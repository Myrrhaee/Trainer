"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Dumbbell,
  MessageCircle,
  PauseCircle,
  RadioTower,
  Ruler,
  Search,
  ShoppingBag,
  TimerReset,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CanonicalReviewQueue } from "@/components/trainer/canonical-review-queue";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";

type AttentionCategory = "training" | "progress" | "communication" | "programs" | "business";
type AttentionPriority = "high" | "medium" | "low";
type AttentionStatus = "open" | "in-progress" | "snoozed" | "done";
type AttentionFilter =
  | "all"
  | "open"
  | "today"
  | "high"
  | "training"
  | "progress"
  | "communication"
  | "programs"
  | "business"
  | "snoozed"
  | "done";

type AttentionItem = {
  id: string;
  client: string;
  clientId: string;
  goal: string;
  category: AttentionCategory;
  reason: string;
  detail: string;
  priority: AttentionPriority;
  dateLabel: string;
  createdBy: "automation" | "manual";
  status: AttentionStatus;
  actionLabel: string;
  actionHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  context: {
    lastActivity: string;
    weight: string;
    program: string;
    note: string;
  };
  snoozeLabel?: string;
};

const categoryMeta: Record<AttentionCategory, { label: string; icon: LucideIcon; chip: string }> = {
  training: {
    label: "Тренировки",
    icon: Dumbbell,
    chip: "border-lime-300/18 bg-lime-300/10 text-lime-100",
  },
  progress: {
    label: "Прогресс",
    icon: Ruler,
    chip: "border-violet-300/18 bg-violet-300/10 text-violet-100",
  },
  communication: {
    label: "Коммуникация",
    icon: MessageCircle,
    chip: "border-cyan-300/18 bg-cyan-300/10 text-cyan-100",
  },
  programs: {
    label: "Программы",
    icon: ClipboardList,
    chip: "border-sky-300/18 bg-sky-300/10 text-sky-100",
  },
  business: {
    label: "Бизнес",
    icon: ShoppingBag,
    chip: "border-emerald-300/18 bg-emerald-300/10 text-emerald-100",
  },
};

const initialAttentionItems: AttentionItem[] = [
  {
    id: "maria-measurements",
    client: "Мария Волкова",
    clientId: "maria-volkova",
    goal: "Снижение веса",
    category: "progress",
    reason: "Нет новых замеров",
    detail: "10 дней без обновлений. Следующая корректировка плана будет вслепую.",
    priority: "high",
    dateLabel: "Сегодня",
    createdBy: "automation",
    status: "open",
    actionLabel: "Запросить замеры",
    actionHref: "/trainer/messages",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/maria-volkova",
    context: {
      lastActivity: "12 дней назад",
      weight: "68.4 кг",
      program: "Сушка 8 недель",
      note: "Хороший adherence, но прогресс нельзя оценить без фото и веса.",
    },
  },
  {
    id: "artem-review",
    client: "Артём Смирнов",
    clientId: "artem-smirnov",
    goal: "Набор массы",
    category: "training",
    reason: "Тренировка ждёт разбора",
    detail: "Завершена сегодня. RPE 9, в жиме минус 2 повтора от плана.",
    priority: "high",
    dateLabel: "Сегодня",
    createdBy: "automation",
    status: "open",
    actionLabel: "Открыть разбор",
    actionHref: "/trainer/review/artem-smirnov-2026-06-10",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/artem-smirnov",
    context: {
      lastActivity: "Сегодня",
      weight: "74.2 кг",
      program: "Набор массы",
      note: "Нужна быстрая обратная связь, чтобы клиент понял, что делать на следующей тренировке.",
    },
  },
  {
    id: "irina-program-end",
    client: "Ирина Козлова",
    clientId: "irina-kozlova",
    goal: "Сила и техника",
    category: "programs",
    reason: "Программа заканчивается",
    detail: "Через 4 дня заканчивается текущий блок. Нужно решить следующий цикл.",
    priority: "medium",
    dateLabel: "Через 4 дня",
    createdBy: "automation",
    status: "in-progress",
    actionLabel: "Продлить программу",
    actionHref: "/trainer/programs",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/irina-kozlova",
    context: {
      lastActivity: "Вчера",
      weight: "61.8 кг",
      program: "Сила 6 недель",
      note: "Техника стабильна, можно переходить к новому силовому блоку.",
    },
  },
  {
    id: "egor-no-program",
    client: "Егор Никитин",
    clientId: "egor-nikitin",
    goal: "Старт с нуля",
    category: "programs",
    reason: "Нет программы",
    detail: "Новый клиент прошёл анкету, но стартовый план ещё не назначен.",
    priority: "high",
    dateLabel: "Сегодня",
    createdBy: "manual",
    status: "open",
    actionLabel: "Назначить программу",
    actionHref: "/trainer/builder?clientId=egor-nikitin",
    secondaryLabel: "Открыть анкету",
    secondaryHref: "/trainer/clients/egor-nikitin",
    context: {
      lastActivity: "Анкета сегодня",
      weight: "82.0 кг",
      program: "Не назначена",
      note: "Есть ограничение по колену, первый блок нужен спокойный и понятный.",
    },
  },
  {
    id: "dmitry-message",
    client: "Дмитрий Лебедев",
    clientId: "dmitry-lebedev",
    goal: "Вернуть ритм",
    category: "communication",
    reason: "Ждёт ответа",
    detail: "Клиент написал про командировку и просит адаптировать неделю.",
    priority: "medium",
    dateLabel: "2 часа назад",
    createdBy: "manual",
    status: "open",
    actionLabel: "Написать",
    actionHref: "/trainer/messages",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/dmitry-lebedev",
    context: {
      lastActivity: "2 часа назад",
      weight: "89.1 кг",
      program: "Full Body 3x",
      note: "Лучше дать короткий план на неделю, а не ждать полноценного отчёта.",
    },
  },
  {
    id: "ekaterina-checkin",
    client: "Екатерина Морозова",
    clientId: "ekaterina-morozova",
    goal: "Композиция тела",
    category: "progress",
    reason: "Нет чек-ина",
    detail: "Просрочен weekly check-in. Последний отчёт был 8 дней назад.",
    priority: "medium",
    dateLabel: "Вчера",
    createdBy: "automation",
    status: "snoozed",
    snoozeLabel: "Завтра",
    actionLabel: "Запросить чек-ин",
    actionHref: "/trainer/messages",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/ekaterina-morozova",
    context: {
      lastActivity: "8 дней назад",
      weight: "64.9 кг",
      program: "Сушка 8 недель",
      note: "Задача отложена до завтра, чтобы не дублировать сообщение после напоминания.",
    },
  },
  {
    id: "anna-renewal",
    client: "Анна Тарасова",
    clientId: "anna-tarasova",
    goal: "Поддержание",
    category: "business",
    reason: "Продление",
    detail: "Период ведения заканчивается через 2 дня. Нужно подготовить мягкое предложение.",
    priority: "low",
    dateLabel: "Через 2 дня",
    createdBy: "automation",
    status: "open",
    actionLabel: "Открыть продажи",
    actionHref: "/trainer/sales",
    secondaryLabel: "Открыть клиента",
    secondaryHref: "/trainer/clients/anna-tarasova",
    context: {
      lastActivity: "Сегодня",
      weight: "59.7 кг",
      program: "Поддержание",
      note: "Не смешивать с coaching-очередью, но не потерять продление.",
    },
  },
  {
    id: "maria-workout-done",
    client: "Мария Волкова",
    clientId: "maria-volkova",
    goal: "Снижение веса",
    category: "training",
    reason: "Разбор закрыт",
    detail: "Тренировка разобрана, комментарий отправлен клиенту.",
    priority: "low",
    dateLabel: "Сегодня",
    createdBy: "manual",
    status: "done",
    actionLabel: "Открыть клиента",
    actionHref: "/trainer/clients/maria-volkova",
    secondaryLabel: "Открыть разбор",
    secondaryHref: "/trainer/review/maria-volkova-2026-06-09",
    context: {
      lastActivity: "Сегодня",
      weight: "68.4 кг",
      program: "Сушка 8 недель",
      note: "Закрытая задача остаётся в истории и не мешает открытой очереди.",
    },
  },
];

const filters: Array<{ id: AttentionFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "Все", icon: Search },
  { id: "open", label: "Открытые", icon: CircleDot },
  { id: "today", label: "Сегодня", icon: CalendarClock },
  { id: "high", label: "Высокий приоритет", icon: AlertTriangle },
  { id: "training", label: "Тренировки", icon: Dumbbell },
  { id: "progress", label: "Прогресс", icon: Ruler },
  { id: "communication", label: "Коммуникация", icon: MessageCircle },
  { id: "programs", label: "Программы", icon: ClipboardList },
  { id: "business", label: "Бизнес", icon: ShoppingBag },
  { id: "snoozed", label: "Отложенные", icon: PauseCircle },
  { id: "done", label: "Закрытые", icon: CheckCircle2 },
];

const priorityOrder: Record<AttentionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function priorityLabel(priority: AttentionPriority) {
  if (priority === "high") return "Высокий";
  if (priority === "medium") return "Средний";
  return "Низкий";
}

function priorityClasses(priority: AttentionPriority) {
  if (priority === "high") return "border-rose-300/24 bg-rose-300/10 text-rose-100";
  if (priority === "medium") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-zinc-700 bg-zinc-900/70 text-zinc-300";
}

function statusLabel(status: AttentionStatus) {
  if (status === "open") return "Open";
  if (status === "in-progress") return "In Progress";
  if (status === "snoozed") return "Snoozed";
  return "Done";
}

function statusClasses(status: AttentionStatus) {
  if (status === "open") return "border-lime-300/18 bg-lime-300/10 text-lime-100";
  if (status === "in-progress") return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
  if (status === "snoozed") return "border-violet-300/18 bg-violet-300/10 text-violet-100";
  return "border-zinc-700 bg-zinc-900/70 text-zinc-400";
}

function createdByLabel(value: AttentionItem["createdBy"]) {
  return value === "automation" ? "Автоматика" : "Вручную";
}

function isOpenQueue(status: AttentionStatus) {
  return status === "open" || status === "in-progress";
}

function matchesFilter(item: AttentionItem, filter: AttentionFilter) {
  if (filter === "all") return true;
  if (filter === "open") return isOpenQueue(item.status);
  if (filter === "today") return item.dateLabel === "Сегодня" && item.status !== "done";
  if (filter === "high") return item.priority === "high" && item.status !== "done";
  if (filter === "snoozed") return item.status === "snoozed";
  if (filter === "done") return item.status === "done";
  return item.category === filter && item.status !== "done";
}

export default function TrainerAttentionPage() {
  if (!isDemoModeEnabled()) return <CanonicalReviewQueue />;
  return <DemoTrainerAttentionPage />;
}

function DemoTrainerAttentionPage() {
  const [items, setItems] = useState<AttentionItem[]>(initialAttentionItems);
  const [activeFilter, setActiveFilter] = useState<AttentionFilter>("open");
  const [selectedId, setSelectedId] = useState(initialAttentionItems[0]?.id ?? "");

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        if (a.status === "snoozed" && isOpenQueue(b.status)) return 1;
        if (isOpenQueue(a.status) && b.status === "snoozed") return -1;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    [items]
  );

  const visibleItems = useMemo(() => {
    return sortedItems.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, sortedItems]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? visibleItems[0] ?? sortedItems.find((item) => item.status !== "done") ?? sortedItems[0];

  const openCount = items.filter((item) => isOpenQueue(item.status)).length;
  const highCount = items.filter((item) => item.priority === "high" && item.status !== "done").length;
  const snoozedCount = items.filter((item) => item.status === "snoozed").length;
  const doneCount = items.filter((item) => item.status === "done").length;
  const firstOpenItem = sortedItems.find((item) => isOpenQueue(item.status));

  function updateStatus(itemId: string, status: AttentionStatus, snoozeLabel?: string) {
    setItems((current) => {
      const nextItems = current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status,
              snoozeLabel: status === "snoozed" ? snoozeLabel : undefined,
            }
          : item
      );

      if (itemId === selectedId) {
        const nextSelected =
          nextItems
            .filter((item) => item.id !== itemId && matchesFilter(item, activeFilter))
            .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0] ??
          nextItems.find((item) => item.id === itemId) ??
          nextItems[0];

        setSelectedId(nextSelected?.id ?? "");
      }

      return nextItems;
    });

    const message =
      status === "done"
        ? "Attention item закрыт"
        : status === "snoozed"
          ? `Отложено: ${snoozeLabel}`
          : status === "in-progress"
            ? "Задача взята в работу"
            : "Задача возвращена в открытую очередь";

    toast.success(message);
  }

  return (
    <TrainerShell
      title="Центр внимания"
      description="Рабочая очередь тренера: Attention Item -> клиент -> действие -> закрытие."
      headerAction={
        <Button asChild className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex">
          <Link href="/trainer/clients">
            <UserRound className="mr-2 h-4 w-4" />
            Открыть клиента
          </Link>
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4">
        <section className="rounded-[1.45rem] border border-zinc-800/90 bg-[linear-gradient(135deg,rgba(24,24,27,0.96),rgba(5,5,6,0.98))] p-4 shadow-xl shadow-black/20 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Attention Center</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Центр внимания</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Рабочая очередь: выбрать item, понять причину, выполнить действие, закрыть и перейти к следующему клиенту.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-zinc-800 bg-black/22 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-lime-300/18 bg-lime-300/10 px-3 py-1 text-lime-100">
                  {openCount} open
                </Badge>
                <Badge className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-rose-100">
                  {highCount} high
                </Badge>
                <Badge className="rounded-full border border-violet-300/18 bg-violet-300/10 px-3 py-1 text-violet-100">
                  {snoozedCount} snoozed
                </Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                  {doneCount} done
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[0.95rem] border border-lime-300/12 bg-lime-300/[0.045] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-lime-100/70">Первый item</p>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                    {firstOpenItem ? `${firstOpenItem.client}: ${firstOpenItem.reason}` : "Открытая очередь чистая"}
                  </p>
                </div>
                {firstOpenItem ? (
                  <Button asChild className="h-8 shrink-0 rounded-full bg-lime-300 px-3 text-xs text-black hover:bg-lime-200">
                    <Link href={firstOpenItem.actionHref}>{firstOpenItem.actionLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)_380px]">
          <aside className="rounded-[1.5rem] border border-zinc-800/90 bg-zinc-950/82 p-3 xl:sticky xl:top-24 xl:self-start">
            <div className="px-2 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Фильтры</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
              {filters.map((filter) => {
                const Icon = filter.icon;
                const count = countForFilter(items, filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={cn(
                      "flex min-w-fit items-center justify-between gap-3 rounded-[1rem] border px-3 py-2.5 text-left text-sm transition xl:min-w-0",
                      activeFilter === filter.id
                        ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                        : "border-transparent bg-transparent text-zinc-400 hover:border-zinc-800 hover:bg-black/20 hover:text-zinc-100"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {filter.label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-zinc-500">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-w-0 rounded-[1.7rem] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,22,0.94),rgba(7,7,9,0.99))] p-3 sm:p-4">
            <div className="flex flex-col gap-3 border-b border-white/7 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Рабочая очередь</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
                  {filterTitle(activeFilter)}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full border border-lime-300/18 bg-lime-300/10 px-3 py-1 text-lime-100">
                  {openCount} в очереди
                </Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                  {visibleItems.length} показано
                </Badge>
              </div>
            </div>

            <div className="mt-3 divide-y divide-white/7 overflow-hidden rounded-[1.2rem] border border-zinc-800 bg-black/18">
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <AttentionRow
                    key={item.id}
                    item={item}
                    active={selectedItem?.id === item.id}
                    onSelect={() => setSelectedId(item.id)}
                    onStatus={(status, snoozeLabel) => updateStatus(item.id, status, snoozeLabel)}
                  />
                ))
              ) : (
                <div className="p-10 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-lime-200" />
                  <p className="mt-3 font-medium text-zinc-100">В этом фильтре пусто</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                    Открытая очередь очищена или задачи находятся в другом статусе.
                  </p>
                </div>
              )}
            </div>
          </main>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            {selectedItem ? (
              <AttentionContextPanel item={selectedItem} onStatus={updateStatus} />
            ) : (
              <section className="rounded-[1.7rem] border border-zinc-800/90 bg-zinc-950/82 p-5">
                <Bell className="h-5 w-5 text-zinc-500" />
                <p className="mt-4 font-medium text-zinc-100">Выберите item</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Контекст клиента появится здесь.
                </p>
              </section>
            )}
          </aside>
        </section>
      </div>
    </TrainerShell>
  );
}

function AttentionRow({
  item,
  active,
  onSelect,
  onStatus,
}: {
  item: AttentionItem;
  active: boolean;
  onSelect: () => void;
  onStatus: (status: AttentionStatus, snoozeLabel?: string) => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;

  return (
    <article
      className={cn(
        "grid gap-4 p-4 transition hover:bg-zinc-950/70 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
        active && "bg-lime-300/[0.045]",
        item.priority === "high" && item.status !== "done" && "shadow-[inset_3px_0_0_rgba(244,63,94,0.52)]"
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-100">
            {initials(item.client)}
          </div>
          <p className="font-medium text-zinc-100">{item.client}</p>
          <Badge className={cn("rounded-full border px-2.5 py-1", meta.chip)}>
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {meta.label}
          </Badge>
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", priorityClasses(item.priority))}>
            {priorityLabel(item.priority)}
          </span>
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", statusClasses(item.status))}>
            {statusLabel(item.status)}
          </span>
          <span className="text-xs text-zinc-500">{item.dateLabel}</span>
        </div>
        <div className="mt-3">
          <p className="text-[1rem] font-medium text-zinc-50">{item.reason}</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">{item.detail}</p>
          {item.snoozeLabel ? (
            <p className="mt-2 text-xs text-violet-200">Напомнить: {item.snoozeLabel}</p>
          ) : null}
        </div>
      </button>

      <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
        <Button asChild className="h-9 rounded-full bg-lime-300 px-4 text-xs text-black hover:bg-lime-200">
          <Link href={item.actionHref}>{item.actionLabel}</Link>
        </Button>
        <Button asChild variant="outline" className="h-9 rounded-full border-zinc-700 bg-zinc-950/45 px-4 text-xs text-zinc-200 hover:bg-zinc-900">
          <Link href={item.secondaryHref}>{item.secondaryLabel}</Link>
        </Button>
        <button
          type="button"
          onClick={() => onStatus("done")}
          className="h-9 rounded-full border border-zinc-800 bg-black/18 px-3 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function AttentionContextPanel({
  item,
  onStatus,
}: {
  item: AttentionItem;
  onStatus: (itemId: string, status: AttentionStatus, snoozeLabel?: string) => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;

  return (
    <section className="rounded-[1.7rem] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(24,24,27,0.94),rgba(7,7,9,0.99))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-black/24 text-lime-100">
            {initials(item.client)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-50">{item.client}</p>
            <p className="mt-1 truncate text-sm text-zinc-500">{item.goal}</p>
          </div>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", meta.chip)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Почему важно</p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">{item.reason}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.detail}</p>
      </div>

      <dl className="mt-4 grid gap-2">
        {[
          ["Последняя активность", item.context.lastActivity],
          ["Последний вес", item.context.weight],
          ["Программа", item.context.program],
          ["Источник", createdByLabel(item.createdBy)],
          ["Статус", statusLabel(item.status)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-800 bg-black/16 px-3 py-2.5">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-right text-sm font-medium text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Контекст</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.context.note}</p>
      </div>

      <div className="mt-4 grid gap-2">
        <Button asChild className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
          <Link href={item.actionHref}>
            {item.actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full border-zinc-700 bg-zinc-950/45 text-zinc-200 hover:bg-zinc-900">
          <Link href={item.secondaryHref}>{item.secondaryLabel}</Link>
        </Button>
      </div>

      <div className="mt-5 border-t border-white/7 pt-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Workflow</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStatus(item.id, "in-progress")}
            disabled={item.status === "done"}
            className="rounded-full border border-cyan-300/18 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-40"
          >
            В работу
          </button>
          <button
            type="button"
            onClick={() => onStatus(item.id, "done")}
            className="rounded-full border border-lime-300/18 bg-lime-300/[0.06] px-3 py-2 text-xs text-lime-100 transition hover:bg-lime-300/10"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-3 rounded-[1rem] border border-zinc-800 bg-black/18 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <TimerReset className="h-4 w-4 text-violet-200" />
            Snooze
          </div>
          <div className="mt-3 grid gap-2">
            {["Завтра", "Через 3 дня", "На следующей неделе"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onStatus(item.id, "snoozed", label)}
                disabled={item.status === "done"}
                className="rounded-full border border-zinc-800 bg-zinc-950/45 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-40"
              >
                Напомнить: {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[1rem] border border-zinc-800 bg-black/18 px-3 py-2 text-xs text-zinc-500">
        <RadioTower className="h-4 w-4" />
        Может быть создано вручную или правилом автоматизации.
      </div>
    </section>
  );
}

function countForFilter(items: AttentionItem[], filter: AttentionFilter) {
  if (filter === "all") return items.length;
  if (filter === "open") return items.filter((item) => isOpenQueue(item.status)).length;
  if (filter === "today") return items.filter((item) => item.dateLabel === "Сегодня" && item.status !== "done").length;
  if (filter === "high") return items.filter((item) => item.priority === "high" && item.status !== "done").length;
  if (filter === "snoozed") return items.filter((item) => item.status === "snoozed").length;
  if (filter === "done") return items.filter((item) => item.status === "done").length;
  return items.filter((item) => item.category === filter && item.status !== "done").length;
}

function filterTitle(filter: AttentionFilter) {
  if (filter === "all") return "Все attention items";
  if (filter === "open") return "Открытая очередь";
  if (filter === "today") return "Сегодня";
  if (filter === "high") return "Высокий приоритет";
  if (filter === "snoozed") return "Отложенные";
  if (filter === "done") return "Закрытые";
  return categoryMeta[filter].label;
}
