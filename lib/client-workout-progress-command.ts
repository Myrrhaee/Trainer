import type { ClientWorkoutExecutionReadModel } from "@/lib/server/client-workouts/client-workout-types";
import type { ProgressSetInput, WorkoutSetLog } from "@/lib/server/workout-sessions/workout-session-types";

export type ClientWorkoutSetOperation = "save" | "skip";

export type ClientWorkoutSetCommandPayload = {
  expectedVersion: number;
  idempotencyKey: string;
  sets: [ProgressSetInput];
};

type PersistedSetFacts = Omit<ProgressSetInput, "status"> & {
  status: WorkoutSetLog["status"];
};

export type ClientWorkoutSetCommandAttempt = {
  operation: ClientWorkoutSetOperation;
  commandId: string;
  sessionId: string;
  assignmentId: string;
  exerciseLogId: string;
  setLogId: string;
  sourceAssignmentSetId: string | null;
  baseline: PersistedSetFacts;
  frozenPayload: ClientWorkoutSetCommandPayload;
  fingerprint: string;
  startedAt: string;
};

export function persistedSetFacts(set: WorkoutSetLog): PersistedSetFacts {
  return {
    setLogId: set.id,
    status: set.status,
    actualRepetitions: set.actualRepetitions,
    actualDurationSeconds: set.actualDurationSeconds,
    actualWeightKg: set.actualWeightKg,
    rpe: set.rpe,
    athleteComment: set.athleteComment,
  };
}

export function createClientWorkoutSetAttempt(input: {
  operation: ClientWorkoutSetOperation;
  assignmentId: string;
  sessionId: string;
  exerciseLogId: string;
  set: WorkoutSetLog;
  expectedVersion: number;
  actual: Omit<ProgressSetInput, "setLogId" | "status">;
  commandId?: string;
  startedAt?: string;
}): ClientWorkoutSetCommandAttempt {
  const result: ProgressSetInput = input.operation === "skip"
    ? {
      setLogId: input.set.id,
      status: "skipped",
      actualRepetitions: null,
      actualDurationSeconds: null,
      actualWeightKg: null,
      rpe: null,
      athleteComment: input.actual.athleteComment,
    }
    : { setLogId: input.set.id, status: "completed", ...input.actual };
  const commandId = input.commandId ?? crypto.randomUUID();
  const frozenPayload: ClientWorkoutSetCommandPayload = {
    expectedVersion: input.expectedVersion,
    idempotencyKey: commandId,
    sets: [result],
  };
  return {
    operation: input.operation,
    commandId,
    sessionId: input.sessionId,
    assignmentId: input.assignmentId,
    exerciseLogId: input.exerciseLogId,
    setLogId: input.set.id,
    sourceAssignmentSetId: input.set.sourceAssignmentSetId,
    baseline: persistedSetFacts(input.set),
    frozenPayload,
    fingerprint: setIntentFingerprint(input.operation, frozenPayload),
    startedAt: input.startedAt ?? new Date().toISOString(),
  };
}

export function isSameClientWorkoutSetIntent(
  attempt: ClientWorkoutSetCommandAttempt,
  candidate: ClientWorkoutSetCommandAttempt,
) {
  return attempt.sessionId === candidate.sessionId
    && attempt.setLogId === candidate.setLogId
    && attempt.fingerprint === candidate.fingerprint;
}

export function reconcileClientWorkoutSetAttempt(
  attempt: ClientWorkoutSetCommandAttempt,
  execution: ClientWorkoutExecutionReadModel,
): "accept" | "replay" | "conflict" {
  if (execution.identity.assignmentId !== attempt.assignmentId
    || execution.identity.sessionId !== attempt.sessionId
    || !execution.session) return "conflict";
  const exercise = execution.session.exercises.find((item) => item.id === attempt.exerciseLogId);
  const set = exercise?.sets.find((item) => item.id === attempt.setLogId);
  if (!set || set.sourceAssignmentSetId !== attempt.sourceAssignmentSetId) return "conflict";
  const observed = persistedSetFacts(set);
  if (sameFacts(observed, attempt.frozenPayload.sets[0])) return "accept";
  if (execution.session.status === "active" && sameFacts(observed, attempt.baseline)) return "replay";
  return "conflict";
}

function setIntentFingerprint(operation: ClientWorkoutSetOperation, payload: ClientWorkoutSetCommandPayload) {
  return JSON.stringify({ operation, expectedVersion: payload.expectedVersion, set: payload.sets[0] });
}

function sameFacts(left: PersistedSetFacts, right: PersistedSetFacts) {
  return left.setLogId === right.setLogId
    && left.status === right.status
    && left.actualRepetitions === right.actualRepetitions
    && left.actualDurationSeconds === right.actualDurationSeconds
    && left.actualWeightKg === right.actualWeightKg
    && left.rpe === right.rpe
    && left.athleteComment === right.athleteComment;
}
