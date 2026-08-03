"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Dumbbell, Loader2, Send, UserRound } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewFeedback, TrainerReviewDetails } from "@/lib/server/reviews/review-types";
import { cn } from "@/lib/utils";

import type {
  ReviewExercise,
  ReviewSignal,
  WorkoutReviewDetails,
} from "@/components/trainer-os/workout-review/review-model";
import {
  ReviewClientComment,
  ReviewExerciseList,
  ReviewSessionSummary,
  ReviewSignals,
} from "@/components/trainer-os/workout-review/review-shared";

type FeedbackMode = "detailed" | "acknowledgement";

const acknowledgements = [
  "Посмотрел, всё в порядке. Продолжаем по плану.",
  "Тренировку принял. Вернусь с корректировками отдельно.",
  "Результаты вижу. Хорошая работа.",
];

const manualReasons = [
  "Разобрано вне продукта",
  "Дублирующая задача",
  "Feedback не требуется",
  "Тестовая или ошибочная задача",
  "Другое",
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "request_failed");
  return body;
}

function errorText(code: string) {
  if (code === "review_already_resolved") return "Этот разбор уже закрыт в другой вкладке. Данные обновлены.";
  if (code === "idempotency_conflict") return "Повтор команды не совпадает с исходным запросом.";
  if (code === "invalid_follow_up") return "Не удалось связать уточнение с исходным ответом.";
  return "Не удалось сохранить решение. Текст остался на экране, попробуйте ещё раз.";
}

export function CanonicalWorkoutReview({ sessionId }: { sessionId: string }) {
  const [details, setDetails] = useState<TrainerReviewDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await requestJson<{ review: TrainerReviewDetails }>(`/api/trainer/reviews/${sessionId}`);
      setDetails(body.review);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  const review = useMemo(() => details ? toReviewModel(details) : null, [details]);

  return (
    <TrainerShell
      eyebrow="Разбор тренировки"
      title={review?.sessionTitle ?? "Результат спортсмена"}
      description={review ? `${review.athlete.displayName} · ${review.session.completedLabel}` : "Загрузка фактов сессии"}
      headerAction={
        <Button asChild variant="outline" className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-200">
          <Link href="/trainer/attention"><ArrowLeft className="size-4" />К очереди</Link>
        </Button>
      }
    >
      {loading ? (
        <div className="grid min-h-[65vh] place-items-center"><Loader2 className="size-6 animate-spin text-zinc-500" /></div>
      ) : failed || !details || !review ? (
        <div className="grid min-h-[65vh] place-items-center text-center">
          <div>
            <AlertCircle className="mx-auto size-9 text-red-300" />
            <h2 className="mt-4 text-xl font-semibold text-zinc-100">Разбор не найден</h2>
            <p className="mt-2 text-sm text-zinc-500">Проверьте ссылку или вернитесь к очереди.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[1440px] space-y-5">
          <section className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-100">{review.athlete.initials}</div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">{details.attention.status === "open" ? "Ждёт решения" : "Разбор закрыт"}</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-zinc-50">{review.athlete.displayName}</h2>
                <p className="mt-1 text-sm text-zinc-500">{review.sessionTitle} · {review.session.completedLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-200">
                <Link href={`/trainer/clients/${details.athlete.id}?from=review`}><UserRound className="size-4" />К профилю</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-200">
                <Link href={`/trainer/builder?clientId=${details.athlete.id}&from=review`}><Dumbbell className="size-4" />Назначить следующую</Link>
              </Button>
            </div>
          </section>

          <ReviewSessionSummary review={review} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <div className="grid min-w-0 gap-5">
              <ReviewSignals signals={review.signals} />
              <ReviewClientComment comment={review.clientComment} />
              <ReviewExerciseList exercises={review.exercises} />
            </div>
            <aside className="xl:sticky xl:top-24">
              <CanonicalFeedbackPanel
                details={details}
                onChanged={async (message) => {
                  setReceipt(message);
                  await load();
                }}
              />
              {receipt ? (
                <div aria-live="polite" className="mt-3 border-l-2 border-lime-300 px-3 py-2 text-sm text-lime-100">{receipt}</div>
              ) : null}
            </aside>
          </div>
        </div>
      )}
    </TrainerShell>
  );
}

function CanonicalFeedbackPanel({
  details,
  onChanged,
}: {
  details: TrainerReviewDetails;
  onChanged: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<FeedbackMode>("detailed");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReason, setManualReason] = useState(manualReasons[0]);
  const [customReason, setCustomReason] = useState("");
  const resolved = details.attention.status === "resolved";
  const lastFeedback = details.feedback[details.feedback.length - 1];
  const canFollowUp = resolved && Boolean(lastFeedback);
  const [followUp, setFollowUp] = useState(false);

  async function send() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/trainer/reviews/${details.session.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attentionItemId: details.attention.id,
          kind: followUp ? "follow_up" : mode,
          body: draft,
          followUpOfId: followUp ? lastFeedback?.id : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setDraft("");
      setFollowUp(false);
      await onChanged(followUp ? "Уточнение отправлено спортсмену." : "Ответ отправлен, задача разбора закрыта.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "request_failed";
      setError(errorText(code));
      if (code === "review_already_resolved") await onChanged("Разбор уже был закрыт. Показано актуальное состояние.");
    } finally {
      setSaving(false);
    }
  }

  async function resolveManually() {
    const reason = manualReason === "Другое" ? customReason.trim() : manualReason;
    if (!reason || saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/trainer/reviews/${details.session.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attentionItemId: details.attention.id,
          reason,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setManualOpen(false);
      await onChanged("Задача закрыта без сообщения. Причина сохранена.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "request_failed";
      setError(errorText(code));
      if (code === "review_already_resolved") await onChanged("Разбор уже был закрыт. Показано актуальное состояние.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="canonical-feedback-heading" className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-lime-200/70">Действие тренера</p>
          <h2 id="canonical-feedback-heading" className="mt-1 text-lg font-semibold text-zinc-50">Обратная связь</h2>
        </div>
        {resolved ? <span className="inline-flex items-center gap-1.5 text-xs text-lime-200"><CheckCircle2 className="size-4" />Закрыто</span> : null}
      </div>

      {details.feedback.length ? (
        <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
          {details.feedback.map((feedback) => <FeedbackEntry key={feedback.id} feedback={feedback} />)}
        </div>
      ) : null}

      {details.attention.manualResolutionReason ? (
        <p className="mt-4 border-l-2 border-zinc-700 pl-3 text-sm text-zinc-400">Закрыто без сообщения: {details.attention.manualResolutionReason}</p>
      ) : null}

      {resolved && !followUp ? (
        canFollowUp ? (
          <Button type="button" variant="outline" onClick={() => setFollowUp(true)} className="mt-4 w-full rounded-lg border-zinc-800 bg-black/20 text-zinc-200">Добавить уточнение</Button>
        ) : null
      ) : (
        <>
          {!followUp ? (
            <div role="group" aria-label="Режим обратной связи" className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={mode === "detailed"} onClick={() => setMode("detailed")} disabled={saving} className={modeClass(mode === "detailed")}>Подробный ответ</button>
              <button type="button" aria-pressed={mode === "acknowledgement"} onClick={() => setMode("acknowledgement")} disabled={saving} className={modeClass(mode === "acknowledgement")}>Коротко подтвердить</button>
            </div>
          ) : null}

          {mode === "acknowledgement" && !followUp ? (
            <div className="mt-3 grid gap-2">
              {acknowledgements.map((value) => (
                <button key={value} type="button" onClick={() => setDraft(value)} disabled={saving} className="min-h-11 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-60">{value}</button>
              ))}
            </div>
          ) : null}

          <Label htmlFor="canonical-review-feedback" className="mt-4 block text-sm text-zinc-300">{followUp ? "Текст уточнения" : "Сообщение спортсмену"}</Label>
          <Textarea
            id="canonical-review-feedback"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={saving}
            maxLength={5000}
            placeholder="Напишите ответ на основе фактов тренировки"
            className="mt-2 min-h-36 resize-y rounded-lg border-zinc-800 bg-black/30 text-zinc-100"
          />
          {error ? <p role="alert" className="mt-3 border-l-2 border-red-400 pl-3 text-sm text-red-200">{error}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={() => void send()} disabled={!draft.trim() || saving} className="min-h-11 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {saving ? "Сохраняем" : followUp ? "Отправить уточнение" : "Отправить"}
            </Button>
            {followUp ? (
              <Button type="button" variant="outline" onClick={() => { setFollowUp(false); setDraft(""); }} disabled={saving} className="min-h-11 rounded-lg border-zinc-800">Отмена</Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setManualOpen(true)} disabled={saving} className="min-h-11 rounded-lg text-zinc-400">Закрыть без сообщения</Button>
            )}
          </div>
        </>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg rounded-lg border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>Закрыть без сообщения?</DialogTitle>
            <DialogDescription>Причина останется в приватной истории тренера. Спортсмен не увидит её как feedback.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="canonical-manual-reason" className="mt-4 text-sm text-zinc-300">Причина</Label>
          <select id="canonical-manual-reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none">
            {manualReasons.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
          {manualReason === "Другое" ? <Textarea aria-label="Своя причина" value={customReason} onChange={(event) => setCustomReason(event.target.value)} maxLength={1000} className="mt-3 min-h-24 rounded-lg border-zinc-800 bg-black/30" /> : null}
          <DialogFooter className="flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={saving} className="rounded-lg border-zinc-800">Продолжить разбор</Button>
            <Button type="button" onClick={() => void resolveManually()} disabled={saving || (manualReason === "Другое" && !customReason.trim())} className="rounded-lg bg-zinc-100 text-black hover:bg-white">Подтвердить закрытие</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FeedbackEntry({ feedback }: { feedback: ReviewFeedback }) {
  const label = feedback.kind === "follow_up" ? "Уточнение" : feedback.kind === "acknowledgement" ? "Короткое подтверждение" : "Подробный ответ";
  const time = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(feedback.sentAt));
  return (
    <article className="py-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500"><span>{label}</span><span>{feedback.author} · {time}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{feedback.body}</p>
    </article>
  );
}

function toReviewModel(details: TrainerReviewDetails): WorkoutReviewDetails {
  const exercises = details.exercises.map(toReviewExercise);
  const signals = details.exercises.flatMap(toSignals);
  const comments = details.exercises.flatMap((exercise) => exercise.sets
    .filter((set) => set.athleteComment.trim())
    .map((set) => `${exercise.title}, подход ${set.position}: ${set.athleteComment.trim()}`));
  const completedSets = details.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === "completed").length;
  const totalSets = details.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedExercises = details.exercises.filter((exercise) => exercise.status === "completed").length;
  return {
    session: {
      id: details.session.id,
      status: details.session.status === "completed_with_omissions" ? "partial" : "completed",
      completedAt: details.session.completedAt,
      completedLabel: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(details.session.completedAt)),
      durationMin: details.session.durationMin,
    },
    athlete: {
      id: details.athlete.id,
      displayName: details.athlete.displayName,
      initials: details.athlete.initials,
      goal: "",
      profileHref: `/trainer/clients/${details.athlete.id}`,
    },
    assignment: { id: details.assignment.id, title: details.session.title, scheduledFor: details.assignment.scheduledFor },
    sessionTitle: details.session.title,
    summary: {
      completedExercises,
      totalExercises: details.exercises.length,
      completedSets,
      totalSets,
      hasSkippedWork: completedSets < totalSets,
      hasDiscomfort: false,
    },
    signals,
    clientComment: comments.length ? comments.join("\n") : undefined,
    exercises,
    feedback: {
      aiState: "unavailable",
      existing: details.feedback.map((feedback) => ({
        id: feedback.id,
        kind: feedback.kind === "follow_up" ? "follow-up" : feedback.kind,
        body: feedback.body,
        author: feedback.author,
        sentAt: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(feedback.sentAt)),
      })),
    },
    attentionContext: {
      id: details.attention.id,
      queue: "canonical-review",
      position: 1,
      total: 1,
      reason: details.attention.priorityReasons.includes("partial_completion") ? "Частичное выполнение" : "Завершённая тренировка ждёт разбора",
    },
  };
}

function toReviewExercise(exercise: TrainerReviewDetails["exercises"][number]): ReviewExercise {
  const changed = exercise.sets.some((set) => set.status === "completed" && (
    (set.actualWeightKg !== null && set.plannedWeightKg !== null && set.actualWeightKg !== set.plannedWeightKg)
    || (set.actualRepetitions !== null && set.plannedRepetitionsMin !== null
      && (set.actualRepetitions < set.plannedRepetitionsMin || set.actualRepetitions > (set.plannedRepetitionsMax ?? set.plannedRepetitionsMin)))
  ));
  return {
    id: exercise.id,
    title: exercise.title,
    state: exercise.status === "skipped" ? "skipped" : exercise.status === "incomplete" ? "incomplete" : changed ? "modified" : "completed",
    planned: {
      sets: exercise.sets.map((set) => ({
        id: set.id,
        kind: set.kind,
        repetitions: set.plannedRepetitionsMin === null ? undefined
          : set.plannedRepetitionsMin === set.plannedRepetitionsMax ? set.plannedRepetitionsMin
            : { min: set.plannedRepetitionsMin, max: set.plannedRepetitionsMax ?? set.plannedRepetitionsMin },
        targetWeightKg: set.plannedWeightKg ?? undefined,
      })),
    },
    actual: {
      sets: exercise.sets.map((set) => ({
        id: set.id,
        kind: set.kind,
        repetitions: set.actualRepetitions ?? undefined,
        weightKg: set.actualWeightKg ?? undefined,
        rpe: set.rpe ?? undefined,
        completed: set.status === "completed",
        comment: set.athleteComment || undefined,
      })),
      comment: exercise.athleteNote || undefined,
    },
    modificationNote: changed ? "Фактические значения отличаются от назначения." : undefined,
  };
}

function toSignals(exercise: TrainerReviewDetails["exercises"][number]): ReviewSignal[] {
  const signals: ReviewSignal[] = [];
  if (exercise.status === "skipped") {
    signals.push({ id: `${exercise.id}-skipped`, kind: "skipped", tone: "warning", title: "Упражнение пропущено", detail: `${exercise.title} не было выполнено.`, sourceLabel: exercise.title, exerciseId: exercise.id });
  } else if (exercise.status === "incomplete") {
    const completed = exercise.sets.filter((set) => set.status === "completed").length;
    signals.push({ id: `${exercise.id}-incomplete`, kind: "incomplete", tone: "warning", title: "Не все подходы выполнены", detail: `${exercise.title}: выполнено ${completed} из ${exercise.sets.length}.`, sourceLabel: exercise.title, exerciseId: exercise.id });
  }
  for (const set of exercise.sets) {
    if (set.status !== "completed") continue;
    if (set.actualRepetitions !== null && set.plannedRepetitionsMin !== null && set.actualRepetitions < set.plannedRepetitionsMin) {
      signals.push({ id: `${set.id}-repetitions`, kind: "repetitions", tone: "warning", title: "Повторов меньше плана", detail: `Подход ${set.position}: ${set.actualRepetitions} вместо ${set.plannedRepetitionsMin}-${set.plannedRepetitionsMax ?? set.plannedRepetitionsMin}.`, sourceLabel: `${exercise.title} · подход ${set.position}`, exerciseId: exercise.id });
    }
    if (set.actualWeightKg !== null && set.plannedWeightKg !== null && set.actualWeightKg !== set.plannedWeightKg) {
      signals.push({ id: `${set.id}-weight`, kind: "weight", tone: "info", title: "Вес отличается от назначения", detail: `Подход ${set.position}: ${set.actualWeightKg} кг вместо ${set.plannedWeightKg} кг.`, sourceLabel: `${exercise.title} · подход ${set.position}`, exerciseId: exercise.id });
    }
  }
  return signals;
}

function modeClass(active: boolean) {
  return cn("min-h-11 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-60", active ? "border-lime-300/35 bg-lime-300/10 text-lime-100" : "border-zinc-800 bg-black/20 text-zinc-400 hover:text-zinc-200");
}
