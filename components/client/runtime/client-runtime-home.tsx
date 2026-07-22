"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Dumbbell, MessageSquareText, Sparkles } from "lucide-react";

import { getClientHomeView } from "@/components/trainer-os/demo-runtime/client-selectors";
import { useProductDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import { Button } from "@/components/ui/button";

import { ClientRuntimeShell } from "./client-runtime-shell";

export function ClientRuntimeHome({ actorId }: { actorId: string }) {
  const runtime = useProductDemoRuntime();
  const view = getClientHomeView(runtime.state, actorId);
  const assignmentId = view?.assignment?.id;
  const feedbackId = view?.latestFeedback?.id;
  const workoutSessionId = view?.session?.session.id;

  useEffect(() => {
    if (!assignmentId) return;
    runtime.commands.recordPilotEvent({ name: "client_assignment_viewed", athleteId: actorId, assignmentId });
  }, [actorId, assignmentId, runtime.commands]);

  useEffect(() => {
    if (!feedbackId || !workoutSessionId) return;
    runtime.commands.recordPilotEvent({ name: "feedback_viewed", athleteId: actorId, workoutSessionId });
    runtime.commands.recordPilotEvent({ name: "flow_completed", athleteId: actorId, workoutSessionId });
  }, [actorId, feedbackId, runtime.commands, workoutSessionId]);

  if (!view) return <ClientNotFound actorId={actorId} />;

  const stateCopy = {
    assignment: { eyebrow: "Тренировка назначена", title: view.assignment?.templateTitle ?? "Следующая тренировка", body: "План тренера готов. Структура назначения зафиксирована и не изменится вместе с шаблоном." },
    in_progress: { eyebrow: "Сессия в процессе", title: view.session?.sessionTitle ?? "Продолжить тренировку", body: "Сохранённые подходы на месте. Продолжай с того же WorkoutSession." },
    awaiting_feedback: { eyebrow: "Тренировка завершена", title: "Результат отправлен тренеру", body: "Сессия и фактические подходы сохранены. Сейчас тренировка ждёт разбора." },
    feedback_received: { eyebrow: "Ответ тренера", title: "Новый отзыв по тренировке", body: view.latestFeedback?.body ?? "Тренер оставил обратную связь." },
    empty: { eyebrow: "Спокойный день", title: "Активной тренировки сейчас нет", body: "Мы не показываем фиктивный план. Новое назначение появится здесь после действия тренера." },
  }[view.state];

  return (
    <ClientRuntimeShell actorId={actorId} actorName={view.actor.displayName} title={`Привет, ${view.actor.displayName.split(" ")[0]}`} description="Твой текущий тренировочный путь и один понятный следующий шаг.">
      <section className="relative overflow-hidden rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_18%_18%,rgba(163,230,53,0.12),transparent_32%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(7,7,9,0.98))] p-5 sm:p-7" aria-labelledby="client-home-state">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase text-lime-200">{stateCopy.eyebrow}</p>
          <h2 id="client-home-state" className="mt-3 text-3xl font-semibold text-zinc-50 sm:text-4xl">{stateCopy.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">{stateCopy.body}</p>
          {view.primaryAction ? (
            <Button asChild className="mt-6 h-12 rounded-lg bg-lime-200 px-5 text-black hover:bg-lime-100">
              <Link href={view.primaryAction.href}>
                {view.primaryAction.label}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Metric icon={Dumbbell} label="Завершено" value={`${view.progress.completedWorkoutCount} тренировок`} />
        <Metric icon={Sparkles} label="Регулярность" value={`${view.progress.consistency}%`} />
        <Metric icon={view.state === "awaiting_feedback" ? Clock3 : CheckCircle2} label="Текущий статус" value={statusLabel(view.state)} />
      </div>

      {view.latestFeedback ? (
        <section className="mt-5 rounded-lg border border-lime-300/20 bg-lime-300/[0.06] p-5" aria-labelledby="latest-feedback">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 h-5 w-5 text-lime-200" aria-hidden="true" />
            <div>
              <p className="text-xs uppercase text-zinc-500">{view.latestFeedback.author} · {view.latestFeedback.sentAt}</p>
              <h2 id="latest-feedback" className="mt-2 text-lg font-semibold text-zinc-50">Отзыв тренера</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{view.latestFeedback.body}</p>
            </div>
          </div>
        </section>
      ) : null}
    </ClientRuntimeShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Dumbbell; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <Icon className="h-5 w-5 text-lime-200" aria-hidden="true" />
      <p className="mt-4 text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function statusLabel(state: "assignment" | "in_progress" | "awaiting_feedback" | "feedback_received" | "empty") {
  return { assignment: "Можно начинать", in_progress: "В процессе", awaiting_feedback: "Ждёт разбора", feedback_received: "Отзыв получен", empty: "Нет назначения" }[state];
}

function ClientNotFound({ actorId }: { actorId: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Клиент не найден</h1>
        <p className="mt-3 text-sm text-zinc-400">Demo actor `{actorId}` не связан ни с одним спортсменом. Данные другого клиента не подставлены.</p>
      </div>
    </main>
  );
}
