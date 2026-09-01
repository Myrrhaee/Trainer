import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

import {
  AthleteTrainingHistory,
  AthleteTrainingRetryButton,
} from "@/components/trainer/athlete-training-history";
import type {
  AthleteTrainingCurrentReadModel,
  AthleteTrainingPendingReview,
  AthleteTrainingViewResult,
} from "@/lib/server/athlete-profile/athlete-training-types";
import { cn } from "@/lib/utils";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";
import { WorkflowReturnReceipt, type WorkflowReturnReceiptModel } from "@/components/trainer/workflow-return-receipt";

type AthleteTrainingTabProps = {
  athleteUserId: string;
  training: AthleteTrainingViewResult;
  sourceAttentionItemId: string | null;
  historySlot?: ReactNode;
  workflowReceipt?: WorkflowReturnReceiptModel | null;
};

export function AthleteTrainingTab({
  athleteUserId,
  training,
  sourceAttentionItemId,
  historySlot,
  workflowReceipt,
}: AthleteTrainingTabProps) {
  if (training.relation.status === "suspended" || training.current.status === "unavailable") {
    return <SuspendedTrainingState />;
  }

  return (
    <div className="grid gap-5" data-athlete-training-tab>
      {workflowReceipt ? <WorkflowReturnReceipt receipt={workflowReceipt} /> : null}
      {training.current.status === "ready" ? (
        <CurrentTrainingWork
          athleteUserId={athleteUserId}
          current={training.current.value}
          sourceAttentionItemId={sourceAttentionItemId}
        />
      ) : (
        <TrainingSectionError
          title="Не удалось загрузить текущую работу"
          description="История остаётся доступна ниже. Обновите страницу, чтобы повторить запрос этого блока."
        />
      )}

      <LatestFeedbackSection feedback={training.feedback} />
      {historySlot ?? (
        <AthleteTrainingHistory
          athleteUserId={athleteUserId}
          initialState={training.history}
          canReview={training.relation.capabilities.canReview}
          sourceAttentionItemId={sourceAttentionItemId}
        />
      )}
    </div>
  );
}

export function AthleteTrainingLoading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Загрузка тренировочных данных">
      {["Работа сейчас", "Последняя обратная связь", "История тренировок"].map((title, index) => (
        <section key={title} className="min-h-32 animate-pulse border-y border-zinc-800/80 py-5 motion-reduce:animate-none">
          <span className="sr-only">{title}</span>
          <div className="h-5 w-44 rounded bg-zinc-900" />
          <div className={cn("mt-5 h-14 rounded bg-zinc-950", index === 0 && "h-28")} />
        </section>
      ))}
    </div>
  );
}

export function AthleteTrainingHistoryLoading() {
  return (
    <section className="min-h-40 animate-pulse pb-4 motion-reduce:animate-none" aria-busy="true" aria-label="Загрузка истории тренировок">
      <div className="h-5 w-44 rounded bg-zinc-900" />
      <div className="mt-5 grid gap-px bg-zinc-900">
        {[0, 1, 2].map((item) => <div key={item} className="h-16 bg-black" />)}
      </div>
    </section>
  );
}

function CurrentTrainingWork({
  athleteUserId,
  current,
  sourceAttentionItemId,
}: {
  athleteUserId: string;
  current: AthleteTrainingCurrentReadModel;
  sourceAttentionItemId: string | null;
}) {
  return (
    <section aria-labelledby="current-training-work" className="border-y border-zinc-800/90 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-zinc-600">Операционный контекст</p>
          <h2 id="current-training-work" className="mt-1 text-xl font-semibold text-zinc-50">Работа сейчас</h2>
        </div>
        <p className="text-xs text-zinc-600">Главное действие доступно в шапке профиля</p>
      </div>

      <div className="mt-5 grid border border-zinc-800/90 lg:grid-cols-3 lg:divide-x lg:divide-zinc-800/90">
        <PendingReviewsSection
          athleteUserId={athleteUserId}
          reviews={current.pendingReviews.items}
          sourceAttentionItemId={sourceAttentionItemId}
        />
        <ActiveExecutionSection current={current} />
        <NextAssignmentSection current={current} />
      </div>
    </section>
  );
}

function PendingReviewsSection({
  athleteUserId,
  reviews,
  sourceAttentionItemId,
}: {
  athleteUserId: string;
  reviews: AthleteTrainingPendingReview[];
  sourceAttentionItemId: string | null;
}) {
  return (
    <div id="pending-reviews" className="min-w-0 border-b border-zinc-800/90 p-4 lg:border-b-0" tabIndex={-1}>
      <SectionLabel icon={<ClipboardCheck className="size-4" />} label="Ожидают разбора" count={reviews.length} />
      {reviews.length ? (
        <div className="mt-4 grid gap-3">
          {reviews.map((review, index) => {
            const highlighted = review.attentionItemId === sourceAttentionItemId;
            const discomfort = review.priorityReasons.includes("discomfort");
            const href = review.sourceAvailability === "ready" && review.sessionId
              ? reviewHref(athleteUserId, review)
              : null;
            const content = (
              <>
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="line-clamp-2 text-sm font-medium text-zinc-100">{review.title}</span>
                  {index === 0 ? <span className="shrink-0 text-[11px] text-zinc-600">Первым</span> : null}
                </span>
                <span className={cn(
                  "mt-1.5 block text-xs leading-relaxed",
                  discomfort ? "text-orange-200/90" : "text-zinc-500",
                )}>
                  {review.sourceAvailability === "unavailable"
                    ? "Источник тренировки недоступен. Задача сохранена без перехода."
                    : discomfort
                      ? "Спортсмен отметил дискомфорт"
                      : review.priorityReasons.includes("partial_completion")
                        ? "Тренировка завершена частично"
                        : "Тренировка завершена и ждёт разбора"}
                </span>
                {highlighted ? <span className="mt-2 block text-xs text-amber-100">Причина открытия профиля</span> : null}
              </>
            );
            const className = cn(
              "block min-h-11 border-l-2 py-2 pl-3 pr-2 outline-none transition focus-visible:ring-2 focus-visible:ring-lime-200/70",
              highlighted ? "border-amber-300 bg-amber-300/[0.05]" : discomfort ? "border-orange-300/70" : "border-zinc-700",
              href && "hover:bg-zinc-900/60",
            );
            return href ? (
              <Link
                key={review.attentionItemId}
                href={href}
                className={className}
                aria-label={`Открыть разбор: ${review.title}`}
                data-attention-item-id={review.attentionItemId}
              >
                {content}
              </Link>
            ) : (
              <div key={review.attentionItemId} className={className} data-attention-item-id={review.attentionItemId}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <TrainingStateEmpty title="Ничего не ждёт разбора" description="Новые завершения появятся здесь автоматически." />
      )}
    </div>
  );
}

function ActiveExecutionSection({ current }: { current: AthleteTrainingCurrentReadModel }) {
  const execution = current.activeExecution.primary;
  const conflict = current.activeExecution.conflict;
  return (
    <div className="min-w-0 border-b border-zinc-800/90 p-4 lg:border-b-0">
      <SectionLabel icon={<PlayCircle className="size-4" />} label="Выполняется сейчас" count={current.activeExecution.totalCount} />
      {conflict ? (
        <div className="mt-4 border-l-2 border-orange-300/70 pl-3">
          <p className="flex items-center gap-2 text-sm font-medium text-orange-100">
            <AlertTriangle className="size-4 shrink-0" />Обнаружено несколько активных тренировок
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">Данные показаны без автоматического исправления.</p>
          <ul className="mt-3 grid gap-2">
            {current.activeExecution.items.map((item) => (
              <li key={item.sessionId} className="border-t border-zinc-800 pt-2 text-sm text-zinc-300">
                <span className="line-clamp-2">{item.title}</span>
                <span className="mt-1 block text-xs text-zinc-600">Начата {formatDateTime(item.startedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : execution ? (
        <div className="mt-4 border-l-2 border-sky-300/60 pl-3">
          <p className="line-clamp-2 text-sm font-medium text-zinc-100">{execution.title}</p>
          <p className="mt-1.5 text-xs text-zinc-500">Начата {formatDateTime(execution.startedAt)}</p>
        </div>
      ) : (
        <TrainingStateEmpty title="Сейчас ничего не выполняется" description="Этот статус не мешает будущему назначению существовать отдельно." />
      )}
    </div>
  );
}

function NextAssignmentSection({ current }: { current: AthleteTrainingCurrentReadModel }) {
  const assignment = current.nextAssignment.primary;
  return (
    <div id="next-assignment" className="min-w-0 p-4" tabIndex={-1}>
      <SectionLabel icon={<Dumbbell className="size-4" />} label="Следующая тренировка" count={current.nextAssignment.totalCount} />
      {assignment ? (
        <div className="mt-4 border-l-2 border-lime-300/60 pl-3">
          <p className="line-clamp-2 text-sm font-medium text-zinc-100">{assignment.title}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <CalendarDays className="size-3.5" />Назначена на {formatDate(assignment.scheduledFor)}
          </p>
          {current.nextAssignment.totalCount > 1 ? (
            <p className="mt-2 text-xs text-zinc-600">Ещё назначений: {current.nextAssignment.totalCount - 1}</p>
          ) : null}
        </div>
      ) : (
        <TrainingStateEmpty title="Следующая тренировка не назначена" description="Основное действие для назначения находится в шапке профиля." />
      )}
    </div>
  );
}

function LatestFeedbackSection({ feedback }: { feedback: AthleteTrainingViewResult["feedback"] }) {
  return (
    <section id="latest-feedback-section" aria-labelledby="latest-feedback" className="border-b border-zinc-800/90 pb-5" tabIndex={-1}>
      <h2 id="latest-feedback" className="text-lg font-semibold text-zinc-50">Последняя обратная связь</h2>
      {feedback.status === "error" ? (
        <div className="mt-4"><TrainingSectionError title="Не удалось загрузить обратную связь" description="Текущая работа и история не затронуты." compact /></div>
      ) : feedback.status === "ready" && feedback.value ? (
        <div className="mt-4 grid gap-3 border-l-2 border-zinc-700 pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium text-zinc-100">{feedback.value.title}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-zinc-400">{feedback.value.body}</p>
          </div>
          <p className="shrink-0 text-xs text-zinc-600">{formatDateTime(feedback.value.sentAt)}</p>
        </div>
      ) : (
        <div className="mt-4"><TrainingStateEmpty title="Обратной связи пока нет" description="Она появится после первого завершённого разбора." /></div>
      )}
    </section>
  );
}

function SuspendedTrainingState() {
  return (
    <section className="border-y border-zinc-800/90 py-8" aria-labelledby="training-suspended">
      <div className="flex max-w-2xl gap-4">
        <PauseCircle className="mt-0.5 size-6 shrink-0 text-zinc-500" />
        <div>
          <h2 id="training-suspended" className="text-lg font-semibold text-zinc-100">Тренировочные данные временно недоступны</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Связь со спортсменом приостановлена. Назначения, сессии, обратная связь и счётчики скрыты до её возобновления.</p>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ icon, label, count }: { icon: ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
      <span className="flex items-center gap-2">{icon}{label}</span>
      <span aria-label={`${label}: ${count}`}>{count}</span>
    </div>
  );
}

function TrainingStateEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 flex gap-3 text-zinc-600">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <div><p className="text-sm text-zinc-400">{title}</p><p className="mt-1 text-xs leading-relaxed">{description}</p></div>
    </div>
  );
}

export function TrainingSectionError({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("border-l-2 border-red-300/50 pl-4", !compact && "border-y border-y-zinc-800/90 py-5")} role="alert">
      <p className="flex items-center gap-2 text-sm font-medium text-red-100"><AlertTriangle className="size-4" />{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
      {!compact ? (
        <AthleteTrainingRetryButton />
      ) : null}
    </section>
  );
}

function reviewHref(athleteUserId: string, review: AthleteTrainingPendingReview) {
  const context = createTrainerWorkflowContext({
    origin: "profile",
    athleteUserId,
    sourceAttentionItemId: review.attentionItemId,
    sourceSessionId: review.sessionId ?? undefined,
    returnTo: `/trainer/clients/${athleteUserId}?tab=training`,
    returnAnchor: "latest-feedback",
  });
  return trainerWorkflowHref(`/trainer/review/${review.sessionId}`, context);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
