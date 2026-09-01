import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ExerciseLibraryInvalidCursorError } from "@/lib/server/exercise-library/exercise-library-cursor";
import { ExerciseLibraryQueryService } from "@/lib/server/exercise-library/exercise-library-query-service";
import { ExerciseLibraryValidationError } from "@/lib/server/exercise-library/exercise-library-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) return json({ error: "unauthorized" }, 401);

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") return json({ error: "exercise_library_forbidden" }, 403);
    const search = new URL(request.url).searchParams;
    const firstValue = search.get("first");
    const model = await new ExerciseLibraryQueryService().list(actor, {
      query: search.get("q"),
      category: search.get("category"),
      equipment: search.get("equipment"),
      bodyRegion: search.get("bodyRegion"),
      scope: search.get("scope"),
      after: search.get("cursor"),
      first: firstValue === null ? undefined : Number(firstValue),
    });
    return json({ exerciseLibrary: model }, 200);
  } catch (error) {
    if (error instanceof ExerciseLibraryInvalidCursorError) return json({ error: "invalid_cursor" }, 400);
    if (error instanceof ExerciseLibraryValidationError) {
      return json({ error: "exercise_library_validation_failed" }, 400);
    }
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
