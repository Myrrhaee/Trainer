import { redirect } from "next/navigation";

import { CanonicalAthleteProfile } from "@/components/trainer/canonical-athlete-profile";
import { ClientProfilePage } from "@/components/trainer-os/client-profile/client-profile-page";
import type { ProfileEntryInput } from "@/components/trainer-os/client-profile/profile-read-model";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireCapability } from "@/lib/server/access/access-guard";
import { AthleteProfileQueryService } from "@/lib/server/athlete-profile/athlete-profile-query-service";
import type { AthleteProfileTab } from "@/lib/server/athlete-profile/athlete-profile-types";

type TrainerClientProfileRouteProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainerClientProfileRoute({ params, searchParams }: TrainerClientProfileRouteProps) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  if (!isDemoModeEnabled()) {
    const { actor } = await requireCapability("trainer", "/trainer/clients");
    if (!isUuid(clientId)) redirect("/trainer/clients");
    const entry = {
      from: firstValue(query.from),
      attentionItem: uuidValue(firstValue(query.attentionItem)),
      entry: firstValue(query.entry),
    };
    const profile = await new AthleteProfileQueryService().find(actor, clientId, entry);
    if (!profile) redirect("/trainer/clients");
    return (
      <CanonicalAthleteProfile
        frame={profile.frame}
        overview={profile.overview}
        activeTab={profileTab(firstValue(query.tab))}
      />
    );
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

function profileTab(value: string | undefined): AthleteProfileTab {
  return value === "training" || value === "progress" ? value : "overview";
}

function uuidValue(value: string | undefined) {
  return value && isUuid(value) ? value : undefined;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
