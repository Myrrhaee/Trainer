"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientCompletedWorkoutReadModel,
  ClientFeedbackPage,
} from "@/lib/server/client-workouts/client-completed-types";
import { clientHistoryDate } from "./canonical-client-history";

const button =
  "inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-900";
const text =
  "whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]";

export function CanonicalCompletedWorkout({
  sessionId,
  initial,
  returnTo,
  feedbackId,
}: {
  sessionId: string;
  initial?: ClientCompletedWorkoutReadModel;
  returnTo: string;
  feedbackId?: string;
}) {
  const [model, setModel] = useState(initial ?? null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const deny = useCallback(() => {
    setModel(null);
    setFailed(true);
    requestAnimationFrame(() => heading.current?.focus());
  }, []);
  useEffect(() => {
    if (initial && retry === 0) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/client/workouts?mode=completed&sessionId=${sessionId}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const body = await response.json();
        if (!body.completed) throw Error();
        if (!controller.signal.aborted) {
          setModel(body.completed);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
          requestAnimationFrame(() => heading.current?.focus());
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [initial, sessionId, retry]);
  const back = returnTo.startsWith("/client/me")
    ? "На главную"
    : "К тренировкам";
  if (!model)
    return (
      <main className="min-h-dvh bg-black p-6 text-zinc-100">
        <h1 ref={heading} tabIndex={-1}>
          {failed ? "Тренировка недоступна" : "Загрузка тренировки…"}
        </h1>
        {failed ? (
          <button
            className={`${button} my-4`}
            onClick={() => setRetry((value) => value + 1)}
          >
            Повторить
          </button>
        ) : null}
        <Link className="flex min-h-11 items-center" href={returnTo}>
          {back}
        </Link>
      </main>
    );
  const context = model.context;
  const malformed =
    context.discomfortReported === true
      ? !context.discomfortComment?.trim()
      : context.discomfortComment !== null ||
        (context.discomfortReported === null &&
          context.overallComment !== null);
  const sets = model.logs.flatMap((log) => log.sets);
  const count = (status: string) =>
    sets.filter((set) => set.status === status).length;
  const expected = model.exercises.reduce(
    (sum, item) => sum + item.setCount,
    0,
  );
  return (
    <main className="min-h-dvh bg-black px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-3xl [overflow-wrap:anywhere]">
        <Link
          className="inline-flex min-h-11 items-center text-zinc-400"
          href={returnTo}
        >
          {back}
        </Link>
        {!returnTo.startsWith("/client/me") ? (
          <Link
            className="ml-6 inline-flex min-h-11 items-center text-zinc-500"
            href="/client/me"
          >
            На главную
          </Link>
        ) : null}
        <header className="border-b border-zinc-800 py-5">
          <h1 className="text-2xl font-semibold tracking-normal">
            {model.title}
          </h1>
          <h2 className="mt-3 text-base text-lime-200">Тренировка завершена</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {model.status === "completed_with_omissions"
              ? "Завершена с пропусками · "
              : ""}
            <time dateTime={model.completedAt}>
              {clientHistoryDate(model.completedAt, model.clientTimezone)}
            </time>
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Назначена на {model.scheduledFor}
          </p>
        </header>
        <CanonicalFeedbackThread
          key={sessionId}
          sessionId={sessionId}
          feedbackId={feedbackId}
          onDenied={deny}
        />
        <section
          aria-labelledby="session-context"
          className="border-t border-zinc-800 py-6"
        >
          <h2 id="session-context" className="text-lg font-semibold">
            Что вы передали тренеру
          </h2>
          <h3 className="mt-4 text-sm font-medium">Ваш комментарий тренеру</h3>
          <p className={`${text} mt-2 text-zinc-300`}>
            {malformed
              ? "Общий комментарий недоступен."
              : context.discomfortReported === null
                ? "Общий комментарий для этой тренировки не собирался."
                : (context.overallComment ?? "Комментарий не оставлен.")}
          </p>
          <h3 className="mt-4 text-sm font-medium">Дискомфорт</h3>
          <p className={`${text} mt-2 text-zinc-300`}>
            {malformed
              ? "Данные о дискомфорте недоступны."
              : context.discomfortReported === null
                ? "Данные о дискомфорте для этой тренировки не собирались."
                : context.discomfortReported === false
                  ? "Дискомфорт не отмечен."
                  : context.discomfortComment}
          </p>
          {context.zeroResultReason ? (
            <>
              <h3 className="mt-4 text-sm font-medium">
                Причина завершения без выполненных подходов
              </h3>
              <p className={`${text} mt-2`}>{context.zeroResultReason}</p>
            </>
          ) : null}
        </section>
        <section
          aria-labelledby="workout-results"
          className="border-t border-zinc-800 py-6"
        >
          <h2
            id="workout-results"
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            Результаты тренировки
          </h2>
          <p className="my-3 text-sm text-zinc-400">
            {expected > 0 && sets.length === expected && !count("pending")
              ? `${count("completed")} из ${expected} подходов с результатом · Пропущено: ${count("skipped")} · Без полного результата: ${count("incomplete")}`
              : "Часть результатов недоступна"}
          </p>
          {model.generalInstruction ? (
            <p className={`${text} my-3`}>{model.generalInstruction}</p>
          ) : null}
          {model.trainerNote ? (
            <p className={`${text} my-3 text-zinc-400`}>{model.trainerNote}</p>
          ) : null}
          {model.exercises.map((exercise) => {
            const log = model.logs.find(
              (item) =>
                item.assignmentExerciseId === exercise.assignmentExerciseId,
            );
            return (
              <details
                key={exercise.assignmentExerciseId}
                className="border-t border-zinc-800 py-2"
              >
                <summary className="min-h-11 cursor-pointer py-3 font-medium">
                  {exercise.position}. {exercise.title}
                </summary>
                {exercise.superset ? (
                  <p className={`${text} mb-3 text-lime-200`}>
                    Суперсет: {exercise.superset.label} ·{" "}
                    {exercise.superset.instruction}
                  </p>
                ) : null}
                {exercise.trainerNote ? (
                  <p className={`${text} mb-3 text-zinc-400`}>
                    {exercise.trainerNote}
                  </p>
                ) : null}
                {!log ? (
                  <p>Данные выполнения недоступны.</p>
                ) : (
                  <>
                    {log.athleteNote ? (
                      <p className={`${text} mb-3`}>{log.athleteNote}</p>
                    ) : null}
                    <ol className="divide-y divide-zinc-900">
                      {log.sets.map((set) => {
                        const prescribed = set.sourceAssignmentSetId
                          ? exercise.sets.find(
                              (item) =>
                                item.assignmentSetId ===
                                set.sourceAssignmentSetId,
                            )
                          : null;
                        const missingPlan =
                          !!set.sourceAssignmentSetId && !prescribed;
                        const min = prescribed
                          ? prescribed.repetitionsMin
                          : set.plannedRepetitionsMin;
                        const max = prescribed
                          ? prescribed.repetitionsMax
                          : set.plannedRepetitionsMax;
                        const duration = prescribed
                          ? prescribed.durationSeconds
                          : set.plannedDurationSeconds;
                        const weight = prescribed
                          ? prescribed.targetWeightKg
                          : set.plannedWeightKg;
                        return (
                          <li key={set.id} className="py-4">
                            <h4 className="text-sm font-medium">
                              Подход {set.position} ·{" "}
                              {set.kind === "warmup"
                                ? "Разминочный"
                                : "Рабочий"}
                            </h4>
                            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                              <p className="text-zinc-400">
                                План
                                {!set.sourceAssignmentSetId
                                  ? " (снимок Session)"
                                  : ""}
                                :{" "}
                                {missingPlan
                                  ? "Данные недоступны"
                                  : duration !== null
                                    ? `${duration} сек.`
                                    : min !== null
                                      ? `${min}${max !== null && max !== min ? `–${max}` : ""} повт.`
                                      : "Данные недоступны"}
                                {!missingPlan && weight !== null
                                  ? ` · ${weight} кг`
                                  : ""}
                              </p>
                              <p>
                                Факт:{" "}
                                {set.status === "skipped"
                                  ? "Пропущен"
                                  : set.status === "incomplete"
                                    ? "Без полного результата"
                                    : set.status === "pending"
                                      ? "Данные недоступны"
                                      : [
                                          set.actualRepetitions !== null
                                            ? `${set.actualRepetitions} повт.`
                                            : null,
                                          set.actualDurationSeconds !== null
                                            ? `${set.actualDurationSeconds} сек.`
                                            : null,
                                          set.actualWeightKg !== null
                                            ? `${set.actualWeightKg} кг`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || "Данные недоступны"}
                                {set.rpe !== null ? ` · RPE ${set.rpe}` : ""}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                              Отдых:{" "}
                              {prescribed?.restSeconds ?? exercise.restSeconds}{" "}
                              сек.
                              {prescribed?.usesOverride
                                ? " · Индивидуальное назначение подхода"
                                : ""}
                            </p>
                            {set.athleteComment ? (
                              <p className={`${text} mt-3 text-zinc-300`}>
                                Ваш комментарий: {set.athleteComment}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                    {log.sets.length < exercise.setCount ? (
                      <p className="py-3 text-sm text-zinc-400">
                        Часть подходов недоступна.
                      </p>
                    ) : null}
                  </>
                )}
              </details>
            );
          })}
          {model.logs
            .filter(
              (log) =>
                !model.exercises.some(
                  (exercise) =>
                    exercise.assignmentExerciseId === log.assignmentExerciseId,
                ),
            )
            .map((log) => (
              <section key={log.id} className="border-t border-zinc-800 py-4">
                <h3 className="font-medium">
                  Результаты упражнения {log.position}: назначение недоступно
                </h3>
                {log.athleteNote ? (
                  <p className={`${text} mt-3`}>{log.athleteNote}</p>
                ) : null}
                <ol>
                  {log.sets.map((set) => (
                    <li key={set.id} className="py-3 text-sm">
                      <p>
                        Подход {set.position}:{" "}
                        {set.status === "skipped"
                          ? "Пропущен"
                          : set.status === "incomplete"
                            ? "Без полного результата"
                            : set.status === "pending"
                              ? "Данные недоступны"
                              : "С результатом"}
                      </p>
                      <p>
                        Факт:{" "}
                        {set.actualRepetitions !== null
                          ? `${set.actualRepetitions} повт. · `
                          : ""}
                        {set.actualDurationSeconds !== null
                          ? `${set.actualDurationSeconds} сек. · `
                          : ""}
                        {set.actualWeightKg !== null
                          ? `${set.actualWeightKg} кг`
                          : ""}
                        {set.rpe !== null ? ` · RPE ${set.rpe}` : ""}
                      </p>
                      {set.athleteComment ? (
                        <p className={text}>
                          Ваш комментарий: {set.athleteComment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
        </section>
        <Link
          className="inline-flex min-h-11 items-center text-lime-300"
          href={returnTo}
        >
          {back}
        </Link>
      </div>
    </main>
  );
}

function CanonicalFeedbackThread({
  sessionId,
  feedbackId,
  onDenied,
}: {
  sessionId: string;
  feedbackId?: string;
  onDenied: () => void;
}) {
  const [page, setPage] = useState<ClientFeedbackPage | null>(null);
  const [selection, setSelection] = useState<{
    after?: string;
    focus?: string;
  }>({ focus: feedbackId });
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    let focusPending = true;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      setFailed(false);
      try {
        const query = new URLSearchParams({ mode: "thread", sessionId });
        if (selection.after) query.set("after", selection.after);
        if (selection.focus) query.set("focus", selection.focus);
        const response = await fetch(`/api/client/feedback?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          setPage(null);
          onDenied();
          return;
        }
        if (!response.ok) throw Error();
        const body = (await response.json()) as { thread: ClientFeedbackPage };
        if (controller.signal.aborted) return;
        setPage((previous) =>
          body.thread.focusUnavailable && previous
            ? { ...previous, focusUnavailable: true }
            : body.thread,
        );
        if (selection.focus && focusPending)
          requestAnimationFrame(() => {
            if (!controller.signal.aborted)
              document.getElementById(`feedback-${selection.focus}`)?.focus();
          });
        focusPending = false;
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      window.removeEventListener("focus", load);
    };
  }, [sessionId, selection, retry, onDenied]);
  return (
    <section aria-labelledby="client-feedback-heading" className="py-6">
      <h2 id="client-feedback-heading" className="text-lg font-semibold">
        Ответ тренера
      </h2>
      {loading ? (
        <p role="status" className="mt-3 text-sm text-zinc-400">
          Загружаем ответ…
        </p>
      ) : null}
      {failed ? (
        <div className="py-3">
          <p role="status">Не удалось загрузить ответ тренера</p>
          <button
            className={`${button} mt-2`}
            onClick={() => setRetry((value) => value + 1)}
          >
            Повторить
          </button>
        </div>
      ) : null}
      {!loading && !failed && page?.focusUnavailable ? (
        <p className="mt-3">Исходный ответ недоступен.</p>
      ) : null}
      {!loading &&
      !failed &&
      page &&
      !page.items.length &&
      !page.focusUnavailable ? (
        <p className="mt-3 text-sm text-zinc-400">
          Тренер ещё не оставил обратную связь.
        </p>
      ) : null}
      {page?.hasPrevious || page?.focusUnavailable ? (
        <button className={`${button} mt-3`} onClick={() => setSelection({})}>
          К началу ответов
        </button>
      ) : null}
      <ol className="divide-y divide-zinc-800">
        {page?.items.map((item) => (
          <li key={item.id} className="py-4" data-feedback-id={item.id}>
            <h3
              id={`feedback-${item.id}`}
              tabIndex={-1}
              className="font-medium"
            >
              {item.kind === "follow_up"
                ? "Уточнение"
                : item.kind === "acknowledgement"
                  ? "Короткий ответ"
                  : "Ответ тренера"}{" "}
              · {item.author}
            </h3>
            <time
              dateTime={item.sentAt}
              className="mt-1 block text-xs text-zinc-500"
            >
              {clientHistoryDate(item.sentAt)}
            </time>
            <p className={`${text} mt-3`}>{item.body}</p>
            {item.followUpOfId ? (
              <button
                className="mt-1 min-h-11 text-sm text-lime-300"
                onClick={() => {
                  const parent = document.getElementById(
                    `feedback-${item.followUpOfId}`,
                  );
                  if (parent) {
                    parent.focus();
                    parent.scrollIntoView({ block: "center" });
                  } else setSelection({ focus: item.followUpOfId! });
                }}
              >
                К исходному ответу
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {page?.hasNextPage ? (
        <button
          disabled={loading}
          className={`${button} mt-3`}
          onClick={() => setSelection({ after: page.endCursor! })}
        >
          Следующие ответы
        </button>
      ) : null}
      {page?.items.length ? (
        <a
          href="#workout-results"
          className="mt-2 flex min-h-11 items-center text-sm text-zinc-400"
        >
          К результатам
        </a>
      ) : null}
    </section>
  );
}
