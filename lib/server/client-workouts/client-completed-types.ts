import type { ClientWorkoutExercisePrescription } from "./client-workout-types";

export type ClientCompletedSet = {
  id: string;
  sourceAssignmentSetId: string | null;
  setKey: string;
  position: number;
  kind: string;
  plannedRepetitionsMin: number | null;
  plannedRepetitionsMax: number | null;
  plannedDurationSeconds: number | null;
  plannedWeightKg: number | null;
  status: "completed" | "skipped" | "incomplete" | "pending";
  actualRepetitions: number | null;
  actualDurationSeconds: number | null;
  actualWeightKg: number | null;
  rpe: number | null;
  athleteComment: string;
};
export type ClientCompletedWorkoutReadModel = {
  sessionId: string;
  assignmentId: string;
  status: "completed" | "completed_with_omissions";
  title: string;
  scheduledFor: string;
  completedAt: string;
  clientTimezone: string;
  generalInstruction: string;
  trainerNote: string;
  context: {
    overallComment: string | null;
    discomfortReported: boolean | null;
    discomfortComment: string | null;
    zeroResultReason: string | null;
  };
  exercises: ClientWorkoutExercisePrescription[];
  logs: {
    id: string;
    assignmentExerciseId: string;
    position: number;
    athleteNote: string;
    sets: ClientCompletedSet[];
  }[];
};
export type ClientFeedbackItem = {
  id: string;
  sessionId: string;
  kind: "detailed" | "acknowledgement" | "follow_up";
  body: string;
  sentAt: string;
  followUpOfId: string | null;
  author: string;
};
export type ClientFeedbackPage = {
  items: ClientFeedbackItem[];
  hasNextPage: boolean;
  endCursor: string | null;
  hasPrevious: boolean;
  focusUnavailable: boolean;
};
export type ClientRecentFeedback = {
  id: string;
  sessionId: string;
  title: string;
  sentAt: string;
  kind: ClientFeedbackItem["kind"];
};
