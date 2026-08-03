import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { EmailOtpService } from "@/lib/server/auth/email/email-otp-service";
import { readSessionCookie, writeSessionCookie } from "@/lib/server/auth/session-cookie";
import {
  isSameOriginRequest,
  readSmallJsonObject,
} from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await readSmallJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const token = await readSessionCookie();
  const actor = token ? await resolveRequestActor() : null;

  try {
    const result = await new EmailOtpService().verify({
      challengeId: body.challengeId,
      email: body.email,
      code: body.code,
      actor,
      currentSessionToken: token,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "invalid_or_expired_code",
          remainingAttempts: result.remainingAttempts,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    await writeSessionCookie(result.issued.token, result.issued.session.absoluteExpiresAt);
    return NextResponse.json(
      { ok: true, intent: result.intent, isNewUser: result.isNewUser },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
