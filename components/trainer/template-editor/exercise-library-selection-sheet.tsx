"use client";

import { ArrowLeft, ChevronRight, ImageOff, Loader2, Plus, Search } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createExerciseSelectionSnapshot, type ExerciseDetailReadModel, type ExerciseLibraryItem } from "@/lib/exercise-library-contract";
import { fetchExerciseDetail, fetchExerciseLibrary } from "./workout-template-editor-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (snapshot: NonNullable<ReturnType<typeof createExerciseSelectionSnapshot>>) => void;
};

export function ExerciseLibrarySelectionSheet({ open, onOpenChange, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [bodyRegion, setBodyRegion] = useState("");
  const [scope, setScope] = useState("all");
  const [items, setItems] = useState<ExerciseLibraryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<ExerciseDetailReadModel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filters = useMemo(() => ({ query: settledQuery, category, equipment, bodyRegion, scope }), [settledQuery, category, equipment, bodyRegion, scope]);
  const load = useCallback(async (after: string | null = null) => {
    const current = ++requestId.current;
    if (after) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    const search = new URLSearchParams({ first: "24" });
    if (filters.query) search.set("q", filters.query);
    if (filters.category) search.set("category", filters.category);
    if (filters.equipment) search.set("equipment", filters.equipment);
    if (filters.bodyRegion) search.set("bodyRegion", filters.bodyRegion);
    if (filters.scope !== "all") search.set("scope", filters.scope);
    if (after) search.set("cursor", after);
    try {
      const model = await fetchExerciseLibrary(search);
      if (current !== requestId.current) return;
      setItems((existing) => after ? mergeById(existing, model.items) : model.items);
      setCursor(model.pageInfo.endCursor);
      setHasNext(model.pageInfo.hasNextPage);
    } catch {
      if (current === requestId.current) setError(true);
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    if (open && !detail) void load();
  }, [open, detail, load]);

  async function openDetail(item: ExerciseLibraryItem) {
    setDetailLoading(true);
    setDetailError(false);
    try {
      setDetail(await fetchExerciseDetail(item.exerciseId));
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function add(detailValue: ExerciseDetailReadModel) {
    const snapshot = createExerciseSelectionSnapshot(detailValue);
    if (!snapshot) return;
    onSelect(snapshot);
    setDetail(null);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) setDetail(null); onOpenChange(value); }}>
      <SheetContent
        side="right"
        className="w-full max-w-none border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:max-w-[680px]"
        overlayClassName="bg-black/65"
      >
        <SheetHeader className="border-b border-zinc-800 px-5 py-4">
          <SheetTitle className="text-lg text-zinc-50">{detail ? detail.title : "Библиотека упражнений"}</SheetTitle>
          <SheetDescription className="text-zinc-400">
            {detail ? "Проверьте источник и добавьте снимок упражнения в шаблон." : "Канонический каталог тренера. Упражнения загружаются по мере просмотра."}
          </SheetDescription>
        </SheetHeader>

        {detail ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
            <Button type="button" variant="ghost" onClick={() => setDetail(null)} className="mb-4 min-h-11 px-0 text-zinc-300">
              <ArrowLeft />К списку
            </Button>
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              {detail.image.url ? <Image src={detail.image.url} alt="" fill unoptimized sizes="(max-width: 680px) 100vw, 640px" className="object-contain" /> : <div className="flex h-full items-center justify-center text-zinc-600"><ImageOff className="size-8" /></div>}
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Категория" value={detail.category} />
              <Detail label="Оборудование" value={detail.equipment} />
              <Detail label="Область тела" value={detail.bodyRegion} />
              <Detail label="Источник" value={detail.sourceLabel} />
            </dl>
            {detail.description ? <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{detail.description}</p> : null}
            {detail.image.availability === "image_unavailable" ? <p className="mt-4 text-sm text-amber-200">Изображение пока недоступно. Само упражнение можно использовать.</p> : null}
            {detail.status === "archived" ? <p role="alert" className="mt-4 text-sm text-amber-200">Упражнение находится в архиве и недоступно для добавления.</p> : null}
            <Button type="button" onClick={() => add(detail)} disabled={!detail.canSelect} className="mt-6 min-h-11 w-full bg-lime-300 text-black hover:bg-lime-200">
              <Plus />Добавить упражнение
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px]">
              <div className="relative">
                <Label htmlFor="editor-library-search" className="sr-only">Поиск упражнений</Label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input id="editor-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название упражнения" className="h-11 border-zinc-800 bg-black pl-10" />
              </div>
              <label className="sr-only" htmlFor="editor-library-category">Категория</label>
              <Input id="editor-library-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Категория" className="h-11 border-zinc-800 bg-black" />
              <select aria-label="Источник упражнений" value={scope} onChange={(event) => setScope(event.target.value)} className="h-11 rounded-lg border border-zinc-800 bg-black px-3 text-sm text-zinc-200">
                <option value="all">Все</option><option value="system">Системные</option><option value="trainer">Мои</option>
              </select>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input value={equipment} onChange={(event) => setEquipment(event.target.value)} aria-label="Оборудование" placeholder="Оборудование" className="h-11 border-zinc-800 bg-black" />
              <Input value={bodyRegion} onChange={(event) => setBodyRegion(event.target.value)} aria-label="Область тела" placeholder="Область тела" className="h-11 border-zinc-800 bg-black" />
            </div>
            {loading ? <LibraryStatus><Loader2 className="size-4 animate-spin" />Загружаем упражнения…</LibraryStatus> : error ? (
              <div role="alert" className="mt-6 rounded-lg border border-rose-300/20 p-5 text-center text-sm text-rose-100">Не удалось загрузить библиотеку.<Button type="button" variant="outline" onClick={() => void load()} className="mx-auto mt-3 min-h-11 border-zinc-700">Повторить</Button></div>
            ) : items.length === 0 ? <LibraryStatus>По выбранным условиям ничего не найдено.</LibraryStatus> : (
              <ul className="mt-5 grid gap-2" aria-label="Упражнения">
                {items.map((item) => <li key={item.exerciseId}>
                  <button type="button" onClick={() => void openDetail(item)} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-left transition hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60">
                    <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900">{item.image.url ? <Image src={item.image.url} alt="" fill unoptimized sizes="44px" className="object-contain" /> : <ImageOff className="size-4 text-zinc-600" />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-zinc-100">{item.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{[item.category, item.equipment, item.sourceLabel].filter(Boolean).join(" · ")}</p></div>
                    <ChevronRight className="size-4 text-zinc-600" />
                  </button>
                </li>)}
              </ul>
            )}
            {hasNext && cursor ? <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void load(cursor)} className="mt-4 min-h-11 w-full border-zinc-700">{loadingMore ? <Loader2 className="animate-spin" /> : null}Показать ещё</Button> : null}
            {detailLoading ? <LibraryStatus><Loader2 className="size-4 animate-spin" />Загружаем карточку…</LibraryStatus> : null}
            {detailError ? <p role="alert" className="mt-3 text-sm text-rose-200">Не удалось открыть упражнение.</p> : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs uppercase text-zinc-600">{label}</dt><dd className="mt-1 text-zinc-200">{value || "Не указано"}</dd></div>;
}

function LibraryStatus({ children }: { children: ReactNode }) {
  return <div role="status" className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">{children}</div>;
}

function mergeById(current: ExerciseLibraryItem[], incoming: ExerciseLibraryItem[]) {
  const seen = new Set(current.map((item) => item.exerciseId));
  return [...current, ...incoming.filter((item) => !seen.has(item.exerciseId))];
}
