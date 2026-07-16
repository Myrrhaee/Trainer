"use client";

import Link from "next/link";
import type { RefObject } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Dumbbell,
  ExternalLink,
  ShieldAlert,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TrainerAttentionKind, TrainerAttentionQueueItem } from "./dashboard-read-model";
import type { TeamClient } from "./types";

type AttentionWorkspaceProps = {
  items: TrainerAttentionQueueItem[];
  currentItemId: string | null;
  resolutionReceipt: string | null;
  sectionRef: RefObject<HTMLElement | null>;
  onSelectItem: (item: TrainerAttentionQueueItem) => void;
  onPreviewClient: (clientId: string | null) => void;
  onMove: (offset: -1 | 1) => void;
  onResolve: (item: TrainerAttentionQueueItem) => void;
  onQuickAssign: (client: TeamClient) => void;
  onWorkoutReview: (client: TeamClient) => void;
};

export function AttentionWorkspace({
  items,
  currentItemId,
  resolutionReceipt,
  sectionRef,
  onSelectItem,
  onPreviewClient,
  onMove,
  onResolve,
  onQuickAssign,
  onWorkoutReview,
}: AttentionWorkspaceProps) {
  const currentItem = items.find((item) => item.id === currentItemId) ?? items[0] ?? null;
  const currentIndex = currentItem ? items.findIndex((item) => item.id === currentItem.id) : -1;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="attention-heading"
      className="rounded-lg border border-zinc-800/90 bg-zinc-950/90 p-4 shadow-2xl shadow-black/25 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-200/70">Рабочая очередь</p>
          <h2 id="attention-heading" className="mt-1 text-2xl font-semibold text-zinc-50">Следующее решение</h2>
          <p className="mt-1 text-sm text-zinc-500">Одна задача за раз, с контекстом и понятным следующим шагом.</p>
        </div>
        {items.length > 0 ? (
          <div className="flex items-center gap-2" aria-label={`Задача ${currentIndex + 1} из ${items.length}`}>
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={items.length < 2}
              className="flex size-10 items-center justify-center rounded-full border border-zinc-800 bg-black/30 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70 disabled:opacity-35"
              aria-label="Предыдущая задача"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="min-w-16 text-center text-sm tabular-nums text-zinc-500">{currentIndex + 1} / {items.length}</span>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={items.length < 2}
              className="flex size-10 items-center justify-center rounded-full border border-zinc-800 bg-black/30 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70 disabled:opacity-35"
              aria-label="Следующая задача"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-4">
        {resolutionReceipt ? (
          <div className="flex items-start gap-3 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] px-3.5 py-3 text-sm text-lime-100 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{resolutionReceipt}</span>
          </div>
        ) : null}
      </div>

      {currentItem ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <AttentionDecisionCard
            key={currentItem.id}
            item={currentItem}
            onResolve={onResolve}
            onQuickAssign={onQuickAssign}
            onWorkoutReview={onWorkoutReview}
          />
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-200">Дальше в очереди</h3>
              <span className="text-xs text-zinc-600">{items.length} открыто</span>
            </div>
            <ol className="max-h-[470px] space-y-2 overflow-y-auto pr-1" aria-label="Очередь внимания">
              {items.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    onMouseEnter={() => onPreviewClient(item.clientId)}
                    onMouseLeave={() => onPreviewClient(null)}
                    onFocus={() => onPreviewClient(item.clientId)}
                    onBlur={() => onPreviewClient(null)}
                    aria-current={item.id === currentItem.id ? "true" : undefined}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70",
                      item.id === currentItem.id
                        ? "border-lime-300/35 bg-lime-300/[0.06]"
                        : "border-zinc-800/80 bg-black/20 hover:border-zinc-700 hover:bg-zinc-900/65"
                    )}
                  >
                    <span className="w-5 shrink-0 text-center text-xs tabular-nums text-zinc-600">{index + 1}</span>
                    <Avatar className="size-9 shrink-0 border border-zinc-800 bg-zinc-950">
                      <AvatarFallback className="bg-zinc-900 text-[11px] font-semibold text-zinc-100">{item.client.initials}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{item.client.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{item.reason}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-zinc-600" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <AllCalmState />
      )}
    </section>
  );
}

function AttentionDecisionCard({
  item,
  onResolve,
  onQuickAssign,
  onWorkoutReview,
}: {
  item: TrainerAttentionQueueItem;
  onResolve: (item: TrainerAttentionQueueItem) => void;
  onQuickAssign: (client: TeamClient) => void;
  onWorkoutReview: (client: TeamClient) => void;
}) {
  const tone = attentionTone[item.kind];
  const SignalIcon = tone.icon;
  const profileHref = `/trainer/clients/${item.clientId}?from=dashboard&attention=${item.kind}&attentionItem=${item.id}`;

  return (
    <article
      className={cn(
        "flex min-h-[470px] flex-col rounded-lg border bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 sm:p-5",
        tone.border
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 shrink-0 border border-zinc-700 bg-zinc-950">
            <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{item.client.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-zinc-50">{item.client.name}</h3>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{item.client.goal}</p>
          </div>
        </div>
        <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", tone.badge)}>
          <SignalIcon className="size-3.5" />
          {tone.label}
        </span>
      </div>

      <div className={cn("mt-5 rounded-lg border p-4", tone.signal)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium uppercase tracking-[0.14em]">{item.eventLabel}</span>
          <span className="opacity-45">·</span>
          <span className="opacity-70">{item.happenedAt}</span>
          {item.visualPrototype ? <span className="rounded-full border border-current/20 px-2 py-0.5 opacity-70">Прототип сигнала</span> : null}
        </div>
        <h3 className="mt-3 text-xl font-semibold text-zinc-50">{item.reason}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300/75">{item.signal}</p>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">Что важно</p>
        <ul className="mt-2 space-y-2">
          {item.relatedSignals.map((signal) => (
            <li key={signal} className="flex items-start gap-2 text-sm text-zinc-400">
              <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone.dot)} />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {item.primaryAction === "review" ? (
          <Button type="button" onClick={() => onWorkoutReview(item.client)} className="h-11 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
            <Check className="size-4" />
            Разобрать
          </Button>
        ) : null}
        {item.primaryAction === "assign" ? (
          <Button type="button" onClick={() => onQuickAssign(item.client)} className="h-11 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
            <Dumbbell className="size-4" />
            Назначить
          </Button>
        ) : null}
        {item.primaryAction === "open_profile" ? (
          <Button asChild className="h-11 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
            <Link href={profileHref}>
              <UserRound className="size-4" />
              Открыть профиль
            </Link>
          </Button>
        ) : null}
        {item.reviewHref ? (
          <Button asChild variant="outline" className="h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href={`${item.reviewHref}?from=dashboard&attentionItem=${item.id}&queue=review`}>
              Полный разбор
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href={profileHref}>Контекст клиента</Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onResolve(item)}
          className="h-11 rounded-full px-3 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
        >
          <CheckCircle2 className="size-4" />
          Отметить решённым
        </Button>
      </div>
    </article>
  );
}

function AllCalmState() {
  return (
    <div className="mt-5 flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-lime-300/15 bg-lime-300/[0.045] p-6 text-center motion-safe:animate-in motion-safe:fade-in">
      <div className="flex size-14 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-lime-100">
        <CheckCircle2 className="size-6" />
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-zinc-50">Все спокойны</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">Открытых решений нет. Карта и жизнь команды остаются доступны ниже.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
          <Link href="/trainer/clients"><UsersRound className="size-4" />Клиенты</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
          <Link href="/trainer/builder"><Dumbbell className="size-4" />Назначить тренировку</Link>
        </Button>
      </div>
    </div>
  );
}

const attentionTone: Record<TrainerAttentionKind, { label: string; icon: typeof CircleAlert; border: string; badge: string; signal: string; dot: string }> = {
  discomfort: {
    label: "Безопасность",
    icon: ShieldAlert,
    border: "border-rose-300/28 shadow-[0_20px_60px_rgba(244,63,94,0.07)]",
    badge: "border-rose-300/25 bg-rose-300/8 text-rose-100",
    signal: "border-rose-300/18 bg-rose-300/[0.055] text-rose-100",
    dot: "bg-rose-300",
  },
  review: {
    label: "Разбор",
    icon: CheckCircle2,
    border: "border-amber-300/22",
    badge: "border-amber-300/22 bg-amber-300/8 text-amber-100",
    signal: "border-amber-300/16 bg-amber-300/[0.045] text-amber-100",
    dot: "bg-amber-300",
  },
  assignment: {
    label: "Назначение",
    icon: Dumbbell,
    border: "border-lime-300/22",
    badge: "border-lime-300/22 bg-lime-300/8 text-lime-100",
    signal: "border-lime-300/16 bg-lime-300/[0.045] text-lime-100",
    dot: "bg-lime-300",
  },
  missed_workout: {
    label: "Пропуск",
    icon: AlertTriangle,
    border: "border-orange-300/20",
    badge: "border-orange-300/22 bg-orange-300/8 text-orange-100",
    signal: "border-orange-300/16 bg-orange-300/[0.045] text-orange-100",
    dot: "bg-orange-300",
  },
};
