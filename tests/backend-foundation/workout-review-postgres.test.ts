import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";
import {
  ReviewAlreadyResolvedError,
  ReviewIdempotencyConflictError,
  ReviewRepository,
} from "../../lib/server/reviews/review-repository";
import { ReviewService } from "../../lib/server/reviews/review-service";
import { WorkoutSessionRepository } from "../../lib/server/workout-sessions/workout-session-repository";
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

async function completedFixture(admin: Pool, app: Pool, label: string) {
  const trainer = await user(admin, `${label} Trainer`, "trainer");
  const athlete = await user(admin, `${label} Athlete`, "athlete");
  const relation = await admin.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1,$2,'active',true) RETURNING id`, [trainer.userId, athlete.userId]);
  const workouts = new PostgresWorkoutRepository(app);
  const template = await workouts.createPublishedTemplate(trainer, {
    title: `${label} Strength`,
    description: "Review integration",
    generalInstruction: "Record every set",
    estimatedDurationMin: 30,
    exercises: [{
      instanceKey: `${label}-press`, title: "Bench press", sets: 2, repetitions: 8,
      targetWeightKg: 50, restSeconds: 90, trainerNote: "",
    }],
  });
  const assignment = await workouts.createAssignment(trainer, {
    athleteUserId: athlete.userId,
    templateId: template.id,
    scheduledFor: "2026-08-15",
    trainerNote: "",
  });
  assert.ok(assignment);
  const sessions = new WorkoutSessionRepository(app);
  const started = await sessions.start(athlete, {
    assignmentId: assignment.id,
    clientTimezone: "Europe/Moscow",
    idempotencyKeyHash: hash(`${label}-start`),
  });
  assert.ok(started);
  const progress = await sessions.saveProgress(athlete, {
    sessionId: started.id,
    expectedVersion: 1,
    idempotencyKeyHash: hash(`${label}-progress`),
    requestHash: hash(`${label}-progress-payload`),
    sets: [{
      setLogId: started.exercises[0].sets[0].id,
      status: "completed",
      actualRepetitions: 7,
      actualDurationSeconds: null,
      actualWeightKg: 50,
      rpe: 8.5,
      athleteComment: "Last repetition was slow",
    }],
  });
  assert.ok(progress);
  const completed = await sessions.complete(athlete, {
    sessionId: started.id,
    expectedVersion: 2,
    idempotencyKeyHash: hash(`${label}-complete`),
    requestHash: hash(`${label}-complete-payload`),
    zeroResultConfirmed: false,
    zeroResultReason: "",
  });
  assert.ok(completed);
  const attention = await admin.query<{ id: string }>(
    "SELECT id FROM app.attention_items WHERE source_session_id = $1",
    [started.id],
  );
  return {
    trainer, athlete, relationId: relation.rows[0].id,
    sessionId: started.id, attentionItemId: attention.rows[0].id,
  };
}

test("trainer review read model uses canonical session facts and isolates unrelated actors", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "B8 read");
    const stranger = await user(admin, "B8 unrelated trainer", "trainer");
    const repository = new ReviewRepository(app);
    const service = new ReviewService(repository, new WorkoutSessionRepository(app));
    const queue = await service.listQueue(data.trainer);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].sessionId, data.sessionId);
    assert.equal(queue[0].completedSets, 1);
    assert.equal(queue[0].totalSets, 2);
    assert.equal(queue[0].hasClientComments, true);
    assert.equal((await service.listQueue(stranger)).length, 0);
    assert.equal((await service.listQueue(data.athlete)).length, 0);

    const review = await service.findReview(data.trainer, data.sessionId);
    assert.equal(review?.session.status, "completed_with_omissions");
    assert.equal(review?.exercises[0].sets[0].actualRepetitions, 7);
    assert.equal(review?.exercises[0].sets[1].status, "incomplete");
    assert.equal(await service.findReview(stranger, data.sessionId), null);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("feedback resolves once, retries safely and remains visible and immutable for the athlete", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "B8 feedback");
    const repository = new ReviewRepository(app);
    const input = {
      attentionItemId: data.attentionItemId,
      sessionId: data.sessionId,
      kind: "detailed" as const,
      body: "Good control. Keep the same weight next time.",
      followUpOfId: null,
      idempotencyKeyHash: hash("B8 feedback send"),
      requestHash: hash("B8 feedback payload"),
    };
    const [sent, retried] = await Promise.all([
      repository.sendFeedback(data.trainer, input),
      repository.sendFeedback(data.trainer, input),
    ]);
    assert.ok(sent);
    assert.equal(retried?.id, sent.id);
    assert.equal((await repository.listQueue(data.trainer)).length, 0);
    assert.equal((await repository.listAthleteFeedback(data.athlete, data.sessionId)).length, 1);

    await assert.rejects(repository.sendFeedback(data.trainer, {
      ...input,
      requestHash: hash("changed payload"),
    }), ReviewIdempotencyConflictError);
    await assert.rejects(repository.sendFeedback(data.trainer, {
      ...input,
      idempotencyKeyHash: hash("different send key"),
      requestHash: hash("different send payload"),
    }), ReviewAlreadyResolvedError);

    const followUp = await repository.sendFeedback(data.trainer, {
      ...input,
      kind: "follow_up",
      body: "Send a video if the tempo changes.",
      followUpOfId: sent.id,
      idempotencyKeyHash: hash("B8 follow up"),
      requestHash: hash("B8 follow up payload"),
    });
    assert.equal(followUp?.followUpOfId, sent.id);
    assert.equal((await repository.listAthleteFeedback(data.athlete, data.sessionId)).length, 2);

    await assert.rejects(withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, data.trainer);
      await client.query("UPDATE app.trainer_feedback SET body = 'mutated' WHERE id = $1", [sent.id]);
    }), (error: NodeJS.ErrnoException) => error.code === "42501");

    await admin.query(`UPDATE app.trainer_athlete_relations SET status = 'ended',
      ended_at = clock_timestamp() WHERE id = $1`, [data.relationId]);
    assert.equal((await repository.listSessionFeedback(data.trainer, data.sessionId)).length, 0);
    assert.equal((await repository.listAthleteFeedback(data.athlete, data.sessionId)).length, 2);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("manual resolution requires a stored trainer-private reason and sends no feedback", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "B8 manual");
    const repository = new ReviewRepository(app);
    const input = {
      attentionItemId: data.attentionItemId,
      sessionId: data.sessionId,
      reason: "Reviewed during a live coaching call",
      idempotencyKeyHash: hash("B8 manual resolve"),
      requestHash: hash("B8 manual payload"),
    };
    const [resolved, retried] = await Promise.all([
      repository.resolveManually(data.trainer, input),
      repository.resolveManually(data.trainer, input),
    ]);
    assert.ok(resolved);
    assert.equal(retried?.id, resolved.id);
    assert.equal((await repository.listQueue(data.trainer)).length, 0);
    assert.equal((await repository.listAthleteFeedback(data.athlete, data.sessionId)).length, 0);

    const privateReason = await admin.query<{ reason: string }>(
      "SELECT reason FROM app.attention_manual_resolutions WHERE attention_item_id = $1",
      [data.attentionItemId],
    );
    assert.equal(privateReason.rows[0].reason, input.reason);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
