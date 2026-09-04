import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ClientFeedbackRepository } from "@/lib/server/client-workouts/client-feedback-repository";
import { ClientHistoryInputError } from "@/lib/server/client-workouts/client-history-cursor";
import {
  ReviewService,
  ReviewValidationError,
} from "@/lib/server/reviews/review-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor();
    if (
      !actor ||
      (await new AccessService().context(actor)).athlete?.status !== "active"
    ) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers },
      );
    }
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some(
        (key) =>
          query.getAll(key).length !== 1 ||
          !["mode", "sessionId", "first", "after", "focus"].includes(key),
      )
    )
      throw new ClientHistoryInputError("invalid_feedback_query");
    const mode = query.get("mode");
    if (mode === "latest") {
      if (query.size !== 1)
        throw new ClientHistoryInputError("invalid_feedback_query");
      return NextResponse.json(
        { latest: await new ClientFeedbackRepository().latest(actor) },
        { headers },
      );
    }
    if (mode === "thread") {
      const thread = await new ClientFeedbackRepository().thread(
        actor,
        query.get("sessionId") ?? "",
        {
          first: query.get("first") ?? undefined,
          after: query.get("after") ?? undefined,
          focus: query.get("focus") ?? undefined,
        },
      );
      return thread
        ? NextResponse.json({ thread }, { headers })
        : NextResponse.json(
            { error: "workout_unavailable" },
            { status: 404, headers },
          );
    }
    if (mode || [...query.keys()].some((key) => key !== "sessionId"))
      throw new ClientHistoryInputError("invalid_feedback_query");
    const sessionId = query.get("sessionId") ?? undefined;
    const feedback = await new ReviewService().listAthleteFeedback(
      actor,
      sessionId,
    );
    return NextResponse.json(
      { feedback },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ClientHistoryInputError)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof ReviewValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers },
      );
    }
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers },
    );
  }
}
