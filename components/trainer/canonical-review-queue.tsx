"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Loader2, MessageSquareText, TriangleAlert } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import type { TrainerReviewQueueItem } from "@/lib/server/reviews/review-types";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

function completedLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ageLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export function CanonicalReviewQueue() {
  const [items, setItems] = useState<TrainerReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/trainer/reviews", { cache: "no-store" });
        if (!response.ok) throw new Error("load_failed");
        const body = await response.json() as { items: TrainerReviewQueueItem[] };
        if (!cancelled) setItems(body.items);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <TrainerShell
      eyebrow="Рабочая очередь"
      title="Тренировки на разбор"
      description="Завершённые сессии, которым нужен ответ или явное решение тренера."
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-end justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Активные задачи</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-zinc-50">Очередь разбора</h2>
          </div>
          {!loading && !failed ? <span className="text-sm text-zinc-500">{items.length}</span> : null}
        </header>

        {loading ? (
          <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-zinc-500" /></div>
        ) : failed ? (
          <div className="grid min-h-[55vh] place-items-center text-center">
            <div>
              <AlertCircle className="mx-auto size-8 text-red-300" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-100">Не удалось загрузить очередь</h2>
              <p className="mt-2 text-sm text-zinc-500">Обновите страницу через несколько минут.</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-[55vh] place-items-center text-center">
            <div className="max-w-md">
              <CheckCircle2 className="mx-auto size-9 text-lime-300" />
              <h2 className="mt-4 text-xl font-semibold tracking-normal text-zinc-100">Все тренировки разобраны</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">Новые задачи появятся после завершения назначенных тренировок.</p>
              <Button asChild variant="outline" className="mt-6 rounded-lg border-zinc-800 bg-zinc-950">
                <Link href="/trainer/clients">Открыть спортсменов</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {items.map((item, index) => {
              const partial = item.completedSets < item.totalSets;
              return (
                <article key={item.id} className="grid gap-5 py-6 lg:grid-cols-[3rem_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex size-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-200">
                    {item.athleteInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="font-semibold text-zinc-100">{item.athleteDisplayName}</h3>
                      <span className="text-xs text-zinc-600">задача {index + 1} из {items.length}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-300">{item.sessionTitle}</p>
                    <p className="mt-1 text-xs text-zinc-600">{completedLabel(item.completedAt)} · {ageLabel(item.completedAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1.5 ${partial ? "text-amber-200" : "text-lime-200"}`}>
                        {partial ? <TriangleAlert className="size-3.5" /> : <ClipboardCheck className="size-3.5" />}
                        {item.completedSets} из {item.totalSets} подходов
                      </span>
                      {item.hasClientComments ? (
                        <span className="inline-flex items-center gap-1.5 text-cyan-200"><MessageSquareText className="size-3.5" />Есть комментарий</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button asChild className="gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
                      <Link href={trainerWorkflowHref(`/trainer/review/${item.sessionId}`, createTrainerWorkflowContext({
                        origin: "dashboard",
                        athleteUserId: item.athleteUserId,
                        sourceAttentionItemId: item.id,
                        sourceSessionId: item.sessionId,
                        queue: { filter: "review", order: "priority", position: index },
                        returnTo: "/trainer/attention",
                        returnAnchor: "workflow-receipt",
                      }))}>
                        Открыть разбор <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-lg border-zinc-800 bg-zinc-950 text-zinc-300">
                      <Link href={`/trainer/clients/${item.athleteUserId}`}>Профиль</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </TrainerShell>
  );
}
