import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { EmailOtpService } from "@/lib/server/auth/email/email-otp-service";
import { readSessionCookie } from "@/lib/server/auth/session-cookie";
import {
  isSameOriginRequest,
  readSmallJsonObject,
  requestIpAddress,
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

  const intent = body.intent === "link" ? "link" : "login";
  const token = await readSessionCookie();
  const actor = token ? await resolveRequestActor() : null;
  if ((intent === "link" && !actor) || (intent === "login" && actor)) {
    return NextResponse.json(
      { error: intent === "link" ? "unauthorized" : "already_authenticated" },
      { status: intent === "link" ? 401 : 409 },
    );
  }

  try {
    const result = await new EmailOtpService().request(
      body.email,
      requestIpAddress(request),
      { intent, actor },
    );
    return NextResponse.json(
      {
        ok: true,
        challengeId: result.challengeId,
        retryAfterSeconds: result.retryAfterSeconds,
        ...(result.developmentCode ? { developmentCode: result.developmentCode } : {}),
      },
      {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
