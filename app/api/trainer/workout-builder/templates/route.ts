import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import { workoutBuilderErrorResponse } from "@/lib/server/workouts/workout-builder-http";
import { WorkoutBuilderService } from "@/lib/server/workouts/workout-builder-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function trainerActor() {
  const actor = await resolveRequestActor();
  if (!actor) return null;
  return (await new AccessService().context(actor)).trainer?.status === "active" ? actor : null;
}

export async function GET() {
  try {
    const actor = await trainerActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const templates = await new WorkoutBuilderService().list(actor);
    return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request, 512 * 1024);
  if (!body) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  try {
    const actor = await trainerActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const result = await new WorkoutBuilderService().saveDraft(actor, body);
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return workoutBuilderErrorResponse(error);
  }
}
