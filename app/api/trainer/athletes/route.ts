import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { WorkoutService } from "@/lib/server/workouts/workout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") {
      return NextResponse.json({ error: "trainer_not_active" }, { status: 403 });
    }
    const athletes = await new WorkoutService().listTrainerAthletes(actor);
    return NextResponse.json({ athletes }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
