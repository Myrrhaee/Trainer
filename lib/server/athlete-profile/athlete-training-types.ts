export type AthleteTrainingRelationStatus = "active" | "suspended";
export type AthleteTrainingAssignmentStatus = "available" | "cancelled";
export type AthleteTrainingSessionStatus =
  | "active"
  | "completed"
  | "completed_with_omissions"
  | "abandoned";
export type AthleteTrainingAttentionStatus = "open" | "resolved" | "archived";
export type AthleteTrainingFeedbackKind = "detailed" | "acknowledgement" | "follow_up";

export type AthleteTrainingPermissions = {
  canReadTraining: boolean;
  canAssign: boolean;
  canOpenSession: boolean;
  canReview: boolean;
  canSendFeedback: boolean;
  canResolveAttention: boolean;
  canOpenAssignment: boolean;
  canEditSessionFacts: false;
};

export type AthleteTrainingFocus =
  | { kind: "relation_unavailable" }
  | { kind: "source_unavailable"; attentionItemId: string }
  | {
      kind: "review_required";
      attentionItemId: string;
      sessionId: string;
      reason: "discomfort" | "partial_completion" | "standard";
    }
  | { kind: "session_in_progress"; assignmentId: string; sessionId: string }
  | { kind: "assignment_scheduled"; assignmentId: string }
  | { kind: "no_next_assignment" }
  | { kind: "no_current_work" };

export type AthleteTrainingAction =
  | { kind: "review"; attentionItemId: string; sessionId: string }
  | { kind: "assign"; athleteUserId: string }
  | { kind: "open_session"; assignmentId: string; sessionId: string }
  | { kind: "open_assignment"; assignmentId: string };

export type AthleteTrainingPendingReview = {
  attentionItemId: string;
  sessionId: string | null;
  assignmentId: string | null;
  title: string;
  attentionStatus: "open";
  priorityReasons: string[];
  createdAt: string;
  completedAt: string | null;
  sourceAvailability: "ready" | "unavailable";
};

export type AthleteTrainingActiveExecution = {
  assignmentId: string;
  sessionId: string;
  title: string;
  scheduledFor: string;
  startedAt: string;
  version: number;
};

export type AthleteTrainingNextAssignment = {
  assignmentId: string;
  title: string;
  scheduledFor: string;
  createdAt: string;
};

export type AthleteTrainingLatestFeedback = {
  feedbackId: string;
  attentionItemId: string;
  sessionId: string;
  assignmentId: string;
  title: string;
  kind: AthleteTrainingFeedbackKind;
  body: string;
  followUpOfId: string | null;
  sentAt: string;
};

export type AthleteTrainingCurrentSnapshot = {
  trainingAvailable: boolean;
  pendingReviews: AthleteTrainingPendingReview[];
  activeExecutions: AthleteTrainingActiveExecution[];
  nextAssignment: AthleteTrainingNextAssignment | null;
  upcomingAssignmentCount: number;
  latestFeedback: AthleteTrainingLatestFeedback | null;
  readAt: string;
};

export type AthleteTrainingCurrentReadModel = {
  focus: AthleteTrainingFocus;
  pendingReviews: {
    primary: AthleteTrainingPendingReview | null;
    items: AthleteTrainingPendingReview[];
    totalCount: number;
  };
  activeExecution: {
    primary: AthleteTrainingActiveExecution | null;
    items: AthleteTrainingActiveExecution[];
    totalCount: number;
    conflict: "multiple_active_sessions" | null;
  };
  nextAssignment: {
    primary: AthleteTrainingNextAssignment | null;
    totalCount: number;
  };
  latestFeedback: AthleteTrainingLatestFeedback | null;
  availableActions: AthleteTrainingAction[];
};

export type AthleteTrainingHistoryItem = {
  assignment: {
    id: string;
    title: string;
    scheduledFor: string;
    status: AthleteTrainingAssignmentStatus;
    createdAt: string;
    cancelledAt: string | null;
  };
  session: {
    id: string;
    status: AthleteTrainingSessionStatus;
    startedAt: string;
    completedAt: string | null;
    version: number;
  } | null;
  completion: {
    completedSets: number;
    skippedSets: number;
    incompleteSets: number;
    totalSets: number;
  } | null;
  attention: {
    id: string;
    status: AthleteTrainingAttentionStatus;
    priorityReasons: string[];
    resolvedAt: string | null;
    resolutionKind: "feedback" | "manual" | "unknown" | null;
  } | null;
  feedback: {
    count: number;
    latestFeedbackId: string | null;
    latestKind: AthleteTrainingFeedbackKind | null;
    latestSentAt: string | null;
  };
  hasPersistedComment: boolean;
  sortAt: string;
  destination: {
    assignmentId: string;
    sessionId: string | null;
    attentionItemId: string | null;
  };
  degraded: "source_unavailable" | null;
};

export type AthleteTrainingHistoryPage = {
  items: AthleteTrainingHistoryItem[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

export type AthleteTrainingReadModel = {
  scope: {
    athleteUserId: string;
    relationId: string;
    relationStatus: AthleteTrainingRelationStatus;
    readAt: string;
  };
  relation: {
    status: AthleteTrainingRelationStatus;
    capabilities: AthleteTrainingPermissions;
  };
  current: AthleteTrainingCurrentReadModel;
  history: AthleteTrainingHistoryPage;
  dataAvailability: {
    hasCurrentWork: boolean;
    hasHistory: boolean;
    currentStatus: "ready" | "unavailable";
    historyStatus: "ready" | "unavailable";
    anomalies: Array<"multiple_active_sessions" | "source_unavailable">;
  };
};

export type AthleteTrainingScope = {
  athleteUserId: string;
  athleteStatus: "active" | "suspended" | "archived";
  relationId: string;
  relationStatus: AthleteTrainingRelationStatus;
};

export type AthleteTrainingHistoryCursor = {
  athleteUserId: string;
  relationId: string;
  sortAt: string;
  assignmentId: string;
};

export type AthleteTrainingHistoryInput = {
  first?: number;
  after?: string | null;
};

export type AthleteTrainingCurrentViewResult = {
  scope: AthleteTrainingReadModel["scope"];
  relation: AthleteTrainingReadModel["relation"];
  current:
    | { status: "ready"; value: AthleteTrainingCurrentReadModel }
    | { status: "error" }
    | { status: "unavailable" };
  feedback:
    | { status: "ready"; value: AthleteTrainingLatestFeedback | null }
    | { status: "error" }
    | { status: "unavailable" };
};

export type AthleteTrainingViewResult = AthleteTrainingCurrentViewResult & {
  history:
    | { status: "ready"; value: AthleteTrainingHistoryPage }
    | { status: "error" }
    | { status: "unavailable" };
};
