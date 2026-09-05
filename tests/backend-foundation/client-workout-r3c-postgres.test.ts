import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool, type PoolClient } from "pg";

import { ClientWorkoutQueryService } from "../../lib/server/client-workouts/client-workout-query-service";
import { ClientWorkoutRepository } from "../../lib/server/client-workouts/client-workout-repository";
import {
  SessionIdempotencyConflictError,
  SessionVersionConflictError,
  WorkoutSessionRepository,
} from "../../lib/server/workout-sessions/workout-session-repository";
import type { ProgressSetInput } from "../../lib/server/workout-sessions/workout-session-types";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import type { BuilderExercise, SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";
import { publishBuilderDraft, saveBuilderDraft } from "./workout-builder-test-driver";

const connectionString = process.env.TEST_DATABASE_URL;

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function account(pool: Pool, name: string, role: "trainer" | "athlete") {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  if (role === "trainer") {
    await pool.query("INSERT INTO app.trainer_profiles (user_id, status, activated_at) VALUES ($1, 'active', clock_timestamp())", [user.rows[0].id]);
  } else {
    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [user.rows[0].id]);
  }
  return { userId: user.rows[0].id };
}

function exercise(instanceId: string, type: "repetitions" | "duration"): BuilderExercise {
  return {
    instanceId,
    exerciseId: `source-${instanceId}`,
    title: type === "repetitions" ? "R3C squat" : "R3C plank",
    category: type === "repetitions" ? "Legs" : "Core",
    equipment: type === "repetitions" ? "Barbell" : "Mat",
    prescription: {
      type,
      sets: "2",
      repetitionMode: type === "repetitions" ? "range" : "fixed",
      repetitionsMin: type === "repetitions" ? "6" : "",
      repetitionsMax: type === "repetitions" ? "8" : "",
      durationSec: type === "duration" ? "45" : "",
      targetWeightKg: type === "repetitions" ? "80" : "",
      restSec: "90",
    },
    perSetMode: true,
    setOverrides: [1, 2].map((position) => ({
      id: `${instanceId}-set-${position}`,
      order: position,
      kind: position === 1 ? "warmup" : "working",
      repetitionsMin: type === "repetitions" ? (position === 1 ? "8" : "6") : "",
      repetitionsMax: type === "repetitions" ? (position === 1 ? "10" : "8") : "",
      durationSec: type === "duration" ? (position === 1 ? "30" : "45") : "",
      targetWeightKg: type === "repetitions" ? (position === 1 ? "40" : "80") : "",
      restSec: position === 1 ? "60" : "90",
      usesOverride: true,
    })),
    trainerNote: `Trainer note ${instanceId}`,
  };
}

function template(): SaveBuilderTemplateInput {
  return {
    title: "R3C persisted execution",
    revision: 1,
    description: "Canonical set log coverage",
    category: "Strength",
    estimatedDurationMin: "40",
    generalInstruction: "Record actual facts only.",
    items: [
      { id: "r3c-repetitions", kind: "exercise", exercise: exercise("r3c-repetitions", "repetitions") },
      { id: "r3c-duration", kind: "exercise", exercise: exercise("r3c-duration", "duration") },
    ],
  };
}

function progress(setLogId: string, values: Partial<ProgressSetInput> = {}): ProgressSetInput {
  return {
    setLogId,
    status: "completed",
    actualRepetitions: 7,
    actualDurationSeconds: null,
    actualWeightKg: 82.5,
    rpe: 8,
    athleteComment: "R3C actual set",
    ...values,
  };
}

test("R3C persists exact actual facts with receipts, source identity and optimistic concurrency", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  const builder = new WorkoutBuilderRepository(app);
  const workouts = new PostgresWorkoutRepository(app);
  const sessions = new WorkoutSessionRepository(app);
  try {
    const trainer = await account(admin, "R3C Trainer", "trainer");
    const athlete = await account(admin, "R3C Athlete", "athlete");
    const foreign = await account(admin, "R3C Foreign", "athlete");
    await admin.query("INSERT INTO app.trainer_athlete_relations (trainer_user_id, athlete_user_id, status, is_primary) VALUES ($1,$2,'active',true),($1,$3,'active',true)", [trainer.userId, athlete.userId, foreign.userId]);
    const draft = await saveBuilderDraft(builder, trainer, template());
    const published = await publishBuilderDraft(builder, trainer, draft.id);
    const assignment = await workouts.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: published.id,
      templateRevisionId: published.revisionId,
      scheduledFor: "2026-09-03",
      trainerNote: "R3C exact execution",
    });
    const foreignAssignment = await workouts.createAssignment(trainer, {
      athleteUserId: foreign.userId,
      templateId: published.id,
      templateRevisionId: published.revisionId,
      scheduledFor: "2026-09-03",
      trainerNote: "Foreign execution",
    });
    assert.ok(assignment);
    assert.ok(foreignAssignment);
    const started = await sessions.startOrResume(athlete, {
      assignmentId: assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("r3c-start"),
    });
    const foreignStarted = await sessions.startOrResume(foreign, {
      assignmentId: foreignAssignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKeyHash: hash("r3c-foreign-start"),
    });
    assert.ok(started);
    assert.ok(foreignStarted);
    const repetitionSet = started.session.exercises[0].sets[0];
    const secondRepetitionSet = started.session.exercises[0].sets[1];
    const durationSet = started.session.exercises[1].sets[0];
    const skippedSet = started.session.exercises[1].sets[1];
    assert.ok(repetitionSet.sourceAssignmentSetId);
    assert.equal(repetitionSet.plannedRepetitionsMin, 8);
    assert.equal(repetitionSet.plannedRepetitionsMax, 10);
    assert.equal(durationSet.plannedDurationSeconds, 30);

    const repetitionRequest = {
      sessionId: started.session.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("r3c-save-repetitions"),
      requestHash: hash("r3c-save-repetitions-payload"),
      sets: [progress(repetitionSet.id)],
    };
    const repetitionCounter = countedPool(app);
    const repetitionRepository = new WorkoutSessionRepository(repetitionCounter.pool);
    const repetitionSaved = await repetitionRepository.saveProgress(athlete, repetitionRequest);
    const repetitionSaveQueries = repetitionCounter.count();
    const repetitionReplay = await repetitionRepository.saveProgress(athlete, repetitionRequest);
    assert.equal(repetitionSaved?.version, 2);
    assert.equal(repetitionReplay?.version, 2);
    assert.deepEqual(repetitionReplay?.exercises[0].sets[0], repetitionSaved?.exercises[0].sets[0]);
    assert.equal(repetitionSaveQueries, 14); // One set-based lineage preflight before writes.
    await assert.rejects(
      sessions.saveProgress(athlete, { ...repetitionRequest, requestHash: hash("changed"), sets: [progress(repetitionSet.id, { actualRepetitions: 8 })] }),
      SessionIdempotencyConflictError,
    );

    const durationCounter = countedPool(app);
    const durationSaved = await new WorkoutSessionRepository(durationCounter.pool).saveProgress(athlete, {
      sessionId: started.session.id,
      expectedVersion: 2,
      idempotencyKeyHash: hash("r3c-save-duration"),
      requestHash: hash("r3c-save-duration-payload"),
      sets: [progress(durationSet.id, {
        actualRepetitions: null,
        actualDurationSeconds: 48,
        actualWeightKg: null,
        rpe: 7.5,
        athleteComment: "Held with stable breathing",
      })],
    });
    assert.equal(durationSaved?.exercises[1].sets[0].actualDurationSeconds, 48);
    assert.equal(durationSaved?.exercises[0].sets[0].actualRepetitions, 7);
    assert.equal(durationCounter.count(), 14);

    const skipCounter = countedPool(app);
    const skipped = await new WorkoutSessionRepository(skipCounter.pool).saveProgress(athlete, {
      sessionId: started.session.id,
      expectedVersion: 3,
      idempotencyKeyHash: hash("r3c-skip"),
      requestHash: hash("r3c-skip-payload"),
      sets: [progress(skippedSet.id, {
        status: "skipped",
        actualRepetitions: null,
        actualDurationSeconds: null,
        actualWeightKg: null,
        rpe: null,
        athleteComment: "Stopped before this set",
      })],
    });
    const persistedSkip = skipped?.exercises[1].sets[1];
    assert.equal(persistedSkip?.status, "skipped");
    assert.equal(persistedSkip?.actualRepetitions, null);
    assert.equal(persistedSkip?.actualDurationSeconds, null);
    assert.equal(persistedSkip?.actualWeightKg, null);
    assert.equal(skipCounter.count(), 14);

    const sameSetConcurrency = await Promise.allSettled([
      sessions.saveProgress(athlete, {
        sessionId: started.session.id,
        expectedVersion: 4,
        idempotencyKeyHash: hash("r3c-concurrent-a"),
        requestHash: hash("r3c-concurrent-a-payload"),
        sets: [progress(secondRepetitionSet.id, { actualRepetitions: 6 })],
      }),
      sessions.saveProgress(athlete, {
        sessionId: started.session.id,
        expectedVersion: 4,
        idempotencyKeyHash: hash("r3c-concurrent-b"),
        requestHash: hash("r3c-concurrent-b-payload"),
        sets: [progress(secondRepetitionSet.id, { actualRepetitions: 8 })],
      }),
    ]);
    assert.equal(sameSetConcurrency.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(sameSetConcurrency.filter((item) => item.status === "rejected" && item.reason instanceof SessionVersionConflictError).length, 1);

    const foreignSetMutation = await sessions.saveProgress(athlete, {
      sessionId: started.session.id,
      expectedVersion: 5,
      idempotencyKeyHash: hash("r3c-foreign-set"),
      requestHash: hash("r3c-foreign-set-payload"),
      sets: [progress(foreignStarted.session.exercises[0].sets[0].id)],
    });
    assert.equal(foreignSetMutation, null);
    assert.equal(await sessions.saveProgress(trainer, {
      sessionId: started.session.id,
      expectedVersion: 5,
      idempotencyKeyHash: hash("r3c-trainer-write"),
      requestHash: hash("r3c-trainer-write-payload"),
      sets: [progress(repetitionSet.id)],
    }), null);

    const exactCounter = countedPool(app);
    const exact = await new ClientWorkoutQueryService(
      new ClientWorkoutRepository(exactCounter.pool),
      new WorkoutSessionRepository(exactCounter.pool),
    ).execution(athlete, { sessionId: started.session.id });
    assert.equal(exact?.identity.sessionId, started.session.id);
    assert.equal(exact?.session?.version, 5);
    assert.equal(exact?.session?.exercises[0].sets[0].athleteComment, "R3C actual set");
    assert.equal(exact?.capabilities.canEdit, true);
    assert.equal(exactCounter.count(), 11);
    const receiptCount = await admin.query<{ count: string }>("SELECT count(*)::text FROM app.workout_session_command_receipts WHERE session_id = $1 AND kind = 'progress'", [started.session.id]);
    assert.equal(receiptCount.rows[0].count, "4");

    const completed = await sessions.complete(athlete, {
      sessionId: started.session.id,
      expectedVersion: 5,
      idempotencyKeyHash: hash("r3c-complete-boundary"),
      requestHash: hash("r3c-complete-boundary-payload"),
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    });
    assert.equal(completed?.status, "completed_with_omissions");
    assert.equal(await sessions.saveProgress(athlete, {
      sessionId: started.session.id,
      expectedVersion: 6,
      idempotencyKeyHash: hash("r3c-after-complete"),
      requestHash: hash("r3c-after-complete-payload"),
      sets: [progress(repetitionSet.id)],
    }), null);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

function countedPool(pool: Pool) {
  let queries = 0;
  const counted = {
    async connect() {
      const client = await pool.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query") {
            return (...args: Parameters<PoolClient["query"]>) => {
              queries += 1;
              return (target.query as (...queryArgs: Parameters<PoolClient["query"]>) => unknown)(...args);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
  return { pool: counted, count: () => queries };
}
