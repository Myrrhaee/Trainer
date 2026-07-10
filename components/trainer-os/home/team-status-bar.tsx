import Link from "next/link";
import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Dumbbell, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { TeamSummary } from "./types";

type TeamStatusBarProps = {
  summary: TeamSummary;
  onProcessClients: () => void;
};

type StatusCardProps = {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "orange";
  icon: ComponentType<{ className?: string }>;
  suffix?: string;
};

const toneStyles = {
  neutral: {
    icon: "bg-zinc-900 text-zinc-300 ring-zinc-700/70",
    value: "text-zinc-50",
    glow: "from-white/[0.04]",
  },
  success: {
    icon: "bg-lime-300/10 text-lime-200 ring-lime-300/20",
    value: "text-lime-100",
    glow: "from-lime-300/[0.07]",
  },
  warning: {
    icon: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
    value: "text-amber-100",
    glow: "from-amber-300/[0.06]",
  },
  danger: {
    icon: "bg-rose-300/10 text-rose-200 ring-rose-300/20",
    value: "text-rose-100",
    glow: "from-rose-300/[0.06]",
  },
  orange: {
    icon: "bg-orange-300/10 text-orange-200 ring-orange-300/20",
    value: "text-orange-100",
    glow: "from-orange-300/[0.06]",
  },
};

function StatusCard({ label, value, tone, icon: Icon, suffix = "" }: StatusCardProps) {
  const styles = toneStyles[tone];

  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow} via-transparent to-transparent opacity-90`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className={`mt-3 text-2xl font-semibold leading-none ${styles.value}`}>
            {value}
            {suffix ? <span className="ml-1 text-sm font-medium text-zinc-400">{suffix}</span> : null}
          </p>
        </div>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ${styles.icon}`}>
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function TeamStatusBar({ summary, onProcessClients }: TeamStatusBarProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Состояние команды</p>
        <p className="hidden text-sm text-zinc-500 md:block">Короткий срез перед работой с клиентами</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.05fr_1fr_1fr_1fr_1.15fr_1.35fr]">
        <StatusCard label="Спортсмены" value={summary.total} tone="neutral" icon={Users} />
        <StatusCard label="По плану" value={summary.onTrack} tone="success" icon={CheckCircle2} />
        <StatusCard label="Нужен шаг" value={summary.needsAction} tone="warning" icon={AlertTriangle} />
        <StatusCard label="Разбор" value={summary.waitingReview} tone="danger" icon={ClipboardCheck} />
        <StatusCard label="Без тренировки" value={summary.noNextWorkout} tone="orange" icon={Dumbbell} />

        <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/90 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <div className="flex h-full flex-col justify-between gap-3">
            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Быстрые действия</p>
            <Button
              type="button"
              onClick={onProcessClients}
              disabled={summary.needsAction === 0}
              className="h-10 w-full rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Users className="size-4" />
              {summary.needsAction > 0 ? `Обработать ${summary.needsAction} клиента` : "Все по плану"}
            </Button>
            <Button asChild variant="outline" className="h-10 w-full rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
              <Link href="/trainer/clients">
                <Plus className="size-4" />
                Добавить клиента
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
