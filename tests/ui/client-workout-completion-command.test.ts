import assert from "node:assert/strict";
import test from "node:test";
import { CompletionValidationError, completionLogicalRequest, createCompletionAttempt, normalizeCompletion, reconcileCompletion } from "../../lib/client-workout-completion-command";
import type { WorkoutSession } from "../../lib/server/workout-sessions/workout-session-types";

const session: WorkoutSession = { id: "session-one", assignmentId: "assignment-one", trainerUserId: "trainer", athleteUserId: "athlete",
  title: "Workout", status: "active", version: 5, clientTimezone: "UTC", startedAt: "2026-09-04T10:00:00Z", completedAt: null,
  exercises: [], attentionItemId: null, updatedAt: "2026-09-04T10:00:00Z" };
const input = { expectedVersion: 5, zeroResultConfirmed: false, zeroResultReason: "", discomfortReported: false };

test("R3D context requires a real boolean, preserves original lines and counts Unicode code points", () => {
  for (const value of [null, undefined, "false", 0]) assert.throws(() => normalizeCompletion({ ...input, discomfortReported: value }), CompletionValidationError);
  assert.throws(() => normalizeCompletion({ ...input, discomfortReported: true, discomfortComment: " \n\u00a0" }), CompletionValidationError);
  assert.equal(normalizeCompletion({ ...input, discomfortComment: "hidden stale text", overallComment: " \n " }).overallComment, null);
  assert.equal(normalizeCompletion({ ...input, discomfortComment: "hidden stale text" }).discomfortComment, null);
  assert.equal(normalizeCompletion({ ...input, discomfortReported: true, discomfortComment: "  Original\ntext  " }).discomfortComment, "Original\ntext");
  assert.equal(Array.from(normalizeCompletion({ ...input, overallComment: "\u{1f600}".repeat(2000) }).overallComment!).length, 2000);
  assert.throws(() => normalizeCompletion({ ...input, overallComment: "\u{1f600}".repeat(2001) }), CompletionValidationError);
  assert.throws(() => normalizeCompletion({ ...input, discomfortReported: true, discomfortComment: "a".repeat(1001) }), CompletionValidationError);
});

test("R3D logical identity includes every field and reconciliation never trusts context alone", async () => {
  const original = await createCompletionAttempt(session, input);
  const content = normalizeCompletion(input);
  assert.deepEqual(Object.keys(completionLogicalRequest(session.id, session.assignmentId, content)), ["sessionId", "assignmentId", "expectedVersion", "zeroResultConfirmed", "zeroResultReason", "overallComment", "discomfortReported", "discomfortComment"]);
  for (const patch of [{ zeroResultConfirmed: true }, { zeroResultReason: "new" }, { overallComment: "new" }, { discomfortReported: true, discomfortComment: "new" }]) {
    assert.notEqual((await createCompletionAttempt(session, { ...input, ...patch })).fingerprint, original.fingerprint);
  }
  assert.notEqual((await createCompletionAttempt({ ...session, version: 6 }, input)).fingerprint, original.fingerprint);
  assert.notEqual((await createCompletionAttempt({ ...session, assignmentId: "other" }, input)).fingerprint, original.fingerprint);
  const context = { overallComment: null, discomfortReported: false, discomfortComment: null, reviewQueued: false };
  assert.equal(reconcileCompletion(original, { ...session, completion: { ...context, correlation: "none" } }), "replay");
  assert.equal(reconcileCompletion(original, { ...session, version: 6, completion: { ...context, correlation: "none" } }), "conflict");
  for (const [correlation, expected] of [["own", "success"], ["equivalent", "already_completed"], ["different", "conflict"], ["none", "conflict"]] as const) {
    assert.equal(reconcileCompletion(original, { ...session, status: "completed", completion: { ...context, correlation } }), expected);
  }
  assert.equal(reconcileCompletion(original, { ...session, id: "foreign", completion: { ...context, correlation: "own" } }), "conflict");
  assert.ok(Object.isFrozen(original.frozenPayload));
});
