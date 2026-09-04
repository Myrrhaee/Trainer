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

async function completedFixture(
  admin: Pool,
  app: Pool,
  label: string,
  options: { secondStatus?: "incomplete" | "skipped"; canonicalSets?: boolean } = {},
) {
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
  const templateExercise = await admin.query<{ id: string }>(
    "SELECT id FROM app.workout_template_exercises WHERE revision_id = $1",
    [template.revisionId],
  );
  if (options.canonicalSets !== false) {
    await admin.query(`INSERT INTO app.workout_template_exercise_sets
        (exercise_id, set_key, position, kind, repetitions_min, repetitions_max,
         duration_seconds, target_weight_kg, rest_seconds, uses_override)
      VALUES
        ($1, 'working-1', 1, 'working', 8, 8, NULL, 50, 90, false),
        ($1, 'working-2', 2, 'working', 8, 8, 45, 50, 120, true)`,
    [templateExercise.rows[0].id]);
  }
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
    sets: [
      {
        setLogId: started.exercises[0].sets[0].id,
        status: "completed",
        actualRepetitions: 7,
        actualDurationSeconds: null,
        actualWeightKg: 50,
        rpe: 8.5,
        athleteComment: "Last repetition was slow",
      },
      {
        setLogId: started.exercises[0].sets[1].id,
        status: options.secondStatus ?? "incomplete",
        actualRepetitions: null,
        actualDurationSeconds: null,
        actualWeightKg: null,
        rpe: null,
        athleteComment: "Stopped before the second result",
      },
    ],
  });
  assert.ok(progress);
  const completed = await sessions.complete(athlete, {
    sessionId: started.id,
    expectedVersion: 2,
    idempotencyKeyHash: hash(`${label}-complete`),
    requestHash: hash(`${label}-complete-payload`),
    discomfortReported: false,
    zeroResultConfirmed: false,
    zeroResultReason: "",
  });
  assert.ok(completed);
  const attention = await admin.query<{ id: string }>(
    "SELECT id FROM app.attention_items WHERE source_session_id = $1",
    [started.id],
  );
  const storedSets = await admin.query<{ id: string; source_assignment_set_id: string | null }>(`SELECT set_log.id, set_log.source_assignment_set_id
    FROM app.workout_set_logs set_log
    JOIN app.workout_exercise_logs exercise ON exercise.id = set_log.exercise_log_id
    WHERE exercise.session_id = $1 ORDER BY set_log.position`, [started.id]);
  return {
    trainer, athlete, relationId: relation.rows[0].id,
    templateId: template.id,
    assignmentId: assignment.id,
    sessionId: started.id,
    attentionItemId: attention.rows[0].id,
    setLogIds: storedSets.rows.map((set) => set.id),
    sourceSetIds: storedSets.rows.map((set) => set.source_assignment_set_id),
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
    const service = new ReviewService(repository);
    const queue = await service.listQueue(data.trainer);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].sessionId, data.sessionId);
    assert.equal(queue[0].completedSets, 1);
    assert.equal(queue[0].totalSets, 2);
    assert.equal(queue[0].hasClientComments, true);
    assert.equal((await service.listQueue(stranger)).length, 0);
    assert.equal((await service.listQueue(data.athlete)).length, 0);

    const review = await service.findReview(data.trainer, data.sessionId);
    assert.equal(review?.identity.sessionId, data.sessionId);
    assert.equal(review?.identity.assignmentId, data.assignmentId);
    assert.equal(review?.identity.attentionItemId, data.attentionItemId);
    assert.equal(review?.session.status, "completed_with_omissions");
    assert.equal(review?.exercises[0].sets[0].actual.repetitions, 7);
    assert.equal(review?.exercises[0].sets[1].actual.status, "incomplete");
    assert.equal(review?.exercises[0].sets[0].identity.sourceAssignmentSetId, data.sourceSetIds[0]);
    assert.equal(review?.exercises[0].sets[1].prescribed.durationSeconds, 45);
    assert.equal(review?.exercises[0].sets[1].prescribed.restSeconds, 120);
    assert.equal(review?.exercises[0].sets[0].prescribed.weightKg, 50);
    assert.deepEqual(review?.exercises[0].sets.flatMap((set) => set.sourceComments.map((item) => item.text)), [
      "Last repetition was slow",
      "Stopped before the second result",
    ]);
    assert.equal(review?.sessionContext.discomfort.status, "known_empty");
    assert.equal(review?.sessionContext.overallComment.status, "known_empty");
    assert.equal(review?.sessionContext.subjectiveMetrics.status, "unsupported");
    assert.equal(review?.dataAvailability.canAssertNoDeviations, true);
    assert.deepEqual(review?.capabilities, {
      canRead: true,
      canSendInitialFeedback: true,
      canSendAcknowledgement: true,
      canSendFollowUp: false,
      canResolveManually: true,
      canOpenAthleteProfile: true,
      canAssignNext: true,
    });
    assert.equal(await service.findReview(stranger, data.sessionId), null);

    await admin.query(`UPDATE app.trainer_athlete_relations SET status = 'suspended'
      WHERE id = $1`, [data.relationId]);
    assert.equal((await service.findReview(data.trainer, data.sessionId))?.capabilities.canAssignNext, false);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("assignment snapshot and repeated Review reads stay immutable and mutation-free", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "R2B snapshot");
    const service = new ReviewService(new ReviewRepository(app));
    const beforeAudit = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.audit_events WHERE actor_user_id = $1",
      [data.trainer.userId],
    );
    const first = await service.findReview(data.trainer, data.sessionId);
    assert.ok(first);

    await admin.query("UPDATE app.workout_templates SET title = 'Changed current template' WHERE id = $1", [data.templateId]);
    const second = await service.findReview(data.trainer, data.sessionId);
    const third = await service.findReview(data.trainer, data.sessionId);
    const afterAudit = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.audit_events WHERE actor_user_id = $1",
      [data.trainer.userId],
    );

    assert.equal(second?.assignmentSnapshot.title, "R2B snapshot Strength");
    assert.equal(second?.session.title, "R2B snapshot Strength");
    assert.deepEqual(second, third);
    assert.equal(afterAudit.rows[0].count, beforeAudit.rows[0].count);
    assert.equal(second?.attention.status, "open");
    assert.equal(second?.existingFeedback.length, 0);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("skipped logs keep null actual values and missing source identity becomes an anomaly", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  try {
    const skippedData = await completedFixture(admin, app, "R2B skipped", { secondStatus: "skipped" });
    const legacyData = await completedFixture(admin, app, "R2B legacy sets", { canonicalSets: false });
    const service = new ReviewService(new ReviewRepository(app));

    const skipped = await service.findReview(skippedData.trainer, skippedData.sessionId);
    assert.equal(skipped?.exercises[0].sets[1].actual.status, "skipped");
    assert.equal(skipped?.exercises[0].sets[1].actual.repetitions, null);
    assert.equal(skipped?.exercises[0].sets[1].actual.weightKg, null);
    assert.ok(skipped?.exercises[0].sets[1].deviations.some((item) => item.type === "set_skipped"));

    const legacy = await service.findReview(legacyData.trainer, legacyData.sessionId);
    assert.equal(legacy?.exercises[0].sets[0].identity.sourceAssignmentSetId, null);
    assert.equal(legacy?.exercises[0].sets[0].prescribed.source, "session_snapshot");
    assert.ok(legacy?.anomalies.some((item) => item.type === "set_source_identity_missing"));
    assert.equal(legacy?.dataAvailability.logs.status, "partial");
    assert.equal(legacy?.dataAvailability.canAssertNoDeviations, false);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("a successfully read empty log source is known empty and never produces an all-clear", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "R2B no logs");
    await admin.query(`DELETE FROM app.workout_set_logs WHERE exercise_log_id IN
      (SELECT id FROM app.workout_exercise_logs WHERE session_id = $1)`, [data.sessionId]);
    await admin.query("DELETE FROM app.workout_exercise_logs WHERE session_id = $1", [data.sessionId]);

    const review = await new ReviewService(new ReviewRepository(app)).findReview(data.trainer, data.sessionId);
    assert.equal(review?.dataAvailability.logs.status, "known_empty");
    assert.equal(review?.dataAvailability.canAssertNoDeviations, false);
    assert.equal(review?.exercises[0].actual.status, "missing");
    assert.ok(review?.exercises[0].deviations.some((item) => item.type === "log_missing"));
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("acknowledgement is projected as persisted feedback with the same athlete-visible ID", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "R2B acknowledgement");
    const repository = new ReviewRepository(app);
    const sent = await repository.sendFeedback(data.trainer, {
      attentionItemId: data.attentionItemId,
      sessionId: data.sessionId,
      kind: "acknowledgement",
      body: "Тренировку посмотрел. Результаты принял.",
      followUpOfId: null,
      idempotencyKeyHash: hash("R2B acknowledgement"),
      requestHash: hash("R2B acknowledgement payload"),
    });
    assert.ok(sent);
    const review = await new ReviewService(repository).findReview(data.trainer, data.sessionId);
    const athleteFeedback = await repository.listAthleteFeedback(data.athlete, data.sessionId);
    assert.equal(review?.existingFeedback[0].kind, "acknowledgement");
    assert.equal(review?.existingFeedback[0].id, athleteFeedback[0].id);
    assert.equal(review?.attention.status, "resolved");
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
    const athleteFeedback = await repository.listAthleteFeedback(data.athlete, data.sessionId);
    assert.equal(athleteFeedback.length, 2);
    const review = await new ReviewService(repository).findReview(data.trainer, data.sessionId);
    assert.equal(review?.attention.status, "resolved");
    assert.deepEqual(review?.existingFeedback.map((item) => item.id).sort(), athleteFeedback.map((item) => item.id).sort());
    assert.equal(review?.existingFeedback[0].kind, "detailed");
    assert.equal(review?.existingFeedback[1].kind, "follow_up");
    assert.equal(review?.existingFeedback[1].followUpOfId, sent.id);
    assert.equal(review?.capabilities.canSendInitialFeedback, false);
    assert.equal(review?.capabilities.canSendFollowUp, true);

    await assert.rejects(withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, data.trainer);
      await client.query("UPDATE app.trainer_feedback SET body = 'mutated' WHERE id = $1", [sent.id]);
    }), (error: NodeJS.ErrnoException) => error.code === "42501");

    await admin.query(`UPDATE app.trainer_athlete_relations SET status = 'ended',
      ended_at = clock_timestamp() WHERE id = $1`, [data.relationId]);
    assert.equal((await repository.listSessionFeedback(data.trainer, data.sessionId)).length, 2);
    assert.equal((await repository.listAthleteFeedback(data.athlete, data.sessionId)).length, 2);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("concurrent resolution and Review reads return semantically consistent snapshots", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 20, options: "-c role=ai_strength_app" });
  try {
    const data = await completedFixture(admin, app, "R2B consistent snapshot");
    const repository = new ReviewRepository(app);
    const service = new ReviewService(repository);
    const reads = Array.from({ length: 16 }, () => service.findReview(data.trainer, data.sessionId));
    const send = repository.sendFeedback(data.trainer, {
      attentionItemId: data.attentionItemId,
      sessionId: data.sessionId,
      kind: "detailed",
      body: "Consistent snapshot feedback",
      followUpOfId: null,
      idempotencyKeyHash: hash("R2B concurrent feedback"),
      requestHash: hash("R2B concurrent feedback payload"),
    });
    const [sent, snapshots] = await Promise.all([send, Promise.all(reads)]);
    if (!sent) assert.fail("feedback was not persisted");
    const sentId = sent.id;
    for (const snapshot of snapshots) {
      if (!snapshot) assert.fail("review snapshot was unavailable");
      const openWithoutFeedback = snapshot.attention.status === "open" && snapshot.existingFeedback.length === 0;
      const resolvedWithFeedback: boolean = snapshot.attention.status === "resolved"
        && snapshot.existingFeedback.some((item): boolean => item.id === sentId);
      assert.equal(openWithoutFeedback || resolvedWithFeedback, true);
    }
    const final = await service.findReview(data.trainer, data.sessionId);
    assert.equal(final?.attention.status, "resolved");
    assert.equal(final?.existingFeedback[0].id, sentId);
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
    const review = await new ReviewService(repository).findReview(data.trainer, data.sessionId);
    assert.equal(review?.attention.status, "resolved");
    assert.equal(review?.attention.manualResolutionReason, input.reason);
    assert.equal(review?.existingFeedback.length, 0);
    assert.equal(review?.capabilities.canSendFollowUp, false);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
