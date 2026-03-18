"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { LogOut, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import * as htmlToImage from "html-to-image";

import { createClient } from "@/lib/supabase-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeightTracker } from "@/components/client/WeightTracker";
import { ShareCard } from "@/components/client/ShareCard";

const supabase = createClient();

/** ID виртуального шаблона для своей тренировки (без тренера). */
const CUSTOM_TEMPLATE_ID = "00000000-0000-0000-0000-000000000001";

/** Упражнения, которые можно добавить в свою тренировку. */
const ADDABLE_EXERCISES = [
  "Жим лёжа",
  "Присед со штангой",
  "Становая тяга",
  "Подтягивания",
  "Отжимания",
  "Тяга горизонтальная",
  "Жим стоя",
  "Разводки гантелей",
  "Выпады",
  "Планка",
];

/** Популярные программы для блока «Магазин». */
const MARKET_PROGRAMS = [
  { id: "market-1", title: "Мощный верх", price: "990 ₽" },
  { id: "market-2", title: "Жиросжигание за 30 дней", price: "Бесплатно" },
  { id: "market-3", title: "База для набора массы", price: "1 490 ₽" },
];

type PlanExercise = {
  id: string;
  exercise_id: string;
  title: string;
  muscle_group?: string | null;
  video_url?: string | null;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
  rest: string;
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

type WorkoutTemplate = {
  id: string;
  title: string;
  plan_json: PlanJson | null;
};

type AssignedProgram = {
  id: string;
  client_id: string;
  template_id: string;
  status: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  is_paid?: boolean;
};

type LogKey = string;

type LogEntry = {
  weight: string;
  reps: string;
  done: boolean;
};

type WorkoutFinishStats = {
  tonnageKg: number;
  exercisesDone: number;
  keyExercise: {
    title: string;
    exerciseId: string;
    currentMaxKg: number | null;
    previousMaxKg: number | null;
    isNewRecord: boolean;
  } | null;
};

function closeOrGoHome() {
  const w = typeof window !== "undefined" ? window : null;
  const tg = (w as { Telegram?: { WebApp?: { close?: () => void } } })
    ?.Telegram?.WebApp;
  if (tg?.close) {
    tg.close();
  } else {
    w?.location?.assign("/");
  }
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = url.trim();
    const watchMatch = u.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
    const shortMatch = u.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
    return null;
  } catch {
    return null;
  }
}

export default function ClientWorkoutPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const clientId = params?.id;
  const programIdFromQuery = searchParams?.get("program") ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const [logState, setLogState] = useState<Record<LogKey, LogEntry>>({});

  const [restActive, setRestActive] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [finishSending, setFinishSending] = useState<"idle" | "sending" | "done">(
    "idle"
  );
  const [finishStats, setFinishStats] = useState<WorkoutFinishStats | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [shareGenerating, setShareGenerating] = useState(false);
  const [shareCardVisible, setShareCardVisible] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [lastResultByExerciseId, setLastResultByExerciseId] = useState<
    Record<string, { weight: number | null; reps: string | null }>
  >({});
  const [activatingAccess, setActivatingAccess] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [hasTrainer, setHasTrainer] = useState<boolean | null>(null);
  const [customExercises, setCustomExercises] = useState<PlanExercise[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const STORAGE_KEY = clientId ? `client:${clientId}:customExercises` : null;

  function buildVirtualTemplate(exercises: PlanExercise[]): WorkoutTemplate | null {
    if (!exercises.length) return null;
    return {
      id: CUSTOM_TEMPLATE_ID,
      title: "Своя тренировка",
      plan_json: {
        weeks: [
          {
            id: "w1",
            name: "Неделя 1",
            days: [
              {
                id: "d1",
                name: "Тренировка",
                exercises,
              },
            ],
          },
        ],
      },
    };
  }

  useEffect(() => {
    if (!clientId) return;

    async function loadClientWorkout() {
      setLoading(true);
      setAccessDenied(false);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, is_paid")
        .eq("id", clientId)
        .maybeSingle();

      if (profileError) {
        console.error("profiles select failed:", profileError);
      }
      if (profileData) {
        setProfile(profileData as Profile);
      }

      const { data: linkRow } = await supabase
        .from("trainer_clients")
        .select("trainer_id, access_granted")
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle();

      const linked = linkRow as { trainer_id?: string | null; access_granted?: boolean } | null;
      const trainerLinked = !!(linked?.trainer_id != null && String(linked.trainer_id).trim() !== "");
      setHasTrainer(trainerLinked);

      if (linked && linked.access_granted === false) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      let templateId: string | null = null;

      if (programIdFromQuery) {
        const [assigned, bought] = await Promise.all([
          supabase
            .from("assigned_programs")
            .select("id")
            .eq("client_id", clientId)
            .eq("template_id", programIdFromQuery)
            .eq("status", "active")
            .maybeSingle(),
          supabase
            .from("client_programs")
            .select("id")
            .eq("client_id", clientId)
            .eq("template_id", programIdFromQuery)
            .maybeSingle(),
        ]);
        if (assigned.data || bought.data) {
          templateId = programIdFromQuery;
        }
      }

      if (!templateId) {
        const { data: assignedData } = await supabase
          .from("assigned_programs")
          .select("id, client_id, template_id, status")
          .eq("client_id", clientId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (assignedData) {
          templateId = (assignedData as AssignedProgram).template_id;
        }
      }

      if (templateId) {
        const { data: templateData } = await supabase
          .from("workout_templates")
          .select("id, title, plan_json")
          .eq("id", templateId)
          .single();

        if (templateData) {
          setTemplate(templateData as WorkoutTemplate);
        } else {
          setTemplate(null);
        }
      } else {
        setTemplate(null);
        if (!trainerLinked && typeof window !== "undefined" && clientId) {
          try {
            const raw = localStorage.getItem(`client:${clientId}:customExercises`);
            const parsed = raw ? (JSON.parse(raw) as PlanExercise[]) : [];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCustomExercises(parsed);
              setTemplate(buildVirtualTemplate(parsed));
            }
          } catch {
            // ignore
          }
        }
      }

      setLoading(false);
    }

    loadClientWorkout();
  }, [clientId, programIdFromQuery]);

  useEffect(() => {
    if (!STORAGE_KEY || customExercises.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customExercises));
    } catch {
      // ignore
    }
  }, [STORAGE_KEY, customExercises]);

  const todayDay = useMemo<PlanDay | null>(() => {
    if (!template?.plan_json?.weeks?.length) return null;
    const firstWeek = template.plan_json.weeks[0];
    if (!firstWeek?.days?.length) return null;
    return firstWeek.days[0];
  }, [template]);

  // Последний результат по каждому упражнению (для подсказки "В прошлый раз")
  useEffect(() => {
    if (!clientId || !todayDay?.exercises?.length) return;

    const exerciseIds = todayDay.exercises.map(
      (ex) => ex.exercise_id ?? ex.id
    ) as string[];

    async function loadLastResults() {
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("exercise_id, performed_weight, performed_reps, created_at")
        .eq("client_id", clientId)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false });

      if (!logs?.length) return;

      const byExercise: Record<
        string,
        { weight: number | null; reps: string | null }
      > = {};
      for (const row of logs as Array<{
        exercise_id: string;
        performed_weight: number | null;
        performed_reps: string | number | null;
      }>) {
        if (row.exercise_id && !(row.exercise_id in byExercise)) {
          byExercise[row.exercise_id] = {
            weight: row.performed_weight ?? null,
            reps:
              row.performed_reps != null
                ? String(row.performed_reps)
                : null,
          };
        }
      }
      setLastResultByExerciseId(byExercise);
    }

    loadLastResults();
  }, [clientId, todayDay?.exercises]);

  function parseSetCount(exercise: PlanExercise): number {
    const raw = exercise.sets?.toString().trim() || "3";
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num <= 0) return 3;
    return Math.min(num, 10);
  }

  function logKey(exerciseId: string, setIndex: number): LogKey {
    return `${exerciseId}:${setIndex}`;
  }

  function parseNum(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const s = String(raw).trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function pickKeyExercise(day: PlanDay): PlanExercise | null {
    const byName = day.exercises.find((e) => e.title?.toLowerCase().includes("жим"));
    return byName ?? day.exercises[0] ?? null;
  }

  async function computeFinishStats(): Promise<WorkoutFinishStats> {
    const day = todayDay;
    if (!day) {
      return { tonnageKg: 0, exercisesDone: 0, keyExercise: null };
    }

    let tonnageKg = 0;
    let exercisesDone = 0;

    // count an exercise as "done" if at least one set is marked done
    for (const ex of day.exercises) {
      const setCount = parseSetCount(ex);
      let exHasDone = false;
      for (let i = 1; i <= setCount; i++) {
        const entry = logState[logKey(ex.id, i)];
        if (!entry?.done) continue;
        exHasDone = true;

        const w = parseNum(entry.weight);
        const r = parseNum(entry.reps);
        if (w != null && r != null) {
          tonnageKg += w * r;
        }
      }
      if (exHasDone) exercisesDone += 1;
    }

    const key = pickKeyExercise(day);
    if (!clientId || !key) {
      return {
        tonnageKg: Math.round(tonnageKg),
        exercisesDone,
        keyExercise: null,
      };
    }

    const keyExerciseId = key.exercise_id ?? key.id;

    let currentMaxKg: number | null = null;
    {
      const setCount = parseSetCount(key);
      for (let i = 1; i <= setCount; i++) {
        const entry = logState[logKey(key.id, i)];
        if (!entry?.done) continue;
        const w = parseNum(entry.weight);
        if (w == null) continue;
        currentMaxKg = currentMaxKg == null ? w : Math.max(currentMaxKg, w);
      }
    }

    // previous record: max performed_weight in history for this exercise
    const { data: prevRows } = await supabase
      .from("workout_logs")
      .select("performed_weight")
      .eq("client_id", clientId)
      .eq("exercise_id", keyExerciseId)
      .not("performed_weight", "is", null)
      .order("performed_weight", { ascending: false })
      .limit(1);

    const previousMaxKg =
      (prevRows?.[0] as { performed_weight: number | null } | undefined)
        ?.performed_weight ?? null;

    const isNewRecord =
      currentMaxKg != null && (previousMaxKg == null || currentMaxKg > previousMaxKg);

    return {
      tonnageKg: Math.round(tonnageKg),
      exercisesDone,
      keyExercise: {
        title: key.title,
        exerciseId: keyExerciseId,
        currentMaxKg,
        previousMaxKg,
        isNewRecord,
      },
    };
  }

  async function shareResult() {
    if (shareGenerating) return;

    const stats = finishStats ?? (await computeFinishStats());
    setFinishStats(stats);

    setShareToast("Генерирую твой трофей...");
    setShareGenerating(true);
    setShareCardVisible(true);

    await new Promise((r) => setTimeout(r, 60));

    const node = shareCardRef.current;
    if (!node) {
      setShareGenerating(false);
      setShareCardVisible(false);
      return;
    }

    try {
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#09090b", // zinc-950
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "my-workout-progress.png", {
        type: "image/png",
      });

      const navAny = navigator as unknown as {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: {
          files?: File[];
          title?: string;
          text?: string;
        }) => Promise<void>;
      };

      const payload = {
        files: [file],
        title: "Мой прогресс",
        text: "Мой результат тренировки в AI Strength Coach",
      };

      if (navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }))) {
        await navAny.share(payload);
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "my-workout-progress.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error("Share generation failed:", e);
    } finally {
      setShareGenerating(false);
      setShareCardVisible(false);
    }
  }

  async function saveLog(
    exercise: PlanExercise,
    setIndex: number,
    entry: LogEntry
  ) {
    if (!clientId || !template) return;

    const payload = {
      client_id: clientId,
      template_id: template.id,
      exercise_id: exercise.exercise_id ?? exercise.id,
      exercise_instance_id: exercise.id,
      set_index: setIndex,
      performed_weight: entry.weight || null,
      performed_reps: entry.reps || null,
      completed: entry.done,
    };

    const { error } = await supabase.from("workout_logs").insert(payload);
    if (error) {
      console.error("Ошибка сохранения workout_logs:", error);
    }
  }

  function updateSet(
    exercise: PlanExercise,
    setIndex: number,
    partial: Partial<LogEntry>,
    triggerRest?: boolean
  ) {
    const key = logKey(exercise.id, setIndex);
    setLogState((prev) => {
      const prevEntry: LogEntry = prev[key] ?? {
        weight: "",
        reps: "",
        done: false,
      };
      const nextEntry: LogEntry = { ...prevEntry, ...partial };
      void saveLog(exercise, setIndex, nextEntry);
      return { ...prev, [key]: nextEntry };
    });

    if (triggerRest) {
      setRestActive(true);
      setRestSecondsLeft(60);
    }
  }

  useEffect(() => {
    if (!restActive || restSecondsLeft <= 0) return;

    const interval = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRestActive(false);
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(100);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restActive, restSecondsLeft]);

  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(null), 2500);
    return () => clearTimeout(t);
  }, [shareToast]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-foreground">
        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <div className="mx-auto h-10 w-40 rounded-full bg-zinc-900/80" />
          <p>Загружаем вашу тренировку...</p>
        </div>
        {/* Hidden share card render target */}
        {shareCardVisible && (
          <div
            className="pointer-events-none fixed left-[-10000px] top-0 opacity-0"
            aria-hidden
          >
            <div ref={shareCardRef}>
              <ShareCard
                date={new Date()}
                tonnageKg={finishStats?.tonnageKg ?? 0}
                exercisesDone={finishStats?.exercisesDone ?? 0}
                progress={
                  finishStats?.keyExercise &&
                  finishStats.keyExercise.currentMaxKg != null &&
                  finishStats.keyExercise.previousMaxKg != null
                    ? {
                        exerciseTitle: finishStats.keyExercise.title,
                        deltaKg:
                          finishStats.keyExercise.currentMaxKg -
                          finishStats.keyExercise.previousMaxKg,
                      }
                    : null
                }
                qrUrl="https://t.me/ai_strength_coach_bot"
              />
            </div>
          </div>
        )}

        {shareToast && (
          <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
            <div className="max-w-md rounded-full border border-zinc-800 bg-zinc-950/90 px-4 py-2 text-sm text-zinc-200 shadow-lg backdrop-blur">
              {shareToast}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-foreground">
        <div className="mx-auto max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-8 text-center">
          <p className="text-base font-medium text-zinc-100">
            Твой тренер ограничил доступ. Свяжись с ним для продления занятий.
          </p>
        </div>
      </div>
    );
  }

  // Paywall: доступ не оплачен
  if (profile && profile.is_paid !== true) {
    async function activateAccess() {
      if (!clientId) return;
      setActivatingAccess(true);
      const { error } = await supabase
        .from("profiles")
        .update({ is_paid: true })
        .eq("id", clientId);
      setActivatingAccess(false);
      if (error) {
        console.error("Ошибка активации доступа:", error);
        return;
      }
      setProfile((prev) => (prev ? { ...prev, is_paid: true } : null));
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.75 },
        colors: ["#eab308", "#facc15", "#fde047", "#fef08a", "#fef9c3"],
      });
    }

    const benefits = [
      "Персональный план",
      "Видео-инструкции",
      "Трекинг веса",
      "Связь с тренером",
    ];

    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-28">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Добро пожаловать
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Привет, {profile?.full_name || "атлет"}!
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeOrGoHome}
            className="size-10 shrink-0 rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
            aria-label="Выход"
          >
            <LogOut className="size-5" />
          </Button>
        </header>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl md:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 ring-1 ring-amber-400/30">
              <Sparkles className="h-7 w-7 text-amber-400/90" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Твой путь к результату начинается здесь
            </h2>
            <ul className="mt-8 flex w-full flex-col gap-4 text-left">
              {benefits.map((label, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400/90">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-zinc-200">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={activatingAccess}
              onClick={() => void activateAccess()}
              className="mt-10 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-6 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30 disabled:opacity-70"
            >
              {activatingAccess ? "Активация..." : "Активировать доступ"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Нет программы: с тренером — ждём программу; без тренера — своя тренировка + магазин
  if (!template || !todayDay) {
    if (hasTrainer === true) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-28">
          <header className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Привет, {profile?.full_name || "атлет"}!
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeOrGoHome}
              className="size-10 shrink-0 rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
              aria-label="Выход"
            >
              <LogOut className="size-5" />
            </Button>
          </header>
          {clientId && <WeightTracker clientId={clientId} />}
          <div className="flex min-h-[30vh] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center">
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-zinc-50">
                Жди программу от тренера
              </h1>
              <p className="text-sm text-zinc-400">
                Как только тренер назначит программу, она появится здесь.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Без тренера: график веса, создать свою тренировку, магазин программ
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-28">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Для себя
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Привет, {profile?.full_name || "атлет"}!
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeOrGoHome}
            className="size-10 shrink-0 rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
            aria-label="Выход"
          >
            <LogOut className="size-5" />
          </Button>
        </header>

        {clientId && <WeightTracker clientId={clientId} />}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">
            Создать свою тренировку
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Добавь упражнения и записывай подходы. График веса и история сохраняются.
          </p>
          <Button
            type="button"
            className="mt-4 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white"
            onClick={() => setShowAddExercise(true)}
          >
            <Plus className="mr-2 size-4" />
            Добавить упражнение
          </Button>
          {showAddExercise && (
            <div className="mt-4 space-y-2 rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-3">
              <p className="text-xs font-medium text-zinc-400">
                Выбери упражнение
              </p>
              <div className="flex flex-wrap gap-2">
                {ADDABLE_EXERCISES.filter(
                  (name) => !customExercises.some((e) => e.title === name)
                ).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
                    onClick={() => {
                      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                      const newEx: PlanExercise = {
                        id,
                        exercise_id: id,
                        title: name,
                        sets: "3",
                        reps: "10",
                        weight: "",
                        rpe: "",
                        rest: "60",
                      };
                      const next = [...customExercises, newEx];
                      setCustomExercises(next);
                      setTemplate(buildVirtualTemplate(next));
                      setShowAddExercise(false);
                    }}
                  >
                    + {name}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-zinc-400"
                onClick={() => setShowAddExercise(false)}
              >
                Закрыть
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">
            Популярные программы из магазина
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Готовые планы от экспертов — можно купить или получить бесплатно.
          </p>
          <div className="mt-4 grid gap-3">
            {MARKET_PROGRAMS.map((prog) => (
              <Link
                key={prog.id}
                href={`/client/${clientId}/program/${prog.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-700/80 bg-zinc-800/40 px-4 py-3 text-left transition hover:bg-zinc-800/70"
              >
                <span className="font-medium text-zinc-100">{prog.title}</span>
                <span
                  className={
                    prog.price === "Бесплатно"
                      ? "text-sm font-medium text-emerald-400"
                      : "text-sm text-zinc-400"
                  }
                >
                  {prog.price}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const firstExerciseTitle = todayDay.exercises[0]?.title ?? template.title;
  const isCustomWorkout = template.id === CUSTOM_TEMPLATE_ID;

  function removeCustomExercise(exerciseId: string) {
    const next = customExercises.filter((e) => e.id !== exerciseId);
    setCustomExercises(next);
    if (next.length > 0) {
      setTemplate(buildVirtualTemplate(next));
    } else {
      setTemplate(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-28">
        {/* Шапка: приветствие + выход */}
        <header className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              {isCustomWorkout ? "Своя тренировка" : "Сегодня"}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Привет, {profile?.full_name || "атлет"}!
            </h1>
            <p className="mt-0.5 truncate text-sm text-zinc-400">
              <span className="font-medium text-zinc-100">{firstExerciseTitle}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isCustomWorkout && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
                onClick={() => setShowAddExercise(true)}
              >
                <Plus className="mr-1 size-4" />
                Добавить
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeOrGoHome}
              className="size-10 rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
              aria-label="Выход"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>

        {/* Вес + аналитика */}
        {clientId && <WeightTracker clientId={clientId} />}

        {/* Добавить упражнение (своя тренировка) */}
        {isCustomWorkout && showAddExercise && (
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-4">
            <p className="text-xs font-medium text-zinc-400">Добавить упражнение</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADDABLE_EXERCISES.filter(
                (name) => !todayDay.exercises.some((e) => e.title === name)
              ).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
                  onClick={() => {
                    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const newEx: PlanExercise = {
                      id,
                      exercise_id: id,
                      title: name,
                      sets: "3",
                      reps: "10",
                      weight: "",
                      rpe: "",
                      rest: "60",
                    };
                    const next = [...customExercises, newEx];
                    setCustomExercises(next);
                    setTemplate(buildVirtualTemplate(next));
                    setShowAddExercise(false);
                  }}
                >
                  + {name}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 text-zinc-400"
              onClick={() => setShowAddExercise(false)}
            >
              Закрыть
            </Button>
          </div>
        )}

        {/* Список упражнений */}
        <section className="flex flex-col gap-4">
          {todayDay.exercises.map((exercise) => {
            const setCount = parseSetCount(exercise);
            const setsArray = Array.from({ length: setCount }, (_, i) => i + 1);

            const youtubeEmbed = exercise.video_url
              ? getYouTubeEmbedUrl(exercise.video_url)
              : null;
            const showVideo = expandedVideoId === exercise.id;

            return (
              <Card
                key={exercise.id}
                className="border border-border/70 bg-zinc-950/80 px-3 py-2"
              >
                <CardHeader className="space-y-1 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-semibold text-zinc-50">
                        {exercise.title}
                      </CardTitle>
                      {exercise.muscle_group && (
                        <p className="text-xs text-zinc-500">{exercise.muscle_group}</p>
                      )}
                      <p className="text-[11px] text-zinc-500">
                        {exercise.sets && exercise.reps
                          ? `${exercise.sets} подходов · ${exercise.reps} повторений`
                          : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                    {exercise.video_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setExpandedVideoId(showVideo ? null : exercise.id)
                        }
                        className="size-9 rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                        aria-label={showVideo ? "Свернуть видео" : "Смотреть видео"}
                      >
                        {showVideo ? (
                          <X className="size-4" />
                        ) : (
                          <Play className="size-4" />
                        )}
                      </Button>
                    )}
                    {isCustomWorkout && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomExercise(exercise.id)}
                        className="size-9 rounded-full bg-zinc-800/80 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                        aria-label="Удалить упражнение"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  </div>
                </CardHeader>
                {showVideo && exercise.video_url && (
                  <div className="mb-3 w-full overflow-hidden rounded-xl bg-black">
                    <div className="relative aspect-video w-full">
                      {youtubeEmbed ? (
                        <iframe
                          src={youtubeEmbed}
                          title={`Видео: ${exercise.title}`}
                          className="absolute inset-0 h-full w-full rounded-xl"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <iframe
                          src={exercise.video_url}
                          title={`Видео: ${exercise.title}`}
                          className="absolute inset-0 h-full w-full rounded-xl"
                          allowFullScreen
                        />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedVideoId(null)}
                      className="mt-2 w-full rounded-full text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      Свернуть видео
                    </Button>
                  </div>
                )}
                <CardContent className="space-y-2 pb-3">
                  {(() => {
                    const eid = exercise.exercise_id ?? exercise.id;
                    const last = lastResultByExerciseId[eid];
                    if (!last) return null;
                    const w =
                      last.weight != null ? `${last.weight} кг` : "— кг";
                    const r = last.reps ?? "—";
                    return (
                      <p className="text-[11px] text-zinc-500">
                        В прошлый раз: {w} x {r}
                      </p>
                    );
                  })()}
                  {setsArray.map((index) => {
                    const key = logKey(exercise.id, index);
                    const entry = logState[key] ?? {
                      weight: "",
                      reps: "",
                      done: false,
                    };

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                          entry.done
                            ? "border-emerald-500/80 bg-emerald-500/10"
                            : "border-border/60 bg-zinc-950/60"
                        }`}
                      >
                        <div className="w-10 text-[11px] font-medium text-zinc-400">
                          Set {index}
                        </div>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="flex flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Input
                                value={entry.weight}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateSet(exercise, index, {
                                    weight: e.target.value,
                                  })
                                }
                                inputMode="decimal"
                                className="h-9 w-20 rounded-xl border-border/60 bg-zinc-900/90 text-[11px]"
                                placeholder="Вес"
                              />
                              <Input
                                value={entry.reps}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateSet(exercise, index, {
                                    reps: e.target.value,
                                  })
                                }
                                inputMode="numeric"
                                className="h-9 w-16 rounded-xl border-border/60 bg-zinc-900/90 text-[11px]"
                                placeholder="Повт."
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className={`h-9 rounded-full px-4 text-[11px] font-semibold ${
                            entry.done
                              ? "bg-emerald-500 text-black hover:bg-emerald-400"
                              : "bg-zinc-100 text-black hover:bg-white"
                          }`}
                          onClick={() =>
                            updateSet(
                              exercise,
                              index,
                              { done: !entry.done },
                              !entry.done
                            )
                          }
                        >
                          {entry.done ? "Done" : "Go"}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Кнопка завершения тренировки (только при программе от тренера) */}
        {!isCustomWorkout && (
        <section className="mt-2">
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="h-12 w-full rounded-full bg-emerald-500 text-sm font-semibold text-black shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={finishSending === "sending"}
              onClick={async () => {
                if (!clientId) return;
                try {
                  setFinishSending("sending");
                  const stats = await computeFinishStats();
                  setFinishStats(stats);
                  const res = await fetch("/api/notify-complete", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ clientId }),
                  });
                  if (!res.ok) {
                    console.error("Не удалось отправить уведомление тренеру");
                    setFinishSending("idle");
                    return;
                  }
                  setFinishSending("done");
                  setTimeout(() => setFinishSending("idle"), 2000);
                } catch (e) {
                  console.error("Ошибка при завершении тренировки:", e);
                  setFinishSending("idle");
                }
              }}
            >
              {finishSending === "sending"
                ? "Отправляем..."
                : finishSending === "done"
                ? "Отправлено!"
                : "Завершить тренировку"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full border-zinc-700 bg-zinc-950/30 text-sm font-semibold text-zinc-100 hover:bg-zinc-900/60"
              disabled={shareGenerating}
              onClick={() => void shareResult()}
            >
              Поделиться результатом 🚀
            </Button>
          </div>
        </section>
        )}

        {/* Таймер отдыха */}
        {restActive && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-6">
            <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-3xl border border-border/60 bg-zinc-950/95 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Отдых
                </p>
                <p className="text-lg font-semibold text-zinc-50">
                  {restSecondsLeft}s
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-4 text-[11px] text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setRestActive(false);
                  setRestSecondsLeft(0);
                }}
              >
                Пропустить
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
