import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest, readSmallJsonObject } from "@/lib/server/http/request-security";
import { PostgresUserRepository } from "@/lib/server/users/user-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizedDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 2 && normalized.length <= 120 ? normalized : null;
}

export async function GET() {
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const profile = await new PostgresUserRepository().findCurrent(actor);
    return profile
      ? NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readSmallJsonObject(request);
  const displayName = normalizedDisplayName(body?.displayName);
  if (!displayName) return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  try {
    const profile = await new PostgresUserRepository().updateDisplayName(actor, displayName);
    return profile
      ? NextResponse.json({ profile })
      : NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
