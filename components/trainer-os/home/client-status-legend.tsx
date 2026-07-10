import { cn } from "@/lib/utils";

import type { TeamClientState, TeamMapFilter } from "./types";

const statusLabels: Record<TeamClientState, string> = {
  on_track: "По плану",
  no_next_workout: "Нет следующей",
  waiting_review: "Ждут разбора",
  needs_adjustment: "Корректировка",
  inactive: "Пауза",
};

const statusDotClass: Record<TeamClientState, string> = {
  on_track: "bg-lime-300",
  no_next_workout: "bg-orange-300",
  waiting_review: "bg-rose-300",
  needs_adjustment: "bg-yellow-300",
  inactive: "bg-zinc-600",
};

type ClientStatusLegendProps = {
  counts: Record<TeamClientState, number>;
  activeFilter: TeamMapFilter;
  onFilterChange: (filter: TeamMapFilter) => void;
};

export function ClientStatusLegend({ counts, activeFilter, onFilterChange }: ClientStatusLegendProps) {
  const statuses = Object.keys(statusLabels) as TeamClientState[];

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onFilterChange("all")}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs transition",
          activeFilter === "all"
            ? "border-lime-300/40 bg-lime-300/12 text-lime-100"
            : "border-zinc-800 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
        )}
      >
        Все
      </button>
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onFilterChange(status)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
            activeFilter === status
              ? "border-lime-300/40 bg-lime-300/12 text-lime-100"
              : "border-zinc-800 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          )}
        >
          <span className={cn("size-2 rounded-full", statusDotClass[status])} />
          {statusLabels[status]} · {counts[status]}
        </button>
      ))}
    </div>
  );
}
