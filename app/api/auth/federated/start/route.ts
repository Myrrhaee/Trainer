import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import { writeFederatedFlowCookie } from "@/lib/server/auth/federated/federated-cookie";
import {
  isFederatedProvider,
} from "@/lib/server/auth/federated/federated-config";
import { FederatedAuthService } from "@/lib/server/auth/federated/federated-service";
import { readSessionCookie } from "@/lib/server/auth/session-cookie";
import {
  isSameOriginRequest,
  readSmallJsonObject,
  requestIpAddress,
} from "@/lib/server/http/request-security";
import { safeReturnPath } from "@/lib/server/http/safe-return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await readSmallJsonObject(request);
  const provider = body?.provider;
  const intent = body?.intent === "link" ? "link" : "login";
  const returnPath = safeReturnPath(body?.returnPath, "/auth/continue");
  if (!isFederatedProvider(provider)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const token = await readSessionCookie();
  const actor = token ? await resolveRequestActor() : null;
  if ((intent === "link" && !actor) || (intent === "login" && actor)) {
    return NextResponse.json(
      { error: intent === "link" ? "unauthorized" : "already_authenticated" },
      { status: intent === "link" ? 401 : 409 },
    );
  }

  try {
    const result = await new FederatedAuthService().start({
      provider,
      intent,
      actor,
      requestIp: requestIpAddress(request),
      requestOrigin: new URL(request.url).origin,
    });
    if (!result.ok) {
      const status = result.reason === "rate_limited"
        ? 429
        : result.reason === "unauthorized" ? 401 : 503;
      return NextResponse.json(
        { error: result.reason },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.provider === "telegram") {
      await writeFederatedFlowCookie({ ...result.cookie, returnPath }, result.expiresAt);
      return NextResponse.json(
        { ok: true, provider: result.provider, authorizationUrl: result.authorizationUrl },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        provider: result.provider,
        flowId: result.flowId,
        nonce: result.nonce,
        clientId: result.clientId,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
