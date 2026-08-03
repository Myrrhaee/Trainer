import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { PostgresFederatedAuthRepository } from "@/lib/server/auth/federated/federated-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const identities = await new PostgresFederatedAuthRepository().listIdentities(actor.userId);
    return NextResponse.json(
      { identities },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
