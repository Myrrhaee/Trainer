import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Pool, type PoolClient } from "pg";
import { PostgresAccessRepository } from "../../lib/server/access/access-repository";
import { withActorTransaction } from "../../lib/server/database/actor-context";
import { WorkoutSessionRepository, SessionIdempotencyConflictError, SessionVersionConflictError } from "../../lib/server/workout-sessions/workout-session-repository";
import { WorkoutSessionService } from "../../lib/server/workout-sessions/workout-session-service";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";
import { ClientWorkoutRepository } from "../../lib/server/client-workouts/client-workout-repository";
import { ClientWorkoutQueryService } from "../../lib/server/client-workouts/client-workout-query-service";
import { ReviewRepository } from "../../lib/server/reviews/review-repository";
import { TrainerDashboardRepository } from "../../lib/server/trainer-dashboard/trainer-dashboard-repository";
import { TrainerWorkflowTransitionService } from "../../lib/server/trainer-workflow/trainer-workflow-transition-service";
import { buildCanonicalTrainerDashboardView } from "../../components/trainer/canonical-trainer-dashboard-model";
import { CompletionValidationError, completionLogicalRequest, normalizeCompletion } from "../../lib/client-workout-completion-command";

const connectionString = process.env.TEST_DATABASE_URL;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

async function fixture(admin: Pool, app: Pool) {
  const users = await admin.query<{ id: string }>("INSERT INTO app.users(status,display_name) VALUES ('active','R3D Trainer'),('active','R3D Athlete'),('active','R3D Foreign') RETURNING id");
  const [trainer, athlete, foreign] = users.rows.map((row) => ({ userId: row.id }));
  await admin.query("INSERT INTO app.trainer_profiles(user_id,status,activated_at) VALUES ($1,'active',clock_timestamp()),($2,'active',clock_timestamp())", [trainer.userId, foreign.userId]);
  await admin.query("INSERT INTO app.athlete_profiles(user_id,status) VALUES ($1,'active')", [athlete.userId]);
  const relation = await admin.query<{ id: string }>("INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true) RETURNING id", [trainer.userId, athlete.userId]);
  const workouts = new PostgresWorkoutRepository(app);
  const template = await workouts.createPublishedTemplate(trainer, { title: "R3D workout", description: "", generalInstruction: "", estimatedDurationMin: 20,
    exercises: [{ instanceKey: "r3d-squat", title: "Squat", sets: 2, repetitions: 6, targetWeightKg: 50, restSeconds: 90, trainerNote: "" }] });
  let day = 3;
  async function assign() {
    const assignment = await workouts.createAssignment(trainer, { athleteUserId: athlete.userId, templateId: template.id, scheduledFor: `2026-09-${String(++day).padStart(2, "0")}`, trainerNote: "" });
    assert.ok(assignment); return assignment;
  }
  const assignment = await assign();
  const sessions = new WorkoutSessionRepository(app);
  async function start(assignmentId = assignment.id) {
    const session = await sessions.start(athlete, { assignmentId, clientTimezone: "UTC", idempotencyKeyHash: hash(randomUUID()) });
    assert.ok(session); return session;
  }
  return { trainer, athlete, foreign, relationId: relation.rows[0].id, assignment, assign, start, sessions, workouts, template };
}

function command(version: number, patch: Record<string, unknown> = {}) {
  return { expectedVersion: version, idempotencyKey: randomUUID(), zeroResultConfirmed: true, zeroResultReason: "", overallComment: " Original\ncomment ", discomfortReported: true, discomfortComment: " Original discomfort ", ...patch };
}

function observedPool(pool: Pool, fail?: RegExp, beforeQuery?: (sql: string) => Promise<void>, inspectRows?: (sql: string, rows: Record<string, unknown>[]) => void) {
  let queries = 0;
  let failed = false;
  return {
    count: () => queries,
    pool: { async connect() {
      const client = await pool.connect();
      return new Proxy(client, { get(target, property) {
        if (property === "query") return async (...args: Parameters<PoolClient["query"]>) => {
          queries++;
          if (!failed && fail?.test(String(args[0]))) { failed = true; throw new Error("injected_transaction_failure"); }
          await beforeQuery?.(String(args[0]));
          const result = await (target.query as (...values: Parameters<PoolClient["query"]>) => Promise<{ rows: Record<string, unknown>[] }>)(...args);
          inspectRows?.(String(args[0]), result.rows);
          return result;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
    } } as unknown as Pool,
  };
}

test("R3D full completion hash, replay, correlation and runtime query counts", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app", max: 8 });
  try {
    const data = await fixture(admin, app);
    const session = await data.start();
    const observed = observedPool(app);
    const repository = new WorkoutSessionRepository(observed.pool);
    const service = new WorkoutSessionService(repository);
    const reads = new ClientWorkoutQueryService(new ClientWorkoutRepository(observed.pool), repository);
    const counts: Record<string, number> = {};
    let before = observed.count();
    assert.equal((await reads.execution(data.athlete, { sessionId: session.id }))?.session?.version, 1);
    counts.exactRead = observed.count() - before;
    const input = command(1);
    before = observed.count();
    const completed = await service.complete(data.athlete, session.id, input);
    counts.firstCompletion = observed.count() - before;
    assert.ok(completed?.completion?.reviewQueued);
    assert.equal(completed.completion.overallComment, "Original\ncomment");
    assert.equal(completed.completion.discomfortComment, "Original discomfort");
    before = observed.count();
    assert.equal((await service.complete(data.athlete, session.id, input))?.version, 2);
    counts.sameKeyReplay = observed.count() - before;
    assert.equal(completed.attentionItemId, null);
    for (const patch of [{ overallComment: "changed" }, { discomfortReported: false }, { discomfortComment: "changed" }, { zeroResultReason: "changed" }, { zeroResultConfirmed: false }, { expectedVersion: 2 }]) {
      await assert.rejects(service.complete(data.athlete, session.id, { ...input, ...patch }), SessionIdempotencyConflictError);
    }
    assert.equal((await service.complete(data.athlete, session.id, { ...input, idempotencyKey: randomUUID() }))?.version, 2);
    await assert.rejects(service.complete(data.athlete, session.id, { ...input, idempotencyKey: randomUUID(), overallComment: "another tab" }), SessionIdempotencyConflictError);
    const fingerprint = hash(JSON.stringify(completionLogicalRequest(session.id, session.assignmentId, normalizeCompletion(input))));
    before = observed.count();
    const own = await reads.execution(data.athlete, { sessionId: session.id, completionCommandId: input.idempotencyKey, completionFingerprint: fingerprint });
    counts.reconcileRead = observed.count() - before;
    assert.equal(own?.session?.completion?.correlation, "own");
    assert.equal((await reads.execution(data.athlete, { sessionId: session.id, completionCommandId: randomUUID(), completionFingerprint: fingerprint }))?.session?.completion?.correlation, "equivalent");
    assert.equal((await reads.execution(data.athlete, { sessionId: session.id, completionCommandId: input.idempotencyKey, completionFingerprint: hash("wrong") }))?.session?.completion?.correlation, "different");
    assert.equal(await reads.execution(data.foreign, { sessionId: session.id, completionCommandId: input.idempotencyKey, completionFingerprint: fingerprint }), null);
    const reasons = await admin.query("SELECT priority_reasons FROM app.attention_items WHERE source_session_id=$1", [session.id]);
    assert.deepEqual(reasons.rows[0].priority_reasons, ["discomfort", "partial_completion"]);
    const receipts = await admin.query("SELECT request_hash FROM app.workout_session_command_receipts WHERE session_id=$1 AND kind='complete'", [session.id]);
    assert.equal(receipts.rowCount, 1); assert.equal(receipts.rows[0].request_hash, fingerprint);
    assert.equal((await admin.query("SELECT id FROM app.notification_outbox WHERE aggregate_id=$1", [session.id])).rowCount, 1);
    before = observed.count();
    await new TrainerDashboardRepository(observed.pool).snapshot(data.trainer);
    counts.dashboardRefresh = observed.count() - before;
    before = observed.count();
    const review = await new ReviewRepository(observed.pool).findReview(data.trainer, session.id);
    counts.exactReview = observed.count() - before;
    assert.equal(review?.sessionContext.discomfort.status, "ready");
    assert.deepEqual(review?.sessionContext.overallComment, { status: "ready", value: "Original\ncomment" });
    assert.equal(review?.dataAvailability.canAssertNoDeviations, false);
    // Read-boundary fault injection, without weakening database constraints or storing corrupt rows.
    for (const tuple of [[false, "stale"], [true, ""], [null, "not legacy"]]) {
      const faultySource = observedPool(app, undefined, undefined, (sql, rows) => {
        if (sql.includes("session.overall_comment, session.discomfort_reported") && sql.includes("AS relation_status")) {
          for (const row of rows) { row.discomfort_reported = tuple[0]; row.discomfort_comment = tuple[1]; }
        }
      });
      const corrupt = await new ReviewRepository(faultySource.pool).findReview(data.trainer, session.id);
      assert.equal(corrupt?.sessionContext.discomfort.status, "unavailable");
      assert.equal(corrupt?.sessionContext.overallComment.status, "unavailable");
      assert.equal(corrupt?.dataAvailability.canAssertNoDeviations, false);
    }
    console.log("R3D measured repository statements (includes BEGIN/actor/isolation/COMMIT; excludes HTTP auth)", counts);
    assert.equal(counts.exactRead, 11); assert.equal(counts.reconcileRead, 12);
    assert.equal(counts.dashboardRefresh, 12); assert.equal(counts.exactReview, 9);
  } finally { await app.end(); await admin.end(); }
});

test("R3D completion failures atomically roll back context, omissions and all side effects", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app" });
  try {
    const data = await fixture(admin, app);
    for (const boundary of [/UPDATE app.workout_sessions SET status/, /INSERT INTO app.attention_items/, /INSERT INTO app.workout_session_command_receipts/, /INSERT INTO app.audit_events/, /INSERT INTO app.notification_outbox/]) {
      const assignment = await data.assign();
      const session = await data.start(assignment.id);
      const saved = await data.sessions.saveProgress(data.athlete, { sessionId: session.id, expectedVersion: 1, idempotencyKeyHash: hash(randomUUID()), requestHash: hash(randomUUID()),
        sets: [{ setLogId: session.exercises[0].sets[0].id, status: "completed", actualRepetitions: 6, actualDurationSeconds: null, actualWeightKg: 50, rpe: null, athleteComment: "Already committed" }] });
      assert.ok(saved);
      const fault = new WorkoutSessionService(new WorkoutSessionRepository(observedPool(app, boundary).pool));
      await assert.rejects(fault.complete(data.athlete, session.id, command(2)), /injected_transaction_failure/);
      const persisted = await data.sessions.find(data.athlete, session.id);
      assert.equal(persisted?.status, "active"); assert.equal(persisted?.version, 2);
      assert.equal(persisted?.completion?.discomfortReported, null);
      assert.equal(persisted?.completion?.overallComment, null);
      assert.equal(persisted?.exercises[0].sets[0].athleteComment, "Already committed");
      assert.equal(persisted?.exercises[0].sets[1].status, "pending");
      assert.equal((await admin.query("SELECT id FROM app.attention_items WHERE source_session_id=$1", [session.id])).rowCount, 0);
      assert.equal((await admin.query("SELECT id FROM app.workout_session_command_receipts WHERE session_id=$1 AND kind='complete'", [session.id])).rowCount, 0);
      assert.equal((await admin.query("SELECT id FROM app.notification_outbox WHERE aggregate_id=$1", [session.id])).rowCount, 0);
    }
  } finally { await app.end(); await admin.end(); }
});

test("R3D original historical workflow survives suspend/end without roster, profile or new-work rights", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app", max: 8 });
  try {
    const data = await fixture(admin, app);
    const a2 = await data.assign(); const future = await data.assign();
    const s1 = await data.start(); const s2 = await data.start(a2.id);
    const access = new PostgresAccessRepository(app);
    await access.transitionRelation(data.trainer, data.relationId, "suspended");
    assert.equal(await data.sessions.start(data.athlete, { assignmentId: future.id, clientTimezone: "UTC", idempotencyKeyHash: hash(randomUUID()) }), null);
    assert.equal(await data.workouts.createAssignment(data.trainer, { athleteUserId: data.athlete.userId, templateId: data.template.id, scheduledFor: "2026-09-05", trainerNote: "" }), null);
    const reads = new ClientWorkoutQueryService(new ClientWorkoutRepository(app), data.sessions);
    assert.equal((await reads.execution(data.athlete, { sessionId: s1.id }))?.assignment.capabilities.canResume, true);
    assert.equal(await data.sessions.find(data.trainer, s1.id), null);
    const progress = await data.sessions.saveProgress(data.athlete, { sessionId: s1.id, expectedVersion: 1, idempotencyKeyHash: hash(randomUUID()), requestHash: hash(randomUUID()),
      sets: [{ setLogId: s1.exercises[0].sets[0].id, status: "skipped", actualRepetitions: null, actualDurationSeconds: null, actualWeightKg: null, rpe: null, athleteComment: "" }] });
    assert.equal(progress?.version, 2);
    const service = new WorkoutSessionService(data.sessions);
    await service.complete(data.athlete, s1.id, command(2));
    await access.transitionRelation(data.trainer, data.relationId, "active");
    await access.transitionRelation(data.trainer, data.relationId, "suspended");
    await access.transitionRelation(data.trainer, data.relationId, "ended");
    await service.complete(data.athlete, s2.id, command(1, { discomfortReported: false, overallComment: "", discomfortComment: "discard me" }));
    assert.equal(await data.sessions.start(data.athlete, { assignmentId: future.id, clientTimezone: "UTC", idempotencyKeyHash: hash(randomUUID()) }), null);
    const dashboard = new TrainerDashboardRepository(app);
    const snapshot = await dashboard.snapshot(data.trainer);
    assert.equal(snapshot.athletes.length, 0); assert.equal(snapshot.reviews.length, 2);
    assert.equal(snapshot.reviews[0].sessionId, s1.id);
    const view = buildCanonicalTrainerDashboardView(snapshot);
    assert.equal(view.clients.length, 0); assert.equal(view.attentionItems.length, 2);
    const reviews = new ReviewRepository(app);
    const review = await reviews.findReview(data.trainer, s1.id); assert.ok(review);
    assert.equal(review.capabilities.canAssignNext, false); assert.equal(review.capabilities.canOpenAthleteProfile, false);
    const transition = await new TrainerWorkflowTransitionService(dashboard).forReview(data.trainer, review, null, { kind: "current", entityId: review.attention.id, title: "", detail: "" });
    assert.match(transition.returnHref, /^\/trainer\/dashboard/);
    const sent = await reviews.sendFeedback(data.trainer, { sessionId: s1.id, attentionItemId: review.attention.id, kind: "detailed", body: "Original trainer feedback", followUpOfId: null, idempotencyKeyHash: hash(randomUUID()), requestHash: hash(randomUUID()) });
    assert.ok(sent);
    assert.equal((await reviews.listAthleteFeedback(data.athlete, s1.id))[0].id, sent.id);
    assert.equal((await reviews.listSessionFeedback(data.trainer, s1.id))[0].id, sent.id);
    await admin.query("INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true)", [data.foreign.userId, data.athlete.userId]);
    assert.equal(await reviews.findReview(data.foreign, s1.id), null);
    assert.equal(await data.sessions.find(data.foreign, s1.id), null);
    assert.equal((await reviews.listSessionFeedback(data.foreign, s1.id)).length, 0);
    await withActorTransaction(data.trainer, async (client) => {
      assert.equal((await client.query("SELECT user_id FROM app.athlete_profiles WHERE user_id=$1", [data.athlete.userId])).rowCount, 0);
      assert.equal((await client.query("SELECT app.has_terminal_assignment_workflow($1,$2,$3) AS allowed", [s1.assignmentId, data.relationId, data.athlete.userId])).rows[0].allowed, true);
    }, app);
    await withActorTransaction(data.foreign, async (client) => {
      assert.equal((await client.query("SELECT app.has_terminal_assignment_workflow($1,$2,$3) AS allowed", [s1.assignmentId, data.relationId, data.athlete.userId])).rows[0].allowed, false);
    }, app);
    await assert.rejects(withActorTransaction(data.athlete, async (client) => {
      await client.query("UPDATE app.trainer_athlete_relations SET status='suspended' WHERE athlete_user_id=$1 AND status='active'", [data.athlete.userId]);
    }, app), (error: { code: string }) => error.code === "42501");
  } finally { await app.end(); await admin.end(); }
});

test("R3D Start serializes with the exact relation row lock", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app", max: 8 });
  try {
    const data = await fixture(admin, app);
    const locker = await admin.connect();
    try {
      await locker.query("BEGIN");
      await locker.query("SELECT id FROM app.trainer_athlete_relations WHERE id=$1 FOR UPDATE", [data.relationId]);
      let settled = false;
      const starting = data.sessions.start(data.athlete, { assignmentId: data.assignment.id, clientTimezone: "UTC", idempotencyKeyHash: hash(randomUUID()) }).finally(() => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(settled, false);
      await locker.query("UPDATE app.trainer_athlete_relations SET status='suspended' WHERE id=$1", [data.relationId]);
      await locker.query("COMMIT");
      assert.equal(await starting, null);
    } finally { await locker.query("ROLLBACK"); locker.release(); }
  } finally { await app.end(); await admin.end(); }
});

test("R3D Start-first holds the relation lock through persistence before suspension", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app", max: 8 });
  let release = () => {};
  try {
    const data = await fixture(admin, app);
    let reached = () => {};
    const locked = new Promise<void>((resolve) => { reached = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const paused = observedPool(app, undefined, async (sql) => {
      if (sql.startsWith("INSERT INTO app.workout_sessions")) { reached(); await gate; }
    });
    const starting = new WorkoutSessionRepository(paused.pool).start(data.athlete, {
      assignmentId: data.assignment.id, clientTimezone: "UTC", idempotencyKeyHash: hash(randomUUID()),
    });
    await locked;
    let suspended = false;
    const suspending = new PostgresAccessRepository(app).transitionRelation(data.trainer, data.relationId, "suspended").finally(() => { suspended = true; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(suspended, false);
    release();
    const session = await starting; assert.ok(session);
    await suspending;
    assert.equal((await data.sessions.find(data.athlete, session.id))?.status, "active");
    const complete = await new WorkoutSessionService(data.sessions).complete(data.athlete, session.id, command(1));
    assert.ok(complete?.completion?.reviewQueued);
  } finally { release(); await app.end(); await admin.end(); }
});

test("R3D priority matrix comes only from explicit context and persisted omissions", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  const app = new Pool({ connectionString, options: "-c role=ai_strength_app" });
  try {
    const data = await fixture(admin, app);
    for (const discomfort of [false, true]) for (const omissions of [false, true]) {
      const session = await data.start((await data.assign()).id);
      let version = 1;
      if (!omissions) {
        await data.sessions.saveProgress(data.athlete, { sessionId: session.id, expectedVersion: 1,
          idempotencyKeyHash: hash(randomUUID()), requestHash: hash(randomUUID()),
          sets: session.exercises[0].sets.map((set) => ({ setLogId: set.id, status: "completed" as const,
            actualRepetitions: 6, actualDurationSeconds: null, actualWeightKg: 50, rpe: null, athleteComment: "" })),
        });
        version++;
      }
      await new WorkoutSessionService(data.sessions).complete(data.athlete, session.id, command(version, { discomfortReported: discomfort }));
      const expected = [...(discomfort ? ["discomfort"] : []), ...(omissions ? ["partial_completion"] : [])];
      assert.deepEqual((await admin.query("SELECT priority_reasons FROM app.attention_items WHERE source_session_id=$1", [session.id])).rows[0].priority_reasons, expected);
    }
  } finally { await app.end(); await admin.end(); }
});

test("R3D rejects missing context, stale versions and active context writes; terminal context is immutable", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString }); const app = new Pool({ connectionString, options: "-c role=ai_strength_app" });
  try {
    const data = await fixture(admin, app); const session = await data.start(); const service = new WorkoutSessionService(data.sessions);
    await assert.rejects(service.complete(data.athlete, session.id, { expectedVersion: 1, zeroResultConfirmed: true, idempotencyKey: randomUUID() }), CompletionValidationError);
    await assert.rejects(service.complete(data.athlete, session.id, command(2)), SessionVersionConflictError);
    await assert.rejects(withActorTransaction(data.athlete, async (client) => {
      await client.query("UPDATE app.workout_sessions SET overall_comment='not completion',version=version+1 WHERE id=$1", [session.id]);
    }, app), (error: { code: string }) => error.code === "23514");
    for (const tuple of [[false, "stale"], [true, " \n "], [null, null]]) {
      await assert.rejects(withActorTransaction(data.athlete, async (client) => {
        await client.query("UPDATE app.workout_sessions SET status='completed',completed_at=clock_timestamp(),version=version+1,discomfort_reported=$2,discomfort_comment=$3 WHERE id=$1", [session.id, ...tuple]);
      }, app), (error: { code: string }) => error.code === "23514");
    }
    await service.complete(data.athlete, session.id, command(1, { discomfortReported: false, discomfortComment: "hidden", overallComment: "\u{1f600}".repeat(2000) }));
    await assert.rejects(admin.query("UPDATE app.workout_sessions SET overall_comment='changed',version=version+1 WHERE id=$1", [session.id]), (error: { code: string }) => error.code === "23514");
    assert.equal((await data.sessions.find(data.athlete, session.id))?.completion?.discomfortComment, null);
  } finally { await app.end(); await admin.end(); }
});

test("R3D real 0015-to-0016 upgrade preserves legacy nulls and old completion receipts", { skip: !connectionString }, async () => {
  const name = `ai_strength_r3d_upgrade_${process.pid}`;
  const server = new URL(connectionString!); server.pathname = "/postgres";
  const management = new Pool({ connectionString: server.toString() });
  const target = new URL(connectionString!); target.pathname = `/${name}`;
  const admin = new Pool({ connectionString: target.toString() });
  const app = new Pool({ connectionString: target.toString(), options: "-c role=ai_strength_app" });
  try {
    await management.query(`CREATE DATABASE ${name}`);
    const env = { ...process.env, DATABASE_MIGRATION_URL: target.toString() };
    const run = (args: string[]) => execFileSync(process.execPath, args, { env, stdio: "pipe", maxBuffer: 8 * 1024 * 1024 });
    run(["scripts/db/bootstrap.mjs"]);
    run(["scripts/db/migrate.mjs", "--through", "0015_workout_template_command_hardening"]);
    const data = await fixture(admin, app);
    const oldPayload = { expectedVersion: 1, zeroResultConfirmed: true, zeroResultReason: "Legacy reason" };
    const key = randomUUID();
    const legacy = await admin.query<{ id: string }>(`INSERT INTO app.workout_sessions
      (assignment_id,relation_id,trainer_user_id,athlete_user_id,status,version,start_idempotency_key_hash,completed_at,zero_result_reason)
      VALUES ($1,$2,$3,$4,'completed_with_omissions',2,$5,clock_timestamp(),$6) RETURNING id`,
      [data.assignment.id, data.relationId, data.trainer.userId, data.athlete.userId, hash(randomUUID()), oldPayload.zeroResultReason]);
    const id = legacy.rows[0].id;
    await admin.query("INSERT INTO app.workout_session_command_receipts(session_id,actor_user_id,kind,idempotency_key_hash,request_hash,result_version) VALUES ($1,$2,'complete',$3,$4,2)", [id, data.athlete.userId, hash(key), hash(JSON.stringify(oldPayload))]);
    await admin.query("INSERT INTO app.attention_items(trainer_user_id,athlete_user_id,relation_id,source_session_id) VALUES ($1,$2,$3,$4)", [data.trainer.userId, data.athlete.userId, data.relationId, id]);
    const next = await data.assign();
    const oldActive = await admin.query<{ id: string }>("INSERT INTO app.workout_sessions(assignment_id,relation_id,trainer_user_id,athlete_user_id,start_idempotency_key_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id", [next.id, data.relationId, data.trainer.userId, data.athlete.userId, hash(randomUUID())]);
    run(["scripts/db/migrate.mjs"]);
    assert.deepEqual((await admin.query("SELECT overall_comment,discomfort_reported,discomfort_comment FROM app.workout_sessions WHERE id=$1", [id])).rows[0], { overall_comment: null, discomfort_reported: null, discomfort_comment: null });
    const service = new WorkoutSessionService(new WorkoutSessionRepository(app));
    assert.equal((await service.complete(data.athlete, id, { ...oldPayload, idempotencyKey: key }))?.version, 2);
    await assert.rejects(service.complete(data.athlete, id, { ...oldPayload, idempotencyKey: key, zeroResultReason: "changed" }), SessionIdempotencyConflictError);
    await assert.rejects(service.complete(data.athlete, oldActive.rows[0].id, { ...oldPayload, idempotencyKey: randomUUID() }), CompletionValidationError);
    assert.equal((await service.complete(data.athlete, oldActive.rows[0].id, command(1, { discomfortReported: false })))?.completion?.discomfortReported, false);
    const review = await new ReviewRepository(app).findReview(data.trainer, id);
    assert.equal(review?.sessionContext.discomfort.status, "unsupported");
    assert.equal(review?.sessionContext.overallComment.status, "unsupported");
    const ddl = await admin.connect();
    try {
      await ddl.query("BEGIN"); await ddl.query("SET LOCAL ROLE ai_strength_migrator");
      await ddl.query(readFileSync("database/migrations/0016_workout_session_completion.down.sql", "utf8"));
      assert.equal((await ddl.query("SELECT column_name FROM information_schema.columns WHERE table_schema='app' AND table_name='workout_sessions' AND column_name='discomfort_reported'")).rowCount, 0);
    } finally { await ddl.query("ROLLBACK"); ddl.release(); }
  } finally {
    await app.end(); await admin.end();
    await management.query(`DROP DATABASE IF EXISTS ${name}`); await management.end();
  }
});
