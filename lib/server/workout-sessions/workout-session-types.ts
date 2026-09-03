export type WorkoutSessionStatus = "active" | "completed" | "completed_with_omissions" | "abandoned";
export type WorkoutLogStatus = "pending" | "completed" | "skipped" | "incomplete";

export type WorkoutSetLog = {
  id: string;
  sourceAssignmentSetId: string | null;
  setKey: string;
  position: number;
  kind: "warmup" | "working";
  plannedRepetitionsMin: number | null;
  plannedRepetitionsMax: number | null;
  plannedDurationSeconds: number | null;
  plannedWeightKg: number | null;
  status: WorkoutLogStatus;
  actualRepetitions: number | null;
  actualDurationSeconds: number | null;
  actualWeightKg: number | null;
  rpe: number | null;
  athleteComment: string;
  updatedAt: string;
};

export type WorkoutExerciseLog = {
  id: string;
  assignmentExerciseId: string;
  title: string;
  position: number;
  status: WorkoutLogStatus;
  athleteNote: string;
  sets: WorkoutSetLog[];
  updatedAt: string;
};

export type WorkoutSession = {
  id: string;
  assignmentId: string;
  trainerUserId: string;
  athleteUserId: string;
  title: string;
  status: WorkoutSessionStatus;
  version: number;
  clientTimezone: string;
  startedAt: string;
  completedAt: string | null;
  exercises: WorkoutExerciseLog[];
  attentionItemId: string | null;
  updatedAt: string;
};

export type ProgressSetInput = {
  setLogId: string;
  status: "completed" | "skipped" | "incomplete";
  actualRepetitions: number | null;
  actualDurationSeconds: number | null;
  actualWeightKg: number | null;
  rpe: number | null;
  athleteComment: string;
};
