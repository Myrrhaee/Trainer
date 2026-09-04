"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ClientRecentFeedback } from "@/lib/server/client-workouts/client-completed-types";
import { clientHistoryDate } from "./canonical-client-history";

export function CanonicalRecentFeedback() {
  const [latest, setLatest] = useState<ClientRecentFeedback | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const restored = useRef(false);
  useEffect(() => {
    if (
      latest &&
      !restored.current &&
      window.location.hash === "#recent-feedback"
    ) {
      restored.current = true;
      document.getElementById("recent-feedback")?.focus();
    }
  }, [latest]);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/client/feedback?mode=latest", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) setLatest(null);
        if (!response.ok) throw Error();
        const body = await response.json();
        if (!controller.signal.aborted) {
          setLatest(body.latest);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        inFlight = false;
      }
    }
    void load();
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      window.removeEventListener("focus", load);
    };
  }, [retry]);
  if (failed)
    return (
      <section className="border-t border-zinc-800 py-5">
        <p role="status">Не удалось загрузить последний ответ</p>
        <button
          className="min-h-11 text-lime-300"
          onClick={() => setRetry((value) => value + 1)}
        >
          Повторить
        </button>
      </section>
    );
  if (!latest) return null;
  return (
    <section
      id="recent-feedback"
      tabIndex={-1}
      aria-labelledby="recent-feedback-heading"
      className="border-t border-zinc-800 py-5 [overflow-wrap:anywhere]"
    >
      <h2 id="recent-feedback-heading" className="font-semibold">
        {latest.kind === "follow_up"
          ? "Уточнение тренера"
          : "Последний ответ тренера"}
      </h2>
      <p className="mt-2 text-zinc-300">
        Тренер ответил на тренировку «{latest.title}»
      </p>
      <time
        dateTime={latest.sentAt}
        className="mt-2 block text-sm text-zinc-500"
      >
        {clientHistoryDate(latest.sentAt)}
      </time>
      <Link
        className="mt-2 inline-flex min-h-11 items-center text-lime-300"
        href={`/client/workouts?session=${latest.sessionId}&feedback=${latest.id}&returnTo=${encodeURIComponent("/client/me#recent-feedback")}#feedback-${latest.id}`}
      >
        Посмотреть ответ
      </Link>
    </section>
  );
}
