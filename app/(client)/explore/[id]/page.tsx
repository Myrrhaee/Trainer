"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Dumbbell, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabase = createClient();

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

type Program = {
  id: string;
  title: string;
  description: string | null;
  plan_json: PlanJson | null;
  weeks: number | null;
  price: number | null;
  trainer_id: string | null;
  cover_url: string | null;
};

export default function ExploreProgramPage() {
  const params = useParams<{ id: string }>();
  const programId = params?.id;

  const [program, setProgram] = useState<Program | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      return;
    }

    async function load() {
      const { data: template, error } = await supabase
        .from("workout_templates")
        .select("id, title, description, plan_json, weeks, price, trainer_id, cover_url")
        .eq("id", programId)
        .eq("is_public", true)
        .single();

      if (error || !template) {
        setProgram(null);
        setLoading(false);
        return;
      }

      setProgram(template as Program);

      if ((template as Program).trainer_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", (template as Program).trainer_id)
          .single();
        setAuthorName(profile?.full_name ?? null);
      }

      setLoading(false);
    }

    load();
  }, [programId]);

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    }
    getUser();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const firstDayExercises = (() => {
    if (!program?.plan_json?.weeks?.length) return [];
    const firstWeek = program.plan_json.weeks[0];
    const firstDay = firstWeek?.days?.[0];
    return firstDay?.exercises ?? [];
  })();

  const otherDaysCount = (() => {
    if (!program?.plan_json?.weeks?.length) return 0;
    let total = 0;
    for (const w of program.plan_json.weeks) {
      const days = w?.days ?? [];
      total += days.length;
    }
    return Math.max(0, total - 1);
  })();

  const isFree = program?.price == null || program.price === 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
        <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-800/80" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-800/60" />
        <div className="mt-6 space-y-2">
          <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-800/60" />
          <div className="h-4 w-full animate-pulse rounded bg-zinc-800/40" />
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
        <Button asChild variant="ghost" size="sm" className="mb-6 text-zinc-400">
          <Link href="/explore" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>
        </Button>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <p className="text-zinc-400">Программа не найдена или недоступна.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-6 rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
      >
        <Link href="/explore" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Назад в каталог
        </Link>
      </Button>

      {/* Hero */}
      <header className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
        <div className="relative aspect-[2/1] w-full sm:aspect-[21/9]">
          {program.cover_url?.trim() ? (
            <img
              src={program.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
          )}
        </div>
        <div className="border-t border-zinc-800 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {program.title}
          </h1>
          {authorName && (
            <p className="mt-1 text-sm text-zinc-500">{authorName}</p>
          )}
          {program.description?.trim() && (
            <p className="mt-4 whitespace-pre-wrap text-zinc-400">
              {program.description}
            </p>
          )}
        </div>
      </header>

      {/* Что внутри */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-50">Что внутри</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Первый день программы — превью. Остальное откроется после покупки.
        </p>

        <ul className="mt-4 space-y-2">
          {firstDayExercises.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              <Dumbbell className="h-5 w-5 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-200">{ex.title}</span>
                {(ex.sets || ex.reps) && (
                  <span className="ml-2 text-sm text-zinc-500">
                    {[ex.sets, ex.reps].filter(Boolean).join(" × ")}
                  </span>
                )}
              </div>
            </li>
          ))}
          {Array.from({ length: otherDaysCount }, (_, i) => (
            <li
              key={`locked-${i}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3"
            >
              <Lock className="h-5 w-5 shrink-0 text-zinc-500" />
              <span className="text-zinc-500">
                День {i + 2}: Доступно после покупки
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Кнопка действия */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        {isFree ? (
          <Button
            asChild
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
          >
            <Link
              href={
                userId
                  ? `/client/${userId}/program/${program.id}`
                  : "/login?redirect=/explore"
              }
            >
              Добавить в мой профиль
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            className="rounded-full bg-zinc-100 px-6 py-3 font-medium text-black hover:bg-white"
            onClick={() => setToastMessage("Модуль оплаты подключается")}
          >
            {program.price != null && program.price > 0
              ? `Купить за ${program.price.toLocaleString("ru-RU")} ₽`
              : "Купить программу"}
          </Button>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full",
            "border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 shadow-lg"
          )}
          role="status"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
