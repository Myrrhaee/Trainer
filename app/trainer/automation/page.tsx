"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RadioTower,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn, createSafeId } from "@/lib/utils";

type RuleTrigger = "missed_workout" | "stale_checkin" | "new_purchase" | "review_ready";
type RuleChannel = "message" | "calendar" | "task";
type RuleStatus = "active" | "paused";
type QueueStatus = "ready" | "scheduled" | "done";
type RuleFilter = "all" | "active" | "paused";

type AutomationRule = {
  id: string;
  title: string;
  trigger: RuleTrigger;
  channel: RuleChannel;
  delay: string;
  status: RuleStatus;
  audience: string;
  message: string;
  lastRun: string;
  runs: number;
  successRate: number;
};

type AutomationQueueItem = {
  id: string;
  clientId: string;
  client: string;
  ruleId: string;
  reason: string;
  due: string;
  status: QueueStatus;
};

const LOCAL_RULES_KEY = "trainer-automation-rules-v1";
const LOCAL_QUEUE_KEY = "trainer-automation-queue-v1";

const triggerLabels: Record<RuleTrigger, string> = {
  missed_workout: "Пропуск тренировки",
  stale_checkin: "Нет чек-ина",
  new_purchase: "Новая покупка",
  review_ready: "Разбор готов",
};

const channelLabels: Record<RuleChannel, string> = {
  message: "Сообщение",
  calendar: "Календарь",
  task: "Задача",
};

const initialRules: AutomationRule[] = [
  {
    id: "rule-missed-workout",
    title: "Вернуть после пропуска",
    trigger: "missed_workout",
    channel: "message",
    delay: "через 3 часа",
    status: "active",
    audience: "Клиенты с активной программой",
    message: "Вижу, тренировка выпала. Давай сегодня сделаем короткую версию и сохраним ритм.",
    lastRun: "32 мин",
    runs: 18,
    successRate: 72,
  },
  {
    id: "rule-stale-checkin",
    title: "Запросить чек-ин",
    trigger: "stale_checkin",
    channel: "message",
    delay: "через 24 часа",
    status: "active",
    audience: "Без чек-ина 5+ дней",
    message: "Пришли вес, самочувствие и пару строк по питанию. По ним скорректирую неделю.",
    lastRun: "Сегодня",
    runs: 12,
    successRate: 81,
  },
  {
    id: "rule-new-purchase",
    title: "Старт после покупки",
    trigger: "new_purchase",
    channel: "calendar",
    delay: "сразу",
    status: "active",
    audience: "Новые покупатели",
    message: "Создать стартовый слот, проверить анкету и назначить первую неделю.",
    lastRun: "Вчера",
    runs: 7,
    successRate: 100,
  },
  {
    id: "rule-review-ready",
    title: "Отдать разбор",
    trigger: "review_ready",
    channel: "task",
    delay: "до 19:00",
    status: "paused",
    audience: "Завершенные тренировки",
    message: "Поставить задачу на комментарий по технике и прогрессии нагрузки.",
    lastRun: "2 дня",
    runs: 24,
    successRate: 88,
  },
];

const initialQueue: AutomationQueueItem[] = [
  {
    id: "queue-artem",
    clientId: "artem-smirnov",
    client: "Артём Смирнов",
    ruleId: "rule-missed-workout",
    reason: "2 пропуска подряд",
    due: "Сейчас",
    status: "ready",
  },
  {
    id: "queue-ekaterina",
    clientId: "ekaterina-morozova",
    client: "Екатерина Морозова",
    ruleId: "rule-stale-checkin",
    reason: "Нет замеров 10 дней",
    due: "Через 2 часа",
    status: "scheduled",
  },
  {
    id: "queue-egor",
    clientId: "egor-nikitin",
    client: "Егор Никитин",
    ruleId: "rule-new-purchase",
    reason: "Клиент готов к старту",
    due: "Сегодня",
    status: "ready",
  },
];

const filterItems: Array<{ value: RuleFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "paused", label: "Пауза" },
];

function emptyRule() {
  return {
    title: "",
    trigger: "missed_workout" as RuleTrigger,
    channel: "message" as RuleChannel,
    delay: "через 3 часа",
    audience: "Клиенты с активной программой",
    message: "",
  };
}

function isRule(value: unknown): value is AutomationRule {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AutomationRule>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.delay === "string" &&
    typeof item.audience === "string" &&
    typeof item.message === "string" &&
    typeof item.lastRun === "string" &&
    typeof item.runs === "number" &&
    typeof item.successRate === "number" &&
    (item.status === "active" || item.status === "paused") &&
    (item.trigger === "missed_workout" ||
      item.trigger === "stale_checkin" ||
      item.trigger === "new_purchase" ||
      item.trigger === "review_ready") &&
    (item.channel === "message" || item.channel === "calendar" || item.channel === "task")
  );
}

function isQueueItem(value: unknown): value is AutomationQueueItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AutomationQueueItem>;
  return (
    typeof item.id === "string" &&
    typeof item.clientId === "string" &&
    typeof item.client === "string" &&
    typeof item.ruleId === "string" &&
    typeof item.reason === "string" &&
    typeof item.due === "string" &&
    (item.status === "ready" || item.status === "scheduled" || item.status === "done")
  );
}

function readLocalRules() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_RULES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isRule) ? parsed : null;
  } catch {
    return null;
  }
}

function readLocalQueue() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isQueueItem) ? parsed : null;
  } catch {
    return null;
  }
}

function persistRules(rules: AutomationRule[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify(rules));
}

function persistQueue(queue: AutomationQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(queue));
}

function ruleStatusClasses(status: RuleStatus) {
  if (status === "active") return "border-lime-300/18 bg-lime-300/10 text-lime-100";
  return "border-zinc-800 bg-black/18 text-zinc-500";
}

function queueStatusClasses(status: QueueStatus) {
  if (status === "ready") return "border-orange-300/18 bg-orange-300/10 text-orange-100";
  if (status === "done") return "border-lime-300/18 bg-lime-300/10 text-lime-100";
  return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
}

export default function TrainerAutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>(() => readLocalRules() ?? initialRules);
  const [queue, setQueue] = useState<AutomationQueueItem[]>(() => readLocalQueue() ?? initialQueue);
  const [filter, setFilter] = useState<RuleFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyRule);

  useEffect(() => {
    persistRules(rules);
  }, [rules]);

  useEffect(() => {
    persistQueue(queue);
  }, [queue]);

  const visibleRules = useMemo(() => {
    if (filter === "all") return rules;
    return rules.filter((rule) => rule.status === filter);
  }, [filter, rules]);

  const readyQueue = queue.filter((item) => item.status === "ready").length;
  const activeRules = rules.filter((rule) => rule.status === "active").length;
  const totalRuns = rules.reduce((sum, rule) => sum + rule.runs, 0);
  const averageSuccess = Math.round(
    rules.reduce((sum, rule) => sum + rule.successRate, 0) / Math.max(1, rules.length)
  );

  function toggleRule(ruleId: string) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? { ...rule, status: rule.status === "active" ? "paused" : "active" }
          : rule
      )
    );
    toast.success("Правило обновлено");
  }

  function duplicateRule(rule: AutomationRule) {
    setRules((current) => [
      {
        ...rule,
        id: createSafeId(),
        title: `${rule.title} · копия`,
        status: "paused",
        lastRun: "не запускалось",
        runs: 0,
      },
      ...current,
    ]);
    toast.success("Правило скопировано");
  }

  function runRule(rule: AutomationRule) {
    setRules((current) =>
      current.map((item) =>
        item.id === rule.id ? { ...item, lastRun: "Сейчас", runs: item.runs + 1 } : item
      )
    );
    toast.success("Тестовый запуск добавлен");
  }

  function updateQueueStatus(itemId: string, status: QueueStatus) {
    setQueue((current) => current.map((item) => (item.id === itemId ? { ...item, status } : item)));
    toast.success(status === "done" ? "Follow-up закрыт" : "Follow-up возвращен в работу");
  }

  function handleCreateRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const message = form.message.trim();

    if (!title || !message) return;

    setRules((current) => [
      {
        id: createSafeId(),
        title,
        trigger: form.trigger,
        channel: form.channel,
        delay: form.delay,
        status: "active",
        audience: form.audience,
        message,
        lastRun: "не запускалось",
        runs: 0,
        successRate: 100,
      },
      ...current,
    ]);
    setForm(emptyRule());
    setSheetOpen(false);
    toast.success("Правило создано");
  }

  return (
    <TrainerShell
      title="Автоматизация"
      eyebrow="Операционная система"
      description="Правила follow-up, напоминания и действия, которые удерживают клиентов в ритме."
      headerAction={
        <Button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex"
        >
          <Plus className="mr-2 h-4 w-4" />
          Новое правило
        </Button>
      }
    >
      <div className="space-y-5" data-trainer-automation>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Активные правила", value: activeRules, helper: "запускаются автоматически", icon: RadioTower },
            { label: "Готово сейчас", value: readyQueue, helper: "follow-up к отправке", icon: AlertTriangle },
            { label: "Запусков", value: totalRuns, helper: "за текущий период", icon: PlayCircle },
            { label: "Успешность", value: `${averageSuccess}%`, helper: "по завершенным сценариям", icon: CheckCircle2 },
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
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                      {metric.value}
                    </p>
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-zinc-500">Правила</p>
                <h2 className="mt-1 text-base font-semibold text-zinc-50">Сценарии тренера</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filterItems.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
                      filter === item.value
                        ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                        : "border-zinc-800 bg-black/18 text-zinc-500 hover:text-zinc-200"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2" data-automation-rules>
              {visibleRules.map((rule) => (
                <article
                  key={rule.id}
                  className="rounded-[1.25rem] border border-zinc-800 bg-black/22 p-4"
                  data-automation-rule={rule.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-50">{rule.title}</h3>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", ruleStatusClasses(rule.status))}>
                          {rule.status === "active" ? "Активно" : "Пауза"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        {triggerLabels[rule.trigger]} · {channelLabels[rule.channel]} · {rule.delay}
                      </p>
                    </div>
                    <Switch
                      checked={rule.status === "active"}
                      onCheckedChange={() => toggleRule(rule.id)}
                      aria-label={`${rule.title}: активность`}
                    />
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-zinc-800 bg-zinc-950/70 p-3">
                    <p className="text-xs text-zinc-500">{rule.audience}</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-300">{rule.message}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-[0.95rem] border border-zinc-800 bg-black/18 p-2">
                      <p className="text-zinc-600">Запуск</p>
                      <p className="mt-1 text-zinc-200">{rule.lastRun}</p>
                    </div>
                    <div className="rounded-[0.95rem] border border-zinc-800 bg-black/18 p-2">
                      <p className="text-zinc-600">Всего</p>
                      <p className="mt-1 text-zinc-200">{rule.runs}</p>
                    </div>
                    <div className="rounded-[0.95rem] border border-zinc-800 bg-black/18 p-2">
                      <p className="text-zinc-600">Успех</p>
                      <p className="mt-1 text-zinc-200">{rule.successRate}%</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => runRule(rule)}
                      className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                      data-run-automation={rule.id}
                    >
                      <PlayCircle className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Тест</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateRule(rule)}
                      className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                    >
                      <Copy className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Копия</span>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                    >
                      <Link href="/trainer/settings">
                        <Settings2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Права</span>
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Очередь</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-50">Follow-up</h2>
                </div>
                <Sparkles className="h-4 w-4 text-lime-200" />
              </div>

              <div className="mt-4 space-y-3" data-automation-queue>
                {queue.map((item) => {
                  const rule = rules.find((candidate) => candidate.id === item.ruleId);
                  return (
                    <article
                      key={item.id}
                      className="rounded-[1.15rem] border border-zinc-800 bg-black/22 p-3"
                      data-automation-queue-item={item.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100">{item.client}</p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.reason}</p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", queueStatusClasses(item.status))}>
                          {item.status === "ready" ? "Сейчас" : item.status === "done" ? "Готово" : "План"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {item.due}
                        </span>
                        <span>{rule?.title ?? "Правило"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                        >
                          <Link href={`/trainer/clients/${item.clientId}`}>
                            <UserRound className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                        >
                          <Link href="/trainer/messages">
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateQueueStatus(item.id, item.status === "done" ? "ready" : "done")}
                          className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                        >
                          {item.status === "done" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <p className="text-xs text-zinc-500">Связанные разделы</p>
              <div className="mt-4 grid gap-2">
                <Button asChild variant="outline" className="justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                  <Link href="/trainer/messages">
                    <Send className="mr-2 h-4 w-4" />
                    Сообщения
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                  <Link href="/trainer/calendar">
                    <Calendar className="mr-2 h-4 w-4" />
                    Календарь
                  </Link>
                </Button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Новое правило</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Сценарий будет сохранен локально и готов к будущей серверной синхронизации.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateRule} className="space-y-4 px-4 pb-6">
            <div className="space-y-2">
              <Label htmlFor="automation-title" className="text-zinc-300">Название</Label>
              <Input
                id="automation-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-full border-zinc-800 bg-black/24 text-zinc-100"
                placeholder="Напомнить после пропуска"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="automation-trigger" className="text-zinc-300">Триггер</Label>
                <select
                  id="automation-trigger"
                  value={form.trigger}
                  onChange={(event) => setForm((current) => ({ ...current, trigger: event.target.value as RuleTrigger }))}
                  className="h-10 w-full rounded-full border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
                >
                  {Object.entries(triggerLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-channel" className="text-zinc-300">Канал</Label>
                <select
                  id="automation-channel"
                  value={form.channel}
                  onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as RuleChannel }))}
                  className="h-10 w-full rounded-full border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
                >
                  {Object.entries(channelLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="automation-delay" className="text-zinc-300">Задержка</Label>
                <Input
                  id="automation-delay"
                  value={form.delay}
                  onChange={(event) => setForm((current) => ({ ...current, delay: event.target.value }))}
                  className="rounded-full border-zinc-800 bg-black/24 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="automation-audience" className="text-zinc-300">Сегмент</Label>
                <Input
                  id="automation-audience"
                  value={form.audience}
                  onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                  className="rounded-full border-zinc-800 bg-black/24 text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="automation-message" className="text-zinc-300">Текст действия</Label>
              <Textarea
                id="automation-message"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="min-h-28 rounded-[1.15rem] border-zinc-800 bg-black/24 text-zinc-100"
                placeholder="Что должно произойти или какое сообщение отправить"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Закрыть
              </Button>
              <Button
                type="submit"
                disabled={!form.title.trim() || !form.message.trim()}
                className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                data-create-automation
              >
                <RadioTower className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </TrainerShell>
  );
}
