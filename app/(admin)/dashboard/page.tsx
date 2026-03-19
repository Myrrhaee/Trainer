"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, DollarSign, Dumbbell, Loader2, Users } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Client = {
  id: string;
  full_name: string;
  email: string;
  telegram_id?: string | null;
  last_reminder_at?: string | null;
  access_granted?: boolean;
};

type MyClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
};

const supabase = createClient();

type WorkoutLogRow = {
  client_id: string;
  created_at: string;
};

type WeightLogRow = {
  client_id: string;
  weight: number;
  created_at: string;
};

type TabKey = "all" | "active" | "lazy";

export default function Home() {
  const router = useRouter();
  const { trainerId } = useTrainer();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [myClientsLoading, setMyClientsLoading] = useState(true);
  const [myClients, setMyClients] = useState<MyClientRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<TabKey>("all");
  const [lastWorkoutByClient, setLastWorkoutByClient] = useState<
    Record<string, number>
  >({});
  const [lastWeightByClient, setLastWeightByClient] = useState<
    Record<string, number>
  >({});
  const [weekWeightsByClient, setWeekWeightsByClient] = useState<
    Record<string, Array<{ ts: number; w: number }>>
  >({});

  const [toast, setToast] = useState<{
    open: boolean;
    title: string;
    description?: string;
    tone: "success" | "error";
  }>({ open: false, title: "", tone: "success" });
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);
  const [accessUpdatingId, setAccessUpdatingId] = useState<string | null>(null);
  const [payments, setPayments] = useState<{ amount: number; created_at: string }[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!trainerId) return;
    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, team_logo_url")
        .eq("id", trainerId)
        .single();
      if (data?.display_name) setDisplayName(data.display_name as string);
      if (data?.team_logo_url) setTeamLogoUrl(data.team_logo_url as string);
    }
    loadProfile();
  }, [trainerId]);

  useEffect(() => {
    async function ensureSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Текущая сессия:", session);
      if (!session) {
        console.log("Пользователь не авторизован");
        router.push("/login?type=trainer");
      }
    }
    ensureSession();
  }, [router]);

  useEffect(() => {
    async function loadClients() {
      setLoading(true);
      const { data, error } = await supabase
        .from("trainer_clients")
        .select(
          "id, access_granted, profiles ( id, full_name, email, role, telegram_id, last_reminder_at )"
        )
        .eq("trainer_id", trainerId);

      if (!error && data) {
        const mapped =
          (data as any[]).map((row) => ({
            id: row.profiles.id,
            full_name: row.profiles.full_name,
            email: row.profiles.email,
            telegram_id: row.profiles.telegram_id,
            last_reminder_at: row.profiles.last_reminder_at ?? null,
            access_granted: row.access_granted !== false,
          })) ?? [];
        setClients(mapped);
      }

      setLoading(false);
    }

    if (trainerId) {
      loadClients();
    }
  }, [trainerId]);

  useEffect(() => {
    let cancelled = false;
    async function loadMyClients() {
      if (!trainerId) return;
      setMyClientsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("my-clients load failed:", error);
        setMyClients([]);
        setMyClientsLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as MyClientRow[];
      setMyClients(rows);
      setMyClientsLoading(false);
    }
    loadMyClients();
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  async function setClientAccess(clientId: string, granted: boolean) {
    if (!trainerId) return;
    setAccessUpdatingId(clientId);
    await supabase
      .from("trainer_clients")
      .update({ access_granted: granted })
      .eq("trainer_id", trainerId)
      .eq("client_id", clientId);
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, access_granted: granted } : c))
    );
    setAccessUpdatingId(null);
  }

  useEffect(() => {
    if (clients.length === 0) return;

    async function loadActivityAndWeights() {
      const ids = clients.map((c) => c.id);
      const now = Date.now();

      const cutoff5d = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
      const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: workouts, error: wErr }, { data: weights, error: wtErr }] =
        await Promise.all([
          supabase
            .from("workout_logs")
            .select("client_id, created_at")
            .in("client_id", ids)
            .gte("created_at", cutoff5d),
          supabase
            .from("weight_logs")
            .select("client_id, weight, created_at")
            .in("client_id", ids)
            .gte("created_at", cutoff7d)
            .order("created_at", { ascending: true }),
        ]);

      if (wErr) {
        console.warn(
          "workout_logs:",
          wErr.message ?? wErr.code ?? "таблица недоступна или RLS"
        );
      }
      if (wtErr) {
        console.warn(
          "weight_logs:",
          wtErr.message ?? wtErr.code ?? "таблица недоступна или RLS"
        );
      }

      const lastWorkout: Record<string, number> = {};
      for (const r of (workouts ?? []) as WorkoutLogRow[]) {
        const ts = new Date(r.created_at).getTime();
        if (!lastWorkout[r.client_id] || ts > lastWorkout[r.client_id]) {
          lastWorkout[r.client_id] = ts;
        }
      }
      setLastWorkoutByClient(lastWorkout);

      const lastWeight: Record<string, number> = {};
      const weekSeries: Record<string, Array<{ ts: number; w: number }>> = {};
      for (const r of (weights ?? []) as WeightLogRow[]) {
        const ts = new Date(r.created_at).getTime();
        if (!weekSeries[r.client_id]) weekSeries[r.client_id] = [];
        weekSeries[r.client_id].push({ ts, w: r.weight });

        if (!lastWeight[r.client_id] || ts > lastWeight[r.client_id]) {
          lastWeight[r.client_id] = ts;
        }
      }
      setLastWeightByClient(lastWeight);
      setWeekWeightsByClient(weekSeries);
    }

    loadActivityAndWeights();
  }, [clients]);

  useEffect(() => {
    if (!trainerId) return;
    supabase
      .from("payments")
      .select("amount, created_at")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setPayments((data as { amount: number; created_at: string }[]) ?? []));
  }, [trainerId]);

  const financeStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now.getTime() - 7 * dayMs;
    const revenueThisMonth = payments
      .filter((p) => new Date(p.created_at).getTime() >= monthStart)
      .reduce((s, p) => s + Number(p.amount), 0);
    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    payments
      .filter((p) => new Date(p.created_at).getTime() >= sevenDaysAgo)
      .forEach((p) => {
        const key = p.created_at.slice(0, 10);
        if (key in byDay) byDay[key] += Number(p.amount);
      });
    const sparklineData = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sum]) => ({
        date,
        label: new Date(date + "Z").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        sum,
      }));
    return { revenueThisMonth, sparklineData };
  }, [payments]);

  async function handleAddClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (!trainerId) {
      console.error("Ошибка: тренер не авторизован");
      alert("Войдите в аккаунт, чтобы добавить клиента.");
      return;
    }

    setSaving(true);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert({
          full_name: name.trim(),
          email: email.trim(),
          role: "client",
        })
        .select("id")
        .maybeSingle();

      if (profileError || !profileData) {
        console.error("Ошибка создания профиля клиента:", profileError);
        alert("Не удалось сохранить клиента. Проверьте настройки Supabase.");
        return;
      }

      const newClientId = profileData.id;
      console.log("Ответ от базы при создании профиля:", profileData);
      console.log("ID нового клиента:", newClientId);

      if (!newClientId) {
        alert("Профиль создан, но ID клиента не получен.");
        return;
      }

      console.log("Связь создается для:", {
        trainer: trainerId,
        client: newClientId,
      });

      const { error: linkError } = await supabase.from("trainer_clients").insert({
        trainer_id: trainerId,
        client_id: newClientId,
        status: "active",
        access_granted: true,
      });

      if (linkError) {
        console.error("Детали ошибки связи:", linkError);
        alert(
          `Клиент создан, но связь с тренером не сохранилась: ${linkError.message}`
        );
        return;
      }

      setClients((prev) => [
        ...prev,
        {
          id: newClientId,
          full_name: name.trim(),
          email: email.trim(),
          access_granted: true,
        },
      ]);

      setDialogOpen(false);
      setName("");
      setEmail("");
    } catch (error: any) {
      console.error("Неожиданная ошибка при создании клиента:", error);
      alert(
        `Не удалось сохранить клиента или связь с тренером: ${
          error?.message ?? "unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendReminder(client: {
    id: string;
    full_name: string;
    telegram_id?: string | null;
  }) {
    if (!client.telegram_id) {
      setToast({
        open: true,
        title: "Telegram не привязан",
        description: "Добавьте telegram_id в профиле клиента.",
        tone: "error",
      });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
      return;
    }

    setReminderLoadingId(client.id);
    try {
      const res = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          clientName: client.full_name,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          open: true,
          title: "Не удалось отправить",
          description:
            (data?.error as string) ||
            "Проверьте, что клиент запускал бота (/start).",
          tone: "error",
        });
        setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
        return;
      }

      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? { ...c, last_reminder_at: new Date().toISOString() }
            : c
        )
      );
      setToast({
        open: true,
        title: "Сообщение доставлено!",
        tone: "success",
      });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
    } catch (e) {
      console.error("Ошибка отправки напоминания:", e);
      setToast({
        open: true,
        title: "Ошибка сети",
        description: "Повторите попытку.",
        tone: "error",
      });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
    } finally {
      setReminderLoadingId(null);
    }
  }

  const now = Date.now();
  const activeCutoff = now - 24 * 60 * 60 * 1000;
  const attentionCutoff = now - 5 * 24 * 60 * 60 * 1000;

  const derived = useMemo(() => {
    const withMeta = clients.map((c) => {
      const lastWorkout = lastWorkoutByClient[c.id] ?? null;
      const lastWeight = lastWeightByClient[c.id] ?? null;
      const lastAny = Math.max(lastWorkout ?? 0, lastWeight ?? 0) || null;

      const activeToday = lastWorkout !== null && lastWorkout >= activeCutoff;
      const needsAttention = !lastAny || lastAny < attentionCutoff;

      return {
        ...c,
        activeToday,
        needsAttention,
        lastAny,
        weekWeights: weekWeightsByClient[c.id] ?? [],
      };
    });

    const totalClients = withMeta.length;
    const activeTodayCount = withMeta.filter((c) => c.activeToday).length;
    const needsAttentionCount = withMeta.filter((c) => c.needsAttention).length;

    return {
      withMeta,
      totalClients,
      activeTodayCount,
      needsAttentionCount,
    };
  }, [
    clients,
    lastWorkoutByClient,
    lastWeightByClient,
    weekWeightsByClient,
    activeCutoff,
    attentionCutoff,
  ]);

  const filteredClients = useMemo(() => {
    if (tab === "active") return derived.withMeta.filter((c) => c.activeToday);
    if (tab === "lazy") return derived.withMeta.filter((c) => c.needsAttention);
    return derived.withMeta;
  }, [tab, derived.withMeta]);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                {displayName
                  ? `Панель управления: ${displayName}`
                  : "Панель управления"}
              </h1>

              <div className="inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <Avatar size="sm" className="bg-zinc-900">
                  {teamLogoUrl ? (
                    <AvatarImage src={teamLogoUrl} alt="Логотип команды" />
                  ) : (
                    <AvatarFallback className="bg-zinc-900 text-zinc-200">
                      {(displayName?.trim()?.[0] ?? "К").toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Команда
                  </div>
                  <div className="max-w-[220px] truncate text-sm font-medium text-zinc-100">
                    {displayName?.trim() ? displayName : "Без названия"}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Быстрый обзор активности и состояния клиентов.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md">
                + Добавить клиента
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border border-border/80 bg-zinc-950/95 text-foreground backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-zinc-50">
                  Новый клиент
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Введите имя и email, чтобы добавить клиента в вашу базу.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium text-zinc-200"
                  >
                    Имя
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setName(e.target.value)
                    }
                    className="h-9 rounded-xl border-border/70 bg-zinc-900/80 text-sm text-foreground ring-0 focus-visible:ring-2 focus-visible:ring-zinc-400/70"
                    placeholder="Например, Иван Петров"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-medium text-zinc-200"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEmail(e.target.value)
                    }
                    className="h-9 rounded-xl border-border/70 bg-zinc-900/80 text-sm text-foreground ring-0 focus-visible:ring-2 focus-visible:ring-zinc-400/70"
                    placeholder="client@example.com"
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={saving || !name.trim() || !email.trim()}
                    className="ml-auto rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {/* Верхний ряд: Stats */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="size-4 text-zinc-200" />}
            label="Всего клиентов"
            value={derived.totalClients}
            tone="neutral"
          />
          <StatCard
            icon={<Dumbbell className="size-4 text-emerald-300" />}
            label="Активны сегодня"
            value={derived.activeTodayCount}
            tone="success"
          />
          <StatCard
            icon={<AlertTriangle className="size-4 text-amber-300" />}
            label="Требуют внимания"
            value={derived.needsAttentionCount}
            tone="warning"
          />
          <Link href="/dashboard/analytics" className="block">
            <Card className="h-full border border-border/60 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-emerald-500/15 transition hover:-translate-y-0.5 hover:border-zinc-500/70 hover:bg-zinc-900/45">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Финансы
                </CardTitle>
                <div className="rounded-full bg-emerald-500/10 p-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                  {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(financeStats.revenueThisMonth)} ₽
                </div>
                <div className="mt-2 h-8 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financeStats.sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                      <Line
                        type="monotone"
                        dataKey="sum"
                        stroke="rgb(16, 185, 129)"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>

        {/* Фильтры */}
        <section className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-zinc-900/40 p-1">
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              Все
            </TabButton>
            <TabButton active={tab === "active"} onClick={() => setTab("active")}>
              Активные
            </TabButton>
            <TabButton active={tab === "lazy"} onClick={() => setTab("lazy")}>
              Прогульщики
            </TabButton>
          </div>
          <Badge variant="outline" className="border-border/60 text-zinc-300">
            {filteredClients.length} из {derived.totalClients}
          </Badge>
        </section>

        {/* Список клиентов */}
        <section className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : derived.totalClients === 0 ? (
            <Card className="col-span-full border border-border/60 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <CardHeader>
                <CardTitle className="text-zinc-100">
                  Пока нет клиентов
                </CardTitle>
                <CardDescription>
                  Нажмите «+ Добавить клиента», чтобы начать формировать базу.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            filteredClients.map((client) => (
              <Card
                key={client.id}
                className="border border-border/60 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition hover:-translate-y-0.5 hover:border-zinc-500/70 hover:bg-zinc-900/45"
              >
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-zinc-900 text-zinc-200">
                      {initials(client.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${
                          client.activeToday ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                      />
                      <CardTitle className="truncate text-sm text-zinc-50">
                        {client.full_name}
                      </CardTitle>
                    </div>
                    <CardDescription className="truncate text-xs text-zinc-400">
                      {client.email}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {client.needsAttention ? (
                      <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Внимание
                      </Badge>
                    ) : client.activeToday ? (
                      <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        Сегодня
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-border/60 text-zinc-300">
                        Оффлайн
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-zinc-400">
                      Доступ к приложению
                    </span>
                    <Switch
                      checked={client.access_granted !== false}
                      disabled={accessUpdatingId === client.id}
                      onCheckedChange={(checked) =>
                        void setClientAccess(client.id, checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-500">
                      {client.lastAny
                        ? `Последняя активность: ${new Date(
                            client.lastAny
                          ).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                          })}`
                        : "Нет данных активности"}
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
                        const nowMs = Date.now();
                        const lastReminderAt = client.last_reminder_at
                          ? new Date(client.last_reminder_at).getTime()
                          : 0;
                        const withinCooldown =
                          lastReminderAt > 0 &&
                          nowMs - lastReminderAt < REMINDER_COOLDOWN_MS;
                        const reminderDisabled =
                          !client.telegram_id || withinCooldown;
                        const hoursLeft = withinCooldown
                          ? Math.ceil(
                              (REMINDER_COOLDOWN_MS - (nowMs - lastReminderAt)) /
                                (60 * 60 * 1000)
                            )
                          : 0;
                        const cooldownTooltip = withinCooldown
                          ? `Напоминание уже отправлено. Можно будет повторить через ${hoursLeft} ч.`
                          : "Можно напомнить через несколько часов";
                        const reminderTooltip: string = reminderDisabled
                          ? !client.telegram_id
                            ? "Нужна привязка ТГ"
                            : cooldownTooltip
                          : "Отправить дружеское напоминание";
                        const isLoading = reminderLoadingId === client.id;
                        const button = (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 shrink-0 rounded-full border border-border/60 text-zinc-200 hover:bg-zinc-800/60 hover:text-white disabled:pointer-events-auto disabled:opacity-50"
                            title={!reminderDisabled ? reminderTooltip : undefined}
                            aria-label={reminderTooltip}
                            disabled={reminderDisabled || isLoading}
                            onClick={() =>
                              void sendReminder({
                                id: client.id,
                                full_name: client.full_name,
                                telegram_id: client.telegram_id,
                              })
                            }
                          >
                            {isLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <BellRing className="size-4" />
                            )}
                          </Button>
                        );
                        return reminderDisabled ? (
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block size-8 shrink-0">
                                {button}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {reminderTooltip}
                            </TooltipContent>
                          </UITooltip>
                        ) : (
                          button
                        );
                      })()}
                      {client.telegram_id ? (
                        <a
                          className="text-[11px] font-medium text-zinc-200 underline underline-offset-4 hover:text-white"
                          href={`https://t.me/user?id=${encodeURIComponent(
                            client.telegram_id
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Telegram →
                        </a>
                      ) : (
                        <span
                          className="text-[11px] text-zinc-600"
                          title="Нужна привязка ТГ"
                        >
                          Telegram не привязан
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-10 w-full">
                    {client.weekWeights.length < 2 ? (
                      <div className="h-full w-full rounded-xl border border-border/40 bg-zinc-950/40" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={client.weekWeights.map((p) => ({
                            ts: p.ts,
                            w: p.w,
                            d: new Date(p.ts).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                            }),
                          }))}
                          margin={{ left: 0, right: 0, top: 6, bottom: 0 }}
                        >
                          <XAxis dataKey="d" hide />
                          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                          <RechartsTooltip
                            cursor={false}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p: any = payload[0].payload;
                              return (
                                <div className="rounded-2xl border border-border/60 bg-zinc-950/95 px-2.5 py-1.5 text-[11px] text-zinc-100 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
                                  <div className="font-semibold">{p.w} кг</div>
                                  <div className="text-zinc-400">{p.d}</div>
                                </div>
                              );
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="w"
                            stroke="rgba(244,244,245,0.85)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3, fill: "#09090b", stroke: "#f4f4f5", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {/* Мои клиенты (привязка по trainer_id) */}
        <section>
          <Card className="border border-border/60 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <CardHeader>
              <CardTitle className="text-zinc-100">Мои клиенты</CardTitle>
              <CardDescription>
                Клиенты, зарегистрированные по вашей ссылке (привязка по trainer_id).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClientsLoading ? (
                <div className="space-y-2">
                  <div className="h-10 w-full rounded-xl bg-zinc-900/60" />
                  <div className="h-10 w-full rounded-xl bg-zinc-900/60" />
                  <div className="h-10 w-full rounded-xl bg-zinc-900/60" />
                </div>
              ) : myClients.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                  <div className="font-medium text-zinc-100">
                    У вас пока нет клиентов.
                  </div>
                  <div className="mt-1 text-zinc-400">
                    Поделитесь своей ссылкой на визитку, чтобы начать!
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <div className="grid grid-cols-12 gap-3 bg-zinc-950/60 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    <div className="col-span-5">Имя клиента</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2">Регистрация</div>
                    <div className="col-span-1 text-right"> </div>
                  </div>
                  <div className="divide-y divide-border/60 bg-zinc-950/30">
                    {myClients.map((c) => {
                      const name = (c.full_name ?? "").trim() || "Без имени";
                      const email = (c.email ?? "").trim() || "—";
                      const date = c.created_at
                        ? new Date(c.created_at).toLocaleDateString("ru-RU", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "—";

                      return (
                        <div
                          key={c.id}
                          className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm"
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-medium text-zinc-100">
                              {name}
                            </div>
                          </div>
                          <div className="col-span-4 min-w-0">
                            <div className="truncate text-zinc-300">{email}</div>
                          </div>
                          <div className="col-span-2 text-zinc-400">{date}</div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                              onClick={() => {
                                // placeholder
                                alert("Скоро: откроем программу клиента");
                              }}
                            >
                              Открыть программу
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {toast.open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
          <div
            className={`pointer-events-auto w-full max-w-md rounded-3xl border px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-zinc-950/95"
                : "border-rose-500/30 bg-zinc-950/95"
            }`}
          >
            <div className="text-sm font-semibold text-zinc-50">
              {toast.title}
            </div>
            {toast.description && (
              <div className="mt-0.5 text-xs text-zinc-400">
                {toast.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="border border-border/50 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
      <CardHeader className="space-y-3">
        <div className="h-4 w-32 rounded-full bg-zinc-800/80" />
        <div className="h-3 w-40 rounded-full bg-zinc-900/80" />
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="h-2.5 w-full rounded-full bg-zinc-900/80" />
        <div className="h-2.5 w-3/4 rounded-full bg-zinc-900/80" />
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning";
}) {
  const ring =
    tone === "success"
      ? "ring-emerald-500/15"
      : tone === "warning"
      ? "ring-amber-500/15"
      : "ring-zinc-500/10";

  return (
    <Card className={`border border-border/60 bg-zinc-900/30 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ${ring}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </CardTitle>
        <div className="rounded-full bg-zinc-950/50 p-2">{icon}</div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-3xl font-semibold tracking-tight text-zinc-50">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-zinc-100 text-black"
          : "text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

