"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  Bookmark,
  Camera,
  ChevronDown,
  ChevronLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCopy,
  Clock3,
  Download,
  Dumbbell,
  Heart,
  Home,
  LineChart,
  LogOut,
  MessageCircle,
  Minus,
  Pencil,
  PlayCircle,
  Plus,
  Ruler,
  Save,
  Search,
  Settings,
  Shield,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target as TargetIcon,
  Target,
  Trophy,
  Trash2,
  Flame,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { ExerciseCategoryIcon } from "@/components/exercise-category-icon";
import {
  getDemoClientSummary,
  getDemoLibraryExercises,
} from "@/lib/demo-data";
import {
  EXERCISE_FILTER_CATEGORIES,
  getExerciseVisualCategory,
  matchesExerciseCategory,
  type ExerciseFilterCategory,
} from "@/lib/exercise-categories";
import type { ExerciseLibraryRow } from "@/lib/exercise-library";
import { clearDemoSession } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const clientNav = [
  { href: "/client/me", label: "Главная", icon: Home },
  { href: "/client/workouts", label: "Тренировки", icon: Dumbbell },
  { href: "/client/library", label: "Библиотека", icon: BookOpen },
  { href: "/client/activity", label: "Активность", icon: CalendarDays },
  { href: "/client/progress", label: "Прогресс", icon: LineChart },
  { href: "/client/settings", label: "Профиль", icon: UserRound },
] as const;

const libraryCategories = EXERCISE_FILTER_CATEGORIES;
const libraryEquipments = ["Все", "Штанга", "Гантели", "Блок", "Собственный вес"] as const;

function getLibraryCategoryMeta(category: ExerciseFilterCategory) {
  switch (category) {
    case "Все":
      return { label: "Все", accent: "from-zinc-200/12 to-zinc-400/5" };
    case "Любимые":
      return { label: "Любимые", accent: "from-amber-300/18 to-yellow-300/8" };
    case "Грудь":
      return { label: "Грудь", accent: "from-rose-300/18 to-orange-300/8" };
    case "Спина":
      return { label: "Спина", accent: "from-cyan-300/18 to-sky-300/8" };
    case "Кардио":
      return { label: "Кардио", accent: "from-red-300/18 to-orange-300/8" };
    case "Бицепс":
    case "Трицепс":
    case "Верхняя часть руки":
    case "Предплечья":
      return { label: category, accent: "from-amber-300/18 to-orange-300/8" };
    case "Квадрицепс":
    case "Хамстринги":
    case "Бедра":
    case "Икры":
      return { label: category, accent: "from-lime-300/18 to-emerald-300/8" };
    case "Плечи":
      return { label: "Плечи", accent: "from-violet-300/18 to-fuchsia-300/8" };
    case "Пресс":
      return { label: "Пресс", accent: "from-teal-300/18 to-emerald-300/8" };
    case "Шея":
      return { label: "Шея", accent: "from-slate-300/18 to-zinc-300/8" };
  }
}

type DemoClientShellProps = {
  title: string;
  description: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isActive(pathname: string, href: string) {
  return pathname === href;
}

function DemoClientShell({ title, description, headerAction, children }: DemoClientShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const data = getDemoClientSummary();

  function handleLogout() {
    clearDemoSession();
    router.replace("/login?role=client");
    router.refresh();
  }

  return (
    <div className="h-full bg-black text-zinc-100">
      <div className="flex min-h-full w-full">
        <aside className="hidden w-24 shrink-0 border-r border-zinc-900 bg-zinc-950/85 px-4 py-5 lg:flex lg:flex-col">
          <div className="space-y-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-zinc-800 bg-zinc-900 text-lime-200 shadow-[0_0_40px_rgba(163,230,53,0.08)]">
              <Dumbbell className="h-5 w-5" />
            </div>

            <nav className="space-y-2">
              {clientNav.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex h-12 w-12 items-center justify-center rounded-[1.1rem] border transition",
                      active
                        ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.18),rgba(111,255,217,0.12))] text-zinc-950 shadow-[0_10px_30px_rgba(163,230,53,0.14)]"
                        : "border-transparent bg-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                    )}
                    aria-label={label}
                    title={label}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </Link>
                );
              })}

              <div className="mt-4 space-y-2 border-t border-zinc-900/80 pt-4">
                <Link
                  href="/client/settings"
                  className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-transparent text-zinc-500 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                  aria-label="Настройки"
                  title="Настройки"
                >
                  <Settings className="h-4.5 w-4.5" />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-transparent text-zinc-500 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                  aria-label="Выйти"
                  title="Выйти"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            </nav>
          </div>
        </aside>

        <div className="mx-auto flex min-w-0 max-w-[1480px] flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-zinc-900 bg-black/88 backdrop-blur-xl">
            <div className="flex flex-col gap-3 px-4 py-3 lg:px-6 lg:py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Личный кабинет клиента
                  </p>
                  <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-50 lg:text-[1.45rem]">
                    {title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-[13px] text-zinc-400 lg:text-sm">{description}</p>
                </div>

                <div className="hidden items-center gap-3 lg:flex">
                  {headerAction}
                  <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-500">
                    <Search className="h-4 w-4" />
                    <span>Поиск по тренировкам и упражнениям</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
                    aria-label="Уведомления"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                    <Avatar className="h-9 w-9 rounded-full bg-zinc-900">
                      <AvatarFallback className="bg-zinc-900 text-zinc-100">
                        {initials(data.client.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="pr-1">
                      <p className="text-sm font-medium text-zinc-100">{data.client.fullName}</p>
                      <p className="text-xs text-zinc-500">{data.client.weekLabel}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {clientNav.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
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
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-4">{children}</main>
        </div>
      </div>
    </div>
  );
}

type HomeStateMode = "new" | "trainer" | "no-trainer" | "no-program" | "active-plan";
type WeekPlanDayStatus = "done" | "today" | "planned" | "rest";
type WeekPlanDay = {
  id: string;
  day: string;
  date: string;
  title: string;
  status: WeekPlanDayStatus;
  note: string;
};

function HomeStateSwitcher({
  value,
  onChange,
}: {
  value: HomeStateMode;
  onChange: (value: HomeStateMode) => void;
}) {
  const options: Array<{ value: HomeStateMode; label: string }> = [
    { value: "new", label: "Новый" },
    { value: "trainer", label: "Есть тренер" },
    { value: "no-trainer", label: "Без тренера" },
    { value: "no-program", label: "Без программы" },
    { value: "active-plan", label: "Активный план" },
  ];

  return (
    <div className="inline-flex max-w-full rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition sm:px-4",
            value === option.value
              ? "bg-lime-300/12 text-lime-100 shadow-[0_0_18px_rgba(163,230,53,0.14)]"
              : "text-zinc-500 hover:text-zinc-200"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function getWeekPlanDayCardClasses(status: WeekPlanDayStatus) {
  return cn(
    "min-w-[160px] flex-1 rounded-[1.45rem] border p-4 transition hover:border-lime-300/16 hover:shadow-[0_16px_35px_rgba(0,0,0,0.22)]",
    status === "today" &&
      "border-lime-300/35 bg-[radial-gradient(circle_at_82%_18%,rgba(190,242,100,0.12),transparent_26%),linear-gradient(180deg,rgba(28,38,12,0.92),rgba(11,15,7,0.98))] shadow-[0_20px_40px_rgba(163,230,53,0.08)]",
    status === "done" && "border-lime-300/14 bg-[linear-gradient(180deg,rgba(17,24,11,0.95),rgba(10,14,9,0.98))]",
    status === "planned" && "border-zinc-800 bg-zinc-950/82",
    status === "rest" && "border-zinc-900 bg-zinc-950/55"
  );
}

function getDemoExerciseDetails(exercise: ExerciseLibraryRow) {
  const primaryMuscles = Array.from(new Set([exercise.muscle_group, exercise.muscle_groups?.[0]].filter(Boolean))) as string[];
  const secondaryMuscles = (exercise.muscle_groups ?? []).filter((muscle) => !primaryMuscles.includes(muscle));
  const techniqueSteps =
    exercise.technique_steps?.length > 0
      ? exercise.technique_steps
      : [
          "Подготовьте устойчивое исходное положение и настройте оборудование.",
          "Двигайтесь по контролируемой амплитуде без рывка.",
          "Сохраняйте технику до конца повторения.",
          "Вернитесь в стартовое положение под контролем.",
        ];
  const tips =
    exercise.tips?.length > 0
      ? exercise.tips
      : ["Сохраняйте стабильный корпус.", "Не торопитесь и контролируйте каждую фазу."];

  const commonMistakes = [
    "Слишком быстрый негатив и потеря контроля движения",
    "Компенсация корпусом вместо работы целевой мышцей",
    "Сокращение амплитуды ради большего веса",
    "Потеря устойчивого исходного положения",
  ];

  const usageNotes = (() => {
    const muscle = (exercise.muscle_group ?? "").toLowerCase();
    if (muscle.includes("груд")) {
      return [
        "Для развития силы и массы груди",
        "Как базовое движение в тренировке верха тела",
        "В начале основной силовой части тренировки",
      ];
    }
    if (muscle.includes("спин")) {
      return [
        "Для построения тягового объёма и техники спины",
        "В день спины или в upper-body тренировке",
        "После базового вертикального или горизонтального движения",
      ];
    }
    if (muscle.includes("плеч")) {
      return [
        "Для акцента на плечевой пояс",
        "В дни верха тела и специальных shoulder-блоках",
        "Как основное или добивающее движение на дельты",
      ];
    }
    if (muscle.includes("бицеп") || muscle.includes("трицеп")) {
      return [
        "Для акцентной работы на руки",
        "После основных базовых движений",
        "Как часть finishing-блока тренировки верха тела",
      ];
    }
    if (muscle.includes("пресс") || muscle.includes("кор")) {
      return [
        "Для укрепления кора и устойчивости корпуса",
        "В конце силовой тренировки или отдельным коротким блоком",
        "Для повышения контроля техники в базовых движениях",
      ];
    }
    return [
      "Для системной работы над целевой группой мышц",
      "Как часть основной тренировки или акцентного блока",
      "Когда нужен чистый и контролируемый объём без лишнего шума",
    ];
  })();

  const exerciseType =
    exercise.equipment?.toLowerCase().includes("штанга") ||
    exercise.equipment?.toLowerCase().includes("гантел") ||
    exercise.equipment?.toLowerCase().includes("тренаж")
      ? "Базовое упражнение"
      : "Изолирующее упражнение";
  const mechanics = primaryMuscles.length > 1 ? "Составное упражнение" : "Локальная механика";
  const equipmentLabel = exercise.equipment ?? "Без оборудования";
  const subtitle = exercise.muscle_groups?.slice(0, 2).join(" • ") || exercise.muscle_group || "Группа мышц не указана";

  return {
    primaryMuscles,
    secondaryMuscles,
    techniqueSteps,
    tips,
    commonMistakes,
    usageNotes,
    exerciseType,
    mechanics,
    equipmentLabel,
    subtitle,
  };
}

function DemoExerciseDetailModal({
  exercise,
  onClose,
}: {
  exercise: ExerciseLibraryRow | null;
  onClose: () => void;
}) {
  const exerciseDetails = useMemo(() => (exercise ? getDemoExerciseDetails(exercise) : null), [exercise]);

  useEffect(() => {
    if (!exercise) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exercise, onClose]);

  if (!exercise || !exerciseDetails) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md sm:px-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-modal-title"
        className="relative flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[2rem] border border-zinc-800/90 bg-zinc-950/96 text-zinc-100 shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/85 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Закрыть модалку"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="max-h-[88vh] overflow-y-auto">
          <div className="border-b border-zinc-800/80 bg-[radial-gradient(circle_at_78%_12%,rgba(163,230,53,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.1))] px-6 py-6 sm:px-7">
            <div className="pr-16">
              <h2 id="exercise-modal-title" className="text-[1.9rem] leading-tight text-zinc-50">
                {exercise.title}
              </h2>
              <p className="mt-2 text-base text-zinc-400">{exerciseDetails.subtitle}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">{exercise.equipment ?? "Без оборудования"}</Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">{exercise.muscle_group ?? "Группа не указана"}</Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">{exercise.difficulty ?? "Средняя сложность"}</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.18fr_0.82fr]">
            <div className="border-b border-zinc-800/70 p-6 lg:border-b-0 lg:border-r lg:p-7">
              <div className="relative overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(22,22,26,0.98),rgba(9,9,11,0.98))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(163,230,53,0.12),transparent_18%),radial-gradient(circle_at_28%_78%,rgba(255,255,255,0.04),transparent_20%)]" />
                <div className="relative flex min-h-[360px] items-center justify-center p-8 sm:min-h-[430px]">
                  {exercise.image_url ? (
                    <Image src={exercise.image_url} alt={exercise.title} width={700} height={560} className="h-full max-h-[360px] w-full object-contain sm:max-h-[430px]" />
                  ) : (
                    <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-[1.4rem] border border-dashed border-zinc-700 bg-black/20">
                      <div className="text-center">
                        <Dumbbell className="mx-auto h-14 w-14 text-zinc-500" />
                        <p className="mt-3 text-sm text-zinc-500">{exercise.title}</p>
                      </div>
                    </div>
                  )}

                  {exercise.video_url ? (
                    <a href={exercise.video_url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/45 text-zinc-100 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:scale-[1.03]">
                        <PlayCircle className="h-8 w-8 text-lime-200" />
                      </span>
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Как выполнять</h3>
                <div className="mt-4 grid gap-3">
                  {exerciseDetails.techniqueSteps.slice(0, 5).map((step, index) => (
                    <div key={`${step}-${index}`} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-[11px] font-semibold text-zinc-200">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-zinc-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Частые ошибки</h3>
                <div className="mt-4 grid gap-3">
                  {exerciseDetails.commonMistakes.map((mistake) => (
                    <div key={mistake} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-400/80" />
                      <p className="text-sm leading-relaxed text-zinc-400">{mistake}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 lg:p-7">
              <div className="rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Работающие мышцы</h3>
                <div className="mt-4 rounded-[1.3rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.8),rgba(9,9,11,0.98))] p-5">
                  <div className="flex h-36 items-center justify-center rounded-[1.1rem] border border-dashed border-zinc-700/80 bg-black/20">
                    <ExerciseCategoryIcon category={(getExerciseVisualCategory(exercise) ?? "Все") as ExerciseFilterCategory} className="h-24 w-24 opacity-80" />
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Основные</p>
                      <p className="mt-2 text-sm text-zinc-200">{exerciseDetails.primaryMuscles.join(", ") || "Основные мышцы не указаны"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Дополнительные</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        {exerciseDetails.secondaryMuscles.length > 0 ? exerciseDetails.secondaryMuscles.join(", ") : "Дополнительные мышцы пока не добавлены"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Характеристики</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Тип", value: exerciseDetails.exerciseType },
                    { label: "Оборудование", value: exerciseDetails.equipmentLabel },
                    { label: "Уровень", value: exercise.difficulty ?? "Средний" },
                    { label: "Механика", value: exerciseDetails.mechanics },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[1.1rem] border border-zinc-800/80 bg-zinc-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                      <p className="mt-2 text-sm text-zinc-200">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">На что обратить внимание</h3>
                <div className="mt-4 grid gap-2.5">
                  {exerciseDetails.tips.map((tip) => (
                    <div key={tip} className="flex items-start gap-3 rounded-[1rem] bg-zinc-950/55 px-3 py-2.5">
                      <TargetIcon className="mt-0.5 h-4 w-4 shrink-0 text-lime-200" />
                      <p className="text-sm leading-relaxed text-zinc-300">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Когда использовать</h3>
                <div className="mt-4 grid gap-3">
                  {exerciseDetails.usageNotes.map((note) => (
                    <div key={note} className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-200" />
                      <p className="text-sm leading-relaxed text-zinc-400">{note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] bg-black/20 p-5">
                <h3 className="text-lg font-medium text-zinc-50">Описание упражнения</h3>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">{exercise.description || "Описание техники пока не добавлено."}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {exercise.video_url ? (
                    <a href={exercise.video_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-black transition hover:bg-white">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Смотреть видео
                    </a>
                  ) : (
                    <div className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 px-4 text-sm text-zinc-500">
                      Видео пока не добавлено
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DemoClientMePage() {
  const data = getDemoClientSummary();
  const [homeState, setHomeState] = useState<HomeStateMode>("active-plan");

  const firstName = data.client.fullName.split(" ")[0] ?? data.client.fullName;
  const homeWeekPlans: Record<HomeStateMode, WeekPlanDay[]> = {
    new: [
      { id: "mon", day: "Пн", date: "20 мая", title: "Анкета", status: "done", note: "Заполнено" },
      { id: "tue", day: "Вт", date: "21 мая", title: "Цель и опыт", status: "today", note: "Сегодня" },
      { id: "wed", day: "Ср", date: "22 мая", title: "Первые замеры", status: "planned", note: "Запланировано" },
      { id: "thu", day: "Чт", date: "23 мая", title: "Подбор плана", status: "planned", note: "Скоро" },
      { id: "fri", day: "Пт", date: "24 мая", title: "Старт недели", status: "planned", note: "Следующий шаг" },
      { id: "sat", day: "Сб", date: "25 мая", title: "Отдых", status: "rest", note: "Восстановление" },
      { id: "sun", day: "Вс", date: "26 мая", title: "Первый чек-ин", status: "planned", note: "Подготовка" },
    ],
    trainer: [
      { id: "mon", day: "Пн", date: "20 мая", title: "Верх тела", status: "done", note: "Выполнено" },
      { id: "tue", day: "Вт", date: "21 мая", title: "Кардио", status: "done", note: "Выполнено" },
      { id: "wed", day: "Ср", date: "22 мая", title: "Ноги + core", status: "today", note: "Сегодня" },
      { id: "thu", day: "Чт", date: "23 мая", title: "Спина + бицепс", status: "planned", note: "Запланировано" },
      { id: "fri", day: "Пт", date: "24 мая", title: "Грудь + трицепс", status: "planned", note: "Запланировано" },
      { id: "sat", day: "Сб", date: "25 мая", title: "Плечи", status: "planned", note: "Запланировано" },
      { id: "sun", day: "Вс", date: "26 мая", title: "Отдых", status: "rest", note: "Восстановление" },
    ],
    "no-trainer": [
      { id: "mon", day: "Пн", date: "20 мая", title: "Фулбоди", status: "done", note: "Выполнено" },
      { id: "tue", day: "Вт", date: "21 мая", title: "Домашний тонус", status: "today", note: "Сегодня" },
      { id: "wed", day: "Ср", date: "22 мая", title: "Кардио + core", status: "planned", note: "Запланировано" },
      { id: "thu", day: "Чт", date: "23 мая", title: "Отдых", status: "rest", note: "Восстановление" },
      { id: "fri", day: "Пт", date: "24 мая", title: "Ноги + ягодицы", status: "planned", note: "Следующая сессия" },
      { id: "sat", day: "Сб", date: "25 мая", title: "Верх тела", status: "planned", note: "По выбору" },
      { id: "sun", day: "Вс", date: "26 мая", title: "Мобилити", status: "rest", note: "Лёгкий день" },
    ],
    "no-program": [
      { id: "mon", day: "Пн", date: "20 мая", title: "Разминка", status: "done", note: "Сделано" },
      { id: "tue", day: "Вт", date: "21 мая", title: "Подбор программы", status: "planned", note: "Выбери цель" },
      { id: "wed", day: "Ср", date: "22 мая", title: "Пробная сессия", status: "today", note: "Сегодня" },
      { id: "thu", day: "Чт", date: "23 мая", title: "Отдых", status: "rest", note: "Без нагрузки" },
      { id: "fri", day: "Пт", date: "24 мая", title: "Нижняя часть тела", status: "planned", note: "Черновик недели" },
      { id: "sat", day: "Сб", date: "25 мая", title: "Кардио", status: "planned", note: "Короткая сессия" },
      { id: "sun", day: "Вс", date: "26 мая", title: "Восстановление", status: "rest", note: "Свободный день" },
    ],
    "active-plan": [
      { id: "mon", day: "Пн", date: "20 мая", title: "Верх тела", status: "done", note: "Выполнено" },
      { id: "tue", day: "Вт", date: "21 мая", title: "Кардио", status: "done", note: "Выполнено" },
      { id: "wed", day: "Ср", date: "22 мая", title: "Ноги + core", status: "today", note: "Сегодня" },
      { id: "thu", day: "Чт", date: "23 мая", title: "Спина + бицепс", status: "planned", note: "Запланировано" },
      { id: "fri", day: "Пт", date: "24 мая", title: "Грудь + трицепс", status: "planned", note: "Запланировано" },
      { id: "sat", day: "Сб", date: "25 мая", title: "Плечи", status: "planned", note: "Запланировано" },
      { id: "sun", day: "Вс", date: "26 мая", title: "Отдых", status: "rest", note: "Восстановление" },
    ],
  };

  const homeScenarios: Record<
    HomeStateMode,
    {
      pageTitle: string;
      pageDescription: string;
      heroBadge: string;
      heroHeadline: string;
      heroText: string;
      heroStats: Array<{ label: string; value: string; helper: string }>;
      progressWidth: string;
      progressCaption: string;
      primaryCta: { label: string; href: string };
      secondaryCta: { label: string; href: string };
      weekStatus: string;
      context: { eyebrow: string; title: string; body: string; cta: { label: string; href: string } };
      strip: Array<{ icon: typeof Flame; text: string }> | null;
    }
  > = {
    new: {
      pageTitle: `Добро пожаловать, ${firstName}!`,
      pageDescription: "Первый экран без пустой аналитики: только старт, маршрут и понятный следующий шаг.",
      heroBadge: "ТВОЙ СТАРТ",
      heroHeadline: "Начнём первую неделю спокойно и с хорошим ритмом",
      heroText: "Соберём основу: первая тренировка, стартовые данные и программа, которая не перегружает с первого дня.",
      heroStats: [
        { label: "Готовность", value: "Старт", helper: "первый вход" },
        { label: "Фокус недели", value: "Анкета", helper: "5–7 минут" },
        { label: "До цели", value: "1 шаг", helper: "создать основу" },
      ],
      progressWidth: "18%",
      progressCaption: "Путь только начинается: сначала создадим опору, а потом появится и реальный прогресс.",
      primaryCta: { label: "Продолжить", href: "/client/settings" },
      secondaryCta: { label: "Создать первую тренировку", href: "/client/workouts" },
      weekStatus: "Ритм недели появится после первой сессии.",
      context: {
        eyebrow: "Следующий шаг",
        title: "Заполни анкету и выбери отправную точку",
        body: "После анкеты станет понятнее цель, нагрузка и какой формат программы подойдёт именно тебе.",
        cta: { label: "Открыть профиль", href: "/client/settings" },
      },
      strip: null,
    },
    trainer: {
      pageTitle: `Добрый вечер, ${firstName}!`,
      pageDescription: "Home как coaching space: состояние недели, главный next step и аккуратный выход в нужные разделы.",
      heroBadge: "ТВОЙ РИТМ",
      heroHeadline: "Тренер ведёт тебя к ровной и сильной неделе",
      heroText: "Сейчас важнее не скорость, а дисциплина: держи темп, выполняй план и оставляй шум за пределами экрана.",
      heroStats: [
        { label: "Готовность", value: "82%", helper: "к сессии" },
        { label: "Фокус недели", value: "Техника", helper: "присед и темп" },
        { label: "До цели", value: "1 сессия", helper: "до закрытия" },
      ],
      progressWidth: "72%",
      progressCaption: "Осталась одна качественная тренировка, чтобы спокойно закрыть план без пропусков.",
      primaryCta: { label: "Продолжить", href: "/client/workouts" },
      secondaryCta: { label: "Открыть тренировки", href: "/client/workouts" },
      weekStatus: "До закрытия недельной цели осталась одна сессия.",
      context: {
        eyebrow: "Комментарий тренера",
        title: "Алексей ждёт от тебя спокойную, чистую по технике тренировку",
        body: "Главный акцент недели — не форсировать, а держать контроль и закончить цикл без пропусков.",
        cta: { label: "Написать тренеру", href: data.trainer.telegramLink },
      },
      strip: [
        { icon: Flame, text: "6 дней подряд" },
        { icon: Target, text: "-1.2 кг к цели" },
        { icon: Sparkles, text: "+5 кг в жиме ногами" },
      ],
    },
    "no-trainer": {
      pageTitle: `Добрый вечер, ${firstName}!`,
      pageDescription: "Спокойный self-guided экран: ритм, следующий шаг и быстрые входы без тяжёлой аналитики.",
      heroBadge: "СВОЙ РИТМ",
      heroHeadline: "Ты уже держишь темп без тренера",
      heroText: "Стабильность сейчас ценнее сложных схем: одна качественная тренировка и понятный маршрут уже двигают тебя вперёд.",
      heroStats: [
        { label: "Готовность", value: "74%", helper: "к сессии" },
        { label: "Фокус недели", value: "Фулбоди", helper: "и core" },
        { label: "До цели", value: "2 шага", helper: "до хорошего ритма" },
      ],
      progressWidth: "54%",
      progressCaption: "Хороший темп. Ещё одна спокойная сессия закрепит неделю без откатов.",
      primaryCta: { label: "Продолжить", href: "/client/workouts" },
      secondaryCta: { label: "Открыть библиотеку", href: "/client/library" },
      weekStatus: "Ещё одна тренировка закрепит ритм этой недели.",
      context: {
        eyebrow: "Поддержка",
        title: "AI предлагает собрать короткую фулбоди-сессию на сегодня",
        body: "Базовое движение, тяга, жим и блок на корпус — этого достаточно, чтобы сохранить темп без лишней сложности.",
        cta: { label: "Открыть библиотеку", href: "/client/library" },
      },
      strip: [
        { icon: Flame, text: "3 дня подряд" },
        { icon: Target, text: "-0.6 кг к цели" },
        { icon: Sparkles, text: "+3 кг в базовых движениях" },
      ],
    },
    "no-program": {
      pageTitle: `Добрый вечер, ${firstName}!`,
      pageDescription: "Экран с фокусом на выборе структуры: без перегруза, но с понятным следующим действием.",
      heroBadge: "НУЖНА СТРУКТУРА",
      heroHeadline: "Выбери программу, чтобы превратить ритм в систему",
      heroText: "Ты уже не на нуле. Сейчас важно закрепить регулярность и собрать понятный план вместо случайных сессий.",
      heroStats: [
        { label: "Готовность", value: "68%", helper: "к следующему шагу" },
        { label: "Фокус недели", value: "Выбор плана", helper: "под цель" },
        { label: "До цели", value: "1 выбор", helper: "до структуры" },
      ],
      progressWidth: "42%",
      progressCaption: "Программа даст опору и избавит от ощущения, что каждую тренировку нужно придумывать заново.",
      primaryCta: { label: "Продолжить", href: "/client/workouts" },
      secondaryCta: { label: "Найти программу", href: "/client/workouts" },
      weekStatus: "Выбор программы поможет закрепить регулярность уже на этой неделе.",
      context: {
        eyebrow: "Что важно сейчас",
        title: "Тебе нужен не ещё один график, а понятная структура",
        body: "Подбери программу под свою цель или собери первую опорную неделю вручную — так путь станет стабильнее.",
        cta: { label: "Открыть тренировки", href: "/client/workouts" },
      },
      strip: [
        { icon: Flame, text: "Ритм уже есть" },
        { icon: Target, text: "Нужна структура" },
        { icon: Sparkles, text: "Следующий шаг — выбрать план" },
      ],
    },
    "active-plan": {
      pageTitle: `Добрый вечер, ${firstName}!`,
      pageDescription: "Премиальный entry point в твой фитнес-ритм: атмосфера, фокус недели и понятный маршрут без dashboard-шума.",
      heroBadge: "ТВОЙ РИТМ",
      heroHeadline: "Ты в ритме уже 6 дней",
      heroText: "Продолжай в том же темпе — ты ближе к цели, чем думаешь. Главное сейчас — не терять спокойный ход и доверять процессу.",
      heroStats: [
        { label: "Готовность", value: "86%", helper: "к неделе" },
        { label: "Фокус недели", value: "1 сессия", helper: "до выполнения" },
        { label: "До цели", value: "63 кг", helper: "текущая цель" },
      ],
      progressWidth: "62%",
      progressCaption: "Твой темп ровный: ещё одна хорошая сессия и неделя закроется без лишнего давления.",
      primaryCta: { label: "Продолжить", href: "/client/workouts" },
      secondaryCta: { label: "Открыть тренировки", href: "/client/workouts" },
      weekStatus: "До закрытия недельной цели осталась одна сессия.",
      context: {
        eyebrow: "Что важно сейчас",
        title: "Добавь новые фото формы или отправь свежие замеры",
        body: "Это поможет увидеть не только ритм, но и реальные изменения тела, не дожидаясь конца цикла.",
        cta: { label: "Открыть профиль", href: "/client/settings" },
      },
      strip: [
        { icon: Flame, text: "6 дней подряд" },
        { icon: Target, text: "-1.2 кг к цели" },
        { icon: Sparkles, text: "+5 кг в жиме ногами" },
      ],
    },
  };

  const scenario = homeScenarios[homeState];
  const homeEventFeeds: Record<HomeStateMode, Array<{ icon: typeof Flame; title: string; body: string; meta: string }>> = {
    new: [
      { icon: Sparkles, title: "Стартовый сценарий готов", body: "Экран подстроен под первый вход без пустой аналитики и лишнего шума.", meta: "Сейчас" },
      { icon: ClipboardCopy, title: "Анкета ещё не заполнена", body: "Это главный шаг перед программой и подбором тренера.", meta: "5–7 минут" },
      { icon: CalendarDays, title: "Первая сессия ещё впереди", body: "После неё появится реальный недельный ритм и история действий.", meta: "На этой неделе" },
      { icon: Camera, title: "Фото формы можно добавить позже", body: "Сначала важнее зафиксировать базовые данные и точку старта.", meta: "Необязательно сегодня" },
    ],
    trainer: [
      { icon: MessageCircle, title: "Алексей обновил тренировку", body: "Уточнил акцент на технике приседа и темпе в нижней точке.", meta: "12 минут назад" },
      { icon: Flame, title: "6 дней подряд", body: "Ритм держится стабильно без провалов в середине недели.", meta: "Серия" },
      { icon: Camera, title: "Через 2 дня — фото формы", body: "Тренер ждёт обновление, чтобы сверить визуальную динамику.", meta: "Напоминание" },
      { icon: Trophy, title: "Новый личный рекорд", body: "Жим ногами вырос на +5 кг в последней сессии.", meta: "Лучший результат" },
    ],
    "no-trainer": [
      { icon: Flame, title: "Последняя тренировка была 2 дня назад", body: "Темп ещё держится, но паузу лучше не растягивать.", meta: "Ритм" },
      { icon: Sparkles, title: "AI советует короткую фулбоди-сессию", body: "База + core помогут сохранить системность без перегруза.", meta: "Рекомендация" },
      { icon: Target, title: "До цели остаётся 0.6 кг", body: "Текущий режим работает, главное — не перегружать неделю.", meta: "Фокус" },
      { icon: Camera, title: "Добавь фото формы", body: "Это даст более честный ориентир, даже если ты занимаешься самостоятельно.", meta: "Напоминание" },
    ],
    "no-program": [
      { icon: CalendarDays, title: "Регулярность уже появилась", body: "Есть движение, но пока нет структуры, которая поддержит его дальше.", meta: "Сейчас" },
      { icon: BookOpen, title: "Программа ещё не выбрана", body: "Без неё каждую сессию приходится собирать заново.", meta: "Нужно решить" },
      { icon: Sparkles, title: "Под цель подходят 2 сценария", body: "Снижение веса или базовый тонус с акцентом на ритм.", meta: "Подсказка" },
      { icon: Camera, title: "Замеры помогут подобрать план точнее", body: "Если обновить данные, рекомендации станут заметно персональнее.", meta: "Опционально" },
    ],
    "active-plan": [
      { icon: MessageCircle, title: "План недели обновлён", body: "Осталась одна сессия, чтобы закрыть цикл без пропусков.", meta: "Сегодня" },
      { icon: Flame, title: "6 дней подряд", body: "Ритм держится стабильно, и это уже работает на результат.", meta: "Серия" },
      { icon: Camera, title: "Нужно обновить фото формы", body: "Через два дня сравнение уже даст более честную динамику.", meta: "Напоминание" },
      { icon: Trophy, title: "Новый личный рекорд", body: "Жим ногами вырос на +5 кг, неделя идёт в правильную сторону.", meta: "Лучший результат" },
    ],
  };
  const homeFocusContent: Record<
    HomeStateMode,
    {
      eyebrow: string;
      title: string;
      body: string;
      cta: { label: string; href: string };
      secondary: Array<{ icon: typeof Camera; title: string; body: string; href: string }>;
    }
  > = {
    new: {
      eyebrow: "Следующий шаг",
      title: "Заполни анкету и выбери отправную точку",
      body: "После анкеты станет понятнее цель, нагрузка и какой формат программы подойдёт именно тебе.",
      cta: { label: "Открыть профиль", href: "/client/settings" },
      secondary: [
        { icon: BookOpen, title: "Изучить библиотеку", body: "Посмотри упражнения и техники без лишнего давления.", href: "/client/library" },
        { icon: Dumbbell, title: "Создать первую тренировку", body: "Собери короткую вводную сессию, если хочется начать сразу.", href: "/client/workouts" },
      ],
    },
    trainer: {
      eyebrow: "Комментарий тренера",
      title: "Алексей ждёт от тебя спокойную, чистую по технике тренировку",
      body: "Главный акцент недели — не форсировать, а держать контроль и закончить цикл без пропусков.",
      cta: { label: "Написать тренеру", href: data.trainer.telegramLink },
      secondary: [
        { icon: Camera, title: "Фото формы и замеры", body: "Через два дня обнови фото и зафиксируй текущие значения.", href: "/client/settings" },
        { icon: LineChart, title: "Проверить прогресс", body: "Посмотри, как неделя влияет на силу и вес без лишнего шума.", href: "/client/progress" },
      ],
    },
    "no-trainer": {
      eyebrow: "Поддержка",
      title: "AI предлагает собрать короткую фулбоди-сессию на сегодня",
      body: "Базовое движение, тяга, жим и блок на корпус — этого достаточно, чтобы сохранить темп без лишней сложности.",
      cta: { label: "Открыть библиотеку", href: "/client/library" },
      secondary: [
        { icon: Dumbbell, title: "Создать свою тренировку", body: "Собери сессию под текущую энергию без жёсткого плана.", href: "/client/workouts" },
        { icon: LineChart, title: "Обновить рабочие веса", body: "Проверь базовые движения и закрепи текущий уровень нагрузки.", href: "/client/progress" },
      ],
    },
    "no-program": {
      eyebrow: "Что важно сейчас",
      title: "Тебе нужен не ещё один график, а понятная структура",
      body: "Подбери программу под свою цель или собери первую опорную неделю вручную — так путь станет стабильнее.",
      cta: { label: "Открыть тренировки", href: "/client/workouts" },
      secondary: [
        { icon: BookOpen, title: "Найти программу", body: "Выбери формат под цель и снизь хаос в принятии решений.", href: "/client/workouts" },
        { icon: Camera, title: "Обновить базовые данные", body: "Фото и замеры помогут системе точнее собрать следующий шаг.", href: "/client/settings" },
      ],
    },
    "active-plan": {
      eyebrow: "Что важно сейчас",
      title: "Добавь новые фото формы или отправь свежие замеры",
      body: "Это поможет увидеть не только ритм, но и реальные изменения тела, не дожидаясь конца цикла.",
      cta: { label: "Открыть профиль", href: "/client/settings" },
      secondary: [
        { icon: LineChart, title: "Проверить прогресс", body: "Смотри изменения тела и силы отдельно, без перегруза на Home.", href: "/client/progress" },
        { icon: Dumbbell, title: "Открыть тренировки", body: "Перейди в план недели и закрой оставшуюся сессию.", href: "/client/workouts" },
      ],
    },
  };
  const heroStats = scenario.heroStats;
  const feedItems = homeEventFeeds[homeState];
  const focusBlock = homeFocusContent[homeState];

  return (
    <DemoClientShell title={scenario.pageTitle} description={scenario.pageDescription}>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сценарий demo</p>
          <p className="mt-1 text-sm text-zinc-400">Home меняется по состоянию пользователя, но остаётся одним и тем же premium hub.</p>
        </div>
        <div className="overflow-x-auto pb-1">
          <HomeStateSwitcher value={homeState} onChange={setHomeState} />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[2.25rem] border border-zinc-800/85 bg-[radial-gradient(circle_at_76%_28%,rgba(163,230,53,0.16),transparent_20%),radial-gradient(circle_at_84%_72%,rgba(91,255,199,0.08),transparent_18%),linear-gradient(180deg,rgba(16,16,20,0.98),rgba(6,6,8,1))] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/Home.png"
            alt="Премиальный фитнес-фон"
            fill
            className="object-cover object-right opacity-88"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,0.94)_0%,rgba(5,5,7,0.88)_36%,rgba(5,5,7,0.46)_62%,rgba(5,5,7,0.22)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_30%,rgba(163,230,53,0.12),transparent_24%),radial-gradient(circle_at_72%_46%,rgba(163,230,53,0.16),transparent_18%)]" />
        </div>

        <div className="relative z-10 flex min-h-[460px] flex-col justify-between p-6 lg:min-h-[500px] lg:p-8 xl:p-10">
          <div className="max-w-[560px]">
            <div>
              <Badge className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-[11px] tracking-[0.18em] text-lime-100">
                {scenario.heroBadge}
              </Badge>
              <h2 className="mt-6 max-w-[10ch] text-[2.7rem] font-semibold leading-[0.92] tracking-[-0.04em] text-zinc-50 sm:text-[3.55rem] xl:text-[4.35rem]">
                {scenario.heroHeadline}
              </h2>
              <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-zinc-300/88 xl:text-[1.05rem]">
                {scenario.heroText}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-200/88">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.38)]" />
                    <span className="font-medium text-zinc-50">{stat.value}</span>
                    <span className="text-zinc-500">{stat.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 max-w-[44rem]">
                <div className="h-[3px] w-full rounded-full bg-white/6">
                  <div
                    className="h-[3px] rounded-full bg-[linear-gradient(90deg,rgba(214,255,128,1),rgba(163,230,53,0.72))] shadow-[0_0_24px_rgba(163,230,53,0.28)]"
                    style={{ width: scenario.progressWidth }}
                  />
                </div>
                <p className="mt-3 max-w-[32rem] text-sm leading-relaxed text-zinc-400">{scenario.progressCaption}</p>
              </div>
            </div>

          </div>

          <div className="mt-10 flex max-w-[560px] flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full bg-lime-300 px-6 text-black hover:bg-lime-200">
                <Link href={scenario.primaryCta.href}>
                  {scenario.primaryCta.label}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-white/10 bg-black/18 px-6 text-zinc-100 hover:bg-zinc-900/80"
              >
                <Link href={scenario.secondaryCta.href}>{scenario.secondaryCta.label}</Link>
              </Button>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-3 rounded-[1.8rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.2))] px-5 py-5 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">План недели</p>
            <p className="mt-1 text-sm text-zinc-400">{scenario.weekStatus}</p>
          </div>
          <Button
            asChild
            variant="outline"
            className="hidden rounded-full border-zinc-800 bg-zinc-950/45 text-zinc-300 hover:bg-zinc-900 sm:inline-flex"
          >
            <Link href="/client/workouts">
              <CalendarDays className="mr-2 h-4 w-4" />
              Открыть тренировки
            </Link>
          </Button>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-full gap-3 px-1">
            {homeWeekPlans[homeState].map((day) => (
              <div key={day.id} className={getWeekPlanDayCardClasses(day.status)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-zinc-100">{day.day}</p>
                    <p className="mt-1 text-xs text-zinc-500">{day.date}</p>
                  </div>
                  {day.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-lime-200" />
                  ) : day.status === "today" ? (
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_16px_rgba(163,230,53,0.32)]" />
                  ) : day.status === "rest" ? (
                    <Minus className="h-5 w-5 text-zinc-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-600" />
                  )}
                </div>
                <p className="mt-4 text-base font-medium text-zinc-100">{day.title}</p>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    day.status === "today"
                      ? "text-lime-200"
                      : day.status === "done"
                      ? "text-emerald-200"
                      : day.status === "rest"
                      ? "text-zinc-500"
                      : "text-zinc-400"
                  )}
                >
                  {day.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2 xl:auto-rows-fr">
        <section className="flex h-full flex-col rounded-[1.95rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.022),rgba(0,0,0,0.24))] p-5 lg:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Что нового</p>
              <h3 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-zinc-50">Лента событий</h3>
            </div>
            <Link
              href="/client/activity"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/20 px-4 py-2 text-sm text-zinc-400 transition hover:border-lime-300/18 hover:text-zinc-100"
            >
              Вся лента
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex flex-1 flex-col rounded-[1.55rem] border border-white/6 bg-black/16 px-4">
            {feedItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.title}-${item.meta}`}
                  className={cn(
                    "flex items-start gap-4 py-4",
                    index !== feedItems.length - 1 && "border-b border-white/6"
                  )}
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-lime-300/12 bg-lime-300/7 text-lime-200/90">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[1.02rem] font-medium text-zinc-100">{item.title}</p>
                      <span className="shrink-0 text-xs tracking-[0.08em] text-zinc-500">{item.meta}</span>
                    </div>
                    <p className="mt-1.5 max-w-[34rem] text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex h-full flex-col rounded-[1.95rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_82%_18%,rgba(163,230,53,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.026),rgba(0,0,0,0.22))] p-5 lg:p-6">
          <div className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-lime-200">{focusBlock.eyebrow}</p>
            <h3 className="mt-4 max-w-[16ch] text-[2rem] font-semibold leading-[0.98] tracking-[-0.03em] text-zinc-50">
              {focusBlock.title}
            </h3>
            <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-zinc-400">{focusBlock.body}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild className="h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200">
                <Link
                  href={focusBlock.cta.href}
                  target={homeState === "trainer" ? "_blank" : undefined}
                  rel={homeState === "trainer" ? "noreferrer" : undefined}
                >
                  {focusBlock.cta.label}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {focusBlock.secondary.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[1.45rem] border border-zinc-800/85 bg-black/16 p-4 transition hover:border-lime-300/18 hover:bg-zinc-900/70"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-300/12 bg-lime-300/7 text-lime-200/90">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-[1.02rem] font-medium text-zinc-100">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-5 rounded-[1.55rem] border border-zinc-900/80 bg-black/18 px-5 py-4 text-sm text-zinc-400 lg:px-6">
        {scenario.strip ? (
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            {scenario.strip.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.text} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-lime-200" />
                  {item.text}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-lime-200">
              <Sparkles className="h-4 w-4" />
              Каждый сильный путь начинается с одного спокойного шага.
            </span>
            <span className="text-zinc-500">Дальше появятся ритм, история и реальные изменения.</span>
          </div>
        )}
      </div>
    </DemoClientShell>
  );
}

export function DemoClientWorkoutsPage() {
  const data = getDemoClientSummary();
  const [mode, setMode] = useState<"trainer" | "solo">("trainer");
  const [activeTab, setActiveTab] = useState<"plan" | "history">("plan");
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [currentEntryScreen, setCurrentEntryScreen] = useState<"overview" | "live" | "log">("overview");
  const [entryTarget, setEntryTarget] = useState<{
    kind: "plan" | "solo" | "repeat";
    title: string;
    helper: string;
    duration?: string;
    exercises?: string;
  } | null>(null);

  const trainerFlow = {
    rhythmLabel: "ТВОЙ РИТМ",
    headline: "Движение создаёт результат",
    subtitle: "Ты на верном пути. Продолжай держать ритм и достигать своих целей.",
    heroStats: [
      { label: "Серия", value: "6 дней подряд" },
      { label: "Прогресс недели", value: "75%" },
      { label: "Тренировки", value: "4 сессии" },
    ],
    actionBar: [
      { id: "plan", title: "Начать по плану", helper: "Тренировка из программы", href: "/today" },
      { id: "solo", title: "Свободная тренировка", helper: "Запиши свою тренировку", href: "/client/workouts" },
      { id: "repeat", title: "Повторить тренировку", helper: "Из истории", href: "/client/workouts" },
    ],
    week: {
      completed: "3 из 4",
      progress: "75%",
      duration: "3 ч 18 мин",
      rhythm: [
        { label: "ПН", status: "done" as const },
        { label: "ВТ", status: "done" as const },
        { label: "СР", status: "today" as const },
        { label: "ЧТ", status: "planned" as const },
        { label: "ПТ", status: "planned" as const },
        { label: "СБ", status: "rest" as const },
        { label: "ВС", status: "planned" as const },
      ],
      days: [
        { id: "mon", day: "Пн", date: "20 мая", title: "Верх тела", status: "done" as const, note: "Выполнено" },
        { id: "tue", day: "Вт", date: "21 мая", title: "Кардио", status: "done" as const, note: "Выполнено" },
        { id: "wed", day: "Ср", date: "22 мая", title: "Ноги + core", status: "today" as const, note: "Сегодня" },
        { id: "thu", day: "Чт", date: "23 мая", title: "Спина + бицепс", status: "planned" as const, note: "Запланировано" },
        { id: "fri", day: "Пт", date: "24 мая", title: "Грудь + трицепс", status: "planned" as const, note: "Запланировано" },
        { id: "sat", day: "Сб", date: "25 мая", title: "Плечи", status: "planned" as const, note: "Запланировано" },
        { id: "sun", day: "Вс", date: "26 мая", title: "Отдых", status: "rest" as const, note: "Восстановление" },
      ],
    },
    planned: [
      { id: "plan-1", title: "Ноги + core", date: "Сегодня", duration: "48–60 мин", exercises: "6 упражнений", status: "Главная сессия", cta: "Открыть" },
      { id: "plan-2", title: "Спина + бицепс", date: "23 мая", duration: "~55 мин", exercises: "6 упражнений", status: "По плану", cta: "Смотреть" },
      { id: "plan-3", title: "Грудь + трицепс", date: "24 мая", duration: "~50 мин", exercises: "5 упражнений", status: "По плану", cta: "Смотреть" },
      { id: "plan-4", title: "Плечи", date: "25 мая", duration: "~40 мин", exercises: "4 упражнения", status: "По плану", cta: "Смотреть" },
    ],
    history: [
      { id: "history-1", title: "Ноги + ягодицы", date: "18 мая", duration: "56 мин", exercises: "6 упражнений", status: "Завершена", cta: "Повторить" },
      { id: "history-2", title: "Верх тела", date: "16 мая", duration: "48 мин", exercises: "5 упражнений", status: "Завершена", cta: "Повторить" },
      { id: "history-3", title: "Кардио + пресс", date: "14 мая", duration: "35 мин", exercises: "4 упражнения", status: "Завершена", cta: "Повторить" },
    ],
    trainer: {
      title: data.trainer.name,
      helper: "Персональный тренер",
      latest: "Держим темп. После сегодняшней сессии пришли короткий фидбек по технике.",
      button: "Написать тренеру",
      href: data.trainer.telegramLink,
    },
    anchors: [
      { id: "leg-press", exercise: "Жим ногами", result: "150 кг × 5", helper: "лучший рабочий сет" },
      { id: "romanian-deadlift", exercise: "Румынская тяга", result: "90 кг × 8", helper: "контроль и амплитуда" },
      { id: "plank", exercise: "Планка", result: "90 сек", helper: "лучший результат по времени" },
    ],
  };

  const soloFlow = {
    rhythmLabel: "СВОЙ РИТМ",
    headline: "Твоя система строится на регулярности",
    subtitle: "Продолжай двигаться в своём темпе: уверенно, спокойно и без перегруженной структуры.",
    heroStats: [
      { label: "Серия", value: "3 дня подряд" },
      { label: "Прогресс недели", value: "50%" },
      { label: "Тренировки", value: "2 сессии" },
    ],
    actionBar: [
      { id: "plan", title: "Открыть идею", helper: "Подбор под состояние", href: "/client/library" },
      { id: "solo", title: "Свободная тренировка", helper: "Запиши свою тренировку", href: "/client/workouts" },
      { id: "repeat", title: "Повторить тренировку", helper: "Из истории", href: "/client/workouts" },
    ],
    week: {
      completed: "2 из 3",
      progress: "50%",
      duration: "1 ч 44 мин",
      rhythm: [
        { label: "ПН", status: "done" as const },
        { label: "ВТ", status: "rest" as const },
        { label: "СР", status: "today" as const },
        { label: "ЧТ", status: "planned" as const },
        { label: "ПТ", status: "rest" as const },
        { label: "СБ", status: "planned" as const },
        { label: "ВС", status: "rest" as const },
      ],
      days: [
        { id: "mon", day: "Пн", date: "20 мая", title: "Силовая сессия", status: "done" as const, note: "Выполнено" },
        { id: "tue", day: "Вт", date: "21 мая", title: "Восстановление", status: "rest" as const, note: "Отдых" },
        { id: "wed", day: "Ср", date: "22 мая", title: "Своя тренировка", status: "today" as const, note: "Сегодня" },
        { id: "thu", day: "Чт", date: "23 мая", title: "Кардио + core", status: "planned" as const, note: "Запланировано" },
        { id: "fri", day: "Пт", date: "24 мая", title: "Восстановление", status: "rest" as const, note: "Отдых" },
        { id: "sat", day: "Сб", date: "25 мая", title: "Фулбоди", status: "planned" as const, note: "Запланировано" },
        { id: "sun", day: "Вс", date: "26 мая", title: "Прогулка", status: "rest" as const, note: "Активный отдых" },
      ],
    },
    planned: [
      { id: "plan-1", title: "Своя тренировка", date: "Сегодня", duration: "40–50 мин", exercises: "5 упражнений", status: "Главная сессия", cta: "Открыть" },
      { id: "plan-2", title: "Кардио + core", date: "23 мая", duration: "~35 мин", exercises: "4 упражнения", status: "В плане", cta: "Смотреть" },
      { id: "plan-3", title: "Фулбоди", date: "25 мая", duration: "~45 мин", exercises: "5 упражнений", status: "В плане", cta: "Смотреть" },
    ],
    history: [
      { id: "history-1", title: "Силовая сессия", date: "18 мая", duration: "44 мин", exercises: "5 упражнений", status: "Завершена", cta: "Повторить" },
      { id: "history-2", title: "Кардио + пресс", date: "15 мая", duration: "32 мин", exercises: "4 упражнения", status: "Завершена", cta: "Повторить" },
    ],
    trainer: null,
    anchors: null,
  };

  const flow = mode === "trainer" ? trainerFlow : soloFlow;
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<string, number>>({});
  const [restSeconds, setRestSeconds] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState("Собранно");
  const [selectedRpe, setSelectedRpe] = useState(8);
  const [finishNote, setFinishNote] = useState("");
  const [modalExercise, setModalExercise] = useState<ExerciseLibraryRow | null>(null);
  const libraryExercises = useMemo(() => getDemoLibraryExercises(), []);

  type LiveSetPlan = { weight: string; reps: string };
  type LiveWorkoutExercise = {
    id: string;
    title: string;
    muscles: string;
    cue: string;
    repRange: string;
    setsLabel: string;
    restSeconds: number;
    sets: LiveSetPlan[];
    exercise: ExerciseLibraryRow;
  };

  const exerciseAssetMap: Record<string, string> = {
    "Приседания со штангой": "/exercises/Quadriceps/Приседания со штангой.webp",
    "Румынская тяга": "/exercises/Hamstrings/Румынская тяга.webp",
    "Жим ногами": "/exercises/Quadriceps/Жим ногами в тренажере под углом 45° с широкой постановкой.webp",
    "Выпады с гантелями": "/exercises/Quadriceps/Выпады с гантелями в ходьбе.webp",
    "Сгибания ног в тренажёре": "/exercises/Hamstrings/Сгибание ног сидя в тренажере.webp",
    Планка: "/exercises/Abs/Планка.webp",
    "Тяга верхнего блока": "/exercises/Back/Тяга верхнего блока к груди.webp",
    "Тяга штанги": "/exercises/Back/Тяга штанги в наклоне.webp",
    "Жим гантелей с «молотковым» хватом лежа": "/exercises/Chest/Жим хаммер лежа.webp",
    "Скручивания на блоке": "/exercises/Abs/Скручивания на блоке.webp",
    "Жим гантелей сидя": "/exercises/Shoulders/Жим на плечи сидя.webp",
  };

  function createFallbackExercise(title: string, muscleGroup: string, equipment = "Гантели"): ExerciseLibraryRow {
    return {
      id: `fallback-${title}`,
      title,
      muscle_group: muscleGroup,
      muscle_groups: [muscleGroup],
      equipment,
      difficulty: "Средняя",
      description: "Описание техники пока не добавлено.",
      image_url: exerciseAssetMap[title],
      video_url: null,
      tips: ["Сохраняйте стабильный корпус.", "Контролируйте движение на всей амплитуде."],
      technique_steps: [
        "Подготовьте устойчивое исходное положение.",
        "Работайте по контролируемой амплитуде.",
        "Не теряйте темп и положение корпуса.",
        "Завершайте повторение без рывков.",
      ],
      is_favorite: false,
      is_system: true,
      owner_user_id: null,
      source_exercise_id: null,
      created_at: null,
      updated_at: null,
    } as ExerciseLibraryRow;
  }

  const resolveExercise = (title: string, muscleGroup: string, equipment?: string) => {
    const normalized = title.toLowerCase();
    const match =
      libraryExercises.find((exercise) => exercise.title.toLowerCase() === normalized) ||
      libraryExercises.find((exercise) => exercise.title.toLowerCase().includes(normalized) || normalized.includes(exercise.title.toLowerCase()));

    return match ?? createFallbackExercise(title, muscleGroup, equipment);
  };

  const liveTemplates = {
    legsTemplate: [
      {
        id: "squat",
        title: "Приседания со штангой",
        muscles: "Квадрицепсы • Ягодицы • Кор",
        cue: "Фокус на глубине, стопах и стабильном темпе.",
        repRange: "6–8 повторений",
        setsLabel: "4 подхода",
        restSeconds: 90,
        sets: [
          { weight: "60 кг", reps: "8" },
          { weight: "70 кг", reps: "8" },
          { weight: "80 кг", reps: "6" },
          { weight: "80 кг", reps: "6" },
        ],
        exercise: resolveExercise("Приседания со штангой", "Квадрицепс", "Штанга"),
      },
      {
        id: "rdl",
        title: "Румынская тяга",
        muscles: "Бицепс бедра • Ягодицы • Разгибатели спины",
        cue: "Держи штангу близко к ногам и не теряй спину.",
        repRange: "8–10 повторений",
        setsLabel: "4 подхода",
        restSeconds: 90,
        sets: [
          { weight: "60 кг", reps: "10" },
          { weight: "70 кг", reps: "8" },
          { weight: "70 кг", reps: "8" },
          { weight: "75 кг", reps: "6" },
        ],
        exercise: resolveExercise("Румынская тяга", "Бедра", "Штанга"),
      },
      {
        id: "leg-press",
        title: "Жим ногами",
        muscles: "Квадрицепсы • Ягодицы",
        cue: "Толкай платформу ровно и не отпускай контроль внизу.",
        repRange: "10–12 повторений",
        setsLabel: "4 подхода",
        restSeconds: 75,
        sets: [
          { weight: "120 кг", reps: "12" },
          { weight: "140 кг", reps: "10" },
          { weight: "150 кг", reps: "8" },
          { weight: "150 кг", reps: "8" },
        ],
        exercise: resolveExercise("Жим ногами", "Квадрицепс", "Тренажёр"),
      },
      {
        id: "lunges",
        title: "Выпады с гантелями",
        muscles: "Ягодицы • Квадрицепсы",
        cue: "Шаг спокойный, колено стабильно, корпус без раскачки.",
        repRange: "10–12 повторений",
        setsLabel: "3 подхода",
        restSeconds: 60,
        sets: [
          { weight: "14 кг", reps: "12" },
          { weight: "16 кг", reps: "10" },
          { weight: "16 кг", reps: "10" },
        ],
        exercise: resolveExercise("Выпады с гантелями", "Квадрицепс", "Гантели"),
      },
      {
        id: "leg-curl",
        title: "Сгибания ног в тренажёре",
        muscles: "Бицепс бедра",
        cue: "Сжимай заднюю поверхность бедра без рывка на возврате.",
        repRange: "12–15 повторений",
        setsLabel: "3 подхода",
        restSeconds: 50,
        sets: [
          { weight: "25 кг", reps: "15" },
          { weight: "30 кг", reps: "12" },
          { weight: "30 кг", reps: "12" },
        ],
        exercise: resolveExercise("Сгибания ног в тренажёре", "Бедра", "Тренажёр"),
      },
      {
        id: "plank",
        title: "Планка",
        muscles: "Кор • Пресс",
        cue: "Собери корпус и держи линию без прогиба.",
        repRange: "45–60 секунд",
        setsLabel: "3 подхода",
        restSeconds: 45,
        sets: [
          { weight: "Вес тела", reps: "60 сек" },
          { weight: "Вес тела", reps: "45 сек" },
          { weight: "Вес тела", reps: "45 сек" },
        ],
        exercise: resolveExercise("Планка", "Пресс", "Собственный вес"),
      },
    ] satisfies LiveWorkoutExercise[],

    backTemplate: [
      {
        id: "row",
        title: "Тяга штанги",
        muscles: "Средняя часть спины • Бицепс",
        cue: "Локти назад, корпус стабилен, не дёргай старт.",
        repRange: "6–8 повторений",
        setsLabel: "4 подхода",
        restSeconds: 90,
        sets: [
          { weight: "50 кг", reps: "8" },
          { weight: "60 кг", reps: "8" },
          { weight: "65 кг", reps: "6" },
          { weight: "65 кг", reps: "6" },
        ],
        exercise: resolveExercise("Тяга штанги", "Спина", "Штанга"),
      },
      {
        id: "lat",
        title: "Тяга верхнего блока",
        muscles: "Широчайшие • Бицепс",
        cue: "Тяни локтями, не поясницей, и фиксируй низ.",
        repRange: "10–12 повторений",
        setsLabel: "4 подхода",
        restSeconds: 75,
        sets: [
          { weight: "35 кг", reps: "12" },
          { weight: "40 кг", reps: "10" },
          { weight: "40 кг", reps: "10" },
          { weight: "45 кг", reps: "8" },
        ],
        exercise: resolveExercise("Тяга верхнего блока", "Спина", "Блок"),
      },
      {
        id: "rdl-back",
        title: "Румынская тяга",
        muscles: "Бицепс бедра • Спина",
        cue: "Удерживай натяжение и не отпускай корпус.",
        repRange: "8–10 повторений",
        setsLabel: "3 подхода",
        restSeconds: 90,
        sets: [
          { weight: "60 кг", reps: "10" },
          { weight: "70 кг", reps: "8" },
          { weight: "70 кг", reps: "8" },
        ],
        exercise: resolveExercise("Румынская тяга", "Бедра", "Штанга"),
      },
    ] satisfies LiveWorkoutExercise[],

    chestTemplate: [
      {
        id: "hammer-press",
        title: "Жим гантелей с «молотковым» хватом лежа",
        muscles: "Грудь • Трицепс",
        cue: "Лопатки сведены, гантели идут по чистой траектории.",
        repRange: "8–10 повторений",
        setsLabel: "4 подхода",
        restSeconds: 90,
        sets: [
          { weight: "18 кг", reps: "10" },
          { weight: "20 кг", reps: "8" },
          { weight: "20 кг", reps: "8" },
          { weight: "22 кг", reps: "6" },
        ],
        exercise: resolveExercise("Жим гантелей с «молотковым» хватом лежа", "Грудь", "Гантели"),
      },
      {
        id: "shoulder-press",
        title: "Жим гантелей сидя",
        muscles: "Плечи • Трицепс",
        cue: "Не рассыпай корпус и держи гантели симметрично.",
        repRange: "8–10 повторений",
        setsLabel: "3 подхода",
        restSeconds: 75,
        sets: [
          { weight: "14 кг", reps: "10" },
          { weight: "16 кг", reps: "8" },
          { weight: "16 кг", reps: "8" },
        ],
        exercise: resolveExercise("Жим гантелей сидя", "Плечи", "Гантели"),
      },
    ] satisfies LiveWorkoutExercise[],

    freeTemplate: [
      {
        id: "free-press",
        title: "Жим гантелей с «молотковым» хватом лежа",
        muscles: "Грудь • Трицепс",
        cue: "Стартовый ориентир. Если хочется, замени на своё базовое движение.",
        repRange: "8–10 повторений",
        setsLabel: "3 подхода",
        restSeconds: 75,
        sets: [
          { weight: "16 кг", reps: "10" },
          { weight: "18 кг", reps: "8" },
          { weight: "18 кг", reps: "8" },
        ],
        exercise: resolveExercise("Жим гантелей с «молотковым» хватом лежа", "Грудь", "Гантели"),
      },
      {
        id: "free-row",
        title: "Тяга верхнего блока",
        muscles: "Широчайшие • Бицепс",
        cue: "Держи темп спокойным и чистым по технике.",
        repRange: "10–12 повторений",
        setsLabel: "3 подхода",
        restSeconds: 75,
        sets: [
          { weight: "35 кг", reps: "12" },
          { weight: "40 кг", reps: "10" },
          { weight: "40 кг", reps: "10" },
        ],
        exercise: resolveExercise("Тяга верхнего блока", "Спина", "Блок"),
      },
      {
        id: "free-core",
        title: "Скручивания на блоке",
        muscles: "Пресс • Кор",
        cue: "Закрой сессию коротким блоком на корпус.",
        repRange: "12–15 повторений",
        setsLabel: "3 подхода",
        restSeconds: 45,
        sets: [
          { weight: "20 кг", reps: "15" },
          { weight: "25 кг", reps: "12" },
          { weight: "25 кг", reps: "12" },
        ],
        exercise: resolveExercise("Скручивания на блоке", "Пресс", "Блок"),
      },
    ] satisfies LiveWorkoutExercise[],
  };

  const liveWorkout = (() => {
    const title = entryTarget?.title ?? flow.planned[0]?.title ?? "Тренировка";
    const isSolo = entryTarget?.kind === "solo";
    const lower = title.toLowerCase();

    const exercises = isSolo
      ? liveTemplates.freeTemplate
      : lower.includes("спина")
      ? liveTemplates.backTemplate
      : lower.includes("груд")
      ? liveTemplates.chestTemplate
      : liveTemplates.legsTemplate;

    return {
      title: isSolo ? "Свободная тренировка" : title,
      helper: isSolo
        ? "Маршрут без предзаписанной программы. Используй как стартовую структуру и меняй по ходу сессии."
        : "Держи темп, не теряй технику и проходи сессию в своём ритме.",
      image: "/Training.png",
      exercises,
    };
  })();

  type LoggedWorkoutSet = {
    id: string;
    weight: string;
    reps: string;
    autoFilledWeight: boolean;
    autoFilledReps: boolean;
    completed: boolean;
  };

  type LoggedWorkoutExercise = {
    id: string;
    title: string;
    muscles: string;
    note: string;
    image?: string;
    equipment: string;
    libraryExercise?: ExerciseLibraryRow;
    sets: LoggedWorkoutSet[];
  };

  function createLoggedSets(exerciseId: string): LoggedWorkoutSet[] {
    return [1, 2, 3].map((setNumber) => ({
      id: `${exerciseId}-set-${setNumber}`,
      weight: "",
      reps: "",
      autoFilledWeight: false,
      autoFilledReps: false,
      completed: false,
    }));
  }

  function createInitialLoggedExercises(): LoggedWorkoutExercise[] {
    return [];
  }

  const [loggedExercises, setLoggedExercises] = useState<LoggedWorkoutExercise[]>(createInitialLoggedExercises);
  const [logExercisePicker, setLogExercisePicker] = useState<"library" | "custom" | null>(null);
  const [logLibraryQuery, setLogLibraryQuery] = useState("");
  const [customExerciseName, setCustomExerciseName] = useState("");
  const [logComment, setLogComment] = useState("");
  const [logSaved, setLogSaved] = useState(false);
  const loggedItemIdRef = useRef(0);
  const filteredLogLibrary = useMemo(() => {
    const query = logLibraryQuery.trim().toLowerCase();
    return libraryExercises
      .filter((exercise) => exercise.is_system && Boolean(exercise.image_url))
      .filter((exercise) => {
        if (!query) return true;
        return [exercise.title, exercise.muscle_group, exercise.equipment ?? "", ...(exercise.muscle_groups ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 12);
  }, [libraryExercises, logLibraryQuery]);
  const loggedSetsCount = loggedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedLoggedSetsCount = loggedExercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0
  );

  function nextLoggedItemId(prefix: string) {
    loggedItemIdRef.current += 1;
    return `${prefix}-${loggedItemIdRef.current}`;
  }

  function isLoggedSetComplete(set: LoggedWorkoutSet) {
    return Boolean(set.weight.trim() && set.reps.trim());
  }

  const totalSets = liveWorkout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedTotalSets = liveWorkout.exercises.reduce((sum, exercise) => sum + Math.min(completedSets[exercise.id] ?? 0, exercise.sets.length), 0);
  const completedExercisesCount = liveWorkout.exercises.filter((exercise) => (completedSets[exercise.id] ?? 0) >= exercise.sets.length).length;
  const currentExercise = liveWorkout.exercises[activeExerciseIndex] ?? liveWorkout.exercises[0];
  const currentCompletedCount = currentExercise ? Math.min(completedSets[currentExercise.id] ?? 0, currentExercise.sets.length) : 0;
  const currentSetNumber = currentExercise ? Math.min(currentCompletedCount + 1, currentExercise.sets.length) : 0;
  const currentSetPlan = currentExercise?.sets[currentCompletedCount] ?? currentExercise?.sets.at(-1);
  const remainingMinutes = Math.max(8, Math.ceil((totalSets - completedTotalSets) * 2.6 + restSeconds / 60));
  const sessionProgress = totalSets > 0 ? Math.min(100, Math.round((completedTotalSets / totalSets) * 100)) : 0;

  function resetLiveWorkoutState() {
    setActiveExerciseIndex(0);
    setCompletedSets({});
    setRestSeconds(0);
    setRestPaused(false);
    setFinishModalOpen(false);
    setSelectedFeeling("Собранно");
    setSelectedRpe(8);
    setFinishNote("");
  }

  useEffect(() => {
    if (currentEntryScreen !== "live" || restSeconds <= 0 || restPaused) return;

    const timer = window.setTimeout(() => setRestSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [currentEntryScreen, restPaused, restSeconds]);

  useEffect(() => {
    if (!entrySheetOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEntrySheetOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entrySheetOpen]);

  function openWorkoutEntry(target: {
    kind: "plan" | "solo" | "repeat";
    title: string;
    helper: string;
    duration?: string;
    exercises?: string;
  }) {
    setEntryTarget(target);
    setEntrySheetOpen(true);
  }

  function handleEntryChoice(choice: "live" | "log") {
    if (choice === "live") {
      resetLiveWorkoutState();
    } else {
      setLoggedExercises(createInitialLoggedExercises());
      setLogComment("");
      setLogSaved(false);
    }

    setEntrySheetOpen(false);
    setCurrentEntryScreen(choice);
  }

  function openChoiceAgain() {
    setEntrySheetOpen(true);
  }

  function handleCompleteSet() {
    if (!currentExercise) return;

    const completedForExercise = Math.min(completedSets[currentExercise.id] ?? 0, currentExercise.sets.length);
    if (completedForExercise >= currentExercise.sets.length) {
      if (activeExerciseIndex < liveWorkout.exercises.length - 1) {
        setActiveExerciseIndex((value) => value + 1);
      }
      return;
    }

    const nextCompleted = completedForExercise + 1;
    const isLastExercise = activeExerciseIndex === liveWorkout.exercises.length - 1;
    const finishedExercise = nextCompleted >= currentExercise.sets.length;

    setCompletedSets((prev) => ({
      ...prev,
      [currentExercise.id]: nextCompleted,
    }));
    setRestSeconds(currentExercise.restSeconds);
    setRestPaused(false);

    if (finishedExercise && isLastExercise) {
      window.setTimeout(() => setFinishModalOpen(true), 220);
      return;
    }

    if (finishedExercise) {
      setActiveExerciseIndex((value) => Math.min(value + 1, liveWorkout.exercises.length - 1));
    }
  }

  function handleFinishWorkout() {
    setFinishModalOpen(false);
    setCurrentEntryScreen("overview");
  }

  function updateLoggedSet(exerciseId: string, setId: string, field: "weight" | "reps", value: string) {
    setLogSaved(false);
    setLoggedExercises((exercises) =>
      exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const editedSetIndex = exercise.sets.findIndex((set) => set.id === setId);
        return {
          ...exercise,
          sets: exercise.sets.map((set, setIndex) => {
            const autoFilledField = field === "weight" ? "autoFilledWeight" : "autoFilledReps";
            const shouldAutofill = editedSetIndex === 0 && setIndex > 0 && (!set[field].trim() || set[autoFilledField]);
            if (set.id !== setId && !shouldAutofill) return set;

            const nextSet = {
              ...set,
              [field]: value,
              [autoFilledField]: set.id !== setId,
            };
            return {
              ...nextSet,
              completed: nextSet.completed && isLoggedSetComplete(nextSet),
            };
          }),
        };
      })
    );
  }

  function toggleLoggedSet(exerciseId: string, setId: string) {
    setLogSaved(false);
    setLoggedExercises((exercises) =>
      exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId && isLoggedSetComplete(set) ? { ...set, completed: !set.completed } : set
              ),
            }
          : exercise
      )
    );
  }

  function addLoggedSet(exerciseId: string) {
    setLogSaved(false);
    const setId = nextLoggedItemId(`${exerciseId}-set`);
    setLoggedExercises((exercises) =>
      exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const previousSet = exercise.sets.at(-1);
        const setNumber = exercise.sets.length + 1;
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: `${setId}-${setNumber}`,
              weight: previousSet?.weight ?? "",
              reps: previousSet?.reps ?? "",
              autoFilledWeight: Boolean(previousSet?.weight),
              autoFilledReps: Boolean(previousSet?.reps),
              completed: false,
            },
          ],
        };
      })
    );
  }

  function removeLoggedSet(exerciseId: string, setId: string) {
    setLogSaved(false);
    setLoggedExercises((exercises) =>
      exercises.map((exercise) =>
        exercise.id === exerciseId && exercise.sets.length > 1
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise
      )
    );
  }

  function removeLoggedExercise(exerciseId: string) {
    setLogSaved(false);
    setLoggedExercises((exercises) => exercises.filter((exercise) => exercise.id !== exerciseId));
  }

  function addLibraryExerciseToLog(exercise: ExerciseLibraryRow) {
    const exerciseId = nextLoggedItemId(`logged-library-${exercise.id}`);
    setLoggedExercises((exercises) => [
      ...exercises,
      {
        id: exerciseId,
        title: exercise.title,
        muscles: exercise.muscle_groups?.slice(0, 3).join(" • ") || exercise.muscle_group || "Все группы",
        note: "Добавлено из библиотеки упражнений",
        image: exercise.image_url ?? undefined,
        equipment: exercise.equipment ?? "Без оборудования",
        libraryExercise: exercise,
        sets: createLoggedSets(exerciseId),
      },
    ]);
    setLogSaved(false);
    setLogLibraryQuery("");
    setLogExercisePicker(null);
  }

  function addCustomExerciseToLog() {
    const title = customExerciseName.trim();
    if (!title) return;

    const exerciseId = nextLoggedItemId("logged-custom");
    setLoggedExercises((exercises) => [
      ...exercises,
      {
        id: exerciseId,
        title,
        muscles: "Свое упражнение",
        note: "Создано вручную для этой тренировки",
        equipment: "Свое оборудование",
        sets: createLoggedSets(exerciseId),
      },
    ]);
    setLogSaved(false);
    setCustomExerciseName("");
    setLogExercisePicker(null);
  }

  if (currentEntryScreen === "live") {
    return (
      <DemoClientShell
        title={liveWorkout.title}
        description="Premium guided training experience с текущим упражнением, рабочими подходами и мягким ритмом по всей сессии."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Режим тренировки</p>
            <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-zinc-50">Тренироваться сейчас</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:bg-zinc-900"
              onClick={openChoiceAgain}
            >
              Изменить формат
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              onClick={() => setCurrentEntryScreen("overview")}
            >
              Назад к плану
            </Button>
          </div>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_84%_24%,rgba(163,230,53,0.12),transparent_20%),linear-gradient(180deg,rgba(16,16,20,0.98),rgba(7,7,9,0.98))] shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0">
            <Image src={liveWorkout.image} alt="Тренировочный режим" fill className="object-cover object-right-center opacity-34" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,0.94)_0%,rgba(5,5,7,0.88)_34%,rgba(5,5,7,0.48)_70%,rgba(5,5,7,0.28)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_36%,rgba(163,230,53,0.08),transparent_22%),radial-gradient(circle_at_84%_52%,rgba(163,230,53,0.12),transparent_18%)]" />
          </div>

          <div className="relative z-10 grid min-h-[258px] gap-6 p-5 lg:grid-cols-[1.08fr_0.92fr] lg:p-7 xl:min-h-[292px]">
            <div className="max-w-[33rem] self-end">
              <Badge className="rounded-full border border-lime-300/16 bg-lime-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-lime-100">
                Режим сессии
              </Badge>
              <h3 className="mt-4 text-[2rem] font-semibold leading-[0.96] tracking-[-0.04em] text-zinc-50 sm:text-[2.65rem]">
                {liveWorkout.title}
              </h3>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-300/88">
                <span>
                  <span className="font-medium text-zinc-50">{Math.min(completedExercisesCount + 1, liveWorkout.exercises.length)} из {liveWorkout.exercises.length}</span>{" "}
                  упражнений
                </span>
                <span>
                  <span className="font-medium text-zinc-50">~{remainingMinutes} мин</span> осталось
                </span>
                <span>
                  <span className="font-medium text-zinc-50">{completedTotalSets}</span> из {totalSets} подходов
                </span>
              </div>
              <div className="mt-5 max-w-[30rem]">
                <div className="h-[4px] w-full rounded-full bg-white/6">
                  <div
                    className="h-[4px] rounded-full bg-[linear-gradient(90deg,rgba(214,255,128,1),rgba(163,230,53,0.72))] shadow-[0_0_24px_rgba(163,230,53,0.28)]"
                    style={{ width: `${sessionProgress}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">Hero держит только контекст. Весь фокус сейчас на текущем упражнении и следующем подходе.</p>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,rgba(163,230,53,0.2),transparent_20%)]" />
              <div className="absolute inset-x-[22%] bottom-6 h-12 rounded-full bg-lime-300/10 blur-3xl" />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-lime-300/14 bg-[radial-gradient(circle_at_72%_10%,rgba(163,230,53,0.1),transparent_22%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.28)] lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Текущее упражнение</p>
                  <button
                    type="button"
                    onClick={() => currentExercise && setModalExercise(currentExercise.exercise)}
                    className="mt-3 text-left transition hover:text-lime-100"
                  >
                    <h4 className="text-[2rem] font-semibold tracking-tight text-zinc-50 sm:text-[2.35rem]">{currentExercise?.title}</h4>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentExercise?.muscles.split("•").map((muscle) => (
                      <span
                        key={muscle}
                        className="rounded-full border border-lime-300/14 bg-lime-300/10 px-3 py-1 text-xs text-lime-100"
                      >
                        {muscle.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => currentExercise && setModalExercise(currentExercise.exercise)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/58 px-4 text-sm text-zinc-200 transition hover:border-lime-300/20 hover:text-zinc-50"
                >
                  <BookOpen className="h-4 w-4" />
                  Техника
                </button>
              </div>

              <motion.div
                key={currentExercise?.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="mt-5 grid gap-5 lg:grid-cols-[0.74fr_1.26fr]"
              >
                <button
                  type="button"
                  onClick={() => currentExercise && setModalExercise(currentExercise.exercise)}
                  className="relative overflow-hidden rounded-[1.7rem] border border-zinc-800/75 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(22,22,26,0.98),rgba(9,9,11,0.98))] text-left transition hover:border-lime-300/18"
                >
                  <div className="relative aspect-[4/5]">
                    {currentExercise?.exercise.image_url ? (
                      <Image src={currentExercise.exercise.image_url} alt={currentExercise.title} fill className="object-contain p-6" sizes="(min-width: 1280px) 22vw, 100vw" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Dumbbell className="h-14 w-14 text-zinc-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_24%,rgba(163,230,53,0.1),transparent_22%)]" />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(7,7,9,0.8))] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Рабочий диапазон</p>
                      <p className="mt-1 text-sm font-medium text-lime-100">{currentExercise?.repRange}</p>
                    </div>
                  </div>
                </button>

                <div className="space-y-3">
                  <div className="rounded-[1.35rem] border border-white/8 bg-black/18 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Фокус подхода</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{currentExercise?.cue}</p>
                  </div>

                  <div className="grid grid-cols-[64px_1fr_1fr_112px] gap-2 px-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <span>Set</span>
                    <span>Вес</span>
                    <span>Повт</span>
                    <span className="text-right">Статус</span>
                  </div>
                  {currentExercise?.sets.map((setPlan, index) => {
                    const status =
                      index < currentCompletedCount ? "done" : index === currentCompletedCount ? "current" : "future";
                    return (
                      <motion.div
                        key={`${currentExercise.id}-${index}`}
                        layout
                        className={cn(
                          "grid grid-cols-[64px_1fr_1fr_112px] items-center gap-3 rounded-[1.35rem] border px-4 py-4 transition",
                          status === "done" &&
                            "border-lime-300/14 bg-[linear-gradient(180deg,rgba(214,255,128,0.07),rgba(0,0,0,0.15))] opacity-90",
                          status === "current" &&
                            "border-lime-300/26 bg-[radial-gradient(circle_at_10%_18%,rgba(163,230,53,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.14))] shadow-[0_0_30px_rgba(163,230,53,0.08)]",
                          status === "future" && "border-white/7 bg-black/14"
                        )}
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-black/18 text-sm font-medium text-zinc-100">
                          {index + 1}
                        </span>
                        <span className={cn("text-lg font-medium", status === "future" ? "text-zinc-500" : "text-zinc-50")}>{setPlan.weight}</span>
                        <span className={cn("text-lg font-medium", status === "future" ? "text-zinc-500" : "text-zinc-50")}>{setPlan.reps}</span>
                        <div className="flex justify-end">
                          {status === "done" ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/14 bg-lime-300/10 px-3 py-1.5 text-sm text-lime-100">
                              <CheckCircle2 className="h-4 w-4" />
                              Готово
                            </span>
                          ) : status === "current" ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/62 px-3 py-1.5 text-sm text-zinc-100">
                              <PlayCircle className="h-4 w-4 text-lime-200" />
                              Сейчас
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-sm text-zinc-500">
                              <Circle className="h-4 w-4" />
                              Дальше
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] border border-lime-300/12 bg-[linear-gradient(180deg,rgba(202,238,112,0.08),rgba(0,0,0,0.12))] px-4 py-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Текущий подход</p>
                      <p className="mt-1 text-base font-medium text-zinc-50">
                        {currentSetNumber} из {currentExercise?.sets.length ?? 0}
                        {currentSetPlan ? ` • ${currentSetPlan.weight} • ${currentSetPlan.reps}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleCompleteSet}
                      className="h-14 rounded-full bg-[linear-gradient(180deg,rgba(199,234,111,0.92),rgba(150,206,64,0.82))] px-6 text-base font-medium text-black shadow-[0_0_34px_rgba(163,230,53,0.14)] hover:bg-[linear-gradient(180deg,rgba(214,244,128,0.94),rgba(164,218,73,0.86))]"
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Подход выполнен
                    </Button>
                  </div>
                </div>
              </motion.div>
            </section>

            <section className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,0.94),rgba(7,7,9,0.98))] p-4 lg:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Фокус на технике</p>
                  <p className="mt-2 text-base font-medium text-zinc-50">Держи спину ровно, колени не выводи вперёд носков.</p>
                </div>
                <Button variant="outline" className="rounded-full border-zinc-800 bg-zinc-950/55 text-zinc-200 hover:bg-zinc-900">
                  Заметки
                </Button>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(8,8,10,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Session progress</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[1.65rem] font-semibold tracking-tight text-zinc-50">
                    {Math.min(completedExercisesCount + 1, liveWorkout.exercises.length)} / {liveWorkout.exercises.length}
                  </p>
                  <p className="text-sm text-zinc-400">упражнений в фокусе</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium text-zinc-100">~{remainingMinutes} мин</p>
                  <p className="text-sm text-zinc-500">до завершения</p>
                </div>
              </div>
              <div className="mt-4 h-[4px] w-full rounded-full bg-white/6">
                <div
                  className="h-[4px] rounded-full bg-[linear-gradient(90deg,rgba(214,255,128,1),rgba(163,230,53,0.72))]"
                  style={{ width: `${sessionProgress}%` }}
                />
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-lime-300/10 bg-[radial-gradient(circle_at_50%_18%,rgba(163,230,53,0.1),transparent_18%),linear-gradient(180deg,rgba(18,18,22,0.96),rgba(8,8,10,0.98))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Rest timer</p>
                  <p className="mt-2 text-base font-medium text-zinc-50">Перед следующим подходом</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-zinc-800 bg-zinc-950/55 text-zinc-200 hover:bg-zinc-900"
                  onClick={() => setRestPaused((value) => !value)}
                >
                  {restPaused ? "Продолжить" : "Пауза"}
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <motion.div
                  animate={restSeconds > 0 && !restPaused ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="relative flex h-24 w-24 items-center justify-center rounded-full border border-lime-300/14 bg-black/22"
                >
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="rgba(190,242,100,0.92)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={264}
                      strokeDashoffset={
                        264 -
                        ((Math.min(restSeconds, currentExercise?.restSeconds ?? 1) / Math.max(currentExercise?.restSeconds ?? 1, 1)) * 264 || 0)
                      }
                    />
                  </svg>
                  <div className="relative text-center">
                    <p className="text-[1.45rem] font-semibold text-zinc-50">{restSeconds}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">сек</p>
                  </div>
                </motion.div>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {restSeconds > 0 ? "Дышим спокойно и возвращаемся в тот же темп." : "Таймер стартует автоматически после выполненного подхода."}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {restPaused ? "Таймер остановлен" : "Мягкий ритм восстановления"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.7rem] border border-white/8 bg-zinc-950/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Маршрут сессии</p>
                  <h4 className="mt-2 text-[1.25rem] font-semibold tracking-tight text-zinc-50">Упражнения</h4>
                </div>
                <div className="rounded-full border border-zinc-800 bg-black/25 px-3 py-1 text-xs text-zinc-400">
                  {completedExercisesCount}/{liveWorkout.exercises.length}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {liveWorkout.exercises.map((exercise, index) => {
                  const doneSets = Math.min(completedSets[exercise.id] ?? 0, exercise.sets.length);
                  const isCurrent = index === activeExerciseIndex;
                  const isDone = doneSets >= exercise.sets.length;
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => setActiveExerciseIndex(index)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[1.3rem] border p-3 text-left transition",
                        isCurrent
                          ? "border-lime-300/22 bg-[radial-gradient(circle_at_12%_14%,rgba(163,230,53,0.1),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] shadow-[0_0_24px_rgba(163,230,53,0.06)]"
                          : "border-white/7 bg-black/16 hover:border-zinc-700 hover:bg-zinc-900/70"
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setModalExercise(exercise.exercise);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setModalExercise(exercise.exercise);
                          }
                        }}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] border border-zinc-800/80 bg-zinc-950/80"
                      >
                        {exercise.exercise.image_url ? (
                          <Image src={exercise.exercise.image_url} alt={exercise.title} fill className="object-cover p-1.5" sizes="56px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Dumbbell className="h-4 w-4 text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-50">{exercise.title}</p>
                            <p className="mt-1 text-xs text-zinc-500">{exercise.setsLabel} • {exercise.repRange}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px]",
                              isCurrent
                                ? "border-lime-300/16 bg-lime-300/10 text-lime-100"
                                : isDone
                                ? "border-zinc-700 bg-zinc-900/80 text-zinc-200"
                                : "border-zinc-800 bg-black/20 text-zinc-500"
                            )}
                          >
                            {doneSets}/{exercise.sets.length}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>

        <AnimatePresence>
          {restSeconds > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              className="fixed bottom-8 right-6 z-[80] hidden rounded-[1.55rem] border border-lime-300/18 bg-[radial-gradient(circle_at_50%_22%,rgba(163,230,53,0.12),transparent_24%),linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.98))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl 2xl:block"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={restPaused ? { scale: 1 } : { scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full border border-lime-300/16 bg-black/25"
                >
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="rgba(190,242,100,0.92)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (Math.min(restSeconds, currentExercise?.restSeconds ?? 1) / Math.max(currentExercise?.restSeconds ?? 1, 1)) * 264}
                    />
                  </svg>
                  <div className="relative text-center">
                    <p className="text-[1.35rem] font-semibold text-zinc-50">{restSeconds}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">сек</p>
                  </div>
                </motion.div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Rest timer</p>
                  <p className="mt-2 text-lg font-medium text-zinc-50">Дай телу дыхание между подходами</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-zinc-800 bg-zinc-950/55 px-3 text-zinc-200 hover:bg-zinc-900"
                      onClick={() => setRestPaused((value) => !value)}
                    >
                      {restPaused ? "Продолжить" : "Пауза"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {finishModalOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md"
              onClick={() => setFinishModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className="w-full max-w-[720px] rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_24%_18%,rgba(163,230,53,0.12),transparent_24%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.42)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Финиш тренировки</p>
                    <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-50">Как прошла сессия?</h3>
                    <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-zinc-400">
                      Закрой тренировку короткой оценкой, чтобы сохранить ритм и своё состояние без лишнего шума.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFinishModalOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-zinc-100">RPE</p>
                  <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedRpe(value)}
                        className={cn(
                          "h-12 rounded-[1rem] border text-sm transition",
                          selectedRpe === value
                            ? "border-lime-300/22 bg-lime-300/12 text-lime-100"
                            : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-zinc-100">Самочувствие</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Собранно", "Нормально", "Тяжело", "Нужно восстановление"].map((feeling) => (
                      <button
                        key={feeling}
                        type="button"
                        onClick={() => setSelectedFeeling(feeling)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition",
                          selectedFeeling === feeling
                            ? "border-lime-300/22 bg-lime-300/10 text-lime-100"
                            : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                        )}
                      >
                        {feeling}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-zinc-100">Заметка</p>
                  <textarea
                    value={finishNote}
                    onChange={(event) => setFinishNote(event.target.value)}
                    placeholder="Например: последний подход дался тяжелее, но техника осталась чистой."
                    className="mt-3 min-h-[110px] w-full rounded-[1.4rem] border border-zinc-800 bg-zinc-950/55 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/20"
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFinishModalOpen(false)}
                    className="rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
                  >
                    Вернуться
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinishWorkout}
                    className="rounded-full bg-lime-300 px-6 text-black hover:bg-lime-200"
                  >
                    Завершить тренировку
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <DemoExerciseDetailModal exercise={modalExercise} onClose={() => setModalExercise(null)} />
      </DemoClientShell>
    );
  }

  if (currentEntryScreen === "log") {
    return (
      <DemoClientShell
        title={entryTarget?.title ?? "Внести результаты"}
        description="Спокойно внесите фактические подходы после тренировки, дополните состав и сохраните историю сессии."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Журнал тренировки</p>
            <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-zinc-50">Записать результаты</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:bg-zinc-900"
              onClick={openChoiceAgain}
            >
              Изменить формат
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              onClick={() => setCurrentEntryScreen("overview")}
            >
              Назад к плану
            </Button>
          </div>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0">
            <Image src="/Training.png" alt="" fill className="object-cover object-right-center opacity-25" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,0.96)_0%,rgba(5,5,7,0.88)_48%,rgba(5,5,7,0.48)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(163,230,53,0.11),transparent_26%)]" />
          </div>

          <div className="relative z-10 grid gap-6 p-5 lg:grid-cols-[1fr_auto] lg:p-7">
            <div className="max-w-[42rem]">
              <Badge className="rounded-full border border-lime-300/16 bg-lime-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-lime-100">
                Постфактум
              </Badge>
              <h3 className="mt-4 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-zinc-50 sm:text-[2.8rem]">
                {entryTarget?.title ?? "Ноги + core"}
              </h3>
              <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-zinc-300/86">
                Соберите фактическую тренировку без спешки. Добавьте упражнения, заполните первый подход, и мы подставим его значения в пустые строки ниже.
              </p>
            </div>
            <div className="flex flex-wrap content-end gap-2 lg:max-w-[240px] lg:justify-end">
              <div className="rounded-full border border-white/10 bg-black/25 px-3.5 py-2 text-sm text-zinc-300">
                <span className="font-medium text-zinc-50">{loggedExercises.length}</span> упражнений
              </div>
              <div className="rounded-full border border-white/10 bg-black/25 px-3.5 py-2 text-sm text-zinc-300">
                <span className="font-medium text-zinc-50">{loggedSetsCount}</span> подходов
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="space-y-4">
            {loggedExercises.length === 0 ? (
              <section className="rounded-[1.7rem] border border-dashed border-zinc-700/90 bg-[radial-gradient(circle_at_18%_12%,rgba(163,230,53,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.9),rgba(7,7,9,0.96))] px-5 py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/10 text-lime-100">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">Добавьте первое упражнение</h4>
                <p className="mx-auto mt-2 max-w-[34rem] text-sm leading-relaxed text-zinc-400">
                  Начните с библиотеки или создайте свое движение. После добавления появятся пустые подходы для фактических результатов.
                </p>
              </section>
            ) : null}

            {loggedExercises.map((exercise, exerciseIndex) => (
              <section
                key={exercise.id}
                className="overflow-hidden rounded-[1.7rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
              >
                <div className="grid gap-4 border-b border-white/7 p-4 sm:grid-cols-[116px_1fr_auto] sm:items-center">
                  <button
                    type="button"
                    onClick={() => exercise.libraryExercise && setModalExercise(exercise.libraryExercise)}
                    disabled={!exercise.libraryExercise}
                    className="relative h-[108px] overflow-hidden rounded-[1.15rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),rgba(0,0,0,0.18)] text-left transition enabled:hover:border-lime-300/22 enabled:hover:shadow-[0_0_24px_rgba(163,230,53,0.08)] disabled:cursor-default"
                    aria-label={exercise.libraryExercise ? `Открыть информацию: ${exercise.title}` : undefined}
                  >
                    {exercise.image ? (
                      <Image src={exercise.image} alt={exercise.title} fill className="object-contain p-2" sizes="116px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Dumbbell className="h-9 w-9 text-zinc-600" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Упражнение {exerciseIndex + 1}</p>
                    <h4 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">{exercise.title}</h4>
                    <p className="mt-1 text-sm text-zinc-500">{exercise.note}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-lime-300/12 bg-lime-300/8 px-2.5 py-1 text-[11px] text-lime-100">
                        {exercise.muscles}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-400">
                        {exercise.equipment}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLoggedExercise(exercise.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-500 transition hover:border-rose-300/20 hover:text-rose-200"
                    aria-label={`Удалить ${exercise.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)_42px_42px] gap-2 px-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:grid-cols-[50px_minmax(0,1fr)_minmax(0,1fr)_96px_42px]">
                    <span>Set</span>
                    <span>Вес</span>
                    <span>Повт</span>
                    <span className="hidden text-center sm:block">Статус</span>
                    <span />
                  </div>

                  <div className="mt-2 space-y-2">
                    {exercise.sets.map((set, setIndex) => (
                      <div
                        key={set.id}
                        className={cn(
                          "grid grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)_42px_42px] items-center gap-2 rounded-[1rem] border p-2 transition sm:grid-cols-[50px_minmax(0,1fr)_minmax(0,1fr)_96px_42px]",
                          set.completed ? "border-lime-300/12 bg-lime-300/[0.045]" : "border-white/7 bg-black/16"
                        )}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-black/20 text-sm font-medium text-zinc-100">
                          {setIndex + 1}
                        </span>
                        <Input
                          value={set.weight}
                          onChange={(event) => updateLoggedSet(exercise.id, set.id, "weight", event.target.value)}
                          placeholder="Вес"
                          aria-label={`Вес, ${exercise.title}, подход ${setIndex + 1}`}
                          className={cn(
                            "h-10 rounded-xl border-zinc-800 bg-black/28 placeholder:text-zinc-600",
                            set.autoFilledWeight ? "text-zinc-500" : "text-zinc-50"
                          )}
                        />
                        <Input
                          value={set.reps}
                          onChange={(event) => updateLoggedSet(exercise.id, set.id, "reps", event.target.value)}
                          placeholder="Повторы"
                          aria-label={`Повторы, ${exercise.title}, подход ${setIndex + 1}`}
                          className={cn(
                            "h-10 rounded-xl border-zinc-800 bg-black/28 placeholder:text-zinc-600",
                            set.autoFilledReps ? "text-zinc-500" : "text-zinc-50"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => toggleLoggedSet(exercise.id, set.id)}
                          disabled={!isLoggedSetComplete(set)}
                          className={cn(
                            "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border text-xs transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-3",
                            set.completed
                              ? "border-lime-300/16 bg-lime-300/10 text-lime-100"
                              : "border-zinc-800 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                          )}
                          aria-label={
                            !isLoggedSetComplete(set)
                              ? "Сначала заполните вес и повторы"
                              : set.completed
                              ? "Отметить подход незавершенным"
                              : "Отметить подход завершенным"
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="hidden sm:inline">{set.completed ? "Готово" : isLoggedSetComplete(set) ? "Отметить" : "Заполнить"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLoggedSet(exercise.id, set.id)}
                          disabled={exercise.sets.length === 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white/5 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label={`Удалить подход ${setIndex + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addLoggedSet(exercise.id)}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-zinc-700 bg-black/12 px-4 text-sm text-zinc-400 transition hover:border-lime-300/24 hover:text-lime-100"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить подход
                  </button>
                </div>
              </section>
            ))}

            <button
              type="button"
              onClick={() => setLogExercisePicker("library")}
              className="group flex w-full items-center justify-between gap-4 rounded-[1.55rem] border border-dashed border-zinc-700/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(0,0,0,0.1))] px-5 py-5 text-left transition hover:border-lime-300/24 hover:bg-lime-300/[0.035]"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/10 text-lime-100">
                  <Plus className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-base font-medium text-zinc-100">Добавить упражнение</span>
                  <span className="mt-1 block text-sm text-zinc-500">Выберите из библиотеки или создайте свое</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-lime-100" />
            </button>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-[1.65rem] border border-lime-300/12 bg-[radial-gradient(circle_at_50%_0%,rgba(163,230,53,0.1),transparent_34%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сводка записи</p>
              <h4 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
                {loggedExercises.length > 0 ? "Тренировка собрана" : "Журнал пока пуст"}
              </h4>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-[1rem] border border-white/7 bg-black/18 px-3 py-3">
                  <p className="text-[1.45rem] font-semibold text-zinc-50">{loggedExercises.length}</p>
                  <p className="mt-1 text-xs text-zinc-500">упражнений</p>
                </div>
                <div className="rounded-[1rem] border border-white/7 bg-black/18 px-3 py-3">
                  <p className="text-[1.45rem] font-semibold text-zinc-50">{completedLoggedSetsCount}/{loggedSetsCount}</p>
                  <p className="mt-1 text-xs text-zinc-500">подходов отмечено</p>
                </div>
              </div>
              <div className="mt-4 h-[4px] overflow-hidden rounded-full bg-white/7">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(214,255,128,1),rgba(163,230,53,0.72))]"
                  style={{ width: `${loggedSetsCount > 0 ? Math.round((completedLoggedSetsCount / loggedSetsCount) * 100) : 0}%` }}
                />
              </div>
            </section>

            <section className="rounded-[1.65rem] border border-zinc-800/85 bg-zinc-950/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Комментарий</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">Добавьте короткую заметку о самочувствии или технике.</p>
              <textarea
                value={logComment}
                onChange={(event) => {
                  setLogComment(event.target.value);
                  setLogSaved(false);
                }}
                placeholder="Например: хороший темп, в последних подходах держал технику."
                className="mt-3 min-h-[120px] w-full resize-none rounded-[1.1rem] border border-zinc-800 bg-black/22 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/20"
              />
            </section>

            <Button
              type="button"
              onClick={() => setLogSaved(true)}
              disabled={loggedExercises.length === 0}
              className="h-14 w-full rounded-full bg-[linear-gradient(180deg,rgba(199,234,111,0.96),rgba(150,206,64,0.88))] text-base font-medium text-black shadow-[0_0_34px_rgba(163,230,53,0.14)] hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {logSaved ? <CheckCircle2 className="mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
              {logSaved ? "Результаты сохранены" : "Сохранить результаты"}
            </Button>
          </aside>
        </div>

        <AnimatePresence>
          {logExercisePicker ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md"
              onClick={() => setLogExercisePicker(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                role="dialog"
                aria-modal="true"
                aria-label="Добавить упражнение"
                className="max-h-[88vh] w-full max-w-[920px] overflow-y-auto rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_18%_12%,rgba(163,230,53,0.1),transparent_24%),linear-gradient(180deg,rgba(18,18,22,0.99),rgba(7,7,9,0.99))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.5)] lg:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Состав тренировки</p>
                    <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-50">Добавить упражнение</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">Найдите движение в библиотеке или запишите свое упражнение вручную.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogExercisePicker(null)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
                    aria-label="Закрыть"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 inline-flex rounded-full border border-zinc-800 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setLogExercisePicker("library")}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm transition",
                      logExercisePicker === "library" ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-zinc-100"
                    )}
                  >
                    Из библиотеки
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogExercisePicker("custom")}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm transition",
                      logExercisePicker === "custom" ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-zinc-100"
                    )}
                  >
                    Свое упражнение
                  </button>
                </div>

                {logExercisePicker === "library" ? (
                  <>
                    <div className="relative mt-5">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        value={logLibraryQuery}
                        onChange={(event) => setLogLibraryQuery(event.target.value)}
                        placeholder="Поиск по библиотеке"
                        className="h-12 rounded-full border-zinc-800 bg-black/24 pl-11 text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredLogLibrary.map((exercise) => (
                        <button
                          key={exercise.id}
                          type="button"
                          onClick={() => addLibraryExerciseToLog(exercise)}
                          className="group overflow-hidden rounded-[1.25rem] border border-zinc-800/85 bg-black/18 text-left transition hover:border-lime-300/24 hover:bg-lime-300/[0.035]"
                        >
                          <div className="relative h-[132px] border-b border-white/7 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_44%)]">
                            {exercise.image_url ? (
                              <Image src={exercise.image_url} alt={exercise.title} fill className="object-contain p-3" sizes="280px" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Dumbbell className="h-8 w-8 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-2 text-sm font-medium text-zinc-100">{exercise.title}</p>
                            <p className="mt-1 text-xs text-zinc-500">{exercise.muscle_group}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-[1.4rem] border border-zinc-800/85 bg-black/18 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/10 text-lime-100">
                      <Pencil className="h-5 w-5" />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-zinc-50">Новое упражнение</h4>
                    <p className="mt-2 max-w-[34rem] text-sm leading-relaxed text-zinc-400">
                      Укажите название. После добавления появится карточка с тремя пустыми подходами, которые можно заполнить.
                    </p>
                    <Input
                      value={customExerciseName}
                      onChange={(event) => setCustomExerciseName(event.target.value)}
                      placeholder="Например: Тяга резинки к поясу"
                      className="mt-4 h-12 rounded-xl border-zinc-800 bg-black/28 text-zinc-100 placeholder:text-zinc-600"
                    />
                    <Button
                      type="button"
                      onClick={addCustomExerciseToLog}
                      disabled={!customExerciseName.trim()}
                      className="mt-4 h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить в тренировку
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <DemoExerciseDetailModal exercise={modalExercise} onClose={() => setModalExercise(null)} />
      </DemoClientShell>
    );
  }

  return (
    <DemoClientShell
      title="Тренировки"
      description="Ритм недели, тренировки по плану и история сессий в более спокойной cinematic-подаче."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Режим</p>
          <div className="mt-2 inline-flex rounded-full border border-zinc-800 bg-zinc-950/85 p-1">
            <Button
              type="button"
              onClick={() => setMode("trainer")}
              className={cn(
                "rounded-full px-4",
                mode === "trainer"
                  ? "bg-zinc-100 text-black hover:bg-white"
                  : "border border-transparent bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              Есть тренер
            </Button>
            <Button
              type="button"
              onClick={() => setMode("solo")}
              className={cn(
                "rounded-full px-4",
                mode === "solo"
                  ? "bg-zinc-100 text-black hover:bg-white"
                  : "border border-transparent bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              Без тренера
            </Button>
          </div>
        </div>
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[2.25rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0">
          <Image
            src="/Training.png"
            alt="Тренировки"
            fill
            priority
            className="object-cover object-[70%_center] opacity-86"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,0.92)_0%,rgba(5,5,7,0.88)_30%,rgba(5,5,7,0.48)_60%,rgba(5,5,7,0.2)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(163,230,53,0.12),transparent_24%),radial-gradient(circle_at_78%_58%,rgba(163,230,53,0.14),transparent_18%),radial-gradient(circle_at_100%_50%,rgba(0,0,0,0.25),transparent_34%)]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
        </div>

        <div className="relative z-10 flex min-h-[460px] flex-col justify-between p-6 lg:min-h-[500px] lg:p-8 xl:p-10">
          <div className="max-w-[560px]">
            <Badge className="rounded-full border border-lime-300/15 bg-lime-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-lime-200">
              {flow.rhythmLabel}
            </Badge>
            <h2 className="mt-6 max-w-[10ch] text-[2.65rem] font-semibold leading-[0.92] tracking-[-0.04em] text-zinc-50 sm:text-[3.8rem] xl:text-[4.45rem]">
              {flow.headline}
            </h2>
            <p className="mt-5 max-w-[33rem] text-base leading-relaxed text-zinc-300/88 xl:text-[1.05rem]">
              {flow.subtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-200/88">
              {flow.heroStats.map((stat) => (
                <div key={stat.label} className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.38)]" />
                  <span className="font-medium text-zinc-50">{stat.value}</span>
                  <span className="text-zinc-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-3 rounded-[1.7rem] border border-white/10 bg-black/28 p-3 backdrop-blur-xl md:grid-cols-3">
            {flow.actionBar.map((action) => {
              const isChoiceAction =
                action.id === "solo" || action.id === "repeat" || (action.id === "plan" && mode === "trainer");

              const actionClasses = cn(
                "group rounded-[1.35rem] border px-4 py-4 transition",
                action.id === "plan" &&
                  "border-lime-300/18 bg-[linear-gradient(180deg,rgba(202,238,112,0.9),rgba(153,210,63,0.82))] text-black shadow-[0_16px_38px_rgba(163,230,53,0.14)] hover:bg-[linear-gradient(180deg,rgba(214,244,128,0.94),rgba(164,218,73,0.86))]",
                action.id === "solo" &&
                  "border-lime-300/12 bg-[linear-gradient(180deg,rgba(214,255,128,0.12),rgba(0,0,0,0.18))] hover:border-lime-300/22 hover:bg-[linear-gradient(180deg,rgba(214,255,128,0.16),rgba(255,255,255,0.04))] hover:shadow-[0_0_30px_rgba(163,230,53,0.08)]",
                action.id === "repeat" &&
                  "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] hover:border-lime-300/16 hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(163,230,53,0.06)]"
              );

              const actionContent = (
                <div className="flex items-start justify-between gap-3">
                  <div className="text-left">
                    <p className={cn("text-base font-medium", action.id === "plan" ? "text-black" : "text-zinc-50")}>
                      {action.title}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm leading-relaxed",
                        action.id === "plan" ? "text-black/70" : action.id === "solo" ? "text-zinc-300/90" : "text-zinc-400"
                      )}
                    >
                      {action.helper}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "mt-0.5 h-4.5 w-4.5 shrink-0 transition",
                      action.id === "plan" ? "text-black/65 group-hover:text-black" : "text-zinc-600 group-hover:text-zinc-100"
                    )}
                  />
                </div>
              );

              if (isChoiceAction) {
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() =>
                      openWorkoutEntry({
                        kind: action.id === "solo" ? "solo" : action.id === "repeat" ? "repeat" : "plan",
                        title:
                          action.id === "solo"
                            ? "Свободная тренировка"
                            : action.id === "repeat"
                            ? flow.history[0]?.title ?? "Последняя тренировка"
                            : flow.planned[0]?.title ?? "Тренировка по плану",
                        helper: action.helper,
                        duration:
                          action.id === "solo" ? undefined : action.id === "repeat" ? flow.history[0]?.duration : flow.planned[0]?.duration,
                        exercises:
                          action.id === "solo" ? undefined : action.id === "repeat" ? flow.history[0]?.exercises : flow.planned[0]?.exercises,
                      })
                    }
                    className={actionClasses}
                  >
                    {actionContent}
                  </button>
                );
              }

              return (
                <Link key={action.id} href={action.href} className={actionClasses}>
                  {actionContent}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.14fr_0.86fr]">
        <section className="rounded-[1.85rem] border border-zinc-800/85 bg-zinc-950/88 p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Мои тренировки</p>
              <h3 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-zinc-50">Сессии и история</h3>
            </div>
            <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/90 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("plan")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition",
                  activeTab === "plan" ? "bg-lime-300/12 text-lime-100" : "text-zinc-500 hover:text-zinc-100"
                )}
              >
                По плану
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition",
                  activeTab === "history" ? "bg-lime-300/12 text-lime-100" : "text-zinc-500 hover:text-zinc-100"
                )}
              >
                История
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(activeTab === "plan" ? flow.planned : flow.history).map((workout) => (
              <div
                key={workout.id}
                className="group flex flex-col gap-3 rounded-[1.35rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.16))] px-4 py-4 transition hover:border-lime-300/14 hover:bg-zinc-900/72 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-800 bg-black/20 text-lime-200">
                    <Dumbbell className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-zinc-50">{workout.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                      <span>{workout.date}</span>
                      <span>•</span>
                      <span>{workout.duration}</span>
                      <span>•</span>
                      <span>{workout.exercises}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:ml-auto">
                  <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
                    {workout.status}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openWorkoutEntry({
                        kind: activeTab === "history" ? "repeat" : workout.id === "plan-1" ? "plan" : "solo",
                        title: workout.title,
                        helper: activeTab === "history" ? "Быстрый вход к повтору тренировки" : "Выбери режим работы с сессией",
                        duration: workout.duration,
                        exercises: workout.exercises,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-3.5 py-2 text-sm text-zinc-200 transition group-hover:border-lime-300/18 group-hover:text-zinc-50"
                  >
                    {workout.cta}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          {flow.trainer ? (
            <section className="rounded-[1.65rem] border border-zinc-800/85 bg-zinc-950/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Тренер</p>
              <div className="mt-4 flex items-center gap-3">
                <Avatar className="h-12 w-12 rounded-2xl bg-zinc-900">
                  <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                    {initials(flow.trainer.title)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100">{flow.trainer.title}</p>
                  <p className="text-xs text-zinc-500">{flow.trainer.helper}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">{flow.trainer.latest}</p>
              <Button
                asChild
                variant="outline"
                className="mt-5 w-full rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              >
                <Link href={flow.trainer.href} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {flow.trainer.button}
                </Link>
              </Button>
            </section>
          ) : (
            <section className="rounded-[1.65rem] border border-zinc-800/85 bg-zinc-950/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Поддержка</p>
              <h4 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">Подбор следующей сессии</h4>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Если тренируешься самостоятельно, держи курс на короткие завершённые тренировки и не усложняй неделю.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-5 w-full rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              >
                <Link href="/client/library">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Открыть библиотеку
                </Link>
              </Button>
            </section>
          )}

          {flow.anchors ? (
            <section className="rounded-[1.65rem] border border-zinc-800/85 bg-zinc-950/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Ориентир на сегодня</p>
              <h4 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">Лучшие результаты по плану</h4>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Перед сессией посмотри на свои сильные точки и используй их как ориентир, а не как давление.
              </p>

              <div className="mt-5 space-y-3">
                {flow.anchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className="rounded-[1.2rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.14))] px-4 py-3"
                  >
                    <p className="text-[1.15rem] font-semibold tracking-tight text-lime-200">{anchor.result}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{anchor.exercise}</p>
                      <span className="text-xs text-zinc-500">{anchor.helper}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[1.65rem] border border-zinc-800/85 bg-zinc-950/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Ориентир на сегодня</p>
              <h4 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">Собери уверенную сессию</h4>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Если тренируешься без плана, держись простого состава: одно базовое движение, тяга, жим и короткий блок на корпус.
              </p>
              <div className="mt-5 rounded-[1.2rem] border border-zinc-800/80 bg-black/18 px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">Формула сессии</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  4–5 упражнений, средняя интенсивность, без попытки выжать максимум из каждого подхода.
                </p>
              </div>
            </section>
          )}
        </aside>
      </div>

      {entrySheetOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/68 px-4 pb-4 pt-10 backdrop-blur-md sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Закрыть" onClick={() => setEntrySheetOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-[860px] overflow-hidden rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_18%_22%,rgba(163,230,53,0.1),transparent_22%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42)] lg:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Вход в тренировку</p>
                <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-50">Как хотите записать тренировку?</h3>
                <p className="mt-3 max-w-[34rem] text-base leading-relaxed text-zinc-400">
                  Выберите формат работы с тренировкой.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEntrySheetOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {entryTarget && entryTarget.kind !== "solo" ? (
              <div className="mt-5 rounded-[1.4rem] border border-zinc-800/80 bg-black/18 px-4 py-3">
                <p className="text-sm font-medium text-zinc-50">{entryTarget.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span>{entryTarget.helper}</span>
                  {entryTarget.duration ? <span>• {entryTarget.duration}</span> : null}
                  {entryTarget.exercises ? <span>• {entryTarget.exercises}</span> : null}
                </div>
              </div>
            ) : entryTarget?.kind === "solo" ? (
              <div className="mt-5 rounded-[1.4rem] border border-zinc-800/80 bg-black/18 px-4 py-3">
                <p className="text-sm font-medium text-zinc-50">Свободная тренировка</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span>Без предзаписанной программы</span>
                  <span>•</span>
                  <span>Ты сам выбираешь упражнения и темп</span>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleEntryChoice("live")}
                className="group rounded-[1.65rem] border border-lime-300/18 bg-[radial-gradient(circle_at_18%_22%,rgba(163,230,53,0.14),transparent_28%),linear-gradient(180deg,rgba(214,255,128,0.12),rgba(0,0,0,0.1))] p-5 text-left shadow-[0_18px_40px_rgba(163,230,53,0.08)] transition hover:border-lime-300/28 hover:shadow-[0_22px_45px_rgba(163,230,53,0.12)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-300/18 bg-lime-300/10 text-lime-200">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[1.3rem] font-semibold tracking-tight text-zinc-50">Тренироваться сейчас</p>
                <p className="mt-2 max-w-[24rem] text-sm leading-relaxed text-zinc-300/90">
                  Пошаговый режим с подходами, таймером и прогрессом.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleEntryChoice("log")}
                className="group rounded-[1.65rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(0,0,0,0.2))] p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-black/20 text-zinc-300">
                  <Pencil className="h-4.5 w-4.5" />
                </div>
                <p className="mt-5 text-[1.3rem] font-semibold tracking-tight text-zinc-50">Записать результаты</p>
                <p className="mt-2 max-w-[24rem] text-sm leading-relaxed text-zinc-400">
                  Быстро внесите веса и повторения после тренировки.
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DemoClientShell>
  );
}

export function DemoClientLibraryPage() {
  return (
    <DemoClientShell
      title="Библиотека упражнений"
      description="Найдите упражнение, посмотрите технику и быстро откройте нужную группу мышц."
    >
      <DemoClientLibraryContent />
    </DemoClientShell>
  );
}

export function DemoClientLibraryContent() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseFilterCategory>("Все");
  const [equipment, setEquipment] = useState<(typeof libraryEquipments)[number]>("Все");
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLibraryRow | null>(null);
  const exercises = getDemoLibraryExercises().filter((item) => item.is_system && Boolean(item.image_url));

  const filtered = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesCategory = matchesExerciseCategory(exercise, category);
      const matchesEquipment =
        equipment === "Все" || (exercise.equipment ?? "").toLowerCase().includes(equipment.toLowerCase());
      const haystack = [
        exercise.title,
        exercise.muscle_group,
        exercise.equipment ?? "",
        exercise.description ?? "",
        ...(exercise.muscle_groups ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesEquipment && haystack.includes(query.trim().toLowerCase());
    });
  }, [category, equipment, exercises, query]);

  return (
    <>
      <div className="space-y-5">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти упражнение"
              className="h-14 rounded-full border-zinc-800 bg-zinc-950/80 pl-12 pr-14 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/90 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              aria-label="Фильтры"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {libraryCategories.map((item) => {
              const meta = getLibraryCategoryMeta(item);
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    "group flex min-w-[88px] flex-col items-center gap-2 rounded-[1.35rem] border px-3 py-3 text-center transition",
                    active
                      ? "border-lime-300/18 bg-[linear-gradient(180deg,rgba(214,255,128,0.14),rgba(9,9,11,0.58))] text-zinc-50 shadow-[0_14px_30px_rgba(163,230,53,0.08)]"
                      : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-13 w-13 items-center justify-center rounded-full border",
                      active
                        ? `border-transparent bg-gradient-to-br ${meta.accent}`
                        : "border-zinc-800 bg-black/20"
                    )}
                  >
                    {item === "Все" ? (
                      <Bookmark className="h-4 w-4" />
                    ) : item === "Любимые" ? (
                      <Heart className="h-4 w-4" />
                    ) : (
                      <ExerciseCategoryIcon category={item} className="h-10 w-10" />
                    )}
                  </div>
                  <span className="text-xs font-medium">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {libraryEquipments.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEquipment(item)}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm transition",
                  equipment === item
                    ? "border-zinc-700 bg-zinc-100 text-black"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3.5 py-2 text-sm text-zinc-500">
            {filtered.length} упражнений
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((exercise) => {
              const visualCategory = getExerciseVisualCategory(exercise) ?? "Все";
              const meta = getLibraryCategoryMeta(visualCategory);
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => setSelectedExercise(exercise)}
                  className="group flex h-full flex-col overflow-hidden rounded-[1.55rem] border border-zinc-800/85 bg-zinc-950/90 text-left transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-950"
                >
                  <div className="relative h-[260px] shrink-0 overflow-hidden border-b border-zinc-800/85 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(20,20,24,0.96),rgba(9,9,11,0.99))]">
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.14]", meta.accent)} />
                    <div className="absolute inset-x-8 top-6 h-20 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)] blur-2xl" />
                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <span className="rounded-full border border-zinc-700 bg-zinc-950/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                        {exercise.muscle_group}
                      </span>
                      {exercise.video_url ? (
                        <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-lime-100">
                          Видео
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute inset-0 flex items-start justify-center px-4 pb-2 pt-12">
                      {exercise.image_url ? (
                        <Image
                          src={exercise.image_url}
                          alt={exercise.title}
                          width={360}
                          height={300}
                          className="h-full w-full object-contain object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full items-start justify-center pt-10">
                          <Dumbbell className="h-16 w-16 text-zinc-100/90" />
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-4 right-4 rounded-full border border-zinc-700 bg-zinc-950/85 p-2 text-zinc-300">
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  <div className="flex min-h-[150px] flex-1 flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-zinc-50">
                          {exercise.title}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {exercise.muscle_groups?.slice(0, 2).join(", ") || exercise.muscle_group}
                        </p>
                      </div>
                      <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-400">
                        {exercise.equipment ?? "Без оборудования"}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-400">
                        {exercise.difficulty ?? "Средняя"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-[1.6rem] border-zinc-800/90 bg-zinc-950/90">
            <CardContent className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-500">
                <Search className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-semibold text-zinc-100">Ничего не найдено</p>
              <p className="mt-2 text-sm text-zinc-500">
                Попробуйте другой запрос, смените группу мышц или снимите часть фильтров.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <DemoExerciseDetailModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
    </>
  );
}

export function DemoClientActivityPage() {
  type ActivityExerciseDetail = {
    title: string;
    sets: string;
    tonnage: string;
    reps: string;
    weights?: string;
    image?: string;
  };

  const getActivityExerciseImage = (title: string) => {
    switch (title) {
      case "Приседания со штангой":
        return "/exercises/Quadriceps/Приседания со штангой.webp";
      case "Румынская тяга":
        return "/exercises/Hamstrings/Румынская тяга.webp";
      case "Жим ногами":
        return "/exercises/Quadriceps/Жим ногами в тренажере под углом 45° с широкой постановкой.webp";
      case "Выпады с гантелями":
        return "/exercises/Quadriceps/Выпады с гантелями в ходьбе.webp";
      case "Сгибания ног":
      case "Сгибания ног в тренажёре":
        return "/exercises/Hamstrings/Сгибание ног сидя в тренажере.webp";
      case "Жим лёжа":
        return "/exercises/Chest/Жим штанги лежа.webp";
      case "Жим гантелей":
      case "Жим гантелей на наклонной":
        return "/exercises/Chest/Жим гантелей на наклонной скамье.webp";
      case "Французский жим":
      case "Трицепс на блоке":
        return "/exercises/Triceps/Разгибание рук на верхнем блоке.webp";
      case "Тяга штанги":
        return "/exercises/Back/Тяга штанги в наклоне.webp";
      case "Тяга верхнего блока":
      case "Тяга блока":
        return "/exercises/Back/Тяга верхнего блока к груди.webp";
      case "Сгибания на бицепс":
        return "/exercises/Biceps/Сгибания рук на бицепс.webp";
      case "Жим гантелей сидя":
        return "/exercises/Shoulders/Жим на плечи сидя.webp";
      default:
        return undefined;
    }
  };

  const months = [
    {
      id: "apr-2026",
      label: "Апрель 2026",
      compareLabel: "к марту",
      ringDelta: "+23%",
      streak: { current: "4 дня подряд", best: "Лучшая серия: 8 дней", activeDays: 4 },
      summary: [
        { label: "тренировок", value: "12", icon: Dumbbell },
        { label: "тоннаж", value: "58 910 кг", icon: Trophy },
        { label: "время", value: "10 ч 58 мин", icon: Clock3 },
        { label: "выполнение плана", value: "84%", icon: Flame },
      ],
      totals: [
        { label: "Тренировок", value: "12", delta: "+3 к марту" },
        { label: "Тоннаж", value: "58 910 кг", delta: "+9 260 кг" },
        { label: "Время", value: "10 ч 58 мин", delta: "+1 ч 24 мин" },
      ],
      defaultSelectedKey: "d17",
      monthCells: [
        { key: "prev-30", day: 30, muted: true, intensity: 0 },
        { key: "prev-31", day: 31, muted: true, intensity: 0 },
        { key: "d1", day: 1, intensity: 2 },
        { key: "d2", day: 2, intensity: 0 },
        { key: "d3", day: 3, intensity: 3 },
        { key: "d4", day: 4, intensity: 0 },
        { key: "d5", day: 5, intensity: 3 },
        { key: "d6", day: 6, intensity: 2 },
        { key: "d7", day: 7, intensity: 0 },
        { key: "d8", day: 8, intensity: 4 },
        { key: "d9", day: 9, intensity: 0 },
        { key: "d10", day: 10, intensity: 3 },
        { key: "d11", day: 11, intensity: 0 },
        { key: "d12", day: 12, intensity: 4 },
        { key: "d13", day: 13, intensity: 2 },
        { key: "d14", day: 14, intensity: 0 },
        { key: "d15", day: 15, intensity: 4 },
        { key: "d16", day: 16, intensity: 3 },
        { key: "d17", day: 17, intensity: 5, pr: true, best: true },
        { key: "d18", day: 18, intensity: 0 },
        { key: "d19", day: 19, intensity: 3 },
        { key: "d20", day: 20, intensity: 0 },
        { key: "d21", day: 21, intensity: 4 },
        { key: "d22", day: 22, intensity: 3 },
        { key: "d23", day: 23, intensity: 0 },
        { key: "d24", day: 24, intensity: 4 },
        { key: "d25", day: 25, intensity: 0 },
        { key: "d26", day: 26, intensity: 3 },
        { key: "d27", day: 27, intensity: 2 },
        { key: "d28", day: 28, intensity: 0 },
        { key: "d29", day: 29, intensity: 4, pr: true },
        { key: "d30", day: 30, intensity: 3 },
      ],
      dayStats: {
        d17: {
          title: "Верх тела",
          date: "17 апреля",
          badge: "Лучший день",
          duration: "52 мин",
          tonnage: "6 480 кг",
          exerciseCount: "5 упражнений",
          note: "Лучший день апреля по верхней части тела и уверенный рост силы в жиме.",
          feeling: "Собранное",
          exercises: [
            { title: "Жим лёжа", sets: "4 подхода", tonnage: "2 360 кг", reps: "10 / 8 / 6 / 6", weights: "45×10 · 55×8 · 60×6 · 60×6", image: getActivityExerciseImage("Жим лёжа") },
            { title: "Тяга штанги", sets: "4 подхода", tonnage: "1 840 кг", reps: "10 / 8 / 8 / 6", weights: "40×10 · 50×8 · 55×8 · 60×6", image: getActivityExerciseImage("Тяга штанги") },
            { title: "Жим гантелей сидя", sets: "3 подхода", tonnage: "1 120 кг", reps: "12 / 10 / 10", weights: "16×12 · 18×10 · 18×10", image: getActivityExerciseImage("Жим гантелей сидя") },
          ] as ActivityExerciseDetail[],
        },
        d29: {
          title: "Ноги + ягодицы",
          date: "29 апреля",
          badge: "Рекорд",
          duration: "61 мин",
          tonnage: "7 210 кг",
          exerciseCount: "5 упражнений",
          note: "Сильная нижняя сессия в конце цикла и хороший выход в новый месяц.",
          feeling: "Сильное",
          exercises: [
            { title: "Жим ногами", sets: "4 подхода", tonnage: "3 140 кг", reps: "12 / 10 / 8 / 8", weights: "120×12 · 140×10 · 160×8 · 170×8", image: getActivityExerciseImage("Жим ногами") },
            { title: "Румынская тяга", sets: "4 подхода", tonnage: "2 080 кг", reps: "10 / 8 / 8 / 6", weights: "50×10 · 60×8 · 65×8 · 70×6", image: getActivityExerciseImage("Румынская тяга") },
            { title: "Выпады с гантелями", sets: "3 подхода", tonnage: "960 кг", reps: "12 / 12 / 10", weights: "16×12 · 16×12 · 18×10", image: getActivityExerciseImage("Выпады с гантелями") },
          ] as ActivityExerciseDetail[],
        },
      },
      bestDays: [
        { date: "29 апреля", title: "Ноги + ягодицы", value: "7 210 кг" },
        { date: "17 апреля", title: "Верх тела", value: "6 480 кг" },
        { date: "24 апреля", title: "Спина + бицепс", value: "5 960 кг" },
      ],
      records: [
        { title: "Жим ногами", gain: "+4 кг", date: "29 апреля" },
        { title: "Жим лёжа", gain: "+2.5 кг", date: "17 апреля" },
        { title: "Тяга штанги", gain: "+5 кг", date: "24 апреля" },
      ],
    },
    {
      id: "may-2026",
      label: "Май 2026",
      compareLabel: "к апрелю",
      ringDelta: "+41%",
      streak: { current: "6 дней подряд", best: "Лучшая серия: 12 дней", activeDays: 5 },
      summary: [
        { label: "тренировок", value: "18", icon: Dumbbell },
        { label: "тоннаж", value: "74 230 кг", icon: Trophy },
        { label: "время", value: "13 ч 24 мин", icon: Clock3 },
        { label: "выполнение плана", value: "92%", icon: Flame },
      ],
      totals: [
        { label: "Тренировок", value: "18", delta: "+6 к апрелю" },
        { label: "Тоннаж", value: "74 230 кг", delta: "+15 320 кг" },
        { label: "Время", value: "13 ч 24 мин", delta: "+2 ч 10 мин" },
      ],
      defaultSelectedKey: "d22",
      monthCells: [
        { key: "prev-27", day: 27, muted: true, intensity: 0 },
        { key: "prev-28", day: 28, muted: true, intensity: 0 },
        { key: "prev-29", day: 29, muted: true, intensity: 0 },
        { key: "prev-30", day: 30, muted: true, intensity: 0 },
        { key: "d1", day: 1, intensity: 2 },
        { key: "d2", day: 2, intensity: 2 },
        { key: "d3", day: 3, intensity: 4 },
        { key: "d4", day: 4, intensity: 3 },
        { key: "d5", day: 5, intensity: 3 },
        { key: "d6", day: 6, intensity: 5, pr: true },
        { key: "d7", day: 7, intensity: 0 },
        { key: "d8", day: 8, intensity: 4 },
        { key: "d9", day: 9, intensity: 3 },
        { key: "d10", day: 10, intensity: 4 },
        { key: "d11", day: 11, intensity: 3 },
        { key: "d12", day: 12, intensity: 4 },
        { key: "d13", day: 13, intensity: 5, pr: true },
        { key: "d14", day: 14, intensity: 0 },
        { key: "d15", day: 15, intensity: 4 },
        { key: "d16", day: 16, intensity: 5 },
        { key: "d17", day: 17, intensity: 4 },
        { key: "d18", day: 18, intensity: 5, pr: true },
        { key: "d19", day: 19, intensity: 4 },
        { key: "d20", day: 20, intensity: 3 },
        { key: "d21", day: 21, intensity: 0 },
        { key: "d22", day: 22, intensity: 5, pr: true, best: true },
        { key: "d23", day: 23, intensity: 3 },
        { key: "d24", day: 24, intensity: 2 },
        { key: "d25", day: 25, intensity: 4 },
        { key: "d26", day: 26, intensity: 3 },
        { key: "d27", day: 27, intensity: 3 },
        { key: "d28", day: 28, intensity: 0 },
        { key: "d29", day: 29, intensity: 2 },
        { key: "d30", day: 30, intensity: 5, pr: true },
        { key: "d31", day: 31, intensity: 3 },
      ],
      dayStats: {
        d6: {
          title: "Спина + бицепс",
          date: "6 мая",
          badge: "Рекорд",
          duration: "58 мин",
          tonnage: "6 780 кг",
          exerciseCount: "5 упражнений",
          note: "Сильная тяговая сессия и хороший прирост в штанге.",
          feeling: "Уверенное",
          exercises: [
            { title: "Тяга штанги", sets: "4 подхода", tonnage: "2 460 кг", reps: "10 / 8 / 8 / 6", weights: "50×10 · 60×8 · 65×8 · 70×6", image: getActivityExerciseImage("Тяга штанги") },
            { title: "Тяга верхнего блока", sets: "4 подхода", tonnage: "1 680 кг", reps: "12 / 10 / 10 / 8", weights: "45×12 · 50×10 · 55×10 · 60×8", image: getActivityExerciseImage("Тяга верхнего блока") },
            { title: "Сгибания на бицепс", sets: "3 подхода", tonnage: "740 кг", reps: "12 / 10 / 10", weights: "18×12 · 20×10 · 20×10", image: getActivityExerciseImage("Сгибания на бицепс") },
          ] as ActivityExerciseDetail[],
        },
        d13: {
          title: "Грудь + трицепс",
          date: "13 мая",
          badge: "Рекорд",
          duration: "56 мин",
          tonnage: "7 450 кг",
          exerciseCount: "5 упражнений",
          note: "Один из самых плотных дней месяца по объёму и росту силы.",
          feeling: "Сильное",
          exercises: [
            { title: "Жим лёжа", sets: "4 подхода", tonnage: "2 180 кг", reps: "10 / 8 / 6 / 6", weights: "45×10 · 52.5×8 · 57.5×6 · 57.5×6", image: getActivityExerciseImage("Жим лёжа") },
            { title: "Жим гантелей на наклонной", sets: "4 подхода", tonnage: "1 620 кг", reps: "10 / 10 / 8 / 8", weights: "20×10 · 22×10 · 24×8 · 24×8", image: getActivityExerciseImage("Жим гантелей на наклонной") },
            { title: "Французский жим", sets: "3 подхода", tonnage: "840 кг", reps: "12 / 10 / 10", weights: "25×12 · 27.5×10 · 27.5×10", image: getActivityExerciseImage("Французский жим") },
          ] as ActivityExerciseDetail[],
        },
        d18: {
          title: "Ноги + ягодицы",
          date: "18 мая",
          badge: "Выполнено",
          duration: "63 мин",
          tonnage: "8 340 кг",
          exerciseCount: "5 упражнений",
          note: "Самая стабильная силовая сессия недели с хорошим ритмом.",
          feeling: "Рабочее",
          exercises: [
            { title: "Приседания со штангой", sets: "4 подхода", tonnage: "3 560 кг", reps: "10 / 8 / 6 / 6", weights: "60×10 · 70×8 · 80×6 · 80×6", image: getActivityExerciseImage("Приседания со штангой") },
            { title: "Румынская тяга", sets: "4 подхода", tonnage: "2 220 кг", reps: "10 / 8 / 8 / 6", weights: "55×10 · 65×8 · 70×8 · 75×6", image: getActivityExerciseImage("Румынская тяга") },
            { title: "Сгибания ног", sets: "3 подхода", tonnage: "740 кг", reps: "15 / 12 / 12", weights: "30×15 · 35×12 · 35×12", image: getActivityExerciseImage("Сгибания ног") },
          ] as ActivityExerciseDetail[],
        },
        d22: {
          title: "Ноги + ягодицы",
          date: "22 мая",
          badge: "Лучший день",
          duration: "60 мин",
          tonnage: "8 920 кг",
          exerciseCount: "5 упражнений",
          note: "Максимальная интенсивность, новый рекорд и лучший день по нижней части тела.",
          feeling: "Отличное",
          exercises: [
            { title: "Приседания со штангой", sets: "4 подхода", tonnage: "3 920 кг", reps: "10 / 8 / 6 / 6", weights: "70×10 · 80×8 · 90×6 · 90×6", image: getActivityExerciseImage("Приседания со штангой") },
            { title: "Румынская тяга", sets: "4 подхода", tonnage: "2 480 кг", reps: "10 / 8 / 8 / 6", weights: "60×10 · 70×8 · 75×8 · 80×6", image: getActivityExerciseImage("Румынская тяга") },
            { title: "Жим ногами", sets: "4 подхода", tonnage: "1 920 кг", reps: "12 / 10 / 8 / 8", weights: "140×12 · 160×10 · 180×8 · 180×8", image: getActivityExerciseImage("Жим ногами") },
            { title: "Выпады с гантелями", sets: "3 подхода", tonnage: "960 кг", reps: "12 / 12 / 10", weights: "18×12 · 18×12 · 20×10", image: getActivityExerciseImage("Выпады с гантелями") },
            { title: "Сгибания ног в тренажёре", sets: "3 подхода", tonnage: "640 кг", reps: "15 / 12 / 12", weights: "30×15 · 35×12 · 35×12", image: getActivityExerciseImage("Сгибания ног в тренажёре") },
          ] as ActivityExerciseDetail[],
        },
        d30: {
          title: "Верх тела",
          date: "30 мая",
          badge: "Рекорд",
          duration: "54 мин",
          tonnage: "7 020 кг",
          exerciseCount: "5 упражнений",
          note: "Финальный сильный день цикла перед новым месяцем.",
          feeling: "Собранное",
          exercises: [
            { title: "Жим лёжа", sets: "4 подхода", tonnage: "2 260 кг", reps: "10 / 8 / 6 / 6", weights: "47.5×10 · 55×8 · 60×6 · 60×6", image: getActivityExerciseImage("Жим лёжа") },
            { title: "Тяга штанги", sets: "4 подхода", tonnage: "2 020 кг", reps: "10 / 8 / 8 / 6", weights: "45×10 · 55×8 · 60×8 · 65×6", image: getActivityExerciseImage("Тяга штанги") },
            { title: "Жим гантелей сидя", sets: "3 подхода", tonnage: "1 040 кг", reps: "12 / 10 / 10", weights: "16×12 · 18×10 · 18×10", image: getActivityExerciseImage("Жим гантелей сидя") },
          ] as ActivityExerciseDetail[],
        },
      },
      bestDays: [
        { date: "22 мая", title: "Ноги + ягодицы", value: "8 920 кг" },
        { date: "13 мая", title: "Грудь + трицепс", value: "7 450 кг" },
        { date: "6 мая", title: "Спина + бицепс", value: "6 780 кг" },
      ],
      records: [
        { title: "Жим ногами", gain: "+5 кг", date: "22 мая" },
        { title: "Приседания", gain: "+10 кг", date: "18 мая" },
        { title: "Тяга штанги", gain: "+7.5 кг", date: "13 мая" },
        { title: "Жим лёжа", gain: "+5 кг", date: "6 мая" },
      ],
    },
    {
      id: "jun-2026",
      label: "Июнь 2026",
      compareLabel: "к маю",
      ringDelta: "+18%",
      streak: { current: "2 дня подряд", best: "Лучшая серия: 5 дней", activeDays: 2 },
      summary: [
        { label: "тренировок", value: "9", icon: Dumbbell },
        { label: "тоннаж", value: "36 580 кг", icon: Trophy },
        { label: "время", value: "6 ч 42 мин", icon: Clock3 },
        { label: "выполнение плана", value: "78%", icon: Flame },
      ],
      totals: [
        { label: "Тренировок", value: "9", delta: "-9 к маю" },
        { label: "Тоннаж", value: "36 580 кг", delta: "-37 650 кг" },
        { label: "Время", value: "6 ч 42 мин", delta: "-6 ч 42 мин" },
      ],
      defaultSelectedKey: "d9",
      monthCells: [
        { key: "prev-1", day: 1, muted: true, intensity: 0 },
        { key: "d2", day: 2, intensity: 0 },
        { key: "d3", day: 3, intensity: 3 },
        { key: "d4", day: 4, intensity: 0 },
        { key: "d5", day: 5, intensity: 4 },
        { key: "d6", day: 6, intensity: 0 },
        { key: "d7", day: 7, intensity: 3 },
        { key: "d8", day: 8, intensity: 0 },
        { key: "d9", day: 9, intensity: 5, pr: true, best: true },
        { key: "d10", day: 10, intensity: 0 },
        { key: "d11", day: 11, intensity: 3 },
        { key: "d12", day: 12, intensity: 0 },
        { key: "d13", day: 13, intensity: 4 },
        { key: "d14", day: 14, intensity: 0 },
        { key: "d15", day: 15, intensity: 0 },
        { key: "d16", day: 16, intensity: 3 },
        { key: "d17", day: 17, intensity: 0 },
        { key: "d18", day: 18, intensity: 4 },
        { key: "d19", day: 19, intensity: 0 },
        { key: "d20", day: 20, intensity: 3 },
        { key: "d21", day: 21, intensity: 0 },
        { key: "d22", day: 22, intensity: 0 },
        { key: "d23", day: 23, intensity: 0 },
        { key: "d24", day: 24, intensity: 0 },
        { key: "d25", day: 25, intensity: 0 },
        { key: "d26", day: 26, intensity: 0 },
        { key: "d27", day: 27, intensity: 0 },
        { key: "d28", day: 28, intensity: 0 },
        { key: "d29", day: 29, intensity: 0 },
        { key: "d30", day: 30, intensity: 0 },
      ],
      dayStats: {
        d9: {
          title: "Грудь + трицепс",
          date: "9 июня",
          badge: "Лучший день",
          duration: "57 мин",
          tonnage: "7 080 кг",
          exerciseCount: "5 упражнений",
          note: "Сильная тренировка месяца с лучшим качеством техники и хорошим контролем темпа.",
          feeling: "Сильное",
          exercises: [
            { title: "Жим лёжа", sets: "4 подхода", tonnage: "2 260 кг", reps: "10 / 8 / 6 / 6", weights: "47.5×10 · 55×8 · 60×6 · 60×6", image: getActivityExerciseImage("Жим лёжа") },
            { title: "Жим гантелей", sets: "4 подхода", tonnage: "1 540 кг", reps: "10 / 10 / 8 / 8", weights: "20×10 · 22×10 · 24×8 · 24×8", image: getActivityExerciseImage("Жим гантелей") },
            { title: "Трицепс на блоке", sets: "3 подхода", tonnage: "820 кг", reps: "12 / 10 / 10", weights: "25×12 · 30×10 · 30×10", image: getActivityExerciseImage("Трицепс на блоке") },
          ] as ActivityExerciseDetail[],
        },
        d18: {
          title: "Спина + бицепс",
          date: "18 июня",
          badge: "Выполнено",
          duration: "53 мин",
          tonnage: "5 940 кг",
          exerciseCount: "4 упражнения",
          note: "Качественный рабочий день без перегруза, но с хорошим объёмом.",
          feeling: "Рабочее",
          exercises: [
            { title: "Тяга штанги", sets: "4 подхода", tonnage: "2 180 кг", reps: "10 / 8 / 8 / 6", weights: "45×10 · 55×8 · 60×8 · 65×6", image: getActivityExerciseImage("Тяга штанги") },
            { title: "Тяга блока", sets: "4 подхода", tonnage: "1 620 кг", reps: "12 / 10 / 10 / 8", weights: "45×12 · 50×10 · 55×10 · 60×8", image: getActivityExerciseImage("Тяга блока") },
            { title: "Сгибания на бицепс", sets: "3 подхода", tonnage: "780 кг", reps: "12 / 10 / 10", weights: "18×12 · 20×10 · 22×10", image: getActivityExerciseImage("Сгибания на бицепс") },
          ] as ActivityExerciseDetail[],
        },
      },
      bestDays: [
        { date: "9 июня", title: "Грудь + трицепс", value: "7 080 кг" },
        { date: "18 июня", title: "Спина + бицепс", value: "5 940 кг" },
        { date: "13 июня", title: "Верх тела", value: "5 480 кг" },
      ],
      records: [
        { title: "Жим лёжа", gain: "+2.5 кг", date: "9 июня" },
        { title: "Тяга блока", gain: "+5 кг", date: "18 июня" },
      ],
    },
  ] as const;

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(1);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(months[1].defaultSelectedKey);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const currentMonth = months[selectedMonthIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDayModalOpen(false);
        setIsMonthPickerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedDay =
    currentMonth.monthCells.find((cell) => cell.key === selectedDayKey) ??
    currentMonth.monthCells.find((cell) => !("muted" in cell && cell.muted) && cell.intensity > 0) ??
    currentMonth.monthCells.find((cell) => !("muted" in cell && cell.muted)) ??
    currentMonth.monthCells[0];

  const selectedDayDetails =
    "muted" in selectedDay && selectedDay.muted
      ? {
          title: "Тренировок не было",
          date: `${selectedDay.day} ${currentMonth.label.split(" ")[0].toLowerCase()}`,
          badge: "Пустой день",
          duration: "—",
          tonnage: "—",
          exerciseCount: "—",
          note: "Этот день относится к соседнему месяцу или в нём не было тренировочной активности.",
          feeling: "—",
          exercises: [] as ActivityExerciseDetail[],
        }
      : currentMonth.dayStats[selectedDay.key as keyof typeof currentMonth.dayStats] ?? {
          title: "В этот день тренировок не было",
          date: `${selectedDay.day} ${currentMonth.label.split(" ")[0].toLowerCase()}`,
          badge: selectedDay.intensity > 0 ? "Активность" : "Пустой день",
          duration: selectedDay.intensity > 0 ? "~45 мин" : "—",
          tonnage: selectedDay.intensity > 0 ? "—" : "—",
          exerciseCount: selectedDay.intensity > 0 ? "4 упражнения" : "—",
          note:
            selectedDay.intensity > 0
              ? "Активность зафиксирована, но подробная карточка этой тренировки пока не собрана."
              : "В этот день тренировок не было. Можно использовать его как восстановление или точку для новой сессии.",
          feeling: selectedDay.intensity > 0 ? "Нормальное" : "—",
          exercises: [] as ActivityExerciseDetail[],
        };

  const insights = {
    streak: currentMonth.streak,
    bestDay: currentMonth.bestDays[0],
    record: currentMonth.records[0],
  };
  const selectedDayHasWorkout = selectedDayDetails.exercises.length > 0;
  const selectedDayIsBest = "best" in selectedDay && Boolean(selectedDay.best);
  const selectedDayIsPR = "pr" in selectedDay && Boolean(selectedDay.pr);

  const renderIntensityDots = (intensity: number) => (
    <div className="mt-8 flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => {
        const active = index < intensity;
        return (
          <span
            key={index}
            className={cn(
              "h-2.5 w-2.5 rounded-full border border-zinc-800 transition",
              !active && "bg-zinc-900/80",
              active && intensity <= 2 && "bg-lime-300/40 shadow-[0_0_6px_rgba(163,230,53,0.12)]",
              active && intensity === 3 && "bg-lime-300/65 shadow-[0_0_8px_rgba(163,230,53,0.16)]",
              active && intensity === 4 && "bg-lime-300/80 shadow-[0_0_10px_rgba(163,230,53,0.2)]",
              active && intensity >= 5 && "bg-lime-300 shadow-[0_0_14px_rgba(163,230,53,0.28)]"
            )}
          />
        );
      })}
    </div>
  );

  const legendItems = [
    { label: "Нет", intensity: 0 },
    { label: "Лёгкая", intensity: 1 },
    { label: "Средняя", intensity: 3 },
    { label: "Высокая", intensity: 4 },
    { label: "Максимальная", intensity: 5 },
  ] as const;

  return (
    <DemoClientShell
      title="Активность"
      description="Ваша история тренировок и прогресс по дням."
    >
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[1.9rem] border-zinc-800/80 bg-[radial-gradient(circle_at_18%_16%,rgba(163,230,53,0.12),transparent_24%),radial-gradient(circle_at_78%_78%,rgba(163,230,53,0.1),transparent_20%),linear-gradient(180deg,rgba(18,18,21,0.985),rgba(8,8,11,0.99))] shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
          <CardContent className="space-y-6 p-5 lg:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonthIndex === 0) return;
                    const nextIndex = selectedMonthIndex - 1;
                    setSelectedMonthIndex(nextIndex);
                    setSelectedDayKey(months[nextIndex].defaultSelectedKey);
                    setIsMonthPickerOpen(false);
                  }}
                  disabled={selectedMonthIndex === 0}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen((value) => !value)}
                    className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-5 py-2.5 text-left transition hover:border-zinc-700 hover:bg-zinc-900/80"
                  >
                    <h2 className="text-[2rem] font-semibold tracking-tight text-zinc-50">{currentMonth.label}</h2>
                    <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition", isMonthPickerOpen && "rotate-180")} />
                  </button>

                  {isMonthPickerOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-3 w-60 rounded-[1.25rem] border border-zinc-800/90 bg-zinc-950/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                      {months.map((month, index) => (
                        <button
                          key={month.id}
                          type="button"
                          onClick={() => {
                            setSelectedMonthIndex(index);
                            setSelectedDayKey(month.defaultSelectedKey);
                            setIsMonthPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left transition",
                            index === selectedMonthIndex
                              ? "bg-lime-300/10 text-lime-100"
                              : "text-zinc-300 hover:bg-zinc-900/80 hover:text-zinc-100"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium">{month.label}</p>
                            <p className="mt-1 text-xs text-zinc-500">{month.summary[0]?.value} тренировок</p>
                          </div>
                          {index === selectedMonthIndex ? <CheckCircle2 className="h-4 w-4 text-lime-200" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonthIndex === months.length - 1) return;
                    const nextIndex = selectedMonthIndex + 1;
                    setSelectedMonthIndex(nextIndex);
                    setSelectedDayKey(months[nextIndex].defaultSelectedKey);
                    setIsMonthPickerOpen(false);
                  }}
                  disabled={selectedMonthIndex === months.length - 1}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:text-zinc-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5 xl:justify-end">
                {currentMonth.summary.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="min-w-[160px] rounded-full border border-zinc-800/80 bg-black/18 px-4 py-3 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-300/10 text-lime-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold leading-none text-zinc-50">{value}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 lg:gap-3">
              {currentMonth.monthCells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => {
                    if ("muted" in cell && cell.muted) return;
                    setSelectedDayKey(cell.key);
                    setIsDayModalOpen(true);
                  }}
                  disabled={"muted" in cell && cell.muted}
                  className={cn(
                    "relative min-h-[102px] rounded-[1.15rem] border p-3 text-left transition",
                    ("muted" in cell && cell.muted)
                      ? "border-zinc-900 bg-zinc-950/35 text-zinc-700"
                      : cell.key === selectedDayKey
                        ? "border-lime-300/55 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.14),transparent_65%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] shadow-[0_0_30px_rgba(163,230,53,0.22),inset_0_0_0_1px_rgba(163,230,53,0.12)]"
                        : "border-zinc-800 bg-[linear-gradient(180deg,rgba(23,23,27,0.98),rgba(10,10,12,0.98))] hover:border-zinc-700 hover:bg-zinc-950",
                    !("muted" in cell && cell.muted) &&
                      "best" in cell &&
                      cell.best &&
                      cell.key !== selectedDayKey &&
                      "border-lime-300/20 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.08),transparent_25%),linear-gradient(180deg,rgba(22,22,26,0.98),rgba(10,10,12,0.98))] shadow-[inset_0_1px_0_rgba(163,230,53,0.05)]"
                  )}
                >
                  {!("muted" in cell && cell.muted) && "best" in cell && cell.best ? (
                    <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/40 to-transparent" />
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-sm font-medium", ("muted" in cell && cell.muted) ? "text-zinc-700" : "text-zinc-100")}>
                      {cell.day}
                    </span>
                    {"best" in cell && cell.best ? (
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-lime-200",
                          cell.key === selectedDayKey
                            ? "bg-lime-300/18 shadow-[0_0_12px_rgba(163,230,53,0.18)]"
                            : "bg-lime-300/10"
                        )}
                      >
                        <Star className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>

                  {renderIntensityDots(cell.intensity)}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span className="text-zinc-500">Интенсивность</span>
                {legendItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 3 }).map((_, index) => {
                        const active = index < Math.max(1, Math.min(3, item.intensity || 1));
                        return (
                          <span
                            key={index}
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              item.intensity === 0 && "bg-zinc-800",
                              item.intensity > 0 && !active && "bg-zinc-800/80",
                              item.intensity === 1 && active && "bg-lime-300/35",
                              item.intensity === 3 && active && "bg-lime-300/60",
                              item.intensity === 4 && active && "bg-lime-300/80",
                              item.intensity === 5 && active && "bg-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.22)]"
                            )}
                          />
                        );
                      })}
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3.5 py-2 text-sm text-zinc-500">
                Нажми на день, чтобы открыть детали
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-3">
          <Card className="rounded-[1.3rem] border-zinc-800/80 bg-[radial-gradient(circle_at_20%_18%,rgba(163,230,53,0.12),transparent_28%),linear-gradient(180deg,rgba(18,18,21,0.985),rgba(8,8,11,0.99))]">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Серия</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[1.9rem] font-semibold leading-none text-zinc-50">{insights.streak.current}</p>
                  <p className="mt-1.5 text-xs text-zinc-500">{insights.streak.best}</p>
                </div>
                <Flame className="h-6 w-6 text-lime-200" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day, index) => (
                  <div key={day} className="flex flex-col items-center gap-2 text-[10px] text-zinc-500">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border",
                        index < insights.streak.activeDays
                          ? "border-lime-300/20 bg-lime-300/12 text-lime-100 shadow-[0_0_14px_rgba(163,230,53,0.16)]"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-700"
                      )}
                    >
                      {index < insights.streak.activeDays ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </span>
                    <span>{day}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.3rem] border-zinc-800/80 bg-[linear-gradient(180deg,rgba(18,18,21,0.985),rgba(8,8,11,0.99))]">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Лучший день</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[1.75rem] font-semibold tracking-tight text-zinc-50">{insights.bestDay?.date}</p>
                  <p className="mt-1.5 text-sm font-medium text-zinc-100">{insights.bestDay?.title}</p>
                  <p className="mt-1.5 text-sm text-lime-300">{insights.bestDay?.value}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-300/8 text-lime-200">
                  <Star className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.3rem] border-zinc-800/80 bg-[radial-gradient(circle_at_78%_14%,rgba(163,230,53,0.08),transparent_22%),linear-gradient(180deg,rgba(18,18,21,0.985),rgba(8,8,11,0.99))]">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Личный рекорд</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[2rem] font-semibold leading-none text-lime-300">{insights.record?.gain}</p>
                  <p className="mt-1.5 text-sm font-medium text-zinc-100">{insights.record?.title}</p>
                  <p className="mt-1.5 text-xs text-zinc-500">{insights.record?.date}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-300/8 text-lime-200">
                  <Trophy className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[1.85rem] border-zinc-800/85 bg-[radial-gradient(circle_at_78%_42%,rgba(163,230,53,0.08),transparent_18%),linear-gradient(180deg,rgba(18,18,21,0.985),rgba(9,9,12,0.99))]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-zinc-50">Итоги за {currentMonth.label.split(" ")[0].toLowerCase()}</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">Главные результаты месяца в более ровной и читаемой композиции.</CardDescription>
                </div>
                <p className="text-sm text-zinc-500">{currentMonth.compareLabel}</p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 xl:grid-cols-[1fr_240px] xl:items-center">
              <div className="grid gap-3 sm:grid-cols-3">
                {currentMonth.totals.map((item) => (
                  <div key={item.label} className="rounded-[1.2rem] border border-zinc-800/80 bg-black/18 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                    <p className="mt-3 text-[1.8rem] font-semibold leading-none text-zinc-50">{item.value}</p>
                    <p className="mt-3 text-sm text-lime-300">{item.delta}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center rounded-[1.4rem] border border-zinc-800/80 bg-black/18 p-4">
                <div className="relative flex h-[200px] w-[200px] items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.16),transparent_62%)]" />
                  <div
                    className="absolute inset-[10px] rounded-full"
                    style={{
                      background: "conic-gradient(rgba(163,230,53,0.98) 0 148deg, rgba(39,39,42,0.75) 148deg 360deg)",
                    }}
                  />
                  <div className="absolute inset-[28px] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_36%),linear-gradient(180deg,rgba(16,16,19,0.98),rgba(7,7,9,0.98))]" />
                  <div className="relative z-10 text-center">
                    <p className="text-[2.8rem] font-semibold tracking-tight text-lime-300">{currentMonth.ringDelta}</p>
                    <p className="mt-2 text-sm text-zinc-300">рост силы</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{currentMonth.compareLabel}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[1.85rem] border-zinc-800/85 bg-[radial-gradient(circle_at_24%_80%,rgba(163,230,53,0.1),transparent_20%),linear-gradient(180deg,rgba(18,18,21,0.985),rgba(8,8,11,0.99))]">
            <CardContent className="space-y-4 p-5 lg:p-6">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-50">Поделитесь своим прогрессом</h3>
                <p className="mt-2 max-w-xl text-sm text-zinc-400">
                  Создайте компактную карточку с итогами месяца и сохраните её для сторис или скрина.
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[1.45rem] border border-zinc-800/70 bg-[radial-gradient(circle_at_72%_24%,rgba(163,230,53,0.22),transparent_18%),linear-gradient(160deg,rgba(33,33,37,0.98),rgba(11,11,13,0.98))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(163,230,53,0.06))]" />
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{currentMonth.label.toUpperCase()}</p>
                <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <p className="text-[1.8rem] font-semibold text-zinc-50">{currentMonth.summary[0]?.value}</p>
                    <p className="mt-1 text-xs text-zinc-400">тренировок</p>
                  </div>
                  <div>
                    <p className="text-[1.8rem] font-semibold text-zinc-50">{currentMonth.summary[1]?.value}</p>
                    <p className="mt-1 text-xs text-zinc-400">тоннаж</p>
                  </div>
                  <div>
                    <p className="text-[1.8rem] font-semibold text-zinc-50">{currentMonth.summary[2]?.value.split(" ").slice(0, 2).join(" ")}</p>
                    <p className="mt-1 text-xs text-zinc-400">время</p>
                  </div>
                  <div>
                    <p className="text-[1.8rem] font-semibold text-lime-300">{currentMonth.ringDelta}</p>
                    <p className="mt-1 text-xs text-zinc-400">рост силы</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="h-11 rounded-full bg-lime-300 px-5 text-zinc-950 hover:bg-lime-200">
                  <Share2 className="mr-2 h-4 w-4" />
                  Создать карточку
                </Button>
                <Button variant="outline" className="h-11 rounded-full border-zinc-700 bg-zinc-950/40 px-4 text-zinc-100 hover:bg-zinc-900">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isDayModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/65 px-3 py-3 backdrop-blur-md lg:px-4 lg:py-4"
          onClick={() => setIsDayModalOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-[680px] flex-col overflow-hidden rounded-[2rem] border border-zinc-800/85 bg-[radial-gradient(circle_at_80%_16%,rgba(163,230,53,0.12),transparent_22%),radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.05),transparent_24%),linear-gradient(180deg,rgba(18,18,21,0.99),rgba(8,8,11,0.995))] shadow-[0_35px_120px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-zinc-900/80 px-5 py-5 lg:px-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),transparent)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <p className="text-sm font-medium text-lime-200">{selectedDayDetails.date}</p>
                    {selectedDayIsBest ? (
                      <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-lime-100">
                        Лучший день
                      </span>
                    ) : null}
                    {selectedDayIsPR && !selectedDayIsBest ? (
                      <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-lime-100">
                        Рекорд
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-[2rem] font-semibold tracking-tight text-zinc-50">{selectedDayDetails.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                    {selectedDayHasWorkout
                      ? "Детали этой сессии, её объём и основные упражнения."
                      : "В этот день активности не было — можно оставить его как восстановление или точку старта для новой сессии."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={cn(
                      "rounded-full border",
                      selectedDayIsBest || selectedDayIsPR
                        ? "border-lime-300/15 bg-lime-300/10 text-lime-100"
                        : "border-zinc-800 bg-zinc-950/80 text-zinc-300"
                    )}
                  >
                    {selectedDayDetails.badge}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setIsDayModalOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-400 transition hover:text-zinc-100"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
              <div className="relative mt-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <div className="relative mt-4 grid gap-3 md:grid-cols-3">
                {[
                  { label: "Длительность", value: selectedDayDetails.duration, icon: Clock3 },
                  { label: "Тоннаж", value: selectedDayDetails.tonnage, icon: Trophy },
                  { label: "Упражнения", value: selectedDayDetails.exerciseCount, icon: Dumbbell },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="min-w-0 rounded-[1.15rem] border border-zinc-800/80 bg-black/18 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-300/8 text-lime-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[1.05rem] font-semibold leading-tight text-zinc-50">{value}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 lg:p-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-medium text-zinc-50">Упражнения</h4>
                    {selectedDayHasWorkout ? (
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Сеты и тоннаж</span>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedDayHasWorkout ? (
                      selectedDayDetails.exercises.map((exercise) => (
                        <div
                          key={exercise.title}
                          className="rounded-[1.25rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(20,20,24,0.92),rgba(11,11,13,0.92))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="relative h-14 w-14 overflow-hidden rounded-[0.95rem] border border-zinc-800 bg-zinc-950/75">
                              {exercise.image ? (
                                <Image
                                  src={exercise.image}
                                  alt={exercise.title}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-lime-200">
                                  <Dumbbell className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-100">{exercise.title}</p>
                              <p className="mt-1 text-xs text-zinc-500">{exercise.sets}</p>
                            </div>
                          </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium text-zinc-50">{exercise.tonnage}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">объём</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(exercise.weights ?? exercise.reps).split("·").map((setValue, setIndex) => (
                              <span
                                key={`${exercise.title}-${setIndex}-${setValue.trim()}`}
                                className="rounded-full border border-zinc-800 bg-zinc-950/75 px-2.5 py-1 text-[11px] font-medium text-zinc-300"
                              >
                                {setValue.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-zinc-800/80 bg-black/18 px-4 py-5 text-sm leading-relaxed text-zinc-400">
                        В этот день тренировок не было.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-zinc-800/80 bg-black/18 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Заметки</p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">{selectedDayDetails.note}</p>
                  </div>

                  <div className="rounded-[1.25rem] border border-zinc-800/80 bg-black/18 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Самочувствие</p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/8 px-3 py-2 text-sm text-lime-100">
                      <Heart className="h-4 w-4" />
                      {selectedDayDetails.feeling}
                    </div>
                  </div>
                </div>
                <div className="border-t border-zinc-900/80 pt-1">
                  <Button
                    className="w-full rounded-full bg-lime-300 text-zinc-950 hover:bg-lime-200"
                    disabled={!selectedDayHasWorkout}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {selectedDayHasWorkout ? "Повторить тренировку" : "В этот день тренировок не было"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DemoClientShell>
  );
}

export function DemoClientProgressPage() {
  const [weightRange, setWeightRange] = useState<"30 дней" | "6 недель" | "3 месяца">("6 недель");
  const [selectedExercise, setSelectedExercise] = useState("Жим ногами");

  const heroProgress = 62;
  const weightProgress = [
    { label: "30 дней", start: 69.1, current: 68.4, change: -0.7, data: [
      { date: "22 апр", value: 69.1 },
      { date: "26 апр", value: 69.0 },
      { date: "30 апр", value: 68.9 },
      { date: "4 мая", value: 68.8 },
      { date: "8 мая", value: 68.6 },
      { date: "12 мая", value: 68.5 },
      { date: "22 мая", value: 68.4 },
    ] },
    { label: "6 недель", start: 69.6, current: 68.4, change: -1.2, data: [
      { date: "1 мая", value: 69.6 },
      { date: "4 мая", value: 69.4 },
      { date: "8 мая", value: 69.0 },
      { date: "12 мая", value: 68.8 },
      { date: "16 мая", value: 68.6 },
      { date: "19 мая", value: 68.5 },
      { date: "22 мая", value: 68.4 },
    ] },
    { label: "3 месяца", start: 71.8, current: 68.4, change: -3.4, data: [
      { date: "1 мар", value: 71.8 },
      { date: "15 мар", value: 71.1 },
      { date: "1 апр", value: 70.4 },
      { date: "15 апр", value: 69.8 },
      { date: "1 мая", value: 69.2 },
      { date: "15 мая", value: 68.8 },
      { date: "22 мая", value: 68.4 },
    ] },
  ];

  const featuredStrengthProgress = useMemo(
    () =>
      ({
        "Жим ногами": {
          e1rm: 167,
          growth: 41,
          start: 118,
          current: 167,
          bestSet: "150 кг × 5 повторений",
          bestSetDate: "22 мая 2024",
          data: [
            { date: "1 апр", value: 118 },
            { date: "8 апр", value: 126 },
            { date: "15 апр", value: 134 },
            { date: "22 апр", value: 142 },
            { date: "1 мая", value: 151 },
            { date: "15 мая", value: 160 },
            { date: "22 мая", value: 167 },
          ],
        },
        "Жим лёжа": {
          e1rm: 82,
          growth: 18,
          start: 69,
          current: 82,
          bestSet: "72.5 кг × 5 повторений",
          bestSetDate: "20 мая 2024",
          data: [
            { date: "1 апр", value: 69 },
            { date: "8 апр", value: 71 },
            { date: "15 апр", value: 73 },
            { date: "22 апр", value: 75 },
            { date: "1 мая", value: 78 },
            { date: "15 мая", value: 80 },
            { date: "22 мая", value: 82 },
          ],
        },
        "Приседания": {
          e1rm: 112,
          growth: 24,
          start: 90,
          current: 112,
          bestSet: "100 кг × 4 повторения",
          bestSetDate: "18 мая 2024",
          data: [
            { date: "1 апр", value: 90 },
            { date: "8 апр", value: 94 },
            { date: "15 апр", value: 97 },
            { date: "22 апр", value: 101 },
            { date: "1 мая", value: 105 },
            { date: "15 мая", value: 109 },
            { date: "22 мая", value: 112 },
          ],
        },
        "Тяга штанги": {
          e1rm: 101,
          growth: 16,
          start: 87,
          current: 101,
          bestSet: "92.5 кг × 4 повторения",
          bestSetDate: "16 мая 2024",
          data: [
            { date: "1 апр", value: 87 },
            { date: "8 апр", value: 89 },
            { date: "15 апр", value: 92 },
            { date: "22 апр", value: 94 },
            { date: "1 мая", value: 96 },
            { date: "15 мая", value: 99 },
            { date: "22 мая", value: 101 },
          ],
        },
      }) as const,
    []
  );

  const allStrengthProgress = useMemo(() => {
    const exerciseNames = Array.from(
      new Set(
        getDemoLibraryExercises()
          .map((exercise) => (typeof exercise.title === "string" ? exercise.title.trim() : ""))
          .filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b, "ru"));

    const progressMap: Record<
      string,
      {
        e1rm: number;
        growth: number;
        start: number;
        current: number;
        bestSet: string;
        bestSetDate: string;
        data: ReadonlyArray<{ date: string; value: number }>;
      }
    > = {
      ...featuredStrengthProgress,
    };

    exerciseNames.forEach((name, index) => {
      if (progressMap[name]) {
        return;
      }

      const growth = 9 + (index % 11) * 2;
      const start = 42 + (index % 9) * 8 + Math.floor(index / 3);
      const current = Math.round(start * (1 + growth / 100));
      const topSetWeight = Math.max(20, Math.round(current * 0.88));
      const reps = 4 + (index % 5);

      progressMap[name] = {
        e1rm: current,
        growth,
        start,
        current,
        bestSet: `${topSetWeight} кг × ${reps} повторений`,
        bestSetDate: "22 мая 2024",
        data: [
          { date: "1 апр", value: start },
          { date: "8 апр", value: Math.round(start * 1.03) },
          { date: "15 апр", value: Math.round(start * 1.05) },
          { date: "22 апр", value: Math.round(start * 1.08) },
          { date: "1 мая", value: Math.round(start * 1.11) },
          { date: "15 мая", value: Math.round(start * (1 + (growth - 2) / 100)) },
          { date: "22 мая", value: current },
        ],
      };
    });

    return progressMap;
  }, [featuredStrengthProgress]);

  const currentWeightProgress = weightProgress.find((item) => item.label === weightRange) ?? weightProgress[1];
  const fallbackStrength = featuredStrengthProgress["Жим ногами"];
  const strengthExerciseNames = Array.from(
    new Set([...Object.keys(featuredStrengthProgress), ...Object.keys(allStrengthProgress)])
  ).sort((a, b) => a.localeCompare(b, "ru"));
  const currentStrength = allStrengthProgress[selectedExercise] || fallbackStrength;

  const bodyChanges = [
    {
      label: "Вес",
      value: "-1.2 кг",
      helper: "68.4 кг сейчас",
      spark: [16, 15, 14, 13, 11, 10, 9],
    },
    {
      label: "Талия",
      value: "-2 см",
      helper: "89 см сейчас",
      spark: [12, 12, 11, 10, 9, 9, 8],
    },
    {
      label: "Бёдра",
      value: "-1 см",
      helper: "99 см сейчас",
      spark: [14, 13, 13, 12, 11, 10, 10],
    },
    {
      label: "Грудь",
      value: "+1 см",
      helper: "98 см сейчас",
      spark: [8, 9, 10, 9, 10, 11, 12],
    },
    {
      label: "Фото прогресса",
      value: "4 фото",
      helper: "Загружено в цикл",
      spark: [6, 7, 7, 8, 8, 9, 10],
    },
  ] as const;

  const recentWorkouts = [
    { id: "rw1", date: "22 мая", title: "Ноги + ягодицы", duration: "60 мин", load: "7.4 т" },
    { id: "rw2", date: "20 мая", title: "Верх тела", duration: "55 мин", load: "5.1 т" },
    { id: "rw3", date: "18 мая", title: "Кардио + пресс", duration: "45 мин", load: "Интервалы" },
    { id: "rw4", date: "16 мая", title: "Спина + бицепс", duration: "60 мин", load: "6.2 т" },
  ] as const;

  const achievements = [
    { id: "a1", title: "Серия 7 дней", helper: "Ритм без пропусков" },
    { id: "a2", title: "Сила растёт", helper: "+41% к e1RM" },
    { id: "a3", title: "Минус 1 кг", helper: "Вес уходит вниз" },
    { id: "a4", title: "Дисциплина", helper: "Фокус держится" },
  ] as const;

  const transformationPhotos = {
    before: {
      label: "Первое фото",
      date: "1 мая 2024",
      image: null as string | null,
    },
    after: {
      label: "Последнее фото",
      date: "22 мая 2024",
      image: null as string | null,
    },
  };
  const hasBeforePhoto = Boolean(transformationPhotos.before.image);
  const hasAfterPhoto = Boolean(transformationPhotos.after.image);

  return (
    <DemoClientShell
      title="Прогресс"
      description="Следите за своим прогрессом и двигайтесь к цели."
    >
      <div className="space-y-4">
        <div className="w-full">
          <Card className="overflow-hidden rounded-[1.9rem] border-zinc-800/70 bg-[radial-gradient(circle_at_16%_18%,rgba(163,230,53,0.16),transparent_22%),radial-gradient(circle_at_45%_34%,rgba(163,230,53,0.18),transparent_18%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.04),transparent_16%),linear-gradient(135deg,rgba(24,24,28,0.985),rgba(10,10,13,0.985)_62%,rgba(7,7,9,0.99))] shadow-[0_36px_110px_rgba(0,0,0,0.34)]">
            <CardContent className="relative overflow-hidden p-5 lg:p-6">
              <div className="pointer-events-none absolute left-[28%] top-[10%] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.22),transparent_62%)] blur-3xl" />

              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_240px_minmax(250px,0.72fr)] xl:items-center">
                <div className="max-w-[360px] space-y-5">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Ты ближе к цели на</p>
                    <p className="mt-2 text-[4rem] font-semibold leading-none tracking-tight text-lime-300 drop-shadow-[0_0_22px_rgba(163,230,53,0.2)] lg:text-[4.8rem]">
                      {heroProgress}%
                    </p>
                    <p className="mt-2 text-base text-zinc-100">Ты на правильном пути!</p>
                    <p className="mt-1 text-sm text-zinc-500">Твоя динамика остаётся стабильной и без резких откатов.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">68.4 кг</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Текущий вес</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-zinc-100">63.0 кг</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Цель</p>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900/70">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(163,230,53,0.95),rgba(187,247,110,0.9))] shadow-[0_0_22px_rgba(163,230,53,0.34)]"
                        style={{ width: `${heroProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center xl:justify-start">
                  <div className="relative flex h-[212px] w-[212px] items-center justify-center">
                    <div className="absolute inset-[-14%] rounded-full bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.24),transparent_58%)] blur-3xl" />
                    <div className="absolute inset-0 rounded-full border border-lime-300/10 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.1),transparent_68%)]" />
                    <div
                      className="absolute inset-[9px] rounded-full shadow-[0_0_44px_rgba(163,230,53,0.14)]"
                      style={{
                        background: `conic-gradient(from 210deg, rgba(190,242,100,0.16) 0deg, rgba(163,230,53,1) ${heroProgress * 3.6 * 0.78}deg, rgba(132,204,22,0.88) ${heroProgress * 3.6}deg, rgba(39,39,42,0.32) ${heroProgress * 3.6}deg, rgba(18,18,20,0.94) 360deg)`,
                      }}
                    />
                    <div className="absolute inset-[24px] rounded-full border border-white/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.055),transparent_34%),linear-gradient(180deg,rgba(16,16,19,0.98),rgba(6,6,8,0.98))]" />
                    <div className="absolute inset-[17px] rounded-full border border-lime-300/8" />
                    <div className="relative z-10 text-center">
                      <p className="text-[2.4rem] font-semibold tracking-tight text-zinc-50">{heroProgress}%</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">пути к цели</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-zinc-800/70">
                  {[
                    { label: "Серия", value: "14 дней", helper: "без пропусков", icon: Flame },
                    { label: "Активность", value: "4–5", helper: "тренировок в неделю", icon: LineChart },
                    { label: "Силовой прогресс", value: "+41%", helper: "к расчётной силе", icon: Dumbbell },
                    { label: "Тренировок за неделю", value: "6/6", helper: "выполнено", icon: CalendarDays },
                  ].map(({ label, value, helper, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3 xl:py-4 xl:first:pt-0 xl:last:pb-0">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-300/8 text-lime-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[1.5rem] font-semibold leading-none text-zinc-50">{value}</p>
                        <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                        <p className="mt-1 text-xs text-zinc-400">{helper}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-[1.8rem] border-zinc-800/90 bg-[radial-gradient(circle_at_15%_18%,rgba(163,230,53,0.08),transparent_22%),linear-gradient(180deg,rgba(17,17,20,0.98),rgba(8,8,11,0.98))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-50">Трансформация</CardTitle>
            <CardDescription className="text-zinc-400">
              Сравнение первого и последнего фото.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-2 lg:p-6 lg:pt-2 xl:grid-cols-[minmax(0,1fr)_280px] xl:grid-rows-[auto_1fr]">
            <div className="space-y-1.5 xl:col-start-1 xl:row-start-1">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
                <span>{transformationPhotos.before.label}</span>
              </div>
              {hasBeforePhoto ? <p className="text-sm text-zinc-500">{transformationPhotos.before.date}</p> : null}
            </div>

            <div className="hidden xl:block xl:col-start-2 xl:row-start-1" />

            <div className="space-y-1.5 xl:col-start-1 xl:row-start-1 xl:ml-[calc(50%+2.25rem)] xl:w-[calc(50%-2.25rem)]">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
                <span>{transformationPhotos.after.label}</span>
              </div>
              {hasAfterPhoto ? <p className="text-sm text-zinc-500">{transformationPhotos.after.date}</p> : null}
            </div>

            <div className="hidden xl:block xl:col-start-2 xl:row-start-1" />

            <div className="grid gap-3 xl:col-start-1 xl:row-start-2 xl:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] xl:items-stretch">
              <ProgressPhotoScene variant="before" image={transformationPhotos.before.image} />

              <div className="hidden xl:flex xl:flex-col xl:items-center xl:justify-center xl:gap-2">
                <div className="h-px w-8 bg-zinc-800" />
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/8 text-lime-100 shadow-[0_0_20px_rgba(163,230,53,0.14)]">
                  <ChevronRight className="h-5 w-5" />
                </div>
                <div className="h-px w-8 bg-zinc-800" />
              </div>

              <ProgressPhotoScene variant="after" image={transformationPhotos.after.image} />
            </div>

            <div className="flex h-full flex-col space-y-2.5 rounded-[1.25rem] border border-zinc-800 bg-black/20 p-3.5 xl:col-start-2 xl:row-start-2">
              <p className="text-base font-semibold text-zinc-50">За 6 недель</p>
              <div className="flex flex-1 flex-col justify-between gap-2.5">
                <div className="flex items-start gap-3 rounded-[1rem] border border-zinc-800 bg-zinc-950/60 p-3">
                  <span className="text-xl text-lime-300">↓</span>
                  <div>
                    <p className="text-lg font-semibold text-zinc-50">-1.2 кг</p>
                    <p className="text-xs text-zinc-400">Снижение веса</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[1rem] border border-zinc-800 bg-zinc-950/60 p-3">
                  <span className="text-xl text-lime-300">↑</span>
                  <div>
                    <p className="text-lg font-semibold text-zinc-50">+5 кг</p>
                    <p className="text-xs text-zinc-400">Прогресс в силе</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[1rem] border border-zinc-800 bg-zinc-950/60 p-3">
                  <Flame className="mt-1 h-5 w-5 text-lime-300" />
                  <div>
                    <p className="text-lg font-semibold text-zinc-50">14</p>
                    <p className="text-xs text-zinc-400">Тренировок</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-1 w-full rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                Все фото
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr] xl:items-stretch">
          <Card className="flex h-full flex-col rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-zinc-50">Динамика веса</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">
                    Ровный визуальный темп без лишней аналитической нагрузки.
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
                  {weightProgress.map((range) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => setWeightRange(range.label as "30 дней" | "6 недель" | "3 месяца")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition",
                        weightRange === range.label
                          ? "bg-zinc-100 text-black"
                          : "text-zinc-500 hover:text-zinc-200"
                      )}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4">
              <div className="grid min-h-[132px] gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                  <p className="text-sm font-medium text-lime-200">{weightRange}</p>
                  <p className="mt-2 text-sm text-zinc-400">Текущая динамика веса</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-lime-300">{currentWeightProgress.current.toFixed(1)} кг</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-50">
                    {currentWeightProgress.change > 0 ? "+" : ""}
                    {currentWeightProgress.change.toFixed(1)} кг
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">Изменение за период</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ProgressStat label="Начальный вес" value={`${currentWeightProgress.start.toFixed(1)} кг`} helper="Старт периода" />
                  <ProgressStat label="Текущий" value={`${currentWeightProgress.current.toFixed(1)} кг`} helper="Сегодня" />
                  <ProgressStat
                    label="Изменение"
                    value={`${currentWeightProgress.change > 0 ? "+" : ""}${currentWeightProgress.change.toFixed(1)} кг`}
                    helper="Движение к цели"
                    accent
                  />
                </div>
              </div>

              <div className="h-[280px] rounded-[1.4rem] border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,15,0.96),rgba(8,8,10,0.98))] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentWeightProgress.data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(163,230,53,0.45)" />
                        <stop offset="100%" stopColor="rgba(163,230,53,0.02)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#52525b", fontSize: 12 }} width={36} />
                    <RechartsTooltip
                      cursor={{ stroke: "rgba(163,230,53,0.2)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "rgba(10,10,12,0.96)",
                        border: "1px solid rgba(63,63,70,0.9)",
                        borderRadius: "16px",
                        color: "#f4f4f5",
                      }}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)} кг`, "Вес"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#bef264"
                      strokeWidth={3}
                      fill="url(#weightFill)"
                      dot={{ r: 0 }}
                      activeDot={{ r: 5, fill: "#bef264", stroke: "#1a1a1a", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-400">Текущий ориентир</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-50">Вес идёт вниз без резких скачков</p>
                  </div>
                  <p className="text-sm text-zinc-500">22 мая 2024</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-zinc-50">Силовой прогресс</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">
                    Расчётная сила (e1RM), а не просто самый тяжёлый подход.
                  </CardDescription>
                </div>
                <div className="relative">
                  <select
                    value={selectedExercise}
                    onChange={(event) => setSelectedExercise(event.target.value)}
                    className="h-11 min-w-[230px] appearance-none rounded-full border border-zinc-800 bg-zinc-950/80 px-4 pr-11 text-sm font-medium text-zinc-100 outline-none transition hover:border-zinc-700"
                  >
                    {strengthExerciseNames.map((exercise) => (
                      <option key={exercise} value={exercise}>
                        {exercise}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4">
              <div className="grid min-h-[132px] gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                  <p className="text-sm font-medium text-lime-200">{selectedExercise}</p>
                  <p className="mt-2 text-sm text-zinc-400">Расчётная сила (e1RM)</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-lime-300">{currentStrength.e1rm} кг</p>
                  <p className="mt-2 text-xl font-semibold text-zinc-50">+{currentStrength.growth}%</p>
                  <p className="mt-1 text-sm text-zinc-400">Прирост</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ProgressStat label="Начало" value={`${currentStrength.start} кг`} helper="Старт e1RM" />
                  <ProgressStat label="Сейчас" value={`${currentStrength.current} кг`} helper="Текущий e1RM" />
                  <ProgressStat label="Прирост" value={`+${currentStrength.growth}%`} helper="К силе" accent />
                </div>
              </div>

              <div className="h-[280px] rounded-[1.4rem] border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,15,0.96),rgba(8,8,10,0.98))] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={currentStrength.data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="strengthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(163,230,53,0.28)" />
                        <stop offset="100%" stopColor="rgba(163,230,53,0.01)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#52525b", fontSize: 12 }} width={36} />
                    <RechartsTooltip
                      cursor={{ stroke: "rgba(163,230,53,0.2)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "rgba(10,10,12,0.96)",
                        border: "1px solid rgba(63,63,70,0.9)",
                        borderRadius: "16px",
                        color: "#f4f4f5",
                      }}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(0)} кг`, "e1RM"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="transparent" fill="url(#strengthFill)" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#a3e635"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#a3e635", stroke: "#101012", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#d9f99d", stroke: "#101012", strokeWidth: 2 }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-400">Лучший рабочий сет</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-50">{currentStrength.bestSet}</p>
                  </div>
                  <p className="text-sm text-zinc-500">{currentStrength.bestSetDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50">Изменения тела</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.1fr]">
            {bodyChanges.map((item, index) => (
              <div key={item.label} className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                <p className="mt-2.5 text-[1.65rem] font-semibold tracking-tight text-zinc-50">{item.value}</p>
                <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
                <div className="mt-3 h-8">
                  <ProgressSparkline values={item.spark} accent={index === 3} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.75rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-zinc-50">Последние тренировки</CardTitle>
                  <CardDescription className="mt-1 text-zinc-400">
                    Последняя активность без скучной таблицы.
                  </CardDescription>
                </div>
                <Button variant="ghost" className="rounded-full text-lime-200 hover:bg-zinc-900/50 hover:text-lime-100">
                  Смотреть все
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recentWorkouts.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-lime-300/15 bg-lime-300/10 text-lime-200">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.date}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{item.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-100">{item.duration}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.load}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-50">Достижения</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 sm:grid-cols-2">
              {achievements.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[1.1rem] border px-3 py-3",
                    index === 1
                      ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.12),rgba(9,9,11,0.36))]"
                      : "border-zinc-800 bg-black/20"
                  )}
                >
                  <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{item.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[1.55rem] border-zinc-800/90 bg-[linear-gradient(90deg,rgba(17,17,20,0.98),rgba(11,11,14,0.98))]">
          <CardContent className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-lime-300/15 bg-lime-300/10 text-lime-200">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="text-sm text-zinc-200 lg:text-base">
              Отличная работа! Продолжай в том же духе — ты каждый день становишься лучше.
            </p>
          </CardContent>
        </Card>
      </div>
    </DemoClientShell>
  );
}

function ProgressStat({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("min-w-0 rounded-[1.15rem] border p-4", accent ? "border-lime-300/20 bg-lime-300/8" : "border-zinc-800 bg-black/20")}>
      <p className="text-[11px] font-medium leading-4 tracking-[0.08em] text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-3 whitespace-nowrap text-[1.4rem] font-semibold tracking-tight sm:text-[1.5rem]",
          accent ? "text-lime-300" : "text-zinc-50"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-sm leading-6 text-zinc-400">{helper}</p>
    </div>
  );
}

function ProgressPhotoScene({
  variant,
  image,
}: {
  variant: "before" | "after";
  image?: string | null;
}) {
  if (!image) {
    return (
      <div className="relative aspect-[4/3.15] overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-[radial-gradient(circle_at_50%_18%,rgba(163,230,53,0.05),transparent_24%),linear-gradient(180deg,rgba(8,8,10,0.98),rgba(13,13,15,0.98))]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-zinc-800 bg-zinc-950/90 text-zinc-500 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <Camera className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-200">Фото прогресса пока нет</p>
            <p className="mx-auto max-w-[280px] text-xs leading-5 text-zinc-500">
              Добавьте фотографии в профиле, чтобы сравнение появилось здесь.
            </p>
          </div>
          <Link
            href="/client/settings"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/90 px-4 py-2 text-sm text-zinc-100 transition hover:border-lime-300/30 hover:bg-zinc-900"
          >
            <Camera className="h-4 w-4" />
            Открыть профиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3.15] overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(23,23,27,0.98),rgba(10,10,12,0.98))]">
      <Image
        src={image}
        alt={variant === "after" ? "Последнее фото прогресса" : "Первое фото прогресса"}
        fill
        className="object-cover"
        sizes="(min-width: 1280px) 22vw, (min-width: 768px) 42vw, 90vw"
      />
      <div className={cn(
        "absolute inset-0",
        variant === "after"
          ? "bg-[radial-gradient(circle_at_50%_18%,rgba(163,230,53,0.08),transparent_28%)]"
          : "bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.04),transparent_24%)]"
      )} />
    </div>
  );
}

function ProgressSparkline({ values, accent = false }: { values: readonly number[]; accent?: boolean }) {
  const width = 120;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <polyline
        fill="none"
        stroke={accent ? "#bef264" : "#a3e635"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function DemoClientSettingsPage() {
  const data = getDemoClientSummary();
  const [activeAngle, setActiveAngle] = useState<"Спереди" | "Сбоку" | "Сзади">("Спереди");
  const [activeProfileSection, setActiveProfileSection] = useState<
    "basic" | "body" | "notifications" | "privacy" | null
  >(null);
  const [profileState, setProfileState] = useState({
    fullName: "Мария Волкова",
    birthDate: "1996-08-14",
    gender: "Женщина",
    currentWeight: "68.4",
    targetWeight: "63.0",
    height: "168",
    activity: "4–5",
    streak: "14",
    telegram: "@demo_trainer",
    reminders: true,
    telegramAlerts: true,
    coachCanViewPhotos: true,
    profileVisibility: "Только я и тренер",
  });
  const [draftState, setDraftState] = useState(profileState);
  const [progressPhotos, setProgressPhotos] = useState<
    Record<
      "Спереди" | "Сбоку" | "Сзади",
      Array<{ id: string; label: string; date: string; current?: boolean; image?: string | null }>
    >
  >({
    Спереди: [
      { id: "start-front", label: "Начало", date: "1 мая 2026", image: null },
      { id: "week1-front", label: "1 неделя", date: "8 мая 2026", image: null },
      { id: "week3-front", label: "3 неделя", date: "22 мая 2026", current: true, image: null },
      { id: "week6-front", label: "6 недель", date: "12 июня 2026", image: null },
    ],
    Сбоку: [
      { id: "start-side", label: "Начало", date: "1 мая 2026", image: null },
      { id: "week1-side", label: "1 неделя", date: "8 мая 2026", image: null },
      { id: "week3-side", label: "3 неделя", date: "22 мая 2026", current: true, image: null },
      { id: "week6-side", label: "6 недель", date: "12 июня 2026", image: null },
    ],
    Сзади: [
      { id: "start-back", label: "Начало", date: "1 мая 2026", image: null },
      { id: "week1-back", label: "1 неделя", date: "8 мая 2026", image: null },
      { id: "week3-back", label: "3 неделя", date: "22 мая 2026", current: true, image: null },
      { id: "week6-back", label: "6 недель", date: "12 июня 2026", image: null },
    ],
  });
  const currentWeightValue = Number.parseFloat(profileState.currentWeight.replace(",", "."));
  const targetWeightValue = Number.parseFloat(profileState.targetWeight.replace(",", "."));
  const remainingWeight =
    Number.isFinite(currentWeightValue) && Number.isFinite(targetWeightValue)
      ? `${(currentWeightValue - targetWeightValue).toFixed(1)} кг`
      : "—";

  const profileMetrics = [
    {
      label: "Текущий вес",
      value: `${profileState.currentWeight} кг`,
      helper: "Стабильный ритм снижения",
      icon: Heart,
    },
    {
      label: "Цель",
      value: `${profileState.targetWeight} кг`,
      helper: `Осталось ${remainingWeight}`,
      icon: TargetIcon,
    },
    {
      label: "Серия",
      value: `${profileState.streak} дней`,
      helper: "Подряд без пауз",
      icon: Flame,
    },
    {
      label: "Активность",
      value: profileState.activity,
      helper: "Тренировок в неделю",
      icon: LineChart,
    },
  ] as const;

  const bodyData = [
    { label: "Вес", value: `${profileState.currentWeight} кг`, helper: "-1.2 кг за 2 недели" },
    { label: "Цель", value: `${profileState.targetWeight} кг`, helper: "Фокус на снижении веса" },
    { label: "Рост", value: `${profileState.height} см`, helper: "Базовый ориентир" },
    { label: "Активность", value: profileState.activity, helper: "Тренировок в неделю" },
    { label: "Серия", value: `${profileState.streak} дней`, helper: "Подряд без пропусков" },
  ] as const;

  const profileSettings = [
    {
      id: "basic",
      title: "Основная информация",
      description: "Имя, дата рождения, пол",
      icon: UserRound,
    },
    {
      id: "body",
      title: "Данные тела",
      description: "Вес, рост, цель",
      icon: Ruler,
    },
    {
      id: "notifications",
      title: "Уведомления",
      description: "Telegram, напоминания",
      icon: Bell,
    },
    {
      id: "privacy",
      title: "Приватность",
      description: "Видимость данных",
      icon: Shield,
    },
  ] as const;

  const activeSectionMeta = profileSettings.find((section) => section.id === activeProfileSection) ?? null;

  useEffect(() => {
    if (!activeProfileSection) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveProfileSection(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProfileSection]);

  function openProfileSection(sectionId: (typeof profileSettings)[number]["id"]) {
    setDraftState(profileState);
    setActiveProfileSection(sectionId);
  }

  function handleDraftChange<K extends keyof typeof draftState>(key: K, value: (typeof draftState)[K]) {
    setDraftState((current) => ({ ...current, [key]: value }));
  }

  function handleSaveProfileSection() {
    setProfileState(draftState);
    setActiveProfileSection(null);
  }

  function handlePhotoUpload(
    angle: "Спереди" | "Сбоку" | "Сзади",
    photoId: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setProgressPhotos((current) => ({
      ...current,
      [angle]: current[angle].map((photo) =>
        photo.id === photoId ? { ...photo, image: previewUrl } : photo
      ),
    }));
    event.target.value = "";
  }

  return (
    <DemoClientShell
      title="Профиль"
      description="Личные данные, фото прогресса, тренер и настройки профиля."
      headerAction={
        <Button
          variant="outline"
          className="rounded-full border-zinc-800 bg-zinc-950/70 px-4 text-zinc-100 hover:bg-zinc-900"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Редактировать профиль
        </Button>
      }
    >
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[1.8rem] border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.09),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.96))]">
          <CardContent className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="flex min-w-0 gap-4 lg:gap-5">
              <div className="relative shrink-0">
                <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-zinc-700 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(160deg,rgba(57,57,61,0.98),rgba(18,18,21,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.28)] lg:h-28 lg:w-28">
                  <span className="text-2xl font-semibold tracking-tight text-zinc-50">
                    {initials(profileState.fullName || data.client.fullName)}
                  </span>
                </div>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-zinc-900"
                  aria-label="Изменить фото профиля"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-4">
                <div>
                  <h2 className="text-[1.8rem] font-semibold tracking-tight text-zinc-50 lg:text-[2rem]">
                    {profileState.fullName}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-lime-100">
                      3 неделя программы
                    </Badge>
                    <Badge className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                      Цель: снижение веса
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2.5 text-sm text-zinc-300">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="h-4 w-4 text-lime-200" />
                    <span className="text-zinc-400">Фокус:</span>
                    <span className="font-medium text-zinc-100">Снижение веса</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-lime-200" />
                    <span className="text-zinc-400">Тренер:</span>
                    <span className="font-medium text-zinc-100">Алексей Романов</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {profileMetrics.map(({ label, value, helper, icon: Icon }) => (
                <div key={label} className="rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Icon className="h-4 w-4 text-lime-200" />
                    <p className="text-[11px] uppercase tracking-[0.18em]">{label}</p>
                  </div>
                  <p className="mt-4 text-[1.55rem] font-semibold tracking-tight text-zinc-50">{value}</p>
                  <p className="mt-1 text-sm text-zinc-400">{helper}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border-zinc-800/90 bg-zinc-950/95">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-zinc-50">Фото прогресса</CardTitle>
                <CardDescription className="mt-1 text-zinc-400">
                  Отслеживайте изменения тела по неделям.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Добавить фото
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Сравнить фото
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(["Спереди", "Сбоку", "Сзади"] as const).map((angle) => (
                <button
                  key={angle}
                  type="button"
                  onClick={() => setActiveAngle(angle)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    activeAngle === angle
                      ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  {angle}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {progressPhotos[activeAngle].map((photo, index) => (
                <article
                  key={photo.id}
                  className={cn(
                    "group overflow-hidden rounded-[1.5rem] border bg-black/20 transition",
                    photo.current
                      ? "border-lime-300/40 shadow-[0_18px_60px_rgba(163,230,53,0.1)]"
                      : "border-zinc-800"
                  )}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden border-b border-zinc-800 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,rgba(26,26,30,0.98),rgba(11,11,14,0.98))]">
                      {photo.current ? (
                      <Badge className="absolute right-3 top-3 rounded-full border border-lime-300/25 bg-lime-300/12 px-3 py-1 text-lime-100">
                          Текущая
                        </Badge>
                      ) : null}

                      {photo.image ? (
                        <Image
                          src={photo.image}
                          alt={`${photo.label} — ${activeAngle}`}
                          fill
                          className="object-cover"
                          sizes="(min-width: 1280px) 18vw, (min-width: 768px) 32vw, 90vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_30%,rgba(163,230,53,0.06),transparent_24%),linear-gradient(180deg,rgba(6,6,8,0.98),rgba(12,12,14,0.98))]">
                          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-zinc-800 bg-zinc-950/90 text-zinc-500 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                            <Camera className="h-6 w-6" />
                          </div>
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-medium text-zinc-200">Фото пока нет</p>
                            <p className="text-xs text-zinc-500">Загрузите снимок для ракурса {activeAngle.toLowerCase()}</p>
                          </div>
                          <label
                            htmlFor={`progress-photo-${photo.id}`}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/90 px-4 py-2 text-sm text-zinc-100 transition hover:border-lime-300/30 hover:bg-zinc-900"
                          >
                            <Camera className="h-4 w-4" />
                            Загрузить
                          </label>
                          <input
                            id={`progress-photo-${photo.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handlePhotoUpload(activeAngle, photo.id, event)}
                          />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(163,230,53,0.08),transparent_28%)]" />
                      <div className="absolute bottom-4 left-4 rounded-full border border-zinc-700 bg-zinc-950/85 px-3 py-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                        {activeAngle}
                      </div>
                      <div className="absolute right-4 top-4 text-xs text-zinc-600">#{index + 1}</div>
                    </div>

                  <div className="space-y-1 px-4 py-3">
                    <p className="text-lg font-semibold text-zinc-50">{photo.label}</p>
                    <p className="text-sm text-zinc-500">{photo.date}</p>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-50">Мои данные</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {bodyData.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-[1.2rem] border p-4",
                    index === 1
                      ? "border-lime-300/20 bg-[linear-gradient(180deg,rgba(214,255,128,0.12),rgba(10,10,12,0.4))]"
                      : "border-zinc-800 bg-black/20"
                  )}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-[1.55rem] font-semibold tracking-tight text-zinc-50">{item.value}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-50">Тренер</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-zinc-700 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(160deg,rgba(60,60,64,0.98),rgba(20,20,24,0.98))]">
                  <span className="text-lg font-semibold text-zinc-50">{initials("Алексей Романов")}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-zinc-50">Алексей Романов</p>
                  <p className="text-sm text-zinc-400">Персональный тренер</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-sm text-lime-100">
                    <Circle className="h-2.5 w-2.5 fill-current" />
                    Онлайн
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4">
                <p className="text-sm text-zinc-400">Контакт</p>
                <p className="mt-1 text-base font-medium text-zinc-100">@demo_trainer</p>
              </div>

              <Button className="h-12 w-full rounded-full bg-lime-300 text-zinc-950 hover:bg-lime-200">
                <MessageCircle className="mr-2 h-4 w-4" />
                Написать в Telegram
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/95">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-zinc-50">Личные заметки</CardTitle>
                <CardDescription className="mt-1 text-zinc-400">
                  Короткий личный фокус и то, что хочется держать в голове каждый день.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.2rem] border border-zinc-800 bg-black/20 p-4 text-[15px] leading-7 text-zinc-300">
              Хочу улучшить технику базовых упражнений и снизить вес. Фокус на питании и стабильности.
            </div>
          </CardContent>
        </Card>

        <Card id="profile-settings" className="rounded-[1.7rem] border-zinc-800/90 bg-zinc-950/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-50">Настройки профиля</CardTitle>
            <CardDescription className="mt-1 text-zinc-400">
              Только персональные данные профиля без дублирования глобальных параметров приложения.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {profileSettings.map(({ id, title, description, icon: Icon }) => (
              <button
                key={title}
                type="button"
                onClick={() => openProfileSection(id)}
                className="flex w-full items-center justify-between rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-zinc-700 bg-zinc-950/80 text-zinc-300">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{title}</p>
                    <p className="mt-1 text-sm text-zinc-500">{description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-zinc-500" />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[1.7rem] border-zinc-800/90 bg-[linear-gradient(180deg,rgba(17,17,20,0.96),rgba(11,11,14,0.96))]">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-base font-medium text-zinc-100">
                Остальные настройки приложения доступны в разделе «Настройки».
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Там будут параметры уведомлений, внешнего вида и других app-level опций.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
            >
              <Settings className="mr-2 h-4 w-4" />
              Перейти в настройки
            </Button>
          </CardContent>
        </Card>
      </div>

      {activeSectionMeta ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md"
          onClick={() => setActiveProfileSection(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-zinc-800 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.08),transparent_24%),linear-gradient(180deg,rgba(19,19,22,0.98),rgba(8,8,10,0.98))] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.45)] lg:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Редактирование профиля</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{activeSectionMeta.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{activeSectionMeta.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveProfileSection(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/80 text-zinc-400 transition hover:text-zinc-100"
                aria-label="Закрыть"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {activeProfileSection === "basic" ? (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Имя и фамилия</label>
                    <Input
                      value={draftState.fullName}
                      onChange={(event) => handleDraftChange("fullName", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm text-zinc-400">Дата рождения</label>
                      <Input
                        type="date"
                        value={draftState.birthDate}
                        onChange={(event) => handleDraftChange("birthDate", event.target.value)}
                        className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm text-zinc-400">Пол</label>
                      <select
                        value={draftState.gender}
                        onChange={(event) => handleDraftChange("gender", event.target.value)}
                        className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 text-zinc-100"
                      >
                        <option>Женщина</option>
                        <option>Мужчина</option>
                        <option>Не указывать</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : null}

              {activeProfileSection === "body" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Текущий вес, кг</label>
                    <Input
                      value={draftState.currentWeight}
                      onChange={(event) => handleDraftChange("currentWeight", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Целевой вес, кг</label>
                    <Input
                      value={draftState.targetWeight}
                      onChange={(event) => handleDraftChange("targetWeight", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Рост, см</label>
                    <Input
                      value={draftState.height}
                      onChange={(event) => handleDraftChange("height", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm text-zinc-400">Активность</label>
                    <Input
                      value={draftState.activity}
                      onChange={(event) => handleDraftChange("activity", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Серия, дней</label>
                    <Input
                      value={draftState.streak}
                      onChange={(event) => handleDraftChange("streak", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                </div>
              ) : null}

              {activeProfileSection === "notifications" ? (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Telegram</label>
                    <Input
                      value={draftState.telegram}
                      onChange={(event) => handleDraftChange("telegram", event.target.value)}
                      className="h-12 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100"
                    />
                  </div>
                  <div className="grid gap-3">
                    {[
                      {
                        key: "reminders" as const,
                        title: "Напоминания о тренировке",
                        description: "Напоминать о тренировках и шагах недели.",
                      },
                      {
                        key: "telegramAlerts" as const,
                        title: "Уведомления в Telegram",
                        description: "Получать короткие оповещения и обновления от тренера.",
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start justify-between gap-4 rounded-[1.3rem] border border-zinc-800 bg-black/20 p-4"
                      >
                        <div>
                          <p className="font-medium text-zinc-100">{item.title}</p>
                          <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={draftState[item.key]}
                          onChange={(event) => handleDraftChange(item.key, event.target.checked)}
                          className="mt-1 h-5 w-5 rounded border-zinc-700 bg-zinc-950 text-lime-300"
                        />
                      </label>
                    ))}
                  </div>
                </>
              ) : null}

              {activeProfileSection === "privacy" ? (
                <>
                  <label className="flex items-start justify-between gap-4 rounded-[1.3rem] border border-zinc-800 bg-black/20 p-4">
                    <div>
                      <p className="font-medium text-zinc-100">Тренер видит фото прогресса</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Оставьте доступ включённым, если хотите получать обратную связь по форме.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftState.coachCanViewPhotos}
                      onChange={(event) => handleDraftChange("coachCanViewPhotos", event.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-zinc-700 bg-zinc-950 text-lime-300"
                    />
                  </label>

                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-400">Видимость данных</label>
                    <select
                      value={draftState.profileVisibility}
                      onChange={(event) => handleDraftChange("profileVisibility", event.target.value)}
                      className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 text-zinc-100"
                    >
                      <option>Только я и тренер</option>
                      <option>Только я</option>
                      <option>Все специалисты клуба</option>
                    </select>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setActiveProfileSection(null)}
                className="rounded-full border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-900"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSaveProfileSection}
                className="rounded-full bg-lime-300 px-6 text-zinc-950 hover:bg-lime-200"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DemoClientShell>
  );
}
