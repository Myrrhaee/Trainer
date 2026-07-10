export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** PostgREST/Supabase: в консоли второй аргумент часто ренерится как `{}` — логируйте через это. */
export function formatSupabaseError(err: unknown): string {
  if (err == null) return "unknown";
  if (typeof err !== "object") return String(err);
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(
    (x): x is string => typeof x === "string" && x.length > 0
  );
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(err);
}

export function logSupabaseError(context: string, err: unknown) {
  console.error(context, formatSupabaseError(err), err);
}

export function isSupabaseSchemaMismatch(err: unknown) {
  if (err == null || typeof err !== "object") return false;

  const e = err as {
    code?: string;
    message?: string;
  };

  if (e.code === "42703" || e.code === "PGRST205") {
    return true;
  }

  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

export function createSafeId() {
  if (
    typeof globalThis !== "undefined" &&
    "crypto" in globalThis &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
