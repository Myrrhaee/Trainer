import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ relationId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readSmallJsonObject(request);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const { relationId } = await params;
    const relation = await new AccessService().transitionRelation(actor, relationId, body.status);
    if (!relation) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, relation });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json(
      { error: code === "23514" ? "invalid_transition" : "temporarily_unavailable" },
      { status: code === "23514" ? 409 : 503 },
    );
  }
}
