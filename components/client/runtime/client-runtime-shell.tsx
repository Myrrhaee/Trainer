"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowLeft, Dumbbell, Eye, Home, LineChart } from "lucide-react";

import { cn } from "@/lib/utils";

import { useClientRuntimeNavigation } from "./client-runtime-navigation";

const nav = [
  { href: "/client/me", label: "Главная", icon: Home },
  { href: "/client/workouts", label: "Тренировки", icon: Dumbbell },
  { href: "/client/activity", label: "Активность", icon: Activity },
  { href: "/client/progress", label: "Прогресс", icon: LineChart },
] as const;

type ClientRuntimeShellProps = {
  actorId: string;
  actorName: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ClientRuntimeShell({ actorId, actorName, title, description, children }: ClientRuntimeShellProps) {
  const pathname = usePathname();
  const navigation = useClientRuntimeNavigation(actorId);

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1480px]">
        <aside className="hidden w-24 shrink-0 border-r border-zinc-900 bg-zinc-950/85 px-4 py-5 lg:block">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-lime-200">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
          </div>
          <nav className="mt-6 space-y-2" aria-label="Кабинет клиента">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={navigation.href(href)}
                aria-label={label}
                title={label}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70",
                  pathname === href
                    ? "border-lime-300/20 bg-lime-300/12 text-lime-100"
                    : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-zinc-900 bg-black/90 px-4 py-3 backdrop-blur-xl lg:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase text-zinc-500">Личный кабинет клиента</p>
                <h1 className="mt-1 text-xl font-semibold text-zinc-50">{title}</h1>
                <p className="mt-1 text-sm text-zinc-400">{description}</p>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-100">{actorName}</p>
                  <p className="text-xs text-zinc-500">Кабинет спортсмена</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 py-5 lg:px-6 lg:py-6">
            {navigation.isTrainerPreview ? (
              <aside className="mb-5 flex flex-col gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-cyan-50 sm:flex-row sm:items-center sm:justify-between" aria-label="Режим предпросмотра клиента">
                <div className="flex min-w-0 items-start gap-3">
                  <Eye className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Предпросмотр кабинета клиента</p>
                    <p className="mt-1 text-sm text-cyan-100/65">Вы остаётесь в роли тренера. Это только предпросмотр кабинета спортсмена.</p>
                  </div>
                </div>
                <Link href={navigation.returnTo} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-200/20 px-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Вернуться в кабинет тренера
                </Link>
              </aside>
            ) : null}
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/92 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Кабинет клиента">
        <div className="mx-auto flex max-w-lg items-stretch gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={navigation.href(href)}
              className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px]", pathname === href ? "text-lime-100" : "text-zinc-500")}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
