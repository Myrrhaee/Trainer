import { NextResponse } from "next/server";

import { isInvitationToken } from "@/lib/server/access/invitation-crypto";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { readSessionCookie, writeSessionCookie } from "@/lib/server/auth/session-cookie";
import { TelegramMiniAppAuthService } from "@/lib/server/auth/federated/telegram-mini-app-service";
import {
  isSameOriginRequest,
  readJsonObject,
  requestIpAddress,
} from "@/lib/server/http/request-security";
import { safeReturnPath } from "@/lib/server/http/safe-return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const currentToken = await readSessionCookie();
  if (currentToken && await resolveRequestActor()) {
    return NextResponse.json({ error: "already_authenticated" }, { status: 409 });
  }

  const body = await readJsonObject(request, 24 * 1024);
  const initData = typeof body?.initData === "string" ? body.initData : "";
  const requestedReturnPath = safeReturnPath(body?.returnPath, "/auth/continue");
  if (!initData || Buffer.byteLength(initData, "utf8") > 16 * 1024) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await new TelegramMiniAppAuthService().authenticate({
      initData,
      requestIp: requestIpAddress(request),
    });
    if (!result.ok) {
      const status = result.reason === "rate_limited"
        ? 429
        : result.reason === "provider_unavailable" ? 503 : 401;
      return NextResponse.json(
        { error: result.reason },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    await writeSessionCookie(result.issued.token, result.issued.session.absoluteExpiresAt);
    const destination = isInvitationToken(result.startParam)
      ? `/onboarding?invite=${encodeURIComponent(result.startParam)}`
      : requestedReturnPath;
    return NextResponse.json(
      { ok: true, destination },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
