export type WorkoutTemplateEditorViewIntent = "default" | "editable" | "published" | "archived";
export type WorkoutTemplateEditorMode = "new" | "editable" | "published" | "archived";
export type WorkoutTemplateLifecycle = "draft_only" | "published_only" | "published_with_draft" | "archived";
export type WorkoutTemplateSelectedRevisionRole =
  | "editable"
  | "published"
  | "archived_editable"
  | "archived_published";

export type WorkoutTemplateEditorRevisionSummary = {
  revisionId: string;
  revisionNumber: number;
  status: "draft" | "published";
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type WorkoutTemplateEditorIssue = {
  severity: "persistence_blocker" | "publication_blocker" | "warning";
  code: string;
  path: string;
  instanceKey: string | null;
  setKey: string | null;
  supersetKey: string | null;
  messageData: { code: string };
};

export type WorkoutTemplateEditorSet = {
  templateSetId: string;
  setKey: string;
  position: number;
  kind: "warmup" | "working";
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  usesOverride: boolean;
};

export type WorkoutTemplateExerciseSourceAvailability =
  | "ready"
  | "archived"
  | "unavailable"
  | "source_not_mapped"
  | "image_unavailable";

export type WorkoutTemplateEditorExercise = {
  templateExerciseId: string;
  instanceKey: string;
  sourceExerciseId: string | null;
  sourceExerciseKey: string;
  position: number;
  snapshot: {
    title: string;
    description: string | null;
    category: string;
    equipment: string | null;
    imageUrl: string | null;
  };
  prescription: {
    type: "repetitions" | "duration";
    repetitionMode: "fixed" | "range";
    setCount: number | null;
    repetitionsMin: number | null;
    repetitionsMax: number | null;
    durationSeconds: number | null;
    targetWeightKg: number | null;
    restSeconds: number | null;
  };
  trainerNote: string;
  perSetMode: boolean;
  sets: WorkoutTemplateEditorSet[];
  superset: {
    supersetKey: string;
    supersetPosition: number;
    label: string;
    instruction: string;
  } | null;
  source: {
    availability: WorkoutTemplateExerciseSourceAvailability;
    currentStatus: "active" | "archived" | null;
    currentStableKey: string | null;
    imageAvailability: "ready" | "image_unavailable" | null;
  };
  anomalies: Array<"source_not_mapped" | "source_unavailable" | "source_archived" | "image_unavailable">;
};

export type WorkoutTemplateEditorCapabilities = {
  canRead: boolean;
  canSaveDraft: boolean;
  canAttemptPublish: boolean;
  publicationReady: boolean;
  canCreateRevision: boolean;
  canContinueDraft: boolean;
  canViewPublished: boolean;
  canDuplicate: boolean;
  canArchive: boolean;
  canOpenExerciseLibrary: boolean;
};

export type WorkoutTemplateEditorAnomaly =
  | "lifecycle_pointer_mismatch"
  | "selected_revision_missing"
  | "invalid_revision_status"
  | "duplicate_instance_key"
  | "duplicate_set_key"
  | "invalid_exercise_order"
  | "invalid_set_order"
  | "invalid_superset"
  | "source_not_mapped"
  | "source_unavailable"
  | "published_content_invalid";

export type WorkoutTemplateEditorContent = {
  title: string;
  description: string;
  category: string;
  generalInstruction: string;
  estimatedDurationMin: number | null;
  revisionStatus: "draft" | "published" | null;
  revisionNumber: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  exercises: WorkoutTemplateEditorExercise[];
};

export type WorkoutTemplateEditorReadModel = {
  mode: WorkoutTemplateEditorMode;
  requestedView: WorkoutTemplateEditorViewIntent;
  identity: {
    templateId: string;
    selectedRevisionId: string;
    selectedRevisionNumber: number;
    selectedRevisionRole: WorkoutTemplateSelectedRevisionRole;
    lifecycle: WorkoutTemplateLifecycle;
  } | null;
  lifecycle: {
    templateStatus: "draft" | "published" | "archived" | null;
    publishedRevisionSummary: WorkoutTemplateEditorRevisionSummary | null;
    editableRevisionSummary: WorkoutTemplateEditorRevisionSummary | null;
    archivedAt: string | null;
    meaningfulUpdatedAt: string | null;
  };
  content: WorkoutTemplateEditorContent;
  validation: {
    persistenceBlockers: WorkoutTemplateEditorIssue[];
    publicationBlockers: WorkoutTemplateEditorIssue[];
    warnings: WorkoutTemplateEditorIssue[];
  };
  capabilities: WorkoutTemplateEditorCapabilities;
  concurrency: {
    editToken: string | null;
    lifecycleToken: string | null;
    lastPersistedAt: string | null;
  };
  fieldLimits: {
    title: number;
    description: number;
    category: number;
    generalInstruction: number;
    exerciseCount: number;
    setCountPerExercise: number;
    trainerNote: number;
  };
  anomalies: WorkoutTemplateEditorAnomaly[];
  dataAvailability: "ready" | "empty" | "source_partial";
  readAt: string;
};
