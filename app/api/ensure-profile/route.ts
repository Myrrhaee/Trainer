import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  userId?: string;
  email?: string | null;
  fullName?: string | null;
  teamName?: string | null;
  trainerId?: string | null;
  role?: "client" | "trainer" | string | null;
};

export async function POST(req: Request) {
  console.log("[ensure-profile] POST called");
  try {
    const body = (await req.json()) as Body;
    const userId = body.userId?.trim();
    if (!userId) {
      console.log("[ensure-profile] Bad request: missing userId");
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    console.log("[ensure-profile] userId:", userId, "role from body:", body.role);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[ensure-profile] Missing env:", {
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }
    console.log("[ensure-profile] Env OK, creating admin client");

    // Service-role client bypasses RLS
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check if profile already exists
    const { data: existing, error: fetchError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[ensure-profile] Fetch existing profile failed:", fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const role =
      body.role === "trainer" || body.role === "client"
        ? body.role
        : "client";
    console.log("[ensure-profile] Profile exists:", !!existing, "will use role:", role);

    const payload: Record<string, unknown> = {
      id: userId,
      role,
    };
    if (typeof body.email === "string") payload.email = body.email.trim().toLowerCase();
    if (typeof body.fullName === "string") payload.full_name = body.fullName;
    if (typeof body.teamName === "string") payload.display_name = body.teamName;
    // Bind client to trainer only on first creation
    if (!existing && typeof body.trainerId === "string" && body.trainerId.trim()) {
      payload.trainer_id = body.trainerId.trim();
    }

    console.log("[ensure-profile] Upsert payload (no secrets):", {
      id: payload.id,
      role: payload.role,
      hasEmail: !!payload.email,
      hasFullName: !!payload.full_name,
      hasDisplayName: !!payload.display_name,
      hasTrainerId: !!payload.trainer_id,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { error } = await admin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .upsert(payload as Record<string, unknown>);
    if (error) {
      console.error("[ensure-profile] Upsert failed:", {
        message: error.message,
        code: (error as unknown as { code?: unknown }).code,
        payload: { id: payload.id, role: payload.role },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[ensure-profile] Success, profile ensured for:", userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ensure-profile] Handler error:", e);
    return NextResponse.json(
      { error: (e as Error)?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

