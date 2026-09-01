import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import { WorkoutBuilderService, WorkoutBuilderValidationError } from "@/lib/server/workouts/workout-builder-service";
import { WorkoutBuilderCommandError } from "@/lib/server/workouts/workout-builder-repository";

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
  const body = await readJsonObject(request, 64 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const actor = await trainerActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const template = await new WorkoutBuilderService().saveDraft(actor, body);
    return template
      ? NextResponse.json({ template }, { status: 201 })
      : NextResponse.json({ error: "template_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkoutBuilderCommandError) {
      return NextResponse.json({ error: error.commandCode }, { status: 409 });
    }
    if (error instanceof WorkoutBuilderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
