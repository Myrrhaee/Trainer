import assert from "node:assert/strict";
import test from "node:test";

import {
  createTrainerWorkflowContext,
  decodeTrainerWorkflowContext,
  encodeTrainerWorkflowContext,
  safeTrainerWorkflowDestination,
  trainerWorkflowHref,
} from "../../lib/trainer-workflow-transition";

const ATHLETE_ID = "11111111-1111-4111-8111-111111111111";
const ATTENTION_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

test("trainer workflow context round-trips canonical profile and queue state", () => {
  const context = createTrainerWorkflowContext({
    origin: "dashboard",
    athleteUserId: ATHLETE_ID,
    sourceAttentionItemId: ATTENTION_ID,
    sourceSessionId: SESSION_ID,
    queue: { filter: "review", order: "priority", position: 4 },
    returnTo: "/trainer/dashboard?filter=review&order=priority&position=4",
    returnAnchor: "workflow-receipt",
  });
  assert.deepEqual(decodeTrainerWorkflowContext(encodeTrainerWorkflowContext(context)), context);
  const href = trainerWorkflowHref(`/trainer/review/${SESSION_ID}`, context);
  const parsed = new URL(href, "http://trainer.local");
  assert.deepEqual(decodeTrainerWorkflowContext(parsed.searchParams.get("flow")), context);
});

test("trainer workflow context rejects external, cross-surface and malformed return targets", () => {
  assert.equal(safeTrainerWorkflowDestination("https://example.com/trainer/dashboard"), null);
  assert.equal(safeTrainerWorkflowDestination("//example.com/trainer/dashboard"), null);
  assert.equal(safeTrainerWorkflowDestination("/trainer/builder"), null);
  assert.equal(safeTrainerWorkflowDestination(`/trainer/clients/${ATHLETE_ID}?tab=progress`), null);
  assert.equal(safeTrainerWorkflowDestination("/trainer/dashboard?evil=1"), null);
  assert.equal(decodeTrainerWorkflowContext(JSON.stringify({ version: 1, origin: "dashboard", tab: "training", athleteUserId: "not-a-uuid" })), null);
});

test("invalid return context degrades to a direct safe context without retaining the URL", () => {
  const context = createTrainerWorkflowContext({
    origin: "dashboard",
    athleteUserId: ATHLETE_ID,
    returnTo: "https://attacker.example/collect",
  });
  assert.equal(context.returnTo, undefined);
  assert.equal(context.athleteUserId, ATHLETE_ID);
});

test("clients return context accepts bounded list state and rejects foreign focus", () => {
  const safe = `/trainer/clients?search=${encodeURIComponent("Артём")}&filter=attention&focus=row&athlete=${ATHLETE_ID}`;
  assert.equal(safeTrainerWorkflowDestination(safe), safe);
  assert.equal(safeTrainerWorkflowDestination("/trainer/clients?focus=row&athlete=foreign"), null);
  assert.equal(safeTrainerWorkflowDestination("/trainer/clients?search=x&unknown=1"), null);
});

test("review return context accepts only an exact canonical session route", () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";
  assert.equal(safeTrainerWorkflowDestination(`/trainer/review/${sessionId}`), `/trainer/review/${sessionId}`);
  assert.equal(safeTrainerWorkflowDestination(`/trainer/review/${sessionId}?next=/trainer/dashboard`), null);
  assert.equal(safeTrainerWorkflowDestination("/trainer/review/not-a-session"), null);
});
