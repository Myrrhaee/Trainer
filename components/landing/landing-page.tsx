"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  TrendingUp,
  Library,
  BellRing,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-32 md:px-12 md:pt-32 md:pb-44">
        <div className="mx-auto max-w-4xl text-center">
          <FadeIn>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
              Твой AI-Strength Coach в кармане
            </h1>
          </FadeIn>
          <FadeIn delay={100}>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-zinc-400 md:text-xl leading-relaxed">
              Профессиональный софт для тренеров, который сам следит за прогрессом
              клиентов и напоминает о тренировках.
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <Button
              asChild
              size="lg"
              className="mt-10 rounded-full bg-zinc-100 px-8 py-6 text-base font-medium text-black hover:bg-white transition shadow-lg"
            >
              <Link href="/login">Попробовать бесплатно</Link>
            </Button>
          </FadeIn>
        </div>
      </section>

      {/* Visual: Mockups */}
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex flex-col items-center justify-center gap-12 md:flex-row md:gap-16">
              {/* iPhone mockup - Dashboard */}
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-zinc-500">
                  Dashboard тренера
                </p>
                <div className="relative rounded-[2.5rem] border-[10px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-950/80">
                  <div className="h-[12px] w-[12px] absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-700" />
                  <div className="h-[480px] w-[260px] overflow-hidden rounded-[1.75rem] bg-zinc-950">
                    <div className="flex h-full flex-col p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100">
                          Trainer
                        </span>
                        <div className="h-6 w-12 rounded-full bg-zinc-800" />
                      </div>
                      <div className="mb-4 grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-zinc-800/80 p-2 text-center"
                          >
                            <div className="text-[10px] text-zinc-500">
                              Карточка
                            </div>
                            <div className="text-sm font-semibold text-zinc-200">
                              —
                            </div>
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
                              <div className="text-[9px] text-zinc-500">
                                Активность
                              </div>
                            </div>
                            <BellRing className="h-3.5 w-3.5 text-zinc-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* iPhone mockup - Client app */}
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-zinc-500">
                  Приложение клиента
                </p>
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
                        <span className="text-[11px] text-zinc-400">
                          Тренировка дня
                        </span>
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

      {/* Features */}
      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 md:grid-cols-3 md:gap-8">
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
                  Трекер прогресса
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Красивые графики веса и объёмов в стиле Apple Health.
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
          <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-12 md:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
              Начни вести клиентов по-новому
            </h2>
            <p className="mt-4 text-zinc-400">
              Регистрируйся и подключай первых клиентов за пару минут.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 rounded-full bg-zinc-100 px-8 py-6 text-base font-medium text-black hover:bg-white transition"
            >
              <Link href="/login">Зарегистрироваться</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      {/* Footer air */}
      <footer className="h-24" />
    </div>
  );
}
