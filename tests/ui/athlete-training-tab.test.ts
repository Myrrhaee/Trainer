import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AthleteTrainingTab } from "../../components/trainer/athlete-training-tab";
import { AthleteTrainingProjector } from "../../lib/server/athlete-profile/athlete-training-projector";
import type {
  AthleteTrainingCurrentSnapshot,
  AthleteTrainingHistoryItem,
  AthleteTrainingScope,
  AthleteTrainingViewResult,
} from "../../lib/server/athlete-profile/athlete-training-types";

const ATHLETE_ID = "11111111-1111-4111-8111-111111111111";
const RELATION_ID = "22222222-2222-4222-8222-222222222222";
const ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const ATTENTION_ID = "55555555-5555-4555-8555-555555555555";

test("training tab keeps empty operational slots stable without a duplicate primary CTA", () => {
  const html = render(view());
  assert.match(html, /Работа сейчас/);
  assert.match(html, /Ничего не ждёт разбора/);
  assert.match(html, /Сейчас ничего не выполняется/);
  assert.match(html, /Следующая тренировка не назначена/);
  assert.match(html, /История пока пуста/);
  assert.doesNotMatch(html, />Назначить тренировку</);
});

test("training tab composes pending, active and next facts independently", () => {
  const html = render(view({
    pendingReviews: [review(ATTENTION_ID, ["discomfort"])],
    activeExecutions: [execution(SESSION_ID), execution("66666666-6666-4666-8666-666666666666")],
    nextAssignment: {
      assignmentId: ASSIGNMENT_ID,
      title: "Следующая силовая",
      scheduledFor: "2026-09-01",
      createdAt: "2026-08-30T10:00:00.000Z",
    },
    upcomingAssignmentCount: 2,
  }), ATTENTION_ID);
  assert.match(html, /Спортсмен отметил дискомфорт/);
  assert.match(html, /Причина открытия профиля/);
  assert.match(html, /Обнаружено несколько активных тренировок/);
  assert.match(html, /Следующая силовая/);
  assert.match(html, /Ещё назначений: 1/);
});

test("training tab renders persisted feedback and terminal history only", () => {
  const feedback = {
    feedbackId: "77777777-7777-4777-8777-777777777777",
    attentionItemId: ATTENTION_ID,
    sessionId: SESSION_ID,
    assignmentId: ASSIGNMENT_ID,
    title: "Силовая база",
    kind: "detailed" as const,
    body: "Сохраняем технику и рабочий темп.",
    followUpOfId: null,
    sentAt: "2026-08-30T12:00:00.000Z",
  };
  const html = render(view({}, {
    feedback: { status: "ready", value: feedback },
    history: {
      status: "ready",
      value: { items: [historyItem()], pageInfo: { endCursor: "opaque", hasNextPage: true } },
    },
  }));
  assert.match(html, /Сохраняем технику и рабочий темп/);
  assert.match(html, /1 из 1 подходов/);
  assert.match(html, /Показать ещё/);
  assert.doesNotMatch(html, /calories|streak|AI score|volume/i);
});

test("training tab isolates partial errors and source unavailable state", () => {
  const degraded = view({
    pendingReviews: [{ ...review(ATTENTION_ID, []), sessionId: null, assignmentId: null, sourceAvailability: "unavailable" }],
  }, {
    feedback: { status: "error" },
    history: { status: "error" },
  });
  const html = render(degraded, ATTENTION_ID);
  assert.match(html, /Источник тренировки недоступен/);
  assert.match(html, /Не удалось загрузить обратную связь/);
  assert.match(html, /Не удалось загрузить историю/);

  const currentError = render({ ...view(), current: { status: "error" } });
  assert.match(currentError, /Не удалось загрузить текущую работу/);
  assert.match(currentError, /Повторить загрузку/);
  assert.match(currentError, /История тренировок/);
});

test("suspended relation exposes no training facts or counters", () => {
  const suspended = view({}, {
    relation: {
      status: "suspended",
      capabilities: permissions(false),
    },
    current: { status: "unavailable" },
    feedback: { status: "unavailable" },
    history: { status: "unavailable" },
  });
  const html = render(suspended);
  assert.match(html, /Тренировочные данные временно недоступны/);
  assert.doesNotMatch(html, /Работа сейчас|История тренировок|Силовая база/);
});

function render(training: AthleteTrainingViewResult, sourceAttentionItemId: string | null = null) {
  return renderToStaticMarkup(createElement(AthleteTrainingTab, {
    athleteUserId: ATHLETE_ID,
    training,
    sourceAttentionItemId,
  }));
}

function view(
  patch: Partial<AthleteTrainingCurrentSnapshot> = {},
  override: Partial<AthleteTrainingViewResult> = {},
): AthleteTrainingViewResult {
  const projector = new AthleteTrainingProjector();
  const current = projector.current(scope(), { ...snapshot(), ...patch });
  const base: AthleteTrainingViewResult = {
    scope: {
      athleteUserId: ATHLETE_ID,
      relationId: RELATION_ID,
      relationStatus: "active",
      readAt: "2026-08-30T10:00:00.000Z",
    },
    relation: { status: "active", capabilities: projector.permissions(scope()) },
    current: { status: "ready", value: current },
    feedback: { status: "ready", value: current.latestFeedback },
    history: { status: "ready", value: { items: [], pageInfo: { endCursor: null, hasNextPage: false } } },
  };
  return { ...base, ...override };
}

function scope(): AthleteTrainingScope {
  return { athleteUserId: ATHLETE_ID, athleteStatus: "active", relationId: RELATION_ID, relationStatus: "active" };
}

function permissions(available: boolean) {
  return {
    canReadTraining: available,
    canAssign: available,
    canOpenSession: available,
    canReview: available,
    canSendFeedback: available,
    canResolveAttention: available,
    canOpenAssignment: available,
    canEditSessionFacts: false as const,
  };
}

function snapshot(): AthleteTrainingCurrentSnapshot {
  return {
    trainingAvailable: true,
    pendingReviews: [],
    activeExecutions: [],
    nextAssignment: null,
    upcomingAssignmentCount: 0,
    latestFeedback: null,
    readAt: "2026-08-30T10:00:00.000Z",
  };
}

function review(attentionItemId: string, priorityReasons: string[]) {
  return {
    attentionItemId,
    sessionId: SESSION_ID,
    assignmentId: ASSIGNMENT_ID,
    title: "Силовая база",
    attentionStatus: "open" as const,
    priorityReasons,
    createdAt: "2026-08-30T10:00:00.000Z",
    completedAt: "2026-08-30T11:00:00.000Z",
    sourceAvailability: "ready" as const,
  };
}

function execution(sessionId: string) {
  return {
    assignmentId: ASSIGNMENT_ID,
    sessionId,
    title: `Активная ${sessionId.slice(0, 4)}`,
    scheduledFor: "2026-08-30",
    startedAt: "2026-08-30T10:00:00.000Z",
    version: 1,
  };
}

function historyItem(): AthleteTrainingHistoryItem {
  return {
    assignment: {
      id: ASSIGNMENT_ID,
      title: "Силовая база",
      scheduledFor: "2026-08-30",
      status: "available",
      createdAt: "2026-08-29T10:00:00.000Z",
      cancelledAt: null,
    },
    session: {
      id: SESSION_ID,
      status: "completed",
      startedAt: "2026-08-30T10:00:00.000Z",
      completedAt: "2026-08-30T11:00:00.000Z",
      version: 1,
    },
    completion: { completedSets: 1, skippedSets: 0, incompleteSets: 0, totalSets: 1 },
    attention: null,
    feedback: { count: 1, latestFeedbackId: "77777777-7777-4777-8777-777777777777", latestKind: "detailed", latestSentAt: "2026-08-30T12:00:00.000Z" },
    hasPersistedComment: true,
    sortAt: "2026-08-30T11:00:00.000Z",
    destination: { assignmentId: ASSIGNMENT_ID, sessionId: SESSION_ID, attentionItemId: null },
    degraded: null,
  };
}
