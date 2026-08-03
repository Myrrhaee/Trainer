import "server-only";

export function legacySupabaseOnboardingEnabled() {
  return process.env.NODE_ENV !== "production"
    && process.env.ENABLE_LEGACY_SUPABASE_ONBOARDING === "true";
}
