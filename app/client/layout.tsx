import type { ReactNode } from "react";
import { headers } from "next/headers";

import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireCapability } from "@/lib/server/access/access-guard";
import { safeAuthReturnPath } from "@/lib/server/http/safe-return-path";

export default async function CanonicalClientLayout({ children }: { children: ReactNode }) {
  if (!isDemoModeEnabled()) {
    const requestHeaders = await headers();
    const returnPath = safeAuthReturnPath(requestHeaders.get("x-ai-canonical-return"), "/client/me");
    await requireCapability("athlete", returnPath);
  }
  return children;
}
