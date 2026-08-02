"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { WorkoutReviewDetails } from "./review-model";
import { useReviewWorkflow } from "./review-store";

const acknowledgements = [
  "Посмотрел, всё в порядке. Продолжаем по плану.",
  "Тренировку принял. Вернусь с корректировками отдельно.",
  "Результаты вижу. Хорошая работа.",
];

const manualReasons = ["Разобрано вне продукта", "Дублирующая задача", "Feedback не требуется", "Тестовая или ошибочная задача", "Другое"];

export function ReviewFeedbackPanel({
  review,
  compact = false,
  onResolved,
  onAssign,
}: {
  review: WorkoutReviewDetails;
  compact?: boolean;
  onResolved?: (kind: "feedback" | "manual") => void;
  onAssign?: () => void;
}) {
  const workflow = useReviewWorkflow(review);
  const { state } = workflow;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReason, setManualReason] = useState(manualReasons[0]);
  const [customReason, setCustomReason] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const isResolved = Boolean(state.resolution);
  const canCompose = !isResolved || followUp;
  const isSaving = state.saveStatus === "saving";

  async function send() {
    const sent = await workflow.send(followUp ? "follow-up" : state.mode);
    if (sent) {
      setFollowUp(false);
      onResolved?.("feedback");
    }
  }

  async function closeManually() {
    const reason = manualReason === "Другое" ? customReason : manualReason;
    const resolved = await workflow.resolveManually(reason);
    if (resolved) {
      setManualOpen(false);
      onResolved?.("manual");
    }
  }

  return (
    <section aria-labelledby={`feedback-heading-${review.session.id}`} className="rounded-lg border border-zinc-800 bg-zinc-950/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-lime-200/70">Действие тренера</p>
          <h2 id={`feedback-heading-${review.session.id}`} className="mt-1 text-lg font-semibold text-zinc-50">Обратная связь</h2>
        </div>
        {isResolved ? <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-xs text-lime-100"><CheckCircle2 className="size-3.5" />Задача закрыта</span> : null}
      </div>

      {state.feedback.length ? (
        <div aria-live="polite" className="mt-4 grid gap-2">
          {state.feedback.map((record) => (
            <article key={record.id} className="rounded-lg border border-zinc-800 bg-black/25 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{record.kind === "follow-up" ? "Уточнение" : record.kind === "acknowledgement" ? "Короткое подтверждение" : "Подробный ответ"}</span>
                <span>{record.author} · {record.sentAt}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{record.body}</p>
            </article>
          ))}
        </div>
      ) : null}

      {isResolved && !followUp ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {state.resolution?.kind === "manual" ? <p className="rounded-lg border border-zinc-800 bg-black/25 p-3 text-sm text-zinc-400">Закрыто без сообщения: {state.resolution.reason}</p> : null}
          <Button type="button" variant="outline" onClick={() => setFollowUp(true)} className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">Добавить уточнение</Button>
          {onAssign ? <Button type="button" onClick={onAssign} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Назначить следующую</Button> : null}
        </div>
      ) : null}

      {canCompose ? (
        <>
          {!followUp ? (
            <div role="group" aria-label="Режим обратной связи" className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={state.mode === "detailed"} onClick={() => workflow.setMode("detailed")} disabled={isSaving} className={modeClass(state.mode === "detailed")}>Подробный ответ</button>
              <button type="button" aria-pressed={state.mode === "acknowledgement"} onClick={() => workflow.setMode("acknowledgement")} disabled={isSaving} className={modeClass(state.mode === "acknowledgement")}>Коротко подтвердить</button>
            </div>
          ) : null}

          {state.mode === "acknowledgement" && !followUp ? (
            <div className="mt-3 grid gap-2">
              {acknowledgements.map((text) => (
                <button key={text} type="button" onClick={() => workflow.setDraft(text)} disabled={isSaving} className="min-h-11 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60 disabled:cursor-not-allowed disabled:opacity-60">{text}</button>
              ))}
            </div>
          ) : null}

          {!followUp ? <AiDraft review={review} status={state.aiStatus} onUse={workflow.useAiDraft} disabled={isSaving} /> : null}

          <Label htmlFor={`review-feedback-${review.session.id}`} className="mt-4 block text-sm text-zinc-300">{followUp ? "Текст уточнения" : "Сообщение клиенту"}</Label>
          <Textarea id={`review-feedback-${review.session.id}`} value={state.draft} onChange={(event) => workflow.setDraft(event.target.value)} disabled={isSaving} placeholder="Напишите ответ на основе фактов тренировки" className={cn("mt-2 resize-y rounded-lg border-zinc-800 bg-black/30 text-zinc-100", compact ? "min-h-28" : "min-h-40")} />

          {state.saveError ? <div role="alert" className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm text-rose-100">{state.saveError}</div> : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={send} disabled={!state.draft.trim() || isSaving} aria-busy={isSaving} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isSaving ? "Отправляем…" : state.saveStatus === "failed" ? "Повторить отправку" : followUp ? "Отправить уточнение" : "Отправить"}
            </Button>
            {followUp ? (
              <Button type="button" variant="outline" onClick={() => { setFollowUp(false); workflow.setDraft(""); }} disabled={isSaving} className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">Отмена</Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setManualOpen(true)} className="min-h-11 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">Закрыть без сообщения</Button>
            )}
          </div>
        </>
      ) : null}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>Закрыть без сообщения?</DialogTitle>
            <DialogDescription>Сообщение клиенту не будет отправлено. Причина останется в истории разбора.</DialogDescription>
          </DialogHeader>
          <Label htmlFor={`manual-reason-${review.session.id}`} className="mt-4 text-sm text-zinc-300">Причина</Label>
          <select id={`manual-reason-${review.session.id}`} value={manualReason} onChange={(event) => setManualReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60">
            {manualReasons.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
          {manualReason === "Другое" ? <Textarea aria-label="Своя причина" value={customReason} onChange={(event) => setCustomReason(event.target.value)} className="mt-3 min-h-24 rounded-lg border-zinc-800 bg-black/30" /> : null}
          <DialogFooter className="flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)} className="rounded-full border-zinc-700 bg-black/20">Продолжить разбор</Button>
            <Button type="button" onClick={closeManually} disabled={state.saveStatus === "saving" || (manualReason === "Другое" && !customReason.trim())} className="rounded-full bg-zinc-100 text-black hover:bg-white">Подтвердить закрытие</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AiDraft({ review, status, onUse, disabled }: { review: WorkoutReviewDetails; status: ReturnType<typeof useReviewWorkflow>["state"]["aiStatus"]; onUse: () => Promise<void>; disabled: boolean }) {
  if (review.feedback.aiState === "unavailable" || review.feedback.aiState === "no-context") {
    return <p className="mt-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-500">AI-черновик недоступен. Можно написать ответ вручную.</p>;
  }
  if (review.feedback.aiState === "failed" || status === "failed") {
    return <p role="status" className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-sm text-amber-100">AI-черновик не сформирован. Можно продолжить вручную.</p>;
  }
  return (
    <div className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-100"><Sparkles className="size-4" />AI-черновик</p>
          <p className="mt-1 text-xs text-zinc-500">{review.feedback.aiProvenance}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onUse} disabled={disabled || status === "generating"} className="min-h-11 rounded-full border-violet-300/20 bg-black/20 text-violet-100 hover:bg-violet-300/10">
          {status === "generating" ? <Loader2 className="size-4 animate-spin" /> : null}{status === "generating" ? "Формируется" : "Использовать"}
        </Button>
      </div>
    </div>
  );
}

function modeClass(active: boolean) {
  return cn("min-h-11 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60 disabled:cursor-not-allowed disabled:opacity-60", active ? "border-lime-300/35 bg-lime-300/10 text-lime-100" : "border-zinc-800 bg-black/20 text-zinc-400 hover:text-zinc-200");
}
