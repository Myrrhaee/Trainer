import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, CircleAlert, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TrainerDashboardSummary } from "./dashboard-read-model";

type DashboardStatusHeaderProps = {
  summary: TrainerDashboardSummary;
  onOpenAttention: () => void;
};

export function DashboardStatusHeader({ summary, onOpenAttention }: DashboardStatusHeaderProps) {
  const calm = summary.attention === 0;
  const metrics = [
    { label: "Активные", value: summary.active, icon: UsersRound, tone: "neutral" },
    { label: "В спокойном ритме", value: summary.calm, icon: CheckCircle2, tone: "calm" },
    { label: "Требуют внимания", value: summary.attention, icon: CircleAlert, tone: "attention" },
    { label: "Ждут разбора", value: summary.waitingReview, icon: ClipboardCheck, tone: "review" },
  ] as const;

  return (
    <section
      aria-labelledby="team-status-heading"
      className="overflow-hidden rounded-lg border border-zinc-800/90 bg-[linear-gradient(135deg,rgba(24,24,27,0.94),rgba(5,5,5,0.92))] shadow-2xl shadow-black/25"
    >
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Состояние команды</p>
          <h1 id="team-status-heading" className="mt-1 text-xl font-semibold text-zinc-50 sm:text-2xl">
            {calm ? "Сегодня всё спокойно" : `${summary.attention} ${getClientWord(summary.attention)} требуют решения`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {calm
              ? "Открытых действий нет. Команда продолжает работать по плану."
              : `${summary.calm} клиентов идут по плану. Начните с самого важного сигнала.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!calm ? (
            <Button type="button" onClick={onOpenAttention} className="h-10 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
              Перейти к решению
              <ArrowRight className="size-4" />
            </Button>
          ) : null}
          <Button asChild variant="outline" className="h-10 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href="/trainer/clients">Все клиенты</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800/70 sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border",
                  metric.tone === "calm" && "border-lime-300/20 bg-lime-300/8 text-lime-100",
                  metric.tone === "attention" && "border-rose-300/20 bg-rose-300/8 text-rose-100",
                  metric.tone === "review" && "border-amber-300/20 bg-amber-300/8 text-amber-100",
                  metric.tone === "neutral" && "border-zinc-700 bg-zinc-900 text-zinc-300"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-semibold text-zinc-50">{metric.value}</span>
                <span className="block truncate text-xs text-zinc-500">{metric.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getClientWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиент";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "клиента";
  return "клиентов";
}
