"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  MessageSquareText,
  Send,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Weight,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { TeamClient } from "@/components/trainer-os/home/types";

type WorkoutReviewDrawerProps = {
  client: TeamClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendReview: (clientId: string) => void;
  onSendReviewAndAssign: (client: TeamClient) => void;
};

const feedbackPresets = [
  {
    label: "Отличная работа",
    text: "Отличная работа. Тренировка закрыта уверенно, сильные подходы фиксирую как хороший шаг вперёд.",
  },
  {
    label: "Держим темп",
    text: "Держим текущий темп. Нагрузка рабочая, на следующей тренировке важно сохранить качество повторений.",
  },
  {
    label: "Нужен делод",
    text: "Нагрузка была высокой, поэтому в следующей тренировке немного снизим объём и дадим восстановиться.",
  },
  {
    label: "Пора увеличить нагрузку",
    text: "Есть запас по качеству движения. На следующей тренировке можно аккуратно поднять нагрузку.",
  },
];

const exerciseExceptions = [
  {
    title: "Жим лёжа",
    plan: "8 повторений",
    fact: "6 повторений",
    signal: "−2 повтора от плана",
    tone: "warning",
  },
  {
    title: "Тяга верхнего блока",
    plan: "65 кг × 10",
    fact: "70 кг × 8",
    signal: "личный рекорд по весу",
    tone: "positive",
  },
  {
    title: "Разведения в стороны",
    plan: "12 повторений",
    fact: "10 повторений",
    signal: "комментарий про плечо",
    tone: "risk",
  },
] as const;

export function WorkoutReviewDrawer({
  client,
  open,
  onOpenChange,
  onSendReview,
  onSendReviewAndAssign,
}: WorkoutReviewDrawerProps) {
  const [feedback, setFeedback] = useState(feedbackPresets[1].text);
  const [selectedPreset, setSelectedPreset] = useState(feedbackPresets[1].label);

  function sendReview() {
    if (!client) return;
    onSendReview(client.id);
  }

  function sendReviewAndAssign() {
    if (!client) return;
    onSendReviewAndAssign(client);
  }

  function selectPreset(preset: (typeof feedbackPresets)[number]) {
    setSelectedPreset(preset.label);
    setFeedback(preset.text);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[96vw] max-w-[1040px] gap-0 border-zinc-800 bg-[#070707] p-0 text-zinc-100 sm:max-w-[1040px]"
      >
        <SheetHeader className="border-b border-zinc-800/80 px-5 py-4">
          <div className="flex flex-col gap-1 pr-10">
            <SheetTitle className="text-xl font-semibold tracking-tight text-zinc-50">Разбор тренировки</SheetTitle>
            <SheetDescription className="text-zinc-500">
              Быстро понять исключения, отправить комментарий и закрыть задачу.
            </SheetDescription>
          </div>
        </SheetHeader>

        {client ? (
          <>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <ReviewHeaderCard client={client} />

              <div className="grid gap-4">
                <WorkoutSummary />
                <ExerciseExceptions />
                <ClientComment />
                <CoachFeedback
                  feedback={feedback}
                  selectedPreset={selectedPreset}
                  onSelectPreset={selectPreset}
                  onFeedbackChange={setFeedback}
                />
              </div>
            </div>

            <SheetFooter className="border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-sm text-zinc-500">
                  Разбор готов к отправке · задача будет закрыта
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={sendReview} className="rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
                    <Send className="size-4" />
                    Отправить разбор
                  </Button>
                  <Button
                    type="button"
                    onClick={sendReviewAndAssign}
                    variant="outline"
                    className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900"
                  >
                    Отправить и назначить следующую
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
                    <Link href={`/trainer/clients/${client.id}`}>
                      <UserRound className="size-4" />
                      Открыть профиль
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReviewHeaderCard({ client }: { client: TeamClient }) {
  return (
    <aside className="rounded-[28px] border border-zinc-800 bg-zinc-950/72 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Клиент</p>
      <div className="mt-4 flex items-center gap-3">
        <Avatar className="size-14 border border-zinc-800 bg-zinc-950">
          <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{client.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-zinc-50">{client.name}</h3>
          <p className="mt-1 truncate text-sm text-zinc-500">{client.goal}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <ContextRow label="Тренировка" value={client.nextWorkout ?? "День жима"} />
        <ContextRow label="Завершена" value={client.lastActivity} />
        <ContextRow label="Статус" value={client.stateLabel} />
      </div>

      <div className="mt-5 rounded-2xl border border-rose-300/18 bg-rose-300/8 p-3">
        <p className="text-sm font-medium text-rose-100">Тренировка ждёт разбора</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-100/62">
          Есть высокий уровень нагрузки и несколько отклонений от плана.
        </p>
      </div>
    </aside>
  );
}

function WorkoutSummary() {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(5,5,5,0.88))] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Сводка</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Что важно по тренировке</h3>
        </div>
        <span className="w-fit rounded-full border border-amber-300/24 bg-amber-300/8 px-3 py-1 text-xs text-amber-100">
          Проверить перед следующей
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <SummaryFact icon={Timer} label="Длительность" value="72 мин" tone="neutral" />
        <SummaryFact icon={Weight} label="Объём" value="7420 кг" tone="neutral" />
        <SummaryFact icon={AlertTriangle} label="Нагрузка" value="9/10" tone="warning" />
        <SummaryFact icon={Sparkles} label="Сигналы" value="3" tone="positive" />
      </div>
    </section>
  );
}

function ExerciseExceptions() {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/68 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Только исключения</p>
        <h3 className="text-xl font-semibold tracking-tight text-zinc-50">Упражнения, требующие внимания</h3>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {exerciseExceptions.map((exercise) => (
          <div key={exercise.title} className={cn("rounded-2xl border p-3", exceptionToneClass[exercise.tone])}>
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-50">{exercise.title}</h4>
              {exercise.tone === "positive" ? <Trophy className="size-4 text-lime-100" /> : <AlertTriangle className="size-4" />}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniFact label="План" value={exercise.plan} />
              <MiniFact label="Факт" value={exercise.fact} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{exercise.signal}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClientComment() {
  return (
    <section className="rounded-[24px] border border-zinc-800 bg-black/24 p-4">
      <div className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800">
          <MessageSquareText className="size-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">Комментарий клиента</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            “Последний подход в жиме был тяжёлый. В разведениях немного тянуло плечо, но без резкой боли.”
          </p>
        </div>
      </div>
    </section>
  );
}

type CoachFeedbackProps = {
  feedback: string;
  selectedPreset: string;
  onSelectPreset: (preset: (typeof feedbackPresets)[number]) => void;
  onFeedbackChange: (value: string) => void;
};

function CoachFeedback({ feedback, selectedPreset, onSelectPreset, onFeedbackChange }: CoachFeedbackProps) {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/72 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/70">Ответ тренера</p>
        <h3 className="text-xl font-semibold tracking-tight text-zinc-50">Быстрая обратная связь</h3>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {feedbackPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={cn(
              "rounded-full border px-3 py-2 text-sm transition",
              selectedPreset === preset.label
                ? "border-lime-300/45 bg-lime-300/12 text-lime-100"
                : "border-zinc-800 bg-black/18 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <Textarea
        value={feedback}
        onChange={(event) => onFeedbackChange(event.target.value)}
        className="mt-4 min-h-28 resize-none rounded-2xl border-zinc-800 bg-black/24 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
      />
    </section>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/70 bg-black/18 px-3 py-2">
      <span className="text-xs text-zinc-600">{label}</span>
      <span className="text-sm font-medium text-zinc-200">{value}</span>
    </div>
  );
}

function SummaryFact({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone: "neutral" | "warning" | "positive";
}) {
  const toneClass = {
    neutral: "border-zinc-800 bg-black/18 text-zinc-300",
    warning: "border-amber-300/20 bg-amber-300/8 text-amber-100",
    positive: "border-lime-300/20 bg-lime-300/8 text-lime-100",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-3", toneClass)}>
      <Icon className="size-4" />
      <p className="mt-3 text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

const exceptionToneClass = {
  warning: "border-amber-300/18 bg-amber-300/7 text-amber-100",
  positive: "border-lime-300/18 bg-lime-300/7 text-lime-100",
  risk: "border-rose-300/18 bg-rose-300/7 text-rose-100",
} as const;
