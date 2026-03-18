import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Global singleton (survives module reloads / React Strict Mode)
const g = globalThis as unknown as {
  __supabaseBrowserClient?: SupabaseClient;
};

let browserClient: SupabaseClient | undefined;

export const createClient = () => {
  if (browserClient) return browserClient;
  if (g.__supabaseBrowserClient) {
    browserClient = g.__supabaseBrowserClient;
    return browserClient;
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    // Ensure session is persisted across reloads
    // (createBrowserClient accepts supabase-js options)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { auth: { persistSession: true } } as any,
  } as unknown as never) as unknown as SupabaseClient;
  g.__supabaseBrowserClient = browserClient;

  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("--- SINGLETON SUPABASE CLIENT INITIALIZED ---");
  }

  return browserClient;
};

// Backwards-compatible name (client components should migrate to createClient()).
export function getSupabaseClient() {
  return createClient();
}


