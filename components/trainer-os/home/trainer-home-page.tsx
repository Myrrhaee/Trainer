"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";

import { ActionStoriesCarousel } from "./action-stories-carousel";
import { EmptyTeamState } from "./empty-team-state";
import {
  getCalmTeam,
  getTeamSummary,
  secondaryAttentionItems,
  teamActivityItems,
  trainerHomeClients,
  trainerHomeMockMode,
} from "./mock-data";
import { SecondaryAttentionPanel } from "./secondary-attention-panel";
import { TeamActivityFeed } from "./team-activity-feed";
import { TeamHqHero } from "./team-hq-hero";
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
  {
    ssr: false,
    loading: () => null,
  }
);

const QuickAssignDrawer = dynamic(
  () => import("@/components/trainer-os/quick-assign/quick-assign-drawer").then((mod) => mod.QuickAssignDrawer),
  {
    ssr: false,
    loading: () => null,
  }
);

const WorkoutReviewDrawer = dynamic(
  () => import("@/components/trainer-os/workout-review/workout-review-drawer").then((mod) => mod.WorkoutReviewDrawer),
  {
    ssr: false,
    loading: () => null,
  }
);

function getInitialClients() {
  if (trainerHomeMockMode === "empty") return [];
  if (trainerHomeMockMode === "calm") return getCalmTeam(trainerHomeClients);
  return trainerHomeClients;
}

export function TrainerHomePage() {
  const [clients, setClients] = useState<TeamClient[]>(getInitialClients);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeActivityClientId, setActiveActivityClientId] = useState<string | null>(null);
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());
  const [hiddenActivityIds, setHiddenActivityIds] = useState<Set<string>>(() => new Set());
  const [lifecycleClientId, setLifecycleClientId] = useState<string | null>(null);
  const [quickAssignClient, setQuickAssignClient] = useState<TeamClient | null>(null);
  const [workoutReviewClient, setWorkoutReviewClient] = useState<TeamClient | null>(null);
  const livingTeamMapRef = useRef<HTMLElement | null>(null);
  const actionStoriesRef = useRef<HTMLElement | null>(null);
  const lifecycleTimeout = useRef<number | null>(null);

  const summary = useMemo(() => getTeamSummary(clients), [clients]);
  const actionClients = useMemo(() => getActionClients(clients), [clients]);
  const visibleActivityItems = useMemo(
    () => teamActivityItems.filter((item) => !hiddenActivityIds.has(item.id)),
    [hiddenActivityIds]
  );
  const unreadActivityItems = useMemo(
    () => visibleActivityItems.filter((item) => !isActivityRead(item, readActivityIds)),
    [readActivityIds, visibleActivityItems]
  );
  const selectedClient = useMemo(
    () => (selectedClientId ? clients.find((client) => client.id === selectedClientId) ?? null : null),
    [clients, selectedClientId]
  );
  const selectedActivityItem = useMemo(
    () => (selectedActivityId ? visibleActivityItems.find((item) => item.id === selectedActivityId) ?? null : null),
    [selectedActivityId, visibleActivityItems]
  );
  const highlightedActivityClientId = activeActivityClientId ?? (activityDrawerOpen ? selectedActivityItem?.clientId ?? null : null);

  useEffect(() => {
    return () => {
      if (lifecycleTimeout.current) {
        window.clearTimeout(lifecycleTimeout.current);
      }
    };
  }, []);

  function focusActionQueue() {
    const firstActionClient = actionClients[0] ?? null;

    if (firstActionClient) {
      setSelectedClientId(firstActionClient.id);
      setActiveActivityClientId(null);
    }

    window.requestAnimationFrame(() => {
      actionStoriesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function completeAction(clientId: string) {
    const nextClientId = getActionClients(clients).find((client) => client.id !== clientId)?.id ?? null;

    if (lifecycleTimeout.current) {
      window.clearTimeout(lifecycleTimeout.current);
    }
    setLifecycleClientId(clientId);
    lifecycleTimeout.current = window.setTimeout(() => {
      setLifecycleClientId(null);
      lifecycleTimeout.current = null;
    }, 5400);

    setClients((currentClients) =>
      currentClients.map((client) => {
        if (client.id !== clientId) return client;

        return {
          ...client,
          state: "on_track",
          stateLabel: "По плану",
          progressTrend: "up",
          priority: "low",
          issue: undefined,
          context: undefined,
          primaryAction: undefined,
          lastActivity: "сейчас",
          nextWorkout: client.nextWorkout ?? "Следующая тренировка назначена",
        };
      })
    );
    setSelectedClientId(nextClientId);
    toast.success(nextClientId ? "Клиент получил следующий шаг. Открыт следующий." : "Все клиенты получили следующий шаг");
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
    scrollToLivingTeamMap(livingTeamMapRef.current);
  }

  function markActivityRead(eventId: string) {
    setReadActivityIds((currentIds) => {
      if (currentIds.has(eventId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(eventId);
      return nextIds;
    });
  }

  function hideActivityEvent(eventId: string) {
    setHiddenActivityIds((currentIds) => {
      if (currentIds.has(eventId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(eventId);
      return nextIds;
    });
    setReadActivityIds((currentIds) => {
      if (currentIds.has(eventId)) return currentIds;
      const nextIds = new Set(currentIds);
      nextIds.add(eventId);
      return nextIds;
    });
    setSelectedActivityId((currentId) => (currentId === eventId ? null : currentId));
    setActiveActivityClientId(null);
  }

  function assignWorkout(clientId: string) {
    completeAction(clientId);
    setQuickAssignClient(null);
  }

  function assignWorkoutAndNext(clientId: string) {
    completeAction(clientId);
    const nextClient = actionClients.find((client) => client.id !== clientId && client.primaryAction === "assign") ?? null;
    setQuickAssignClient(nextClient);
  }

  function sendReview(clientId: string) {
    completeAction(clientId);
    setWorkoutReviewClient(null);
  }

  function sendReviewAndAssign(client: TeamClient) {
    completeAction(client.id);
    setWorkoutReviewClient(null);
    setQuickAssignClient(client);
  }

  function openDemoTeam() {
    setClients(trainerHomeClients);
    setSelectedClientId(null);
  }

  return (
    <TrainerShell
      eyebrow="Главная тренера"
      title="Команда Романова"
      description="Состояние клиентов, важные действия и последние события."
    >
      <main className="min-h-screen bg-black px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
          {clients.length === 0 ? (
            <EmptyTeamState onOpenDemo={openDemoTeam} />
          ) : (
            <>
              <TeamHqHero summary={summary} activityItems={visibleActivityItems} onProcessClients={focusActionQueue} />

              <section ref={livingTeamMapRef} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
                <LivingTeamMap
                  clients={clients}
                  activityItems={unreadActivityItems}
                  activeActivityClientId={highlightedActivityClientId}
                  lifecycleClientId={lifecycleClientId}
                  selectedClientId={selectedClientId}
                  onSelectClient={(client) => setSelectedClientId(client.id)}
                  onClearSelection={() => setSelectedClientId(null)}
                />
                <ActionStoriesCarousel
                  clients={actionClients}
                  selectedClient={selectedClient}
                  selectedClientId={selectedClientId}
                  firstItemRef={actionStoriesRef}
                  onSelectClient={(client) => setSelectedClientId(client.id)}
                  onComplete={completeAction}
                />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <TeamActivityFeed
                  items={visibleActivityItems}
                  activeClientId={highlightedActivityClientId}
                  isEventRead={(item) => isActivityRead(item, readActivityIds)}
                  onActivityPreview={setActiveActivityClientId}
                  onOpenJournal={openActivityJournal}
                  onSelectEvent={selectActivityEvent}
                />
                <SecondaryAttentionPanel items={secondaryAttentionItems} />
              </section>
            </>
          )}
        </div>
      </main>
      {quickAssignClient ? (
        <QuickAssignDrawer
          client={quickAssignClient}
          open={Boolean(quickAssignClient)}
          onOpenChange={(open) => {
            if (!open) setQuickAssignClient(null);
          }}
          onAssign={assignWorkout}
          onAssignNext={assignWorkoutAndNext}
        />
      ) : null}
      {workoutReviewClient ? (
        <WorkoutReviewDrawer
          client={workoutReviewClient}
          open={Boolean(workoutReviewClient)}
          onOpenChange={(open) => {
            if (!open) setWorkoutReviewClient(null);
          }}
          onSendReview={sendReview}
          onSendReviewAndAssign={sendReviewAndAssign}
        />
      ) : null}
      {activityDrawerOpen ? (
        <ActivityDrawer
          open={activityDrawerOpen}
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
    <section className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Живая карта команды</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Спортсмены в текущем ритме</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Загружаем карту команды.</p>
        </div>
      </div>
      <div className="mt-5 h-[560px] overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_44%_42%,rgba(255,255,255,0.044),transparent_38%),linear-gradient(180deg,rgba(18,18,21,0.98),rgba(7,7,9,0.98))]">
        <div className="h-full w-full animate-pulse bg-[radial-gradient(circle_at_30%_52%,rgba(190,242,100,0.055),transparent_28%),radial-gradient(circle_at_75%_25%,rgba(248,113,113,0.045),transparent_24%)]" />
      </div>
    </section>
  );
}

function isActivityRead(item: TeamActivityItem, readActivityIds: Set<string>) {
  return !item.unread || readActivityIds.has(item.id);
}

function scrollToLivingTeamMap(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleRatio = visibleHeight / Math.min(rect.height, viewportHeight);
    const mostlyVisible = visibleRatio >= 0.55 && rect.top >= -80 && rect.top <= viewportHeight * 0.34;

    if (mostlyVisible) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = Math.max(window.scrollY + rect.top - 84, 0);

    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  });
}

const priorityWeight = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

function getActionClients(clients: TeamClient[]) {
  return clients
    .filter((client) => ["no_next_workout", "waiting_review", "needs_adjustment"].includes(client.state))
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
}
