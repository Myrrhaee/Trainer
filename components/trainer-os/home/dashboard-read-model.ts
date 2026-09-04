import type { TeamClient, TeamSummary } from "./types";

export type TrainerDashboardDemoMode = "team" | "calm" | "empty" | "large";

export type TrainerAttentionKind = "discomfort" | "review" | "assignment" | "missed_workout";

export type TrainerAttentionQueueItem = {
  canOpenProfile?: boolean;
  id: string;
  clientId: string;
  client: TeamClient;
  kind: TrainerAttentionKind;
  eventLabel: string;
  happenedAt: string;
  reason: string;
  signal: string;
  relatedSignals: string[];
  primaryAction: "review" | "assign" | "open_profile";
  reviewHref?: string;
  visualPrototype?: boolean;
  ageHours: number;
};

export type TrainerDashboardSummary = TeamSummary & {
  active: number;
  calm: number;
  attention: number;
};

export function buildTrainerAttentionQueue(clients: TeamClient[]): TrainerAttentionQueueItem[] {
  const items = clients.flatMap((client) => {
    if (client.state === "needs_adjustment") {
      return [
        createItem(client, {
          kind: "discomfort",
          eventLabel: "Сигнал о дискомфорте",
          reason: client.issue ?? "Нужно проверить самочувствие",
          signal: "Плечо после тяговой тренировки",
          relatedSignals: ["Дискомфорт после нагрузки", "Следующий тренировочный день требует решения"],
          primaryAction: "open_profile",
          ageHours: 8,
        }),
      ];
    }

    if (client.state === "waiting_review") {
      return [
        createItem(client, {
          kind: "review",
          eventLabel: "Тренировка завершена",
          reason: client.issue ?? "Тренировка ждёт разбора",
          signal: "Нагрузка 9/10, жим лёжа −2 повтора от плана",
          relatedSignals: ["Высокая субъективная нагрузка", "Отклонение от плана в жиме"],
          primaryAction: "review",
          reviewHref: "/trainer/review/artem-smirnov-2026-06-10",
          ageHours: 2,
        }),
      ];
    }

    if (client.state === "no_next_workout") {
      return [
        createItem(client, {
          kind: "assignment",
          eventLabel: "Следующий шаг не назначен",
          reason: client.issue ?? "Нужна следующая тренировка",
          signal: "Последняя тренировка завершена, календарь дальше пуст",
          relatedSignals: ["Нет следующей тренировки"],
          primaryAction: "assign",
          ageHours: 24,
        }),
      ];
    }

    if (client.id === "ksenia-belyaeva" && client.issue) {
      return [
        createItem(client, {
          kind: "missed_workout",
          eventLabel: "Пропуск тренировки",
          reason: "Тренировка не начата",
          signal: "Нет активности 9 дней",
          relatedSignals: ["Запланированная тренировка пропущена", "Нужен ручной контакт тренера"],
          primaryAction: "open_profile",
          visualPrototype: true,
          ageHours: 216,
        }),
      ];
    }

    return [];
  });

  return items.sort((a, b) => {
    if (a.kind === "discomfort" && b.kind !== "discomfort") return -1;
    if (b.kind === "discomfort" && a.kind !== "discomfort") return 1;
    return b.ageHours - a.ageHours;
  });
}

export function buildTrainerDashboardSummary(
  summary: TeamSummary,
  attentionItems: TrainerAttentionQueueItem[]
): TrainerDashboardSummary {
  const active = summary.total - summary.inactive;

  return {
    ...summary,
    active,
    calm: summary.onTrack,
    attention: attentionItems.length,
  };
}

export function getDashboardClientsForMode(
  clients: TeamClient[],
  mode: TrainerDashboardDemoMode
): TeamClient[] {
  if (mode === "empty") return [];
  if (mode === "calm") {
    return clients.map((client) => ({
      ...client,
      state: client.state === "inactive" ? "inactive" : "on_track",
      stateLabel: client.state === "inactive" ? "Пауза" : "По плану",
      issue: undefined,
      context: undefined,
      primaryAction: undefined,
    }));
  }
  if (mode !== "large") return clients;

  const extraClients: TeamClient[] = Array.from({ length: Math.max(0, 30 - clients.length) }, (_, index) => {
    const scenario = index === 0 ? "no_next_workout" : index === 1 ? "waiting_review" : index === 2 ? "needs_adjustment" : "on_track";
    const actionState = scenario !== "on_track";

    return {
      id: `demo-athlete-${index + 1}`,
      name: `Спортсмен ${index + 1} с длинным именем`,
      initials: `С${index + 1}`,
      goal: index % 2 === 0 ? "Сила и техника" : "Стабильный тренировочный ритм",
      state: scenario,
      stateLabel:
        scenario === "no_next_workout"
          ? "Нет следующей"
          : scenario === "waiting_review"
            ? "Ждёт разбора"
            : scenario === "needs_adjustment"
              ? "Нужна корректировка"
              : "По плану",
      progressTrend: actionState ? "flat" : index % 2 === 0 ? "up" : "flat",
      isOnline: false,
      priority: actionState ? "medium" : "low",
      lastActivity: index % 2 === 0 ? "3 дня назад" : "2 дня назад",
      nextWorkout: scenario === "no_next_workout" ? undefined : "Тренировочный день",
      issue:
        scenario === "no_next_workout"
          ? "Нет следующей тренировки"
          : scenario === "waiting_review"
            ? "Тренировка ждёт разбора"
            : scenario === "needs_adjustment"
              ? "Нужна корректировка"
              : undefined,
      context: actionState ? "Дополнительный сигнал для проверки поведения большой команды." : undefined,
      primaryAction:
        scenario === "no_next_workout"
          ? "assign"
          : scenario === "waiting_review"
            ? "review"
            : scenario === "needs_adjustment"
              ? "open_client"
              : undefined,
    };
  });

  return [...clients, ...extraClients];
}

function createItem(
  client: TeamClient,
  fields: Omit<TrainerAttentionQueueItem, "id" | "clientId" | "client" | "happenedAt">
): TrainerAttentionQueueItem {
  return {
    id: `attention-${client.id}-${fields.kind}`,
    clientId: client.id,
    client,
    happenedAt: client.lastActivity,
    ...fields,
  };
}
