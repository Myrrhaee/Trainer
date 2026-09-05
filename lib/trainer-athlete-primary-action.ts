export type TrainerAthletePrimaryActionDecision =
  | {
      kind: "review";
      sessionId: string;
      attentionItemId: string | null;
    }
  | { kind: "assign" }
  | null;

export type TrainerAthletePrimaryActionFacts = {
  relationStatus: "invited" | "active" | "suspended" | "ended";
  athleteStatus: "active" | "suspended" | "archived";
  currentAssignmentId: string | null;
  openReview: {
    sessionId: string;
    attentionItemId: string | null;
  } | null;
};

export function resolveTrainerAthletePrimaryAction(
  facts: TrainerAthletePrimaryActionFacts,
): TrainerAthletePrimaryActionDecision {
  if (facts.openReview) {
    return {
      kind: "review",
      sessionId: facts.openReview.sessionId,
      attentionItemId: facts.openReview.attentionItemId,
    };
  }

  if (
    facts.relationStatus === "active"
    && facts.athleteStatus === "active"
    && !facts.currentAssignmentId
  ) {
    return { kind: "assign" };
  }

  return null;
}
