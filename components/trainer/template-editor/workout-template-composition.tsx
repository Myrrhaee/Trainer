"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CircleAlert, Link2, Plus, RotateCcw, Trash2, Unlink } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkoutTemplateEditorIssue } from "@/lib/workout-template-editor-contract";
import { cn } from "@/lib/utils";
import type { EditorDraftContent, EditorExerciseDraft, EditorSetDraft } from "./workout-template-editor-state";
import {
  editorExerciseFieldId,
  editorSequence,
  editorSetFieldId,
  editorSupersetTargetId,
  issueLabel,
} from "./workout-template-editor-state";

type Props = {
  content: EditorDraftContent;
  editable: boolean;
  disabled?: boolean;
  expanded: Set<string>;
  selectedForSuperset: Set<string>;
  issues: WorkoutTemplateEditorIssue[];
  undoAvailable: boolean;
  onExpandedChange: (instanceKey: string) => void;
  onSelectForSuperset: (instanceKey: string, selected: boolean) => void;
  onCreateSuperset: () => void;
  onDissolveSuperset: (key: string) => void;
  onUpdateExercise: (instanceKey: string, update: (exercise: EditorExerciseDraft) => EditorExerciseDraft) => void;
  onMoveSequence: (instanceKey: string, direction: -1 | 1) => void;
  onMoveSupersetMember: (instanceKey: string, direction: -1 | 1) => void;
  onRemoveExercise: (instanceKey: string) => void;
  onTogglePerSet: (instanceKey: string, enabled: boolean) => void;
  onPrescriptionTypeChange: (instanceKey: string, type: EditorExerciseDraft["prescriptionType"]) => void;
  onMoveSet: (instanceKey: string, setKey: string, direction: -1 | 1) => void;
  onRemoveSet: (instanceKey: string, setKey: string) => void;
  onUndo: () => void;
  onOpenLibrary: () => void;
};

export function WorkoutTemplateComposition(props: Props) {
  const { content, editable, disabled = false } = props;
  return (
    <section id="template-composition" aria-labelledby="template-composition-heading" className="min-w-0 max-w-full pt-7">
      <fieldset disabled={disabled} className="m-0 w-full min-w-0 max-w-full border-0 p-0">
      <legend className="sr-only">Состав тренировки</legend>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="template-composition-heading" tabIndex={-1} className="text-lg font-semibold text-zinc-100 outline-none">Состав тренировки</h2><p className="mt-1 text-sm text-zinc-500">{content.exercises.length ? `${content.exercises.length} упражнений` : "Добавьте упражнения"}</p></div>
        {editable ? <div className="flex flex-wrap gap-2">{props.undoAvailable ? <Button type="button" variant="outline" onClick={props.onUndo} className="min-h-11 border-zinc-700"><RotateCcw />Вернуть</Button> : null}<Button type="button" onClick={props.onOpenLibrary} className="min-h-11 bg-lime-300 text-black hover:bg-lime-200"><Plus />Добавить упражнение</Button></div> : null}
      </div>

      {editable && props.selectedForSuperset.size >= 2 ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lime-300/20 bg-lime-300/[0.06] px-4 py-3"><p className="text-sm text-lime-100">Выбрано для суперсета: {props.selectedForSuperset.size}</p><Button type="button" onClick={props.onCreateSuperset} disabled={props.selectedForSuperset.size > 4} className="min-h-11 bg-lime-300 text-black"><Link2 />Создать суперсет</Button></div> : null}

      {content.exercises.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-zinc-800 px-6 py-12 text-center"><h3 className="font-semibold text-zinc-200">Добавьте упражнения</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">Начните с библиотеки упражнений. Состав можно сохранить как черновик и продолжить позже.</p>{editable ? <Button type="button" onClick={props.onOpenLibrary} className="mt-5 min-h-11 bg-lime-300 text-black"><Plus />Добавить упражнение</Button> : null}</div> : (
        <ol className="mt-5 grid min-w-0 max-w-full gap-3" aria-label="Упражнения шаблона">
          {content.exercises.map((exercise, index) => <ExerciseRow key={exercise.instanceKey} exercise={exercise} index={index} total={content.exercises.length} {...props} />)}
        </ol>
      )}
      </fieldset>
    </section>
  );
}

function ExerciseRow(props: Props & { exercise: EditorExerciseDraft; index: number; total: number }) {
  const { exercise, editable, expanded, issues, index } = props;
  const open = expanded.has(exercise.instanceKey);
  const rowIssues = issues.filter((issue) => issue.instanceKey === exercise.instanceKey || (exercise.supersetKey && issue.supersetKey === exercise.supersetKey));
  const groupMembers = exercise.supersetKey ? props.content.exercises.filter((item) => item.supersetKey === exercise.supersetKey).length : 0;
  const sequence = editorSequence(props.content.exercises);
  const sequenceIndex = sequence.findIndex((item) => item.instanceKeys.includes(exercise.instanceKey));
  const sequenceItem = sequence[sequenceIndex];
  const memberIndex = sequenceItem?.instanceKeys.indexOf(exercise.instanceKey) ?? -1;
  const firstGroupMember = sequenceItem?.kind === "superset" && memberIndex === 0;
  return <li id={`exercise-${exercise.instanceKey}`} className={cn("min-w-0 max-w-full scroll-mt-36 rounded-lg border bg-zinc-950/55", rowIssues.length ? "border-amber-300/25" : "border-zinc-800")}>
    <div className="flex min-h-16 items-center gap-2 px-3 py-2 sm:px-4">
      {editable ? <input type="checkbox" aria-label={`Выбрать ${exercise.title} для суперсета`} checked={props.selectedForSuperset.has(exercise.instanceKey)} onChange={(event) => props.onSelectForSuperset(exercise.instanceKey, event.target.checked)} disabled={Boolean(exercise.supersetKey)} className="size-4 accent-lime-300" /> : null}
      <button id={editorExerciseFieldId(exercise.instanceKey, "disclosure")} type="button" aria-expanded={open} onClick={() => props.onExpandedChange(exercise.instanceKey)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/50">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-zinc-400">{index + 1}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-zinc-100">{exercise.title}</span><span className="mt-1 block truncate text-xs text-zinc-500">{summary(exercise)}{exercise.supersetKey ? ` · Суперсет (${groupMembers})` : ""}</span></span>
        {rowIssues.length ? <span className="flex items-center gap-1 text-xs text-amber-200"><CircleAlert className="size-4" />{rowIssues.length}</span> : null}
        {open ? <ChevronDown className="size-4 text-zinc-500" /> : <ChevronRight className="size-4 text-zinc-500" />}
      </button>
      {editable ? <div className="flex flex-wrap justify-end gap-1">
        {!exercise.supersetKey || firstGroupMember ? <><IconButton label={exercise.supersetKey ? "Переместить суперсет выше" : "Выше"} disabled={sequenceIndex <= 0} onClick={() => props.onMoveSequence(exercise.instanceKey, -1)}><ArrowUp /></IconButton><IconButton label={exercise.supersetKey ? "Переместить суперсет ниже" : "Ниже"} disabled={sequenceIndex < 0 || sequenceIndex === sequence.length - 1} onClick={() => props.onMoveSequence(exercise.instanceKey, 1)}><ArrowDown /></IconButton></> : null}
        {exercise.supersetKey ? <><IconButton label="Переместить участника выше" disabled={memberIndex <= 0} onClick={() => props.onMoveSupersetMember(exercise.instanceKey, -1)}><ArrowUp /></IconButton><IconButton label="Переместить участника ниже" disabled={memberIndex < 0 || memberIndex === (sequenceItem?.instanceKeys.length ?? 0) - 1} onClick={() => props.onMoveSupersetMember(exercise.instanceKey, 1)}><ArrowDown /></IconButton></> : null}
        <IconButton label="Удалить упражнение" onClick={() => props.onRemoveExercise(exercise.instanceKey)}><Trash2 /></IconButton>
      </div> : null}
    </div>
    {open ? <div className="min-w-0 max-w-full border-t border-zinc-800 px-4 py-5">
      {rowIssues.length ? <ul className="mb-4 grid gap-1 text-xs text-amber-100">{rowIssues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issueLabel(issue)}</li>)}</ul> : null}
      {editable ? <ExerciseFields {...props} /> : <ReadOnlyExercise exercise={exercise} />}
    </div> : null}
  </li>;
}

function ExerciseFields(props: Props & { exercise: EditorExerciseDraft }) {
  const { exercise } = props;
  const firstGroupMember = exercise.supersetKey
    ? editorSequence(props.content.exercises).find((item) => item.key === `superset:${exercise.supersetKey}`)?.instanceKeys[0] === exercise.instanceKey
    : false;
  const update = (patch: Partial<EditorExerciseDraft>) => props.onUpdateExercise(exercise.instanceKey, (current) => ({ ...current, ...patch }));
  return <div className="grid min-w-0 max-w-full gap-5">
    {exercise.sourceAvailability !== "ready" && exercise.sourceAvailability !== "image_unavailable" ? <p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-sm text-amber-100">{sourceLabel(exercise.sourceAvailability)}. Сохранённый snapshot упражнения остаётся доступен.</p> : null}
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField label="Формат"><select value={exercise.prescriptionType} onChange={(event) => props.onPrescriptionTypeChange(exercise.instanceKey, event.target.value as EditorExerciseDraft["prescriptionType"])} className="h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm"><option value="repetitions">Повторения</option><option value="duration">Время</option></select></SelectField>
      {exercise.prescriptionType === "repetitions" ? <SelectField label="Повторения"><select value={exercise.repetitionMode} onChange={(event) => update({ repetitionMode: event.target.value as EditorExerciseDraft["repetitionMode"] })} className="h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm"><option value="fixed">Фиксированно</option><option value="range">Диапазон</option></select></SelectField> : null}
      <InputField label="Подходы"><Input id={editorExerciseFieldId(exercise.instanceKey, "setCount")} type="number" min={1} max={20} value={exercise.setCount} onChange={(event) => { const setCount = event.target.value; update({ setCount, ...(exercise.perSetMode ? { sets: resizeSets(exercise, Number(setCount || 0)) } : {}) }); }} className="h-11 border-zinc-800 bg-black" /></InputField>
    </div>
    <div className="grid gap-4 sm:grid-cols-4">
      {exercise.prescriptionType === "duration" ? <InputField label="Длительность, сек"><Input id={editorExerciseFieldId(exercise.instanceKey, "durationSec")} type="number" min={1} value={exercise.durationSec} onChange={(event) => update({ durationSec: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField> : <><InputField label={exercise.repetitionMode === "range" ? "Повторения от" : "Повторения"}><Input id={editorExerciseFieldId(exercise.instanceKey, "repetitionsMin")} type="number" min={1} value={exercise.repetitionsMin} onChange={(event) => update({ repetitionsMin: event.target.value, ...(exercise.repetitionMode === "fixed" ? { repetitionsMax: event.target.value } : {}) })} className="h-11 border-zinc-800 bg-black" /></InputField>{exercise.repetitionMode === "range" ? <InputField label="Повторения до"><Input id={editorExerciseFieldId(exercise.instanceKey, "repetitionsMax")} type="number" min={1} value={exercise.repetitionsMax} onChange={(event) => update({ repetitionsMax: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField> : null}</>}
      <InputField label="Целевой вес, кг"><Input id={editorExerciseFieldId(exercise.instanceKey, "targetWeightKg")} type="number" min={0} step="0.5" value={exercise.targetWeightKg} onChange={(event) => update({ targetWeightKg: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField>
      <InputField label="Отдых, сек"><Input id={editorExerciseFieldId(exercise.instanceKey, "restSec")} type="number" min={0} value={exercise.restSec} onChange={(event) => update({ restSec: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField>
    </div>
    <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={exercise.perSetMode} onChange={(event) => props.onTogglePerSet(exercise.instanceKey, event.target.checked)} className="size-4 accent-lime-300" />Настраивать каждый подход отдельно</label>
    {exercise.perSetMode ? <SetEditor {...props} /> : null}
    <InputField label="Заметка тренера"><Textarea value={exercise.trainerNote} maxLength={2000} onChange={(event) => update({ trainerNote: event.target.value })} placeholder="Необязательно" className="min-h-20 border-zinc-800 bg-black" /></InputField>
    {exercise.supersetKey && firstGroupMember ? <div className="rounded-lg border border-lime-300/15 bg-lime-300/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p id={editorSupersetTargetId(exercise.supersetKey)} tabIndex={-1} className="scroll-mt-36 text-sm font-medium text-lime-100 outline-none">Суперсет</p><Button type="button" variant="outline" onClick={() => props.onDissolveSuperset(exercise.supersetKey!)} className="min-h-11 border-zinc-700"><Unlink />Расформировать</Button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><InputField label="Название"><Input value={exercise.supersetLabel} onChange={(event) => updateGroup(props, exercise.supersetKey!, { supersetLabel: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField><InputField label="Инструкция"><Input value={exercise.supersetInstruction} onChange={(event) => updateGroup(props, exercise.supersetKey!, { supersetInstruction: event.target.value })} className="h-11 border-zinc-800 bg-black" /></InputField></div></div> : null}
  </div>;
}

function SetEditor(props: Props & { exercise: EditorExerciseDraft }) {
  return <div className="grid gap-2"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-medium text-zinc-200">Подходы</h4><Button type="button" variant="outline" disabled={props.exercise.sets.length >= 20} onClick={() => props.onUpdateExercise(props.exercise.instanceKey, (exercise) => ({ ...exercise, setCount: String(exercise.sets.length + 1), sets: resizeSets(exercise, exercise.sets.length + 1) }))} className="min-h-11 border-zinc-700"><Plus />Добавить подход</Button></div>{props.exercise.sets.map((set, index) => <div id={editorSetFieldId(props.exercise.instanceKey, set.setKey, "row")} data-set-key={set.setKey} tabIndex={-1} key={set.setKey} className="scroll-mt-36 grid gap-2 rounded-lg border border-zinc-800 p-3 outline-none sm:grid-cols-[90px_1fr_1fr_1fr_auto]">
    <select aria-label={`Тип подхода ${index + 1}`} value={set.kind} onChange={(event) => updateSet(props, set.setKey, { kind: event.target.value as EditorSetDraft["kind"] })} className="h-11 rounded-lg border border-zinc-800 bg-black px-2 text-xs"><option value="warmup">Размин.</option><option value="working">Рабочий</option></select>
    {props.exercise.prescriptionType === "duration" ? <Input id={editorSetFieldId(props.exercise.instanceKey, set.setKey, "durationSec")} aria-label={`Длительность подхода ${index + 1}`} type="number" value={set.durationSec} onChange={(event) => updateSet(props, set.setKey, { durationSec: event.target.value })} placeholder="Сек" className="h-11 border-zinc-800 bg-black" /> : <Input id={editorSetFieldId(props.exercise.instanceKey, set.setKey, "repetitionsMin")} aria-label={`Повторения подхода ${index + 1}`} type="number" value={set.repetitionsMin} onChange={(event) => updateSet(props, set.setKey, { repetitionsMin: event.target.value, repetitionsMax: event.target.value })} placeholder="Повт." className="h-11 border-zinc-800 bg-black" />}
    <Input id={editorSetFieldId(props.exercise.instanceKey, set.setKey, "targetWeightKg")} aria-label={`Вес подхода ${index + 1}`} type="number" value={set.targetWeightKg} onChange={(event) => updateSet(props, set.setKey, { targetWeightKg: event.target.value })} placeholder="Кг" className="h-11 border-zinc-800 bg-black" />
    <Input id={editorSetFieldId(props.exercise.instanceKey, set.setKey, "restSec")} aria-label={`Отдых подхода ${index + 1}`} type="number" value={set.restSec} onChange={(event) => updateSet(props, set.setKey, { restSec: event.target.value })} placeholder="Отдых" className="h-11 border-zinc-800 bg-black" />
    <div className="flex gap-1"><IconButton label={`Подход ${index + 1} выше`} disabled={index === 0} onClick={() => props.onMoveSet(props.exercise.instanceKey, set.setKey, -1)}><ArrowUp /></IconButton><IconButton label={`Подход ${index + 1} ниже`} disabled={index === props.exercise.sets.length - 1} onClick={() => props.onMoveSet(props.exercise.instanceKey, set.setKey, 1)}><ArrowDown /></IconButton><IconButton label={`Удалить подход ${index + 1}`} onClick={() => props.onRemoveSet(props.exercise.instanceKey, set.setKey)}><Trash2 /></IconButton></div>
  </div>)}</div>;
}

function ReadOnlyExercise({ exercise }: { exercise: EditorExerciseDraft }) {
  return <dl className="grid gap-4 text-sm sm:grid-cols-3"><Read label="Назначение" value={summary(exercise)} /><Read label="Источник" value={sourceLabel(exercise.sourceAvailability)} /><Read label="Заметка" value={exercise.trainerNote || "Нет заметки"} />{exercise.sets.length ? <div className="sm:col-span-3"><dt className="text-xs uppercase text-zinc-600">Подходы</dt><dd className="mt-2 grid gap-2">{exercise.sets.map((set) => <span key={set.setKey} className="rounded-md border border-zinc-800 px-3 py-2 text-zinc-300">{set.position}. {set.kind === "warmup" ? "Разминочный" : "Рабочий"} · {set.repetitionsMin || set.durationSec || "?"} · отдых {set.restSec || "?"} сек</span>)}</dd></div> : null}</dl>;
}

function updateSet(props: Props & { exercise: EditorExerciseDraft }, setKey: string, patch: Partial<EditorSetDraft>) { props.onUpdateExercise(props.exercise.instanceKey, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.setKey === setKey ? { ...set, ...patch } : set) })); }
function resizeSets(exercise: EditorExerciseDraft, rawCount: number) { const count = Math.max(0, Math.min(20, rawCount)); return Array.from({ length: count }, (_, index) => exercise.sets[index] ?? { templateSetId: null, setKey: crypto.randomUUID(), position: index + 1, kind: "working" as const, repetitionsMin: exercise.repetitionsMin, repetitionsMax: exercise.repetitionsMax, durationSec: exercise.durationSec, targetWeightKg: exercise.targetWeightKg, restSec: exercise.restSec, usesOverride: false }); }
function updateGroup(props: Props, key: string, patch: Partial<EditorExerciseDraft>) { props.content.exercises.filter((item) => item.supersetKey === key).forEach((item) => props.onUpdateExercise(item.instanceKey, (exercise) => ({ ...exercise, ...patch }))); }
function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button type="button" aria-label={label} title={label} className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/50 disabled:opacity-30" {...props}>{children}</button>; }
function InputField({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 max-w-full gap-2 text-xs text-zinc-500"><span>{label}</span>{children}</label>; }
function SelectField({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 max-w-full gap-2 text-xs text-zinc-500"><span>{label}</span>{children}</label>; }
function Read({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase text-zinc-600">{label}</dt><dd className="mt-1 text-zinc-300">{value}</dd></div>; }
function summary(exercise: EditorExerciseDraft) { const sets = exercise.setCount || "?"; const target = exercise.prescriptionType === "duration" ? `${exercise.durationSec || "?"} сек` : exercise.repetitionMode === "range" ? `${exercise.repetitionsMin || "?"}–${exercise.repetitionsMax || "?"} повт.` : `${exercise.repetitionsMin || "?"} повт.`; return `${sets} × ${target}`; }
function sourceLabel(value: EditorExerciseDraft["sourceAvailability"]) { return value === "ready" ? "Доступно в библиотеке" : value === "archived" ? "Источник в архиве" : value === "image_unavailable" ? "Без изображения" : value === "source_not_mapped" ? "Источник не связан" : "Источник недоступен"; }
