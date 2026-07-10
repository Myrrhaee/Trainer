"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Dumbbell,
  FileText,
  MessageSquareText,
  Plus,
  Ruler,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type WeekDayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type EventKind = "workout" | "checkin" | "measurement" | "report" | "renewal" | "risk";
type EventStatus = "done" | "open" | "expected" | "risk";

type CalendarEvent = {
  id: string;
  day: WeekDayId;
  client: string;
  clientId: string;
  kind: EventKind;
  title: string;
  timeLabel: string;
  status: EventStatus;
  context: string;
  href: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

type UpcomingRisk = {
  id: string;
  inLabel: string;
  client: string;
  title: string;
  context: string;
  href: string;
};

const weekDays: Array<{ id: WeekDayId; label: string; date: string; accent?: boolean }> = [
  { id: "mon", label: "Пн", date: "15" },
  { id: "tue", label: "Вт", date: "16" },
  { id: "wed", label: "Ср", date: "17", accent: true },
  { id: "thu", label: "Чт", date: "18" },
  { id: "fri", label: "Пт", date: "19" },
  { id: "sat", label: "Сб", date: "20" },
  { id: "sun", label: "Вс", date: "21" },
];

const kindMeta: Record<EventKind, { label: string; icon: LucideIcon; chip: string }> = {
  workout: {
    label: "Тренировка",
    icon: Dumbbell,
    chip: "border-lime-300/18 bg-lime-300/10 text-lime-100",
  },
  checkin: {
    label: "Чек-ин",
    icon: MessageSquareText,
    chip: "border-cyan-300/18 bg-cyan-300/10 text-cyan-100",
  },
  measurement: {
    label: "Замеры",
    icon: Ruler,
    chip: "border-violet-300/18 bg-violet-300/10 text-violet-100",
  },
  report: {
    label: "Отчёт",
    icon: FileText,
    chip: "border-sky-300/18 bg-sky-300/10 text-sky-100",
  },
  renewal: {
    label: "Продление",
    icon: ShoppingBag,
    chip: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100",
  },
  risk: {
    label: "Риск",
    icon: AlertTriangle,
    chip: "border-amber-300/24 bg-amber-300/10 text-amber-100",
  },
};

const initialEvents: CalendarEvent[] = [
  {
    id: "mon-maria-workout",
    day: "mon",
    client: "Мария Волкова",
    clientId: "maria-volkova",
    kind: "workout",
    title: "Низ тела",
    timeLabel: "Завершена",
    status: "done",
    context: "Тренировка закрыта, можно сверить комментарий и вес в приседе.",
    href: "/trainer/clients/maria-volkova",
    actionLabel: "Открыть клиента",
    secondaryHref: "/trainer/review/maria-volkova-2026-06-09",
    secondaryLabel: "Открыть разбор",
  },
  {
    id: "mon-irina-report",
    day: "mon",
    client: "Ирина Козлова",
    clientId: "irina-kozlova",
    kind: "report",
    title: "Weekly review",
    timeLabel: "Отправлен",
    status: "done",
    context: "Отчёт ушёл клиенту, следующий фокус: стабильность техники жима.",
    href: "/trainer/clients/irina-kozlova",
    actionLabel: "Открыть клиента",
    secondaryHref: "/trainer/reports",
    secondaryLabel: "Открыть отчёты",
  },
  {
    id: "tue-artem-risk",
    day: "tue",
    client: "Артём Смирнов",
    clientId: "artem-smirnov",
    kind: "risk",
    title: "2 пропуска подряд",
    timeLabel: "Открыто",
    status: "risk",
    context: "Последняя активность 4 дня назад. Нужен короткий контакт до следующей тренировки.",
    href: "/trainer/clients/artem-smirnov",
    actionLabel: "Открыть клиента",
    secondaryHref: "/trainer/messages",
    secondaryLabel: "Написать",
  },
  {
    id: "wed-maria-checkin",
    day: "wed",
    client: "Мария Волкова",
    clientId: "maria-volkova",
    kind: "checkin",
    title: "Чек-ин",
    timeLabel: "15:00",
    status: "open",
    context: "Проверить сон, шаги и ощущение после нижней тренировки.",
    href: "/trainer/clients/maria-volkova#checkins",
    actionLabel: "Открыть клиента",
  },
  {
    id: "wed-artem-workout",
    day: "wed",
    client: "Артём Смирнов",
    clientId: "artem-smirnov",
    kind: "workout",
    title: "Грудь + спина",
    timeLabel: "Завершена",
    status: "open",
    context: "Высокий RPE и просадка повторов. Нужен разбор тренировки.",
    href: "/trainer/review/artem-smirnov-2026-06-10",
    actionLabel: "Открыть разбор",
    secondaryHref: "/trainer/clients/artem-smirnov",
    secondaryLabel: "Открыть клиента",
  },
  {
    id: "wed-irina-measurements",
    day: "wed",
    client: "Ирина Козлова",
    clientId: "irina-kozlova",
    kind: "measurement",
    title: "Замеры",
    timeLabel: "Ожидаются",
    status: "expected",
    context: "Клиент должна прислать фото и вес до конца дня.",
    href: "/trainer/clients/irina-kozlova#measurements",
    actionLabel: "Открыть клиента",
  },
  {
    id: "thu-egor-workout",
    day: "thu",
    client: "Егор Никитин",
    clientId: "egor-nikitin",
    kind: "workout",
    title: "Стартовая тренировка",
    timeLabel: "План",
    status: "open",
    context: "Новый клиент без программы. Нужно назначить первый тренировочный день.",
    href: "/trainer/builder?clientId=egor-nikitin",
    actionLabel: "Назначить тренировку",
    secondaryHref: "/trainer/clients/egor-nikitin",
    secondaryLabel: "Открыть клиента",
  },
  {
    id: "fri-dmitry-report",
    day: "fri",
    client: "Дмитрий Лебедев",
    clientId: "dmitry-lebedev",
    kind: "report",
    title: "Отчёт недели",
    timeLabel: "Нужно отправить",
    status: "open",
    context: "Неделя после командировки. В отчёте нужен фокус на сон и возврат ритма.",
    href: "/trainer/reports",
    actionLabel: "Открыть отчёты",
    secondaryHref: "/trainer/clients/dmitry-lebedev",
    secondaryLabel: "Открыть клиента",
  },
  {
    id: "sat-ekaterina-measurements",
    day: "sat",
    client: "Екатерина Морозова",
    clientId: "ekaterina-morozova",
    kind: "measurement",
    title: "Замеры просрочены",
    timeLabel: "10 дней",
    status: "risk",
    context: "Нет свежих показателей. Если не запросить сейчас, прогресс недели будет слепым.",
    href: "/trainer/clients/ekaterina-morozova#measurements",
    actionLabel: "Запросить замеры",
  },
  {
    id: "sun-renewal",
    day: "sun",
    client: "Анна Тарасова",
    clientId: "anna-tarasova",
    kind: "renewal",
    title: "Продление",
    timeLabel: "Через 2 дня",
    status: "open",
    context: "Период ведения заканчивается. Подготовить мягкое предложение продления.",
    href: "/trainer/sales",
    actionLabel: "Открыть продажи",
    secondaryHref: "/trainer/clients/anna-tarasova",
    secondaryLabel: "Открыть клиента",
  },
];

const upcomingRisks: UpcomingRisk[] = [
  {
    id: "risk-maria-measurements",
    inLabel: "Через 2 дня",
    client: "Мария Волкова",
    title: "Нет новых замеров",
    context: "Последний вес был неделю назад. Без замеров сложно обновить план.",
    href: "/trainer/clients/maria-volkova#measurements",
  },
  {
    id: "risk-program-end",
    inLabel: "Через 3 дня",
    client: "Артём Смирнов",
    title: "Заканчивается программа",
    context: "Нужно решить: делoad, новый блок или продление текущего цикла.",
    href: "/trainer/programs",
  },
  {
    id: "risk-report",
    inLabel: "Через 5 дней",
    client: "Дмитрий Лебедев",
    title: "Нужно отправить отчёт",
    context: "Клиент возвращается после нестабильной недели.",
    href: "/trainer/reports",
  },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function eventToneClasses(status: EventStatus) {
  switch (status) {
    case "done":
      return "border-lime-300/18 bg-lime-300/8";
    case "risk":
      return "border-amber-300/24 bg-amber-300/10";
    case "expected":
      return "border-violet-300/18 bg-violet-300/8";
    default:
      return "border-zinc-800 bg-black/20";
  }
}

function statusLabel(status: EventStatus) {
  if (status === "done") return "Закрыто";
  if (status === "risk") return "Требует внимания";
  if (status === "expected") return "Ожидается";
  return "Открыто";
}

export default function TrainerCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const todayEvents = useMemo(() => events.filter((event) => event.day === "wed"), [events]);
  const weekHealth = useMemo(() => {
    const done = events.filter((event) => event.status === "done").length;
    const attention = events.filter((event) => event.status === "risk" || event.status === "open").length;

    return {
      total: events.length,
      done,
      attention,
    };
  }, [events]);

  function eventsForDay(day: WeekDayId) {
    return events.filter((event) => event.day === day);
  }

  function markEventDone(eventId: string) {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, status: "done", timeLabel: "Закрыто" } : event
      )
    );
    setSelectedEvent((current) =>
      current?.id === eventId ? { ...current, status: "done", timeLabel: "Закрыто" } : current
    );
    toast.success("Событие отмечено выполненным");
  }

  return (
    <TrainerShell
      title="Календарь"
      description="Weekly Command Center: ритм недели, события клиентов и будущие риски."
      headerAction={
        <Button asChild className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex">
          <Link href="/trainer/builder">
            <Plus className="mr-2 h-4 w-4" />
            Назначить тренировку
          </Link>
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5">
        <section className="rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.12),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.94),rgba(3,7,18,0.98))] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">15-21 июня 2026</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Weekly Command Center</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Не расписание встреч, а пульт coaching-ритма: что важно сегодня, что будет завтра и где появятся риски.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <HealthMetric label="События" value={String(weekHealth.total)} helper="на неделе" />
              <HealthMetric label="Закрыто" value={String(weekHealth.done)} helper="ритм держится" />
              <HealthMetric label="Внимание" value={String(weekHealth.attention)} helper="нужны действия" hot />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="min-w-0 rounded-[1.85rem] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.99))] p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Week Timeline</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Что происходит на этой неделе</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(kindMeta).map(([kind, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <Badge key={kind} className={cn("rounded-full border px-2.5 py-1", meta.chip)}>
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid min-w-[900px] grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayEvents = eventsForDay(day.id);
                  return (
                    <section
                      key={day.id}
                      className={cn(
                        "min-h-[560px] rounded-[1.35rem] border p-3",
                        day.accent
                          ? "border-lime-300/22 bg-lime-300/7"
                          : "border-zinc-800/90 bg-black/18"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-white/7 pb-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{day.label}</p>
                          <p className="mt-0.5 text-xs text-zinc-600">июн {day.date}</p>
                        </div>
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-xs text-zinc-400">
                          {dayEvents.length}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {dayEvents.length > 0 ? (
                          dayEvents.map((event) => (
                            <CalendarEventCard
                              key={event.id}
                              event={event}
                              onOpen={() => setSelectedEvent(event)}
                              onDone={() => markEventDone(event.id)}
                            />
                          ))
                        ) : (
                          <div className="rounded-[1rem] border border-dashed border-zinc-800 bg-black/14 p-4 text-center text-sm text-zinc-600">
                            Нет coaching-событий
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/82 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Today Panel</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Сегодня</h2>
                </div>
                <CalendarClock className="h-5 w-5 text-lime-100" />
              </div>

              <div className="mt-4 space-y-3">
                {todayEvents.map((event) => {
                  const meta = kindMeta[event.kind];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      className="w-full rounded-[1.15rem] border border-zinc-800 bg-black/18 p-3 text-left transition hover:border-lime-300/24 hover:bg-lime-300/6"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", meta.chip)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-100">{event.client}</p>
                            <span className="text-xs text-zinc-500">{event.timeLabel}</span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">{meta.label}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{event.title}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-amber-300/14 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(9,9,11,0.98))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">Upcoming Risks</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Станет проблемой</h2>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-100" />
              </div>

              <div className="mt-4 space-y-3">
                {upcomingRisks.map((risk) => (
                  <Link
                    key={risk.id}
                    href={risk.href}
                    className="group block rounded-[1.15rem] border border-amber-300/14 bg-black/18 p-3 transition hover:bg-amber-300/8"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-100/70">
                      {risk.inLabel}
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{risk.client}</p>
                        <p className="mt-1 text-sm text-amber-50">{risk.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{risk.context}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-amber-100" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-lime-300/12 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),rgba(7,7,9,0.96))] p-4">
              <BarChart3 className="h-5 w-5 text-lime-100" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-50">Ритм недели</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {weekHealth.total} событий, {weekHealth.done} закрыто, {weekHealth.attention} требуют внимания.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button asChild className="h-9 rounded-full bg-lime-300 text-black hover:bg-lime-200">
                  <Link href="/trainer/dashboard">К очереди</Link>
                </Button>
                <Button asChild variant="outline" className="h-9 rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                  <Link href="/trainer/builder">Builder</Link>
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[500px]">
          {selectedEvent ? (
            <EventDrawerContent event={selectedEvent} onDone={() => markEventDone(selectedEvent.id)} />
          ) : (
            <SheetHeader>
              <SheetTitle>Событие</SheetTitle>
              <SheetDescription>Выберите событие в календаре.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </TrainerShell>
  );
}

function CalendarEventCard({
  event,
  onOpen,
  onDone,
}: {
  event: CalendarEvent;
  onOpen: () => void;
  onDone: () => void;
}) {
  const meta = kindMeta[event.kind];
  const Icon = meta.icon;

  return (
    <article className={cn("rounded-[1rem] border p-3", eventToneClasses(event.status))}>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn("rounded-full border px-2 py-0.5", meta.chip)}>
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {meta.label}
          </Badge>
          <span className="text-[11px] text-zinc-500">{event.timeLabel}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-zinc-50">{event.client}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{event.title}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600">{event.context}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onDone}
          disabled={event.status === "done"}
          className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-200 transition hover:bg-black/24 disabled:opacity-45"
        >
          Закрыть
        </button>
        <Link
          href={event.href}
          className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-200 transition hover:bg-black/24"
        >
          Действие
        </Link>
      </div>
    </article>
  );
}

function EventDrawerContent({ event, onDone }: { event: CalendarEvent; onDone: () => void }) {
  const meta = kindMeta[event.kind];
  const Icon = meta.icon;

  return (
    <div className="px-4">
      <SheetHeader className="px-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-black/24 text-lime-100">
          <Icon className="h-5 w-5" />
        </div>
        <SheetTitle className="mt-4 text-left text-2xl text-zinc-50">{event.title}</SheetTitle>
        <SheetDescription className="text-left text-zinc-400">
          {meta.label} · {statusLabel(event.status)}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-4">
        <section className="rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Клиент</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-100">
              {initials(event.client)}
            </div>
            <div>
              <p className="font-semibold text-zinc-100">{event.client}</p>
              <p className="text-sm text-zinc-500">{event.timeLabel}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Контекст</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{event.context}</p>
        </section>

        <div className="grid gap-2">
          <Button asChild className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
            <Link href={event.href}>
              {event.actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={event.status === "done"}
            className="h-11 rounded-full border-zinc-800 bg-black/18 text-zinc-100 hover:bg-zinc-900"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Отметить выполненным
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50">
            <Link href="/trainer/builder">
              <Dumbbell className="mr-2 h-4 w-4" />
              Назначить тренировку
            </Link>
          </Button>
          {event.secondaryHref ? (
            <Button asChild variant="ghost" className="h-11 rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50">
              <Link href={event.secondaryHref}>{event.secondaryLabel ?? "Открыть связанный раздел"}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  helper,
  hot = false,
}: {
  label: string;
  value: string;
  helper: string;
  hot?: boolean;
}) {
  return (
    <div className={cn("rounded-[1.35rem] border p-4", hot ? "border-amber-300/18 bg-amber-300/8" : "border-zinc-800 bg-black/22")}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{helper}</p>
    </div>
  );
}
