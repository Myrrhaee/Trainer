import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { projectNewWorkoutTemplateEditor, projectWorkoutTemplateEditor } from "./workout-template-editor-projector";
import { WorkoutTemplateEditorRepository } from "./workout-template-editor-repository";
import {
  WorkoutTemplateEditorNotFoundError,
  WorkoutTemplateEditorValidationError,
  WorkoutTemplateEditorViewUnavailableError,
  type WorkoutTemplateEditorReadInput,
} from "./workout-template-editor-types";

const views = new Set(["default", "editable", "published", "archived"] as const);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkoutTemplateEditorQueryService {
  constructor(private readonly repository = new WorkoutTemplateEditorRepository()) {}

  async read(actor: Actor, rawTemplateId: unknown, rawView: unknown = "default") {
    const input = normalizeWorkoutTemplateEditorInput(rawTemplateId, rawView);
    const bundle = await this.repository.read(actor, input.templateId, input.view);
    if (!bundle) throw new WorkoutTemplateEditorNotFoundError();
    if (!bundle.header.selected_revision_id
      || !bundle.header.selected_revision_role
      || bundle.header.selected_revision_number === null
      || !bundle.header.selected_revision_status) {
      throw new WorkoutTemplateEditorViewUnavailableError(unavailableCode(input.view));
    }
    return projectWorkoutTemplateEditor(actor, input.view, bundle);
  }

  async bootstrapNew(actor: Actor) {
    if (!(await this.repository.canBootstrap(actor))) throw new WorkoutTemplateEditorNotFoundError();
    return projectNewWorkoutTemplateEditor();
  }
}

export function normalizeWorkoutTemplateEditorInput(rawTemplateId: unknown, rawView: unknown): WorkoutTemplateEditorReadInput {
  if (typeof rawTemplateId !== "string" || !uuidPattern.test(rawTemplateId)) {
    throw new WorkoutTemplateEditorValidationError("invalid_template_id");
  }
  const view = typeof rawView === "string" && rawView.trim() ? rawView.trim() : "default";
  if (!views.has(view as WorkoutTemplateEditorReadInput["view"])) {
    throw new WorkoutTemplateEditorValidationError("invalid_view");
  }
  return { templateId: rawTemplateId, view: view as WorkoutTemplateEditorReadInput["view"] };
}

function unavailableCode(view: WorkoutTemplateEditorReadInput["view"]) {
  if (view === "editable") return "editable_draft_not_found" as const;
  if (view === "published") return "published_revision_not_found" as const;
  return "requested_view_unavailable" as const;
}
