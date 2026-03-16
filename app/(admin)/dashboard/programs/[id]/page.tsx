"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

type ExerciseInstance = {
  id: string;
  exercise_id: string;
  title: string;
  muscle_group?: string | null;
  video_url?: string | null;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
  rest: string;
};

type Day = {
  id: string;
  name: string;
  exercises: ExerciseInstance[];
};

type Week = {
  id: string;
  name: string;
  days: Day[];
};

type Plan = {
  weeks: Week[];
};

type Program = {
  id: string;
  title: string;
  plan_json: Plan | null;
};

type LibraryExercise = {
  id: string;
  title: string;
  muscle_group: string | null;
  video_url: string | null;
};

const supabase = getSupabaseClient();

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ProgramBuilderPage() {
  const params = useParams<{ id: string }>();
  const programId = params?.id;

  const [program, setProgram] = useState<Program | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  useEffect(() => {
    async function loadProgram() {
      if (!programId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("workout_templates")
        .select("id, title, plan_json")
        .eq("id", programId)
        .single();

      if (!error && data) {
        const loadedProgram = data as Program;
        let initialPlan: Plan;

        if (loadedProgram.plan_json && loadedProgram.plan_json.weeks) {
          initialPlan = loadedProgram.plan_json;
        } else {
          const weekId = createId();
          const dayId = createId();
          initialPlan = {
            weeks: [
              {
                id: weekId,
                name: "Week 1",
                days: [
                  {
                    id: dayId,
                    name: "Day 1",
                    exercises: [],
                  },
                ],
              },
            ],
          };
        }

        setProgram(loadedProgram);
        setPlan(initialPlan);
        setActiveWeekId(initialPlan.weeks[0]?.id ?? null);
        setActiveDayId(initialPlan.weeks[0]?.days[0]?.id ?? null);
      }

      setLoading(false);
    }

    loadProgram();
  }, [programId]);

  const activeWeek = useMemo(
    () => plan?.weeks.find((w) => w.id === activeWeekId) ?? null,
    [plan, activeWeekId]
  );

  const activeDay = useMemo(() => {
    if (!activeWeek) return null;
    return activeWeek.days.find((d) => d.id === activeDayId) ?? null;
  }, [activeWeek, activeDayId]);

  function addWeek() {
    if (!plan) return;
    const index = plan.weeks.length;
    const id = createId();
    const newWeek: Week = {
      id,
      name: `Week ${index + 1}`,
      days: [],
    };
    const nextPlan = { ...plan, weeks: [...plan.weeks, newWeek] };
    setPlan(nextPlan);
    setActiveWeekId(id);
    setActiveDayId(null);
  }

  function addDay(weekId: string) {
    if (!plan) return;
    const nextWeeks = plan.weeks.map((week) => {
      if (week.id !== weekId) return week;
      const index = week.days.length;
      const id = createId();
      const newDay: Day = {
        id,
        name: `Day ${index + 1}`,
        exercises: [],
      };
      return { ...week, days: [...week.days, newDay] };
    });
    setPlan({ ...plan, weeks: nextWeeks });

    setActiveWeekId(weekId);
    const targetWeek = nextWeeks.find((w) => w.id === weekId);
    setActiveDayId(targetWeek?.days[targetWeek.days.length - 1]?.id ?? null);
  }

  function updateExercise(
    exerciseId: string,
    field: keyof ExerciseInstance,
    value: string
  ) {
    if (!plan || !activeWeek || !activeDay) return;

    const nextWeeks = plan.weeks.map((week) => {
      if (week.id !== activeWeek.id) return week;
      const nextDays = week.days.map((day) => {
        if (day.id !== activeDay.id) return day;
        const nextExercises = day.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, [field]: value } : ex
        );
        return { ...day, exercises: nextExercises };
      });
      return { ...week, days: nextDays };
    });

    setPlan({ ...plan, weeks: nextWeeks });
  }

  function addExerciseFromLibrary(ex: LibraryExercise) {
    if (!plan || !activeWeek || !activeDay) return;

    const instanceId = createId();
    const instance: ExerciseInstance = {
      id: instanceId,
      exercise_id: ex.id,
      title: ex.title,
      muscle_group: ex.muscle_group,
      video_url: ex.video_url ?? null,
      sets: "",
      reps: "",
      weight: "",
      rpe: "",
      rest: "",
    };

    const nextWeeks = plan.weeks.map((week) => {
      if (week.id !== activeWeek.id) return week;
      const nextDays = week.days.map((day) => {
        if (day.id !== activeDay.id) return day;
        return { ...day, exercises: [...day.exercises, instance] };
      });
      return { ...week, days: nextDays };
    });

    setPlan({ ...plan, weeks: nextWeeks });
    setLibraryOpen(false);
  }

  async function loadLibraryExercises() {
    setLibraryLoading(true);
    const { data, error } = await supabase
      .from("exercises")
      .select("id, title, muscle_group, video_url")
      .order("title", { ascending: true });

    if (!error && data) {
      setLibraryExercises(data as LibraryExercise[]);
    }
    setLibraryLoading(false);
  }

  const filteredLibraryExercises = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return libraryExercises;
    return libraryExercises.filter((ex) => {
      const mg = ex.muscle_group || "";
      return ex.title.toLowerCase().includes(q) || mg.toLowerCase().includes(q);
    });
  }, [librarySearch, libraryExercises]);

  async function handleSave() {
    if (!programId || !plan) return;
    setSaving(true);

    const { error } = await supabase
      .from("workout_templates")
      .update({
        plan_json: plan,
        weeks: plan.weeks.length,
      })
      .eq("id", programId);

    setSaving(false);
    if (error) {
      console.error("Ошибка сохранения программы:", error);
      alert("Не удалось сохранить программу. Проверьте настройки Supabase и RLS.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading || !plan || !program) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-foreground">
        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <div className="h-8 w-40 rounded-full bg-zinc-900/80" />
          <p>Загружаем программу...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-black px-4 py-10 text-foreground">
      <main className="flex w-full max-w-6xl gap-6">
        <aside className="w-64 shrink-0 rounded-2xl border border-border/60 bg-zinc-950/70 p-4">
          <div className="mb-4 space-y-1">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-50">
              {program.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Структура по неделям и дням.
            </p>
          </div>

          <div className="space-y-3">
            {plan.weeks.map((week) => (
              <div key={week.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveWeekId(week.id);
                    if (week.days.length > 0) setActiveDayId(week.days[0].id);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                    activeWeekId === week.id
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-zinc-300 hover:bg-zinc-900/60"
                  }`}
                >
                  <span>{week.name}</span>
                  <span className="text-[10px] text-zinc-500">
                    {week.days.length} дн.
                  </span>
                </button>

                <div className="space-y-1 pl-2">
                  {week.days.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        setActiveWeekId(week.id);
                        setActiveDayId(day.id);
                      }}
                      className={`flex w-full items-center rounded-lg px-3 py-1.5 text-[11px] transition ${
                        activeDayId === day.id
                          ? "bg-zinc-900 text-zinc-50"
                          : "text-zinc-400 hover:bg-zinc-900/50"
                      }`}
                    >
                      {day.name}
                      <span className="ml-auto text-[10px] text-zinc-500">
                        {day.exercises.length} упр.
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addDay(week.id)}
                    className="mt-1 inline-flex items-center rounded-lg px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-100"
                  >
                    + День
                  </button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full rounded-xl border-border/70 bg-zinc-950/80 text-xs text-zinc-100"
              onClick={addWeek}
            >
              + Неделя
            </Button>
          </div>
        </aside>

        <section className="flex flex-1 flex-col gap-4">
          <header className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-50">
                {activeWeek?.name} · {activeDay?.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Добавляйте упражнения и настраивайте подходы, повторы и нагрузку.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border/70 bg-zinc-950/80 px-4 text-xs text-zinc-100"
                onClick={() => {
                  setLibraryOpen(true);
                  if (libraryExercises.length === 0) loadLibraryExercises();
                }}
                disabled={!activeDay}
              >
                + Добавить упражнение
              </Button>
              <Button
                type="button"
                className="rounded-full bg-zinc-100 px-5 py-2 text-xs font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? "Сохранение..."
                  : saved
                  ? "Сохранено!"
                  : "Сохранить программу"}
              </Button>
            </div>
          </header>

          {!activeWeek || !activeDay ? (
            <Card className="border border-border/70 bg-zinc-950/60">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-100">
                  Выберите неделю и день
                </CardTitle>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeDay.exercises.length === 0 ? (
                <Card className="border border-border/70 bg-zinc-950/60">
                  <CardHeader>
                    <CardTitle className="text-sm text-zinc-100">
                      В этом дне пока нет упражнений
                    </CardTitle>
                  </CardHeader>
                </Card>
              ) : (
                activeDay.exercises.map((exercise) => (
                  <Card
                    key={exercise.id}
                    className="border border-border/60 bg-zinc-950/80"
                  >
                    <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0 pb-3">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium text-zinc-50">
                          {exercise.title}
                        </CardTitle>
                        {exercise.muscle_group && (
                          <p className="text-xs text-zinc-500">
                            {exercise.muscle_group}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      <div className="grid gap-2 md:grid-cols-5">
                        <div className="space-y-1">
                          <p className="text-[11px] text-zinc-400">Подходы</p>
                          <Input
                            value={exercise.sets}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateExercise(exercise.id, "sets", e.target.value)
                            }
                            className="h-8 rounded-lg border-border/60 bg-zinc-900/80 text-xs"
                            placeholder="3"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-zinc-400">Повторы</p>
                          <Input
                            value={exercise.reps}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateExercise(exercise.id, "reps", e.target.value)
                            }
                            className="h-8 rounded-lg border-border/60 bg-zinc-900/80 text-xs"
                            placeholder="8–10"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-zinc-400">Вес</p>
                          <Input
                            value={exercise.weight}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateExercise(exercise.id, "weight", e.target.value)
                            }
                            className="h-8 rounded-lg border-border/60 bg-zinc-900/80 text-xs"
                            placeholder="80 кг / 70%"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-zinc-400">RPE</p>
                          <Input
                            value={exercise.rpe}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateExercise(exercise.id, "rpe", e.target.value)
                            }
                            className="h-8 rounded-lg border-border/60 bg-zinc-900/80 text-xs"
                            placeholder="7–8"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-zinc-400">Отдых</p>
                          <Input
                            value={exercise.rest}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateExercise(exercise.id, "rest", e.target.value)
                            }
                            className="h-8 rounded-lg border-border/60 bg-zinc-900/80 text-xs"
                            placeholder="90 сек"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-zinc-400">Заметки</p>
                        <Textarea
                          value={""}
                          readOnly
                          className="min-h-9 cursor-not-allowed rounded-lg border-dashed border-border/40 bg-transparent text-[11px] text-zinc-600"
                          placeholder="Скоро здесь можно будет добавлять заметки к упражнению."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>

        <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
          <SheetContent className="border-l border-border/70 bg-zinc-950/95 backdrop-blur-xl">
            <SheetHeader>
              <SheetTitle className="text-sm font-semibold text-zinc-50">
                Библиотека упражнений
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Найдите упражнение и добавьте его в текущий день программы.
              </SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col gap-3 px-4 pb-6 pt-2">
              <Input
                placeholder="Поиск по названию или группе мышц..."
                value={librarySearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLibrarySearch(e.target.value)
                }
                className="h-9 rounded-full border-border/70 bg-zinc-900/80 text-xs"
              />

              <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
                {libraryLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Загружаем упражнения...
                  </p>
                ) : filteredLibraryExercises.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ничего не найдено.
                  </p>
                ) : (
                  filteredLibraryExercises.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => addExerciseFromLibrary(ex)}
                      className="group block w-full text-left"
                    >
                      <Card className="border border-border/60 bg-zinc-950/80 transition hover:border-zinc-500/80 hover:bg-zinc-900/80">
                        <CardHeader className="space-y-1 pb-2">
                          <CardTitle className="text-xs font-medium text-zinc-50">
                            {ex.title}
                          </CardTitle>
                          {ex.muscle_group && (
                            <p className="text-[11px] text-zinc-500">
                              {ex.muscle_group}
                            </p>
                          )}
                        </CardHeader>
                      </Card>
                    </button>
                  ))
                )}
              </div>
              <SheetFooter className="mt-2 justify-end px-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border/70 bg-zinc-950/80 px-4 text-xs text-zinc-100"
                  onClick={() => setLibraryOpen(false)}
                >
                  Закрыть
                </Button>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}

