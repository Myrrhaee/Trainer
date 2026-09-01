import type {
  AthleteTrainingAction,
  AthleteTrainingCurrentReadModel,
  AthleteTrainingCurrentSnapshot,
  AthleteTrainingFocus,
  AthleteTrainingPermissions,
  AthleteTrainingScope,
} from "./athlete-training-types";

export class AthleteTrainingProjector {
  permissions(scope: AthleteTrainingScope): AthleteTrainingPermissions {
    const available = scope.relationStatus === "active" && scope.athleteStatus === "active";
    return {
      canReadTraining: available,
      canAssign: available,
      canOpenSession: available,
      canReview: available,
      canSendFeedback: available,
      canResolveAttention: available,
      canOpenAssignment: available,
      canEditSessionFacts: false,
    };
  }

  current(
    scope: AthleteTrainingScope,
    snapshot: AthleteTrainingCurrentSnapshot,
    permissions = this.permissions(scope),
  ): AthleteTrainingCurrentReadModel {
    const pendingReviews = [...snapshot.pendingReviews].sort(comparePendingReviews);
    const activeExecutions = [...snapshot.activeExecutions].sort(compareActiveExecutions);
    const primaryReview = pendingReviews[0] ?? null;
    const primaryExecution = activeExecutions[0] ?? null;
    const focus = this.focus(scope, primaryReview, primaryExecution, snapshot, permissions);

    return {
      focus,
      pendingReviews: {
        primary: primaryReview,
        items: pendingReviews,
        totalCount: pendingReviews.length,
      },
      activeExecution: {
        primary: primaryExecution,
        items: activeExecutions,
        totalCount: activeExecutions.length,
        conflict: activeExecutions.length > 1 ? "multiple_active_sessions" : null,
      },
      nextAssignment: {
        primary: snapshot.nextAssignment,
        totalCount: snapshot.upcomingAssignmentCount,
      },
      latestFeedback: snapshot.latestFeedback,
      availableActions: actions(focus, permissions, scope.athleteUserId),
    };
  }

  private focus(
    scope: AthleteTrainingScope,
    review: AthleteTrainingCurrentSnapshot["pendingReviews"][number] | null,
    execution: AthleteTrainingCurrentSnapshot["activeExecutions"][number] | null,
    snapshot: AthleteTrainingCurrentSnapshot,
    permissions: AthleteTrainingPermissions,
  ): AthleteTrainingFocus {
    if (!permissions.canReadTraining) return { kind: "relation_unavailable" };
    if (review?.sourceAvailability === "unavailable") {
      return { kind: "source_unavailable", attentionItemId: review.attentionItemId };
    }
    if (review?.sourceAvailability === "ready" && review.sessionId) {
      return {
        kind: "review_required",
        attentionItemId: review.attentionItemId,
        sessionId: review.sessionId,
        reason: review.priorityReasons.includes("discomfort")
          ? "discomfort"
          : review.priorityReasons.includes("partial_completion")
            ? "partial_completion"
            : "standard",
      };
    }
    if (execution) {
      return {
        kind: "session_in_progress",
        assignmentId: execution.assignmentId,
        sessionId: execution.sessionId,
      };
    }
    if (snapshot.nextAssignment) {
      return { kind: "assignment_scheduled", assignmentId: snapshot.nextAssignment.assignmentId };
    }
    if (scope.relationStatus === "active") return { kind: "no_next_assignment" };
    return { kind: "no_current_work" };
  }
}

function actions(
  focus: AthleteTrainingFocus,
  permissions: AthleteTrainingPermissions,
  athleteUserId: string,
): AthleteTrainingAction[] {
  if (focus.kind === "review_required" && permissions.canReview) {
    return [{
      kind: "review",
      attentionItemId: focus.attentionItemId,
      sessionId: focus.sessionId,
    }];
  }
  if (focus.kind === "no_next_assignment" && permissions.canAssign) {
    return [{ kind: "assign", athleteUserId }];
  }
  if (focus.kind === "session_in_progress" && permissions.canOpenSession) {
    return [{
      kind: "open_session",
      assignmentId: focus.assignmentId,
      sessionId: focus.sessionId,
    }];
  }
  if (focus.kind === "assignment_scheduled" && permissions.canOpenAssignment) {
    return [{ kind: "open_assignment", assignmentId: focus.assignmentId }];
  }
  return [];
}

function comparePendingReviews(
  left: AthleteTrainingCurrentSnapshot["pendingReviews"][number],
  right: AthleteTrainingCurrentSnapshot["pendingReviews"][number],
) {
  const discomfort = Number(right.priorityReasons.includes("discomfort"))
    - Number(left.priorityReasons.includes("discomfort"));
  if (discomfort) return discomfort;
  const completed = timestamp(left.completedAt, Number.POSITIVE_INFINITY)
    - timestamp(right.completedAt, Number.POSITIVE_INFINITY);
  return completed || left.attentionItemId.localeCompare(right.attentionItemId);
}

function compareActiveExecutions(
  left: AthleteTrainingCurrentSnapshot["activeExecutions"][number],
  right: AthleteTrainingCurrentSnapshot["activeExecutions"][number],
) {
  return timestamp(right.startedAt, 0) - timestamp(left.startedAt, 0)
    || right.sessionId.localeCompare(left.sessionId);
}

function timestamp(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}
