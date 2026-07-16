import type { TeamClient } from "@/components/trainer-os/home/types";

export type ReviewExerciseState = "completed" | "incomplete" | "skipped" | "modified" | "added";
export type ReviewSignalKind = "discomfort" | "skipped" | "incomplete" | "repetitions" | "weight" | "modified" | "missing-data";
export type ReviewSignalTone = "danger" | "warning" | "info";
export type ReviewAiState = "available" | "unavailable" | "failed" | "no-context";

export type ReviewSetPlan = {
  id: string;
  kind: "warmup" | "working";
  repetitions?: number | { min: number; max: number };
  targetWeightKg?: number;
  targetRpe?: number;
};

export type ReviewSetActual = {
  id: string;
  kind: "warmup" | "working";
  repetitions?: number;
  weightKg?: number;
  rpe?: number;
  completed: boolean;
  comment?: string;
};

export type ReviewExercise = {
  id: string;
  title: string;
  state: ReviewExerciseState;
  planned?: { sets: ReviewSetPlan[]; note?: string };
  actual: { sets: ReviewSetActual[]; comment?: string };
  modificationNote?: string;
  previousResult?: string;
};

export type ReviewSignal = {
  id: string;
  kind: ReviewSignalKind;
  tone: ReviewSignalTone;
  title: string;
  detail: string;
  sourceLabel: string;
  exerciseId?: string;
  originalText?: string;
  area?: string;
  severity?: "low" | "medium" | "high";
};

export type TrainerFeedbackRecord = {
  id: string;
  kind: "detailed" | "acknowledgement" | "follow-up";
  body: string;
  author: string;
  sentAt: string;
};

export type WorkoutReviewDetails = {
  session: {
    id: string;
    status: "completed" | "partial";
    completedAt: string;
    completedLabel: string;
    durationMin?: number;
  };
  athlete: {
    id: string;
    displayName: string;
    initials: string;
    goal: string;
    profileHref: string;
  };
  assignment?: {
    id: string;
    title: string;
    scheduledFor?: string;
  };
  sessionTitle: string;
  summary: {
    completedExercises: number;
    totalExercises: number;
    completedSets: number;
    totalSets: number;
    hasSkippedWork: boolean;
    hasDiscomfort: boolean;
  };
  signals: ReviewSignal[];
  clientComment?: string;
  exercises: ReviewExercise[];
  previousContext?: {
    label: string;
    detail: string;
  };
  feedback: {
    aiState: ReviewAiState;
    aiDraft?: string;
    aiProvenance?: string;
    existing: TrainerFeedbackRecord[];
    demoSendBehavior?: "success" | "fail-once";
  };
  attentionContext?: {
    id: string;
    queue: string;
    position: number;
    total: number;
    reason: string;
    nextSessionId?: string;
  };
};

type ReviewSeed = Omit<WorkoutReviewDetails, "summary">;

function setPlan(id: string, repetitions: number | { min: number; max: number }, targetWeightKg?: number, kind: ReviewSetPlan["kind"] = "working"): ReviewSetPlan {
  return { id, kind, repetitions, targetWeightKg };
}

function setActual(id: string, repetitions: number | undefined, weightKg: number | undefined, options: Partial<ReviewSetActual> = {}): ReviewSetActual {
  return { id, kind: "working", repetitions, weightKg, completed: true, ...options };
}

function buildReview(seed: ReviewSeed): WorkoutReviewDetails {
  const plannedSets = seed.exercises.reduce((total, exercise) => total + (exercise.planned?.sets.length ?? 0), 0);
  const actualSets = seed.exercises.reduce(
    (total, exercise) => total + exercise.actual.sets.filter((set) => set.completed).length,
    0
  );
  const completedExercises = seed.exercises.filter((exercise) => exercise.state === "completed" || exercise.state === "modified" || exercise.state === "added").length;

  return {
    ...seed,
    summary: {
      completedExercises,
      totalExercises: seed.exercises.length,
      completedSets: actualSets,
      totalSets: plannedSets || actualSets,
      hasSkippedWork: seed.exercises.some((exercise) => exercise.state === "skipped" || exercise.state === "incomplete"),
      hasDiscomfort: seed.signals.some((signal) => signal.kind === "discomfort"),
    },
  };
}

const demoReviewSessions = [
  buildReview({
    session: { id: "maria-volkova-2026-06-09", status: "completed", completedAt: "2026-06-09T18:58:00+03:00", completedLabel: "9 июня, 18:58", durationMin: 58 },
    athlete: { id: "maria-volkova", displayName: "Мария Волкова", initials: "МВ", goal: "Снижение веса", profileHref: "/trainer/clients/maria-volkova" },
    assignment: { id: "assignment-maria-lower-01", title: "Низ тела · базовый день", scheduledFor: "9 июня, 18:00" },
    sessionTitle: "Низ тела · базовый день",
    signals: [],
    exercises: [
      {
        id: "maria-squat",
        title: "Приседания со штангой",
        state: "completed",
        planned: { sets: [setPlan("1", 10, 45, "warmup"), setPlan("2", 8, 55), setPlan("3", 8, 55)] },
        actual: { sets: [setActual("1", 10, 45, { kind: "warmup" }), setActual("2", 8, 55), setActual("3", 8, 55)] },
        previousResult: "52.5 кг × 8",
      },
      {
        id: "maria-rdl",
        title: "Румынская тяга",
        state: "completed",
        planned: { sets: [setPlan("1", 10, 40), setPlan("2", 10, 40), setPlan("3", 10, 40)] },
        actual: { sets: [setActual("1", 10, 40), setActual("2", 10, 40), setActual("3", 10, 40)] },
        previousResult: "40 кг × 10",
      },
      {
        id: "maria-lunge",
        title: "Выпады назад",
        state: "completed",
        planned: { sets: [setPlan("1", 12, 10), setPlan("2", 12, 10)] },
        actual: { sets: [setActual("1", 12, 10), setActual("2", 12, 10)] },
      },
    ],
    previousContext: { label: "Предыдущий похожий день", detail: "Выполнен полностью, рабочий RPE 7/10." },
    feedback: {
      aiState: "available",
      aiDraft: "Тренировка выполнена по плану, рабочие веса и повторения сохранены. Хорошая работа, продолжаем текущую прогрессию.",
      aiProvenance: "На основе результатов тренировки; комментарий клиента не оставлен",
      existing: [],
    },
    attentionContext: { id: "attention-maria-review", queue: "dashboard-review", position: 4, total: 4, reason: "Завершённая тренировка ждёт разбора" },
  }),
  buildReview({
    session: { id: "artem-smirnov-2026-06-10", status: "completed", completedAt: "2026-06-10T20:12:00+03:00", completedLabel: "10 июня, 20:12", durationMin: 72 },
    athlete: { id: "artem-smirnov", displayName: "Артём Смирнов", initials: "АС", goal: "Набор массы", profileHref: "/trainer/clients/artem-smirnov" },
    assignment: { id: "assignment-artem-push-pull-08", title: "Грудь + спина", scheduledFor: "10 июня, 19:00" },
    sessionTitle: "Грудь + спина",
    signals: [
      { id: "artem-bench-reps", kind: "repetitions", tone: "warning", title: "Жим ниже плана", detail: "В главном рабочем подходе выполнено 6 повторений вместо 8.", sourceLabel: "Жим штанги лёжа · подход 3", exerciseId: "artem-bench" },
      { id: "artem-db-weight", kind: "weight", tone: "info", title: "Вес скорректирован", detail: "В жиме гантелей спортсмен использовал 26 кг вместо целевых 28 кг.", sourceLabel: "Жим гантелей лёжа", exerciseId: "artem-db-press" },
    ],
    clientComment: "Последний подход в жиме дался тяжело. Спал около пяти часов, поэтому не стал форсировать повторы.",
    exercises: [
      {
        id: "artem-bench",
        title: "Жим штанги лёжа",
        state: "incomplete",
        planned: { sets: [setPlan("1", 8, 55, "warmup"), setPlan("2", 8, 70), setPlan("3", 8, 80)] },
        actual: { sets: [setActual("1", 8, 55, { kind: "warmup" }), setActual("2", 8, 70), setActual("3", 6, 80, { rpe: 9, comment: "Штанга замедлилась в середине." })], comment: "Последний подход дался тяжело." },
        previousResult: "77.5 кг × 8",
      },
      {
        id: "artem-row",
        title: "Тяга штанги в наклоне",
        state: "completed",
        planned: { sets: [setPlan("1", 10, 60), setPlan("2", 10, 60), setPlan("3", 10, 60)] },
        actual: { sets: [setActual("1", 10, 60), setActual("2", 10, 65), setActual("3", 9, 65)] },
        previousResult: "60 кг × 10",
      },
      {
        id: "artem-db-press",
        title: "Жим гантелей лёжа",
        state: "modified",
        planned: { sets: [setPlan("1", 8, 28), setPlan("2", 8, 28), setPlan("3", 8, 28)] },
        actual: { sets: [setActual("1", 10, 24), setActual("2", 8, 26), setActual("3", 7, 26)] },
        modificationNote: "Самостоятельно снизил вес из-за общей усталости.",
        previousResult: "28 кг × 8",
      },
    ],
    previousContext: { label: "Предыдущий жим", detail: "77.5 кг × 8 при RPE 8; комментариев о самочувствии не было." },
    feedback: {
      aiState: "available",
      aiDraft: "Вижу, что из-за недосыпа ты не стал форсировать жим и сохранил контроль нагрузки. Это разумно. Следующий тяжёлый день скорректируем после восстановления.",
      aiProvenance: "На основе результатов тренировки и комментария клиента",
      existing: [],
      demoSendBehavior: "fail-once",
    },
    attentionContext: { id: "attention-artem-review", queue: "dashboard-review", position: 1, total: 4, reason: "Есть отклонения от плана", nextSessionId: "liza-gromova-2026-06-18" },
  }),
  buildReview({
    session: { id: "liza-gromova-2026-06-18", status: "completed", completedAt: "2026-06-18T19:44:00+03:00", completedLabel: "18 июня, 19:44", durationMin: 51 },
    athlete: { id: "liza-gromova", displayName: "Лиза Громова", initials: "ЛГ", goal: "Сила и мобильность", profileHref: "/trainer/clients/liza-gromova" },
    sessionTitle: "Верх тела · адаптивный день",
    signals: [
      { id: "liza-shoulder-discomfort", kind: "discomfort", tone: "danger", title: "Спортсмен отметил дискомфорт", detail: "Во время разведений появилось тянущее ощущение в правом плече.", sourceLabel: "Комментарий клиента · разведения в стороны", exerciseId: "liza-lateral-raise", originalText: "На втором подходе стало тянуть правое плечо. Резкой боли не было, упражнение остановила.", area: "Правое плечо", severity: "medium" },
      { id: "liza-skipped", kind: "skipped", tone: "warning", title: "Упражнение остановлено", detail: "Разведения в стороны не были завершены после сигнала о самочувствии.", sourceLabel: "Разведения в стороны", exerciseId: "liza-lateral-raise" },
    ],
    clientComment: "На втором подходе стало тянуть правое плечо. Резкой боли не было, упражнение остановила.",
    exercises: [
      {
        id: "liza-pulldown",
        title: "Тяга верхнего блока",
        state: "completed",
        actual: { sets: [setActual("1", 12, 36), setActual("2", 12, 40), setActual("3", 11, 40)] },
        previousResult: "38 кг × 12",
      },
      {
        id: "liza-lateral-raise",
        title: "Разведения в стороны",
        state: "skipped",
        actual: { sets: [setActual("1", 12, 6), setActual("2", 7, 6, { completed: false, comment: "Остановила подход из-за ощущения в плече." })], comment: "Упражнение остановлено после второго подхода." },
      },
    ],
    previousContext: { label: "Контекст", detail: "Исходное назначение недоступно; сравнение с планом не строится." },
    feedback: { aiState: "unavailable", existing: [] },
    attentionContext: { id: "attention-liza-discomfort", queue: "dashboard-review", position: 2, total: 4, reason: "Комментарий о дискомфорте", nextSessionId: "maxim-orlov-2026-06-18" },
  }),
  buildReview({
    session: { id: "maxim-orlov-2026-06-18", status: "partial", completedAt: "2026-06-18T21:03:00+03:00", completedLabel: "18 июня, 21:03", durationMin: 39 },
    athlete: { id: "maxim-orlov", displayName: "Максим Орлов", initials: "МО", goal: "Общая сила", profileHref: "/trainer/clients/maxim-orlov" },
    assignment: { id: "assignment-maxim-full-body-03", title: "Полное тело B", scheduledFor: "18 июня, 20:00" },
    sessionTitle: "Полное тело B",
    signals: [
      { id: "maxim-skipped-row", kind: "skipped", tone: "warning", title: "Упражнение пропущено", detail: "Горизонтальная тяга отмечена как пропущенная.", sourceLabel: "Горизонтальная тяга", exerciseId: "maxim-row" },
      { id: "maxim-missing-sets", kind: "missing-data", tone: "warning", title: "Не все подходы записаны", detail: "В румынской тяге есть факт упражнения, но нет данных по двум подходам.", sourceLabel: "Румынская тяга", exerciseId: "maxim-rdl" },
    ],
    clientComment: "Пришлось закончить раньше из-за рабочего звонка. Самочувствие обычное.",
    exercises: [
      {
        id: "maxim-squat",
        title: "Фронтальные приседания",
        state: "completed",
        planned: { sets: [setPlan("1", 8, 45), setPlan("2", 8, 45), setPlan("3", 8, 45)] },
        actual: { sets: [setActual("1", 8, 45), setActual("2", 8, 45), setActual("3", 8, 45)] },
      },
      {
        id: "maxim-rdl",
        title: "Румынская тяга",
        state: "incomplete",
        planned: { sets: [setPlan("1", 10, 60), setPlan("2", 10, 60), setPlan("3", 10, 60)] },
        actual: { sets: [setActual("1", 10, 60)] },
      },
      {
        id: "maxim-row",
        title: "Горизонтальная тяга",
        state: "skipped",
        planned: { sets: [setPlan("1", 12, 50), setPlan("2", 12, 50), setPlan("3", 12, 50)] },
        actual: { sets: [] },
      },
    ],
    feedback: { aiState: "no-context", existing: [] },
    attentionContext: { id: "attention-maxim-partial", queue: "dashboard-review", position: 3, total: 4, reason: "Частичное выполнение", nextSessionId: "maria-volkova-2026-06-09" },
  }),
  buildReview({
    session: { id: "irina-kozlova-2026-06-12", status: "completed", completedAt: "2026-06-12T18:20:00+03:00", completedLabel: "12 июня, 18:20", durationMin: 42 },
    athlete: { id: "irina-kozlova", displayName: "Ирина Козлова", initials: "ИК", goal: "Сила и тонус", profileHref: "/trainer/clients/irina-kozlova" },
    assignment: { id: "assignment-irina-technique-02", title: "Верх тела · техника", scheduledFor: "12 июня, 17:30" },
    sessionTitle: "Верх тела · техника",
    signals: [{ id: "irina-no-sets", kind: "missing-data", tone: "warning", title: "Подходы не записаны", detail: "Сессия завершена без фактических данных по подходам.", sourceLabel: "WorkoutSession" }],
    clientComment: "Прошла движения в лёгком режиме, цифры не записывала.",
    exercises: [],
    feedback: { aiState: "no-context", existing: [] },
  }),
  buildReview({
    session: { id: "egor-nikitin-2026-06-14", status: "completed", completedAt: "2026-06-14T16:40:00+03:00", completedLabel: "14 июня, 16:40", durationMin: 61 },
    athlete: { id: "egor-nikitin", displayName: "Егор Никитин", initials: "ЕН", goal: "Развитие силы", profileHref: "/trainer/clients/egor-nikitin" },
    assignment: { id: "assignment-egor-strength-05", title: "Силовой день", scheduledFor: "14 июня, 15:30" },
    sessionTitle: "Силовой день",
    signals: [],
    exercises: [{ id: "egor-deadlift", title: "Становая тяга", state: "completed", planned: { sets: [setPlan("1", 5, 110), setPlan("2", 5, 110), setPlan("3", 5, 110)] }, actual: { sets: [setActual("1", 5, 110), setActual("2", 5, 110), setActual("3", 5, 110)] }, previousResult: "107.5 кг × 5" }],
    feedback: { aiState: "available", existing: [{ id: "feedback-egor-01", kind: "acknowledgement", body: "Посмотрел, всё в порядке. Продолжаем по плану.", author: "Алексей Романов", sentAt: "14 июня, 17:02" }] },
  }),
] satisfies WorkoutReviewDetails[];

const reviewById = new Map(demoReviewSessions.map((review) => [review.session.id, review]));

export function getWorkoutReviewDetails(workoutId: string) {
  return reviewById.get(workoutId) ?? null;
}

export function getDefaultReviewSessionId(athleteId: string) {
  return demoReviewSessions.find((review) => review.athlete.id === athleteId && review.feedback.existing.length === 0)?.session.id;
}

export function getReviewDemoSessionIds() {
  return demoReviewSessions.map((review) => review.session.id);
}

export function toReviewTeamClient(review: WorkoutReviewDetails): TeamClient {
  return {
    id: review.athlete.id,
    name: review.athlete.displayName,
    initials: review.athlete.initials,
    goal: review.athlete.goal,
    state: "waiting_review",
    stateLabel: review.summary.hasDiscomfort ? "Есть сигнал о самочувствии" : review.session.status === "partial" ? "Частично выполнена" : "Ждёт разбора",
    progressTrend: "flat",
    isOnline: false,
    priority: review.summary.hasDiscomfort ? "high" : "medium",
    lastActivity: review.session.completedLabel,
    nextWorkout: review.sessionTitle,
    issue: review.signals[0]?.title,
    context: review.signals[0]?.detail,
    primaryAction: "review",
  };
}

export function formatReviewRepetitions(value?: number | { min: number; max: number }) {
  if (value === undefined) return "не указано";
  return typeof value === "number" ? `${value}` : `${value.min}–${value.max}`;
}

export function formatReviewWeight(value?: number) {
  return value === undefined ? "без цели" : `${value} кг`;
}
