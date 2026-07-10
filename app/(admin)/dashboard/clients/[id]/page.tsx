"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  Copy,
  LineChart,
  MessageCircle,
  PauseCircle,
  Pencil,
  RefreshCcw,
  Ruler,
  Send,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { createClient } from "@/lib/supabase-client";
import { loadVisibleExerciseTitles } from "@/lib/exercise-library";
import { useTrainer } from "@/lib/auth-context";
import { isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient();

type ClientProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  trainer_id: string | null;
  weight?: number | null;
  height?: number | null;
  target_weight?: number | null;
  telegram_id?: string | null;
};

type TrainerClientLinkRow = {
  access_granted: boolean | null;
};

type WorkoutLogRow = {
  exercise_id: string;
  performed_weight: number | null;
  performed_reps: number | string | null;
  created_at: string;
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
  description: string | null;
  plan_json: PlanJson | null;
};

type ExerciseRow = {
  id: string;
  title: string;
};

type Period = "30d" | "90d" | "all";

type QueryResult<T> = {
  data: T;
  error: unknown;
};

function initials(value: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "C";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatRelative(value: string, nowTs: number): string {
  const ts = new Date(value).getTime();
  const diff = Math.max(1, Math.round((nowTs - ts) / (1000 * 60 * 60)));
  if (diff < 24) return `${diff} ч назад`;
  const days = Math.round(diff / 24);
  if (days < 7) return `${days} д назад`;
  return formatDate(value);
}

function formatWeight(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} кг`;
}

function goalLabel(profile: ClientProfile | null, templateGoal: string | null | undefined) {
  if (templateGoal === "weight_loss") return "Снижение веса";
  if (templateGoal === "muscle_gain") return "Набор массы";
  if (templateGoal === "strength") return "Рост силы";
  if (
    profile?.weight != null &&
    profile?.target_weight != null &&
    profile.target_weight < profile.weight
  ) {
    return "Снижение веса";
  }
  if (
    profile?.weight != null &&
    profile?.target_weight != null &&
    profile.target_weight > profile.weight
  ) {
    return "Набор веса";
  }
  return "Поддержание формы";
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
    const key = row.created_at.slice(0, 10);
    const existing = grouped.get(key) ?? {
      dateKey: key,
      createdAt: row.created_at,
      logs: [],
      tonnage: 0,
    };
    existing.logs.push(row);
    const weight = Number(row.performed_weight ?? 0);
    const reps = Number(row.performed_reps ?? 0);
    existing.tonnage += Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : 0;
    grouped.set(key, existing);
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

async function loadClientProfile(clientId: string): Promise<QueryResult<ClientProfile | null>> {
  const fullRes = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at, trainer_id, weight, height, target_weight, telegram_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? null) as ClientProfile | null,
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("profiles")
    .select("id, full_name, email, updated_at, trainer_id, weight, height, target_weight, telegram_id")
    .eq("id", clientId)
    .maybeSingle();

  return {
    data: fallbackRes.data
      ? ({
          id: (fallbackRes.data as { id: string }).id,
          full_name: (fallbackRes.data as { full_name?: string | null }).full_name ?? null,
          email: (fallbackRes.data as { email?: string | null }).email ?? null,
          created_at: (fallbackRes.data as { updated_at?: string | null }).updated_at ?? null,
          trainer_id: (fallbackRes.data as { trainer_id?: string | null }).trainer_id ?? null,
          weight: (fallbackRes.data as { weight?: number | null }).weight ?? null,
          height: (fallbackRes.data as { height?: number | null }).height ?? null,
          target_weight: (fallbackRes.data as { target_weight?: number | null }).target_weight ?? null,
          telegram_id: (fallbackRes.data as { telegram_id?: string | null }).telegram_id ?? null,
        } as ClientProfile)
      : null,
    error: fallbackRes.error,
  };
}

async function loadClientWorkoutLogs(clientId: string): Promise<QueryResult<WorkoutLogRow[]>> {
  const fullRes = await supabase
    .from("workout_logs")
    .select("exercise_id, performed_weight, performed_reps, created_at")
    .eq("client_id", clientId)
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
    .eq("client_id", clientId)
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

async function loadClientPrograms(clientId: string): Promise<QueryResult<AssignedProgramRow[]>> {
  const assignedRes = await supabase
    .from("assigned_programs")
    .select("client_id, template_id, status")
    .eq("client_id", clientId);

  if (isSupabaseSchemaMismatch(assignedRes.error)) {
    return { data: [], error: null };
  }

  return {
    data: (assignedRes.data ?? []) as AssignedProgramRow[],
    error: assignedRes.error,
  };
}

async function loadTemplates(trainerId: string): Promise<QueryResult<TemplateRow[]>> {
  const fullRes = await supabase
    .from("workout_templates")
    .select("id, title, goal, description, plan_json")
    .eq("trainer_id", trainerId);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as TemplateRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title, description, plan_json")
    .eq("trainer_id", trainerId);

  return {
    data: ((fallbackRes.data ?? []) as Array<{
      id: string;
      title: string;
      description?: string | null;
      plan_json?: PlanJson | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      goal: null,
      description: row.description ?? null,
      plan_json: row.plan_json ?? null,
    })),
    error: fallbackRes.error,
  };
}

export default function TrainerClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id;
  const { trainerId } = useTrainer();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("90d");
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [accessGranted, setAccessGranted] = useState(true);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLogRow[]>([]);
  const [programs, setPrograms] = useState<AssignedProgramRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [reminderSending, setReminderSending] = useState(false);
  const nowTs = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!trainerId || !clientId) return;
    const currentTrainerId = trainerId;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const [
        clientRes,
        linkRes,
        workoutsRes,
        weightsRes,
        programsRes,
        templatesRes,
        exercisesRes,
      ] = await Promise.all([
        loadClientProfile(clientId),
        supabase
          .from("trainer_clients")
          .select("access_granted")
          .eq("trainer_id", currentTrainerId)
          .eq("client_id", clientId)
          .maybeSingle(),
        loadClientWorkoutLogs(clientId),
        supabase
          .from("weight_logs")
          .select("weight, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: true })
          .limit(240),
        loadClientPrograms(clientId),
        loadTemplates(currentTrainerId),
        loadVisibleExerciseTitles(supabase, currentTrainerId),
      ]);

      if (cancelled) return;

      if (clientRes.error) logSupabaseError("trainer client profile", clientRes.error);
      if (linkRes.error) logSupabaseError("trainer client link", linkRes.error);
      if (workoutsRes.error) logSupabaseError("trainer client workouts", workoutsRes.error);
      if (weightsRes.error) logSupabaseError("trainer client weights", weightsRes.error);
      if (programsRes.error) logSupabaseError("trainer client programs", programsRes.error);
      if (templatesRes.error) logSupabaseError("trainer client templates", templatesRes.error);
      if (exercisesRes.error) logSupabaseError("trainer client exercises", exercisesRes.error);

      const profile = (clientRes.data ?? null) as ClientProfile | null;
      if (!profile || profile.trainer_id !== currentTrainerId) {
        setClient(null);
        setLoading(false);
        return;
      }

      setClient(profile);
      setAccessGranted(((linkRes.data as TrainerClientLinkRow | null)?.access_granted ?? true) !== false);
      setWorkoutLogs((workoutsRes.data ?? []) as WorkoutLogRow[]);
      setWeightLogs((weightsRes.data ?? []) as WeightLogRow[]);
      setPrograms((programsRes.data ?? []) as AssignedProgramRow[]);
      setTemplates((templatesRes.data ?? []) as TemplateRow[]);
      setExercises((exercisesRes.data ?? []) as ExerciseRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, trainerId]);

  const detail = useMemo(() => {
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 3650;
    const cutoff = nowTs - days * 24 * 60 * 60 * 1000;

    const filteredWeights = weightLogs.filter(
      (row) => new Date(row.created_at).getTime() >= cutoff
    );
    const filteredWorkouts = workoutLogs.filter(
      (row) => new Date(row.created_at).getTime() >= cutoff
    );

    const activeProgram = programs.find((row) => row.status === "active") ?? null;
    const activeTemplate = activeProgram
      ? templates.find((template) => template.id === activeProgram.template_id) ?? null
      : null;

    const chartWeights = filteredWeights.map((row) => ({
      label: new Date(row.created_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
      }),
      value: row.weight,
      fullDate: formatDate(row.created_at),
    }));

    const groupedWorkouts = groupWorkoutDays(filteredWorkouts);
    const latestWeight = filteredWeights[filteredWeights.length - 1]?.weight ?? client?.weight ?? null;
    const monthBaseline =
      [...filteredWeights]
        .reverse()
        .find((row) => nowTs - new Date(row.created_at).getTime() >= 28 * 24 * 60 * 60 * 1000)
        ?.weight ??
      filteredWeights[0]?.weight ??
      null;
    const weekBaseline =
      [...filteredWeights]
        .reverse()
        .find((row) => nowTs - new Date(row.created_at).getTime() >= 7 * 24 * 60 * 60 * 1000)
        ?.weight ??
      filteredWeights[0]?.weight ??
      null;

    const exerciseMap = new Map(exercises.map((row) => [row.id, row.title]));
    const strengthByExercise = new Map<
      string,
      { current: number; previous: number; title: string }
    >();

    filteredWorkouts.forEach((row) => {
      const title = exerciseMap.get(row.exercise_id) ?? "Упражнение";
      const weight = Number(row.performed_weight ?? 0);
      const existing = strengthByExercise.get(row.exercise_id) ?? {
        current: 0,
        previous: 0,
        title,
      };
      if (weight > existing.current) {
        existing.previous = existing.current;
        existing.current = weight;
      } else if (weight > existing.previous) {
        existing.previous = weight;
      }
      strengthByExercise.set(row.exercise_id, existing);
    });

    const topStrength = [...strengthByExercise.values()]
      .sort((a, b) => b.current - a.current)
      .slice(0, 4)
      .map((row) => ({
        title: row.title,
        current: row.current,
        previous: row.previous,
      }));

    const programDays =
      activeTemplate?.plan_json?.weeks?.flatMap((week) =>
        week.days.map((day) => ({
          id: day.id,
          week: week.name,
          name: day.name,
          exercises: day.exercises.length,
        }))
      ) ?? [];

    return {
      activeTemplate,
      chartWeights,
      groupedWorkouts,
      latestWeight,
      weekChange:
        latestWeight != null && weekBaseline != null ? latestWeight - weekBaseline : null,
      monthChange:
        latestWeight != null && monthBaseline != null ? latestWeight - monthBaseline : null,
      streak: computeStreak(filteredWorkouts),
      topStrength,
      programDays,
    };
  }, [client, exercises, nowTs, period, programs, templates, weightLogs, workoutLogs]);

  async function toggleAccess() {
    if (!trainerId || !clientId) return;
    const nextValue = !accessGranted;
    const { error } = await supabase
      .from("trainer_clients")
      .update({ access_granted: nextValue })
      .eq("trainer_id", trainerId)
      .eq("client_id", clientId);

    if (error) {
      logSupabaseError("trainer client toggle access", error);
      return;
    }

    setAccessGranted(nextValue);
  }

  async function sendReminder() {
    if (!clientId || !client) return;
    setReminderSending(true);
    try {
      await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientName: client.full_name ?? "клиент",
        }),
      });
    } finally {
      setReminderSending(false);
    }
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
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-zinc-100">Клиент не найден</p>
            <p className="mt-2 text-sm text-zinc-500">
              Возможно, он не привязан к вашему кабинету.
            </p>
            <Button asChild className="mt-6 rounded-full bg-zinc-100 text-black hover:bg-white">
              <Link href="/dashboard">Вернуться в dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = client.full_name?.trim() || "Клиент";

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к roster
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {(["30d", "90d", "all"] as Period[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  period === key
                    ? "border-zinc-100 bg-zinc-100 text-black"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {key === "30d" ? "30 дней" : key === "90d" ? "90 дней" : "Всё время"}
              </button>
            ))}
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
          <Card className="overflow-hidden rounded-[2rem] border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 rounded-3xl bg-zinc-900">
                    <AvatarFallback className="rounded-3xl bg-zinc-900 text-lg text-zinc-100">
                      {initials(clientName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-semibold tracking-tight text-zinc-50">
                        {clientName}
                      </p>
                      <Badge
                        className={
                          accessGranted
                            ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                            : "rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200"
                        }
                      >
                        {accessGranted ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      {goalLabel(client, detail.activeTemplate?.goal)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                        Рост: {client.height ? `${client.height} см` : "—"}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                        Вес: {formatWeight(detail.latestWeight)}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                        Цель: {formatWeight(client.target_weight)}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                        Старт: {formatDate(client.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  >
                    <Link
                      href={
                        detail.activeTemplate
                          ? `/dashboard/programs/${detail.activeTemplate.id}`
                          : "/dashboard/programs"
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void toggleAccess()}
                    className="rounded-full bg-zinc-100 text-black hover:bg-white"
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    {accessGranted ? "Завершить ведение" : "Возобновить ведение"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Быстрые действия</CardTitle>
              <CardDescription className="text-zinc-400">
                Коммуникация и корректировки без лишних шагов.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QuickActionButton
                href={
                  detail.activeTemplate
                    ? `/dashboard/programs/${detail.activeTemplate.id}`
                    : "/dashboard/programs"
                }
                label="Обновить программу"
                icon={<RefreshCcw className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => void sendReminder()}
                className="flex items-center justify-between rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/60"
              >
                <span className="flex items-center gap-3">
                  <span className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-zinc-50">Запросить замеры</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Через Telegram Mini App
                    </span>
                  </span>
                </span>
                <span className="text-xs text-zinc-500">
                  {reminderSending ? "..." : "Отправить"}
                </span>
              </button>
              <QuickActionButton
                href="https://web.telegram.org/"
                label="Открыть Telegram"
                icon={<MessageCircle className="h-4 w-4" />}
                external
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(client.email ?? "");
                }}
                className="flex items-center justify-between rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/60"
              >
                <span className="flex items-center gap-3">
                  <span className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
                    <Copy className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-zinc-50">Скопировать контакт</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{client.email ?? "Email не указан"}</span>
                  </span>
                </span>
              </button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-xl text-zinc-50">Прогресс</CardTitle>
                <CardDescription className="text-zinc-400">
                  Графики, замеры и ключевые сигналы по клиенту.
                </CardDescription>
              </div>
              <LineChart className="h-5 w-5 text-zinc-500" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard label="Текущий вес" value={formatWeight(detail.latestWeight)} />
                <StatCard label="За неделю" value={formatWeight(detail.weekChange)} />
                <StatCard label="За месяц" value={formatWeight(detail.monthChange)} />
                <StatCard label="Streak" value={`${detail.streak} тренировок`} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.3fr,0.95fr]">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Вес</p>
                    <Ruler className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="h-56">
                    {detail.chartWeights.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 text-sm text-zinc-500">
                        Пока нет истории веса
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.chartWeights}>
                          <defs>
                            <linearGradient id="clientWeightFill" x1="0" y1="0" x2="0" y2="1">
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
                                  <div className="text-zinc-500">{point.fullDate}</div>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#f4f4f5"
                            strokeWidth={2}
                            fill="url(#clientWeightFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Силовые</p>
                    <BarChart3 className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="h-56">
                    {detail.topStrength.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 text-sm text-zinc-500">
                        Нет данных по силовым
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detail.topStrength}>
                          <XAxis
                            dataKey="title"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#71717a", fontSize: 10 }}
                            interval={0}
                          />
                          <YAxis hide />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            content={({ active, payload }) => {
                              const point = payload?.[0]?.payload as
                                | { title: string; current: number; previous: number }
                                | undefined;
                              if (!active || !point) return null;
                              return (
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100">
                                  <div className="font-semibold">{point.title}</div>
                                  <div className="text-zinc-400">
                                    Сейчас: {point.current} кг
                                  </div>
                                  <div className="text-zinc-500">
                                    Было: {point.previous || 0} кг
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="current" radius={[8, 8, 0, 0]} fill="rgba(244,244,245,0.88)" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Текущая программа</CardTitle>
              <CardDescription className="text-zinc-400">
                Программа как живой поток, а не статичный документ.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.activeTemplate ? (
                <>
                  <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-zinc-50">
                          {detail.activeTemplate.title}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {goalLabel(client, detail.activeTemplate.goal)}
                        </p>
                      </div>
                      <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                        Активна
                      </Badge>
                    </div>
                    {detail.activeTemplate.description?.trim() ? (
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        {detail.activeTemplate.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {detail.programDays.slice(0, 5).map((day) => (
                      <div
                        key={day.id}
                        className="flex items-center justify-between rounded-[1.25rem] border border-zinc-800/90 bg-black/20 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{day.name}</p>
                          <p className="text-xs text-zinc-500">
                            {day.week} · {day.exercises} упражнений
                          </p>
                        </div>
                        <span className="text-xs text-zinc-500">В потоке</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                    >
                      <Link href={`/dashboard/programs/${detail.activeTemplate.id}`}>
                        Редактировать
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="rounded-full bg-zinc-100 text-black hover:bg-white"
                    >
                      <Link href={`/dashboard/programs/${detail.activeTemplate.id}`}>
                        Дублировать / обновить
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 px-5 py-10 text-center text-sm text-zinc-500">
                  У клиента пока нет активной программы.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Отчёты клиента</CardTitle>
              <CardDescription className="text-zinc-400">
                Последние тренировки, объём и рабочие веса.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.groupedWorkouts.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 px-5 py-10 text-center text-sm text-zinc-500">
                  История тренировок пока пуста.
                </div>
              ) : (
                detail.groupedWorkouts.slice(0, 6).map((day) => (
                  <div
                    key={day.dateKey}
                    className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-50">
                          {formatDate(day.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatRelative(day.createdAt, nowTs)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                          {day.logs.length} записей
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                          {Math.round(day.tonnage)} кг тоннаж
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Коммуникация</CardTitle>
              <CardDescription className="text-zinc-400">
                Telegram остаётся частью UX и усиливает ведение.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Telegram</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {client.telegram_id ? "Аккаунт клиента привязан" : "Telegram не привязан"}
                    </p>
                  </div>
                  <Badge
                    className={
                      client.telegram_id
                        ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : "rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
                    }
                  >
                    {client.telegram_id ? "Connected" : "Offline"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => void sendReminder()}
                  className="flex items-center justify-between rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
                      <Send className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-zinc-50">Отправить сообщение</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Быстрый nudging через бота
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-zinc-600" />
                </button>

                <QuickActionButton
                  href="https://web.telegram.org/"
                  label="Открыть Telegram"
                  icon={<MessageCircle className="h-4 w-4" />}
                  external
                />
              </div>

              <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                <p className="text-sm font-medium text-zinc-100">Последний сигнал</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {detail.groupedWorkouts[0]
                    ? `Последняя тренировка была ${formatRelative(detail.groupedWorkouts[0].createdAt, nowTs)}.`
                    : "Клиент ещё не присылал отчёты через приложение."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

function QuickActionButton({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto justify-between rounded-[1.4rem] border-zinc-800 bg-black/20 px-4 py-3 text-zinc-100 hover:bg-zinc-900"
    >
      <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
        <span className="inline-flex items-center gap-3">
          <span className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
            {icon}
          </span>
          {label}
        </span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}
