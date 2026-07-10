import { Flame, TrendingUp, Dumbbell } from "lucide-react";

import { cn } from "@/lib/utils";

export type ClientMiniAnalyticsCardProps = {
  /** Completed workouts in the current week (rolling or calendar week — caller decides). */
  workoutsThisWeek?: number;
  /** Consecutive workouts for streak display. */
  streakCount?: number;
  /** Strength lift label, e.g. bench press. */
  liftName?: string;
  /** Previous best or starting weight (kg). */
  liftFromKg?: number;
  /** Current best or target weight (kg). */
  liftToKg?: number;
  className?: string;
};

const defaults = {
  workoutsThisWeek: 3,
  streakCount: 5,
  liftName: "Bench press",
  liftFromKg: 60,
  liftToKg: 65,
} as const;

/**
 * Compact analytics summary for client dashboards: weekly volume, streak, one lift progression.
 * Presentational only — pass values via props (no fetching inside).
 */
export function ClientMiniAnalyticsCard({
  workoutsThisWeek = defaults.workoutsThisWeek,
  streakCount = defaults.streakCount,
  liftName = defaults.liftName,
  liftFromKg = defaults.liftFromKg,
  liftToKg = defaults.liftToKg,
  className,
}: ClientMiniAnalyticsCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/70 to-zinc-950/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        className
      )}
      aria-label="Mini analytics"
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-black/25 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            Week
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none text-zinc-50">
            {workoutsThisWeek}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-zinc-500">workouts</p>
        </div>

        <div className="min-w-0 rounded-xl border border-orange-500/20 bg-orange-950/20 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200/80">
            <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400/90" aria-hidden />
            Streak
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none text-zinc-50">
            {streakCount}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-zinc-500">in a row</p>
        </div>

        <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-black/25 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            Strength
          </div>
          <p className="mt-1 truncate text-[11px] font-medium leading-tight text-zinc-300">
            {liftName}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
            {liftFromKg}
            <span className="mx-1 text-zinc-600">→</span>
            {liftToKg}
            <span className="ml-0.5 text-xs font-normal text-zinc-500">kg</span>
          </p>
        </div>
      </div>
    </section>
  );
}
