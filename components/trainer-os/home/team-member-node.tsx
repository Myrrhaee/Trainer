import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { TeamClient } from "./types";

type TeamMemberNodeProps = {
  client: TeamClient;
  x: number;
  y: number;
  size: "sm" | "md" | "lg";
};

export function TeamMemberNode({ client, x, y, size }: TeamMemberNodeProps) {
  const isActionState = ["no_next_workout", "waiting_review", "needs_adjustment"].includes(client.state);
  const nodeSize = {
    sm: "size-11",
    md: "size-14",
    lg: "size-16",
  }[size];
  const textSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <Link
      href={`/trainer/clients/${client.id}`}
      className={cn(
        "group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-full text-center outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-lime-300/70",
        isActionState
          ? "z-20"
          : client.state === "inactive"
            ? "opacity-45 hover:opacity-80"
            : "opacity-86 hover:opacity-100"
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={`Открыть клиента ${client.name}`}
    >
      <Avatar
        className={cn(
          nodeSize,
          "border-2 bg-zinc-950 shadow-xl shadow-black/30 transition group-hover:scale-105",
          client.state === "on_track" && "border-lime-300/34",
          client.state === "waiting_review" && "border-rose-300/70 shadow-rose-950/20",
          client.state === "no_next_workout" && "border-orange-300/70 shadow-orange-950/20",
          client.state === "needs_adjustment" && "border-yellow-300/70 shadow-yellow-950/20",
          client.state === "inactive" && "border-zinc-700"
        )}
      >
        <AvatarFallback className={cn("bg-zinc-900 font-semibold text-zinc-100", textSize)}>{client.initials}</AvatarFallback>
      </Avatar>

      <span
        className={cn(
          "absolute right-0 top-0 size-3 rounded-full ring-2 ring-zinc-950",
          client.state === "on_track" && "bg-lime-300",
          client.state === "waiting_review" && "bg-rose-300",
          client.state === "no_next_workout" && "bg-orange-300",
          client.state === "needs_adjustment" && "bg-yellow-300",
          client.state === "inactive" && "bg-zinc-600"
        )}
      />

      {isActionState ? (
        <div className="hidden min-w-24 rounded-full border border-zinc-800/80 bg-black/55 px-2 py-1 backdrop-blur md:block">
          <p className="truncate text-xs font-medium text-zinc-100">{client.name.split(" ")[0]}</p>
          <p className="truncate text-[10px] text-zinc-500">{client.stateLabel}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-64 -translate-x-1/2 rounded-2xl border border-zinc-800 bg-zinc-950/98 p-3 text-left shadow-2xl shadow-black/60 group-hover:block group-focus-visible:block">
        <p className="text-sm font-semibold text-zinc-50">{client.name}</p>
        <p className="mt-1 text-xs text-zinc-500">{client.goal}</p>
        <div className="mt-3 rounded-xl border border-zinc-800/80 bg-black/25 p-2">
          <p className="text-xs font-medium text-zinc-300">{client.issue ?? client.nextWorkout ?? "Клиент идёт по плану"}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{client.context ?? `Последняя активность: ${client.lastActivity}`}</p>
        </div>
      </div>
    </Link>
  );
}
