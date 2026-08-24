import type { TrainerDashboardSnapshot } from "@/lib/server/trainer-dashboard/trainer-dashboard-types";

export type CanonicalRosterStatus = "waiting_review" | "no_next_workout" | "in_progress" | "scheduled";
export type CanonicalRosterFilter = "all" | "attention" | "waiting_review" | "on_track";

export type CanonicalRosterAthlete = {
  athleteUserId: string;
  displayName: string;
  initials: string;
  status: CanonicalRosterStatus;
  statusLabel: string;
  nextStep: string;
  nextStepDetail: string;
  latestActivity: string;
  reviewHref: string | null;
  needsAction: boolean;
};

export type CanonicalRosterSummary = {
  total: number;
  attention: number;
  waitingReview: number;
  onTrack: number;
};

export function buildCanonicalTrainerRoster(
  snapshot: TrainerDashboardSnapshot,
  now = new Date(),
): { athletes: CanonicalRosterAthlete[]; summary: CanonicalRosterSummary } {
  const reviewByAthlete = new Map(snapshot.reviews.map((review) => [review.athleteUserId, review]));
  const athletes = snapshot.athletes.map<CanonicalRosterAthlete>((athlete) => {
    const review = reviewByAthlete.get(athlete.athleteUserId);
    if (review) {
      return {
        athleteUserId: athlete.athleteUserId,
        displayName: athlete.displayName,
        initials: athlete.initials,
        status: "waiting_review",
        statusLabel: "Ждёт разбора",
        nextStep: "Разобрать тренировку",
        nextStepDetail: review.sessionTitle,
        latestActivity: relativeTime(review.completedAt, now),
        reviewHref: `/trainer/review/${review.sessionId}`,
        needsAction: true,
      };
    }

    if (athlete.nextAssignment) {
      const inProgress = athlete.nextAssignment.status === "in_progress";
      return {
        athleteUserId: athlete.athleteUserId,
        displayName: athlete.displayName,
        initials: athlete.initials,
        status: inProgress ? "in_progress" : "scheduled",
        statusLabel: inProgress ? "Тренируется" : "Тренировка назначена",
        nextStep: athlete.nextAssignment.title,
        nextStepDetail: inProgress ? "Выполняет сейчас" : formatScheduledDate(athlete.nextAssignment.scheduledFor),
        latestActivity: relativeTime(athlete.latestActivityAt, now),
        reviewHref: null,
        needsAction: false,
      };
    }

    return {
      athleteUserId: athlete.athleteUserId,
      displayName: athlete.displayName,
      initials: athlete.initials,
      status: "no_next_workout",
      statusLabel: "Нет следующей",
      nextStep: "Назначить тренировку",
      nextStepDetail: "Календарь дальше пуст",
      latestActivity: relativeTime(athlete.latestActivityAt, now),
      reviewHref: null,
      needsAction: true,
    };
  }).sort((left, right) => statusPriority[left.status] - statusPriority[right.status]
    || left.displayName.localeCompare(right.displayName, "ru"));

  const waitingReview = athletes.filter((athlete) => athlete.status === "waiting_review").length;
  const attention = athletes.filter((athlete) => athlete.needsAction).length;

  return {
    athletes,
    summary: {
      total: athletes.length,
      attention,
      waitingReview,
      onTrack: athletes.length - attention,
    },
  };
}

export function filterCanonicalTrainerRoster(
  athletes: CanonicalRosterAthlete[],
  filter: CanonicalRosterFilter,
  search: string,
) {
  const query = search.trim().toLocaleLowerCase("ru");
  return athletes.filter((athlete) => {
    const matchesQuery = !query || [athlete.displayName, athlete.statusLabel, athlete.nextStep]
      .join(" ")
      .toLocaleLowerCase("ru")
      .includes(query);
    const matchesFilter = filter === "all"
      || (filter === "attention" && athlete.needsAction)
      || (filter === "waiting_review" && athlete.status === "waiting_review")
      || (filter === "on_track" && !athlete.needsAction);
    return matchesQuery && matchesFilter;
  });
}

const statusPriority: Record<CanonicalRosterStatus, number> = {
  waiting_review: 0,
  no_next_workout: 1,
  in_progress: 2,
  scheduled: 3,
};

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

function formatScheduledDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}
