"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Clock3,
  Dumbbell,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_TRAINER, isDemoModeEnabled } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase-client";
import { cn, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

type ThreadStatus = "open" | "risk" | "resolved";
type ThreadFilter = "all" | "unread" | "risk" | "resolved";
type MessageAuthor = "trainer" | "client";

type Message = {
  id: string;
  author: MessageAuthor;
  body: string;
  time: string;
  status?: "sent" | "read";
};

type ClientThread = {
  id: string;
  clientId: string;
  clientName: string;
  goal: string;
  status: ThreadStatus;
  unread: boolean;
  lastSeen: string;
  responseTime: string;
  priority: string;
  tags: string[];
  messages: Message[];
};

type ReplyTemplate = {
  id: string;
  title: string;
  tone: string;
  body: string;
};

type SyncSource = "loading" | "server" | "local" | "demo";
type SyncStatus = "loading" | "saved" | "local" | "saving" | "error";

type MessageSyncState = {
  source: SyncSource;
  status: SyncStatus;
  message: string;
  trainerId: string | null;
  schemaMissing: boolean;
  updatedAt: string | null;
};

type MessageMetadata = {
  clientName?: unknown;
  goal?: unknown;
  threadStatus?: unknown;
  priority?: unknown;
  tags?: unknown;
};

type TrainerClientMessageRow = {
  id: string;
  trainer_id: string;
  client_id: string;
  sender_role: "trainer" | "client";
  body: string;
  status: "draft" | "sent" | "read";
  metadata: MessageMetadata | null;
  created_at: string;
  read_at: string | null;
};

const filterItems: Array<{ value: ThreadFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "unread", label: "Новые" },
  { value: "risk", label: "Риски" },
  { value: "resolved", label: "Закрыто" },
];

const replyTemplates: ReplyTemplate[] = [
  {
    id: "missed-workout",
    title: "Пропуск тренировки",
    tone: "Поддержка",
    body: "Вижу, что тренировка выпала из ритма. Давай не будем откатываться: сегодня сделай короткую версию на 25 минут, а я подстрою следующую нагрузку.",
  },
  {
    id: "check-in",
    title: "Запрос чек-ина",
    tone: "Контроль",
    body: "Пришли, пожалуйста, вес, самочувствие и пару строк по питанию за последние 2 дня. По ним точнее решу, оставляем ли текущий темп.",
  },
  {
    id: "technique",
    title: "Разбор техники",
    tone: "Форма",
    body: "По видео видно хороший контроль, но в нижней точке теряется корпус. В следующем подходе снизь вес на 5-10% и держи паузу 1 секунду.",
  },
  {
    id: "win",
    title: "Усилить прогресс",
    tone: "Мотивация",
    body: "Отличная неделя. Самое ценное сейчас - удержать повторяемость. Я оставлю прогрессию аккуратной, чтобы прибавка не сломала технику.",
  },
];

const LOCAL_THREADS_STORAGE_KEY = "trainer-message-threads-v1";

const initialSyncState: MessageSyncState = {
  source: "loading",
  status: "loading",
  message: "Загружаем диалоги",
  trainerId: null,
  schemaMissing: false,
  updatedAt: null,
};

const initialThreads: ClientThread[] = [
  {
    id: "thread-maria",
    clientId: "maria-volkova",
    clientName: "Мария Волкова",
    goal: "Снижение веса",
    status: "open",
    unread: true,
    lastSeen: "8 мин",
    responseTime: "14 мин",
    priority: "Ждет разбор",
    tags: ["техника", "питание"],
    messages: [
      {
        id: "maria-1",
        author: "client",
        body: "Отправила видео приседа и чек-ин. Вес стоит третий день, но по самочувствию все нормально.",
        time: "10:42",
      },
      {
        id: "maria-2",
        author: "trainer",
        body: "Видео вижу. Вес пока не трогаем: по недельной средней динамика все еще в нужном коридоре.",
        time: "10:48",
        status: "read",
      },
      {
        id: "maria-3",
        author: "client",
        body: "Ок, тогда жду комментарий по коленям в приседе.",
        time: "10:56",
      },
    ],
  },
  {
    id: "thread-artem",
    clientId: "artem-smirnov",
    clientName: "Артём Смирнов",
    goal: "Набор массы",
    status: "risk",
    unread: true,
    lastSeen: "32 мин",
    responseTime: "27 мин",
    priority: "2 пропуска подряд",
    tags: ["риск", "ритм"],
    messages: [
      {
        id: "artem-1",
        author: "client",
        body: "На этой неделе завал на работе. Пропустил ноги и спину, не понимаю, как догнать.",
        time: "09:31",
      },
      {
        id: "artem-2",
        author: "trainer",
        body: "Догонять все сразу не будем. Соберу короткий блок, чтобы вернуться без перегруза.",
        time: "09:39",
        status: "read",
      },
    ],
  },
  {
    id: "thread-egor",
    clientId: "egor-nikitin",
    clientName: "Егор Никитин",
    goal: "Рекомпозиция",
    status: "open",
    unread: false,
    lastSeen: "1 ч",
    responseTime: "9 мин",
    priority: "Стартовая программа",
    tags: ["новый", "анкета"],
    messages: [
      {
        id: "egor-1",
        author: "client",
        body: "Заполнил анкету. Основной запрос - убрать живот и не потерять силовые.",
        time: "Вчера",
      },
      {
        id: "egor-2",
        author: "trainer",
        body: "Принял. Сегодня соберу стартовый план и оставлю первые ориентиры по питанию.",
        time: "Вчера",
        status: "read",
      },
    ],
  },
  {
    id: "thread-ekaterina",
    clientId: "ekaterina-morozova",
    clientName: "Екатерина Морозова",
    goal: "Гипертрофия",
    status: "resolved",
    unread: false,
    lastSeen: "Вчера",
    responseTime: "18 мин",
    priority: "Чек-ин закрыт",
    tags: ["замеры", "сон"],
    messages: [
      {
        id: "kate-1",
        author: "client",
        body: "Замеры отправила. Сон лучше, но аппетит стал выше после ног.",
        time: "Вчера",
      },
      {
        id: "kate-2",
        author: "trainer",
        body: "По замерам все ровно. Добавлю небольшой перекус в тренировочные дни и посмотрим неделю.",
        time: "Вчера",
        status: "read",
      },
    ],
  },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusLabel(status: ThreadStatus) {
  if (status === "risk") return "Риск";
  if (status === "resolved") return "Закрыто";
  return "В работе";
}

function statusClasses(status: ThreadStatus) {
  if (status === "risk") return "border-orange-300/18 bg-orange-300/10 text-orange-100";
  if (status === "resolved") return "border-emerald-300/18 bg-emerald-300/10 text-emerald-100";
  return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
}

let supabaseClient: SupabaseClient | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }

  return supabaseClient;
}

function cloneInitialThreads() {
  return initialThreads.map((thread) => ({
    ...thread,
    tags: [...thread.tags],
    messages: thread.messages.map((message) => ({ ...message })),
  }));
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Message>;
  return (
    typeof item.id === "string" &&
    (item.author === "trainer" || item.author === "client") &&
    typeof item.body === "string" &&
    typeof item.time === "string"
  );
}

function isThread(value: unknown): value is ClientThread {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ClientThread>;
  return (
    typeof item.id === "string" &&
    typeof item.clientId === "string" &&
    typeof item.clientName === "string" &&
    typeof item.goal === "string" &&
    (item.status === "open" || item.status === "risk" || item.status === "resolved") &&
    typeof item.unread === "boolean" &&
    typeof item.lastSeen === "string" &&
    typeof item.responseTime === "string" &&
    typeof item.priority === "string" &&
    Array.isArray(item.tags) &&
    item.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(item.messages) &&
    item.messages.every(isMessage)
  );
}

function readLocalThreads() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_THREADS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isThread) ? parsed : null;
  } catch (error) {
    console.error("trainer messages local restore failed", error);
    return null;
  }
}

function persistLocalThreads(threads: ClientThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_THREADS_STORAGE_KEY, JSON.stringify(threads));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function safeMetadataValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeMetadataTags(value: unknown) {
  return Array.isArray(value) && value.every((tag) => typeof tag === "string") ? value : null;
}

function safeThreadStatus(value: unknown): ThreadStatus | null {
  return value === "open" || value === "risk" || value === "resolved" ? value : null;
}

function formatServerTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Сейчас";

  const now = Date.now();
  const deltaMinutes = Math.max(0, Math.round((now - date.getTime()) / 60000));

  if (deltaMinutes < 2) return "Сейчас";
  if (deltaMinutes < 60) return `${deltaMinutes} мин`;
  if (deltaMinutes < 60 * 24) return `${Math.round(deltaMinutes / 60)} ч`;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function threadsFromRows(rows: TrainerClientMessageRow[]) {
  const grouped = rows.reduce((acc, row) => {
    const items = acc.get(row.client_id) ?? [];
    items.push(row);
    acc.set(row.client_id, items);
    return acc;
  }, new Map<string, TrainerClientMessageRow[]>());

  return Array.from(grouped.entries()).map(([clientId, items]) => {
    const sortedItems = [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const last = sortedItems[sortedItems.length - 1];
    const metadata = last?.metadata ?? {};
    const seed = initialThreads.find((thread) => thread.clientId === clientId);
    const clientName =
      safeMetadataValue(metadata.clientName) ?? seed?.clientName ?? `Клиент ${clientId.slice(0, 8)}`;
    const status = safeThreadStatus(metadata.threadStatus) ?? seed?.status ?? "open";
    const tags = safeMetadataTags(metadata.tags) ?? seed?.tags ?? ["диалог"];

    return {
      id: `thread-${clientId}`,
      clientId,
      clientName,
      goal: safeMetadataValue(metadata.goal) ?? seed?.goal ?? "Персональное сопровождение",
      status,
      unread: sortedItems.some(
        (message) => message.sender_role === "client" && message.status !== "read"
      ),
      lastSeen: last ? formatServerTime(last.created_at) : seed?.lastSeen ?? "Сейчас",
      responseTime: seed?.responseTime ?? "15 мин",
      priority: safeMetadataValue(metadata.priority) ?? seed?.priority ?? "Диалог активен",
      tags,
      messages: sortedItems.map((message) => ({
        id: message.id,
        author: message.sender_role,
        body: message.body,
        time: formatServerTime(message.created_at),
        status: message.sender_role === "trainer" ? message.status === "read" ? "read" : "sent" : undefined,
      })),
    } satisfies ClientThread;
  });
}

export default function TrainerMessagesPage() {
  const [threads, setThreads] = useState<ClientThread[]>(() => cloneInitialThreads());
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreads[0]?.id ?? "");
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(replyTemplates[0]?.id ?? "");
  const [syncState, setSyncState] = useState<MessageSyncState>(initialSyncState);

  useEffect(() => {
    let active = true;

    async function initializeMessages() {
      const localThreads = readLocalThreads();
      const fallbackThreads = localThreads ?? cloneInitialThreads();

      if (isDemoModeEnabled()) {
        if (!active) return;
        setThreads(fallbackThreads);
        setSelectedThreadId(fallbackThreads[0]?.id ?? "");
        setSyncState({
          source: "demo",
          status: "saved",
          message: "Demo-режим: диалоги сохраняются локально",
          trainerId: DEMO_TRAINER.id,
          schemaMissing: false,
          updatedAt: null,
        });
        return;
      }

      setSyncState({
        ...initialSyncState,
        message: "Загружаем диалоги из Supabase",
      });

      try {
        const supabase = getSupabase();
        const userResult = await supabase.auth.getUser();
        const user = userResult.data.user;

        if (userResult.error || !user) {
          if (userResult.error) logSupabaseError("trainer messages user load failed", userResult.error);
          if (!active) return;
          setThreads(fallbackThreads);
          setSelectedThreadId(fallbackThreads[0]?.id ?? "");
          setSyncState({
            source: "local",
            status: "local",
            message: "Нет активной сессии тренера: показана локальная копия",
            trainerId: null,
            schemaMissing: false,
            updatedAt: null,
          });
          return;
        }

        const result = await supabase
          .from("trainer_client_messages")
          .select("id, trainer_id, client_id, sender_role, body, status, metadata, created_at, read_at")
          .eq("trainer_id", user.id)
          .order("created_at", { ascending: true })
          .limit(240);

        if (isSupabaseSchemaMismatch(result.error)) {
          if (!active) return;
          persistLocalThreads(fallbackThreads);
          setThreads(fallbackThreads);
          setSelectedThreadId(fallbackThreads[0]?.id ?? "");
          setSyncState({
            source: "local",
            status: "local",
            message: "Миграция сообщений ещё не применена: работаем локально",
            trainerId: user.id,
            schemaMissing: true,
            updatedAt: null,
          });
          return;
        }

        if (result.error) {
          logSupabaseError("trainer messages load failed", result.error);
          if (!active) return;
          setThreads(fallbackThreads);
          setSelectedThreadId(fallbackThreads[0]?.id ?? "");
          setSyncState({
            source: "local",
            status: "error",
            message: "Не удалось загрузить Supabase: показана локальная копия",
            trainerId: user.id,
            schemaMissing: false,
            updatedAt: null,
          });
          return;
        }

        const serverThreads = threadsFromRows((result.data ?? []) as TrainerClientMessageRow[]);
        const nextThreads = serverThreads.length > 0 ? serverThreads : fallbackThreads;

        if (!active) return;
        persistLocalThreads(nextThreads);
        setThreads(nextThreads);
        setSelectedThreadId(nextThreads[0]?.id ?? "");
        setSyncState({
          source: "server",
          status: serverThreads.length > 0 ? "saved" : "local",
          message:
            serverThreads.length > 0
              ? "Диалоги загружены из Supabase"
              : "Серверных сообщений пока нет: показана локальная копия",
          trainerId: user.id,
          schemaMissing: false,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        logSupabaseError("trainer messages initialize failed", error);
        if (!active) return;
        setThreads(fallbackThreads);
        setSelectedThreadId(fallbackThreads[0]?.id ?? "");
        setSyncState({
          source: "local",
          status: "error",
          message: "Ошибка синхронизации: показана локальная копия",
          trainerId: null,
          schemaMissing: false,
          updatedAt: null,
        });
      }
    }

    void initializeMessages();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (syncState.source === "loading") return;
    persistLocalThreads(threads);
  }, [syncState.source, threads]);

  const visibleThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && thread.unread) ||
        (filter === "risk" && thread.status === "risk") ||
        (filter === "resolved" && thread.status === "resolved");
      const matchesQuery =
        normalizedQuery.length === 0 ||
        thread.clientName.toLowerCase().includes(normalizedQuery) ||
        thread.goal.toLowerCase().includes(normalizedQuery) ||
        thread.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return matchesFilter && matchesQuery;
    });
  }, [filter, query, threads]);

  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? visibleThreads[0] ?? threads[0];
  const selectedTemplate =
    replyTemplates.find((template) => template.id === selectedTemplateId) ?? replyTemplates[0];

  const openCount = threads.filter((thread) => thread.status !== "resolved").length;
  const unreadCount = threads.filter((thread) => thread.unread).length;
  const riskCount = threads.filter((thread) => thread.status === "risk").length;
  const resolvedCount = threads.filter((thread) => thread.status === "resolved").length;
  const syncLabel =
    syncState.source === "server"
      ? "Supabase"
      : syncState.source === "demo"
        ? "Demo"
        : syncState.source === "loading"
          ? "Загрузка"
          : "Локально";

  async function markThreadReadOnServer(thread: ClientThread) {
    if (syncState.source !== "server" || !syncState.trainerId || !isUuid(thread.clientId)) return;

    const result = await getSupabase()
      .from("trainer_client_messages")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("trainer_id", syncState.trainerId)
      .eq("client_id", thread.clientId)
      .eq("sender_role", "client")
      .neq("status", "read");

    if (isSupabaseSchemaMismatch(result.error)) {
      setSyncState((current) => ({
        ...current,
        source: "local",
        status: "local",
        schemaMissing: true,
        message: "Миграция сообщений ещё не применена: read-state сохранён локально",
      }));
      return;
    }

    if (result.error) {
      logSupabaseError("trainer messages mark read failed", result.error);
    }
  }

  async function saveMessageToServer(thread: ClientThread, body: string) {
    if (syncState.source !== "server" || !syncState.trainerId || !isUuid(thread.clientId)) {
      setSyncState((current) => ({
        ...current,
        status: "local",
        message: "Сообщение сохранено локально до появления серверного клиента",
      }));
      return { ok: true, mode: "local" as const };
    }

    setSyncState((current) => ({
      ...current,
      status: "saving",
      message: "Сохраняем сообщение в Supabase",
    }));

    const result = await getSupabase()
      .from("trainer_client_messages")
      .insert({
        trainer_id: syncState.trainerId,
        client_id: thread.clientId,
        sender_role: "trainer",
        body,
        status: "sent",
        metadata: {
          clientName: thread.clientName,
          goal: thread.goal,
          threadStatus: thread.status === "resolved" ? "open" : thread.status,
          priority: thread.priority,
          tags: thread.tags,
        },
      })
      .select("id, trainer_id, client_id, sender_role, body, status, metadata, created_at, read_at")
      .single();

    if (isSupabaseSchemaMismatch(result.error)) {
      setSyncState((current) => ({
        ...current,
        source: "local",
        status: "local",
        schemaMissing: true,
        message: "Миграция сообщений ещё не применена: сохранено локально",
      }));
      return { ok: true, mode: "local" as const };
    }

    if (result.error || !result.data) {
      logSupabaseError("trainer messages save failed", result.error);
      setSyncState((current) => ({
        ...current,
        status: "error",
        message: "Не удалось сохранить в Supabase, локальная копия обновлена",
      }));
      return { ok: false, mode: "server" as const };
    }

    setSyncState((current) => ({
      ...current,
      source: "server",
      status: "saved",
      message: "Сообщение сохранено в Supabase",
      updatedAt: (result.data as TrainerClientMessageRow).created_at,
    }));
    return { ok: true, mode: "server" as const };
  }

  function selectThread(threadId: string) {
    const thread = threads.find((item) => item.id === threadId);
    setSelectedThreadId(threadId);
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, unread: false } : thread))
    );
    if (thread?.unread) {
      void markThreadReadOnServer(thread);
    }
  }

  function applyTemplate(template: ReplyTemplate) {
    setSelectedTemplateId(template.id);
    setComposer(template.body);
  }

  function updateThreadStatus(status: ThreadStatus) {
    if (!selectedThread) return;

    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              status,
              unread: status === "resolved" ? false : thread.unread,
              priority: status === "resolved" ? "Диалог закрыт" : thread.priority,
            }
          : thread
      )
    );
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composer.trim();

    if (!selectedThread || body.length === 0) return;

    const message: Message = {
      id: `trainer-${Date.now()}`,
      author: "trainer",
      body,
      time: "Сейчас",
      status: "sent",
    };

    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              unread: false,
              status: thread.status === "resolved" ? "open" : thread.status,
              lastSeen: "Сейчас",
              messages: [...thread.messages, message],
            }
          : thread
      )
    );
    setComposer("");
    const result = await saveMessageToServer(selectedThread, body);

    if (result.ok && result.mode === "server") {
      toast.success("Сообщение сохранено в Supabase");
      return;
    }

    if (result.ok) {
      toast.success("Сообщение сохранено локально");
      return;
    }

    toast.warning("Локальная копия обновлена, Supabase не принял сообщение");
  }

  return (
    <TrainerShell
      title="Сообщения"
      eyebrow="Коммуникация"
      description="Диалоги с клиентами, быстрые ответы и обращения, которые влияют на удержание."
      headerAction={
        <Button
          asChild
          className="hidden rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200 xl:inline-flex"
        >
          <Link href="/trainer/clients">
            <UserRound className="mr-2 h-4 w-4" />
            Клиенты
          </Link>
        </Button>
      }
    >
      <div className="space-y-4" data-trainer-messages>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Открытые", value: openCount, helper: "в активной работе", icon: MessageCircle },
            { label: "Новые", value: unreadCount, helper: "ждут ответа", icon: Sparkles },
            { label: "Риски", value: riskCount, helper: "могут сорвать ритм", icon: AlertTriangle },
            { label: "Закрыто", value: resolvedCount, helper: "за последние сутки", icon: CheckCircle2 },
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

        <section className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className="min-w-0 rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-black/24 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Клиент, тег или цель"
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

            <div className="mt-3 space-y-2">
              {visibleThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  data-thread-card={thread.id}
                  className={cn(
                    "w-full rounded-[1.2rem] border p-3 text-left transition",
                    selectedThread?.id === thread.id
                      ? "border-lime-300/18 bg-lime-300/10"
                      : "border-zinc-800 bg-black/18 hover:border-zinc-700 hover:bg-zinc-900/60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 rounded-full bg-zinc-900">
                      <AvatarFallback className="bg-zinc-900 text-xs text-zinc-100">
                        {initials(thread.clientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {thread.clientName}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{thread.goal}</p>
                        </div>
                        {thread.unread ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-lime-300" aria-label="Новое" />
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[11px]",
                            statusClasses(thread.status)
                          )}
                        >
                          {statusLabel(thread.status)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                          <Clock3 className="h-3 w-3" />
                          {thread.lastSeen}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {visibleThreads.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-zinc-800 bg-black/18 p-6 text-center">
                  <MessageCircle className="mx-auto h-5 w-5 text-zinc-600" />
                  <p className="mt-3 text-sm font-medium text-zinc-300">Диалоги не найдены</p>
                  <p className="mt-1 text-xs text-zinc-600">Измените фильтр или поисковый запрос.</p>
                </div>
              ) : null}
            </div>
          </aside>

          <main className="min-w-0 rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            {selectedThread ? (
              <>
                <div className="border-b border-zinc-800 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar className="h-12 w-12 rounded-full bg-zinc-900">
                        <AvatarFallback className="bg-zinc-900 text-zinc-100">
                          {initials(selectedThread.clientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold tracking-tight text-zinc-50">
                            {selectedThread.clientName}
                          </h2>
                          <span className={cn("rounded-full border px-2.5 py-1 text-xs", statusClasses(selectedThread.status))}>
                            {statusLabel(selectedThread.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{selectedThread.goal}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedThread.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-zinc-800 bg-black/18 px-2.5 py-1 text-xs text-zinc-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                      >
                        <Link href={`/trainer/clients/${selectedThread.clientId}`}>
                          <UserRound className="mr-2 h-4 w-4" />
                          Клиент
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                      >
                        <Link href={`/trainer/builder?clientId=${selectedThread.clientId}`}>
                          <Dumbbell className="mr-2 h-4 w-4" />
                          План
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[560px] min-h-[360px] space-y-3 overflow-y-auto p-4">
                  {selectedThread.messages.map((message) => {
                    const isTrainer = message.author === "trainer";
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isTrainer ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[88%] rounded-[1.2rem] border px-4 py-3 sm:max-w-[72%]",
                            isTrainer
                              ? "border-lime-300/18 bg-lime-300/10 text-lime-50"
                              : "border-zinc-800 bg-black/24 text-zinc-100"
                          )}
                        >
                          <p className="text-sm leading-relaxed">{message.body}</p>
                          <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-zinc-500">
                            <span>{message.time}</span>
                            {isTrainer && message.status ? <span>{message.status === "read" ? "прочитано" : "отправлено"}</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSend} className="border-t border-zinc-800 p-4">
                  <div className="flex flex-col gap-3">
                    <Textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      placeholder="Ответ клиенту"
                      data-message-composer
                      className="min-h-24 rounded-[1.15rem] border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-lime-300/40"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Ответ обычно: {selectedThread.responseTime}
                        </span>
                        <span className="hidden text-zinc-700 sm:inline">/</span>
                        <span>{selectedThread.priority}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:flex">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateThreadStatus(selectedThread.status === "resolved" ? "open" : "resolved")}
                          className="rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                        >
                          {selectedThread.status === "resolved" ? (
                            <RotateCcw className="h-4 w-4 sm:mr-2" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 sm:mr-2" />
                          )}
                          <span className="hidden sm:inline">
                            {selectedThread.status === "resolved" ? "Вернуть" : "Закрыть"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateThreadStatus("risk")}
                          className="rounded-full border-orange-300/20 bg-orange-300/10 text-orange-100 hover:bg-orange-300/15"
                        >
                          <AlertTriangle className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Риск</span>
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          data-message-send
                          className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                          disabled={composer.trim().length === 0}
                        >
                          <Send className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Отправить</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </>
            ) : null}
          </main>

          <aside className="min-w-0 space-y-4">
            <div
              className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]"
              data-message-sync-state
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                    syncState.source === "server"
                      ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                      : syncState.status === "error"
                        ? "border-orange-300/18 bg-orange-300/10 text-orange-100"
                        : "border-zinc-800 bg-black/24 text-zinc-400"
                  )}
                >
                  <Cloud className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Синхронизация</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-50">{syncLabel}</h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        syncState.status === "saved"
                          ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
                          : syncState.status === "error"
                            ? "border-orange-300/18 bg-orange-300/10 text-orange-100"
                            : "border-zinc-800 bg-black/18 text-zinc-500"
                      )}
                    >
                      {syncState.status === "saving" ? "сохраняем" : syncState.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{syncState.message}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Быстрые ответы</p>
                  <h3 className="mt-1 text-sm font-semibold text-zinc-50">Шаблоны</h3>
                </div>
                <Sparkles className="h-4 w-4 text-lime-200" />
              </div>
              <div className="mt-4 space-y-2">
                {replyTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    data-template-card={template.id}
                    onClick={() => applyTemplate(template)}
                    className={cn(
                      "w-full rounded-[1.1rem] border p-3 text-left transition",
                      selectedTemplate?.id === template.id
                        ? "border-lime-300/18 bg-lime-300/10"
                        : "border-zinc-800 bg-black/18 hover:border-zinc-700 hover:bg-zinc-900/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{template.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{template.tone}</p>
                      </div>
                      <Send className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-500">
                      {template.body}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <p className="text-xs text-zinc-500">Фокус диалога</p>
              <h3 className="mt-1 text-sm font-semibold text-zinc-50">
                {selectedThread?.priority ?? "Нет выбранного диалога"}
              </h3>
              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-800 bg-black/18 px-3 py-2">
                  <span>Средний ответ</span>
                  <span className="text-zinc-100">{selectedThread?.responseTime ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-zinc-800 bg-black/18 px-3 py-2">
                  <span>Последняя активность</span>
                  <span className="text-zinc-100">{selectedThread?.lastSeen ?? "-"}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </TrainerShell>
  );
}
