import { redirect } from "next/navigation";

import { DemoClientActivityPage } from "@/components/demo/demo-client-cabinet";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default function ClientActivityPage() {
  if (isDemoModeEnabled()) {
    return <DemoClientActivityPage />;
  }

  redirect("/history");
}
