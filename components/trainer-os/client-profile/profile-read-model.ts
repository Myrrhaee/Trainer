import type { TeamClient } from "@/components/trainer-os/home/types";

import { getAthleteProfile } from "./mock-data";
import type { AthleteProfile } from "./types";

export type ClientProfileTab = "overview" | "training" | "progress" | "finance";
export type ProfilePrimaryActionKind = "review" | "assign" | "message" | "open_plan";
export type ProfileAttentionKind = "discomfort" | "review" | "assignment" | "missed_workout";

export type ProfileEntryInput = {
  from?: string;
  attention?: string;
  attentionItem?: string;
  entry?: string;
};

export type ProfileEntryContext = {
  source: "dashboard" | "clients" | "review" | "direct";
  itemId?: string;
  kind?: ProfileAttentionKind;
  label: string;
  title: string;
  detail: string;
  signal?: string;
  happenedAt?: string;
  returnHref: string;
  returnLabel: string;
  nextClientId?: string;
  nextAttentionKind?: ProfileAttentionKind;
};

export type TrainerAthleteProfileView = {
  athlete: AthleteProfile;
  context: ProfileEntryContext | null;
  source: ProfileEntryContext["source"];
  primaryAction: {
    kind: ProfilePrimaryActionKind;
    label: string;
  };
  defaultTab: ClientProfileTab;
  reviewSessionId?: string;
  latestEvent: AthleteProfile["timeline"][number] | null;
};

export function buildTrainerAthleteProfileView(
  clientId: string,
  entry: ProfileEntryInput
): TrainerAthleteProfileView | null {
  const athlete = getAthleteProfile(clientId);
  if (!athlete) return null;

  const source = getSource(entry);
  const attentionKind = parseAttentionKind(entry.attention);
  const context = buildEntryContext(athlete, source, attentionKind, entry.attentionItem, entry.entry);
  const primaryAction = getPrimaryAction(athlete, attentionKind);
  const reviewSessionId = clientId === "artem-smirnov" ? "artem-smirnov-2026-06-10" : undefined;

  return {
    athlete,
    context,
    source,
    primaryAction,
    defaultTab: primaryAction.kind === "review" || primaryAction.kind === "assign" ? "training" : "overview",
    reviewSessionId,
    latestEvent: athlete.timeline[0] ?? null,
  };
}

export function toProfileTeamClient(view: TrainerAthleteProfileView): TeamClient {
  const { athlete, primaryAction } = view;
  const state =
    primaryAction.kind === "review"
      ? "waiting_review"
      : primaryAction.kind === "assign"
        ? "no_next_workout"
        : athlete.membership.status === "paused"
          ? "inactive"
          : athlete.openIssues.length > 0
            ? "needs_adjustment"
            : "on_track";

  return {
    id: athlete.id,
    name: athlete.name,
    initials: athlete.initials,
    goal: athlete.goal,
    state,
    stateLabel: athlete.status,
    progressTrend: athlete.weightTrend.length > 1 ? "up" : "flat",
    isOnline: false,
    priority: state === "on_track" ? "low" : "high",
    lastActivity: athlete.lastActivity,
    nextWorkout: athlete.upcomingWorkouts[0]?.title,
    issue: view.context?.title ?? athlete.openIssues[0],
    context: view.context?.signal ?? view.latestEvent?.detail,
    primaryAction:
      primaryAction.kind === "review"
        ? "review"
        : primaryAction.kind === "assign"
          ? "assign"
          : primaryAction.kind === "message"
            ? "message"
            : "open_client",
  };
}

function getSource(entry: ProfileEntryInput): ProfileEntryContext["source"] {
  if (entry.from === "dashboard") return "dashboard";
  if (entry.from === "clients") return "clients";
  if (entry.from === "review") return "review";
  return "direct";
}

function parseAttentionKind(value?: string): ProfileAttentionKind | undefined {
  if (value === "discomfort" || value === "review" || value === "assignment" || value === "missed_workout") return value;
  return undefined;
}

function buildEntryContext(
  athlete: AthleteProfile,
  source: ProfileEntryContext["source"],
  kind?: ProfileAttentionKind,
  itemId?: string,
  entryKind?: string
): ProfileEntryContext | null {
  if (source !== "dashboard" || !kind) return null;

  const base = attentionContextByKind[kind];
  const next = nextQueueClient[athlete.id];

  return {
    source,
    itemId,
    kind,
    label: base.label,
    title: base.title(athlete),
    detail: base.detail(athlete),
    signal: base.signal(athlete),
    happenedAt: athlete.lastActivity,
    returnHref: "/trainer/dashboard#attention-heading",
    returnLabel: "Вернуться к очереди",
    nextClientId: next?.clientId,
    nextAttentionKind: next?.kind,
    ...(entryKind === "map" ? { label: "Из карты команды" } : null),
  };
}

function getPrimaryAction(athlete: AthleteProfile, kind?: ProfileAttentionKind) {
  if (kind === "review") return { kind: "review" as const, label: "Разобрать тренировку" };
  if (kind === "assignment") return { kind: "assign" as const, label: "Назначить тренировку" };
  if (kind === "discomfort" || kind === "missed_workout") return { kind: "message" as const, label: "Написать клиенту" };

  if (athlete.workoutHistory.some((workout) => workout.status.toLowerCase().includes("ждёт"))) {
    return { kind: "review" as const, label: "Разобрать тренировку" };
  }
  if (athlete.upcomingWorkouts.length === 0 && athlete.membership.status !== "paused") {
    return { kind: "assign" as const, label: "Назначить тренировку" };
  }
  if (athlete.membership.status === "paused") return { kind: "message" as const, label: "Написать клиенту" };
  if (athlete.openIssues.length > 0) return { kind: "message" as const, label: "Написать клиенту" };
  return { kind: "open_plan" as const, label: "Открыть текущий план" };
}

const attentionContextByKind: Record<
  ProfileAttentionKind,
  {
    label: string;
    title: (athlete: AthleteProfile) => string;
    detail: (athlete: AthleteProfile) => string;
    signal: (athlete: AthleteProfile) => string;
  }
> = {
  discomfort: {
    label: "Сигнал о самочувствии",
    title: () => "Нужна безопасная корректировка",
    detail: (athlete) => `Последнее событие получено ${athlete.lastActivity}.`,
    signal: (athlete) => athlete.openIssues[0] ?? "Нужно уточнить самочувствие перед следующей тренировкой.",
  },
  review: {
    label: "Ожидает разбора",
    title: (athlete) => `${athlete.lastWorkout} завершена`,
    detail: (athlete) => `Тренировка завершена ${athlete.lastActivity}.`,
    signal: (athlete) => athlete.openIssues[0] ?? athlete.workoutHistory[0]?.meta ?? "Нужно проверить фактическое выполнение.",
  },
  assignment: {
    label: "Нужен следующий шаг",
    title: () => "Следующая тренировка не назначена",
    detail: (athlete) => `Последняя активность была ${athlete.lastActivity}.`,
    signal: (athlete) => athlete.openIssues[0] ?? "Календарь тренировок дальше пуст.",
  },
  missed_workout: {
    label: "Нет активности",
    title: () => "Тренировка не начата",
    detail: (athlete) => `Последняя активность была ${athlete.lastActivity}.`,
    signal: (athlete) => athlete.openIssues[0] ?? "Нужен ручной контакт тренера.",
  },
};

const nextQueueClient: Record<string, { clientId: string; kind: ProfileAttentionKind } | undefined> = {
  "olga-sokolova": { clientId: "ksenia-belyaeva", kind: "missed_workout" },
  "ksenia-belyaeva": { clientId: "egor-nikitin", kind: "assignment" },
  "egor-nikitin": { clientId: "artem-smirnov", kind: "review" },
  "artem-smirnov": undefined,
};
