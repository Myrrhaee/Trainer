"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  TrendingUp,
  Library,
  BellRing,
  Dumbbell,
  Timer,
  History,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";

type HeroTab = "client" | "trainer";

const PROGRAMS = [
  { title: "Мощный верх", price: "990 ₽", tag: "Сила" },
  { title: "Жиросжигание за 30 дней", price: "Бесплатно", tag: "Похудение" },
  { title: "База для набора массы", price: "1 490 ₽", tag: "Масса" },
  { title: "Функциональный кор", price: "Бесплатно", tag: "Кор" },
  { title: "Силовые ноги", price: "790 ₽", tag: "Ноги" },
  { title: "Выносливость 8 недель", price: "1 290 ₽", tag: "Кардио" },
];

function useInView(once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
        else if (!once) setVisible(false);
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [once]);

  return { ref, visible };
}

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0",
        className
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const [heroTab, setHeroTab] = useState<HeroTab>("client");
  const [cabinetHref, setCabinetHref] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setCabinetHref(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = (data as { role?: string | null } | null)?.role ?? null;
      const href = role === "trainer" ? "/trainer/dashboard" : "/client/dashboard";
      if (!cancelled) setCabinetHref(href);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen font-sans text-zinc-100">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-800/60 bg-black/50 px-6 py-3 backdrop-blur-md md:px-12">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-zinc-100/90 text-black">
              ⚡️
            </span>
            AI Strength Coach
          </Link>

          {cabinetHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-zinc-700 bg-zinc-950/30 text-zinc-100 hover:bg-zinc-900/60"
            >
              <Link href={cabinetHref}>В кабинет</Link>
            </Button>
          )}
          {!cabinetHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-zinc-700 bg-zinc-950/30 text-zinc-100 hover:bg-zinc-900/60"
            >
              <Link href="/login">Войти</Link>
            </Button>
          )}
        </div>
      </header>
      {/* Hero with tabs */}
      <section className="relative overflow-hidden px-6 pt-24 pb-32 md:px-12 md:pt-32 md:pb-44">
        {/* Subtle gradient background - можно заменить на фото атлета */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(39,39,42,0.4),transparent)]" />
        <div className="mx-auto max-w-4xl text-center relative">
          <FadeIn>
            <div className="inline-flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-900/80 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setHeroTab("client")}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                  heroTab === "client"
                    ? "bg-zinc-100 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Для себя
              </button>
              <button
                type="button"
                onClick={() => setHeroTab("trainer")}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                  heroTab === "trainer"
                    ? "bg-zinc-100 text-black shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Для тренеров
              </button>
            </div>
          </FadeIn>

          {heroTab === "client" ? (
            <>
              <FadeIn delay={100}>
                <h1 className="mt-10 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                  Твой прогресс под контролем
                </h1>
              </FadeIn>
              <FadeIn delay={200}>
                <p className="mt-6 max-w-2xl mx-auto text-lg text-zinc-400 md:text-xl leading-relaxed">
                  Тренируйся по своим программам или выбирай планы от лучших экспертов.
                  Бесплатный дневник тренировок и аналитика веса.
                </p>
              </FadeIn>
            </>
          ) : (
            <>
              <FadeIn delay={100}>
                <h1 className="mt-10 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                  Твой AI-Strength Coach в кармане
                </h1>
              </FadeIn>
              <FadeIn delay={200}>
                <p className="mt-6 max-w-2xl mx-auto text-lg text-zinc-400 md:text-xl leading-relaxed">
                  Профессиональная CRM для тренеров: следите за прогрессом клиентов,
                  напоминайте о тренировках и считайте доход в одном месте.
                </p>
              </FadeIn>
            </>
          )}

          <FadeIn delay={300}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-zinc-100 px-8 py-6 text-base font-medium text-black hover:bg-white transition shadow-lg"
              >
                <Link href="/login?role=client">Начать тренироваться бесплатно</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-zinc-600 px-8 py-6 text-base font-medium text-zinc-100 hover:bg-zinc-800/80 hover:text-white transition"
              >
                <Link href="/login?role=trainer">Создать кабинет тренера</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Visual: Mockups (unchanged, works for both) */}
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex flex-col items-center justify-center gap-12 md:flex-row md:gap-16">
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-zinc-500">Dashboard тренера</p>
                <div className="relative rounded-[2.5rem] border-[10px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-950/80">
                  <div className="h-[12px] w-[12px] absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-700" />
                  <div className="h-[480px] w-[260px] overflow-hidden rounded-[1.75rem] bg-zinc-950">
                    <div className="flex h-full flex-col p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">Trainer</span>
                        <div className="h-6 w-12 rounded-full bg-zinc-800" />
                      </div>
                      <div className="mb-4 grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-zinc-800/80 p-2 text-center"
                          >
                            <div className="text-[10px] text-zinc-500">Карточка</div>
                            <div className="text-sm font-semibold text-zinc-200">—</div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 flex-1">
                        {["Клиент 1", "Клиент 2", "Клиент 3"].map((label, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-xl bg-zinc-800/60 px-3 py-2"
                          >
                            <div className="h-8 w-8 rounded-full bg-zinc-700" />
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-zinc-200">
                                {label}
                              </div>
                              <div className="text-[9px] text-zinc-500">Активность</div>
                            </div>
                            <BellRing className="h-3.5 w-3.5 text-zinc-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-zinc-500">Приложение клиента</p>
                <div className="relative rounded-[2.5rem] border-[10px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-950/80">
                  <div className="h-[12px] w-[12px] absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-700" />
                  <div className="h-[480px] w-[260px] overflow-hidden rounded-[1.75rem] bg-zinc-950">
                    <div className="flex h-full flex-col p-4">
                      <div className="mb-4 text-center">
                        <span className="text-xs font-semibold text-zinc-100">
                          Моя программа
                        </span>
                      </div>
                      <div className="mb-3 h-20 rounded-xl bg-zinc-800/80 flex items-center justify-center gap-2">
                        <Dumbbell className="h-5 w-5 text-zinc-500" />
                        <span className="text-[11px] text-zinc-400">Тренировка дня</span>
                      </div>
                      <div className="space-y-2 flex-1">
                        {["Упражнение 1", "Упражнение 2", "Записать вес"].map(
                          (label, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-zinc-700/80 px-3 py-2 text-[11px] text-zinc-300"
                            >
                              {label}
                            </div>
                          )
                        )}
                      </div>
                      <div className="mt-4 h-8 rounded-full bg-zinc-100/90 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-black">
                          Отметить выполненным
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Маркетплейс программ */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Маркетплейс программ
            </h2>
            <p className="mt-3 text-center text-zinc-400 max-w-xl mx-auto">
              Готовые планы от экспертов — от силы до жиросжигания
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROGRAMS.map((program, i) => (
                <div
                  key={i}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-zinc-700 hover:bg-zinc-800/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 group-hover:bg-amber-500/20 group-hover:text-amber-400">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {program.tag}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                    {program.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-3 text-sm font-semibold",
                      program.price === "Бесплатно"
                        ? "text-emerald-400"
                        : "text-zinc-200"
                    )}
                  >
                    {program.price}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Преимущества для атлета */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Преимущества для атлета
            </h2>
          </FadeIn>
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            <FadeIn delay={0}>
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <Timer className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">
                  Чистый трекер
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Ничего лишнего — только твои подходы и таймер отдыха.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <History className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">
                  История в кармане
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Все прошлые веса и графики всегда под рукой.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <UserPlus className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">
                  Прямая связь
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Легко привяжи своего тренера, если решишь перейти на новый уровень.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Features для тренеров (CRM, доход, библиотека) */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Для тренеров
            </h2>
          </FadeIn>
          <div className="mt-16 grid gap-16 md:grid-cols-3 md:gap-8">
            <FadeIn delay={0}>
              <div className="flex flex-col items-start text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
                  Умная CRM
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Автоматический поиск «прогульщиков» и быстрая связь в Telegram.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <div className="flex flex-col items-start text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
                  Трекер прогресса и доход
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Графики веса и объёмов, аналитика выручки и прогноз.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="flex flex-col items-start text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300">
                  <Library className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
                  Библиотека
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Своя база упражнений с видео и шаблонами программ.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <FadeIn>
          <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-12 md:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Начни уже сегодня
            </h2>
            <p className="mt-4 text-zinc-400">
              Тренируйся по своим планам бесплатно или создай кабинет и веди клиентов.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-zinc-100 px-8 py-6 text-base font-medium text-black hover:bg-white transition"
              >
                <Link href="/login?role=client">Начать тренироваться бесплатно</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-zinc-600 px-8 py-6 text-base font-medium text-zinc-100 hover:bg-zinc-800/80 hover:text-white transition"
              >
                <Link href="/login?role=trainer">Создать кабинет тренера</Link>
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>

      <footer className="h-24" />
    </div>
  );
}
