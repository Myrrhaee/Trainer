import { WorkoutReviewPage, type ReviewEntryInput } from "@/components/trainer-os/workout-review/workout-review-page";
import { CanonicalWorkoutReview } from "@/components/trainer/canonical-workout-review";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import {
  createTrainerWorkflowContext,
  encodeTrainerWorkflowContext,
  TRAINER_WORKFLOW_CONTEXT_PARAM,
} from "@/lib/trainer-workflow-transition";

export default async function TrainerWorkoutReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workoutId: sessionId }, query] = await Promise.all([params, searchParams]);
  const entry: ReviewEntryInput = {
    from: firstValue(query.from),
    attentionItem: firstValue(query.attentionItem),
    queue: firstValue(query.queue),
    position: firstValue(query.position),
    next: firstValue(query.next),
    returnTo: firstValue(query.returnTo),
  };

  const transitionContext = firstValue(query[TRAINER_WORKFLOW_CONTEXT_PARAM]) ?? encodeTrainerWorkflowContext(
    createTrainerWorkflowContext({
      origin: entry.from === "dashboard" ? "dashboard" : entry.from === "profile" ? "profile" : "direct",
      sourceAttentionItemId: entry.attentionItem,
      sourceSessionId: sessionId,
      queue: entry.from === "dashboard" ? { filter: "review", order: "priority" } : undefined,
      returnTo: entry.returnTo,
      returnAnchor: "workflow-receipt",
    }),
  );

  return isDemoModeEnabled()
    ? <WorkoutReviewPage workoutId={sessionId} entry={entry} />
    : <CanonicalWorkoutReview sessionId={sessionId} transitionContext={transitionContext} />;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
