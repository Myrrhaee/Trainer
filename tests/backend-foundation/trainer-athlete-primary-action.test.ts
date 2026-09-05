import assert from "node:assert/strict";
import test from "node:test";

import { resolveTrainerAthletePrimaryAction } from "../../lib/trainer-athlete-primary-action";

const active = {
  relationStatus: "active" as const,
  athleteStatus: "active" as const,
  currentAssignmentId: null,
  openReview: null,
};

test("shared trainer-athlete primary action follows one cross-surface priority contract", () => {
  assert.equal(resolveTrainerAthletePrimaryAction({
    ...active,
    openReview: { sessionId: "session-review", attentionItemId: "attention-review" },
  })?.kind, "review");

  assert.equal(resolveTrainerAthletePrimaryAction({
    ...active,
    openReview: { sessionId: "session-discomfort", attentionItemId: "attention-discomfort" },
  })?.kind, "review");

  assert.deepEqual(resolveTrainerAthletePrimaryAction(active), { kind: "assign" });
  assert.equal(resolveTrainerAthletePrimaryAction({
    ...active,
    currentAssignmentId: "assignment-current",
  }), null);
  assert.equal(resolveTrainerAthletePrimaryAction({
    ...active,
    currentAssignmentId: "assignment-next",
  }), null);

  assert.deepEqual(resolveTrainerAthletePrimaryAction({
    ...active,
    relationStatus: "suspended",
    openReview: { sessionId: "session-historical", attentionItemId: "attention-historical" },
  }), {
    kind: "review",
    sessionId: "session-historical",
    attentionItemId: "attention-historical",
  });
  assert.equal(resolveTrainerAthletePrimaryAction({
    ...active,
    relationStatus: "suspended",
  }), null);
});
