import { redirect } from "next/navigation";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { safeAuthReturnPath } from "@/lib/server/http/safe-return-path";

export const dynamic = "force-dynamic";

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await resolveRequestActor();
  const query = await searchParams;
  if (!actor) redirect(`/login?next=${encodeURIComponent(safeAuthReturnPath(query.next, "/onboarding"))}`);
  if (query.next) redirect(safeAuthReturnPath(query.next, "/onboarding"));
  const context = await new AccessService().context(actor);
  redirect(context.destination);
}
