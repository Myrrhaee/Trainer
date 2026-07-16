"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, ClipboardList, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  formatReviewRepetitions,
  formatReviewWeight,
  type ReviewExercise,
  type ReviewSignal,
  type WorkoutReviewDetails,
} from "./review-model";

export function ReviewSessionSummary({ review, compact = false }: { review: WorkoutReviewDetails; compact?: boolean }) {
  const { summary } = review;
  const facts = [
    ["Упражнения", `${summary.completedExercises} / ${summary.totalExercises || "нет данных"}`],
    ["Подходы", `${summary.completedSets} / ${summary.totalSets || "нет данных"}`],
    ["Длительность", review.session.durationMin ? `${review.session.durationMin} мин` : "не записана"],
    ["Статус", review.session.status === "partial" ? "частично" : "завершена"],
  ];

  return (
    <section aria-labelledby={`summary-${review.session.id}`} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Итог сессии</p>
          <h2 id={`summary-${review.session.id}`} className="mt-1 text-lg font-semibold text-zinc-50">{review.sessionTitle}</h2>
          <p className="mt-1 text-sm text-zinc-500">{review.session.completedLabel}</p>
        </div>
        <Badge className={cn("rounded-full border", review.session.status === "partial" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-lime-300/20 bg-lime-300/10 text-lime-100")}>
          {review.session.status === "partial" ? "Частичное выполнение" : "Завершена"}
        </Badge>
      </div>
      <dl className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-800/80 bg-black/25 p-3">
            <dt className="text-xs text-zinc-600">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>
      {!review.assignment ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100">
          <ClipboardList className="mt-0.5 size-4 shrink-0" />
          <span>Исходное назначение недоступно. Показаны только фактические данные, без ложного сравнения с планом.</span>
        </div>
      ) : null}
    </section>
  );
}

export function ReviewSignals({ signals, limit }: { signals: ReviewSignal[]; limit?: number }) {
  const visible = [...signals].sort((a, b) => Number(b.kind === "discomfort") - Number(a.kind === "discomfort")).slice(0, limit);

  return (
    <section aria-labelledby="review-signals-heading" className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <p className="text-xs font-medium uppercase text-zinc-500">Сначала исключения</p>
      <h2 id="review-signals-heading" className="mt-1 text-lg font-semibold text-zinc-50">Важные сигналы</h2>
      {visible.length ? (
        <div className="mt-4 grid gap-3">
          {visible.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-lime-300/15 bg-lime-300/[0.05] p-3 text-sm text-lime-100">
          <CheckCircle2 className="size-4" /> Существенных отклонений и сигналов не зафиксировано.
        </div>
      )}
    </section>
  );
}

function SignalCard({ signal }: { signal: ReviewSignal }) {
  const isDiscomfort = signal.kind === "discomfort";
  return (
    <article className={cn("rounded-lg border p-3", signal.tone === "danger" ? "border-rose-300/25 bg-rose-300/[0.07]" : signal.tone === "warning" ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-cyan-300/15 bg-cyan-300/[0.05]")}>
      <div className="flex items-start gap-3">
        {isDiscomfort ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-200" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" aria-hidden="true" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-50">{signal.title}</h3>
            {isDiscomfort ? <span className="rounded-full border border-rose-300/20 px-2 py-0.5 text-xs text-rose-100">Сигнал клиента</span> : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{signal.detail}</p>
          {signal.originalText ? <blockquote className="mt-2 border-l-2 border-rose-200/40 pl-3 text-sm italic text-zinc-300">«{signal.originalText}»</blockquote> : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>Источник: {signal.sourceLabel}</span>
            {signal.area ? <span>Область: {signal.area}</span> : null}
            {signal.severity ? <span>Выраженность: {severityLabel[signal.severity]}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ReviewClientComment({ comment }: { comment?: string }) {
  if (!comment) {
    return <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500">Комментарий клиента не оставлен.</p>;
  }
  return (
    <section aria-labelledby="client-comment-heading" className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 size-5 shrink-0 text-cyan-100" />
        <div>
          <h2 id="client-comment-heading" className="text-xs font-medium uppercase text-cyan-100/70">Исходный комментарий клиента</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">«{comment}»</p>
        </div>
      </div>
    </section>
  );
}

export function ReviewExerciseList({ exercises, compact = false }: { exercises: ReviewExercise[]; compact?: boolean }) {
  if (!exercises.length) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-zinc-50">Фактические подходы не записаны</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">Сессия завершена, но данных по упражнениям и подходам нет. Тренер всё равно может интерпретировать комментарий и отправить ответ.</p>
      </section>
    );
  }

  const ordered = [...exercises].sort((a, b) => exercisePriority(a) - exercisePriority(b));
  const visible = compact ? ordered.filter((exercise) => exercise.state !== "completed").slice(0, 3) : ordered;

  if (compact && !visible.length) {
    return <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500">Все упражнения выполнены без существенных отклонений.</p>;
  }

  return (
    <section aria-labelledby="review-exercises-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Plan vs actual</p>
          <h2 id="review-exercises-heading" className="mt-1 text-lg font-semibold text-zinc-50">{compact ? "Ключевые отклонения" : "Результаты по упражнениям"}</h2>
        </div>
        <span className="text-sm text-zinc-500">{visible.length} из {exercises.length}</span>
      </div>
      <div className="mt-3 grid gap-3">
        {visible.map((exercise) => <ExerciseResult key={exercise.id} exercise={exercise} compact={compact} />)}
      </div>
    </section>
  );
}

function ExerciseResult({ exercise, compact }: { exercise: ReviewExercise; compact: boolean }) {
  const planSets = exercise.planned?.sets ?? [];
  const actualSets = exercise.actual.sets;
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950/78 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-50">{exercise.title}</h3>
          {exercise.modificationNote ? <p className="mt-1 text-sm text-zinc-500">{exercise.modificationNote}</p> : null}
        </div>
        <Badge className={cn("rounded-full border", exerciseStateClass[exercise.state])}>{exerciseStateLabel[exercise.state]}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-zinc-800/80 bg-black/25 p-3">
          <dt className="text-xs text-zinc-600">План</dt>
          <dd className="mt-1 text-zinc-200">{exercise.planned ? `${planSets.length} подх. · ${setSummary(planSets[planSets.length - 1])}` : "план недоступен"}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-black/25 p-3">
          <dt className="text-xs text-zinc-600">Факт</dt>
          <dd className="mt-1 text-zinc-200">{actualSets.length ? `${actualSets.filter((set) => set.completed).length} подх. · ${actualSetSummary(actualSets[actualSets.length - 1])}` : "нет записанных подходов"}</dd>
        </div>
      </dl>
      {exercise.actual.comment ? <p className="mt-3 text-sm text-zinc-400">Комментарий: «{exercise.actual.comment}»</p> : null}
      {!compact ? (
        <details className="mt-3 group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60">
            Подробные подходы <span className="text-zinc-600 group-open:hidden">Показать</span><span className="hidden text-zinc-600 group-open:inline">Скрыть</span>
          </summary>
          <div role="table" aria-label={`Подходы: ${exercise.title}`} className="mt-2 overflow-hidden rounded-lg border border-zinc-800">
            <div role="row" className="grid grid-cols-[44px_1fr_1fr] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-500">
              <span role="columnheader">№</span><span role="columnheader">План</span><span role="columnheader">Факт</span>
            </div>
            {Array.from({ length: Math.max(planSets.length, actualSets.length) }).map((_, index) => {
              const planned = planSets[index];
              const actual = actualSets[index];
              return (
                <div role="row" key={`${exercise.id}-set-${index}`} className="grid grid-cols-[44px_1fr_1fr] border-t border-zinc-800 px-3 py-2 text-sm text-zinc-300">
                  <span role="cell">{index + 1}</span>
                  <span role="cell">{planned ? setSummary(planned) : "не назначен"}</span>
                  <span role="cell">{actual ? actualSetSummary(actual) : "не записан"}</span>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function setSummary(set?: { repetitions?: number | { min: number; max: number }; targetWeightKg?: number }) {
  if (!set) return "не указано";
  return `${formatReviewWeight(set.targetWeightKg)} × ${formatReviewRepetitions(set.repetitions)}`;
}

function actualSetSummary(set?: { repetitions?: number; weightKg?: number; completed: boolean; rpe?: number }) {
  if (!set) return "не записано";
  const value = `${set.weightKg === undefined ? "вес не записан" : `${set.weightKg} кг`} × ${set.repetitions ?? "повторы не записаны"}`;
  return `${value}${set.rpe ? ` · RPE ${set.rpe}` : ""}${set.completed ? "" : " · не завершён"}`;
}

function exercisePriority(exercise: ReviewExercise) {
  return exercise.state === "skipped" ? 0 : exercise.state === "incomplete" ? 1 : exercise.state === "modified" ? 2 : 3;
}

const severityLabel = { low: "низкая", medium: "средняя", high: "высокая" } as const;
const exerciseStateLabel = { completed: "По плану", incomplete: "Не полностью", skipped: "Пропущено", modified: "Изменено", added: "Добавлено" } as const;
const exerciseStateClass = {
  completed: "border-lime-300/20 bg-lime-300/10 text-lime-100",
  incomplete: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  skipped: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  modified: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  added: "border-violet-300/20 bg-violet-300/10 text-violet-100",
} as const;
