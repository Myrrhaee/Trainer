"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";

import { cn } from "@/lib/utils";

import type { TeamActivityType, TeamClient } from "./types";

type TeamNodeProps = {
  client: TeamClient;
  totalClients: number;
  eventType: TeamActivityType | null;
  eventActive: boolean;
  lifecycleActive: boolean;
  zoneShiftActive: boolean;
  selected: boolean;
  dimmed: boolean;
  pushed: boolean;
  x: number;
  y: number;
  delay: number;
  onSelect: (client: TeamClient) => void;
  onOpen: (client: TeamClient) => void;
  onHoverChange: (clientId: string | null) => void;
};

type NodeStyle = {
  offset: number;
  text: string;
  dot: string;
  dotPosition: string;
  border: string;
  shadow: string;
  dotColor: string;
  pulse: "none" | "red" | "amber";
};

type DragSnapshot = {
  pointerId: number;
  fieldRect: DOMRect;
  homeX: number;
  homeY: number;
  grabX: number;
  grabY: number;
  startClientX: number;
  startClientY: number;
};

export function TeamNode({
  client,
  totalClients,
  eventType,
  eventActive,
  lifecycleActive,
  zoneShiftActive,
  selected,
  dimmed,
  pushed,
  x,
  y,
  delay,
  onSelect,
  onOpen,
  onHoverChange,
}: TeamNodeProps) {
  const isActionState = ["no_next_workout", "waiting_review", "needs_adjustment"].includes(client.state);
  const nodeStyle = getNodeStyle(client);
  const eventStyle = eventType ? getEventStyle(eventType) : null;
  const floatStyle = getFloatStyle(client.state, delay);
  const previousState = useRef(client.state);
  const dragSnapshot = useRef<DragSnapshot | null>(null);
  const suppressClick = useRef(false);
  const returnTimeout = useRef<number | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const baseSize = getBaseNodeSize(totalClients);
  const visualSize = Math.max(30, baseSize + nodeStyle.offset + (selected ? 4 : 0));
  const tooltipClassName = getTooltipClassName(x, y);
  const resolvingToCalm = lifecycleActive && client.state === "on_track";

  useEffect(() => {
    if (previousState.current !== client.state && client.state === "on_track") {
      const startTimeout = window.setTimeout(() => setSuccessFlash(true), 0);
      const endTimeout = window.setTimeout(() => setSuccessFlash(false), 1100);
      previousState.current = client.state;
      return () => {
        window.clearTimeout(startTimeout);
        window.clearTimeout(endTimeout);
      };
    }

    previousState.current = client.state;
    return undefined;
  }, [client.state]);

  useEffect(() => {
    return () => {
      if (returnTimeout.current) {
        window.clearTimeout(returnTimeout.current);
      }
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onSelect(client);
  }

  function handleDoubleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!suppressClick.current) {
      onOpen(client);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    if (returnTimeout.current) {
      window.clearTimeout(returnTimeout.current);
      returnTimeout.current = null;
    }
    setIsReturning(false);

    const field = event.currentTarget.closest(".trainer-team-field");
    if (!(field instanceof HTMLElement)) return;

    const fieldRect = field.getBoundingClientRect();
    const homeX = (fieldRect.width * x) / 100;
    const homeY = (fieldRect.height * y) / 100;
    const currentCenterX = homeX + dragOffset.x;
    const currentCenterY = homeY + dragOffset.y;
    const pointerX = event.clientX - fieldRect.left;
    const pointerY = event.clientY - fieldRect.top;

    dragSnapshot.current = {
      pointerId: event.pointerId,
      fieldRect,
      homeX,
      homeY,
      grabX: pointerX - currentCenterX,
      grabY: pointerY - currentCenterY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    onHoverChange(null);
    onSelect(client);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const snapshot = dragSnapshot.current;
    if (!snapshot || snapshot.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - snapshot.startClientX, event.clientY - snapshot.startClientY);
    if (moved > 4) {
      suppressClick.current = true;
      setIsDragging(true);
    }

    const nextCenterX = clamp(
      event.clientX - snapshot.fieldRect.left - snapshot.grabX,
      visualSize / 2,
      snapshot.fieldRect.width - visualSize / 2
    );
    const nextCenterY = clamp(
      event.clientY - snapshot.fieldRect.top - snapshot.grabY,
      visualSize / 2,
      snapshot.fieldRect.height - visualSize / 2
    );

    setDragOffset({
      x: nextCenterX - snapshot.homeX,
      y: nextCenterY - snapshot.homeY,
    });
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const snapshot = dragSnapshot.current;
    if (!snapshot || snapshot.pointerId !== event.pointerId) return;

    dragSnapshot.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
    if (suppressClick.current || Math.hypot(dragOffset.x, dragOffset.y) > 1) {
      setIsReturning(true);
      returnTimeout.current = window.setTimeout(() => {
        setIsReturning(false);
        returnTimeout.current = null;
      }, 3200);
    }
    setDragOffset({ x: 0, y: 0 });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onFocus={() => onHoverChange(client.id)}
      onBlur={() => onHoverChange(null)}
      onMouseEnter={() => {
        if (!isDragging) onHoverChange(client.id);
      }}
      onMouseLeave={() => {
        if (!isDragging) onHoverChange(null);
      }}
      className={cn(
        "trainer-team-node group absolute z-10 cursor-grab touch-none select-none rounded-full text-center outline-none transition-[left,top,opacity,filter,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[left,top,transform] active:cursor-grabbing hover:z-[120] focus-visible:z-[120] focus-visible:ring-2 focus-visible:ring-lime-300/70",
        isActionState ? "z-20" : "opacity-85 hover:opacity-100",
        client.state === "inactive" && "opacity-45 hover:opacity-75",
        selected && "z-[90] opacity-100",
        eventActive && "z-[130] opacity-100 brightness-110 saturate-110",
        isDragging && "z-[160] opacity-100 brightness-110 saturate-110 duration-75",
        zoneShiftActive && !selected && !isDragging && !isReturning && "duration-[22000ms] ease-[cubic-bezier(0.45,0,0.55,1)]",
        resolvingToCalm && !isDragging && "duration-[5200ms]",
        isReturning && !isDragging && "duration-[3200ms] ease-[cubic-bezier(0.19,1,0.22,1)]",
        pushed && "opacity-70",
        dimmed && !isDragging && !eventActive && "opacity-[0.18] brightness-50 saturate-50 hover:opacity-70 hover:brightness-90 hover:saturate-100"
      )}
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          "--float-x": `${floatStyle.x}px`,
          "--float-y": `${floatStyle.y}px`,
          "--float-x-soft": `${floatStyle.xSoft}px`,
          "--float-y-soft": `${floatStyle.ySoft}px`,
          "--float-x-2": `${floatStyle.x2}px`,
          "--float-y-2": `${floatStyle.y2}px`,
          "--float-x-3": `${floatStyle.x3}px`,
          "--float-y-3": `${floatStyle.y3}px`,
          transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`,
        } as CSSProperties
      }
      data-state={client.state}
      data-selected={selected ? "true" : "false"}
      data-flash={successFlash ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      data-event-active={eventActive ? "true" : "false"}
      data-lifecycle={resolvingToCalm ? "resolved" : "idle"}
      aria-label={`Выбрать клиента ${client.name}`}
    >
      <span
        className="trainer-team-float relative block"
        style={{
          animation:
            client.state === "inactive" || isDragging || zoneShiftActive
              ? "none"
              : `trainerTeamFloat ${floatStyle.duration}s ease-in-out ${floatStyle.delay}s infinite`,
        }}
      >
        <span
          className={cn(
            "relative flex items-center justify-center rounded-full border bg-zinc-950 font-semibold text-zinc-100 transition-[width,height,box-shadow,transform] duration-300",
            !zoneShiftActive && "group-hover:scale-[1.035]",
            nodeStyle.text,
            nodeStyle.border,
            nodeStyle.shadow,
            selected && "ring-2 ring-white/45 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_18px_42px_rgba(0,0,0,0.3)]",
            isDragging && "scale-[1.045] ring-2 ring-lime-100/40 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_22px_54px_rgba(0,0,0,0.36)]",
            resolvingToCalm && !isDragging && "duration-[1800ms] ease-[cubic-bezier(0.19,1,0.22,1)]",
            client.state === "inactive" && "text-zinc-400"
          )}
          style={{ width: visualSize, height: visualSize }}
        >
          {eventStyle ? (
            <span
              className={cn(
                "trainer-team-event-ripple pointer-events-none absolute rounded-full border",
                eventActive ? "-inset-4 opacity-100" : "-inset-3 opacity-55",
                eventStyle.border,
                eventActive && eventStyle.activeShadow
              )}
            />
          ) : null}
          {eventActive && eventStyle ? (
            <span className={cn("trainer-team-event-focus pointer-events-none absolute -inset-6 rounded-full", eventStyle.glow)} />
          ) : null}
          {nodeStyle.pulse !== "none" ? (
            <span
              className={cn(
                "pointer-events-none absolute -inset-1 rounded-full border",
                nodeStyle.pulse === "red" && "trainer-team-red-pulse border-red-400/36",
                nodeStyle.pulse === "amber" && "trainer-team-amber-pulse border-amber-300/26"
              )}
            />
          ) : null}
          {client.isOnline ? (
            <span className="trainer-team-online-orbit pointer-events-none absolute -inset-2 rounded-full">
              <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-sky-200/85 shadow-[0_0_10px_rgba(186,230,253,0.28)]" />
            </span>
          ) : null}
          {successFlash ? <span className="trainer-team-success-flash pointer-events-none absolute -inset-2 rounded-full border border-lime-200/55" /> : null}
          {successFlash ? <span className="trainer-team-lifecycle-wake pointer-events-none absolute -inset-5 rounded-full bg-lime-300/[0.055]" /> : null}
          <span className="relative z-10">{client.initials}</span>
          <span className={cn("absolute z-20 rounded-full ring-2 ring-zinc-950", nodeStyle.dot, nodeStyle.dotPosition, nodeStyle.dotColor)} />
        </span>

        {!selected && !isDragging ? (
          <span className={tooltipClassName}>
            <span className="block truncate text-sm font-semibold text-zinc-50">{client.name}</span>
            <span className="mt-1 block text-xs text-zinc-500">{client.stateLabel}</span>
            <span className="mt-2 block text-xs text-zinc-500">Динамика: {getTrendLabel(client.progressTrend)}</span>
            {client.isOnline ? <span className="mt-2 block text-xs text-sky-100/80">Сейчас онлайн</span> : null}
            {client.primaryAction ? (
              <span className="mt-2 block text-xs text-lime-100">Действие: {getActionLabel(client.primaryAction)}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function getBaseNodeSize(totalClients: number) {
  if (totalClients <= 5) return 72;
  if (totalClients <= 12) return 62;
  if (totalClients <= 24) return 50;
  if (totalClients <= 40) return 42;
  return 34;
}

function getNodeStyle(client: TeamClient): NodeStyle {
  switch (client.state) {
    case "no_next_workout":
      return {
        offset: 8,
        text: "text-sm",
        dot: "size-3",
        dotPosition: "-right-0.5 top-1.5",
        border: "border-red-400/62",
        shadow: "shadow-[0_0_18px_rgba(248,113,113,0.12),0_14px_30px_rgba(0,0,0,0.22)]",
        dotColor: "bg-red-400",
        pulse: "red",
      };
    case "waiting_review":
      return {
        offset: 6,
        text: "text-sm",
        dot: "size-3",
        dotPosition: "-right-0.5 top-1.5",
        border: "border-amber-300/52",
        shadow: "shadow-[0_0_15px_rgba(252,211,77,0.08),0_14px_30px_rgba(0,0,0,0.22)]",
        dotColor: "bg-amber-300",
        pulse: "amber",
      };
    case "needs_adjustment":
      return {
        offset: 4,
        text: "text-sm",
        dot: "size-2.5",
        dotPosition: "-right-0.5 top-1.5",
        border: "border-orange-300/48",
        shadow: "shadow-[0_0_13px_rgba(251,146,60,0.07),0_14px_30px_rgba(0,0,0,0.22)]",
        dotColor: "bg-orange-300",
        pulse: "none",
      };
    case "inactive":
      return {
        offset: -4,
        text: "text-[11px]",
        dot: "size-2.5",
        dotPosition: "-right-0.5 top-1",
        border: "border-zinc-700/70",
        shadow: "shadow-[0_12px_28px_rgba(0,0,0,0.18)]",
        dotColor: "bg-zinc-600",
        pulse: "none",
      };
    case "on_track":
    default:
      return {
        offset: 0,
        text: "text-xs",
        dot: "size-2.5",
        dotPosition: "-right-0.5 top-1",
        border: "border-lime-300/26",
        shadow: "shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
        dotColor: "bg-lime-300",
        pulse: "none",
      };
  }
}

function getEventStyle(type: TeamActivityType) {
  switch (type) {
    case "completed_workout":
      return {
        border: "border-lime-200/22",
        glow: "bg-lime-300/[0.045]",
        activeShadow: "shadow-[0_0_34px_rgba(190,242,100,0.12)]",
      };
    case "personal_record":
      return {
        border: "border-amber-200/26",
        glow: "bg-amber-300/[0.05]",
        activeShadow: "shadow-[0_0_34px_rgba(252,211,77,0.12)]",
      };
    case "check_in_submitted":
      return {
        border: "border-sky-200/22",
        glow: "bg-sky-300/[0.045]",
        activeShadow: "shadow-[0_0_34px_rgba(125,211,252,0.1)]",
      };
    case "measurement_updated":
      return {
        border: "border-violet-200/22",
        glow: "bg-violet-300/[0.045]",
        activeShadow: "shadow-[0_0_34px_rgba(196,181,253,0.1)]",
      };
    case "workout_assigned":
      return {
        border: "border-emerald-200/22",
        glow: "bg-emerald-300/[0.045]",
        activeShadow: "shadow-[0_0_34px_rgba(110,231,183,0.1)]",
      };
    case "message_received":
      return {
        border: "border-zinc-100/18",
        glow: "bg-zinc-100/[0.035]",
        activeShadow: "shadow-[0_0_30px_rgba(244,244,245,0.075)]",
      };
    case "review_sent":
    default:
      return {
        border: "border-zinc-200/18",
        glow: "bg-zinc-200/[0.035]",
        activeShadow: "shadow-[0_0_30px_rgba(228,228,231,0.075)]",
      };
  }
}

function getFloatStyle(state: TeamClient["state"], delay: number) {
  const duration = 11 + (delay % 8);
  const baseDelay = delay * 0.47;
  const direction = delay % 2 === 0 ? 1 : -1;
  const crossDirection = delay % 3 === 0 ? -1 : 1;
  const drift = (delay % 4) * 0.28;

  if (state === "no_next_workout") {
    return {
      xSoft: direction * (1.7 + drift),
      ySoft: -2.2,
      x: direction * (3.6 + drift),
      y: -4.2,
      x2: crossDirection * (4.4 + drift),
      y2: 3,
      x3: direction * -(2.8 + drift),
      y3: 3.8,
      duration: duration + 8,
      delay: baseDelay,
    };
  }

  if (state === "waiting_review") {
    return {
      xSoft: direction * (1.5 + drift),
      ySoft: -1.9,
      x: direction * (3.2 + drift),
      y: -3.7,
      x2: crossDirection * (3.8 + drift),
      y2: 2.8,
      x3: direction * -(2.5 + drift),
      y3: 3.2,
      duration: duration + 7,
      delay: baseDelay,
    };
  }

  if (state === "needs_adjustment") {
    return {
      xSoft: direction * (1.4 + drift),
      ySoft: -1.8,
      x: direction * (3 + drift),
      y: -3.5,
      x2: crossDirection * (3.6 + drift),
      y2: 2.5,
      x3: direction * -(2.3 + drift),
      y3: 3,
      duration: duration + 5,
      delay: baseDelay,
    };
  }

  if (state === "inactive") {
    return { xSoft: 0, ySoft: 0, x: 0, y: 0, x2: 0, y2: 0, x3: 0, y3: 0, duration: 0, delay: 0 };
  }

  return {
    xSoft: direction * (1.8 + drift),
    ySoft: -2.3,
    x: direction * (4 + (delay % 2) + drift),
    y: -4.4,
    x2: crossDirection * (3 + (delay % 2) + drift),
    y2: 3,
    x3: direction * -(2.4 + drift),
    y3: 3.8,
    duration,
    delay: baseDelay,
  };
}

function getActionLabel(action: TeamClient["primaryAction"]) {
  if (action === "assign") return "назначить";
  if (action === "review") return "разобрать";
  if (action === "message") return "написать";
  return "открыть клиента";
}

function getTrendLabel(trend: TeamClient["progressTrend"]) {
  if (trend === "up") return "растет";
  if (trend === "down") return "снижается";
  return "стабильно";
}

function getTooltipClassName(x: number, y: number) {
  const verticalClass = y > 72 ? "bottom-[calc(100%+12px)]" : "top-[calc(100%+12px)]";
  const horizontalClass =
    x < 18
      ? "left-0 translate-x-0"
      : x > 82
        ? "right-0 translate-x-0"
        : "left-1/2 -translate-x-1/2";

  return cn(
    "pointer-events-none absolute z-[130] hidden w-52 rounded-[1.1rem] border border-zinc-800 bg-zinc-950/98 p-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.32)] group-hover:block group-focus-visible:block",
    verticalClass,
    horizontalClass
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
