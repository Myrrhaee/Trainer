import { redirect } from "next/navigation";

import { DemoClientProgressPage } from "@/components/demo/demo-client-cabinet";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default function ClientProgressPage() {
  if (isDemoModeEnabled()) {
    return <DemoClientProgressPage />;
  }

  redirect("/history");
}
