import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CanonicalReviewActionRegion } from "../../components/trainer/review/canonical-review-action-region";
import {
  CanonicalReviewAvailability,
  CanonicalReviewContextHeader,
  CanonicalReviewEvidence,
  CanonicalReviewSummary,
} from "../../components/trainer/review/canonical-review-evidence";
import {
  actualSetValues,
  collectReviewExceptions,
  summarizeReview,
} from "../../components/trainer/review/canonical-review-presentation";
import type { ReviewReadModel, ReviewSetReadModel } from "../../lib/server/reviews/review-types";
import type { TrainerWorkflowTransition } from "../../lib/trainer-workflow-transition";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const ATTENTION_ID = "33333333-3333-4333-8333-333333333333";
const ATHLETE_ID = "44444444-4444-4444-8444-444444444444";
const RELATION_ID = "55555555-5555-4555-8555-555555555555";
const EXERCISE_ID = "66666666-6666-4666-8666-666666666666";

test("context header is compact, source-aware and has no synthetic queue position", () => {
  const html = render(CanonicalReviewContextHeader, { review: model(), transition: workflow() });
  assert.match(html, /Разбор тренировки/);
  assert.match(html, /Артём Смирнов/);
  assert.match(html, /Из очереди/);
  assert.match(html, /Завершённая тренировка ждёт разбора/);
  assert.doesNotMatch(html, /1\/1|Программа|Достижения/);
});

test("availability presents unsupported context honestly", () => {
  const html = render(CanonicalReviewAvailability, { review: model() });
  assert.match(html, /Данные о самочувствии для этой тренировки не собирались/);
  assert.doesNotMatch(html, /Дискомфорта нет|Все данные в норме|Отклонений нет/);
});

test("summary counts canonical set states without invented metrics", () => {
  const review = model();
  const summary = summarizeReview(review);
  assert.deepEqual(summary, {
    exerciseCount: 1,
    prescribedSetCount: 3,
    completedSetCount: 1,
    skippedSetCount: 1,
    incompleteSetCount: 1,
    missingSetCount: 1,
    deviationCount: 4,
    commentCount: 2,
  });
  const html = render(CanonicalReviewSummary, { review });
  assert.match(html, /Длительность.*62 мин/);
  assert.doesNotMatch(html, /эффектив|калори|AI|готовность/i);
});

test("exception index keeps exact stable source anchors and neutral copy", () => {
  const exceptions = collectReviewExceptions(model());
  assert.ok(exceptions.some((item) => item.title === "Повторы отличаются от плана" && item.detail.includes("8 повторов")));
  assert.ok(exceptions.some((item) => item.title === "Подход пропущен"));
  assert.ok(exceptions.some((item) => item.title === "Выполнено частично"));
  assert.ok(exceptions.some((item) => item.title === "Результат не записан"));
  assert.ok(exceptions.every((item) => item.sourceAnchorId.startsWith("review-")));
  assert.ok(exceptions.every((item) => item.sourceIdentity.length > 0));
});

test("exercise results preserve planned, actual and comments at their sources", () => {
  const html = render(CanonicalReviewEvidence, { review: model() });
  assert.match(html, /По плану/);
  assert.match(html, /Выполнено/);
  assert.match(html, /Комментарий спортсмена к подходу/);
  assert.match(html, /Колено чувствуется только в нижней точке/);
  assert.match(html, /Комментарий к упражнению/);
  assert.match(html, /Проверить глубину/);
  assert.doesNotMatch(html, /Проверить глубину.*Колено чувствуется только в нижней точке:/);
});

test("long source comments preserve full text behind an accessible disclosure", () => {
  const text = `Первая строка\n${"длинныйфрагмент".repeat(30)}\nФинальная строка`;
  const review = model();
  const source = review.exercises[0].sets[0];
  source.sourceComments = [{
    source: "set_comment",
    sourceId: source.identity.setLogId!,
    exerciseLogId: review.exercises[0].identity.exerciseLogId,
    setLogId: source.identity.setLogId,
    text,
  }];
  const html = render(CanonicalReviewEvidence, { review });
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Показать полностью/);
  assert.match(html, /whitespace-pre-wrap/);
  assert.match(html, /Финальная строка/);
  assert.doesNotMatch(html, /overflow-x-auto/);
});

test("skipped, incomplete and missing results remain distinct", () => {
  const sets = model().exercises[0].sets;
  assert.deepEqual(actualSetValues(sets[1]), ["Пропущено"]);
  assert.notDeepEqual(actualSetValues(sets[2]), ["Пропущено"]);
  assert.deepEqual(actualSetValues(sets[3]), ["Результат не записан"]);
  const html = render(CanonicalReviewEvidence, { review: model() });
  assert.match(html, /Выполнено частично/);
  assert.match(html, /Результат не записан/);
});

test("missing source identity is disclosed and never matched to a neighbor", () => {
  const html = render(CanonicalReviewEvidence, { review: model() });
  assert.match(html, /Источник назначенного подхода не подтверждён/);
  assert.match(html, /Соседние подходы не использовались для сопоставления/);
});

test("session all-clear is blocked when capability is false", () => {
  const review = model({ exercises: [{ ...model().exercises[0], deviations: [], sets: [cleanSet()] }] });
  const html = render(CanonicalReviewEvidence, { review });
  assert.match(html, /Вывод обо всей сессии недоступен/);
  assert.doesNotMatch(html, /По полным данным различий/);
  assert.match(html, /По записанным значениям этого подхода отличий не зафиксировано/);
});

test("known-empty logs do not become an unavailable or positive assertion", () => {
  const review = model({
    exercises: [],
    dataAvailability: { ...model().dataAvailability, logs: { status: "known_empty", value: null } },
  });
  const html = render(CanonicalReviewEvidence, { review });
  assert.match(html, /Результаты по подходам не записаны/);
  assert.doesNotMatch(html, /Все данные в норме/);
});

test("partial and unavailable sources retain explicit limitations", () => {
  const partial = model({
    dataAvailability: {
      ...model().dataAvailability,
      logs: { status: "partial", value: { exerciseCount: 1, setCount: 2 }, reason: "partial" },
      assignmentSnapshot: { status: "unavailable", reason: "missing" },
    },
  });
  const html = render(CanonicalReviewEvidence, { review: partial });
  assert.match(html, /Результаты: часть данных недоступна/);
  assert.match(html, /Назначение: не удалось загрузить данные/);
  assert.match(html, /Итог составлен по доступной части/);
  assert.doesNotMatch(html, />По плану</);
  assert.doesNotMatch(html, /Инструкция тренера из назначения/);
});

test("unavailable logs hide stale actual values and source comments", () => {
  const unavailable = model({
    dataAvailability: {
      ...model().dataAvailability,
      logs: { status: "unavailable", reason: "read failed" },
    },
  });
  const html = render(CanonicalReviewEvidence, { review: unavailable });
  const summaryHtml = render(CanonicalReviewSummary, { review: unavailable });
  assert.match(html, /Результаты: не удалось загрузить данные/);
  assert.match(html, /Не удалось загрузить данные результата/);
  assert.doesNotMatch(html, /Темп комфортный, техника стабильна/);
  assert.doesNotMatch(summaryHtml, />Выполнено</);
  assert.doesNotMatch(summaryHtml, />Комментариев</);
});

test("open action region exposes detailed mode and no AI draft", () => {
  const html = render(CanonicalReviewActionRegion, {
    review: model(), transition: workflow(), transitionContext: "{}", onReload: async () => true,
  });
  assert.match(html, /Подробный ответ/);
  assert.match(html, /Коротко подтвердить/);
  assert.match(html, /Сообщение спортсмену/);
  assert.match(html, /Отправить ответ/);
  assert.doesNotMatch(html, /AI draft|ИИ-черновик|Сгенерировать ответ/i);
});

test("resolved action region renders immutable feedback receipt and follow-up entry", () => {
  const review = model({
    attention: { ...model().attention, status: "resolved", resolvedAt: "2026-08-31T13:10:00.000Z" },
    existingFeedback: [feedback()],
    capabilities: { canRead: true, canSendInitialFeedback: false, canSendAcknowledgement: false, canSendFollowUp: true, canResolveManually: false },
  });
  const transition = workflow({ result: { ...workflow().result, kind: "review", entityId: feedback().id, title: "Обратная связь сохранена" } });
  const html = render(CanonicalReviewActionRegion, { review, transition, transitionContext: "{}", onReload: async () => true });
  assert.match(html, /Ответ тренера/);
  assert.match(html, /Сохраняем спокойный темп/);
  assert.match(html, /Обратная связь сохранена/);
  assert.match(html, /Статус доставки уведомления недоступен/);
  assert.match(html, /Добавить уточнение/);
});

test("production review path has no demo presenter, store or compatibility mapper", () => {
  const production = [
    readFileSync("components/trainer/canonical-workout-review.tsx", "utf8"),
    readFileSync("components/trainer/review/canonical-review-evidence.tsx", "utf8"),
    readFileSync("components/trainer/review/canonical-review-action-region.tsx", "utf8"),
  ].join("\n");
  assert.doesNotMatch(production, /trainer-os\/workout-review|WorkoutReviewDetails|review-store|useReviewWorkflow|review-model/);
  assert.doesNotMatch(production, /toReviewModel|synthetic queue|aiState/);
});

test("mobile contract uses one evidence/action DOM order and no wide table", () => {
  const page = readFileSync("components/trainer/canonical-workout-review.tsx", "utf8");
  const evidence = readFileSync("components/trainer/review/canonical-review-evidence.tsx", "utf8");
  assert.ok(page.indexOf("<CanonicalReviewEvidence") < page.indexOf("<CanonicalReviewActionRegion"));
  assert.match(page, /xl:grid-cols-\[minmax\(0,1fr\)_390px\]/);
  assert.doesNotMatch(evidence, /<table|overflow-x-auto/);
  assert.match(evidence, /sm:grid-cols-2/);
});

function render(Component: React.ElementType, props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(Component, props));
}

function model(patch: Partial<ReviewReadModel> = {}): ReviewReadModel {
  const base: ReviewReadModel = {
    identity: { sessionId: SESSION_ID, assignmentId: ASSIGNMENT_ID, attentionItemId: ATTENTION_ID, athleteUserId: ATHLETE_ID, relationId: RELATION_ID },
    athlete: { id: ATHLETE_ID, displayName: "Артём Смирнов", initials: "АС" },
    attention: {
      id: ATTENTION_ID, status: "open", createdAt: "2026-08-31T12:05:00.000Z", resolvedAt: null,
      priorityReasons: [], manualResolutionReason: null, sourceAvailability: { status: "ready", value: { sessionId: SESSION_ID } },
    },
    assignmentSnapshot: {
      id: ASSIGNMENT_ID, sourceTemplateId: "77777777-7777-4777-8777-777777777777",
      sourceRevisionId: "88888888-8888-4888-8888-888888888888", sourceRevisionNumber: 3,
      title: "Силовая база", scheduledFor: "2026-08-31", instruction: "Работать без отказа", trainerNote: "Контроль техники", createdAt: "2026-08-30T10:00:00.000Z",
    },
    session: {
      id: SESSION_ID, assignmentId: ASSIGNMENT_ID, title: "Силовая база", status: "completed_with_omissions",
      clientTimezone: "Europe/Moscow", startedAt: "2026-08-31T11:00:00.000Z", completedAt: "2026-08-31T12:02:00.000Z",
      durationMin: 62, zeroResultReason: { status: "known_empty", value: null }, createdAt: "2026-08-31T11:00:00.000Z", updatedAt: "2026-08-31T12:02:00.000Z",
    },
    exercises: [exercise()],
    sessionContext: unsupportedContext(),
    existingFeedback: [],
    capabilities: { canRead: true, canSendInitialFeedback: true, canSendAcknowledgement: true, canSendFollowUp: false, canResolveManually: true },
    anomalies: [{ type: "unsupported_session_context", detail: "not collected" }, { type: "set_source_identity_missing", setLogId: null, detail: "missing" }],
    dataAvailability: {
      sourceSession: { status: "ready", value: { sessionId: SESSION_ID } },
      assignmentSnapshot: { status: "ready", value: { assignmentId: ASSIGNMENT_ID } },
      logs: { status: "partial", value: { exerciseCount: 1, setCount: 3 }, reason: "partial" },
      feedback: { status: "known_empty", value: null },
      sessionContext: unsupportedContext(),
      canAssertNoDeviations: false,
    },
  };
  return { ...base, ...patch };
}

function exercise() {
  const sets = [
    set({ position: 1, setLogId: "91111111-1111-4111-8111-111111111111", sourceAssignmentSetId: "92111111-1111-4111-8111-111111111111", repetitions: 8, status: "completed", comment: "Колено чувствуется только в нижней точке", deviation: "planned_repetitions_not_met" }),
    set({ position: 2, setLogId: "93111111-1111-4111-8111-111111111111", sourceAssignmentSetId: "94111111-1111-4111-8111-111111111111", repetitions: null, status: "skipped", deviation: "set_skipped" }),
    set({ position: 3, setLogId: "95111111-1111-4111-8111-111111111111", sourceAssignmentSetId: "96111111-1111-4111-8111-111111111111", repetitions: 6, status: "incomplete", deviation: "result_incomplete" }),
    set({ position: 4, setLogId: null, sourceAssignmentSetId: null, repetitions: null, status: "missing", deviation: "log_missing" }),
  ];
  return {
    identity: { exerciseLogId: "97111111-1111-4111-8111-111111111111", assignmentExerciseId: EXERCISE_ID, position: 1, title: "Присед со штангой" },
    prescribed: { instanceKey: "squat", category: "Ноги", equipment: "Штанга", prescriptionType: "repetitions" as const, repetitionMode: "fixed" as const, repetitionsMin: 10, repetitionsMax: 10, durationSeconds: null, targetWeightKg: 70, restSeconds: 120, trainerNote: "Сохранять нейтральную спину" },
    actual: { status: "incomplete" as const, athleteNote: { status: "ready" as const, value: "Проверить глубину" }, createdAt: "2026-08-31T11:10:00.000Z", updatedAt: "2026-08-31T12:00:00.000Z" },
    sets,
    sourceComments: [{ source: "exercise_note" as const, sourceId: "97111111-1111-4111-8111-111111111111", exerciseLogId: "97111111-1111-4111-8111-111111111111", setLogId: null, text: "Проверить глубину" }],
    deviations: sets.flatMap((item) => item.deviations),
  };
}

function set(options: {
  position: number; setLogId: string | null; sourceAssignmentSetId: string | null;
  repetitions: number | null; status: ReviewSetReadModel["actual"]["status"];
  deviation: ReviewSetReadModel["deviations"][number]["type"]; comment?: string;
}): ReviewSetReadModel {
  const comment = options.comment ? [{ source: "set_comment" as const, sourceId: options.setLogId!, exerciseLogId: "97111111-1111-4111-8111-111111111111", setLogId: options.setLogId, text: options.comment }] : [];
  const deviation = {
    id: `${options.deviation}:${options.position}`, type: options.deviation,
    exerciseLogId: "97111111-1111-4111-8111-111111111111", setLogId: options.setLogId,
    assignmentExerciseId: EXERCISE_ID, sourceAssignmentSetId: options.sourceAssignmentSetId,
    planned: { repetitionsMin: 10, repetitionsMax: 10, durationSeconds: null, weightKg: 70 },
    actual: options.status === "skipped" || options.status === "missing" ? null : { repetitionsMin: options.repetitions, repetitionsMax: options.repetitions, durationSeconds: null, weightKg: 70 },
    commentReference: options.comment ? { source: "set_comment" as const, sourceId: options.setLogId!, text: options.comment } : null,
  };
  return {
    identity: { setLogId: options.setLogId, sourceAssignmentSetId: options.sourceAssignmentSetId, setKey: `set-${options.position}`, position: options.position },
    prescribed: { source: options.sourceAssignmentSetId ? "assignment_snapshot" : "session_snapshot", kind: "working", repetitionsMin: 10, repetitionsMax: 10, durationSeconds: null, weightKg: 70, restSeconds: 120 },
    actual: { status: options.status, repetitions: options.repetitions, durationSeconds: null, weightKg: options.status === "skipped" || options.status === "missing" ? null : 70, rpe: options.status === "completed" ? 8 : null, createdAt: options.setLogId ? "2026-08-31T11:20:00.000Z" : null, updatedAt: options.setLogId ? "2026-08-31T11:21:00.000Z" : null },
    athleteComment: options.comment ? { status: "ready", value: options.comment } : { status: "unsupported", reason: "not confirmed" },
    sourceComments: comment,
    deviations: [deviation],
  };
}

function cleanSet(): ReviewSetReadModel {
  return { ...set({ position: 1, setLogId: "98111111-1111-4111-8111-111111111111", sourceAssignmentSetId: "99111111-1111-4111-8111-111111111111", repetitions: 10, status: "completed", deviation: "repetitions_changed" }), deviations: [] };
}

function unsupportedContext() {
  return {
    overallComment: { status: "unsupported" as const, reason: "not collected" },
    discomfort: { status: "unsupported" as const, reason: "not collected" },
    subjectiveMetrics: { status: "unsupported" as const, reason: "not collected" },
  };
}

function feedback() {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", attentionItemId: ATTENTION_ID, sessionId: SESSION_ID,
    assignmentId: ASSIGNMENT_ID, trainerUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", athleteUserId: ATHLETE_ID,
    kind: "detailed" as const, body: "Сохраняем спокойный темп.", followUpOfId: null, author: "Тренер", sentAt: "2026-08-31T13:00:00.000Z",
  };
}

function workflow(patch: Partial<TrainerWorkflowTransition> = {}): TrainerWorkflowTransition {
  const base: TrainerWorkflowTransition = {
    context: { version: 1, origin: "dashboard", athleteUserId: ATHLETE_ID, tab: "training", sourceAttentionItemId: ATTENTION_ID, sourceSessionId: SESSION_ID },
    profileHref: `/trainer/clients/${ATHLETE_ID}?tab=training`, queueHref: "/trainer/dashboard?filter=review", returnHref: "/trainer/dashboard?filter=review",
    nextItem: null, allCalm: true,
    result: { kind: "current", entityId: ATTENTION_ID, athleteUserId: ATHLETE_ID, sessionId: SESSION_ID, title: "Разбор открыт", detail: "Силовая база" },
  };
  return { ...base, ...patch };
}
