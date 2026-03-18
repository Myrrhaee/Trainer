"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { cn } from "@/lib/utils";

type ShareCardProps = {
  date?: Date | string;
  tonnageKg: number;
  exercisesDone: number;
  progress?: {
    exerciseTitle: string;
    deltaKg: number; // can be negative/positive
  } | null;
  qrUrl: string;
  className?: string;
};

function formatDate(d: Date) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function ShareCard({
  date,
  tonnageKg,
  exercisesDone,
  progress,
  qrUrl,
  className,
}: ShareCardProps) {
  const dateLabel = useMemo(() => {
    if (!date) return formatDate(new Date());
    if (date instanceof Date) return formatDate(date);
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return formatDate(parsed);
  }, [date]);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const url = await QRCode.toDataURL(qrUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          scale: 10,
          color: {
            dark: "#e4e4e7", // zinc-200
            light: "#09090b", // zinc-950
          },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  const progressLabel = useMemo(() => {
    if (!progress) return null;
    const sign = progress.deltaKg > 0 ? "+" : progress.deltaKg < 0 ? "−" : "";
    const abs = Math.abs(progress.deltaKg);
    return `${progress.exerciseTitle}: ${sign}${abs} кг 📈`;
  }, [progress]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[56px] border border-white/10 bg-zinc-950 text-zinc-50 shadow-[0_40px_120px_rgba(0,0,0,0.75)]",
        className
      )}
      style={{ width: 1080, height: 1920 }}
    >
      {/* premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(244,244,245,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_20%_20%,rgba(16,185,129,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_80%_35%,rgba(59,130,246,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/40" />
      </div>

      <div className="relative flex h-full flex-col px-[88px] pt-[76px] pb-[88px]">
        {/* header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <span className="text-lg font-semibold tracking-tight">⚡️</span>
            </div>
            <div className="leading-tight">
              <div className="text-[18px] font-semibold tracking-tight text-zinc-100">
                AI Strength Coach
              </div>
              <div className="text-[14px] text-zinc-400">{dateLabel}</div>
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[13px] font-medium text-zinc-200">
            Story
          </div>
        </header>

        {/* center */}
        <main className="mt-[220px] flex flex-1 flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[13px] font-medium text-zinc-200">
            СЕГОДНЯ
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            {dateLabel}
          </div>

          <h1 className="mt-8 text-[64px] font-semibold tracking-tight leading-[1.05]">
            ТРЕНИРОВКА
            <br />
            ЗАВЕРШЕНА
          </h1>

          <div className="mt-14 grid w-full grid-cols-2 gap-6">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-8 text-left backdrop-blur">
              <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Тоннаж
              </div>
              <div className="mt-3 text-[44px] font-semibold tracking-tight">
                {Math.max(0, Math.round(tonnageKg)).toLocaleString("ru-RU")}
                <span className="ml-2 text-[22px] font-semibold text-zinc-300">
                  кг
                </span>
              </div>
              <div className="mt-2 text-[15px] text-zinc-400">
                Общий поднятый вес
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-8 text-left backdrop-blur">
              <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                Упражнений
              </div>
              <div className="mt-3 text-[44px] font-semibold tracking-tight">
                {Math.max(0, Math.round(exercisesDone)).toLocaleString("ru-RU")}
              </div>
              <div className="mt-2 text-[15px] text-zinc-400">
                Выполнено сегодня
              </div>
            </div>
          </div>

          <div className="mt-10 w-full rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-8 py-7 text-left">
            <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              Прогресс месяца
            </div>
            <div className="mt-3 flex items-end justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[24px] font-semibold tracking-tight">
                  {progressLabel ?? "Добавь ключевое упражнение"}
                </div>
                <div className="mt-1 text-[15px] text-zinc-400">
                  Сравнение с прошлым рекордом
                </div>
              </div>
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25" />
            </div>
          </div>
        </main>

        {/* footer */}
        <footer className="mt-8 flex items-end justify-between gap-10">
          <div className="max-w-[520px]">
            <div className="text-[14px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Присоединяйся к сильным
            </div>
            <div className="mt-3 text-[20px] font-semibold tracking-tight text-zinc-100">
              Сканируй QR и начни вести прогресс
            </div>
            <div className="mt-2 text-[15px] text-zinc-400">
              Бот поможет тренироваться по плану и сохранять результаты.
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="rounded-[28px] border border-white/10 bg-black/30 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR"
                  className="h-44 w-44 rounded-2xl"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white/5 text-[12px] text-zinc-400">
                  QR…
                </div>
              )}
            </div>
            <div className="text-[12px] text-zinc-500">{qrUrl}</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

