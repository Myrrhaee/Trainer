"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, Lock, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const supabase = createClient();

const CATEGORIES = ["Все", "Похудение", "Набор массы", "Сила", "Для дома"] as const;

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Новичок",
  intermediate: "Средний",
  advanced: "Профи",
};

type PlanExercise = {
  id: string;
  title: string;
  muscle_group?: string | null;
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

type ProgramRow = {
  id: string;
  title: string;
  plan_json: PlanJson | null;
  weeks: number | null;
  price: number | null;
  trainer_id: string | null;
  cover_url?: string | null;
  difficulty?: string | null;
  goal?: string | null;
};

type ProgramWithAuthor = ProgramRow & {
  authorName: string | null;
  goalLabel: string;
  difficultyLabel: string;
};

function getMockGoal(index: number): string {
  const g = ["Похудение", "Набор массы", "Сила", "Для дома"];
  return g[index % 4];
}

function getDifficultyLabel(d: string | null | undefined): string {
  if (!d) return "Средний";
  return DIFFICULTY_LABELS[d] ?? d;
}

export default function ExplorePage() {
  const [programs, setPrograms] = useState<ProgramWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("Все");
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithAuthor | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: templates, error } = await supabase
        .from("workout_templates")
        .select("id, title, plan_json, weeks, price, trainer_id, cover_url, difficulty, goal")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error || !templates?.length) {
        setPrograms([]);
        setLoading(false);
        return;
      }

      const rows = templates as ProgramRow[];
      const trainerIds = [...new Set(rows.map((r) => r.trainer_id).filter(Boolean))] as string[];

      let authorMap: Record<string, string | null> = {};
      if (trainerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", trainerIds);
        if (profiles) {
          authorMap = Object.fromEntries(
            profiles.map((p: { id: string; full_name: string | null }) => [
              p.id,
              p.full_name ?? null,
            ])
          );
        }
      }

      const withAuthor: ProgramWithAuthor[] = rows.map((r, i) => {
        const goalFromDb = r.goal ?? getMockGoal(i);
        const goalLabel =
          goalFromDb === "weight_loss"
            ? "Похудение"
            : goalFromDb === "muscle_gain"
              ? "Набор массы"
              : goalFromDb === "strength"
                ? "Сила"
                : goalFromDb === "home" || goalFromDb === "Для дома"
                  ? "Для дома"
                  : goalFromDb;
        return {
          ...r,
          authorName: r.trainer_id ? authorMap[r.trainer_id] ?? null : null,
          goalLabel,
          difficultyLabel: getDifficultyLabel(r.difficulty),
        };
      });

      setPrograms(withAuthor);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    }
    getUser();
  }, []);

  const filtered = useMemo(() => {
    if (filterCategory === "Все") return programs;
    return programs.filter((p) => p.goalLabel === filterCategory);
  }, [programs, filterCategory]);

  const firstDayExercises = useMemo(() => {
    if (!selectedProgram?.plan_json?.weeks?.length) return [];
    const firstWeek = selectedProgram.plan_json.weeks[0];
    const firstDay = firstWeek?.days?.[0];
    return firstDay?.exercises ?? [];
  }, [selectedProgram]);

  const hasLockedContent = useMemo(() => {
    if (!selectedProgram?.plan_json?.weeks?.length) return false;
    const weeks = selectedProgram.plan_json.weeks;
    if (weeks.length > 1) return true;
    const firstWeek = weeks[0];
    const days = firstWeek?.days ?? [];
    return days.length > 1;
  }, [selectedProgram]);

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 md:text-5xl">
          Исследуй программы
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Планы тренировок от экспертов для любого уровня.
        </p>
      </header>

      {/* Scrolling filter chips */}
      <section className="mb-8 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none md:flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition whitespace-nowrap",
                filterCategory === cat
                  ? "border-zinc-100 bg-zinc-100 text-black"
                  : "border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/80"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
              <div className="h-40 animate-pulse bg-zinc-800/80" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800/80" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-800/80" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800/60" />
                <div className="mt-auto flex justify-end">
                  <div className="h-4 w-14 animate-pulse rounded bg-zinc-800/60" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 py-20 text-center">
          <p className="text-zinc-400">
            {filterCategory === "Все" ? "Программ пока нет." : "По выбранной категории программ нет."}
          </p>
          {filterCategory !== "Все" && (
            <Button
              variant="outline"
              className="mt-4 rounded-full border-zinc-600"
              onClick={() => setFilterCategory("Все")}
            >
              Показать все
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => setSelectedProgram(program)}
              className="group text-left transition-transform duration-200 hover:scale-[1.02]"
            >
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
                {/* Cover: image or gradient */}
                <div className="relative h-40 w-full overflow-hidden">
                  {program.cover_url?.trim() ? (
                    <img
                      src={program.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge className="rounded-full border-0 bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-zinc-200 backdrop-blur-sm">
                      {program.difficultyLabel}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="line-clamp-2 font-semibold text-zinc-50">
                    {program.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {program.authorName ?? "Тренер"}
                  </p>
                  <div className="mt-auto flex items-center justify-end gap-1 pt-3">
                    <span className="text-sm font-medium text-zinc-200">
                      {program.price != null && program.price > 0
                        ? `${program.price.toLocaleString("ru-RU")} ₽`
                        : "Бесплатно"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                  </div>
                </div>
              </article>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog
        open={!!selectedProgram}
        onOpenChange={(open) => !open && setSelectedProgram(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden border-zinc-800 bg-zinc-950 p-0 relative">
          <button
            type="button"
            onClick={() => setSelectedProgram(null)}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
          {selectedProgram && (
            <>
              <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-800/90 to-amber-950/40">
                <Sparkles className="h-12 w-12 text-amber-400/60" />
              </div>
              <div className="flex flex-col gap-4 overflow-y-auto p-6">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <DialogTitle className="text-xl text-zinc-50">
                        {selectedProgram.title}
                      </DialogTitle>
                      <DialogDescription className="mt-1 text-sm text-zinc-400">
                        {selectedProgram.authorName ?? "Тренер"} · {selectedProgram.weeks ?? "—"} нед.
                      </DialogDescription>
                    </div>
                    <Badge className="shrink-0 rounded-full bg-zinc-800 text-zinc-300">
                      {selectedProgram.difficultyLabel}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Первая тренировка (превью)
                  </p>
                  <ul className="space-y-2">
                    {firstDayExercises.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200"
                      >
                        <Dumbbell className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span>{ex.title}</span>
                        {(ex.sets || ex.reps) && (
                          <span className="ml-auto text-xs text-zinc-500">
                            {[ex.sets, ex.reps].filter(Boolean).join(" × ")}
                          </span>
                        )}
                      </li>
                    ))}
                    {firstDayExercises.length === 0 && (
                      <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-500">
                        Упражнения не указаны
                      </li>
                    )}
                  </ul>

                  {hasLockedContent && (
                    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
                      <div className="blur-sm select-none">
                        <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
                          <Lock className="h-4 w-4" />
                          <span>Ещё тренировки и дни</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Lock className="h-6 w-6 text-zinc-500" />
                          <span className="text-xs font-medium text-zinc-400">
                            Доступно после покупки
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t border-zinc-800 bg-zinc-900/30 p-4">
                {selectedProgram.price != null && selectedProgram.price > 0 ? (
                  <Button
                    asChild
                    className="w-full rounded-full bg-zinc-100 py-3 font-medium text-black hover:bg-white"
                  >
                    <Link
                      href={
                        userId
                          ? `/client/${userId}/program/${selectedProgram.id}`
                          : `/login?redirect=/explore`
                      }
                    >
                      Купить доступ
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="w-full rounded-full bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500"
                  >
                    <Link
                      href={
                        userId
                          ? `/client/${userId}/program/${selectedProgram.id}`
                          : `/login?redirect=/explore`
                      }
                    >
                      Добавить в мои тренировки
                    </Link>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
