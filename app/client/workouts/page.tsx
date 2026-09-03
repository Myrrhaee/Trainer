import { CanonicalWorkoutExecution } from "@/components/client/canonical-workout-execution";
import { CanonicalClientHome } from "@/components/client/canonical-client-home";
import { DemoClientWorkoutsPage } from "@/components/demo/demo-client-cabinet";
import { ClientRuntimeWorkouts } from "@/components/client/runtime/client-runtime-workouts";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default async function ClientWorkoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (isDemoModeEnabled() && process.env.NEXT_PUBLIC_STAGE13_RUNTIME !== "false") {
    return <ClientRuntimeWorkouts actorId={single(query.actor) ?? "artem-smirnov"} assignmentId={single(query.assignment)} sessionId={single(query.session)} viewMode={single(query.view)} />;
  }
  if (isDemoModeEnabled()) return <DemoClientWorkoutsPage />;

  const assignmentId = single(query.assignment);
  const sessionId = single(query.session);
  if (!assignmentId && !sessionId) return <CanonicalClientHome mode="collection" />;

  return (
    <CanonicalWorkoutExecution
      assignmentId={assignmentId}
      sessionId={sessionId}
      returnTo={safeReturnTo(single(query.returnTo))}
    />
  );
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

function safeReturnTo(value: string | undefined) {
  return value === "/client/workouts" ? value : "/client/me";
}
