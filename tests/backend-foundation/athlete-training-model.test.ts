import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mergeAthleteTrainingHistory } from "../../lib/athlete-training-history-merge";
import { AthleteTrainingProfileFrameProjector } from "../../lib/server/athlete-profile/athlete-training-profile-frame-projector";
import {
  AthleteTrainingInvalidCursorError,
  decodeAthleteTrainingCursor,
  encodeAthleteTrainingCursor,
} from "../../lib/server/athlete-profile/athlete-training-cursor";
import { AthleteTrainingProjector } from "../../lib/server/athlete-profile/athlete-training-projector";
import { AthleteTrainingQueryService } from "../../lib/server/athlete-profile/athlete-training-query-service";
import { AthleteTrainingRepository } from "../../lib/server/athlete-profile/athlete-training-repository";
import type { AthleteProfileFrameReadModel } from "../../lib/server/athlete-profile/athlete-profile-types";
import type {
  AthleteTrainingCurrentSnapshot,
  AthleteTrainingHistoryItem,
  AthleteTrainingScope,
} from "../../lib/server/athlete-profile/athlete-training-types";

const ATHLETE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ATHLETE_ID = "22222222-2222-4222-8222-222222222222";
const RELATION_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "44444444-4444-4444-8444-444444444444";

test("athlete training projector keeps independent current facts and deterministic review priority", () => {
  const model = new AthleteTrainingProjector().current(scope(), {
    ...emptyCurrent(),
    pendingReviews: [
      review("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [], "2026-08-20T10:00:00.000Z"),
      review("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ["discomfort"], "2026-08-22T10:00:00.000Z"),
      review("cccccccc-cccc-4ccc-8ccc-cccccccccccc", ["discomfort"], "2026-08-21T10:00:00.000Z"),
    ],
    activeExecutions: [execution("66666666-6666-4666-8666-666666666666", "2026-08-25T10:00:00.000Z")],
    nextAssignment: {
      assignmentId: ASSIGNMENT_ID,
      title: "Следующая тренировка",
      scheduledFor: "2026-08-28",
      createdAt: "2026-08-20T10:00:00.000Z",
    },
    upcomingAssignmentCount: 2,
  });

  assert.equal(model.focus.kind, "review_required");
  assert.equal(model.pendingReviews.primary?.attentionItemId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(model.pendingReviews.totalCount, 3);
  assert.equal(model.activeExecution.totalCount, 1);
  assert.equal(model.nextAssignment.totalCount, 2);
  assert.equal(model.availableActions[0]?.kind, "review");
});

test("athlete training projector selects active execution deterministically and exposes conflict", () => {
  const model = new AthleteTrainingProjector().current(scope(), {
    ...emptyCurrent(),
    activeExecutions: [
      execution("77777777-7777-4777-8777-777777777777", "2026-08-25T09:00:00.000Z"),
      execution("88888888-8888-4888-8888-888888888888", "2026-08-25T11:00:00.000Z"),
    ],
  });

  assert.equal(model.focus.kind, "session_in_progress");
  assert.equal(model.activeExecution.primary?.sessionId, "88888888-8888-4888-8888-888888888888");
  assert.equal(model.activeExecution.conflict, "multiple_active_sessions");
  assert.equal(model.activeExecution.totalCount, 2);
});

test("athlete training projector separates next assignment, missing assignment and feedback receipt", () => {
  const projector = new AthleteTrainingProjector();
  const feedback = {
    feedbackId: "99999999-9999-4999-8999-999999999999",
    attentionItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "55555555-5555-4555-8555-555555555555",
    assignmentId: ASSIGNMENT_ID,
    title: "Завершённая тренировка",
    kind: "detailed" as const,
    body: "Работа принята.",
    followUpOfId: null,
    sentAt: "2026-08-25T12:00:00.000Z",
  };
  const scheduled = projector.current(scope(), {
    ...emptyCurrent(),
    nextAssignment: {
      assignmentId: ASSIGNMENT_ID,
      title: "Следующая тренировка",
      scheduledFor: "2026-08-28",
      createdAt: "2026-08-20T10:00:00.000Z",
    },
    upcomingAssignmentCount: 1,
    latestFeedback: feedback,
  });
  assert.equal(scheduled.focus.kind, "assignment_scheduled");
  assert.equal(scheduled.latestFeedback?.feedbackId, feedback.feedbackId);

  const missing = projector.current(scope(), { ...emptyCurrent(), latestFeedback: feedback });
  assert.equal(missing.focus.kind, "no_next_assignment");
  assert.equal(missing.availableActions[0]?.kind, "assign");
  assert.equal(missing.latestFeedback?.feedbackId, feedback.feedbackId);
});

test("athlete training projector fails closed for suspended and stale source states", () => {
  const projector = new AthleteTrainingProjector();
  const suspended = projector.current({ ...scope(), relationStatus: "suspended" }, emptyCurrent());
  assert.equal(suspended.focus.kind, "relation_unavailable");
  assert.equal(projector.permissions({ ...scope(), relationStatus: "suspended" }).canReadTraining, false);

  const stale = projector.current(scope(), {
    ...emptyCurrent(),
    pendingReviews: [{
      ...review("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [], null),
      sessionId: null,
      assignmentId: null,
      sourceAvailability: "unavailable",
    }],
    activeExecutions: [execution("88888888-8888-4888-8888-888888888888", "2026-08-25T11:00:00.000Z")],
  });
  assert.deepEqual(stale.focus, {
    kind: "source_unavailable",
    attentionItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.deepEqual(stale.availableActions, []);
});

test("athlete training cursor is opaque, stable and bound to athlete and relation", () => {
  const encoded = encodeAthleteTrainingCursor({
    athleteUserId: ATHLETE_ID,
    relationId: RELATION_ID,
    sortAt: "2026-08-20T10:00:00.000Z",
    assignmentId: ASSIGNMENT_ID,
  });
  assert.deepEqual(decodeAthleteTrainingCursor(encoded, {
    athleteUserId: ATHLETE_ID,
    relationId: RELATION_ID,
  }), {
    athleteUserId: ATHLETE_ID,
    relationId: RELATION_ID,
    sortAt: "2026-08-20T10:00:00.000Z",
    assignmentId: ASSIGNMENT_ID,
  });
  assert.throws(() => decodeAthleteTrainingCursor(encoded, {
    athleteUserId: OTHER_ATHLETE_ID,
    relationId: RELATION_ID,
  }), AthleteTrainingInvalidCursorError);
  assert.throws(() => decodeAthleteTrainingCursor("not-a-cursor", {
    athleteUserId: ATHLETE_ID,
    relationId: RELATION_ID,
  }), AthleteTrainingInvalidCursorError);
});

test("athlete training production boundary has no mock, demo or localStorage dependency", async () => {
  const files = [
    "lib/server/athlete-profile/athlete-training-types.ts",
    "lib/server/athlete-profile/athlete-training-cursor.ts",
    "lib/server/athlete-profile/athlete-training-projector.ts",
    "lib/server/athlete-profile/athlete-training-repository.ts",
    "lib/server/athlete-profile/athlete-training-query-service.ts",
    "lib/server/athlete-profile/athlete-training-profile-frame-projector.ts",
    "components/trainer/athlete-training-tab.tsx",
    "components/trainer/athlete-training-history.tsx",
    "app/trainer/clients/[clientId]/page.tsx",
    "app/api/trainer/athletes/[athleteId]/training-history/route.ts",
  ];
  const source = (await Promise.all(files.map((file) => readFile(
    new URL(`../../${file}`, import.meta.url),
    "utf8",
  )))).join("\n");
  assert.doesNotMatch(source, /mock-data|demo-data|localStorage/i);
  assert.doesNotMatch(source, /^import\s.+trainer-os\/client-profile/im);
});

test("R1 header and R2A current facts share the canonical primary-action priority", () => {
  const training = new AthleteTrainingProjector();
  const frameProjector = new AthleteTrainingProfileFrameProjector();
  const baseFrame = profileFrame();

  const pendingAndMissing = training.current(scope(), {
    ...emptyCurrent(),
    pendingReviews: [review("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [], "2026-08-20T10:00:00.000Z")],
  });
  assert.equal(frameProjector.project(baseFrame, pendingAndMissing, training.permissions(scope())).availableActions.primary?.kind, "review");

  const activeAndFuture = training.current(scope(), {
    ...emptyCurrent(),
    activeExecutions: [execution("66666666-6666-4666-8666-666666666666", "2026-08-25T10:00:00.000Z")],
    nextAssignment: nextAssignment(),
    upcomingAssignmentCount: 1,
  });
  const activeFrame = frameProjector.project(baseFrame, activeAndFuture, training.permissions(scope()));
  assert.equal(activeFrame.currentState.kind, "workout_active");
  assert.equal(activeFrame.availableActions.primary, null);

  const missing = training.current(scope(), emptyCurrent());
  assert.equal(frameProjector.project(baseFrame, missing, training.permissions(scope())).availableActions.primary?.kind, "assign");

  const multiple = training.current(scope(), {
    ...emptyCurrent(),
    pendingReviews: [
      review("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [], "2026-08-20T10:00:00.000Z"),
      review("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ["discomfort"], "2026-08-21T10:00:00.000Z"),
    ],
  });
  assert.match(frameProjector.project(baseFrame, multiple, training.permissions(scope())).availableActions.primary?.href ?? "", /bbbbbbbb-bbbb/);

  const suspendedScope = { ...scope(), relationStatus: "suspended" as const };
  const suspended = training.current(suspendedScope, emptyCurrent());
  const suspendedFrame = frameProjector.project(
    { ...baseFrame, relation: { ...baseFrame.relation, status: "suspended" } },
    suspended,
    training.permissions(suspendedScope),
  );
  assert.equal(suspendedFrame.currentState.kind, "relation_unavailable");
  assert.equal(suspendedFrame.availableActions.primary, null);

  const resolvedEntryFrame = {
    ...baseFrame,
    entryContext: {
      ...baseFrame.entryContext,
      mode: "attention" as const,
      attention: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "resolved" as const,
        sessionId: "55555555-5555-4555-8555-555555555555",
        title: "Уже разобрана",
        reason: "Эта задача уже закрыта",
      },
    },
  };
  assert.equal(frameProjector.project(resolvedEntryFrame, missing, training.permissions(scope())).availableActions.primary?.kind, "assign");
});

test("training view keeps current, feedback and history failures independent", async () => {
  const current = emptyCurrent();
  const repository = {
    findScope: async () => scope(),
    findCurrent: async () => current,
    findLatestFeedback: async () => { throw new Error("feedback_down"); },
    findHistory: async () => { throw new Error("history_down"); },
  } as unknown as AthleteTrainingRepository;
  const service = new AthleteTrainingQueryService(repository);
  const streamedCurrent = await service.findCurrentView(
    { userId: "99999999-9999-4999-8999-999999999999" },
    ATHLETE_ID,
  );
  assert.ok(streamedCurrent);
  assert.equal(streamedCurrent.current.status, "ready");
  assert.equal(streamedCurrent.feedback.status, "error");
  const view = await service.findView({ userId: "99999999-9999-4999-8999-999999999999" }, ATHLETE_ID);
  assert.ok(view);
  assert.equal(view.current.status, "ready");
  assert.equal(view.feedback.status, "error");
  assert.equal(view.history.status, "error");

  const currentFailure = new AthleteTrainingQueryService({
    ...repository,
    findCurrent: async () => { throw new Error("current_down"); },
    findLatestFeedback: async () => null,
    findHistory: async () => ({ items: [], pageInfo: { endCursor: null, hasNextPage: false } }),
  } as unknown as AthleteTrainingRepository);
  const partial = await currentFailure.findView({ userId: "99999999-9999-4999-8999-999999999999" }, ATHLETE_ID);
  assert.ok(partial);
  assert.equal(partial.current.status, "error");
  assert.equal(partial.feedback.status, "ready");
  assert.equal(partial.history.status, "ready");
});

test("cursor page merge keeps assignment lineage unique", () => {
  const first = historyItem("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const duplicate = historyItem("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const second = historyItem("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  const merged = mergeAthleteTrainingHistory([first], [duplicate, second]);
  assert.deepEqual(merged.items.map((item) => item.assignment.id), [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]);
  assert.deepEqual(merged.additions.map((item) => item.assignment.id), ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
});

function scope(): AthleteTrainingScope {
  return {
    athleteUserId: ATHLETE_ID,
    athleteStatus: "active",
    relationId: RELATION_ID,
    relationStatus: "active",
  };
}

function emptyCurrent(): AthleteTrainingCurrentSnapshot {
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

function review(attentionItemId: string, priorityReasons: string[], completedAt: string | null) {
  return {
    attentionItemId,
    sessionId: "55555555-5555-4555-8555-555555555555",
    assignmentId: ASSIGNMENT_ID,
    title: "Завершённая тренировка",
    attentionStatus: "open" as const,
    priorityReasons,
    createdAt: "2026-08-20T10:05:00.000Z",
    completedAt,
    sourceAvailability: "ready" as const,
  };
}

function execution(sessionId: string, startedAt: string) {
  return {
    assignmentId: ASSIGNMENT_ID,
    sessionId,
    title: "Тренировка в процессе",
    scheduledFor: "2026-08-25",
    startedAt,
    version: 1,
  };
}

function nextAssignment() {
  return {
    assignmentId: ASSIGNMENT_ID,
    title: "Следующая тренировка",
    scheduledFor: "2026-08-28",
    createdAt: "2026-08-20T10:00:00.000Z",
  };
}

function profileFrame(): AthleteProfileFrameReadModel {
  return {
    identity: { athleteUserId: ATHLETE_ID, displayName: "Анна Смирнова", initials: "АС", goal: null },
    relation: { id: RELATION_ID, status: "active", acceptedAt: "2026-08-01T10:00:00.000Z" },
    currentState: {
      kind: "calm",
      tone: "calm",
      label: "Работа идёт по плану",
      detail: "Срочных решений не требуется.",
      assignmentId: null,
      sessionId: null,
      attentionItemId: null,
    },
    entryContext: {
      mode: "neutral",
      source: "direct",
      returnHref: "/trainer/clients",
      returnLabel: "К спортсменам",
      attention: null,
    },
    availableActions: { primary: null },
    permissions: { canRead: true, canAssign: true, canReview: false, canEditAthleteFacts: false },
  };
}

function historyItem(assignmentId: string): AthleteTrainingHistoryItem {
  return {
    assignment: {
      id: assignmentId,
      title: "История",
      scheduledFor: "2026-08-20",
      status: "available",
      createdAt: "2026-08-19T10:00:00.000Z",
      cancelledAt: null,
    },
    session: {
      id: "55555555-5555-4555-8555-555555555555",
      status: "completed",
      startedAt: "2026-08-20T10:00:00.000Z",
      completedAt: "2026-08-20T11:00:00.000Z",
      version: 1,
    },
    completion: { completedSets: 1, skippedSets: 0, incompleteSets: 0, totalSets: 1 },
    attention: null,
    feedback: { count: 0, latestFeedbackId: null, latestKind: null, latestSentAt: null },
    hasPersistedComment: false,
    sortAt: "2026-08-20T11:00:00.000Z",
    destination: {
      assignmentId,
      sessionId: "55555555-5555-4555-8555-555555555555",
      attentionItemId: null,
    },
    degraded: null,
  };
}
