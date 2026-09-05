import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool, type PoolClient } from "pg";

import type { Actor } from "../../lib/server/database/actor-context";
import { WorkoutSessionRepository, SessionIdempotencyConflictError, SessionVersionConflictError } from "../../lib/server/workout-sessions/workout-session-repository";
import { WorkoutSessionService, WorkoutSessionValidationError } from "../../lib/server/workout-sessions/workout-session-service";
import type { ProgressSetInput, WorkoutSession } from "../../lib/server/workout-sessions/workout-session-types";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

function setResult(setLogId: string, repetitions = 8): ProgressSetInput {
  return { setLogId, status: "completed", actualRepetitions: repetitions,
    actualDurationSeconds: null, actualWeightKg: 0, rpe: null, athleteComment: "Atomic batch" };
}

function batch(session: WorkoutSession) {
  return { expectedVersion: session.version, idempotencyKey: randomUUID(),
    sets: session.exercises[0].sets.map((set) => setResult(set.id)) };
}

function hookedPool(pool: Pool, hook: (sql: string, query: () => Promise<unknown>, client: PoolClient) => Promise<unknown>) {
  return { async connect() {
    const client = await pool.connect();
    return new Proxy(client, { get(target, property) {
      if (property === "query") return (...args: Parameters<PoolClient["query"]>) => {
        const sql = typeof args[0] === "string" ? args[0] : "";
        return hook(sql, () => (target.query as (...args: Parameters<PoolClient["query"]>) => Promise<unknown>)(...args), target);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  } } as unknown as Pool;
}

test("R4 batch Save is atomic under validation, replay, write faults and Complete serialization", {
  skip: !connectionString,
}, async (t) => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  const repository = new WorkoutSessionRepository(app);
  const service = new WorkoutSessionService(repository);
  const workouts = new PostgresWorkoutRepository(app);
  try {
    async function account(role: "trainer" | "athlete"): Promise<Actor> {
      const { rows } = await admin.query<{ id: string }>(
        "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id", [`R4 ${role}`]);
      await admin.query(role === "trainer"
        ? "INSERT INTO app.trainer_profiles (user_id,status,activated_at) VALUES ($1,'active',clock_timestamp())"
        : "INSERT INTO app.athlete_profiles (user_id,status) VALUES ($1,'active')", [rows[0].id]);
      return { userId: rows[0].id };
    }
    const trainer = await account("trainer");
    const athlete = await account("athlete");
    const foreign = await account("athlete");
    await admin.query(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true),($1,$3,'active',true)`,
    [trainer.userId, athlete.userId, foreign.userId]);
    const template = await workouts.createPublishedTemplate(trainer, {
      title: "R4 atomic results", description: "", estimatedDurationMin: null, generalInstruction: "Record actual facts",
      exercises: [{ instanceKey: "r4-squat", title: "R4 squat", sets: 2, repetitions: 8, targetWeightKg: null, restSeconds: 60, trainerNote: "" }],
    });
    async function start(actor = athlete) {
      const assignment = await workouts.createAssignment(trainer, {
        athleteUserId: actor.userId, templateId: template.id,
        templateRevisionId: template.revisionId, scheduledFor: "2026-09-04", trainerNote: "",
      });
      assert.ok(assignment);
      const result = await service.start(actor, { assignmentId: assignment.id,
        clientTimezone: "Europe/Moscow", idempotencyKey: randomUUID() });
      assert.ok(result);
      return result.session;
    }
    async function snapshot(session: WorkoutSession, actor = athlete) {
      const persisted = await repository.find(actor, session.id);
      const receipts = await admin.query("SELECT * FROM app.workout_session_command_receipts WHERE session_id=$1 ORDER BY id", [session.id]);
      const audit = await admin.query("SELECT * FROM app.audit_events WHERE metadata->>'session_id'=$1 ORDER BY id", [session.id]);
      const attention = await admin.query("SELECT * FROM app.attention_items WHERE source_session_id=$1 ORDER BY id", [session.id]);
      return { persisted, receipts: receipts.rows, audit: audit.rows, attention: attention.rows };
    }
    async function unchanged(session: WorkoutSession, command: () => Promise<unknown>) {
      const before = await snapshot(session);
      await command();
      assert.deepEqual(await snapshot(session), before);
    }

    for (const invalidFirst of [false, true]) {
      await t.test(invalidFirst ? "invalid first + valid second writes nothing" : "valid first + invalid second preserves existing actuals", async () => {
        let session = await start();
        session = (await service.saveProgress(athlete, session.id, batch(session)))!;
        const request = batch(session);
        request.sets = invalidFirst
          ? [setResult(randomUUID()), setResult(session.exercises[0].sets[1].id, 11)]
          : [setResult(session.exercises[0].sets[0].id, 11), setResult(randomUUID())];
        let writes = 0;
        const observed = new WorkoutSessionService(new WorkoutSessionRepository(hookedPool(app, async (sql, query) => {
          if (/^UPDATE app\.workout_set_logs target/.test(sql)) writes++;
          return query();
        })));
        await unchanged(session, async () => assert.equal(await observed.saveProgress(athlete, session.id, request), null));
        assert.equal(writes, 0, "all targets must be resolved before even the first write");
      });
    }
    await t.test("valid + foreign Set fails closed for both actors", async () => {
      const session = await start();
      const other = await start(foreign);
      const foreignBefore = await snapshot(other, foreign);
      const request = batch(session);
      request.sets[1] = setResult(other.exercises[0].sets[0].id);
      await unchanged(session, async () => assert.equal(await service.saveProgress(athlete, session.id, request), null));
      assert.deepEqual(await snapshot(other, foreign), foreignBefore);
    });
    await t.test("duplicate target fails service validation without writes", async () => {
      const session = await start();
      const request = batch(session);
      request.sets[1] = request.sets[0];
      await unchanged(session, async () => {
        await assert.rejects(async () => service.saveProgress(athlete, session.id, request),
          (error: unknown) => error instanceof WorkoutSessionValidationError && error.message === "duplicate_sets");
      });
    });
    await t.test("stale version writes nothing", async () => {
      const session = await start();
      const stale = batch(session);
      await service.saveProgress(athlete, session.id, batch(session));
      await unchanged(session, () => assert.rejects(service.saveProgress(athlete, session.id, stale), SessionVersionConflictError));
    });
    await t.test("full normalized batch replays once and changed batch conflicts", async () => {
      const session = await start();
      const request = batch(session);
      request.sets[1] = { ...request.sets[1], actualWeightKg: null };
      const saved = await service.saveProgress(athlete, session.id, request);
      assert.ok(saved);
      assert.equal(saved.version, session.version + 1);
      assert.deepEqual(saved.exercises[0].sets.map((set) => [set.status, set.actualRepetitions, set.actualWeightKg]),
        [["completed", 8, 0], ["completed", 8, null]]);
      const after = await snapshot(session);
      assert.equal(after.receipts.length, 1);
      assert.equal(after.receipts[0].result_version, 2);
      assert.equal(after.audit.filter((row) => row.event_type === "workout.session.progress_saved").length, 1);
      assert.deepEqual(await service.saveProgress(athlete, session.id, request), saved);
      assert.deepEqual(await snapshot(session), after);
      const changed = { ...request, sets: [request.sets[0], { ...request.sets[1], actualRepetitions: 9 }] };
      await assert.rejects(service.saveProgress(athlete, session.id, changed), SessionIdempotencyConflictError);
      assert.deepEqual(await snapshot(session), after);
    });
    for (const failure of ["database-after-first-write", "missing-second-write", "database-after-receipt"] as const) {
      await t.test(`${failure} rolls back all facts/version/receipt/audit`, async () => {
        const session = await start();
        let writes = 0;
        let injected = false;
        const failing = new WorkoutSessionService(new WorkoutSessionRepository(hookedPool(app, async (sql, query, client) => {
          const write = /^UPDATE app\.workout_set_logs target/.test(sql);
          if (write) writes++;
          if (failure === "missing-second-write" && write && writes === 2) {
            injected = true;
            return { rowCount: 0, rows: [] };
          }
          const result = await query();
          if ((failure === "database-after-first-write" && write && writes === 1)
            || (failure === "database-after-receipt" && sql.includes("INSERT INTO app.workout_session_command_receipts"))) {
            injected = true;
            await client.query("SELECT 1 / 0");
          }
          return result;
        })));
        await unchanged(session, () => assert.rejects(failing.saveProgress(athlete, session.id, batch(session)),
          failure === "missing-second-write" ? SessionVersionConflictError : /division by zero/));
        assert.ok(injected);
        assert.ok(writes >= 1);
      });
    }
    await t.test("lost response after committed batch reconciles exact Session and same key", async () => {
      const session = await start();
      const request = batch(session);
      await service.saveProgress(athlete, session.id, request); // Intentionally discard the response.
      const exact = await service.find(athlete, session.id);
      assert.equal(exact?.id, session.id);
      assert.equal(exact?.assignmentId, session.assignmentId);
      assert.equal(exact?.version, 2);
      const beforeReplay = await snapshot(session);
      assert.deepEqual(await service.saveProgress(athlete, session.id, request), exact);
      assert.deepEqual(await snapshot(session), beforeReplay);
    });
    await t.test("Complete waits for whole batch; stale Complete cannot commit an intermediate state", async () => {
      const session = await start();
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const completeLock = Promise.withResolvers<void>();
      let held = false;
      const saving = new WorkoutSessionService(new WorkoutSessionRepository(hookedPool(app, async (sql, query) => {
        const result = await query();
        if (!held && /^UPDATE app\.workout_set_logs target/.test(sql)) {
          held = true;
          entered.resolve();
          await release.promise;
        }
        return result;
      })));
      const completing = new WorkoutSessionService(new WorkoutSessionRepository(hookedPool(app, async (sql, query) => {
        const result = query();
        if (sql.includes("FOR UPDATE")) completeLock.resolve();
        return result;
      })));
      const save = saving.saveProgress(athlete, session.id, batch(session));
      await entered.promise;
      const completion = { expectedVersion: 1, idempotencyKey: randomUUID(), discomfortReported: false,
        overallComment: "R4 completion", discomfortComment: null, zeroResultConfirmed: false, zeroResultReason: "" };
      const rejected = assert.rejects(completing.complete(athlete, session.id, completion), SessionVersionConflictError);
      try {
        await completeLock.promise;
        const during = await repository.find(athlete, session.id);
        assert.equal(during?.version, 1);
        assert.ok(during?.exercises[0].sets.every((set) => set.status === "pending"));
      } finally { release.resolve(); }
      assert.equal((await save)?.version, 2);
      await rejected;
      const terminal = await service.complete(athlete, session.id, { ...completion, expectedVersion: 2 });
      assert.equal(terminal?.status, "completed");
      assert.equal(terminal?.version, 3);
      assert.ok(terminal?.exercises[0].sets.every((set) => set.actualRepetitions === 8));
      await unchanged(session, async () => assert.equal(await service.saveProgress(athlete, session.id,
        { ...batch(session), expectedVersion: 3 }), null));
    });
  } finally {
    await app.end();
    await admin.end();
  }
});
