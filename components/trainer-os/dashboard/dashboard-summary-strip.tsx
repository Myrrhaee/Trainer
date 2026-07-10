import type { SummaryMetric } from "./types";
import { cn } from "@/lib/utils";

const toneClass: Record<SummaryMetric["tone"], string> = {
  neutral: "border-zinc-800 bg-zinc-950/70 text-zinc-200",
  lime: "border-lime-300/15 bg-lime-300/8 text-lime-100",
  amber: "border-amber-300/15 bg-amber-300/8 text-amber-100",
  red: "border-red-300/15 bg-red-300/8 text-red-100",
  cyan: "border-cyan-300/15 bg-cyan-300/8 text-cyan-100",
};

type DashboardSummaryStripProps = {
  metrics: SummaryMetric[];
};

export function DashboardSummaryStrip({ metrics }: DashboardSummaryStripProps) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Today summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div key={metric.id} className={cn("rounded-2xl border px-4 py-3", toneClass[metric.tone])}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{metric.label}</p>
              <Icon className="size-4 text-current opacity-80" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{metric.value}</p>
          </div>
        );
      })}
    </section>
  );
}
