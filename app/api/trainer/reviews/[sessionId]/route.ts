import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ReviewService, ReviewValidationError } from "@/lib/server/reviews/review-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const review = await new ReviewService().findReview(actor, sessionId);
    return review
      ? NextResponse.json({ review }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "review_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
