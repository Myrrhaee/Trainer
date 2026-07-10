"use client";

import { ChevronDown, ChevronUp, Layers3, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkoutBuilderBlock,
  WorkoutBuilderExercise,
  WorkoutSetEntry,
} from "@/components/trainer/workout-builder-types";
import { WorkoutExerciseCard } from "@/components/trainer/workout-exercise-card";
import { cn } from "@/lib/utils";

export function WorkoutSupersetBlockCard({
  block,
  blockIndex,
  activeAddTarget,
  onToggleExpand,
  onDelete,
  onStartAdding,
  onStopAdding,
  onFieldChange,
  onExerciseFieldChange,
  onExerciseToggleExpand,
  onExerciseTogglePerSetMode,
  onExerciseSetCountChange,
  onExerciseSetEntryChange,
  onExerciseDuplicate,
  onExerciseDelete,
  onExerciseMove,
  onExerciseReplace,
  onExerciseInspectImage,
}: {
  block: WorkoutBuilderBlock;
  blockIndex: number;
  activeAddTarget: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onStartAdding: () => void;
  onStopAdding: () => void;
  onFieldChange: (
    field: keyof Pick<WorkoutBuilderBlock, "title" | "note" | "rounds" | "restBetweenRounds">,
    value: string
  ) => void;
  onExerciseFieldChange: (
    exerciseId: string,
    field: keyof WorkoutBuilderExercise,
    value: string
  ) => void;
  onExerciseToggleExpand: (exerciseId: string) => void;
  onExerciseTogglePerSetMode: (exerciseId: string) => void;
  onExerciseSetCountChange: (exerciseId: string, value: string) => void;
  onExerciseSetEntryChange: (
    exerciseId: string,
    setEntryId: string,
    field: keyof WorkoutSetEntry,
    value: string
  ) => void;
  onExerciseDuplicate: (exerciseId: string) => void;
  onExerciseDelete: (exerciseId: string) => void;
  onExerciseMove: (exerciseId: string, direction: "up" | "down") => void;
  onExerciseReplace: () => void;
  onExerciseInspectImage: (exercise: WorkoutBuilderExercise) => void;
}) {
  const letter = String.fromCharCode(66 + blockIndex);
  const exerciseCount = block.exercises.length;

  return (
    <article
      className={cn(
        "rounded-[1.7rem] border bg-[radial-gradient(circle_at_0%_0%,rgba(190,242,100,0.08),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.8),rgba(5,5,7,0.96))] p-3 transition",
        activeAddTarget
          ? "border-lime-300/28 shadow-2xl shadow-lime-950/20"
          : "border-zinc-800/90"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-sm font-semibold text-lime-100">
            {letter}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-zinc-50">{block.title}</h4>
              <span className="rounded-full border border-lime-300/16 bg-lime-300/8 px-2.5 py-1 text-xs text-lime-100">
                Суперсет
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-xs text-zinc-500">
                {exerciseCount || "0"} упр. · {block.rounds || "3"} круга
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Упражнения выполняются подряд: A1 → A2 → отдых после круга. Подходит для антагонистов, добивки или экономии времени.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {activeAddTarget ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-lime-300/24 bg-lime-300/10 text-lime-50 hover:bg-lime-300/15"
              onClick={onStopAdding}
            >
              Завершить набор
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              onClick={onStartAdding}
            >
              <Plus className="mr-2 size-4" />
              Добавить A{exerciseCount + 1}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="size-10 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
            onClick={onToggleExpand}
            aria-label={block.expanded ? "Свернуть суперсет" : "Развернуть суперсет"}
            title={block.expanded ? "Свернуть суперсет" : "Развернуть суперсет"}
          >
            {block.expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="size-10 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-rose-100"
            onClick={onDelete}
            aria-label="Удалить суперсет"
            title="Удалить суперсет"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {activeAddTarget ? (
        <div className="mt-3 rounded-[1.2rem] border border-lime-300/14 bg-lime-300/7 px-4 py-3 text-sm text-lime-50/90">
          Сейчас библиотека добавляет упражнения в этот суперсет. Выберите A{exerciseCount + 1} справа.
        </div>
      ) : null}

      {block.expanded ? (
        <div className="mt-4 space-y-4 border-t border-zinc-800/80 pt-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_170px]">
            <div className="space-y-2">
              <Label className="text-zinc-300">Название блока</Label>
              <Input
                value={block.title}
                onChange={(event) => onFieldChange("title", event.target.value)}
                placeholder="Например: Грудь + спина"
                className="h-10 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Круги</Label>
              <Input
                value={block.rounds}
                onChange={(event) => onFieldChange("rounds", event.target.value)}
                placeholder="4"
                className="h-10 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Отдых после круга</Label>
              <Input
                value={block.restBetweenRounds}
                onChange={(event) => onFieldChange("restBetweenRounds", event.target.value)}
                placeholder="120 сек"
                className="h-10 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Подсказка к суперсету</Label>
            <Textarea
              value={block.note}
              onChange={(event) => onFieldChange("note", event.target.value)}
              placeholder="Например: выполнять без паузы между упражнениями, отдых только после A2."
              className="min-h-20 rounded-[1.2rem] border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {block.exercises.length === 0 ? (
            <div className="rounded-[1.3rem] border border-dashed border-zinc-800 bg-black/22 px-5 py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-lime-100">
                <Layers3 className="size-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-zinc-100">Суперсет пока пустой</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                Добавьте два или больше упражнения из библиотеки. Каждое упражнение сохранит свои подходы, вес, RPE и комментарии.
              </p>
              <Button
                type="button"
                className="mt-4 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                onClick={onStartAdding}
              >
                Добавить первое упражнение
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {block.exercises.map((exercise, exerciseIndex) => (
                <div key={exercise.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="rounded-full border border-lime-300/18 bg-lime-300/8 px-2.5 py-1 text-xs font-semibold text-lime-100">
                      A{exerciseIndex + 1}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {exerciseIndex === block.exercises.length - 1
                        ? "после этого упражнения отдых"
                        : "сразу перейти к следующему"}
                    </span>
                  </div>
                  <WorkoutExerciseCard
                    exercise={exercise}
                    index={exerciseIndex}
                    canMoveUp={exerciseIndex > 0}
                    canMoveDown={exerciseIndex < block.exercises.length - 1}
                    onToggleExpand={() => onExerciseToggleExpand(exercise.id)}
                    onDuplicate={() => onExerciseDuplicate(exercise.id)}
                    onDelete={() => onExerciseDelete(exercise.id)}
                    onMoveUp={() => onExerciseMove(exercise.id, "up")}
                    onMoveDown={() => onExerciseMove(exercise.id, "down")}
                    onReplace={onExerciseReplace}
                    onInspectImage={() => onExerciseInspectImage(exercise)}
                    onFieldChange={(field, value) => onExerciseFieldChange(exercise.id, field, value)}
                    onTogglePerSetMode={() => onExerciseTogglePerSetMode(exercise.id)}
                    onSetCountChange={(value) => onExerciseSetCountChange(exercise.id, value)}
                    onSetEntryChange={(setEntryId, field, value) =>
                      onExerciseSetEntryChange(exercise.id, setEntryId, field, value)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}
