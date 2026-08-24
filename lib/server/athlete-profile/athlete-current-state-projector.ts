import type {
  AthleteProfileCurrentState,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";

export class AthleteCurrentStateProjector {
  project(snapshot: AthleteProfileSnapshot): AthleteProfileCurrentState {
    const assignment = snapshot.currentAssignment;
    const attention = snapshot.openAttention;
    const base = {
      assignmentId: assignment?.id ?? null,
      sessionId: attention?.sessionId ?? assignment?.sessionId ?? null,
      attentionItemId: attention?.id ?? null,
    };

    if (snapshot.relationStatus !== "active" || snapshot.athleteStatus !== "active") {
      return {
        ...base,
        kind: "relation_unavailable",
        tone: "muted",
        label: "Связь приостановлена",
        detail: "Рабочие действия недоступны, пока связь со спортсменом не активна.",
      };
    }

    if (attention?.priorityReasons.includes("discomfort")) {
      return {
        ...base,
        kind: "discomfort",
        tone: "warning",
        label: "Спортсмен отметил дискомфорт",
        detail: `${attention.title} требует внимательного разбора.`,
      };
    }

    if (attention) {
      return {
        ...base,
        kind: "review_required",
        tone: "attention",
        label: "Тренировка ждёт разбора",
        detail: attention.title,
      };
    }

    if (!assignment) {
      return {
        ...base,
        kind: "no_next_assignment",
        tone: "attention",
        label: "Нет следующей тренировки",
        detail: "Следующий рабочий шаг ещё не назначен.",
      };
    }

    if (assignment.status === "in_progress") {
      return {
        ...base,
        kind: "workout_active",
        tone: "active",
        label: "Тренировка выполняется",
        detail: assignment.title,
      };
    }

    if (assignment.status === "scheduled") {
      return {
        ...base,
        kind: "assignment_ready",
        tone: "calm",
        label: "Тренировка назначена",
        detail: assignment.title,
      };
    }

    return {
      ...base,
      kind: "calm",
      tone: "calm",
      label: "Работа идёт по плану",
      detail: "Срочных решений не требуется.",
    };
  }
}
