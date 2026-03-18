import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Единственное хранилище инстанса — вне жизненного цикла React (избегаем дублирования в Strict Mode / Safari)
const g = globalThis as unknown as {
  __supabaseBrowserClient?: SupabaseClient;
};

export const createClient = (): SupabaseClient => {
  if (g.__supabaseBrowserClient) return g.__supabaseBrowserClient;

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    isSingleton: true,
  }) as unknown as SupabaseClient;

  g.__supabaseBrowserClient = client;
  return client;
};

// Backwards-compatible name (client components should migrate to createClient()).
export function getSupabaseClient() {
  return createClient();
}


