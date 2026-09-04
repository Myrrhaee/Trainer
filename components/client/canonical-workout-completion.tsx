"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CompletionValidationError, createCompletionAttempt, reconcileCompletion, type CompletionAttempt } from "@/lib/client-workout-completion-command";
import type { ClientWorkoutExecutionReadModel } from "@/lib/server/client-workouts/client-workout-types";
import type { WorkoutSession } from "@/lib/server/workout-sessions/workout-session-types";

type State = "loading" | "ready" | "sending" | "failed" | "unknown" | "conflict";
class ExactReadError extends Error {
  constructor(readonly status: number) { super("exact_read_failed"); }
}

async function exactRead(sessionId: string, attempt?: CompletionAttempt) {
  const query = new URLSearchParams({ sessionId });
  if (attempt) {
    query.set("completionCommandId", attempt.commandId);
    query.set("completionFingerprint", attempt.fingerprint);
  }
  const response = await fetch(`/api/client/workouts?${query}`, { cache: "no-store" });
  if (!response.ok) throw new ExactReadError(response.status);
  const body = await response.json() as { execution: ClientWorkoutExecutionReadModel };
  if (!body.execution.session || body.execution.session.id !== sessionId) throw new Error("identity_changed");
  return body.execution.session;
}

export function CanonicalWorkoutCompletion({ session, open, onOpenChange, onCompleted, onRead, onUnavailable, onReturnFocus }: {
  session: WorkoutSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (session: WorkoutSession) => void;
  onRead: (session: WorkoutSession) => void;
  onUnavailable: () => void;
  onReturnFocus: () => void;
}) {
  const [basis, setBasis] = useState(session);
  const [state, setState] = useState<State>("loading");
  const [overall, setOverall] = useState("");
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [discomfort, setDiscomfort] = useState("");
  const [zeroConfirmed, setZeroConfirmed] = useState(false);
  const [zeroReason, setZeroReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState<WorkoutSession | null>(null);
  const [canReconfirm, setCanReconfirm] = useState(false);
  const attempt = useRef<CompletionAttempt | null>(null);
  const busy = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const overallRef = useRef<HTMLTextAreaElement>(null);
  const discomfortRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const zeroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || attempt.current) return;
    let cancelled = false;
    setState("loading");
    setError(null);
    void exactRead(session.id).then((current) => {
      if (cancelled) return;
      setBasis(current);
      if (current.status === "active") onRead(current);
      if (current.status !== "active") { setElsewhere(current); setState("conflict"); }
      else setState("ready");
    }).catch((caught) => { if (!cancelled) {
      if (caught instanceof ExactReadError && [401, 403, 404].includes(caught.status)) onUnavailable();
      else { setState("failed"); setError("Не удалось получить сохранённые результаты. Откройте завершение ещё раз."); }
    } });
    return () => { cancelled = true; };
  }, [open, session.id, onRead, onUnavailable]);

  useEffect(() => {
    if (state === "unknown" || state === "conflict") statusRef.current?.focus();
  }, [state]);

  const sets = basis.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.status === "completed").length;
  const skipped = sets.filter((set) => set.status === "skipped").length;
  const incomplete = sets.filter((set) => set.status === "incomplete").length;
  const pending = sets.filter((set) => set.status === "pending").length;
  const frozen = state === "loading" || state === "sending" || state === "unknown" || state === "conflict";

  function succeed(current: WorkoutSession) {
    attempt.current = null;
    setOverall(""); setDiscomfort(""); setZeroReason("");
    onCompleted(current);
    onOpenChange(false);
  }

  async function submit(current: CompletionAttempt) {
    setState("sending"); setError(null); setCanReconfirm(false);
    try {
      const response = await fetch(`/api/workout-sessions/${current.sessionId}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current.frozenPayload),
      });
      if (response.ok) {
        const body = await response.json() as { session: WorkoutSession };
        if (body.session.id !== current.sessionId || body.session.assignmentId !== current.assignmentId
          || !body.session.completedAt || !body.session.completion?.reviewQueued) throw new Error("unconfirmed_response");
        succeed(body.session);
      } else if ([401, 403, 404].includes(response.status)) {
        onUnavailable();
      } else if (response.status >= 500) {
        setState("unknown"); setError("Не удалось подтвердить завершение тренировки.");
      } else if (response.status === 409) {
        setState("conflict"); setError("Результаты тренировки изменились. Проверьте сохранённое состояние.");
      } else {
        setState("failed"); setError("Не удалось завершить тренировку. Проверьте поля и повторите.");
      }
    } catch {
      setState("unknown"); setError("Не удалось подтвердить завершение тренировки.");
    }
  }

  async function confirm() {
    if (busy.current || frozen || (state === "failed" && !attempt.current)) return;
    setInvalidField(null); setError(null);
    if (completed === 0 && !zeroConfirmed) {
      setInvalidField("zeroResultConfirmed"); setError("Подтвердите завершение без выполненных подходов."); zeroRef.current?.focus(); return;
    }
    busy.current = true;
    setState("sending");
    try {
      const candidate = await createCompletionAttempt(basis, { overallComment: overall,
        discomfortReported: answer, discomfortComment: discomfort, zeroResultConfirmed: zeroConfirmed, zeroResultReason: zeroReason });
      const current = attempt.current?.fingerprint === candidate.fingerprint ? attempt.current : candidate;
      attempt.current = current;
      await submit(current);
    } catch (caught) {
      setState("ready");
      if (caught instanceof CompletionValidationError) {
        setInvalidField(caught.message);
        setError(caught.message === "discomfortReported" ? "Выберите «Да» или «Нет»."
          : caught.message === "discomfortComment" ? "Опишите, что почувствовали: от 1 до 1000 символов."
            : "Проверьте длину комментария: общий до 2000, причина до 1000 символов.");
        window.setTimeout(() => {
          if (caught.message === "discomfortReported") answerRef.current?.focus();
          else if (caught.message === "discomfortComment") discomfortRef.current?.focus();
          else overallRef.current?.focus();
        }, 0);
      } else { setError("Не удалось подготовить завершение. Попробуйте ещё раз."); }
    } finally { busy.current = false; }
  }

  async function check() {
    const current = attempt.current;
    if (!current || busy.current) return;
    busy.current = true; setState("sending");
    try {
      const persisted = await exactRead(current.sessionId, current);
      const result = reconcileCompletion(current, persisted);
      if (result === "success" || result === "already_completed") succeed(persisted);
      else if (result === "replay") await submit(current);
      else {
        setBasis(persisted); setState("conflict");
        if (persisted.status !== "active") { setElsewhere(persisted); setError("Тренировка уже завершена другим действием. Ваш текст не перезаписал сохранённый результат."); }
        else { onRead(persisted); setCanReconfirm(true); setError("Результаты тренировки изменились. Нужно заново подтвердить текущие результаты."); }
      }
    } catch (caught) {
      if (caught instanceof ExactReadError && [401, 403, 404].includes(caught.status)) onUnavailable();
      else { setState("unknown"); setError("Не удалось подтвердить завершение тренировки."); }
    }
    finally { busy.current = false; }
  }

  return <Dialog open={open} onOpenChange={(next) => { if (state !== "sending" && state !== "unknown") onOpenChange(next); }}>
    <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus(); }} style={{ width: "calc(100vw - 2rem)", maxWidth: 560 }} className="grid max-h-[90dvh] gap-3 overflow-y-auto rounded-lg p-5">
      <DialogHeader><DialogTitle>Завершить тренировку</DialogTitle>
        <DialogDescription className="break-words">{basis.title}</DialogDescription></DialogHeader>
      {state === "loading" ? <p role="status">Проверяем сохранённые результаты…</p> : <>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm" aria-label="Сохранённые результаты">
          <dt>С результатом</dt><dd>{completed} из {sets.length} подходов</dd>
          <dt>Пропущено</dt><dd>{skipped}</dd><dt>Неполные</dt><dd>{incomplete}</dd><dt>Не записано</dt><dd>{pending}</dd>
        </dl>
        {completed !== sets.length ? <p className="text-sm text-zinc-400">Не все результаты заполнены. Тренировку можно завершить с пропусками.</p> : null}
        {completed === 0 ? <div className="grid gap-2">
          <label className="flex min-h-11 items-center gap-3 text-sm"><input ref={zeroRef} type="checkbox" checked={zeroConfirmed} disabled={frozen}
            aria-invalid={invalidField === "zeroResultConfirmed"} aria-describedby="completion-status"
            onChange={(event) => setZeroConfirmed(event.target.checked)} />Подтверждаю завершение без выполненных подходов</label>
          <label htmlFor="completion-zero" className="text-sm">Причина (необязательно)</label>
          <Textarea id="completion-zero" value={zeroReason} disabled={frozen} onChange={(event) => setZeroReason(event.target.value)} />
        </div> : null}
        <div className="grid gap-2"><label htmlFor="completion-overall" className="text-sm">Комментарий тренеру (необязательно)</label>
          <Textarea id="completion-overall" ref={overallRef} value={overall} disabled={frozen} aria-invalid={invalidField === "overallComment"}
            aria-describedby="completion-status" onChange={(event) => { setOverall(event.target.value); if (invalidField === "overallComment") { setInvalidField(null); setError(null); } }} /></div>
        <fieldset disabled={frozen} className="min-w-0" aria-invalid={invalidField === "discomfortReported"} aria-describedby="completion-status"><legend className="text-sm">Был ли дискомфорт во время тренировки?</legend>
          <div className="flex gap-8">{[false, true].map((value) => <label key={String(value)} className="flex min-h-11 items-center gap-2">
            <input ref={value ? undefined : answerRef} type="radio" name="completion-discomfort" value={String(value)} required checked={answer === value}
              aria-describedby="completion-status" onChange={() => { setAnswer(value); setInvalidField(null); setError(null); }} />{value ? "Да" : "Нет"}</label>)}</div>
        </fieldset>
        {answer === true ? <div className="grid gap-2"><label htmlFor="completion-discomfort-comment" className="text-sm">Опишите, что почувствовали</label>
          <Textarea id="completion-discomfort-comment" ref={discomfortRef} required value={discomfort} disabled={frozen}
            aria-invalid={invalidField === "discomfortComment"} aria-describedby="completion-status" onChange={(event) => { setDiscomfort(event.target.value); if (invalidField === "discomfortComment") { setInvalidField(null); setError(null); } }} /></div> : null}
      </>}
      <p id="completion-status" ref={statusRef} tabIndex={-1} role="status" className="break-words text-sm text-amber-200 outline-none">
        {state === "sending" ? "Завершаем…" : error}</p>
      {elsewhere ? <div className="grid gap-2 border-t border-zinc-700 pt-3 text-sm">
        <p>Сохранённый комментарий: {elsewhere.completion?.overallComment ?? "не указан"}</p>
        <p className="whitespace-pre-wrap break-words">{elsewhere.completion?.discomfortComment}</p>
        <Button variant="outline" onClick={() => succeed(elsewhere)}>Посмотреть сохранённый результат</Button>
      </div> : state === "unknown" || state === "conflict" ? <>
        <Button className="min-h-11 bg-zinc-100 text-black hover:bg-white" onClick={() => void check()}>Проверить завершение</Button>
        {state === "conflict" && canReconfirm && basis.status === "active" ? <Button variant="outline" className="min-h-11" onClick={() => { attempt.current = null; setCanReconfirm(false); setState("ready"); setError(null); }}>Подтвердить текущие результаты</Button> : null}
      </> : <Button className="min-h-11 bg-zinc-100 text-black hover:bg-white" disabled={frozen || (state === "failed" && !attempt.current)} onClick={() => void confirm()}>Завершить тренировку</Button>}
      <Button variant="ghost" className="min-h-11" disabled={state === "sending" || state === "unknown"} onClick={() => onOpenChange(false)}>Вернуться к тренировке</Button>
    </DialogContent>
  </Dialog>;
}

export function WorkoutCompletionReceipt({ session }: { session: WorkoutSession }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [session.id]);
  return <section aria-labelledby="completion-receipt-heading" className="grid gap-3 border-y border-zinc-800 py-6" role="status">
    <h2 id="completion-receipt-heading" ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-lime-300">Тренировка завершена</h2>
    <p className="break-words">{session.title}</p>
    {session.completedAt ? <time dateTime={session.completedAt}>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: session.clientTimezone }).format(new Date(session.completedAt))}</time> : null}
    <p>Результат сохранён</p>
    {session.completion?.reviewQueued ? <p>Тренировка отправлена тренеру на разбор</p> : null}
    {session.completion?.discomfortReported === true ? <p>Комментарий о дискомфорте сохранён и будет виден тренеру.</p> : null}
    <div className="flex flex-wrap gap-3"><Button asChild className="min-h-11"><Link href="/client/me">На главную</Link></Button>
      <Button asChild variant="outline" className="min-h-11"><Link href="/client/workouts">К тренировкам</Link></Button></div>
  </section>;
}
