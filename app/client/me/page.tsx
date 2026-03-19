"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Как в программе клиента — для записей без шаблона тренера */
const FREE_WORKOUT_TEMPLATE_ID = "00000000-0000-0000-0000-000000000001";
const REST_SECONDS = 90;

type ClientProfile = {
  id: string;
  trainer_id: string | null;
};

type TrainerProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
};

type ExerciseRow = {
  id: string;
  title: string;
  name?: string | null;
};

type WorkoutLogRow = {
  id: string;
  client_id: string;
  exercise_id: string;
  set_index: number;
  performed_weight: number | null;
  performed_reps: number | string | null;
  created_at: string;
};

function normalizeTelegramLink(value: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("@")) return `https://t.me/${v.slice(1)}`;
  return v;
}

function exerciseLabel(ex: ExerciseRow): string {
  const n = (ex.name ?? "").trim();
  if (n) return n;
  return (ex.title ?? "").trim() || "Упражнение";
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function ClientMePage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("3");
  const [saving, setSaving] = useState(false);
  const [todayLogs, setTodayLogs] = useState<WorkoutLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [restSecondsLeft, setRestSecondsLeft] = useState(0);

  const loadTodayLogs = useCallback(
    async (uid: string) => {
      setLogsLoading(true);
      const { data, error: logErr } = await supabase
        .from("workout_logs")
        .select("id, client_id, exercise_id, set_index, performed_weight, performed_reps, created_at")
        .eq("client_id", uid)
        .gte("created_at", startOfTodayISO())
        .lte("created_at", endOfTodayISO())
        .order("created_at", { ascending: false });

      if (logErr) {
        console.error("client/me load workout_logs failed:", logErr);
        setTodayLogs([]);
      } else {
        setTodayLogs((data ?? []) as WorkoutLogRow[]);
      }
      setLogsLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    async function go() {
      setLoading(true);
      setError(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.error("client/me getUser failed:", userErr);
      }
      const user = userRes.user;
      if (!user) {
        router.replace("/login?role=client");
        return;
      }

      setClientId(user.id);

      const { data: clientRow, error: clientErr } = await supabase
        .from("profiles")
        .select("id, trainer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (clientErr) {
        console.error("client/me load client profile failed:", clientErr);
        setError("Не удалось загрузить профиль. Попробуйте позже.");
        setLoading(false);
        return;
      }

      const clientProfile = (clientRow ?? null) as ClientProfile | null;
      const trainerId = clientProfile?.trainer_id?.trim() || null;
      if (!trainerId) {
        setTrainer(null);
        setLoading(false);
        void loadTodayLogs(user.id);
        return;
      }

      const { data: trainerRow, error: trainerErr } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, team_logo_url, telegram_link")
        .eq("id", trainerId)
        .maybeSingle();

      if (trainerErr) {
        console.error("client/me load trainer profile failed:", trainerErr);
        setError("Не удалось загрузить данные тренера. Попробуйте позже.");
        setLoading(false);
        return;
      }

      setTrainer((trainerRow ?? null) as TrainerProfile | null);
      setLoading(false);
      void loadTodayLogs(user.id);
    }
    go();
  }, [router, supabase, loadTodayLogs]);

  useEffect(() => {
    async function loadExercises() {
      setExercisesLoading(true);
      const { data, error: exErr } = await supabase
        .from("exercises")
        .select("id, title, name")
        .order("title", { ascending: true });

      if (exErr) {
        console.error("client/me exercises load failed, retry title-only:", exErr);
        const { data: fallback } = await supabase
          .from("exercises")
          .select("id, title")
          .order("title", { ascending: true });
        setExercises((fallback ?? []) as ExerciseRow[]);
      } else {
        setExercises((data ?? []) as ExerciseRow[]);
      }
      setExercisesLoading(false);
    }
    loadExercises();
  }, [supabase]);

  useEffect(() => {
    if (restSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setRestSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [restSecondsLeft]);

  const exerciseById = useMemo(() => {
    const m = new Map<string, ExerciseRow>();
    exercises.forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  const telegramUrl = useMemo(
    () => normalizeTelegramLink(trainer?.telegram_link ?? null),
    [trainer?.telegram_link]
  );
  const trainerTitle = trainer?.display_name?.trim() || "Мой тренер";
  const trainerName = trainer?.full_name?.trim() || "—";
  const fallbackLetter = (trainer?.display_name?.trim()?.[0] ?? "T").toUpperCase();

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    if (!selectedExerciseId) {
      setError("Выберите упражнение");
      return;
    }
    const w = parseFloat(weight.replace(",", "."));
    const r = parseInt(reps.trim(), 10);
    const nSets = Math.min(20, Math.max(1, parseInt(sets.trim(), 10) || 1));
    if (!Number.isFinite(w) || w <= 0) {
      setError("Укажите вес");
      return;
    }
    if (!Number.isFinite(r) || r <= 0) {
      setError("Укажите повторения");
      return;
    }

    setSaving(true);
    setError(null);

    const rows = Array.from({ length: nSets }, (_, i) => ({
      client_id: clientId,
      template_id: FREE_WORKOUT_TEMPLATE_ID,
      exercise_id: selectedExerciseId,
      exercise_instance_id: selectedExerciseId,
      set_index: i + 1,
      performed_weight: w,
      performed_reps: r,
      completed: true,
    }));

    const { error: insErr } = await supabase.from("workout_logs").insert(rows as never);
    setSaving(false);

    if (insErr) {
      console.error("workout_logs insert failed:", insErr);
      setError(insErr.message ?? "Не удалось сохранить подход");
      return;
    }

    setRestSecondsLeft(REST_SECONDS);
    setWeight("");
    setReps("");
    await loadTodayLogs(clientId);
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      {restSecondsLeft > 0 && (
        <div className="sticky top-0 z-50 border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950/95 via-zinc-950 to-cyan-950/95 px-4 py-3 text-center backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
              Отдых
            </span>
            <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-200">
              {formatTime(restSecondsLeft)}
            </span>
            <span className="text-xs text-zinc-400">
              До следующего подхода — {REST_SECONDS} с
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Кабинет клиента
            </h1>
            <p className="text-sm text-zinc-400">
              Ваш прогресс и программа тренировок.
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
              aria-label="Настройки"
              title="Настройки"
            >
              <Link href="/client/settings">
                <Settings className="size-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
            >
              <Link href="/">На главную</Link>
            </Button>
          </div>
        </header>

        {error && (
          <div
            className="rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Мой тренер</CardTitle>
            <CardDescription className="text-zinc-400">
              Контакты и команда.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-zinc-900/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-44 rounded bg-zinc-900/60" />
                  <div className="h-3 w-28 rounded bg-zinc-900/60" />
                </div>
              </div>
            ) : trainer ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="bg-zinc-900">
                    {trainer.team_logo_url ? (
                      <AvatarImage src={trainer.team_logo_url} alt="Логотип команды" />
                    ) : (
                      <AvatarFallback className="bg-zinc-900 text-zinc-200">
                        {fallbackLetter}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {trainerTitle}
                    </div>
                    <div className="truncate text-xs text-zinc-400">
                      {trainerName}
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  disabled={!telegramUrl}
                  className="rounded-xl bg-zinc-100 px-5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
                >
                  <a href={telegramUrl ?? "#"} target="_blank" rel="noreferrer">
                    Написать тренеру в Telegram
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                У вас пока не указан тренер. Перейдите по ссылке тренера и зарегистрируйтесь как клиент.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Моя программа на сегодня</CardTitle>
            <CardDescription className="text-zinc-400">
              Запишите подходы — они появятся ниже в виде кольца активности.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-zinc-300">Упражнение</Label>
                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  disabled={exercisesLoading}
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">
                    {exercisesLoading ? "Загрузка..." : "Выберите упражнение"}
                  </option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {exerciseLabel(ex)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="w" className="text-xs font-medium text-zinc-300">
                    Вес, кг
                  </Label>
                  <Input
                    id="w"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="60"
                    className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r" className="text-xs font-medium text-zinc-300">
                    Повторения
                  </Label>
                  <Input
                    id="r"
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    placeholder="10"
                    className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s" className="text-xs font-medium text-zinc-300">
                    Подходы
                  </Label>
                  <Input
                    id="s"
                    inputMode="numeric"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    placeholder="3"
                    className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={saving || !clientId}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-2.5 text-sm font-semibold text-zinc-950 hover:opacity-95 disabled:opacity-50"
              >
                {saving ? "Сохраняем..." : "Записать"}
              </Button>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-200">Сегодня</h3>
              {logsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-28 rounded-[1.25rem] bg-zinc-900/50" />
                  ))}
                </div>
              ) : todayLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 p-6 text-center text-sm text-zinc-500">
                  Пока нет записей за сегодня — добавьте первый подход выше.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {todayLogs.map((log) => {
                    const ex = exerciseById.get(log.exercise_id);
                    const name = ex ? exerciseLabel(ex) : "Упражнение";
                    const repsVal =
                      log.performed_reps != null ? String(log.performed_reps) : "—";
                    const wVal =
                      log.performed_weight != null
                        ? log.performed_weight.toLocaleString("ru-RU", { maximumFractionDigits: 1 })
                        : "—";
                    const time = new Date(log.created_at).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div
                        key={log.id}
                        className="group relative overflow-hidden rounded-[1.25rem] border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5 transition hover:ring-emerald-500/20"
                      >
                        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/15 blur-2xl" />
                        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-cyan-500/10 blur-xl" />
                        <div className="relative flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-xs font-medium text-zinc-400">
                              {name}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
                              {time}
                            </span>
                          </div>
                          <div className="flex items-end gap-4">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                                Вес
                              </div>
                              <div className="text-3xl font-semibold tabular-nums tracking-tight text-emerald-400">
                                {wVal}
                                <span className="ml-0.5 text-lg font-medium text-emerald-500/70">кг</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                                Повт.
                              </div>
                              <div className="text-2xl font-semibold tabular-nums text-cyan-300">
                                {repsVal}
                              </div>
                            </div>
                            <div className="ml-auto text-right">
                              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                                Подход
                              </div>
                              <div className="text-xl font-semibold tabular-nums text-zinc-200">
                                {log.set_index}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
