"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  MessageSquareText,
  Ruler,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TeamActivityItem, TeamActivityType } from "./types";

type TeamActivityFeedProps = {
  items: TeamActivityItem[];
  activeClientId?: string | null;
  isEventRead: (item: TeamActivityItem) => boolean;
  onActivityPreview?: (clientId: string | null) => void;
  onOpenJournal: () => void;
  onSelectEvent: (item: TeamActivityItem) => void;
};

export function TeamActivityFeed({
  items,
  activeClientId = null,
  isEventRead,
  onActivityPreview,
  onOpenJournal,
  onSelectEvent,
}: TeamActivityFeedProps) {
  const todayItems = items.filter((item) => item.dateGroup === "today");
  const previewItems = items.filter((item) => !isEventRead(item)).slice(0, 3);
  const displayPreviewItems = previewItems.length > 0 ? previewItems : todayItems.slice(0, 2);
  const summary = getActivitySummary(todayItems);

  return (
    <section className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/90 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Жизнь клуба</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
            {todayItems.length > 0 ? `Сегодня произошло ${todayItems.length} событий` : "Сегодня пока тихо"}
          </h2>
        </div>
        <Button type="button" onClick={onOpenJournal} className="rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
          Открыть журнал
        </Button>
      </div>

      {todayItems.length > 0 ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-zinc-800 bg-black/20 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4", item.iconClassName)} />
                    <span className="text-sm font-medium text-zinc-100">{item.value}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.label}</p>
                </div>
              );
            })}
          </div>

          {displayPreviewItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              {displayPreviewItems.map((item) => {
                const Icon = activityIconMap[item.type];
                const active = activeClientId === item.clientId;
                const read = isEventRead(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onOpenJournal();
                      onSelectEvent(item);
                    }}
                    onMouseEnter={() => onActivityPreview?.(item.clientId)}
                    onMouseLeave={() => onActivityPreview?.(null)}
                    onFocus={() => onActivityPreview?.(item.clientId)}
                    onBlur={() => onActivityPreview?.(null)}
                    className={cn(
                      "flex w-full gap-3 rounded-2xl border border-zinc-800/70 bg-black/18 p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/60",
                      active && "border-lime-300/35 bg-lime-300/[0.035] shadow-[0_14px_34px_rgba(163,230,53,0.055)]",
                      read && "opacity-70"
                    )}
                  >
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", activityToneMap[item.type])}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {!read ? <span className="size-1.5 rounded-full bg-lime-300" /> : null}
                        <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                        <span className="text-xs text-zinc-600">{item.clock}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-zinc-500">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/20 p-4">
          <p className="text-sm text-zinc-500">
            Когда клиенты завершат тренировки, отправят чек-ин или обновят замеры, события появятся здесь.
          </p>
        </div>
      )}
    </section>
  );
}

function getActivitySummary(items: TeamActivityItem[]) {
  return [
    {
      label: "тренировки",
      value: `${countByType(items, "completed_workout")} ${getPlural(countByType(items, "completed_workout"), ["тренировка", "тренировки", "тренировок"])}`,
      icon: Dumbbell,
      iconClassName: "text-lime-200",
    },
    {
      label: "рекорды",
      value: `${countByType(items, "personal_record")} ${getPlural(countByType(items, "personal_record"), ["рекорд", "рекорда", "рекордов"])}`,
      icon: Trophy,
      iconClassName: "text-amber-200",
    },
    {
      label: "замеры",
      value: `${countByType(items, "measurement_updated")} ${getPlural(countByType(items, "measurement_updated"), ["замер", "замера", "замеров"])}`,
      icon: Ruler,
      iconClassName: "text-violet-200",
    },
    {
      label: "чек-ины",
      value: `${countByType(items, "check_in_submitted")} ${getPlural(countByType(items, "check_in_submitted"), ["чек-ин", "чек-ина", "чек-инов"])}`,
      icon: ClipboardCheck,
      iconClassName: "text-sky-200",
    },
  ];
}

function countByType(items: TeamActivityItem[], type: TeamActivityType) {
  return items.filter((item) => item.type === type).length;
}

function getPlural(count: number, [one, few, many]: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
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
