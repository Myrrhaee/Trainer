"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, List, Loader2, MessageSquare, Play, Save, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanonicalWorkoutCompletion, WorkoutCompletionReceipt } from "./canonical-workout-completion";
import { Input } from "@/components/ui/input";
import {
  createClientWorkoutSetAttempt,
  isSameClientWorkoutSetIntent,
  reconcileClientWorkoutSetAttempt,
  type ClientWorkoutSetCommandAttempt,
  type ClientWorkoutSetOperation,
} from "@/lib/client-workout-progress-command";
import {
  createClientWorkoutStartAttempt,
  reconcileClientWorkoutStart,
  type ClientWorkoutStartAttempt,
} from "@/lib/client-workout-start-command";
import type {
  ClientWorkoutAssignmentReadModel,
  ClientWorkoutExecutionReadModel,
  ClientWorkoutExercisePrescription,
  ClientWorkoutSetPrescription,
  StartOrResumeSessionResult,
} from "@/lib/server/client-workouts/client-workout-types";
import type { ReviewFeedback } from "@/lib/server/reviews/review-types";
import type { WorkoutSession, WorkoutSetLog } from "@/lib/server/workout-sessions/workout-session-types";

type Values = { repetitions: string; duration: string; weight: string; rpe: string; comment: string };
type SetCommandState = "editing" | "saving" | "saved" | "skipped" | "save_failed" | "outcome_unknown" | "conflict";

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

function plannedResult(set: WorkoutSetLog, prescription?: ClientWorkoutSetPrescription) {
  const parts: string[] = [];
  if (set.plannedRepetitionsMin !== null) {
    parts.push(set.plannedRepetitionsMin === set.plannedRepetitionsMax
      ? `${set.plannedRepetitionsMin} повт.`
      : `${set.plannedRepetitionsMin}-${set.plannedRepetitionsMax} повт.`);
  }
  if (set.plannedDurationSeconds !== null) parts.push(`${set.plannedDurationSeconds} сек.`);
  if (set.plannedWeightKg !== null) parts.push(`${set.plannedWeightKg} кг`);
  if (prescription?.restSeconds !== undefined) parts.push(`отдых ${prescription.restSeconds} сек.`);
  return parts.join(" · ") || "Свободный подход";
}

function assignmentPrescription(exercise: ClientWorkoutExercisePrescription) {
  if (exercise.perSetMode) return `${exercise.setCount} подх. · индивидуально`;
  const value = exercise.prescriptionType === "duration"
    ? `${exercise.durationSeconds} сек.`
    : exercise.repetitionMode === "range"
      ? `${exercise.repetitionsMin}-${exercise.repetitionsMax} повт.`
      : `${exercise.repetitionsMin} повт.`;
  return `${exercise.setCount} × ${value}${exercise.targetWeightKg !== null ? ` · ${exercise.targetWeightKg} кг` : ""}`;
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
  if (!response.ok) throw new RequestError(body.error || "request_failed", response.status);
  return body;
}

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type StartState = "idle" | "running" | "outcome_unknown" | "failed" | "conflict" | "success";

function exactExecutionReadUrl(assignmentId?: string, sessionId?: string) {
  const query = new URLSearchParams();
  if (assignmentId) query.set("assignmentId", assignmentId);
  if (sessionId) query.set("sessionId", sessionId);
  return `/api/client/workouts?${query.toString()}`;
}

function clientSessionRoute(sessionId: string, returnTo: "/client/me" | "/client/workouts") {
  return `/client/workouts?session=${encodeURIComponent(sessionId)}&returnTo=${encodeURIComponent(returnTo)}`;
}

export function CanonicalWorkoutExecution({
  assignmentId,
  sessionId,
  returnTo,
}: {
  assignmentId?: string;
  sessionId?: string;
  returnTo: "/client/me" | "/client/workouts";
}) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<ClientWorkoutAssignmentReadModel | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [feedback, setFeedback] = useState<ReviewFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [error, setError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const completionTrigger = useRef<HTMLButtonElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [startState, setStartState] = useState<StartState>("idle");
  const startAttempt = useRef<ClientWorkoutStartAttempt | null>(null);
  const setAttempts = useRef<Record<string, ClientWorkoutSetCommandAttempt>>({});
  const dirtySets = useRef(new Set<string>());
  const [setCommandStates, setSetCommandStates] = useState<Record<string, SetCommandState>>({});
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [executionCapabilities, setExecutionCapabilities] = useState<ClientWorkoutExecutionReadModel["capabilities"] | null>(null);
  const completionUnavailable = useCallback(() => { setSession(null); setAssignment(null); setUnavailable(true); setCompleteOpen(false); }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const body = await jsonRequest<{ execution: ClientWorkoutExecutionReadModel }>(exactExecutionReadUrl(assignmentId, sessionId));
        if (cancelled) return;
        if (body.execution.assignment.status === "cancelled" && !body.execution.session) {
          setUnavailable(true);
          return;
        }
        setAssignment(body.execution.assignment);
        setSession(body.execution.session);
        setExecutionCapabilities(body.execution.capabilities);
        if (!sessionId && body.execution.session) {
          router.replace(clientSessionRoute(body.execution.session.id, returnTo));
        }
      } catch (caught) {
        if (!cancelled) {
          if (caught instanceof RequestError && caught.status === 404) setUnavailable(true);
          else setError(errorText(caught instanceof Error ? caught.message : "request_failed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [assignmentId, sessionId, returnTo, router]);

  useEffect(() => {
    if (!session) return;
    setValues((current) => {
      const next: Record<string, Values> = {};
      for (const exercise of session.exercises) {
        for (const set of exercise.sets) {
          next[set.id] = dirtySets.current.has(set.id) && current[set.id]
            ? current[set.id]
            : initialValues(set);
        }
      }
      return next;
    });
  }, [session]);

  useEffect(() => {
    if (!session?.exercises.length) return;
    if (!activeExerciseId || !session.exercises.some((exercise) => exercise.id === activeExerciseId)) {
      setActiveExerciseId(session.exercises[0].id);
    }
  }, [activeExerciseId, session]);

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

  const persistedCount = session?.exercises.flatMap((item) => item.sets)
    .filter((item) => item.status !== "pending").length ?? 0;
  const totalCount = session?.exercises.reduce((sum, item) => sum + item.sets.length, 0) ?? 0;
  const isTerminal = session ? session.status !== "active" : false;
  const activeExerciseIndex = session?.exercises.findIndex((exercise) => exercise.id === activeExerciseId) ?? -1;
  const activeExercise = activeExerciseIndex >= 0 ? session?.exercises[activeExerciseIndex] : session?.exercises[0];
  const activePrescription = assignment?.exercises.find((exercise) => exercise.assignmentExerciseId === activeExercise?.assignmentExerciseId);

  async function submitStart(attempt: ClientWorkoutStartAttempt) {
    setBusyKey("start");
    setStartState("running");
    setError(null);
    try {
      const body = await jsonRequest<StartOrResumeSessionResult>("/api/workout-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: attempt.assignmentId, clientTimezone: attempt.clientTimezone, idempotencyKey: attempt.commandId }),
      });
      setSession(body.session);
      setExecutionCapabilities({ canEdit: true, canSkip: true, canResume: true, canEnterCompletionFlow: true });
      setStartState("success");
      startAttempt.current = null;
      router.replace(clientSessionRoute(body.session.id, returnTo));
    } catch (caught) {
      if (!(caught instanceof RequestError) || caught.status >= 500) {
        setStartState("outcome_unknown");
        setError("Не удалось подтвердить, началась ли тренировка.");
      } else {
        setStartState(caught.status === 409 ? "conflict" : "failed");
        setError(errorText(caught.message));
      }
    } finally {
      setBusyKey(null);
    }
  }

  function start() {
    if (!assignment || busyKey || !assignment.capabilities.canStart) return;
    const attempt = startAttempt.current ?? createClientWorkoutStartAttempt({
      assignmentId: assignment.assignmentId,
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    startAttempt.current = attempt;
    void submitStart(attempt);
  }

  async function reconcileStart() {
    const attempt = startAttempt.current;
    if (!attempt || busyKey) return;
    setBusyKey("start");
    setStartState("running");
    setError(null);
    try {
      const body = await jsonRequest<{ execution: ClientWorkoutExecutionReadModel }>(
        `/api/client/workouts?assignmentId=${encodeURIComponent(attempt.assignmentId)}`,
      );
      setAssignment(body.execution.assignment);
      setExecutionCapabilities(body.execution.capabilities);
      const decision = reconcileClientWorkoutStart(attempt, body.execution);
      if (decision === "accept" && body.execution.session) {
        setSession(body.execution.session);
        setStartState("success");
        startAttempt.current = null;
        router.replace(clientSessionRoute(body.execution.session.id, returnTo));
        return;
      }
      if (decision === "conflict") {
        setStartState("conflict");
        setError("Состояние назначения изменилось. Обновите список тренировок.");
        return;
      }
    } catch (caught) {
      setStartState(caught instanceof RequestError && caught.status < 500 ? "conflict" : "outcome_unknown");
      setError(caught instanceof RequestError && caught.status < 500
        ? "Тренировка больше недоступна."
        : "Не удалось проверить статус тренировки.");
      return;
    } finally {
      setBusyKey(null);
    }
    await submitStart(attempt);
  }

  function candidateSetAttempt(exerciseLogId: string, set: WorkoutSetLog, operation: ClientWorkoutSetOperation) {
    if (!session || !assignment) return null;
    const current = values[set.id] ?? initialValues(set);
    return createClientWorkoutSetAttempt({
      operation,
      assignmentId: assignment.assignmentId,
      sessionId: session.id,
      exerciseLogId,
      set,
      expectedVersion: session.version,
      actual: {
        actualRepetitions: numberOrNull(current.repetitions),
        actualDurationSeconds: numberOrNull(current.duration),
        actualWeightKg: numberOrNull(current.weight),
        rpe: numberOrNull(current.rpe),
        athleteComment: current.comment,
      },
    });
  }

  function saveSet(exerciseLogId: string, set: WorkoutSetLog, operation: ClientWorkoutSetOperation) {
    if (!session || busyKey) return;
    const candidate = candidateSetAttempt(exerciseLogId, set, operation);
    if (!candidate) return;
    const previous = setAttempts.current[set.id];
    const attempt = previous && isSameClientWorkoutSetIntent(previous, candidate) ? previous : candidate;
    setAttempts.current[set.id] = attempt;
    void submitSetAttempt(attempt);
  }

  async function submitSetAttempt(attempt: ClientWorkoutSetCommandAttempt) {
    setBusyKey(attempt.setLogId);
    setSetCommandStates((current) => ({ ...current, [attempt.setLogId]: "saving" }));
    try {
      const body = await jsonRequest<{ session: WorkoutSession }>(`/api/workout-sessions/${attempt.sessionId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.frozenPayload),
      });
      dirtySets.current.delete(attempt.setLogId);
      delete setAttempts.current[attempt.setLogId];
      setSession(body.session);
      setSetCommandStates((current) => ({
        ...current,
        [attempt.setLogId]: attempt.operation === "skip" ? "skipped" : "saved",
      }));
    } catch (caught) {
      const unknown = !(caught instanceof RequestError) || caught.status >= 500;
      const conflict = caught instanceof RequestError && (caught.status === 409 || caught.status === 404);
      setSetCommandStates((current) => ({
        ...current,
        [attempt.setLogId]: unknown ? "outcome_unknown" : conflict ? "conflict" : "save_failed",
      }));
      focusSet(attempt.setLogId);
    } finally {
      setBusyKey(null);
    }
  }

  async function reconcileSet(attempt: ClientWorkoutSetCommandAttempt) {
    if (busyKey) return;
    setBusyKey(attempt.setLogId);
    setSetCommandStates((current) => ({ ...current, [attempt.setLogId]: "saving" }));
    try {
      const body = await jsonRequest<{ execution: ClientWorkoutExecutionReadModel }>(
        exactExecutionReadUrl(undefined, attempt.sessionId),
      );
      const decision = reconcileClientWorkoutSetAttempt(attempt, body.execution);
      if (decision === "accept") {
        dirtySets.current.delete(attempt.setLogId);
        delete setAttempts.current[attempt.setLogId];
        setSession(body.execution.session);
        setExecutionCapabilities(body.execution.capabilities);
        setSetCommandStates((current) => ({
          ...current,
          [attempt.setLogId]: attempt.operation === "skip" ? "skipped" : "saved",
        }));
        return;
      }
      setSession(body.execution.session);
      setExecutionCapabilities(body.execution.capabilities);
      if (decision === "conflict") {
        setSetCommandStates((current) => ({ ...current, [attempt.setLogId]: "conflict" }));
        focusSet(attempt.setLogId);
        return;
      }
    } catch {
      setSetCommandStates((current) => ({ ...current, [attempt.setLogId]: "outcome_unknown" }));
      focusSet(attempt.setLogId);
      return;
    } finally {
      setBusyKey(null);
    }
    await submitSetAttempt(attempt);
  }

  function changeSetValue(setId: string, next: Values) {
    dirtySets.current.add(setId);
    const state = setCommandStates[setId];
    if (state && state !== "outcome_unknown" && state !== "saving") {
      setSetCommandStates((current) => ({ ...current, [setId]: "editing" }));
    }
    setValues((current) => ({ ...current, [setId]: next }));
  }

  const unresolvedSetId = session?.exercises.flatMap((exercise) => exercise.sets).find((set) =>
    dirtySets.current.has(set.id) || ["saving", "save_failed", "outcome_unknown", "conflict", "editing"].includes(setCommandStates[set.id] ?? ""))?.id;

  function returnToUnresolvedSet() {
    if (!unresolvedSetId || !session) return;
    const exercise = session.exercises.find((item) => item.sets.some((set) => set.id === unresolvedSetId));
    if (exercise) setActiveExerciseId(exercise.id);
    window.setTimeout(() => focusSet(unresolvedSetId), 0);
  }

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-black text-zinc-100"><Loader2 className="size-6 animate-spin text-zinc-500" /></main>;
  }

  if (unavailable || (!assignment && !session)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-4 text-zinc-100">
        <div className="text-center">
          <DumbbellMark />
          <h1 className="mt-5 text-xl font-semibold tracking-normal">Тренировка недоступна</h1>
          <p className="mt-2 text-sm text-zinc-500">Возможно, ссылка устарела или назначение изменилось.</p>
          <Button asChild variant="outline" className="mt-6 rounded-lg"><Link href={returnTo}>Вернуться к тренировкам</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-black px-4 py-6 text-zinc-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href={returnTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
          <ArrowLeft className="size-4" /> Мои тренировки
        </Link>

        <header className="mt-6 flex flex-col gap-5 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-lime-300">
              {isTerminal ? "Результат тренировки" : session ? "Тренировка идёт" : "Назначено тренером"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">{session?.title ?? assignment?.title}</h1>
            {assignment?.generalInstruction ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{assignment.generalInstruction}</p> : null}
            {assignment ? <p className="mt-3 text-xs text-zinc-500">Назначил: {assignment.trainer.displayName} · {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${assignment.scheduledFor}T12:00:00`))}</p> : null}
          </div>
          {session ? (
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-2xl font-semibold tracking-normal">{persistedCount} / {totalCount}</p>
              <p className="text-xs text-zinc-500">подходов сохранено</p>
            </div>
          ) : null}
        </header>

        {error ? <Notice tone="error" text={error} /> : null}
        {startState === "outcome_unknown" ? (
          <Button type="button" variant="outline" onClick={() => void reconcileStart()} disabled={busyKey !== null} className="mt-4 min-h-11 rounded-lg border-zinc-700">
            {busyKey === "start" ? <Loader2 className="size-4 animate-spin" /> : null}
            Проверить
          </Button>
        ) : null}
        {session?.completedAt ? <WorkoutCompletionReceipt session={session} /> : null}

        {!session && assignment ? (
          <section className="py-8">
            {assignment.trainerNote ? <p className="mb-6 border-l-2 border-lime-300/50 pl-4 text-sm text-zinc-300">{assignment.trainerNote}</p> : null}
            <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
              {assignment.exercises.map((exercise, index) => (
                <li key={exercise.instanceKey} className="grid gap-2 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm text-zinc-600">{index + 1}</span>
                  <span className="font-medium">{exercise.title}</span>
                  <span className="text-sm text-zinc-500">{assignmentPrescription(exercise)}</span>
                </li>
              ))}
            </ol>
            <Button onClick={start} disabled={busyKey !== null || !assignment.capabilities.canStart || startState === "outcome_unknown"} className="mt-7 min-h-11 gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
              {busyKey === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {busyKey === "start" ? "Начинаем тренировку…" : "Начать тренировку"}
            </Button>
            {!assignment.capabilities.canStart && assignment.relationStatus !== "active" ? <p className="mt-4 text-sm text-zinc-500">Начало тренировки сейчас недоступно.</p> : null}
          </section>
        ) : null}

        {session && activeExercise ? (
          <div className="py-7">
            {session.exercises.length > 1 ? (
              <nav aria-label="Упражнения тренировки" className="border-b border-zinc-800 pb-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase text-zinc-500">
                  <List className="size-4" aria-hidden /> Упражнения
                </div>
                <div role="tablist" aria-label="Выбор упражнения" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {session.exercises.map((exercise, index) => (
                    <button
                      key={exercise.id}
                      type="button"
                      role="tab"
                      aria-selected={exercise.id === activeExercise.id}
                      aria-controls={`exercise-panel-${exercise.id}`}
                      onClick={() => setActiveExerciseId(exercise.id)}
                      className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors ${exercise.id === activeExercise.id ? "border-lime-300/50 bg-lime-300/10 text-zinc-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                    >
                      <span className="mr-2 text-zinc-600">{index + 1}</span>{exercise.title}
                    </button>
                  ))}
                </div>
              </nav>
            ) : null}
            <section
              id={`exercise-panel-${activeExercise.id}`}
              role="tabpanel"
              className="py-7"
              aria-labelledby={`exercise-${activeExercise.id}`}
            >
                <div className="flex items-baseline gap-3">
                  <span className="text-sm text-zinc-600">{activeExerciseIndex + 1}</span>
                  <h2 id={`exercise-${activeExercise.id}`} className="text-xl font-semibold tracking-normal">{activeExercise.title}</h2>
                </div>
                {activePrescription?.superset ? (
                  <p className="mt-2 text-xs text-lime-200">{activePrescription.superset.label}{activePrescription.superset.instruction ? ` · ${activePrescription.superset.instruction}` : ""}</p>
                ) : null}
                {activePrescription?.trainerNote ? (
                  <p className="mt-4 border-l-2 border-lime-300/40 pl-3 text-sm text-zinc-300">{activePrescription.trainerNote}</p>
                ) : null}
                {activeExercise.athleteNote ? <p className="mt-3 text-sm text-zinc-500">Заметка спортсмена: {activeExercise.athleteNote}</p> : null}
                <div className="mt-5 divide-y divide-zinc-800 border-y border-zinc-800">
                  {activeExercise.sets.map((set) => (
                    <SetEditor
                      key={set.id}
                      set={set}
                      prescription={activePrescription?.sets.find((item) => (
                        set.sourceAssignmentSetId
                          ? item.assignmentSetId === set.sourceAssignmentSetId
                          : item.setKey === set.setKey
                      ))}
                      value={values[set.id] ?? initialValues(set)}
                      disabled={!executionCapabilities?.canEdit || busyKey !== null || completeOpen}
                      busy={busyKey === set.id}
                      commandState={setCommandStates[set.id]}
                      onChange={(next) => changeSetValue(set.id, next)}
                      onSave={(operation) => saveSet(activeExercise.id, set, operation)}
                      onReconcile={() => {
                        const attempt = setAttempts.current[set.id];
                        if (attempt) void reconcileSet(attempt);
                      }}
                      onRetry={() => {
                        const attempt = setAttempts.current[set.id];
                        if (attempt) void submitSetAttempt(attempt);
                      }}
                      onContinueAfterConflict={() => {
                        delete setAttempts.current[set.id];
                        setSetCommandStates((current) => ({ ...current, [set.id]: "editing" }));
                      }}
                    />
                  ))}
                </div>
                {session.exercises.length > 1 ? (
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={activeExerciseIndex <= 0}
                      onClick={() => setActiveExerciseId(session.exercises[activeExerciseIndex - 1].id)}
                      className="min-h-11 gap-2 rounded-lg border-zinc-800"
                    ><ArrowLeft className="size-4" /> Предыдущее</Button>
                    <span className="text-xs text-zinc-500">{activeExerciseIndex + 1} из {session.exercises.length}</span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={activeExerciseIndex >= session.exercises.length - 1}
                      onClick={() => setActiveExerciseId(session.exercises[activeExerciseIndex + 1].id)}
                      className="min-h-11 gap-2 rounded-lg border-zinc-800"
                    >Следующее <ArrowRight className="size-4" /></Button>
                  </div>
                ) : null}
              </section>
          </div>
        ) : null}

        {session?.status === "active" && executionCapabilities?.canEnterCompletionFlow ? (
          <footer className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t border-zinc-800 bg-black/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
            {unresolvedSetId ? <button type="button" onClick={returnToUnresolvedSet} className="min-h-11 text-left text-sm text-amber-200">Есть несохранённые результаты. К подходу</button>
              : <p className="text-sm text-zinc-500">Можно завершить с невыполненными подходами</p>}
            <Button ref={completionTrigger} onClick={() => setCompleteOpen(true)} disabled={busyKey !== null || Boolean(unresolvedSetId)} className="shrink-0 gap-2 rounded-lg bg-zinc-100 text-black hover:bg-white">
              <Check className="size-4" /> Завершить
            </Button>
          </footer>
        ) : null}

        {isTerminal ? (
          <div className="border-t border-zinc-800 py-8">
            <ClientFeedbackHistory feedback={feedback} loading={feedbackLoading} />
          </div>
        ) : null}
      </div>

      {session ? <CanonicalWorkoutCompletion session={session} open={completeOpen} onOpenChange={setCompleteOpen} onRead={setSession}
        onReturnFocus={() => completionTrigger.current?.focus()}
        onUnavailable={completionUnavailable}
        onCompleted={(persisted) => {
          setSession(persisted);
          setExecutionCapabilities({ canEdit: false, canSkip: false, canResume: false, canEnterCompletionFlow: false });
          setError(null);
        }} /> : null}
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
  prescription,
  value,
  disabled,
  busy,
  commandState,
  onChange,
  onSave,
  onReconcile,
  onRetry,
  onContinueAfterConflict,
}: {
  set: WorkoutSetLog;
  prescription?: ClientWorkoutSetPrescription;
  value: Values;
  disabled: boolean;
  busy: boolean;
  commandState?: SetCommandState;
  onChange: (value: Values) => void;
  onSave: (operation: ClientWorkoutSetOperation) => void;
  onReconcile: () => void;
  onRetry: () => void;
  onContinueAfterConflict: () => void;
}) {
  const saved = set.status !== "pending";
  const unresolved = commandState === "outcome_unknown" || commandState === "conflict";
  const frozenUnknown = commandState === "outcome_unknown";
  const showPrimaryCommands = commandState !== "save_failed" && !unresolved;
  const stateText = commandState ? setCommandText(commandState) : null;
  return (
    <div id={`workout-set-${set.id}`} tabIndex={-1} className="grid scroll-mt-24 gap-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-lime-300 lg:grid-cols-[8rem_minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="text-sm font-medium">Подход {set.position}</p>
        <p className="mt-1 text-xs text-zinc-500">План: {plannedResult(set, prescription)}</p>
        {saved ? (
          <p className={`mt-2 text-xs ${set.status === "completed" ? "text-lime-300" : "text-amber-300"}`}>
            {set.status === "completed" ? "Выполнен" : set.status === "skipped" ? "Пропущен" : "Не выполнен"}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {set.plannedDurationSeconds === null ? (
          <Field label="Повторы" value={value.repetitions} disabled={disabled || frozenUnknown} max="500" onChange={(repetitions) => onChange({ ...value, repetitions })} />
        ) : (
          <Field label="Секунды" value={value.duration} disabled={disabled || frozenUnknown} max="86400" onChange={(duration) => onChange({ ...value, duration })} />
        )}
        <Field label="Вес, кг" value={value.weight} disabled={disabled || frozenUnknown} max="2000" step="0.5" onChange={(weight) => onChange({ ...value, weight })} />
        <Field label="RPE" value={value.rpe} disabled={disabled || frozenUnknown} min="1" max="10" step="0.5" onChange={(rpe) => onChange({ ...value, rpe })} />
        <label className="col-span-2 text-xs text-zinc-500 sm:col-span-1">
          Комментарий
          <Input value={value.comment} disabled={disabled || frozenUnknown} maxLength={1000} onChange={(event) => onChange({ ...value, comment: event.target.value })} className="mt-1 h-11 rounded-lg border-zinc-800 bg-zinc-900/60" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(!disabled || busy) && showPrimaryCommands ? (
          <>
          <Button size="icon" variant="outline" onClick={() => onSave("skip")} disabled={disabled || unresolved} aria-label={`Пропустить подход ${set.position}`} title="Пропустить" className="min-h-11 min-w-11 rounded-lg border-zinc-800">
            <SkipForward className="size-4" />
          </Button>
          <Button onClick={() => onSave("save")} disabled={disabled || unresolved} className="min-h-11 gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить
          </Button>
          </>
        ) : null}
        {commandState === "outcome_unknown" ? (
          <Button type="button" variant="outline" onClick={onReconcile} disabled={busy} className="min-h-11 rounded-lg border-zinc-700">Проверить</Button>
        ) : null}
        {commandState === "save_failed" ? (
          <Button type="button" variant="outline" onClick={onRetry} disabled={busy} className="min-h-11 rounded-lg border-zinc-700">Повторить</Button>
        ) : null}
        {commandState === "conflict" ? (
          <Button type="button" variant="outline" onClick={onContinueAfterConflict} disabled={busy} className="min-h-11 rounded-lg border-zinc-700">Продолжить редактирование</Button>
        ) : null}
      </div>
      {stateText ? <p role={commandState === "save_failed" || unresolved ? "alert" : "status"} aria-live="polite" className={`text-sm lg:col-start-2 ${commandState === "saved" ? "text-lime-300" : commandState === "skipped" ? "text-amber-300" : commandState === "editing" ? "text-zinc-500" : "text-red-200"}`}>{stateText}</p> : null}
    </div>
  );
}

function Field({ label, value, disabled, min = "0", max, step = "1", onChange }: {
  label: string; value: string; disabled: boolean; min?: string; max?: string; step?: string; onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-zinc-500">
      {label}
      <Input type="number" min={min} max={max} step={step} inputMode="decimal" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 rounded-lg border-zinc-800 bg-zinc-900/60" />
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

function setCommandText(state: SetCommandState) {
  if (state === "editing") return "Есть несохранённые изменения.";
  if (state === "saving") return "Сохраняем подход…";
  if (state === "saved") return "Подход сохранён";
  if (state === "skipped") return "Подход отмечен как пропущенный";
  if (state === "save_failed") return "Не удалось сохранить подход. Введённые значения сохранены на экране.";
  if (state === "outcome_unknown") return "Не удалось подтвердить, сохранился ли подход.";
  return "Подход изменился в другой вкладке. Введённые значения оставлены на экране.";
}

function focusSet(setId: string) {
  requestAnimationFrame(() => document.getElementById(`workout-set-${setId}`)?.focus());
}

function DumbbellMark() {
  return <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-zinc-800 text-zinc-400"><Play className="size-5" /></div>;
}
