import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  Gauge,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  UserRound,
} from "lucide-react";

import { AthleteProfileScrollReset } from "@/components/trainer/athlete-profile-scroll-reset";
import { AthleteTrainingLoading, AthleteTrainingTab } from "@/components/trainer/athlete-training-tab";
import { CanonicalQuickAssignSheet } from "@/components/trainer/quick-assign/canonical-quick-assign-sheet";
import { QuickAssignProfileTrigger } from "@/components/trainer/quick-assign/quick-assign-profile-trigger";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import type {
  AthleteOverviewReadModel,
  AthleteProfileFrameReadModel,
  AthleteProfileTab,
} from "@/lib/server/athlete-profile/athlete-profile-types";
import type { AthleteTrainingViewResult } from "@/lib/server/athlete-profile/athlete-training-types";
import { cn } from "@/lib/utils";
import type { WorkflowReturnReceiptModel } from "@/components/trainer/workflow-return-receipt";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

export function CanonicalAthleteProfile({
  frame,
  overview,
  activeTab,
  training,
  trainingHistory,
  workflowReceipt,
  quickAssign,
}: {
  frame: AthleteProfileFrameReadModel;
  overview: AthleteOverviewReadModel;
  activeTab: AthleteProfileTab;
  training?: AthleteTrainingViewResult | null;
  trainingHistory?: ReactNode;
  workflowReceipt?: WorkflowReturnReceiptModel | null;
  quickAssign?: {
    open: boolean;
    transitionContext: string;
    originPhrase: string;
    handoffToken?: string | null;
  } | null;
}) {
  return (
    <TrainerShell
      eyebrow="Команда"
      title="Профиль спортсмена"
      description="Личный контекст и текущее состояние работы"
      headerAction={(
        <Button asChild variant="outline" className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-300">
          <Link href={frame.entryContext.returnHref}><ArrowLeft className="size-4" />{frame.entryContext.returnLabel}</Link>
        </Button>
      )}
    >
      <AthleteProfileScrollReset preservePosition={Boolean(workflowReceipt)} />
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-10">
        <div className="mx-auto w-full max-w-[1180px]">
          <Link href={frame.entryContext.returnHref} className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 lg:hidden">
            <ArrowLeft className="size-4" />{frame.entryContext.returnLabel}
          </Link>

          <ProfileHeader frame={frame} />
          {frame.entryContext.mode === "attention" && frame.entryContext.attention ? (
            <AttentionContextStrip frame={frame} />
          ) : null}
          <ProfileTabs frame={frame} activeTab={activeTab} />

          <div className="pt-5">
            {activeTab === "overview" ? <OverviewTab frame={frame} overview={overview} /> : null}
            {activeTab === "training" ? (
              training ? (
                <AthleteTrainingTab
                  athleteUserId={frame.identity.athleteUserId}
                  training={training}
                  sourceAttentionItemId={frame.entryContext.attention?.id ?? null}
                  historySlot={trainingHistory}
                  workflowReceipt={workflowReceipt}
                />
              ) : (
                <AthleteTrainingLoading />
              )
            ) : null}
            {activeTab === "progress" ? <ProgressTab overview={overview} /> : null}
          </div>
        </div>
      </main>
      {quickAssign?.open ? (
        <CanonicalQuickAssignSheet
          athleteUserId={frame.identity.athleteUserId}
          initialOpen
          transitionContext={quickAssign.transitionContext}
          originPhrase={quickAssign.originPhrase}
          handoffToken={quickAssign.handoffToken}
        />
      ) : null}
    </TrainerShell>
  );
}

function ProfileHeader({ frame }: { frame: AthleteProfileFrameReadModel }) {
  const primary = frame.availableActions.primary;
  const PrimaryIcon = primary?.kind === "review" ? ClipboardCheck : Dumbbell;
  return (
    <header className="grid gap-5 border-y border-zinc-800/90 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg font-semibold text-zinc-100 sm:size-18">
          {frame.identity.initials}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-2xl font-semibold tracking-normal text-zinc-50 sm:text-3xl">
              {frame.identity.displayName}
            </h2>
            <RelationStatus status={frame.relation.status} />
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm text-zinc-400">
            {frame.identity.goal ?? "Цель пока не указана спортсменом"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
            <CalendarDays className="size-3.5" />В команде с {formatDate(frame.relation.acceptedAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
        <CurrentState state={frame.currentState} />
        {primary ? (
          <Button asChild className="min-h-11 shrink-0 rounded-lg bg-lime-300 px-4 text-black hover:bg-lime-200">
            {primary.kind === "assign" ? (
              <QuickAssignProfileTrigger href={primary.href} athleteUserId={frame.identity.athleteUserId} label={primary.label} />
            ) : (
              <Link href={primary.href}><PrimaryIcon className="size-4" />{primary.label}</Link>
            )}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function RelationStatus({ status }: { status: AthleteProfileFrameReadModel["relation"]["status"] }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-lime-200/80"><CheckCircle2 className="size-3.5" />Активная связь</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500"><PauseCircle className="size-3.5" />Связь приостановлена</span>
  );
}

function CurrentState({ state }: { state: AthleteProfileFrameReadModel["currentState"] }) {
  const Icon = state.kind === "discomfort" ? AlertTriangle
    : state.kind === "review_required" ? ClipboardCheck
      : state.kind === "workout_active" ? PlayCircle
        : state.kind === "relation_unavailable" ? PauseCircle
          : state.kind === "source_unavailable" ? AlertTriangle
          : state.kind === "no_next_assignment" ? Dumbbell : CheckCircle2;
  return (
    <div className="flex min-w-0 items-center gap-3 lg:max-w-xs">
      <span className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border",
        state.tone === "warning" && "border-orange-300/20 bg-orange-300/10 text-orange-200",
        state.tone === "attention" && "border-amber-300/20 bg-amber-300/10 text-amber-100",
        state.tone === "active" && "border-sky-300/20 bg-sky-300/10 text-sky-100",
        state.tone === "calm" && "border-lime-300/20 bg-lime-300/10 text-lime-100",
        state.tone === "muted" && "border-zinc-700 bg-zinc-900 text-zinc-400",
      )}><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{state.label}</span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">{state.detail}</span>
      </span>
    </div>
  );
}

function AttentionContextStrip({ frame }: { frame: AthleteProfileFrameReadModel }) {
  const attention = frame.entryContext.attention;
  if (!attention) return null;
  const resolved = attention.status !== "open";
  return (
    <section className={cn(
      "mt-4 flex flex-col gap-3 border-l-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
      resolved ? "border-zinc-700 bg-zinc-900/40" : "border-amber-300/70 bg-amber-300/[0.055]",
    )} aria-label="Причина открытия профиля">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", resolved ? "text-zinc-400" : "text-amber-100")}>{attention.reason}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{attention.title}</p>
      </div>
      {attention.status === "open" ? (
        <Link href={trainerWorkflowHref(`/trainer/review/${attention.sessionId}`, createTrainerWorkflowContext({
          origin: "profile",
          athleteUserId: frame.identity.athleteUserId,
          sourceAttentionItemId: attention.id,
          sourceSessionId: attention.sessionId,
          returnTo: `/trainer/clients/${frame.identity.athleteUserId}?tab=training`,
          returnAnchor: "latest-feedback",
        }))} className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-lime-200 hover:text-lime-100">
          Открыть источник <ClipboardCheck className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

function ProfileTabs({ frame, activeTab }: { frame: AthleteProfileFrameReadModel; activeTab: AthleteProfileTab }) {
  const tabs: Array<{ id: AthleteProfileTab; label: string }> = [
    { id: "overview", label: "Обзор" },
    { id: "training", label: "Тренировки" },
    { id: "progress", label: "Прогресс" },
  ];
  return (
    <nav className="mt-4 grid grid-cols-3 border-b border-zinc-800" aria-label="Разделы профиля спортсмена">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tabHref(frame, tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={cn(
            "relative flex min-h-11 items-center justify-center px-2 text-sm transition",
            activeTab === tab.id ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-200",
          )}
        >
          {tab.label}
          {activeTab === tab.id ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-lime-300" /> : null}
        </Link>
      ))}
    </nav>
  );
}

function OverviewTab({ frame, overview }: { frame: AthleteProfileFrameReadModel; overview: AthleteOverviewReadModel }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
      <div className="grid gap-5">
        <RecentWork frame={frame} overview={overview} />
        <AboutAthlete overview={overview} />
      </div>
      <TrainingContext overview={overview} />
    </div>
  );
}

function RecentWork({ frame, overview }: { frame: AthleteProfileFrameReadModel; overview: AthleteOverviewReadModel }) {
  const assignment = overview.recentWork.currentAssignment;
  const session = overview.recentWork.lastSession;
  const feedback = overview.recentWork.lastFeedback;
  const rows = [
    {
      label: "Текущее назначение",
      value: assignment?.title ?? "Нет назначения",
      meta: assignment ? `${assignment.status === "in_progress" ? "Выполняется" : "Назначено"} · ${formatShortDate(assignment.scheduledFor)}` : "Требуется решение тренера",
      icon: assignment?.status === "in_progress" ? PlayCircle : Dumbbell,
    },
    {
      label: "Последняя тренировка",
      value: session?.title ?? "Выполненных тренировок пока нет",
      meta: session ? `${session.completedSets} из ${session.totalSets} подходов · ${formatShortDate(session.completedAt)}` : "История появится после первого завершения",
      icon: ClipboardCheck,
    },
    {
      label: "Последняя обратная связь",
      value: feedback ? "Отправлена тренером" : "Обратной связи пока нет",
      meta: feedback ? formatDateTime(feedback.sentAt) : "Появится после разбора тренировки",
      icon: MessageSquareText,
    },
    {
      label: "Следующий шаг",
      value: overview.recentWork.nextStep,
      meta: frame.currentState.detail,
      icon: Gauge,
    },
  ];
  return (
    <Section title="Последнее в работе" description="Только факты, которые влияют на следующий шаг.">
      <div className="divide-y divide-zinc-800 border-y border-zinc-800">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="grid gap-2 py-3.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <span className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="size-4" />{row.label}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-100">{row.value}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-600">{row.meta}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function AboutAthlete({ overview }: { overview: AthleteOverviewReadModel }) {
  return (
    <Section title="О спортсмене" description="Информация, которой спортсмен решил поделиться с тренером.">
      {overview.dataAvailability.hasAbout ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {overview.about.biography ? <Fact label="О себе" value={overview.about.biography} wide /> : null}
          {overview.about.trainingExperience ? <Fact label="Тренировочный опыт" value={overview.about.trainingExperience} /> : null}
          {overview.about.athleteContext ? <Fact label="Контекст занятий" value={overview.about.athleteContext} /> : null}
        </dl>
      ) : (
        <LocalEmpty icon={<UserRound className="size-5" />} title="Спортсмен пока не заполнил личную анкету" description="Рабочий статус и назначения остаются доступны выше." />
      )}
    </Section>
  );
}

function TrainingContext({ overview }: { overview: AthleteOverviewReadModel }) {
  const context = overview.trainingContext;
  return (
    <Section title="Тренировочный контекст" description="Данные спортсмена, полезные при составлении тренировок.">
      {overview.dataAvailability.hasTrainingContext ? (
        <dl className="grid gap-4">
          {context.preferences.length ? <Fact label="Предпочтения" value={context.preferences.join(", ")} /> : null}
          {context.availableEquipment.length ? <Fact label="Оборудование" value={context.availableEquipment.join(", ")} /> : null}
          {context.schedule ? <Fact label="Привычный график" value={context.schedule} /> : null}
          {context.athleteReportedLimitations ? <Fact label="Со слов спортсмена" value={context.athleteReportedLimitations} /> : null}
        </dl>
      ) : (
        <LocalEmpty icon={<Dumbbell className="size-5" />} title="Контекст пока не указан" description="Предпочтения, оборудование и график появятся после заполнения анкеты." />
      )}
    </Section>
  );
}

function ProgressTab({ overview }: { overview: AthleteOverviewReadModel }) {
  return (
    <Section title="Прогресс" description="В R1 используются только подтверждённые данные завершённых тренировок.">
      {overview.recentWork.lastSession ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Fact label="Последняя тренировка" value={overview.recentWork.lastSession.title} />
          <Fact label="Завершено подходов" value={`${overview.recentWork.lastSession.completedSets} из ${overview.recentWork.lastSession.totalSets}`} />
          <Fact label="Дата" value={formatDate(overview.recentWork.lastSession.completedAt)} />
        </div>
      ) : (
        <LocalEmpty icon={<Gauge className="size-5" />} title="Недостаточно данных для динамики" description="Графики появятся после накопления канонической истории, без подстановки mock-значений." />
      )}
    </Section>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = `section-${title.toLocaleLowerCase("ru").replaceAll(/[^a-zа-яё0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border border-zinc-800/90 bg-zinc-950/65 p-4 sm:p-5">
      <h2 id={id} className="text-lg font-semibold tracking-normal text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{value}</dd>
    </div>
  );
}

function LocalEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 border-l-2 border-zinc-800 pl-4">
      <span className="mt-0.5 text-zinc-600">{icon}</span>
      <div><p className="text-sm font-medium text-zinc-300">{title}</p><p className="mt-1 text-sm leading-relaxed text-zinc-600">{description}</p></div>
    </div>
  );
}

function tabHref(frame: AthleteProfileFrameReadModel, tab: AthleteProfileTab) {
  const params = new URLSearchParams({ tab });
  if (frame.entryContext.source !== "direct") params.set("from", frame.entryContext.source);
  if (frame.entryContext.attention) params.set("attentionItem", frame.entryContext.attention.id);
  return `/trainer/clients/${frame.identity.athleteUserId}?${params.toString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
