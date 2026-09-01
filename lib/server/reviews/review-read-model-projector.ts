import type {
  ReviewCapabilities,
  ReviewDeviation,
  ReviewExerciseReadModel,
  ReviewSetReadModel,
} from "./review-types";

function actualValues(set: ReviewSetReadModel) {
  return {
    repetitionsMin: set.actual.repetitions,
    repetitionsMax: set.actual.repetitions,
    durationSeconds: set.actual.durationSeconds,
    weightKg: set.actual.weightKg,
  };
}

function plannedValues(set: ReviewSetReadModel) {
  return {
    repetitionsMin: set.prescribed.repetitionsMin,
    repetitionsMax: set.prescribed.repetitionsMax,
    durationSeconds: set.prescribed.durationSeconds,
    weightKg: set.prescribed.weightKg,
  };
}

function deviation(
  type: ReviewDeviation["type"],
  exercise: ReviewExerciseReadModel,
  set: ReviewSetReadModel | null,
  suffix: string = type,
): ReviewDeviation {
  const comment = set?.sourceComments[0] ?? exercise.sourceComments[0] ?? null;
  return {
    id: `${type}:${set?.identity.setLogId ?? set?.identity.sourceAssignmentSetId ?? exercise.identity.exerciseLogId ?? exercise.identity.assignmentExerciseId}:${suffix}`,
    type,
    exerciseLogId: exercise.identity.exerciseLogId,
    setLogId: set?.identity.setLogId ?? null,
    assignmentExerciseId: exercise.identity.assignmentExerciseId,
    sourceAssignmentSetId: set?.identity.sourceAssignmentSetId ?? null,
    planned: set ? plannedValues(set) : null,
    actual: set ? actualValues(set) : null,
    commentReference: comment ? { source: comment.source, sourceId: comment.sourceId, text: comment.text } : null,
  };
}

export function projectReviewDeviations(exercise: ReviewExerciseReadModel): ReviewDeviation[] {
  const result: ReviewDeviation[] = [];
  if (exercise.actual.status === "missing") result.push(deviation("log_missing", exercise, null));
  if (exercise.actual.status === "skipped") result.push(deviation("exercise_skipped", exercise, null));
  if (exercise.actual.status === "incomplete") result.push(deviation("result_incomplete", exercise, null));
  if (exercise.sourceComments.length) result.push(deviation("athlete_comment_present", exercise, null, "exercise"));

  for (const set of exercise.sets) {
    if (set.actual.status === "missing") result.push(deviation("log_missing", exercise, set));
    if (set.actual.status === "skipped") result.push(deviation("set_skipped", exercise, set));
    if (set.actual.status === "incomplete") result.push(deviation("result_incomplete", exercise, set));
    if (!set.identity.sourceAssignmentSetId) result.push(deviation("source_unavailable", exercise, set));

    const repetitions = set.actual.repetitions;
    const min = set.prescribed.repetitionsMin;
    const max = set.prescribed.repetitionsMax;
    if (repetitions !== null && min !== null && max !== null && (repetitions < min || repetitions > max)) {
      result.push(deviation("planned_repetitions_not_met", exercise, set));
    }
    if (set.actual.weightKg !== null && set.prescribed.weightKg !== null
      && set.actual.weightKg !== set.prescribed.weightKg) {
      result.push(deviation("load_changed", exercise, set));
    }
    if (set.actual.durationSeconds !== null && set.prescribed.durationSeconds !== null
      && set.actual.durationSeconds !== set.prescribed.durationSeconds) {
      result.push(deviation("duration_changed", exercise, set));
    }
    if (set.sourceComments.length) result.push(deviation("athlete_comment_present", exercise, set, "set"));
  }
  return result;
}

export function reviewCapabilities(input: {
  attentionStatus: "open" | "resolved" | "archived";
  feedbackCount: number;
  sourceIdentityValid: boolean;
}): ReviewCapabilities {
  const readable = input.sourceIdentityValid;
  const open = readable && input.attentionStatus === "open";
  return {
    canRead: readable,
    canSendInitialFeedback: open,
    canSendAcknowledgement: open,
    canSendFollowUp: readable && input.attentionStatus === "resolved" && input.feedbackCount > 0,
    canResolveManually: open,
  };
}
