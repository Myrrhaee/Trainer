import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHistory,
  historyCollectionUrl,
  readHistoryNavigation,
  safeClientReturn,
} from "../../lib/client-history-navigation";
import {
  decodeHistoryCursor,
  encodeHistoryCursor,
  historyLimit,
} from "../../lib/server/client-workouts/client-history-cursor";
import type { ClientWorkoutHistoryItem } from "../../lib/server/client-workouts/client-history-types";

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
