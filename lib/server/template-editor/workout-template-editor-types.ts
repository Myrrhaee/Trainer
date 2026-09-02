import type { WorkoutTemplateEditorViewIntent } from "@/lib/workout-template-editor-contract";

export type WorkoutTemplateEditorReadInput = {
  templateId: string;
  view: WorkoutTemplateEditorViewIntent;
};

export class WorkoutTemplateEditorValidationError extends Error {
  constructor(public readonly code: "invalid_template_id" | "invalid_view") {
    super(code);
  }
}

export class WorkoutTemplateEditorNotFoundError extends Error {
  constructor() {
    super("template_not_found");
  }
}

export class WorkoutTemplateEditorViewUnavailableError extends Error {
  constructor(public readonly code: "editable_draft_not_found" | "published_revision_not_found" | "requested_view_unavailable") {
    super(code);
  }
}

export const workoutTemplateEditorFieldLimits = {
  title: 120,
  description: 2_000,
  category: 120,
  generalInstruction: 4_000,
  exerciseCount: 40,
  setCountPerExercise: 20,
  trainerNote: 2_000,
} as const;
