import {
  trainerWorkflowHref,
  type TrainerWorkflowContext,
} from "@/lib/trainer-workflow-transition";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDOFF_PATTERN = /^[A-Za-z0-9_-]{20,160}$/;

export const QUICK_ASSIGN_HANDOFF_PARAM = "handoff";

export function quickAssignHref(input: {
  athleteUserId: string;
  context: TrainerWorkflowContext;
  handoffToken?: string | null;
}) {
  if (!UUID_PATTERN.test(input.athleteUserId)) throw new Error("invalid_quick_assign_athlete");
  if (input.context.athleteUserId && input.context.athleteUserId !== input.athleteUserId) {
    throw new Error("quick_assign_athlete_mismatch");
  }
  const path = `/trainer/clients/${input.athleteUserId}?tab=training&assign=1`;
  const href = trainerWorkflowHref(path, { ...input.context, athleteUserId: input.athleteUserId });
  if (!input.handoffToken) return href;
  if (!isQuickAssignHandoffToken(input.handoffToken)) throw new Error("invalid_quick_assign_handoff");
  const url = new URL(href, "http://trainer.local");
  url.searchParams.set(QUICK_ASSIGN_HANDOFF_PARAM, input.handoffToken);
  return `${url.pathname}${url.search}`;
}

export function isQuickAssignHandoffToken(value: unknown): value is string {
  return typeof value === "string" && HANDOFF_PATTERN.test(value);
}
