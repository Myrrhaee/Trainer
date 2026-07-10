"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  Dumbbell,
  MessageCircle,
  RadioTower,
  RotateCcw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InsightSegment = "all" | "risk" | "growth" | "new";
type InsightTone = "risk" | "stable" | "growth";
type ActionStatus = "open" | "done";

type ClientInsight = {
  id: string;
  name: string;
  goal: string;
  segment: Exclude<InsightSegment, "all">;
  tone: InsightTone;
  health: number;
  adherence: number;
  progress: string;
  revenue: string;
  lastSignal: string;
  driver: string;
  recommendedAction: string;
  actionHref: string;
};

type InsightAction = {
  id: string;
  clientId: string;
  title: string;
  detail: string;
  owner: string;
  due: string;
  status: ActionStatus;
  href: string;
};

const segmentItems: Array<{ value: InsightSegment; label: string }> = [
  { value: "all", label: "Все" },
  { value: "risk", label: "Риски" },
  { value: "growth", label: "Рост" },
  { value: "new", label: "Новые" },
];

const initialInsights: ClientInsight[] = [
  {
    id: "maria-volkova",
    name: "Мария Волкова",
    goal: "Снижение веса",
    segment: "growth",
    tone: "growth",
    health: 86,
    adherence: 84,
    progress: "-1.2 кг",
    revenue: "12 900 ₽",
    lastSignal: "Видео приседа и чек-ин сегодня",
    driver: "Стабильная неделя, техника требует короткого разбора",
    recommendedAction: "Ответить по приседу и закрепить текущий темп",
    actionHref: "/trainer/messages",
  },
  {
    id: "artem-smirnov",
    name: "Артём Смирнов",
    goal: "Набор массы",
    segment: "risk",
    tone: "risk",
    health: 48,
    adherence: 52,
    progress: "+0.4 кг",
    revenue: "9 900 ₽",
    lastSignal: "2 пропуска подряд",
    driver: "Падает ритм тренировок, клиент просит план восстановления",
    recommendedAction: "Запустить follow-up и короткую тренировку",
    actionHref: "/trainer/automation",
  },
  {
    id: "egor-nikitin",
    name: "Егор Никитин",
    goal: "Рекомпозиция",
    segment: "new",
    tone: "stable",
    health: 63,
    adherence: 0,
    progress: "старт",
    revenue: "14 900 ₽",
    lastSignal: "Анкета заполнена сегодня",
    driver: "Высокий intent, но программа еще не назначена",
    recommendedAction: "Собрать стартовую неделю",
    actionHref: "/trainer/builder",
  },
  {
    id: "ekaterina-morozova",
    name: "Екатерина Морозова",
    goal: "Гипертрофия",
    segment: "risk",
    tone: "risk",
    health: 57,
    adherence: 63,
    progress: "+0.2 кг",
    revenue: "12 900 ₽",
    lastSignal: "Нет свежих замеров 10 дней",
    driver: "Нужно вернуть регулярный чек-ин и сон",
    recommendedAction: "Запросить замеры и сон за 3 дня",
    actionHref: "/trainer/messages",
  },
  {
    id: "irina-kozlova",
    name: "Ирина Козлова",
    goal: "Сила и тонус",
    segment: "growth",
    tone: "growth",
    health: 91,
    adherence: 91,
    progress: "-0.3 кг",
    revenue: "15 900 ₽",
    lastSignal: "Тренировка завершена сегодня",
    driver: "Высокая дисциплина, можно повышать нагрузку",
    recommendedAction: "Дать прогрессию на следующую неделю",
    actionHref: "/trainer/builder",
  },
];

const initialActions: InsightAction[] = [
  {
    id: "action-artem",
    clientId: "artem-smirnov",
    title: "Вернуть Артёма в ритм",
    detail: "Сценарий после пропуска и короткий блок на 25 минут",
    owner: "Авто + тренер",
    due: "Сегодня",
    status: "open",
    href: "/trainer/automation",
  },
  {
    id: "action-egor",
    clientId: "egor-nikitin",
    title: "Назначить стартовую неделю",
    detail: "Первый план, базовые упражнения и вводный комментарий",
    owner: "Тренер",
    due: "Сегодня",
    status: "open",
    href: "/trainer/builder",
  },
  {
    id: "action-kate",
    clientId: "ekaterina-morozova",
    title: "Запросить замеры",
    detail: "Вес, окружности, сон и аппетит после ног",
    owner: "Сообщения",
    due: "2 часа",
    status: "open",
    href: "/trainer/messages",
  },
  {
    id: "action-maria",
    clientId: "maria-volkova",
    title: "Закрыть разбор техники",
    detail: "Комментарий по коленям в приседе",
    owner: "Сообщения",
    due: "Сегодня",
    status: "done",
    href: "/trainer/messages",
  },
];

const trendBars = [62, 66, 64, 71, 76, 78, 82, 84];

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneClasses(tone: InsightTone) {
  if (tone === "risk") return "border-orange-300/20 bg-orange-300/10 text-orange-100";
  if (tone === "growth") return "border-lime-300/18 bg-lime-300/10 text-lime-100";
  return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
}

function healthBarClasses(tone: InsightTone) {
  if (tone === "risk") return "bg-orange-300";
  if (tone === "growth") return "bg-lime-300";
  return "bg-cyan-300";
}

export default function TrainerInsightsPage() {
  const [segment, setSegment] = useState<InsightSegment>("all");
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<InsightAction[]>(initialActions);

  const visibleInsights = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialInsights.filter((item) => {
      const matchesSegment = segment === "all" || item.segment === segment;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.goal.toLowerCase().includes(normalizedQuery) ||
        item.driver.toLowerCase().includes(normalizedQuery);

      return matchesSegment && matchesQuery;
    });
  }, [query, segment]);

  const riskCount = initialInsights.filter((item) => item.tone === "risk").length;
  const growthCount = initialInsights.filter((item) => item.tone === "growth").length;
  const averageHealth = Math.round(
    initialInsights.reduce((sum, item) => sum + item.health, 0) / initialInsights.length
  );
  const openActions = actions.filter((action) => action.status === "open").length;

  function toggleAction(actionId: string) {
    setActions((current) =>
      current.map((action) =>
        action.id === actionId
          ? { ...action, status: action.status === "open" ? "done" : "open" }
          : action
      )
    );
    toast.success("Статус действия обновлен");
  }

  return (
    <TrainerShell
      title="Инсайты"
      eyebrow="Качество ведения"
      description="Риски, удержание, прогресс клиентов и действия, которые стоит сделать сегодня."
      headerAction={
        <Button
          asChild
          className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex"
        >
          <Link href="/trainer/automation">
            <RadioTower className="mr-2 h-4 w-4" />
            Автоматизация
          </Link>
        </Button>
      }
    >
      <div className="space-y-5" data-trainer-insights>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Health score", value: averageHealth, helper: "средний индекс клиентов", icon: BarChart3 },
            { label: "Риски", value: riskCount, helper: "требуют контакта", icon: AlertTriangle },
            { label: "Рост", value: growthCount, helper: "можно усиливать прогресс", icon: TrendingUp },
            { label: "Действия", value: openActions, helper: "открытые задачи", icon: Sparkles },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.label}
                className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{metric.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-lime-200">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">{metric.helper}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-4">
            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Клиенты</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-50">Сигналы по ведению</h2>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-black/24 px-3 py-2">
                    <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Клиент или сигнал"
                      className="h-7 w-full border-0 bg-transparent px-0 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 sm:w-48"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {segmentItems.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSegment(item.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
                          segment === item.value
                            ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                            : "border-zinc-800 bg-black/18 text-zinc-500 hover:text-zinc-200"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3" data-insight-client-list>
                {visibleInsights.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[1.25rem] border border-zinc-800 bg-black/22 p-4"
                    data-insight-client={item.id}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-11 w-11 rounded-full bg-zinc-900">
                            <AvatarFallback className="bg-zinc-900 text-xs text-zinc-100">
                              {initials(item.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-zinc-50">{item.name}</h3>
                              <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", toneClasses(item.tone))}>
                                {item.tone === "risk" ? "Риск" : item.tone === "growth" ? "Рост" : "Стабильно"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">{item.goal}</p>
                            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.driver}</p>
                            <p className="mt-2 text-xs leading-relaxed text-lime-100/80">{item.recommendedAction}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Health</span>
                            <span className="font-medium text-zinc-100">{item.health}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-zinc-900">
                            <div
                              className={cn("h-full rounded-full", healthBarClasses(item.tone))}
                              style={{ width: `${item.health}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-[0.9rem] border border-zinc-800 bg-zinc-950/70 p-2">
                            <p className="text-zinc-600">Ритм</p>
                            <p className="mt-1 text-zinc-200">{item.adherence}%</p>
                          </div>
                          <div className="rounded-[0.9rem] border border-zinc-800 bg-zinc-950/70 p-2">
                            <p className="text-zinc-600">Прогресс</p>
                            <p className="mt-1 text-zinc-200">{item.progress}</p>
                          </div>
                          <div className="rounded-[0.9rem] border border-zinc-800 bg-zinc-950/70 p-2">
                            <p className="text-zinc-600">MRR</p>
                            <p className="mt-1 text-zinc-200">{item.revenue}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            asChild
                            size="sm"
                            className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                          >
                            <Link href={item.actionHref}>
                              <ArrowUpRight className="mr-2 h-4 w-4" />
                              Действие
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                          >
                            <Link href={`/trainer/clients/${item.id}`}>
                              <UserRound className="mr-2 h-4 w-4" />
                              Клиент
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Тренд</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-50">Качество ведения</h2>
                </div>
                <TrendingUp className="h-4 w-4 text-lime-200" />
              </div>
              <div className="mt-5 flex h-32 items-end gap-2" data-insight-trend>
                {trendBars.map((value, index) => (
                  <div key={`${value}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-full bg-[linear-gradient(180deg,rgba(190,242,100,0.88),rgba(45,212,191,0.28))]"
                      style={{ height: `${value}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-[1rem] border border-zinc-800 bg-black/18 p-3">
                  <p className="text-xs text-zinc-600">Удержание</p>
                  <p className="mt-1 text-zinc-100">92%</p>
                </div>
                <div className="rounded-[1rem] border border-zinc-800 bg-black/18 p-3">
                  <p className="text-xs text-zinc-600">Ответ</p>
                  <p className="mt-1 text-zinc-100">18 мин</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Сегодня</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-50">Действия</h2>
                </div>
                <Clock3 className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="mt-4 space-y-3" data-insight-actions>
                {actions.map((action) => (
                  <article
                    key={action.id}
                    className={cn(
                      "rounded-[1.1rem] border p-3",
                      action.status === "done"
                        ? "border-lime-300/14 bg-lime-300/8"
                        : "border-zinc-800 bg-black/22"
                    )}
                    data-insight-action={action.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{action.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{action.detail}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          action.status === "done"
                            ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                            : "border-orange-300/18 bg-orange-300/10 text-orange-100"
                        )}
                      >
                        {action.status === "done" ? "Готово" : "Открыто"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>{action.owner}</span>
                      <span className="text-zinc-700">/</span>
                      <span>{action.due}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                      >
                        <Link href={action.href}>
                          {action.href.includes("messages") ? (
                            <MessageCircle className="mr-2 h-4 w-4" />
                          ) : action.href.includes("builder") ? (
                            <Dumbbell className="mr-2 h-4 w-4" />
                          ) : (
                            <RadioTower className="mr-2 h-4 w-4" />
                          )}
                          Открыть
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => toggleAction(action.id)}
                        className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                        data-toggle-insight-action={action.id}
                      >
                        {action.status === "done" ? (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        {action.status === "done" ? "Вернуть" : "Готово"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <p className="text-xs text-zinc-500">Причины риска</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Пропуски", value: 42, icon: TrendingDown },
                  { label: "Нет чек-ина", value: 31, icon: Calendar },
                  { label: "Нет программы", value: 27, icon: Dumbbell },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 text-zinc-400">
                          <Icon className="h-3.5 w-3.5 text-zinc-600" />
                          {item.label}
                        </span>
                        <span className="text-zinc-100">{item.value}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-zinc-900">
                        <div className="h-full rounded-full bg-orange-300" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </TrainerShell>
  );
}
