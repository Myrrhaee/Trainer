"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, CheckCircle2, Dumbbell, Loader2, LogOut, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkoutSession } from "@/lib/server/workout-sessions/workout-session-types";
import type { WorkoutAssignment } from "@/lib/server/workouts/workout-types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

export function CanonicalClientHome() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignments() {
      try {
        const [assignmentResponse, sessionResponse] = await Promise.all([
          fetch("/api/workout-assignments", { cache: "no-store" }),
          fetch("/api/workout-sessions", { cache: "no-store" }),
        ]);
        if (!assignmentResponse.ok || !sessionResponse.ok) throw new Error("load_failed");
        const assignmentBody = await assignmentResponse.json() as { assignments: WorkoutAssignment[] };
        const sessionBody = await sessionResponse.json() as { sessions: WorkoutSession[] };
        if (!cancelled) {
          setAssignments(assignmentBody.assignments);
          setSessions(sessionBody.sessions);
        }
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

  return (
    <main className="min-h-dvh bg-black px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase text-lime-300">Кабинет спортсмена</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">Мои тренировки</h1>
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
          <section className="grid min-h-[60vh] place-items-center py-12" aria-label="Загрузка тренировок">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </section>
        ) : loadFailed ? (
          <section className="grid min-h-[60vh] place-items-center py-12">
            <div className="max-w-md text-center">
              <AlertCircle className="mx-auto size-9 text-red-300" />
              <h2 className="mt-4 text-lg font-semibold tracking-normal">Не удалось загрузить тренировки</h2>
              <p className="mt-2 text-sm text-zinc-500">Обновите страницу через несколько минут.</p>
            </div>
          </section>
        ) : assignments.length === 0 ? (
          <section className="grid min-h-[60vh] place-items-center py-12">
            <div className="max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-lime-200">
              <Dumbbell aria-hidden />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-normal">Связь с тренером подключена</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Первая тренировка появится здесь после назначения тренером.
            </p>
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
                <h2 id="available-workouts-heading" className="mt-1 text-lg font-semibold tracking-normal">Доступные тренировки</h2>
              </div>
              <span className="text-sm text-zinc-500">{assignments.length}</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {assignments.map((assignment) => (
                <article key={assignment.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
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
                    <p className="mt-4 text-xs text-zinc-600">Версия шаблона {assignment.sourceRevision}</p>
                    {(() => {
                      const session = sessions.find((item) => item.assignmentId === assignment.id);
                      const completed = session && session.status !== "active";
                      return (
                        <Button asChild className="mt-5 gap-2 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
                          <Link href={session
                            ? `/client/workouts?session=${session.id}`
                            : `/client/workouts?assignment=${assignment.id}`}>
                            {completed ? <CheckCircle2 className="size-4" /> : <Play className="size-4" />}
                            {completed ? "Посмотреть результат" : session ? "Продолжить" : "Начать тренировку"}
                          </Link>
                        </Button>
                      );
                    })()}
                  </div>
                  <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
                    {assignment.exercises.map((exercise, index) => (
                      <li key={exercise.instanceKey} className="flex items-center gap-3 py-3 text-sm">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-zinc-500">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{exercise.title}</span>
                        <span className="shrink-0 text-zinc-500">
                          {exercise.sets} x {exercise.repetitions}{exercise.targetWeightKg !== null ? ` · ${exercise.targetWeightKg} кг` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
