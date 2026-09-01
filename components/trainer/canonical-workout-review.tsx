"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import type { ReviewReadModel } from "@/lib/server/reviews/review-types";
import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";
import { CanonicalReviewActionRegion } from "./review/canonical-review-action-region";
import { CanonicalReviewContextHeader, CanonicalReviewEvidence } from "./review/canonical-review-evidence";

type ReviewResponse = {
  review: ReviewReadModel;
  transition: TrainerWorkflowTransition;
};

class ReviewRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function fetchReview(sessionId: string, transitionContext: string) {
  const params = new URLSearchParams({ flow: transitionContext });
  const response = await fetch(`/api/trainer/reviews/${sessionId}?${params.toString()}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({})) as Partial<ReviewResponse> & { error?: string };
  if (!response.ok || !body.review || !body.transition) {
    throw new ReviewRequestError(response.status, body.error ?? "request_failed");
  }
  return body as ReviewResponse;
}

export function CanonicalWorkoutReview({ sessionId, transitionContext }: {
  sessionId: string;
  transitionContext: string;
}) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ status: number; message: string } | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const next = await fetchReview(sessionId, transitionContext);
      setData(next);
      setFailure(null);
      return true;
    } catch (caught) {
      if (showLoading) {
        setData(null);
        setFailure(caught instanceof ReviewRequestError
          ? { status: caught.status, message: caught.message }
          : { status: 0, message: "request_failed" });
      }
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [sessionId, transitionContext]);

  useEffect(() => { void load(); }, [load]);

  const review = data?.review ?? null;
  return (
    <TrainerShell
      eyebrow="Разбор тренировки"
      title={review ? review.session.title : "Разбор тренировки"}
      description={review ? `${review.athlete.displayName} · подтверждённые факты завершённой сессии` : "Загрузка фактов завершённой сессии"}
    >
      {loading ? <CanonicalReviewLoading /> : failure || !data ? (
        <CanonicalReviewUnavailable failure={failure} onRetry={() => void load()} />
      ) : (
        <div className="mx-auto w-full max-w-[1320px] pb-8">
          <nav aria-label="Быстрые переходы по разбору" className="sr-only focus-within:not-sr-only focus-within:mb-3">
            <div className="flex flex-wrap gap-2">
              <a href="#review-exceptions" className="inline-flex min-h-11 items-center rounded-[8px] border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100">К исключениям</a>
              <a href="#review-results" className="inline-flex min-h-11 items-center rounded-[8px] border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100">К результатам</a>
              <a href="#review-feedback" className="inline-flex min-h-11 items-center rounded-[8px] border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100">К обратной связи</a>
            </div>
          </nav>
          <CanonicalReviewContextHeader review={data.review} transition={data.transition} />
          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <CanonicalReviewEvidence review={data.review} />
            <aside data-review-action-column className="min-w-0 xl:sticky xl:top-28 [@media(max-height:800px)]:static">
              <CanonicalReviewActionRegion
                review={data.review}
                transition={data.transition}
                transitionContext={transitionContext}
                onReload={() => load(false)}
              />
            </aside>
          </div>
        </div>
      )}
    </TrainerShell>
  );
}

function CanonicalReviewLoading() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-[1320px]">
      <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Загружаем разбор тренировки
      </p>
      <div aria-hidden="true" className="mt-4 grid animate-pulse gap-5 motion-reduce:animate-none xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <div className="h-24 rounded-[8px] bg-zinc-900" />
          <div className="h-32 rounded-[8px] bg-zinc-900" />
          <div className="h-56 rounded-[8px] bg-zinc-900" />
        </div>
        <div className="h-80 rounded-[8px] bg-zinc-900" />
      </div>
    </div>
  );
}

function CanonicalReviewUnavailable({
  failure,
  onRetry,
}: {
  failure: { status: number; message: string } | null;
  onRetry: () => void;
}) {
  const retryable = !failure || failure.status === 0 || failure.status >= 500;
  return (
    <section role="alert" className="mx-auto grid min-h-[55vh] w-full max-w-xl place-items-center text-center">
      <div>
        <AlertCircle className="mx-auto size-9 text-amber-200" />
        <h2 className="mt-4 text-xl font-semibold text-zinc-100">Разбор недоступен</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {retryable
            ? "Не удалось загрузить данные тренировки. Повторите попытку или вернитесь к очереди."
            : "Вернитесь к очереди и выберите доступную тренировку."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {retryable ? <Button type="button" variant="outline" onClick={onRetry} className="min-h-11 rounded-[8px] border-zinc-800">Повторить загрузку</Button> : null}
          <Button asChild variant="outline" className="min-h-11 rounded-[8px] border-zinc-800"><a href="/trainer/dashboard">К очереди</a></Button>
        </div>
      </div>
    </section>
  );
}
