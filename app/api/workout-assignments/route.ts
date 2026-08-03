import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";
import { WorkoutService, WorkoutValidationError } from "@/lib/server/workouts/workout-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const access = await new AccessService().context(actor);
    if (access.athlete?.status !== "active") {
      return NextResponse.json({ error: "athlete_not_active" }, { status: 403 });
    }
    const assignments = await new WorkoutService().listAthleteAssignments(actor);
    return NextResponse.json({ assignments }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readSmallJsonObject(request);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") {
      return NextResponse.json({ error: "trainer_not_active" }, { status: 403 });
    }
    const assignment = await new WorkoutService().createAssignment(actor, body);
    if (!assignment) {
      return NextResponse.json({ error: "athlete_or_template_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkoutValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "42501") {
      return NextResponse.json({ error: "assignment_forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
