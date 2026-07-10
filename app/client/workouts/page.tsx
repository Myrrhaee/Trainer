import { redirect } from "next/navigation";

import { DemoClientWorkoutsPage } from "@/components/demo/demo-client-cabinet";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export default function ClientWorkoutsPage() {
  if (isDemoModeEnabled()) {
    return <DemoClientWorkoutsPage />;
  }

  redirect("/today");
}
