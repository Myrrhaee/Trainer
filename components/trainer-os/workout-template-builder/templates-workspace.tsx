"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Copy,
  Dumbbell,
  FileEdit,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { summarizeTemplate, type TemplateStatus, type WorkoutTemplateDraft } from "./builder-model";

type TemplateFilter = "all" | TemplateStatus;

export function TemplatesWorkspace({
  templates,
  athleteId,
  onCreate,
  onOpen,
  onDuplicate,
  onArchive,
  onAssign,
}: {
  templates: WorkoutTemplateDraft[];
  athleteId?: string;
  onCreate: () => void;
  onOpen: (template: WorkoutTemplateDraft) => void;
  onDuplicate: (template: WorkoutTemplateDraft) => void;
  onArchive: (template: WorkoutTemplateDraft) => void;
  onAssign: (template: WorkoutTemplateDraft) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [category, setCategory] = useState("Все категории");
  const summaries = useMemo(() => templates.map((template) => ({ template, summary: summarizeTemplate(template) })), [templates]);
  const categories = useMemo(
    () => ["Все категории", ...Array.from(new Set(templates.map((template) => template.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"))],
    [templates]
  );
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    return summaries.filter(({ summary }) => {
      if (filter !== "all" && summary.status !== filter) return false;
      if (category !== "Все категории" && summary.category !== category) return false;
      return !normalized || [summary.title, summary.description, summary.category].join(" ").toLocaleLowerCase("ru").includes(normalized);
    });
  }, [category, filter, query, summaries]);

  if (templates.length === 0) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-10">
        <section className="mx-auto flex min-h-[68vh] w-full max-w-3xl flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-lime-200">
            <Dumbbell className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-zinc-50">Создайте первый шаблон</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            Шаблоны сохраняют структуру тренировки и используются повторно. Назначение спортсмену создаётся отдельно через Quick Assign.
          </p>
          <Button type="button" onClick={onCreate} className="mt-6 min-h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200">
            <Plus className="size-4" />Создать первый шаблон
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-10">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-lime-200/70">WorkoutTemplate workspace</p>
            <h2 className="mt-2 text-3xl font-semibold text-zinc-50">Шаблоны тренировок</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">Создавайте переиспользуемые тренировки без привязки к Program или календарю.</p>
          </div>
          <Button type="button" onClick={onCreate} className="min-h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200">
            <Plus className="size-4" />Новый шаблон
          </Button>
        </header>

        {athleteId ? (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-lime-200/70">Контекст спортсмена сохранён</p>
              <p className="mt-1 text-sm text-zinc-300">После публикации можно вернуться в Quick Assign для этого спортсмена.</p>
            </div>
            <span className="text-xs text-zinc-500">Без автоматического назначения</span>
          </div>
        ) : null}

        <section aria-label="Фильтры шаблонов" className="mt-5 grid gap-3 border-b border-zinc-800 pb-5 lg:grid-cols-[minmax(280px,1fr)_auto_220px]">
          <div className="relative min-w-0">
            <Label htmlFor="template-search" className="sr-only">Поиск шаблонов</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            <Input id="template-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, focus или категории" className="h-11 min-w-0 border-zinc-800 bg-zinc-950 pl-10 text-zinc-100" />
          </div>
          <div role="tablist" aria-label="Статус шаблона" className="flex gap-2 overflow-x-auto">
            {(["all", "draft", "published", "archived"] as TemplateFilter[]).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60", filter === value ? "border-lime-300/35 bg-lime-300/10 text-lime-100" : "border-zinc-800 text-zinc-400 hover:text-zinc-100")}>
                {filterLabel(value)}
              </button>
            ))}
          </div>
          <Label className="sr-only" htmlFor="template-category">Категория</Label>
          <select id="template-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-lime-300/40">
            {categories.map((value) => <option key={value}>{value}</option>)}
          </select>
        </section>

        {visible.length ? (
          <section aria-label="Список шаблонов" className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ template, summary }) => (
              <article key={template.id} className="flex min-h-[240px] flex-col rounded-lg border border-zinc-800 bg-zinc-950/74 p-4 transition hover:border-zinc-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TemplateStatusBadge status={summary.status} />
                      <span className="text-xs text-zinc-600">revision {summary.revision}</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-xl font-semibold text-zinc-50">{summary.title || "Без названия"}</h2>
                  </div>
                  <MoreHorizontal className="size-4 shrink-0 text-zinc-700" aria-hidden="true" />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{summary.description || "Описание пока не заполнено."}</p>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Состав" value={`${summary.exerciseCount} упр.`} />
                  <Metric label="Время" value={`${summary.estimatedDurationMin} мин`} />
                  <Metric label="Focus" value={summary.category || "Не задан"} />
                  <Metric label="Использований" value={String(summary.usageCount)} />
                </dl>
                <p className="mt-3 text-xs text-zinc-600">Обновлён {summary.updatedLabel}</p>
                <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2 pt-4">
                  <Button type="button" onClick={() => onOpen(template)} className="min-h-11 justify-between rounded-full bg-zinc-100 px-4 text-black hover:bg-white">
                    Открыть<ArrowRight className="size-4" />
                  </Button>
                  <Button type="button" size="icon-lg" variant="outline" onClick={() => onDuplicate(template)} aria-label={`Дублировать ${summary.title}`} title="Дублировать" className="rounded-full border-zinc-700 text-zinc-300"><Copy className="size-4" /></Button>
                  {summary.status !== "archived" ? (
                    <Button type="button" size="icon-lg" variant="outline" onClick={() => onArchive(template)} aria-label={`Архивировать ${summary.title}`} title="Архивировать prototype" className="rounded-full border-zinc-700 text-zinc-400"><Archive className="size-4" /></Button>
                  ) : <span className="size-9" />}
                </div>
                {athleteId && summary.status === "published" ? (
                  <Button type="button" variant="ghost" onClick={() => onAssign(template)} className="mt-2 min-h-11 rounded-full text-lime-200 hover:bg-lime-300/10">
                    <Dumbbell className="size-4" />Назначить спортсмену
                  </Button>
                ) : null}
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-lg border border-dashed border-zinc-700 p-8 text-center">
            <FileEdit className="mx-auto size-6 text-zinc-600" />
            <h2 className="mt-3 text-lg font-semibold text-zinc-100">Шаблоны не найдены</h2>
            <p className="mt-2 text-sm text-zinc-500">Измените запрос или сбросьте фильтры.</p>
            <Button type="button" variant="outline" onClick={() => { setQuery(""); setFilter("all"); setCategory("Все категории"); }} className="mt-4 min-h-11 rounded-full border-zinc-700 text-zinc-100">Сбросить фильтры</Button>
          </section>
        )}
      </div>
    </main>
  );
}

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", status === "published" ? "border-lime-300/25 bg-lime-300/10 text-lime-100" : status === "archived" ? "border-zinc-700 bg-zinc-900 text-zinc-500" : "border-amber-300/25 bg-amber-300/10 text-amber-100")}>{filterLabel(status)}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-zinc-800 bg-black/24 px-3 py-2"><dt className="text-xs text-zinc-600">{label}</dt><dd className="mt-1 truncate font-medium text-zinc-200">{value}</dd></div>;
}

function filterLabel(value: TemplateFilter) {
  if (value === "all") return "Все";
  if (value === "draft") return "Draft";
  if (value === "published") return "Published";
  return "Archived";
}
