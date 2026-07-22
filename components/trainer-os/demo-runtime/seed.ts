import { athleteProfiles } from "@/components/trainer-os/client-profile/mock-data";
import {
  buildTrainerAttentionQueue,
  type TrainerAttentionQueueItem,
} from "@/components/trainer-os/home/dashboard-read-model";
import {
  teamActivityItems,
  trainerHomeClients,
} from "@/components/trainer-os/home/mock-data";
import {
  getDemoQuickAssignTemplates,
  type WorkoutTemplateListItem,
} from "@/components/trainer-os/quick-assign/quick-assign-model";
import {
  getReviewDemoSessionIds,
  getWorkoutReviewDetails,
  type WorkoutReviewDetails,
} from "@/components/trainer-os/workout-review/review-model";
import {
  createSetRows,
  getDemoBuilderTemplates,
  type WorkoutPrescriptionDraft,
  type WorkoutTemplateDraft,
  type WorkoutTemplateExerciseDraft,
} from "@/components/trainer-os/workout-template-builder/builder-model";

import type {
  RuntimeExerciseLog,
  RuntimeAttentionItem,
  RuntimeWorkoutSession,
  TrainerDemoState,
} from "./types";

const attentionSessionByAthlete: Record<string, string | undefined> = {
  "artem-smirnov": "artem-smirnov-2026-06-10",
  "olga-sokolova": "olga-sokolova-2026-06-16",
};

export function createInitialTrainerDemoState(): TrainerDemoState {
  const attentionItems = buildTrainerAttentionQueue(trainerHomeClients).map(toRuntimeAttentionItem);
  const reviewSessions = getReviewDemoSessionIds()
    .map((sessionId) => getWorkoutReviewDetails(sessionId))
    .filter((session): session is WorkoutReviewDetails => Boolean(session));
  reviewSessions.push(createOlgaDiscomfortSession());
  const workoutSessions = reviewSessions.map(toRuntimeWorkoutSession);

  const existingTemplates = getDemoBuilderTemplates();
  const existingTemplateIds = new Set(existingTemplates.map((template) => template.id));
  const quickAssignTemplates = getDemoQuickAssignTemplates()
    .filter((template) => !existingTemplateIds.has(template.id))
    .map(fromQuickAssignTemplate);

  return {
    athletes: trainerHomeClients.map((athlete) => ({ ...athlete })),
    athleteProfiles: athleteProfiles.map(cloneProfile),
    workoutTemplates: [...existingTemplates, ...quickAssignTemplates].map((draft) => ({ draft })),
    workoutAssignments: [],
    workoutSessions,
    attentionItems,
    trainerFeedback: workoutSessions.flatMap((session) =>
      session.feedback.existing.map((feedback) => ({
        ...feedback,
        athleteId: session.athlete.id,
        workoutSessionId: session.session.id,
        attentionItemId: findAttentionId(attentionItems, session.athlete.id, session.session.id),
        trainerId: "trainer-alexey-romanov",
      }))
    ),
    manualResolutions: [],
    teamActivity: teamActivityItems.map((item) => ({ ...item })),
    selectedAttentionItemId: attentionItems[0]?.id ?? null,
    pilotEvents: [],
  };
}

function toRuntimeWorkoutSession(review: WorkoutReviewDetails): RuntimeWorkoutSession {
  const exerciseLogs: RuntimeExerciseLog[] = review.exercises.map((exercise, exerciseIndex) => {
    const plannedSets = exercise.planned?.sets ?? exercise.actual.sets.map((set) => ({
      id: set.id,
      kind: set.kind,
      repetitions: set.repetitions,
      targetWeightKg: set.weightKg,
      targetRpe: set.rpe,
    }));
    return {
      id: `exercise-log-${review.session.id}-${exercise.id}`,
      workoutSessionId: review.session.id,
      assignmentExerciseId: exercise.id,
      exerciseId: exercise.id,
      title: exercise.title,
      order: exerciseIndex + 1,
      status: exercise.state === "skipped" ? "skipped" : exercise.state === "completed" || exercise.state === "modified" || exercise.state === "added" ? "completed" : "in_progress",
      skipReason: exercise.state === "skipped" ? exercise.modificationNote ?? exercise.actual.comment : undefined,
      clientComment: exercise.actual.comment,
      sets: plannedSets.map((plan, setIndex) => {
        const actual = exercise.actual.sets.find((set) => set.id === plan.id) ?? exercise.actual.sets[setIndex];
        return {
          id: `set-log-${review.session.id}-${exercise.id}-${plan.id}`,
          workoutSessionId: review.session.id,
          assignmentExerciseId: exercise.id,
          order: setIndex + 1,
          kind: plan.kind,
          plan: { ...plan },
          actualRepetitions: actual?.repetitions,
          actualWeightKg: actual?.weightKg,
          rpe: actual?.rpe,
          completed: actual?.completed ?? false,
          comment: actual?.comment,
        };
      }),
    };
  });
  const discomfort = review.signals.find((signal) => signal.kind === "discomfort" && signal.originalText);
  return {
    ...review,
    assignmentEntityId: review.assignment?.id,
    lifecycleStatus: review.session.status === "partial" || review.summary.hasSkippedWork ? "completed_with_omissions" : "completed",
    startedAt: review.session.completedAt,
    exerciseLogs,
    discomfort: discomfort?.originalText
      ? { originalText: discomfort.originalText, area: discomfort.area, severity: discomfort.severity }
      : undefined,
    completionReceiptId: `legacy-completion-${review.session.id}`,
  };
}

function toRuntimeAttentionItem(item: TrainerAttentionQueueItem): RuntimeAttentionItem {
  const workoutSessionId = attentionSessionByAthlete[item.clientId];
  const originalText = item.kind === "discomfort"
    ? "После тяговой тренировки появилось тянущее ощущение в плече. Резкой боли не было."
    : undefined;

  return {
    id: item.id,
    athleteId: item.clientId,
    kind: item.kind,
    status: "active",
    eventLabel: item.eventLabel,
    happenedAt: item.happenedAt,
    reason: item.reason,
    signal: originalText ?? item.signal,
    originalText,
    relatedSignals: [...item.relatedSignals],
    primaryAction: item.kind === "discomfort" && workoutSessionId ? "review" : item.primaryAction,
    workoutSessionId,
    ageHours: item.ageHours,
    visualPrototype: item.visualPrototype,
  };
}

function fromQuickAssignTemplate(template: WorkoutTemplateListItem): WorkoutTemplateDraft {
  return {
    id: template.id,
    title: template.title,
    status: template.state,
    revision: template.revision,
    description: template.description,
    category: template.category,
    estimatedDurationMin: String(template.durationMin),
    generalInstruction: template.instruction,
    items: template.exercises.map((exercise, index) => {
      const prescription: WorkoutPrescriptionDraft = {
        type: "repetitions",
        sets: String(exercise.sets),
        repetitionMode: "fixed",
        repetitionsMin: String(exercise.repetitions),
        repetitionsMax: String(exercise.repetitions),
        durationSec: "",
        targetWeightKg: exercise.targetWeightKg ? String(exercise.targetWeightKg) : "",
        restSec: "90",
      };
      const instanceId = `runtime-${template.id}-${exercise.id}-${index + 1}`;
      const instance: WorkoutTemplateExerciseDraft = {
        instanceId,
        exerciseId: exercise.id,
        title: exercise.title,
        category: template.focus[0] ?? template.category,
        prescription,
        perSetMode: false,
        setOverrides: createSetRows(exercise.sets, prescription, instanceId),
        trainerNote: "",
      };
      return { id: instanceId, kind: "exercise" as const, exercise: instance };
    }),
    updatedLabel: template.lastUsed ?? "из Quick Assign",
    usageCount: template.recent ? 1 : 0,
  };
}

function createOlgaDiscomfortSession(): WorkoutReviewDetails {
  return {
    session: {
      id: "olga-sokolova-2026-06-16",
      status: "completed",
      completedAt: "2026-06-16T19:40:00+03:00",
      completedLabel: "16 июня, 19:40",
      durationMin: 48,
    },
    athlete: {
      id: "olga-sokolova",
      displayName: "Ольга Соколова",
      initials: "ОС",
      goal: "Сила и осанка",
      profileHref: "/trainer/clients/olga-sokolova",
    },
    assignment: {
      id: "assignment-olga-pull-06",
      title: "День тяги",
      scheduledFor: "16 июня, 18:30",
    },
    sessionTitle: "День тяги",
    summary: {
      completedExercises: 2,
      totalExercises: 3,
      completedSets: 6,
      totalSets: 9,
      hasSkippedWork: true,
      hasDiscomfort: true,
    },
    signals: [
      {
        id: "olga-shoulder-discomfort",
        kind: "discomfort",
        tone: "danger",
        title: "Спортсмен отметил дискомфорт",
        detail: "После тяговой тренировки появилось тянущее ощущение в плече.",
        sourceLabel: "Оригинальный комментарий клиента",
        originalText: "После тяговой тренировки появилось тянущее ощущение в плече. Резкой боли не было.",
        area: "Плечо",
        severity: "medium",
      },
    ],
    clientComment: "После тяговой тренировки появилось тянущее ощущение в плече. Резкой боли не было.",
    exercises: [
      {
        id: "olga-pulldown",
        title: "Тяга верхнего блока",
        state: "completed",
        actual: { sets: [{ id: "1", kind: "working", repetitions: 10, weightKg: 42, completed: true }] },
      },
      {
        id: "olga-row",
        title: "Горизонтальная тяга",
        state: "completed",
        actual: { sets: [{ id: "1", kind: "working", repetitions: 12, weightKg: 38, completed: true }] },
      },
      {
        id: "olga-face-pull",
        title: "Тяга каната к лицу",
        state: "skipped",
        actual: { sets: [] },
      },
    ],
    previousContext: {
      label: "Контекст безопасности",
      detail: "Сохраняется исходный текст клиента. Интерпретация и диагноз не формируются.",
    },
    feedback: {
      aiState: "unavailable",
      existing: [],
    },
    attentionContext: {
      id: "attention-olga-sokolova-discomfort",
      queue: "dashboard",
      position: 1,
      total: 4,
      reason: "Сигнал о дискомфорте",
      nextSessionId: "artem-smirnov-2026-06-10",
    },
  };
}

function findAttentionId(items: RuntimeAttentionItem[], athleteId: string, sessionId: string) {
  return items.find((item) => item.athleteId === athleteId && item.workoutSessionId === sessionId)?.id;
}

function cloneProfile(profile: (typeof athleteProfiles)[number]) {
  return {
    ...profile,
    upcomingWorkouts: profile.upcomingWorkouts.map((workout) => ({ ...workout })),
    workoutHistory: profile.workoutHistory.map((workout) => ({ ...workout })),
    timeline: profile.timeline.map((item) => ({ ...item })),
    openIssues: [...profile.openIssues],
  };
}
