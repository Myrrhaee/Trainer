import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { AthleteTrainingInvalidCursorError } from "../../lib/server/athlete-profile/athlete-training-cursor";
import { AthleteTrainingQueryService } from "../../lib/server/athlete-profile/athlete-training-query-service";
import { AthleteTrainingRepository } from "../../lib/server/athlete-profile/athlete-training-repository";
import type { Actor } from "../../lib/server/database/actor-context";
import { ReviewRepository } from "../../lib/server/reviews/review-repository";
import { WorkoutSessionRepository } from "../../lib/server/workout-sessions/workout-session-repository";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

test("athlete training read model authorizes relation scope and fails closed when suspended", {
  skip: !connectionString,
}, async () => {
  const context = pools();
  try {
    const trainer = await user(context.admin, "R2A Scope Trainer", "trainer");
    const stranger = await user(context.admin, "R2A Scope Stranger", "trainer");
    const athlete = await user(context.admin, "R2A Scope Athlete", "athlete");
    const relationId = await relate(context.admin, trainer, athlete);
    const service = trainingService(context.app);

    const empty = await service.find(trainer, athlete.userId);
    assert.ok(empty);
    assert.equal(empty.current.focus.kind, "no_next_assignment");
    assert.equal(empty.current.pendingReviews.totalCount, 0);
    assert.equal(empty.current.activeExecution.totalCount, 0);
    assert.equal(empty.current.nextAssignment.totalCount, 0);
    assert.deepEqual(empty.history.items, []);
    assert.equal(empty.relation.capabilities.canAssign, true);
    assert.equal(await service.find(stranger, athlete.userId), null);
    assert.equal(await service.find(athlete, athlete.userId), null);

    await context.admin.query(
      "UPDATE app.trainer_athlete_relations SET status = 'suspended' WHERE id = $1",
      [relationId],
    );
    const suspended = await service.find(trainer, athlete.userId);
    assert.ok(suspended);
    assert.equal(suspended.current.focus.kind, "relation_unavailable");
    assert.equal(suspended.relation.capabilities.canReadTraining, false);
    assert.equal(suspended.relation.capabilities.canAssign, false);
    assert.equal(suspended.relation.capabilities.canReview, false);
    assert.equal(suspended.dataAvailability.currentStatus, "unavailable");
    assert.equal(suspended.dataAvailability.historyStatus, "unavailable");
    assert.deepEqual(suspended.history.items, []);
  } finally {
    await context.close();
  }
});

test("athlete training current projection keeps reviews, active execution, next assignment and feedback independent", {
  skip: !connectionString,
}, async () => {
  const context = pools();
  try {
    const fixture = await coachingFixture(context, "R2A Current");
    const completed: Array<Awaited<ReturnType<typeof complete>>> = [];
    for (let index = 0; index < 3; index += 1) {
      const assignment = await assign(fixture, `2026-08-${10 + index}`);
      completed.push(await complete(fixture, assignment.id, `current-completed-${index}`, index === 0));
    }

    const feedback = await new ReviewRepository(context.app).sendFeedback(fixture.trainer, {
      attentionItemId: completed[0].attentionItemId,
      sessionId: completed[0].sessionId,
      kind: "detailed",
      body: "Сохраняем технику и рабочий темп.",
      followUpOfId: null,
      idempotencyKeyHash: hash("r2a-current-feedback"),
      requestHash: hash("r2a-current-feedback-body"),
    });
    assert.ok(feedback);

    const activeOne = await assign(fixture, "2026-08-20");
    const activeTwo = await assign(fixture, "2026-08-21");
    const sessions = new WorkoutSessionRepository(context.app);
    const startedOne = await sessions.start(fixture.athlete, {
      assignmentId: activeOne.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("r2a-active-one"),
    });
    const startedTwo = await sessions.start(fixture.athlete, {
      assignmentId: activeTwo.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("r2a-active-two"),
    });
    assert.ok(startedOne);
    assert.ok(startedTwo);

    const nextOne = await assign(fixture, "2026-08-24");
    await assign(fixture, "2026-08-25");

    const before = await persistedState(context.admin, fixture.relationId);
    const service = trainingService(context.app);
    const model = await service.find(fixture.trainer, fixture.athlete.userId, { first: 10 });
    assert.ok(model);

    assert.equal(model.current.focus.kind, "review_required");
    assert.equal(model.current.pendingReviews.totalCount, 2);
    assert.equal(model.current.pendingReviews.items.length, 2);
    assert.equal(model.current.pendingReviews.items.some(
      (item) => item.attentionItemId === completed[0].attentionItemId,
    ), false);
    assert.equal(model.current.activeExecution.totalCount, 2);
    assert.equal(model.current.activeExecution.conflict, "multiple_active_sessions");
    assert.equal(model.current.activeExecution.primary?.sessionId, startedTwo.id);
    assert.equal(model.current.nextAssignment.primary?.assignmentId, nextOne.id);
    assert.equal(model.current.nextAssignment.totalCount, 2);
    assert.equal(model.current.latestFeedback?.feedbackId, feedback.id);
    assert.equal(model.current.latestFeedback?.sessionId, completed[0].sessionId);
    assert.equal(model.current.latestFeedback?.assignmentId, completed[0].assignmentId);
    assert.deepEqual(model.dataAvailability.anomalies, ["multiple_active_sessions"]);

    assert.equal(model.history.items.length, 3);
    assert.equal(model.history.items.some((item) => item.session?.status === "active"), false);
    assert.equal(model.history.items.some((item) => item.assignment.id === nextOne.id), false);
    const reviewed = model.history.items.find((item) => item.session?.id === completed[0].sessionId);
    assert.equal(reviewed?.attention?.status, "resolved");
    assert.equal(reviewed?.attention?.resolutionKind, "feedback");
    assert.equal(reviewed?.feedback.latestFeedbackId, feedback.id);
    assert.equal(reviewed?.hasPersistedComment, true);
    assert.equal(reviewed?.destination.assignmentId, completed[0].assignmentId);
    assert.equal(reviewed?.destination.sessionId, completed[0].sessionId);

    const repeated = await service.find(fixture.trainer, fixture.athlete.userId, { first: 10 });
    assert.ok(repeated);
    assert.deepEqual(normalizeReadTime(repeated), normalizeReadTime(model));
    assert.deepEqual(await persistedState(context.admin, fixture.relationId), before);
  } finally {
    await context.close();
  }
});

test("athlete training history is deterministic, cursor-paginated and athlete-bound", {
  skip: !connectionString,
}, async () => {
  const context = pools();
  try {
    const fixture = await coachingFixture(context, "R2A History");
    const completed: Array<Awaited<ReturnType<typeof complete>>> = [];
    for (let index = 0; index < 6; index += 1) {
      const assignment = await assign(fixture, `2026-07-${10 + index}`);
      completed.push(await complete(fixture, assignment.id, `history-completed-${index}`));
    }
    const cancelled = await assign(fixture, "2026-07-20");
    await context.admin.query(`UPDATE app.workout_assignments
      SET status = 'cancelled', cancelled_at = clock_timestamp() WHERE id = $1`, [cancelled.id]);
    const available = await assign(fixture, "2026-09-01");

    const otherAthlete = await user(context.admin, "R2A Other Athlete", "athlete");
    await relate(context.admin, fixture.trainer, otherAthlete);
    const service = trainingService(context.app);

    const first = await service.find(fixture.trainer, fixture.athlete.userId, { first: 3 });
    assert.ok(first);
    assert.equal(first.history.items.length, 3);
    assert.equal(first.history.pageInfo.hasNextPage, true);
    assert.ok(first.history.pageInfo.endCursor);
    assert.equal(first.current.nextAssignment.primary?.assignmentId, available.id);
    assert.equal(first.current.nextAssignment.totalCount, 1);

    const second = await service.find(fixture.trainer, fixture.athlete.userId, {
      first: 3,
      after: first.history.pageInfo.endCursor,
    });
    assert.ok(second);
    assert.equal(second.history.items.length, 3);
    assert.equal(second.history.pageInfo.hasNextPage, true);
    const third = await service.find(fixture.trainer, fixture.athlete.userId, {
      first: 3,
      after: second.history.pageInfo.endCursor,
    });
    assert.ok(third);
    assert.equal(third.history.items.length, 1);
    assert.equal(third.history.pageInfo.hasNextPage, false);
    assert.equal(third.history.pageInfo.endCursor, null);

    const all = [...first.history.items, ...second.history.items, ...third.history.items];
    assert.equal(new Set(all.map((item) => item.assignment.id)).size, 7);
    assert.equal(all.some((item) => item.assignment.id === available.id), false);
    assert.equal(all.some((item) => item.assignment.id === cancelled.id), true);
    assert.deepEqual(
      all.map((item) => item.sortAt),
      [...all].map((item) => item.sortAt).sort().reverse(),
    );
    assert.deepEqual(
      new Set(all.map((item) => item.session?.id).filter(Boolean)),
      new Set(completed.map((item) => item.sessionId)),
    );

    await assert.rejects(
      service.find(fixture.trainer, otherAthlete.userId, {
        first: 3,
        after: first.history.pageInfo.endCursor,
      }),
      AthleteTrainingInvalidCursorError,
    );
  } finally {
    await context.close();
  }
});

function pools() {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 12, options: "-c role=ai_strength_app" });
  return {
    admin,
    app,
    close: () => Promise.all([admin.end(), app.end()]),
  };
}

async function user(pool: Pool, displayName: string, kind: "trainer" | "athlete"): Promise<Actor> {
  const account = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  if (kind === "trainer") {
    await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
      VALUES ($1, 'active', clock_timestamp())`, [account.rows[0].id]);
  } else {
    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [account.rows[0].id]);
  }
  return { userId: account.rows[0].id };
}

async function relate(pool: Pool, trainer: Actor, athlete: Actor) {
  const result = await pool.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, 'active', true) RETURNING id`, [trainer.userId, athlete.userId]);
  return result.rows[0].id;
}

async function coachingFixture(context: ReturnType<typeof pools>, label: string) {
  const trainer = await user(context.admin, `${label} Trainer`, "trainer");
  const athlete = await user(context.admin, `${label} Athlete`, "athlete");
  const relationId = await relate(context.admin, trainer, athlete);
  const workouts = new PostgresWorkoutRepository(context.app);
  const template = await workouts.createPublishedTemplate(trainer, {
    title: `${label} Strength`,
    description: "Canonical R2A fixture",
    generalInstruction: "Записывать каждый подход.",
    estimatedDurationMin: 35,
    exercises: [{
      instanceKey: `${label.toLowerCase().replaceAll(" ", "-")}-press`,
      title: "Жим лёжа",
      sets: 2,
      repetitions: 8,
      targetWeightKg: 50,
      restSeconds: 90,
      trainerNote: "",
    }],
  });
  return { trainer, athlete, relationId, workouts, templateId: template.id, context };
}

async function assign(fixture: Awaited<ReturnType<typeof coachingFixture>>, scheduledFor: string) {
  const assignment = await fixture.workouts.createAssignment(fixture.trainer, {
    athleteUserId: fixture.athlete.userId,
    templateId: fixture.templateId,
    scheduledFor,
    trainerNote: "",
  });
  assert.ok(assignment);
  return assignment;
}

async function complete(
  fixture: Awaited<ReturnType<typeof coachingFixture>>,
  assignmentId: string,
  key: string,
  withComment = false,
) {
  const repository = new WorkoutSessionRepository(fixture.context.app);
  let session = await repository.start(fixture.athlete, {
    assignmentId,
    clientTimezone: "Europe/Moscow",
    idempotencyKeyHash: hash(`${key}-start`),
  });
  assert.ok(session);
  if (withComment) {
    session = await repository.saveProgress(fixture.athlete, {
      sessionId: session.id,
      expectedVersion: session.version,
      idempotencyKeyHash: hash(`${key}-progress`),
      requestHash: hash(`${key}-progress-request`),
      sets: [{
        setLogId: session.exercises[0].sets[0].id,
        status: "completed",
        actualRepetitions: 8,
        actualDurationSeconds: null,
        actualWeightKg: 50,
        rpe: 8,
        athleteComment: "Последний повтор был тяжёлым.",
      }],
    });
    assert.ok(session);
  }
  const completed = await repository.complete(fixture.athlete, {
    sessionId: session.id,
    expectedVersion: session.version,
    idempotencyKeyHash: hash(`${key}-complete`),
    requestHash: hash(`${key}-complete-request`),
    zeroResultConfirmed: !withComment,
    zeroResultReason: withComment ? "" : "Тестовый цикл без результатов",
  });
  assert.ok(completed);
  const attention = await fixture.context.admin.query<{ id: string }>(
    "SELECT id FROM app.attention_items WHERE source_session_id = $1",
    [session.id],
  );
  return { assignmentId, sessionId: session.id, attentionItemId: attention.rows[0].id };
}

function trainingService(pool: Pool) {
  return new AthleteTrainingQueryService(new AthleteTrainingRepository(pool));
}

async function persistedState(pool: Pool, relationId: string) {
  const result = await pool.query<{ state: unknown }>(`SELECT jsonb_build_object(
    'assignments', (SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status) ORDER BY id)
      FROM app.workout_assignments WHERE relation_id = $1),
    'sessions', (SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status, 'version', version) ORDER BY id)
      FROM app.workout_sessions WHERE relation_id = $1),
    'attention', (SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status, 'resolvedAt', resolved_at) ORDER BY id)
      FROM app.attention_items WHERE relation_id = $1),
    'feedback', (SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind) ORDER BY id)
      FROM app.trainer_feedback WHERE relation_id = $1)
  ) AS state`, [relationId]);
  return result.rows[0].state;
}

function normalizeReadTime<T extends { scope: { readAt: string } }>(model: T) {
  return { ...model, scope: { ...model.scope, readAt: "<read-at>" } };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
