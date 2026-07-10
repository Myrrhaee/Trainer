"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Globe,
  Layers3,
  Plus,
  ShoppingBag,
  Sparkles,
  Target,
} from "lucide-react";

import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import {
  createSafeId,
  formatSupabaseError,
  isSupabaseSchemaMismatch,
  logSupabaseError,
} from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { DemoProgramsPage } from "@/components/demo/demo-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const supabase = createClient();

type Program = {
  id: string;
  title: string;
  weeks: number | null;
  price: number | null;
  is_public?: boolean | null;
  goal?: string | null;
  description?: string | null;
  cover_url?: string | null;
};

type QueryResult<T> = {
  data: T;
  error: unknown;
};

function formatMoney(value: number | null | undefined) {
  if (value == null || value <= 0) return "Бесплатно";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function goalLabel(goal: string | null | undefined) {
  switch (goal) {
    case "weight_loss":
      return "Похудение";
    case "muscle_gain":
      return "Набор массы";
    case "strength":
      return "Сила";
    case "endurance":
      return "Выносливость";
    default:
      return "Универсальная";
  }
}

async function loadProgramsForTrainer(trainerId: string): Promise<QueryResult<Program[]>> {
  const fullRes = await supabase
    .from("workout_templates")
    .select("id, title, weeks, price, is_public, goal, description, cover_url")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as Program[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title, weeks, price, is_public, description, cover_url")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  return {
    data: ((fallbackRes.data ?? []) as Array<{
      id: string;
      title: string;
      weeks?: number | null;
      price?: number | null;
      is_public?: boolean | null;
      description?: string | null;
      cover_url?: string | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      weeks: row.weeks ?? null,
      price: row.price ?? null,
      is_public: row.is_public ?? null,
      goal: null,
      description: row.description ?? null,
      cover_url: row.cover_url ?? null,
    })),
    error: fallbackRes.error,
  };
}

export default function ProgramsPage() {
  if (isDemoModeEnabled()) {
    return <DemoProgramsPage />;
  }

  return <ProgramsSupabasePage />;
}

function ProgramsSupabasePage() {
  const { trainerId } = useTrainer();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!trainerId) return;
    const currentTrainerId = trainerId;
    let cancelled = false;

    async function loadPrograms() {
      setLoading(true);

      const { data, error } = await loadProgramsForTrainer(currentTrainerId);

      if (cancelled) return;

      if (error) {
        logSupabaseError("programs load failed", error);
        setPrograms([]);
      } else {
        setPrograms((data ?? []) as Program[]);
      }

      setLoading(false);
    }

    void loadPrograms();
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  const summary = useMemo(() => {
    const publicPrograms = programs.filter((program) => program.is_public);
    const paidPrograms = programs.filter((program) => (program.price ?? 0) > 0);
    const avgWeeks =
      programs.length > 0
        ? programs.reduce((sum, program) => sum + (program.weeks ?? 0), 0) / programs.length
        : 0;

    return {
      total: programs.length,
      publicCount: publicPrograms.length,
      paidCount: paidPrograms.length,
      avgWeeks,
    };
  }, [programs]);

  async function handleCreateProgram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !trainerId) return;

    setCreating(true);

    const weekId = createSafeId();
    const dayId = createSafeId();
    const initialPlanJson = {
      weeks: [
        {
          id: weekId,
          name: "Неделя 1",
          days: [{ id: dayId, name: "День 1", exercises: [] }],
        },
      ],
    };

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setCreating(false);
      logSupabaseError("create program session failed", sessionError ?? new Error("no session"));
      alert("Сессия истекла. Перезайди в аккаунт и попробуй снова.");
      return;
    }

    const response = await fetch("/api/trainer/programs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title: title.trim(),
        isPublic,
        planJson: initialPlanJson,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      program?: Program;
    };

    setCreating(false);

    if (!response.ok || !result.program) {
      logSupabaseError("create program failed", result.error ?? new Error("empty response"));
      alert(
        `Не удалось создать программу.\n\n${
          result.error ? formatSupabaseError({ message: result.error }) : "Пустой ответ от сервера"
        }`
      );
      return;
    }

    setPrograms((prev) => [result.program as Program, ...prev]);
    setDialogOpen(false);
    setTitle("");
    setIsPublic(false);
    router.push(`/dashboard/programs/${result.program.id}`);
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Program lab
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
                    Программы
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    Здесь собираются ваши продукты: персональные программы, шаблоны и публичные
                    предложения для продаж. Экран задуман как витрина и операционная панель сразу.
                  </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-zinc-100 px-5 text-black hover:bg-white">
                      <Plus className="mr-2 h-4 w-4" />
                      Создать программу
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md border border-zinc-800 bg-zinc-950/95 text-zinc-100">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-zinc-50">
                        Новая программа
                      </DialogTitle>
                      <DialogDescription className="text-zinc-400">
                        Начните с названия, а структуру, обложку и витрину донастроите на следующем
                        экране.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateProgram} className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="program-title" className="text-zinc-300">
                          Название
                        </Label>
                        <Input
                          id="program-title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="Например, Strength Block 8 weeks"
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-900/80"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">Сразу вывести в витрину</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Подойдёт, если вы создаёте продукт на продажу, а не только для клиента.
                          </p>
                        </div>
                        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                      </div>
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={creating || !title.trim()}
                          className="rounded-full bg-zinc-100 text-black hover:bg-white disabled:opacity-60"
                        >
                          {creating ? "Создание..." : "Продолжить"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SummaryCard label="Всего программ" value={String(summary.total)} icon={<Layers3 className="h-4 w-4" />} />
                <SummaryCard label="В продаже" value={String(summary.publicCount)} icon={<ShoppingBag className="h-4 w-4" />} />
                <SummaryCard
                  label="Средняя длина"
                  value={summary.total > 0 ? `${summary.avgWeeks.toFixed(1)} нед.` : "—"}
                  icon={<Target className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Срез продукта</CardTitle>
              <CardDescription className="text-zinc-400">
                Быстро понять, что уже можно продавать, а что ещё в работе.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <InsightRow
                label="Платные программы"
                value={String(summary.paidCount)}
                hint="Прямой доход"
              />
              <InsightRow
                label="Бесплатные лид-магниты"
                value={String(Math.max(0, summary.publicCount - summary.paidCount))}
                hint="Вход в воронку"
              />
              <InsightRow
                label="Черновики / private"
                value={String(Math.max(0, summary.total - summary.publicCount))}
                hint="Под клиентов"
              />
            </CardContent>
          </Card>
        </section>

        <section>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ProgramSkeleton />
              <ProgramSkeleton />
              <ProgramSkeleton />
            </div>
          ) : programs.length === 0 ? (
            <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
              <CardContent className="p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="mt-4 text-lg font-semibold text-zinc-100">Пока нет ни одной программы</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  Создайте первую структуру, чтобы потом использовать её как живой поток тренировок,
                  шаблон или товар для витрины.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/programs/${program.id}`)}
                  className="text-left"
                >
                  <Card className="group h-full rounded-[2rem] border-zinc-800/80 bg-zinc-950/90 transition hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900/90">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="relative overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,rgba(39,39,42,0.75),rgba(9,9,11,0.95))] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              {goalLabel(program.goal)}
                            </p>
                            <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
                              {program.title}
                            </h2>
                          </div>
                          <Badge
                            className={
                              program.is_public
                                ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
                            }
                          >
                            {program.is_public ? (
                              <>
                                <Globe className="mr-1.5 h-3.5 w-3.5" />
                                Public
                              </>
                            ) : (
                              "Private"
                            )}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-zinc-400">
                          {program.description?.trim() || "Описание и позиционирование можно уточнить в редакторе программы."}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-zinc-400">
                        <ProgramMeta label="Длина" value={program.weeks ? `${program.weeks} недель` : "Не задана"} />
                        <ProgramMeta label="Цена" value={formatMoney(program.price)} />
                        <ProgramMeta label="Формат" value={program.is_public ? "Витрина / продажи" : "Внутренний поток"} />
                      </div>

                      <div className="mt-5 flex items-center justify-between pt-2 text-sm font-medium text-zinc-200">
                        <span>Открыть редактор</span>
                        <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:text-zinc-100" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <div className="text-zinc-500">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

function InsightRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <p className="mt-1 text-xs text-zinc-500">{hint}</p>
        </div>
        <span className="text-xl font-semibold text-zinc-50">{value}</span>
      </div>
    </div>
  );
}

function ProgramMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-full border border-zinc-800 bg-black/20 px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function ProgramSkeleton() {
  return (
    <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
      <CardContent className="p-5">
        <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="h-3 w-24 rounded-full bg-zinc-800" />
          <div className="mt-3 h-6 w-40 rounded-full bg-zinc-800" />
          <div className="mt-4 h-3 w-full rounded-full bg-zinc-900" />
          <div className="mt-2 h-3 w-3/4 rounded-full bg-zinc-900" />
        </div>
        <div className="mt-4 h-10 rounded-full bg-zinc-900" />
        <div className="mt-2 h-10 rounded-full bg-zinc-900" />
        <div className="mt-2 h-10 rounded-full bg-zinc-900" />
      </CardContent>
    </Card>
  );
}
