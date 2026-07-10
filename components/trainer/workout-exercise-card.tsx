"use client";

import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkoutBuilderExercise,
  WorkoutSetEntry,
} from "@/components/trainer/workout-builder-types";
import { cn } from "@/lib/utils";

const executionTypeOptions = [
  "Обычное",
  "Разминочное",
  "Техническое",
  "Контрольное",
  "Добивка",
];

const effortModeOptions = ["Обычный", "До отказа", "AMRAP"];

export function WorkoutExerciseCard({
  exercise,
  index,
  canMoveUp,
  canMoveDown,
  onToggleExpand,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onReplace,
  onInspectImage,
  onFieldChange,
  onTogglePerSetMode,
  onSetCountChange,
  onSetEntryChange,
}: {
  exercise: WorkoutBuilderExercise;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleExpand: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplace: () => void;
  onInspectImage: () => void;
  onFieldChange: (field: keyof WorkoutBuilderExercise, value: string) => void;
  onTogglePerSetMode: () => void;
  onSetCountChange: (value: string) => void;
  onSetEntryChange: (
    setEntryId: string,
    field: keyof WorkoutSetEntry,
    value: string
  ) => void;
}) {
  const history = getExerciseHistory(exercise.title);
  const executionType = exercise.executionType || "Обычное";
  const effortMode = exercise.effortMode || "Обычный";
  const effortModeHint = getEffortModeHint(effortMode);

  return (
    <article
      className="group rounded-[1.65rem] border border-zinc-800/90 bg-[linear-gradient(135deg,rgba(24,24,27,0.92),rgba(5,5,7,0.98))] p-3 shadow-xl shadow-black/10"
      data-reorder-ready="true"
      data-exercise-id={exercise.id}
    >
      <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onInspectImage}
          className="relative h-44 overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.99))] text-left"
        >
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/88 text-xs font-semibold text-zinc-100">
              {index + 1}
            </span>
            <span className="hidden rounded-full border border-zinc-700 bg-zinc-950/88 px-2.5 py-1 text-xs text-zinc-300 sm:inline-flex">
              Техника
            </span>
          </div>
          <div className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/88 text-zinc-400">
            <GripVertical className="h-4 w-4" />
          </div>
          {exercise.imageUrl ? (
            <Image
              src={exercise.imageUrl}
              alt={exercise.title}
              width={260}
              height={220}
              className="h-full w-full object-contain object-top p-3 transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-sm font-semibold text-zinc-500">
                IMG
              </div>
            </div>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-50">{exercise.title}</h3>
                {exercise.category ? (
                  <Badge className="rounded-full border border-lime-300/14 bg-lime-300/10 text-lime-100">
                    {exercise.category}
                  </Badge>
                ) : null}
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                  {executionType}
                </Badge>
                <Badge
                  className={cn(
                    "rounded-full border",
                    effortMode === "Обычный"
                      ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                      : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                  )}
                >
                  {effortMode}
                </Badge>
                {exercise.rpe ? (
                  <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                    RPE {exercise.rpe}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                {exercise.description?.trim() || "Настройте объём, интенсивность и подсказку для клиента."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                title="Переместить выше"
                aria-label="Переместить выше"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                title="Переместить ниже"
                aria-label="Переместить ниже"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
                onClick={onDuplicate}
                title="Дублировать"
                aria-label="Дублировать"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
                onClick={onReplace}
                title="Заменить упражнение"
                aria-label="Заменить упражнение"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-rose-100"
                onClick={onDelete}
                title="Удалить"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-zinc-700 bg-zinc-950/40 px-3 text-zinc-100 hover:bg-zinc-900"
                onClick={onToggleExpand}
              >
                {exercise.expanded ? "Свернуть" : "Настроить"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
            <CompactMetric label="Тип" value={executionType} />
            <CompactMetric label="Режим" value={effortMode} />
            <CompactMetric label="Подходы" value={exercise.sets || "—"} />
            <CompactMetric label="Повторы" value={exercise.reps || "—"} />
            <CompactMetric label="Вес" value={exercise.weight || "—"} />
            <CompactMetric label="Отдых" value={exercise.rest || "—"} />
            <CompactMetric label="RPE" value={exercise.rpe || "—"} />
          </div>

          {exercise.expanded ? (
            <div className="mt-4 space-y-4 border-t border-zinc-800/80 pt-4">
              <div className="rounded-[1.3rem] border border-zinc-800 bg-black/18 p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
                  <SelectField
                    label="Тип упражнения"
                    value={executionType}
                    onChange={(value) => onFieldChange("executionType", value)}
                    options={executionTypeOptions}
                  />
                  <SelectField
                    label="Режим выполнения"
                    value={effortMode}
                    onChange={(value) => onFieldChange("effortMode", value)}
                    options={effortModeOptions}
                  />
                  <Field
                    label="Темп"
                    value={exercise.tempo}
                    onChange={(value) => onFieldChange("tempo", value)}
                    placeholder="3-1-1"
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  {effortModeHint}
                </p>
              </div>

              <div className="rounded-[1.3rem] border border-zinc-800 bg-black/18 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Label className="text-zinc-300">Подходы</Label>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      Общая схема подходит для 4×10. Режим по подходам нужен для 12/10/8/8, разных весов, отдыха, RPE и финальных AMRAP/отказных сетов.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
                    <SetModeButton
                      active={!exercise.perSetMode}
                      label="Общие значения"
                      helper="Одна схема на все подходы"
                      onClick={() => {
                        if (exercise.perSetMode) onTogglePerSetMode();
                      }}
                    />
                    <SetModeButton
                      active={exercise.perSetMode}
                      label="По подходам"
                      helper="Каждый подход отдельно"
                      onClick={() => {
                        if (!exercise.perSetMode) onTogglePerSetMode();
                      }}
                    />
                  </div>
                </div>

                {!exercise.perSetMode ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Field
                      label="Подходы"
                      value={exercise.sets}
                      onChange={(value) => onSetCountChange(value)}
                      placeholder="4"
                    />
                    <Field
                      label="Повторы"
                      value={exercise.reps}
                      onChange={(value) => onFieldChange("reps", value)}
                      placeholder="10"
                    />
                    <Field
                      label="Вес"
                      value={exercise.weight}
                      onChange={(value) => onFieldChange("weight", value)}
                      placeholder="60 кг"
                    />
                    <Field
                      label="Отдых"
                      value={exercise.rest}
                      onChange={(value) => onFieldChange("rest", value)}
                      placeholder="90 сек"
                    />
                    <Field
                      label="RPE"
                      value={exercise.rpe}
                      onChange={(value) => onFieldChange("rpe", value)}
                      placeholder="8"
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="max-w-[180px]">
                      <Field
                        label="Количество подходов"
                        value={exercise.sets}
                        onChange={(value) => onSetCountChange(value)}
                        placeholder="4"
                      />
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                      {exercise.setEntries.map((setEntry, setIndex) => (
                        <div
                          key={setEntry.id}
                          className="rounded-[1rem] border border-zinc-800 bg-zinc-950/55 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-zinc-400">Подход {setIndex + 1}</p>
                            <span className="rounded-full border border-zinc-800 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                              set
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <SetEntryField
                              label="Повт."
                              value={setEntry.reps}
                              onChange={(value) => onSetEntryChange(setEntry.id, "reps", value)}
                              placeholder="10"
                            />
                            <SetEntryField
                              label="Вес"
                              value={setEntry.weight}
                              onChange={(value) => onSetEntryChange(setEntry.id, "weight", value)}
                              placeholder="60 кг"
                            />
                            <SetEntryField
                              label="Отдых"
                              value={setEntry.rest}
                              onChange={(value) => onSetEntryChange(setEntry.id, "rest", value)}
                              placeholder="90 сек"
                            />
                            <SetEntryField
                              label="RPE"
                              value={setEntry.rpe}
                              onChange={(value) => onSetEntryChange(setEntry.id, "rpe", value)}
                              placeholder="8"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Комментарий клиенту</Label>
                    <Textarea
                      value={exercise.comment}
                      onChange={(event) => onFieldChange("comment", event.target.value)}
                      placeholder="Например: последний подход близко к отказу, следить за техникой."
                      className="min-h-24 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Техника / замена</Label>
                    <Textarea
                      value={exercise.note}
                      onChange={(event) => onFieldChange("note", event.target.value)}
                      placeholder="Например: заменить на тренажёр при дискомфорте в плече."
                      className="min-h-24 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="rounded-[1.2rem] border border-lime-300/12 bg-lime-300/6 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-lime-100/70">Последний раз</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-50">{exercise.title}</p>
                  <div className="mt-3 space-y-2">
                    {history.map((item, itemIndex) => (
                      <div key={`${item}-${itemIndex}`} className="flex items-center justify-between rounded-full border border-zinc-800 bg-zinc-950/72 px-3 py-2 text-sm">
                        <span className="text-zinc-500">#{itemIndex + 1}</span>
                        <span className="font-medium text-zinc-200">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getExerciseHistory(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("жим")) return ["75 кг x 8", "75 кг x 8", "70 кг x 10"];
  if (lower.includes("тяга")) return ["65 кг x 10", "65 кг x 9", "60 кг x 10"];
  if (lower.includes("присед")) return ["55 кг x 8", "55 кг x 8", "50 кг x 10"];
  return ["рабочий вес x 10", "рабочий вес x 10", "легче x 12"];
}

function getEffortModeHint(mode: string) {
  if (mode === "До отказа") {
    return "До отказа: клиент выполняет указанные подходы до технического отказа. Лучше использовать точечно, например в последнем подходе или добивке.";
  }

  if (mode === "AMRAP") {
    return "AMRAP: клиент делает максимально возможное число качественных повторений в заданном подходе. Укажите минимальный ориентир в поле повторов.";
  }

  return "Обычный режим: клиент работает в заданном диапазоне повторов, веса, отдыха и RPE без обязательного отказа.";
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/22 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function SetModeButton({
  active,
  label,
  helper,
  onClick,
}: {
  active: boolean;
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-2 text-left transition",
        active
          ? "border-lime-300/24 bg-lime-300/10 text-lime-50"
          : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
      )}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-0.5 block text-xs text-zinc-500">{helper}</span>
    </button>
  );
}

function SetEntryField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-zinc-600">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition focus:border-lime-300/28"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-2xl border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
      />
    </div>
  );
}
