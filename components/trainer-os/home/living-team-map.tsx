"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { TeamNode } from "./team-node";
import type { TeamActivityItem, TeamClient } from "./types";

type MapPlacement = {
  client: TeamClient;
  index: number;
  x: number;
  y: number;
  locked: boolean;
};

type LivingTeamMapProps = {
  clients: TeamClient[];
  activityItems?: TeamActivityItem[];
  activeActivityClientId?: string | null;
  lifecycleClientId?: string | null;
  selectedClientId: string | null;
  onSelectClient: (client: TeamClient) => void;
  onClearSelection: () => void;
};

export function LivingTeamMap({
  clients,
  activityItems = [],
  activeActivityClientId = null,
  lifecycleClientId = null,
  selectedClientId,
  onSelectClient,
  onClearSelection,
}: LivingTeamMapProps) {
  const router = useRouter();
  const [hoveredClientId, setHoveredClientId] = useState<string | null>(null);
  const teamHealth = getTeamHealthVisuals(clients);
  const activityByClientId = new Map(activityItems.map((item) => [item.clientId, item]));
  const placements = getResolvedPlacements(clients, selectedClientId, lifecycleClientId);
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  function openClient(client: TeamClient) {
    router.push(`/trainer/clients/${client.id}?from=dashboard&entry=map`);
  }

  return (
    <section aria-labelledby="team-map-heading" className="rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Живая карта команды</p>
          <h2 id="team-map-heading" className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Спортсмены в текущем ритме</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Видно, кто идет по плану, а кому нужен следующий шаг.
          </p>
        </div>
        <StatusLegend />
      </div>

      <div
        className={cn(
          "trainer-team-field relative mt-5 h-[420px] overflow-hidden rounded-lg border border-zinc-800/80 bg-[radial-gradient(circle_at_44%_42%,rgba(255,255,255,0.044),transparent_38%),linear-gradient(180deg,rgba(18,18,21,0.98),rgba(7,7,9,0.98))] sm:h-[500px] xl:h-[560px]",
          teamHealth.hasCritical && "trainer-team-field-busy"
        )}
        onClick={onClearSelection}
        aria-label="Карта команды. Нажмите на пустое место, чтобы сбросить выбор клиента."
      >
        <div
          className="trainer-team-diagonal pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{
            background: `linear-gradient(34deg, rgba(163,230,53,${teamHealth.calmDiagonal}) 0%, rgba(39,39,42,0.008) 44%, rgba(250,204,21,${teamHealth.watchDiagonal}) 62%, rgba(248,113,113,${teamHealth.decisionDiagonal}) 100%)`,
          }}
        />
        <div
          className="trainer-team-ambient-calm pointer-events-none absolute -bottom-32 -left-28 h-80 w-[40rem] rounded-full blur-3xl transition-opacity duration-700"
          style={{ backgroundColor: `rgba(190,242,100,${teamHealth.calmCloud})` }}
        />
        <div
          className="trainer-team-ambient-watch pointer-events-none absolute left-[34%] top-[35%] h-72 w-[36rem] rounded-full blur-3xl transition-opacity duration-700"
          style={{ backgroundColor: `rgba(252,211,77,${teamHealth.watchCloud})` }}
        />
        <div
          className="trainer-team-ambient-decision pointer-events-none absolute -right-28 -top-28 h-96 w-[44rem] rounded-full blur-3xl transition-opacity duration-700"
          style={{ backgroundColor: `rgba(248,113,113,${teamHealth.decisionCloud})` }}
        />
        <div
          className="trainer-team-ambient-rose pointer-events-none absolute right-[8%] top-[10%] h-64 w-[32rem] rounded-full blur-3xl transition-opacity duration-700"
          style={{ backgroundColor: `rgba(253,164,175,${teamHealth.roseCloud})` }}
        />
        <div className="pointer-events-none absolute -bottom-24 right-4 h-56 w-[24rem] rounded-full bg-zinc-500/[0.026] blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_46%_48%,rgba(255,255,255,0.026)_0%,transparent_38%),radial-gradient(circle_at_50%_52%,transparent_0%,rgba(0,0,0,0.16)_76%,rgba(0,0,0,0.34)_100%)]" />
        {clients.map((client, index) => {
          const placement = getInteractivePlacement(
            client,
            hoveredClientId,
            placements
          );
          const activity = activityByClientId.get(client.id);
          return (
            <TeamNode
              key={client.id}
              client={client}
              totalClients={clients.length}
              eventType={activity?.type ?? null}
              eventActive={activeActivityClientId === client.id}
              lifecycleActive={lifecycleClientId === client.id}
              zoneShiftActive={false}
              selected={selectedClientId === client.id}
              dimmed={Boolean(selectedClientId && selectedClientId !== client.id)}
              pushed={Boolean(hoveredClientId && hoveredClientId !== client.id && placement.wasRepelled)}
              x={placement.x}
              y={placement.y}
              delay={index}
              onSelect={onSelectClient}
              onOpen={openClient}
              onHoverChange={setHoveredClientId}
            />
          );
        })}
      </div>

      {selectedClient ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800/70 pt-3" aria-live="polite">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{selectedClient.name}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{selectedClient.stateLabel} · {selectedClient.goal}</p>
          </div>
          <button
            type="button"
            onClick={() => openClient(selectedClient)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-700 bg-black/25 px-3 text-sm text-zinc-200 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70"
          >
            Профиль
            <ArrowRight className="size-4" />
          </button>
        </div>
      ) : null}

      <style>{`
        @keyframes trainerTeamFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          18% { transform: translate3d(var(--float-x-soft, 1px), var(--float-y-soft, -2px), 0); }
          38% { transform: translate3d(var(--float-x, 0), var(--float-y, -4px), 0); }
          62% { transform: translate3d(var(--float-x-2, 1px), var(--float-y-2, 2px), 0); }
          84% { transform: translate3d(var(--float-x-3, -1px), var(--float-y-3, 1px), 0); }
        }

        @keyframes trainerTeamAmbientCalm {
          0%, 100% { opacity: 0.82; transform: translate3d(0, 0, 0) scale(1); }
          50% { opacity: 1; transform: translate3d(10px, -6px, 0) scale(1.035); }
        }

        @keyframes trainerTeamAmbientWatch {
          0%, 100% { opacity: 0.7; transform: translate3d(0, 0, 0) scale(1); }
          48% { opacity: 0.96; transform: translate3d(-8px, 5px, 0) scale(1.028); }
        }

        @keyframes trainerTeamAmbientDecision {
          0%, 100% { opacity: 0.74; transform: translate3d(0, 0, 0) scale(1); }
          50% { opacity: 1; transform: translate3d(-10px, 8px, 0) scale(1.04); }
        }

        @keyframes trainerTeamDiagonalBreath {
          0%, 100% { opacity: 0.92; }
          50% { opacity: 1; }
        }

        @keyframes trainerTeamRedPulse {
          0%, 100% { opacity: 0.34; transform: scale(0.96); }
          50% { opacity: 0.72; transform: scale(1.12); }
        }

        @keyframes trainerTeamAmberPulse {
          0%, 100% { opacity: 0.24; transform: scale(0.98); }
          50% { opacity: 0.46; transform: scale(1.08); }
        }

        @keyframes trainerTeamOnlineOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes trainerTeamSuccessFlash {
          0% { opacity: 0; transform: scale(0.86); }
          18% { opacity: 0.72; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.32); }
        }

        @keyframes trainerTeamEventRipple {
          0%, 100% { transform: scale(0.95); opacity: 0.36; }
          52% { transform: scale(1.13); opacity: 0.72; }
        }

        @keyframes trainerTeamEventFocus {
          0%, 100% { transform: scale(0.92); opacity: 0.16; }
          48% { transform: scale(1.18); opacity: 0.34; }
        }

        @keyframes trainerTeamLifecycleWake {
          0% { opacity: 0; transform: scale(0.72); }
          22% { opacity: 0.32; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.62); }
        }

        .trainer-team-red-pulse {
          animation: trainerTeamRedPulse 2.8s ease-in-out infinite;
        }

        .trainer-team-amber-pulse {
          animation: trainerTeamAmberPulse 3.6s ease-in-out infinite;
        }

        .trainer-team-online-orbit {
          animation: trainerTeamOnlineOrbit 11s linear infinite;
        }

        .trainer-team-success-flash {
          animation: trainerTeamSuccessFlash 1100ms ease-out forwards;
        }

        .trainer-team-event-ripple {
          animation: trainerTeamEventRipple 5.8s ease-in-out infinite;
        }

        .trainer-team-event-focus {
          animation: trainerTeamEventFocus 2.4s ease-in-out infinite;
          filter: blur(2px);
        }

        .trainer-team-lifecycle-wake {
          animation: trainerTeamLifecycleWake 1800ms ease-out forwards;
          filter: blur(3px);
        }

        .trainer-team-diagonal {
          animation: trainerTeamDiagonalBreath 18s ease-in-out infinite;
        }

        .trainer-team-ambient-calm {
          animation: trainerTeamAmbientCalm 16s ease-in-out infinite;
        }

        .trainer-team-ambient-watch {
          animation: trainerTeamAmbientWatch 19s ease-in-out 1.7s infinite;
        }

        .trainer-team-ambient-decision {
          animation: trainerTeamAmbientDecision 15s ease-in-out 0.8s infinite;
        }

        .trainer-team-ambient-rose {
          animation: trainerTeamAmbientDecision 21s ease-in-out 2.4s infinite reverse;
        }

        .trainer-team-field-busy .trainer-team-ambient-decision {
          animation-duration: 12.5s;
        }

        @media (prefers-reduced-motion: reduce) {
          .trainer-team-diagonal,
          .trainer-team-ambient-calm,
          .trainer-team-ambient-watch,
          .trainer-team-ambient-decision,
          .trainer-team-ambient-rose {
            animation: none !important;
          }

          .trainer-team-node {
            animation: none !important;
            transition-duration: 0.001ms !important;
          }

          .trainer-team-node * {
            animation: none !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </section>
  );
}

function StatusLegend() {
  const items = [
    { label: "по плану", className: "bg-lime-300" },
    { label: "нет следующей", className: "bg-red-400" },
    { label: "ждет разбора", className: "bg-amber-300" },
    { label: "корректировка", className: "bg-orange-300" },
    { label: "пауза", className: "bg-zinc-600" },
  ];

  return (
    <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1">
          <span className={cn("size-2 rounded-full", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function fallbackPlacement(index: number) {
  const x = 12 + ((index * 17) % 76);
  const y = 16 + ((index * 23) % 68);
  return { x, y };
}

function getBasePlacement(client: TeamClient, index: number) {
  if (client.state === "on_track" && resolvedNodePlacements[client.id]) {
    return resolvedNodePlacements[client.id];
  }

  return nodePlacements[client.id] ?? fallbackPlacement(index);
}

function getInteractivePlacement(
  client: TeamClient,
  hoveredClientId: string | null,
  placements: Map<string, MapPlacement>
) {
  const base = placements.get(client.id) ?? { ...fallbackPlacement(0), client, index: 0, locked: false };
  if (!hoveredClientId || hoveredClientId === client.id) return { ...base, wasRepelled: false };

  const hovered = placements.get(hoveredClientId);
  if (!hovered) return { ...base, wasRepelled: false };

  const dx = base.x - hovered.x;
  const dy = base.y - hovered.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0 || distance > 13) return { ...base, wasRepelled: false };

  const force = (13 - distance) * 0.42;
  const nextX = clamp(base.x + (dx / distance) * force, 7, 93);
  const nextY = clamp(base.y + (dy / distance) * force, 10, 88);

  return { x: nextX, y: nextY, wasRepelled: true };
}

function getResolvedPlacements(
  clients: TeamClient[],
  selectedClientId: string | null,
  lifecycleClientId: string | null
) {
  const placements = clients.map((client, index): MapPlacement => ({
    client,
    index,
    ...getLivingPlacement(client, index),
    locked: selectedClientId === client.id || lifecycleClientId === client.id,
  }));

  for (let iteration = 0; iteration < 8; iteration += 1) {
    for (let aIndex = 0; aIndex < placements.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < placements.length; bIndex += 1) {
        separateIfOverlapping(placements[aIndex], placements[bIndex], iteration);
      }
    }
  }

  return new Map(placements.map((placement) => [placement.client.id, placement]));
}

function separateIfOverlapping(a: MapPlacement, b: MapPlacement, iteration: number) {
  if (a.locked && b.locked) return;

  const aspect = 0.42;
  let dx = a.x - b.x;
  let dy = (a.y - b.y) * aspect;
  let distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = getCollisionRadius(a.client) + getCollisionRadius(b.client);

  if (distance >= minDistance) return;

  if (distance < 0.01) {
    const angle = hashToUnit(`${a.client.id}:${b.client.id}:${iteration}`) * Math.PI * 2;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    distance = 1;
  }

  const push = (minDistance - distance) * 0.56;
  const nx = dx / distance;
  const ny = dy / distance;
  const aWeight = a.locked ? 0 : b.locked ? 1 : 0.5;
  const bWeight = b.locked ? 0 : a.locked ? 1 : 0.5;

  movePlacement(a, nx * push * aWeight, (ny * push * aWeight) / aspect);
  movePlacement(b, -nx * push * bWeight, (-ny * push * bWeight) / aspect);
}

function movePlacement(placement: MapPlacement, dx: number, dy: number) {
  if (placement.locked) return;

  const bounds = getSemanticBounds(placement.client.state);
  placement.x = clamp(placement.x + dx, bounds.minX, bounds.maxX);
  placement.y = clamp(placement.y + dy, bounds.minY, bounds.maxY);
}

function getCollisionRadius(client: TeamClient) {
  if (client.state === "inactive") return 2.2;
  if (client.state === "no_next_workout") return 3.2;
  if (client.state === "waiting_review") return 3.05;
  if (client.state === "needs_adjustment") return 2.9;
  return 2.75;
}

function getLivingPlacement(client: TeamClient, index: number) {
  return getBasePlacement(client, index);
}

function getSemanticBounds(state: TeamClient["state"]) {
  if (state === "inactive") return { minX: 74, maxX: 94, minY: 68, maxY: 90 };
  if (state === "no_next_workout") return { minX: 68, maxX: 88, minY: 22, maxY: 45 };
  if (state === "waiting_review") return { minX: 60, maxX: 82, minY: 18, maxY: 42 };
  if (state === "needs_adjustment") return { minX: 48, maxX: 68, minY: 32, maxY: 56 };
  return { minX: 12, maxX: 62, minY: 34, maxY: 84 };
}

function hashToUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTeamHealthVisuals(clients: TeamClient[]) {
  const urgentScore = clients.reduce((score, client) => {
    if (client.state === "no_next_workout") return score + 3;
    if (client.state === "waiting_review") return score + 2.4;
    if (client.state === "needs_adjustment") return score + 1.5;
    return score;
  }, 0);
  const urgentCount = clients.filter((client) => ["no_next_workout", "waiting_review", "needs_adjustment"].includes(client.state)).length;
  const load = Math.min(1, (urgentScore + urgentCount * 0.8) / 16);
  const calmBias = 1 - load;

  return {
    calmDiagonal: roundOpacity(0.022 + calmBias * 0.018),
    watchDiagonal: roundOpacity(0.012 + load * 0.016),
    decisionDiagonal: roundOpacity(0.018 + load * 0.034),
    calmCloud: roundOpacity(0.022 + calmBias * 0.02),
    watchCloud: roundOpacity(0.01 + load * 0.016),
    decisionCloud: roundOpacity(0.018 + load * 0.034),
    roseCloud: roundOpacity(0.01 + load * 0.021),
    hasCritical: clients.some((client) => client.state === "no_next_workout"),
  };
}

function roundOpacity(value: number) {
  return Math.round(value * 1000) / 1000;
}

const nodePlacements: Record<string, { x: number; y: number }> = {
  "artem-smirnov": { x: 74, y: 25 },
  "olga-sokolova": { x: 62, y: 40 },
  "egor-nikitin": { x: 83, y: 32 },
  "maria-volkova": { x: 22, y: 58 },
  "dmitry-korolev": { x: 29, y: 45 },
  "sofia-andreeva": { x: 41, y: 38 },
  "nikita-ivanov": { x: 48, y: 49 },
  "anna-petrova": { x: 55, y: 56 },
  "kirill-orlov": { x: 52, y: 67 },
  "elena-kuznetsova": { x: 43, y: 73 },
  "roman-belov": { x: 35, y: 80 },
  "polina-gromova": { x: 27, y: 72 },
  "ivan-melnikov": { x: 19, y: 68 },
  "alisa-zvereva": { x: 18, y: 83 },
  "maxim-ustinov": { x: 15, y: 52 },
  "veronika-levina": { x: 31, y: 36 },
  "pavel-sergeev": { x: 59, y: 62 },
  "yana-fedotova": { x: 45, y: 84 },
  "timur-akimov": { x: 36, y: 62 },
  "irina-kozlova": { x: 50, y: 35 },
  "leonid-savin": { x: 24, y: 45 },
  "ksenia-belyaeva": { x: 87, y: 82 },
  "vadim-larin": { x: 78, y: 88 },
  "natalia-ershova": { x: 93, y: 74 },
};

const resolvedNodePlacements: Record<string, { x: number; y: number }> = {
  "artem-smirnov": { x: 40, y: 54 },
  "olga-sokolova": { x: 35, y: 67 },
  "egor-nikitin": { x: 28, y: 62 },
};
