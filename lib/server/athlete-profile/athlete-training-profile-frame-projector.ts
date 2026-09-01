import type {
  AthleteProfileAction,
  AthleteProfileCurrentState,
  AthleteProfileFrameReadModel,
} from "./athlete-profile-types";
import type {
  AthleteTrainingCurrentReadModel,
  AthleteTrainingPermissions,
} from "./athlete-training-types";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

export class AthleteTrainingProfileFrameProjector {
  project(
    frame: AthleteProfileFrameReadModel,
    current: AthleteTrainingCurrentReadModel,
    permissions: AthleteTrainingPermissions,
  ): AthleteProfileFrameReadModel {
    const currentState = stateFromTraining(current, permissions);
    return {
      ...frame,
      currentState,
      availableActions: {
        primary: primaryAction(frame.identity.athleteUserId, current, permissions),
      },
      permissions: {
        ...frame.permissions,
        canAssign: permissions.canAssign,
        canReview: permissions.canReview && current.pendingReviews.items.some(
          (item) => item.sourceAvailability === "ready" && Boolean(item.sessionId),
        ),
      },
    };
  }
}

function stateFromTraining(
  current: AthleteTrainingCurrentReadModel,
  permissions: AthleteTrainingPermissions,
): AthleteProfileCurrentState {
  const review = current.pendingReviews.primary;
  const execution = current.activeExecution.primary;
  const assignment = current.nextAssignment.primary;
  const base = {
    assignmentId: review?.assignmentId ?? execution?.assignmentId ?? assignment?.assignmentId ?? null,
    sessionId: review?.sessionId ?? execution?.sessionId ?? null,
    attentionItemId: review?.attentionItemId ?? null,
  };

  if (!permissions.canReadTraining) {
    return {
      ...base,
      kind: "relation_unavailable",
      tone: "muted",
      label: "Связь приостановлена",
      detail: "Тренировочные данные недоступны, пока связь не активна.",
    };
  }
  if (review?.sourceAvailability === "unavailable") {
    return {
      ...base,
      kind: "source_unavailable",
      tone: "muted",
      label: "Источник разбора недоступен",
      detail: "Задача сохранена, но связанная тренировка больше недоступна.",
    };
  }
  if (review?.sessionId) {
    const discomfort = review.priorityReasons.includes("discomfort");
    return {
      ...base,
      kind: discomfort ? "discomfort" : "review_required",
      tone: discomfort ? "warning" : "attention",
      label: discomfort ? "Спортсмен отметил дискомфорт" : "Тренировка ждёт разбора",
      detail: review.title,
    };
  }
  if (execution) {
    return {
      ...base,
      kind: "workout_active",
      tone: "active",
      label: current.activeExecution.conflict
        ? "Несколько активных тренировок"
        : "Тренировка выполняется",
      detail: execution.title,
    };
  }
  if (assignment) {
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
    kind: "no_next_assignment",
    tone: "attention",
    label: "Нет следующей тренировки",
    detail: "Следующий рабочий шаг ещё не назначен.",
  };
}

function primaryAction(
  athleteUserId: string,
  current: AthleteTrainingCurrentReadModel,
  permissions: AthleteTrainingPermissions,
): AthleteProfileAction | null {
  const review = current.pendingReviews.primary;
  const profileHref = `/trainer/clients/${athleteUserId}?tab=training`;

  if (review) {
    if (review.sourceAvailability !== "ready" || !review.sessionId || !permissions.canReview) {
      return null;
    }
    const context = createTrainerWorkflowContext({
      origin: "profile",
      athleteUserId,
      sourceAttentionItemId: review.attentionItemId,
      sourceSessionId: review.sessionId,
      returnTo: profileHref,
      returnAnchor: "latest-feedback",
    });
    return {
      kind: "review",
      label: "Разобрать тренировку",
      href: trainerWorkflowHref(`/trainer/review/${review.sessionId}`, context),
    };
  }

  if (!current.nextAssignment.primary && permissions.canAssign) {
    const context = createTrainerWorkflowContext({
      origin: "profile",
      athleteUserId,
      returnTo: profileHref,
      returnAnchor: "next-assignment",
    });
    return {
      kind: "assign",
      label: "Назначить тренировку",
      href: trainerWorkflowHref(`/trainer/clients/${athleteUserId}?tab=training&assign=1`, context),
    };
  }
  return null;
}
