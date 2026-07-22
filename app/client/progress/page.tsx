import { redirect } from "next/navigation";

import { DemoClientProgressPage } from "@/components/demo/demo-client-cabinet";
import { ClientRuntimeProgress } from "@/components/client/runtime/client-runtime-progress";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default async function ClientProgressPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (isDemoModeEnabled() && process.env.NEXT_PUBLIC_STAGE13_RUNTIME !== "false") {
    return <ClientRuntimeProgress actorId={single(query.actor) ?? "artem-smirnov"} />;
  }
  if (isDemoModeEnabled()) return <DemoClientProgressPage />;

  redirect("/history");
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
