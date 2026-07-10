"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  Dumbbell,
  FileText,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { cn, createSafeId } from "@/lib/utils";

type ReportStatus = "draft" | "ready" | "sent";
type ReportFilter = "all" | "draft" | "ready" | "sent";

type ClientReport = {
  id: string;
  clientId: string;
  client: string;
  goal: string;
  period: string;
  status: ReportStatus;
  summary: string;
  wins: string[];
  risks: string[];
  nextFocus: string[];
  metrics: {
    adherence: number;
    workouts: string;
    weight: string;
    response: string;
  };
  updatedAt: string;
  sentAt?: string;
};

const LOCAL_REPORTS_KEY = "trainer-client-reports-v1";

const clients = [
  { id: "maria-volkova", name: "Мария Волкова", goal: "Снижение веса" },
  { id: "artem-smirnov", name: "Артём Смирнов", goal: "Набор массы" },
  { id: "egor-nikitin", name: "Егор Никитин", goal: "Рекомпозиция" },
  { id: "ekaterina-morozova", name: "Екатерина Морозова", goal: "Гипертрофия" },
  { id: "irina-kozlova", name: "Ирина Козлова", goal: "Сила и тонус" },
];

const initialReports: ClientReport[] = [
  {
    id: "report-maria",
    clientId: "maria-volkova",
    client: "Мария Волкова",
    goal: "Снижение веса",
    period: "10-16 июня",
    status: "ready",
    summary: "Неделя стабильная: ритм удержан, вес движется в нужном коридоре, техника приседа требует одного уточнения.",
    wins: ["3 тренировки выполнены", "Средний вес ниже на 1.2 кг", "Чек-ин отправлен вовремя"],
    risks: ["Колени уходят внутрь в нижней точке приседа"],
    nextFocus: ["Оставить дефицит без усиления", "Разобрать присед", "Добавить паузу 1 сек в нижней точке"],
    metrics: { adherence: 84, workouts: "3/3", weight: "-1.2 кг", response: "14 мин" },
    updatedAt: "Сегодня",
  },
  {
    id: "report-artem",
    clientId: "artem-smirnov",
    client: "Артём Смирнов",
    goal: "Набор массы",
    period: "10-16 июня",
    status: "draft",
    summary: "Ритм просел из-за работы. Важно вернуть движение без попытки догнать весь объем сразу.",
    wins: ["Вес не просел", "Клиент сам написал о проблеме"],
    risks: ["2 тренировки подряд пропущены", "Нужно снизить входной порог"],
    nextFocus: ["Короткая тренировка 25 минут", "Follow-up через сообщения", "Пересобрать неделю без перегруза"],
    metrics: { adherence: 52, workouts: "1/3", weight: "+0.4 кг", response: "27 мин" },
    updatedAt: "32 мин",
  },
  {
    id: "report-egor",
    clientId: "egor-nikitin",
    client: "Егор Никитин",
    goal: "Рекомпозиция",
    period: "Старт",
    status: "draft",
    summary: "Анкета заполнена, запрос понятен: убрать живот и сохранить силовые. Нужен стартовый план.",
    wins: ["Высокая мотивация", "Анкета заполнена в день покупки"],
    risks: ["Программа еще не назначена"],
    nextFocus: ["Назначить первую неделю", "Дать правила прогрессии", "Запросить стартовые фото"],
    metrics: { adherence: 0, workouts: "0/0", weight: "старт", response: "9 мин" },
    updatedAt: "1 ч",
  },
  {
    id: "report-irina",
    clientId: "irina-kozlova",
    client: "Ирина Козлова",
    goal: "Сила и тонус",
    period: "10-16 июня",
    status: "sent",
    summary: "Сильная неделя: высокий ритм, техника стабильна, можно аккуратно поднимать нагрузку.",
    wins: ["4 тренировки выполнены", "Соблюдение 91%", "Готова к прогрессии"],
    risks: ["Следить за восстановлением после ног"],
    nextFocus: ["Добавить 2.5 кг в жим", "Оставить RPE не выше 8", "Проверить сон после ног"],
    metrics: { adherence: 91, workouts: "4/4", weight: "-0.3 кг", response: "11 мин" },
    updatedAt: "Вчера",
    sentAt: "Вчера",
  },
];

const filterItems: Array<{ value: ReportFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "draft", label: "Черновики" },
  { value: "ready", label: "Готовые" },
  { value: "sent", label: "Отправлено" },
];

function emptyForm() {
  return {
    clientId: clients[0].id,
    period: "10-16 июня",
    summary: "",
    wins: "",
    risks: "",
    nextFocus: "",
  };
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isReport(value: unknown): value is ClientReport {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ClientReport>;
  return (
    typeof item.id === "string" &&
    typeof item.clientId === "string" &&
    typeof item.client === "string" &&
    typeof item.goal === "string" &&
    typeof item.period === "string" &&
    typeof item.summary === "string" &&
    typeof item.updatedAt === "string" &&
    (item.status === "draft" || item.status === "ready" || item.status === "sent") &&
    Array.isArray(item.wins) &&
    Array.isArray(item.risks) &&
    Array.isArray(item.nextFocus) &&
    item.wins.every((entry) => typeof entry === "string") &&
    item.risks.every((entry) => typeof entry === "string") &&
    item.nextFocus.every((entry) => typeof entry === "string") &&
    typeof item.metrics === "object" &&
    item.metrics !== null
  );
}

function readLocalReports() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isReport) ? parsed : null;
  } catch {
    return null;
  }
}

function persistReports(reports: ClientReport[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
}

function statusClasses(status: ReportStatus) {
  if (status === "sent") return "border-lime-300/18 bg-lime-300/10 text-lime-100";
  if (status === "ready") return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
  return "border-zinc-800 bg-black/18 text-zinc-500";
}

function statusLabel(status: ReportStatus) {
  if (status === "sent") return "Отправлено";
  if (status === "ready") return "Готов";
  return "Черновик";
}

function listFromText(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TrainerReportsPage() {
  const [reports, setReports] = useState<ClientReport[]>(() => readLocalReports() ?? initialReports);
  const [selectedReportId, setSelectedReportId] = useState(initialReports[0]?.id ?? "");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const visibleReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesFilter = filter === "all" || report.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        report.client.toLowerCase().includes(normalizedQuery) ||
        report.goal.toLowerCase().includes(normalizedQuery) ||
        report.summary.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, query, reports]);

  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? visibleReports[0] ?? reports[0];
  const readyCount = reports.filter((report) => report.status === "ready").length;
  const draftCount = reports.filter((report) => report.status === "draft").length;
  const sentCount = reports.filter((report) => report.status === "sent").length;
  const averageAdherence = Math.round(
    reports.reduce((sum, report) => sum + report.metrics.adherence, 0) / Math.max(1, reports.length)
  );

  function updateReports(nextReports: ClientReport[]) {
    setReports(nextReports);
    persistReports(nextReports);
  }

  function updateReportStatus(reportId: string, status: ReportStatus) {
    const nextReports = reports.map((report) =>
      report.id === reportId
        ? {
            ...report,
            status,
            updatedAt: "Сейчас",
            sentAt: status === "sent" ? "Сейчас" : report.sentAt,
          }
        : report
    );
    updateReports(nextReports);
    toast.success(status === "sent" ? "Отчет отмечен как отправленный" : "Статус отчета обновлен");
  }

  function duplicateReport(report: ClientReport) {
    const copy = {
      ...report,
      id: createSafeId(),
      status: "draft" as ReportStatus,
      period: `${report.period} · копия`,
      updatedAt: "Сейчас",
      sentAt: undefined,
    };
    updateReports([copy, ...reports]);
    setSelectedReportId(copy.id);
    toast.success("Отчет скопирован");
  }

  async function copyReport(report: ClientReport) {
    const text = [
      `${report.client} · ${report.period}`,
      report.summary,
      `Победы: ${report.wins.join("; ")}`,
      `Риски: ${report.risks.join("; ")}`,
      `Фокус: ${report.nextFocus.join("; ")}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Текст отчета скопирован");
    } catch {
      toast.warning("Не удалось скопировать текст");
    }
  }

  function handleCreateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = clients.find((item) => item.id === form.clientId) ?? clients[0];
    const summary = form.summary.trim();

    if (!summary) return;

    const report: ClientReport = {
      id: createSafeId(),
      clientId: client.id,
      client: client.name,
      goal: client.goal,
      period: form.period.trim() || "Текущая неделя",
      status: "draft",
      summary,
      wins: listFromText(form.wins),
      risks: listFromText(form.risks),
      nextFocus: listFromText(form.nextFocus),
      metrics: { adherence: 75, workouts: "2/3", weight: "н/д", response: "18 мин" },
      updatedAt: "Сейчас",
    };

    updateReports([report, ...reports]);
    setSelectedReportId(report.id);
    setForm(emptyForm());
    setSheetOpen(false);
    toast.success("Отчет создан");
  }

  return (
    <TrainerShell
      title="Отчеты"
      eyebrow="Клиентская коммуникация"
      description="Weekly review, прогресс, риски и следующий фокус в формате, который клиенту легко понять."
      headerAction={
        <Button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 xl:inline-flex"
        >
          <Plus className="mr-2 h-4 w-4" />
          Новый отчет
        </Button>
      }
    >
      <div className="space-y-5" data-trainer-reports>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Готовы", value: readyCount, helper: "можно отправлять", icon: CheckCircle2 },
            { label: "Черновики", value: draftCount, helper: "нужно дописать", icon: FileText },
            { label: "Отправлено", value: sentCount, helper: "клиент уже получил", icon: Send },
            { label: "Средний ритм", value: `${averageAdherence}%`, helper: "по отчетам", icon: TrendingUp },
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

        <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-black/24 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Клиент или отчет"
                className="h-7 border-0 bg-transparent px-0 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0"
              />
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

            <div className="mt-3 space-y-2" data-report-list>
              {visibleReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedReportId(report.id)}
                  data-report-card={report.id}
                  className={cn(
                    "w-full rounded-[1.18rem] border p-3 text-left transition",
                    selectedReport?.id === report.id
                      ? "border-lime-300/18 bg-lime-300/10"
                      : "border-zinc-800 bg-black/18 hover:border-zinc-700 hover:bg-zinc-900/60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 rounded-full bg-zinc-900">
                      <AvatarFallback className="bg-zinc-900 text-xs text-zinc-100">
                        {initials(report.client)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">{report.client}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{report.period}</p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", statusClasses(report.status))}>
                          {statusLabel(report.status)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-500">{report.summary}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            {selectedReport ? (
              <>
                <div className="border-b border-zinc-800 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{selectedReport.client}</h2>
                        <span className={cn("rounded-full border px-2.5 py-1 text-xs", statusClasses(selectedReport.status))}>
                          {statusLabel(selectedReport.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{selectedReport.goal} · {selectedReport.period}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => duplicateReport(selectedReport)}
                        className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Копия
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateReportStatus(selectedReport.id, selectedReport.status === "sent" ? "ready" : "sent")}
                        className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                        data-send-report={selectedReport.id}
                      >
                        {selectedReport.status === "sent" ? (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {selectedReport.status === "sent" ? "Вернуть" : "Отправить"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <article className="min-w-0 rounded-[1.25rem] border border-zinc-800 bg-black/24 p-5" data-report-preview>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Weekly review</p>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">{selectedReport.period}</h3>
                      </div>
                      <FileText className="h-5 w-5 text-lime-200" />
                    </div>

                    <p className="mt-5 text-sm leading-relaxed text-zinc-300">{selectedReport.summary}</p>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Ритм", value: `${selectedReport.metrics.adherence}%`, icon: CheckCircle2 },
                        { label: "Тренировки", value: selectedReport.metrics.workouts, icon: Dumbbell },
                        { label: "Ответ", value: selectedReport.metrics.response, icon: Clock3 },
                      ].map((metric) => {
                        const Icon = metric.icon;
                        return (
                          <div key={metric.label} className="rounded-[1rem] border border-zinc-800 bg-zinc-950/70 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-zinc-600">{metric.label}</p>
                              <Icon className="h-3.5 w-3.5 text-zinc-600" />
                            </div>
                            <p className="mt-2 text-lg font-semibold text-zinc-100">{metric.value}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      {[
                        { title: "Победы", items: selectedReport.wins, icon: Sparkles, tone: "lime" },
                        { title: "Риски", items: selectedReport.risks, icon: AlertTriangle, tone: "orange" },
                        { title: "Фокус", items: selectedReport.nextFocus, icon: Calendar, tone: "cyan" },
                      ].map((block) => {
                        const Icon = block.icon;
                        return (
                          <section key={block.title} className="rounded-[1.05rem] border border-zinc-800 bg-zinc-950/70 p-4">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", block.tone === "orange" ? "text-orange-200" : block.tone === "cyan" ? "text-cyan-200" : "text-lime-200")} />
                              <h4 className="text-sm font-semibold text-zinc-100">{block.title}</h4>
                            </div>
                            <ul className="mt-3 space-y-2">
                              {block.items.map((item) => (
                                <li key={item} className="text-xs leading-relaxed text-zinc-500">{item}</li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </article>

                  <aside className="space-y-3">
                    <div className="rounded-[1.2rem] border border-zinc-800 bg-black/24 p-4">
                      <p className="text-xs text-zinc-500">Доставка</p>
                      <div className="mt-3 space-y-2 text-sm text-zinc-400">
                        <div className="flex items-center justify-between gap-3">
                          <span>Обновлен</span>
                          <span className="text-zinc-100">{selectedReport.updatedAt}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Отправлен</span>
                          <span className="text-zinc-100">{selectedReport.sentAt ?? "-"}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyReport(selectedReport)}
                      className="w-full justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Скопировать текст
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                      <Link href="/trainer/messages">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Открыть сообщения
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                      <Link href={`/trainer/clients/${selectedReport.clientId}`}>
                        <UserRound className="mr-2 h-4 w-4" />
                        Профиль клиента
                      </Link>
                    </Button>
                  </aside>
                </div>
              </>
            ) : null}
          </main>
        </section>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Новый отчет</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Черновик сохранится локально и будет готов к отправке клиенту.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateReport} className="space-y-4 px-4 pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-client" className="text-zinc-300">Клиент</Label>
                <select
                  id="report-client"
                  value={form.clientId}
                  onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                  className="h-10 w-full rounded-full border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-period" className="text-zinc-300">Период</Label>
                <Input
                  id="report-period"
                  value={form.period}
                  onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                  className="rounded-full border-zinc-800 bg-black/24 text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-summary" className="text-zinc-300">Итог недели</Label>
              <Textarea
                id="report-summary"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                className="min-h-24 rounded-[1.15rem] border-zinc-800 bg-black/24 text-zinc-100"
                placeholder="Короткий вывод для клиента"
              />
            </div>

            {[
              { id: "wins", label: "Победы", value: form.wins, placeholder: "Каждый пункт с новой строки" },
              { id: "risks", label: "Риски", value: form.risks, placeholder: "Каждый пункт с новой строки" },
              { id: "nextFocus", label: "Следующий фокус", value: form.nextFocus, placeholder: "Каждый пункт с новой строки" },
            ].map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={`report-${field.id}`} className="text-zinc-300">{field.label}</Label>
                <Textarea
                  id={`report-${field.id}`}
                  value={field.value}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [field.id]: event.target.value }))
                  }
                  className="min-h-20 rounded-[1.15rem] border-zinc-800 bg-black/24 text-zinc-100"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
              >
                Закрыть
              </Button>
              <Button
                type="submit"
                disabled={!form.summary.trim()}
                className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                data-create-report
              >
                <FileText className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </TrainerShell>
  );
}
