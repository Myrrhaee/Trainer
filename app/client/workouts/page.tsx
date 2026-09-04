import { CanonicalWorkoutExecution } from "@/components/client/canonical-workout-execution";
import { CanonicalClientHome } from "@/components/client/canonical-client-home";
import { DemoClientWorkoutsPage } from "@/components/demo/demo-client-cabinet";
import { ClientRuntimeWorkouts } from "@/components/client/runtime/client-runtime-workouts";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { safeClientReturn } from "@/lib/client-history-navigation";

export default async function ClientWorkoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (isDemoModeEnabled() && process.env.NEXT_PUBLIC_STAGE13_RUNTIME !== "false") {
    return <ClientRuntimeWorkouts actorId={single(query.actor) ?? "artem-smirnov"} assignmentId={single(query.assignment)} sessionId={single(query.session)} viewMode={single(query.view)} />;
  }
  if (isDemoModeEnabled()) return <DemoClientWorkoutsPage />;

  const assignmentId = single(query.assignment);
  const sessionId = single(query.session);
  if (query.assignment===undefined && query.session===undefined) return <CanonicalClientHome mode="collection" />;
  const invalid = [query.assignment,query.session,query.feedback,query.returnTo].some(value=>Array.isArray(value)) || query.assignment === "" || query.session === "";

  return (
    <CanonicalWorkoutExecution
      key={`${assignmentId??""}:${sessionId??""}:${single(query.feedback)??""}`}
      assignmentId={invalid?undefined:assignmentId}
      sessionId={invalid?"invalid":sessionId}
      feedbackId={single(query.feedback)}
      returnTo={safeClientReturn(single(query.returnTo))}
    />
  );
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
