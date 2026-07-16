import { WorkoutReviewPage, type ReviewEntryInput } from "@/components/trainer-os/workout-review/workout-review-page";

export default async function TrainerWorkoutReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workoutId }, query] = await Promise.all([params, searchParams]);
  const entry: ReviewEntryInput = {
    from: firstValue(query.from),
    attentionItem: firstValue(query.attentionItem),
    queue: firstValue(query.queue),
    position: firstValue(query.position),
    next: firstValue(query.next),
  };

  return <WorkoutReviewPage workoutId={workoutId} entry={entry} />;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
