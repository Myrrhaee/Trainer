export type ClientWorkoutHistoryItem = {
  sessionId: string;
  assignmentId: string;
  title: string;
  scheduledFor: string;
  completedAt: string;
  clientTimezone: string;
  status: "completed" | "completed_with_omissions";
  summary: {
    availability: "ready" | "partial";
    exerciseCount: number;
    plannedSetCount: number;
    completedSetCount: number;
    skippedSetCount: number;
    incompleteSetCount: number;
  };
  feedback: {
    hasFeedback: boolean;
    feedbackCount: number;
    latestFeedbackAt: string | null;
  };
};

export type ClientWorkoutHistoryReadModel = {
  items: ClientWorkoutHistoryItem[];
  pageInfo: {
    hasNextPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
};
