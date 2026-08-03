"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Copy,
  Dumbbell,
  ExternalLink,
  Filter,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Search,
  Send,
  SlidersHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { CanonicalTrainerRoster } from "@/components/trainer/canonical-trainer-roster";
import { QuickAssignDrawer } from "@/components/trainer-os/quick-assign/quick-assign-drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase-client";
import { cn, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type ClientStatus = "Активна" | "Требует внимания" | "Нет программы" | "На паузе";
type ClientFilter = "all" | "active" | "attention" | "needs-review" | "paused" | "no-program" | "overdue-check-in";
type ClientSort = "recent" | "attention" | "adherence";
type AttentionTone = "danger" | "warning" | "neutral";

type TrainerClient = {
  id: string;
  name: string;
  goal: string;
  currentWeight: string;
  weightDelta: string;
  lastActivity: string;
  lastActivityType: "Тренировка" | "Чек-ин" | "Замеры";
  rhythm: number[];
  adherence: number;
  status: ClientStatus;
  attentionReason?: string;
  checkInOverdue?: boolean;
  reviewCount?: number;
  reviewHref?: string;
};

type AttentionItem = {
  id: string;
  clientId: string;
  clientName: string;
  reason: string;
  detail: string;
  tone: AttentionTone;
  icon: typeof AlertTriangle;
  href?: string;
};

type ClientProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  updated_at?: string | null;
  weight?: number | null;
  target_weight?: number | null;
};

type WorkoutLogRow = {
  client_id: string;
  created_at: string;
};

type TrainerWorkoutReviewRow = {
  client_id: string;
  workout_date: string;
  status: "needs_review" | "reviewed" | null;
};

type AssignedProgramRow = {
  client_id: string;
  status: string | null;
};

const demoClients: TrainerClient[] = [
  {
    id: "maria-volkova",
    name: "Мария Волкова",
    goal: "Снижение веса",
    currentWeight: "68.4 кг",
    weightDelta: "-1.2 кг",
    lastActivity: "Вчера",
    lastActivityType: "Тренировка",
    rhythm: [42, 58, 64, 72, 68, 82, 76],
    adherence: 84,
    status: "Активна",
    reviewCount: 1,
    reviewHref: "/trainer/review/maria-volkova-2026-06-09",
  },
  {
    id: "artem-smirnov",
    name: "Артём Смирнов",
    goal: "Набор массы",
    currentWeight: "82.1 кг",
    weightDelta: "+0.4 кг",
    lastActivity: "4 дня назад",
    lastActivityType: "Тренировка",
    rhythm: [78, 70, 42, 28, 18, 12, 8],
    adherence: 52,
    status: "Требует внимания",
    attentionReason: "Пропустил 2 тренировки подряд",
    reviewCount: 1,
    reviewHref: "/trainer/review/artem-smirnov-2026-06-10",
  },
  {
    id: "irina-kozlova",
    name: "Ирина Козлова",
    goal: "Сила и тонус",
    currentWeight: "59.8 кг",
    weightDelta: "-0.3 кг",
    lastActivity: "Сегодня",
    lastActivityType: "Тренировка",
    rhythm: [54, 62, 68, 72, 80, 86, 88],
    adherence: 91,
    status: "Требует внимания",
    attentionReason: "Ждёт комментарий по тренировке",
    reviewCount: 1,
    reviewHref: "/trainer/review/irina-kozlova-2026-06-12",
  },
  {
    id: "dmitry-lebedev",
    name: "Дмитрий Лебедев",
    goal: "Поддержание формы",
    currentWeight: "76.0 кг",
    weightDelta: "0 кг",
    lastActivity: "2 дня назад",
    lastActivityType: "Чек-ин",
    rhythm: [44, 48, 52, 56, 54, 60, 58],
    adherence: 74,
    status: "Активна",
  },
  {
    id: "egor-nikitin",
    name: "Егор Никитин",
    goal: "Рекомпозиция",
    currentWeight: "89.3 кг",
    weightDelta: "-0.6 кг",
    lastActivity: "Сегодня",
    lastActivityType: "Чек-ин",
    rhythm: [18, 24, 28, 30, 36, 42, 45],
    adherence: 0,
    status: "Нет программы",
    attentionReason: "Новый клиент без плана",
  },
  {
    id: "ekaterina-morozova",
    name: "Екатерина Морозова",
    goal: "Гипертрофия",
    currentWeight: "64.7 кг",
    weightDelta: "+0.2 кг",
    lastActivity: "10 дней назад",
    lastActivityType: "Замеры",
    rhythm: [62, 58, 52, 46, 40, 32, 24],
    adherence: 63,
    status: "Требует внимания",
    attentionReason: "Не отправила свежие замеры",
    checkInOverdue: true,
  },
  {
    id: "anna-tarasova",
    name: "Анна Тарасова",
    goal: "Возврат после паузы",
    currentWeight: "71.2 кг",
    weightDelta: "-0.1 кг",
    lastActivity: "6 дней назад",
    lastActivityType: "Чек-ин",
    rhythm: [20, 24, 20, 18, 16, 14, 12],
    adherence: 28,
    status: "На паузе",
  },
];

const attentionItems: AttentionItem[] = [
  {
    id: "artem-missed",
    clientId: "artem-smirnov",
    clientName: "Артём Смирнов",
    reason: "Пропустил тренировку",
    detail: "2 тренировки подряд",
    tone: "danger",
    icon: AlertTriangle,
  },
  {
    id: "ekaterina-measurements",
    clientId: "ekaterina-morozova",
    clientName: "Екатерина Морозова",
    reason: "Не отправила замеры",
    detail: "10 дней назад",
    tone: "warning",
    icon: Ruler,
  },
  {
    id: "irina-comment",
    clientId: "irina-kozlova",
    clientName: "Ирина Козлова",
    reason: "Ждёт комментарий",
    detail: "Завершила тренировку",
    tone: "neutral",
    icon: ClipboardList,
    href: "/trainer/review/irina-kozlova-2026-06-12",
  },
  {
    id: "egor-new",
    clientId: "egor-nikitin",
    clientName: "Егор Никитин",
    reason: "Новый клиент",
    detail: "Нет программы",
    tone: "warning",
    icon: UserPlus,
  },
];

const filters: Array<{ id: ClientFilter; label: string }> = [
  { id: "all", label: "Все клиенты" },
  { id: "active", label: "Активные" },
  { id: "attention", label: "Требуют внимания" },
  { id: "needs-review", label: "Ждут разбора" },
  { id: "paused", label: "На паузе" },
  { id: "no-program", label: "Без программы" },
  { id: "overdue-check-in", label: "Просрочен чек-ин" },
];

const sortOptions: Array<{ id: ClientSort; label: string; helper: string }> = [
  { id: "recent", label: "Недавняя активность", helper: "Сначала те, кто был активен недавно" },
  { id: "attention", label: "Требуют внимания", helper: "Сначала разборы, пропуски и клиенты без плана" },
  { id: "adherence", label: "Соблюдение плана", helper: "Сначала самые дисциплинированные" },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusClasses(status: ClientStatus) {
  switch (status) {
    case "Активна":
      return "border-lime-300/14 bg-lime-300/10 text-lime-100";
    case "Требует внимания":
      return "border-orange-300/20 bg-orange-300/10 text-orange-100";
    case "Нет программы":
      return "border-zinc-700 bg-zinc-900/70 text-zinc-300";
    case "На паузе":
      return "border-zinc-800 bg-black/20 text-zinc-500";
  }
}

function getStatusDotClasses(status: ClientStatus) {
  switch (status) {
    case "Активна":
      return "bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.35)]";
    case "Требует внимания":
      return "bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,0.32)]";
    case "Нет программы":
      return "bg-zinc-300";
    case "На паузе":
      return "bg-zinc-700";
  }
}

function getAttentionClasses(tone: AttentionTone) {
  switch (tone) {
    case "danger":
      return {
        icon: "border-red-300/18 bg-red-300/10 text-red-100",
        border: "hover:border-red-300/18",
      };
    case "warning":
      return {
        icon: "border-orange-300/18 bg-orange-300/10 text-orange-100",
        border: "hover:border-orange-300/18",
      };
    case "neutral":
      return {
        icon: "border-zinc-700 bg-zinc-900/70 text-zinc-200",
        border: "hover:border-lime-300/16",
      };
  }
}

function formatWeight(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
}

function formatDelta(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "нет данных";
  if (Math.abs(value) < 0.05) return "0 кг";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
}

function relativeDate(value: string | null | undefined, now = Date.now()) {
  if (!value) return "Нет данных";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Нет данных";

  const days = Math.max(0, Math.floor((now - timestamp) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  if (days < 5) return `${days} дня назад`;
  return `${days} дней назад`;
}

function createLocalClientId(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "client"}-${Date.now().toString(36)}`;
}

function clientAttentionScore(client: TrainerClient) {
  return (client.reviewCount ?? 0) * 10 + (client.attentionReason ? 5 : 0) + (client.checkInOverdue ? 3 : 0);
}

function sortClients(clients: TrainerClient[], sort: ClientSort) {
  const next = [...clients];

  if (sort === "attention") {
    return next.sort((a, b) => clientAttentionScore(b) - clientAttentionScore(a));
  }

  if (sort === "adherence") {
    return next.sort((a, b) => b.adherence - a.adherence);
  }

  return next;
}

async function loadWorkoutLogsForClients(clientIds: string[]) {
  if (clientIds.length === 0) {
    return { data: [] as WorkoutLogRow[], error: null };
  }

  const fullRes = await supabase
    .from("workout_logs")
    .select("client_id, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  return {
    data: (fullRes.data ?? []) as WorkoutLogRow[],
    error: fullRes.error,
  };
}

async function loadSavedWorkoutReviews(trainerId: string, clientIds: string[]) {
  if (clientIds.length === 0) {
    return { data: [] as TrainerWorkoutReviewRow[], error: null };
  }

  const res = await supabase
    .from("trainer_workout_reviews")
    .select("client_id, workout_date, status")
    .eq("trainer_id", trainerId)
    .in("client_id", clientIds)
    .order("workout_date", { ascending: false })
    .limit(300);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [] as TrainerWorkoutReviewRow[], error: null };
  }

  return {
    data: (res.data ?? []) as TrainerWorkoutReviewRow[],
    error: res.error,
  };
}

async function loadAssignedPrograms(clientIds: string[]) {
  if (clientIds.length === 0) {
    return { data: [] as AssignedProgramRow[], error: null };
  }

  const res = await supabase
    .from("assigned_programs")
    .select("client_id, status")
    .in("client_id", clientIds);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [] as AssignedProgramRow[], error: null };
  }

  return {
    data: (res.data ?? []) as AssignedProgramRow[],
    error: res.error,
  };
}

function countPendingReviews(workoutLogs: WorkoutLogRow[], savedReviews: TrainerWorkoutReviewRow[]) {
  const reviewedKeys = new Set(
    savedReviews
      .filter((review) => review.status === "reviewed")
      .map((review) => `${review.client_id}:${review.workout_date}`)
  );
  const pending = new Map<string, { count: number; latestAt: string }>();

  workoutLogs.forEach((log) => {
    if (!log.client_id || !log.created_at) return;
    const dateKey = log.created_at.slice(0, 10);
    const key = `${log.client_id}:${dateKey}`;
    if (reviewedKeys.has(key)) return;

    const existing = pending.get(log.client_id) ?? { count: 0, latestAt: log.created_at };
    existing.count += pending.has(log.client_id) && existing.latestAt.slice(0, 10) === dateKey ? 0 : 1;
    if (log.created_at > existing.latestAt) {
      existing.latestAt = log.created_at;
    }
    pending.set(log.client_id, existing);
  });

  return pending;
}

function buildRhythm(clientId: string, workoutLogs: WorkoutLogRow[]) {
  const now = new Date();
  return Array.from({ length: 7 }).map((_, offset) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (6 - offset));
    const key = day.toISOString().slice(0, 10);
    const dayLogs = workoutLogs.filter((log) => log.client_id === clientId && log.created_at.slice(0, 10) === key);
    return Math.min(100, dayLogs.length * 28);
  });
}

function buildRealClients(
  profiles: ClientProfileRow[],
  workoutLogs: WorkoutLogRow[],
  savedReviews: TrainerWorkoutReviewRow[],
  programs: AssignedProgramRow[]
) {
  const now = Date.now();
  const pendingReviews = countPendingReviews(workoutLogs, savedReviews);
  const programClientIds = new Set(programs.map((program) => program.client_id));

  return profiles.map((profile) => {
    const clientLogs = workoutLogs.filter((log) => log.client_id === profile.id);
    const latestLog = clientLogs[0]?.created_at ?? profile.updated_at ?? profile.created_at;
    const pendingReview = pendingReviews.get(profile.id);
    const hasProgram = programClientIds.has(profile.id);
    const inactiveDays = latestLog ? Math.floor((now - new Date(latestLog).getTime()) / (24 * 60 * 60 * 1000)) : 999;
    const status: ClientStatus = pendingReview
      ? "Требует внимания"
      : !hasProgram
        ? "Нет программы"
        : inactiveDays > 14
          ? "На паузе"
          : "Активна";
    const attentionReason = pendingReview
      ? `${pendingReview.count} тренировк${pendingReview.count === 1 ? "а" : "и"} ждёт разбора`
      : !hasProgram
        ? "Нужно назначить программу"
        : inactiveDays > 10
          ? "Давно не было активности"
          : undefined;
    const recentTrainingDays = new Set(
      clientLogs
        .filter((log) => now - new Date(log.created_at).getTime() < 14 * 24 * 60 * 60 * 1000)
        .map((log) => log.created_at.slice(0, 10))
    ).size;

    return {
      id: profile.id,
      name: profile.full_name?.trim() || profile.email || "Клиент",
      goal: profile.target_weight ? `Цель ${formatWeight(profile.target_weight)}` : "Индивидуальная цель",
      currentWeight: formatWeight(profile.weight),
      weightDelta: formatDelta(null),
      lastActivity: relativeDate(latestLog, now),
      lastActivityType: clientLogs.length > 0 ? "Тренировка" : "Чек-ин",
      rhythm: buildRhythm(profile.id, workoutLogs),
      adherence: Math.min(100, Math.max(0, recentTrainingDays * 18)),
      status,
      attentionReason,
      checkInOverdue: inactiveDays > 10,
      reviewCount: pendingReview?.count ?? 0,
      reviewHref: pendingReview ? `/trainer/clients/${profile.id}#reviews` : undefined,
    } satisfies TrainerClient;
  });
}

function buildAttentionItems(clients: TrainerClient[]): AttentionItem[] {
  return clients
    .filter((client) => client.attentionReason)
    .slice(0, 6)
    .map((client) => ({
      id: `${client.id}-attention`,
      clientId: client.id,
      clientName: client.name,
      reason: client.attentionReason ?? "Требует внимания",
      detail: client.lastActivity,
      tone: client.reviewCount ? "neutral" : client.status === "Нет программы" ? "warning" : "danger",
      icon: client.reviewCount ? ClipboardList : client.status === "Нет программы" ? UserPlus : AlertTriangle,
      href: client.reviewHref ?? `/trainer/clients/${client.id}`,
    }));
}

function ClientActions({
  className,
  scope,
  onInvite,
  onAddClient,
}: {
  className?: string;
  scope: "header" | "mobile";
  onInvite: () => void;
  onAddClient: () => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        data-client-action="invite"
        data-client-action-scope={scope}
        className="h-11 shrink-0 whitespace-nowrap rounded-full border-zinc-800 bg-zinc-950/55 px-4 text-zinc-200 hover:bg-zinc-900"
        onClick={onInvite}
      >
        <Link2 className="mr-2 h-4 w-4" />
        Пригласить по ссылке
      </Button>
      <Button
        type="button"
        data-client-action="add"
        data-client-action-scope={scope}
        className="h-11 shrink-0 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,rgba(199,234,111,0.96),rgba(150,206,64,0.88))] px-5 text-black hover:bg-lime-200"
        onClick={onAddClient}
      >
        <Plus className="mr-2 h-4 w-4" />
        Добавить клиента
      </Button>
    </div>
  );
}

export default function TrainerClientsPage() {
  if (
    !isDemoModeEnabled()
    && (
      process.env.NODE_ENV === "production"
      || process.env.NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER !== "true"
    )
  ) {
    return <CanonicalTrainerRoster />;
  }
  return <LegacyTrainerClientsPage />;
}

function LegacyTrainerClientsPage() {
  const router = useRouter();
  const demoMode = isDemoModeEnabled();
  const [activeFilter, setActiveFilter] = useState<ClientFilter>("all");
  const [search, setSearch] = useState("");
  const [realClients, setRealClients] = useState<TrainerClient[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [sortMode, setSortMode] = useState<ClientSort>("recent");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [messageClient, setMessageClient] = useState<TrainerClient | null>(null);
  const [actionsClient, setActionsClient] = useState<TrainerClient | null>(null);
  const [quickAssignClient, setQuickAssignClient] = useState<TrainerClient | null>(null);
  const [localClients, setLocalClients] = useState<TrainerClient[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newClientGoal, setNewClientGoal] = useState("");
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    if (demoMode) return;

    let cancelled = false;

    async function loadRealClients() {
      setLoading(true);

      const accessResponse = await fetch("/api/access/context", { cache: "no-store" });
      if (cancelled) return;
      const legacyRosterEnabled = process.env.NODE_ENV !== "production"
        && process.env.NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER === "true";
      if (accessResponse.status === 401) {
        router.replace("/login?next=/trainer/clients");
        return;
      }
      if (accessResponse.ok && !legacyRosterEnabled) {
        // B4 authenticates this route; canonical athlete reads move in the next vertical slice.
        setRealClients([]);
        setLoading(false);
        return;
      }
      if (!accessResponse.ok) {
        setRealClients([]);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?role=trainer");
        return;
      }

      const profilesRes = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at, updated_at, weight, target_weight")
        .eq("trainer_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (profilesRes.error) {
        logSupabaseError("trainer clients profiles", profilesRes.error);
        setRealClients([]);
        setLoading(false);
        return;
      }

      const profiles = (profilesRes.data ?? []) as ClientProfileRow[];
      const clientIds = profiles.map((profile) => profile.id);
      const [workoutsRes, reviewsRes, programsRes] = await Promise.all([
        loadWorkoutLogsForClients(clientIds),
        loadSavedWorkoutReviews(user.id, clientIds),
        loadAssignedPrograms(clientIds),
      ]);

      if (cancelled) return;

      if (workoutsRes.error) logSupabaseError("trainer clients workout logs", workoutsRes.error);
      if (reviewsRes.error) logSupabaseError("trainer clients workout reviews", reviewsRes.error);
      if (programsRes.error) logSupabaseError("trainer clients programs", programsRes.error);

      setRealClients(buildRealClients(profiles, workoutsRes.data, reviewsRes.data, programsRes.data));
      setLoading(false);
    }

    void loadRealClients();

    return () => {
      cancelled = true;
    };
  }, [demoMode, router]);

  const clients = useMemo(
    () => [...(demoMode ? demoClients : realClients), ...localClients],
    [demoMode, localClients, realClients]
  );
  const visibleAttentionItems = demoMode ? attentionItems : buildAttentionItems(realClients);
  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = clients.filter((client) => {
      const matchesSearch = !query || [client.name, client.goal, client.status].join(" ").toLowerCase().includes(query);
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "active" && client.status === "Активна") ||
        (activeFilter === "attention" && Boolean(client.attentionReason)) ||
        (activeFilter === "needs-review" && Boolean(client.reviewCount)) ||
        (activeFilter === "paused" && client.status === "На паузе") ||
        (activeFilter === "no-program" && client.status === "Нет программы") ||
        (activeFilter === "overdue-check-in" && client.checkInOverdue);

      return matchesSearch && matchesFilter;
    });

    return sortClients(filtered, sortMode);
  }, [activeFilter, clients, search, sortMode]);

  const attentionCount = visibleAttentionItems.length;
  const reviewCount = clients.reduce((sum, client) => sum + (client.reviewCount ?? 0), 0);
  const activeSort = sortOptions.find((option) => option.id === sortMode) ?? sortOptions[0];

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Ссылка приглашения скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  }

  async function openInvitation() {
    setInviteOpen(true);
    if (demoMode) {
      setInviteLink(`${window.location.origin}/onboarding?invite=demo-invitation`);
      return;
    }

    setInviteLoading(true);
    setInviteLink(null);
    try {
      const response = await fetch("/api/access/invitations", { method: "POST" });
      const payload = await response.json().catch(() => ({})) as {
        invitationUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.invitationUrl) {
        toast.error(payload.error === "trainer_not_active"
          ? "Доступ тренера ещё не активирован"
          : "Не удалось создать приглашение");
        return;
      }
      setInviteLink(payload.invitationUrl);
    } catch {
      toast.error("Не удалось создать приглашение");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleAddClient() {
    const name = newClientName.trim();
    const goal = newClientGoal.trim();

    if (!name) {
      toast.error("Введите имя клиента");
      return;
    }

    const client: TrainerClient = {
      id: createLocalClientId(name),
      name,
      goal: goal || "Новая цель",
      currentWeight: "—",
      weightDelta: "нет данных",
      lastActivity: "Сейчас",
      lastActivityType: "Чек-ин",
      rhythm: [0, 0, 0, 0, 0, 0, 0],
      adherence: 0,
      status: "Нет программы",
      attentionReason: "Нужно назначить программу",
    };

    setLocalClients((prev) => [client, ...prev]);
    setNewClientName("");
    setNewClientGoal("");
    setAddClientOpen(false);
    setActiveFilter("all");
    toast.success("Клиент добавлен как локальная заготовка");
  }

  function openMessage(client: TrainerClient) {
    setMessageClient(client);
    setMessageText(
      client.attentionReason
        ? `${client.name}, привет! Вижу: ${client.attentionReason.toLowerCase()}. Давай коротко сверим план на сегодня.`
        : `${client.name}, привет! Как самочувствие после последней тренировки?`
    );
  }

  function sendMessageDraft() {
    if (!messageClient) return;
    toast.success(`Черновик сообщения для ${messageClient.name} готов`);
    setMessageClient(null);
    setMessageText("");
  }

  return (
    <TrainerShell
      title="Клиенты"
      description="Управляйте клиентами, отслеживайте прогресс и быстро разбирайте coaching-события."
      headerAction={
        <ClientActions
          className="hidden flex-nowrap xl:flex"
          scope="header"
          onInvite={() => void openInvitation()}
          onAddClient={() => setAddClientOpen(true)}
        />
      }
    >
      <div className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden">
        <section className="xl:hidden">
          <ClientActions
            scope="mobile"
            onInvite={() => void openInvitation()}
            onAddClient={() => setAddClientOpen(true)}
          />
        </section>

        <section className="rounded-[1.35rem] border border-zinc-800/85 bg-zinc-950/72 p-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-zinc-400">
                {loading
                  ? "Загружаем клиентов, тренировки и очередь разборов."
                  : `${filteredClients.length} из ${clients.length} клиентов · ${attentionCount} требуют внимания · ${reviewCount} разборов`}
              </p>
            </div>

            <div className="relative w-full lg:max-w-[360px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по имени, цели или статусу"
                className="h-12 w-full rounded-full border border-zinc-800 bg-zinc-950/70 pl-11 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/24"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[1.45rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.022),rgba(0,0,0,0.18))] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Требуют внимания</p>
              <span className="rounded-full border border-orange-300/18 bg-orange-300/10 px-2.5 py-1 text-xs font-medium text-orange-100">
                {attentionCount}
              </span>
            </div>
            <p className="text-xs text-zinc-500">Компактная очередь: открыть клиента и закрыть действие.</p>
          </div>

          {visibleAttentionItems.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {visibleAttentionItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const classes = getAttentionClasses(item.tone);
                  return (
                    <article
                      key={item.id}
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-[1.05rem] border border-zinc-800/85 bg-black/20 p-3 transition",
                        classes.border
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-zinc-900 text-xs text-zinc-100">
                          {initials(item.clientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{item.clientName}</p>
                        <p className="truncate text-xs text-zinc-300">{item.reason}</p>
                        <p className="truncate text-xs text-zinc-500">{item.detail}</p>
                      </div>
                      <div className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:flex", classes.icon)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        className="h-8 shrink-0 rounded-full border-zinc-800 bg-zinc-950/45 px-3 text-xs text-zinc-200 hover:bg-zinc-900"
                      >
                        <Link href={item.href ?? `/trainer/clients/${item.clientId}`}>Открыть</Link>
                      </Button>
                    </article>
                  );
                })}
            </div>
            ) : (
              <div className="mt-3 rounded-[1rem] border border-lime-300/12 bg-lime-300/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-lime-300" />
                  <div>
                    <p className="font-medium text-zinc-100">Все клиенты в порядке</p>
                    <p className="mt-1 text-sm text-zinc-500">На сегодня нет срочных действий.</p>
                  </div>
                </div>
              </div>
            )}
        </section>

        <section className="rounded-[1.25rem] border border-zinc-800/85 bg-zinc-950/72 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сегодня</p>
            <div className="grid flex-1 gap-2 md:grid-cols-3 xl:max-w-3xl">
              {[
                { icon: AlertTriangle, value: `${attentionCount} клиента требуют внимания` },
                { icon: ClipboardList, value: `${reviewCount} тренировки ждут разбора` },
                { icon: CalendarDays, value: "2 чек-ина запланировано" },
              ].map(({ icon: Icon, value }) => (
                <div key={value} className="flex items-center gap-2 rounded-full border border-white/7 bg-black/18 px-3 py-2">
                  <Icon className="h-4 w-4 text-zinc-500" />
                  <p className="text-xs text-zinc-300">{value}</p>
                </div>
              ))}
            </div>
            <Button
              asChild
              variant="outline"
              className="h-9 shrink-0 rounded-full border-zinc-800 bg-zinc-950/50 px-4 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              <Link href="/trainer/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                Открыть календарь
              </Link>
            </Button>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
            <div className="rounded-[1.35rem] border border-zinc-800/85 bg-zinc-950/72 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setActiveFilter(filter.id)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                          activeFilter === filter.id
                            ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                            : "border-zinc-800 bg-black/16 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-zinc-800 bg-black/18 text-xs text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setFiltersOpen(true)}
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      Фильтры
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-zinc-800 bg-black/18 text-xs text-zinc-300 hover:bg-zinc-900"
                      onClick={() => setFiltersOpen(true)}
                    >
                      {activeSort.label}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

            {loading ? (
              <div className="grid gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`client-skeleton-${index}`}
                    className="h-[78px] animate-pulse rounded-[1.1rem] border border-zinc-800 bg-zinc-950/60"
                  />
                ))}
              </div>
            ) : filteredClients.length > 0 ? (
              <div data-client-roster className="overflow-hidden rounded-[1.45rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.98))]">
                  <div className="hidden grid-cols-[minmax(240px,1.35fr)_minmax(120px,0.7fr)_minmax(170px,0.8fr)_140px_150px] gap-4 border-b border-white/7 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-zinc-500 xl:grid">
                    <span>Клиент</span>
                    <span>Активность</span>
                    <span>Прогресс</span>
                    <span>Статус</span>
                    <span className="text-right">Действия</span>
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    {filteredClients.map((client) => (
                      <article
                        key={client.id}
                        data-client-row
                        className="grid gap-3 px-4 py-3 transition hover:bg-white/[0.025] xl:grid-cols-[minmax(240px,1.35fr)_minmax(120px,0.7fr)_minmax(170px,0.8fr)_140px_150px] xl:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-zinc-900 text-sm text-zinc-100">
                              {initials(client.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full", getStatusDotClasses(client.status))} />
                              <h3 className="truncate text-base font-medium text-zinc-50">{client.name}</h3>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-zinc-500">{client.goal}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-zinc-100">{client.lastActivity}</p>
                          <p className="mt-1 text-xs text-zinc-500">{client.lastActivityType}</p>
                        </div>

                        <div className="flex items-center justify-between gap-3 xl:justify-start">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{client.currentWeight}</p>
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                client.weightDelta.startsWith("-")
                                  ? "text-lime-200"
                                  : client.weightDelta.startsWith("+")
                                    ? "text-zinc-300"
                                    : "text-zinc-500"
                              )}
                            >
                              {client.weightDelta}
                            </p>
                          </div>
                          <div className="min-w-[86px]">
                            <div className="h-1.5 rounded-full bg-zinc-800">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full",
                                  client.adherence >= 80
                                    ? "bg-lime-300"
                                    : client.adherence >= 55
                                      ? "bg-amber-300"
                                      : "bg-orange-300"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, client.adherence))}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">{client.adherence}% rhythm</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", getStatusClasses(client.status))}>
                            {client.status}
                          </span>
                          {client.reviewCount ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-100">
                              <ClipboardList className="h-3.5 w-3.5" />
                              Разбор
                            </span>
                          ) : null}
                          {client.attentionReason ? (
                            <span className="text-xs text-zinc-500 xl:hidden">{client.attentionReason}</span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-start gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => openMessage(client)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
                            aria-label={`Написать ${client.name}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <Button
                            asChild
                            variant="outline"
                            className="h-9 rounded-full border-zinc-800 bg-zinc-950/45 px-3 text-xs text-zinc-200 hover:bg-zinc-900"
                          >
                            <Link href={client.reviewHref ?? `/trainer/clients/${client.id}`}>
                              {client.reviewCount ? "Разбор" : "Открыть"}
                            </Link>
                          </Button>
                          <button
                            type="button"
                            onClick={() => setActionsClient(client)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white/5 hover:text-zinc-200"
                            aria-label={`Ещё действия: ${client.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <section className="rounded-[1.85rem] border border-dashed border-zinc-700/90 bg-[radial-gradient(circle_at_18%_12%,rgba(163,230,53,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.9),rgba(7,7,9,0.96))] p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/10 text-lime-100">
                    <Users className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">Клиенты пока не добавлены</h2>
                  <p className="mx-auto mt-2 max-w-[34rem] text-sm leading-relaxed text-zinc-400">
                    Пригласите первого клиента или создайте демонстрационного.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
                      onClick={() => void openInvitation()}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Пригласить по ссылке
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200"
                      onClick={() => setAddClientOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить клиента
                    </Button>
                  </div>
                </section>
              )}
        </section>
      </div>

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[460px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Пригласить клиента</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Скопируйте ссылку и отправьте её клиенту. После регистрации он попадёт в клиентскую базу тренера.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="rounded-[1.2rem] border border-zinc-800 bg-black/24 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Ссылка приглашения</p>
              <p className="mt-3 break-all text-sm leading-relaxed text-zinc-100">
                {inviteLoading ? "Создаём одноразовую ссылку..." : inviteLink ?? "Ссылка не создана"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                disabled={!inviteLink || inviteLoading}
                className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                onClick={() => void copyInviteLink()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Скопировать
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
              >
                <a href={`mailto:?subject=Приглашение в кабинет&body=${encodeURIComponent(inviteLink ?? "")}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addClientOpen} onOpenChange={setAddClientOpen}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Добавить клиента</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Быстрая заготовка клиента для планирования. Реальное приглашение можно отправить ссылкой.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Имя клиента</Label>
              <Input
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="Например, Иван Петров"
                className="h-11 rounded-2xl border-zinc-800 bg-zinc-900/80"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Цель</Label>
              <Input
                value={newClientGoal}
                onChange={(event) => setNewClientGoal(event.target.value)}
                placeholder="Снижение веса, набор массы, сила"
                className="h-11 rounded-2xl border-zinc-800 bg-zinc-900/80"
              />
            </div>
            <div className="rounded-[1.1rem] border border-lime-300/12 bg-lime-300/[0.045] p-4 text-sm leading-relaxed text-lime-100/90">
              После добавления клиент появится в списке со статусом “Нет программы”, чтобы тренер сразу мог назначить план.
            </div>
            <Button
              type="button"
              className="h-11 w-full rounded-full bg-lime-300 text-black hover:bg-lime-200"
              onClick={handleAddClient}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Добавить заготовку
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[460px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Фильтры и сортировка</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Настройте список под текущую задачу: разборы, клиенты без программы или дисциплина.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Фильтр</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      activeFilter === filter.id
                        ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                        : "border-zinc-800 bg-black/18 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сортировка</p>
              <div className="mt-3 grid gap-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSortMode(option.id)}
                    className={cn(
                      "rounded-[1rem] border p-3 text-left transition",
                      sortMode === option.id
                        ? "border-lime-300/18 bg-lime-300/10"
                        : "border-zinc-800 bg-black/18 hover:border-zinc-700"
                    )}
                  >
                    <span className="text-sm font-medium text-zinc-100">{option.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{option.helper}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
              onClick={() => {
                setActiveFilter("all");
                setSortMode("recent");
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Сбросить
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(messageClient)} onOpenChange={(open) => !open && setMessageClient(null)}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">
              {messageClient ? `Сообщение: ${messageClient.name}` : "Сообщение клиенту"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Быстрый черновик для Telegram или личного сообщения.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <Textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              className="min-h-36 rounded-[1.2rem] border-zinc-800 bg-zinc-900/80 text-zinc-100"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                onClick={sendMessageDraft}
              >
                <Send className="mr-2 h-4 w-4" />
                Сохранить черновик
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
              >
                <Link href={messageClient ? `/trainer/clients/${messageClient.id}` : "/trainer/clients"}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Открыть клиента
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(actionsClient)} onOpenChange={(open) => !open && setActionsClient(null)}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[430px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">
              {actionsClient ? actionsClient.name : "Действия клиента"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Быстрый переход к основным сценариям ведения.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 px-4">
            <Button asChild variant="outline" className="h-11 justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-200 hover:bg-zinc-900">
              <Link href={actionsClient ? `/trainer/clients/${actionsClient.id}` : "/trainer/clients"}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Открыть карточку
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-200 hover:bg-zinc-900"
              onClick={() => {
                setQuickAssignClient(actionsClient);
                setActionsClient(null);
              }}
              disabled={!actionsClient}
            >
                <Dumbbell className="mr-2 h-4 w-4" />
                Назначить тренировку
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-200 hover:bg-zinc-900"
              onClick={() => {
                if (actionsClient) openMessage(actionsClient);
                setActionsClient(null);
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Написать клиенту
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-200 hover:bg-zinc-900"
              onClick={() => {
                toast.success("Заметка тренера подготовлена");
                setActionsClient(null);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Добавить заметку
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <QuickAssignDrawer
        athleteId={quickAssignClient?.id ?? null}
        context={{
          source: "clients",
          reason: quickAssignClient ? `Быстрое действие для ${quickAssignClient.name} из списка клиентов.` : undefined,
          returnTo: "/trainer/clients",
        }}
        open={Boolean(quickAssignClient)}
        onOpenChange={(open) => {
          if (!open) setQuickAssignClient(null);
        }}
        onAssigned={(receipt) => {
          toast.success(`${receipt.templateTitle} назначена для ${receipt.athleteName}`);
        }}
      />
    </TrainerShell>
  );
}
