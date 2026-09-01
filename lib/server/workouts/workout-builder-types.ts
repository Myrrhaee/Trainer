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
};

export type SaveBuilderTemplateInput = Omit<BuilderTemplate,
  "id" | "revisionId" | "status" | "updatedLabel" | "usageCount" |
  "latestPublishedRevision" | "editableRevision"
> & {
  id?: string;
};
