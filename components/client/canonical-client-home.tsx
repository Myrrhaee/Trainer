"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDown, CalendarDays, CheckCircle2, Dumbbell, Loader2, LogOut, Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanonicalClientHistory } from "./canonical-client-history";
import { CanonicalRecentFeedback } from "./canonical-recent-feedback";
import type {
  ClientWorkoutAssignmentReadModel,
  ClientWorkoutCollectionReadModel,
  ClientWorkoutExercisePrescription,
} from "@/lib/server/client-workouts/client-workout-types";
import {
  appendCurrentWorkouts,
  currentWorkoutCollectionUrl,
  readCurrentWorkoutNavigation,
  replaceClientWorkoutCollectionUrl,
} from "@/lib/client-history-navigation";

type CurrentView = {
  rows: ClientWorkoutAssignmentReadModel[];
  start: string | null;
  after: string | null;
  depth: number;
  target: number;
  hasNext: boolean;
  loading: boolean;
  failed: boolean;
  notice: string;
  anchor: string;
};

const initialCurrent: CurrentView = {
  rows: [],
  start: null,
  after: null,
  depth: 0,
  target: 1,
  hasNext: true,
  loading: true,
  failed: false,
  notice: "",
  anchor: "",
};

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
  const [view, setView] = useState<CurrentView>(initialCurrent);
  const [, setNavigationVersion] = useState(0);
  const state = useRef<CurrentView>(initialCurrent);
  const request = useRef<AbortController | null>(null);
  const loadRef = useRef<(next?: boolean) => void>(() => {});

  useEffect(() => {
    let disposed = false;
    const publish = (value: CurrentView) => {
      state.current = value;
      if (!disposed) setView(value);
    };
    const writeUrl = (value: CurrentView) => {
      if (mode !== "collection") return;
      replaceClientWorkoutCollectionUrl(
        currentWorkoutCollectionUrl(
          value.start,
          value.depth,
          value.anchor,
          new URL(window.location.href),
        ),
      );
    };
    async function loadAssignments(next = false) {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      let current = { ...state.current, loading: true, failed: false };
      if (next) current.target = current.depth + 1;
      publish(current);
      let reset = false;
      try {
        while (current.depth < current.target && current.hasNext) {
          const query = new URLSearchParams();
          if (current.depth === 0 && current.start)
            query.set("currentStart", current.start);
          if (current.depth > 0 && current.after)
            query.set("currentAfter", current.after);
          const response = await fetch(
            `/api/client/workouts${query.size ? `?${query}` : ""}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          if (response.status === 400 && mode === "collection" && !reset) {
            reset = true;
            current = {
              ...initialCurrent,
              notice:
                "Текущие тренировки обновлены: сохранённая позиция недоступна.",
            };
            replaceClientWorkoutCollectionUrl(
              currentWorkoutCollectionUrl(
                null,
                1,
                "#current-workouts",
                new URL(window.location.href),
              ),
            );
            publish(current);
            continue;
          }
          if (!response.ok) throw new Error("load_failed");
          const body = (await response.json()) as {
            collection: ClientWorkoutCollectionReadModel;
          };
          const page = body.collection;
          if (
            page.pageInfo.hasNextPage &&
            (!page.pageInfo.endCursor ||
              page.pageInfo.endCursor === current.after)
          )
            throw new Error("non_advancing_current_cursor");
          current = {
            ...current,
            rows: appendCurrentWorkouts(current.rows, page.assignments),
            start: page.pageInfo.startCursor,
            after: page.pageInfo.endCursor,
            depth: current.depth + 1,
            hasNext: page.pageInfo.hasNextPage,
          };
          publish(current);
        }
        if (!current.hasNext && current.depth < current.target)
          current.notice =
            "Список изменился: показаны все доступные тренировки.";
        current = { ...current, loading: false, target: current.depth };
        publish(current);
        writeUrl(current);
        if (next && !current.hasNext)
          requestAnimationFrame(() => {
            if (!disposed && !controller.signal.aborted)
              document.getElementById("current-workouts-exhausted")?.focus();
          });
        if (!next && current.anchor.startsWith("#current-workout-")) {
          requestAnimationFrame(() => {
            if (disposed || controller.signal.aborted) return;
            const row = document.getElementById(current.anchor.slice(1));
            const target = row ?? document.getElementById("current-workouts");
            target?.focus();
            target?.scrollIntoView({ block: "start" });
            if (!row)
              publish({
                ...current,
                notice:
                  "Выбранная тренировка больше не доступна в текущем списке.",
              });
          });
        }
      } catch {
        if (!controller.signal.aborted)
          publish({ ...current, loading: false, failed: true });
      } finally {
        if (request.current === controller) request.current = null;
      }
    }
    function restore() {
      request.current?.abort();
      request.current = null;
      const navigation =
        mode === "collection"
          ? readCurrentWorkoutNavigation(new URL(window.location.href))
          : { start: null, depth: 1, anchor: "", invalid: false };
      publish({
        ...initialCurrent,
        start: navigation.start,
        target: navigation.depth,
        anchor: navigation.anchor,
        notice: navigation.invalid
          ? "Текущие тренировки обновлены: сохранённая позиция недоступна."
          : "",
      });
      if (navigation.invalid && mode === "collection")
        replaceClientWorkoutCollectionUrl(
          currentWorkoutCollectionUrl(
            null,
            1,
            "#current-workouts",
            new URL(window.location.href),
          ),
        );
      void loadAssignments();
    }
    const refreshNavigationHref = () =>
      setNavigationVersion((version) => version + 1);
    loadRef.current = (next) => {
      void loadAssignments(next);
    };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener(
      "client-workout-navigation",
      refreshNavigationHref,
    );
    return () => {
      disposed = true;
      request.current?.abort();
      request.current = null;
      window.removeEventListener("popstate", restore);
      window.removeEventListener(
        "client-workout-navigation",
        refreshNavigationHref,
      );
    };
  }, [mode]);

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

  const allAssignments = view.rows;
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

        {view.loading && view.depth === 0 ? (
          <section className="grid place-items-center py-12" aria-label="Загрузка тренировок">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </section>
        ) : view.failed && view.depth === 0 ? (
          <section className="grid place-items-center py-12">
            <div className="max-w-md text-center">
              <AlertCircle className="mx-auto size-9 text-red-300" />
              <h2 className="mt-4 text-lg font-semibold tracking-normal">Не удалось загрузить тренировки</h2>
              <p className="mt-2 text-sm text-zinc-500">Повторите запрос, когда соединение восстановится.</p>
              <Button type="button" variant="outline" className="mt-5 gap-2 border-zinc-700" onClick={() => loadRef.current()}>
                <RefreshCw className="size-4" aria-hidden />
                Повторить
              </Button>
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
          <section className="py-8" aria-labelledby="current-workouts">
            <div className="flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <p className="text-xs uppercase text-zinc-500">От тренера</p>
                <h2 id="current-workouts" tabIndex={-1} className="mt-1 text-lg font-semibold tracking-normal">
                  {mode === "home" ? "Текущая тренировка" : "Текущие и ближайшие"}
                </h2>
              </div>
              {mode === "collection" ? <span className="text-sm text-zinc-500">{assignments.length}</span> : null}
            </div>
            <div className="divide-y divide-zinc-800">
              {assignments.map((assignment: ClientWorkoutAssignmentReadModel) => (
                <article id={`current-workout-${assignment.assignmentId}`} tabIndex={-1} key={assignment.assignmentId} className="grid scroll-mt-4 gap-5 py-6 outline-none focus-visible:ring-2 focus-visible:ring-lime-300 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
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
                      <Link
                        href={`/client/workouts${assignment.session ? `?session=${assignment.session.sessionId}` : `?assignment=${assignment.assignmentId}`}&returnTo=${encodeURIComponent(
                          mode === "home"
                            ? "/client/me"
                            : currentWorkoutCollectionUrl(
                                view.start,
                                view.depth,
                                `#current-workout-${assignment.assignmentId}`,
                                typeof window === "undefined"
                                  ? undefined
                                  : new URL(window.location.href),
                              ),
                        )}`}
                        onClick={(event) => {
                          if (
                            mode !== "collection" ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.button !== 0
                          )
                            return;
                          const origin = currentWorkoutCollectionUrl(
                            view.start,
                            view.depth,
                            `#current-workout-${assignment.assignmentId}`,
                            new URL(window.location.href),
                          );
                          replaceClientWorkoutCollectionUrl(origin);
                          event.preventDefault();
                          router.push(
                            `/client/workouts${assignment.session ? `?session=${assignment.session.sessionId}` : `?assignment=${assignment.assignmentId}`}&returnTo=${encodeURIComponent(origin)}`,
                          );
                        }}
                      >
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
            {view.notice ? <p role="status" className="py-3 text-sm text-zinc-400">{view.notice}</p> : null}
            {mode === "collection" && view.failed ? (
              <div className="py-4">
                <p role="alert">
                  {view.depth > 0
                    ? "Не удалось загрузить следующую часть текущих тренировок"
                    : "Не удалось загрузить текущие тренировки"}
                </p>
                <Button type="button" variant="outline" className="mt-3 gap-2 border-zinc-700" onClick={() => loadRef.current()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Повторить
                </Button>
              </div>
            ) : null}
            {mode === "collection" && !view.failed && view.hasNext ? (
              <Button type="button" variant="outline" className="my-5 gap-2 border-zinc-700" disabled={view.loading} onClick={() => loadRef.current(true)}>
                {view.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
                {view.loading ? "Загрузка…" : "Показать ещё"}
              </Button>
            ) : null}
            {mode === "collection" && !view.loading && !view.failed && !view.hasNext ? (
              <p id="current-workouts-exhausted" tabIndex={-1} role="status" className="py-5 text-sm text-zinc-400">
                Все тренировки показаны
              </p>
            ) : null}
          </section>
        )}
        {mode === "collection" ? <><CanonicalClientHistory/><Link href="/client/me" className="mt-6 inline-flex min-h-11 items-center text-zinc-400">На главную</Link></> : <><CanonicalRecentFeedback/><Link href="/client/workouts" className="inline-flex min-h-11 items-center text-lime-300">Все тренировки</Link></>}
      </div>
    </main>
  );
}
