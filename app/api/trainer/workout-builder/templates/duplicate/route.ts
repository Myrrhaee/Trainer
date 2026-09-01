import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import { workoutBuilderErrorResponse } from "@/lib/server/workouts/workout-builder-http";
import { WorkoutBuilderService } from "@/lib/server/workouts/workout-builder-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request, 16 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const result = await new WorkoutBuilderService().duplicate(actor, body);
    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    return workoutBuilderErrorResponse(error);
  }
}
