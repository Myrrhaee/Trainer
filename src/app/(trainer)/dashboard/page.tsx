"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Hammer,
  LayoutDashboard,
  Library,
  TrendingUp,
  UserRound,
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

type Priority = "urgent" | "warning" | "info";

const MOCK_URGENT = [
  {
    id: "u1",
    title: "Anna K. missed check-in window",
    detail: "No weight log in 5 days — follow up before next session.",
    priority: "urgent" as Priority,
  },
  {
    id: "u2",
    title: "Payment link expires tonight",
    detail: "Marco R. — program «Strength II», link closes 23:59.",
    priority: "warning" as Priority,
  },
];

const MOCK_WAITING = [
  { id: "w1", name: "Sofia L.", since: "3 days", plan: "Upper / hybrid" },
  { id: "w2", name: "Dmitry V.", since: "1 day", plan: "Deload week" },
  { id: "w3", name: "Elena P.", since: "Today", plan: "New client — intake done" },
];

const MOCK_RECENT = [
  { id: "r1", name: "Igor N.", workout: "Legs · week 3", time: "2h ago", status: "Completed" },
  { id: "r2", name: "Maria S.", workout: "Push · custom", time: "Yesterday", status: "Completed" },
  { id: "r3", name: "Paul T.", workout: "Full body", time: "Yesterday", status: "Logged late" },
];

const MOCK_SCHEDULE = [
  {
    id: "s1",
    label: "Moved",
    client: "Anna K.",
    text: "Tuesday leg day → Wednesday 07:30",
    priority: "warning" as Priority,
  },
  {
    id: "s2",
    label: "New",
    client: "Elena P.",
    text: "Intro session added Fri 18:00",
    priority: "info" as Priority,
  },
];

const MOCK_STATS = [
  { label: "Active clients", value: "24", hint: "vs last week" },
  { label: "Awaiting program", value: "3", hint: "needs assignment" },
  { label: "Sessions this week", value: "18", hint: "scheduled" },
  { label: "Completion rate", value: "87%", hint: "7-day" },
];

const ATTENTION_SNAPSHOT = [
  {
    id: "a1",
    label: "Needs attention now",
    value: "1",
    tone: "urgent" as Priority,
    hint: "urgent + time-sensitive",
  },
  {
    id: "a2",
    label: "Waiting for program",
    value: "3",
    tone: "warning" as Priority,
    hint: "assign workouts",
  },
  {
    id: "a3",
    label: "Schedule updates",
    value: "2",
    tone: "info" as Priority,
    hint: "since yesterday",
  },
];

function priorityStyles(p: Priority) {
  switch (p) {
    case "urgent":
      return {
        wrap: "border-rose-500/35 bg-gradient-to-br from-rose-950/50 to-zinc-950 shadow-[0_0_0_1px_rgba(244,63,94,0.12)]",
        badge: "border-rose-400/40 bg-rose-500/15 text-rose-100",
        icon: "text-rose-300",
      };
    case "warning":
      return {
        wrap: "border-amber-500/30 bg-gradient-to-br from-amber-950/35 to-zinc-950 shadow-[0_0_0_1px_rgba(245,158,11,0.1)]",
        badge: "border-amber-400/35 bg-amber-500/12 text-amber-100",
        icon: "text-amber-200",
      };
    default:
      return {
        wrap: "border-zinc-700/90 bg-zinc-950/80",
        badge: "border-zinc-600 bg-zinc-800/80 text-zinc-300",
        icon: "text-zinc-400",
      };
  }
}

function snapshotTone(tone: Priority) {
  switch (tone) {
    case "urgent":
      return "border-rose-500/30 bg-rose-950/25 text-rose-100";
    case "warning":
      return "border-amber-500/30 bg-amber-950/20 text-amber-100";
    default:
      return "border-zinc-700/90 bg-zinc-900/40 text-zinc-200";
  }
}

export default function TrainerDashboardPage() {
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
            <div className="mx-auto max-w-6xl">
              <header className="mb-8 flex flex-col gap-4 border-b border-zinc-800/80 pb-8 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Today
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                    Coaching dashboard
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                    Who needs you now, who is blocked on programming, and what moved on the
                    calendar.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white md:self-auto"
                >
                  Review queue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div
                className="mb-8 grid gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/20 p-4 md:grid-cols-3"
                role="group"
                aria-label="Attention snapshot"
              >
                {ATTENTION_SNAPSHOT.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      snapshotTone(row.tone)
                    )}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      {row.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
                      {row.value}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500/90">{row.hint}</p>
                  </div>
                ))}
              </div>

              <section className="mb-8" aria-labelledby="urgent-heading">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2
                    id="urgent-heading"
                    className="text-sm font-semibold tracking-tight text-zinc-200"
                  >
                    Urgent reminders
                  </h2>
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200">
                    Action
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-black/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  {MOCK_URGENT.map((item, index) => {
                    const s = priorityStyles(item.priority);
                    const isLast = index === MOCK_URGENT.length - 1;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex gap-0",
                          !isLast && "border-b border-zinc-800/80"
                        )}
                      >
                        <div
                          className={cn(
                            "w-1 shrink-0",
                            item.priority === "urgent"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 bg-zinc-950/40 p-5">
                          <div className="flex items-start gap-3">
                            <Bell className={cn("mt-0.5 h-5 w-5 shrink-0", s.icon)} aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-snug text-zinc-50">{item.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                {item.detail}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                s.badge
                              )}
                            >
                              {item.priority === "urgent" ? "Urgent" : "Warning"}
                            </span>
                            <button
                              type="button"
                              className="text-xs font-semibold text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="grid gap-8 lg:grid-cols-2">
                <section aria-labelledby="waiting-heading">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2
                      id="waiting-heading"
                      className="text-sm font-semibold tracking-tight text-zinc-200"
                    >
                      Waiting for workout assignment
                    </h2>
                    <span className="text-xs text-amber-200/90">Needs program</span>
                  </div>
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-1">
                    <ul className="divide-y divide-amber-500/10 rounded-xl bg-black/20" role="list">
                      {MOCK_WAITING.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start justify-between gap-4 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                              <UserRound className="h-4 w-4 text-amber-100" aria-hidden />
                            </span>
                            <div>
                              <p className="font-medium text-zinc-100">{row.name}</p>
                              <p className="mt-0.5 text-sm text-zinc-500">{row.plan}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-medium text-amber-100/90">Waiting</p>
                            <p className="text-xs text-zinc-500">{row.since}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section aria-labelledby="recent-heading">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2
                      id="recent-heading"
                      className="text-sm font-semibold tracking-tight text-zinc-200"
                    >
                      Recent completed client workouts
                    </h2>
                    <span className="text-xs text-zinc-500">Last 48h</span>
                  </div>
                  <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/25 p-1">
                    <ul className="divide-y divide-zinc-800/80 rounded-xl bg-black/15" role="list">
                      {MOCK_RECENT.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <CheckCircle2
                              className="h-5 w-5 shrink-0 text-emerald-400/90"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-100">{row.name}</p>
                              <p className="truncate text-sm text-zinc-500">{row.workout}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-zinc-400">{row.time}</p>
                            <p className="text-[11px] text-zinc-600">{row.status}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <section aria-labelledby="schedule-heading">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2
                      id="schedule-heading"
                      className="text-sm font-semibold tracking-tight text-zinc-200"
                    >
                      Schedule changes
                    </h2>
                    <CalendarClock className="h-4 w-4 text-zinc-500" aria-hidden />
                  </div>
                  <div className="space-y-3">
                    {MOCK_SCHEDULE.map((row) => {
                      const s = priorityStyles(row.priority);
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border p-4",
                            s.wrap
                          )}
                        >
                          <div className="mt-0.5 rounded-lg border border-zinc-700/80 bg-black/30 p-2">
                            <Calendar className="h-4 w-4 text-zinc-300" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-zinc-100">
                                {row.client}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  s.badge
                                )}
                              >
                                {row.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm text-zinc-400">{row.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="stats-heading">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2
                      id="stats-heading"
                      className="text-sm font-semibold tracking-tight text-zinc-200"
                    >
                      Quick stats
                    </h2>
                    <span className="text-xs text-zinc-500">Snapshot</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {MOCK_STATS.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                          {stat.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">{stat.hint}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
