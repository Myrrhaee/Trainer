"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Loader2, MessageSquare, Play, Save, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewFeedback } from "@/lib/server/reviews/review-types";
import type { WorkoutSession, WorkoutSetLog } from "@/lib/server/workout-sessions/workout-session-types";
import type { WorkoutAssignment } from "@/lib/server/workouts/workout-types";

type Values = { repetitions: string; duration: string; weight: string; rpe: string; comment: string };

function initialValues(set: WorkoutSetLog): Values {
  return {
    repetitions: set.actualRepetitions?.toString() ?? "",
    duration: set.actualDurationSeconds?.toString() ?? "",
    weight: set.actualWeightKg?.toString() ?? set.plannedWeightKg?.toString() ?? "",
    rpe: set.rpe?.toString() ?? "",
    comment: set.athleteComment,
  };
}

function numberOrNull(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? null : Number(normalized);
}

function plannedResult(set: WorkoutSetLog) {
  const parts: string[] = [];
  if (set.plannedRepetitionsMin !== null) {
    parts.push(set.plannedRepetitionsMin === set.plannedRepetitionsMax
      ? `${set.plannedRepetitionsMin} повт.`
      : `${set.plannedRepetitionsMin}-${set.plannedRepetitionsMax} повт.`);
  }
  if (set.plannedDurationSeconds !== null) parts.push(`${set.plannedDurationSeconds} сек.`);
  if (set.plannedWeightKg !== null) parts.push(`${set.plannedWeightKg} кг`);
  return parts.join(" · ") || "Свободный подход";
}

function errorText(code: string) {
  if (code === "version_conflict") return "Тренировка изменилась в другой вкладке. Обновите страницу.";
  if (code === "result_required") return "Укажите повторы или длительность подхода.";
  if (code === "zero_result_confirmation_required") return "Подтвердите завершение без выполненных подходов.";
  return "Не удалось сохранить изменения. Попробуйте ещё раз.";
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || "request_failed");
  return body;
}

export function CanonicalWorkoutExecution({
  assignmentId,
  sessionId,
}: {
  assignmentId?: string;
  sessionId?: string;
}) {
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([]);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [feedback, setFeedback] = useState<ReviewFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [zeroConfirmed, setZeroConfirmed] = useState(false);
  const [zeroReason, setZeroReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [assignmentBody, sessionBody] = await Promise.all([
          jsonRequest<{ assignments: WorkoutAssignment[] }>("/api/workout-assignments"),
          jsonRequest<{ sessions: WorkoutSession[] }>("/api/workout-sessions"),
        ]);
        if (cancelled) return;
        setAssignments(assignmentBody.assignments);
        const selected = sessionId
          ? sessionBody.sessions.find((item) => item.id === sessionId)
          : assignmentId
            ? sessionBody.sessions.find((item) => item.assignmentId === assignmentId)
            : sessionBody.sessions.find((item) => item.status === "active");
        setSession(selected ?? null);
      } catch (caught) {
        if (!cancelled) setError(errorText(caught instanceof Error ? caught.message : "request_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [assignmentId, sessionId]);

  useEffect(() => {
    if (!session) return;
    const next: Record<string, Values> = {};
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) next[set.id] = initialValues(set);
    }
    setValues(next);
  }, [session]);

  useEffect(() => {
    if (!session || session.status === "active") {
      setFeedback([]);
      return;
    }
    let cancelled = false;
    setFeedbackLoading(true);
    void jsonRequest<{ feedback: ReviewFeedback[] }>(`/api/client/feedback?sessionId=${encodeURIComponent(session.id)}`)
      .then((body) => {
        if (!cancelled) setFeedback(body.feedback);
      })
      .catch(() => {
        if (!cancelled) setFeedback([]);
      })
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  const assignment = useMemo(() => {
    const id = session?.assignmentId ?? assignmentId;
    return assignments.find((item) => item.id === id) ?? assignments[0] ?? null;
  }, [assignmentId, assignments, session]);

  const completedCount = session?.exercises.flatMap((item) => item.sets)
    .filter((item) => item.status === "completed").length ?? 0;
  const totalCount = session?.exercises.reduce((sum, item) => sum + item.sets.length, 0) ?? 0;
  const isTerminal = session ? session.status !== "active" : false;

  async function start() {
    if (!assignment || busyKey) return;
    setBusyKey("start");
    setError(null);
    try {
      const body = await jsonRequest<{ session: WorkoutSession }>("/api/workout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setSession(body.session);
    } catch (caught) {
      setError(errorText(caught instanceof Error ? caught.message : "request_failed"));
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSet(set: WorkoutSetLog, status: "completed" | "skipped") {
    if (!session || busyKey) return;
    const current = values[set.id] ?? initialValues(set);
    setBusyKey(set.id);
    setError(null);
    setMessage(null);
    try {
      const body = await jsonRequest<{ session: WorkoutSession }>(`/api/workout-sessions/${session.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: session.version,
          idempotencyKey: crypto.randomUUID(),
          sets: [{
            setLogId: set.id,
            status,
            actualRepetitions: status === "skipped" ? null : numberOrNull(current.repetitions),
            actualDurationSeconds: status === "skipped" ? null : numberOrNull(current.duration),
            actualWeightKg: status === "skipped" ? null : numberOrNull(current.weight),
            rpe: status === "skipped" ? null : numberOrNull(current.rpe),
            athleteComment: current.comment,
          }],
        }),
      });
      setSession(body.session);
      setMessage(status === "completed" ? "Подход сохранён" : "Подход пропущен");
    } catch (caught) {
      setError(errorText(caught instanceof Error ? caught.message : "request_failed"));
    } finally {
      setBusyKey(null);
    }
  }

  async function complete() {
    if (!session || busyKey) return;
    setBusyKey("complete");
    setError(null);
    try {
      const body = await jsonRequest<{ session: WorkoutSession }>(`/api/workout-sessions/${session.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: session.version,
          idempotencyKey: crypto.randomUUID(),
          zeroResultConfirmed: zeroConfirmed,
          zeroResultReason: zeroReason,
        }),
      });
      setSession(body.session);
      setCompleteOpen(false);
      setMessage("Тренировка завершена и отправлена тренеру");
    } catch (caught) {
      setError(errorText(caught instanceof Error ? caught.message : "request_failed"));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-black text-zinc-100"><Loader2 className="size-6 animate-spin text-zinc-500" /></main>;
  }

  if (!assignment && !session) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-4 text-zinc-100">
        <div className="text-center">
          <DumbbellMark />
          <h1 className="mt-5 text-xl font-semibold tracking-normal">Нет доступной тренировки</h1>
          <Button asChild variant="outline" className="mt-6 rounded-lg"><Link href="/client/me">Вернуться в кабинет</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black px-4 py-6 text-zinc-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/client/me" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="size-4" /> Мои тренировки
        </Link>

        <header className="mt-6 flex flex-col gap-5 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-lime-300">
              {isTerminal ? "Результат тренировки" : session ? "Тренировка идёт" : "Назначено тренером"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">{session?.title ?? assignment?.title}</h1>
            {assignment?.generalInstruction ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{assignment.generalInstruction}</p> : null}
          </div>
          {session ? (
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-2xl font-semibold tracking-normal">{completedCount} / {totalCount}</p>
              <p className="text-xs text-zinc-500">подходов выполнено</p>
            </div>
          ) : null}
        </header>

        {error ? <Notice tone="error" text={error} /> : null}
        {message ? <Notice tone="success" text={message} /> : null}

        {!session && assignment ? (
          <section className="py-8">
            {assignment.trainerNote ? <p className="mb-6 border-l-2 border-lime-300/50 pl-4 text-sm text-zinc-300">{assignment.trainerNote}</p> : null}
            <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
              {assignment.exercises.map((exercise, index) => (
                <li key={exercise.instanceKey} className="grid gap-2 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm text-zinc-600">{index + 1}</span>
                  <span className="font-medium">{exercise.title}</span>
                  <span className="text-sm text-zinc-500">{exercise.sets} x {exercise.repetitions}{exercise.targetWeightKg !== null ? ` · ${exercise.targetWeightKg} кг` : ""}</span>
                </li>
              ))}
            </ol>
            <Button onClick={() => void start()} disabled={busyKey !== null} className="mt-7 gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
              {busyKey === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Начать тренировку
            </Button>
          </section>
        ) : null}

        {session ? (
          <div className="divide-y divide-zinc-800">
            {session.exercises.map((exercise, exerciseIndex) => (
              <section key={exercise.id} className="py-8" aria-labelledby={`exercise-${exercise.id}`}>
                <div className="flex items-baseline gap-3">
                  <span className="text-sm text-zinc-600">{exerciseIndex + 1}</span>
                  <h2 id={`exercise-${exercise.id}`} className="text-xl font-semibold tracking-normal">{exercise.title}</h2>
                </div>
                <div className="mt-5 divide-y divide-zinc-800 border-y border-zinc-800">
                  {exercise.sets.map((set) => (
                    <SetEditor
                      key={set.id}
                      set={set}
                      value={values[set.id] ?? initialValues(set)}
                      disabled={isTerminal || busyKey !== null}
                      busy={busyKey === set.id}
                      onChange={(next) => setValues((current) => ({ ...current, [set.id]: next }))}
                      onSave={(status) => void saveSet(set, status)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {session?.status === "active" ? (
          <footer className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t border-zinc-800 bg-black/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
            <p className="text-sm text-zinc-500">Можно завершить с невыполненными подходами</p>
            <Button onClick={() => setCompleteOpen(true)} disabled={busyKey !== null} className="shrink-0 gap-2 rounded-lg bg-zinc-100 text-black hover:bg-white">
              <Check className="size-4" /> Завершить
            </Button>
          </footer>
        ) : null}

        {isTerminal ? (
          <div className="border-t border-zinc-800 py-8">
            <section className="text-center">
              <CheckCircle2 className="mx-auto size-9 text-lime-300" />
              <h2 className="mt-4 text-xl font-semibold tracking-normal">Результат сохранён</h2>
              <p className="mt-2 text-sm text-zinc-500">Тренер увидит тренировку в очереди разбора.</p>
            </section>
            <ClientFeedbackHistory feedback={feedback} loading={feedbackLoading} />
          </div>
        ) : null}
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Завершить тренировку?</DialogTitle>
            <DialogDescription>
              Выполнено {completedCount} из {totalCount} подходов. Остальные будут отмечены как невыполненные.
            </DialogDescription>
          </DialogHeader>
          {completedCount === 0 ? (
            <div className="mt-5 space-y-4">
              <label className="flex items-start gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={zeroConfirmed}
                  onChange={(event) => setZeroConfirmed(event.target.checked)}
                  className="mt-0.5 size-4 accent-lime-300"
                />
                Подтверждаю завершение без выполненных подходов
              </label>
              <Textarea
                value={zeroReason}
                onChange={(event) => setZeroReason(event.target.value)}
                maxLength={1000}
                placeholder="Причина, если хотите сообщить тренеру"
                className="rounded-lg border-zinc-800 bg-zinc-900/60"
              />
            </div>
          ) : null}
          <DialogFooter className="mt-3">
            <Button variant="ghost" onClick={() => setCompleteOpen(false)} disabled={busyKey !== null}>Отмена</Button>
            <Button
              onClick={() => void complete()}
              disabled={busyKey !== null || (completedCount === 0 && !zeroConfirmed)}
              className="rounded-lg bg-zinc-100 text-black hover:bg-white"
            >
              {busyKey === "complete" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Завершить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ClientFeedbackHistory({ feedback, loading }: { feedback: ReviewFeedback[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 border-t border-zinc-800 pt-8 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Проверяем ответ тренера
      </div>
    );
  }

  if (!feedback.length) {
    return (
      <section className="mt-8 border-t border-zinc-800 pt-8 text-center">
        <MessageSquare className="mx-auto size-6 text-zinc-600" />
        <h2 className="mt-3 text-base font-medium text-zinc-300">Ответ тренера пока не получен</h2>
        <p className="mt-1 text-sm text-zinc-600">Он появится здесь после разбора тренировки.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="client-feedback-heading" className="mt-8 border-t border-zinc-800 pt-8">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-lime-300" />
        <h2 id="client-feedback-heading" className="text-lg font-semibold">Ответ тренера</h2>
      </div>
      <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
        {feedback.map((item) => {
          const label = item.kind === "follow_up" ? "Уточнение" : item.kind === "acknowledgement" ? "Короткий ответ" : "Разбор";
          const sentAt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(item.sentAt));
          return (
            <article key={item.id} className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{label}</span>
                <span>{item.author} · {sentAt}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{item.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SetEditor({
  set,
  value,
  disabled,
  busy,
  onChange,
  onSave,
}: {
  set: WorkoutSetLog;
  value: Values;
  disabled: boolean;
  busy: boolean;
  onChange: (value: Values) => void;
  onSave: (status: "completed" | "skipped") => void;
}) {
  const saved = set.status !== "pending";
  return (
    <div className="grid gap-4 py-5 lg:grid-cols-[8rem_minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="text-sm font-medium">Подход {set.position}</p>
        <p className="mt-1 text-xs text-zinc-500">{plannedResult(set)}</p>
        {saved ? (
          <p className={`mt-2 text-xs ${set.status === "completed" ? "text-lime-300" : "text-amber-300"}`}>
            {set.status === "completed" ? "Выполнен" : set.status === "skipped" ? "Пропущен" : "Не выполнен"}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {set.plannedDurationSeconds === null ? (
          <Field label="Повторы" value={value.repetitions} disabled={disabled} max="500" onChange={(repetitions) => onChange({ ...value, repetitions })} />
        ) : (
          <Field label="Секунды" value={value.duration} disabled={disabled} max="86400" onChange={(duration) => onChange({ ...value, duration })} />
        )}
        <Field label="Вес, кг" value={value.weight} disabled={disabled} max="2000" step="0.5" onChange={(weight) => onChange({ ...value, weight })} />
        <Field label="RPE" value={value.rpe} disabled={disabled} min="1" max="10" step="0.5" onChange={(rpe) => onChange({ ...value, rpe })} />
        <label className="col-span-2 text-xs text-zinc-500 sm:col-span-1">
          Комментарий
          <Input value={value.comment} disabled={disabled} maxLength={1000} onChange={(event) => onChange({ ...value, comment: event.target.value })} className="mt-1 rounded-lg border-zinc-800 bg-zinc-900/60" />
        </label>
      </div>
      {!disabled || busy ? (
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => onSave("skipped")} disabled={disabled} aria-label={`Пропустить подход ${set.position}`} title="Пропустить" className="rounded-lg border-zinc-800">
            <SkipForward className="size-4" />
          </Button>
          <Button onClick={() => onSave("completed")} disabled={disabled} className="gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, disabled, min = "0", max, step = "1", onChange }: {
  label: string; value: string; disabled: boolean; min?: string; max?: string; step?: string; onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-zinc-500">
      {label}
      <Input type="number" min={min} max={max} step={step} inputMode="decimal" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 rounded-lg border-zinc-800 bg-zinc-900/60" />
    </label>
  );
}

function Notice({ tone, text }: { tone: "error" | "success"; text: string }) {
  return (
    <div className={`mt-5 flex items-center gap-2 border-l-2 px-3 py-2 text-sm ${tone === "error" ? "border-red-400 text-red-200" : "border-lime-300 text-lime-200"}`}>
      {tone === "error" ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
      {text}
    </div>
  );
}

function DumbbellMark() {
  return <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-zinc-800 text-zinc-400"><Play className="size-5" /></div>;
}
