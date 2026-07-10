import { AlertTriangle, CheckCircle2, Clock3, Dumbbell, PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { TrainerClientStatus } from "./types";

const statusMeta: Record<TrainerClientStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  on_track: {
    label: "Идет по плану",
    className: "border-lime-300/20 bg-lime-300/10 text-lime-100",
    icon: CheckCircle2,
  },
  needs_assignment: {
    label: "Нет следующей",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    icon: Dumbbell,
  },
  waiting_review: {
    label: "Ждет разбора",
    className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    icon: Clock3,
  },
  missed_workout: {
    label: "Пропуск",
    className: "border-red-300/25 bg-red-300/10 text-red-100",
    icon: AlertTriangle,
  },
  no_program: {
    label: "Нет старта",
    className: "border-zinc-500/30 bg-zinc-900 text-zinc-200",
    icon: PauseCircle,
  },
  needs_correction: {
    label: "Корректировка",
    className: "border-red-300/25 bg-red-300/10 text-red-100",
    icon: AlertTriangle,
  },
};

type StatusBadgeProps = {
  status: TrainerClientStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        meta.className,
        className
      )}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  );
}
