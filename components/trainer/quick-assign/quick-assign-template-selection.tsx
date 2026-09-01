"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuickAssignTemplateListItem } from "@/lib/server/quick-assign/quick-assign-types";
import { cn } from "@/lib/utils";

export function QuickAssignTemplateSelection({
  items,
  selectedRevisionId,
  query,
  loading,
  loadingMore,
  disabled,
  error,
  hasNextPage,
  exhausted,
  onQueryChange,
  onSelect,
  onLoadMore,
  onRetry,
  onCreateTemplate,
}: {
  items: QuickAssignTemplateListItem[];
  selectedRevisionId: string | null;
  query: string;
  loading: boolean;
  loadingMore: boolean;
  disabled: boolean;
  error: string | null;
  hasNextPage: boolean;
  exhausted: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (item: QuickAssignTemplateListItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onCreateTemplate: () => void;
}) {
  return (
    <section aria-labelledby="quick-assign-template-heading" className="flex min-h-0 flex-col lg:h-full">
      <div className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-5">
        <h2 id="quick-assign-template-heading" className="text-base font-semibold text-zinc-50">Шаблон тренировки</h2>
        <p className="mt-1 text-sm text-zinc-500">Только опубликованные версии.</p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-zinc-600" />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            disabled={disabled}
            placeholder="Название, описание или категория"
            aria-label="Поиск шаблонов"
            className="h-11 border-zinc-800 bg-black pl-10 pr-10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              disabled={disabled}
              aria-label="Очистить поиск"
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-zinc-500" aria-live="polite">
          {loading ? "Ищем шаблоны…" : `${items.length} ${resultWord(items.length)}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4" data-quick-assign-template-scroll>
        {loading && items.length === 0 ? <TemplateListSkeleton /> : null}
        {error && items.length === 0 ? (
          <ListMessage
            title="Не удалось загрузить шаблоны"
            description={error}
            action={<Button type="button" variant="outline" onClick={onRetry} className="min-h-11 border-zinc-700">Повторить</Button>}
          />
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <ListMessage
            title={query ? "Ничего не найдено" : "Нет опубликованных шаблонов"}
            description={query ? `По запросу «${query}» нет доступных версий. Измените запрос.` : "Создайте и опубликуйте шаблон, чтобы назначить тренировку."}
            action={!query ? <Button type="button" variant="outline" onClick={onCreateTemplate} className="min-h-11 border-zinc-700">Создать шаблон</Button> : undefined}
          />
        ) : null}
        {items.length > 0 ? (
          <div role="radiogroup" aria-label="Опубликованные шаблоны" className="grid gap-1.5">
            {items.map((item) => {
              const selected = selectedRevisionId === item.revisionId;
              return (
                <button
                  key={item.revisionId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(item)}
                  disabled={disabled}
                  data-template-revision-id={item.revisionId}
                  className={cn(
                    "group flex min-h-16 w-full items-start gap-3 rounded-md border px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-lime-200",
                    selected ? "border-lime-300/45 bg-lime-300/[0.055]" : "border-transparent hover:border-zinc-800 hover:bg-zinc-900/60",
                  )}
                >
                  <span className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-lime-300 bg-lime-300 text-black" : "border-zinc-700 text-transparent",
                  )}><Check className="size-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-zinc-100">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      Версия {item.revisionNumber} · {item.exerciseCount} упр. · {item.prescribedSetCount} подх.
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {[item.category || null, formatUpdatedAt(item.updatedAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="pt-3 text-center">
            {hasNextPage ? (
              <Button type="button" variant="ghost" onClick={onLoadMore} disabled={loadingMore || disabled} className="min-h-11 text-zinc-300">
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                Показать ещё
              </Button>
            ) : (
              exhausted ? <p className="py-3 text-xs text-zinc-500" role="status">Все результаты загружены</p> : null
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TemplateListSkeleton() {
  return (
    <div className="grid gap-2" aria-label="Загрузка шаблонов" aria-busy="true">
      {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-md bg-zinc-900" />)}
    </div>
  );
}

function ListMessage({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="border-l-2 border-zinc-800 px-4 py-2">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function resultWord(count: number) {
  return count === 1 ? "результат" : count > 1 && count < 5 ? "результата" : "результатов";
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value));
}
