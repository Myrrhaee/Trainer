"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Dumbbell,
  Plus,
  Search,
} from "lucide-react";
import { createSafeId } from "@/lib/utils";

const RECENT_EXERCISES = [
  "Жим лёжа",
  "Присед",
  "Тяга верхнего блока",
  "Жим гантелей",
  "Сгибания на бицепс",
] as const;

type CurrentExercise = {
  id: string;
  name: string;
  note: string;
};

const INITIAL_WORKOUT: CurrentExercise[] = [
  {
    id: "e1",
    name: "Жим гантелей на наклонной",
    note: "Добавьте подходы по ходу — без привязки к программе.",
  },
  {
    id: "e2",
    name: "Разводки",
    note: "Фокус на технике и контроле негатива.",
  },
];

export default function FreeWorkoutPage() {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<CurrentExercise[]>(INITIAL_WORKOUT);

  const filteredRecent = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...RECENT_EXERCISES];
    return RECENT_EXERCISES.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  function addFromRecent(name: string) {
    const id = `r-${name}-${createSafeId()}`;
    setCurrent((prev) => [
      ...prev,
      { id, name, note: "Быстро добавлено из недавних." },
    ]);
    setQuery("");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col pb-36">
      <header className="mb-6 flex items-start gap-3">
        <Link
          href="/client/me"
          className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-400 transition active:scale-[0.98] hover:border-zinc-600 hover:text-zinc-100"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Вне плана
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[1.65rem]">
            Свободная тренировка
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Без тренера и назначенной программы — только ваши упражнения и темп.
          </p>
        </div>
      </header>

      <section
        aria-label="Поиск и добавление"
        className="mb-8 rounded-2xl border border-zinc-800/90 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      >
        <label className="sr-only" htmlFor="exercise-search">
          Найти упражнение
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              id="exercise-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Найти упражнение…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-black/40 pl-10 pr-3 text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition active:scale-[0.99] hover:bg-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить
          </button>
        </div>
      </section>

      <section className="mb-8" aria-label="Недавние упражнения">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
            Недавние
          </h2>
          <span className="text-xs text-zinc-600">тап — в тренировку</span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filteredRecent.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addFromRecent(name)}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-200 transition active:scale-[0.98] hover:border-zinc-600 hover:bg-zinc-800/80"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex-1" aria-label="Текущая тренировка">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
            Сейчас в тренировке
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            черновик
          </span>
        </div>

        <ul className="space-y-3" role="list">
          {current.map((ex, index) => (
            <li key={ex.id}>
              <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-950/90 to-black/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs font-semibold tabular-nums text-zinc-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-zinc-50">
                      {ex.name}
                    </p>
                    <p className="mt-1.5 text-sm text-zinc-500">{ex.note}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-zinc-800/90 bg-black/30 px-3 py-2 text-xs font-medium text-zinc-400">
                        Подходы: —
                      </span>
                      <span className="rounded-lg border border-zinc-800/90 bg-black/30 px-3 py-2 text-xs font-medium text-zinc-400">
                        Вес: —
                      </span>
                    </div>
                  </div>
                  <Dumbbell
                    className="mt-1 h-5 w-5 shrink-0 text-zinc-600"
                    aria-hidden
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/90 bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 py-4 text-base font-semibold tracking-tight text-zinc-950 shadow-[0_1px_0_0_rgba(255,255,255,0.1)] transition active:scale-[0.99] hover:bg-white"
          >
            <Check className="h-5 w-5" aria-hidden />
            Завершить тренировку
          </button>
        </div>
      </div>
    </div>
  );
}
