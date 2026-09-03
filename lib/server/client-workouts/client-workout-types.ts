import type { RelationStatus } from "@/lib/server/access/access-types";
import type { WorkoutSession, WorkoutSessionStatus } from "@/lib/server/workout-sessions/workout-session-types";

export type ClientWorkoutSetPrescription = {
  assignmentSetId: string;
  setKey: string;
  position: number;
  kind: "warmup" | "working";
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number;
  usesOverride: boolean;
};

export type ClientWorkoutExercisePrescription = {
  assignmentExerciseId: string;
  instanceKey: string;
  sourceExerciseKey: string;
  position: number;
  title: string;
  category: string;
  equipment: string | null;
  prescriptionType: "repetitions" | "duration";
  repetitionMode: "fixed" | "range";
  setCount: number;
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number;
  trainerNote: string;
  perSetMode: boolean;
  superset: null | {
    key: string;
    position: number;
    label: string;
    instruction: string;
  };
  sets: ClientWorkoutSetPrescription[];
};

export type ClientWorkoutSessionSummary = {
  sessionId: string;
  status: WorkoutSessionStatus;
  version: number;
  startedAt: string;
  completedAt: string | null;
};

export type ClientWorkoutAssignmentReadModel = {
  assignmentId: string;
  athleteUserId: string;
  trainer: { displayName: string };
  source: {
    templateId: string;
    revisionId: string;
    revisionNumber: number;
  };
  scheduledFor: string;
  status: "available" | "cancelled";
  relationStatus: RelationStatus;
  title: string;
  generalInstruction: string;
  trainerNote: string;
  exercises: ClientWorkoutExercisePrescription[];
  session: ClientWorkoutSessionSummary | null;
  capabilities: {
    canStart: boolean;
    canResume: boolean;
    canViewResult: boolean;
  };
  createdAt: string;
};

export type ClientWorkoutCollectionReadModel = {
  currentAssignmentId: string | null;
  assignments: ClientWorkoutAssignmentReadModel[];
  limit: number;
  hasMore: boolean;
};

export type ClientWorkoutExecutionReadModel = {
  identity: {
    assignmentId: string;
    sessionId: string | null;
    athleteUserId: string;
  };
  assignment: ClientWorkoutAssignmentReadModel;
  session: WorkoutSession | null;
  capabilities: {
    canEdit: boolean;
    canSkip: boolean;
    canResume: boolean;
    canEnterCompletionFlow: boolean;
  };
};

export type StartOrResumeSessionResult = {
  session: WorkoutSession;
  outcome: "created" | "resumed";
};
