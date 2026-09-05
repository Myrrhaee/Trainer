import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHistory,
  appendCurrentWorkouts,
  currentWorkoutCollectionUrl,
  historyCollectionUrl,
  readCurrentWorkoutNavigation,
  readHistoryNavigation,
  safeClientReturn,
} from "../../lib/client-history-navigation";
import {
  decodeHistoryCursor,
  encodeHistoryCursor,
  historyLimit,
} from "../../lib/server/client-workouts/client-history-cursor";
import type { ClientWorkoutHistoryItem } from "../../lib/server/client-workouts/client-history-types";
import type { ClientWorkoutAssignmentReadModel } from "../../lib/server/client-workouts/client-workout-types";
import {
  decodeClientCurrentCursor,
  encodeClientCurrentCursor,
} from "../../lib/server/client-workouts/client-current-cursor";

test("R3E navigation preserves full depth and anchor without a restore-depth cap", () => {
  const anchor = "#workout-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const path = historyCollectionUrl("opaque-cursor", 1000, anchor);
  assert.deepEqual(
    readHistoryNavigation(new URL(path, "https://client.invalid")),
    { start: "opaque-cursor", depth: 1000, anchor, invalid: false },
  );
  assert.equal(safeClientReturn(path), path);
  assert.equal(
    safeClientReturn("/trainer/dashboard"),
    "/client/workouts#history",
  );
  assert.equal(safeClientReturn("//foreign.test"), "/client/workouts#history");
  assert.equal(
    safeClientReturn("/client/me#recent-feedback"),
    "/client/me#recent-feedback",
  );
  assert.ok(
    readHistoryNavigation(
      new URL("https://client.invalid/client/workouts?historyDepth=-1"),
    ).invalid,
  );
  assert.ok(
    readHistoryNavigation(
      new URL(
        "https://client.invalid/client/workouts?historyStart=x&historyDepth=2&historyDepth=3",
      ),
    ).invalid,
  );
});

test("R3E append deduplicates Session identity and preserves the previous prefix", () => {
  const row = (sessionId: string, title = sessionId) =>
    ({ sessionId, title }) as ClientWorkoutHistoryItem;
  assert.deepEqual(
    appendHistory([row("a"), row("b")], [row("b", "updated"), row("c")]),
    [row("a"), row("b", "updated"), row("c")],
  );
});

test("R3E cursor retains microseconds and rejects actor/purpose/limit substitution", () => {
  const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const upper = { at: "2026-09-04T00:00:00.123456Z", id: actor };
  const token = encodeHistoryCursor({
    v: 1,
    domain: "client-history",
    actor,
    upper,
    after: null,
  });
  assert.equal(decodeHistoryCursor(token, actor, "start").upper.at, upper.at);
  assert.throws(() => decodeHistoryCursor(token, "foreign", "start"));
  assert.throws(() => decodeHistoryCursor(token, actor, "after"));
  assert.throws(() => decodeHistoryCursor("garbage", actor, "start"));
  assert.equal(historyLimit(), 10);
  assert.equal(historyLimit("30"), 30);
  for (const value of ["31", "0", "-1", "NaN", "2.5", "01"])
    assert.throws(() => historyLimit(value));
});

test("R4 current navigation preserves its depth beside independent history state", () => {
  const assignmentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const base = new URL(
    "https://client.invalid/client/workouts?historyStart=history-token&historyDepth=4#history",
  );
  const path = currentWorkoutCollectionUrl(
    "current-token",
    3,
    `#current-workout-${assignmentId}`,
    base,
  );
  assert.equal(
    path,
    `/client/workouts?historyStart=history-token&historyDepth=4&currentStart=current-token&currentDepth=3#current-workout-${assignmentId}`,
  );
  assert.deepEqual(
    readCurrentWorkoutNavigation(new URL(path, "https://client.invalid")),
    {
      start: "current-token",
      depth: 3,
      anchor: `#current-workout-${assignmentId}`,
      invalid: false,
    },
  );
  assert.equal(safeClientReturn(path), path);
  assert.ok(
    readCurrentWorkoutNavigation(
      new URL(
        "https://client.invalid/client/workouts?currentStart=x&currentDepth=2&currentDepth=3",
      ),
    ).invalid,
  );
});

test("R4 current cursor retains exact order tuple and rejects substitution", () => {
  const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const upper = {
    bucket: 0 as const,
    scheduledFor: "2026-09-04",
    createdAt: "2026-09-04T12:13:14.123456Z",
    assignmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  };
  const token = encodeClientCurrentCursor({
    v: 1,
    domain: "client-current-workouts",
    actor,
    upper,
    after: null,
  });
  assert.deepEqual(decodeClientCurrentCursor(token, actor, "start").upper, upper);
  assert.throws(() => decodeClientCurrentCursor(token, "foreign", "start"));
  assert.throws(() => decodeClientCurrentCursor(token, actor, "after"));
  assert.throws(() => decodeClientCurrentCursor("garbage", actor, "start"));
  const invalidOrder = encodeClientCurrentCursor({
    v: 1,
    domain: "client-current-workouts",
    actor,
    upper: { ...upper, bucket: 1 },
    after: upper,
  });
  assert.throws(() => decodeClientCurrentCursor(invalidOrder, actor, "after"));
});

test("R4 current append deduplicates canonical Assignment and Session identity", () => {
  const row = (assignmentId: string, sessionId: string | null) =>
    ({
      assignmentId,
      session: sessionId ? { sessionId } : null,
    }) as ClientWorkoutAssignmentReadModel;
  assert.deepEqual(
    appendCurrentWorkouts(
      [row("assignment-a", "session-a"), row("assignment-b", null)],
      [
        row("assignment-b", "session-b"),
        row("assignment-c", "session-a"),
        row("assignment-d", "session-d"),
      ],
    ).map((item) => [item.assignmentId, item.session?.sessionId ?? null]),
    [
      ["assignment-a", "session-a"],
      ["assignment-b", "session-b"],
      ["assignment-d", "session-d"],
    ],
  );
});
