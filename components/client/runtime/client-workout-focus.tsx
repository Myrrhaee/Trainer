"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  SkipForward,
} from "lucide-react";

import { useProductDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import type {
  ClientDemoActor,
  RuntimeExerciseLog,
  RuntimeSetLog,
} from "@/components/trainer-os/demo-runtime/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ClientWorkoutFocusProps = {
  actor: ClientDemoActor;
  sessionId: string;
  exercises: RuntimeExerciseLog[];
  onError: (message: string | null) => void;
};

type FocusTarget = {
  exerciseId: string;
  setId: string;
};

export function ClientWorkoutFocus({ actor, sessionId, exercises, onError }: ClientWorkoutFocusProps) {
  const runtime = useProductDemoRuntime();
  const initialTarget = findInitialTarget(exercises);
  const [activeExerciseId, setActiveExerciseId] = useState(initialTarget?.exerciseId ?? exercises[0]?.id ?? "");
  const [activeSetId, setActiveSetId] = useState(initialTarget?.setId ?? exercises[0]?.sets[0]?.id ?? "");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const activeExercise = exercises.find((exercise) => exercise.id === activeExerciseId) ?? exercises[0];
  const activeSet = activeExercise?.sets.find((set) => set.id === activeSetId)
    ?? activeExercise?.sets.find((set) => !set.completed)
    ?? activeExercise?.sets[0];
  const allSets = exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })));
  const activeGlobalIndex = activeSet ? allSets.findIndex((item) => item.set.id === activeSet.id) : -1;
  const completedSets = allSets.filter((item) => item.set.completed).length;
  const completedExercises = exercises.filter((exercise) => exercise.status === "completed").length;
  const handledExercises = exercises.filter((exercise) => exercise.status === "completed" || exercise.status === "skipped").length;
  const progressPercent = allSets.length ? Math.round((completedSets / allSets.length) * 100) : 0;

  function focus(target: FocusTarget | null) {
    if (!target) return;
    setActiveExerciseId(target.exerciseId);
    setActiveSetId(target.setId);
  }

  function selectExercise(exercise: RuntimeExerciseLog) {
    const set = exercise.sets.find((item) => !item.completed) ?? exercise.sets[0];
    if (!set) return;
    focus({ exerciseId: exercise.id, setId: set.id });
    setSavedNotice(null);
  }

  function move(direction: -1 | 1) {
    if (activeGlobalIndex < 0) return;
    const next = allSets[activeGlobalIndex + direction];
    if (!next) return;
    focus({ exerciseId: next.exercise.id, setId: next.set.id });
    setSavedNotice(null);
  }

  function advanceAfterSave(set: RuntimeSetLog) {
    setSavedNotice(`Подход ${set.order} сохранён`);
    if (set.completed) return;
    const next = findNextIncompleteTarget(exercises, set.id);
    focus(next);
  }

  function skipExercise() {
    if (!activeExercise) return;
    const result = runtime.commands.skipExercise({
      actor,
      workoutSessionId: sessionId,
      exerciseLogId: activeExercise.id,
      reason: "Пропущено клиентом во время сессии",
    });
    if (!result.ok) {
      onError(result.error.message);
      return;
    }
    onError(null);
    const nextExercise = exercises.slice(exercises.indexOf(activeExercise) + 1).find((exercise) => exercise.status !== "skipped")
      ?? exercises.find((exercise) => exercise.id !== activeExercise.id && exercise.status !== "skipped");
    if (nextExercise) selectExercise(nextExercise);
    setSavedNotice(`${activeExercise.title}: упражнение пропущено`);
  }

  if (!activeExercise || !activeSet) return null;

  return (
    <section className="space-y-4" aria-label="Выполнение упражнений">
      <div className="sticky top-[7.25rem] z-20 rounded-lg border border-zinc-700 bg-zinc-950/96 p-4 shadow-xl backdrop-blur-xl sm:top-[6.5rem]" aria-label="Ход тренировки">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Ход тренировки</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {completedSets} из {allSets.length} подходов сохранено
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>{handledExercises} из {exercises.length} упражнений закрыто</p>
            <p className="mt-1">{progressPercent}%</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
          <div className="h-full rounded-full bg-lime-300 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-2 min-h-5 text-xs text-lime-200" aria-live="polite">
          {savedNotice ?? (activeSet.completed ? "Этот подход сохранён. Результат можно обновить." : "Изменения сохраняются после нажатия кнопки.")}
        </p>
      </div>

      <div className="grid grid-flow-col auto-cols-[minmax(180px,1fr)] gap-2 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-3 sm:auto-cols-auto sm:overflow-visible sm:pb-0" role="tablist" aria-label="Упражнения тренировки">
        {exercises.map((exercise, index) => {
          const active = exercise.id === activeExercise.id;
          const saved = exercise.sets.filter((set) => set.completed).length;
          return (
            <button
              key={exercise.id}
              type="button"
              role="tab"
              id={`exercise-tab-${exercise.id}`}
              aria-controls={`exercise-panel-${exercise.id}`}
              aria-selected={active}
              onClick={() => selectExercise(exercise)}
              className={cn(
                "flex min-h-14 min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70",
                active ? "border-lime-300/30 bg-lime-300/[0.08]" : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
              )}
            >
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs", active ? "border-lime-300/30 text-lime-200" : "border-zinc-700 text-zinc-500")}>
                {exercise.status === "completed" ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-100">{exercise.title}</span>
                <span className={cn("mt-0.5 block text-xs", exercise.status === "skipped" ? "text-amber-200" : "text-zinc-500")}>
                  {exercise.status === "skipped" ? "Пропущено" : `${saved}/${exercise.sets.length} подходов`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div id={`exercise-panel-${activeExercise.id}`} role="tabpanel" aria-labelledby={`exercise-tab-${activeExercise.id}`} className="min-h-[360px] rounded-lg border border-zinc-800 bg-zinc-950/82 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="min-w-0">
            <p className="text-xs uppercase text-lime-200">Упражнение {exercises.indexOf(activeExercise) + 1} из {exercises.length}</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{activeExercise.title}</h2>
            {activeExercise.supersetLabel ? <p className="mt-2 text-sm text-lime-200/75">{activeExercise.supersetLabel} · позиция {activeExercise.supersetOrder}</p> : null}
            {activeExercise.supersetInstruction ? <p className="mt-1 text-sm text-zinc-500">{activeExercise.supersetInstruction}</p> : null}
          </div>
          <Button type="button" variant="outline" className="rounded-lg border-zinc-800" onClick={skipExercise} disabled={activeExercise.status === "skipped"}>
            <SkipForward className="mr-2 size-4" aria-hidden="true" />
            {activeExercise.status === "skipped" ? "Пропущено" : "Пропустить упражнение"}
          </Button>
        </div>

        {activeExercise.status === "skipped" ? (
          <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100">
            {activeExercise.skipReason}
          </div>
        ) : (
          <FocusedSetEditor
            key={activeSet.id}
            actor={actor}
            sessionId={sessionId}
            set={activeSet}
            onError={onError}
            onSaved={advanceAfterSave}
          />
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-4 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <Button type="button" variant="ghost" className="min-w-0 justify-center rounded-lg" onClick={() => move(-1)} disabled={activeGlobalIndex <= 0}>
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />Предыдущий
          </Button>
          <div className="order-first col-span-2 flex items-center justify-center gap-1 sm:order-none sm:col-auto sm:gap-1.5" aria-label={`Подход ${activeSet.order} из ${activeExercise.sets.length}`}>
            {activeExercise.sets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => focus({ exerciseId: activeExercise.id, setId: set.id })}
                className="flex size-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                aria-label={`Открыть подход ${set.order}${set.completed ? ", сохранён" : ""}`}
              >
                {set.completed ? <CheckCircle2 className="size-4 text-lime-200" aria-hidden="true" /> : <Circle className={cn("size-4", set.id === activeSet.id ? "fill-zinc-500 text-zinc-400" : "text-zinc-700")} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" className="min-w-0 justify-center rounded-lg" onClick={() => move(1)} disabled={activeGlobalIndex >= allSets.length - 1}>
            Следующий<ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{completedExercises} упражнений выполнено полностью.</p>
    </section>
  );
}

function FocusedSetEditor({
  actor,
  sessionId,
  set,
  onError,
  onSaved,
}: {
  actor: ClientDemoActor;
  sessionId: string;
  set: RuntimeSetLog;
  onError: (message: string | null) => void;
  onSaved: (set: RuntimeSetLog) => void;
}) {
  const runtime = useProductDemoRuntime();
  const plannedReps = typeof set.plan.repetitions === "number" ? set.plan.repetitions : set.plan.repetitions?.min ?? 0;
  const [repetitions, setRepetitions] = useState(String(set.actualRepetitions ?? plannedReps));
  const [weight, setWeight] = useState(String(set.actualWeightKg ?? set.plan.targetWeightKg ?? ""));

  function save() {
    const command = set.completed ? runtime.commands.updateSetLog : runtime.commands.saveSetLog;
    const result = command({
      actor,
      workoutSessionId: sessionId,
      setLogId: set.id,
      repetitions: Number(repetitions),
      weightKg: weight ? Number(weight) : undefined,
    });
    if (!result.ok) {
      onError(result.error.message);
      return;
    }
    onError(null);
    onSaved(set);
  }

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-zinc-500">Текущий подход</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">Подход {set.order}</p>
          {set.kind === "warmup" ? <p className="mt-1 text-sm text-zinc-500">Разминочный</p> : null}
        </div>
        {set.completed ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-lime-200"><CheckCircle2 className="size-4" aria-hidden="true" />Сохранено</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${set.id}-weight`}>Вес, кг</Label>
          <Input id={`${set.id}-weight`} inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} className="mt-2 h-14 rounded-lg border-zinc-700 bg-black text-lg" placeholder="Без веса" />
        </div>
        <div>
          <Label htmlFor={`${set.id}-reps`}>Повторы</Label>
          <Input id={`${set.id}-reps`} inputMode="numeric" value={repetitions} onChange={(event) => setRepetitions(event.target.value)} className="mt-2 h-14 rounded-lg border-zinc-700 bg-black text-lg" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
        <p>План: {plannedReps} повторений{set.plan.targetWeightKg ? ` · ${set.plan.targetWeightKg} кг` : ""}</p>
        <Button type="button" onClick={save} className={cn("min-h-12 rounded-lg px-5", set.completed ? "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" : "bg-lime-200 text-black hover:bg-lime-100")}>
          {set.completed ? "Обновить результат" : "Сохранить и продолжить"}
          {!set.completed ? <ArrowRight className="ml-2 size-4" aria-hidden="true" /> : null}
        </Button>
      </div>
    </div>
  );
}

function findInitialTarget(exercises: RuntimeExerciseLog[]): FocusTarget | null {
  for (const exercise of exercises) {
    if (exercise.status === "skipped") continue;
    const set = exercise.sets.find((item) => !item.completed);
    if (set) return { exerciseId: exercise.id, setId: set.id };
  }
  const fallbackExercise = exercises.find((exercise) => exercise.sets.length > 0);
  return fallbackExercise ? { exerciseId: fallbackExercise.id, setId: fallbackExercise.sets[0].id } : null;
}

function findNextIncompleteTarget(exercises: RuntimeExerciseLog[], currentSetId: string): FocusTarget | null {
  const candidates = exercises.flatMap((exercise) => exercise.status === "skipped"
    ? []
    : exercise.sets.map((set) => ({ exerciseId: exercise.id, setId: set.id, completed: set.completed })));
  const currentIndex = candidates.findIndex((item) => item.setId === currentSetId);
  const next = candidates.slice(currentIndex + 1).find((item) => !item.completed)
    ?? candidates.slice(0, Math.max(currentIndex, 0)).find((item) => !item.completed);
  return next ? { exerciseId: next.exerciseId, setId: next.setId } : null;
}
