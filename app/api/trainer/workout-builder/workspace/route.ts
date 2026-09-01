import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { TemplateWorkspaceInvalidCursorError } from "@/lib/server/template-workspace/template-workspace-cursor";
import { TemplateWorkspaceQueryService } from "@/lib/server/template-workspace/template-workspace-query-service";
import { TemplateWorkspaceValidationError } from "@/lib/server/template-workspace/template-workspace-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) return json({ error: "unauthorized" }, 401);

  try {
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") {
      return json({ error: "template_workspace_forbidden" }, 403);
    }
    const search = new URL(request.url).searchParams;
    const first = search.get("limit") ?? search.get("first");
    const model = await new TemplateWorkspaceQueryService().list(actor, {
      status: search.get("status"),
      query: search.get("q"),
      category: search.get("category"),
      after: search.get("cursor"),
      first: first === null ? undefined : Number(first),
    });
    return json({ templateWorkspace: model }, 200);
  } catch (error) {
    if (error instanceof TemplateWorkspaceInvalidCursorError) {
      return json({ error: "invalid_cursor" }, 400);
    }
    if (error instanceof TemplateWorkspaceValidationError) {
      return json({ error: "invalid_filter" }, 400);
    }
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
