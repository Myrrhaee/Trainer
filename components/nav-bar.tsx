"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrainer } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-zinc-100 text-black"
          : "text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const { signOut } = useTrainer();

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-black/40 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-2xl bg-zinc-100/95 shadow-sm" />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Trainer
          </span>
        </div>
        <nav className="flex items-center gap-2 rounded-full border border-border/60 bg-zinc-950/60 px-1.5 py-1">
          <NavLink href="/dashboard" label="Клиенты" />
          <NavLink href="/dashboard/library" label="Библиотека" />
          <NavLink href="/dashboard/programs" label="Программы" />
          <NavLink href="/dashboard/analytics" label="Аналитика" />
          <NavLink href="/trainers" label="Найти тренера" />
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void signOut()}
          className="rounded-full text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          Выйти
        </Button>
      </div>
    </header>
  );
}

