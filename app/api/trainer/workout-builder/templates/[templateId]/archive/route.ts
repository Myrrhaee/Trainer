import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest } from "@/lib/server/http/request-security";
import { WorkoutBuilderService, WorkoutBuilderValidationError } from "@/lib/server/workouts/workout-builder-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ templateId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const actor = await resolveRequestActor();
    if (!actor || (await new AccessService().context(actor)).trainer?.status !== "active") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { templateId } = await context.params;
    const template = await new WorkoutBuilderService().archive(actor, templateId);
    return template
      ? NextResponse.json({ template })
      : NextResponse.json({ error: "template_not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof WorkoutBuilderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
