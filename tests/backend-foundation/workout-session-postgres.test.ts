import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";
import {
  SessionIdempotencyConflictError,
  SessionVersionConflictError,
  WorkoutSessionRepository,
  ZeroResultConfirmationRequiredError,
} from "../../lib/server/workout-sessions/workout-session-repository";
import type { ProgressSetInput } from "../../lib/server/workout-sessions/workout-session-types";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function user(pool: Pool, displayName: string, kind: "trainer" | "athlete") {
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

async function fixture(admin: Pool, app: Pool, label: string) {
  const trainer = await user(admin, `${label} Trainer`, "trainer");
  const athlete = await user(admin, `${label} Athlete`, "athlete");
  const relation = await admin.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, 'active', true) RETURNING id`, [trainer.userId, athlete.userId]);
  const workouts = new PostgresWorkoutRepository(app);
  const template = await workouts.createPublishedTemplate(trainer, {
    title: `${label} Full body`,
    description: "Execution test",
    generalInstruction: "Controlled tempo",
    estimatedDurationMin: 30,
    exercises: [{
      instanceKey: `${label}-squat`, title: "Squat", sets: 2, repetitions: 6,
      targetWeightKg: 60, restSeconds: 90, trainerNote: "",
    }],
  });
  const assignment = await workouts.createAssignment(trainer, {
    athleteUserId: athlete.userId,
    templateId: template.id,
    scheduledFor: "2026-08-12",
    trainerNote: "Execution test",
  });
  assert.ok(assignment);
  return { trainer, athlete, relationId: relation.rows[0].id, assignment };
}

function completed(setLogId: string): ProgressSetInput {
  return {
    setLogId,
    status: "completed",
    actualRepetitions: 6,
    actualDurationSeconds: null,
    actualWeightKg: 62.5,
    rpe: 8,
    athleteComment: "Good",
  };
}

test("one assignment starts one resumable session and progress commands are durable", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const repository = new WorkoutSessionRepository(app);
  try {
    const data = await fixture(admin, app, "B7 durable");
    const startInput = {
      assignmentId: data.assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("start-b7-durable"),
    };
    const [first, concurrent] = await Promise.all([
      repository.start(data.athlete, startInput),
      repository.start(data.athlete, startInput),
    ]);
    assert.ok(first);
    assert.ok(concurrent);
    assert.equal(concurrent.id, first.id);
    assert.equal(first.exercises.length, 1);
    assert.equal(first.exercises[0].sets.length, 2);

    const count = await admin.query<{ count: string }>(
      "SELECT count(*)::text FROM app.workout_sessions WHERE assignment_id = $1",
      [data.assignment.id],
    );
    assert.equal(Number(count.rows[0].count), 1);

    const request = {
      sessionId: first.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("progress-b7-durable"),
      requestHash: hash("same-progress-payload"),
      sets: [completed(first.exercises[0].sets[0].id)],
    };
    const [saved, retried] = await Promise.all([
      repository.saveProgress(data.athlete, request),
      repository.saveProgress(data.athlete, request),
    ]);
    assert.equal(saved?.version, 2);
    assert.equal(retried?.version, 2);
    assert.equal(saved?.exercises[0].sets[0].actualWeightKg, 62.5);

    await assert.rejects(
      repository.saveProgress(data.athlete, { ...request, requestHash: hash("changed-payload") }),
      SessionIdempotencyConflictError,
    );
    await assert.rejects(
      repository.saveProgress(data.athlete, {
        ...request,
        idempotencyKeyHash: hash("new-progress-key"),
        requestHash: hash("new-progress-payload"),
      }),
      SessionVersionConflictError,
    );
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("partial completion is stable and creates exactly one trainer attention item", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const repository = new WorkoutSessionRepository(app);
  try {
    const data = await fixture(admin, app, "B7 partial");
    const session = await repository.start(data.athlete, {
      assignmentId: data.assignment.id,
      clientTimezone: "UTC",
      idempotencyKeyHash: hash("start-b7-partial"),
    });
    assert.ok(session);
    const progress = await repository.saveProgress(data.athlete, {
      sessionId: session.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("progress-b7-partial"),
      requestHash: hash("partial-progress-payload"),
      sets: [completed(session.exercises[0].sets[0].id)],
    });
    assert.ok(progress);
    const completeInput = {
      sessionId: session.id,
      expectedVersion: 2,
      idempotencyKeyHash: hash("complete-b7-partial"),
      requestHash: hash("partial-complete-payload"),
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    };
    const [completedSession, retried] = await Promise.all([
      repository.complete(data.athlete, completeInput),
      repository.complete(data.athlete, completeInput),
    ]);
    assert.equal(completedSession?.status, "completed_with_omissions");
    assert.equal(retried?.version, 3);
    assert.equal(completedSession?.exercises[0].sets[1].status, "incomplete");
    assert.equal(completedSession?.attentionItemId, null);
    assert.ok((await repository.find(data.trainer, session.id))?.attentionItemId);

    const items = await admin.query<{ count: string }>(
      "SELECT count(*)::text FROM app.attention_items WHERE source_session_id = $1",
      [session.id],
    );
    assert.equal(Number(items.rows[0].count), 1);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("zero-result completion needs confirmation and participant access follows relation lifecycle", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const repository = new WorkoutSessionRepository(app);
  try {
    const data = await fixture(admin, app, "B7 access");
    const stranger = await user(admin, "B7 unrelated athlete", "athlete");
    const session = await repository.start(data.athlete, {
      assignmentId: data.assignment.id,
      clientTimezone: "UTC",
      idempotencyKeyHash: hash("start-b7-zero"),
    });
    assert.ok(session);
    assert.equal(await repository.find(stranger, session.id), null);
    assert.equal((await repository.find(data.trainer, session.id))?.id, session.id);

    const trainerUpdate = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, data.trainer);
      return client.query("UPDATE app.workout_sessions SET version = version + 1 WHERE id = $1", [session.id]);
    });
    assert.equal(trainerUpdate.rowCount, 0);

    await assert.rejects(repository.complete(data.athlete, {
      sessionId: session.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("complete-b7-zero-unconfirmed"),
      requestHash: hash("zero-unconfirmed-payload"),
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    }), ZeroResultConfirmationRequiredError);

    const completedSession = await repository.complete(data.athlete, {
      sessionId: session.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("complete-b7-zero-confirmed"),
      requestHash: hash("zero-confirmed-payload"),
      discomfortReported: false,
      zeroResultConfirmed: true,
      zeroResultReason: "Stopped before the first set",
    });
    assert.equal(completedSession?.status, "completed_with_omissions");

    await admin.query(`UPDATE app.trainer_athlete_relations
      SET status = 'ended', ended_at = clock_timestamp() WHERE id = $1`, [data.relationId]);
    assert.equal((await repository.find(data.trainer, session.id))?.id, session.id);
    assert.equal((await repository.find(data.athlete, session.id))?.status, "completed_with_omissions");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
