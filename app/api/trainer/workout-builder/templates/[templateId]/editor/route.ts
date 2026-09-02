import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { WorkoutTemplateEditorQueryService } from "@/lib/server/template-editor/workout-template-editor-query-service";
import {
  WorkoutTemplateEditorNotFoundError,
  WorkoutTemplateEditorValidationError,
  WorkoutTemplateEditorViewUnavailableError,
} from "@/lib/server/template-editor/workout-template-editor-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const actor = await resolveRequestActor();
    if (!actor) return json({ error: "unauthorized" }, 401);
    const access = await new AccessService().context(actor);
    if (access.trainer?.status !== "active") return json({ error: "template_editor_forbidden" }, 403);
    const { templateId } = await params;
    const view = new URL(request.url).searchParams.get("view") ?? "default";
    const editor = await new WorkoutTemplateEditorQueryService().read(actor, templateId, view);
    return json({ editor }, 200);
  } catch (error) {
    if (error instanceof WorkoutTemplateEditorValidationError) {
      return error.code === "invalid_view"
        ? json({ error: "invalid_view" }, 400)
        : json({ error: "template_not_found" }, 404);
    }
    if (error instanceof WorkoutTemplateEditorNotFoundError) {
      return json({ error: "template_not_found" }, 404);
    }
    if (error instanceof WorkoutTemplateEditorViewUnavailableError) {
      return json({ error: error.code }, 409);
    }
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
