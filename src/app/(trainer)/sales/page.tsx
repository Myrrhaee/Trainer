"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ExternalLink,
  Hammer,
  LayoutDashboard,
  Library,
  Pencil,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/trainer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trainer/clients", label: "Clients", icon: Users },
  { href: "/trainer/builder", label: "Builder", icon: Hammer },
  { href: "/trainer/calendar", label: "Calendar", icon: Calendar },
  { href: "/trainer/library", label: "Library", icon: Library },
  { href: "/trainer/sales", label: "Sales", icon: TrendingUp },
] as const;

type ProgramStatus = "draft" | "published";

type Program = {
  id: string;
  title: string;
  status: ProgramStatus;
  priceRub: number;
  description: string;
  salesPlaceholder: string;
};

const MOCK_PROGRAMS: Program[] = [
  {
    id: "p1",
    title: "Strength Block · 8 weeks",
    status: "published",
    priceRub: 4990,
    description: "Progressive overload template with deload — upper/lower split.",
    salesPlaceholder: "—",
  },
  {
    id: "p2",
    title: "Hypertrophy · Push / Pull / Legs",
    status: "published",
    priceRub: 3490,
    description: "Volume-focused mesocycle with optional cardio add-ons.",
    salesPlaceholder: "—",
  },
  {
    id: "p3",
    title: "Return to training · 4 weeks",
    status: "draft",
    priceRub: 1990,
    description: "Light re-entry after a break; editable exercise swaps.",
    salesPlaceholder: "—",
  },
  {
    id: "p4",
    title: "Conditioning + strength hybrid",
    status: "draft",
    priceRub: 2990,
    description: "Draft: mix of barbell work and short metcon finishers.",
    salesPlaceholder: "—",
  },
];

function formatPrice(rub: number) {
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

export default function TrainerSalesPage() {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-zinc-800/90 bg-black/40 px-3 py-6 md:flex md:flex-col">
          <div className="mb-8 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Trainer
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">Studio</p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5" aria-label="Trainer">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/trainer/dashboard" && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-zinc-800/90 bg-black/30 px-4 py-4 md:hidden">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Trainer
            </p>
            <nav
              className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Trainer"
            >
              {NAV.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                      active
                        ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 px-4 py-8 md:px-10 md:py-10 lg:px-14">
            <div className="mx-auto max-w-5xl">
              <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Programs
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                    Sales &amp; marketplace
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                    Publish workout programs to your storefront. Actions are UI-only until
                    checkout is wired.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_0_rgba(255,255,255,0.15)] transition hover:bg-emerald-400 active:scale-[0.99] sm:self-auto"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  New program
                </button>
              </header>

              <ul className="space-y-4" role="list">
                {MOCK_PROGRAMS.map((program) => {
                  const isPublished = program.status === "published";
                  return (
                    <li
                      key={program.id}
                      className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/60 via-zinc-950/80 to-black/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    >
                      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:gap-8">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
                              {program.title}
                            </h2>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                isPublished
                                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                                  : "border-zinc-600 bg-zinc-800/80 text-zinc-400"
                              )}
                            >
                              {isPublished ? "Published" : "Draft"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                            {program.description}
                          </p>
                          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                Price
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-50">
                                {formatPrice(program.priceRub)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                Sales (placeholder)
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-300">
                                {program.salesPlaceholder}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:flex-col lg:flex-row">
                          <button
                            type="button"
                            disabled={isPublished}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition",
                              isPublished
                                ? "cursor-not-allowed border border-zinc-800 bg-zinc-900/50 text-zinc-600"
                                : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                            )}
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            disabled={!isPublished}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition",
                              !isPublished
                                ? "cursor-not-allowed border border-zinc-800 bg-zinc-900/50 text-zinc-600"
                                : "border border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            )}
                          >
                            Unpublish
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <Link
                            href="/explore"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700/90 bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/80"
                          >
                            View marketplace
                            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
