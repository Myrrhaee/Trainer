"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BarChart3,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  ExternalLink,
  FileText,
  Hammer,
  LayoutDashboard,
  Library,
  LucideIcon,
  MessageCircle,
  RadioTower,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  UserPlus,
  TrendingUp,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const trainerNav = [
  { href: "/trainer/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/trainer/clients", label: "Клиенты", icon: Users },
  { href: "/trainer/library", label: "Библиотека", icon: Library },
  { href: "/trainer/builder", label: "Шаблоны", icon: ClipboardList },
] as const;

type SearchItem = {
  title: string;
  helper: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

type NotificationTone = "risk" | "info" | "success";
type NotificationFilter = "all" | "unread" | "risk" | "done";
type TrainerNotification = {
  id: string;
  title: string;
  helper: string;
  href: string;
  icon: LucideIcon;
  tone: NotificationTone;
  unread: boolean;
  time: string;
};

const commandGroups: Array<{ title: string; items: SearchItem[] }> = [
  {
    title: "Разделы",
    items: [
      {
        title: "Дашборд",
        helper: "Очередь задач, риски и сводка по клиентам",
        href: "/trainer/dashboard",
        icon: LayoutDashboard,
        keywords: ["главная", "очередь", "задачи", "dashboard"],
      },
      {
        title: "Центр внимания",
        helper: "Единая очередь Attention Items и действий по клиентам",
        href: "/trainer/attention",
        icon: AlertTriangle,
        keywords: ["внимание", "attention", "задачи", "очередь", "inbox"],
      },
      {
        title: "Клиенты",
        helper: "Список клиентов, статусы, быстрые действия",
        href: "/trainer/clients",
        icon: Users,
        keywords: ["клиент", "ростер", "анкеты", "clients"],
      },
      {
        title: "Сообщения",
        helper: "Диалоги, быстрые ответы и рисковые обращения",
        href: "/trainer/messages",
        icon: MessageCircle,
        keywords: ["сообщения", "чат", "диалоги", "inbox", "messages"],
      },
      {
        title: "Программы",
        helper: "Библиотека программ, назначения и структура недель",
        href: "/trainer/programs",
        icon: ClipboardList,
        keywords: ["программы", "programs", "назначения", "циклы"],
      },
      {
        title: "Конструктор тренировки",
        helper: "Собрать тренировку, сохранить шаблон, назначить день",
        href: "/trainer/builder",
        icon: Hammer,
        keywords: ["тренировка", "билдер", "builder", "шаблон"],
      },
      {
        title: "Календарь",
        helper: "Неделя, чек-ины, разборы и события",
        href: "/trainer/calendar",
        icon: Calendar,
        keywords: ["календарь", "слоты", "чек-ин", "calendar"],
      },
      {
        title: "Автоматизация",
        helper: "Правила follow-up, напоминания и операционные сценарии",
        href: "/trainer/automation",
        icon: RadioTower,
        keywords: ["автоматизация", "напоминания", "follow-up", "rules", "automation"],
      },
      {
        title: "Инсайты",
        helper: "Риски, удержание, прогресс и действия по клиентам",
        href: "/trainer/insights",
        icon: BarChart3,
        keywords: ["инсайты", "аналитика", "риски", "retention", "прогресс"],
      },
      {
        title: "Отчеты",
        helper: "Weekly review, прогресс и следующий фокус для клиента",
        href: "/trainer/reports",
        icon: FileText,
        keywords: ["отчеты", "report", "weekly", "прогресс", "review"],
      },
      {
        title: "Библиотека упражнений",
        helper: "Мои упражнения и базовая библиотека",
        href: "/trainer/library",
        icon: Library,
        keywords: ["упражнения", "библиотека", "library"],
      },
      {
        title: "Продажи",
        helper: "Витрина, продукты, покупки и ссылки",
        href: "/trainer/sales",
        icon: TrendingUp,
        keywords: ["продажи", "витрина", "sales", "продукты"],
      },
      {
        title: "Настройки",
        helper: "Профиль, уведомления, правила и безопасность",
        href: "/trainer/settings",
        icon: Settings,
        keywords: ["настройки", "профиль", "settings"],
      },
    ],
  },
  {
    title: "Клиенты",
    items: [
      {
        title: "Мария Волкова",
        helper: "Активна · текущая программа и разборы",
        href: "/trainer/clients/maria-volkova",
        icon: Dumbbell,
        keywords: ["мария", "волкова", "активна"],
      },
      {
        title: "Артём Смирнов",
        helper: "Требует внимания · пропуски тренировок",
        href: "/trainer/clients/artem-smirnov",
        icon: MessageCircle,
        keywords: ["артём", "смирнов", "риск", "пропуск"],
      },
      {
        title: "Егор Никитин",
        helper: "Нет программы · назначить стартовый план",
        href: "/trainer/clients/egor-nikitin",
        icon: UserPlus,
        keywords: ["егор", "никитин", "новый", "без программы"],
      },
      {
        title: "Екатерина Морозова",
        helper: "Требует внимания · запросить замеры",
        href: "/trainer/clients/ekaterina-morozova",
        icon: Sparkles,
        keywords: ["екатерина", "морозова", "замеры"],
      },
    ],
  },
  {
    title: "Действия",
    items: [
      {
        title: "Создать тренировку",
        helper: "Открыть конструктор для новой сборки",
        href: "/trainer/builder",
        icon: Hammer,
        keywords: ["создать", "тренировка", "новая"],
      },
      {
        title: "Открыть очередь разборов",
        helper: "Перейти к единому центру внимания",
        href: "/trainer/attention",
        icon: ClipboardList,
        keywords: ["разбор", "очередь", "feedback", "attention"],
      },
      {
        title: "Посмотреть риски клиентов",
        helper: "Открыть инсайты по удержанию и прогрессу",
        href: "/trainer/insights",
        icon: BarChart3,
        keywords: ["риски", "инсайты", "аналитика", "клиенты"],
      },
      {
        title: "Подготовить отчет",
        helper: "Собрать weekly review для клиента",
        href: "/trainer/reports",
        icon: FileText,
        keywords: ["отчет", "weekly", "review", "клиент"],
      },
      {
        title: "Добавить клиента",
        helper: "Открыть клиентский раздел",
        href: "/trainer/clients",
        icon: UserPlus,
        keywords: ["добавить", "пригласить", "клиент"],
      },
      {
        title: "Опубликовать продукт",
        helper: "Перейти к витрине и продажам",
        href: "/trainer/sales",
        icon: RadioTower,
        keywords: ["опубликовать", "продукт", "витрина"],
      },
      {
        title: "Скопировать ссылку витрины",
        helper: "Открыть настройки публичного профиля",
        href: "/trainer/settings",
        icon: ExternalLink,
        keywords: ["ссылка", "публичный", "профиль"],
      },
      {
        title: "Настроить напоминания",
        helper: "Открыть правила автоматизации",
        href: "/trainer/automation",
        icon: RadioTower,
        keywords: ["напоминания", "авто", "правила", "follow-up"],
      },
      {
        title: "Проверить покупки",
        helper: "Продажи, покупатели и продукты",
        href: "/trainer/sales",
        icon: ShoppingBag,
        keywords: ["покупки", "оплаты", "доход"],
      },
    ],
  },
];

const initialNotifications: TrainerNotification[] = [
  {
    id: "review-queue",
    title: "3 тренировки ждут разбора",
    helper: "Мария, Дмитрий и Ирина завершили тренировки",
    href: "/trainer/dashboard",
    icon: ClipboardList,
    tone: "risk",
    unread: true,
    time: "15 мин",
  },
  {
    id: "clients-without-program",
    title: "2 клиента без программы",
    helper: "Егор и новый клиент готовы к стартовому плану",
    href: "/trainer/clients",
    icon: UserPlus,
    tone: "risk",
    unread: true,
    time: "Сегодня",
  },
  {
    id: "calendar-ready",
    title: "Календарь недели готов",
    helper: "Проверьте чек-ины и свободные слоты",
    href: "/trainer/calendar",
    icon: Calendar,
    tone: "info",
    unread: false,
    time: "Вчера",
  },
  {
    id: "storefront-sale",
    title: "Новая покупка программы",
    helper: "Ольга купила «Снижение веса 6 недель»",
    href: "/trainer/sales",
    icon: ShoppingBag,
    tone: "success",
    unread: true,
    time: "Сегодня",
  },
];

const notificationFilters: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "unread", label: "Новые" },
  { value: "risk", label: "Риски" },
  { value: "done", label: "Прочитано" },
];

type TrainerShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  trainerName?: string;
  teamName?: string;
  headerAction?: ReactNode;
  children: ReactNode;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TrainerShell({
  title,
  description,
  eyebrow = "Личный кабинет тренера",
  trainerName = "Алексей Романов",
  teamName = "Romanov Coaching",
  headerAction,
  children,
}: TrainerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<TrainerNotification[]>(initialNotifications);
  const [commandOpen, setCommandOpen] = useState(false);

  const unreadCount = notifications.filter((item) => item.unread).length;
  const riskCount = notifications.filter((item) => item.tone === "risk").length;
  const visibleNotifications = notifications.filter((item) => {
    if (notificationFilter === "unread") return item.unread;
    if (notificationFilter === "risk") return item.tone === "risk";
    if (notificationFilter === "done") return !item.unread;
    return true;
  });

  function runCommand(href: string) {
    setCommandOpen(false);
    router.push(href);
  }

  function notificationToneClasses(tone: NotificationTone) {
    switch (tone) {
      case "risk":
        return "border-orange-300/18 bg-orange-300/10 text-orange-100";
      case "success":
        return "border-lime-300/18 bg-lime-300/10 text-lime-100";
      case "info":
        return "border-cyan-300/18 bg-cyan-300/10 text-cyan-100";
    }
  }

  function markNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );
  }

  function toggleNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: !item.unread } : item))
    );
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  }

  function openNotification(item: TrainerNotification) {
    markNotificationRead(item.id);
    setNotificationsOpen(false);
    router.push(item.href);
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-black text-zinc-100">
      <div className="flex min-h-screen min-w-0 max-w-full overflow-x-hidden">
        <aside className="sticky top-0 hidden h-screen w-24 shrink-0 overflow-hidden border-r border-zinc-900 bg-zinc-950/88 px-4 py-5 lg:flex lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center gap-6">
            <Link
              href="/trainer/dashboard"
              className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-zinc-800 bg-zinc-900 text-lime-200 shadow-[0_0_40px_rgba(163,230,53,0.08)]"
              aria-label="Кабинет тренера"
              title="Кабинет тренера"
            >
              <Hammer className="h-5 w-5" />
            </Link>

            <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Навигация тренера">
              {trainerNav.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/trainer/dashboard" && pathname?.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "group flex h-12 w-12 items-center justify-center rounded-[1.1rem] border transition",
                      active
                        ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.18),rgba(111,255,217,0.1))] text-lime-100 shadow-[0_10px_30px_rgba(163,230,53,0.12)]"
                        : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </Link>
                );
              })}

              <div className="mt-4 space-y-2 border-t border-zinc-900/80 pt-4">
                <Link
                  href="/trainer/settings"
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[1.1rem] border transition",
                    pathname === "/trainer/settings"
                      ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                      : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                  aria-label="Настройки"
                  title="Настройки"
                >
                  <Settings className="h-4.5 w-4.5" />
                </Link>
              </div>
            </nav>
          </div>
        </aside>

        <div className="mx-auto flex min-w-0 max-w-[1560px] flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/88 backdrop-blur-xl">
            <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden px-4 py-3 lg:px-6 lg:py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {eyebrow}
                  </p>
                  <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-50 lg:text-[1.45rem]">
                    {title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-400 lg:text-sm">
                    {description}
                  </p>
                </div>

                <div className="hidden items-center gap-3 lg:flex">
                  {headerAction}
                  <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    <Search className="h-4 w-4" />
                    <span>Поиск по кабинету тренера</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
                    aria-label="Уведомления"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-lime-300 px-1 text-[10px] font-semibold text-black">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                    <Avatar className="h-9 w-9 rounded-full bg-zinc-900">
                      <AvatarFallback className="bg-zinc-900 text-zinc-100">
                        {initials(trainerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="pr-1">
                      <p className="text-sm font-medium text-zinc-100">{trainerName}</p>
                      <p className="text-xs text-zinc-500">{teamName}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm whitespace-nowrap text-zinc-400 transition"
                >
                  <Search className="h-4 w-4" />
                  <span>Поиск</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm whitespace-nowrap text-zinc-400 transition"
                >
                  <Bell className="h-4 w-4" />
                  <span>Уведомления</span>
                  {unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-300 px-1 text-[10px] font-semibold text-black">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
                {trainerNav.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/trainer/dashboard" && pathname?.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm whitespace-nowrap transition",
                        active
                          ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                          : "border-zinc-800 bg-zinc-950/70 text-zinc-400"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
                <Link
                  href="/trainer/settings"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm whitespace-nowrap transition",
                    pathname === "/trainer/settings"
                      ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-400"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  <span>Настройки</span>
                </Link>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 lg:px-6 lg:py-5">{children}</main>
        </div>
      </div>

      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Поиск по кабинету тренера"
        description="Быстрый переход по разделам, клиентам и действиям тренера."
        className="border-zinc-800 bg-zinc-950/98 text-zinc-100 shadow-2xl sm:max-w-[620px]"
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Клиент, раздел или действие"
            className="text-zinc-100 placeholder:text-zinc-600"
          />
          <CommandList className="max-h-[460px]">
            <CommandEmpty className="py-10 text-sm text-zinc-500">
              Ничего не найдено
            </CommandEmpty>
            {commandGroups.map((group, groupIndex) => (
              <div key={group.title}>
                {groupIndex > 0 ? <CommandSeparator className="bg-zinc-800" /> : null}
                <CommandGroup
                  heading={group.title}
                  className="text-zinc-100 [&_[cmdk-group-heading]]:text-zinc-500"
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={`${group.title}-${item.title}`}
                        value={[item.title, item.helper, ...item.keywords].join(" ")}
                        onSelect={() => runCommand(item.href)}
                        className="items-start gap-3 rounded-xl px-3 py-3 text-zinc-200 data-selected:bg-zinc-900 data-selected:text-zinc-50"
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-zinc-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.helper}</p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[430px]">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-zinc-50">Уведомления</SheetTitle>
                <SheetDescription className="mt-2 text-zinc-400">
                  {unreadCount > 0
                    ? `${unreadCount} новых · ${riskCount} требуют внимания`
                    : `${riskCount} требуют внимания`}
                </SheetDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={markAllNotificationsRead}
                disabled={unreadCount === 0}
                className="h-8 rounded-full border-zinc-800 bg-black/18 px-3 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Все
              </Button>
            </div>
          </SheetHeader>

          <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {notificationFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setNotificationFilter(filter.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  notificationFilter === filter.value
                    ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                    : "border-zinc-800 bg-black/18 text-zinc-500 hover:text-zinc-200"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 px-4">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "rounded-[1.2rem] border p-4 transition",
                      item.unread
                        ? "border-lime-300/14 bg-black/30"
                        : "border-zinc-800 bg-black/18"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", notificationToneClasses(item.tone))}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                              {item.unread ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-lime-300" aria-label="Новое" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.helper}</p>
                          </div>
                          <span className="shrink-0 text-[11px] text-zinc-600">{item.time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openNotification(item)}
                        className="h-8 rounded-full bg-lime-300 text-xs text-black hover:bg-lime-200"
                      >
                        Открыть
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => toggleNotificationRead(item.id)}
                        className="h-8 rounded-full border-zinc-800 bg-black/18 text-xs text-zinc-300 hover:bg-zinc-900"
                      >
                        {item.unread ? (
                          <>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Прочитано
                          </>
                        ) : (
                          <>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Вернуть
                          </>
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-zinc-800 bg-black/18 p-6 text-center">
                <AlertTriangle className="mx-auto h-5 w-5 text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-300">Нет уведомлений в этом фильтре</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">Смените фильтр или верните прочитанные события.</p>
              </div>
            )}
          </div>
          <div className="mt-auto border-t border-zinc-800 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                onClick={() => {
                  setNotificationsOpen(false);
                  router.push("/trainer/dashboard");
                }}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Очередь
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setNotificationsOpen(false);
                  router.push("/trainer/settings");
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Настройки
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
