import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  userId?: string;
  email?: string | null;
  fullName?: string | null;
  teamName?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("ensure-profile missing env:", {
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    // Service-role client bypasses RLS
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload: Record<string, unknown> = {
      id: userId,
      role: "trainer",
    };
    if (typeof body.email === "string") payload.email = body.email;
    // fullName → full_name
    if (typeof body.fullName === "string") payload.full_name = body.fullName;
    // teamName → display_name
    if (typeof body.teamName === "string") payload.display_name = body.teamName;

    // Supabase generated types may not include custom columns; keep payload flexible.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { error } = await admin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .upsert(payload as Record<string, unknown>);
    if (error) {
      console.error("ensure-profile upsert failed:", {
        message: error.message,
        details: (error as unknown as { details?: unknown }).details,
        hint: (error as unknown as { hint?: unknown }).hint,
        code: (error as unknown as { code?: unknown }).code,
        payload,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ensure-profile handler error:", e);
    return NextResponse.json(
      { error: (e as Error)?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

