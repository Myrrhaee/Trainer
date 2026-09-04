"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  Info,
} from "lucide-react";

import type {
  ReviewAvailability,
  ReviewExerciseReadModel,
  ReviewReadModel,
  ReviewSetReadModel,
} from "@/lib/server/reviews/review-types";
import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";
import { cn } from "@/lib/utils";
import {
  actualSetValues,
  attentionReasonLabel,
  availabilityText,
  collectReviewExceptions,
  hasExerciseExceptions,
  originLabel,
  plannedSetValues,
  reviewExerciseAnchorId,
  reviewSetAnchorId,
  shortId,
  summarizeReview,
  type CanonicalReviewException,
} from "./canonical-review-presentation";

export function CanonicalReviewContextHeader({
  review,
  transition,
}: {
  review: ReviewReadModel;
  transition: TrainerWorkflowTransition;
}) {
  const origin = originLabel(transition.context.origin);
  const backLabel = transition.context.origin === "profile" && review.capabilities.canOpenAthleteProfile !== false ? "К профилю" : "К очереди";
  return (
    <section aria-label="Контекст разбора" className="border-b border-zinc-800 pb-5">
      <Link
        href={transition.returnHref}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
      >
        <ArrowLeft className="size-4" />{backLabel}
      </Link>
      <div className="mt-2 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-lime-200/70">Разбор тренировки</p>
          <p className="mt-2 text-xl font-semibold text-zinc-50 sm:text-2xl">{review.athlete.displayName}</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-zinc-400">
            {review.session.title} · {formatCompletion(review.session.completedAt, review.session.clientTimezone)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3",
            review.attention.status === "open"
              ? "border-amber-300/30 bg-amber-300/8 text-amber-100"
              : "border-lime-300/25 bg-lime-300/8 text-lime-100",
          )}>
            {review.attention.status === "open" ? <CircleDashed className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {review.attention.status === "open" ? "Ждёт разбора" : "Разбор закрыт"}
          </span>
          <span className="rounded-full border border-zinc-800 px-3 py-2 text-zinc-400">{origin}</span>
          <span className="rounded-full border border-zinc-800 px-3 py-2 font-mono text-zinc-500" title={review.session.id}>
            Session {shortId(review.session.id)}
          </span>
        </div>
      </div>
      <div className="mt-4 border-l-2 border-zinc-700 pl-3">
        <p className="text-xs text-zinc-500">Причина</p>
        <p className="mt-1 text-sm text-zinc-200">{attentionReasonLabel(review.attention.priorityReasons)}</p>
      </div>
    </section>
  );
}

export function CanonicalReviewEvidence({ review }: { review: ReviewReadModel }) {
  const exceptions = useMemo(() => collectReviewExceptions(review), [review]);
  const initiallyOpen = useMemo(() => new Set(review.exercises
    .filter(hasExerciseExceptions)
    .map((exercise) => exercise.identity.assignmentExerciseId)), [review]);
  const [openExercises, setOpenExercises] = useState(initiallyOpen);

  function jumpToSource(item: CanonicalReviewException) {
    setOpenExercises((current) => new Set(current).add(item.exerciseId));
    window.setTimeout(() => {
      const target = document.getElementById(item.sourceAnchorId);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }, 0);
  }

  return (
    <div data-review-evidence-column className="grid min-w-0 gap-5">
      <CanonicalReviewAvailability review={review} />
      <CanonicalReviewSummary review={review} />
      <CanonicalReviewDiscomfort review={review} />
      <CanonicalReviewExceptions review={review} exceptions={exceptions} onJump={jumpToSource} />
      <CanonicalReviewSessionContext review={review} />
      <CanonicalReviewExerciseResults
        review={review}
        openExercises={openExercises}
        onToggle={(exerciseId) => setOpenExercises((current) => {
          const next = new Set(current);
          if (next.has(exerciseId)) next.delete(exerciseId); else next.add(exerciseId);
          return next;
        })}
      />
    </div>
  );
}

export function CanonicalReviewAvailability({ review }: { review: ReviewReadModel }) {
  const items = [
    { label: "Источник сессии", value: review.dataAvailability.sourceSession },
    { label: "Назначение", value: review.dataAvailability.assignmentSnapshot },
    { label: "Результаты", value: review.dataAvailability.logs },
  ];
  const degraded = items.some((item) => item.value.status === "partial" || item.value.status === "unavailable")
    || review.sessionContext.discomfort.status === "unsupported";
  return (
    <section aria-labelledby="review-availability-heading" className="rounded-[8px] border border-zinc-800 bg-zinc-950/55 p-4">
      <div className="flex items-center gap-2">
        {degraded ? <Info className="size-4 text-amber-200" /> : <ClipboardCheck className="size-4 text-lime-200" />}
        <h2 id="review-availability-heading" className="text-sm font-semibold text-zinc-100">Доступность данных</h2>
      </div>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className="border-l border-zinc-700 pl-3 text-zinc-400">
            {availabilityText(item.value, item.label)}
          </li>
        ))}
      </ul>
      {review.sessionContext.discomfort.status === "unsupported" ? (
        <p className="mt-3 text-sm text-amber-100/85">Данные о самочувствии для этой тренировки не собирались.</p>
      ) : null}
    </section>
  );
}

export function CanonicalReviewSummary({ review }: { review: ReviewReadModel }) {
  const summary = summarizeReview(review);
  const planAvailable = review.dataAvailability.assignmentSnapshot.status !== "unavailable";
  const actualAvailable = review.dataAvailability.logs.status !== "unavailable";
  return (
    <section aria-labelledby="review-summary-heading" className="border-b border-zinc-800 pb-5">
      <h2 id="review-summary-heading" className="text-lg font-semibold text-zinc-50">Итог выполнения</h2>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <SummaryFact label="Упражнений" value={summary.exerciseCount} />
        {planAvailable ? <SummaryFact label="Подходов по плану" value={summary.prescribedSetCount} /> : null}
        {actualAvailable ? <SummaryFact label="Выполнено" value={summary.completedSetCount} /> : null}
        {actualAvailable ? <SummaryFact label="Частично" value={summary.incompleteSetCount} /> : null}
        {actualAvailable ? <SummaryFact label="Пропущено" value={summary.skippedSetCount} /> : null}
        {actualAvailable ? <SummaryFact label="Без результата" value={summary.missingSetCount} /> : null}
        {actualAvailable ? <SummaryFact label="Фактических отличий" value={summary.deviationCount} /> : null}
        {actualAvailable ? <SummaryFact label="Комментариев" value={summary.commentCount} /> : null}
        <SummaryFact label="Длительность" value={`${review.session.durationMin} мин`} />
      </dl>
      {review.dataAvailability.logs.status === "partial" || review.dataAvailability.logs.status === "unavailable" ? (
        <p className="mt-3 text-sm text-amber-200">Итог составлен по доступной части результатов.</p>
      ) : null}
    </section>
  );
}

function SummaryFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

export function CanonicalReviewExceptions({
  review,
  exceptions,
  onJump,
}: {
  review: ReviewReadModel;
  exceptions: CanonicalReviewException[];
  onJump: (item: CanonicalReviewException) => void;
}) {
  return (
    <section id="review-exceptions" aria-labelledby="review-exceptions-heading" className="scroll-mt-28">
      <div className="flex items-center justify-between gap-3">
        <h2 id="review-exceptions-heading" className="text-lg font-semibold text-zinc-50">Сначала исключения</h2>
        <span className="text-sm text-zinc-500">{exceptions.length}</span>
      </div>
      {!exceptions.length ? (
        <p className="mt-3 rounded-[8px] border border-zinc-800 p-4 text-sm text-zinc-400">
          {review.dataAvailability.canAssertNoDeviations
            ? "По полным данным различий с назначением не зафиксировано."
            : "Доступных исключений для показа нет. Вывод обо всей сессии недоступен из-за ограничений источника."}
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
          {exceptions.map((item) => (
            <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <AlertTriangle className="size-4 shrink-0 text-amber-200" />{item.title}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {item.exerciseTitle}{item.setPosition ? ` · подход ${item.setPosition}` : ""}
                </p>
                <LongCopy text={item.detail} className="mt-1 text-zinc-300" />
                {item.comment && item.comment !== item.detail ? (
                  <blockquote className="mt-2 border-l border-zinc-700 pl-3">
                    <LongCopy text={item.comment} className="text-zinc-400" />
                  </blockquote>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onJump(item)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-zinc-800 px-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                aria-label={`К результату: ${item.exerciseTitle}${item.setPosition ? `, подход ${item.setPosition}` : ""}`}
              >
                К результату<ArrowDown className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CanonicalReviewExerciseResults({
  review,
  openExercises,
  onToggle,
}: {
  review: ReviewReadModel;
  openExercises: Set<string>;
  onToggle: (exerciseId: string) => void;
}) {
  const planAvailable = review.dataAvailability.assignmentSnapshot.status !== "unavailable";
  const actualAvailable = review.dataAvailability.logs.status !== "unavailable";
  return (
    <section id="review-results" aria-labelledby="review-results-heading" className="scroll-mt-28">
      <h2 id="review-results-heading" className="text-lg font-semibold text-zinc-50">Результаты по упражнениям</h2>
      {review.dataAvailability.logs.status === "known_empty" ? (
        <p className="mt-3 rounded-[8px] border border-zinc-800 p-4 text-sm text-zinc-400">Результаты по подходам не записаны.</p>
      ) : null}
      <div className="mt-3 grid gap-3">
        {review.exercises.map((exercise) => (
          <CanonicalReviewExercise
            key={exercise.identity.assignmentExerciseId}
            exercise={exercise}
            planAvailable={planAvailable}
            actualAvailable={actualAvailable}
            open={openExercises.has(exercise.identity.assignmentExerciseId)}
            onToggle={() => onToggle(exercise.identity.assignmentExerciseId)}
          />
        ))}
      </div>
    </section>
  );
}

function CanonicalReviewExercise({ exercise, open, planAvailable, actualAvailable, onToggle }: {
  exercise: ReviewExerciseReadModel;
  open: boolean;
  planAvailable: boolean;
  actualAvailable: boolean;
  onToggle: () => void;
}) {
  const contentId = `${reviewExerciseAnchorId(exercise)}-content`;
  const affectedSets = exercise.sets.filter((set) => set.deviations.length > 0).length;
  const status = actualAvailable ? exerciseStatus(exercise) : "Результаты недоступны";
  return (
    <article id={reviewExerciseAnchorId(exercise)} tabIndex={-1} className="scroll-mt-28 rounded-[8px] border border-zinc-800 bg-zinc-950/45 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200/70"
      >
        <span className="min-w-0">
          <span className="block text-xs text-zinc-500">Упражнение {exercise.identity.position}</span>
          <span className="mt-1 block break-words font-medium text-zinc-100">{exercise.identity.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
          <span>{status}{affectedSets ? ` · ${affectedSets} подх.` : ""}</span>
          <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <div id={contentId} className="border-t border-zinc-800 px-4 py-4">
          {planAvailable && exercise.prescribed.trainerNote ? (
            <div className="mb-4 text-sm">
              <p className="text-xs text-zinc-500">Инструкция тренера из назначения</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-zinc-300">{exercise.prescribed.trainerNote}</p>
            </div>
          ) : null}
          {actualAvailable ? exercise.sourceComments.map((comment) => (
            <SourceComment key={`${comment.source}:${comment.sourceId}`} label="Комментарий к упражнению" text={comment.text} />
          )) : null}
          <div className="grid gap-3">
            {exercise.sets.map((set) => <CanonicalReviewSetResult key={reviewSetAnchorId(exercise, set)} exercise={exercise} set={set} planAvailable={planAvailable} actualAvailable={actualAvailable} />)}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CanonicalReviewSetResult({ exercise, set, planAvailable, actualAvailable }: {
  exercise: ReviewExerciseReadModel;
  set: ReviewSetReadModel;
  planAvailable: boolean;
  actualAvailable: boolean;
}) {
  const sourceMissing = !set.identity.sourceAssignmentSetId;
  return (
    <article
      id={reviewSetAnchorId(exercise, set)}
      tabIndex={-1}
      className="scroll-mt-28 rounded-[8px] border border-zinc-800 bg-black/25 p-3 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-100">Подход {set.identity.position} · {set.prescribed.kind === "warmup" ? "разминочный" : "рабочий"}</h3>
        <SetStatus set={set} actualAvailable={actualAvailable} />
      </div>
      <dl className={cn("mt-3 grid gap-3", planAvailable && actualAvailable && "sm:grid-cols-2")}>
        {planAvailable ? <ValueGroup label="По плану" values={plannedSetValues(set)} /> : null}
        {actualAvailable ? <ValueGroup label="Выполнено" values={actualSetValues(set)} /> : <ValueGroup label="Выполнено" values={["Не удалось загрузить данные результата"]} />}
      </dl>
      {actualAvailable && set.actual.status === "completed" && !set.deviations.length ? (
        <p className="mt-3 text-xs text-zinc-500">По записанным значениям этого подхода отличий не зафиксировано.</p>
      ) : null}
      {actualAvailable && sourceMissing ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-200"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />Источник назначенного подхода не подтверждён. Соседние подходы не использовались для сопоставления.</p>
      ) : null}
      {actualAvailable ? set.sourceComments.map((comment) => (
        <SourceComment key={`${comment.source}:${comment.sourceId}`} label="Комментарий спортсмена к подходу" text={comment.text} />
      )) : null}
    </article>
  );
}

function ValueGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-relaxed text-zinc-200">{values.length ? values.join(" · ") : "Не указано"}</dd>
    </div>
  );
}

function SetStatus({ set, actualAvailable }: { set: ReviewSetReadModel; actualAvailable: boolean }) {
  const content = !actualAvailable ? "Результат недоступен"
    : set.actual.status === "skipped" ? "Пропущено"
    : set.actual.status === "incomplete" ? "Выполнено частично"
      : set.actual.status === "missing" ? "Результат не записан"
        : set.deviations.length ? "Есть отличия" : "По плану";
  const Icon = set.actual.status === "completed" && !set.deviations.length ? CheckCircle2
    : set.actual.status === "missing" ? CircleDashed : AlertTriangle;
  return <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400"><Icon className="size-3.5" />{content}</span>;
}

function SourceComment({ label, text }: { label: string; text: string }) {
  return (
    <div data-review-source-comment className="min-w-0 mt-3 border-l-2 border-zinc-700 pl-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <LongCopy text={text} className="mt-1 text-zinc-300" />
    </div>
  );
}

function LongCopy({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const expandable = text.length > 360 || text.split("\n").length > 4;
  return (
    <div className="min-w-0">
      <p
        id={contentId}
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]",
          expandable && !expanded && "line-clamp-4",
          className,
        )}
      >
        {text}
      </p>
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex min-h-11 items-center text-sm text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
        >
          {expanded ? "Свернуть" : "Показать полностью"}
        </button>
      ) : null}
    </div>
  );
}

function CanonicalReviewDiscomfort({ review }: { review: ReviewReadModel }) {
  return <dl className="border-t border-zinc-800 pt-5 text-sm">
        <div className="border-l-2 border-amber-300/50 pl-3" data-review-discomfort>
          <dt className="text-xs text-zinc-500">Дискомфорт во время тренировки</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-200">
            {review.sessionContext.discomfort.status === "ready" ? review.sessionContext.discomfort.value.comment
              : review.sessionContext.discomfort.status === "known_empty" ? "Спортсмен отметил: дискомфорта не было"
                : review.sessionContext.discomfort.status === "unsupported" ? "Данные о дискомфорте не собирались"
                  : "Данные о дискомфорте недоступны"}
          </dd>
        </div>
    </dl>;
}

export function CanonicalReviewSessionContext({ review }: { review: ReviewReadModel }) {
  return (
    <section aria-labelledby="review-session-context-heading" className="border-t border-zinc-800 pt-5">
      <h2 id="review-session-context-heading" className="text-lg font-semibold text-zinc-50">Контекст сессии</h2>
      <dl className="mt-3 text-sm">
        <ContextAvailability label="Общий комментарий" value={review.sessionContext.overallComment} unsupported="Общий комментарий к тренировке не собирался" />
      </dl>
      {review.session.zeroResultReason.status === "ready" ? (
        <div className="mt-4 border-l-2 border-amber-300/50 pl-3">
          <p className="text-xs text-zinc-500">Причина завершения без результата</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{review.session.zeroResultReason.value}</p>
        </div>
      ) : null}
    </section>
  );
}

function ContextAvailability({ label, value, unsupported }: {
  label: string;
  value: ReviewAvailability<unknown>;
  unsupported: string;
}) {
  return (
    <div className="rounded-[8px] border border-zinc-800 p-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-zinc-300">{value.status === "ready" && typeof value.value === "string" ? value.value : availabilityText(value, label, unsupported)}</dd>
    </div>
  );
}

function exerciseStatus(exercise: ReviewExerciseReadModel) {
  if (exercise.actual.status === "skipped") return "Пропущено";
  if (exercise.actual.status === "incomplete") return "Выполнено частично";
  if (exercise.actual.status === "missing") return "Результат не записан";
  if (exercise.deviations.length) return "Есть отличия";
  return "По записанным значениям";
}

function formatCompletion(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }
}
