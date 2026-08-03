import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import {
  WorkoutSessionService,
  WorkoutSessionValidationError,
} from "@/lib/server/workout-sessions/workout-session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).athlete?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const session = await new WorkoutSessionService().find(actor, sessionId);
    return session
      ? NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "session_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkoutSessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
