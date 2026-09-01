export type BuilderTemplateStatus = "draft" | "published" | "archived";
export type BuilderPrescriptionType = "repetitions" | "duration";
export type BuilderRepetitionMode = "fixed" | "range";
export type BuilderSetKind = "warmup" | "working";

export type BuilderSet = {
  id: string;
  order: number;
  kind: BuilderSetKind;
  repetitionsMin: string;
  repetitionsMax: string;
  durationSec: string;
  targetWeightKg: string;
  restSec: string;
  usesOverride: boolean;
};

export type BuilderExercise = {
  instanceId: string;
  exerciseId: string;
  sourceExerciseId?: string;
  title: string;
  category: string;
  equipment?: string;
  description?: string;
  imageUrl?: string;
  prescription: {
    type: BuilderPrescriptionType;
    sets: string;
    repetitionMode: BuilderRepetitionMode;
    repetitionsMin: string;
    repetitionsMax: string;
    durationSec: string;
    targetWeightKg: string;
    restSec: string;
  };
  perSetMode: boolean;
  setOverrides: BuilderSet[];
  trainerNote: string;
};

export type BuilderItem =
  | { id: string; kind: "exercise"; exercise: BuilderExercise }
  | { id: string; kind: "superset"; label: string; instruction: string; exercises: BuilderExercise[] };

export type BuilderTemplate = {
  id: string;
  revisionId: string;
  title: string;
  status: BuilderTemplateStatus;
  revision: number;
  description: string;
  category: string;
  estimatedDurationMin: string;
  generalInstruction: string;
  items: BuilderItem[];
  updatedLabel: string;
  usageCount: number;
  latestPublishedRevision: { revisionId: string; revision: number } | null;
  editableRevision: { revisionId: string; revision: number } | null;
  editToken: string | null;
  templateToken: string;
};

export type SaveBuilderTemplateInput = Omit<BuilderTemplate,
  "id" | "revisionId" | "status" | "updatedLabel" | "usageCount" |
  "latestPublishedRevision" | "editableRevision" | "editToken" | "templateToken"
> & {
  id?: string;
};

export type WorkoutBuilderOperation =
  | "create_draft"
  | "save_draft"
  | "create_revision"
  | "publish_revision"
  | "duplicate_template"
  | "archive_template";

export type WorkoutBuilderValidationIssue = {
  path: string;
  code: string;
};

export type WorkoutBuilderCommandResult = {
  template: BuilderTemplate;
  replay: boolean;
  outcome: "created" | "saved" | "published" | "existing_draft" | "duplicated" | "archived" | "already_archived";
};

export type SaveDraftCommandInput = {
  commandId: string;
  templateId: string;
  revisionId: string;
  expectedEditToken: string | null;
  content: SaveBuilderTemplateInput;
  requestFingerprint: string;
};

export type PublishRevisionCommandInput = {
  commandId: string;
  templateId: string;
  revisionId: string;
  expectedEditToken: string;
  requestFingerprint: string;
};

export type CreateRevisionCommandInput = {
  commandId: string;
  templateId: string;
  expectedTemplateToken: string | null;
  requestFingerprint: string;
};

export type DuplicateTemplateCommandInput = {
  commandId: string;
  sourceTemplateId: string;
  sourceRevisionIntent: "editable" | "published" | "latest_saved";
  newTemplateId: string;
  newRevisionId: string;
  title: string;
  requestFingerprint: string;
};

export type ArchiveTemplateCommandInput = {
  commandId: string;
  templateId: string;
  expectedTemplateToken: string | null;
  requestFingerprint: string;
};
