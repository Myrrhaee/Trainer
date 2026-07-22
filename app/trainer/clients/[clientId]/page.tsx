import { ClientProfilePage } from "@/components/trainer-os/client-profile/client-profile-page";
import type { ProfileEntryInput } from "@/components/trainer-os/client-profile/profile-read-model";

type TrainerClientProfileRouteProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainerClientProfileRoute({ params, searchParams }: TrainerClientProfileRouteProps) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
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
