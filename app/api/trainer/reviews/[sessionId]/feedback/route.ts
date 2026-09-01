import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readJsonObject } from "@/lib/server/http/request-security";
import {
  ReviewAlreadyResolvedError,
  ReviewIdempotencyConflictError,
  ReviewInvalidFollowUpError,
} from "@/lib/server/reviews/review-repository";
import { ReviewService, ReviewValidationError } from "@/lib/server/reviews/review-service";
import { revalidateTrainerWorkflow } from "@/lib/server/trainer-workflow/revalidation";
import { TrainerWorkflowTransitionService } from "@/lib/server/trainer-workflow/trainer-workflow-transition-service";
import { decodeTrainerWorkflowContext } from "@/lib/trainer-workflow-transition";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(request, 16 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const service = new ReviewService();
    const feedback = await service.sendFeedback(actor, sessionId, body);
    if (!feedback) return NextResponse.json({ error: "review_not_found" }, { status: 404 });
    const review = await service.findReview(actor, sessionId);
    if (!review) return NextResponse.json({ error: "review_not_found" }, { status: 404 });
    const transition = await new TrainerWorkflowTransitionService().forReview(
      actor,
      review,
      decodeTrainerWorkflowContext(body.transitionContext),
      {
        kind: "review",
        entityId: feedback.id,
        title: feedback.kind === "follow_up" ? "Уточнение сохранено" : "Обратная связь сохранена",
        detail: `${review.athlete.displayName} · ${review.session.title}`,
        resolutionState: review.attention.status === "resolved" ? "resolved" : undefined,
      },
    );
    transition.refreshWarning = revalidateTrainerWorkflow(review.athlete.id) ?? undefined;
    return NextResponse.json({ feedback, transition }, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ReviewAlreadyResolvedError || error instanceof ReviewIdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ReviewInvalidFollowUpError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "42501") return NextResponse.json({ error: "review_forbidden" }, { status: 403 });
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
