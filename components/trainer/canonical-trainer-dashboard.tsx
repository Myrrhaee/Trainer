"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { buildCanonicalTrainerDashboardView } from "@/components/trainer/canonical-trainer-dashboard-model";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { AttentionWorkspace } from "@/components/trainer-os/home/attention-workspace";
import { DashboardStatusHeader } from "@/components/trainer-os/home/dashboard-status-header";
import { EmptyTeamState } from "@/components/trainer-os/home/empty-team-state";
import { TeamActivityFeed } from "@/components/trainer-os/home/team-activity-feed";
import type { TeamActivityItem, TeamClient } from "@/components/trainer-os/home/types";
import type { TrainerDashboardSnapshot } from "@/lib/server/trainer-dashboard/trainer-dashboard-types";
import { WorkflowReturnReceipt } from "@/components/trainer/workflow-return-receipt";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";
import { quickAssignHref } from "@/lib/quick-assign-navigation";

const LivingTeamMap = dynamic(
  () => import("@/components/trainer-os/home/living-team-map").then((module) => module.LivingTeamMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

const ActivityDrawer = dynamic(
  () => import("@/components/trainer-os/home/activity-drawer").then((module) => module.ActivityDrawer),
  { ssr: false, loading: () => null },
);

export function CanonicalTrainerDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<TrainerDashboardSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedAttentionId, setSelectedAttentionId] = useState<string | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [activeActivityClientId, setActiveActivityClientId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(() => new Set());
  const [hiddenActivityIds, setHiddenActivityIds] = useState<Set<string>>(() => new Set());
  const attentionSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trainer/dashboard", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("dashboard_load_failed");
        return response.json() as Promise<TrainerDashboardSnapshot>;
      })
      .then((value) => {
        if (!cancelled) setSnapshot(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  const dashboard = useMemo(
    () => snapshot ? buildCanonicalTrainerDashboardView(snapshot) : null,
    [snapshot],
  );
  const visibleActivities = useMemo(
    () => dashboard?.activities.filter((item) => !hiddenActivityIds.has(item.id)) ?? [],
    [dashboard?.activities, hiddenActivityIds],
  );
  const unreadActivities = useMemo(
    () => visibleActivities.filter((item) => item.unread && !readActivityIds.has(item.id)),
    [readActivityIds, visibleActivities],
  );
  const requestedPosition = Number(searchParams.get("position"));
  const queueFocusRequested = searchParams.get("focus") === "queue";
  const restoredAttention = dashboard?.attentionItems.length && Number.isInteger(requestedPosition) && requestedPosition >= 0
    ? dashboard.attentionItems[Math.min(requestedPosition, dashboard.attentionItems.length - 1)]
    : null;
  const currentAttention = dashboard?.attentionItems.find((item) => item.id === selectedAttentionId)
    ?? dashboard?.attentionItems.find((item) => item.clientId === selectedClientId)
    ?? restoredAttention
    ?? dashboard?.attentionItems[0]
    ?? null;
  const selectedActivity = selectedActivityId
    ? visibleActivities.find((item) => item.id === selectedActivityId) ?? null
    : null;
  const highlightedActivityClientId = activeActivityClientId
    ?? (activityDrawerOpen ? selectedActivity?.clientId ?? null : null);
  const mapSelectedClientId = previewClientId ?? selectedClientId ?? currentAttention?.clientId ?? null;
  const receiptId = searchParams.get("receiptId");
  const receiptKind = searchParams.get("receipt");
  const receiptActivity = receiptId && /^[0-9a-f-]{36}$/i.test(receiptId)
    ? snapshot?.activities.find((item) => item.id === `${receiptKind === "assignment" ? "assignment" : "feedback"}:${receiptId}`)
    : null;
  useEffect(() => {
    if (!dashboard?.attentionItems.length || !Number.isInteger(requestedPosition) || requestedPosition < 0) return;
    if (!queueFocusRequested) return;
    const frame = window.requestAnimationFrame(() => {
      attentionSectionRef.current?.focus({ preventScroll: true });
      attentionSectionRef.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dashboard?.attentionItems, queueFocusRequested, requestedPosition]);

  function selectActivity(item: TeamActivityItem) {
    setSelectedAttentionId(null);
    setSelectedActivityId(item.id);
    setSelectedClientId(item.clientId);
    setActiveActivityClientId(item.clientId);
    setReadActivityIds((current) => new Set(current).add(item.id));
  }

  function moveAttention(offset: -1 | 1) {
    if (!dashboard || !currentAttention || dashboard.attentionItems.length < 2) return;
    const index = dashboard.attentionItems.findIndex((item) => item.id === currentAttention.id);
    const next = dashboard.attentionItems[(index + offset + dashboard.attentionItems.length) % dashboard.attentionItems.length];
    setSelectedAttentionId(next.id);
    setSelectedClientId(next.clientId);
  }

  function openReview(client: TeamClient) {
    const review = currentAttention?.clientId === client.id && currentAttention.reviewHref ? currentAttention
      : dashboard?.attentionItems.find((item) => item.clientId === client.id && item.reviewHref);
    if (review?.reviewHref) {
      const sessionId = review.reviewHref.split("/trainer/review/")[1]?.split("?")[0];
      if (!sessionId) return;
      router.push(trainerWorkflowHref(`/trainer/review/${sessionId}`, createTrainerWorkflowContext({
        origin: "dashboard",
        athleteUserId: client.id,
        sourceAttentionItemId: review.id,
        sourceSessionId: sessionId,
        queue: {
          filter: "all",
          order: "priority",
          position: dashboard?.attentionItems.findIndex((item) => item.id === review.id) ?? 0,
        },
        returnTo: "/trainer/dashboard",
        returnAnchor: "workflow-receipt",
      })));
    }
  }

  function openAssignment(client: TeamClient) {
    const position = dashboard?.attentionItems.findIndex((item) => item.clientId === client.id) ?? 0;
    router.push(quickAssignHref({ athleteUserId: client.id, context: createTrainerWorkflowContext({
      origin: "dashboard",
      athleteUserId: client.id,
      queue: { filter: "all", order: "priority", position: Math.max(0, position) },
      returnTo: "/trainer/dashboard",
      returnAnchor: "workflow-receipt",
    }) }));
  }

  return (
    <TrainerShell
      eyebrow="Главная тренера"
      title="Команда"
      description="Состояние спортсменов, рабочие решения и последние события."
    >
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
          {!dashboard && !failed ? (
            <div className="grid min-h-[66vh] place-items-center" aria-label="Загрузка главной тренера">
              <Loader2 className="size-6 animate-spin text-zinc-500" />
            </div>
          ) : failed ? (
            <section className="grid min-h-[66vh] place-items-center text-center">
              <div>
                <AlertCircle className="mx-auto size-9 text-red-300" />
                <h2 className="mt-4 text-xl font-semibold">Не удалось загрузить состояние команды</h2>
                <p className="mt-2 text-sm text-zinc-500">Обновите страницу и повторите попытку.</p>
              </div>
            </section>
          ) : dashboard?.clients.length === 0 && dashboard.attentionItems.length === 0 ? (
            <EmptyTeamState />
          ) : dashboard ? (
            <>
              {receiptActivity ? (
                <WorkflowReturnReceipt receipt={{
                  id: receiptId!,
                  title: receiptKind === "assignment" ? "Тренировка назначена" : "Обратная связь сохранена",
                  detail: `${receiptActivity.athleteDisplayName} · ${receiptActivity.detail}`,
                  focusTarget: "workflow-receipt",
                }} />
              ) : null}
              <DashboardStatusHeader
                summary={dashboard.summary}
                onOpenAttention={() => attentionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(390px,5fr)] xl:items-start">
                <AttentionWorkspace
                  items={dashboard.attentionItems}
                  currentItemId={currentAttention?.id ?? null}
                  resolutionReceipt={null}
                  sectionRef={attentionSectionRef}
                  onSelectItem={(item) => { setSelectedAttentionId(item.id); setSelectedClientId(item.clientId); }}
                  onPreviewClient={setPreviewClientId}
                  onMove={moveAttention}
                  onResolve={() => undefined}
                  onQuickAssign={openAssignment}
                  onWorkoutReview={openReview}
                  allowManualResolve={false}
                />
                <LivingTeamMap
                  clients={dashboard.clients}
                  activityItems={unreadActivities}
                  activeActivityClientId={highlightedActivityClientId}
                  selectedClientId={mapSelectedClientId}
                  onSelectClient={(client) => { setSelectedAttentionId(null); setSelectedClientId(client.id); }}
                  onClearSelection={() => {
                    setSelectedClientId(null);
                    setSelectedAttentionId(null);
                    setPreviewClientId(null);
                  }}
                />
              </div>

              <TeamActivityFeed
                items={visibleActivities}
                activeClientId={highlightedActivityClientId}
                isEventRead={(item) => !item.unread || readActivityIds.has(item.id)}
                onActivityPreview={setActiveActivityClientId}
                onOpenJournal={() => setActivityDrawerOpen(true)}
                onSelectEvent={selectActivity}
              />
            </>
          ) : null}
        </div>
      </main>

      {activityDrawerOpen ? (
        <ActivityDrawer
          open
          items={visibleActivities}
          selectedEventId={selectedActivityId}
          isEventRead={(item) => !item.unread || readActivityIds.has(item.id)}
          onOpenChange={(open) => {
            setActivityDrawerOpen(open);
            if (!open) setActiveActivityClientId(null);
          }}
          onHoverEvent={setActiveActivityClientId}
          onSelectEvent={selectActivity}
          onMarkRead={(eventId) => setReadActivityIds((current) => new Set(current).add(eventId))}
          onHideEvent={(eventId) => setHiddenActivityIds((current) => new Set(current).add(eventId))}
        />
      ) : null}
    </TrainerShell>
  );
}

function MapSkeleton() {
  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-5">
      <p className="text-xs font-medium uppercase text-zinc-500">Живая карта команды</p>
      <div className="mt-5 h-[420px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/30 sm:h-[500px] xl:h-[560px]" />
    </section>
  );
}
