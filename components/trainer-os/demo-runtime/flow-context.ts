import type { TrainerFlowContext, TrainerFlowSource } from "./types";

const sources: TrainerFlowSource[] = [
  "dashboard",
  "clients",
  "profile",
  "review",
  "quick-assign",
  "builder",
  "direct",
];

export function normalizeTrainerFlowContext(input: Partial<TrainerFlowContext>): TrainerFlowContext {
  return {
    source: sources.includes(input.source as TrainerFlowSource) ? input.source as TrainerFlowSource : "direct",
    athleteId: safeId(input.athleteId),
    attentionItemId: safeId(input.attentionItemId),
    workoutSessionId: safeId(input.workoutSessionId),
    workoutTemplateId: safeId(input.workoutTemplateId),
    returnTo: safeTrainerReturnPath(input.returnTo),
  };
}

export function safeTrainerReturnPath(value?: string) {
  return value && value.startsWith("/trainer/") && !value.startsWith("//") ? value : undefined;
}

function safeId(value?: string) {
  return value && /^[a-zA-Z0-9:_-]+$/.test(value) ? value : undefined;
}
