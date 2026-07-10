import { WorkoutReviewClient } from "./workout-review-client";

export default async function TrainerWorkoutReviewPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;

  return <WorkoutReviewClient workoutId={workoutId} />;
}
