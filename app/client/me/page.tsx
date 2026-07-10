"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  ChartLine,
  ChevronRight,
  Dumbbell,
  MessageCircle,
  Play,
  Settings,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { createClient } from "@/lib/supabase-client";
import { loadVisibleExerciseTitles } from "@/lib/exercise-library";
import { formatSupabaseError, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { DemoClientMePage } from "@/components/demo/demo-client-cabinet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AchievementsStrip } from "@/src/features/client-dashboard/components/AchievementsStrip";
import { RecommendedPrograms } from "@/src/features/client-dashboard/components/RecommendedPrograms";
import { TrainerCard } from "@/src/features/client-dashboard/components/TrainerCard";
import { ClientMiniAnalyticsCard } from "@/src/features/execution/components/ClientMiniAnalyticsCard";

const supabase = createClient();

type ClientProfile = {
  id: string;
  full_name: string | null;
  trainer_id: string | null;
  weight?: number | null;
  height?: number | null;
  target_weight?: number | null;
};

type TrainerProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
};

type WorkoutLogRow = {
  exercise_id: string;
  performed_weight: number | null;
  performed_reps: number | string | null;
  created_at: string;
};

type TrainerWorkoutReviewRow = {
  workout_date: string;
  status: "needs_review" | "reviewed" | null;
  comment: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
  client_seen_at: string | null;
};

type WeightLogRow = {
  weight: number;
  created_at: string;
};

type AssignedProgramRow = {
  client_id: string;
  template_id: string;
  status: string | null;
};

type PlanExercise = {
  id: string;
  title: string;
  sets?: string;
  reps?: string;
};

type PlanDay = {
  id: string;
  name: string;
  exercises: PlanExercise[];
};

type PlanWeek = {
  id: string;
  name: string;
  days: PlanDay[];
};

type PlanJson = {
  weeks: PlanWeek[];
};

type TemplateRow = {
  id: string;
  title: string;
  goal: string | null;
  plan_json: PlanJson | null;
};

type ExerciseRow = {
  id: string;
  title: string;
};

type QueryResult<T> = {
  data: T;
  error: unknown;
};

type UpcomingWorkout = {
  id: string;
  title: string;
  dayLabel: string;
  meta: string;
  status: string;
};

type DemoScenarioKey =
  | "trainer_with_workout"
  | "trainer_no_workout"
  | "purchased_program"
  | "fresh_start";

type DemoScenario = {
  label: string;
  hasTrainer: boolean;
  hasTrainerAssignedWorkouts: boolean;
  hasPurchasedProgram: boolean;
  upcomingWorkouts: UpcomingWorkout[];
};

type DemoProgressMetricKey = "weight" | "activity" | "strength";

const baseUpcomingWorkout: UpcomingWorkout = [
  {
    id: "upcoming-1",
    title: "Верх тела",
    dayLabel: "Завтра",
    meta: "~45 мин · 7 упражнений",
    status: "От тренера",
  },
][0];

const demoScenarios: Record<DemoScenarioKey, DemoScenario> = {
  trainer_with_workout: {
    label: "Тренер назначил",
    hasTrainer: true,
    hasTrainerAssignedWorkouts: true,
    hasPurchasedProgram: false,
    upcomingWorkouts: [baseUpcomingWorkout],
  },
  trainer_no_workout: {
    label: "Тренер без плана",
    hasTrainer: true,
    hasTrainerAssignedWorkouts: false,
    hasPurchasedProgram: false,
    upcomingWorkouts: [],
  },
  purchased_program: {
    label: "Купленная программа",
    hasTrainer: false,
    hasTrainerAssignedWorkouts: false,
    hasPurchasedProgram: true,
    upcomingWorkouts: [],
  },
  fresh_start: {
    label: "Новый клиент",
    hasTrainer: false,
    hasTrainerAssignedWorkouts: false,
    hasPurchasedProgram: false,
    upcomingWorkouts: [],
  },
};

const demoProgressSeries = [
  { label: "01", weight: 79.8, activity: 48, strength: 74 },
  { label: "05", weight: 79.2, activity: 64, strength: 76 },
  { label: "09", weight: 78.9, activity: 72, strength: 79 },
  { label: "13", weight: 78.5, activity: 58, strength: 80 },
  { label: "17", weight: 78.2, activity: 81, strength: 82 },
  { label: "21", weight: 77.9, activity: 69, strength: 84 },
  { label: "25", weight: 77.5, activity: 86, strength: 86 },
  { label: "29", weight: 77.2, activity: 74, strength: 87 },
];

function initials(value: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "A";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeTelegramLink(value: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("@")) return `https://t.me/${v.slice(1)}`;
  return v;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

function formatWeight(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} кг`;
}

function groupWorkoutDays(rows: WorkoutLogRow[]) {
  const grouped = new Map<
    string,
    {
      dateKey: string;
      createdAt: string;
      logs: WorkoutLogRow[];
      tonnage: number;
    }
  >();

  rows.forEach((row) => {
    const dateKey = row.created_at.slice(0, 10);
    const existing = grouped.get(dateKey) ?? {
      dateKey,
      createdAt: row.created_at,
      logs: [],
      tonnage: 0,
    };
    existing.logs.push(row);
    const weight = Number(row.performed_weight ?? 0);
    const reps = Number(row.performed_reps ?? 0);
    existing.tonnage += Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : 0;
    grouped.set(dateKey, existing);
  });

  return [...grouped.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function computeStreak(rows: WorkoutLogRow[]) {
  const dayKeys = [...new Set(rows.map((row) => row.created_at.slice(0, 10)))].sort(
    (a, b) => b.localeCompare(a)
  );
  if (dayKeys.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(dayKeys[i - 1]).getTime();
    const current = new Date(dayKeys[i]).getTime();
    const diff = Math.round((prev - current) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

async function loadTrainerProfile(trainerId: string): Promise<QueryResult<TrainerProfile | null>> {
  const fullRes = await supabase
    .from("profiles")
    .select("id, full_name, display_name, team_logo_url, telegram_link")
    .eq("id", trainerId)
    .maybeSingle();

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? null) as TrainerProfile | null,
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", trainerId)
    .maybeSingle();

  return {
    data: fallbackRes.data
      ? ({
          id: (fallbackRes.data as { id: string }).id,
          full_name: (fallbackRes.data as { full_name?: string | null }).full_name ?? null,
          display_name: null,
          team_logo_url: null,
          telegram_link: null,
        } as TrainerProfile)
      : null,
    error: fallbackRes.error,
  };
}

async function loadWorkoutLogs(userId: string): Promise<QueryResult<WorkoutLogRow[]>> {
  const fullRes = await supabase
    .from("workout_logs")
    .select("exercise_id, performed_weight, performed_reps, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as WorkoutLogRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_logs")
    .select("exercise_id, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  return {
    data: ((fallbackRes.data ?? []) as Array<{ exercise_id?: string | null; created_at: string }>).map(
      (row) => ({
        exercise_id: row.exercise_id ?? "exercise",
        performed_weight: null,
        performed_reps: null,
        created_at: row.created_at,
      })
    ),
    error: fallbackRes.error,
  };
}

async function loadTrainerWorkoutReviews(userId: string): Promise<QueryResult<TrainerWorkoutReviewRow[]>> {
  const res = await supabase
    .from("trainer_workout_reviews")
    .select("workout_date, status, comment, reviewed_at, updated_at, client_seen_at")
    .eq("client_id", userId)
    .eq("status", "reviewed")
    .order("workout_date", { ascending: false })
    .limit(20);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [], error: null };
  }

  return {
    data: (res.data ?? []) as TrainerWorkoutReviewRow[],
    error: res.error,
  };
}

async function loadProgramAccess(userId: string): Promise<QueryResult<AssignedProgramRow[]>> {
  const assignedRes = await supabase
    .from("assigned_programs")
    .select("client_id, template_id, status")
    .eq("client_id", userId);

  const assignedMissing = isSupabaseSchemaMismatch(assignedRes.error);
  const assignedRows = assignedMissing ? [] : ((assignedRes.data ?? []) as AssignedProgramRow[]);

  const purchasedRes = await supabase
    .from("client_programs")
    .select("template_id")
    .eq("client_id", userId);

  const purchasedMissing = isSupabaseSchemaMismatch(purchasedRes.error);
  const purchasedRows = purchasedMissing
    ? []
    : ((purchasedRes.data ?? []) as Array<{ template_id: string }>).map((row) => ({
        client_id: userId,
        template_id: row.template_id,
        status: "purchased",
      }));

  return {
    data: [...assignedRows, ...purchasedRows],
    error:
      (!assignedMissing && assignedRes.error) ||
      (!purchasedMissing && purchasedRes.error) ||
      null,
  };
}

async function loadTemplates(trainerId: string): Promise<QueryResult<TemplateRow[]>> {
  const fullRes = await supabase
    .from("workout_templates")
    .select("id, title, goal, plan_json")
    .eq("trainer_id", trainerId);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as TemplateRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title, plan_json")
    .eq("trainer_id", trainerId);

  return {
    data: ((fallbackRes.data ?? []) as Array<{
      id: string;
      title: string;
      plan_json?: PlanJson | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      goal: null,
      plan_json: row.plan_json ?? null,
    })),
    error: fallbackRes.error,
  };
}

export default function ClientMePage() {
  if (isDemoModeEnabled()) {
    return (
      <>
        <DemoClientMePage />
        <HeaderCopyInjector />
        <DemoDashboardFlowInjector />
        <HistoryCompactInjector />
        <RecommendedProgramsInjector />
      </>
    );
  }

  return (
    <>
      <ClientMeSupabasePage />
      <LayoutRhythmInjector />
      <HeaderCopyInjector />
      <AchievementsStripInjector />
      <TrainerCardInjector />
      <RecommendedProgramsInjector />
    </>
  );
}

function DemoDashboardFlowInjector() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scenarioKey, setScenarioKey] = useState<DemoScenarioKey>("trainer_with_workout");
  const [progressMetric, setProgressMetric] = useState<DemoProgressMetricKey>("weight");
  const scenario = demoScenarios[scenarioKey];
  const availableUpcomingWorkouts = scenario.hasTrainerAssignedWorkouts
    ? scenario.upcomingWorkouts
    : [];
  const progressMetricConfig: Record<
    DemoProgressMetricKey,
    {
      label: string;
      dataKey: DemoProgressMetricKey;
      description: string;
      insight?: string;
      exerciseName?: string;
      valueFormatter: (value: number) => string;
      stroke: string;
      domainPadding: number;
    }
  > = {
    weight: {
      label: "Вес",
      dataKey: "weight",
      description: "Вес идёт вниз без резких скачков",
      insight: "Текущий фокус — стабильное снижение веса",
      valueFormatter: (value) => `${value.toFixed(1)} кг`,
      stroke: "#d6ff80",
      domainPadding: 0.4,
    },
    activity: {
      label: "Активность",
      dataKey: "activity",
      description: "Ритм тренировок держится стабильно",
      insight: "Лучше всего держится тренировочный ритм",
      valueFormatter: (value) => `${Math.round(value)}%`,
      stroke: "#67e8f9",
      domainPadding: 8,
    },
    strength: {
      label: "Сила",
      dataKey: "strength",
      description: "Лучший прогресс сейчас показывает жим ногами",
      insight: "Самый сильный рост за период",
      exerciseName: "Жим ногами",
      valueFormatter: (value) => `${Math.round(value)} кг`,
      stroke: "#c084fc",
      domainPadding: 4,
    },
  };
  const activeProgressMetric = progressMetricConfig[progressMetric];

  useEffect(() => {
    let frameId = 0;
    const hero = document.querySelector<HTMLElement>('section[aria-label="Фокус недели"]');
    if (!hero || !hero.parentElement) return undefined;

    const firstGrid = hero.nextElementSibling as HTMLElement | null;
    const secondGrid = firstGrid?.nextElementSibling as HTMLElement | null;

    if (firstGrid) firstGrid.dataset.dashboardFlowHidden = "true";
    if (secondGrid) secondGrid.dataset.dashboardFlowHidden = "true";

    const focusTitle = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span")
    ).find((element) => element.textContent?.trim() === "Фокус недели");

    if (focusTitle) {
      let current: HTMLElement | null = focusTitle;
      while (current) {
        const className = typeof current.className === "string" ? current.className : "";
        if (
          className.includes("border-zinc-800") &&
          className.includes("rounded-[1.45rem]")
        ) {
          current.dataset.dashboardFlowCardHidden = "true";
          break;
        }
        current = current.parentElement;
      }
    }

    let anchor = hero.parentElement.querySelector<HTMLElement>("[data-dashboard-flow-anchor]");
    if (!anchor) {
      anchor = document.createElement("div");
      anchor.dataset.dashboardFlowAnchor = "true";
      hero.insertAdjacentElement("afterend", anchor);
    }

    frameId = window.requestAnimationFrame(() => {
      setTarget(anchor);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  if (!target) return null;

  return (
    <>
      <style jsx global>{`
        [data-dashboard-flow-hidden="true"],
        [data-dashboard-flow-card-hidden="true"] {
          display: none !important;
        }
      `}</style>
      {createPortal(
        <div data-dashboard-flow-portal className="mt-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(demoScenarios) as Array<[DemoScenarioKey, DemoScenario]>).map(
              ([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScenarioKey(key)}
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm transition",
                    scenarioKey === key
                      ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.08fr,0.92fr]">
            <Card className="rounded-[1.6rem] border-zinc-800/90 bg-zinc-950/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-zinc-50">Прогресс за 30 дней</CardTitle>
                <CardDescription className="text-zinc-400">
                  Вес, ритм тренировок и силовой результат без лишнего шума.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.28fr)_minmax(260px,0.72fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DemoMetricCard
                      label="Тренировки"
                      value="3 / 4"
                      helper="По плану недели"
                    />
                    <DemoMetricCard
                      label="Вес"
                      value="-1.2 кг"
                      helper="За 30 дней"
                    />
                    <DemoMetricCard
                      label="Сила"
                      value="+5 кг"
                      helper="Жим ногами"
                    />
                  </div>

                  <div className="rounded-[1.25rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Динамика
                        </p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">
                          {activeProgressMetric.description}
                        </p>
                        {activeProgressMetric.exerciseName ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            Упражнение: {activeProgressMetric.exerciseName}
                          </p>
                        ) : activeProgressMetric.insight ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {activeProgressMetric.insight}
                          </p>
                        ) : null}
                      </div>
                      <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/75 p-1 text-xs">
                        {(Object.entries(progressMetricConfig) as Array<
                          [DemoProgressMetricKey, (typeof progressMetricConfig)[DemoProgressMetricKey]]
                        >).map(([key, metric]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setProgressMetric(key)}
                            className={[
                              "rounded-full px-3 py-1.5 transition",
                              progressMetric === key
                                ? "bg-lime-300/12 text-lime-100"
                                : "text-zinc-500 hover:text-zinc-200",
                            ].join(" ")}
                          >
                            {metric.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={demoProgressSeries} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="demoClientProgressFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(214,255,128,0.45)" />
                              <stop offset="68%" stopColor="rgba(103,232,249,0.14)" />
                              <stop offset="100%" stopColor="rgba(9,9,11,0)" />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#71717a", fontSize: 11 }}
                          />
                          <YAxis
                            hide
                            domain={[
                              `dataMin - ${activeProgressMetric.domainPadding}`,
                              `dataMax + ${activeProgressMetric.domainPadding}`,
                            ]}
                          />
                          <Tooltip
                            cursor={{ stroke: "rgba(214,255,128,0.14)" }}
                            content={({ active, payload, label }) => {
                              const point = payload?.[0]?.payload as
                                | { weight: number; activity: number; strength: number }
                                | undefined;
                              if (!active || !point) return null;
                              return (
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                                  {activeProgressMetric.exerciseName ? (
                                    <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                      {activeProgressMetric.exerciseName}
                                    </div>
                                  ) : null}
                                  <div className="font-semibold">
                                    {activeProgressMetric.valueFormatter(point[activeProgressMetric.dataKey])}
                                  </div>
                                  <div className="mt-1 text-zinc-500">День {label}</div>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey={activeProgressMetric.dataKey}
                            stroke={activeProgressMetric.stroke}
                            strokeWidth={2.2}
                            fill="url(#demoClientProgressFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <Link
                      href="/client/progress"
                      className="mt-3 inline-flex items-center text-sm font-medium text-zinc-300 transition hover:text-zinc-50"
                    >
                      Открыть подробную статистику
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="flex h-full flex-col gap-3">
                  <div className="rounded-[1.2rem] border border-zinc-800/85 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                      Быстрые выводы
                    </p>
                    <div className="mt-3 space-y-2.5">
                      <ProgressInsightRow
                        title="6 дней подряд без пропусков"
                        helper="Лучший ритм за последний месяц"
                      />
                      <ProgressInsightRow
                        title="Жим ногами: +5 кг"
                        helper="Самый сильный сдвиг этой недели"
                      />
                      <ProgressInsightRow
                        title="Осталась 1 тренировка"
                        helper="До закрытия недельной цели"
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-lime-300/14 bg-[linear-gradient(180deg,rgba(214,255,128,0.12),rgba(9,9,11,0.45))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Следующий шаг
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-100">
                          {scenario.hasTrainer && availableUpcomingWorkouts.length > 0
                            ? "Открыть тренировку от тренера"
                            : scenario.hasTrainer
                              ? "Напомнить тренеру про план"
                              : scenario.hasPurchasedProgram
                                ? "Продолжить купленную программу"
                                : "Записать первую тренировку"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {scenario.hasTrainer && availableUpcomingWorkouts.length > 0
                            ? availableUpcomingWorkouts[0]?.meta
                            : scenario.hasTrainer
                              ? "Чтобы не выпадать из ритма на этой неделе"
                              : scenario.hasPurchasedProgram
                                ? "Следующий день уже готов внутри программы"
                                : "А дальше можно выбрать программу или тренера"}
                        </p>
                      </div>
                      <span className="rounded-full border border-lime-300/18 bg-lime-300/10 px-2.5 py-1 text-[11px] text-lime-100">
                        Сейчас
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Link
                        href={scenario.hasTrainer ? "/client/workouts" : scenario.hasPurchasedProgram ? "/client/workouts" : "/client/workouts"}
                        className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-black transition hover:bg-white"
                      >
                        {scenario.hasTrainer && availableUpcomingWorkouts.length > 0
                          ? "Открыть тренировки"
                          : scenario.hasTrainer
                            ? "Своя тренировка"
                            : scenario.hasPurchasedProgram
                              ? "Продолжить программу"
                              : "Своя тренировка"}
                      </Link>
                      <Link
                        href={scenario.hasTrainer ? "https://t.me/" : scenario.hasPurchasedProgram ? "/client/progress" : "/trainers"}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                      >
                        {scenario.hasTrainer
                          ? "Написать тренеру"
                          : scenario.hasPurchasedProgram
                            ? "Открыть прогресс"
                            : "Найти тренера"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.6rem] border-zinc-800/90 bg-zinc-950/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-zinc-50">
                  {scenario.hasPurchasedProgram ? "Текущая программа" : "Ближайшие тренировки"}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  {scenario.hasPurchasedProgram
                    ? "Текущий цикл и ближайший шаг по плану."
                    : "Ближайшее действие и следующий шаг в тренировках."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {scenario.hasPurchasedProgram ? (
                  <>
                    <div className="rounded-[1.2rem] border border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.14),rgba(9,9,11,0.45))] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Программа</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-50">
                        Снижение веса — 6 недель
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">3 неделя из 6</p>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-[1rem] border border-zinc-800 bg-black/20 px-4 py-3">
                        <p className="text-sm font-medium text-zinc-100">Следующий день</p>
                        <p className="mt-1 text-sm text-zinc-500">Верх тела</p>
                      </div>
                      <div className="rounded-[1rem] border border-zinc-800 bg-black/20 px-4 py-3">
                        <p className="text-sm font-medium text-zinc-100">Формат тренировки</p>
                        <p className="mt-1 text-sm text-zinc-500">~45 мин · 7 упражнений</p>
                      </div>
                    </div>

                    <Link
                      href="/client/workouts"
                      className="inline-flex items-center text-sm font-medium text-zinc-300 transition hover:text-zinc-50"
                    >
                      Продолжить программу
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </>
                ) : scenario.hasTrainer && availableUpcomingWorkouts.length > 0 ? (
                  <>
                    <div className="grid gap-3">
                      {availableUpcomingWorkouts.map((workout) => (
                        <div
                          key={workout.id}
                          className="rounded-[1.15rem] border border-zinc-800 bg-black/20 px-4 py-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-100">{workout.title}</p>
                              <p className="mt-1 text-sm text-zinc-500">{workout.dayLabel}</p>
                            </div>
                            <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[11px] text-lime-100">
                              {workout.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-zinc-400">{workout.meta}</p>
                        </div>
                      ))}
                    </div>

                    <Link
                      href="/client/workouts"
                      className="inline-flex items-center text-sm font-medium text-zinc-300 transition hover:text-zinc-50"
                    >
                      Открыть тренировки
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </>
                ) : scenario.hasTrainer ? (
                  <div className="space-y-3">
                    <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                      <p className="text-sm font-medium text-zinc-100">
                        Тренер пока не назначил тренировку
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Можно написать тренеру или записать самостоятельную сессию, чтобы не выпадать из ритма.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <Link
                        href="https://t.me/"
                        className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-100 px-4.5 text-sm font-semibold text-black transition hover:bg-white"
                      >
                        Написать тренеру
                      </Link>
                      <Link
                        href="/client/workouts"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                      >
                        Своя тренировка
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                      <p className="text-sm font-medium text-zinc-100">Начните тренировочный путь</p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Запишите первую самостоятельную тренировку, выберите программу или найдите онлайн-тренера.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <Link
                        href="/client/workouts"
                        className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-100 px-4.5 text-sm font-semibold text-black transition hover:bg-white"
                      >
                        Своя тренировка
                      </Link>
                      <Link
                        href="/client/workouts"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                      >
                        Выбрать программу
                      </Link>
                      <Link
                        href="/trainers"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                      >
                        Найти тренера
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:items-start">
            <div className="opacity-[0.98]">
              {scenario.hasTrainer ? <TrainerCard /> : <NoTrainerCard />}
            </div>
            <div className="opacity-[0.94]">
              <AchievementsStrip />
            </div>
          </div>
        </div>,
        target
      )}
    </>
  );
}

function NoTrainerCard() {
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.06),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(12,12,14,0.98))] p-5 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[radial-gradient(circle_at_bottom,rgba(163,230,53,0.08),transparent_72%)]" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Онлайн-тренер
            </p>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-zinc-50">
              Подберите наставника под свою цель
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Тренер поможет с программой, ритмом и корректировкой нагрузки по ходу недели.
            </p>
          </div>

          <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-[11px] text-zinc-400">
            Без тренера
          </span>
        </div>

        <div className="rounded-[1.35rem] border border-zinc-800/80 bg-black/20 p-4">
          <p className="text-sm font-medium text-zinc-100">Что даст сопровождение</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-400">
            <p>Персональный план и контроль прогресса</p>
            <p>Понятные следующие шаги по тренировкам</p>
            <p>Регулярная обратная связь без перегруза</p>
          </div>
        </div>

        <Link
          href="/trainers"
          className="inline-flex h-11 items-center justify-center rounded-full bg-lime-300 px-4.5 text-sm font-semibold text-black transition hover:bg-lime-200"
        >
          Выбрать тренера
          <ChevronRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function DemoMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-zinc-800/85 bg-black/20 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-400">{helper}</p>
    </div>
  );
}

function ProgressInsightRow({
  title,
  helper,
}: {
  title: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1rem] border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-3">
      <p className="text-sm font-medium text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}

function LayoutRhythmInjector() {
  useEffect(() => {
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      const mainElement =
        document.querySelector<HTMLElement>("main.flex-1") ??
        document.querySelector<HTMLElement>("main");
      if (mainElement) {
        mainElement.dataset.dashboardLayout = "client-home";
      }

      const cardRoleMap: Array<{ title: string; role: string }> = [
        { title: "Обзор прогресса", role: "overview" },
        { title: "Активность", role: "activity" },
        { title: "Достижения", role: "achievements" },
        { title: "Тренировки", role: "workouts" },
        { title: "Моя программа", role: "program" },
        { title: "Прогресс", role: "progress-secondary" },
        { title: "Связь с тренером", role: "trainer" },
        { title: "История тренировок", role: "history" },
      ];

      cardRoleMap.forEach(({ title, role }) => {
        const titleElement = Array.from(
          document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span")
        ).find((element) => element.textContent?.trim() === title);

        if (!titleElement) return;

        let current: HTMLElement | null = titleElement;
        while (current) {
          const className = typeof current.className === "string" ? current.className : "";
          if (
            className.includes("border-zinc-800") &&
            (className.includes("rounded-[1.45rem]") || className.includes("rounded-[2rem]"))
          ) {
            current.dataset.dashboardRole = role;
            const parentGrid = current.parentElement;
            if (parentGrid?.className.includes("grid")) {
              if (!parentGrid.dataset.dashboardGrid) {
                parentGrid.dataset.dashboardGrid =
                  role === "overview" || role === "activity" || role === "achievements"
                    ? "primary"
                    : role === "workouts" ||
                        role === "program" ||
                        role === "progress-secondary" ||
                        role === "trainer"
                      ? "secondary"
                      : "supporting";
              }
            }
            break;
          }
          current = current.parentElement;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <style jsx global>{`
      [data-dashboard-layout="client-home"] {
        gap: 1.25rem;
      }

      [data-dashboard-layout="client-home"] > .mt-4 {
        margin-top: 1.25rem;
      }

      [data-dashboard-grid="primary"],
      [data-dashboard-grid="secondary"],
      [data-dashboard-grid="supporting"] {
        gap: 1.25rem;
      }

      [data-achievements-strip-portal],
      [data-history-compact-portal],
      [data-progress-insights-portal],
      [data-trainer-card-portal],
      [data-recommended-programs-portal] {
        width: 100%;
      }

      @media (min-width: 1280px) {
        [data-dashboard-role="overview"] {
          grid-column: span 5 / span 5;
        }

        [data-dashboard-role="activity"] {
          grid-column: span 7 / span 7;
        }

        [data-dashboard-role="achievements"] {
          grid-column: 1 / -1;
        }

        [data-dashboard-role="workouts"],
        [data-dashboard-role="progress-secondary"] {
          grid-column: span 6 / span 6;
        }

        [data-dashboard-role="program"] {
          grid-column: span 5 / span 5;
        }

        [data-dashboard-role="trainer"] {
          grid-column: span 7 / span 7;
        }

        [data-dashboard-role="history"] {
          max-width: 56rem;
        }
      }
    `}</style>
  );
}

function HeaderCopyInjector() {
  useEffect(() => {
    const titles = Array.from(document.querySelectorAll<HTMLElement>("h1"));
    const mainTitle = titles.find((element) => element.textContent?.trim() === "Главная");
    if (mainTitle) {
      mainTitle.textContent = "Мой прогресс";
    }

    const paragraphs = Array.from(document.querySelectorAll<HTMLElement>("p"));

    const eyebrow = paragraphs.find(
      (element) => element.textContent?.trim() === "Личный кабинет клиента"
    );
    if (eyebrow) {
      eyebrow.textContent = "Личный кабинет клиента";
    }

    const description = paragraphs.find((element) =>
      element.textContent?.trim() ===
      "Компактный обзор тренировок, прогресса и задач на ближайшие дни."
    );
    if (description) {
      description.textContent =
        "Активность, достижения, программа и следующий шаг на этой неделе.";
    }
  }, []);

  return null;
}

function HistoryCompactInjector() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frameId = 0;
    const titleElement = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span")
    ).find((element) => element.textContent?.trim() === "История тренировок");

    if (!titleElement) return undefined;

    let current: HTMLElement | null = titleElement;
    while (current) {
      const className = typeof current.className === "string" ? current.className : "";
      if (
        className.includes("border-zinc-800") &&
        className.includes("rounded-[1.45rem]")
      ) {
        current.dataset.historyCompactReplaced = "true";
        frameId = window.requestAnimationFrame(() => {
          setTarget(current);
        });
        return () => {
          window.cancelAnimationFrame(frameId);
        };
      }
      current = current.parentElement;
    }

    return undefined;
  }, []);

  if (!target) return null;

  const items = [
    { title: "Ноги и core", date: "Сегодня", status: "Выполнено" },
    { title: "Верх тела", date: "24 апр", status: "Выполнено" },
    { title: "Круговая тренировка", date: "22 апр", status: "Выполнено" },
  ];

  return (
    <>
      <style jsx global>{`
        [data-history-compact-replaced="true"] > :not([data-history-compact-portal]) {
          display: none !important;
        }
      `}</style>
      {createPortal(
        <div
          data-history-compact-portal
          className="rounded-[1.45rem] border border-zinc-800/90 bg-zinc-950/90 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-[-0.02em] text-zinc-50">
                История тренировок
              </h3>
              <p className="mt-1 text-sm text-zinc-500">Три последние завершённые сессии.</p>
            </div>
            <Link
              href="/client/progress"
              className="text-sm text-zinc-400 transition hover:text-zinc-100"
            >
              Вся история
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={`${item.title}-${item.date}`}
                className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-800/80 bg-black/20 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.date}</p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950/75 px-2.5 py-1 text-[11px] text-zinc-300">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>,
        target
      )}
    </>
  );
}

function AchievementsStripInjector() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frameId = 0;
    const titleElement = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span")
    ).find((element) => element.textContent?.trim() === "Достижения");

    if (!titleElement) return undefined;

    let current: HTMLElement | null = titleElement;
    while (current) {
      const className = typeof current.className === "string" ? current.className : "";
      if (
        className.includes("border-zinc-800") &&
        (className.includes("rounded-[1.45rem]") || className.includes("rounded-[2rem]"))
      ) {
        current.dataset.achievementsStripReplaced = "true";
        frameId = window.requestAnimationFrame(() => {
          setTarget(current);
        });
        return () => {
          window.cancelAnimationFrame(frameId);
        };
      }
      current = current.parentElement;
    }

    return undefined;
  }, []);

  if (!target) return null;

  return (
    <>
      <style jsx global>{`
        [data-achievements-strip-replaced="true"] > :not([data-achievements-strip-portal]) {
          display: none !important;
        }
      `}</style>
      {createPortal(
        <div data-achievements-strip-portal>
          <AchievementsStrip />
        </div>,
        target
      )}
    </>
  );
}

function TrainerCardInjector() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frameId = 0;
    const titleElement = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span")
    ).find((element) => element.textContent?.trim() === "Связь с тренером");

    if (!titleElement) return undefined;

    let current: HTMLElement | null = titleElement;
    while (current) {
      const className = typeof current.className === "string" ? current.className : "";
      if (
        className.includes("border-zinc-800") &&
        (className.includes("rounded-[1.45rem]") || className.includes("rounded-[2rem]"))
      ) {
        current.dataset.trainerCardReplaced = "true";
        frameId = window.requestAnimationFrame(() => {
          setTarget(current);
        });
        return () => {
          window.cancelAnimationFrame(frameId);
        };
      }
      current = current.parentElement;
    }
    return undefined;
  }, []);

  if (!target) return null;

  return (
    <>
      <style jsx global>{`
        [data-trainer-card-replaced="true"] > :not([data-trainer-card-portal]) {
          display: none !important;
        }
      `}</style>
      {createPortal(
        <div data-trainer-card-portal>
          <TrainerCard />
        </div>,
        target
      )}
    </>
  );
}

function RecommendedProgramsInjector() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let frameId = 0;
    const mainElement =
      document.querySelector<HTMLElement>("main.flex-1") ??
      document.querySelector<HTMLElement>("main");

    if (!mainElement) return undefined;

    frameId = window.requestAnimationFrame(() => {
      setTarget(mainElement);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="mt-4" data-recommended-programs-portal>
      <RecommendedPrograms />
    </div>,
    target
  );
}

function ClientMeSupabasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLogRow[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>([]);
  const [workoutReviews, setWorkoutReviews] = useState<TrainerWorkoutReviewRow[]>([]);
  const [seenReviewDates, setSeenReviewDates] = useState<string[]>([]);
  const [seenReviewSavingDates, setSeenReviewSavingDates] = useState<string[]>([]);
  const [seenReviewErrors, setSeenReviewErrors] = useState<Record<string, string>>({});
  const [programs, setPrograms] = useState<AssignedProgramRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [nowTs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) logSupabaseError("client/me auth", authError);
      const userId = authData.user?.id;

      if (!userId) {
        router.replace("/login?role=client");
        return;
      }

      const clientRes = await supabase
        .from("profiles")
        .select("id, full_name, trainer_id, weight, height, target_weight")
        .eq("id", userId)
        .maybeSingle();

      if (clientRes.error) {
        logSupabaseError("client/me profile", clientRes.error);
      }

      const profile = (clientRes.data ?? null) as ClientProfile | null;
      if (!profile) {
        setLoading(false);
        return;
      }

      const trainerId = profile.trainer_id?.trim() || null;

      const [
        trainerRes,
        weightsRes,
        workoutsRes,
        reviewsRes,
        programsRes,
        templatesRes,
        exercisesRes,
      ] = await Promise.all([
        trainerId
          ? loadTrainerProfile(trainerId)
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("weight_logs")
          .select("weight, created_at")
          .eq("client_id", userId)
          .order("created_at", { ascending: true })
          .limit(240),
        loadWorkoutLogs(userId),
        loadTrainerWorkoutReviews(userId),
        loadProgramAccess(userId),
        trainerId ? loadTemplates(trainerId) : Promise.resolve({ data: [], error: null }),
        trainerId
          ? loadVisibleExerciseTitles(supabase, trainerId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      if (trainerRes.error) logSupabaseError("client/me trainer", trainerRes.error);
      if (weightsRes.error) logSupabaseError("client/me weights", weightsRes.error);
      if (workoutsRes.error) logSupabaseError("client/me workouts", workoutsRes.error);
      if (reviewsRes.error) logSupabaseError("client/me workout reviews", reviewsRes.error);
      if (programsRes.error) logSupabaseError("client/me programs", programsRes.error);
      if (templatesRes.error) logSupabaseError("client/me templates", templatesRes.error);
      if (exercisesRes.error) logSupabaseError("client/me exercises", exercisesRes.error);

      setClient(profile);
      setTrainer((trainerRes.data ?? null) as TrainerProfile | null);
      setWeightLogs((weightsRes.data ?? []) as WeightLogRow[]);
      setWorkoutLogs((workoutsRes.data ?? []) as WorkoutLogRow[]);
      setWorkoutReviews((reviewsRes.data ?? []) as TrainerWorkoutReviewRow[]);
      setPrograms((programsRes.data ?? []) as AssignedProgramRow[]);
      setTemplates((templatesRes.data ?? []) as TemplateRow[]);
      setExercises((exercisesRes.data ?? []) as ExerciseRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const detail = useMemo(() => {
    const activeProgram =
      programs.find((row) => row.status === "active") ??
      programs.find((row) => row.status === "purchased") ??
      programs[0] ??
      null;
    const activeTemplate = activeProgram
      ? templates.find((template) => template.id === activeProgram.template_id) ?? null
      : null;

    const latestWeight = weightLogs[weightLogs.length - 1]?.weight ?? client?.weight ?? null;
    const weekCutoff = nowTs - 7 * 24 * 60 * 60 * 1000;
    const weekBaseline =
      [...weightLogs]
        .reverse()
        .find((row) => new Date(row.created_at).getTime() <= weekCutoff)?.weight ??
      weightLogs[0]?.weight ??
      null;

    const weightChart = weightLogs.slice(-10).map((row) => ({
      label: formatDate(row.created_at),
      value: row.weight,
      fullDate: row.created_at,
    }));

	    const groupedWorkouts = groupWorkoutDays(workoutLogs);
	    const seenReviewDateSet = new Set(seenReviewDates);
	    const reviewMap = new Map(
	      workoutReviews
	        .filter((review) => review.status === "reviewed" && review.comment?.trim())
	        .map((review) => [review.workout_date, review])
	    );
	    const completedDays = groupedWorkouts.length;
    const streak = computeStreak(workoutLogs);

    const programDays =
      activeTemplate?.plan_json?.weeks?.flatMap((week) => week.days) ?? [];
    const todayProgramDay =
      programDays.length > 0 ? programDays[completedDays % programDays.length] : null;
    const todayLogs = workoutLogs.filter(
      (row) => nowTs - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000
    );

    const todayStatus =
      todayLogs.length === 0
        ? "Не начата"
        : todayProgramDay && todayLogs.length >= todayProgramDay.exercises.length
        ? "Выполнена"
        : "В процессе";

    const exerciseMap = new Map(exercises.map((row) => [row.id, row.title]));
    const strengthMap = new Map<string, { current: number; previous: number; title: string }>();
    workoutLogs.forEach((row) => {
      const title = exerciseMap.get(row.exercise_id) ?? "Упражнение";
      const weight = Number(row.performed_weight ?? 0);
      const existing = strengthMap.get(row.exercise_id) ?? { current: 0, previous: 0, title };
      if (weight > existing.current) {
        existing.previous = existing.current;
        existing.current = weight;
      } else if (weight > existing.previous) {
        existing.previous = weight;
      }
      strengthMap.set(row.exercise_id, existing);
    });

    const topLift = [...strengthMap.values()].sort((a, b) => b.current - a.current)[0] ?? null;
    const trainerWeek =
      activeTemplate && completedDays > 0 ? Math.max(1, Math.ceil(completedDays / 3)) : 1;

    return {
      activeTemplate,
      latestWeight,
      weeklyDelta:
        latestWeight != null && weekBaseline != null ? latestWeight - weekBaseline : null,
      weightChart,
	      groupedWorkouts,
	      historyItems: groupedWorkouts.slice(0, 3).map((item) => {
	        const firstTitle =
	          item.logs[0] ? exerciseMap.get(item.logs[0].exercise_id) ?? "Тренировка" : "Тренировка";
	        const extraCount = Math.max(0, item.logs.length - 1);
	        const review = reviewMap.get(item.dateKey);
	
	        return {
	          id: item.dateKey,
	          title: extraCount > 0 ? `${firstTitle} и ещё ${extraCount}` : firstTitle,
	          dateLabel: formatDate(item.createdAt),
	          status: "Выполнено",
	          trainerComment: review?.comment?.trim() || null,
	          trainerCommentSeen: review ? Boolean(review.client_seen_at) || seenReviewDateSet.has(review.workout_date) : false,
	        };
	      }),
	      trainerFeedback: workoutReviews
	        .filter((review) => review.status === "reviewed" && review.comment?.trim())
	        .slice(0, 3)
	        .map((review) => ({
	          id: review.workout_date,
	          dateLabel: formatDate(review.reviewed_at ?? review.updated_at ?? review.workout_date),
	          workoutDateLabel: formatDate(review.workout_date),
	          comment: review.comment?.trim() ?? "",
	          seen: Boolean(review.client_seen_at) || seenReviewDateSet.has(review.workout_date),
	        })),
	      streak,
      todayProgramDay,
      todayStatus,
      topLift,
      trainerWeek,
    };
	  }, [client, exercises, nowTs, programs, seenReviewDates, templates, weightLogs, workoutLogs, workoutReviews]);

  async function markFeedbackSeen(workoutDate: string) {
    if (seenReviewDates.includes(workoutDate)) return;

    setSeenReviewSavingDates((prev) => (prev.includes(workoutDate) ? prev : [...prev, workoutDate]));
    setSeenReviewErrors((prev) => {
      const next = { ...prev };
      delete next[workoutDate];
      return next;
    });

    const { error } = await supabase.rpc("mark_trainer_workout_review_seen", {
      workout_date: workoutDate,
    });

    setSeenReviewSavingDates((prev) => prev.filter((date) => date !== workoutDate));

    if (error) {
      const message = isSupabaseSchemaMismatch(error)
        ? "Функция отметки прочтения ещё не применена в Supabase."
        : formatSupabaseError(error);
      setSeenReviewErrors((prev) => ({ ...prev, [workoutDate]: message }));
      logSupabaseError("client/me review seen", error);
      return;
    }

    const seenAt = new Date().toISOString();
    setSeenReviewDates((prev) => (prev.includes(workoutDate) ? prev : [...prev, workoutDate]));
    setWorkoutReviews((prev) =>
      prev.map((review) =>
        review.workout_date === workoutDate ? { ...review, client_seen_at: seenAt } : review
      )
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-zinc-100">Профиль не найден</p>
            <p className="mt-2 text-sm text-zinc-500">
              Попробуйте перезайти в аккаунт.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trainerName = trainer?.display_name?.trim() || trainer?.full_name?.trim() || "Тренер";
  const telegramUrl = normalizeTelegramLink(trainer?.telegram_link ?? null);
  const clientName = client.full_name?.trim() || "Атлет";
  const latestFeedback = detail.trainerFeedback[0] ?? null;
  const goalText =
    client.target_weight != null && detail.latestWeight != null
      ? client.target_weight < detail.latestWeight
        ? "Снижение веса"
        : client.target_weight > detail.latestWeight
        ? "Набор веса"
        : "Поддержание формы"
      : "Прогресс под контролем";

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-5 md:py-8">
        <section className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 rounded-3xl bg-zinc-900 sm:h-16 sm:w-16">
                <AvatarImage src={trainer?.team_logo_url ?? undefined} alt={trainerName} />
                <AvatarFallback className="rounded-3xl bg-zinc-900 text-zinc-100">
                  {initials(clientName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-tight text-zinc-50">
                    {clientName}
                  </p>
                  <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                    {detail.activeTemplate ? `${detail.trainerWeek} неделя программы` : "Свободный режим"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {goalText}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                    Текущий вес: {formatWeight(detail.latestWeight)}
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                    Цель: {formatWeight(client.target_weight)}
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                    Тренер: {trainerName}
                  </span>
                </div>
              </div>
            </div>

            <Button
              asChild
              variant="ghost"
              size="icon"
              className="self-start rounded-2xl border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
            >
              <Link href="/client/settings" aria-label="Настройки профиля">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-zinc-50">Тренировка на сегодня</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Главная точка действия в приложении.
                  </CardDescription>
                </div>
                <Badge
                  className={
                    detail.todayStatus === "Выполнена"
                      ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : detail.todayStatus === "В процессе"
                      ? "rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200"
                      : "rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
                  }
                >
                  {detail.todayStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Core UX
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                      {detail.todayProgramDay?.name ?? "Свободная тренировка"}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {detail.activeTemplate
                        ? detail.activeTemplate.title
                        : "Тренируйтесь в свободном формате и сохраняйте прогресс"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-right">
                    <div className="text-xs text-zinc-500">Длительность</div>
                    <div className="text-lg font-semibold text-zinc-100">
                      {detail.todayProgramDay ? `${Math.max(35, detail.todayProgramDay.exercises.length * 8)} мин` : "45 мин"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  {(detail.todayProgramDay?.exercises ?? []).slice(0, 4).map((exercise) => (
                    <div
                      key={exercise.id}
                      className="flex items-center justify-between rounded-2xl border border-zinc-800/90 bg-black/20 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{exercise.title}</p>
                        <p className="text-xs text-zinc-500">
                          {[exercise.sets, exercise.reps].filter(Boolean).join(" × ") || "Подходы в плане"}
                        </p>
                      </div>
                      <Dumbbell className="h-4 w-4 text-zinc-600" />
                    </div>
                  ))}
                  {!detail.todayProgramDay ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
                      Сегодня можно начать свободную тренировку или открыть общий кабинет.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button
                    asChild
                    className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white"
                  >
                    <Link
                      href={
                        detail.activeTemplate
                          ? `/client/${client.id}?program=${detail.activeTemplate.id}`
                          : `/client/${client.id}`
                      }
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Начать тренировку
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  >
                    <Link href={`/client/${client.id}`}>
                      Внести веса и повторы
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <ClientMiniAnalyticsCard
                workoutsThisWeek={detail.groupedWorkouts.filter((item) => {
                  return nowTs - new Date(item.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
                }).length}
                streakCount={detail.streak}
                liftName={detail.topLift?.title ?? "Любимое упражнение"}
                liftFromKg={detail.topLift?.previous ?? 0}
                liftToKg={detail.topLift?.current ?? 0}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Связь с тренером</CardTitle>
              <CardDescription className="text-zinc-400">
                Telegram остаётся частью маршрута и усиливает поддержку.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 rounded-2xl bg-zinc-900">
                    <AvatarImage src={trainer?.team_logo_url ?? undefined} alt={trainerName} />
                    <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                      {initials(trainerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{trainerName}</p>
                    <p className="text-xs text-zinc-500">Ваш наставник</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <Button
                  asChild
                  className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white"
                >
                  <Link href={telegramUrl ?? "https://web.telegram.org/"} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Написать тренеру
                  </Link>
                </Button>
	                <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
	                  <p className="text-sm font-medium text-zinc-100">Уведомления</p>
	                  <div className="mt-3 grid gap-2">
	                    {latestFeedback ? (
	                      <div className="rounded-[1rem] border border-lime-300/16 bg-lime-300/[0.045] px-3 py-3">
	                        <div className="flex items-center justify-between gap-3">
	                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-lime-100">
	                            {latestFeedback.seen ? "Разбор принят" : "Новый разбор"}
	                          </p>
	                          <span className="text-[11px] text-zinc-500">{latestFeedback.dateLabel}</span>
	                        </div>
	                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-200">
	                          {latestFeedback.comment}
	                        </p>
	                        <p className="mt-2 text-xs text-zinc-500">
	                          Тренировка: {latestFeedback.workoutDateLabel}
	                        </p>
	                        {latestFeedback.seen ? (
	                          <p className="mt-3 text-xs text-lime-100">Отмечено как прочитанное</p>
	                        ) : (
	                          <Button
	                            type="button"
	                            onClick={() => void markFeedbackSeen(latestFeedback.id)}
	                            disabled={seenReviewSavingDates.includes(latestFeedback.id)}
	                            className="mt-3 h-9 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200 disabled:opacity-60"
	                          >
	                            {seenReviewSavingDates.includes(latestFeedback.id) ? "Отмечаем..." : "Принял"}
	                          </Button>
	                        )}
	                        {seenReviewErrors[latestFeedback.id] ? (
	                          <p className="mt-2 text-xs leading-relaxed text-rose-200">
	                            {seenReviewErrors[latestFeedback.id]}
	                          </p>
	                        ) : null}
	                      </div>
	                    ) : null}
	                    <NotificationPill text="Сегодня доступна тренировка" />
	                    {detail.activeTemplate ? (
	                      <NotificationPill text={`Активна программа: ${detail.activeTemplate.title}`} />
                    ) : null}
                    <NotificationPill text="Можно запросить новые замеры через настройки" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-zinc-50">Динамика веса</CardTitle>
                <CardDescription className="text-zinc-400">
                  Только то, что дополняет общую сводку сверху.
                </CardDescription>
              </div>
              <ChartLine className="h-5 w-5 text-zinc-500" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-48">
                {detail.weightChart.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 text-sm text-zinc-500">
                    Добавьте первые замеры в настройках
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detail.weightChart}>
                      <defs>
                        <linearGradient id="clientDashboardWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f4f4f5" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="#f4f4f5" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as
                            | { value: number; fullDate: string }
                            | undefined;
                          if (!active || !point) return null;
                          return (
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100">
                              <div className="font-semibold">{point.value} кг</div>
                              <div className="text-zinc-500">{formatDate(point.fullDate)}</div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#f4f4f5"
                        strokeWidth={2}
                        fill="url(#clientDashboardWeight)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MotivationCard
                  title="Силовой сдвиг"
                  value={
                    detail.topLift
                      ? `${detail.topLift.title}: ${detail.topLift.previous || 0} → ${detail.topLift.current} кг`
                      : "Первые тренировки создадут базу"
                  }
                  icon={<Trophy className="h-4 w-4" />}
                />
                <MotivationCard
                  title="Замеры"
                  value={
                    detail.weightChart.length > 0
                      ? `${detail.weightChart.length} отметок в истории веса`
                      : "История начнётся после первого замера"
                  }
                  icon={<ChartLine className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-zinc-50">История тренировок</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Последние завершённые тренировки.
                    </CardDescription>
                  </div>
                  <Link
                    href="/client/progress"
                    className="text-sm text-zinc-400 transition hover:text-zinc-100"
                  >
                    Вся история
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {detail.historyItems.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-zinc-800 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                    История появится после первой тренировки.
                  </div>
                ) : (
                  detail.historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-800/80 bg-black/20 px-3.5 py-3"
                    >
	                      <div className="min-w-0">
	                        <p className="truncate text-sm font-medium text-zinc-100">{item.title}</p>
	                        <p className="mt-0.5 text-xs text-zinc-500">{item.dateLabel}</p>
		                        {item.trainerComment ? (
		                          <div className="mt-2 rounded-[0.9rem] border border-lime-300/12 bg-lime-300/[0.035] px-3 py-2">
		                            <div className="flex flex-wrap items-center gap-2">
		                              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-lime-100">
		                                Комментарий тренера
		                              </p>
		                              {item.trainerCommentSeen ? (
		                                <span className="rounded-full border border-lime-300/16 bg-lime-300/10 px-2 py-0.5 text-[10px] text-lime-100">
		                                  Принято
		                                </span>
		                              ) : null}
		                            </div>
		                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-300">
		                              {item.trainerComment}
		                            </p>
	                          </div>
	                        ) : null}
	                      </div>
                      <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950/75 px-2.5 py-1 text-[11px] text-zinc-300">
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
              <CardHeader>
                <CardTitle className="text-xl text-zinc-50">Замеры и фото</CardTitle>
                <CardDescription className="text-zinc-400">
                  Видимый прогресс мотивирует сильнее цифр.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MeasureCard label="Рост" value={client.height ? `${client.height} см` : "—"} />
                  <MeasureCard label="Целевой вес" value={formatWeight(client.target_weight)} />
                </div>
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 p-5 text-center">
                  <Camera className="mx-auto h-5 w-5 text-zinc-500" />
                  <p className="mt-3 text-sm font-medium text-zinc-100">Фото прогресса</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Загружайте фото и замеры в профиле, чтобы видеть разницу по неделям.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  >
                    <Link href="/client/settings">
                      Открыть профиль
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

function MotivationCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <span className="text-zinc-500">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-100">{value}</p>
    </div>
  );
}

function NotificationPill({ text }: { text: string }) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400">
      {text}
    </div>
  );
}

function MeasureCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-zinc-800/90 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}
