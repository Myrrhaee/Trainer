"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mergeAthleteTrainingHistory } from "@/lib/athlete-training-history-merge";
import type {
  AthleteTrainingHistoryItem,
  AthleteTrainingHistoryPage,
  AthleteTrainingViewResult,
} from "@/lib/server/athlete-profile/athlete-training-types";
import { cn } from "@/lib/utils";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

type HistoryState = AthleteTrainingViewResult["history"];

export function AthleteTrainingHistory({
  athleteUserId,
  initialState,
  canReview,
  sourceAttentionItemId,
}: {
  athleteUserId: string;
  initialState: HistoryState;
  canReview: boolean;
  sourceAttentionItemId: string | null;
}) {
  const initialPage = initialState.status === "ready" ? initialState.value : emptyPage();
  const [items, setItems] = useState(initialPage.items);
  const [pageInfo, setPageInfo] = useState(initialPage.pageInfo);
  const [error, setError] = useState(initialState.status === "error" ? "history_unavailable" : null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  async function loadPage(restart = false) {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const cursor = restart ? null : pageInfo.endCursor;
    try {
      const url = new URL(`/api/trainer/athletes/${athleteUserId}/training-history`, window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as AthleteTrainingHistoryPage | { error?: string };
      if (!response.ok || !("items" in payload)) {
        throw new Error(response.status === 400 ? "invalid_cursor" : "history_unavailable");
      }
      if (requestId !== requestRef.current) return;
      const merged = mergeAthleteTrainingHistory(restart ? [] : items, payload.items);
      const additions = merged.additions;
      setItems(merged.items);
      setPageInfo(payload.pageInfo);
      requestAnimationFrame(() => {
        if (additions[0]) document.getElementById(`training-history-${additions[0].assignment.id}`)?.focus();
      });
    } catch (caught) {
      if (requestId === requestRef.current) {
        setError(caught instanceof Error ? caught.message : "history_unavailable");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  if (initialState.status === "unavailable") return null;

  return (
    <section aria-labelledby="training-history-heading" className="pb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="training-history-heading" className="text-lg font-semibold text-zinc-50">История тренировок</h2>
          <p className="mt-1 text-sm text-zinc-500">Завершённые и отменённые назначения</p>
        </div>
        {items.length ? <span className="text-xs text-zinc-600">Показано: {items.length}</span> : null}
      </div>

      {error ? (
        <div className="mt-4 border-l-2 border-red-300/50 pl-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-medium text-red-100"><AlertTriangle className="size-4" />{error === "invalid_cursor" ? "История изменилась во время просмотра" : "Не удалось загрузить историю"}</p>
          <p className="mt-1 text-sm text-zinc-500">{error === "invalid_cursor" ? "Начните загрузку истории заново." : "Текущая работа выше остаётся доступна."}</p>
          <Button type="button" variant="outline" className="mt-4 min-h-11 rounded-lg border-zinc-700 bg-transparent" onClick={() => loadPage(true)} disabled={loading}>
            {loading ? "Загрузка…" : "Повторить"}
          </Button>
        </div>
      ) : items.length ? (
        <div className="mt-4 divide-y divide-zinc-800/90 border-y border-zinc-800/90">
          {items.map((item) => (
            <TrainingHistoryRow
              key={item.assignment.id}
              item={item}
              athleteUserId={athleteUserId}
              canReview={canReview}
              highlighted={item.attention?.id === sourceAttentionItemId}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex gap-3 text-zinc-600">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div><p className="text-sm text-zinc-400">История пока пуста</p><p className="mt-1 text-xs">Первая строка появится после завершения или отмены назначения.</p></div>
        </div>
      )}

      {!error && pageInfo.hasNextPage ? (
        <Button type="button" variant="outline" className="mt-5 min-h-11 w-full rounded-lg border-zinc-700 bg-transparent text-zinc-200 sm:w-auto" onClick={() => loadPage()} disabled={loading}>
          {loading ? "Загрузка…" : "Показать ещё"}
        </Button>
      ) : null}
    </section>
  );
}

export function AthleteTrainingRetryButton({ label = "Повторить загрузку" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-4 min-h-11 rounded-lg border-zinc-700 bg-transparent text-zinc-200"
      onClick={() => window.location.reload()}
    >
      {label}
    </Button>
  );
}

function TrainingHistoryRow({
  item,
  athleteUserId,
  canReview,
  highlighted,
}: {
  item: AthleteTrainingHistoryItem;
  athleteUserId: string;
  canReview: boolean;
  highlighted: boolean;
}) {
  const href = item.attention?.status === "open" && item.session && canReview
    ? reviewHref(athleteUserId, item)
    : null;
  const content = (
    <>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium text-zinc-100">{item.assignment.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{historyStatus(item)}</span>
          <span>{formatDateTime(item.sortAt)}</span>
          {item.completion ? <span>{item.completion.completedSets} из {item.completion.totalSets} подходов</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-zinc-600">
        {item.hasPersistedComment ? <MessageSquareText className="size-4" aria-label="Есть комментарий спортсмена" /> : null}
        {item.feedback.count ? <span className="flex items-center gap-1 text-xs" aria-label={`Обратная связь: ${item.feedback.count}`}><ClipboardCheck className="size-4" />{item.feedback.count}</span> : null}
        {href ? <ChevronRight className="size-4" aria-hidden="true" /> : null}
      </div>
      {highlighted ? <span className="col-span-full text-xs text-amber-100">Причина открытия профиля{item.attention?.status !== "open" ? " уже закрыта" : ""}</span> : null}
    </>
  );
  const className = cn(
    "grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-3 outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200/70 sm:px-3",
    highlighted && "border-l-2 border-amber-300 bg-amber-300/[0.045]",
    href && "hover:bg-zinc-900/60",
  );
  const common = {
    id: `training-history-${item.assignment.id}`,
    tabIndex: -1,
    className,
    "data-training-history-row": item.assignment.id,
  };
  return href ? (
    <Link {...common} href={href} aria-label={`Открыть разбор: ${item.assignment.title}`}>{content}</Link>
  ) : (
    <div {...common}>{content}</div>
  );
}

function historyStatus(item: AthleteTrainingHistoryItem) {
  if (item.assignment.status === "cancelled") return "Назначение отменено";
  if (item.session?.status === "completed_with_omissions") return "Завершена с пропусками";
  if (item.session?.status === "abandoned") return "Прервана";
  return "Завершена";
}

function reviewHref(athleteUserId: string, item: AthleteTrainingHistoryItem) {
  const context = createTrainerWorkflowContext({
    origin: "profile",
    athleteUserId,
    sourceAttentionItemId: item.attention?.id,
    sourceSessionId: item.session?.id,
    returnTo: `/trainer/clients/${athleteUserId}?tab=training`,
    returnAnchor: "latest-feedback",
  });
  return trainerWorkflowHref(`/trainer/review/${item.session?.id}`, context);
}

function emptyPage(): AthleteTrainingHistoryPage {
  return { items: [], pageInfo: { endCursor: null, hasNextPage: false } };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
