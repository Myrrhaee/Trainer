import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { QuickAssignInvalidCursorError } from "@/lib/server/quick-assign/quick-assign-cursor";
import { QuickAssignQueryService } from "@/lib/server/quick-assign/quick-assign-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const actor = await resolveRequestActor();
  if (!actor) return json({ error: "unauthorized" }, 401);

  const { athleteId } = await params;
  if (!isUuid(athleteId)) return json({ error: "assignment_validation_failed" }, 400);
  const search = new URL(request.url).searchParams;
  const templateRevisionId = search.get("templateRevisionId");
  if (templateRevisionId && !isUuid(templateRevisionId)) {
    return json({ error: "assignment_validation_failed" }, 400);
  }
  const firstValue = search.get("first");
  const first = firstValue === null ? undefined : Number(firstValue);
  if (firstValue !== null && (!Number.isInteger(first) || Number(first) < 1)) {
    return json({ error: "assignment_validation_failed" }, 400);
  }

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") return json({ error: "assignment_forbidden" }, 403);
    const model = await new QuickAssignQueryService().find(actor, athleteId, {
      query: search.get("query") ?? "",
      after: search.get("cursor"),
      first,
      templateRevisionId,
    });
    if (!model) return json({ error: "assignment_forbidden" }, 404);
    return json({ quickAssign: model }, 200);
  } catch (error) {
    if (error instanceof QuickAssignInvalidCursorError) return json({ error: "invalid_cursor" }, 400);
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
