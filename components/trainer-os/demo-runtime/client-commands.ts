import type { TeamActivityItem } from "@/components/trainer-os/home/types";
import type { ReviewExercise, ReviewSignal } from "@/components/trainer-os/workout-review/review-model";

import type {
  ClientAssignmentCommandInput,
  ClientSessionCommandInput,
  RuntimeAttentionItem,
  RuntimeExerciseLog,
  RuntimeWorkoutSession,
  SaveClientSessionCommentInput,
  SaveSetLogInput,
  SetDiscomfortSignalInput,
  SkipExerciseInput,
  TrainerDemoCommandErrorCode,
  TrainerDemoCommandReceipt,
  TrainerDemoCommandResult,
  TrainerDemoState,
} from "./types";

type Execution<TReceipt extends TrainerDemoCommandReceipt = TrainerDemoCommandReceipt> = {
  state: TrainerDemoState;
  result: TrainerDemoCommandResult<TReceipt>;
};

export function startWorkoutSession(
  state: TrainerDemoState,
  input: ClientAssignmentCommandInput
): Execution<TrainerDemoCommandReceipt & { session: RuntimeWorkoutSession }> {
  const assignment = state.workoutAssignments.find((item) => item.id === input.assignmentId);
  if (!assignment) return failed(state, "UNKNOWN_ASSIGNMENT", "Назначенная тренировка не найдена.");
  const actorError = validateClientActor(state, input.actor.id, assignment.athleteId);
  if (actorError) return failed(state, actorError.code, actorError.message);

  const existing = state.workoutSessions.find((item) => item.assignmentEntityId === assignment.id);
  if (existing) {
    return succeeded(state, { ...receipt("StartWorkoutSession", existing.session.id, true), session: existing });
  }

  const athlete = getAthlete(state, assignment.athleteId);
  if (!athlete) return failed(state, "UNKNOWN_ATHLETE", "Спортсмен не найден.");
  const startedAt = now();
  const sessionId = `session-${assignment.id}`;
  const exerciseLogs = assignment.snapshotExercises.map((exercise, index): RuntimeExerciseLog => ({
    id: `exercise-log-${sessionId}-${exercise.assignmentExerciseId}`,
    workoutSessionId: sessionId,
    assignmentExerciseId: exercise.assignmentExerciseId,
    exerciseId: exercise.id,
    title: exercise.title,
    order: index + 1,
    supersetId: exercise.supersetId,
    supersetLabel: exercise.supersetLabel,
    supersetInstruction: exercise.supersetInstruction,
    supersetOrder: exercise.supersetOrder,
    status: "pending",
    sets: exercise.setPlans.map((plan, setIndex) => ({
      id: `set-log-${sessionId}-${exercise.assignmentExerciseId}-${setIndex + 1}`,
      workoutSessionId: sessionId,
      assignmentExerciseId: exercise.assignmentExerciseId,
      order: setIndex + 1,
      kind: plan.kind,
      plan: { ...plan },
      completed: false,
    })),
  }));
  const session = buildSession(state, assignment.id, sessionId, startedAt, exerciseLogs);
  const next = appendEvents(
    { ...state, workoutSessions: [...state.workoutSessions, session] },
    [
      { name: "session_started", athleteId: assignment.athleteId, workoutSessionId: sessionId, assignmentId: assignment.id },
    ]
  );
  return succeeded(next, { ...receipt("StartWorkoutSession", sessionId, false), session });
}

export function resumeWorkoutSession(
  state: TrainerDemoState,
  input: ClientSessionCommandInput
): Execution<TrainerDemoCommandReceipt & { session: RuntimeWorkoutSession }> {
  const session = findClientSession(state, input);
  if (!session.ok) return failed(state, session.code, session.message);
  if (session.value.lifecycleStatus !== "active") {
    return failed(state, "SESSION_ALREADY_COMPLETED", "Завершённую тренировку нельзя продолжить.");
  }
  const next = appendEvents(state, [{ name: "session_resumed", athleteId: input.actor.id, workoutSessionId: input.workoutSessionId }]);
  return succeeded(next, { ...receipt("ResumeWorkoutSession", session.value.session.id, false), session: session.value });
}

export function saveSetLog(state: TrainerDemoState, input: SaveSetLogInput, commandName: "SaveSetLog" | "UpdateSetLog"): Execution {
  const lookup = findClientSession(state, input);
  if (!lookup.ok) return failed(state, lookup.code, lookup.message);
  if (lookup.value.lifecycleStatus !== "active") return failed(state, "SESSION_ALREADY_COMPLETED", "Завершённые результаты нельзя изменить.");
  if (!Number.isFinite(input.repetitions) || input.repetitions < 0 || (input.weightKg !== undefined && (!Number.isFinite(input.weightKg) || input.weightKg < 0))) {
    return failed(state, "INVALID_SET_RESULT", "Проверьте повторения и вес.");
  }
  const existingSet = lookup.value.exerciseLogs.flatMap((item) => item.sets).find((item) => item.id === input.setLogId);
  if (!existingSet) return failed(state, "UNKNOWN_SET_LOG", "Подход не найден.");
  const alreadyApplied = existingSet.completed
    && existingSet.actualRepetitions === input.repetitions
    && existingSet.actualWeightKg === input.weightKg
    && existingSet.rpe === input.rpe
    && existingSet.comment === clean(input.comment);
  if (alreadyApplied) return succeeded(state, receipt(commandName, existingSet.id, true));

  const nextSession = updateSession(lookup.value, (exercise) => exercise.sets.some((set) => set.id === input.setLogId)
    ? {
        ...exercise,
        status: exercise.status === "pending" ? "in_progress" : exercise.status,
        sets: exercise.sets.map((set) => set.id === input.setLogId ? {
          ...set,
          actualRepetitions: input.repetitions,
          actualWeightKg: input.weightKg,
          rpe: input.rpe,
          comment: clean(input.comment),
          completed: true,
        } : set),
      }
    : exercise);
  const completedSession = updateSession(nextSession, (exercise) => exercise.sets.every((set) => set.completed)
    ? { ...exercise, status: "completed" }
    : exercise);
  const next = appendEvents(replaceSession(state, completedSession), [{ name: "set_saved", athleteId: input.actor.id, workoutSessionId: input.workoutSessionId }]);
  return succeeded(next, receipt(commandName, existingSet.id, false));
}

export function skipExercise(state: TrainerDemoState, input: SkipExerciseInput): Execution {
  const lookup = findClientSession(state, input);
  if (!lookup.ok) return failed(state, lookup.code, lookup.message);
  if (lookup.value.lifecycleStatus !== "active") return failed(state, "SESSION_ALREADY_COMPLETED", "Завершённую тренировку нельзя изменить.");
  const exercise = lookup.value.exerciseLogs.find((item) => item.id === input.exerciseLogId);
  if (!exercise) return failed(state, "UNKNOWN_EXERCISE_LOG", "Упражнение не найдено.");
  if (exercise.status === "skipped" && exercise.skipReason === clean(input.reason)) {
    return succeeded(state, receipt("SkipExercise", exercise.id, true));
  }
  const nextSession = updateSession(lookup.value, (item) => item.id === exercise.id
    ? { ...item, status: "skipped", skipReason: clean(input.reason) }
    : item);
  const next = appendEvents(replaceSession(state, nextSession), [{ name: "exercise_skipped", athleteId: input.actor.id, workoutSessionId: input.workoutSessionId }]);
  return succeeded(next, receipt("SkipExercise", exercise.id, false));
}

export function saveClientSessionComment(state: TrainerDemoState, input: SaveClientSessionCommentInput): Execution {
  const lookup = findClientSession(state, input);
  if (!lookup.ok) return failed(state, lookup.code, lookup.message);
  if (lookup.value.lifecycleStatus !== "active") return failed(state, "SESSION_ALREADY_COMPLETED", "Завершённую тренировку нельзя изменить.");
  const comment = input.comment.trim();
  if (lookup.value.clientComment === comment) return succeeded(state, receipt("SaveClientSessionComment", lookup.value.session.id, true));
  const nextSession = { ...lookup.value, clientComment: comment || undefined };
  const next = appendEvents(replaceSession(state, nextSession), [{ name: "client_comment_saved", athleteId: input.actor.id, workoutSessionId: input.workoutSessionId }]);
  return succeeded(next, receipt("SaveClientSessionComment", lookup.value.session.id, false));
}

export function setDiscomfortSignal(state: TrainerDemoState, input: SetDiscomfortSignalInput): Execution {
  const lookup = findClientSession(state, input);
  if (!lookup.ok) return failed(state, lookup.code, lookup.message);
  if (lookup.value.lifecycleStatus !== "active") return failed(state, "SESSION_ALREADY_COMPLETED", "Завершённую тренировку нельзя изменить.");
  const originalText = input.originalText.trim();
  if (!originalText) return failed(state, "INVALID_DISCOMFORT", "Опишите ощущение своими словами.");
  if (lookup.value.discomfort?.originalText === originalText && lookup.value.discomfort.area === clean(input.area) && lookup.value.discomfort.severity === input.severity) {
    return succeeded(state, receipt("SetDiscomfortSignal", lookup.value.session.id, true));
  }
  const nextSession = {
    ...lookup.value,
    discomfort: { originalText, area: clean(input.area), severity: input.severity },
  };
  const next = appendEvents(replaceSession(state, nextSession), [{ name: "discomfort_added", athleteId: input.actor.id, workoutSessionId: input.workoutSessionId }]);
  return succeeded(next, receipt("SetDiscomfortSignal", lookup.value.session.id, false));
}

export function completeWorkoutSession(
  state: TrainerDemoState,
  input: ClientSessionCommandInput
): Execution<TrainerDemoCommandReceipt & { attentionItemId: string; session: RuntimeWorkoutSession }> {
  const lookup = findClientSession(state, input);
  if (!lookup.ok) return failed(state, lookup.code, lookup.message);
  const existingAttention = state.attentionItems.find((item) => item.workoutSessionId === lookup.value.session.id);
  if (lookup.value.lifecycleStatus !== "active") {
    if (!existingAttention) return failed(state, "UNKNOWN_ATTENTION_ITEM", "Review item для завершённой тренировки не найден.");
    return succeeded(state, {
      ...receipt("CompleteWorkoutSession", lookup.value.completionReceiptId ?? lookup.value.session.id, true),
      attentionItemId: existingAttention.id,
      session: lookup.value,
    });
  }

  const completedAt = now();
  const hasOmissions = lookup.value.exerciseLogs.some((exercise) =>
    exercise.status === "skipped" || exercise.sets.some((set) => !set.completed)
  );
  const completed = materializeReview({
    ...lookup.value,
    lifecycleStatus: hasOmissions ? "completed_with_omissions" : "completed",
    completionReceiptId: `completion-${lookup.value.session.id}`,
    session: {
      ...lookup.value.session,
      status: hasOmissions ? "partial" : "completed",
      completedAt,
      completedLabel: formatDate(completedAt),
      durationMin: 52,
    },
  });
  const attention = createReviewAttention(completed);
  const nextAttentionItems = existingAttention ? state.attentionItems : [...state.attentionItems, attention];
  const next = appendEvents(
    {
      ...replaceSession(state, completed),
      attentionItems: nextAttentionItems,
      selectedAttentionItemId: attention.id,
      teamActivity: [completionActivity(state, completed), ...state.teamActivity],
    },
    [
      { name: "session_completed", athleteId: input.actor.id, workoutSessionId: completed.session.id, assignmentId: completed.assignmentEntityId },
      { name: "review_item_created", athleteId: input.actor.id, workoutSessionId: completed.session.id, assignmentId: completed.assignmentEntityId, attentionItemId: attention.id },
    ]
  );
  return succeeded(next, {
    ...receipt("CompleteWorkoutSession", completed.completionReceiptId ?? completed.session.id, false),
    attentionItemId: attention.id,
    session: completed,
  });
}

function buildSession(state: TrainerDemoState, assignmentId: string, sessionId: string, startedAt: string, exerciseLogs: RuntimeExerciseLog[]): RuntimeWorkoutSession {
  const assignment = state.workoutAssignments.find((item) => item.id === assignmentId)!;
  const athlete = getAthlete(state, assignment.athleteId)!;
  const initials = athlete.name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("");
  return {
    session: { id: sessionId, status: "partial", completedAt: "", completedLabel: "В процессе" },
    athlete: { id: athlete.id, displayName: athlete.name, initials, goal: athlete.goal, profileHref: `/trainer/clients/${athlete.id}` },
    assignment: { id: assignment.id, title: assignment.templateTitle, scheduledFor: assignment.scheduledDate },
    assignmentEntityId: assignment.id,
    sessionTitle: assignment.templateTitle,
    summary: { completedExercises: 0, totalExercises: exerciseLogs.length, completedSets: 0, totalSets: exerciseLogs.flatMap((item) => item.sets).length, hasSkippedWork: false, hasDiscomfort: false },
    signals: [],
    exercises: exerciseLogs.map(toReviewExercise),
    feedback: { aiState: "available", existing: [] },
    lifecycleStatus: "active",
    startedAt,
    exerciseLogs,
  };
}

function materializeReview(session: RuntimeWorkoutSession): RuntimeWorkoutSession {
  const exercises = session.exerciseLogs.map(toReviewExercise);
  const signals: ReviewSignal[] = session.exerciseLogs.flatMap((exercise): ReviewSignal[] => {
    if (exercise.status === "skipped") return [{ id: `signal-skipped-${exercise.id}`, kind: "skipped" as const, tone: "warning" as const, title: "Упражнение пропущено", detail: exercise.skipReason || "Причина не указана.", sourceLabel: exercise.title, exerciseId: exercise.id }];
    if (exercise.sets.some((set) => !set.completed)) return [{ id: `signal-incomplete-${exercise.id}`, kind: "incomplete" as const, tone: "warning" as const, title: "Не все подходы выполнены", detail: "Сессия завершена с незаполненными подходами.", sourceLabel: exercise.title, exerciseId: exercise.id }];
    return [];
  });
  if (session.discomfort) {
    signals.unshift({
      id: `signal-discomfort-${session.session.id}`,
      kind: "discomfort",
      tone: "danger",
      title: "Спортсмен отметил дискомфорт",
      detail: session.discomfort.originalText,
      sourceLabel: "Оригинальный комментарий клиента",
      originalText: session.discomfort.originalText,
      area: session.discomfort.area,
      severity: session.discomfort.severity,
    });
  }
  return {
    ...session,
    exercises,
    signals,
    summary: {
      completedExercises: session.exerciseLogs.filter((exercise) => exercise.status === "completed").length,
      totalExercises: session.exerciseLogs.length,
      completedSets: session.exerciseLogs.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length,
      totalSets: session.exerciseLogs.flatMap((exercise) => exercise.sets).length,
      hasSkippedWork: session.exerciseLogs.some((exercise) => exercise.status === "skipped" || exercise.sets.some((set) => !set.completed)),
      hasDiscomfort: Boolean(session.discomfort),
    },
  };
}

function toReviewExercise(exercise: RuntimeExerciseLog): ReviewExercise {
  const completedSets = exercise.sets.filter((set) => set.completed).length;
  const state = exercise.status === "skipped" ? "skipped" : completedSets === exercise.sets.length ? "completed" : "incomplete";
  return {
    id: exercise.assignmentExerciseId,
    title: exercise.title,
    state,
    planned: { sets: exercise.sets.map((set) => ({ ...set.plan })) },
    actual: {
      sets: exercise.sets.map((set) => ({
        id: set.plan.id,
        kind: set.kind,
        repetitions: set.actualRepetitions,
        weightKg: set.actualWeightKg,
        rpe: set.rpe,
        completed: set.completed,
        comment: set.comment,
      })),
      comment: exercise.clientComment,
    },
    modificationNote: exercise.status === "skipped" ? exercise.skipReason : undefined,
  };
}

function createReviewAttention(session: RuntimeWorkoutSession): RuntimeAttentionItem {
  const discomfort = session.discomfort;
  return {
    id: `attention-review-${session.session.id}`,
    athleteId: session.athlete.id,
    kind: discomfort ? "discomfort" : "review",
    status: "active",
    eventLabel: discomfort ? "Сигнал после тренировки" : "Тренировка завершена",
    happenedAt: "только что",
    reason: discomfort ? "Спортсмен отметил дискомфорт" : session.lifecycleStatus === "completed_with_omissions" ? "Тренировка завершена с отклонениями" : "Завершённая тренировка ждёт разбора",
    signal: discomfort?.originalText ?? `${session.summary.completedExercises} из ${session.summary.totalExercises} упражнений выполнено.`,
    originalText: discomfort?.originalText,
    relatedSignals: [...new Set(session.signals.filter((signal) => signal.kind !== "discomfort").map((signal) => signal.title))],
    primaryAction: "review",
    workoutSessionId: session.session.id,
    ageHours: 0,
  };
}

function findClientSession(state: TrainerDemoState, input: ClientSessionCommandInput): { ok: true; value: RuntimeWorkoutSession } | { ok: false; code: TrainerDemoCommandErrorCode; message: string } {
  const session = state.workoutSessions.find((item) => item.session.id === input.workoutSessionId);
  if (!session) return { ok: false, code: "UNKNOWN_SESSION", message: "WorkoutSession не найдена." };
  const actorError = validateClientActor(state, input.actor.id, session.athlete.id);
  if (actorError) return { ok: false, ...actorError };
  return { ok: true, value: session };
}

function validateClientActor(state: TrainerDemoState, actorId: string, athleteId: string) {
  if (!state.athletes.some((item) => item.id === actorId) && !state.athleteProfiles.some((item) => item.id === actorId)) {
    return { code: "UNKNOWN_ATHLETE" as const, message: "Demo athlete не найден." };
  }
  if (actorId !== athleteId) return { code: "ACTOR_ATHLETE_MISMATCH" as const, message: "Client actor не имеет доступа к данным другого спортсмена." };
  return null;
}

function updateSession(session: RuntimeWorkoutSession, update: (exercise: RuntimeExerciseLog) => RuntimeExerciseLog) {
  return { ...session, exerciseLogs: session.exerciseLogs.map(update) };
}

function replaceSession(state: TrainerDemoState, session: RuntimeWorkoutSession) {
  return { ...state, workoutSessions: state.workoutSessions.map((item) => item.session.id === session.session.id ? session : item) };
}

function getAthlete(state: TrainerDemoState, athleteId: string) {
  const athlete = state.athletes.find((item) => item.id === athleteId);
  if (athlete) return athlete;
  const profile = state.athleteProfiles.find((item) => item.id === athleteId);
  return profile ? { id: profile.id, name: profile.name, goal: profile.goal } : null;
}

function appendEvents(state: TrainerDemoState, events: Array<Omit<TrainerDemoState["pilotEvents"][number], "id" | "at">>) {
  return events.reduce((current, event) => ({
    ...current,
    pilotEvents: [...current.pilotEvents, { ...event, id: `pilot-${current.pilotEvents.length + 1}`, at: now() }],
  }), state);
}

function completionActivity(state: TrainerDemoState, session: RuntimeWorkoutSession): TeamActivityItem {
  const athlete = getAthlete(state, session.athlete.id);
  return {
    id: `activity-completed-${session.session.id}`,
    clientId: session.athlete.id,
    clientName: athlete?.name ?? session.athlete.displayName,
    type: "completed_workout",
    title: "Клиент завершил тренировку",
    description: session.sessionTitle,
    time: "сейчас",
    clock: new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    dateGroup: "today",
    unread: true,
  };
}

function receipt(commandName: string, entityId: string, alreadyApplied: boolean): TrainerDemoCommandReceipt {
  return { commandId: `demo-command-${commandName}-${entityId}`, commandName, appliedAt: now(), alreadyApplied, entityId };
}

function succeeded<TReceipt extends TrainerDemoCommandReceipt>(state: TrainerDemoState, value: TReceipt): Execution<TReceipt> {
  return { state, result: { ok: true, receipt: value } };
}

function failed(state: TrainerDemoState, code: TrainerDemoCommandErrorCode, message: string): Execution<never> {
  return { state, result: { ok: false, error: { code, message } } };
}

function clean(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function now() {
  return new Date().toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
