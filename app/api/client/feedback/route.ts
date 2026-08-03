import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ReviewService, ReviewValidationError } from "@/lib/server/reviews/review-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).athlete?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? undefined;
    const feedback = await new ReviewService().listAthleteFeedback(actor, sessionId);
    return NextResponse.json({ feedback }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
