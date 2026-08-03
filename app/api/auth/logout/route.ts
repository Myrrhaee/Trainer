import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  readSessionCookie,
} from "@/lib/server/auth/session-cookie";
import { SessionService } from "@/lib/server/auth/session-service";
import { isSameOriginRequest } from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const token = await readSessionCookie();
  if (token) {
    try {
      await new SessionService().revoke(token, "logout");
    } catch {
      // Cookie clearing is still required when persistence is unavailable.
    }
  }
  await clearSessionCookie();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
