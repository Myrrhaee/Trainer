"use client";

import Image from "next/image";
import { Eye, Plus, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import { ExerciseCategoryIcon } from "@/components/exercise-category-icon";
import type { ExerciseLibraryRow } from "@/lib/exercise-library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getExerciseVisualCategory } from "@/lib/exercise-categories";
import { cn } from "@/lib/utils";

type LibraryScope = "mine" | "system";

export function ExerciseLibraryPanel({
  exercises,
  search,
  onSearchChange,
  scope,
  onScopeChange,
  category,
  onCategoryChange,
  equipment,
  onEquipmentChange,
  categories,
  equipmentOptions,
  loading,
  copyingId,
  addLabel = "Добавить в тренировку",
  modeHint,
  onAdd,
  onAddToMine,
  onInspect,
}: {
  exercises: ExerciseLibraryRow[];
  search: string;
  onSearchChange: (value: string) => void;
  scope: LibraryScope;
  onScopeChange: (value: LibraryScope) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  equipment: string;
  onEquipmentChange: (value: string) => void;
  categories: string[];
  equipmentOptions: string[];
  loading: boolean;
  copyingId: string | null;
  addLabel?: string;
  modeHint?: string;
  onAdd: (exercise: ExerciseLibraryRow) => void;
  onAddToMine: (exercise: ExerciseLibraryRow) => void;
  onInspect: (exercise: ExerciseLibraryRow) => void;
}) {
  const emptyTitle =
    scope === "mine" ? "У вас пока нет упражнений" : "Базовая библиотека пока пуста";
  const emptyDescription =
    scope === "mine"
      ? "Создайте своё упражнение или добавьте системное в личную библиотеку."
      : "Попробуйте изменить фильтр или строку поиска.";

  return (
    <Card id="builder-library" className="overflow-hidden rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-xl text-zinc-50">Библиотека упражнений</CardTitle>
            <CardDescription className="text-zinc-400">
              {modeHint ?? "Найдите упражнение и добавьте его в тренировку за 1–2 клика."}
            </CardDescription>
          </div>

          <Tabs value={scope} onValueChange={(value) => onScopeChange(value as LibraryScope)}>
            <TabsList className="h-auto w-fit rounded-full border border-zinc-800 bg-zinc-950 p-1">
              <TabsTrigger
                value="mine"
                className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-zinc-100 data-[state=active]:text-black"
              >
                Мои упражнения
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-zinc-100 data-[state=active]:text-black"
              >
                Базовая библиотека
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск по названию, категории или мышцам"
              className="h-10 rounded-2xl border-zinc-800 bg-black/20 pl-10 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-10 rounded-2xl border border-zinc-800 bg-black/20 px-3 text-sm text-zinc-100 outline-none"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={equipment}
              onChange={(event) => onEquipmentChange(event.target.value)}
              className="h-10 rounded-2xl border border-zinc-800 bg-black/20 px-3 text-sm text-zinc-100 outline-none"
            >
              <option value="Всё оборудование">Всё оборудование</option>
              {equipmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 2xl:max-h-[calc(100vh-24rem)] 2xl:overflow-y-auto 2xl:pr-3">
        {loading ? (
          <div className="space-y-3">
            <LibrarySkeleton />
            <LibrarySkeleton />
            <LibrarySkeleton />
          </div>
        ) : exercises.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="mt-4 text-base font-semibold text-zinc-100">{emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">{emptyDescription}</p>
          </div>
        ) : (
          exercises.map((exercise) => (
            <ExerciseLibraryCard
              key={exercise.id}
              exercise={exercise}
              copying={copyingId === exercise.id}
              addLabel={addLabel}
              onAdd={() => onAdd(exercise)}
              onAddToMine={() => onAddToMine(exercise)}
              onInspect={() => onInspect(exercise)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ExerciseLibraryCard({
  exercise,
  copying,
  addLabel,
  onAdd,
  onAddToMine,
  onInspect,
}: {
  exercise: ExerciseLibraryRow;
  copying: boolean;
  addLabel: string;
  onAdd: () => void;
  onAddToMine: () => void;
  onInspect: () => void;
}) {
  const visualCategory = getExerciseVisualCategory(exercise) ?? exercise.muscle_group ?? "Все";

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(24,24,27,0.78),rgba(5,5,6,0.94))] transition hover:border-lime-300/16">
      <button
        type="button"
        onClick={onInspect}
        className="group relative block h-36 w-full overflow-hidden border-b border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.99))]"
      >
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          <Badge className="rounded-full border border-zinc-700 bg-zinc-950/86 text-zinc-300">
            {exercise.muscle_group ?? "Без категории"}
          </Badge>
          {exercise.is_system ? (
            <Badge className="rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Базовое
            </Badge>
          ) : (
            <Badge className="rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-300">
              <UserRound className="mr-1.5 h-3.5 w-3.5" />
              Моё
            </Badge>
          )}
        </div>

        {exercise.image_url ? (
          <Image
            src={exercise.image_url}
            alt={exercise.title}
            fill
            className="object-contain object-top p-4 transition duration-300 group-hover:scale-[1.03]"
            sizes="390px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex size-20 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-zinc-300">
              <ExerciseCategoryIcon category={visualCategory} className="size-12" />
            </div>
          </div>
        )}

        <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950/88 px-3 py-1.5 text-xs text-zinc-300 opacity-0 transition group-hover:opacity-100">
          <Eye className="size-3.5" />
          Техника
        </span>
      </button>

      <div className="p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">{exercise.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
              {exercise.equipment ?? "Без оборудования"}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
              {exercise.difficulty ?? "Сложность не указана"}
            </span>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {exercise.description?.trim() || "Описание пока не заполнено."}
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <Button
            type="button"
            className="rounded-full bg-zinc-100 text-black hover:bg-white"
            onClick={onAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
          <div className={cn("grid gap-2", exercise.is_system ? "grid-cols-2" : "grid-cols-1")}>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              onClick={onInspect}
            >
              <Eye className="mr-2 h-4 w-4" />
              Техника
            </Button>
            {exercise.is_system ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                onClick={onAddToMine}
                disabled={copying}
              >
                {copying ? "Добавляем..." : "К себе"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function LibrarySkeleton() {
  return (
    <div className="rounded-[1.3rem] border border-zinc-800/90 bg-black/20 p-4">
      <div className="h-4 w-40 rounded-full bg-zinc-800" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-zinc-900" />
        <div className="h-6 w-24 rounded-full bg-zinc-900" />
      </div>
      <div className="mt-4 h-3 w-full rounded-full bg-zinc-900" />
      <div className="mt-2 h-3 w-4/5 rounded-full bg-zinc-900" />
      <div className="mt-4 h-9 w-32 rounded-full bg-zinc-900" />
    </div>
  );
}
