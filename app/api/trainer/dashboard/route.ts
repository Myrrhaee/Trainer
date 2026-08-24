import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { TrainerDashboardRepository } from "@/lib/server/trainer-dashboard/trainer-dashboard-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const snapshot = await new TrainerDashboardRepository().snapshot(actor);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
