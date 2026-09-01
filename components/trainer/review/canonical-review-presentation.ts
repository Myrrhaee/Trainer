import type {
  ReviewAvailability,
  ReviewDeviation,
  ReviewExerciseReadModel,
  ReviewReadModel,
  ReviewSetReadModel,
  ReviewSetValues,
} from "@/lib/server/reviews/review-types";

export type CanonicalReviewSummary = {
  exerciseCount: number;
  prescribedSetCount: number;
  completedSetCount: number;
  skippedSetCount: number;
  incompleteSetCount: number;
  missingSetCount: number;
  deviationCount: number;
  commentCount: number;
};

export type CanonicalReviewException = {
  id: string;
  rank: number;
  title: string;
  detail: string;
  exerciseTitle: string;
  setPosition: number | null;
  exerciseId: string;
  sourceAnchorId: string;
  comment: string | null;
  sourceIdentity: string;
};

export function summarizeReview(review: ReviewReadModel): CanonicalReviewSummary {
  const sets = review.exercises.flatMap((exercise) => exercise.sets);
  const deviations = review.exercises.flatMap((exercise) => exercise.deviations)
    .filter((item) => item.type !== "athlete_comment_present");
  const comments = review.exercises.flatMap((exercise) => [
    ...exercise.sourceComments,
    ...exercise.sets.flatMap((set) => set.sourceComments),
  ]);
  return {
    exerciseCount: review.exercises.length,
    prescribedSetCount: sets.filter((set) => set.identity.sourceAssignmentSetId !== null).length,
    completedSetCount: sets.filter((set) => set.actual.status === "completed").length,
    skippedSetCount: sets.filter((set) => set.actual.status === "skipped").length,
    incompleteSetCount: sets.filter((set) => set.actual.status === "incomplete").length,
    missingSetCount: sets.filter((set) => set.actual.status === "missing").length,
    deviationCount: deviations.length,
    commentCount: comments.length,
  };
}

export function collectReviewExceptions(review: ReviewReadModel): CanonicalReviewException[] {
  if (review.dataAvailability.logs.status === "unavailable") return [];
  const planAvailable = review.dataAvailability.assignmentSnapshot.status !== "unavailable";
  return review.exercises.flatMap((exercise) => exercise.deviations.map((deviation) => (
    toReviewException(exercise, deviation, planAvailable)
  ))).sort((left, right) => left.rank - right.rank
    || left.exerciseTitle.localeCompare(right.exerciseTitle, "ru")
    || (left.setPosition ?? 0) - (right.setPosition ?? 0));
}

function toReviewException(
  exercise: ReviewExerciseReadModel,
  deviation: ReviewDeviation,
  planAvailable: boolean,
): CanonicalReviewException {
  const set = deviation.setLogId || deviation.sourceAssignmentSetId
    ? exercise.sets.find((candidate) => candidate.identity.setLogId === deviation.setLogId
      || candidate.identity.sourceAssignmentSetId === deviation.sourceAssignmentSetId) ?? null
    : null;
  const sourceAnchorId = set ? reviewSetAnchorId(exercise, set) : reviewExerciseAnchorId(exercise);
  const sourceIdentity = set?.identity.setLogId
    ?? set?.identity.sourceAssignmentSetId
    ?? exercise.identity.exerciseLogId
    ?? exercise.identity.assignmentExerciseId;
  const copy = deviationCopy(deviation, planAvailable);
  return {
    id: deviation.id,
    rank: exceptionRank(deviation.type),
    title: copy.title,
    detail: copy.detail,
    exerciseTitle: exercise.identity.title,
    setPosition: set?.identity.position ?? null,
    exerciseId: exercise.identity.assignmentExerciseId,
    sourceAnchorId,
    comment: deviation.commentReference?.text ?? null,
    sourceIdentity,
  };
}

function exceptionRank(type: ReviewDeviation["type"]) {
  if (type === "exercise_skipped" || type === "set_skipped") return 20;
  if (type === "result_incomplete") return 30;
  if (type === "athlete_comment_present") return 40;
  if (type === "planned_repetitions_not_met" || type === "repetitions_changed"
    || type === "load_changed" || type === "duration_changed") return 50;
  return 60;
}

function deviationCopy(deviation: ReviewDeviation, planAvailable: boolean) {
  if (deviation.type === "exercise_skipped") {
    return { title: "Упражнение пропущено", detail: "Выполнение упражнения отмечено как пропущенное." };
  }
  if (deviation.type === "set_skipped") {
    return { title: "Подход пропущен", detail: "Выполнение подхода отмечено как пропущенное." };
  }
  if (deviation.type === "result_incomplete") {
    return { title: "Выполнено частично", detail: "Записана только часть результата." };
  }
  if (deviation.type === "athlete_comment_present") {
    return { title: "Есть комментарий спортсмена", detail: deviation.commentReference?.text ?? "Комментарий сохранён у результата." };
  }
  if (deviation.type === "log_missing") {
    return { title: "Результат не записан", detail: "Данные выполнения отсутствуют." };
  }
  if (deviation.type === "source_unavailable") {
    return { title: "Источник подхода недоступен", detail: "Результат сохранён без устойчивой связи с назначенным подходом." };
  }
  if (deviation.type === "planned_repetitions_not_met" || deviation.type === "repetitions_changed") {
    return {
      title: "Повторы отличаются от плана",
      detail: planAvailable
        ? repetitionsDifference(deviation.planned, deviation.actual)
        : `Записано повторов: ${deviation.actual?.repetitionsMin ?? "не указано"}. Данные назначения недоступны.`,
    };
  }
  if (deviation.type === "load_changed") {
    return {
      title: "Нагрузка изменена",
      detail: planAvailable
        ? valueDifference(deviation.planned?.weightKg, deviation.actual?.weightKg, "кг", "Нагрузка")
        : `Выполненная нагрузка: ${deviation.actual?.weightKg ?? "не записана"} кг. Данные назначения недоступны.`,
    };
  }
  return {
    title: "Длительность изменена",
    detail: planAvailable
      ? valueDifference(deviation.planned?.durationSeconds, deviation.actual?.durationSeconds, "сек", "Длительность")
      : `Выполненная длительность: ${deviation.actual?.durationSeconds ?? "не записана"} сек. Данные назначения недоступны.`,
  };
}

function repetitionsDifference(planned: ReviewSetValues | null, actual: ReviewSetValues | null) {
  const plannedValue = repetitionsLabel(planned?.repetitionsMin ?? null, planned?.repetitionsMax ?? null);
  const actualValue = actual?.repetitionsMin === null || actual?.repetitionsMin === undefined
    ? "не записано"
    : `${actual.repetitionsMin} повторов`;
  return `Выполнено ${actualValue} вместо запланированных ${plannedValue}.`;
}

function valueDifference(planned: number | null | undefined, actual: number | null | undefined, unit: string, label: string) {
  const plannedLabel = planned === null || planned === undefined ? "не указана" : `${formatNumber(planned)} ${unit}`;
  const actualLabel = actual === null || actual === undefined ? "не записана" : `${formatNumber(actual)} ${unit}`;
  return `${label}: ${plannedLabel} по плану, ${actualLabel} выполнено.`;
}

export function plannedSetValues(set: ReviewSetReadModel) {
  const values: string[] = [];
  if (set.prescribed.repetitionsMin !== null) {
    values.push(repetitionsLabel(set.prescribed.repetitionsMin, set.prescribed.repetitionsMax));
  }
  if (set.prescribed.durationSeconds !== null) values.push(`${set.prescribed.durationSeconds} сек`);
  if (set.prescribed.weightKg !== null) values.push(`${formatNumber(set.prescribed.weightKg)} кг`);
  if (set.prescribed.restSeconds !== null) values.push(`отдых ${set.prescribed.restSeconds} сек`);
  return values;
}

export function actualSetValues(set: ReviewSetReadModel) {
  if (set.actual.status === "skipped") return ["Пропущено"];
  if (set.actual.status === "missing") return ["Результат не записан"];
  const values: string[] = [];
  if (set.actual.repetitions !== null) values.push(`${set.actual.repetitions} повторов`);
  if (set.actual.durationSeconds !== null) values.push(`${set.actual.durationSeconds} сек`);
  if (set.actual.weightKg !== null) values.push(`${formatNumber(set.actual.weightKg)} кг`);
  if (set.actual.rpe !== null) values.push(`RPE ${formatNumber(set.actual.rpe)}`);
  if (!values.length) values.push(set.actual.status === "incomplete" ? "Часть результата не записана" : "Значения не записаны");
  return values;
}

export function reviewExerciseAnchorId(exercise: ReviewExerciseReadModel) {
  return `review-exercise-${domSafe(exercise.identity.assignmentExerciseId)}`;
}

export function reviewSetAnchorId(exercise: ReviewExerciseReadModel, set: ReviewSetReadModel) {
  return `review-set-${domSafe(exercise.identity.assignmentExerciseId)}-${domSafe(
    set.identity.setLogId ?? set.identity.sourceAssignmentSetId ?? set.identity.setKey,
  )}`;
}

export function hasExerciseExceptions(exercise: ReviewExerciseReadModel) {
  return exercise.deviations.length > 0 || exercise.sourceComments.length > 0
    || exercise.sets.some((set) => set.sourceComments.length > 0);
}

export function availabilityText(
  availability: ReviewAvailability<unknown>,
  subject: string,
  unsupportedText?: string,
) {
  if (availability.status === "ready") return `${subject}: данные доступны`;
  if (availability.status === "known_empty") return `${subject}: подтверждённых записей нет`;
  if (availability.status === "unsupported") return unsupportedText ?? `${subject}: данные для этой тренировки не собирались`;
  if (availability.status === "partial") return `${subject}: часть данных недоступна`;
  return `${subject}: не удалось загрузить данные`;
}

export function originLabel(origin: string) {
  if (origin === "dashboard") return "Из очереди";
  if (origin === "profile") return "Из профиля";
  if (origin === "clients") return "Из списка спортсменов";
  if (origin === "review") return "Из предыдущего действия";
  return "Прямая ссылка";
}

export function attentionReasonLabel(reasons: string[]) {
  if (reasons.includes("discomfort")) return "В источнике внимания отмечен дискомфорт";
  if (reasons.includes("client_comment")) return "Спортсмен оставил комментарий к результату";
  if (reasons.includes("partial_completion")) return "Тренировка завершена частично";
  if (reasons.length) return "Завершённая тренировка требует решения тренера";
  return "Завершённая тренировка ждёт разбора";
}

export function shortId(value: string) {
  return value.slice(-8);
}

function repetitionsLabel(min: number | null, max: number | null) {
  if (min === null) return "не указано";
  if (max !== null && max !== min) return `${min}–${max} повторов`;
  return `${min} повторов`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function domSafe(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
