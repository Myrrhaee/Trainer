import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import {
  ClientWorkoutInputError,
  ClientWorkoutQueryService,
} from "@/lib/server/client-workouts/client-workout-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).athlete?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const query = new URL(request.url).searchParams;
    const assignmentId = query.get("assignmentId") ?? undefined;
    const sessionId = query.get("sessionId") ?? undefined;
    const service = new ClientWorkoutQueryService();
    if (assignmentId || sessionId) {
      const execution = await service.execution(actor, { assignmentId, sessionId,
        completionCommandId: query.get("completionCommandId") ?? undefined,
        completionFingerprint: query.get("completionFingerprint") ?? undefined });
      return execution
        ? NextResponse.json({ execution }, { headers: { "Cache-Control": "no-store" } })
        : NextResponse.json({ error: "workout_unavailable" }, { status: 404 });
    }
    const collection = await service.collection(actor);
    return NextResponse.json({ collection }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ClientWorkoutInputError) {
      return NextResponse.json({ error: "workout_unavailable" }, { status: 404 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
