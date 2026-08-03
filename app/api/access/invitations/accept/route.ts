import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readSmallJsonObject(request);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const result = await new AccessService().acceptAthleteInvitation(actor, body.token);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json(
      { ok: true, relationId: result.relation.id, retry: result.retry },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    const conflict = code === "23505" || code === "23514";
    return NextResponse.json(
      { error: conflict ? "relation_conflict" : "temporarily_unavailable" },
      { status: conflict ? 409 : 503 },
    );
  }
}
