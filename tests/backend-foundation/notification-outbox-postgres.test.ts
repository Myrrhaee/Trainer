import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";
import { MemoryNotificationDelivery } from "../../lib/server/notifications/notification-delivery";
import { NotificationOutboxRepository } from "../../lib/server/notifications/notification-repository";
import { NotificationWorker } from "../../lib/server/notifications/notification-worker";
import { ReviewRepository } from "../../lib/server/reviews/review-repository";
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
  const userId = account.rows[0].id;
  if (kind === "trainer") {
    await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
      VALUES ($1, 'active', clock_timestamp())`, [userId]);
  } else {
    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [userId]);
  }
  return { userId };
}

test("canonical workout loop enqueues exactly-once generic events and worker delivers with consent", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  const workerPool = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_worker" });
  try {
    const trainer = await user(admin, "B11 Trainer", "trainer");
    const athlete = await user(admin, "B11 Athlete", "athlete");
    await admin.query(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
      VALUES ($1,$2,'active',true)`, [trainer.userId, athlete.userId]);
    await admin.query(`INSERT INTO app_private.auth_identities
      (user_id, provider, provider_subject, verified_at, last_used_at, provider_metadata)
      VALUES
        ($1,'telegram','810000001',clock_timestamp(),clock_timestamp(),'{"botAccessGranted":true}'),
        ($2,'telegram','810000002',clock_timestamp(),clock_timestamp(),'{"allowsWriteToPm":true}')`,
      [trainer.userId, athlete.userId]);

    const workouts = new PostgresWorkoutRepository(app);
    const template = await workouts.createPublishedTemplate(trainer, {
      title: "B11 Full body",
      description: "Notification integration",
      generalInstruction: "Steady pace",
      estimatedDurationMin: 25,
      exercises: [{
        instanceKey: "b11-squat", title: "Squat", sets: 1, repetitions: 5,
        targetWeightKg: 60, restSeconds: 90, trainerNote: "",
      }],
    });
    const assignment = await workouts.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-10",
      trainerNote: "",
    });
    assert.ok(assignment);

    const sessions = new WorkoutSessionRepository(app);
    const started = await sessions.start(athlete, {
      assignmentId: assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("b11-start"),
    });
    assert.ok(started);
    const progress = await sessions.saveProgress(athlete, {
      sessionId: started.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("b11-progress"),
      requestHash: hash("b11-progress-payload"),
      sets: [{
        setLogId: started.exercises[0].sets[0].id,
        status: "completed",
        actualRepetitions: 5,
        actualDurationSeconds: null,
        actualWeightKg: 60,
        rpe: 7,
        athleteComment: "",
      }],
    });
    assert.ok(progress);
    const completed = await sessions.complete(athlete, {
      sessionId: started.id,
      expectedVersion: 2,
      idempotencyKeyHash: hash("b11-complete"),
      requestHash: hash("b11-complete-payload"),
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    });
    assert.ok(completed);
    const attention = await admin.query<{ id: string }>(
      "SELECT id FROM app.attention_items WHERE source_session_id = $1",
      [started.id],
    );
    assert.equal(attention.rowCount, 1);

    const reviews = new ReviewRepository(app);
    const feedbackInput = {
      attentionItemId: attention.rows[0].id,
      sessionId: started.id,
      kind: "detailed" as const,
      body: "Good work.",
      followUpOfId: null,
      idempotencyKeyHash: hash("b11-feedback"),
      requestHash: hash("b11-feedback-payload"),
    };
    const feedback = await reviews.sendFeedback(trainer, feedbackInput);
    assert.ok(feedback);
    assert.equal((await reviews.sendFeedback(trainer, feedbackInput))?.id, feedback.id);
    assert.equal((await sessions.complete(athlete, {
      sessionId: started.id,
      expectedVersion: 2,
      idempotencyKeyHash: hash("b11-complete"),
      requestHash: hash("b11-complete-payload"),
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    }))?.id, started.id);

    const events = await admin.query<{ event_type: string; deduplication_key: string }>(
      `SELECT event_type::text, deduplication_key FROM app.notification_outbox
       WHERE deduplication_key = ANY($1::text[]) ORDER BY created_at, id`,
      [[
        `workout_assigned:${assignment.id}`,
        `workout_completed:${started.id}`,
        `review_feedback_ready:${feedback.id}`,
      ]],
    );
    assert.deepEqual(events.rows.map((row) => row.event_type).sort(), [
      "review_feedback_ready",
      "workout_assigned",
      "workout_completed",
    ]);
    assert.equal(new Set(events.rows.map((row) => row.deduplication_key)).size, 3);

    await assert.rejects(withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, trainer);
      await client.query(`INSERT INTO app.notification_outbox
        (event_type, recipient_user_id, actor_user_id, aggregate_type, aggregate_id, deduplication_key)
        VALUES ('workout_completed',$1,$2,'workout_session',$3,'forged:event')`,
        [athlete.userId, trainer.userId, started.id]);
    }), permissionDenied);
    await assert.rejects(
      app.query("SELECT id FROM app.notification_outbox LIMIT 1"),
      permissionDenied,
    );
    await assert.rejects(
      workerPool.query("SELECT provider_subject FROM app_private.auth_identities LIMIT 1"),
      permissionDenied,
    );

    const repository = new NotificationOutboxRepository(workerPool);
    assert.equal(await repository.telegramRecipient(trainer.userId), "810000001");
    assert.equal(await repository.telegramRecipient(athlete.userId), "810000002");
    const worker = new NotificationWorker(repository, {
      mode: "memory",
      telegramBotToken: null,
      publicOrigin: "http://127.0.0.1:3000",
      batchSize: 1_000,
      leaseSeconds: 60,
      maxAttempts: 3,
      retryBaseSeconds: 1,
    }, new MemoryNotificationDelivery());
    const summary = await worker.drainOnce();
    assert.ok(summary.claimed >= 3);
    assert.ok(summary.delivered >= 3);
    const delivered = await admin.query<{ status: string; provider_message_id: string | null }>(
      `SELECT status::text, provider_message_id FROM app.notification_outbox
       WHERE deduplication_key = ANY($1::text[])`,
      [[
        `workout_assigned:${assignment.id}`,
        `workout_completed:${started.id}`,
        `review_feedback_ready:${feedback.id}`,
      ]],
    );
    assert.equal(delivered.rowCount, 3);
    assert.equal(delivered.rows.every((row) => row.status === "delivered"), true);
    assert.equal(delivered.rows.every((row) => row.provider_message_id?.startsWith("memory:")), true);
  } finally {
    await Promise.all([admin.end(), app.end(), workerPool.end()]);
  }
});

test("worker retries when Telegram messaging permission is absent", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const workerPool = new Pool({ connectionString, max: 2, options: "-c role=ai_strength_worker" });
  try {
    const trainer = await user(admin, "B11 No consent trainer", "trainer");
    const athlete = await user(admin, "B11 No consent athlete", "athlete");
    await admin.query(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
      VALUES ($1,$2,'active',true)`, [trainer.userId, athlete.userId]);
    await admin.query(`INSERT INTO app_private.auth_identities
      (user_id, provider, provider_subject, verified_at, provider_metadata)
      VALUES ($1,'telegram','820000001',clock_timestamp(),'{"allowsWriteToPm":false}')`,
      [athlete.userId]);

    const workouts = new PostgresWorkoutRepository(app);
    const template = await workouts.createPublishedTemplate(trainer, {
      title: "B11 Retry", description: "", generalInstruction: "", estimatedDurationMin: null,
      exercises: [{ instanceKey: "retry-row", title: "Row", sets: 1, repetitions: 8,
        targetWeightKg: null, restSeconds: 60, trainerNote: "" }],
    });
    const assignment = await workouts.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-11",
      trainerNote: "",
    });
    assert.ok(assignment);

    const repository = new NotificationOutboxRepository(workerPool);
    assert.equal(await repository.telegramRecipient(athlete.userId), null);
    const worker = new NotificationWorker(repository, {
      mode: "memory",
      telegramBotToken: null,
      publicOrigin: "http://127.0.0.1:3000",
      batchSize: 1_000,
      leaseSeconds: 60,
      maxAttempts: 3,
      retryBaseSeconds: 1,
    }, new MemoryNotificationDelivery());
    const summary = await worker.drainOnce();
    assert.ok(summary.claimed >= 1);
    assert.ok(summary.retried >= 1);
    const state = await admin.query<{ status: string; last_error_code: string; attempt_count: number }>(
      `SELECT status::text, last_error_code, attempt_count FROM app.notification_outbox
       WHERE deduplication_key = $1`,
      [`workout_assigned:${assignment.id}`],
    );
    assert.deepEqual(state.rows[0], {
      status: "retry_wait",
      last_error_code: "telegram_recipient_unavailable",
      attempt_count: 1,
    });
  } finally {
    await Promise.all([admin.end(), app.end(), workerPool.end()]);
  }
});

function permissionDenied(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}
