"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Dumbbell,
  MessageCircle,
  UserRound,
} from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  secondaryCheckItems,
  trainerOperatingClients,
} from "./mock-data";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import type { TrainerOperatingClient } from "./types";

export function DashboardOperatingBoard() {
  const [quickAssignClient, setQuickAssignClient] = useState<TrainerOperatingClient | null>(null);
  const [handledClients, setHandledClients] = useState<Record<string, string>>({});
  const firstActionRef = useRef<HTMLDivElement | null>(null);

  const clients = useMemo(
    () =>
      trainerOperatingClients.map((client) => {
        const handledLabel = handledClients[client.id];
        if (!handledLabel) return client;

        return {
          ...client,
          status: "on_track" as const,
          priority: "low" as const,
          nextWorkout: {
            name: handledLabel,
            meta: "Обработано сейчас",
            detail: "Следующий шаг готов",
          },
          todayState: client.plannedToday ? client.todayState : "Следующая тренировка назначена",
          action: "open_client" as const,
          actionLabel: "Открыть",
          reason: "Следующий шаг назначен.",
        };
      }),
    [handledClients]
  );

  const actionClients = clients.filter((client) => client.status !== "on_track");
  const onTrackClients = clients.filter((client) => client.status === "on_track");
  const progress = Math.round((onTrackClients.length / clients.length) * 100);

  function completeClientAction(clientId: string, label: string) {
    setHandledClients((current) => ({ ...current, [clientId]: label }));
  }

  function assignWorkout(templateName: string) {
    if (!quickAssignClient) return;
    completeClientAction(quickAssignClient.id, templateName);
    setQuickAssignClient(null);
  }

  function focusFirstAction() {
    firstActionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <TrainerShell
      eyebrow="Trainer OS V1"
      title="Главная"
      description="Спокойный рабочий центр тренера: следующий шаг, разбор и клиенты в порядке."
    >
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.08),transparent_30%),radial-gradient(circle_at_85%_5%,rgba(250,204,21,0.05),transparent_26%),linear-gradient(180deg,#050505_0%,#09090b_48%,#050505_100%)] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-200/70">Рабочее утро</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">Доброе утро, Алексей</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                Разберем клиентов, которым нужен следующий шаг. Остальные спокойно идут по плану.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={focusFirstAction}
                disabled={actionClients.length === 0}
                className="h-10 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200"
              >
                {actionClients.length > 0 ? `Обработать ${actionClients.length} клиента` : "Все обработано"}
                <ArrowRight className="size-4" />
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
                <Link href="/trainer/clients">Все клиенты</Link>
              </Button>
            </div>
          </header>

          <StatusOverview active={clients.length} onTrack={onTrackClients.length} blocked={actionClients.length} progress={progress} />

          {actionClients.length > 0 ? (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[30px] border border-zinc-800/90 bg-zinc-950/72 p-4 shadow-2xl shadow-black/30 sm:p-5" ref={firstActionRef}>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">Тренировочный процесс заблокирован</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Требуют действия</h2>
                  </div>
                  <p className="max-w-sm text-sm leading-relaxed text-zinc-500">Показываем только тех, у кого нет следующего шага или нужна корректировка.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {actionClients.map((client) => (
                    <ActionClientCard
                      key={client.id}
                      client={client}
                      onQuickAssign={setQuickAssignClient}
                      onComplete={completeClientAction}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <SecondaryChecks />
                <OnTrackCard clients={onTrackClients} />
              </div>
            </section>
          ) : (
            <section className="rounded-[30px] border border-lime-300/15 bg-lime-300/8 p-8 text-center shadow-2xl shadow-black/30">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-lime-300/12 text-lime-100 ring-1 ring-lime-300/20">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-zinc-50">Все клиенты имеют следующий шаг</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                Можно спокойно переходить к тренировкам, сообщениям и плановым проверкам.
              </p>
              <div className="mt-6 flex justify-center">
                <Button asChild className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
                  <Link href="/trainer/clients">Посмотреть клиентов</Link>
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>

      <QuickAssignPlaceholder client={quickAssignClient} onClose={() => setQuickAssignClient(null)} onAssign={assignWorkout} />
    </TrainerShell>
  );
}

function StatusOverview({ active, onTrack, blocked, progress }: { active: number; onTrack: number; blocked: number; progress: number }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(135deg,rgba(24,24,27,0.94),rgba(5,5,5,0.88))] p-5 shadow-2xl shadow-black/30">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr_auto] lg:items-center">
        <div className="relative flex size-40 items-center justify-center justify-self-center rounded-full bg-zinc-950 ring-1 ring-zinc-800 lg:justify-self-start">
          <div
            className="absolute inset-3 rounded-full"
            style={{
              background: `conic-gradient(rgb(190 242 100) ${progress * 3.6}deg, rgba(39,39,42,0.95) 0deg)`,
            }}
          />
          <div className="relative flex size-[7.2rem] flex-col items-center justify-center rounded-full bg-zinc-950 text-center ring-1 ring-zinc-800">
            <p className="text-3xl font-semibold text-zinc-50">{progress}%</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">в порядке</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Состояние базы</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{active} активных клиентов</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            {onTrack} идут по плану. {blocked} требуют действия, потому что тренировочный процесс сейчас остановлен или требует решения тренера.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px]">
          <StatusPill label="Активные" value={active} tone="neutral" />
          <StatusPill label="Идут по плану" value={onTrack} tone="green" />
          <StatusPill label="Требуют действия" value={blocked} tone="amber" />
        </div>
      </div>
    </section>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: "neutral" | "green" | "amber" }) {
  const toneClass = {
    neutral: "border-zinc-800 bg-black/22 text-zinc-200",
    green: "border-lime-300/18 bg-lime-300/8 text-lime-100",
    amber: "border-amber-300/18 bg-amber-300/8 text-amber-100",
  }[tone];

  return (
    <div className={cn("rounded-2xl border px-4 py-3", toneClass)}>
      <p className="text-2xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function ActionClientCard({
  client,
  onQuickAssign,
  onComplete,
}: {
  client: TrainerOperatingClient;
  onQuickAssign: (client: TrainerOperatingClient) => void;
  onComplete: (clientId: string, label: string) => void;
}) {
  const tone = getActionTone(client.status);

  return (
    <article className={cn("flex min-h-[310px] flex-col rounded-[26px] border bg-black/24 p-4", tone.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 border border-zinc-800 bg-zinc-950">
            <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{client.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-zinc-50">{client.name}</h3>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{client.goal}</p>
          </div>
        </div>
        <PriorityBadge priority={client.priority} />
      </div>

      <div className="mt-5">
        <StatusBadge status={client.status} />
        <p className="mt-4 text-lg font-semibold leading-snug text-zinc-50">{getHumanStatus(client)}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{client.reason}</p>
        <p className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs leading-relaxed text-zinc-500">{client.coachNote}</p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {renderActionCardPrimary(client, onQuickAssign, onComplete)}
        <Button asChild variant="outline" className="h-9 rounded-full border-zinc-700 bg-black/20 px-3 text-xs text-zinc-200 hover:bg-zinc-900">
          <Link href={`/trainer/clients/${client.id}`}>Открыть</Link>
        </Button>
      </div>
    </article>
  );
}

function getActionTone(status: TrainerOperatingClient["status"]) {
  if (status === "waiting_review" || status === "needs_correction") {
    return { card: "border-red-300/18 shadow-[0_0_34px_rgba(248,113,113,0.07)]" };
  }

  if (status === "needs_assignment" || status === "no_program") {
    return { card: "border-amber-300/18 shadow-[0_0_34px_rgba(251,191,36,0.06)]" };
  }

  return { card: "border-yellow-300/18" };
}

function getHumanStatus(client: TrainerOperatingClient) {
  switch (client.status) {
    case "waiting_review":
      return "Ждет разбора";
    case "needs_assignment":
      return "Нет следующей тренировки";
    case "no_program":
      return "Нет первой тренировки";
    case "needs_correction":
      return "Нужна корректировка";
    case "missed_workout":
      return "Пропуск тренировки";
    default:
      return "Идет по плану";
  }
}

function renderActionCardPrimary(
  client: TrainerOperatingClient,
  onQuickAssign: (client: TrainerOperatingClient) => void,
  onComplete: (clientId: string, label: string) => void
) {
  if (client.action === "quick_assign") {
    return (
      <Button type="button" onClick={() => onQuickAssign(client)} className="h-9 rounded-full bg-lime-300 px-4 text-xs font-semibold text-black hover:bg-lime-200">
        Назначить
        <ArrowRight className="size-3.5" />
      </Button>
    );
  }

  if (client.action === "open_review") {
    return (
      <Button asChild className="h-9 rounded-full bg-lime-300 px-4 text-xs font-semibold text-black hover:bg-lime-200">
        <Link href={client.reviewHref ?? `/trainer/review/${client.id}-mock`}>
          Разобрать
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    );
  }

  if (client.action === "message") {
    return (
      <Button asChild className="h-9 rounded-full bg-lime-300 px-4 text-xs font-semibold text-black hover:bg-lime-200">
        <Link href={client.messageHref ?? "/trainer/messages"}>
          <MessageCircle className="size-3.5" />
          Сообщение
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild className="h-9 rounded-full bg-lime-300 px-4 text-xs font-semibold text-black hover:bg-lime-200">
        <Link href={`/trainer/clients/${client.id}`}>
          <UserRound className="size-3.5" />
          Открыть клиента
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onComplete(client.id, client.nextWorkout?.name ?? client.recommendedTemplate ?? "Следующий шаг")}
        className="h-9 rounded-full px-3 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      >
        Уже исправлено
      </Button>
    </>
  );
}

function SecondaryChecks() {
  return (
    <section className="rounded-[26px] border border-zinc-800/90 bg-zinc-950/64 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Второй приоритет</p>
      <h2 className="mt-1 text-lg font-semibold text-zinc-50">Полезно проверить</h2>
      <div className="mt-3 space-y-2">
        {secondaryCheckItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-black/18 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">
                {item.label} - {item.count} клиента
              </span>
              <span className="mt-1 block truncate text-xs text-zinc-500">{item.helper}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-zinc-600" />
          </button>
        ))}
      </div>
    </section>
  );
}

function OnTrackCard({ clients }: { clients: TrainerOperatingClient[] }) {
  const preview = clients.slice(0, 8);

  return (
    <section className="rounded-[26px] border border-lime-300/12 bg-lime-300/6 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/60">Спокойная зона</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-50">{clients.length} клиентов идут по плану</h2>
        </div>
        <Circle className="mt-1 size-3 fill-lime-300 text-lime-300" />
      </div>
      <div className="mt-4 flex -space-x-2">
        {preview.map((client) => (
          <Avatar key={client.id} className="size-9 border-2 border-zinc-950 bg-zinc-900">
            <AvatarFallback className="bg-zinc-900 text-[11px] font-semibold text-zinc-200">{client.initials}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-zinc-500">У этих клиентов есть следующий тренировочный шаг. Они не должны занимать внимание тренера утром.</p>
      <Button asChild variant="outline" className="mt-4 h-9 rounded-full border-zinc-700 bg-black/20 text-xs text-zinc-200 hover:bg-zinc-900">
        <Link href="/trainer/clients">
          Посмотреть всех клиентов
          <ChevronRight className="size-3.5" />
        </Link>
      </Button>
    </section>
  );
}

function QuickAssignPlaceholder({
  client,
  onClose,
  onAssign,
}: {
  client: TrainerOperatingClient | null;
  onClose: () => void;
  onAssign: (templateName: string) => void;
}) {
  const templates = client
    ? [client.recommendedTemplate ?? "Тренировка на все тело", "Повторить прошлую", "Технический день"]
    : ["Тренировка на все тело", "Повторить прошлую", "Технический день"];

  return (
    <Sheet open={Boolean(client)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 px-0 py-0 text-zinc-100 sm:max-w-[560px]">
        {client ? (
          <>
            <SheetHeader className="border-b border-zinc-800 px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-200/70">Быстрое назначение</p>
              <SheetTitle className="mt-2 text-2xl text-zinc-50">{client.name}</SheetTitle>
              <SheetDescription className="text-zinc-500">
                {client.goal} · {client.reason}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-5 py-5">
              <div className="rounded-2xl border border-zinc-800 bg-black/22 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Контекст клиента</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <InfoLine label="Сегодня" value={client.todayState} />
                  <InfoLine label="Последняя тренировка" value={client.lastWorkout ? `${client.lastWorkout.name} · ${client.lastWorkout.meta}` : "Истории пока нет"} />
                  <InfoLine label="Рекомендация" value={client.recommendedTemplate ?? "Тренировка на все тело"} />
                  <InfoLine label="Заметка тренера" value={client.coachNote} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Выбери шаблон</p>
                <div className="mt-3 space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => onAssign(template)}
                      className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-left transition hover:border-lime-300/30 hover:bg-lime-300/5"
                    >
                      <span>
                        <span className="block text-sm font-medium text-zinc-100">{template}</span>
                        <span className="mt-1 block text-xs text-zinc-500">Назначить сейчас и убрать клиента из блока действий.</span>
                      </span>
                      <ArrowRight className="size-4 text-zinc-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-zinc-800 bg-zinc-950 px-5 py-4">
              <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
                <Link href={`/trainer/builder?clientId=${client.id}`}>
                  <Dumbbell className="size-4" />
                  Доработать
                </Link>
              </Button>
              <Button type="button" onClick={() => onAssign(client.recommendedTemplate ?? "Тренировка на все тело")} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
                Назначить рекомендацию
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm text-zinc-200">{value}</p>
    </div>
  );
}
