"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Dumbbell, Minus, TrendingUp, UserRound } from "lucide-react";

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

import type { TeamClient } from "@/components/trainer-os/home/types";

type QuickAssignDrawerProps = {
  client: TeamClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (clientId: string) => void;
  onAssignNext: (clientId: string) => void;
};

const templates = [
  {
    id: "pull-day",
    name: "День тяги",
    helper: "Спина, задняя дельта, бицепс",
    tag: "Рекомендовано",
  },
  {
    id: "upper-light",
    name: "Лёгкий верх",
    helper: "Снижение нагрузки после тяжёлого жима",
    tag: "Избранное",
  },
  {
    id: "full-body-b",
    name: "Полное тело B",
    helper: "Универсальный день на 55 минут",
    tag: "Недавнее",
  },
];

const previousLoads = [
  {
    exercise: "Жим лёжа",
    last: "80×6",
    best: "82.5×5",
    trend: "up",
  },
  {
    exercise: "Становая тяга",
    last: "120×5",
    best: "125×3",
    trend: "flat",
  },
  {
    exercise: "Тяга блока",
    last: "70×8",
    best: "70×8",
    trend: "up",
  },
];

const loadStrategies = ["Повторить", "+2.5 кг", "+5 кг", "Делоад", "Вручную"] as const;

export function QuickAssignDrawer({ client, open, onOpenChange, onAssign, onAssignNext }: QuickAssignDrawerProps) {
  const context = client ? getClientContext(client) : null;

  function assign() {
    if (!client) return;
    onAssign(client.id);
  }

  function assignNext() {
    if (!client) return;
    onAssignNext(client.id);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[96vw] max-w-[1180px] gap-0 border-zinc-800 bg-[#070707] p-0 text-zinc-100 sm:max-w-[1180px]"
      >
        <SheetHeader className="border-b border-zinc-800/80 px-5 py-4">
          <div className="flex flex-col gap-1 pr-10">
            <SheetTitle className="text-xl font-semibold tracking-tight text-zinc-50">Быстрое назначение</SheetTitle>
            <SheetDescription className="text-zinc-500">
              Следующая тренировка, нагрузки и подтверждение в одном окне.
            </SheetDescription>
          </div>
        </SheetHeader>

        {client && context ? (
          <>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_minmax(420px,1fr)_320px]">
              <ClientContextColumn client={client} context={context} />
              <RecommendationColumn />
              <PreviousLoadsColumn />
            </div>

            <div className="border-t border-zinc-800/80 bg-black/35 px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Стратегия нагрузки</p>
                  <p className="mt-1 text-sm text-zinc-400">По умолчанию повторяем рабочие веса и не форсируем прогрессию.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loadStrategies.map((strategy, index) => (
                    <button
                      key={strategy}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm transition",
                        index === 0
                          ? "border-lime-300/45 bg-lime-300/12 text-lime-100"
                          : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      {strategy}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-sm text-zinc-500">
                  Выбрано: <span className="font-medium text-zinc-200">День тяги</span> · Повторить веса
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={assign} className="rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
                    <CheckCircle2 className="size-4" />
                    Назначить
                  </Button>
                  <Button
                    type="button"
                    onClick={assignNext}
                    variant="outline"
                    className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900"
                  >
                    Назначить и следующий
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
                    <Link href="/trainer/builder">
                      <Dumbbell className="size-4" />
                      Открыть конструктор
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

function ClientContextColumn({ client, context }: { client: TeamClient; context: ClientContext }) {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/72 p-4">
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
        <ContextRow label="Текущий вес" value={context.weight} />
        <ContextRow label="Фаза" value={context.phase} />
        <ContextRow label="Активность" value={client.lastActivity} />
        <ContextRow label="Статус" value={client.stateLabel} />
      </div>

      <div className="mt-5 rounded-2xl border border-orange-300/18 bg-orange-300/8 p-3">
        <p className="text-sm font-medium text-orange-100">{client.issue ?? "Нужна следующая тренировка"}</p>
        <p className="mt-1 text-xs leading-relaxed text-orange-100/62">{client.context ?? "Контекст сохранён из текущего экрана."}</p>
      </div>

      <Button asChild variant="outline" className="mt-4 w-full rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
        <Link href={`/trainer/clients/${client.id}`}>
          <UserRound className="size-4" />
          Открыть профиль
        </Link>
      </Button>
    </section>
  );
}

function RecommendationColumn() {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(5,5,5,0.88))] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/70">Рекомендация</p>
      <div className="mt-4 rounded-[26px] border border-lime-300/24 bg-lime-300/8 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-50">День тяги</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Предыдущая тренировка была днём жима. Логично дать тяговой день и сохранить нагрузку без агрессивного повышения.
            </p>
          </div>
          <span className="w-fit rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-xs text-lime-100">
            Лучший следующий шаг
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <MiniFact label="Фокус" value="Спина + бицепс" />
          <MiniFact label="Время" value="55 мин" />
          <MiniFact label="Нагрузка" value="Повторить" />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-200">Альтернативные шаблоны</h4>
          <span className="text-xs text-zinc-600">Недавние · избранные · рекомендованные</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {templates.map((template, index) => (
            <button
              key={template.id}
              type="button"
              className={cn(
                "rounded-2xl border p-3 text-left transition",
                index === 0
                  ? "border-lime-300/35 bg-lime-300/8"
                  : "border-zinc-800 bg-black/18 hover:border-zinc-700 hover:bg-zinc-900/60"
              )}
            >
              <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">{template.tag}</span>
              <p className="mt-2 text-sm font-semibold text-zinc-50">{template.name}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{template.helper}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviousLoadsColumn() {
  return (
    <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/72 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Предыдущие нагрузки</p>
      <div className="mt-4 space-y-3">
        {previousLoads.map((load) => (
          <div key={load.exercise} className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">{load.exercise}</h3>
              <TrendIcon trend={load.trend} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <LoadFact label="Последний" value={load.last} />
              <LoadFact label="Лучший" value={load.best} />
            </div>
          </div>
        ))}
      </div>
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

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-black/18 px-3 py-2">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function LoadFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-lime-300/20 bg-lime-300/8 px-2 py-1 text-xs text-lime-100">
        <TrendingUp className="size-3" />
        вверх
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-black/20 px-2 py-1 text-xs text-zinc-400">
      <Minus className="size-3" />
      ровно
    </span>
  );
}

type ClientContext = {
  weight: string;
  phase: string;
};

function getClientContext(client: TeamClient): ClientContext {
  return clientContextMap[client.id] ?? { weight: "74.2 кг", phase: "Неделя 4 из 8" };
}

const clientContextMap: Record<string, ClientContext> = {
  "egor-nikitin": { weight: "82.4 кг", phase: "Стартовый цикл" },
  "artem-smirnov": { weight: "74.2 кг", phase: "Неделя 4 из 8" },
  "olga-sokolova": { weight: "61.8 кг", phase: "Неделя 3 из 6" },
};
