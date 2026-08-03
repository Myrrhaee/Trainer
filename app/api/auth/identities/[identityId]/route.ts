import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { PostgresFederatedAuthRepository } from "@/lib/server/auth/federated/federated-repository";
import { readSessionCookie, writeSessionCookie } from "@/lib/server/auth/session-cookie";
import { SessionService } from "@/lib/server/auth/session-service";
import { isSameOriginRequest } from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ identityId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = await readSessionCookie();
  const actor = token ? await resolveRequestActor() : null;
  if (!token || !actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { identityId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(identityId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const result = await new PostgresFederatedAuthRepository()
      .unlinkIdentity(actor.userId, identityId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason },
        { status: result.reason === "last_identity" ? 409 : 404 },
      );
    }
    const issued = await new SessionService().rotate(token);
    if (!issued) {
      return NextResponse.json({ error: "session_rotation_failed" }, { status: 503 });
    }
    await writeSessionCookie(issued.token, issued.session.absoluteExpiresAt);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
