"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { getDefaultWorkoutReviewSessionId, getTrainerDashboardView } from "@/components/trainer-os/demo-runtime/selectors";
import { useTrainerDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";

import { AttentionWorkspace } from "./attention-workspace";
import type { TrainerAttentionQueueItem, TrainerDashboardDemoMode } from "./dashboard-read-model";
import { DashboardStatusHeader } from "./dashboard-status-header";
import { EmptyTeamState } from "./empty-team-state";
import { TeamActivityFeed } from "./team-activity-feed";
import type { TeamActivityItem, TeamClient } from "./types";

const LivingTeamMap = dynamic(
  () => import("./living-team-map").then((mod) => mod.LivingTeamMap),
  {
    ssr: false,
    loading: () => <LivingTeamMapSkeleton />,
  }
);

const ActivityDrawer = dynamic(
  () => import("./activity-drawer").then((mod) => mod.ActivityDrawer),
  { ssr: false, loading: () => null }
);

const QuickAssignDrawer = dynamic(
  () => import("@/components/trainer-os/quick-assign/quick-assign-drawer").then((mod) => mod.QuickAssignDrawer),
  { ssr: false, loading: () => null }
);

const WorkoutReviewDrawer = dynamic(
  () => import("@/components/trainer-os/workout-review/workout-review-drawer").then((mod) => mod.WorkoutReviewDrawer),
  { ssr: false, loading: () => null }
);

type TrainerHomePageProps = {
  demoMode?: TrainerDashboardDemoMode;
};

export function TrainerHomePage({ demoMode = "team" }: TrainerHomePageProps) {
  const runtime = useTrainerDemoRuntime();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [resolutionReceipt, setResolutionReceipt] = useState<string | null>(null);
  const [activeActivityClientId, setActiveActivityClientId] = useState<string | null>(null);
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());
  const [hiddenActivityIds, setHiddenActivityIds] = useState<Set<string>>(() => new Set());
  const [lifecycleClientId, setLifecycleClientId] = useState<string | null>(null);
  const [quickAssignClient, setQuickAssignClient] = useState<TeamClient | null>(null);
  const [workoutReviewClient, setWorkoutReviewClient] = useState<TeamClient | null>(null);
  const attentionSectionRef = useRef<HTMLElement | null>(null);
  const lifecycleTimeout = useRef<number | null>(null);

  const dashboard = getTrainerDashboardView(runtime.state, demoMode);
  const { clients, attentionItems, selectedAttentionItem: currentAttentionItem, summary } = dashboard;
  const visibleActivityItems = useMemo(
    () => dashboard.teamActivity.filter((item) => !hiddenActivityIds.has(item.id)),
    [dashboard.teamActivity, hiddenActivityIds]
  );
  const unreadActivityItems = useMemo(
    () => visibleActivityItems.filter((item) => !isActivityRead(item, readActivityIds)),
    [readActivityIds, visibleActivityItems]
  );
  const selectedActivityItem = useMemo(
    () => (selectedActivityId ? visibleActivityItems.find((item) => item.id === selectedActivityId) ?? null : null),
    [selectedActivityId, visibleActivityItems]
  );
  const highlightedActivityClientId = activeActivityClientId ?? (activityDrawerOpen ? selectedActivityItem?.clientId ?? null : null);
  const mapSelectedClientId = previewClientId ?? selectedClientId ?? currentAttentionItem?.clientId ?? null;

  useEffect(() => {
    runtime.commands.recordPilotEvent({ name: "flow_started" });
    return () => {
      if (lifecycleTimeout.current) window.clearTimeout(lifecycleTimeout.current);
    };
  }, [runtime.commands]);

  function focusAttentionQueue() {
    if (currentAttentionItem) {
      runtime.commands.selectAttentionItem(currentAttentionItem.id);
      setSelectedClientId(currentAttentionItem.clientId);
    }
    attentionSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  }

  function selectAttentionItem(item: TrainerAttentionQueueItem) {
    runtime.commands.selectAttentionItem(item.id);
    setSelectedClientId(item.clientId);
    setResolutionReceipt(null);
  }

  function moveAttention(offset: -1 | 1) {
    if (!currentAttentionItem || attentionItems.length < 2) return;
    const currentIndex = attentionItems.findIndex((item) => item.id === currentAttentionItem.id);
    const nextIndex = (currentIndex + offset + attentionItems.length) % attentionItems.length;
    selectAttentionItem(attentionItems[nextIndex]);
  }

  function resolveAttentionItem(item: TrainerAttentionQueueItem, outcome = "Следующий шаг подтверждён") {
    const currentIndex = attentionItems.findIndex((candidate) => candidate.id === item.id);
    const remainingItems = attentionItems.filter((candidate) => candidate.id !== item.id);
    const nextItem = remainingItems[Math.min(Math.max(currentIndex, 0), remainingItems.length - 1)] ?? remainingItems[0] ?? null;

    const result = runtime.commands.resolveAttentionItemManually({
      actor: runtime.actor,
      athleteId: item.clientId,
      attentionItemId: item.id,
      workoutSessionId: runtime.state.attentionItems.find((candidate) => candidate.id === item.id)?.workoutSessionId,
      reason: outcome,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setSelectedClientId(nextItem?.clientId ?? null);
    setResolutionReceipt(`${item.client.name}: ${outcome}. ${nextItem ? `Дальше — ${nextItem.client.name}.` : "Открытых задач больше нет."}`);

    if (item.client.state !== "inactive") showLifecycle(item.clientId);

    toast.success(nextItem ? "Задача закрыта. Открыта следующая." : "Все задачи обработаны");
  }

  function showLifecycle(clientId: string) {
    if (lifecycleTimeout.current) window.clearTimeout(lifecycleTimeout.current);
    setLifecycleClientId(clientId);
    lifecycleTimeout.current = window.setTimeout(() => {
      setLifecycleClientId(null);
      lifecycleTimeout.current = null;
    }, 1800);
  }

  function selectMapClient(client: TeamClient) {
    setSelectedClientId(client.id);
    const relatedItem = attentionItems.find((item) => item.clientId === client.id);
    if (relatedItem) runtime.commands.selectAttentionItem(relatedItem.id);
  }

  function selectActivityEvent(item: TeamActivityItem) {
    setSelectedActivityId(item.id);
    setActiveActivityClientId(item.clientId);
    setSelectedClientId(item.clientId);
    markActivityRead(item.id);
  }

  function openActivityJournal() {
    setSelectedActivityId(null);
    setActiveActivityClientId(null);
    setActivityDrawerOpen(true);
  }

  function markActivityRead(eventId: string) {
    setReadActivityIds((currentIds) => new Set(currentIds).add(eventId));
  }

  function hideActivityEvent(eventId: string) {
    setHiddenActivityIds((currentIds) => new Set(currentIds).add(eventId));
    setReadActivityIds((currentIds) => new Set(currentIds).add(eventId));
    setSelectedActivityId((currentId) => (currentId === eventId ? null : currentId));
    setActiveActivityClientId(null);
  }

  function openDemoTeam() {
    window.location.assign("/trainer/dashboard");
  }

  return (
    <TrainerShell
      eyebrow="Главная тренера"
      title="Команда Романова"
      description="Состояние команды и следующий рабочий шаг."
    >
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
          {clients.length === 0 ? (
            <EmptyTeamState onOpenDemo={openDemoTeam} />
          ) : (
            <>
              <DashboardStatusHeader summary={summary} onOpenAttention={focusAttentionQueue} />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(390px,5fr)] xl:items-start">
                <AttentionWorkspace
                  items={attentionItems}
                  currentItemId={currentAttentionItem?.id ?? null}
                  resolutionReceipt={resolutionReceipt}
                  sectionRef={attentionSectionRef}
                  onSelectItem={selectAttentionItem}
                  onPreviewClient={setPreviewClientId}
                  onMove={moveAttention}
                  onResolve={resolveAttentionItem}
                  onQuickAssign={setQuickAssignClient}
                  onWorkoutReview={setWorkoutReviewClient}
                />
                <LivingTeamMap
                  clients={clients}
                  activityItems={unreadActivityItems}
                  activeActivityClientId={highlightedActivityClientId}
                  lifecycleClientId={lifecycleClientId}
                  selectedClientId={mapSelectedClientId}
                  onSelectClient={selectMapClient}
                  onClearSelection={() => {
                    setSelectedClientId(null);
                    setPreviewClientId(null);
                  }}
                />
              </div>

              <TeamActivityFeed
                items={visibleActivityItems}
                activeClientId={highlightedActivityClientId}
                isEventRead={(item) => isActivityRead(item, readActivityIds)}
                onActivityPreview={setActiveActivityClientId}
                onOpenJournal={openActivityJournal}
                onSelectEvent={selectActivityEvent}
              />
            </>
          )}
        </div>
      </main>

      {quickAssignClient ? (
        <QuickAssignDrawer
          key={quickAssignClient.id}
          athleteId={quickAssignClient.id}
          context={{
            source: "dashboard",
            reason: quickAssignClient.context ?? quickAssignClient.issue,
            attentionItemId: runtime.state.attentionItems.find((item) => item.athleteId === quickAssignClient.id && item.status === "active")?.id,
            returnTo: "/trainer/dashboard#attention-heading",
          }}
          open
          onOpenChange={(open) => {
            if (!open) setQuickAssignClient(null);
          }}
          onAssigned={(receipt) => {
            setResolutionReceipt(`${receipt.athleteName}: ${receipt.templateTitle} назначена.`);
            showLifecycle(receipt.athleteId);
          }}
          onNextAthlete={(receipt) => {
            const nextAssignment = attentionItems.find(
              (item) => item.clientId !== receipt.athleteId && item.primaryAction === "assign"
            );
            if (nextAssignment) setQuickAssignClient(nextAssignment.client);
            else setQuickAssignClient(null);
          }}
        />
      ) : null}

      {workoutReviewClient ? (
        <WorkoutReviewDrawer
          sessionId={getDefaultWorkoutReviewSessionId(runtime.state, workoutReviewClient.id) ?? null}
          open
          source="dashboard"
          attentionItemId={runtime.state.attentionItems.find((item) => item.athleteId === workoutReviewClient.id && item.status === "active")?.id}
          onOpenChange={(open) => {
            if (!open) setWorkoutReviewClient(null);
          }}
          onResolved={(clientId, kind) => {
            setResolutionReceipt(`${workoutReviewClient.name}: ${kind === "manual" ? "задача закрыта с причиной" : "feedback отправлен"}.`);
            showLifecycle(clientId);
          }}
          onAssignNext={(client) => {
            setWorkoutReviewClient(null);
            setQuickAssignClient(client);
          }}
        />
      ) : null}

      {activityDrawerOpen ? (
        <ActivityDrawer
          open
          items={visibleActivityItems}
          selectedEventId={selectedActivityId}
          isEventRead={(item) => isActivityRead(item, readActivityIds)}
          onOpenChange={(open) => {
            setActivityDrawerOpen(open);
            if (!open) setActiveActivityClientId(null);
          }}
          onHoverEvent={setActiveActivityClientId}
          onSelectEvent={selectActivityEvent}
          onMarkRead={markActivityRead}
          onHideEvent={hideActivityEvent}
        />
      ) : null}
    </TrainerShell>
  );
}

function LivingTeamMapSkeleton() {
  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Живая карта команды</p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-50">Спортсмены в текущем ритме</h2>
      <div className="mt-5 h-[420px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/30 sm:h-[500px] xl:h-[560px]" />
    </section>
  );
}

function isActivityRead(item: TeamActivityItem, readActivityIds: Set<string>) {
  return !item.unread || readActivityIds.has(item.id);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
