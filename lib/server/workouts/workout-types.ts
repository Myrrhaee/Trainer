export type WorkoutExerciseInput = {
  instanceKey: string;
  title: string;
  sets: number;
  repetitions: number;
  targetWeightKg: number | null;
  restSeconds: number;
  trainerNote: string;
};

export type CreateWorkoutTemplateInput = {
  title: string;
  description: string;
  generalInstruction: string;
  estimatedDurationMin: number | null;
  exercises: WorkoutExerciseInput[];
};

export type WorkoutTemplate = {
  id: string;
  title: string;
  description: string;
  status: "published";
  revisionId: string;
  revision: number;
  generalInstruction: string;
  estimatedDurationMin: number | null;
  exercises: WorkoutExerciseInput[];
  createdAt: string;
};

export type TrainerAthlete = {
  relationId: string;
  athleteUserId: string;
  displayName: string;
  initials: string;
  acceptedAt: string;
};

export type WorkoutAssignment = {
  id: string;
  assignmentId: string;
  athleteUserId: string;
  trainerUserId: string;
  title: string;
  titleSnapshot: string;
  trainerNote: string;
  generalInstruction: string;
  scheduledFor: string;
  status: "available" | "cancelled";
  sourceTemplateId: string;
  sourceRevisionId: string;
  sourceRevision: number;
  sourceRevisionNumber: number;
  exercises: WorkoutExerciseInput[];
  createdAt: string;
};

export type CreateWorkoutAssignmentInput = {
  assignmentId?: string;
  athleteUserId: string;
  templateId: string;
  templateRevisionId?: string;
  scheduledFor: string;
  trainerNote: string;
  assignmentStateToken?: string;
  allowAdditionalAssignment?: boolean;
};
