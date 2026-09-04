import {
  buildTrainerDashboardSummary,
  type TrainerAttentionQueueItem,
} from "@/components/trainer-os/home/dashboard-read-model";
import { getTeamSummary } from "@/components/trainer-os/home/mock-data";
import type { TeamActivityDateGroup, TeamActivityItem, TeamClient } from "@/components/trainer-os/home/types";
import type { TrainerDashboardSnapshot } from "@/lib/server/trainer-dashboard/trainer-dashboard-types";

export type CanonicalTrainerDashboardView = {
  clients: TeamClient[];
  attentionItems: TrainerAttentionQueueItem[];
  activities: TeamActivityItem[];
  summary: ReturnType<typeof buildTrainerDashboardSummary>;
};

export function buildCanonicalTrainerDashboardView(
  snapshot: TrainerDashboardSnapshot,
  now = new Date(),
): CanonicalTrainerDashboardView {
  const reviewByAthlete = new Map(snapshot.reviews.toReversed().map((review) => [review.athleteUserId, review]));
  const clients = snapshot.athletes.map<TeamClient>((athlete) => {
    const review = reviewByAthlete.get(athlete.athleteUserId);
    if (review) {
      return {
        id: athlete.athleteUserId,
        name: athlete.displayName,
        initials: athlete.initials,
        goal: "Активная связь",
        state: "waiting_review",
        stateLabel: "Ждёт разбора",
        progressTrend: "flat",
        isOnline: false,
        priority: "high",
        lastActivity: relativeTime(review.completedAt, now),
        issue: "Тренировка ждёт разбора",
        context: `${review.sessionTitle}: ${review.completedSets} из ${review.totalSets} подходов выполнено.`,
        primaryAction: "review",
      };
    }

    if (athlete.nextAssignment) {
      return {
        id: athlete.athleteUserId,
        name: athlete.displayName,
        initials: athlete.initials,
        goal: "Активная связь",
        state: "on_track",
        stateLabel: athlete.nextAssignment.status === "in_progress" ? "Тренируется" : "Тренировка назначена",
        progressTrend: "flat",
        isOnline: athlete.nextAssignment.status === "in_progress",
        priority: "low",
        lastActivity: relativeTime(athlete.latestActivityAt, now),
        nextWorkout: athlete.nextAssignment.title,
      };
    }

    return {
      id: athlete.athleteUserId,
      name: athlete.displayName,
      initials: athlete.initials,
      goal: "Активная связь",
      state: "no_next_workout",
      stateLabel: "Нет следующей",
      progressTrend: "flat",
      isOnline: false,
      priority: "high",
      lastActivity: relativeTime(athlete.latestActivityAt, now),
      issue: "Нет следующей тренировки",
      context: "Активная связь есть, но доступная или начатая тренировка не найдена.",
      primaryAction: "assign",
    };
  });

  const clientById = new Map(clients.map((client) => [client.id, client]));
  const reviewItems = snapshot.reviews.map<TrainerAttentionQueueItem>((review) => {
      const client: TeamClient = clientById.get(review.athleteUserId) ?? {
        id: review.athleteUserId, name: review.athleteDisplayName, initials: review.athleteInitials,
        goal: "Разбор завершённой тренировки", state: "waiting_review", stateLabel: "Ждёт разбора",
        progressTrend: "flat", isOnline: false, priority: "high",
        lastActivity: relativeTime(review.completedAt, now), primaryAction: "review",
      };
      return {
        id: review.id,
        clientId: client.id,
        client,
        kind: "review",
        eventLabel: "Тренировка завершена",
        happenedAt: relativeTime(review.completedAt, now),
        reason: "Тренировка ждёт разбора",
        signal: `${review.sessionTitle}: ${review.completedSets} из ${review.totalSets} подходов выполнено.`,
        relatedSignals: [
          review.hasClientComments ? "Есть комментарий спортсмена" : "Комментариев спортсмена нет",
          ...review.priorityReasons.map(priorityLabel),
        ],
        primaryAction: "review",
        reviewHref: `/trainer/review/${review.sessionId}`,
        canOpenProfile: clientById.has(review.athleteUserId),
        ageHours: ageHours(review.completedAt, now),
      };
  });
  const attentionItems = [...reviewItems, ...clients.flatMap<TrainerAttentionQueueItem>((client) => {
    if (client.state === "no_next_workout") {
      return [{
        id: `assignment-${client.id}`,
        clientId: client.id,
        client,
        kind: "assignment",
        eventLabel: "Следующий шаг не назначен",
        happenedAt: client.lastActivity,
        reason: "Нет следующей тренировки",
        signal: "Активная связь есть, но доступная или начатая тренировка не найдена.",
        relatedSignals: ["Нужно выбрать готовый шаблон или создать новый"],
        primaryAction: "assign",
        ageHours: 0,
      }];
    }
    return [];
  })];

  const activities = snapshot.activities
    .filter((activity) => clientById.has(activity.athleteUserId))
    .map<TeamActivityItem>((activity) => ({
      id: activity.id,
      clientId: activity.athleteUserId,
      clientName: activity.athleteDisplayName,
      type: activity.kind === "workout_completed"
        ? "completed_workout"
        : activity.kind === "feedback_sent"
          ? "review_sent"
          : "workout_assigned",
      title: activity.kind === "workout_completed"
        ? `${activity.athleteDisplayName}: тренировка завершена`
        : activity.kind === "feedback_sent"
          ? `${activity.athleteDisplayName}: обратная связь отправлена`
          : `${activity.athleteDisplayName}: назначена тренировка`,
      description: activity.detail,
      time: relativeTime(activity.occurredAt, now),
      clock: clockTime(activity.occurredAt),
      dateGroup: dateGroup(activity.occurredAt, now),
      unread: activity.kind === "workout_completed",
      href: activity.sessionId && activity.kind === "workout_completed"
        ? `/trainer/review/${activity.sessionId}?from=history`
        : `/trainer/clients/${activity.athleteUserId}?from=dashboard&entry=activity`,
    }));

  return {
    clients,
    attentionItems,
    activities,
    summary: buildTrainerDashboardSummary(getTeamSummary(clients), attentionItems),
  };
}

function relativeTime(value: string, now: Date) {
  const differenceMs = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(differenceMs / 60_000);
  if (minutes < 2) return "сейчас";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value));
}

function clockTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateGroup(value: string, now: Date): TeamActivityDateGroup {
  const current = dayKey(now);
  const target = dayKey(new Date(value));
  if (target === current) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return target === dayKey(yesterday) ? "yesterday" : "week";
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function ageHours(value: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 3_600_000));
}

function priorityLabel(value: string) {
  if (value === "discomfort") return "Спортсмен отметил дискомфорт";
  if (value === "client_comment") return "Есть комментарий к подходу";
  if (value === "omissions" || value === "partial_completion") return "Тренировка завершена с пропусками";
  return value.replaceAll("_", " ");
}
