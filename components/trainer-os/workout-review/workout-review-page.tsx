"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Dumbbell, UserRound } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { QuickAssignDrawer } from "@/components/trainer-os/quick-assign/quick-assign-drawer";
import { Button } from "@/components/ui/button";

import { ReviewFeedbackPanel } from "./review-feedback-panel";
import { getWorkoutReviewDetails, toReviewTeamClient } from "./review-model";
import { ReviewClientComment, ReviewExerciseList, ReviewSessionSummary, ReviewSignals } from "./review-shared";

export type ReviewEntryInput = {
  from?: string;
  attentionItem?: string;
  queue?: string;
  position?: string;
  next?: string;
};

export function WorkoutReviewPage({ workoutId, entry }: { workoutId: string; entry: ReviewEntryInput }) {
  const review = getWorkoutReviewDetails(workoutId);
  if (!review) return <UnknownWorkoutReview workoutId={workoutId} />;
  return <KnownWorkoutReview review={review} entry={entry} />;
}

function KnownWorkoutReview({ review, entry }: { review: NonNullable<ReturnType<typeof getWorkoutReviewDetails>>; entry: ReviewEntryInput }) {
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const teamClient = toReviewTeamClient(review);
  const source = parseSource(entry.from);
  const returnTarget = getReturnTarget(source, review);
  const nextSessionId = safeSessionId(entry.next) ?? review.attentionContext?.nextSessionId;
  const profileHref = `${review.athlete.profileHref}?from=review`;
  const queuePosition = Number(entry.position) || review.attentionContext?.position;
  const queueTotal = review.attentionContext?.total;

  return (
    <TrainerShell
      eyebrow="Разбор тренировки"
      title={review.sessionTitle}
      description={`${review.athlete.displayName} · ${review.session.completedLabel}`}
      headerAction={
        <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
          <Link href={returnTarget.href}><ArrowLeft className="size-4" />{returnTarget.label}</Link>
        </Button>
      }
    >
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto w-full max-w-[1440px] space-y-5">
          <section className="rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.09),transparent_32%),linear-gradient(135deg,rgba(24,24,27,0.94),rgba(5,5,5,0.98))] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-semibold text-zinc-100">{review.athlete.initials}</div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    {sourceLabel[source]}
                    {queuePosition && queueTotal ? ` · задача ${queuePosition} из ${queueTotal}` : ""}
                    {entry.attentionItem ? ` · ${entry.attentionItem}` : ""}
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold text-zinc-50">{review.athlete.displayName}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{review.sessionTitle} · {review.session.completedLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
                  <Link href={profileHref}><UserRound className="size-4" />К профилю</Link>
                </Button>
                <Button type="button" onClick={() => setQuickAssignOpen(true)} variant="outline" className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
                  <Dumbbell className="size-4" />Назначить следующую
                </Button>
              </div>
            </div>
          </section>

          <ReviewSessionSummary review={review} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <div className="grid min-w-0 gap-5">
              <ReviewSignals signals={review.signals} />
              <ReviewClientComment comment={review.clientComment} />
              <ReviewExerciseList exercises={review.exercises} />
              {review.previousContext ? (
                <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs font-medium uppercase text-zinc-500">{review.previousContext.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{review.previousContext.detail}</p>
                </section>
              ) : null}
            </div>

            <aside className="xl:sticky xl:top-24">
              <ReviewFeedbackPanel review={review} onResolved={(kind) => setReceipt(kind === "manual" ? "Задача закрыта без сообщения. Причина сохранена локально." : "Feedback сохранён, задача разбора закрыта.")} onAssign={() => setQuickAssignOpen(true)} />
              {receipt ? (
                <div aria-live="polite" className="mt-3 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] p-3 text-sm text-lime-100">
                  <p>{receipt}</p>
                  <div className="mt-3 grid gap-2">
                    {source === "dashboard" && nextSessionId ? (
                      <Button asChild size="sm" className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
                        <Link href={`/trainer/review/${nextSessionId}?from=dashboard&queue=review`}><ArrowRight className="size-4" />Следующий клиент</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline" className="min-h-11 rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
                      <Link href={returnTarget.href}>{returnTarget.label}</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </main>

      <QuickAssignDrawer client={teamClient} open={quickAssignOpen} onOpenChange={setQuickAssignOpen} onAssign={() => { setQuickAssignOpen(false); setReceipt(`Тренировка для ${review.athlete.displayName} назначена локально.`); }} onAssignNext={() => { setQuickAssignOpen(false); setReceipt(`Тренировка для ${review.athlete.displayName} назначена. Можно перейти к следующему клиенту.`); }} />
    </TrainerShell>
  );
}

function UnknownWorkoutReview({ workoutId }: { workoutId: string }) {
  return (
    <TrainerShell eyebrow="Разбор тренировки" title="Сессия не найдена" description="Ссылка не соответствует доступной demo-сессии.">
      <main className="flex min-h-[76vh] items-center justify-center bg-black px-4 py-10 pb-28 text-zinc-100 lg:pb-10">
        <section className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-950/90 p-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-50">Тренировка не найдена</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Идентификатор <span className="font-mono text-zinc-400">{workoutId}</span> не был заменён данными другой сессии.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full bg-lime-300 text-black hover:bg-lime-200"><Link href="/trainer/dashboard">На главную</Link></Button>
            <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900"><Link href="/trainer/clients">К спортсменам</Link></Button>
          </div>
        </section>
      </main>
    </TrainerShell>
  );
}

function parseSource(value?: string): "dashboard" | "profile" | "history" | "direct" {
  return value === "dashboard" || value === "profile" || value === "history" ? value : "direct";
}

function getReturnTarget(source: ReturnType<typeof parseSource>, review: NonNullable<ReturnType<typeof getWorkoutReviewDetails>>) {
  if (source === "dashboard") return { href: "/trainer/dashboard#attention-heading", label: "Вернуться к очереди" };
  if (source === "profile" || source === "history") return { href: `${review.athlete.profileHref}?from=review`, label: "Вернуться в профиль" };
  return { href: review.athlete.profileHref, label: "К профилю" };
}

function safeSessionId(value?: string) {
  return value && /^[a-z0-9-]+$/.test(value) ? value : undefined;
}

const sourceLabel = { dashboard: "Из очереди Dashboard", profile: "Из профиля спортсмена", history: "Из истории тренировок", direct: "Прямая ссылка" } as const;
