import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientWorkoutStartAttempt,
  reconcileClientWorkoutStart,
} from "../../lib/client-workout-start-command";
import type { ClientWorkoutExecutionReadModel } from "../../lib/server/client-workouts/client-workout-types";

const assignmentId = "11111111-1111-4111-8111-111111111111";

function execution(input: { session?: boolean; canStart?: boolean; assignmentId?: string } = {}): ClientWorkoutExecutionReadModel {
  const id = input.assignmentId ?? assignmentId;
  const sessionId = input.session ? "55555555-5555-4555-8555-555555555555" : null;
  return {
    identity: {
      assignmentId: id,
      sessionId,
      athleteUserId: "22222222-2222-4222-8222-222222222222",
    },
    assignment: {
      assignmentId: id,
      athleteUserId: "22222222-2222-4222-8222-222222222222",
      trainer: { displayName: "Trainer" },
      source: { templateId: "33333333-3333-4333-8333-333333333333", revisionId: "44444444-4444-4444-8444-444444444444", revisionNumber: 1 },
      scheduledFor: "2026-09-03",
      status: "available",
      relationStatus: "active",
      title: "Workout",
      generalInstruction: "",
      trainerNote: "",
      exercises: [],
      session: input.session ? { sessionId: "55555555-5555-4555-8555-555555555555", status: "active", version: 1, startedAt: "2026-09-03T10:00:00.000Z", completedAt: null } : null,
      capabilities: { canStart: input.canStart ?? !input.session, canResume: Boolean(input.session), canViewResult: false },
      createdAt: "2026-09-03T09:00:00.000Z",
    },
    session: input.session ? {
      id: "55555555-5555-4555-8555-555555555555",
      assignmentId: id,
      trainerUserId: "33333333-3333-4333-8333-333333333333",
      athleteUserId: "22222222-2222-4222-8222-222222222222",
      title: "Workout",
      status: "active",
      version: 1,
      clientTimezone: "UTC",
      startedAt: "2026-09-03T10:00:00.000Z",
      completedAt: null,
      exercises: [],
      attentionItemId: null,
      updatedAt: "2026-09-03T10:00:00.000Z",
    } : null,
    capabilities: {
      canEdit: Boolean(input.session),
      canSkip: Boolean(input.session),
      canResume: Boolean(input.session),
      canEnterCompletionFlow: Boolean(input.session),
    },
  };
}

test("start attempt freezes command identity and immutable payload", () => {
  const attempt = createClientWorkoutStartAttempt({
    assignmentId,
    clientTimezone: "Europe/Moscow",
    commandId: "command-r3b",
    startedAt: "2026-09-03T10:00:00.000Z",
  });
  assert.deepEqual(attempt, {
    assignmentId,
    clientTimezone: "Europe/Moscow",
    commandId: "command-r3b",
    startedAt: "2026-09-03T10:00:00.000Z",
  });
});

test("unknown start reconciliation accepts exact session, replays unchanged intent, or conflicts", () => {
  const attempt = createClientWorkoutStartAttempt({ assignmentId, clientTimezone: "UTC", commandId: "command-r3b", startedAt: "now" });
  assert.equal(reconcileClientWorkoutStart(attempt, execution({ session: true })), "accept");
  assert.equal(reconcileClientWorkoutStart(attempt, execution({ canStart: true })), "replay");
  assert.equal(reconcileClientWorkoutStart(attempt, execution({ canStart: false })), "conflict");
  assert.equal(reconcileClientWorkoutStart(attempt, execution({ assignmentId: "66666666-6666-4666-8666-666666666666" })), "conflict");
});
