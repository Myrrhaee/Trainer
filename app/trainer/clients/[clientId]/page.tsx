import { redirect } from "next/navigation";

import { CanonicalAthleteProfile } from "@/components/trainer/canonical-athlete-profile";
import { ClientProfilePage } from "@/components/trainer-os/client-profile/client-profile-page";
import type { ProfileEntryInput } from "@/components/trainer-os/client-profile/profile-read-model";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireCapability } from "@/lib/server/access/access-guard";
import { ReviewService } from "@/lib/server/reviews/review-service";
import { WorkoutService } from "@/lib/server/workouts/workout-service";

type TrainerClientProfileRouteProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainerClientProfileRoute({ params, searchParams }: TrainerClientProfileRouteProps) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  if (!isDemoModeEnabled()) {
    const { actor } = await requireCapability("trainer", "/trainer/clients");
    const [athletes, reviews] = await Promise.all([
      new WorkoutService().listTrainerAthletes(actor),
      new ReviewService().listQueue(actor),
    ]);
    const athlete = athletes.find((item) => item.athleteUserId === clientId);
    if (!athlete) redirect("/trainer/clients");
    const review = reviews.find((item) => item.athleteUserId === clientId) ?? null;
    return <CanonicalAthleteProfile athlete={athlete} review={review} />;
  }

  const entry: ProfileEntryInput = {
    from: firstValue(query.from),
    attention: firstValue(query.attention),
    attentionItem: firstValue(query.attentionItem),
    entry: firstValue(query.entry),
  };

  return <ClientProfilePage clientId={clientId} entry={entry} initialQuickAssignOpen={firstValue(query.research) === "1" && firstValue(query.quickAssign) === "1"} />;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
