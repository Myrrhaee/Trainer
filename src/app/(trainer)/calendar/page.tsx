"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  Hammer,
  LayoutDashboard,
  Library,
  Send,
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

const WEEK_RANGE = "24–30 марта";

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

type SessionKind = "normal" | "urgent" | "no_assignment" | "changed";

type WeekSession = {
  id: string;
  day: (typeof WEEK_DAYS)[number];
  time: string;
  client: string;
  trainingDay: string;
  kind: SessionKind;
};

/** MVP mock — replace with real data later. */
const MOCK_SESSIONS: WeekSession[] = [
  {
    id: "s1",
    day: "Пн",
    time: "07:30",
    client: "Anna K.",
    trainingDay: "Ноги · нед. 3",
    kind: "changed",
  },
  {
    id: "s2",
    day: "Пн",
    time: "18:00",
    client: "Marco R.",
    trainingDay: "Верх · силовая",
    kind: "normal",
  },
  {
    id: "s3",
    day: "Вт",
    time: "08:00",
    client: "Sofia L.",
    trainingDay: "—",
    kind: "no_assignment",
  },
  {
    id: "s4",
    day: "Ср",
    time: "12:15",
    client: "Dmitry V.",
    trainingDay: "Разгрузка · лёгкий",
    kind: "urgent",
  },
  {
    id: "s5",
    day: "Чт",
    time: "19:30",
    client: "Elena P.",
    trainingDay: "Знакомство",
    kind: "normal",
  },
  {
    id: "s6",
    day: "Пт",
    time: "07:00",
    client: "Igor N.",
    trainingDay: "Толкание · нед. 2",
    kind: "changed",
  },
  {
    id: "s7",
    day: "Сб",
    time: "11:00",
    client: "Maria S.",
    trainingDay: "Полное тело",
    kind: "urgent",
  },
];

const NEED_SEND = [
  { id: "n1", client: "Sofia L.", note: "Нет плана на эту неделю" },
  { id: "n2", client: "Paul T.", note: "Черновик готов — не отправлен" },
];

const SCHEDULE_CHANGES = [
  { id: "c1", text: "Anna K. · ноги перенесены с вт на пн 07:30" },
  { id: "c2", text: "Igor N. · пятница 07:00 вместо чт 19:00" },
];

function sessionCardClass(kind: SessionKind) {
  switch (kind) {
    case "urgent":
      return "border-rose-500/45 bg-gradient-to-b from-rose-950/40 to-zinc-950/80 shadow-[0_0_0_1px_rgba(244,63,94,0.12)]";
    case "no_assignment":
      return "border-dashed border-violet-400/35 bg-violet-950/15";
    case "changed":
      return "border-amber-400/35 bg-amber-950/20";
    default:
      return "border-zinc-700/90 bg-zinc-900/40";
  }
}

function sessionBadge(kind: SessionKind) {
  switch (kind) {
    case "urgent":
      return { label: "Срочно", className: "border-rose-400/40 bg-rose-500/15 text-rose-100" };
    case "no_assignment":
      return {
        label: "Нет задания",
        className: "border-violet-400/35 bg-violet-500/12 text-violet-100",
      };
    case "changed":
      return {
        label: "Изменено",
        className: "border-amber-400/35 bg-amber-500/12 text-amber-100",
      };
    default:
      return { label: "План", className: "border-zinc-600 bg-zinc-800/80 text-zinc-300" };
  }
}

function sessionsForDay(day: (typeof WEEK_DAYS)[number]) {
  return MOCK_SESSIONS.filter((s) => s.day === day);
}

export default function TrainerCalendarPage() {
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

          <main className="flex-1 px-4 py-8 md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
              <div className="min-w-0 flex-1">
                <header className="mb-6 flex flex-col gap-2 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Неделя
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                      Календарь тренировок
                    </h1>
                    <p className="mt-2 text-sm text-zinc-400">
                      {WEEK_RANGE} · время ориентировочное; блоки подсвечивают риски и
                      переносы.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-950/20 px-2 py-1 text-rose-200/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Срочно
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-950/20 px-2 py-1 text-violet-200/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      Нет задания
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-950/20 px-2 py-1 text-amber-200/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Изменение
                    </span>
                  </div>
                </header>

                <div
                  className="overflow-x-auto pb-2 [scrollbar-width:thin]"
                  role="region"
                  aria-label="Недельная сетка"
                >
                  <div className="flex min-w-[720px] gap-2 lg:min-w-0 lg:grid lg:grid-cols-7 lg:gap-3">
                    {WEEK_DAYS.map((day) => {
                      const items = sessionsForDay(day);
                      return (
                        <div
                          key={day}
                          className="flex w-[104px] shrink-0 flex-col rounded-2xl border border-zinc-800/80 bg-black/25 lg:w-auto"
                        >
                          <div className="border-b border-zinc-800/80 px-2 py-2.5 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                              {day}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-600">
                              {items.length ? `${items.length} слот` : "—"}
                            </p>
                          </div>
                          <div className="flex flex-1 flex-col gap-2 p-2">
                            {items.length === 0 ? (
                              <p className="py-6 text-center text-[11px] text-zinc-600">Пусто</p>
                            ) : (
                              items.map((s) => {
                                const badge = sessionBadge(s.kind);
                                return (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "rounded-xl border p-2.5",
                                      sessionCardClass(s.kind)
                                    )}
                                  >
                                    <p className="text-[11px] font-semibold tabular-nums text-zinc-300">
                                      {s.time}
                                    </p>
                                    <p className="mt-1 text-xs font-medium leading-tight text-zinc-50">
                                      {s.client}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">
                                      {s.trainingDay}
                                    </p>
                                    <span
                                      className={cn(
                                        "mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                        badge.className
                                      )}
                                    >
                                      {badge.label}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="w-full shrink-0 space-y-4 lg:w-[320px] xl:w-[340px]">
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-zinc-400" aria-hidden />
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                      Нужно отправить тренировку
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Клиенты без назначенного плана на ближайшие дни.
                  </p>
                  <ul className="mt-4 space-y-3" role="list">
                    {NEED_SEND.map((row) => (
                      <li
                        key={row.id}
                        className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-950/10 px-3 py-2.5"
                      >
                        <AlertCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/90"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100">{row.client}</p>
                          <p className="text-xs text-zinc-500">{row.note}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950/60 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                  >
                    Открыть очередь
                  </button>
                </div>

                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/30 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-zinc-400" aria-hidden />
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                      Изменения расписания
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Недавние переносы и правки времени.
                  </p>
                  <ul className="mt-4 space-y-2.5" role="list">
                    {SCHEDULE_CHANGES.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-3 py-2 text-sm text-amber-50/95"
                      >
                        {row.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
