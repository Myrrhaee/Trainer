"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Dumbbell, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MiniMetric, Panel, toneClass } from "./client-profile-ui";
import type { AthleteLoad, AthleteProfile, AthleteWorkout } from "./types";

export function TrainingTab({
  athlete,
  onAssign,
  onReview,
}: {
  athlete: AthleteProfile;
  onAssign: () => void;
  onReview: () => void;
}) {
  const waitingReviewWorkouts = athlete.workoutHistory.filter((workout) => workout.status.toLowerCase().includes("ждёт"));
  const clientComments = athlete.timeline.filter((item) => item.title.toLowerCase().includes("комментарий"));
  const [activeSessionTab, setActiveSessionTab] = useState<"plan" | "history">("plan");

  return (
    <section className="grid gap-5">
      <TrainingProfileHero athlete={athlete} waitingReviewCount={waitingReviewWorkouts.length} />

      <TrainerWorkoutControlStrip
        athlete={athlete}
        waitingReviewCount={waitingReviewWorkouts.length}
        onAssign={onAssign}
        onReview={onReview}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <WorkoutHistoryPanel
          plannedWorkouts={athlete.upcomingWorkouts}
          historyWorkouts={athlete.workoutHistory}
          activeTab={activeSessionTab}
          onTabChange={setActiveSessionTab}
          onAssign={onAssign}
          onReview={onReview}
        />

        <div className="grid gap-5">
          <LastWorkoutCommentPanel
            athlete={athlete}
            comments={clientComments}
            canReview={waitingReviewWorkouts.length > 0}
            onReview={onReview}
          />
          <ReviewQueuePanel workouts={waitingReviewWorkouts} onReview={onReview} />
        </div>
      </div>

      <TopExerciseResultsPanel athlete={athlete} />
    </section>
  );
}

function TrainingProfileHero({ athlete, waitingReviewCount }: { athlete: AthleteProfile; waitingReviewCount: number }) {
  const nextWorkout = athlete.upcomingWorkouts[0];
  const completedCount = athlete.workoutHistory.length;
  const plannedCount = athlete.upcomingWorkouts.length;
  const hasActiveProgram = athlete.currentProgram.status === "active";

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_18%_18%,rgba(190,242,100,0.12),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(5,5,5,0.94))] p-5 shadow-[0_28px_88px_rgba(0,0,0,0.28)] lg:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Тренировочный путь</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {hasActiveProgram
              ? `Идёт к ${athlete.targetWeight} через ${athlete.currentProgram.phase.toLowerCase()}`
              : "Следующая тренировка пока не назначена"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Здесь тренер видит назначенные дни, историю выполнения и рабочие веса по главным упражнениям.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <TrainingHeroMetric label="Текущий вес" value={athlete.currentWeight} helper={`цель ${athlete.targetWeight}`} />
            <TrainingHeroMetric label="Выполнение" value={`${athlete.adherence.workouts}%`} helper={athlete.adherence.label} />
            <TrainingHeroMetric label="Завершено" value={`${completedCount}`} helper="тренировок в истории" />
            <TrainingHeroMetric label="В плане" value={`${plannedCount}`} helper="следующих дней" />
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-black/22 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Следующая тренировка</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">{nextWorkout?.title ?? "Не назначена"}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {nextWorkout ? `${nextWorkout.date} · ${nextWorkout.meta}` : "У клиента пока нет следующего тренировочного дня."}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs", toneClass(waitingReviewCount > 0 ? "warning" : "good"))}>
              {waitingReviewCount > 0 ? "ждёт разбора" : "ритм ок"}
            </span>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-lime-300 shadow-[0_0_20px_rgba(190,242,100,0.24)]"
              style={{ width: `${Math.min(100, Math.max(8, athlete.adherence.workouts))}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrainingHeroMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{helper}</p>
    </div>
  );
}

function TrainerWorkoutControlStrip({
  athlete,
  waitingReviewCount,
  onAssign,
  onReview,
}: {
  athlete: AthleteProfile;
  waitingReviewCount: number;
  onAssign: () => void;
  onReview: () => void;
}) {
  return (
    <section className="rounded-[1.85rem] border border-zinc-800/85 bg-zinc-950/88 p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Рабочие действия</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-3 py-1.5 text-sm", waitingReviewCount > 0 ? toneClass("warning") : toneClass("good"))}>
              {waitingReviewCount > 0 ? `${waitingReviewCount} ждёт разбора` : "Разборов нет"}
            </span>
            {athlete.currentProgram.status === "active" ? (
              <>
                <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-sm text-zinc-400">
                  {athlete.currentProgram.name}
                </span>
                <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-sm text-zinc-500">
                  {athlete.currentProgram.phase} · неделя {athlete.currentProgram.week}
                </span>
              </>
            ) : (
              <span className="rounded-full border border-amber-300/18 bg-amber-300/8 px-3 py-1.5 text-sm text-amber-100">
                Активного плана нет
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:shrink-0 xl:flex-wrap xl:justify-end">
          {waitingReviewCount > 0 ? (
            <Button type="button" onClick={onReview} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
              <CheckCircle2 className="size-4" />
              Разобрать
            </Button>
          ) : null}
          <Button type="button" onClick={onAssign} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
            <Dumbbell className="size-4" />
            Назначить из шаблона
          </Button>
          <Button type="button" onClick={onAssign} variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            Повторить прошлую
          </Button>
          <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href={`/trainer/builder?clientId=${athlete.id}`}>Открыть конструктор</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ReviewQueuePanel({ workouts, onReview }: { workouts: AthleteWorkout[]; onReview: () => void }) {
  return (
    <Panel title="Ждут разбора" eyebrow="Очередь">
      {workouts.length > 0 ? (
        <div className="space-y-2">
          {workouts.map((workout) => (
            <div key={workout.id} className="rounded-[20px] border border-amber-300/16 bg-amber-300/7 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-zinc-50">{workout.title}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{workout.date} · {workout.meta}</p>
                </div>
                <Button type="button" onClick={onReview} className="h-8 shrink-0 rounded-full bg-lime-300 px-3 text-xs text-black hover:bg-lime-200">
                  Разобрать
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-lime-300/16 bg-lime-300/7 p-4">
          <p className="text-sm font-semibold text-lime-50">Очередь разбора пустая</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Все завершённые тренировки уже получили обратную связь.</p>
        </div>
      )}
    </Panel>
  );
}

function TopExerciseResultsPanel({ athlete }: { athlete: AthleteProfile }) {
  return (
    <Panel title="Лучшие результаты по упражнениям" eyebrow="Топ-10 движений">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
          Рабочие веса по самым важным упражнениям клиента. Этот блок нужен, чтобы быстро выбрать нагрузку при назначении следующей тренировки.
        </p>
        <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
          {athlete.previousLoads.length} упражнений
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {athlete.previousLoads.slice(0, 10).map((load, index) => (
          <TopExerciseResultCard key={load.exercise} load={load} index={index} />
        ))}
      </div>
    </Panel>
  );
}

function TopExerciseResultCard({ load, index }: { load: AthleteLoad; index: number }) {
  return (
    <div className="min-w-0 rounded-[24px] border border-zinc-800 bg-black/18 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-600">#{index + 1}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">{load.exercise}</h3>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[11px]", toneClass(load.tone))}>{load.trend}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Последний" value={load.last} />
        <MiniMetric label="Лучший" value={load.best} />
      </div>
    </div>
  );
}

function LastWorkoutCommentPanel({
  athlete,
  comments,
  canReview,
  onReview,
}: {
  athlete: AthleteProfile;
  comments: AthleteProfile["timeline"];
  canReview: boolean;
  onReview: () => void;
}) {
  const latestComment = comments[0];

  return (
    <Panel title="Комментарий клиента" eyebrow="Последняя тренировка">
      <div className="rounded-[22px] border border-zinc-800 bg-black/18 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-lime-200/80" />
          <p className="line-clamp-1 text-sm font-semibold text-zinc-50">{athlete.lastWorkout}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {latestComment?.detail ?? "Клиент пока не оставил комментарий к последней тренировке."}
        </p>
        <div className="mt-4 grid gap-2">
          {canReview ? (
            <Button type="button" onClick={onReview} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
              Открыть разбор
            </Button>
          ) : null}
          <Button asChild variant="ghost" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            <Link href="/trainer/messages">Написать клиенту</Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function WorkoutHistoryPanel({
  plannedWorkouts,
  historyWorkouts,
  activeTab,
  onTabChange,
  onAssign,
  onReview,
}: {
  plannedWorkouts: AthleteWorkout[];
  historyWorkouts: AthleteWorkout[];
  activeTab: "plan" | "history";
  onTabChange: (tab: "plan" | "history") => void;
  onAssign: () => void;
  onReview: () => void;
}) {
  const workouts = activeTab === "plan" ? plannedWorkouts : historyWorkouts;

  return (
    <section className="rounded-[1.85rem] border border-zinc-800/85 bg-zinc-950/88 p-5 shadow-2xl shadow-black/20 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Тренировки клиента</p>
          <h3 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-zinc-50">Сессии и история</h3>
        </div>
        <div className="inline-flex w-fit rounded-full border border-zinc-800 bg-zinc-950/90 p-1">
          <button
            type="button"
            onClick={() => onTabChange("plan")}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              activeTab === "plan" ? "bg-lime-300/12 text-lime-100" : "text-zinc-500 hover:text-zinc-100"
            )}
          >
            По плану
          </button>
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              activeTab === "history" ? "bg-lime-300/12 text-lime-100" : "text-zinc-500 hover:text-zinc-100"
            )}
          >
            История
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {workouts.map((workout) => (
          <WorkoutSessionRow
            key={workout.id}
            workout={workout}
            mode={activeTab}
            onAssign={onAssign}
            onReview={onReview}
          />
        ))}
      </div>
    </section>
  );
}

function WorkoutSessionRow({
  workout,
  mode,
  onAssign,
  onReview,
}: {
  workout: AthleteWorkout;
  mode: "plan" | "history";
  onAssign: () => void;
  onReview: () => void;
}) {
  const isWaitingReview = workout.status.toLowerCase().includes("ждёт");
  const metaParts = workout.meta.split("·").map((part) => part.trim()).filter(Boolean);
  const actionLabel = isWaitingReview ? "Разобрать" : mode === "plan" ? "Назначить" : "Открыть";
  const action = isWaitingReview ? onReview : mode === "plan" ? onAssign : undefined;

  return (
    <div className="group flex flex-col gap-3 rounded-[1.35rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))] px-4 py-4 transition hover:border-lime-300/14 hover:bg-zinc-900/72 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-800 bg-black/20 text-lime-200">
          <Dumbbell className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-zinc-50">{workout.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span>{workout.date}</span>
            {metaParts.slice(0, 3).map((part) => (
              <span key={part} className="inline-flex items-center gap-2">
                <span className="text-zinc-700">•</span>
                <span>{part}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:ml-auto sm:justify-end">
        <span className={cn("rounded-full border px-3 py-1.5 text-xs", toneClass(workout.tone))}>{workout.status}</span>
        <Button
          type="button"
          onClick={action}
          variant="outline"
          className="h-9 rounded-full border-zinc-800 bg-zinc-950/60 px-4 text-sm text-zinc-200 transition group-hover:border-lime-300/18 group-hover:text-zinc-50"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
