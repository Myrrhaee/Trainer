import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";
import {
  ReviewAlreadyResolvedError,
  ReviewIdempotencyConflictError,
} from "@/lib/server/reviews/review-repository";
import { ReviewService, ReviewValidationError } from "@/lib/server/reviews/review-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readSmallJsonObject(request);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const resolution = await new ReviewService().resolveManually(actor, sessionId, body);
    return resolution
      ? NextResponse.json({ resolution }, { status: 201 })
      : NextResponse.json({ error: "review_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ReviewAlreadyResolvedError || error instanceof ReviewIdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "42501") return NextResponse.json({ error: "review_forbidden" }, { status: 403 });
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
