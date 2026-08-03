import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { isSameOriginRequest } from "@/lib/server/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const actor = await resolveRequestActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const invitation = await new AccessService().createAthleteInvitation(actor);
    const origin = new URL(request.url).origin;
    const webInvitationUrl = `${origin}/onboarding?invite=${encodeURIComponent(invitation.token)}`;
    const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
    const telegramInvitationUrl = /^[A-Za-z0-9_]{5,32}$/.test(botUsername)
      ? `https://t.me/${botUsername}?startapp=${invitation.token}`
      : null;
    return NextResponse.json(
      {
        ok: true,
        invitationId: invitation.invitationId,
        expiresAt: invitation.expiresAt.toISOString(),
        invitationUrl: telegramInvitationUrl ?? webInvitationUrl,
        webInvitationUrl,
        telegramInvitationUrl,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    return NextResponse.json(
      { error: code === "42501" ? "trainer_not_active" : "temporarily_unavailable" },
      { status: code === "42501" ? 403 : 503 },
    );
  }
}
