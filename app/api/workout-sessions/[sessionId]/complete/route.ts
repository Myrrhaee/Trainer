import { NextResponse } from "next/server";
import { CompletionValidationError } from "@/lib/client-workout-completion-command";
import { revalidateTrainerWorkflow } from "@/lib/server/trainer-workflow/revalidation";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import {
  SessionIdempotencyConflictError,
  SessionVersionConflictError,
  ZeroResultConfirmationRequiredError,
} from "@/lib/server/workout-sessions/workout-session-repository";
import {
  WorkoutSessionService,
  WorkoutSessionValidationError,
} from "@/lib/server/workout-sessions/workout-session-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request, 32 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).athlete?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const session = await new WorkoutSessionService().complete(actor, sessionId, body);
    return session
      ? NextResponse.json({ session, refreshWarning: revalidateTrainerWorkflow(session.athleteUserId) ?? undefined })
      : NextResponse.json({ error: "active_session_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkoutSessionValidationError || error instanceof CompletionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SessionVersionConflictError || error instanceof SessionIdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ZeroResultConfirmationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "42501") return NextResponse.json({ error: "session_forbidden" }, { status: 403 });
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
