import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { TeamSummary } from "./types";

type TeamSummaryPanelProps = {
  summary: TeamSummary;
  onProcessClients: () => void;
};

export function TeamSummaryPanel({ summary, onProcessClients }: TeamSummaryPanelProps) {
  const progress = summary.total > 0 ? Math.round((summary.onTrack / summary.total) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-[32px] border border-zinc-800/80 bg-[linear-gradient(135deg,rgba(24,24,27,0.92),rgba(9,9,11,0.78))] p-5 shadow-2xl shadow-black/28">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-200/70">Состояние команды</p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-5xl font-semibold tracking-tight text-zinc-50">{summary.total}</p>
              <p className="mt-1 text-sm text-zinc-500">спортсмена в команде</p>
            </div>
            <div className="flex flex-1 flex-wrap gap-2 pb-1">
              <SummaryChip value={summary.onTrack} label="идут по плану" tone="green" />
              <SummaryChip value={summary.needsAction} label="требуют действий" tone="amber" />
              <SummaryChip value={summary.waitingReview} label="ждут разбора" tone="red" />
              <SummaryChip value={summary.noNextWorkout} label="без следующей тренировки" tone="orange" />
              <SummaryChip value={summary.inactive} label="на паузе" tone="muted" />
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
            <div className="h-full rounded-full bg-lime-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex justify-start lg:justify-end">
          <Button
            type="button"
            onClick={onProcessClients}
            disabled={summary.needsAction === 0}
            className="h-10 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {summary.needsAction > 0 ? "Обработать клиентов" : "Все спокойно"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

type SummaryChipProps = {
  value: number;
  label: string;
  tone: "green" | "amber" | "red" | "orange" | "muted";
};

function SummaryChip({ value, label, tone }: SummaryChipProps) {
  const toneClass = {
    green: "border-lime-300/18 bg-lime-300/8 text-lime-100",
    amber: "border-yellow-300/18 bg-yellow-300/8 text-yellow-100",
    red: "border-rose-300/18 bg-rose-300/8 text-rose-100",
    orange: "border-orange-300/18 bg-orange-300/8 text-orange-100",
    muted: "border-zinc-800 bg-black/18 text-zinc-400",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${toneClass}`}>
      <span className="text-base font-semibold text-zinc-50">{value}</span>
      {label}
    </span>
  );
}
