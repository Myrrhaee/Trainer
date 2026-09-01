import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { AthleteTrainingInvalidCursorError } from "@/lib/server/athlete-profile/athlete-training-cursor";
import { AthleteTrainingQueryService } from "@/lib/server/athlete-profile/athlete-training-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { athleteId } = await params;
  if (!isUuid(athleteId)) return NextResponse.json({ error: "invalid_athlete" }, { status: 400 });
  const cursor = new URL(request.url).searchParams.get("cursor");

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") {
      return NextResponse.json({ error: "trainer_not_active" }, { status: 403 });
    }
    const result = await new AthleteTrainingQueryService().findHistoryPage(actor, athleteId, {
      first: 10,
      after: cursor,
    });
    if (!result) return NextResponse.json({ error: "athlete_not_found" }, { status: 404 });
    if (result.status === "unavailable") {
      return NextResponse.json({ error: "training_unavailable" }, { status: 403 });
    }
    return NextResponse.json(result.page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AthleteTrainingInvalidCursorError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
