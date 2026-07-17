"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Flame,
  Lock,
  Trophy,
  UserRoundSearch,
  UsersRound,
  Weight,
} from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickAssignDrawer } from "@/components/trainer-os/quick-assign/quick-assign-drawer";
import { WorkoutReviewDrawer } from "@/components/trainer-os/workout-review/workout-review-drawer";
import { getDefaultReviewSessionId } from "@/components/trainer-os/workout-review/review-model";
import { cn } from "@/lib/utils";

import {
  buildTrainerAthleteProfileView,
  type ClientProfileTab,
  type ProfileEntryInput,
} from "./profile-read-model";
import { ProfileWorkflowBar } from "./profile-workflow-bar";
import { athleteReputationRanks, getAthleteReputationView } from "./reputation-ranks";
import type { AthleteProfile } from "./types";
import { formatProfileDate } from "./client-profile-ui";
import { ManagementTab } from "./management-tab";
import { OverviewTab } from "./overview-tab";
import { ProgressTab } from "./progress-tab";
import { TrainingTab } from "./training-tab";

const profileTabs: Array<{ value: ClientProfileTab; label: string }> = [
  { value: "overview", label: "Обзор" },
  { value: "training", label: "Тренировки" },
  { value: "progress", label: "Прогресс" },
  { value: "finance", label: "Доступ и оплата" },
];

type ClientProfilePageProps = {
  clientId: string;
  entry: ProfileEntryInput;
};

export function ClientProfilePage({ clientId, entry }: ClientProfilePageProps) {
  const view = buildTrainerAthleteProfileView(clientId, entry);

  if (!view) return <UnknownClientProfile clientId={clientId} />;

  return <KnownClientProfile view={view} />;
}

function KnownClientProfile({ view }: { view: NonNullable<ReturnType<typeof buildTrainerAthleteProfileView>> }) {
  const athlete = view.athlete;
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rankDialogOpen, setRankDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientProfileTab>(view.defaultTab);
  const [actionReceipt, setActionReceipt] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const isOverviewTab = activeTab === "overview";
  const headerTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
  const headerPresenceTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <TrainerShell
      eyebrow="Профиль спортсмена"
      title={athlete.name}
      description="Тренировочный путь спортсмена и текущий рабочий контекст."
    >
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.08),transparent_28%),linear-gradient(180deg,#050505_0%,#09090b_46%,#050505_100%)] px-4 py-6 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
          <ProfileWorkflowBar
            view={view}
            receipt={actionReceipt}
            onAssign={() => setQuickAssignOpen(true)}
            onReview={() => setReviewOpen(true)}
            onOpenPlan={() => setActiveTab("training")}
          />

          <motion.div layout className="relative" transition={headerTransition}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={isOverviewTab ? "overview-header" : "compact-header"}
                layout
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, y: isOverviewTab ? -10 : 10, scale: 0.992, filter: "blur(6px)" }
                }
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: isOverviewTab ? 8 : -8, scale: 0.992, filter: "blur(5px)" }
                }
                style={{ transformOrigin: "top center" }}
                transition={headerPresenceTransition}
              >
                {isOverviewTab ? (
                  <AthleteHeader athlete={athlete} onOpenReputation={() => setRankDialogOpen(true)} />
                ) : (
                  <CompactClientHeader athlete={athlete} onOpenReputation={() => setRankDialogOpen(true)} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div layout="position" transition={headerTransition}>
            <div className="w-full">
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div
                  role="tablist"
                  aria-label="Разделы профиля спортсмена"
                  className="inline-flex h-10 w-max min-w-full items-center justify-start rounded-2xl border border-zinc-800 bg-zinc-950/72 p-1 text-zinc-400 sm:min-w-0"
                >
                  {profileTabs.map((tab) => {
                    const isActive = activeTab === tab.value;

                    return (
                      <button
                        key={tab.value}
                        id={`client-profile-tab-${tab.value}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`client-profile-panel-${tab.value}`}
                        data-state={isActive ? "active" : "inactive"}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70",
                          isActive ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-zinc-100"
                        )}
                        onClick={() => setActiveTab(tab.value)}
                        onKeyDown={(event) => handleTabKeyDown(event, tab.value, setActiveTab)}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                id={`client-profile-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`client-profile-tab-${activeTab}`}
                tabIndex={0}
                className="mt-5 focus-visible:outline-none"
              >
                {activeTab === "overview" ? <OverviewTab athlete={athlete} /> : null}
                {activeTab === "training" ? (
                  <TrainingTab
                    athlete={athlete}
                    onAssign={() => setQuickAssignOpen(true)}
                    onReview={() => setReviewOpen(true)}
                  />
                ) : null}
                {activeTab === "progress" ? <ProgressTab athlete={athlete} /> : null}
                {activeTab === "finance" ? <ManagementTab athlete={athlete} /> : null}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <QuickAssignDrawer
        athleteId={athlete.id}
        context={{
          source: "profile",
          reason: view.context?.detail ?? "Плановое назначение из профиля спортсмена.",
          returnTo: `/trainer/clients/${athlete.id}`,
        }}
        open={quickAssignOpen}
        onOpenChange={(open) => {
          setQuickAssignOpen(open);
          if (!open) restoreWorkflowFocus();
        }}
        onAssigned={(receipt) => {
          setActionReceipt(`${receipt.templateTitle} назначена для ${athlete.name} на ${receipt.scheduledDate}.`);
        }}
        onOpenAssignment={(receipt) => {
          setQuickAssignOpen(false);
          setActiveTab("training");
          setActionReceipt(`${receipt.templateTitle} добавлена в локальный список предстоящих тренировок.`);
          restoreWorkflowFocus();
        }}
      />
      <WorkoutReviewDrawer
        sessionId={view.reviewSessionId ?? getDefaultReviewSessionId(athlete.id) ?? null}
        open={reviewOpen}
        source="profile"
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) restoreWorkflowFocus();
        }}
        onResolved={(_, kind) => {
          setActionReceipt(kind === "manual" ? `Разбор ${athlete.name} закрыт без сообщения.` : `Feedback для ${athlete.name} отправлен.`);
        }}
        onAssignNext={() => {
          setReviewOpen(false);
          setActionReceipt(`Разбор ${athlete.name} завершён. Можно назначить следующий день.`);
          setQuickAssignOpen(true);
        }}
      />
      <ReputationRankDialog
        athlete={athlete}
        open={rankDialogOpen}
        onOpenChange={(open) => {
          setRankDialogOpen(open);
          if (!open) window.requestAnimationFrame(() => document.getElementById("profile-rank-trigger")?.focus());
        }}
      />
    </TrainerShell>
  );
}

function UnknownClientProfile({ clientId }: { clientId: string }) {
  return (
    <TrainerShell eyebrow="Профиль спортсмена" title="Спортсмен не найден" description="Проверьте ссылку или вернитесь к списку клиентов.">
      <main className="flex min-h-[76vh] items-center justify-center bg-black px-4 py-10 pb-28 text-zinc-100 lg:pb-10">
        <section className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-950/90 p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
            <UserRoundSearch className="size-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-zinc-50">Такого спортсмена нет в demo-команде</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            URL не был подменён данными другого клиента. Идентификатор <span className="font-mono text-zinc-400">{clientId}</span> не найден.
          </p>
          <Button asChild className="mt-6 rounded-full bg-lime-300 text-black hover:bg-lime-200">
            <Link href="/trainer/clients"><UsersRound className="size-4" />К списку клиентов</Link>
          </Button>
        </section>
      </main>
    </TrainerShell>
  );
}

function handleTabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  currentTab: ClientProfileTab,
  setActiveTab: (tab: ClientProfileTab) => void
) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  const currentIndex = profileTabs.findIndex((tab) => tab.value === currentTab);
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? profileTabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + profileTabs.length) % profileTabs.length;
  const nextTab = profileTabs[nextIndex];
  setActiveTab(nextTab.value);
  window.requestAnimationFrame(() => document.getElementById(`client-profile-tab-${nextTab.value}`)?.focus());
}

function restoreWorkflowFocus() {
  window.requestAnimationFrame(() => document.getElementById("profile-primary-action")?.focus());
}

function AthleteHeader({
  athlete,
  onOpenReputation,
}: {
  athlete: AthleteProfile;
  onOpenReputation: () => void;
}) {
  const careerStats = getAthleteCareerStats(athlete);
  const reputation = getAthleteReputation(athlete);
  const activeTitle = athlete.titles.find((title) => title.id === athlete.activeTitleId && title.isUnlocked);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-[linear-gradient(135deg,rgba(24,24,27,0.82),rgba(5,5,5,0.94))] shadow-[0_26px_80px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_19%_18%,rgba(190,242,100,0.09),transparent_25%),radial-gradient(circle_at_77%_18%,rgba(255,255,255,0.045),transparent_21%)]" />

      <div className="relative z-10 grid gap-5 p-5 lg:grid-cols-[180px_minmax(0,1fr)_280px] lg:grid-rows-[auto_auto] lg:gap-x-7 lg:gap-y-4 xl:grid-cols-[190px_minmax(0,1fr)_300px] 2xl:grid-cols-[232px_minmax(0,1fr)_330px] 2xl:gap-x-8">
        <div className="flex flex-col items-center justify-center lg:row-span-2">
          <AthletePhoto initials={athlete.initials} size="large" />
        </div>

        <div className="min-w-0 self-center">
          <h2 className="max-w-full text-[2.7rem] font-semibold leading-[0.96] tracking-[-0.035em] text-zinc-50 sm:text-[3.35rem] lg:text-[3.2rem] xl:text-[3.55rem] 2xl:text-[4.05rem]">
            {athlete.name}
          </h2>

          <AthleteTitleMark title={activeTitle} className="mt-3" />

          <p className="mt-3 line-clamp-2 max-w-[680px] text-base leading-relaxed text-zinc-300/86 sm:text-lg">
            {athlete.about}
          </p>

          <div className="mt-5 grid max-w-[540px] gap-3 sm:grid-cols-2">
            <ProfileLine icon={Trophy} label="Цель" value={athlete.goal} />
            <ProfileLine icon={CalendarDays} label="В клубе" value={getClubTenureLabel(athlete)} />
          </div>
        </div>

        <SportReputationCard reputation={reputation} onOpen={onOpenReputation} />

        <div className="border-t border-zinc-800/80 pt-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            {careerStats.map((stat) => (
              <AthleteCareerStat key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.15rem] border border-zinc-800/80 bg-black/18 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-lime-300/18 bg-lime-300/8 text-lime-200">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{label}</span>
        <span className="mt-1 block line-clamp-2 break-words text-base font-semibold text-zinc-100">{value}</span>
      </span>
    </div>
  );
}

function AthleteCareerStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-[1.15rem] border border-zinc-800/80 bg-black/24 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/8 text-lime-100">
          <Icon className="size-4" />
        </div>
        <p className="text-right text-[11px] uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">{value}</p>
      <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function AthletePhoto({ initials, size }: { initials: string; size: "large" | "small" }) {
  const isLarge = size === "large";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/8 bg-[radial-gradient(circle_at_42%_22%,rgba(255,255,255,0.16),transparent_31%),linear-gradient(180deg,#27272a,#050505)] shadow-[0_18px_55px_rgba(0,0,0,0.34)]",
        isLarge ? "size-40 sm:size-44 2xl:size-48" : "size-14 sm:size-16"
      )}
    >
      <p className={cn("font-semibold tracking-tight text-zinc-50", isLarge ? "text-4xl" : "text-sm")}>
        {initials}
      </p>
    </div>
  );
}

function AthleteTitleMark({
  title,
  compact,
  className,
}: {
  title: AthleteProfile["titles"][number] | undefined;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2.5 text-lime-100/95",
        compact ? "text-sm font-semibold" : "text-lg font-semibold",
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-300/10 ring-1 ring-amber-200/15",
          compact ? "size-8" : "size-10"
        )}
      >
        {title?.asset ? (
          <Image
            src={title.asset}
            alt={title.name}
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            className={cn("object-contain", compact ? "size-8" : "size-10")}
            sizes={compact ? "32px" : "40px"}
          />
        ) : (
          <Trophy className={compact ? "size-4" : "size-5"} />
        )}
      </span>
      <span className="truncate">{title?.name ?? "Без титула"}</span>
    </div>
  );
}

function RankLevelMarks({ level, className }: { level: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center gap-1.5 font-semibold leading-none", className)}
      aria-label={`Уровень ${level} из 3`}
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <span
          key={index}
          className={index < level ? "text-lime-300 drop-shadow-[0_0_10px_rgba(190,242,100,0.24)]" : "text-zinc-700"}
        >
          {index < level ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

function rankAuraClass(score: number, compact = false) {
  if (score >= 11500) {
    return compact
      ? "bg-[radial-gradient(circle,rgba(250,204,21,0.42),rgba(168,85,247,0.24)_46%,transparent_72%)]"
      : "bg-[radial-gradient(circle,rgba(250,204,21,0.34),rgba(168,85,247,0.22)_42%,transparent_70%)]";
  }

  if (score >= 7200) {
    return compact
      ? "bg-[radial-gradient(circle,rgba(250,204,21,0.38),rgba(251,146,60,0.22)_48%,transparent_72%)]"
      : "bg-[radial-gradient(circle,rgba(250,204,21,0.3),rgba(251,146,60,0.18)_44%,transparent_70%)]";
  }

  if (score >= 4100) {
    return compact
      ? "bg-[radial-gradient(circle,rgba(103,232,249,0.34),rgba(190,242,100,0.2)_48%,transparent_72%)]"
      : "bg-[radial-gradient(circle,rgba(103,232,249,0.28),rgba(190,242,100,0.16)_44%,transparent_70%)]";
  }

  if (score >= 2000) {
    return compact
      ? "bg-[radial-gradient(circle,rgba(190,242,100,0.38),rgba(132,204,22,0.18)_48%,transparent_72%)]"
      : "bg-[radial-gradient(circle,rgba(190,242,100,0.3),rgba(132,204,22,0.15)_44%,transparent_70%)]";
  }

  if (score >= 750) {
    return compact
      ? "bg-[radial-gradient(circle,rgba(163,230,53,0.26),rgba(113,113,122,0.14)_50%,transparent_72%)]"
      : "bg-[radial-gradient(circle,rgba(163,230,53,0.2),rgba(113,113,122,0.12)_46%,transparent_70%)]";
  }

  return compact
    ? "bg-[radial-gradient(circle,rgba(161,161,170,0.24),rgba(82,82,91,0.12)_50%,transparent_72%)]"
    : "bg-[radial-gradient(circle,rgba(161,161,170,0.18),rgba(82,82,91,0.1)_46%,transparent_70%)]";
}

function SportReputationCard({
  reputation,
  onOpen,
}: {
  reputation: {
    rank: string;
    subtitle: string;
    progress: number;
    stars: number;
    score: number;
    asset?: string;
    nextRank: string | null;
  };
  onOpen: () => void;
}) {
  return (
    <aside className="relative flex min-h-[230px] items-center justify-center p-2 lg:min-h-[260px] 2xl:min-h-[292px]">
      <button
        id="profile-rank-trigger"
        type="button"
        onClick={onOpen}
        className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-center rounded-[1.6rem] text-center transition hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
        aria-label={`Открыть систему рангов. Текущий ранг: ${reputation.rank}`}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-[42%] h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-2xl 2xl:h-72 2xl:w-72",
            rankAuraClass(reputation.score)
          )}
        />
        <span className="pointer-events-none absolute left-1/2 top-[42%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/4 blur-xl" />
        {reputation.asset ? (
          <Image
            src={reputation.asset}
            alt={reputation.rank}
            width={172}
            height={196}
            className="relative z-10 h-36 w-auto object-contain drop-shadow-[0_20px_34px_rgba(0,0,0,0.48)] 2xl:h-40"
            sizes="172px"
            priority
          />
        ) : (
          <Trophy className="relative z-10 size-16 text-lime-200" />
        )}
        <p className="relative z-10 mt-4 text-2xl font-semibold uppercase tracking-[0.04em] text-zinc-50 2xl:text-3xl">
          {reputation.rank}
        </p>
        <RankLevelMarks level={reputation.stars} className="relative z-10 mt-2 text-2xl 2xl:text-3xl" />
      </button>
    </aside>
  );
}

function CompactClientHeader({
  athlete,
  onOpenReputation,
}: {
  athlete: AthleteProfile;
  onOpenReputation: () => void;
}) {
  const reputation = getAthleteReputation(athlete);
  const activeTitle = athlete.titles.find((title) => title.id === athlete.activeTitleId && title.isUnlocked);

  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-zinc-800/80 bg-[linear-gradient(135deg,rgba(24,24,27,0.78),rgba(5,5,5,0.9))] px-4 py-3 shadow-[0_20px_64px_rgba(0,0,0,0.24)] sm:px-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,1.2fr)_minmax(260px,0.8fr)_minmax(170px,0.45fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <AthletePhoto initials={athlete.initials} size="small" />
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-3xl lg:text-2xl xl:text-3xl">
              {athlete.name}
            </h2>
            <AthleteTitleMark title={activeTitle} compact className="mt-1" />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 border-zinc-800 lg:border-l lg:pl-4">
          <CompactMeta label="Цель" value={athlete.goal} />
          <CompactMeta label="Статус" value={athlete.status} />
        </div>

        <div className="border-zinc-800 lg:border-l lg:pl-4">
          <CompactRankSummary reputation={reputation} onOpen={onOpenReputation} />
        </div>
      </div>
    </section>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function CompactRankSummary({
  reputation,
  onOpen,
}: {
  reputation: {
    rank: string;
    subtitle: string;
    progress: number;
    stars: number;
    score: number;
    asset?: string;
    nextRank: string | null;
  };
  onOpen: () => void;
}) {
  return (
    <button
      id="profile-rank-trigger"
      type="button"
      onClick={onOpen}
      className="flex min-w-[168px] items-center gap-3 rounded-2xl text-left transition hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
      aria-label={`Открыть систему рангов. Текущий ранг: ${reputation.rank}`}
    >
      {reputation.asset ? (
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <span
            className={cn(
              "pointer-events-none absolute inset-[-10px] rounded-full opacity-90 blur-lg",
              rankAuraClass(reputation.score, true)
            )}
          />
          <Image
            src={reputation.asset}
            alt={reputation.rank}
            width={58}
            height={64}
            className="relative z-10 h-14 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.38)]"
            sizes="58px"
            priority
          />
        </span>
      ) : (
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <span className={cn("pointer-events-none absolute inset-[-10px] rounded-full opacity-90 blur-lg", rankAuraClass(reputation.score, true))} />
          <Trophy className="relative z-10 size-11 text-lime-200" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold uppercase tracking-[0.03em] text-zinc-50">{reputation.rank}</p>
        <RankLevelMarks level={reputation.stars} className="mt-1 justify-start text-lg" />
      </div>
    </button>
  );
}

function ReputationRankDialog({
  athlete,
  open,
  onOpenChange,
}: {
  athlete: AthleteProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentRankIndex = Math.max(
    athleteReputationRanks.findIndex((rank) => rank.id === athlete.reputation.rankId),
    0
  );
  const currentRank = athleteReputationRanks[currentRankIndex] ?? athleteReputationRanks[0];
  const nextRank = athleteReputationRanks[currentRankIndex + 1] ?? null;
  const unlockedCount = currentRankIndex + 1;
  const scoreToNext = nextRank ? Math.max(nextRank.minScore - athlete.reputation.score, 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] !max-w-[1120px] overflow-hidden rounded-[32px] border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">Rank system</p>
              <DialogTitle className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                Спортивная репутация {athlete.name}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                Ранги открываются по мере роста репутации: тренировки, стабильность, прогресс и достижения повышают статус спортсмена.
              </DialogDescription>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RankDialogStat label="Score" value={formatRankScore(athlete.reputation.score)} />
              <RankDialogStat label="Открыто" value={`${unlockedCount}/${athleteReputationRanks.length}`} />
              <RankDialogStat label="До след." value={nextRank ? formatRankScore(scoreToNext) : "max"} />
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(88vh-150px)] overflow-y-auto px-5 py-5 sm:px-6">
          <section className="grid gap-4 rounded-[28px] border border-lime-300/14 bg-lime-300/6 p-4 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
            <div className="flex items-center justify-center">
              {currentRank.asset ? (
                <Image
                  src={currentRank.asset}
                  alt={currentRank.name}
                  width={140}
                  height={160}
                  className="h-32 w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)]"
                  sizes="140px"
                />
              ) : (
                <Trophy className="size-20 text-lime-200" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-medium text-lime-100">
                  текущий ранг
                </span>
                <span className="rounded-full border border-zinc-800 bg-black/24 px-3 py-1.5 text-xs text-zinc-500">
                  {formatRankScore(athlete.reputation.score)} score
                </span>
              </div>
              <h3 className="mt-3 text-3xl font-semibold uppercase tracking-[0.04em] text-zinc-50">
                {currentRank.name}
              </h3>
              <RankLevelMarks level={currentRank.division} className="mt-3 justify-start text-2xl" />
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-500">
                    {nextRank ? `До ${nextRank.name}` : "Максимальный ранг открыт"}
                  </span>
                  <span className="font-medium text-zinc-200">
                    {nextRank ? `${athlete.reputation.progress}%` : "100%"}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.25)]"
                    style={{ width: `${nextRank ? athlete.reputation.progress : 100}%` }}
                  />
                </div>
                {nextRank ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    Нужно еще {formatRankScore(scoreToNext)} score, чтобы перейти на следующий уровень.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Все ранги</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Полученные, текущий и будущие уровни спортивной репутации.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-zinc-700 bg-black/20 text-zinc-300 hover:bg-zinc-900"
                onClick={() => onOpenChange(false)}
              >
                Закрыть
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {athleteReputationRanks.map((rank, index) => (
                <RankCatalogCard
                  key={rank.id}
                  rank={rank}
                  state={index < currentRankIndex ? "unlocked" : index === currentRankIndex ? "current" : "locked"}
                />
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RankDialogStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-zinc-800 bg-black/24 p-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function RankCatalogCard({
  rank,
  state,
}: {
  rank: (typeof athleteReputationRanks)[number];
  state: "unlocked" | "current" | "locked";
}) {
  const isLocked = state === "locked";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[26px] border p-4",
        state === "current"
          ? "border-lime-300/30 bg-lime-300/8"
          : state === "unlocked"
            ? "border-zinc-800 bg-black/24"
            : "border-zinc-900 bg-black/14 opacity-62"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex size-16 shrink-0 items-center justify-center">
          {rank.asset ? (
            <Image
              src={rank.asset}
              alt={rank.name}
              width={64}
              height={72}
              className={cn(
                "h-16 w-auto object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)]",
                isLocked ? "grayscale" : ""
              )}
              sizes="64px"
            />
          ) : (
            <Trophy className={cn("size-10", isLocked ? "text-zinc-700" : "text-lime-200")} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-base font-semibold uppercase tracking-[0.03em] text-zinc-50">{rank.name}</h4>
            <RankStateBadge state={state} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">от {formatRankScore(rank.minScore)} score</p>
          <RankLevelMarks level={rank.division} className="mt-2 justify-start text-lg" />
        </div>
      </div>
    </article>
  );
}

function RankStateBadge({ state }: { state: "unlocked" | "current" | "locked" }) {
  if (state === "current") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-lime-300/24 bg-lime-300/10 text-lime-100">
        <Trophy className="size-3.5" />
      </span>
    );
  }

  if (state === "unlocked") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/8 text-lime-100">
        <CheckCircle2 className="size-3.5" />
      </span>
    );
  }

  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-600">
      <Lock className="size-3.5" />
    </span>
  );
}

function getAthleteCareerStats(athlete: AthleteProfile) {
  return [
    {
      icon: Dumbbell,
      label: "Тренировки",
      value: String(athlete.career.completedWorkouts),
      detail: "пройдено всего",
    },
    {
      icon: Weight,
      label: "Вес",
      value: athlete.career.weightChange,
      detail: `${athlete.currentWeight} сейчас`,
    },
    {
      icon: Flame,
      label: "Серия",
      value: `${athlete.career.streakDays} ${getDayWord(athlete.career.streakDays)}`,
      detail: athlete.adherence.label,
    },
  ];
}

function getDayWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function getAthleteReputation(athlete: AthleteProfile) {
  return getAthleteReputationView(athlete.reputation);
}

function formatRankScore(score: number) {
  return new Intl.NumberFormat("ru-RU").format(score);
}

function getClubTenureLabel(athlete: AthleteProfile) {
  const compactExperience = athlete.trainingExperience.match(/^\d+\s+[^\s,]+/u)?.[0];

  return compactExperience ?? `с ${formatProfileDate(athlete.membership.addedAt)}`;
}
