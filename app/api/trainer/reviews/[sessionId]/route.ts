import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ReviewService, ReviewValidationError } from "@/lib/server/reviews/review-service";
import { TrainerWorkflowTransitionService } from "@/lib/server/trainer-workflow/trainer-workflow-transition-service";
import { decodeTrainerWorkflowContext, TRAINER_WORKFLOW_CONTEXT_PARAM } from "@/lib/trainer-workflow-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { sessionId } = await context.params;
    const review = await new ReviewService().findReview(actor, sessionId);
    if (!review) return NextResponse.json({ error: "review_not_found" }, { status: 404 });
    const lastFeedback = review.existingFeedback[review.existingFeedback.length - 1];
    const transition = await new TrainerWorkflowTransitionService().forReview(
      actor,
      review,
      decodeTrainerWorkflowContext(new URL(request.url).searchParams.get(TRAINER_WORKFLOW_CONTEXT_PARAM)),
      lastFeedback
        ? {
            kind: "review",
            entityId: lastFeedback.id,
            title: "Обратная связь сохранена",
            detail: `${review.athlete.displayName} · ${review.session.title}`,
            resolutionState: review.attention.status === "resolved" ? "already_resolved" : undefined,
          }
        : review.attention.manualResolutionReason
          ? {
              kind: "manual_resolution",
              entityId: review.attention.id,
              title: "Разбор закрыт без сообщения",
              detail: review.attention.manualResolutionReason,
              resolutionState: "already_resolved",
            }
          : {
              kind: "current",
              entityId: review.attention.id,
              title: "Разбор открыт",
              detail: review.session.title,
            },
    );
    return NextResponse.json({ review, transition }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
