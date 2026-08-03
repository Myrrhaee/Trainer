import { NextResponse } from "next/server";

import { federatedProviderAvailability } from "@/lib/server/auth/federated/provider-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { providers: federatedProviderAvailability() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
