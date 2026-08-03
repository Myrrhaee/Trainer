import { CanonicalWorkoutExecution } from "@/components/client/canonical-workout-execution";
import { DemoClientWorkoutsPage } from "@/components/demo/demo-client-cabinet";
import { ClientRuntimeWorkouts } from "@/components/client/runtime/client-runtime-workouts";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default async function ClientWorkoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (isDemoModeEnabled() && process.env.NEXT_PUBLIC_STAGE13_RUNTIME !== "false") {
    return <ClientRuntimeWorkouts actorId={single(query.actor) ?? "artem-smirnov"} assignmentId={single(query.assignment)} sessionId={single(query.session)} viewMode={single(query.view)} />;
  }
  if (isDemoModeEnabled()) return <DemoClientWorkoutsPage />;

  return <CanonicalWorkoutExecution assignmentId={single(query.assignment)} sessionId={single(query.session)} />;
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
