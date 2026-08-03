import type { ReactNode } from "react";

import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireCapability } from "@/lib/server/access/access-guard";

export default async function CanonicalClientLayout({ children }: { children: ReactNode }) {
  if (!isDemoModeEnabled()) await requireCapability("athlete", "/client/me");
  return children;
}
