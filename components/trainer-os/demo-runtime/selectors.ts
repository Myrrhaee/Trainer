import { CheckCircle2, Dumbbell, MessageSquareText, ShieldAlert } from "lucide-react";

import {
  buildTrainerAthleteProfileView,
  type ProfileEntryInput,
  type TrainerAthleteProfileView,
} from "@/components/trainer-os/client-profile/profile-read-model";
import type { AthleteProfile, AthleteTimelineItem, AthleteWorkout } from "@/components/trainer-os/client-profile/types";
import {
  buildTrainerDashboardSummary,
  getDashboardClientsForMode,
  type TrainerAttentionQueueItem,
  type TrainerDashboardDemoMode,
} from "@/components/trainer-os/home/dashboard-read-model";
import { getTeamSummary } from "@/components/trainer-os/home/mock-data";
import type { TeamClient } from "@/components/trainer-os/home/types";
import {
  isTemplateSuitable,
  type QuickAssignAthlete,
  type QuickAssignEntryContext,
  type QuickAssignView,
  type WorkoutTemplateListItem,
} from "@/components/trainer-os/quick-assign/quick-assign-model";
import type { WorkoutReviewDetails } from "@/components/trainer-os/workout-review/review-model";
import { getTemplateExercises, type WorkoutTemplateDraft } from "@/components/trainer-os/workout-template-builder/builder-model";

import type {
  RuntimeAttentionItem,
  TrainerDemoState,
} from "./types";

export function getTrainerAttentionQueue(
  state: TrainerDemoState,
  mode: TrainerDashboardDemoMode = "team"
): TrainerAttentionQueueItem[] {
  if (mode === "calm" || mode === "empty") return [];
  const clients = getDashboardClients(state, mode);
  return state.attentionItems
    .filter((item) => item.status === "active")
    .map((item) => toAttentionQueueItem(item, clients.find((client) => client.id === item.athleteId)))
    .filter((item): item is TrainerAttentionQueueItem => Boolean(item))
    .sort((a, b) => {
      if (a.kind === "discomfort" && b.kind !== "discomfort") return -1;
      if (b.kind === "discomfort" && a.kind !== "discomfort") return 1;
      return b.ageHours - a.ageHours;
    });
}

export function getTrainerDashboardView(state: TrainerDemoState, mode: TrainerDashboardDemoMode = "team") {
  const clients = getDashboardClients(state, mode);
  const attentionItems = getTrainerAttentionQueue(state, mode);
  const selectedAttentionItem = attentionItems.find((item) => item.id === state.selectedAttentionItemId)
    ?? attentionItems[0]
    ?? null;
  return {
    clients,
    attentionItems,
    selectedAttentionItem,
    summary: buildTrainerDashboardSummary(getTeamSummary(clients), attentionItems),
    teamActivity: state.teamActivity,
  };
}

export function getAthleteProfileView(
  state: TrainerDemoState,
  clientId: string,
  entry: ProfileEntryInput
): TrainerAthleteProfileView | null {
  const base = buildTrainerAthleteProfileView(clientId, entry);
  if (!base) return null;
  const athlete = augmentAthleteProfile(state, base.athlete);
  const activeAttention = state.attentionItems.find(
    (item) => item.athleteId === clientId && item.status === "active"
  );
  const primaryAction = activeAttention
    ? activeAttention.kind === "review" || (activeAttention.kind === "discomfort" && activeAttention.workoutSessionId)
      ? { kind: "review" as const, label: "Разобрать тренировку" }
      : activeAttention.kind === "assignment"
        ? { kind: "assign" as const, label: "Назначить тренировку" }
        : { kind: "message" as const, label: "Написать клиенту" }
    : athlete.upcomingWorkouts.length > 0
      ? { kind: "open_plan" as const, label: "Открыть текущий план" }
      : athlete.membership.status === "paused"
        ? { kind: "message" as const, label: "Написать клиенту" }
        : { kind: "assign" as const, label: "Назначить тренировку" };
  const reviewSessionId = activeAttention?.workoutSessionId
    ?? getDefaultWorkoutReviewSessionId(state, clientId);

  return {
    ...base,
    athlete,
    primaryAction,
    defaultTab: primaryAction.kind === "review" || primaryAction.kind === "assign" ? "training" : base.defaultTab,
    reviewSessionId,
    latestEvent: athlete.timeline[0] ?? null,
  };
}

export function getWorkoutReviewDetails(state: TrainerDemoState, workoutSessionId: string): WorkoutReviewDetails | null {
  const review = state.workoutSessions.find((item) => item.session.id === workoutSessionId);
  if (!review) return null;
  const feedback = state.trainerFeedback
    .filter((item) => item.workoutSessionId === workoutSessionId)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      body: item.body,
      author: item.author,
      sentAt: item.sentAt,
    }));
  const attention = state.attentionItems.find((item) => item.workoutSessionId === workoutSessionId);
  const activeQueue = state.attentionItems.filter((item) => item.status === "active");
  const position = attention ? activeQueue.findIndex((item) => item.id === attention.id) + 1 : 0;
  return {
    ...review,
    feedback: { ...review.feedback, existing: feedback },
    attentionContext: attention
      ? {
          id: attention.id,
          queue: "dashboard",
          position: Math.max(1, position),
          total: activeQueue.length,
          reason: attention.reason,
          nextSessionId: getNextReviewSessionId(state, attention.id),
        }
      : review.attentionContext,
  };
}

export function getDefaultWorkoutReviewSessionId(state: TrainerDemoState, athleteId: string) {
  return state.attentionItems.find(
    (item) => item.athleteId === athleteId && item.status === "active" && Boolean(item.workoutSessionId)
  )?.workoutSessionId
    ?? state.workoutSessions.find((item) => item.athlete.id === athleteId)?.session.id;
}

export function getQuickAssignView(
  state: TrainerDemoState,
  athleteId: string | null,
  context: QuickAssignEntryContext
): QuickAssignView | null {
  if (!athleteId) return null;
  const athlete = getQuickAssignAthlete(state, athleteId);
  if (!athlete) return null;
  const templates = state.workoutTemplates
    .filter((item) => athleteId !== "alexandra-konstantinova" || item.createdForAthleteId === athleteId)
    .map((item) => toQuickAssignTemplate(item.draft));
  const assignments = state.workoutAssignments
    .filter((assignment) => assignment.athleteId === athleteId)
    .map((assignment) => ({
      id: assignment.id,
      templateId: assignment.sourceTemplateId,
      title: assignment.templateTitle,
      scheduledDate: assignment.scheduledDate,
    }));
  return {
    athlete,
    context,
    templates,
    recentAssignments: assignments,
    constraints: athlete.state === "paused"
      ? { assignmentAllowed: false, reason: "Ведение спортсмена приостановлено. Проверьте статус доступа перед новым назначением." }
      : { assignmentAllowed: true },
  };
}

export function getWorkoutTemplateWorkspace(state: TrainerDemoState) {
  return state.workoutTemplates.map((item) => item.draft);
}

export function getWorkoutTemplateEditorView(state: TrainerDemoState, templateId: string) {
  return state.workoutTemplates.find((item) => item.draft.id === templateId)?.draft ?? null;
}

function getDashboardClients(state: TrainerDemoState, mode: TrainerDashboardDemoMode) {
  const base = getDashboardClientsForMode(state.athletes, mode);
  if (mode !== "team") return base;
  return base.map((client) => {
    const attention = state.attentionItems.find((item) => item.athleteId === client.id && item.status === "active");
    const assignment = state.workoutAssignments.filter((item) => item.athleteId === client.id).at(-1);
    if (attention) return clientFromAttention(client, attention);
    if (client.state === "inactive") return client;
    return {
      ...client,
      state: "on_track" as const,
      stateLabel: assignment ? "Следующая назначена" : "По плану",
      progressTrend: "up" as const,
      priority: "low" as const,
      issue: undefined,
      context: undefined,
      primaryAction: undefined,
      nextWorkout: assignment?.templateTitle ?? client.nextWorkout,
      lastActivity: assignment ? "сейчас" : client.lastActivity,
    };
  });
}

function clientFromAttention(client: TeamClient, attention: RuntimeAttentionItem): TeamClient {
  const state = attention.kind === "discomfort"
    ? "needs_adjustment"
    : attention.kind === "review"
      ? "waiting_review"
      : attention.kind === "assignment"
        ? "no_next_workout"
        : client.state;
  return {
    ...client,
    state,
    stateLabel: attention.kind === "discomfort" ? "Нужна корректировка" : attention.kind === "review" ? "Ждёт разбора" : attention.kind === "assignment" ? "Нет следующей" : client.stateLabel,
    priority: attention.kind === "discomfort" ? "high" : client.priority,
    issue: attention.reason,
    context: attention.originalText ?? attention.signal,
    primaryAction: attention.primaryAction === "open_profile" ? "open_client" : attention.primaryAction,
  };
}

function toAttentionQueueItem(item: RuntimeAttentionItem, client?: TeamClient): TrainerAttentionQueueItem | null {
  if (!client) return null;
  return {
    id: item.id,
    clientId: item.athleteId,
    client,
    kind: item.kind,
    eventLabel: item.eventLabel,
    happenedAt: item.happenedAt,
    reason: item.reason,
    signal: item.originalText ?? item.signal,
    relatedSignals: [...item.relatedSignals],
    primaryAction: item.primaryAction,
    reviewHref: item.workoutSessionId ? `/trainer/review/${item.workoutSessionId}` : undefined,
    visualPrototype: item.visualPrototype,
    ageHours: item.ageHours,
  };
}

function augmentAthleteProfile(state: TrainerDemoState, base: AthleteProfile): AthleteProfile {
  const assignments: AthleteWorkout[] = state.workoutAssignments
    .filter((item) => item.athleteId === base.id)
    .filter((assignment) => state.workoutSessions.find((session) => session.assignmentEntityId === assignment.id)?.lifecycleStatus !== "completed"
      && state.workoutSessions.find((session) => session.assignmentEntityId === assignment.id)?.lifecycleStatus !== "completed_with_omissions")
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.templateTitle,
      date: assignment.scheduledDate,
      meta: `${assignment.snapshotExercises.length} упражнений · rev ${assignment.sourceTemplateRevision}`,
      status: state.workoutSessions.some((session) => session.assignmentEntityId === assignment.id && session.lifecycleStatus === "active") ? "В процессе" : "Запланирована",
      tone: "good",
    }));
  const runtimeTimeline: AthleteTimelineItem[] = [
    ...state.trainerFeedback.filter((item) => item.athleteId === base.id).map((feedback) => ({
      id: feedback.id,
      title: feedback.kind === "follow-up" ? "Уточнение тренера" : "Feedback тренера",
      detail: feedback.body,
      time: feedback.sentAt,
      icon: MessageSquareText,
      tone: "good" as const,
    })),
    ...state.manualResolutions.filter((item) => item.athleteId === base.id).map((resolution) => ({
      id: resolution.id,
      title: "Разбор закрыт без сообщения",
      detail: resolution.reason,
      time: resolution.resolvedAt,
      icon: CheckCircle2,
      tone: "muted" as const,
    })),
    ...state.attentionItems.filter((item) => item.athleteId === base.id && item.originalText).map((item) => ({
      id: `signal-history-${item.id}`,
      title: "Комментарий спортсмена · исходный сигнал",
      detail: item.originalText ?? item.signal,
      time: item.happenedAt,
      icon: ShieldAlert,
      tone: "warning" as const,
    })),
  ];
  const assignmentTimeline: AthleteTimelineItem[] = assignments.map((assignment) => ({
    id: `timeline-${assignment.id}`,
    title: "Назначена тренировка",
    detail: `${assignment.title} · ${assignment.date}`,
    time: "сейчас",
    icon: Dumbbell,
    tone: "good",
  }));
  const feedbackPosts: AthleteProfile["profilePosts"] = state.trainerFeedback
    .filter((item) => item.athleteId === base.id)
    .map((feedback) => ({
      id: `profile-${feedback.id}`,
      type: "coach_note",
      author: "coach",
      title: feedback.kind === "follow-up" ? "Уточнение тренера" : "Feedback по тренировке",
      body: feedback.body,
      time: feedback.sentAt,
      meta: "WorkoutSession",
      tone: "good",
    }));
  const signalPosts: AthleteProfile["profilePosts"] = state.attentionItems
    .filter((item) => item.athleteId === base.id && item.originalText)
    .map((item) => ({
      id: `profile-signal-${item.id}`,
      type: "check_in",
      author: "client",
      title: "Исходный сигнал спортсмена",
      body: item.originalText ?? item.signal,
      time: item.happenedAt,
      meta: "Без диагноза и AI-интерпретации",
      tone: "warning",
    }));
  const integratedSessions = state.workoutSessions.filter(
    (session) => session.athlete.id === base.id && session.assignmentEntityId && state.workoutAssignments.some((assignment) => assignment.id === session.assignmentEntityId)
  );
  const completedSessions = integratedSessions.filter((session) => session.lifecycleStatus !== "active");
  const runtimeHistory: AthleteWorkout[] = completedSessions.map((session) => ({
    id: session.session.id,
    title: session.sessionTitle,
    date: session.session.completedLabel,
    meta: `${session.summary.completedSets}/${session.summary.totalSets} подходов${session.discomfort ? " · отмечен дискомфорт" : ""}`,
    status: session.lifecycleStatus === "completed_with_omissions" ? "Завершена с пропусками" : "Завершена",
    tone: session.discomfort ? "warning" : session.lifecycleStatus === "completed_with_omissions" ? "muted" : "good",
  }));
  const runtimeSets = completedSessions.flatMap((session) => session.exerciseLogs.flatMap((exercise) => exercise.sets
    .filter((set) => set.completed && set.actualRepetitions !== undefined)
    .map((set) => ({ session, exercise, set }))));
  const strongest = runtimeSets.sort((a, b) => (b.set.actualWeightKg ?? 0) - (a.set.actualWeightKg ?? 0) || (b.set.actualRepetitions ?? 0) - (a.set.actualRepetitions ?? 0))[0];
  const runtimeBestResults: AthleteProfile["bestResults"] = strongest ? [{
    id: `runtime-best-${strongest.set.id}`,
    exercise: strongest.exercise.title,
    value: `${strongest.set.actualWeightKg ?? "—"} кг × ${strongest.set.actualRepetitions}`,
    date: strongest.session.session.completedLabel,
    delta: "Факт текущей сессии",
    tone: "good",
  }] : [];
  const runtimeExerciseTrends: AthleteProfile["exerciseTrends"] = strongest ? [{
    id: `runtime-trend-${strongest.exercise.exerciseId}`,
    exercise: strongest.exercise.title,
    description: "Фактические рабочие подходы из WorkoutSession",
    values: runtimeSets.filter((item) => item.exercise.exerciseId === strongest.exercise.exerciseId).map((item) => item.set.actualWeightKg ?? item.set.actualRepetitions ?? 0),
    unit: strongest.set.actualWeightKg !== undefined ? "кг" : "повт.",
    start: "Первая запись",
    current: `${strongest.set.actualWeightKg ?? strongest.set.actualRepetitions ?? 0}`,
    increase: "Runtime facts",
    bestSet: `${strongest.set.actualWeightKg ?? "—"} кг × ${strongest.set.actualRepetitions}`,
    tone: "good",
  }] : [];
  return {
    ...base,
    career: { ...base.career, completedWorkouts: base.career.completedWorkouts + completedSessions.length },
    upcomingWorkouts: uniqueById([...assignments, ...base.upcomingWorkouts]),
    workoutHistory: uniqueById([...runtimeHistory, ...base.workoutHistory]),
    bestResults: uniqueById([...runtimeBestResults, ...base.bestResults]),
    exerciseTrends: uniqueById([...runtimeExerciseTrends, ...base.exerciseTrends]),
    timeline: uniqueById([...assignmentTimeline, ...runtimeTimeline, ...base.timeline]),
    profilePosts: uniqueById([...feedbackPosts, ...signalPosts, ...base.profilePosts]),
    nextWorkout: assignments.at(-1)?.title ?? base.nextWorkout,
  };
}

function getQuickAssignAthlete(state: TrainerDemoState, athleteId: string): QuickAssignAthlete | null {
  const profile = state.athleteProfiles.find((item) => item.id === athleteId);
  const teamClient = state.athletes.find((item) => item.id === athleteId);
  if (!profile && !teamClient) return null;
  const activeAttention = state.attentionItems.find((item) => item.athleteId === athleteId && item.status === "active");
  const paused = profile?.membership.status === "paused" || teamClient?.state === "inactive";
  return {
    id: athleteId,
    displayName: profile?.name ?? teamClient?.name ?? athleteId,
    initials: profile?.initials ?? teamClient?.initials ?? "?",
    goal: profile?.goal ?? teamClient?.goal,
    status: paused ? "На паузе" : profile?.status ?? teamClient?.stateLabel ?? "Активен",
    state: paused
      ? "paused"
      : activeAttention?.kind === "assignment"
        ? "needs_assignment"
        : activeAttention?.kind === "review"
          ? "after_review"
          : activeAttention
            ? "active"
            : state.workoutAssignments.some((item) => item.athleteId === athleteId)
              ? "calm"
              : "active",
  };
}

function toQuickAssignTemplate(template: WorkoutTemplateDraft): WorkoutTemplateListItem {
  return {
    id: template.id,
    revision: template.revision,
    title: template.title,
    description: template.description,
    category: template.category,
    focus: template.category ? [template.category] : [],
    durationMin: Number.parseInt(template.estimatedDurationMin, 10) || 45,
    state: template.status,
    recent: template.usageCount > 0,
    instruction: template.generalInstruction,
    hasSupersets: template.items.some((item) => item.kind === "superset"),
    exercises: getTemplateExercises(template).map((exercise) => ({
      id: exercise.instanceId,
      title: exercise.title,
      sets: Number.parseInt(exercise.prescription.sets, 10) || 1,
      repetitions: exercise.prescription.type === "duration"
        ? Number.parseInt(exercise.prescription.durationSec, 10) || 1
        : Number.parseInt(exercise.prescription.repetitionsMin, 10) || 1,
      targetWeightKg: exercise.prescription.targetWeightKg ? Number(exercise.prescription.targetWeightKg) : undefined,
    })),
  };
}

function getNextReviewSessionId(state: TrainerDemoState, attentionItemId: string) {
  const active = state.attentionItems.filter((item) => item.status === "active" && item.workoutSessionId);
  const currentIndex = active.findIndex((item) => item.id === attentionItemId);
  return active[currentIndex + 1]?.workoutSessionId;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function hasSuitablePublishedTemplate(view: QuickAssignView) {
  return view.templates.some((template) => template.state === "published" && isTemplateSuitable(template, view.athlete));
}
