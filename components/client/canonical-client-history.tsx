"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, RefreshCw } from "lucide-react";
import {
  appendHistory,
  historyCollectionUrl,
  readHistoryNavigation,
  replaceClientWorkoutCollectionUrl,
} from "@/lib/client-history-navigation";
import type {
  ClientWorkoutHistoryItem,
  ClientWorkoutHistoryReadModel,
} from "@/lib/server/client-workouts/client-history-types";

export function clientHistoryDate(value: string, timezone = "UTC") {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }
}

type View = {
  rows: ClientWorkoutHistoryItem[];
  start: string | null;
  after: string | null;
  depth: number;
  target: number;
  hasNext: boolean;
  loading: boolean;
  failed: boolean;
  notice: string;
  anchor: string;
};
const initial: View = {
  rows: [],
  start: null,
  after: null,
  depth: 0,
  target: 1,
  hasNext: true,
  loading: true,
  failed: false,
  notice: "",
  anchor: "",
};
const control =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-lime-300 disabled:opacity-50";

export function CanonicalClientHistory() {
  const [view, setView] = useState<View>(initial);
  const state = useRef<View>(initial);
  const request = useRef<AbortController | null>(null);
  const loadRef = useRef<(next?: boolean) => void>(() => {});
  useEffect(() => {
    let disposed = false;
    const publish = (value: View) => {
      state.current = value;
      if (!disposed) setView(value);
    };
    const writeUrl = (value: View) =>
      replaceClientWorkoutCollectionUrl(
        historyCollectionUrl(
          value.start,
          value.depth,
          value.anchor,
          new URL(window.location.href),
        ),
      );
    async function load(next = false) {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      let current = { ...state.current, loading: true, failed: false };
      if (next) current.target = current.depth + 1;
      publish(current);
      let reset = false;
      try {
        while (current.depth < current.target && current.hasNext) {
          const query = new URLSearchParams({ mode: "history", first: "10" });
          if (current.depth === 0 && current.start)
            query.set("start", current.start);
          if (current.depth > 0 && current.after)
            query.set("after", current.after);
          const response = await fetch(`/api/client/workouts?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (response.status === 400 && !reset) {
            reset = true;
            current = {
              ...initial,
              notice: "История обновлена: сохранённая позиция недоступна.",
            };
            replaceClientWorkoutCollectionUrl(
              historyCollectionUrl(
                null,
                1,
                "#history",
                new URL(window.location.href),
              ),
            );
            publish(current);
            continue;
          }
          if (!response.ok) {
            if (response.status === 401 || response.status === 403)
              current = {
                ...initial,
                hasNext: false,
                notice: "Доступ к истории недоступен.",
              };
            throw new Error("history_unavailable");
          }
          const body = (await response.json()) as {
            history: ClientWorkoutHistoryReadModel;
          };
          if (controller.signal.aborted) return;
          const page = body.history;
          if (
            page.pageInfo.hasNextPage &&
            (!page.pageInfo.endCursor ||
              page.pageInfo.endCursor === current.after)
          )
            throw new Error("non_advancing_cursor");
          current = {
            ...current,
            rows: appendHistory(current.rows, page.items),
            start: page.pageInfo.startCursor,
            after: page.pageInfo.endCursor,
            depth: current.depth + 1,
            hasNext: page.pageInfo.hasNextPage,
          };
          publish(current);
        }
        if (!current.hasNext && current.depth < current.target)
          current.notice =
            "История изменилась: показаны все доступные тренировки.";
        current = { ...current, loading: false, target: current.depth };
        publish(current);
        writeUrl(current);
        if (next && !current.hasNext)
          requestAnimationFrame(() => {
            if (!disposed && !controller.signal.aborted)
              document.getElementById("history-exhausted")?.focus();
          });
        if (!next && current.anchor.startsWith("#workout-")) {
          requestAnimationFrame(() => {
            if (disposed || controller.signal.aborted) return;
            const row = document.getElementById(current.anchor.slice(1));
            const target = row ?? document.getElementById("history");
            target?.focus();
            target?.scrollIntoView({ block: "start" });
            if (!row)
              publish({
                ...current,
                notice:
                  "Выбранная тренировка больше не доступна в этой части истории.",
              });
          });
        }
      } catch {
        if (!controller.signal.aborted)
          publish({ ...current, loading: false, failed: true });
      } finally {
        if (request.current === controller) request.current = null;
      }
    }
    function restore() {
      request.current?.abort();
      request.current = null;
      const navigation = readHistoryNavigation(new URL(window.location.href));
      publish({
        ...initial,
        start: navigation.start,
        target: navigation.depth,
        anchor: navigation.anchor,
        notice: navigation.invalid
          ? "История обновлена: сохранённая позиция недоступна."
          : "",
      });
      if (navigation.invalid)
        replaceClientWorkoutCollectionUrl(
          historyCollectionUrl(
            null,
            1,
            "#history",
            new URL(window.location.href),
          ),
        );
      void load();
    }
    loadRef.current = (next) => {
      void load(next);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => {
      disposed = true;
      request.current?.abort();
      request.current = null;
      window.removeEventListener("popstate", restore);
    };
  }, []);
  return (
    <section
      className="mt-8 border-t border-zinc-800 pt-6"
      aria-labelledby="history"
    >
      <h2 id="history" tabIndex={-1} className="text-xl font-semibold">
        История тренировок
      </h2>
      <p role="status" className="my-3 text-sm text-zinc-400">
        {view.notice ||
          (view.loading
            ? view.target > 1
              ? `Восстанавливаем историю: загружено ${view.depth} из ${view.target} страниц`
              : "Загружаем историю…"
            : view.depth > 0
              ? `Показано тренировок: ${view.rows.length}`
              : "")}
      </p>
      {!view.rows.length && !view.loading && !view.failed ? (
        <p className="py-6 text-zinc-400">Завершённых тренировок пока нет.</p>
      ) : null}
      <ol className="divide-y divide-zinc-800">
        {view.rows.map((item) => {
          const anchor = `#workout-${item.sessionId}`;
          const origin = historyCollectionUrl(
            view.start,
            view.depth,
            anchor,
            typeof window === "undefined"
              ? undefined
              : new URL(window.location.href),
          );
          return (
            <li key={item.sessionId} className="py-5">
              <h3 className="break-words text-lg font-medium [overflow-wrap:anywhere]">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                <time dateTime={item.completedAt}>
                  {clientHistoryDate(item.completedAt, item.clientTimezone)}
                </time>{" "}
                ·{" "}
                {item.status === "completed"
                  ? "Завершена"
                  : "Завершена с пропусками"}
              </p>
              <p className="mt-2 text-sm">
                {item.summary.availability === "ready"
                  ? `${item.summary.completedSetCount} из ${item.summary.plannedSetCount} подходов с результатом · Пропущено: ${item.summary.skippedSetCount} · Без полного результата: ${item.summary.incompleteSetCount}`
                  : "Часть результатов недоступна"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {item.feedback.hasFeedback
                  ? "Есть ответ тренера"
                  : "Пока без ответа"}
              </p>
              <Link
                id={anchor.slice(1)}
                href={`/client/workouts?session=${item.sessionId}&returnTo=${encodeURIComponent(origin)}`}
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-lime-300"
                aria-label={`Открыть тренировку «${item.title}», ${clientHistoryDate(item.completedAt, item.clientTimezone)}`}
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    event.button === 0
                  )
                    replaceClientWorkoutCollectionUrl(origin);
                }}
              >
                Открыть тренировку <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
      {view.failed ? (
        <div className="py-4">
          <p role="alert">
            {view.depth > 0
              ? "Не удалось восстановить историю полностью"
              : "Не удалось загрузить историю"}
          </p>
          <button
            type="button"
            className={`${control} mt-3`}
            onClick={() => loadRef.current()}
          >
            <RefreshCw size={16} aria-hidden />
            Повторить
          </button>
        </div>
      ) : null}
      {!view.failed && view.hasNext ? (
        <button
          type="button"
          className={`${control} my-5`}
          disabled={view.loading}
          onClick={() => loadRef.current(true)}
        >
          <ArrowDown size={16} aria-hidden />
          {view.loading ? "Загрузка…" : "Показать ещё"}
        </button>
      ) : null}
      {!view.loading && !view.failed && !view.hasNext ? (
        <p
          id="history-exhausted"
          tabIndex={-1}
          role="status"
          className="py-5 text-sm text-zinc-400"
        >
          Все тренировки показаны
        </p>
      ) : null}
    </section>
  );
}
