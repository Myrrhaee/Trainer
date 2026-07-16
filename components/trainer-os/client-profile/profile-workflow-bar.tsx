import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Dumbbell, MessageCircle, PlayCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TrainerAthleteProfileView } from "./profile-read-model";

type ProfileWorkflowBarProps = {
  view: TrainerAthleteProfileView;
  receipt: string | null;
  onAssign: () => void;
  onReview: () => void;
  onOpenPlan: () => void;
};

export function ProfileWorkflowBar({ view, receipt, onAssign, onReview, onOpenPlan }: ProfileWorkflowBarProps) {
  const { athlete, context, primaryAction, latestEvent } = view;
  const reviewReturnHref = view.source === "review" && view.reviewSessionId ? `/trainer/review/${view.reviewSessionId}` : null;
  const returnHref = context?.returnHref ?? reviewReturnHref ?? (view.source === "dashboard" ? "/trainer/dashboard" : "/trainer/clients");
  const returnLabel = context?.returnLabel ?? (reviewReturnHref ? "Назад к разбору" : view.source === "dashboard" ? "Назад к команде" : "К списку клиентов");
  const nextHref = context?.nextClientId
    ? `/trainer/clients/${context.nextClientId}?from=dashboard&attention=${context.nextAttentionKind ?? "assignment"}`
    : null;

  return (
    <section aria-labelledby="profile-workflow-heading" className="rounded-lg border border-zinc-800/90 bg-zinc-950/92 p-4 shadow-2xl shadow-black/25 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1", context ? "border-amber-300/20 bg-amber-300/8 text-amber-100" : "border-zinc-800 bg-black/20 text-zinc-400")}>
              {context ? <CircleAlert className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {context?.label ?? athlete.status}
            </span>
            <span className="text-zinc-600">{context?.happenedAt ?? athlete.lastActivity}</span>
          </div>
          <h2 id="profile-workflow-heading" className="mt-2 text-xl font-semibold text-zinc-50">
            {context?.title ?? latestEvent?.title ?? athlete.goal}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
            {context?.signal ?? latestEvent?.detail ?? `Текущая цель: ${athlete.goal}.`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <PrimaryAction view={view} onAssign={onAssign} onReview={onReview} onOpenPlan={onOpenPlan} />
          <Button asChild variant="outline" className="h-10 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href={returnHref}>
              <ArrowLeft className="size-4" />
              {returnLabel}
            </Link>
          </Button>
        </div>
      </div>

      {context ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800/70 pt-3 text-xs text-zinc-500">
          <span>{context.detail}</span>
          {context.itemId ? <span className="font-mono text-zinc-700">{context.itemId}</span> : null}
          {view.reviewSessionId && primaryAction.kind === "review" ? (
            <Link href={`/trainer/review/${view.reviewSessionId}?from=profile&clientId=${athlete.id}`} className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-lime-100">
              Полный разбор
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite">
        {receipt ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] p-3 text-sm text-lime-100 motion-safe:animate-in motion-safe:fade-in sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" />{receipt}</span>
            <div className="flex flex-wrap gap-2">
              {nextHref ? (
                <Button asChild size="sm" className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
                  <Link href={nextHref}>К следующему клиенту<ArrowRight className="size-4" /></Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost" className="rounded-full text-lime-100 hover:bg-lime-300/10">
                <Link href={returnHref}><RotateCcw className="size-4" />К очереди</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PrimaryAction({
  view,
  onAssign,
  onReview,
  onOpenPlan,
}: {
  view: TrainerAthleteProfileView;
  onAssign: () => void;
  onReview: () => void;
  onOpenPlan: () => void;
}) {
  const action = view.primaryAction;

  if (action.kind === "message") {
    return (
      <Button asChild className="h-10 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
        <Link id="profile-primary-action" href={`/trainer/messages?clientId=${view.athlete.id}`}><MessageCircle className="size-4" />{action.label}</Link>
      </Button>
    );
  }

  const Icon = action.kind === "review" ? CheckCircle2 : action.kind === "assign" ? Dumbbell : PlayCircle;
  const handler = action.kind === "review" ? onReview : action.kind === "assign" ? onAssign : onOpenPlan;

  return (
    <Button id="profile-primary-action" type="button" onClick={handler} className="h-10 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
      <Icon className="size-4" />
      {action.label}
    </Button>
  );
}
