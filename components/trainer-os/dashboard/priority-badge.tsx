import { cn } from "@/lib/utils";

import type { TrainerClientPriority } from "./types";

const priorityMeta: Record<TrainerClientPriority, { label: string; className: string }> = {
  high: {
    label: "Срочно",
    className: "bg-red-300/12 text-red-100 ring-red-300/20",
  },
  medium: {
    label: "Средне",
    className: "bg-amber-300/12 text-amber-100 ring-amber-300/20",
  },
  low: {
    label: "Спокойно",
    className: "bg-zinc-800 text-zinc-400 ring-zinc-700",
  },
};

type PriorityBadgeProps = {
  priority: TrainerClientPriority;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const meta = priorityMeta[priority];

  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ring-1", meta.className, className)}>
      {meta.label}
    </span>
  );
}
