export type QuickAssignRelationStatus = "active" | "suspended";
export type QuickAssignAthleteStatus = "active" | "suspended" | "archived";

export type QuickAssignUpcomingAssignment = {
  assignmentId: string;
  sourceRevisionId: string;
  title: string;
  scheduledFor: string;
  createdAt: string;
};

export type QuickAssignTemplateListItem = {
  templateId: string;
  revisionId: string;
  revisionNumber: number;
  title: string;
  description: string;
  category: string;
  exerciseCount: number;
  prescribedSetCount: number;
  supersetCount: number;
  estimatedDurationMin: number | null;
  updatedAt: string;
  eligibility: {
    assignable: true;
    reason: "ready";
  };
};

export type QuickAssignSetPrescription = {
  templateSetId: string;
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

export type QuickAssignExercisePreview = {
  templateExerciseId: string;
  instanceKey: string;
  position: number;
  title: string;
  category: string;
  equipment: string | null;
  prescriptionType: "repetitions" | "duration";
  repetitionMode: "fixed" | "range";
  sets: number;
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number;
  trainerNote: string;
  superset: {
    key: string;
    position: number;
    label: string;
    instruction: string;
  } | null;
  setPrescriptions: QuickAssignSetPrescription[];
};

export type QuickAssignTemplatePreview = QuickAssignTemplateListItem & {
  generalInstruction: string;
  exercises: QuickAssignExercisePreview[];
};

export type QuickAssignSelectedTemplate =
  | { status: "idle" }
  | { status: "ready"; template: QuickAssignTemplatePreview }
  | {
      status: "stale_revision" | "archived" | "draft";
      tombstone: {
        templateId: string;
        revisionId: string;
        revisionNumber: number;
        title: string;
      };
    }
  | { status: "unavailable" };

export type QuickAssignReadModel = {
  readAt: string;
  athlete: {
    athleteUserId: string;
    relationId: string;
    displayName: string;
    initials: string;
    relationStatus: QuickAssignRelationStatus;
    athleteStatus: QuickAssignAthleteStatus;
    capabilities: {
      canAssign: boolean;
      canSearchTemplates: boolean;
      canOpenBuilder: boolean;
      blockedReason: "relation_suspended" | "athlete_unavailable" | null;
    };
    nextAssignment: QuickAssignUpcomingAssignment | null;
    upcomingAssignments: QuickAssignUpcomingAssignment[];
    upcomingAssignmentCount: number;
    assignmentStateToken: string;
  };
  calendar: {
    today: string;
    tomorrow: string;
    minScheduledFor: string;
    selectedScheduledFor: null;
    timezone: string | null;
    timezoneAvailability: "available" | "unavailable";
    fallbackExplanation: string | null;
  };
  templates: {
    items: QuickAssignTemplateListItem[];
    pageInfo: {
      endCursor: string | null;
      hasNextPage: boolean;
    };
    search: {
      query: string;
      pageSize: number;
    };
  };
  selectedTemplate: QuickAssignSelectedTemplate;
  dataAvailability: {
    athlete: "ready" | "unavailable";
    templates: "ready" | "unavailable";
    preview: "idle" | "ready" | "stale" | "unavailable";
  };
};

export type QuickAssignScope = {
  athleteUserId: string;
  relationId: string;
  displayName: string;
  initials: string;
  relationStatus: QuickAssignRelationStatus;
  athleteStatus: QuickAssignAthleteStatus;
  readAt: string;
  today: string;
  tomorrow: string;
};

export type QuickAssignTemplateCursor = {
  trainerUserId: string;
  athleteUserId: string;
  relationId: string;
  query: string;
  updatedAt: string;
  templateId: string;
};

export type QuickAssignListInput = {
  query?: string;
  after?: string | null;
  first?: number;
};

export type QuickAssignFindInput = QuickAssignListInput & {
  templateRevisionId?: string | null;
};
