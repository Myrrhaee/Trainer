import type { TeamActivityItem } from "@/components/trainer-os/home/types";

import {
  TRAINER_DEMO_ACTOR_ID,
  type CreateFollowUpFeedbackInput,
  type CreateWorkoutAssignmentInput,
  type ResolveAttentionManuallyInput,
  type ResolveAttentionWithFeedbackInput,
  type RuntimeAttentionItem,
  type RuntimeWorkoutAssignment,
  type TrainerDemoCommandReceipt,
  type TrainerDemoCommandResult,
  type TrainerDemoState,
  type WorkoutTemplateCommandInput,
} from "./types";

type Execution<TReceipt extends TrainerDemoCommandReceipt = TrainerDemoCommandReceipt> = {
  state: TrainerDemoState;
  result: TrainerDemoCommandResult<TReceipt>;
};

export function resolveAttentionWithFeedback(
  state: TrainerDemoState,
  input: ResolveAttentionWithFeedbackInput,
  commandName: "ResolveAttentionItemWithFeedback" | "ResolveAttentionItemWithAcknowledgement"
): Execution {
  const invalid = validateActorAndAthlete(state, input.actor.id, input.athleteId);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const session = state.workoutSessions.find((item) => item.session.id === input.workoutSessionId);
  if (!session || session.athlete.id !== input.athleteId) {
    return failed(state, "UNKNOWN_SESSION", "WorkoutSession не найдена для выбранного спортсмена.");
  }
  if (!input.feedback.body.trim()) return failed(state, "INVALID_FEEDBACK", "Feedback не может быть пустым.");

  const attention = findAttention(state, input.athleteId, input.workoutSessionId, input.attentionItemId);
  if (!attention) return failed(state, "UNKNOWN_ATTENTION_ITEM", "AttentionItem не найден для WorkoutSession.");
  const existing = state.trainerFeedback.find(
    (feedback) => feedback.workoutSessionId === input.workoutSessionId && feedback.kind !== "follow-up"
  );
  if (existing) {
    return succeeded(state, receipt(commandName, existing.id, true, attention.id));
  }
  if (attention.status !== "active") {
    return failed(state, "ATTENTION_ALREADY_RESOLVED", "AttentionItem уже закрыт.");
  }

  const appliedAt = now();
  const feedback = {
    ...input.feedback,
    body: input.feedback.body.trim(),
    athleteId: input.athleteId,
    workoutSessionId: input.workoutSessionId,
    attentionItemId: attention.id,
    trainerId: input.actor.id,
  };
  const nextAttentionItems = resolveAttention(state.attentionItems, attention.id, appliedAt, feedback.id);
  const nextState = appendPilotEvent(
    {
      ...state,
      attentionItems: nextAttentionItems,
      trainerFeedback: [...state.trainerFeedback, feedback],
      selectedAttentionItemId: nextActiveAttentionId(nextAttentionItems, attention.id),
      teamActivity: [feedbackActivity(state, input.athleteId, feedback.id), ...state.teamActivity],
    },
    {
      name: "feedback_sent",
      athleteId: input.athleteId,
      attentionItemId: attention.id,
      workoutSessionId: input.workoutSessionId,
    }
  );
  return succeeded(nextState, receipt(commandName, feedback.id, false, attention.id));
}

export function resolveAttentionManually(
  state: TrainerDemoState,
  input: ResolveAttentionManuallyInput
): Execution {
  const invalid = validateActorAndAthlete(state, input.actor.id, input.athleteId);
  if (invalid) return failed(state, invalid.code, invalid.message);
  if (!input.reason.trim()) return failed(state, "INVALID_MANUAL_REASON", "Укажите причину закрытия.");
  const attention = state.attentionItems.find((item) => item.id === input.attentionItemId);
  if (!attention || attention.athleteId !== input.athleteId) {
    return failed(state, "UNKNOWN_ATTENTION_ITEM", "AttentionItem не найден для спортсмена.");
  }
  const existing = state.manualResolutions.find((item) => item.attentionItemId === attention.id);
  if (existing) return succeeded(state, receipt("ResolveAttentionItemManually", existing.id, true, attention.id));
  if (attention.status !== "active") {
    return failed(state, "ATTENTION_ALREADY_RESOLVED", "AttentionItem уже закрыт.");
  }
  if (input.workoutSessionId && attention.workoutSessionId !== input.workoutSessionId) {
    return failed(state, "STALE_ATTENTION_ITEM", "AttentionItem больше не соответствует открытой WorkoutSession.");
  }

  const appliedAt = now();
  const resolution = {
    id: `manual-resolution-${attention.id}`,
    athleteId: input.athleteId,
    attentionItemId: attention.id,
    workoutSessionId: input.workoutSessionId,
    reason: input.reason.trim(),
    trainerId: input.actor.id,
    resolvedAt: appliedAt,
  };
  const nextAttentionItems = resolveAttention(state.attentionItems, attention.id, appliedAt, resolution.id);
  const nextState = appendPilotEvent(
    {
      ...state,
      attentionItems: nextAttentionItems,
      manualResolutions: [...state.manualResolutions, resolution],
      selectedAttentionItemId: nextActiveAttentionId(nextAttentionItems, attention.id),
    },
    { name: "attention_resolved", athleteId: input.athleteId, attentionItemId: attention.id, workoutSessionId: input.workoutSessionId }
  );
  return succeeded(nextState, receipt("ResolveAttentionItemManually", resolution.id, false, attention.id));
}

export function createWorkoutAssignment(
  state: TrainerDemoState,
  input: CreateWorkoutAssignmentInput
): Execution<TrainerDemoCommandReceipt & { assignment: RuntimeWorkoutAssignment }> {
  const invalid = validateActorAndAthlete(state, input.actor.id, input.receipt.athleteId);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const profile = state.athleteProfiles.find((item) => item.id === input.receipt.athleteId);
  if (profile?.membership.status === "paused") return failed(state, "ATHLETE_PAUSED", "Назначение недоступно для спортсмена на паузе.");
  const template = state.workoutTemplates.find((item) => item.draft.id === input.receipt.templateId)?.draft;
  if (!template) return failed(state, "UNKNOWN_TEMPLATE", "WorkoutTemplate не найден.");
  if (template.status !== "published") return failed(state, "INVALID_TEMPLATE_STATE", "Назначать можно только published revision.");

  const existing = state.workoutAssignments.find((assignment) => assignment.id === input.receipt.id);
  if (existing) {
    return succeeded(state, {
      ...receipt("CreateWorkoutAssignment", existing.id, true),
      assignment: existing,
    });
  }

  const appliedAt = now();
  const assignment: RuntimeWorkoutAssignment = {
    id: input.receipt.id,
    athleteId: input.receipt.athleteId,
    sourceTemplateId: template.id,
    sourceTemplateRevision: template.revision,
    sourceTemplateRevisionId: `${template.id}:rev:${template.revision}`,
    templateTitle: template.title,
    scheduledDate: input.receipt.scheduledDate,
    status: "scheduled",
    snapshotExercises: input.receipt.snapshotExercises.map((exercise) => ({ ...exercise, override: exercise.override ? { ...exercise.override } : undefined })),
    overrideCount: input.receipt.overrideCount,
    trainerNote: input.receipt.trainerNote,
    generalInstruction: input.receipt.generalInstruction,
    createdContext: { ...input.receipt.createdContext },
    createdAt: appliedAt,
  };
  const assignmentAttention = state.attentionItems.find(
    (item) => item.athleteId === assignment.athleteId && item.kind === "assignment" && item.status === "active"
  );
  const nextAttentionItems = assignmentAttention
    ? resolveAttention(state.attentionItems, assignmentAttention.id, appliedAt, assignment.id)
    : state.attentionItems;
  const nextState = appendPilotEvent(
    {
      ...state,
      workoutAssignments: [...state.workoutAssignments, assignment],
      attentionItems: nextAttentionItems,
      selectedAttentionItemId: assignmentAttention
        ? nextActiveAttentionId(nextAttentionItems, assignmentAttention.id)
        : state.selectedAttentionItemId,
      teamActivity: [assignmentActivity(state, assignment), ...state.teamActivity],
    },
    {
      name: "assignment_created",
      athleteId: assignment.athleteId,
      attentionItemId: assignmentAttention?.id,
      workoutTemplateId: assignment.sourceTemplateId,
      assignmentId: assignment.id,
    }
  );
  return succeeded(nextState, {
    ...receipt("CreateWorkoutAssignment", assignment.id, false, assignmentAttention?.id),
    assignment,
  });
}

export function saveWorkoutTemplateDraft(
  state: TrainerDemoState,
  input: WorkoutTemplateCommandInput
): Execution<TrainerDemoCommandReceipt & { template: typeof input.template }> {
  const invalid = validateTemplateCommand(state, input);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const template = { ...input.template, status: "draft" as const, updatedLabel: "только что" };
  const nextState = upsertTemplate(state, template, input.athleteId, "template_saved");
  return succeeded(nextState, { ...receipt("SaveWorkoutTemplateDraft", template.id, false), template });
}

export function publishWorkoutTemplate(
  state: TrainerDemoState,
  input: WorkoutTemplateCommandInput
): Execution<TrainerDemoCommandReceipt & { template: typeof input.template }> {
  const invalid = validateTemplateCommand(state, input);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const current = state.workoutTemplates.find((item) => item.draft.id === input.template.id)?.draft;
  if (current?.status === "published" && current.revision === input.template.revision) {
    return succeeded(state, { ...receipt("PublishWorkoutTemplate", current.id, true), template: current });
  }
  const template = { ...input.template, status: "published" as const, updatedLabel: "только что" };
  const nextState = upsertTemplate(state, template, input.athleteId, "template_published");
  return succeeded(nextState, { ...receipt("PublishWorkoutTemplate", template.id, false), template });
}

export function createWorkoutTemplateRevision(
  state: TrainerDemoState,
  input: WorkoutTemplateCommandInput
): Execution<TrainerDemoCommandReceipt & { template: typeof input.template }> {
  const invalid = validateTemplateCommand(state, input);
  if (invalid) return failed(state, invalid.code, invalid.message);
  if (input.template.status !== "draft" || !input.template.sourceTemplateId) {
    return failed(state, "INVALID_TEMPLATE_STATE", "Новая revision должна быть отдельным draft с source reference.");
  }
  const nextState = upsertTemplate(state, input.template, input.athleteId, "template_saved");
  return succeeded(nextState, { ...receipt("CreateWorkoutTemplateRevision", input.template.id, false), template: input.template });
}

export function archiveWorkoutTemplate(
  state: TrainerDemoState,
  input: WorkoutTemplateCommandInput
): Execution<TrainerDemoCommandReceipt & { template: typeof input.template }> {
  const invalid = validateTemplateCommand(state, input);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const existing = state.workoutTemplates.find((item) => item.draft.id === input.template.id);
  if (!existing) return failed(state, "UNKNOWN_TEMPLATE", "WorkoutTemplate не найден.");
  if (existing.draft.status === "archived") {
    return succeeded(state, { ...receipt("ArchiveWorkoutTemplatePrototype", existing.draft.id, true), template: existing.draft });
  }
  const template = { ...existing.draft, status: "archived" as const, updatedLabel: "только что" };
  const nextState = upsertTemplate(state, template, existing.createdForAthleteId, "template_saved");
  return succeeded(nextState, { ...receipt("ArchiveWorkoutTemplatePrototype", template.id, false), template });
}

export function createFollowUpFeedback(
  state: TrainerDemoState,
  input: CreateFollowUpFeedbackInput
): Execution {
  const invalid = validateActorAndAthlete(state, input.actor.id, input.athleteId);
  if (invalid) return failed(state, invalid.code, invalid.message);
  const session = state.workoutSessions.find((item) => item.session.id === input.workoutSessionId);
  if (!session || session.athlete.id !== input.athleteId) return failed(state, "UNKNOWN_SESSION", "WorkoutSession не найдена.");
  if (!input.feedback.body.trim()) return failed(state, "INVALID_FEEDBACK", "Уточнение не может быть пустым.");
  const existing = state.trainerFeedback.find((item) => item.id === input.feedback.id);
  if (existing) return succeeded(state, receipt("CreateFollowUpFeedback", existing.id, true));
  const feedback = {
    ...input.feedback,
    kind: "follow-up" as const,
    body: input.feedback.body.trim(),
    athleteId: input.athleteId,
    workoutSessionId: input.workoutSessionId,
    trainerId: input.actor.id,
  };
  return succeeded({ ...state, trainerFeedback: [...state.trainerFeedback, feedback] }, receipt("CreateFollowUpFeedback", feedback.id, false));
}

export function selectAttentionItem(state: TrainerDemoState, attentionItemId: string | null): Execution {
  if (attentionItemId === null) {
    return succeeded({ ...state, selectedAttentionItemId: null }, receipt("SelectAttentionItem", "none", false));
  }
  const attention = state.attentionItems.find((item) => item.id === attentionItemId && item.status === "active");
  if (!attention) return failed(state, "UNKNOWN_ATTENTION_ITEM", "Active AttentionItem не найден.");
  const nextState = appendPilotEvent(
    { ...state, selectedAttentionItemId: attention.id },
    { name: "attention_opened", athleteId: attention.athleteId, attentionItemId: attention.id, workoutSessionId: attention.workoutSessionId }
  );
  return succeeded(nextState, receipt("SelectAttentionItem", attention.id, false));
}

function validateActorAndAthlete(state: TrainerDemoState, actorId: string, athleteId: string) {
  if (actorId !== TRAINER_DEMO_ACTOR_ID) return { code: "UNAUTHORIZED_ACTOR" as const, message: "Demo actor не имеет trainer capability." };
  if (!state.athletes.some((item) => item.id === athleteId) && !state.athleteProfiles.some((item) => item.id === athleteId)) {
    return { code: "UNKNOWN_ATHLETE" as const, message: "Спортсмен не найден." };
  }
  return null;
}

function validateTemplateCommand(state: TrainerDemoState, input: WorkoutTemplateCommandInput) {
  if (input.actor.id !== TRAINER_DEMO_ACTOR_ID) return { code: "UNAUTHORIZED_ACTOR" as const, message: "Demo actor не имеет trainer capability." };
  if (input.athleteId && !state.athleteProfiles.some((item) => item.id === input.athleteId)) {
    return { code: "UNKNOWN_ATHLETE" as const, message: "Athlete context не найден." };
  }
  if (!input.template.id.trim()) return { code: "UNKNOWN_TEMPLATE" as const, message: "WorkoutTemplate ID отсутствует." };
  return null;
}

function findAttention(state: TrainerDemoState, athleteId: string, sessionId: string, attentionItemId?: string) {
  if (attentionItemId) {
    return state.attentionItems.find(
      (item) => item.id === attentionItemId && item.athleteId === athleteId && item.workoutSessionId === sessionId
    );
  }
  return state.attentionItems.find(
    (item) => item.athleteId === athleteId && item.workoutSessionId === sessionId
  );
}

function resolveAttention(items: RuntimeAttentionItem[], id: string, resolvedAt: string, resolutionId: string) {
  return items.map((item) => item.id === id ? { ...item, status: "resolved" as const, resolvedAt, resolutionId } : item);
}

function nextActiveAttentionId(items: RuntimeAttentionItem[], resolvedId: string) {
  const resolvedIndex = items.findIndex((item) => item.id === resolvedId);
  const active = items.filter((item) => item.status === "active");
  return active.find((item) => items.indexOf(item) >= resolvedIndex)?.id ?? active[0]?.id ?? null;
}

function upsertTemplate(
  state: TrainerDemoState,
  template: WorkoutTemplateCommandInput["template"],
  athleteId: string | undefined,
  eventName: "template_saved" | "template_published"
) {
  const current = state.workoutTemplates.find((item) => item.draft.id === template.id);
  const workoutTemplates = current
    ? state.workoutTemplates.map((item) => item.draft.id === template.id ? { draft: template, createdForAthleteId: athleteId ?? item.createdForAthleteId } : item)
    : [{ draft: template, createdForAthleteId: athleteId }, ...state.workoutTemplates];
  return appendPilotEvent(
    { ...state, workoutTemplates },
    { name: eventName, athleteId, workoutTemplateId: template.id }
  );
}

function feedbackActivity(state: TrainerDemoState, athleteId: string, feedbackId: string): TeamActivityItem {
  const athlete = getAthlete(state, athleteId);
  return {
    id: `activity-${feedbackId}`,
    clientId: athleteId,
    clientName: athlete?.name ?? athleteId,
    type: "review_sent",
    title: "Тренер отправил обратную связь",
    description: "Feedback сохранён в истории спортсмена.",
    time: "сейчас",
    clock: currentClock(),
    dateGroup: "today",
    unread: true,
  };
}

function assignmentActivity(state: TrainerDemoState, assignment: RuntimeWorkoutAssignment): TeamActivityItem {
  const athlete = getAthlete(state, assignment.athleteId);
  return {
    id: `activity-${assignment.id}`,
    clientId: assignment.athleteId,
    clientName: athlete?.name ?? assignment.athleteId,
    type: "workout_assigned",
    title: "Назначена тренировка",
    description: assignment.templateTitle,
    time: "сейчас",
    clock: currentClock(),
    dateGroup: "today",
    unread: true,
  };
}

function getAthlete(state: TrainerDemoState, athleteId: string) {
  return state.athletes.find((item) => item.id === athleteId)
    ?? state.athleteProfiles.find((item) => item.id === athleteId);
}

function appendPilotEvent(state: TrainerDemoState, event: Omit<TrainerDemoState["pilotEvents"][number], "id" | "at">) {
  const pilotEvent = { ...event, id: `pilot-${state.pilotEvents.length + 1}`, at: now() };
  return { ...state, pilotEvents: [...state.pilotEvents, pilotEvent] };
}

function receipt(commandName: string, entityId: string, alreadyApplied: boolean, resolvedAttentionItemId?: string): TrainerDemoCommandReceipt {
  return {
    commandId: `demo-command-${commandName}-${entityId}`,
    commandName,
    appliedAt: now(),
    alreadyApplied,
    entityId,
    resolvedAttentionItemId,
  };
}

function succeeded<TReceipt extends TrainerDemoCommandReceipt>(state: TrainerDemoState, value: TReceipt): Execution<TReceipt> {
  return { state, result: { ok: true, receipt: value } };
}

function failed(state: TrainerDemoState, code: Parameters<typeof errorResult>[0], message: string): Execution<never> {
  return { state, result: errorResult(code, message) };
}

function errorResult(code: "UNAUTHORIZED_ACTOR" | "UNKNOWN_ATHLETE" | "UNKNOWN_SESSION" | "UNKNOWN_TEMPLATE" | "UNKNOWN_ATTENTION_ITEM" | "ATTENTION_ALREADY_RESOLVED" | "INVALID_FEEDBACK" | "INVALID_MANUAL_REASON" | "INVALID_TEMPLATE_STATE" | "ATHLETE_PAUSED" | "STALE_ATTENTION_ITEM", message: string) {
  return { ok: false as const, error: { code, message } };
}

function now() {
  return new Date().toISOString();
}

function currentClock() {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}
