import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientWorkoutSetAttempt,
  isSameClientWorkoutSetIntent,
  reconcileClientWorkoutSetAttempt,
} from "../../lib/client-workout-progress-command";
import type { ClientWorkoutExecutionReadModel } from "../../lib/server/client-workouts/client-workout-types";
import type { WorkoutSetLog } from "../../lib/server/workout-sessions/workout-session-types";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const exerciseLogId = "33333333-3333-4333-8333-333333333333";
const setLogId = "44444444-4444-4444-8444-444444444444";

function set(overrides: Partial<WorkoutSetLog> = {}): WorkoutSetLog {
  return {
    id: setLogId,
    sourceAssignmentSetId: "55555555-5555-4555-8555-555555555555",
    setKey: "working-1",
    position: 1,
    kind: "working",
    plannedRepetitionsMin: 6,
    plannedRepetitionsMax: 8,
    plannedDurationSeconds: null,
    plannedWeightKg: 60,
    status: "pending",
    actualRepetitions: null,
    actualDurationSeconds: null,
    actualWeightKg: null,
    rpe: null,
    athleteComment: "",
    updatedAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  };
}

function execution(currentSet: WorkoutSetLog, options: { active?: boolean; setId?: string } = {}): ClientWorkoutExecutionReadModel {
  const active = options.active ?? true;
  const sessionSet = options.setId ? { ...currentSet, id: options.setId } : currentSet;
  return {
    identity: { assignmentId, sessionId, athleteUserId: "66666666-6666-4666-8666-666666666666" },
    assignment: {
      assignmentId,
      athleteUserId: "66666666-6666-4666-8666-666666666666",
      trainer: { displayName: "Trainer" },
      source: { templateId: "77777777-7777-4777-8777-777777777777", revisionId: "88888888-8888-4888-8888-888888888888", revisionNumber: 1 },
      scheduledFor: "2026-09-03",
      status: "available",
      relationStatus: "active",
      title: "Workout",
      generalInstruction: "",
      trainerNote: "",
      exercises: [],
      session: { sessionId, status: active ? "active" : "completed", version: 2, startedAt: "2026-09-03T10:00:00.000Z", completedAt: active ? null : "2026-09-03T11:00:00.000Z" },
      capabilities: { canStart: false, canResume: active, canViewResult: !active },
      createdAt: "2026-09-03T09:00:00.000Z",
    },
    session: {
      id: sessionId,
      assignmentId,
      trainerUserId: "99999999-9999-4999-8999-999999999999",
      athleteUserId: "66666666-6666-4666-8666-666666666666",
      title: "Workout",
      status: active ? "active" : "completed",
      version: 2,
      clientTimezone: "UTC",
      startedAt: "2026-09-03T10:00:00.000Z",
      completedAt: active ? null : "2026-09-03T11:00:00.000Z",
      exercises: [{ id: exerciseLogId, assignmentExerciseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Squat", position: 1, status: sessionSet.status, athleteNote: "", sets: [sessionSet], updatedAt: sessionSet.updatedAt }],
      attentionItemId: null,
      updatedAt: sessionSet.updatedAt,
    },
    capabilities: { canEdit: active, canSkip: active, canResume: active, canEnterCompletionFlow: active },
  };
}

const actual = {
  actualRepetitions: 7,
  actualDurationSeconds: null,
  actualWeightKg: 62.5,
  rpe: 8,
  athleteComment: "Рабочий подход",
};

test("set attempt freezes command identity, payload and preserves planned nulls", () => {
  const attempt = createClientWorkoutSetAttempt({
    operation: "save", assignmentId, sessionId, exerciseLogId, set: set(), expectedVersion: 1,
    actual, commandId: "r3c-command", startedAt: "2026-09-03T10:05:00.000Z",
  });
  assert.equal(attempt.commandId, "r3c-command");
  assert.equal(attempt.frozenPayload.idempotencyKey, "r3c-command");
  assert.equal(attempt.frozenPayload.sets[0].actualDurationSeconds, null);
  assert.equal(attempt.baseline.status, "pending");

  const same = createClientWorkoutSetAttempt({
    operation: "save", assignmentId, sessionId, exerciseLogId, set: set(), expectedVersion: 1,
    actual, commandId: "another-command",
  });
  const changed = createClientWorkoutSetAttempt({
    operation: "save", assignmentId, sessionId, exerciseLogId, set: set(), expectedVersion: 1,
    actual: { ...actual, actualRepetitions: 8 }, commandId: "changed-command",
  });
  assert.equal(isSameClientWorkoutSetIntent(attempt, same), true);
  assert.equal(isSameClientWorkoutSetIntent(attempt, changed), false);
});

test("skip remains distinct from zero and incomplete", () => {
  const skipped = createClientWorkoutSetAttempt({
    operation: "skip", assignmentId, sessionId, exerciseLogId, set: set(), expectedVersion: 1,
    actual: { ...actual, actualRepetitions: 0 }, commandId: "skip-command",
  });
  assert.deepEqual(skipped.frozenPayload.sets[0], {
    setLogId,
    status: "skipped",
    actualRepetitions: null,
    actualDurationSeconds: null,
    actualWeightKg: null,
    rpe: null,
    athleteComment: "Рабочий подход",
  });
  assert.notEqual(skipped.baseline.status, "incomplete");
});

test("unknown set command accepts persisted facts, replays unchanged state, and conflicts safely", () => {
  const attempt = createClientWorkoutSetAttempt({
    operation: "save", assignmentId, sessionId, exerciseLogId, set: set(), expectedVersion: 1,
    actual, commandId: "r3c-command",
  });
  assert.equal(reconcileClientWorkoutSetAttempt(attempt, execution(set({
    status: "completed", ...actual,
  }))), "accept");
  assert.equal(reconcileClientWorkoutSetAttempt(attempt, execution(set())), "replay");
  assert.equal(reconcileClientWorkoutSetAttempt(attempt, execution(set({ status: "completed", ...actual, actualRepetitions: 6 }))), "conflict");
  assert.equal(reconcileClientWorkoutSetAttempt(attempt, execution(set(), { active: false })), "conflict");
  assert.equal(reconcileClientWorkoutSetAttempt(attempt, execution(set(), { setId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })), "conflict");
});
