import type {
  QuickAssignReadModel,
  QuickAssignTemplateListItem,
  QuickAssignTemplatePreview,
} from "@/lib/server/quick-assign/quick-assign-types";

export type QuickAssignDraft = {
  selected: QuickAssignTemplateListItem | null;
  scheduledFor: string;
  trainerNote: string;
  allowAdditionalAssignment: boolean;
};

export type QuickAssignCommandPayload = {
  assignmentId: string;
  athleteUserId: string;
  templateId: string;
  templateRevisionId: string;
  scheduledFor: string;
  trainerNote: string;
  assignmentStateToken: string;
  allowAdditionalAssignment: boolean;
  transitionContext: string;
};

export type QuickAssignCommandLifecycle =
  | { status: "idle" }
  | { status: "submitting"; payload: QuickAssignCommandPayload }
  | { status: "outcome_unknown"; payload: QuickAssignCommandPayload }
  | { status: "conflict"; code: string }
  | { status: "persisted"; assignmentId: string }
  | { status: "revalidation_warning"; assignmentId: string; warning: string };

export type QuickAssignClientState = {
  mobileStep: "selection" | "review";
  query: string;
  draft: QuickAssignDraft;
  command: QuickAssignCommandLifecycle;
};

export type QuickAssignAction =
  | { type: "presentation_restored"; query: string; scheduledFor: string; trainerNote: string }
  | { type: "query_changed"; query: string }
  | { type: "template_selected"; template: QuickAssignTemplateListItem }
  | { type: "return_to_selection" }
  | { type: "date_changed"; scheduledFor: string }
  | { type: "note_changed"; trainerNote: string }
  | { type: "same_date_confirmed"; confirmed: boolean }
  | { type: "canonical_state_refreshed" }
  | { type: "selection_unavailable" }
  | { type: "command_submitting"; payload: QuickAssignCommandPayload }
  | { type: "command_outcome_unknown"; payload: QuickAssignCommandPayload }
  | { type: "command_conflict"; code: string }
  | { type: "command_persisted"; assignmentId: string; warning?: string }
  | { type: "command_recovered" };

export function initialQuickAssignState(): QuickAssignClientState {
  return {
    mobileStep: "selection",
    query: "",
    draft: {
      selected: null,
      scheduledFor: "",
      trainerNote: "",
      allowAdditionalAssignment: false,
    },
    command: { status: "idle" },
  };
}

export function quickAssignReducer(
  state: QuickAssignClientState,
  action: QuickAssignAction,
): QuickAssignClientState {
  switch (action.type) {
    case "presentation_restored":
      return {
        ...state,
        query: action.query,
        draft: {
          ...state.draft,
          scheduledFor: action.scheduledFor,
          trainerNote: action.trainerNote.slice(0, 2_000),
        },
      };
    case "query_changed":
      return { ...state, query: action.query };
    case "template_selected":
      return {
        ...state,
        mobileStep: "review",
        draft: {
          ...state.draft,
          selected: action.template,
          allowAdditionalAssignment: false,
        },
        command: { status: "idle" },
      };
    case "return_to_selection":
      return { ...state, mobileStep: "selection" };
    case "date_changed":
      return {
        ...state,
        draft: {
          ...state.draft,
          scheduledFor: action.scheduledFor,
          allowAdditionalAssignment: false,
        },
        command: editableCommand(state.command),
      };
    case "note_changed":
      return {
        ...state,
        draft: { ...state.draft, trainerNote: action.trainerNote.slice(0, 2_000) },
        command: editableCommand(state.command),
      };
    case "same_date_confirmed":
      return {
        ...state,
        draft: { ...state.draft, allowAdditionalAssignment: action.confirmed },
        command: editableCommand(state.command),
      };
    case "canonical_state_refreshed":
      return {
        ...state,
        draft: { ...state.draft, allowAdditionalAssignment: false },
        command: { status: "idle" },
      };
    case "selection_unavailable":
      return {
        ...state,
        mobileStep: "selection",
        draft: { ...state.draft, selected: null, allowAdditionalAssignment: false },
        command: { status: "idle" },
      };
    case "command_submitting":
      return { ...state, command: { status: "submitting", payload: action.payload } };
    case "command_outcome_unknown":
      return { ...state, command: { status: "outcome_unknown", payload: action.payload } };
    case "command_conflict":
      return { ...state, command: { status: "conflict", code: action.code } };
    case "command_persisted":
      return {
        ...state,
        command: action.warning
          ? { status: "revalidation_warning", assignmentId: action.assignmentId, warning: action.warning }
          : { status: "persisted", assignmentId: action.assignmentId },
      };
    case "command_recovered":
      return { ...state, command: { status: "idle" } };
  }
}

export function mergeTemplatePages(
  current: QuickAssignTemplateListItem[],
  incoming: QuickAssignTemplateListItem[],
) {
  const byRevision = new Map(current.map((item) => [item.revisionId, item]));
  for (const item of incoming) byRevision.set(item.revisionId, item);
  return [...byRevision.values()];
}

export function sameDateAssignments(model: QuickAssignReadModel, scheduledFor: string) {
  if (!scheduledFor) return [];
  return model.athlete.upcomingAssignments.filter((item) => item.scheduledFor === scheduledFor);
}

export function exactDuplicateAssignment(model: QuickAssignReadModel, draft: QuickAssignDraft) {
  if (!draft.selected || !draft.scheduledFor) return null;
  return model.athlete.upcomingAssignments.find((item) => (
    item.scheduledFor === draft.scheduledFor
    && item.sourceRevisionId === draft.selected?.revisionId
  )) ?? null;
}

export function validateQuickAssignDraft(
  model: QuickAssignReadModel,
  draft: QuickAssignDraft,
  preview: QuickAssignTemplatePreview | null,
) {
  const errors: Record<string, string> = {};
  if (!draft.selected) errors.template = "Выберите шаблон.";
  if (!preview || preview.revisionId !== draft.selected?.revisionId) {
    errors.preview = "Проверьте состав выбранной версии.";
  }
  if (!draft.scheduledFor) {
    errors.scheduledFor = "Выберите дату тренировки.";
  } else if (draft.scheduledFor < model.calendar.minScheduledFor) {
    errors.scheduledFor = `Дата должна быть не раньше ${model.calendar.minScheduledFor}.`;
  }
  if (draft.trainerNote.length > 2_000) errors.trainerNote = "Максимум 2000 символов.";
  if (exactDuplicateAssignment(model, draft)) errors.duplicate = "Эта версия уже назначена на выбранную дату.";
  const sameDate = sameDateAssignments(model, draft.scheduledFor);
  if (sameDate.length > 0 && !errors.duplicate && !draft.allowAdditionalAssignment) {
    errors.sameDate = "Подтвердите вторую тренировку на эту дату.";
  }
  return errors;
}

export function buildStrictAssignmentPayload(input: {
  assignmentId: string;
  model: QuickAssignReadModel;
  draft: QuickAssignDraft;
  transitionContext: string;
}): QuickAssignCommandPayload {
  const selected = input.draft.selected;
  if (!selected) throw new Error("quick_assign_template_required");
  return {
    assignmentId: input.assignmentId,
    athleteUserId: input.model.athlete.athleteUserId,
    templateId: selected.templateId,
    templateRevisionId: selected.revisionId,
    scheduledFor: input.draft.scheduledFor,
    trainerNote: input.draft.trainerNote,
    assignmentStateToken: input.model.athlete.assignmentStateToken,
    allowAdditionalAssignment: input.draft.allowAdditionalAssignment,
    transitionContext: input.transitionContext,
  };
}

export function isQuickAssignDirty(draft: QuickAssignDraft) {
  return Boolean(
    draft.selected
    || draft.scheduledFor
    || draft.trainerNote.trim()
    || draft.allowAdditionalAssignment,
  );
}

function editableCommand(command: QuickAssignCommandLifecycle): QuickAssignCommandLifecycle {
  return command.status === "outcome_unknown" || command.status === "submitting"
    ? command
    : { status: "idle" };
}
