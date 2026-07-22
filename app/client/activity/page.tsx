import { redirect } from "next/navigation";

import { DemoClientActivityPage } from "@/components/demo/demo-client-cabinet";
import { ClientRuntimeActivity } from "@/components/client/runtime/client-runtime-activity";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default async function ClientActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (isDemoModeEnabled() && process.env.NEXT_PUBLIC_STAGE13_RUNTIME !== "false") {
    return <ClientRuntimeActivity actorId={single(query.actor) ?? "artem-smirnov"} />;
  }
  if (isDemoModeEnabled()) return <DemoClientActivityPage />;

  redirect("/history");
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
