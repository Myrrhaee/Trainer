import type { User } from "@supabase/supabase-js";

export type DemoRole = "trainer" | "client";

type DemoSession = {
  role: DemoRole;
  userId: string;
  email: string;
  fullName: string;
};

const DEMO_STORAGE_KEY = "trainer-demo-session";

export const DEMO_TRAINER = {
  id: "demo-trainer-1",
  email: "admin.trainer@local.test",
  fullName: "Алексей Романов",
};

export const DEMO_CLIENT = {
  id: "demo-client-1",
  email: "admin.client@local.test",
  fullName: "Мария Волкова",
};

export function isDemoModeEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getDemoCredentials(role: DemoRole) {
  return role === "trainer" ? DEMO_TRAINER : DEMO_CLIENT;
}

export function createDemoSupabaseUser(role: DemoRole): User {
  const source = getDemoCredentials(role);
  return {
    id: source.id,
    email: source.email,
    aud: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: { provider: "demo", role },
    user_metadata: {
      full_name: source.fullName,
      demo_mode: true,
      role,
    },
    role: "authenticated",
  } as User;
}

export function resolveDemoLogin(
  rawLogin: string,
  role: DemoRole
): { role: DemoRole; email: string } | null {
  const normalized = rawLogin.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "admin") {
    const target = getDemoCredentials(role);
    return { role, email: target.email };
  }

  if (normalized === DEMO_TRAINER.email) {
    return { role: "trainer", email: DEMO_TRAINER.email };
  }

  if (normalized === DEMO_CLIENT.email) {
    return { role: "client", email: DEMO_CLIENT.email };
  }

  return null;
}

export function writeDemoSession(role: DemoRole) {
  if (typeof window === "undefined") return;
  const source = getDemoCredentials(role);
  const payload: DemoSession = {
    role,
    userId: source.id,
    email: source.email,
    fullName: source.fullName,
  };
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
}

export function readDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (
      (parsed.role === "trainer" || parsed.role === "client") &&
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.fullName === "string"
    ) {
      return parsed as DemoSession;
    }
  } catch {
    return null;
  }

  return null;
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}
