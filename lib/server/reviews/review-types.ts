export type ReviewFeedbackKind = "detailed" | "acknowledgement" | "follow_up";
export type ReviewAttentionStatus = "open" | "resolved" | "archived";
export type ReviewSessionStatus = "completed" | "completed_with_omissions";
export type ReviewLogStatus = "pending" | "completed" | "skipped" | "incomplete";

export type ReviewAvailability<T> =
  | { status: "ready"; value: T }
  | { status: "known_empty"; value: null }
  | { status: "unsupported"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "partial"; value: T; reason: string };

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

export type ReviewReadFeedback = ReviewFeedback & { assignmentId: string };

export type TrainerReviewQueueItem = {
  id: string;
  sessionId: string;
  athleteUserId: string;
  athleteDisplayName: string;
  athleteInitials: string;
  sessionTitle: string;
  status: ReviewAttentionStatus;
  completedAt: string;
  createdAt: string;
  completedSets: number;
  totalSets: number;
  hasClientComments: boolean;
  priorityReasons: string[];
};

export type ReviewSetValues = {
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
};

export type ReviewDeviationType =
  | "set_skipped"
  | "exercise_skipped"
  | "result_incomplete"
  | "planned_repetitions_not_met"
  | "repetitions_changed"
  | "load_changed"
  | "duration_changed"
  | "log_missing"
  | "athlete_comment_present"
  | "source_unavailable";

export type ReviewDeviation = {
  id: string;
  type: ReviewDeviationType;
  exerciseLogId: string | null;
  setLogId: string | null;
  assignmentExerciseId: string;
  sourceAssignmentSetId: string | null;
  planned: ReviewSetValues | null;
  actual: ReviewSetValues | null;
  commentReference: {
    source: "exercise_note" | "set_comment";
    sourceId: string;
    text: string;
  } | null;
};

export type ReviewSourceComment = {
  source: "exercise_note" | "set_comment";
  sourceId: string;
  exerciseLogId: string | null;
  setLogId: string | null;
  text: string;
};

export type ReviewSetReadModel = {
  identity: {
    setLogId: string | null;
    sourceAssignmentSetId: string | null;
    setKey: string;
    position: number;
  };
  prescribed: {
    source: "assignment_snapshot" | "session_snapshot";
    kind: "warmup" | "working";
    repetitionsMin: number | null;
    repetitionsMax: number | null;
    durationSeconds: number | null;
    weightKg: number | null;
    restSeconds: number | null;
  };
  actual: {
    status: ReviewLogStatus | "missing";
    repetitions: number | null;
    durationSeconds: number | null;
    weightKg: number | null;
    rpe: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  athleteComment: ReviewAvailability<string>;
  sourceComments: ReviewSourceComment[];
  deviations: ReviewDeviation[];
};

export type ReviewExerciseReadModel = {
  identity: {
    exerciseLogId: string | null;
    assignmentExerciseId: string;
    position: number;
    title: string;
  };
  prescribed: {
    instanceKey: string;
    category: string;
    equipment: string | null;
    prescriptionType: "repetitions" | "duration";
    repetitionMode: "fixed" | "range";
    repetitionsMin: number | null;
    repetitionsMax: number | null;
    durationSeconds: number | null;
    targetWeightKg: number | null;
    restSeconds: number;
    trainerNote: string;
  };
  actual: {
    status: ReviewLogStatus | "missing";
    athleteNote: ReviewAvailability<string>;
    createdAt: string | null;
    updatedAt: string | null;
  };
  sets: ReviewSetReadModel[];
  sourceComments: ReviewSourceComment[];
  deviations: ReviewDeviation[];
};

export type ReviewAnomalyType =
  | "assignment_snapshot_unavailable"
  | "logs_partial"
  | "logs_unavailable"
  | "source_session_unavailable"
  | "attention_source_mismatch"
  | "set_source_identity_missing"
  | "feedback_attention_mismatch"
  | "unsupported_session_context";

export type ReviewAnomaly = {
  type: ReviewAnomalyType;
  exerciseLogId?: string | null;
  setLogId?: string | null;
  attentionItemId?: string;
  feedbackId?: string;
  detail: string;
};

export type ReviewCapabilities = {
  canRead: boolean;
  canSendInitialFeedback: boolean;
  canSendAcknowledgement: boolean;
  canSendFollowUp: boolean;
  canResolveManually: boolean;
  canOpenAthleteProfile?: boolean;
  canAssignNext?: boolean;
};

export type ReviewReadModel = {
  identity: {
    sessionId: string;
    assignmentId: string;
    attentionItemId: string;
    athleteUserId: string;
    relationId: string;
  };
  athlete: { id: string; displayName: string; initials: string };
  attention: {
    id: string;
    status: ReviewAttentionStatus;
    createdAt: string;
    resolvedAt: string | null;
    priorityReasons: string[];
    manualResolutionReason: string | null;
    sourceAvailability: ReviewAvailability<{ sessionId: string }>;
  };
  assignmentSnapshot: {
    id: string;
    sourceTemplateId: string;
    sourceRevisionId: string;
    sourceRevisionNumber: number;
    title: string;
    scheduledFor: string;
    instruction: string;
    trainerNote: string;
    createdAt: string;
  };
  session: {
    id: string;
    assignmentId: string;
    title: string;
    status: ReviewSessionStatus;
    clientTimezone: string;
    startedAt: string;
    completedAt: string;
    durationMin: number;
    zeroResultReason: ReviewAvailability<string>;
    createdAt: string;
    updatedAt: string;
  };
  exercises: ReviewExerciseReadModel[];
  sessionContext: {
    overallComment: ReviewAvailability<string>;
    discomfort: ReviewAvailability<{ reported: true; comment: string }>;
    subjectiveMetrics: ReviewAvailability<Record<string, never>>;
  };
  existingFeedback: ReviewReadFeedback[];
  capabilities: ReviewCapabilities;
  anomalies: ReviewAnomaly[];
  dataAvailability: {
    sourceSession: ReviewAvailability<{ sessionId: string }>;
    assignmentSnapshot: ReviewAvailability<{ assignmentId: string }>;
    logs: ReviewAvailability<{ exerciseCount: number; setCount: number }>;
    feedback: ReviewAvailability<{ count: number }>;
    sessionContext: {
      overallComment: ReviewAvailability<string>;
      discomfort: ReviewAvailability<{ reported: true; comment: string }>;
      subjectiveMetrics: ReviewAvailability<Record<string, never>>;
    };
    canAssertNoDeviations: boolean;
  };
};
