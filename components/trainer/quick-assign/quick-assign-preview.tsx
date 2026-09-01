"use client";

import { useState, type RefObject } from "react";
import { AlertTriangle, ChevronDown, Dumbbell, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  QuickAssignExercisePreview,
  QuickAssignSelectedTemplate,
  QuickAssignTemplatePreview,
} from "@/lib/server/quick-assign/quick-assign-types";

export function QuickAssignSelectedPreview({
  selected,
  loading,
  error,
  headingRef,
  onRetry,
}: {
  selected: QuickAssignSelectedTemplate;
  loading: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <section className="flex min-h-56 items-center justify-center" aria-busy="true" aria-label="Загрузка состава шаблона">
        <div className="text-center text-zinc-500"><Loader2 className="mx-auto size-5 animate-spin" /><p className="mt-3 text-sm">Загружаем точную версию…</p></div>
      </section>
    );
  }

  if (error) {
    return (
      <section ref={headingRef} tabIndex={-1} role="alert" className="border-l-2 border-rose-300/60 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
        <h2 className="text-base font-semibold text-zinc-100">Состав не загрузился</h2>
        <p className="mt-1 text-sm text-zinc-500">{error} Список, дата и заметка сохранены.</p>
        <Button type="button" variant="outline" onClick={onRetry} className="mt-4 min-h-11 border-zinc-700"><RotateCcw className="size-4" />Повторить</Button>
      </section>
    );
  }

  if (selected.status === "idle") {
    return (
      <section className="flex min-h-56 items-center justify-center px-6 text-center">
        <div><Dumbbell className="mx-auto size-6 text-zinc-600" /><h2 className="mt-3 text-base font-medium text-zinc-300">Выберите шаблон</h2><p className="mt-1 text-sm text-zinc-500">Состав конкретной опубликованной версии появится здесь.</p></div>
      </section>
    );
  }

  if (selected.status !== "ready") {
    const tombstone = "tombstone" in selected ? selected.tombstone : null;
    return (
      <section ref={headingRef} tabIndex={-1} role="alert" className="border-l-2 border-amber-300/60 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" /><div><h2 className="text-base font-semibold text-zinc-100">Версия больше недоступна</h2><p className="mt-1 text-sm text-zinc-500">{tombstone ? `«${tombstone.title}», версия ${tombstone.revisionNumber},` : "Выбранная версия"} изменилась после загрузки. Выберите актуальную версию самостоятельно.</p></div></div>
      </section>
    );
  }

  return <ReadyPreview template={selected.template} headingRef={headingRef} />;
}

function ReadyPreview({ template, headingRef }: { template: QuickAssignTemplatePreview; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <section aria-labelledby="quick-assign-preview-heading">
      <div className="border-b border-zinc-800 pb-3">
        <h2 ref={headingRef} tabIndex={-1} id="quick-assign-preview-heading" className="break-words text-xl font-semibold text-zinc-50 outline-none focus-visible:ring-2 focus-visible:ring-lime-200">{template.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {[
            `Версия ${template.revisionNumber}`,
            countLabel(template.exerciseCount, "упражнение", "упражнения", "упражнений"),
            countLabel(template.prescribedSetCount, "подход", "подхода", "подходов"),
            template.estimatedDurationMin ? `${template.estimatedDurationMin} мин` : null,
          ].filter(Boolean).join(" · ")}
        </p>
        {template.category ? <p className="mt-1 text-xs text-zinc-500">{template.category}</p> : null}
        {template.description ? <p className="mt-2 text-sm leading-relaxed text-zinc-400">{template.description}</p> : null}
      </div>
      {template.generalInstruction ? (
        <div className="border-b border-zinc-800 py-4"><p className="text-xs text-zinc-500">Общая инструкция</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{template.generalInstruction}</p></div>
      ) : null}
      <ol className="divide-y divide-zinc-800">
        {template.exercises.map((exercise, index) => <ExercisePreview key={exercise.templateExerciseId} exercise={exercise} index={index} />)}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-zinc-500">После назначения изменения шаблона не повлияют на эту тренировку.</p>
    </section>
  );
}

function countLabel(value: number, one: string, few: string, many: string) {
  const modulo100 = value % 100;
  const modulo10 = value % 10;
  const word = modulo100 >= 11 && modulo100 <= 14
    ? many
    : modulo10 === 1
      ? one
      : modulo10 >= 2 && modulo10 <= 4
        ? few
        : many;
  return `${value} ${word}`;
}

function ExercisePreview({ exercise, index }: { exercise: QuickAssignExercisePreview; index: number }) {
  const disclosureId = `quick-assign-exercise-${exercise.templateExerciseId}`;
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3.5">
      <div>
        <button type="button" aria-expanded={open} aria-controls={disclosureId} onClick={() => setOpen((current) => !current)} className="flex min-h-11 w-full cursor-pointer items-start justify-between gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-lime-200">
          <span className="min-w-0"><span className="block text-xs text-zinc-500">{index + 1}. {exercise.category}</span><span className="mt-0.5 block break-words text-sm font-medium text-zinc-100">{exercise.title}</span><span className="mt-1 block text-xs text-zinc-500">{summaryPrescription(exercise)}</span></span>
          <ChevronDown className={open ? "mt-2 size-4 shrink-0 rotate-180 text-zinc-500 transition" : "mt-2 size-4 shrink-0 text-zinc-500 transition"} aria-hidden="true" />
        </button>
        <div id={disclosureId} hidden={!open} className="mt-3 space-y-2 border-l border-zinc-800 pl-4">
          {exercise.superset ? <p className="text-xs text-sky-200/80">{exercise.superset.label}{exercise.superset.instruction ? ` · ${exercise.superset.instruction}` : ""}</p> : null}
          {exercise.setPrescriptions.length ? exercise.setPrescriptions.map((set) => (
            <div key={set.templateSetId} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 text-xs">
              <span className="text-zinc-500">Подход {set.position}</span><span className="text-zinc-400">{setPrescription(set)}</span>
            </div>
          )) : <p className="text-xs text-zinc-500">{summaryPrescription(exercise)}</p>}
          {exercise.trainerNote ? <p className="whitespace-pre-wrap pt-1 text-xs leading-relaxed text-zinc-500">{exercise.trainerNote}</p> : null}
        </div>
      </div>
    </li>
  );
}

function summaryPrescription(exercise: QuickAssignExercisePreview) {
  if (exercise.prescriptionType === "duration") return `${exercise.sets} × ${exercise.durationSeconds ?? 0} сек · отдых ${exercise.restSeconds} сек`;
  const repetitions = exercise.repetitionsMax && exercise.repetitionsMax !== exercise.repetitionsMin
    ? `${exercise.repetitionsMin ?? 0}–${exercise.repetitionsMax}`
    : String(exercise.repetitionsMin ?? 0);
  return `${exercise.sets} × ${repetitions}${exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} кг` : ""} · отдых ${exercise.restSeconds} сек`;
}

function setPrescription(set: QuickAssignExercisePreview["setPrescriptions"][number]) {
  if (set.durationSeconds) return `${set.durationSeconds} сек · отдых ${set.restSeconds} сек`;
  const repetitions = set.repetitionsMax && set.repetitionsMax !== set.repetitionsMin
    ? `${set.repetitionsMin ?? 0}–${set.repetitionsMax} повторов`
    : `${set.repetitionsMin ?? 0} повторов`;
  return `${repetitions}${set.targetWeightKg ? ` · ${set.targetWeightKg} кг` : ""} · отдых ${set.restSeconds} сек`;
}
