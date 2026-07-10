"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Camera,
  Check,
  MessageCircle,
  Ruler,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MobileCabinetNav } from "@/components/client/mobile-cabinet-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase-client";
import { logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type ClientProfile = {
  id: string;
  full_name: string | null;
  trainer_id: string | null;
  weight: number | null;
  height: number | null;
  target_weight: number | null;
};

type TrainerProfile = {
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
};

type WeightLogRow = {
  id: string;
  weight: number;
  created_at: string;
};

type WorkoutLogRow = {
  created_at: string;
};

type RangeKey = "2w" | "1m" | "3m";

function initials(value: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "AT";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeTelegramLink(value: string | null): string | null {
  const clean = (value ?? "").trim();
  if (!clean) return null;
  if (clean.startsWith("@")) return `https://t.me/${clean.slice(1)}`;
  return clean;
}

function formatWeight(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} кг`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

function computeStreak(rows: WorkoutLogRow[]) {
  const days = [...new Set(rows.map((row) => row.created_at.slice(0, 10)))].sort((a, b) =>
    b.localeCompare(a)
  );

  if (days.length === 0) return 0;

  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(days[index - 1]).getTime();
    const current = new Date(days[index]).getTime();
    const diff = Math.round((previous - current) / (1000 * 60 * 60 * 24));

    if (diff === 1) streak += 1;
    else break;
  }

  return streak;
}

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<RangeKey>("1m");
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLogRow[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [selectedMood, setSelectedMood] = useState("Стабильно");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [referenceNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) logSupabaseError("check-in auth", authError);
      const userId = authData.user?.id;

      if (!userId) {
        router.replace("/login?role=client");
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("id, full_name, trainer_id, weight, height, target_weight")
        .eq("id", userId)
        .maybeSingle();

      if (profileRes.error) {
        logSupabaseError("check-in profile", profileRes.error);
      }

      const profile = (profileRes.data ?? null) as ClientProfile | null;
      if (!profile) {
        setLoading(false);
        return;
      }

      const trainerId = profile.trainer_id?.trim() || null;

      const [trainerRes, weightsRes, workoutsRes] = await Promise.all([
        trainerId
          ? supabase
              .from("profiles")
              .select("full_name, display_name, team_logo_url, telegram_link")
              .eq("id", trainerId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("weight_logs")
          .select("id, weight, created_at")
          .eq("client_id", userId)
          .order("created_at", { ascending: true })
          .limit(240),
        supabase
          .from("workout_logs")
          .select("created_at")
          .eq("client_id", userId)
          .order("created_at", { ascending: false })
          .limit(240),
      ]);

      if (cancelled) return;

      if (trainerRes.error) logSupabaseError("check-in trainer", trainerRes.error);
      if (weightsRes.error) logSupabaseError("check-in weights", weightsRes.error);
      if (workoutsRes.error) logSupabaseError("check-in workouts", workoutsRes.error);

      setClient(profile);
      setTrainer((trainerRes.data ?? null) as TrainerProfile | null);
      setWeightLogs((weightsRes.data ?? []) as WeightLogRow[]);
      setWorkoutLogs((workoutsRes.data ?? []) as WorkoutLogRow[]);
      setWeightInput(profile.weight ? String(profile.weight).replace(".", ",") : "");
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const metrics = useMemo(() => {
    const currentWeight = weightLogs[weightLogs.length - 1]?.weight ?? client?.weight ?? null;
    const twoWeeksAgo = referenceNow - 14 * 24 * 60 * 60 * 1000;
    const monthAgo = referenceNow - 30 * 24 * 60 * 60 * 1000;

    const baseline2w =
      [...weightLogs].reverse().find((row) => new Date(row.created_at).getTime() <= twoWeeksAgo)
        ?.weight ??
      weightLogs[0]?.weight ??
      currentWeight;

    const baseline1m =
      [...weightLogs].reverse().find((row) => new Date(row.created_at).getTime() <= monthAgo)
        ?.weight ??
      weightLogs[0]?.weight ??
      currentWeight;

    const filteredRows = weightLogs.filter((row) => {
      const ts = new Date(row.created_at).getTime();
      const cutoff =
        range === "2w"
          ? referenceNow - 14 * 24 * 60 * 60 * 1000
          : range === "1m"
          ? referenceNow - 30 * 24 * 60 * 60 * 1000
          : referenceNow - 90 * 24 * 60 * 60 * 1000;
      return ts >= cutoff;
    });

    const chart = (filteredRows.length > 0 ? filteredRows : weightLogs.slice(-8)).map((row) => ({
      label: formatDate(row.created_at),
      value: row.weight,
      fullDate: row.created_at,
    }));

    const targetGap =
      client?.target_weight != null && currentWeight != null
        ? currentWeight - client.target_weight
        : null;

    return {
      currentWeight,
      delta2w:
        currentWeight != null && baseline2w != null ? currentWeight - baseline2w : null,
      delta1m:
        currentWeight != null && baseline1m != null ? currentWeight - baseline1m : null,
      chart,
      streak: computeStreak(workoutLogs),
      targetGap,
    };
  }, [client, range, referenceNow, weightLogs, workoutLogs]);

  async function handleSaveCheckIn() {
    if (!client) return;

    const normalized = weightInput.replace(",", ".").trim();
    const value = Number(normalized);

    if (!normalized || Number.isNaN(value) || value <= 0) return;

    setSaving(true);
    setSavedMessage(null);

    const [insertRes, updateRes] = await Promise.all([
      supabase
        .from("weight_logs")
        .insert({ client_id: client.id, weight: value })
        .select("id, weight, created_at")
        .single(),
      supabase.from("profiles").update({ weight: value }).eq("id", client.id),
    ]);

    if (insertRes.error) logSupabaseError("check-in insert weight", insertRes.error);
    if (updateRes.error) logSupabaseError("check-in update profile", updateRes.error);

    if (!insertRes.error && insertRes.data) {
      const newRow = insertRes.data as WeightLogRow;
      setWeightLogs((prev) => [...prev, newRow]);
      setClient((prev) => (prev ? { ...prev, weight: value } : prev));
      setSavedMessage("Чек-ин сохранён. Тренер увидит актуальный вес.");
    }

    setSaving(false);
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
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-zinc-100">Профиль не найден</p>
            <p className="mt-2 text-sm text-zinc-500">Попробуйте снова открыть кабинет.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trainerName = trainer?.display_name?.trim() || trainer?.full_name?.trim() || "Тренер";
  const telegramUrl = normalizeTelegramLink(trainer?.telegram_link ?? null);
  const trendUp = (metrics.delta2w ?? 0) > 0;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-28 pt-4">
        <section className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Progress Hub
              </p>
              <h1 className="mt-2 text-[1.95rem] font-semibold tracking-tight text-zinc-50">
                Check-in
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Быстро фиксируйте вес, самочувствие и видимый прогресс без лишних шагов.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-right">
              <div className="text-xs text-zinc-500">Streak</div>
              <div className="text-lg font-semibold text-zinc-100">{metrics.streak}</div>
            </div>
          </div>
        </section>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-zinc-50">Новый чек-ин</CardTitle>
            <CardDescription className="text-zinc-400">
              Один экран для веса, состояния и сигнала тренеру.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Weight className="h-4 w-4 text-zinc-500" />
                  Актуальный вес
                </div>
                <div className="mt-4 flex gap-2">
                  <Input
                    value={weightInput}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setWeightInput(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="Например, 78.4"
                    className="h-12 rounded-2xl border-zinc-800 bg-black/30 text-zinc-100 placeholder:text-zinc-600"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSaveCheckIn()}
                    disabled={saving}
                    className="h-12 rounded-2xl bg-zinc-100 px-5 text-black hover:bg-white"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {saving ? "Сохраняем" : "Сохранить"}
                  </Button>
                </div>
                {savedMessage ? (
                  <p className="mt-3 text-xs text-zinc-400">{savedMessage}</p>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Sparkles className="h-4 w-4 text-zinc-500" />
                  Самочувствие
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {["Легко", "Стабильно", "Нужно восстановление", "Высокая энергия"].map((mood) => (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        selectedMood === mood
                          ? "border-zinc-600 bg-zinc-900 text-zinc-50"
                          : "border-zinc-800 bg-zinc-950/70 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Текущий вес"
                value={formatWeight(metrics.currentWeight)}
                icon={<Weight className="h-4 w-4" />}
              />
              <MetricTile
                label="За 2 недели"
                value={
                  metrics.delta2w == null
                    ? "—"
                    : `${metrics.delta2w > 0 ? "+" : ""}${metrics.delta2w.toFixed(1)} кг`
                }
                icon={trendUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              />
              <MetricTile
                label="До цели"
                value={
                  metrics.targetGap == null
                    ? "—"
                    : `${metrics.targetGap > 0 ? "-" : "+"}${Math.abs(metrics.targetGap).toFixed(1)} кг`
                }
                icon={<Target className="h-4 w-4" />}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-zinc-50">Динамика веса</CardTitle>
                <CardDescription className="text-zinc-400">
                  Прогресс должен читаться за секунды.
                </CardDescription>
              </div>
              <div className="flex rounded-full border border-zinc-800 bg-black/20 p-1">
                {(["2w", "1m", "3m"] as RangeKey[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      range === item
                        ? "bg-zinc-100 text-black"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="h-56">
              {metrics.chart.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 text-sm text-zinc-500">
                  Добавьте первый чек-ин, чтобы увидеть график.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.chart}>
                    <defs>
                      <linearGradient id="checkInWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f4f4f5" stopOpacity={0.26} />
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
                      fill="url(#checkInWeight)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InsightCard
                title="Месячный ритм"
                text={
                  metrics.delta1m == null
                    ? "Появится после нескольких чек-инов."
                    : `${metrics.delta1m > 0 ? "Вес растёт" : "Вес снижается"} на ${Math.abs(metrics.delta1m).toFixed(1)} кг за месяц.`
                }
                icon={<Activity className="h-4 w-4" />}
              />
              <InsightCard
                title="Текущий фокус"
                text={
                  client.target_weight != null && metrics.currentWeight != null
                    ? `До цели ${Math.abs(metrics.currentWeight - client.target_weight).toFixed(1)} кг. Самочувствие: ${selectedMood.toLowerCase()}.`
                    : "Заполните цель в профиле, чтобы видеть направление работы."
                }
                icon={<Target className="h-4 w-4" />}
              />
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-5">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Замеры и фото</CardTitle>
              <CardDescription className="text-zinc-400">
                Видимые изменения часто убеждают сильнее, чем цифры на графике.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricStrip
                  label="Рост"
                  value={client.height ? `${client.height} см` : "—"}
                  icon={<Ruler className="h-4 w-4" />}
                />
                <MetricStrip
                  label="Целевой вес"
                  value={formatWeight(client.target_weight)}
                  icon={<Target className="h-4 w-4" />}
                />
              </div>
              <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
                    <Camera className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-100">Фото и детальные замеры</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Откройте профиль, чтобы обновить параметры и добавить визуальный прогресс.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                    >
                      <Link href="/client/settings">
                        Открыть профиль
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Связь с тренером</CardTitle>
              <CardDescription className="text-zinc-400">
                Telegram остаётся рядом и усиливает обратную связь.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
                <Avatar className="h-12 w-12 rounded-2xl bg-zinc-900">
                  <AvatarImage src={trainer?.team_logo_url ?? undefined} alt={trainerName} />
                  <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                    {initials(trainerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100">{trainerName}</p>
                  <p className="text-xs text-zinc-500">Последний mood: {selectedMood}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  asChild
                  className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white"
                >
                  <Link href={telegramUrl ?? "https://web.telegram.org/"} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Написать тренеру
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                >
                  <Link href="/client/me">Вернуться в dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <MobileCabinetNav />
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <span>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <span className="text-zinc-500">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-100">{text}</p>
    </div>
  );
}

function MetricStrip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-[1.3rem] border border-zinc-800/90 bg-black/20 px-4 py-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
      </div>
      <div className="text-zinc-500">{icon}</div>
    </div>
  );
}
