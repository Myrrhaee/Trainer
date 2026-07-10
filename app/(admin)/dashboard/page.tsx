"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ChartColumn,
  ClipboardList,
  Copy,
  DollarSign,
  Dumbbell,
  Library,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Users,
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
import { useTrainer } from "@/lib/auth-context";
import { isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { DemoTrainerDashboardPage } from "@/components/demo/demo-pages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const supabase = createClient();

type DashboardFilter =
  | "all"
  | "active"
  | "new"
  | "silent"
  | "reports"
  | "progress"
  | "paused";
type SortKey = "recent" | "progress" | "name" | "created";

type TrainerProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  slug: string | null;
};

type ClientProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  weight?: number | null;
  target_weight?: number | null;
  height?: number | null;
  telegram_id?: string | null;
};

type TrainerClientLinkRow = {
  client_id: string;
  access_granted: boolean | null;
};

type WorkoutLogRow = {
  client_id: string;
  exercise_id: string;
  performed_weight: number | null;
  performed_reps: number | string | null;
  created_at: string;
};

type WeightLogRow = {
  client_id: string;
  weight: number;
  created_at: string;
};

type PaymentRow = {
  amount: number;
  category: string | null;
  created_at: string;
};

type AssignedProgramRow = {
  client_id: string;
  template_id: string;
  status: string | null;
};

type TemplateRow = {
  id: string;
  title: string;
  goal: string | null;
};

type ClientStatus =
  | "Активен"
  | "Новый"
  | "Ждет ответа"
  | "На паузе"
  | "Нет данных"
  | "Без прогресса"
  | "Пора обновить программу";

type ClientCard = {
  id: string;
  name: string;
  email: string;
  initials: string;
  goal: string;
  currentWeight: number | null;
  createdAt: number | null;
  lastActiveLabel: string;
  lastActiveAt: number | null;
  statusLabel: ClientStatus;
  statusTone: "emerald" | "amber" | "zinc" | "sky" | "rose";
  weeklyDelta: number | null;
  reportsToday: boolean;
  accessGranted: boolean;
  activeProgramId: string | null;
  activeProgramTitle: string | null;
  isNew: boolean;
  needsProgramUpdate: boolean;
  needsAttention: boolean;
  missingProgress: boolean;
  missedWorkouts: boolean;
  lowActivity: boolean;
  recentWorkouts: number;
  lastMeasurementAt: number | null;
  needsMeasurements: boolean;
};

type AttentionItem = {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  description: string;
  priority: "Высокий" | "Средний" | "Низкий";
  tone: "rose" | "amber" | "sky";
  eventTime: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

type RecentSale = {
  id: string;
  title: string;
  amount: number;
  dateLabel: string;
  isNew: boolean;
};

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
  if (parts.length === 0) return "Т";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelative(date: string | null, nowTs: number): string {
  if (!date) return "Нет активности";
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return "Нет активности";
  const hours = Math.max(1, Math.round((nowTs - ts) / (1000 * 60 * 60)));
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} д назад`;
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

function formatChange(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "Нет данных";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} кг`;
}

function formatMetric(value: number) {
  return value > 0 ? String(value) : "—";
}

function goalLabel(
  client: ClientProfileRow,
  templateGoal: string | null | undefined
): string {
  if (templateGoal === "weight_loss") return "Снижение веса";
  if (templateGoal === "muscle_gain") return "Набор массы";
  if (templateGoal === "strength") return "Рост силы";
  if (templateGoal === "endurance") return "Выносливость";
  if (
    typeof client.weight === "number" &&
    typeof client.target_weight === "number"
  ) {
    if (client.target_weight < client.weight) return "Снижение веса";
    if (client.target_weight > client.weight) return "Набор веса";
  }
  return "Поддержание формы";
}

async function loadTrainerProfile(
  trainerId: string
): Promise<QueryResult<TrainerProfile | null>> {
  const fullRes = await supabase
    .from("profiles")
    .select("id, full_name, display_name, team_logo_url, slug")
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
          slug: null,
        } as TrainerProfile)
      : null,
    error: fallbackRes.error,
  };
}

async function loadTrainerClients(
  trainerId: string
): Promise<QueryResult<ClientProfileRow[]>> {
  const fullRes = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at, weight, target_weight, height, telegram_id")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as ClientProfileRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("profiles")
    .select("id, full_name, email, updated_at, weight, target_weight, height, telegram_id")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });

  return {
    data: ((fallbackRes.data ?? []) as Array<{
      id: string;
      full_name?: string | null;
      email?: string | null;
      updated_at?: string | null;
      weight?: number | null;
      target_weight?: number | null;
      height?: number | null;
      telegram_id?: string | null;
    }>).map((row) => ({
      id: row.id,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      created_at: row.updated_at ?? null,
      weight: row.weight ?? null,
      target_weight: row.target_weight ?? null,
      height: row.height ?? null,
      telegram_id: row.telegram_id ?? null,
    })),
    error: fallbackRes.error,
  };
}

async function loadWorkoutLogs(): Promise<QueryResult<WorkoutLogRow[]>> {
  const fullRes = await supabase
    .from("workout_logs")
    .select("client_id, exercise_id, performed_weight, performed_reps, created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as WorkoutLogRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_logs")
    .select("client_id, exercise_id, created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  return {
    data: ((fallbackRes.data ?? []) as Array<{
      client_id: string;
      exercise_id?: string | null;
      created_at: string;
    }>).map((row) => ({
      client_id: row.client_id,
      exercise_id: row.exercise_id ?? "exercise",
      performed_weight: null,
      performed_reps: null,
      created_at: row.created_at,
    })),
    error: fallbackRes.error,
  };
}

async function loadPayments(trainerId: string): Promise<QueryResult<PaymentRow[]>> {
  const res = await supabase
    .from("payments")
    .select("amount, category, created_at")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [], error: null };
  }

  return {
    data: (res.data ?? []) as PaymentRow[],
    error: res.error,
  };
}

async function loadAssignments(): Promise<QueryResult<AssignedProgramRow[]>> {
  const res = await supabase
    .from("assigned_programs")
    .select("client_id, template_id, status");

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [], error: null };
  }

  return {
    data: (res.data ?? []) as AssignedProgramRow[],
    error: res.error,
  };
}

async function loadTemplates(trainerId: string): Promise<QueryResult<TemplateRow[]>> {
  const fullRes = await supabase
    .from("workout_templates")
    .select("id, title, goal")
    .eq("trainer_id", trainerId);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as TemplateRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title")
    .eq("trainer_id", trainerId);

  return {
    data: ((fallbackRes.data ?? []) as Array<{ id: string; title: string }>).map((row) => ({
      id: row.id,
      title: row.title,
      goal: null,
    })),
    error: fallbackRes.error,
  };
}

export default function TrainerDashboardPage() {
  if (isDemoModeEnabled()) {
    return <DemoTrainerDashboardPage />;
  }

  return <TrainerDashboardSupabasePage />;
}

function TrainerDashboardSupabasePage() {
  const { trainerId } = useTrainer();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [clientRows, setClientRows] = useState<ClientProfileRow[]>([]);
  const [links, setLinks] = useState<TrainerClientLinkRow[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLogRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignedProgramRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [linkCopied, setLinkCopied] = useState(false);
  const [nowTs] = useState(() => Date.now());

  useEffect(() => {
    if (!trainerId) return;
    const currentTrainerId = trainerId;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      const [
        trainerRes,
        clientsRes,
        linksRes,
        workoutsRes,
        weightsRes,
        paymentsRes,
        assignmentsRes,
        templatesRes,
      ] = await Promise.all([
        loadTrainerProfile(currentTrainerId),
        loadTrainerClients(currentTrainerId),
        supabase
          .from("trainer_clients")
          .select("client_id, access_granted")
          .eq("trainer_id", currentTrainerId),
        loadWorkoutLogs(),
        supabase
          .from("weight_logs")
          .select("client_id, weight, created_at")
          .order("created_at", { ascending: true })
          .limit(400),
        loadPayments(currentTrainerId),
        loadAssignments(),
        loadTemplates(currentTrainerId),
      ]);

      if (cancelled) return;

      if (trainerRes.error) logSupabaseError("trainer dashboard profile", trainerRes.error);
      if (clientsRes.error) logSupabaseError("trainer dashboard clients", clientsRes.error);
      if (linksRes.error) logSupabaseError("trainer dashboard links", linksRes.error);
      if (workoutsRes.error) logSupabaseError("trainer dashboard logs", workoutsRes.error);
      if (weightsRes.error) logSupabaseError("trainer dashboard weights", weightsRes.error);
      if (paymentsRes.error) logSupabaseError("trainer dashboard payments", paymentsRes.error);
      if (assignmentsRes.error) logSupabaseError("trainer dashboard assignments", assignmentsRes.error);
      if (templatesRes.error) logSupabaseError("trainer dashboard templates", templatesRes.error);

      setTrainerProfile((trainerRes.data ?? null) as TrainerProfile | null);
      setClientRows((clientsRes.data ?? []) as ClientProfileRow[]);
      setLinks((linksRes.data ?? []) as TrainerClientLinkRow[]);
      setWorkoutLogs((workoutsRes.data ?? []) as WorkoutLogRow[]);
      setWeightLogs((weightsRes.data ?? []) as WeightLogRow[]);
      setPayments((paymentsRes.data ?? []) as PaymentRow[]);
      setAssignments((assignmentsRes.data ?? []) as AssignedProgramRow[]);
      setTemplates((templatesRes.data ?? []) as TemplateRow[]);
      setLoading(false);
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  const publicSlug = trainerProfile?.slug?.trim() ?? "";
  const publicLink =
    origin && publicSlug ? `${origin}/t/${encodeURIComponent(publicSlug)}` : "";

  const dashboard = useMemo(() => {
    const linksByClient = new Map(
      links.map((row) => [row.client_id, row.access_granted !== false])
    );

    const weightMap = new Map<string, WeightLogRow[]>();
    weightLogs.forEach((row) => {
      const items = weightMap.get(row.client_id) ?? [];
      items.push(row);
      weightMap.set(row.client_id, items);
    });

    const workoutMap = new Map<string, WorkoutLogRow[]>();
    workoutLogs.forEach((row) => {
      const items = workoutMap.get(row.client_id) ?? [];
      items.push(row);
      workoutMap.set(row.client_id, items);
    });

    const activePrograms = new Map<string, AssignedProgramRow>();
    assignments.forEach((row) => {
      if (row.status === "active" && !activePrograms.has(row.client_id)) {
        activePrograms.set(row.client_id, row);
      }
    });

    const templateMap = new Map(templates.map((row) => [row.id, row]));

    const cards: ClientCard[] = clientRows.map((client) => {
      const clientWeights = [...(weightMap.get(client.id) ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
      const clientWorkouts = [...(workoutMap.get(client.id) ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      const latestWorkout = clientWorkouts[0] ?? null;
      const latestWeight = clientWeights[clientWeights.length - 1]?.weight ?? client.weight ?? null;
      const latestMeasurement = clientWeights[clientWeights.length - 1] ?? null;
      const weekCutoff = nowTs - 7 * 24 * 60 * 60 * 1000;
      const baseline =
        [...clientWeights]
          .reverse()
          .find((row) => new Date(row.created_at).getTime() <= weekCutoff)?.weight ??
        clientWeights[0]?.weight ??
        null;
      const weeklyDelta =
        latestWeight != null && baseline != null ? latestWeight - baseline : null;
      const accessGranted = linksByClient.get(client.id) ?? true;
      const activeProgram = activePrograms.get(client.id) ?? null;
      const template = activeProgram ? templateMap.get(activeProgram.template_id) ?? null : null;

      const hasReportToday = clientWorkouts.some(
        (row) => nowTs - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000
      );
      const hoursSinceLast = latestWorkout
        ? (nowTs - new Date(latestWorkout.created_at).getTime()) / (1000 * 60 * 60)
        : Number.POSITIVE_INFINITY;
      const isNew =
        client.created_at != null &&
        nowTs - new Date(client.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
      const missingProgress =
        weeklyDelta != null && Math.abs(weeklyDelta) < 0.2 && latestWeight != null;
      const needsProgramUpdate =
        !!activeProgram &&
        !!latestWorkout &&
        nowTs - new Date(latestWorkout.created_at).getTime() > 9 * 24 * 60 * 60 * 1000;
      const missedWorkouts =
        Number.isFinite(hoursSinceLast) && hoursSinceLast > 72 && hoursSinceLast <= 120;
      const lowActivity =
        Number.isFinite(hoursSinceLast) && hoursSinceLast > 48 && hoursSinceLast <= 72;
      const recentWorkouts = clientWorkouts.filter(
        (row) => nowTs - new Date(row.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
      ).length;
      const lastMeasurementAt = latestMeasurement
        ? new Date(latestMeasurement.created_at).getTime()
        : null;
      const needsMeasurements =
        lastMeasurementAt == null || nowTs - lastMeasurementAt > 14 * 24 * 60 * 60 * 1000;
      const createdAt =
        client.created_at != null ? new Date(client.created_at).getTime() : null;

      let statusLabel: ClientStatus = "Нет данных";
      let statusTone: ClientCard["statusTone"] = "zinc";

      if (!accessGranted) {
        statusLabel = "На паузе";
        statusTone = "amber";
      } else if (isNew) {
        statusLabel = "Новый";
        statusTone = "sky";
      } else if (hoursSinceLast > 96) {
        statusLabel = "Ждет ответа";
        statusTone = "amber";
      } else if (needsProgramUpdate) {
        statusLabel = "Пора обновить программу";
        statusTone = "rose";
      } else if (missingProgress) {
        statusLabel = "Без прогресса";
        statusTone = "rose";
      } else if (Number.isFinite(hoursSinceLast)) {
        statusLabel = "Активен";
        statusTone = hasReportToday ? "sky" : "emerald";
      }

      return {
        id: client.id,
        name: client.full_name?.trim() || "Клиент",
        email: client.email?.trim() || "email не указан",
        initials: initials(client.full_name),
        goal: goalLabel(client, template?.goal),
        currentWeight: latestWeight,
        createdAt,
        lastActiveLabel: formatRelative(latestWorkout?.created_at ?? null, nowTs),
        lastActiveAt: latestWorkout ? new Date(latestWorkout.created_at).getTime() : null,
        statusLabel,
        statusTone,
        weeklyDelta,
        reportsToday: hasReportToday,
        accessGranted,
        activeProgramId: activeProgram?.template_id ?? null,
        activeProgramTitle: template?.title ?? null,
        isNew,
        needsProgramUpdate,
        needsAttention:
          hasReportToday ||
          missingProgress ||
          needsProgramUpdate ||
          missedWorkouts ||
          needsMeasurements ||
          lowActivity,
        missingProgress,
        missedWorkouts,
        lowActivity,
        recentWorkouts,
        lastMeasurementAt,
        needsMeasurements,
      };
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const reportsCount = cards.filter((card) => card.reportsToday).length;
    const silentCount = cards.filter((card) => card.statusLabel === "Ждет ответа").length;
    const monthRevenue = payments
      .filter((row) => new Date(row.created_at).getTime() >= monthStart.getTime())
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const programSales = payments.filter((row) =>
      (row.category ?? "").toLowerCase().includes("програм")
    ).length;
    const updateCount = cards.filter((card) => card.needsProgramUpdate).length;
    const pausedCount = cards.filter((card) => card.statusLabel === "На паузе").length;

    const attention: AttentionItem[] = cards
      .flatMap((card) => {
        const items: AttentionItem[] = [];

        if (card.reportsToday) {
          items.push({
            id: `${card.id}-report`,
            clientId: card.id,
            clientName: card.name,
            label: "Прислал отчёт по тренировке",
            description: "Нужна быстрая реакция по выполнению и самочувствию клиента.",
            priority: "Высокий",
            tone: "sky",
            eventTime: card.lastActiveLabel,
            actionLabel: "Открыть",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Написать",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.statusLabel === "Ждет ответа") {
          items.push({
            id: `${card.id}-silent`,
            clientId: card.id,
            clientName: card.name,
            label: "Не отвечает несколько дней",
            description: "Клиент выпал из диалога и требует отдельного контакта.",
            priority: "Высокий",
            tone: "amber",
            eventTime: card.lastActiveLabel,
            actionLabel: "Написать",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Открыть",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.isNew) {
          items.push({
            id: `${card.id}-new`,
            clientId: card.id,
            clientName: card.name,
            label: "Новый клиент ждёт первого действия",
            description: "Нужно познакомиться, назначить старт и зафиксировать первый шаг.",
            priority: "Высокий",
            tone: "sky",
            eventTime: "Добавлен недавно",
            actionLabel: "Открыть",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Назначить программу",
            secondaryHref: card.activeProgramId
              ? `/dashboard/programs/${card.activeProgramId}`
              : "/dashboard/programs",
          });
        }

        if (card.missedWorkouts) {
          items.push({
            id: `${card.id}-missed`,
            clientId: card.id,
            clientName: card.name,
            label: "Пропустил тренировку",
            description: "Ритм сбился, лучше быстро вернуть клиента в процесс.",
            priority: "Средний",
            tone: "amber",
            eventTime: card.lastActiveLabel,
            actionLabel: "Написать",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Запросить замеры",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.missingProgress) {
          items.push({
            id: `${card.id}-progress`,
            clientId: card.id,
            clientName: card.name,
            label: "Нет прогресса по весу",
            description: "Пора проверить план, восстановление и реальные действия клиента.",
            priority: "Средний",
            tone: "rose",
            eventTime: "Последняя неделя без сдвига",
            actionLabel: "Открыть",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Обновить программу",
            secondaryHref: card.activeProgramId
              ? `/dashboard/programs/${card.activeProgramId}`
              : "/dashboard/programs",
          });
        }

        if (card.needsProgramUpdate) {
          items.push({
            id: `${card.id}-program`,
            clientId: card.id,
            clientName: card.name,
            label: "Пора обновить программу",
            description: "Текущий план устарел и уже не даёт движения клиенту.",
            priority: "Высокий",
            tone: "amber",
            eventTime: "Текущий план давно без движения",
            actionLabel: "Обновить программу",
            actionHref: card.activeProgramId
              ? `/dashboard/programs/${card.activeProgramId}`
              : "/dashboard/programs",
            secondaryLabel: "Открыть клиента",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.needsMeasurements) {
          items.push({
            id: `${card.id}-measurements`,
            clientId: card.id,
            clientName: card.name,
            label: "Давно не было новых замеров",
            description: "Без актуальных данных сложнее корректировать нагрузку и питание.",
            priority: "Средний",
            tone: "amber",
            eventTime:
              card.lastMeasurementAt != null
                ? formatRelative(new Date(card.lastMeasurementAt).toISOString(), nowTs)
                : "Замеры ещё не отправлял",
            actionLabel: "Запросить замеры",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Открыть клиента",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.lowActivity) {
          items.push({
            id: `${card.id}-activity`,
            clientId: card.id,
            clientName: card.name,
            label: "Снизил активность",
            description: "Клиент стал реже заходить и может выпасть из режима.",
            priority: "Низкий",
            tone: "amber",
            eventTime: card.lastActiveLabel,
            actionLabel: "Написать",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Открыть клиента",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        if (card.recentWorkouts >= 3 && card.lastActiveAt && nowTs - card.lastActiveAt < 24 * 60 * 60 * 1000) {
          items.push({
            id: `${card.id}-week`,
            clientId: card.id,
            clientName: card.name,
            label: "Завершил неделю тренировок",
            description: "Хороший момент дать обратную связь и закрепить следующий шаг.",
            priority: "Низкий",
            tone: "sky",
            eventTime: `${card.recentWorkouts} тренировки за неделю`,
            actionLabel: "Открыть клиента",
            actionHref: `/dashboard/clients/${card.id}`,
            secondaryLabel: "Написать",
            secondaryHref: `/dashboard/clients/${card.id}`,
          });
        }

        return items;
      })
      .sort((a, b) => {
        const priorityOrder = { "Высокий": 3, "Средний": 2, "Низкий": 1 };
        const byPriority = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (byPriority !== 0) return byPriority;
        return a.clientName.localeCompare(b.clientName);
      })
      .slice(0, 8);

    const query = search.trim().toLowerCase();
    const filteredClients = cards
      .filter((card) => {
        const matchesSearch =
          !query ||
          card.name.toLowerCase().includes(query);

        if (!matchesSearch) return false;

        switch (filter) {
          case "active":
            return card.statusLabel === "Активен";
          case "new":
            return card.isNew;
          case "silent":
            return card.statusLabel === "Ждет ответа";
          case "reports":
            return card.reportsToday;
          case "progress":
            return card.missingProgress || card.needsProgramUpdate;
          case "paused":
            return card.statusLabel === "На паузе";
          default:
            return true;
        }
      })
      .sort((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "recent") return (right.lastActiveAt ?? 0) - (left.lastActiveAt ?? 0);
        if (sort === "progress") {
          const progressRank = (card: ClientCard) => {
            if (card.needsProgramUpdate) return 0;
            if (card.missingProgress) return 1;
            if (card.weeklyDelta == null) return 2;
            return 3 + Math.abs(card.weeklyDelta);
          };
          return progressRank(left) - progressRank(right);
        }
        return (right.createdAt ?? 0) - (left.createdAt ?? 0);
      });

    const clientGrowth = clientRows
      .slice()
      .reverse()
      .reduce<Array<{ label: string; total: number }>>((acc, row) => {
        const label = row.created_at
          ? new Date(row.created_at).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "short",
            })
          : "—";
        const previous = acc[acc.length - 1]?.total ?? 0;
        acc.push({ label, total: previous + 1 });
        return acc;
      }, []);

    const revenueByDay = payments.reduce<Record<string, number>>((acc, row) => {
      const key = row.created_at.slice(0, 10);
      acc[key] = (acc[key] ?? 0) + Number(row.amount);
      return acc;
    }, {});

    const programPayments = payments.filter((row) =>
      (row.category ?? "").toLowerCase().includes("програм")
    );
    const newProgramPurchases = programPayments.filter(
      (row) => nowTs - new Date(row.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    ).length;
    const programRevenue = programPayments.reduce(
      (sum, row) => sum + Number(row.amount),
      0
    );
    const recentSales: RecentSale[] = programPayments.slice(0, 4).map((row, index) => ({
      id: `${row.created_at}-${row.amount}-${index}`,
      title:
        row.category?.trim() && row.category.trim().length > 0
          ? row.category.trim()
          : "Покупка программы",
      amount: Number(row.amount),
      dateLabel: formatRelative(row.created_at, nowTs),
      isNew: nowTs - new Date(row.created_at).getTime() < 3 * 24 * 60 * 60 * 1000,
    }));

    const revenueChart = Object.entries(revenueByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, amount]) => ({
        label: new Date(key).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "short",
        }),
        amount,
      }));

    const regularClients = cards.filter(
      (card) => card.lastActiveAt != null && nowTs - card.lastActiveAt < 7 * 24 * 60 * 60 * 1000
    ).length;
    const regularity = cards.length > 0 ? Math.round((regularClients / cards.length) * 100) : 0;

    return {
      cards,
      filteredClients,
      attention,
      summary: {
        activeClients: cards.filter(
          (card) => card.statusLabel !== "На паузе" && card.statusLabel !== "Нет данных"
        ).length,
        newClients: cards.filter((card) => card.isNew).length,
        silentClients: silentCount,
        reports: reportsCount,
        updateCount,
        pausedCount,
        monthRevenue,
        programSales,
        programsInStore: templates.length,
        regularity,
      },
      charts: {
        clientGrowth,
        revenueChart,
      },
      sales: {
        recentSales,
        newProgramPurchases,
        programRevenue,
      },
      hasPersonalClients: cards.length > 0,
      hasOnlySales: cards.length === 0 && (programSales > 0 || templates.length > 0),
    };
  }, [assignments, clientRows, filter, links, nowTs, payments, search, sort, templates, weightLogs, workoutLogs]);

  async function copyPublicLink() {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
      </div>
    );
  }

  const trainerName = trainerProfile?.display_name?.trim() || trainerProfile?.full_name?.trim() || "Тренер";
  const hasClients = dashboard.cards.length > 0;
  const hasAttention = dashboard.attention.length > 0;
  const isNewTrainer = !hasClients && !dashboard.hasOnlySales;
  const isSalesFocused = dashboard.hasOnlySales;
  const hasPausedClients = dashboard.summary.pausedCount > 0;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 lg:px-8">
        <section>
          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 rounded-2xl border border-zinc-800 bg-zinc-900">
                    {trainerProfile?.team_logo_url ? (
                      <AvatarImage src={trainerProfile.team_logo_url} alt={trainerName} />
                    ) : null}
                    <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                      {initials(trainerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Личный кабинет тренера
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
                      {trainerName}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-400">
                      Клиенты, программы и прогресс в одном месте.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
                    Активных клиентов: {formatMetric(dashboard.summary.activeClients)}
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
                    Требуют внимания: {formatMetric(dashboard.attention.length)}
                  </span>
                  {publicLink ? (
                    <button
                      type="button"
                      onClick={() => void copyPublicLink()}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-800 bg-black/20 px-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
                    >
                      <Copy className="h-4 w-4" />
                      {linkCopied ? "Ссылка скопирована" : "Публичный профиль"}
                    </button>
                  ) : null}
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border border-zinc-800 bg-black/20 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                  >
                    <Link href="/settings" aria-label="Настройки">
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setFilter("reports")}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-black/20 text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
                    aria-label="Уведомления"
                  >
                    <Bell className="h-4 w-4" />
                    {hasAttention ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 px-1 text-[10px] font-semibold text-black">
                        {dashboard.attention.length}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricEntry
            label="Активные клиенты"
            value={formatMetric(dashboard.summary.activeClients)}
            hint={hasClients ? "Клиенты, с которыми вы сейчас работаете" : "Активных клиентов пока нет"}
            icon={<Users className="h-4 w-4" />}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <MetricEntry
            label="Новые заявки"
            value={formatMetric(dashboard.summary.newClients)}
            hint={dashboard.summary.newClients > 0 ? "Нужно связаться и назначить старт" : "Новых заявок пока нет"}
            icon={<UserPlus className="h-4 w-4" />}
            active={filter === "new"}
            onClick={() => setFilter("new")}
          />
          <MetricEntry
            label="Ждут ответа"
            value={formatMetric(dashboard.summary.silentClients)}
            hint={dashboard.summary.silentClients > 0 ? "Есть клиенты без ответа" : "Все ответы под контролем"}
            icon={<TriangleAlert className="h-4 w-4" />}
            active={filter === "silent"}
            onClick={() => setFilter("silent")}
          />
          <MetricEntry
            label="Новые отчёты"
            value={formatMetric(dashboard.summary.reports)}
            hint={dashboard.summary.reports > 0 ? "Есть новые отчёты по тренировкам" : "Новых отчётов пока нет"}
            icon={<Bell className="h-4 w-4" />}
            active={filter === "reports"}
            onClick={() => setFilter("reports")}
          />
          <MetricEntry
            label="Обновить программу"
            value={formatMetric(dashboard.summary.updateCount)}
            hint={dashboard.summary.updateCount > 0 ? "Есть клиенты, которым нужен новый план" : "Программы не требуют обновления"}
            icon={<Sparkles className="h-4 w-4" />}
            active={filter === "progress"}
            onClick={() => setFilter("progress")}
          />
          <MetricEntry
            label="Доход за месяц"
            value={dashboard.summary.monthRevenue > 0 ? formatCurrency(dashboard.summary.monthRevenue) : "—"}
            hint={dashboard.summary.monthRevenue > 0 ? "Поступления за текущий месяц" : "Поступлений пока нет"}
            icon={<DollarSign className="h-4 w-4" />}
            onClick={() => setFilter("all")}
          />
        </section>

        {isNewTrainer ? (
          <section>
            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-zinc-50">Пока нет клиентов</CardTitle>
                <CardDescription className="text-zinc-400">
                  Подключите первого клиента или подготовьте программу, чтобы начать работу.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[1.2fr,0.9fr]">
                <EmptyBlock
                  title="Начало работы"
                  description="Добавьте первого клиента, создайте программу и заполните библиотеку упражнений. После этого кабинет станет основным рабочим инструментом."
                  actions={[
                    { href: "/dashboard", label: "Добавить клиента" },
                    { href: "/dashboard/programs", label: "Создать программу" },
                    { href: "/dashboard/library", label: "Открыть библиотеку" },
                  ]}
                />
                <div className="grid gap-3">
                  <StatusLine label="Шаг 1" value="Добавьте первого клиента" />
                  <StatusLine label="Шаг 2" value="Создайте первую программу" />
                  <StatusLine label="Шаг 3" value="Заполните библиотеку упражнений" />
                  <StatusLine label="Шаг 4" value="Подготовьте продажу программ, если хотите масштабироваться" />
                </div>
              </CardContent>
            </Card>
          </section>
        ) : isSalesFocused ? (
          <section>
            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-zinc-50">Продажи программ</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Сейчас основной поток идёт через готовые программы и покупки без персонального ведения.
                    </CardDescription>
                  </div>
                  <Button asChild className="rounded-full bg-zinc-100 text-black hover:bg-white">
                    <Link href="/dashboard/programs">Управлять программами</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[0.95fr,1.25fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AnalyticsTile label="Продажи программ" value={formatMetric(dashboard.summary.programSales)} />
                  <AnalyticsTile label="Доход" value={dashboard.sales.programRevenue > 0 ? formatCurrency(dashboard.sales.programRevenue) : "Пока нет"} />
                  <AnalyticsTile label="Новые покупки" value={formatMetric(dashboard.sales.newProgramPurchases)} />
                  <AnalyticsTile label="Программ в продаже" value={formatMetric(dashboard.summary.programsInStore)} />
                </div>
                <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Недавние продажи</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Последние покупки и новые оплаты.
                      </p>
                    </div>
                    <Sparkles className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {dashboard.sales.recentSales.length === 0 ? (
                      <div className="rounded-[1rem] border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                        Пока нет покупок. Опубликуйте программу или обновите карточку продукта.
                      </div>
                    ) : (
                      dashboard.sales.recentSales.map((sale) => (
                        <RecentSaleRow key={sale.id} sale={sale} />
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : (
          <section>
            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-zinc-50">Требует внимания</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Задачи, по которым нужен ваш ответ.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-zinc-400">
                      Всего задач: {dashboard.attention.length > 0 ? dashboard.attention.length : "0"}
                    </span>
                    <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-zinc-400">
                      Высокий приоритет: {dashboard.attention.filter((item) => item.priority === "Высокий").length}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hasAttention ? (
                  <EmptyBlock
                    title="Сегодня нет критических событий"
                    description="Все клиенты под контролем. Срочных отчётов, зависших ответов и задач на сейчас нет."
                    actions={[
                      { href: "/dashboard/programs", label: "Проверить программы" },
                      { href: "/dashboard/library", label: "Открыть библиотеку" },
                    ]}
                  />
                ) : (
                  dashboard.attention.map((item) => (
                    <AttentionCard key={item.id} item={item} />
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {!isNewTrainer && !isSalesFocused ? (
          <section id="roster" className="grid gap-5 xl:grid-cols-[1.6fr,0.95fr]">
          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div>
                  <CardTitle className="text-xl text-zinc-50">Мои клиенты</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Активные клиенты, их статус и быстрые действия
                  </CardDescription>
                </div>
              </div>

              {hasPausedClients ? (
                <div className="rounded-[1rem] border border-zinc-800 bg-black/20 px-3.5 py-2.5 text-sm text-zinc-400">
                  На паузе: {dashboard.summary.pausedCount}. Используйте фильтр, чтобы быстро открыть этот список.
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск по имени"
                    className="h-10 rounded-2xl border-zinc-800 bg-black/20 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="h-10 rounded-2xl border border-zinc-800 bg-black/20 px-3 text-sm text-zinc-100 outline-none"
                >
                  <option value="recent">По последней активности</option>
                  <option value="name">По имени</option>
                  <option value="progress">По прогрессу</option>
                  <option value="created">По дате добавления</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {([
                  ["all", "Все"],
                  ["active", "Активные"],
                  ["new", "Новые"],
                  ["silent", "Ждут ответа"],
                  ["progress", "Без прогресса"],
                  ["paused", "На паузе"],
                ] as Array<[DashboardFilter, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filter === key
                        ? "border-zinc-100 bg-zinc-100 text-black"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasClients ? (
                <EmptyBlock
                  title="Пока нет клиентов"
                  description="Добавьте первого клиента или опубликуйте программу"
                  actions={[
                    { href: "/dashboard", label: "Добавить клиента" },
                    { href: "/dashboard/programs", label: "Создать программу" },
                  ]}
                />
              ) : dashboard.filteredClients.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center text-sm text-zinc-500">
                  По текущим фильтрам ничего не найдено.
                </div>
              ) : (
                dashboard.filteredClients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-zinc-50">Быстрые действия</CardTitle>
                <CardDescription className="text-zinc-400">
                  Частые действия в работе с клиентами и программами.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                <QuickAction href="/dashboard" label="Добавить клиента" description="Подключить нового клиента" icon={<UserPlus className="h-4 w-4" />} />
                <QuickAction href="/dashboard/programs" label="Создать программу" description="Собрать план тренировок" icon={<ClipboardList className="h-4 w-4" />} />
                <QuickAction href="/dashboard/library" label="Открыть библиотеку упражнений" description="Добавить или обновить упражнения" icon={<Library className="h-4 w-4" />} />
                <QuickAction href="/dashboard/programs" label="Создать шаблон" description="Сохранить типовой план" icon={<Dumbbell className="h-4 w-4" />} />
                <QuickAction href="/dashboard/programs" label="Опубликовать программу" description="Открыть продажу программы" icon={<Sparkles className="h-4 w-4" />} />
              </CardContent>
            </Card>

            {dashboard.hasOnlySales ? (
              <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-zinc-50">Продажи без персонального ведения</CardTitle>
                  <CardDescription className="text-zinc-400">
                    У вас уже есть продукты и продажи, даже если персональных клиентов пока нет.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AnalyticsTile label="Продажи программ" value={formatMetric(dashboard.summary.programSales)} />
                  <AnalyticsTile label="Программ в продаже" value={formatMetric(dashboard.summary.programsInStore)} />
                  <Button asChild className="w-full rounded-full bg-zinc-100 text-black hover:bg-white">
                    <Link href="/dashboard/programs">Открыть раздел программ</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-zinc-50">Короткая сводка</CardTitle>
                <CardDescription className="text-zinc-400">
                  Главное на сегодня без переходов по разделам.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <StatusLine label="Активные клиенты" value={dashboard.summary.activeClients > 0 ? `${dashboard.summary.activeClients} в работе` : "Пока нет"} />
                <StatusLine label="Новые отчёты" value={dashboard.summary.reports > 0 ? `${dashboard.summary.reports} ждут реакции` : "Ничего срочного"} />
                <StatusLine label="Ждут ответа" value={dashboard.summary.silentClients > 0 ? `${dashboard.summary.silentClients} клиента` : "Все под контролем"} />
                <StatusLine label="Пора обновить программу" value={dashboard.summary.updateCount > 0 ? `${dashboard.summary.updateCount} клиента` : "Обновления не горят"} />
                <StatusLine label="Доход за месяц" value={dashboard.summary.monthRevenue > 0 ? formatCurrency(dashboard.summary.monthRevenue) : "Пока нет"} />
              </CardContent>
            </Card>
          </div>
          </section>
        ) : null}

        <section>
          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-zinc-50">Краткая аналитика</CardTitle>
              <CardDescription className="text-zinc-400">
                Основные показатели по клиентам и продажам.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-[0.85fr,1fr,1fr]">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <AnalyticsTile label="Продажи программ" value={formatMetric(dashboard.summary.programSales)} />
                  <AnalyticsTile label="Программ в продаже" value={formatMetric(dashboard.summary.programsInStore)} />
                  <AnalyticsTile label="Регулярно тренируются" value={hasClients ? `${dashboard.summary.regularity}%` : "—"} />
                  <AnalyticsTile label="Клиентов на паузе" value={formatMetric(dashboard.summary.pausedCount)} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Рост числа клиентов</p>
                    <ChartColumn className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="h-36">
                    {dashboard.charts.clientGrowth.length === 0 ? (
                      <AnalyticsPlaceholder text="График появится после первых подключённых клиентов." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboard.charts.clientGrowth}>
                          <defs>
                            <linearGradient id="trainerClientsFillNew" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f4f4f5" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#f4f4f5" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                          <YAxis hide />
                          <Tooltip cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                          <Area type="monotone" dataKey="total" stroke="#f4f4f5" strokeWidth={2} fill="url(#trainerClientsFillNew)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-200">Доход по неделям</p>
                    <DollarSign className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="h-36">
                    {dashboard.charts.revenueChart.length === 0 ? (
                      <AnalyticsPlaceholder text="Данные появятся после первых продаж или оплат." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.charts.revenueChart}>
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="amount" fill="rgba(244,244,245,0.88)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function MetricEntry({
  label,
  value,
  hint,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.35rem] border px-4 py-3.5 text-left transition ${
        active
          ? "border-zinc-100 bg-zinc-100/95 text-black"
          : "border-zinc-800/80 bg-zinc-950/90 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900/90"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium ${active ? "text-zinc-700" : "text-zinc-500"}`}>{label}</p>
        <div className={active ? "text-zinc-700" : "text-zinc-500"}>{icon}</div>
      </div>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-1 text-[13px] leading-snug ${active ? "text-zinc-700" : "text-zinc-400"}`}>{hint}</p>
    </button>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <div className="rounded-[1.35rem] border border-zinc-800/90 bg-black/30 p-3.5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-50">{item.clientName}</p>
            <Badge className={attentionTone(item.tone)}>{item.label}</Badge>
            <Badge className={priorityTone(item.priority)}>{item.priority}</Badge>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{item.description}</p>
          <p className="mt-1.5 text-xs text-zinc-500">{item.eventTime}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
          >
            <Link href={item.actionHref}>
              {item.actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="h-10 rounded-full bg-zinc-100 text-black hover:bg-white">
            <Link href={item.secondaryHref}>{item.secondaryLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClientRow({ client }: { client: ClientCard }) {
  const progressLabel = formatChange(client.weeklyDelta);

  const activityHint = client.reportsToday
    ? "Прислал отчет сегодня"
    : client.needsMeasurements
      ? "Нужны свежие замеры"
      : client.lowActivity
        ? "Снизил активность"
        : client.recentWorkouts > 0
          ? `${client.recentWorkouts} тренировки за 7 дней`
          : "Нет новых тренировок";

  return (
    <article className="rounded-[1.35rem] border border-zinc-800/90 bg-black/30 p-3.5 transition hover:border-zinc-700 hover:bg-zinc-950/60">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="h-12 w-12 rounded-2xl bg-zinc-900">
              <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                {client.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="text-base font-semibold text-zinc-50 transition hover:text-white"
                >
                  {client.name}
                </Link>
                <Badge className={statusTone(client.statusTone)}>{client.statusLabel}</Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{client.goal}</p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                  Последняя активность: {client.lastActiveLabel}
                </span>
                <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1">
                  {activityHint}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-full border-zinc-700 bg-zinc-950/40 px-4 text-zinc-100 hover:bg-zinc-900"
            >
              <Link href={`/dashboard/clients/${client.id}`}>Открыть</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-9 rounded-full px-4 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
            >
              <Link href={`/dashboard/clients/${client.id}`}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Написать
              </Link>
            </Button>
            <Button
              asChild
              className="h-9 rounded-full bg-zinc-100 px-4 text-black hover:bg-white"
            >
              <Link
                href={
                  client.activeProgramId
                    ? `/dashboard/programs/${client.activeProgramId}`
                    : "/dashboard/programs"
                }
              >
                Обновить программу
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-full border-zinc-700 bg-zinc-950/40 px-4 text-zinc-100 hover:bg-zinc-900"
            >
              <Link href={`/dashboard/clients/${client.id}`}>Запросить замеры</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ClientMetaCell
            label="Текущий вес"
            value={
              client.currentWeight != null
                ? `${client.currentWeight.toFixed(1)} кг`
                : "Нет данных"
            }
          />
          <ClientMetaCell label="Статус" value={client.statusLabel} />
          <ClientMetaCell label="Последняя активность" value={client.lastActiveLabel} />
          <ClientMetaCell label="Прогресс" value={progressLabel} />
          <ClientMetaCell
            label="Текущая программа"
            value={client.activeProgramTitle ?? "Не назначена"}
          />
        </div>
      </div>
    </article>
  );
}

function ClientMetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-zinc-800 bg-zinc-950/55 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-100">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-3.5 py-3 transition hover:border-zinc-700 hover:bg-zinc-900/60"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
          {icon}
        </span>
        <span>
          <span className="block text-sm font-medium text-zinc-50">{label}</span>
          <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-zinc-600" />
    </Link>
  );
}

function RecentSaleRow({ sale }: { sale: RecentSale }) {
  return (
    <div className="flex items-center justify-between rounded-[1rem] border border-zinc-800 bg-zinc-950/55 px-3.5 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-zinc-100">{sale.title}</p>
          {sale.isNew ? (
            <Badge className="rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200">
              Новая покупка
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-zinc-500">{sale.dateLabel}</p>
      </div>
      <p className="text-sm font-semibold text-zinc-50">{formatCurrency(sale.amount)}</p>
    </div>
  );
}

function AnalyticsTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-zinc-800 bg-black/20 px-3.5 py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function AnalyticsPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-[1.4rem] border border-dashed border-zinc-800 bg-black/20 px-4 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[1.15rem] border border-zinc-800 bg-black/20 px-3.5 py-2.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-100">{value}</span>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-zinc-800 bg-black/20 px-5 py-8 text-center">
      <p className="text-base font-semibold text-zinc-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.href + action.label}
            asChild
            variant="outline"
            className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function statusTone(tone: ClientCard["statusTone"]) {
  if (tone === "emerald") {
    return "rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "sky") {
    return "rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200";
  }
  if (tone === "amber") {
    return "rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200";
  }
  if (tone === "rose") {
    return "rounded-full border border-rose-400/20 bg-rose-500/10 text-rose-200";
  }
  return "rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300";
}

function attentionTone(tone: AttentionItem["tone"]) {
  if (tone === "sky") {
    return "rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200";
  }
  if (tone === "amber") {
    return "rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200";
  }
  return "rounded-full border border-rose-400/20 bg-rose-500/10 text-rose-200";
}

function priorityTone(priority: AttentionItem["priority"]) {
  if (priority === "Высокий") {
    return "rounded-full border border-zinc-600 bg-zinc-800/90 text-zinc-50";
  }
  if (priority === "Средний") {
    return "rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300";
  }
  return "rounded-full border border-zinc-800 bg-black/20 text-zinc-400";
}
