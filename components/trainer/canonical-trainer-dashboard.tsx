"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Loader2,
  Plus,
  Users,
} from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import type { TrainerReviewQueueItem } from "@/lib/server/reviews/review-types";
import type { TrainerAthlete, WorkoutTemplate } from "@/lib/server/workouts/workout-types";

type DashboardData = {
  athletes: TrainerAthlete[];
  reviews: TrainerReviewQueueItem[];
  templates: WorkoutTemplate[];
};

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error("dashboard_load_failed");
  return response.json() as Promise<T>;
}

function completedLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CanonicalTrainerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readJson<{ athletes: TrainerAthlete[] }>("/api/trainer/athletes"),
      readJson<{ items: TrainerReviewQueueItem[] }>("/api/trainer/reviews"),
      readJson<{ templates: WorkoutTemplate[] }>("/api/trainer/workout-templates"),
    ])
      .then(([athletes, reviews, templates]) => {
        if (!cancelled) {
          setData({ athletes: athletes.athletes, reviews: reviews.items, templates: templates.templates });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <TrainerShell
      eyebrow="Рабочая главная"
      title="Сегодня"
      description="Очередь разборов и следующие действия по спортсменам."
      headerAction={(
        <Button asChild className="rounded-lg bg-lime-300 text-black hover:bg-lime-200">
          <Link href="/trainer/builder"><Plus className="size-4" />Создать шаблон</Link>
        </Button>
      )}
    >
      <div className="mx-auto w-full max-w-7xl">
        {!data && !failed ? (
          <div className="grid min-h-[60vh] place-items-center" aria-label="Загрузка рабочей главной">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </div>
        ) : failed ? (
          <section className="grid min-h-[60vh] place-items-center text-center">
            <div>
              <AlertCircle className="mx-auto size-9 text-red-300" />
              <h2 className="mt-4 text-xl font-semibold tracking-normal">Не удалось загрузить рабочие данные</h2>
              <p className="mt-2 text-sm text-zinc-500">Обновите страницу и повторите попытку.</p>
            </div>
          </section>
        ) : data ? (
          <div className="space-y-8">
            <section aria-label="Состояние рабочего пространства" className="grid border-y border-zinc-800 sm:grid-cols-3 sm:divide-x sm:divide-zinc-800">
              <Metric icon={ClipboardList} label="Ждут разбора" value={data.reviews.length} href="/trainer/attention" tone={data.reviews.length ? "attention" : "neutral"} />
              <Metric icon={Users} label="Активные спортсмены" value={data.athletes.length} href="/trainer/clients" tone="neutral" />
              <Metric icon={Dumbbell} label="Шаблоны" value={data.templates.length} href="/trainer/builder" tone="neutral" />
            </section>

            <section aria-labelledby="canonical-dashboard-reviews">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">Следующее действие</p>
                  <h2 id="canonical-dashboard-reviews" className="mt-1 text-xl font-semibold tracking-normal">Очередь разбора</h2>
                </div>
                {data.reviews.length ? <span className="text-sm text-zinc-500">{data.reviews.length}</span> : null}
              </div>
              {data.reviews.length ? (
                <div className="divide-y divide-zinc-800">
                  {data.reviews.map((item) => (
                    <article key={item.id} className="grid gap-4 py-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <div className="flex size-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs font-semibold">
                        {item.athleteInitials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-zinc-100">{item.athleteDisplayName}</h3>
                        <p className="mt-1 truncate text-sm text-zinc-300">{item.sessionTitle}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {completedLabel(item.completedAt)} · {item.completedSets} из {item.totalSets} подходов
                        </p>
                      </div>
                      <Button asChild className="min-h-11 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
                        <Link href={`/trainer/review/${item.sessionId}?from=dashboard&attentionItem=${item.id}`}>
                          Разобрать <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 items-center gap-4 border-b border-zinc-800 py-8">
                  <CheckCircle2 className="size-8 shrink-0 text-lime-300" />
                  <div>
                    <h3 className="font-semibold">Все завершённые тренировки разобраны</h3>
                    <p className="mt-1 text-sm text-zinc-500">Новая задача появится после завершения тренировки спортсменом.</p>
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="canonical-dashboard-athletes">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">Команда</p>
                  <h2 id="canonical-dashboard-athletes" className="mt-1 text-xl font-semibold tracking-normal">Спортсмены</h2>
                </div>
                <Button asChild variant="ghost" className="rounded-lg text-zinc-400">
                  <Link href="/trainer/clients">Все спортсмены <ArrowRight className="size-4" /></Link>
                </Button>
              </div>
              {data.athletes.length ? (
                <div className="divide-y divide-zinc-800">
                  {data.athletes.slice(0, 6).map((athlete) => (
                    <article key={athlete.athleteUserId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs font-semibold">
                          {athlete.initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-medium">{athlete.displayName}</h3>
                          <p className="mt-0.5 text-xs text-zinc-600">Активная связь</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" className="min-h-10 rounded-lg border-zinc-800 bg-zinc-950">
                          <Link href={`/trainer/clients/${athlete.athleteUserId}`}>Профиль</Link>
                        </Button>
                        <Button asChild variant="ghost" className="min-h-10 rounded-lg text-lime-200">
                          <Link href={`/trainer/builder?athleteId=${athlete.athleteUserId}&from=quick-assign`}>Назначить</Link>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Users className="mx-auto size-8 text-zinc-700" />
                  <p className="mt-3 text-sm text-zinc-500">Пригласите первого спортсмена из раздела «Клиенты».</p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </TrainerShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  href: string;
  tone: "attention" | "neutral";
}) {
  return (
    <Link href={href} className="flex min-h-28 items-center gap-4 px-4 py-5 transition hover:bg-zinc-950/70 sm:px-5">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${tone === "attention" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <strong className="block text-2xl font-semibold tracking-normal text-zinc-100">{value}</strong>
        <span className="mt-1 block text-xs text-zinc-500">{label}</span>
      </span>
    </Link>
  );
}
