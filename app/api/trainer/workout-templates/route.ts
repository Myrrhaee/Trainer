import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest } from "@/lib/server/http/request-security";
import { WorkoutService } from "@/lib/server/workouts/workout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function activeTrainer() {
  const actor = await resolveRequestActor();
  if (!actor) return { actor: null, status: 401 as const };
  const access = await new AccessService().context(actor);
  if (access.trainer?.status !== "active") return { actor: null, status: 403 as const };
  return { actor, status: 200 as const };
}

export async function GET() {
  try {
    const auth = await activeTrainer();
    if (!auth.actor) {
      return NextResponse.json(
        { error: auth.status === 401 ? "unauthorized" : "trainer_not_active" },
        { status: auth.status },
      );
    }
    const templates = await new WorkoutService().listTemplates(auth.actor);
    return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const auth = await activeTrainer();
  if (!auth.actor) {
    return NextResponse.json(
      { error: auth.status === 401 ? "unauthorized" : "trainer_not_active" },
      { status: auth.status },
    );
  }
  return NextResponse.json({ error: "legacy_template_mutation_removed" }, { status: 410 });
}
