import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import {
  WorkoutSessionService,
  WorkoutSessionValidationError,
} from "@/lib/server/workout-sessions/workout-session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function athleteActor() {
  const actor = await resolveRequestActor();
  if (!actor) return null;
  const access = await new AccessService().context(actor);
  return access.athlete?.status === "active" ? actor : null;
}

export async function GET() {
  try {
    const actor = await athleteActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const sessions = await new WorkoutSessionService().list(actor);
    return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request, 32 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const actor = await athleteActor();
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const result = await new WorkoutSessionService().start(actor, body);
    return result
      ? NextResponse.json(result, { status: result.outcome === "created" ? 201 : 200 })
      : NextResponse.json({ error: "assignment_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkoutSessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "42501") return NextResponse.json({ error: "session_forbidden" }, { status: 403 });
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
