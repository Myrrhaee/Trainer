"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Flame, Plus, RotateCcw, TimerReset, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  createBuilderId,
  createSetRows,
  type RepetitionMode,
  type SetKind,
  type WorkoutSetOverrideDraft,
  type WorkoutTemplateExerciseDraft,
} from "./builder-model";

export function ExerciseInspector({
  exercise,
  locked,
  onChange,
}: {
  exercise: WorkoutTemplateExerciseDraft | null;
  locked: boolean;
  onChange: (exercise: WorkoutTemplateExerciseDraft) => void;
}) {
  if (!exercise) {
    return (
      <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/45 p-6 text-center">
        <div>
          <TimerReset className="mx-auto size-6 text-zinc-600" />
          <h2 className="mt-3 font-semibold text-zinc-200">Выберите упражнение</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">Инспектор покажет prescription, подходы и заметку выбранного упражнения.</p>
        </div>
      </section>
    );
  }

  const activeExercise = exercise;
  const prescription = exercise.prescription;

  function updatePrescription(patch: Partial<typeof prescription>) {
    const nextPrescription = { ...prescription, ...patch };
    const requestedSets = Math.max(1, Number.parseInt(nextPrescription.sets, 10) || 1);
    onChange({
      ...activeExercise,
      prescription: nextPrescription,
      setOverrides: createSetRows(requestedSets, nextPrescription, activeExercise.instanceId, activeExercise.setOverrides),
    });
  }

  function updateSet(setId: string, patch: Partial<WorkoutSetOverrideDraft>) {
    onChange({
      ...activeExercise,
      setOverrides: activeExercise.setOverrides.map((set) => set.id === setId ? { ...set, ...patch, usesOverride: true } : set),
    });
  }

  function resetSet(setId: string) {
    onChange({
      ...activeExercise,
      setOverrides: activeExercise.setOverrides.map((set) => set.id === setId ? defaultSet(set, activeExercise) : set),
    });
  }

  function applyDefaults() {
    onChange({
      ...activeExercise,
      setOverrides: activeExercise.setOverrides.map((set) => defaultSet(set, activeExercise)),
    });
  }

  function addSet(kind: SetKind) {
    const index = activeExercise.setOverrides.length;
    const next: WorkoutSetOverrideDraft = {
      ...defaultSet({ id: createBuilderId("set"), order: index + 1, kind, repetitionsMin: "", repetitionsMax: "", durationSec: "", targetWeightKg: "", restSec: "", usesOverride: false }, activeExercise),
      kind,
    };
    onChange({ ...activeExercise, prescription: { ...prescription, sets: String(index + 1) }, setOverrides: [...activeExercise.setOverrides, next] });
  }

  function removeSet(setId: string) {
    if (activeExercise.setOverrides.length <= 1) return;
    const next = activeExercise.setOverrides.filter((set) => set.id !== setId).map((set, index) => ({ ...set, order: index + 1 }));
    onChange({ ...activeExercise, prescription: { ...prescription, sets: String(next.length) }, setOverrides: next });
  }

  function moveSet(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= activeExercise.setOverrides.length) return;
    const next = [...activeExercise.setOverrides];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...activeExercise, setOverrides: next.map((set, position) => ({ ...set, order: position + 1 })) });
  }

  return (
    <section aria-labelledby="builder-inspector-heading" className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="border-b border-zinc-800 pb-4">
        <p className="text-xs font-medium uppercase text-lime-200/70">Exercise Inspector</p>
        <h2 id="builder-inspector-heading" tabIndex={-1} className="mt-1 text-xl font-semibold text-zinc-50 focus:outline-none">{exercise.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{exercise.category}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p>
      </div>

      <fieldset disabled={locked} className="mt-4 grid min-w-0 gap-5 disabled:opacity-70">
        <div>
          <Label className="text-sm text-zinc-300">Основной тип задания</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ModeButton active={prescription.type === "repetitions"} label="Повторения" onClick={() => updatePrescription({ type: "repetitions" })} />
            <ModeButton active={prescription.type === "duration"} label="Длительность" onClick={() => updatePrescription({ type: "duration" })} />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <NumberInput label="Подходы" value={prescription.sets} min="1" onChange={(value) => updatePrescription({ sets: value })} />
          {prescription.type === "duration" ? (
            <NumberInput label="Длительность, сек" value={prescription.durationSec} min="1" onChange={(value) => updatePrescription({ durationSec: value })} />
          ) : (
            <div className="min-w-0">
              <Label className="text-sm text-zinc-300">Повторения</Label>
              <div className="mt-2 flex min-w-0 gap-2">
                <select value={prescription.repetitionMode} onChange={(event) => updatePrescription({ repetitionMode: event.target.value as RepetitionMode })} className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black/30 px-2 text-sm text-zinc-100">
                  <option value="fixed">Точно</option>
                  <option value="range">Диапазон</option>
                </select>
                <Input aria-label="Минимум повторений" type="number" min="1" value={prescription.repetitionsMin} onChange={(event) => updatePrescription({ repetitionsMin: event.target.value, ...(prescription.repetitionMode === "fixed" ? { repetitionsMax: event.target.value } : {}) })} className="h-11 w-20 border-zinc-800 bg-black/30 text-zinc-100" />
                {prescription.repetitionMode === "range" ? <Input aria-label="Максимум повторений" type="number" min="1" value={prescription.repetitionsMax} onChange={(event) => updatePrescription({ repetitionsMax: event.target.value })} className="h-11 w-20 border-zinc-800 bg-black/30 text-zinc-100" /> : null}
              </div>
            </div>
          )}
          <NumberInput label="Целевой вес, кг" value={prescription.targetWeightKg} min="0" step="0.5" placeholder="Необязательно" onChange={(value) => updatePrescription({ targetWeightKg: value })} />
          <NumberInput label="Отдых, сек" value={prescription.restSec} min="0" onChange={(value) => updatePrescription({ restSec: value })} />
        </div>

        <div>
          <Label htmlFor={`trainer-note-${exercise.instanceId}`} className="text-sm text-zinc-300">Заметка спортсмену</Label>
          <Textarea id={`trainer-note-${exercise.instanceId}`} value={exercise.trainerNote} onChange={(event) => onChange({ ...exercise, trainerNote: event.target.value })} placeholder="Техника, back-off, пауза или замена" className="mt-2 min-h-20 border-zinc-800 bg-black/30 text-zinc-100" />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span><span className="block text-sm font-medium text-zinc-200">Настроить подходы отдельно</span><span className="mt-1 block text-xs text-zinc-600">Default prescription остаётся основой.</span></span>
            <input type="checkbox" checked={exercise.perSetMode} onChange={(event) => onChange({ ...exercise, perSetMode: event.target.checked })} className="size-4 accent-lime-300" />
          </label>
        </div>

        {exercise.perSetMode ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">Подходы</h3>
                <p className="mt-1 text-xs text-zinc-600">Warm-up и working различаются подписью.</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={applyDefaults} className="min-h-9 rounded-full text-zinc-400"><RotateCcw className="size-3.5" />Применить defaults</Button>
            </div>
            {exercise.setOverrides.map((set, index) => (
              <div key={set.id} className={cn("rounded-lg border p-3", set.kind === "warmup" ? "border-sky-300/25 bg-sky-300/[0.05]" : "border-zinc-800 bg-zinc-950")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {set.kind === "warmup" ? <Flame className="size-4 text-sky-200" /> : <DumbbellDot />}
                    <select aria-label={`Тип подхода ${index + 1}`} value={set.kind} onChange={(event) => updateSet(set.id, { kind: event.target.value as SetKind })} className="h-9 rounded-lg border border-zinc-700 bg-black/30 px-2 text-xs text-zinc-200"><option value="warmup">Разминка</option><option value="working">Рабочий</option></select>
                    <span className="text-xs text-zinc-500">#{index + 1}{set.usesOverride ? " · override" : ""}</span>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label={`Поднять подход ${index + 1}`} disabled={index === 0} onClick={() => moveSet(index, -1)}><ArrowUp /></IconButton>
                    <IconButton label={`Опустить подход ${index + 1}`} disabled={index === exercise.setOverrides.length - 1} onClick={() => moveSet(index, 1)}><ArrowDown /></IconButton>
                    <IconButton label={`Сбросить подход ${index + 1}`} onClick={() => resetSet(set.id)}><RotateCcw /></IconButton>
                    <IconButton label={`Удалить подход ${index + 1}`} disabled={exercise.setOverrides.length <= 1} onClick={() => removeSet(set.id)}><Trash2 /></IconButton>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {prescription.type === "duration" ? <SetInput label="Секунды" value={set.durationSec} onChange={(value) => updateSet(set.id, { durationSec: value })} /> : <><SetInput label="Повторы от" value={set.repetitionsMin} onChange={(value) => updateSet(set.id, { repetitionsMin: value })} /><SetInput label="Повторы до" value={set.repetitionsMax} onChange={(value) => updateSet(set.id, { repetitionsMax: value })} /></>}
                  <SetInput label="Вес, кг" value={set.targetWeightKg} onChange={(value) => updateSet(set.id, { targetWeightKg: value })} />
                  <SetInput label="Отдых, сек" value={set.restSec} onChange={(value) => updateSet(set.id, { restSec: value })} />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => addSet("warmup")} className="min-h-11 rounded-full border-zinc-700 text-zinc-200"><Plus className="size-4" />Разминка</Button>
              <Button type="button" variant="outline" onClick={() => addSet("working")} className="min-h-11 rounded-full border-zinc-700 text-zinc-200"><Plus className="size-4" />Рабочий</Button>
            </div>
          </div>
        ) : null}
      </fieldset>
    </section>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60", active ? "border-lime-300/35 bg-lime-300/10 text-lime-100" : "border-zinc-800 bg-black/20 text-zinc-400")}>{label}</button>;
}

function NumberInput({ label, value, min, step, placeholder, onChange }: { label: string; value: string; min: string; step?: string; placeholder?: string; onChange: (value: string) => void }) {
  return <div className="min-w-0"><Label className="text-sm text-zinc-300">{label}</Label><Input type="number" min={min} step={step} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 min-w-0 border-zinc-800 bg-black/30 text-zinc-100" /></div>;
}

function SetInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="min-w-0"><span className="text-xs text-zinc-600">{label}</span><Input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 min-w-0 border-zinc-800 bg-black/30 text-zinc-100" /></label>;
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 [&_svg]:size-3.5">{children}</button>;
}

function DumbbellDot() {
  return <span aria-hidden="true" className="size-2.5 rounded-full bg-lime-300" />;
}

function defaultSet(set: WorkoutSetOverrideDraft, exercise: WorkoutTemplateExerciseDraft): WorkoutSetOverrideDraft {
  return { ...set, repetitionsMin: exercise.prescription.repetitionsMin, repetitionsMax: exercise.prescription.repetitionsMax, durationSec: exercise.prescription.durationSec, targetWeightKg: exercise.prescription.targetWeightKg, restSec: exercise.prescription.restSec, usesOverride: false };
}
