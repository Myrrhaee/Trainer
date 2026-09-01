export type AthleteProfileTab = "overview" | "training" | "progress";

export type AthleteProfileCurrentStateKind =
  | "relation_unavailable"
  | "source_unavailable"
  | "discomfort"
  | "review_required"
  | "no_next_assignment"
  | "workout_active"
  | "assignment_ready"
  | "calm";

export type AthleteProfileCurrentState = {
  kind: AthleteProfileCurrentStateKind;
  tone: "muted" | "attention" | "warning" | "active" | "calm";
  label: string;
  detail: string;
  assignmentId: string | null;
  sessionId: string | null;
  attentionItemId: string | null;
};

export type AthleteProfileAction = {
  kind: "review" | "assign";
  label: string;
  href: string;
};

export type AthleteProfileEntryInput = {
  from?: string;
  attentionItem?: string;
  entry?: string;
};

export type AthleteProfileEntryContext = {
  mode: "neutral" | "attention";
  source: "clients" | "dashboard" | "review" | "history" | "direct";
  returnHref: string;
  returnLabel: string;
  attention: {
    id: string;
    status: "open" | "resolved" | "archived";
    sessionId: string;
    title: string;
    reason: string;
  } | null;
};

export type AthleteProfileFrameReadModel = {
  identity: {
    athleteUserId: string;
    displayName: string;
    initials: string;
    goal: string | null;
  };
  relation: {
    id: string;
    status: "active" | "suspended";
    acceptedAt: string;
  };
  currentState: AthleteProfileCurrentState;
  entryContext: AthleteProfileEntryContext;
  availableActions: {
    primary: AthleteProfileAction | null;
  };
  permissions: {
    canRead: true;
    canAssign: boolean;
    canReview: boolean;
    canEditAthleteFacts: false;
  };
};

export type AthleteProfileAssignmentSummary = {
  id: string;
  title: string;
  scheduledFor: string;
  status: "scheduled" | "in_progress";
  sessionId: string | null;
};

export type AthleteProfileSessionSummary = {
  id: string;
  assignmentId: string;
  title: string;
  status: "completed" | "completed_with_omissions";
  startedAt: string;
  completedAt: string;
  completedSets: number;
  totalSets: number;
};

export type AthleteProfileFeedbackSummary = {
  id: string;
  sessionId: string;
  sentAt: string;
  kind: "detailed" | "acknowledgement" | "follow_up";
};

export type AthleteOverviewReadModel = {
  about: {
    biography: string | null;
    trainingExperience: string | null;
    athleteContext: string | null;
  };
  trainingContext: {
    preferences: string[];
    availableEquipment: string[];
    schedule: string | null;
    athleteReportedLimitations: string | null;
  };
  recentWork: {
    currentAssignment: AthleteProfileAssignmentSummary | null;
    lastSession: AthleteProfileSessionSummary | null;
    lastFeedback: AthleteProfileFeedbackSummary | null;
    nextStep: string;
  };
  dataAvailability: {
    hasAbout: boolean;
    hasTrainingContext: boolean;
    hasCompletedWork: boolean;
  };
};

export type AthleteProfileReadModel = {
  frame: AthleteProfileFrameReadModel;
  overview: AthleteOverviewReadModel;
};

export type AthleteProfileSnapshot = {
  athleteUserId: string;
  displayName: string;
  initials: string;
  athleteStatus: "active" | "suspended" | "archived";
  relationId: string;
  relationStatus: "active" | "suspended";
  acceptedAt: string;
  profile: {
    goal: string | null;
    biography: string | null;
    trainingExperience: string | null;
    athleteContext: string | null;
    preferences: string[];
    availableEquipment: string[];
    schedule: string | null;
    athleteReportedLimitations: string | null;
  };
  currentAssignment: AthleteProfileAssignmentSummary | null;
  lastSession: AthleteProfileSessionSummary | null;
  lastFeedback: AthleteProfileFeedbackSummary | null;
  openAttention: {
    id: string;
    sessionId: string;
    title: string;
    status: "open";
    priorityReasons: string[];
  } | null;
};

export type AthleteProfileAttentionSnapshot = {
  id: string;
  sessionId: string;
  title: string;
  status: "open" | "resolved" | "archived";
  priorityReasons: string[];
};
