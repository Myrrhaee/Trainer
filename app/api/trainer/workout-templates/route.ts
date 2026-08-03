import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";
import { WorkoutService, WorkoutValidationError } from "@/lib/server/workouts/workout-service";

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
  const body = await readSmallJsonObject(request);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const auth = await activeTrainer();
    if (!auth.actor) {
      return NextResponse.json(
        { error: auth.status === 401 ? "unauthorized" : "trainer_not_active" },
        { status: auth.status },
      );
    }
    const template = await new WorkoutService().createTemplate(auth.actor, body);
    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkoutValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
