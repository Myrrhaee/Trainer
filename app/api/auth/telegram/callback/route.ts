import { NextResponse } from "next/server";

import { resolveRequestActor } from "@/lib/server/auth/actor";
import {
  clearFederatedFlowCookie,
  readFederatedFlowCookie,
} from "@/lib/server/auth/federated/federated-cookie";
import { FederatedAuthService } from "@/lib/server/auth/federated/federated-service";
import { readSessionCookie, writeSessionCookie } from "@/lib/server/auth/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginRedirect(request: Request, outcome: "complete" | "error", returnPath?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("federated", outcome);
  url.searchParams.set("provider", "telegram");
  if (returnPath) url.searchParams.set("next", returnPath);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookie = await readFederatedFlowCookie();
  if (
    url.searchParams.has("error")
    || !cookie
    || !code
    || code.length > 4_096
    || !state
    || state.length > 256
  ) {
    await clearFederatedFlowCookie();
    return NextResponse.redirect(loginRedirect(request, "error", cookie?.returnPath));
  }

  const token = await readSessionCookie();
  const actor = token ? await resolveRequestActor() : null;
  const service = new FederatedAuthService();
  try {
    const context = await service.prepareTelegram({
      flowId: cookie.flowId,
      state,
      nonce: cookie.nonce,
      actor,
    });
    if (!context) {
      await clearFederatedFlowCookie();
      return NextResponse.redirect(loginRedirect(request, "error", cookie.returnPath));
    }
    const result = await service.completeTelegram({
      context,
      code,
      nonce: cookie.nonce,
      pkceVerifier: cookie.pkceVerifier,
      actor,
      currentSessionToken: token,
      requestOrigin: new URL(request.url).origin,
    });
    await clearFederatedFlowCookie();
    if (!result.ok) {
      return NextResponse.redirect(loginRedirect(request, "error", cookie.returnPath));
    }
    await writeSessionCookie(result.issued.token, result.issued.session.absoluteExpiresAt);
    return NextResponse.redirect(loginRedirect(request, "complete", cookie.returnPath));
  } catch {
    await clearFederatedFlowCookie();
    return NextResponse.redirect(loginRedirect(request, "error", cookie.returnPath));
  }
}
