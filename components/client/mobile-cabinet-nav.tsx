"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Dumbbell, LayoutGrid, LineChart, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/client/me", label: "Главная", icon: LayoutGrid },
  { href: "/client/workouts", label: "Тренировки", icon: Dumbbell },
  { href: "/client/library", label: "Библиотека", icon: BookOpen },
  { href: "/client/activity", label: "Активность", icon: CalendarDays },
  { href: "/client/progress", label: "Прогресс", icon: LineChart },
  { href: "/client/settings", label: "Профиль", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/client/me") {
    return (
      pathname === "/client/me" ||
      pathname === "/client/dashboard" ||
      pathname === "/today" ||
      pathname.startsWith("/today/")
    );
  }

  return pathname === href;
}

export function MobileCabinetNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/90 bg-black/88 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
      aria-label="Client cabinet"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1rem] px-1 py-2 text-[11px] font-medium transition",
                active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl border transition",
                  active
                    ? "border-zinc-700 bg-zinc-900 text-zinc-50"
                    : "border-transparent bg-transparent text-zinc-500"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.85} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
