import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const TEST_PASSWORD = "0000";
const TEST_TRAINER = {
  email: "admin.trainer@local.test",
  role: "trainer" as const,
  full_name: "Admin Trainer",
  display_name: "Admin Team",
};
const TEST_CLIENT = {
  email: "admin.client@local.test",
  role: "client" as const,
  full_name: "Admin Client",
  display_name: "Client Team",
};

type AuthUser = {
  id: string;
  email?: string | null;
};

async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error("seed-test-users listUsers failed:", error.message);
    return null;
  }
  const found = (data.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
  );
  if (!found) return null;
  return { id: found.id, email: found.email };
}

async function ensureAuthUser(email: string): Promise<AuthUser | null> {
  const admin = getSupabaseAdmin();
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("seed-test-users createUser failed:", error?.message);
    return await getUserByEmail(email);
  }

  return { id: data.user.id, email: data.user.email };
}

async function ensureProfile(
  user: AuthUser,
  data: { role: "trainer" | "client"; full_name: string; display_name: string }
) {
  const admin = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    id: user.id,
    role: data.role,
    email: (user.email ?? "").toLowerCase(),
    full_name: data.full_name,
    display_name: data.display_name,
  };

  const { error } = await admin.from("profiles").upsert(payload as never);
  if (error) {
    console.error("seed-test-users upsert profile failed:", error.message);
    throw error;
  }
}

export async function POST() {
  try {
    const trainer = await ensureAuthUser(TEST_TRAINER.email);
    const client = await ensureAuthUser(TEST_CLIENT.email);

    if (!trainer || !client) {
      return NextResponse.json(
        { ok: false, error: "Failed to create test auth users" },
        { status: 500 }
      );
    }

    await ensureProfile(trainer, {
      role: TEST_TRAINER.role,
      full_name: TEST_TRAINER.full_name,
      display_name: TEST_TRAINER.display_name,
    });
    await ensureProfile(client, {
      role: TEST_CLIENT.role,
      full_name: TEST_CLIENT.full_name,
      display_name: TEST_CLIENT.display_name,
    });

    return NextResponse.json({
      ok: true,
      trainerEmail: TEST_TRAINER.email,
      clientEmail: TEST_CLIENT.email,
      password: TEST_PASSWORD,
      loginAlias: "admin",
    });
  } catch (e) {
    console.error("seed-test-users route failed:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

