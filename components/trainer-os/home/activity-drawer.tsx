"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultReviewSessionId } from "@/components/trainer-os/workout-review/review-model";
import {
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Eye,
  EyeOff,
  MessageSquareText,
  Ruler,
  Trophy,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { TeamActivityDateGroup, TeamActivityItem, TeamActivityType } from "./types";

type ActivityDrawerProps = {
  open: boolean;
  items: TeamActivityItem[];
  selectedEventId: string | null;
  isEventRead: (item: TeamActivityItem) => boolean;
  onOpenChange: (open: boolean) => void;
  onHoverEvent: (clientId: string | null) => void;
  onSelectEvent: (item: TeamActivityItem) => void;
  onMarkRead: (eventId: string) => void;
  onHideEvent: (eventId: string) => void;
};

type ActivityFilter = "all" | TeamActivityType;

const filters: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "completed_workout", label: "Тренировки" },
  { id: "personal_record", label: "Рекорды" },
  { id: "measurement_updated", label: "Замеры" },
  { id: "check_in_submitted", label: "Чек-ины" },
  { id: "workout_assigned", label: "Назначения" },
  { id: "message_received", label: "Сообщения" },
];

const groupLabels: Record<TeamActivityDateGroup, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  week: "На этой неделе",
};

const groupOrder: TeamActivityDateGroup[] = ["today", "yesterday", "week"];

export function ActivityDrawer({
  open,
  items,
  selectedEventId,
  isEventRead,
  onOpenChange,
  onHoverEvent,
  onSelectEvent,
  onMarkRead,
  onHideEvent,
}: ActivityDrawerProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const filteredItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.type === filter)),
    [filter, items]
  );
  const todayCount = items.filter((item) => item.dateGroup === "today").length;
  const unreadCount = items.filter((item) => !isEventRead(item)).length;

  function openClient(item: TeamActivityItem) {
    router.push(`/trainer/clients/${item.clientId}`);
  }

  function openPrimaryAction(item: TeamActivityItem) {
    if (item.href) {
      router.push(item.href);
      return;
    }
    if (item.type === "completed_workout") {
      const sessionId = getDefaultReviewSessionId(item.clientId);
      router.push(sessionId ? `/trainer/review/${sessionId}?from=history` : `/trainer/clients/${item.clientId}?from=dashboard`);
      return;
    }

    openClient(item);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-0"
        className="w-full gap-0 overflow-hidden border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 shadow-[0_0_80px_rgba(0,0,0,0.5)] sm:!w-[90vw] sm:!max-w-[560px] xl:!w-[480px] xl:!max-w-[480px] 2xl:!w-[min(600px,30vw)] 2xl:!max-w-[600px]"
      >
        <SheetHeader className="border-b border-zinc-800/80 px-5 py-4">
          <div className="pr-10">
            <SheetTitle className="text-xl font-semibold tracking-tight text-zinc-50">Жизнь клуба</SheetTitle>
            <SheetDescription className="mt-1 text-zinc-500">Все события команды</SheetDescription>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-zinc-800 bg-black/24 px-2.5 py-1">{todayCount} событий сегодня</span>
            <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-2.5 py-1 text-lime-100">
              {unreadCount} непрочитанных
            </span>
          </div>
        </SheetHeader>

        <div className="border-b border-zinc-800/70 px-5 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                  filter === item.id
                    ? "border-lime-300/35 bg-lime-300/10 text-lime-100"
                    : "border-zinc-800 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {filteredItems.length > 0 ? (
            <div className="space-y-5">
              {groupOrder.map((group) => {
                const groupItems = filteredItems.filter((item) => item.dateGroup === group);
                if (groupItems.length === 0) return null;

                return (
                  <section key={group}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{groupLabels[group]}</h3>
                      <span className="text-xs text-zinc-600">{groupItems.length}</span>
                    </div>
                    <div className="space-y-2">
                      {groupItems.map((item) => (
                        <ActivityRow
                          key={item.id}
                          item={item}
                          active={selectedEventId === item.id}
                          read={isEventRead(item)}
                          onClick={() => onSelectEvent(item)}
                          onHoverChange={onHoverEvent}
                          onMarkRead={() => onMarkRead(item.id)}
                          onHide={() => onHideEvent(item.id)}
                          onOpenPrimary={() => openPrimaryAction(item)}
                          onOpenClient={() => openClient(item)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyFilterState filter={filter} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityRow({
  item,
  active,
  read,
  onClick,
  onHoverChange,
  onMarkRead,
  onHide,
  onOpenPrimary,
  onOpenClient,
}: {
  item: TeamActivityItem;
  active: boolean;
  read: boolean;
  onClick: () => void;
  onHoverChange: (clientId: string | null) => void;
  onMarkRead: () => void;
  onHide: () => void;
  onOpenPrimary: () => void;
  onOpenClient: () => void;
}) {
  const Icon = activityIconMap[item.type];
  const initials = getInitials(item.clientName);

  return (
    <article
      onMouseEnter={() => onHoverChange(item.clientId)}
      onMouseLeave={() => onHoverChange(null)}
      className={cn(
        "group rounded-2xl border transition",
        active
          ? "border-lime-300/32 bg-lime-300/[0.045] shadow-[0_14px_36px_rgba(163,230,53,0.055)]"
          : "border-zinc-800/80 bg-black/18 hover:border-zinc-700 hover:bg-zinc-900/45",
        read && !active && "opacity-68"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        onFocus={() => onHoverChange(item.clientId)}
        onBlur={() => onHoverChange(null)}
        className="flex w-full gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60"
      >
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <div className={cn("flex size-8 items-center justify-center rounded-full", activityToneMap[item.type])}>
            <Icon className="size-3.5" />
          </div>
          <span className="max-w-12 truncate text-[11px] text-zinc-600">{item.clock}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center gap-2">
                {!read ? <span className="size-1.5 shrink-0 rounded-full bg-lime-300" /> : null}
                <span className="truncate text-xs font-medium text-zinc-300">{item.clientName}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-100">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{item.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="flex size-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-[11px] font-semibold text-zinc-300">
                {initials}
              </span>
              <span className="hidden shrink-0 items-center gap-1 opacity-0 transition group-hover:flex group-hover:opacity-100 group-focus-within:flex group-focus-within:opacity-100">
                {!read ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMarkRead();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onMarkRead();
                      }
                    }}
                    className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label="Отметить просмотренным"
                  >
                    <Eye className="size-3.5" />
                  </span>
                ) : null}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onHide();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onHide();
                    }
                  }}
                  className="inline-flex size-7 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Скрыть событие"
                >
                  <EyeOff className="size-3.5" />
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {active ? (
        <div className="border-t border-zinc-800/75 px-3 pb-3 pt-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/62 p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <ContextTile label="Тип" value={getActivityLabel(item.type)} />
              <ContextTile label="Время" value={item.clock} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={onOpenPrimary} className="rounded-full bg-lime-300 px-3 text-black hover:bg-lime-200">
                <UserRound className="size-4" />
                {item.type === "completed_workout" ? "Открыть разбор" : "Открыть клиента"}
              </Button>
              <Button
                type="button"
                onClick={onMarkRead}
                variant="outline"
                className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900"
              >
                <Eye className="size-4" />
                Отметить просмотренным
              </Button>
              <Button type="button" onClick={onHide} variant="ghost" className="rounded-full text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200">
                <EyeOff className="size-4" />
                Скрыть
              </Button>
              {item.type === "completed_workout" ? (
                <Button type="button" onClick={onOpenClient} variant="ghost" className="rounded-full text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200">
                  Открыть клиента
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function EmptyFilterState({ filter }: { filter: ActivityFilter }) {
  const emptyCopy =
    filter === "all"
      ? {
          title: "Сегодня пока тихо",
          body: "Когда клиенты завершат тренировки, отправят чек-ин или обновят замеры, события появятся здесь.",
        }
      : {
          title: "По этому типу событий ничего нет",
          body: "Можно переключиться на все события или выбрать другой тип.",
        };

  return (
    <div className="mt-6 rounded-[1.55rem] border border-zinc-800 bg-black/24 p-5 text-center">
      <p className="text-sm font-semibold text-zinc-100">{emptyCopy.title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">{emptyCopy.body}</p>
    </div>
  );
}

export function getActivityLabel(type: TeamActivityType) {
  if (type === "completed_workout") return "Тренировка";
  if (type === "personal_record") return "Рекорд";
  if (type === "measurement_updated") return "Замеры";
  if (type === "check_in_submitted") return "Чек-ин";
  if (type === "workout_assigned") return "Назначение";
  if (type === "message_received") return "Сообщение";
  return "Разбор";
}

const activityIconMap: Record<TeamActivityType, typeof Dumbbell> = {
  completed_workout: Dumbbell,
  personal_record: Trophy,
  measurement_updated: Ruler,
  check_in_submitted: ClipboardCheck,
  workout_assigned: CheckCircle2,
  message_received: MessageSquareText,
  review_sent: MessageSquareText,
};

const activityToneMap: Record<TeamActivityType, string> = {
  completed_workout: "bg-lime-300/10 text-lime-100 ring-1 ring-lime-300/20",
  personal_record: "bg-amber-300/10 text-amber-100 ring-1 ring-amber-300/20",
  measurement_updated: "bg-violet-300/10 text-violet-100 ring-1 ring-violet-300/20",
  check_in_submitted: "bg-sky-300/10 text-sky-100 ring-1 ring-sky-300/20",
  workout_assigned: "bg-emerald-300/10 text-emerald-100 ring-1 ring-emerald-300/20",
  message_received: "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700",
  review_sent: "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700",
};
