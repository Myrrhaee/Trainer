"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Hammer,
  LayoutDashboard,
  Library,
  LogOut,
  LucideIcon,
  MessageCircle,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  UserPlus,
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
import { clearDemoSession, isDemoModeEnabled } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";

type SearchItem = {
  title: string;
  helper: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

type TrainerNavigationItem = SearchItem & {
  id: "dashboard" | "clients" | "templates" | "library" | "settings";
  label: string;
  activeMatch: "exact" | "prefix";
};

const trainerNavigationItems: TrainerNavigationItem[] = [
  {
    id: "dashboard",
    label: "Главная",
    title: "Главная",
    helper: "Очередь решений и состояние команды",
    href: "/trainer/dashboard",
    icon: LayoutDashboard,
    keywords: ["главная", "очередь", "задачи", "dashboard"],
    activeMatch: "exact",
  },
  {
    id: "clients",
    label: "Клиенты",
    title: "Клиенты",
    helper: "Список спортсменов и их рабочий контекст",
    href: "/trainer/clients",
    icon: Users,
    keywords: ["клиент", "спортсмен", "ростер", "clients"],
    activeMatch: "prefix",
  },
  {
    id: "templates",
    label: "Шаблоны",
    title: "Шаблоны",
    helper: "Создание и редактирование шаблонов тренировок",
    href: "/trainer/builder",
    icon: ClipboardList,
    keywords: ["шаблон", "тренировка", "builder"],
    activeMatch: "prefix",
  },
  {
    id: "library",
    label: "Библиотека",
    title: "Библиотека",
    helper: "Упражнения и техника выполнения",
    href: "/trainer/library",
    icon: Library,
    keywords: ["упражнения", "техника", "библиотека", "library"],
    activeMatch: "prefix",
  },
  {
    id: "settings",
    label: "Настройки",
    title: "Настройки",
    helper: "Профиль, уведомления, правила и доступ",
    href: "/trainer/settings",
    icon: Settings,
    keywords: ["настройки", "профиль", "settings"],
    activeMatch: "prefix",
  },
];

function isTrainerNavigationItemActive(pathname: string | null, item: TrainerNavigationItem) {
  if (!pathname) return false;
  if (item.activeMatch === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

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
    items: trainerNavigationItems.map(({ title, helper, href, icon, keywords }) => ({
      title,
      helper,
      href,
      icon,
      keywords,
    })),
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
        title: "Создать шаблон",
        helper: "Открыть рабочую область шаблонов тренировок",
        href: "/trainer/builder",
        icon: Hammer,
        keywords: ["создать", "шаблон", "тренировка", "новая"],
      },
      {
        title: "Открыть очередь",
        helper: "Вернуться к следующим решениям на главной",
        href: "/trainer/dashboard",
        icon: ClipboardList,
        keywords: ["разбор", "очередь", "feedback", "attention"],
      },
      {
        title: "Добавить клиента",
        helper: "Открыть клиентский раздел",
        href: "/trainer/clients",
        icon: UserPlus,
        keywords: ["добавить", "пригласить", "клиент"],
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
  trainerName,
  teamName,
  headerAction,
  children,
}: TrainerShellProps) {
  const demoMode = isDemoModeEnabled();
  const pathname = usePathname();
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<TrainerNotification[]>(() => demoMode ? initialNotifications : []);
  const [commandOpen, setCommandOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const visibleTrainerName = trainerName ?? accountName ?? (demoMode ? "Алексей Романов" : "Тренер");
  const visibleTeamName = teamName ?? (demoMode ? "Romanov Coaching" : "AI Strength Coach");
  const visibleCommandGroups = demoMode
    ? commandGroups
    : commandGroups.filter((group) => group.title !== "Клиенты");

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    void fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ profile: { displayName: string | null } }> : null)
      .then((body) => {
        if (!cancelled && body?.profile.displayName) setAccountName(body.profile.displayName);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [demoMode]);

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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      if (isDemoModeEnabled()) {
        clearDemoSession();
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
      }
    } finally {
      setAccountOpen(false);
      router.replace("/login");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-black text-zinc-100">
      <div className="flex min-h-screen min-w-0 max-w-full overflow-x-clip">
        <aside className="sticky top-0 hidden h-screen w-24 shrink-0 overflow-hidden border-r border-zinc-900 bg-zinc-950/88 px-4 py-5 lg:flex lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center gap-6">
            <Link
              href="/trainer/dashboard"
              className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-zinc-800 bg-zinc-900 text-lime-200 shadow-[0_0_40px_rgba(163,230,53,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              aria-label="Кабинет тренера"
              title="Кабинет тренера"
            >
              <Hammer className="h-5 w-5" />
            </Link>

            <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Основная навигация тренера">
              {trainerNavigationItems.map((item) => {
                const Icon = item.icon;
                const active = isTrainerNavigationItemActive(pathname, item);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "group relative flex h-12 w-12 items-center justify-center rounded-[1.1rem] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                      active
                        ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.18),rgba(111,255,217,0.1))] text-lime-100 shadow-[0_10px_30px_rgba(163,230,53,0.12)]"
                        : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {active ? (
                      <span className="absolute -right-[17px] h-7 w-0.5 rounded-full bg-lime-300" aria-hidden="true" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="mx-auto flex min-w-0 max-w-[1560px] flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/88 backdrop-blur-xl">
            <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden px-4 py-3 lg:px-6 lg:py-3.5">
              <div className="flex items-start justify-between gap-3 lg:items-center">
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
                    className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                  >
                    <Search className="h-4 w-4" />
                    <span>Поиск по кабинету тренера</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
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
                        {initials(visibleTrainerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="pr-1">
                      <p className="text-sm font-medium text-zinc-100">{visibleTrainerName}</p>
                      <p className="text-xs text-zinc-500">{visibleTeamName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      disabled={signingOut}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70 disabled:cursor-wait disabled:opacity-50"
                      aria-label="Выйти из аккаунта"
                      title="Выйти"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                    aria-label="Поиск по кабинету"
                    title="Поиск"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                    aria-label="Уведомления"
                    title="Уведомления"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-lime-300 px-1 text-[9px] font-semibold text-black">
                        {unreadCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountOpen(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                    aria-label="Аккаунт тренера"
                    title="Аккаунт"
                  >
                    <Avatar className="h-8 w-8 rounded-full bg-zinc-900">
                      <AvatarFallback className="bg-zinc-900 text-xs text-zinc-100">
                        {initials(visibleTrainerName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 lg:px-6 lg:py-5">{children}</main>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/90 bg-black/94 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:hidden"
        aria-label="Основная навигация тренера"
      >
        <div className="grid h-[4.5rem] grid-cols-5 px-1.5">
          {trainerNavigationItems.map((item) => {
            const Icon = item.icon;
            const active = isTrainerNavigationItemActive(pathname, item);

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200/70",
                  active
                    ? "bg-white/[0.045] font-semibold text-zinc-50"
                    : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-200"
                )}
              >
                {active ? (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-lime-300" aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "flex h-7 w-9 items-center justify-center rounded-full border transition",
                    active
                      ? "border-lime-300/20 bg-lime-300/12 text-lime-100"
                      : "border-transparent text-zinc-500"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="block max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

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
            {visibleCommandGroups.map((group, groupIndex) => (
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

      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent
          side="right"
          className="w-full border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Аккаунт тренера</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Профиль команды и выход из кабинета.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-zinc-800 bg-black/24 p-4">
              <Avatar className="h-12 w-12 rounded-full bg-zinc-900">
                <AvatarFallback className="bg-zinc-900 text-sm text-zinc-100">
                  {initials(visibleTrainerName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{visibleTrainerName}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{visibleTeamName}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="mt-4 h-11 w-full rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50 disabled:cursor-wait disabled:opacity-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {signingOut ? "Выходим..." : "Выйти"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
