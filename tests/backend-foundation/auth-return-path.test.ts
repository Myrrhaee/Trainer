import assert from "node:assert/strict";
import test from "node:test";

import { safeAuthReturnPath } from "../../lib/server/http/safe-return-path";

const assignmentId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const feedbackId = "33333333-3333-4333-8333-333333333333";

test("canonical auth return preserves allowlisted exact client destinations", () => {
  assert.equal(
    safeAuthReturnPath(`/client/workouts?assignment=${assignmentId}`),
    `/client/workouts?assignment=${assignmentId}`,
  );
  const exactSession = `/client/workouts?session=${sessionId}&feedback=${feedbackId}&returnTo=${encodeURIComponent(`/client/workouts?currentStart=opaque&currentDepth=2#current-workout-${assignmentId}`)}`;
  assert.equal(safeAuthReturnPath(exactSession), exactSession);
  assert.equal(safeAuthReturnPath("/client/me"), "/client/me");
});

test("canonical auth return rejects ambiguous or uncontrolled client destinations", () => {
  const fallback = "/auth/continue";
  for (const value of [
    "https://outside.example/client/workouts",
    "/client\\workouts",
    `/client/workouts?session=${sessionId}&session=${assignmentId}`,
    `/client/workouts?assignment=${assignmentId}&session=${sessionId}`,
    `/client/workouts?assignment=${assignmentId}&returnTo=${encodeURIComponent("https://outside.example")}`,
    `/client/workouts?assignment=${assignmentId}&returnTo=${encodeURIComponent(`/client/workouts?session=${sessionId}`)}`,
    `/client/workouts?assignment=${assignmentId}&unknown=1`,
    "/client/workouts?currentStart=opaque",
  ]) assert.equal(safeAuthReturnPath(value), fallback, value);
});
