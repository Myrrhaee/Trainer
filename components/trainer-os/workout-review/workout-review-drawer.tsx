"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { ReviewFeedbackPanel } from "./review-feedback-panel";
import { getWorkoutReviewDetails, toReviewTeamClient } from "./review-model";
import { ReviewClientComment, ReviewExerciseList, ReviewSessionSummary, ReviewSignals } from "./review-shared";
import { useReviewWorkflow } from "./review-store";

type WorkoutReviewDrawerProps = {
  sessionId: string | null;
  open: boolean;
  source: "dashboard" | "profile";
  attentionItemId?: string;
  onOpenChange: (open: boolean) => void;
  onResolved?: (athleteId: string, kind: "feedback" | "manual") => void;
  onAssignNext?: (client: ReturnType<typeof toReviewTeamClient>) => void;
};

export function WorkoutReviewDrawer(props: WorkoutReviewDrawerProps) {
  const review = props.sessionId ? getWorkoutReviewDetails(props.sessionId) : null;
  return review ? <KnownReviewDrawer {...props} review={review} /> : <UnknownReviewDrawer {...props} />;
}

function KnownReviewDrawer({ review, open, source, attentionItemId, onOpenChange, onResolved, onAssignNext }: WorkoutReviewDrawerProps & { review: NonNullable<ReturnType<typeof getWorkoutReviewDetails>> }) {
  const workflow = useReviewWorkflow(review);
  const [discardOpen, setDiscardOpen] = useState(false);
  const teamClient = toReviewTeamClient(review);
  const hasUnsavedDraft = Boolean(workflow.state.draft.trim()) && workflow.state.saveStatus !== "saving";
  const fullReviewHref = `/trainer/review/${review.session.id}?from=${source}${attentionItemId ? `&attentionItem=${encodeURIComponent(attentionItemId)}` : ""}`;

  function requestClose() {
    if (hasUnsavedDraft && !workflow.state.resolution) setDiscardOpen(true);
    else onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) onOpenChange(true);
    else requestClose();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="!w-[calc(100vw-12px)] !max-w-[920px] gap-0 border-zinc-800 bg-[#070707] p-0 text-zinc-100">
        <SheetHeader className="border-b border-zinc-800/80 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3 pr-10">
          <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-semibold">{review.athlete.initials}</div>
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg font-semibold text-zinc-50">{review.athlete.displayName}</SheetTitle>
            <SheetDescription className="truncate text-zinc-500">{review.sessionTitle} · {review.session.completedLabel}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-28 sm:p-4 sm:pb-28">
        <div className="mx-auto grid max-w-3xl gap-4">
          <ReviewSessionSummary review={review} compact />
          <ReviewSignals signals={review.signals} limit={3} />
          <ReviewClientComment comment={review.clientComment} />
          <ReviewExerciseList exercises={review.exercises} compact />
          <ReviewFeedbackPanel review={review} compact onResolved={(kind) => onResolved?.(review.athlete.id, kind)} onAssign={onAssignNext ? () => onAssignNext(teamClient) : undefined} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-zinc-800/80 bg-zinc-950/98 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-3xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" onClick={requestClose} variant="ghost" className="min-h-11 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">Закрыть</Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
              <Link href={`${review.athlete.profileHref}?from=review`}><UserRound className="size-4" />Профиль</Link>
            </Button>
            <Button asChild className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
              <Link href={fullReviewHref}>Открыть подробный разбор<ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </div>
      </div>

        <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950">
            <DialogHeader><DialogTitle>Закрыть с несохранённым текстом?</DialogTitle><DialogDescription>Черновик останется доступен при повторном открытии в текущей browser session, но сообщение ещё не отправлено.</DialogDescription></DialogHeader>
            <DialogFooter className="flex-col sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)} className="rounded-full border-zinc-700">Продолжить редактирование</Button>
              <Button type="button" onClick={() => { setDiscardOpen(false); onOpenChange(false); }} className="rounded-full bg-zinc-100 text-black hover:bg-white">Закрыть drawer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function UnknownReviewDrawer({ open, onOpenChange }: WorkoutReviewDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!w-[calc(100vw-12px)] !max-w-[920px] border-zinc-800 bg-[#070707] text-zinc-100">
        <div className="flex min-h-full items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <SheetTitle className="text-xl font-semibold text-zinc-50">Сессия не найдена</SheetTitle>
            <SheetDescription className="mt-2 text-zinc-500">Drawer не подставил данные другого спортсмена. Вернитесь к очереди и откройте доступную тренировку.</SheetDescription>
            <Button asChild className="mt-5 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Link href="/trainer/dashboard">К очереди</Link></Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
