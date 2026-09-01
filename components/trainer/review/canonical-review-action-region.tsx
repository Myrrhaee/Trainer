"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Dumbbell, Loader2, MessageSquareText, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewFeedback, ReviewReadModel } from "@/lib/server/reviews/review-types";
import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";
import { cn } from "@/lib/utils";
import { quickAssignHref } from "@/lib/quick-assign-navigation";
import { createTrainerWorkflowContext } from "@/lib/trainer-workflow-transition";
import { shortId } from "./canonical-review-presentation";

type FeedbackMode = "detailed" | "acknowledgement";

type CommandResponse = { transition: TrainerWorkflowTransition };

const acknowledgements = [
  "Тренировку посмотрел. Результаты принял.",
  "Результаты вижу. Продолжаем по текущему плану.",
  "Тренировку принял. Отдельно вернусь с корректировками.",
] as const;

const manualReasons = [
  "Разобрано вне продукта",
  "Дублирующая задача",
  "Обратная связь не требуется",
  "Тестовая или ошибочная задача",
  "Другое",
] as const;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "request_failed");
  return body;
}

function errorText(code: string) {
  if (code === "review_already_resolved") return "Этот разбор уже закрыт в другой вкладке. Загружаем сохранённое решение.";
  if (code === "idempotency_conflict") return "Повтор команды не совпадает с исходным запросом. Проверьте текст и повторите действие.";
  if (code === "invalid_follow_up") return "Не удалось связать уточнение с исходным ответом.";
  return "Не удалось сохранить решение. Текст остался на экране.";
}

export function CanonicalReviewActionRegion({
  review,
  transition,
  transitionContext,
  onReload,
}: {
  review: ReviewReadModel;
  transition: TrainerWorkflowTransition;
  transitionContext: string;
  onReload: () => Promise<boolean>;
}) {
  const [mode, setMode] = useState<FeedbackMode>("detailed");
  const [draft, setDraft] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TrainerWorkflowTransition | null>(() => (
    review.attention.status === "resolved" && transition.result.kind !== "current" ? transition : null
  ));
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReason, setManualReason] = useState<(typeof manualReasons)[number]>(manualReasons[0]);
  const [customReason, setCustomReason] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [reloadFailed, setReloadFailed] = useState(false);
  const logicalRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const manualRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submittingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const manualErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (review.attention.status === "resolved") {
      setFollowUp(false);
      if (transition.result.kind !== "current") setReceipt(transition);
    }
  }, [review.attention.status, transition]);

  const latestFeedback = review.existingFeedback[review.existingFeedback.length - 1];
  const initialCommandAvailable = review.capabilities.canSendInitialFeedback
    || review.capabilities.canSendAcknowledgement;
  const canFollowUp = review.capabilities.canSendFollowUp && Boolean(latestFeedback);

  function updateDraft(value: string) {
    const nextFingerprint = commandFingerprint(mode, followUp, value, latestFeedback?.id);
    if (logicalRequestRef.current && logicalRequestRef.current.fingerprint !== nextFingerprint) {
      logicalRequestRef.current = null;
      setError(null);
    }
    setDraft(value);
  }

  async function send() {
    const body = draft.trim();
    const kind = followUp ? "follow_up" : mode;
    if (!body || submittingRef.current) return;
    if (kind === "detailed" && !review.capabilities.canSendInitialFeedback) return;
    if (kind === "acknowledgement" && !review.capabilities.canSendAcknowledgement) return;
    if (kind === "follow_up" && (!review.capabilities.canSendFollowUp || !latestFeedback)) return;

    const fingerprint = commandFingerprint(mode, followUp, body, latestFeedback?.id);
    const logical = logicalRequestRef.current?.fingerprint === fingerprint
      ? logicalRequestRef.current
      : { fingerprint, key: crypto.randomUUID() };
    logicalRequestRef.current = logical;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await requestJson<CommandResponse>(`/api/trainer/reviews/${review.session.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attentionItemId: review.attention.id,
          kind,
          body,
          followUpOfId: kind === "follow_up" ? latestFeedback.id : undefined,
          idempotencyKey: logical.key,
          transitionContext,
        }),
      });
      logicalRequestRef.current = null;
      setDraft("");
      setFollowUp(false);
      setReceipt(response.transition);
      if (!(await onReload())) setReloadFailed(true);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "request_failed";
      setError(errorText(code));
      window.setTimeout(() => errorRef.current?.focus(), 0);
      if (code === "review_already_resolved" && !(await onReload())) setReloadFailed(true);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function resolveManually() {
    const reason = manualReason === "Другое" ? customReason.trim() : manualReason;
    if (!reason || submittingRef.current || !review.capabilities.canResolveManually) return;
    const fingerprint = reason;
    const logical = manualRequestRef.current?.fingerprint === fingerprint
      ? manualRequestRef.current
      : { fingerprint, key: crypto.randomUUID() };
    manualRequestRef.current = logical;
    submittingRef.current = true;
    setSaving(true);
    setManualError(null);
    try {
      const response = await requestJson<CommandResponse>(`/api/trainer/reviews/${review.session.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attentionItemId: review.attention.id,
          reason,
          idempotencyKey: logical.key,
          transitionContext,
        }),
      });
      manualRequestRef.current = null;
      setManualOpen(false);
      setReceipt(response.transition);
      if (!(await onReload())) setReloadFailed(true);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "request_failed";
      setManualError(errorText(code));
      window.setTimeout(() => manualErrorRef.current?.focus(), 0);
      if (code === "review_already_resolved" && !(await onReload())) setReloadFailed(true);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  function changeManualReason(value: (typeof manualReasons)[number]) {
    const fingerprint = value === "Другое" ? customReason.trim() : value;
    if (manualRequestRef.current?.fingerprint !== fingerprint) manualRequestRef.current = null;
    setManualReason(value);
    setManualError(null);
  }

  function changeCustomReason(value: string) {
    if (manualRequestRef.current?.fingerprint !== value.trim()) manualRequestRef.current = null;
    setCustomReason(value);
    setManualError(null);
  }

  return (
    <section id="review-feedback" aria-labelledby="canonical-feedback-heading" className="scroll-mt-28 rounded-[8px] border border-zinc-800 bg-zinc-950/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-lime-200/70">Действие тренера</p>
          <h2 id="canonical-feedback-heading" className="mt-1 text-lg font-semibold text-zinc-50">Обратная связь</h2>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1.5 text-xs",
          review.attention.status === "open" ? "text-amber-200" : "text-lime-200",
        )}>
          {review.attention.status === "open" ? <MessageSquareText className="size-4" /> : <CheckCircle2 className="size-4" />}
          {review.attention.status === "open" ? "Открыто" : "Разбор закрыт"}
        </span>
      </div>

      {review.existingFeedback.length ? <CanonicalReviewFeedbackTimeline feedback={review.existingFeedback} /> : null}
      {review.attention.manualResolutionReason ? (
        <div className="mt-4 border-l-2 border-zinc-700 pl-3 text-sm text-zinc-400">
          <p>Закрыто без сообщения спортсмену</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-300">{review.attention.manualResolutionReason}</p>
        </div>
      ) : null}

      {receipt ? (
        <>
          <CanonicalReviewCompletionReceipt transition={receipt} review={review} reloadFailed={reloadFailed} />
          {canFollowUp ? (
            <Button type="button" variant="outline" onClick={() => { setReceipt(null); setFollowUp(true); setReloadFailed(false); }} className="mt-4 min-h-11 w-full rounded-[8px] border-zinc-800 bg-black/20 text-zinc-200">
              Добавить уточнение
            </Button>
          ) : null}
        </>
      ) : followUp ? (
        <CanonicalFeedbackComposer
          mode={mode}
          draft={draft}
          followUp
          saving={saving}
          error={error}
          errorRef={errorRef}
          onModeChange={setMode}
          onDraftChange={updateDraft}
          onSubmit={() => void send()}
          onCancel={() => { setFollowUp(false); setDraft(""); setError(null); logicalRequestRef.current = null; }}
        />
      ) : review.attention.status === "resolved" ? (
        canFollowUp ? (
          <Button type="button" variant="outline" onClick={() => { setReceipt(null); setFollowUp(true); }} className="mt-4 min-h-11 w-full rounded-[8px] border-zinc-800 bg-black/20 text-zinc-200">
            Добавить уточнение
          </Button>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Для этого разбора дополнительные действия недоступны.</p>
        )
      ) : initialCommandAvailable ? (
        <>
          <CanonicalFeedbackComposer
            mode={mode}
            draft={draft}
            followUp={false}
            saving={saving}
            error={error}
            errorRef={errorRef}
            onModeChange={(nextMode) => {
              setMode(nextMode);
              setDraft("");
              setError(null);
              logicalRequestRef.current = null;
            }}
            onDraftChange={updateDraft}
            onSubmit={() => void send()}
          />
          {review.capabilities.canResolveManually ? (
            <details className="mt-5 border-t border-zinc-800 pt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-zinc-500 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70">
                Дополнительные действия<ChevronDown className="size-4" />
              </summary>
              <Button type="button" variant="ghost" onClick={() => setManualOpen(true)} disabled={saving} className="mt-2 min-h-11 w-full rounded-[8px] text-zinc-400 hover:text-zinc-100">
                Закрыть без сообщения
              </Button>
            </details>
          ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-[8px] border border-zinc-800 p-3 text-sm text-zinc-400">Действия для этого разбора недоступны.</p>
      )}

      <Dialog open={manualOpen} onOpenChange={(open) => { setManualOpen(open); if (!open) setManualError(null); }}>
        <DialogContent className="max-w-lg rounded-[8px] border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>Закрыть разбор без сообщения?</DialogTitle>
            <DialogDescription>Спортсмен не получит обратную связь по этой тренировке. Причина сохранится в приватной истории тренера.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="canonical-manual-reason" className="mt-4 text-sm text-zinc-300">Причина *</Label>
          <select
            id="canonical-manual-reason"
            value={manualReason}
            onChange={(event) => changeManualReason(event.target.value as (typeof manualReasons)[number])}
            disabled={saving}
            className="mt-2 min-h-11 w-full rounded-[8px] border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
          >
            {manualReasons.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
          {manualReason === "Другое" ? (
            <Textarea
              aria-label="Своя причина"
              value={customReason}
              onChange={(event) => changeCustomReason(event.target.value)}
              disabled={saving}
              maxLength={1000}
              className="mt-3 min-h-24 rounded-[8px] border-zinc-800 bg-black/30"
            />
          ) : null}
          {manualError ? (
            <div ref={manualErrorRef} tabIndex={-1} role="alert" className="mt-3 border-l-2 border-red-400 pl-3 text-sm text-red-200 outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
              {manualError}
            </div>
          ) : null}
          <DialogFooter className="flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={saving} className="min-h-11 rounded-[8px] border-zinc-800">Продолжить разбор</Button>
            <Button type="button" onClick={() => void resolveManually()} disabled={saving || (manualReason === "Другое" && !customReason.trim())} className="min-h-11 rounded-[8px] bg-zinc-100 text-black hover:bg-white">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}Закрыть без сообщения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CanonicalFeedbackComposer({
  mode,
  draft,
  followUp,
  saving,
  error,
  errorRef,
  onModeChange,
  onDraftChange,
  onSubmit,
  onCancel,
}: {
  mode: FeedbackMode;
  draft: string;
  followUp: boolean;
  saving: boolean;
  error: string | null;
  errorRef: RefObject<HTMLDivElement | null>;
  onModeChange: (mode: FeedbackMode) => void;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const submitLabel = followUp ? "Отправить уточнение"
    : mode === "acknowledgement" ? "Подтвердить и закрыть разбор" : "Отправить ответ";
  return (
    <div className="mt-4">
      {!followUp ? (
        <div role="group" aria-label="Режим обратной связи" className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={mode === "detailed"} onClick={() => onModeChange("detailed")} disabled={saving} className={modeClass(mode === "detailed")}>Подробный ответ</button>
          <button type="button" aria-pressed={mode === "acknowledgement"} onClick={() => onModeChange("acknowledgement")} disabled={saving} className={modeClass(mode === "acknowledgement")}>Коротко подтвердить</button>
        </div>
      ) : null}
      {mode === "acknowledgement" && !followUp ? (
        <div className="mt-3 grid gap-2">
          {acknowledgements.map((value) => (
            <button key={value} type="button" onClick={() => onDraftChange(value)} disabled={saving} className="min-h-11 rounded-[8px] border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-60">{value}</button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex items-end justify-between gap-3">
        <Label htmlFor="canonical-review-feedback" className="text-sm text-zinc-300">{followUp ? "Текст уточнения" : "Сообщение спортсмену"}</Label>
        <span className="text-xs text-zinc-600" aria-live="polite">{draft.length}/5000</span>
      </div>
      <Textarea
        id="canonical-review-feedback"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        disabled={saving}
        maxLength={5000}
        placeholder="Напишите ответ на основе фактов тренировки"
        className="mt-2 min-h-36 resize-y rounded-[8px] border-zinc-800 bg-black/30 text-zinc-100"
      />
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-3 border-l-2 border-red-400 pl-3 text-sm text-red-200 outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
          <p>{error}</p>
          <p className="mt-1 text-xs text-red-200/75">Повтор использует тот же ключ, пока текст не изменён.</p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        <Button type="button" onClick={onSubmit} disabled={!draft.trim() || saving} className="min-h-11 w-full rounded-[8px] bg-lime-300 text-black hover:bg-lime-200">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {saving ? "Сохраняем" : error ? "Повторить сохранение" : submitLabel}
        </Button>
        {followUp && onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-11 rounded-[8px] border-zinc-800">Отмена</Button> : null}
      </div>
    </div>
  );
}

export function CanonicalReviewFeedbackTimeline({ feedback }: { feedback: ReviewFeedback[] }) {
  return (
    <section aria-labelledby="review-feedback-timeline-heading" className="mt-4">
      <h3 id="review-feedback-timeline-heading" className="text-sm font-medium text-zinc-300">Сохранённая переписка</h3>
      <div className="mt-2 divide-y divide-zinc-800 border-y border-zinc-800">
        {feedback.map((item) => <FeedbackEntry key={item.id} feedback={item} />)}
      </div>
    </section>
  );
}

function FeedbackEntry({ feedback }: { feedback: ReviewFeedback }) {
  const label = feedback.kind === "follow_up" ? "Уточнение"
    : feedback.kind === "acknowledgement" ? "Короткое подтверждение" : "Ответ тренера";
  const time = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(feedback.sentAt));
  return (
    <article className="py-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
        <span>{label} · {shortId(feedback.id)}</span><span>{feedback.author} · {time}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{feedback.body}</p>
      {feedback.followUpOfId ? <p className="mt-2 text-xs text-zinc-600">Уточнение к ответу {shortId(feedback.followUpOfId)}</p> : null}
    </article>
  );
}

export function CanonicalReviewCompletionReceipt({
  transition,
  review,
  reloadFailed = false,
}: {
  transition: TrainerWorkflowTransition;
  review: ReviewReadModel;
  reloadFailed?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const manual = transition.result.kind === "manual_resolution";
  const followUp = transition.result.kind === "review"
    && (transition.result.title === "Уточнение сохранено"
      || review.existingFeedback.some((item) => item.id === transition.result.entityId && item.kind === "follow_up"));
  const assignHref = quickAssignHref({
    athleteUserId: review.athlete.id,
    context: createTrainerWorkflowContext({
      origin: "review",
      athleteUserId: review.athlete.id,
      sourceSessionId: review.session.id,
      queue: transition.context.queue,
      returnTo: `/trainer/review/${review.session.id}`,
      returnAnchor: "next-assignment",
    }),
  });
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [transition.result.entityId]);
  return (
    <div id="workflow-receipt" role="status" aria-live="polite" className="mt-4 border-t border-zinc-800 pt-4">
      <h3 id="review-completion-receipt-heading" ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-base font-semibold text-lime-100 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70">
        <CheckCircle2 className="size-5" />
        {manual ? "Разбор закрыт без сообщения спортсмену" : followUp ? "Уточнение сохранено" : "Обратная связь сохранена"}
      </h3>
      <p className="mt-2 text-sm text-zinc-300">{transition.result.detail}</p>
      <p className="mt-1 text-xs font-mono text-zinc-500">ID {shortId(transition.result.entityId)}</p>
      {!followUp && !manual ? <p className="mt-3 text-sm text-zinc-300">Задача разбора закрыта. Спортсмен увидит ответ в кабинете.</p> : null}
      {followUp ? <p className="mt-3 text-sm text-zinc-300">Уточнение добавлено к закрытому разбору. Задача повторно не открывалась.</p> : null}
      {manual ? <p className="mt-3 text-sm text-zinc-300">Сообщение спортсмену не отправлялось.</p> : (
        <p className="mt-2 text-xs text-zinc-500">{transition.result.deliveryWarning ?? "Статус доставки уведомления недоступен"}</p>
      )}
      {transition.refreshWarning || reloadFailed ? <p className="mt-3 text-sm text-amber-200">Решение сохранено, но очередь не удалось обновить.</p> : null}
      <div className="mt-4 grid gap-2 text-sm">
        {transition.nextItem ? (
          <Link href={transition.nextItem.href} className="inline-flex min-h-11 items-center rounded-[8px] bg-lime-300 px-3 font-medium text-black hover:bg-lime-200">
            Следующее действие: {transition.nextItem.athleteDisplayName}
          </Link>
        ) : transition.allCalm ? (
          <Link href="/trainer/clients" className="inline-flex min-h-11 items-center rounded-[8px] border border-lime-300/25 px-3 text-lime-100 hover:border-lime-300/40">В очереди всё спокойно · к спортсменам</Link>
        ) : null}
        <Link href={assignHref} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-zinc-700 px-3 text-zinc-200 hover:border-zinc-600 hover:text-white">
          <Dumbbell className="size-4" />Назначить следующую тренировку
        </Link>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href={transition.profileHref} className="inline-flex min-h-11 items-center text-zinc-300 hover:text-white">К профилю</Link>
          <Link href={transition.queueHref} className="inline-flex min-h-11 items-center text-zinc-300 hover:text-white">К очереди</Link>
        </div>
      </div>
    </div>
  );
}

function commandFingerprint(mode: FeedbackMode, followUp: boolean, body: string, feedbackId?: string) {
  return `${followUp ? "follow_up" : mode}:${feedbackId ?? "initial"}:${body.trim()}`;
}

function modeClass(active: boolean) {
  return cn(
    "min-h-11 rounded-[8px] border px-3 py-2 text-sm transition disabled:opacity-60",
    active
      ? "border-lime-300/35 bg-lime-300/10 text-lime-100"
      : "border-zinc-800 bg-black/20 text-zinc-400 hover:text-zinc-200",
  );
}
