"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { ExerciseCategoryIcon } from "@/components/exercise-category-icon";
import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import { getDemoLibraryExercises } from "@/lib/demo-data";
import {
  copySystemExerciseToMyLibrary,
  createCustomExercise,
  deleteOwnedExercise,
  loadVisibleExerciseLibrary,
  type ExerciseLibraryRow,
  updateOwnedExercise,
} from "@/lib/exercise-library";
import {
  EXERCISE_ASSIGNABLE_CATEGORIES,
  EXERCISE_FILTER_CATEGORIES,
  matchesExerciseCategory,
} from "@/lib/exercise-categories";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { createSafeId, logSupabaseError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const supabase = createClient();

type LibraryScope = "mine" | "system";
const DIFFICULTY_OPTIONS = ["Лёгкая", "Средняя", "Сложная"] as const;

export default function LibraryPage() {
  const { trainerId } = useTrainer();
  const demoMode = isDemoModeEnabled();
  const [exercises, setExercises] = useState<ExerciseLibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("Все");
  const [scope, setScope] = useState<LibraryScope>("mine");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryRow | null>(null);
  const [title, setTitle] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!trainerId) return;
    const currentTrainerId = trainerId;
    let cancelled = false;

    async function loadExercises() {
      setLoading(true);

       if (demoMode) {
        setExercises(getDemoLibraryExercises());
        setLoading(false);
        return;
      }

      const result = await loadVisibleExerciseLibrary(supabase, currentTrainerId);
      if (cancelled) return;

      if (result.error) {
        logSupabaseError("library exercises", result.error);
        setExercises([]);
      } else {
        setExercises(result.data);
      }

      setLoading(false);
    }

    void loadExercises();
    return () => {
      cancelled = true;
    };
  }, [demoMode, trainerId]);

  const summary = useMemo(() => {
    const owned = exercises.filter((exercise) => !exercise.is_system);
    const system = exercises.filter((exercise) => exercise.is_system);

    return {
      total: exercises.length,
      owned: owned.length,
      system: system.length,
      withVideo: exercises.filter((exercise) => Boolean(exercise.video_url?.trim())).length,
      byGroup: EXERCISE_ASSIGNABLE_CATEGORIES.map((group) => ({
        group,
        count: exercises.filter((exercise) => matchesExerciseCategory(exercise, group)).length,
      })),
    };
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (scope === "mine" ? exercise.is_system : !exercise.is_system) return false;

      const byQuery =
        !query ||
        exercise.title.toLowerCase().includes(query) ||
        (exercise.muscle_group ?? "").toLowerCase().includes(query);
      const byGroup = matchesExerciseCategory(exercise, activeGroup);
      return byQuery && byGroup;
    });
  }, [activeGroup, exercises, scope, search]);

  function openForCreate() {
    setEditing(null);
    setTitle("");
    setMuscleGroup("");
    setEquipment("");
    setDifficulty("");
    setDescription("");
    setVideoUrl("");
    setSheetOpen(true);
  }

  function openForEdit(exercise: ExerciseLibraryRow) {
    if (exercise.is_system) return;
    setEditing(exercise);
    setTitle(exercise.title);
    setMuscleGroup(exercise.muscle_group ?? "");
    setEquipment(exercise.equipment ?? "");
    setDifficulty(exercise.difficulty ?? "");
    setDescription(exercise.description ?? "");
    setVideoUrl(exercise.video_url ?? "");
    setSheetOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainerId || !title.trim() || !muscleGroup) return;

    setSaving(true);

    const payload = {
      title: title.trim(),
      muscle_group: muscleGroup,
      equipment: equipment.trim() || null,
      difficulty: difficulty || null,
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
    };

    if (demoMode) {
      const nextExercise: ExerciseLibraryRow = editing
        ? {
            ...editing,
            ...payload,
          }
        : {
            id: createSafeId(),
            ...payload,
            technique_steps: [],
            tips: [],
            muscle_groups: muscleGroup ? [muscleGroup] : [],
            is_system: false,
            owner_user_id: trainerId,
            source_exercise_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

      setExercises((prev) => {
        if (editing) {
          return prev.map((exercise) => (exercise.id === editing.id ? nextExercise : exercise));
        }
        return [nextExercise, ...prev];
      });
      setSaving(false);
      setSheetOpen(false);
      setScope("mine");
      return;
    }

    const result = editing
      ? await updateOwnedExercise(supabase, trainerId, editing.id, payload)
      : await createCustomExercise(supabase, trainerId, payload);

    if (result.error) {
      logSupabaseError("library save exercise", result.error);
      setSaving(false);
      return;
    }

    if (result.data) {
      setExercises((prev) => {
        if (editing) {
          return prev.map((exercise) =>
            exercise.id === editing.id ? result.data as ExerciseLibraryRow : exercise
          );
        }
        return [result.data as ExerciseLibraryRow, ...prev];
      });
      setScope("mine");
    }

    setSaving(false);
    setSheetOpen(false);
  }

  async function handleCopy(exercise: ExerciseLibraryRow) {
    if (!exercise.is_system) return;

    if (demoMode) {
      const copy: ExerciseLibraryRow = {
        ...exercise,
        id: createSafeId(),
        is_system: false,
        owner_user_id: trainerId,
        source_exercise_id: exercise.id,
      };
      setExercises((prev) => [copy, ...prev]);
      setScope("mine");
      return;
    }

    setCopyingId(exercise.id);
    const result = await copySystemExerciseToMyLibrary(supabase, exercise.id);
    if (result.error) {
      logSupabaseError("library copy system exercise", result.error);
      setCopyingId(null);
      return;
    }

    if (result.data) {
      setExercises((prev) => [result.data as ExerciseLibraryRow, ...prev]);
      setScope("mine");
    }
    setCopyingId(null);
  }

  async function handleDelete(exercise: ExerciseLibraryRow) {
    if (!trainerId || exercise.is_system) return;

    if (demoMode) {
      setExercises((prev) => prev.filter((row) => row.id !== exercise.id));
      return;
    }

    setDeletingId(exercise.id);
    const result = await deleteOwnedExercise(supabase, trainerId, exercise.id);
    if (result.error) {
      logSupabaseError("library delete exercise", result.error);
      setDeletingId(null);
      return;
    }

    setExercises((prev) => prev.filter((row) => row.id !== exercise.id));
    setDeletingId(null);
  }

  const emptyTitle =
    scope === "mine"
      ? "У вас пока нет упражнений"
      : "Базовая библиотека пока пуста";

  const emptyDescription =
    scope === "mine"
      ? "Скопируйте системное упражнение или создайте своё, чтобы собрать рабочую библиотеку."
      : "После применения миграций здесь появятся системные упражнения, доступные всем тренерам.";

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[1.35fr,1fr]">
          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
            <CardContent className="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Библиотека упражнений
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
                    Упражнения
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    Системные упражнения доступны всем как база. Ваши упражнения живут отдельно:
                    их можно редактировать, удалять и использовать в программах без риска менять
                    общие шаблоны.
                  </p>
                </div>

                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button onClick={openForCreate} className="rounded-full bg-zinc-100 text-black hover:bg-white">
                      <Plus className="mr-2 h-4 w-4" />
                      Новое упражнение
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="border-l border-zinc-800 bg-zinc-950/95 text-zinc-100">
                    <SheetHeader>
                      <SheetTitle className="text-lg font-semibold text-zinc-50">
                        {editing ? "Редактировать упражнение" : "Новое упражнение"}
                      </SheetTitle>
                      <SheetDescription className="text-zinc-400">
                        Создайте своё упражнение или обновите карточку в личной библиотеке.
                        Системные упражнения редактировать нельзя.
                      </SheetDescription>
                    </SheetHeader>
                    <form
                      onSubmit={handleSubmit}
                      className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Название</Label>
                        <Input
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="Например, Жим штанги лёжа"
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-900/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Категория</Label>
                      <div className="flex flex-wrap gap-2">
                          {EXERCISE_ASSIGNABLE_CATEGORIES.map((group) => (
                            <button
                              key={group}
                              type="button"
                              onClick={() => setMuscleGroup(group)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                                muscleGroup === group
                                  ? "border-zinc-100 bg-zinc-100 text-black"
                                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                              }`}
                            >
                              <ExerciseCategoryIcon category={group} className="h-10 w-10" />
                              {group}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Оборудование</Label>
                          <Input
                            value={equipment}
                            onChange={(event) => setEquipment(event.target.value)}
                            placeholder="Например, штанга, гантели, блок"
                            className="h-10 rounded-xl border-zinc-700 bg-zinc-900/80"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Сложность</Label>
                          <div className="flex flex-wrap gap-2">
                            {DIFFICULTY_OPTIONS.map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setDifficulty(item)}
                                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                  difficulty === item
                                    ? "border-zinc-100 bg-zinc-100 text-black"
                                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                                }`}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Описание</Label>
                        <Textarea
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Короткая техника, акценты, подсказки для клиента..."
                          className="min-h-32 rounded-xl border-zinc-700 bg-zinc-900/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Ссылка на видео</Label>
                        <Input
                          value={videoUrl}
                          onChange={(event) => setVideoUrl(event.target.value)}
                          placeholder="https://youtube.com/..."
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-900/80"
                        />
                      </div>
                      <SheetFooter className="mt-auto">
                        <Button
                          type="submit"
                          disabled={saving || !title.trim() || !muscleGroup}
                          className="rounded-full bg-zinc-100 text-black hover:bg-white disabled:opacity-60"
                        >
                          {saving ? "Сохраняем..." : editing ? "Сохранить" : "Создать"}
                        </Button>
                      </SheetFooter>
                    </form>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <SummaryTile label="Всего в доступе" value={String(summary.total)} />
                <SummaryTile label="Мои упражнения" value={String(summary.owned)} />
                <SummaryTile label="Системные" value={String(summary.system)} />
                <SummaryTile label="С видео" value={String(summary.withVideo)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-zinc-50">Срез по группам</CardTitle>
              <CardDescription className="text-zinc-400">
                Быстрый вход в нужную часть библиотеки.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {summary.byGroup.map((item) => (
                <button
                  key={item.group}
                  type="button"
                  onClick={() => setActiveGroup(item.group)}
                  className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                    activeGroup === item.group
                      ? "border-zinc-100 bg-zinc-100 text-black"
                      : "border-zinc-800 bg-black/20 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                        <ExerciseCategoryIcon category={item.group} className="h-10 w-10" />
                      </span>
                      <span className="font-medium">{item.group}</span>
                    </div>
                    <span className="text-sm opacity-80">{item.count}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3">
            <Tabs value={scope} onValueChange={(value) => setScope(value as LibraryScope)}>
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

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск по названию или группе мышц"
                  className="h-10 rounded-full border-zinc-700 bg-zinc-900/80 pl-10"
                />
              </div>
              {scope === "mine" ? (
                <Button onClick={openForCreate} className="rounded-full bg-zinc-100 text-black hover:bg-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Создать новое
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {EXERCISE_FILTER_CATEGORIES.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setActiveGroup(group)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                    activeGroup === group
                      ? "border-zinc-100 bg-zinc-100 text-black"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  {group === "Все" ? null : group === "Любимые" ? (
                    <Heart className="h-4 w-4" />
                  ) : (
                    <ExerciseCategoryIcon category={group} className="h-10 w-10" />
                  )}
                  {group}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ExerciseSkeleton />
              <ExerciseSkeleton />
              <ExerciseSkeleton />
            </div>
          ) : filteredExercises.length === 0 ? (
            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardContent className="p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="mt-4 text-lg font-semibold text-zinc-100">{emptyTitle}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  {emptyDescription}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredExercises.map((exercise) => {
                const isOwned = !exercise.is_system;
                const isCopying = copyingId === exercise.id;
                const isDeleting = deletingId === exercise.id;

                return (
                  <Card
                    key={exercise.id}
                    className="h-full rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90"
                  >
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="rounded-[1.35rem] border border-zinc-800 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                                {exercise.muscle_group ?? "Без категории"}
                              </Badge>
                              {exercise.is_system ? (
                                <Badge className="rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200">
                                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                  Системное
                                </Badge>
                              ) : (
                                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                                  <UserRound className="mr-1.5 h-3.5 w-3.5" />
                                  Моё
                                </Badge>
                              )}
                            </div>
                            <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-50">
                              {exercise.title}
                            </h2>
                          </div>
                          {exercise.video_url?.trim() ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 p-2 text-emerald-200">
                              <PlayCircle className="h-4 w-4" />
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-zinc-400">
                          {exercise.description?.trim() ||
                            "Добавьте описание техники, чтобы упражнение было проще использовать в программах и объяснять клиенту."}
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <LibraryMetaItem
                            label="Категория"
                            value={exercise.muscle_group ?? "Не указана"}
                          />
                          <LibraryMetaItem
                            label="Оборудование"
                            value={exercise.equipment ?? "Не указано"}
                          />
                          <LibraryMetaItem
                            label="Сложность"
                            value={exercise.difficulty ?? "Не указана"}
                          />
                          <LibraryMetaItem
                            label="Группы мышц"
                            value={exercise.muscle_group ?? "Не указаны"}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-zinc-300">
                        <span>{exercise.video_url?.trim() ? "Видео добавлено" : "Видео не добавлено"}</span>
                        {exercise.source_exercise_id ? (
                          <span className="text-xs text-zinc-500">Скопировано из системной базы</span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isOwned ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                              onClick={() => openForEdit(exercise)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Редактировать
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                              disabled={isDeleting}
                              onClick={() => void handleDelete(exercise)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {isDeleting ? "Удаляем..." : "Удалить"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            className="rounded-full bg-zinc-100 text-black hover:bg-white"
                            disabled={isCopying}
                            onClick={() => void handleCopy(exercise)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {isCopying ? "Добавляем..." : "Добавить к себе"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

function LibraryMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function ExerciseSkeleton() {
  return (
    <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
      <CardContent className="p-5">
        <div className="rounded-[1.35rem] border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="h-6 w-28 rounded-full bg-zinc-800" />
          <div className="mt-4 h-6 w-44 rounded-full bg-zinc-800" />
          <div className="mt-4 h-3 w-full rounded-full bg-zinc-900" />
          <div className="mt-2 h-3 w-4/5 rounded-full bg-zinc-900" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-zinc-900" />
        </div>
        <div className="mt-4 h-9 w-40 rounded-full bg-zinc-900" />
      </CardContent>
    </Card>
  );
}
