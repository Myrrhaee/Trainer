import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isDemoModeEnabled } from "@/lib/demo-mode";
import { AccessService } from "@/lib/server/access/access-service";
import { requireCapability } from "@/lib/server/access/access-guard";

export default async function TrainerAthleteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  if (isDemoModeEnabled()) return children;

  const [{ actor }, { clientId }] = await Promise.all([
    requireCapability("trainer", "/trainer/clients"),
    params,
  ]);
  if (!await new AccessService().hasCurrentAthleteRelation(actor, clientId)) {
    redirect("/trainer/clients");
  }
  return children;
}
