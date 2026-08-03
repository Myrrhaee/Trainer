import "server-only";

import { redirect } from "next/navigation";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { AccessService } from "@/lib/server/access/access-service";

export async function requireCapability(
  capability: "trainer" | "athlete",
  returnPath: string,
) {
  const actor = await resolveRequestActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const context = await new AccessService().context(actor);
  const profile = capability === "trainer" ? context.trainer : context.athlete;
  if (profile?.status !== "active") redirect("/onboarding");
  return { actor, context };
}
