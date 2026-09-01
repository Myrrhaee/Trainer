import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ExerciseLibraryQueryService } from "@/lib/server/exercise-library/exercise-library-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  const actor = await resolveRequestActor();
  if (!actor) return json({ error: "unauthorized" }, 401);
  const { exerciseId } = await params;
  if (!isUuid(exerciseId)) return json({ error: "exercise_not_found" }, 404);

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") return json({ error: "exercise_library_forbidden" }, 403);
    const detail = await new ExerciseLibraryQueryService().detail(actor, exerciseId);
    return detail
      ? json({ exercise: detail }, 200)
      : json({ error: "exercise_not_found" }, 404);
  } catch {
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
