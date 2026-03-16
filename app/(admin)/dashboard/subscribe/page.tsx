"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";

const BENEFITS = [
  "Неограниченное количество клиентов",
  "Библиотека упражнений с видео",
  "Программы тренировок и назначения",
  "Напоминания клиентам в Telegram",
  "Трекер веса и прогресса",
];

export default function SubscribePage() {
  const paymentUrl =
    process.env.NEXT_PUBLIC_SUBSCRIPTION_PAYMENT_URL ?? "#";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-10">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад в кабинет
      </Link>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
            Продление подписки
          </h1>
          <p className="mt-2 text-zinc-400">
            Полный доступ к рабочему кабинету тренера
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-zinc-50">$29</span>
            <span className="text-zinc-500">/мес</span>
          </div>
          <ul className="mt-8 space-y-3">
            {BENEFITS.map((label, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3 w-3" />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <Button
            asChild
            className="mt-10 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-6 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30"
          >
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
              Перейти к оплате
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
