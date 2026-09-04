"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, CheckCircle2, Dumbbell, Loader2, LogOut, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanonicalClientHistory } from "./canonical-client-history";
import { CanonicalRecentFeedback } from "./canonical-recent-feedback";
import type {
  ClientWorkoutAssignmentReadModel,
  ClientWorkoutCollectionReadModel,
  ClientWorkoutExercisePrescription,
} from "@/lib/server/client-workouts/client-workout-types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

function prescription(exercise: ClientWorkoutExercisePrescription) {
  if (exercise.perSetMode) return `${exercise.setCount} подх. · по подходам`;
  const target = exercise.prescriptionType === "duration"
    ? `${exercise.durationSeconds} сек.`
    : exercise.repetitionMode === "range"
      ? `${exercise.repetitionsMin}-${exercise.repetitionsMax} повт.`
      : `${exercise.repetitionsMin} повт.`;
  return `${exercise.setCount} × ${target}`;
}

export function CanonicalClientHome({ mode = "home" }: { mode?: "home" | "collection" }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [collection, setCollection] = useState<ClientWorkoutCollectionReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignments() {
      try {
        const response = await fetch("/api/client/workouts", { cache: "no-store" });
        if (!response.ok) throw new Error("load_failed");
        const body = await response.json() as { collection: ClientWorkoutCollectionReadModel };
        if (!cancelled) setCollection(body.collection);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAssignments();
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const allAssignments = collection?.assignments ?? [];
  const assignments = mode === "home" ? allAssignments.slice(0, 1) : allAssignments;

  return (
    <main className="min-h-dvh bg-black px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase text-lime-300">Кабинет спортсмена</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              {mode === "home" ? "Что делаем сейчас" : "Мои тренировки"}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={signingOut}
            onClick={() => void signOut()}
            aria-label="Выйти из аккаунта"
            title="Выйти"
            className="text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <LogOut aria-hidden />
          </Button>
        </header>

        {loading ? (
          <section className="grid place-items-center py-12" aria-label="Загрузка тренировок">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </section>
        ) : loadFailed ? (
          <section className="grid place-items-center py-12">
            <div className="max-w-md text-center">
              <AlertCircle className="mx-auto size-9 text-red-300" />
              <h2 className="mt-4 text-lg font-semibold tracking-normal">Не удалось загрузить тренировки</h2>
              <p className="mt-2 text-sm text-zinc-500">Обновите страницу через несколько минут.</p>
            </div>
          </section>
        ) : allAssignments.length === 0 ? (
          <section className="grid place-items-center py-12">
            <div className="max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-lime-200">
              <Dumbbell aria-hidden />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-normal">Сейчас нет назначенной тренировки.</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">Новое назначение появится здесь.</p>
            <p className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-500">
              <CheckCircle2 className="size-4 text-lime-300" aria-hidden />
              Аккаунт спортсмена активен
            </p>
          </div>
          </section>
        ) : (
          <section className="py-8" aria-labelledby="available-workouts-heading">
            <div className="flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <p className="text-xs uppercase text-zinc-500">От тренера</p>
                <h2 id="available-workouts-heading" className="mt-1 text-lg font-semibold tracking-normal">
                  {mode === "home" ? "Текущая тренировка" : "Текущие и ближайшие"}
                </h2>
              </div>
              {mode === "collection" ? <span className="text-sm text-zinc-500">{assignments.length}</span> : null}
            </div>
            <div className="divide-y divide-zinc-800">
              {assignments.map((assignment: ClientWorkoutAssignmentReadModel) => (
                <article key={assignment.assignmentId} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <div>
                    <p className="flex items-center gap-2 text-sm text-lime-200">
                      <CalendarDays className="size-4" />
                      {formatDate(assignment.scheduledFor)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-normal">{assignment.title}</h3>
                    {assignment.generalInstruction ? <p className="mt-2 text-sm leading-relaxed text-zinc-400">{assignment.generalInstruction}</p> : null}
                    {assignment.trainerNote ? (
                      <p className="mt-4 border-l-2 border-lime-300/50 pl-3 text-sm text-zinc-300">{assignment.trainerNote}</p>
                    ) : null}
                    <p className="mt-4 text-xs text-zinc-600">Тренер: {assignment.trainer.displayName}</p>
                    <Button asChild className="mt-5 gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
                      <Link href={`/client/workouts${assignment.session ? `?session=${assignment.session.sessionId}` : `?assignment=${assignment.assignmentId}`}&returnTo=${encodeURIComponent(mode === "home" ? "/client/me" : "/client/workouts")}`}>
                        <Play className="size-4" />
                        {assignment.session ? "Продолжить тренировку" : assignment.capabilities.canStart ? "Начать тренировку" : "Посмотреть назначение"}
                      </Link>
                    </Button>
                  </div>
                  <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
                    {assignment.exercises.map((exercise, index) => (
                      <li key={exercise.instanceKey} className="flex items-center gap-3 py-3 text-sm">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-zinc-500">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{exercise.title}</span>
                        <span className="shrink-0 text-zinc-500">
                          {prescription(exercise)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        )}
        {mode === "collection" ? <><CanonicalClientHistory/><Link href="/client/me" className="mt-6 inline-flex min-h-11 items-center text-zinc-400">На главную</Link></> : <><CanonicalRecentFeedback/><Link href="/client/workouts" className="inline-flex min-h-11 items-center text-lime-300">Все тренировки</Link></>}
      </div>
    </main>
  );
}
