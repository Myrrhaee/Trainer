import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { ClientWorkoutRepository } from "../../lib/server/client-workouts/client-workout-repository";
import { ClientWorkoutInputError, ClientWorkoutQueryService } from "../../lib/server/client-workouts/client-workout-query-service";
import { WorkoutSessionRepository } from "../../lib/server/workout-sessions/workout-session-repository";
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

function exercise(id: string, type: "range" | "duration"): BuilderExercise {
  return {
    instanceId: id,
    exerciseId: `source-${id}`,
    title: type === "range" ? "Range squat" : "Timed plank",
    category: type === "range" ? "Legs" : "Core",
    equipment: type === "range" ? "Barbell" : "Mat",
    prescription: {
      type: type === "range" ? "repetitions" : "duration",
      sets: "2",
      repetitionMode: type === "range" ? "range" : "fixed",
      repetitionsMin: type === "range" ? "6" : "",
      repetitionsMax: type === "range" ? "8" : "",
      durationSec: type === "duration" ? "45" : "",
      targetWeightKg: type === "range" ? "80" : "",
      restSec: "90",
    },
    perSetMode: type === "range",
    setOverrides: type === "range" ? [
      { id: `${id}-warmup`, order: 1, kind: "warmup", repetitionsMin: "8", repetitionsMax: "10", durationSec: "", targetWeightKg: "40", restSec: "60", usesOverride: true },
      { id: `${id}-work`, order: 2, kind: "working", repetitionsMin: "6", repetitionsMax: "8", durationSec: "", targetWeightKg: "80", restSec: "120", usesOverride: true },
    ] : [],
    trainerNote: `Note ${id}`,
  };
}

function richTemplate(): SaveBuilderTemplateInput {
  return {
    title: "R3B rich workout",
    revision: 1,
    description: "Snapshot coverage",
    category: "Strength",
    estimatedDurationMin: "45",
    generalInstruction: "Keep the prescribed order.",
    items: [{
      id: "r3b-superset",
      kind: "superset",
      label: "Pair A",
      instruction: "No rest between exercises",
      exercises: [exercise("range-one", "range"), exercise("duration-two", "duration")],
    }],
  };
}

test("R3B projects independent rich assignments and exact reads fail closed", { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const builder = new WorkoutBuilderRepository(app);
  const workouts = new PostgresWorkoutRepository(app);
  const clientWorkouts = new ClientWorkoutRepository(app);
  const sessions = new WorkoutSessionRepository(app);
  const query = new ClientWorkoutQueryService(clientWorkouts, sessions);
  try {
    const trainer = await account(admin, "R3B Trainer", "trainer");
    const athlete = await account(admin, "R3B Athlete", "athlete");
    const foreign = await account(admin, "R3B Foreign", "athlete");
    await admin.query("INSERT INTO app.trainer_athlete_relations (trainer_user_id, athlete_user_id, status, is_primary) VALUES ($1,$2,'active',true)", [trainer.userId, athlete.userId]);
    const draft = await saveBuilderDraft(builder, trainer, richTemplate());
    const published = await publishBuilderDraft(builder, trainer, draft.id);
    const assignment = await workouts.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: published.id,
      templateRevisionId: published.revisionId,
      scheduledFor: "2026-09-03",
      trainerNote: "Exact R3B note",
    });
    assert.ok(assignment);

    const collection = await clientWorkouts.listCurrent(athlete);
    assert.equal(collection.currentAssignmentId, assignment.id);
    assert.equal(collection.assignments.length, 1);
    const projected = collection.assignments[0];
    assert.equal(projected.exercises[0].repetitionMode, "range");
    assert.equal(projected.exercises[0].repetitionsMin, 6);
    assert.equal(projected.exercises[0].repetitionsMax, 8);
    assert.equal(projected.exercises[0].perSetMode, true);
    assert.deepEqual(projected.exercises[0].sets.map((set) => [set.kind, set.repetitionsMin, set.repetitionsMax]), [
      ["warmup", 8, 10],
      ["working", 6, 8],
    ]);
    assert.equal(projected.exercises[1].prescriptionType, "duration");
    assert.equal(projected.exercises[1].durationSeconds, 45);
    assert.equal(projected.exercises[0].superset?.key, projected.exercises[1].superset?.key);
    assert.equal(projected.exercises[0].superset?.label, "Pair A");

    assert.equal(await clientWorkouts.findAssignment(foreign, assignment.id), null);
    assert.equal(await query.execution(athlete, { assignmentId: "99999999-9999-4999-8999-999999999999" }), null);
    assert.equal(await query.execution(foreign, { assignmentId: assignment.id }), null);
    await assert.rejects(query.execution(athlete, { assignmentId: "not-a-uuid" }), ClientWorkoutInputError);

    const cancelled = await workouts.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: published.id,
      templateRevisionId: published.revisionId,
      scheduledFor: "2026-09-04",
      trainerNote: "Cancelled R3B assignment",
    });
    assert.ok(cancelled);
    await admin.query("UPDATE app.workout_assignments SET status = 'cancelled', cancelled_at = clock_timestamp() WHERE id = $1", [cancelled.id]);
    const cancelledRead = await query.execution(athlete, { assignmentId: cancelled.id });
    assert.equal(cancelledRead?.assignment.status, "cancelled");
    assert.equal(cancelledRead?.assignment.capabilities.canStart, false);
    assert.equal(await sessions.startOrResume(athlete, {
      assignmentId: cancelled.id,
      clientTimezone: "UTC",
      idempotencyKeyHash: hash("r3b-cancelled-start"),
    }), null);

    const input = { assignmentId: assignment.id, clientTimezone: "Europe/Moscow", idempotencyKeyHash: hash("r3b-start-command") };
    const [first, second] = await Promise.all([
      sessions.startOrResume(athlete, input),
      sessions.startOrResume(athlete, input),
    ]);
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.session.id, second.session.id);
    assert.deepEqual(new Set([first.outcome, second.outcome]), new Set(["created", "resumed"]));

    const resumed = await query.execution(athlete, { assignmentId: assignment.id });
    assert.equal(resumed?.session?.id, first.session.id);
    assert.equal((await query.execution(athlete, { sessionId: first.session.id }))?.assignment.assignmentId, assignment.id);
    assert.equal(await query.execution(foreign, { sessionId: first.session.id }), null);
    const completed = await sessions.complete(athlete, {
      sessionId: first.session.id,
      expectedVersion: 1,
      idempotencyKeyHash: hash("r3b-complete"),
      requestHash: hash("r3b-complete-payload"),
      discomfortReported: false,
      zeroResultConfirmed: true,
      zeroResultReason: "R3B terminal state test",
    });
    assert.equal(completed?.status, "completed_with_omissions");
    const terminalRead = await query.execution(athlete, { assignmentId: assignment.id });
    assert.equal(terminalRead?.session?.id, first.session.id);
    assert.equal(terminalRead?.assignment.capabilities.canResume, false);
    assert.equal(terminalRead?.assignment.capabilities.canViewResult, true);
    const terminalReplay = await sessions.startOrResume(athlete, { ...input, idempotencyKeyHash: hash("r3b-start-after-complete") });
    assert.equal(terminalReplay?.session.id, first.session.id);
    assert.equal(terminalReplay?.session.status, "completed_with_omissions");
    const sessionCount = await admin.query<{ count: string }>("SELECT count(*)::text FROM app.workout_sessions WHERE assignment_id = $1", [assignment.id]);
    assert.equal(sessionCount.rows[0].count, "1");
    const startAuditCount = await admin.query<{ count: string }>("SELECT count(*)::text FROM app.audit_events WHERE event_type = 'workout.session.started' AND metadata->>'assignment_id' = $1", [assignment.id]);
    assert.equal(startAuditCount.rows[0].count, "1");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
