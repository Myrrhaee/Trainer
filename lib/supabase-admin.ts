import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Supabase client with service role key. Use only in server-side code (API routes, server components).
 * Bypasses RLS. Set SUPABASE_SERVICE_ROLE_KEY in env.
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  adminClient = createClient(supabaseUrl, serviceRoleKey);
  return adminClient;
}
