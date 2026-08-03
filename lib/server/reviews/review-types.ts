export type ReviewFeedbackKind = "detailed" | "acknowledgement" | "follow_up";

export type ReviewFeedback = {
  id: string;
  attentionItemId: string;
  sessionId: string;
  trainerUserId: string;
  athleteUserId: string;
  kind: ReviewFeedbackKind;
  body: string;
  followUpOfId: string | null;
  author: string;
  sentAt: string;
};

export type TrainerReviewQueueItem = {
  id: string;
  sessionId: string;
  athleteUserId: string;
  athleteDisplayName: string;
  athleteInitials: string;
  sessionTitle: string;
  status: "open" | "resolved" | "archived";
  completedAt: string;
  createdAt: string;
  completedSets: number;
  totalSets: number;
  hasClientComments: boolean;
  priorityReasons: string[];
};

export type TrainerReviewSet = {
  id: string;
  kind: "warmup" | "working";
  position: number;
  status: "pending" | "completed" | "skipped" | "incomplete";
  plannedRepetitionsMin: number | null;
  plannedRepetitionsMax: number | null;
  plannedDurationSeconds: number | null;
  plannedWeightKg: number | null;
  actualRepetitions: number | null;
  actualDurationSeconds: number | null;
  actualWeightKg: number | null;
  rpe: number | null;
  athleteComment: string;
};

export type TrainerReviewExercise = {
  id: string;
  title: string;
  position: number;
  status: "pending" | "completed" | "skipped" | "incomplete";
  athleteNote: string;
  sets: TrainerReviewSet[];
};

export type TrainerReviewDetails = {
  attention: {
    id: string;
    status: "open" | "resolved" | "archived";
    createdAt: string;
    resolvedAt: string | null;
    priorityReasons: string[];
    manualResolutionReason: string | null;
  };
  session: {
    id: string;
    assignmentId: string;
    title: string;
    status: "completed" | "completed_with_omissions";
    startedAt: string;
    completedAt: string;
    durationMin: number;
  };
  athlete: {
    id: string;
    displayName: string;
    initials: string;
  };
  assignment: {
    id: string;
    scheduledFor: string;
  };
  exercises: TrainerReviewExercise[];
  feedback: ReviewFeedback[];
};
