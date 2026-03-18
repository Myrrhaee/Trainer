"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

export function ClientNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isExplore = pathname === "/explore" || pathname?.startsWith("/explore/");
  const [cabinetHref, setCabinetHref] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(!!session);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setCabinetHref(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = (data as { role?: string | null } | null)?.role ?? null;
      const href = role === "trainer" ? "/trainer/dashboard" : "/client/dashboard";
      if (!cancelled) setCabinetHref(href);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-black/80 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Логотип или название — можно заменить на Link на главную */}
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Тренировки
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {cabinetHref && (
            <Link
              href={cabinetHref}
              className="mr-1 inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/80 hover:text-zinc-100"
            >
              Личный кабинет
            </Link>
          )}
          <Link
            href="/explore"
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
              isExplore
                ? "bg-zinc-100 text-black"
                : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
            )}
            aria-label="Магазин"
          >
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Магазин</span>
          </Link>
          {hasSession && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="ml-1 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/80 hover:text-zinc-100"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
