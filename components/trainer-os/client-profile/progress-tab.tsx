"use client";

import { useState } from "react";
import { Camera, ChevronDown, Dumbbell, Weight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

import { Panel, toneSurfaceClass } from "./client-profile-ui";
import type { AthleteProfile } from "./types";

export function ProgressTab({ athlete }: { athlete: AthleteProfile }) {
  return (
    <section className="grid gap-5">
      <ClientProgressScoreHero athlete={athlete} />
      <BodyChangesStrip athlete={athlete} />
      <ClientTransformationPanel athlete={athlete} />

      <div className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr] 2xl:items-stretch">
        <ClientWeightDynamics athlete={athlete} />
        <ClientExerciseProgressChart athlete={athlete} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <TrainerProgressNotes athlete={athlete} />
      </div>
    </section>
  );
}

function ClientProgressScoreHero({ athlete }: { athlete: AthleteProfile }) {
  const progressScore = Math.min(
    92,
    Math.max(36, Math.round((athlete.currentProgram.week / athlete.currentProgram.totalWeeks) * 100 + 12))
  );
  const strongestResult = athlete.bestResults.find((result) => result.tone === "good") ?? athlete.bestResults[0];
  const firstWeight = athlete.weightTrend[0] ?? 0;
  const currentWeight = athlete.weightTrend.at(-1) ?? firstWeight;
  const delta = currentWeight - firstWeight;
  const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toFixed(1)} кг`;

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-zinc-800/70 bg-[radial-gradient(circle_at_16%_18%,rgba(163,230,53,0.16),transparent_22%),radial-gradient(circle_at_45%_34%,rgba(163,230,53,0.14),transparent_18%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.04),transparent_16%),linear-gradient(135deg,rgba(24,24,28,0.985),rgba(10,10,13,0.985)_62%,rgba(7,7,9,0.99))] p-5 shadow-[0_36px_110px_rgba(0,0,0,0.34)] lg:p-6">
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_240px_minmax(250px,0.72fr)] xl:items-center">
        <div className="max-w-[430px] space-y-5">
          <div>
            <p className="text-sm font-medium text-zinc-300">Изменения тела и веса</p>
            <p className="mt-2 text-[4rem] font-semibold leading-none tracking-tight text-lime-300 drop-shadow-[0_0_22px_rgba(163,230,53,0.2)] lg:text-[4.8rem]">
              {progressScore}%
            </p>
            <p className="mt-2 text-base text-zinc-100">Клиент ближе к целевой форме</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Вес, замеры, фото и силовые показатели собраны в одном спокойном срезе.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-100">{athlete.currentWeight}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Текущий вес</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-100">{athlete.targetWeight}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Цель</p>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900/70">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(163,230,53,0.95),rgba(187,247,110,0.9))] shadow-[0_0_22px_rgba(163,230,53,0.34)]"
                style={{ width: `${progressScore}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center xl:justify-start">
          <CircularProgressScore value={progressScore} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-zinc-800/70">
          <HeroProgressMetric icon={Weight} label="Вес" value={deltaLabel} helper={`${currentWeight.toFixed(1)} кг сейчас`} />
          <HeroProgressMetric icon={Dumbbell} label="Силовой прогресс" value={strongestResult?.delta ?? "старт"} helper={strongestResult?.exercise ?? "Первые данные"} />
          <HeroProgressMetric icon={Camera} label="Фото прогресса" value={`${athlete.progressPhotos.length} фото`} helper="в текущем цикле" />
        </div>
      </div>
    </section>
  );
}

function BodyChangesStrip({ athlete }: { athlete: AthleteProfile }) {
  const bodyChanges = buildBodyChanges(athlete);

  return (
    <section className="rounded-[1.8rem] border border-zinc-800/90 bg-zinc-950/95 p-5 lg:p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Изменения тела</h2>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.1fr]">
        {bodyChanges.map((item, index) => (
          <div key={item.label} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-3.5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
            <p className="mt-2.5 text-[1.65rem] font-semibold tracking-tight text-zinc-50">{item.value}</p>
            <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
            <div className="mt-3 h-8">
              <ProgressSparkline values={item.spark} accent={index === 3 || item.label === "Фото прогресса"} />
            </div>
          </div>
          ))}
      </div>
    </section>
  );
}

function CircularProgressScore({ value }: { value: number }) {
  return (
    <div className="relative flex h-[212px] w-[212px] items-center justify-center">
      <div className="absolute inset-[-14%] rounded-full bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.24),transparent_58%)] blur-3xl" />
      <div className="absolute inset-0 rounded-full border border-lime-300/10 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.1),transparent_68%)]" />
      <div
        className="absolute inset-[9px] rounded-full shadow-[0_0_44px_rgba(163,230,53,0.14)]"
        style={{
          background: `conic-gradient(from 210deg, rgba(190,242,100,0.16) 0deg, rgba(163,230,53,1) ${value * 3.6 * 0.78}deg, rgba(132,204,22,0.88) ${value * 3.6}deg, rgba(39,39,42,0.32) ${value * 3.6}deg, rgba(18,18,20,0.94) 360deg)`,
        }}
      />
      <div className="absolute inset-[24px] rounded-full border border-white/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.055),transparent_34%),linear-gradient(180deg,rgba(16,16,19,0.98),rgba(6,6,8,0.98))]" />
      <div className="absolute inset-[17px] rounded-full border border-lime-300/8" />
      <div className="relative z-10 text-center">
        <p className="text-[2.4rem] font-semibold tracking-tight text-zinc-50">{value}%</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">пути к цели</p>
      </div>
    </div>
  );
}

function HeroProgressMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="flex items-start gap-3 xl:py-4 xl:first:pt-0 xl:last:pb-0">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-300/8 text-lime-200">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[1.5rem] font-semibold leading-none text-zinc-50">{value}</p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{helper}</p>
      </div>
    </div>
  );
}

function ClientTransformationPanel({ athlete }: { athlete: AthleteProfile }) {
  const firstWeight = athlete.weightTrend[0] ?? 0;
  const currentWeight = athlete.weightTrend.at(-1) ?? firstWeight;
  const delta = currentWeight - firstWeight;
  const strongestResult = athlete.bestResults.find((result) => result.tone === "good") ?? athlete.bestResults[0];

  return (
    <section className="overflow-hidden rounded-[1.8rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_15%_18%,rgba(163,230,53,0.08),transparent_22%),linear-gradient(180deg,rgba(17,17,20,0.98),rgba(8,8,11,0.98))] p-5 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Трансформация</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Фото и изменения тела</h2>
        </div>
        <span className="rounded-full border border-lime-300/18 bg-lime-300/8 px-3 py-1.5 text-xs text-lime-100">
          {athlete.progressPhotos.length} фото в цикле
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="grid gap-3 sm:grid-cols-3">
          {athlete.progressPhotos.slice(0, 3).map((photo) => (
            <div
              key={photo.id}
              className="flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-[radial-gradient(circle_at_50%_18%,rgba(190,242,100,0.1),transparent_34%),linear-gradient(135deg,#18181b,#050505)] p-4"
            >
              <Camera className="size-5 text-zinc-500" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">{photo.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{photo.date}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex h-full flex-col gap-2.5 rounded-[1.25rem] border border-zinc-800 bg-black/20 p-3.5">
          <p className="text-base font-semibold text-zinc-50">За текущий цикл</p>
          <TransformationMetric mark={delta <= 0 ? "↓" : "↑"} value={`${delta > 0 ? "+" : ""}${delta.toFixed(1)} кг`} label="Изменение веса" />
          <TransformationMetric mark="↑" value={strongestResult?.delta ?? "старт"} label={strongestResult?.exercise ?? "Силовой ориентир"} />
          <TransformationMetric mark="•" value={athlete.measurements[0]?.delta ?? "0"} label={athlete.measurements[0]?.label ?? "Замеры"} />
        </div>
      </div>
    </section>
  );
}

function TransformationMetric({ mark, value, label }: { mark: string; value: string; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1rem] border border-zinc-800 bg-zinc-950/60 p-3">
      <span className="text-xl text-lime-300">{mark}</span>
      <div>
        <p className="text-lg font-semibold text-zinc-50">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

function ClientWeightDynamics({ athlete }: { athlete: AthleteProfile }) {
  const [weightRange, setWeightRange] = useState<WeightRangeLabel>("6 недель");
  const weightProgress = buildWeightProgressRanges(athlete.weightTrend);
  const currentWeightProgress = weightProgress.find((item) => item.label === weightRange) ?? weightProgress[1];
  const deltaLabel = `${currentWeightProgress.change > 0 ? "+" : ""}${currentWeightProgress.change.toFixed(1)} кг`;
  const orientText = currentWeightProgress.change < 0
    ? "Вес идёт вниз без резких скачков"
    : currentWeightProgress.change > 0
      ? "Вес растёт ровным темпом"
      : "Вес держится стабильно";

  return (
    <section className="flex h-full flex-col rounded-[1.8rem] border border-zinc-800/90 bg-zinc-950/95 p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Динамика веса</h2>
          <p className="mt-2 max-w-[360px] text-sm leading-relaxed text-zinc-400">
            Ровный визуальный темп без лишней аналитической нагрузки.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
          {weightProgress.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setWeightRange(range.label)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                weightRange === range.label ? "bg-zinc-100 text-black" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              {range.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid min-h-[132px] gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
          <p className="text-sm font-medium text-lime-200">{weightRange}</p>
          <p className="mt-2 text-sm text-zinc-400">Текущая динамика веса</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-lime-300">
            {currentWeightProgress.current.toFixed(1)} кг
          </p>
          <p className="mt-2 text-xl font-semibold text-zinc-50">{deltaLabel}</p>
          <p className="mt-1 text-sm text-zinc-400">Изменение за период</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ClientProgressStat label="Начальный вес" value={`${currentWeightProgress.start.toFixed(1)} кг`} helper="Старт периода" />
          <ClientProgressStat label="Текущий" value={`${currentWeightProgress.current.toFixed(1)} кг`} helper="Сегодня" />
          <ClientProgressStat label="Изменение" value={deltaLabel} helper="Движение к цели" accent />
        </div>
      </div>

      <div className="mt-5 h-[280px] rounded-[1.4rem] border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,15,0.96),rgba(8,8,10,0.98))] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentWeightProgress.data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trainerWeightFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(163,230,53,0.45)" />
                <stop offset="100%" stopColor="rgba(163,230,53,0.02)" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#52525b", fontSize: 12 }} width={36} />
            <RechartsTooltip
              cursor={{ stroke: "rgba(163,230,53,0.2)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(10,10,12,0.96)",
                border: "1px solid rgba(63,63,70,0.9)",
                borderRadius: "16px",
                color: "#f4f4f5",
              }}
              formatter={(value) => [`${Number(value ?? 0).toFixed(1)} кг`, "Вес"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#bef264"
              strokeWidth={3}
              fill="url(#trainerWeightFill)"
              dot={{ r: 0 }}
              activeDot={{ r: 5, fill: "#bef264", stroke: "#1a1a1a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-400">Текущий ориентир</p>
            <p className="mt-1 text-lg font-semibold text-zinc-50">{orientText}</p>
          </div>
          <p className="text-sm text-zinc-500">цель: {athlete.targetWeight}</p>
        </div>
      </div>
    </section>
  );
}

function ClientProgressStat({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-[22px] border p-4", accent ? "border-lime-300/18 bg-lime-300/8" : "border-zinc-800 bg-black/18")}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className={cn("mt-2 text-xl font-semibold tracking-tight", accent ? "text-lime-200" : "text-zinc-50")}>{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{helper}</p>
    </div>
  );
}

function buildBodyChanges(athlete: AthleteProfile) {
  const firstWeight = athlete.weightTrend[0] ?? 0;
  const currentWeight = athlete.weightTrend.at(-1) ?? firstWeight;
  const weightDelta = currentWeight - firstWeight;
  const waist = findMeasurement(athlete, "Талия");
  const hips = findMeasurement(athlete, "Бедро") ?? findMeasurement(athlete, "Бёдра");
  const chest = findMeasurement(athlete, "Грудь");

  return [
    {
      label: "Вес",
      value: formatSignedValue(weightDelta, "кг", 1),
      helper: `${currentWeight.toFixed(1)} кг сейчас`,
      spark: athlete.weightTrend.length > 0 ? athlete.weightTrend : [currentWeight],
    },
    {
      label: "Талия",
      value: waist ? formatMeasurementDelta(waist.delta) : "0 см",
      helper: waist ? `${waist.value} сейчас` : "нет замера",
      spark: buildMeasurementSpark(waist),
    },
    {
      label: "Бёдра",
      value: hips ? formatMeasurementDelta(hips.delta) : "0 см",
      helper: hips ? `${hips.value} сейчас` : "нет замера",
      spark: buildMeasurementSpark(hips),
    },
    {
      label: "Грудь",
      value: chest ? formatMeasurementDelta(chest.delta) : "0 см",
      helper: chest ? `${chest.value} сейчас` : "нет замера",
      spark: buildMeasurementSpark(chest),
    },
    {
      label: "Фото прогресса",
      value: `${athlete.progressPhotos.length} фото`,
      helper: "Загружено в цикл",
      spark: [6, 7, 7, 8, 8, 9, 10],
    },
  ];
}

function ClientExerciseProgressChart({ athlete }: { athlete: AthleteProfile }) {
  const [selectedTrendId, setSelectedTrendId] = useState(athlete.exerciseTrends[0]?.id ?? "");
  const selectedTrend = athlete.exerciseTrends.find((trend) => trend.id === selectedTrendId) ?? athlete.exerciseTrends[0];

  if (!selectedTrend) {
    return (
      <section className="flex h-full flex-col rounded-[1.8rem] border border-zinc-800/90 bg-zinc-950/95 p-5 lg:p-6">
        <div className="rounded-[24px] border border-zinc-800 bg-black/18 p-4">
          <p className="text-sm text-zinc-500">Данные появятся после первых тренировок.</p>
        </div>
      </section>
    );
  }

  const strengthData = buildStrengthProgressData(selectedTrend);
  const strengthGrowth = calculatePercentGrowth(strengthData.start, strengthData.current);

  return (
    <section className="flex h-full flex-col rounded-[1.8rem] border border-zinc-800/90 bg-zinc-950/95 p-5 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Силовой прогресс</h2>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-zinc-400">
            Расчётная сила (e1RM), а не просто самый тяжёлый подход.
          </p>
        </div>
        <div className="relative shrink-0">
          <select
            id="exercise-trend"
            value={selectedTrend.id}
            onChange={(event) => setSelectedTrendId(event.target.value)}
            className="h-11 min-w-[230px] appearance-none rounded-full border border-zinc-800 bg-zinc-950/80 px-4 pr-11 text-sm font-medium text-zinc-100 outline-none transition hover:border-zinc-700"
          >
            {athlete.exerciseTrends.map((trend) => (
              <option key={trend.id} value={trend.id} className="bg-zinc-950 text-zinc-100">
                {trend.exercise}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      <div className="mt-7 grid min-h-[132px] gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
          <p className="text-sm font-medium text-lime-200">{selectedTrend.exercise}</p>
          <p className="mt-2 text-sm text-zinc-400">Расчётная сила (e1RM)</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-lime-300">{strengthData.current} кг</p>
          <p className="mt-2 text-xl font-semibold text-zinc-50">+{strengthGrowth}%</p>
          <p className="mt-1 text-sm text-zinc-400">Прирост</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ClientProgressStat label="Начало" value={`${strengthData.start} кг`} helper="Старт e1RM" />
          <ClientProgressStat label="Сейчас" value={`${strengthData.current} кг`} helper="Текущий e1RM" />
          <ClientProgressStat label="Прирост" value={`+${strengthGrowth}%`} helper="К силе" accent />
        </div>
      </div>

      <div className="mt-5 h-[280px] rounded-[1.4rem] border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,15,0.96),rgba(8,8,10,0.98))] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={strengthData.data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="trainerStrengthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(163,230,53,0.28)" />
                <stop offset="100%" stopColor="rgba(163,230,53,0.01)" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#52525b", fontSize: 12 }} width={36} />
            <RechartsTooltip
              cursor={{ stroke: "rgba(163,230,53,0.2)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(10,10,12,0.96)",
                border: "1px solid rgba(63,63,70,0.9)",
                borderRadius: "16px",
                color: "#f4f4f5",
              }}
              formatter={(value) => [`${Number(value ?? 0).toFixed(0)} кг`, "e1RM"]}
            />
            <Area type="monotone" dataKey="value" stroke="transparent" fill="url(#trainerStrengthFill)" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#a3e635"
              strokeWidth={3}
              dot={{ r: 4, fill: "#a3e635", stroke: "#101012", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#d9f99d", stroke: "#101012", strokeWidth: 2 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-400">Лучший рабочий сет</p>
            <p className="mt-1 text-lg font-semibold text-zinc-50">{selectedTrend.bestSet}</p>
          </div>
          <p className="text-sm text-zinc-500">последний цикл</p>
        </div>
      </div>
    </section>
  );
}

type WeightRangeLabel = "30 дней" | "6 недель" | "3 месяца";

function ProgressSparkline({ values, accent = false }: { values: readonly number[]; accent?: boolean }) {
  const width = 120;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke={accent ? "#bef264" : "#a3e635"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function TrainerProgressNotes({ athlete }: { athlete: AthleteProfile }) {
  const riskyLoad = athlete.previousLoads.find((load) => load.tone === "warning");
  const mainLimitation = athlete.limitations.find((limitation) => limitation.severity !== "low");
  const hasCorrection = Boolean(riskyLoad || mainLimitation || athlete.openIssues.length > 0);

  return (
    <Panel title="Вывод тренера" eyebrow="Решение по программе">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] border border-lime-300/16 bg-lime-300/7 p-4">
          <p className="text-sm font-semibold text-zinc-50">Что видно по прогрессу</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Вес и силовые показатели движутся без резкого отката. Основной ориентир — сохранить темп цикла.
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-800 bg-black/18 p-4">
          <p className="text-sm font-semibold text-zinc-50">Что значит для программы</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {riskyLoad
              ? `${riskyLoad.exercise}: ${riskyLoad.trend}. Следующий день лучше вести аккуратнее.`
              : `Можно продолжать фазу “${athlete.currentProgram.phase}” без смены структуры.`}
          </p>
        </div>
        <div className={cn("rounded-[24px] border p-4", toneSurfaceClass(hasCorrection ? "warning" : "good"))}>
          <p className="text-sm font-semibold text-zinc-50">Нужна ли корректировка</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {hasCorrection
              ? mainLimitation?.detail ?? athlete.openIssues[0] ?? "Есть сигнал, который лучше учесть в следующей тренировке."
              : "Корректировка не требуется. Достаточно держать текущий план."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function buildWeightProgressRanges(values: number[]) {
  const normalizedValues = values.length > 0 ? values : [0];
  const ranges: Array<{ label: WeightRangeLabel; shortLabel: string; dates: string[]; count: number }> = [
    { label: "30 дней", shortLabel: "30 дней", dates: ["22 апр", "26 апр", "30 апр", "4 мая", "8 мая", "12 мая", "22 мая"], count: 5 },
    { label: "6 недель", shortLabel: "6 недель", dates: ["1 мая", "4 мая", "8 мая", "12 мая", "16 мая", "19 мая", "22 мая"], count: 7 },
    { label: "3 месяца", shortLabel: "3 месяца", dates: ["1 мар", "15 мар", "1 апр", "15 апр", "1 мая", "15 мая", "22 мая"], count: normalizedValues.length },
  ];

  return ranges.map((range) => {
    const rangeValues = normalizedValues.slice(-range.count);
    const start = rangeValues[0] ?? normalizedValues[0] ?? 0;
    const current = rangeValues.at(-1) ?? start;

    return {
      label: range.label,
      shortLabel: range.shortLabel,
      start,
      current,
      change: current - start,
      data: rangeValues.map((value, index) => ({
        date: range.dates[Math.max(range.dates.length - rangeValues.length, 0) + index] ?? `${index + 1}`,
        value,
      })),
    };
  });
}

function buildStrengthProgressData(trend: AthleteProfile["exerciseTrends"][number]) {
  const values = trend.values.length > 0 ? trend.values : [0];
  const labels = ["1 апр", "8 апр", "15 апр", "22 апр", "1 мая", "15 мая", "22 мая"];
  const start = Math.round(values[0] ?? 0);
  const current = Math.round(values.at(-1) ?? start);

  return {
    start,
    current,
    data: values.map((value, index) => ({
      date: labels[Math.max(labels.length - values.length, 0) + index] ?? `${index + 1}`,
      value: Math.round(value),
    })),
  };
}

function calculatePercentGrowth(start: number, current: number) {
  if (start <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(((current - start) / start) * 100));
}

function findMeasurement(athlete: AthleteProfile, label: string) {
  return athlete.measurements.find((measurement) => measurement.label.toLowerCase().includes(label.toLowerCase()));
}

function formatSignedValue(value: number, unit: string, fractionDigits = 0) {
  if (Math.abs(value) < 0.05) {
    return `0 ${unit}`;
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(fractionDigits)} ${unit}`;
}

function formatMeasurementDelta(delta: string) {
  const value = parseMeasurementNumber(delta);

  return formatSignedValue(value, "см");
}

function buildMeasurementSpark(measurement: AthleteProfile["measurements"][number] | undefined) {
  if (!measurement) {
    return [8, 8, 8, 8, 8, 8, 8];
  }

  const current = parseMeasurementNumber(measurement.value);
  const delta = parseMeasurementNumber(measurement.delta);
  const start = current - delta;

  return Array.from({ length: 7 }).map((_, index) => {
    const progress = index / 6;

    return start + delta * progress;
  });
}

function parseMeasurementNumber(value: string) {
  return Number.parseFloat(value.replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
}
