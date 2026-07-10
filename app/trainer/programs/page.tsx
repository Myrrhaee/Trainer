"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  Layers3,
  Plus,
  RadioTower,
  Search,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  getDemoProgramDays,
  getDemoPrograms,
  getDemoRosterClients,
} from "@/lib/demo-data";
import { DEMO_TRAINER, isDemoModeEnabled } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase-client";
import { cn, createSafeId, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type ProgramStatus = "active" | "draft" | "needs-update";

type ProgramDay = {
  id: string;
  label: string;
  weekLabel: string;
  trainingType?: string;
  exerciseCount?: number;
};

type TrainerProgram = {
  id: string;
  title: string;
  weeks: number;
  clientCount: number;
  lastUpdated: string;
  status: ProgramStatus;
  completion: number;
  focus: string;
  days: ProgramDay[];
};

type AssignedProgram = {
  id: string;
  clientId: string;
  clientName: string;
  clientGoal: string;
  currentWeight: string;
  currentProgram: string;
  programId: string;
  programTitle: string;
  assignedAt: string;
};

type ClientOption = {
  id: string;
  name: string;
  goal: string;
  currentWeight: string;
  currentProgram: string;
  restriction: string;
};

type BuilderWorkoutTemplate = {
  id: string;
  title: string;
  trainingType: string;
  note: string;
  folder: string;
  exerciseCount: number;
  blockCount: number;
  savedAt: string;
  source?: "local" | "server" | "demo";
};

type ProgramCreatorDay = {
  id: string;
  weekLabel: string;
  label: string;
  templateId: string;
};

type ProgramCreatorDraft = {
  title: string;
  focus: string;
  note: string;
  days: ProgramCreatorDay[];
};

type WorkoutTemplateRow = {
  id: string;
  title?: string | null;
  weeks?: number | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  plan_json?: {
    weeks?: Array<{
      id?: string;
      name?: string;
      days?: Array<{
        id?: string;
        name?: string;
        trainingType?: string;
        exercises?: unknown[];
      }>;
    }>;
  } | null;
};

type AssignedProgramRow = {
  client_id: string;
  template_id: string;
  status?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  weight?: number | null;
  target_weight?: number | null;
  updated_at?: string | null;
};

const templatePresets = [
  {
    id: "ppl",
    title: "Push Pull Legs",
    helper: "4-6 тренировок в неделю",
    focus: "Гипертрофия",
  },
  {
    id: "beginner",
    title: "Новичок 3 раза",
    helper: "Стартовый блок на 4 недели",
    focus: "Техника",
  },
  {
    id: "cut",
    title: "Сушка",
    helper: "Силовой блок + расход",
    focus: "Снижение веса",
  },
  {
    id: "mass",
    title: "Набор массы",
    helper: "База, объём, прогрессия",
    focus: "Гипертрофия",
  },
];

const demoProgramHealth = [
  { title: "Сушка 8 недель", clients: 12, completion: 92 },
  { title: "Набор массы", clients: 8, completion: 81 },
  { title: "Новички", clients: 3, completion: 65 },
];

const defaultProgramCreatorDays: ProgramCreatorDay[] = [
  {
    id: "day-1",
    weekLabel: "Неделя 1",
    label: "Пн · День 1",
    templateId: "",
  },
  {
    id: "day-2",
    weekLabel: "Неделя 1",
    label: "Ср · День 2",
    templateId: "",
  },
  {
    id: "day-3",
    weekLabel: "Неделя 1",
    label: "Пт · День 3",
    templateId: "",
  },
];

function relativeDate(value?: string | null) {
  if (!value) return "3 дня назад";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "3 дня назад";
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

function statusLabel(status: ProgramStatus) {
  if (status === "draft") return "Черновик";
  if (status === "needs-update") return "Требует обновления";
  return "Активна";
}

function statusClasses(status: ProgramStatus) {
  switch (status) {
    case "needs-update":
      return "border-amber-300/24 bg-amber-300/10 text-amber-100";
    case "draft":
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
    default:
      return "border-lime-300/20 bg-lime-300/10 text-lime-100";
  }
}

function builderTemplateStorageKey(userId: string) {
  return `trainer-builder-templates:${userId}`;
}

function readTemplatePayload(value: unknown) {
  if (Array.isArray(value)) {
    return {
      exercises: value,
      blocks: [],
      folder: "Общие",
    };
  }

  if (value && typeof value === "object") {
    const payload = value as {
      exercises?: unknown;
      blocks?: unknown;
      folder?: unknown;
    };

    return {
      exercises: Array.isArray(payload.exercises) ? payload.exercises : [],
      blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
      folder: typeof payload.folder === "string" ? payload.folder : "Общие",
    };
  }

  return {
    exercises: [],
    blocks: [],
    folder: "Общие",
  };
}

function normalizeBuilderWorkoutTemplate(value: unknown): BuilderWorkoutTemplate | null {
  if (!value || typeof value !== "object") return null;

  const template = value as {
    id?: unknown;
    title?: unknown;
    trainingType?: unknown;
    training_type?: unknown;
    note?: unknown;
    folder?: unknown;
    exercises?: unknown;
    blocks?: unknown;
    savedAt?: unknown;
    updated_at?: unknown;
    created_at?: unknown;
    source?: unknown;
  };
  const payload = readTemplatePayload({
    exercises: template.exercises,
    blocks: template.blocks,
    folder: template.folder,
  });

  return {
    id: typeof template.id === "string" && template.id ? template.id : createSafeId(),
    title: typeof template.title === "string" && template.title.trim() ? template.title.trim() : "Тренировка без названия",
    trainingType:
      typeof template.trainingType === "string" && template.trainingType.trim()
        ? template.trainingType.trim()
        : typeof template.training_type === "string" && template.training_type.trim()
          ? template.training_type.trim()
          : "Силовая тренировка",
    note: typeof template.note === "string" ? template.note : "",
    folder: payload.folder,
    exerciseCount:
      payload.exercises.length +
      payload.blocks.reduce((sum, block) => {
        if (!block || typeof block !== "object") return sum;
        const blockValue = block as { exercises?: unknown };
        return sum + (Array.isArray(blockValue.exercises) ? blockValue.exercises.length : 0);
      }, 0),
    blockCount: payload.blocks.length,
    savedAt:
      typeof template.savedAt === "string"
        ? template.savedAt
        : typeof template.updated_at === "string"
          ? template.updated_at
          : typeof template.created_at === "string"
            ? template.created_at
            : new Date().toISOString(),
    source:
      template.source === "server" || template.source === "local" || template.source === "demo"
        ? template.source
        : "local",
  };
}

function loadLocalBuilderWorkoutTemplates(userId: string): BuilderWorkoutTemplate[] {
  try {
    const raw = window.localStorage.getItem(builderTemplateStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((template) => normalizeBuilderWorkoutTemplate(template))
      .filter((template): template is BuilderWorkoutTemplate => Boolean(template));
  } catch (error) {
    console.error("program creator templates restore failed", error);
    return [];
  }
}

function buildFallbackWorkoutTemplates(): BuilderWorkoutTemplate[] {
  return [
    {
      id: "demo-workout-push",
      title: "Push Day · база",
      trainingType: "Push · гипертрофия",
      note: "Грудь, плечи, трицепс. Подходит как первый день недели.",
      folder: "Push / Pull / Legs",
      exerciseCount: 5,
      blockCount: 1,
      savedAt: new Date().toISOString(),
      source: "demo",
    },
    {
      id: "demo-workout-pull",
      title: "Pull Day · спина",
      trainingType: "Pull · сила и объём",
      note: "Спина, задняя дельта, бицепс. Можно назначать после push-дня.",
      folder: "Push / Pull / Legs",
      exerciseCount: 5,
      blockCount: 0,
      savedAt: new Date().toISOString(),
      source: "demo",
    },
    {
      id: "demo-workout-legs",
      title: "Ноги · силовой день",
      trainingType: "Ноги · силовой",
      note: "Квадрицепс, ягодицы, задняя поверхность. Акцент на технику.",
      folder: "Ноги",
      exerciseCount: 6,
      blockCount: 1,
      savedAt: new Date().toISOString(),
      source: "demo",
    },
  ];
}

function normalizeProgramDays(program: WorkoutTemplateRow): ProgramDay[] {
  const weeks = Array.isArray(program.plan_json?.weeks) ? program.plan_json?.weeks ?? [] : [];
  const days = weeks.flatMap((week, weekIndex) => {
    const weekLabel = week.name?.trim() || `Неделя ${weekIndex + 1}`;
    return (week.days ?? []).map((day, dayIndex) => ({
      id: day.id?.trim() || `${program.id}-w${weekIndex + 1}-d${dayIndex + 1}`,
      label: day.name?.trim() || `День ${dayIndex + 1}`,
      weekLabel,
      trainingType: day.trainingType,
      exerciseCount: Array.isArray(day.exercises) ? day.exercises.length : undefined,
    }));
  });

  if (days.length > 0) return days;

  return Array.from({ length: Math.min(program.weeks ?? 4, 4) }, (_, index) => ({
    id: `${program.id}-demo-day-${index + 1}`,
    label: index % 2 === 0 ? "Силовой день" : "Техника + объём",
    weekLabel: `Неделя ${index + 1}`,
    trainingType: index % 2 === 0 ? "Силовая" : "Гипертрофия",
    exerciseCount: 5,
  }));
}

function buildDemoPrograms(): TrainerProgram[] {
  const titles = ["Сушка 8 недель", "Набор массы", "Новички"];
  const focuses = ["Снижение веса", "Гипертрофия", "Стартовая техника"];

  return getDemoPrograms().map((program, index) => ({
    id: program.id,
    title: titles[index] ?? program.title,
    weeks: index === 0 ? 8 : program.weeks,
    clientCount: [12, 8, 3][index] ?? 1,
    lastUpdated: ["3 дня назад", "вчера", "12 дней назад"][index] ?? "5 дней назад",
    status: index === 1 ? "needs-update" as const : program.status === "Черновик" ? "draft" as const : "active" as const,
    completion: [92, 81, 65][index] ?? 70,
    focus: focuses[index] ?? program.status,
    days: getDemoProgramDays(program.id),
  }));
}

function buildDemoAssignments(programs: TrainerProgram[]): AssignedProgram[] {
  const roster = getDemoRosterClients();
  return roster.slice(0, 5).map((client, index) => {
    const program = programs[index % programs.length];
    return {
      id: `${client.id}-${program.id}`,
      clientId: client.id,
      clientName: client.name,
      clientGoal: client.goal,
      currentWeight: client.currentWeight,
      currentProgram: client.program,
      programId: program.id,
      programTitle: program.title,
      assignedAt: index === 0 ? "сегодня" : `${index + 1} дн. назад`,
    };
  });
}

function buildDemoClients(): ClientOption[] {
  return getDemoRosterClients().map((client) => ({
    id: client.id,
    name: client.name,
    goal: client.goal,
    currentWeight: client.currentWeight,
    currentProgram: client.program,
    restriction: client.status === "Требует внимания" ? "Проверить восстановление перед назначением" : "Без ограничений",
  }));
}

export default function TrainerProgramsPage() {
  const demoMode = isDemoModeEnabled();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<TrainerProgram[]>([]);
  const [assignments, setAssignments] = useState<AssignedProgram[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [assignProgram, setAssignProgram] = useState<TrainerProgram | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [programCreatorOpen, setProgramCreatorOpen] = useState(false);
  const [builderTemplates, setBuilderTemplates] = useState<BuilderWorkoutTemplate[]>([]);
  const [programDraft, setProgramDraft] = useState<ProgramCreatorDraft>({
    title: "Новая программа",
    focus: "Рабочий цикл",
    note: "",
    days: defaultProgramCreatorDays,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      setLoading(true);

      if (demoMode) {
        const localTemplates = loadLocalBuilderWorkoutTemplates(DEMO_TRAINER.id);
        const demoPrograms = buildDemoPrograms();
        if (!cancelled) {
          setTrainerId(DEMO_TRAINER.id);
          setBuilderTemplates(localTemplates.length > 0 ? localTemplates : buildFallbackWorkoutTemplates());
          setPrograms(demoPrograms);
          setAssignments(buildDemoAssignments(demoPrograms));
          setClients(buildDemoClients());
          setSelectedProgramId(demoPrograms[0]?.id ?? null);
          setLoading(false);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?role=trainer";
        return;
      }

      setTrainerId(user.id);

      const [templatesRes, assignedRes, profilesRes] = await Promise.all([
        supabase
          .from("workout_templates")
          .select("id, title, weeks, status, updated_at, created_at, plan_json")
          .eq("trainer_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("assigned_programs")
          .select("client_id, template_id, status"),
        supabase
          .from("profiles")
          .select("id, full_name, email, weight, target_weight, updated_at")
          .eq("trainer_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (templatesRes.error) logSupabaseError("trainer programs templates", templatesRes.error);
      if (assignedRes.error && !isSupabaseSchemaMismatch(assignedRes.error)) {
        logSupabaseError("trainer programs assignments", assignedRes.error);
      }
      if (profilesRes.error) logSupabaseError("trainer programs profiles", profilesRes.error);

      const assignedRows = isSupabaseSchemaMismatch(assignedRes.error)
        ? []
        : ((assignedRes.data ?? []) as AssignedProgramRow[]);
      const profileRows = (profilesRes.data ?? []) as ProfileRow[];

      const nextPrograms = ((templatesRes.data ?? []) as WorkoutTemplateRow[]).map((program, index) => {
        const clientCount = assignedRows.filter((row) => row.template_id === program.id).length;
        const days = normalizeProgramDays(program);
        const stale = relativeDate(program.updated_at ?? program.created_at).includes("дн.") && index < 3;

        return {
          id: program.id,
          title: program.title?.trim() || "Программа без названия",
          weeks: program.weeks ?? Math.max(1, new Set(days.map((day) => day.weekLabel)).size),
          clientCount,
          lastUpdated: relativeDate(program.updated_at ?? program.created_at),
          status: stale ? "needs-update" : clientCount > 0 ? "active" : "draft",
          completion: Math.max(52, Math.min(96, 64 + clientCount * 7 - index * 3)),
          focus: program.status ?? "Рабочая программа",
          days,
        } satisfies TrainerProgram;
      });

      const clientsById = new Map(profileRows.map((profile) => [profile.id, profile]));
      const nextAssignments = assignedRows.slice(0, 8).map((row) => {
        const profile = clientsById.get(row.client_id);
        const program = nextPrograms.find((item) => item.id === row.template_id);
        const currentWeight =
          typeof profile?.weight === "number" ? `${profile.weight.toLocaleString("ru-RU")} кг` : "не указан";

        return {
          id: `${row.client_id}-${row.template_id}`,
          clientId: row.client_id,
          clientName: profile?.full_name?.trim() || profile?.email?.trim() || "Клиент",
          clientGoal:
            typeof profile?.target_weight === "number" && typeof profile.weight === "number"
              ? profile.target_weight < profile.weight
                ? "Снижение веса"
                : "Набор массы"
              : "Поддержание формы",
          currentWeight,
          currentProgram: program?.title ?? "Назначенная программа",
          programId: row.template_id,
          programTitle: program?.title ?? "Программа",
          assignedAt: relativeDate(profile?.updated_at),
        };
      });

      const nextClients = profileRows.map((profile) => ({
        id: profile.id,
        name: profile.full_name?.trim() || profile.email?.trim() || "Клиент",
        goal:
          typeof profile.target_weight === "number" && typeof profile.weight === "number"
            ? profile.target_weight < profile.weight
              ? "Снижение веса"
              : "Набор массы"
            : "Поддержание формы",
        currentWeight:
          typeof profile.weight === "number" ? `${profile.weight.toLocaleString("ru-RU")} кг` : "не указан",
        currentProgram: nextAssignments.find((item) => item.clientId === profile.id)?.programTitle ?? "Не назначена",
        restriction: "Проверить анкету и последние тренировки",
      }));

      setPrograms(nextPrograms);
      setAssignments(nextAssignments);
      setClients(nextClients);
      setBuilderTemplates(loadLocalBuilderWorkoutTemplates(user.id));
      setSelectedProgramId(nextPrograms[0]?.id ?? null);
      setLoading(false);
    }

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const filteredPrograms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return programs;
    return programs.filter((program) =>
      [program.title, program.focus, statusLabel(program.status)]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [programs, query]);

  const selectedProgram =
    programs.find((program) => program.id === selectedProgramId) ?? filteredPrograms[0] ?? null;
  const activePrograms = programs.filter((program) => program.status === "active").length;
  const clientsInPrograms = assignments.length > 0
    ? new Set(assignments.map((item) => item.clientId)).size
    : programs.reduce((sum, program) => sum + program.clientCount, 0);
  const needsUpdate = programs.filter((program) => program.status === "needs-update").length;
  const healthRows = programs.length > 0
    ? programs
        .slice()
        .sort((a, b) => b.clientCount - a.clientCount)
        .slice(0, 4)
        .map((program) => ({
          title: program.title,
          clients: program.clientCount,
          completion: program.completion,
        }))
    : demoProgramHealth;

  function handleDuplicate(program: TrainerProgram) {
    toast.success(`Создана копия программы «${program.title}»`);
  }

  function handleCreateFromTemplate(title: string) {
    toast.success(`Шаблон «${title}» подготовлен`, {
      description: "Откройте Builder, чтобы собрать первый тренировочный день.",
    });
  }

  function handleOpenProgramCreator() {
    const templates =
      builderTemplates.length > 0
        ? builderTemplates
        : demoMode
          ? buildFallbackWorkoutTemplates()
          : trainerId
            ? loadLocalBuilderWorkoutTemplates(trainerId)
            : [];
    const nextTemplates = templates.length > 0 ? templates : builderTemplates;

    setBuilderTemplates(nextTemplates);
    setProgramDraft({
      title: "Программа из тренировок",
      focus: nextTemplates[0]?.folder ?? "Рабочий цикл",
      note: "Собрана из сохранённых тренировок builder.",
      days: defaultProgramCreatorDays.map((day, index) => ({
        ...day,
        id: createSafeId(),
        templateId: nextTemplates[index % Math.max(1, nextTemplates.length)]?.id ?? "",
      })),
    });
    setProgramCreatorOpen(true);
  }

  function handleProgramDraftDayChange(
    dayId: string,
    patch: Partial<Pick<ProgramCreatorDay, "weekLabel" | "label" | "templateId">>
  ) {
    setProgramDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) => (day.id === dayId ? { ...day, ...patch } : day)),
    }));
  }

  function handleAddProgramDraftDay() {
    setProgramDraft((prev) => ({
      ...prev,
      days: [
        ...prev.days,
        {
          id: createSafeId(),
          weekLabel: `Неделя ${Math.max(1, new Set(prev.days.map((day) => day.weekLabel)).size)}`,
          label: `День ${prev.days.length + 1}`,
          templateId: builderTemplates[0]?.id ?? "",
        },
      ],
    }));
  }

  function handleRemoveProgramDraftDay(dayId: string) {
    setProgramDraft((prev) => ({
      ...prev,
      days: prev.days.length > 1 ? prev.days.filter((day) => day.id !== dayId) : prev.days,
    }));
  }

  function handleCreateProgramFromWorkouts() {
    const title = programDraft.title.trim();
    if (!title) {
      toast.error("Назовите программу");
      return;
    }

    const selectedDays = programDraft.days.filter((day) => day.templateId);
    if (selectedDays.length === 0) {
      toast.error("Выберите хотя бы одну тренировку для программы");
      return;
    }

    const templateById = new Map(builderTemplates.map((template) => [template.id, template]));
    const days: ProgramDay[] = selectedDays.map((day, index) => {
      const template = templateById.get(day.templateId);

      return {
        id: createSafeId(),
        label: day.label.trim() || `День ${index + 1}`,
        weekLabel: day.weekLabel.trim() || "Неделя 1",
        trainingType: template?.trainingType ?? "Тренировка",
        exerciseCount: template?.exerciseCount ?? 0,
      };
    });

    const newProgram: TrainerProgram = {
      id: createSafeId(),
      title,
      weeks: Math.max(1, new Set(days.map((day) => day.weekLabel)).size),
      clientCount: 0,
      lastUpdated: "сейчас",
      status: "draft",
      completion: 0,
      focus: programDraft.focus.trim() || "Рабочий цикл",
      days,
    };

    setPrograms((prev) => [newProgram, ...prev]);
    setSelectedProgramId(newProgram.id);
    setProgramCreatorOpen(false);
    toast.success(`Программа «${newProgram.title}» создана из тренировок`);
  }

  function handleAssign(program: TrainerProgram, client: ClientOption) {
    toast.success(`«${program.title}» назначена клиенту ${client.name}`);
    setAssignProgram(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="rounded-full border border-zinc-800 bg-black/30 px-4 py-3 text-sm text-zinc-300">
          Загружаем программы
        </div>
      </div>
    );
  }

  return (
    <TrainerShell
      title="Программы"
      description="Рабочая библиотека программ, назначений и структуры недель для ведения клиентов."
      headerAction={
        <div className="hidden items-center gap-2 xl:flex">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-zinc-800 bg-zinc-950/55 px-4 text-zinc-200 hover:bg-zinc-900"
            onClick={handleOpenProgramCreator}
          >
            Из существующих тренировок
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200"
            onClick={handleOpenProgramCreator}
          >
            <Plus className="mr-2 h-4 w-4" />
            Создать программу
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5">
        <section className="rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.14),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.94),rgba(3,7,18,0.98))] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Program OS</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Рабочий центр программ</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Программы показывают, кого вы ведёте, какие планы работают и какие циклы пора обновить.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-zinc-700 bg-black/18 text-zinc-100 hover:bg-zinc-900"
                onClick={handleOpenProgramCreator}
              >
                Из существующих тренировок
              </Button>
              <Button
                type="button"
                className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                onClick={handleOpenProgramCreator}
              >
                Создать программу
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <HeroMetric icon={ClipboardList} label="Активные программы" value={String(activePrograms)} />
            <HeroMetric icon={Users} label="Клиентов в программах" value={String(clientsInPrograms)} />
            <HeroMetric icon={RadioTower} label="Требуют обновления" value={String(needsUpdate)} tone={needsUpdate > 0 ? "warning" : "good"} />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="space-y-5">
            <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/78 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Program Library</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Библиотека программ</h2>
                </div>
                <div className="relative w-full lg:w-[340px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Найти программу"
                    className="h-10 rounded-2xl border-zinc-800 bg-black/24 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredPrograms.map((program) => (
                  <article
                    key={program.id}
                    className={cn(
                      "rounded-[1.5rem] border bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(7,7,10,0.98))] p-4 transition",
                      selectedProgram?.id === program.id ? "border-lime-300/24" : "border-zinc-800/90"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-base font-semibold text-zinc-50">{program.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{program.weeks} недель · {program.focus}</p>
                      </div>
                      <Badge className={cn("rounded-full border", statusClasses(program.status))}>
                        {statusLabel(program.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <SmallMetric label="Клиенты" value={String(program.clientCount)} />
                      <SmallMetric label="Completion" value={`${program.completion}%`} />
                      <SmallMetric label="Изменено" value={program.lastUpdated} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="h-9 rounded-full bg-zinc-100 px-3 text-black hover:bg-white"
                        onClick={() => setSelectedProgramId(program.id)}
                      >
                        Открыть
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full border-zinc-700 bg-zinc-950/40 px-3 text-zinc-100 hover:bg-zinc-900"
                        onClick={() => handleDuplicate(program)}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Дублировать
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-full px-3 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                        onClick={() => setAssignProgram(program)}
                      >
                        Назначить
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {selectedProgram ? (
              <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/78 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Open Program Flow</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">{selectedProgram.title}</h2>
                    <p className="mt-2 text-sm text-zinc-500">Программа → недели → дни → тренировки. День открывается в существующем Builder.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                    onClick={() => setAssignProgram(selectedProgram)}
                  >
                    Назначить клиенту
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  {Array.from(new Set(selectedProgram.days.map((day) => day.weekLabel))).map((weekLabel) => (
                    <div key={weekLabel} className="rounded-[1.25rem] border border-zinc-800 bg-black/18 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{weekLabel}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {selectedProgram.days
                          .filter((day) => day.weekLabel === weekLabel)
                          .map((day) => (
                            <Link
                              key={day.id}
                              href={`/trainer/builder?programId=${selectedProgram.id}&dayId=${day.id}`}
                              className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 transition hover:border-lime-300/24 hover:bg-lime-300/6"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-100">{day.label}</p>
                                  <p className="mt-1 text-xs text-zinc-500">{day.trainingType ?? "Тренировка"} · {day.exerciseCount ?? 5} упр.</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-lime-100" />
                              </div>
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/78 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Assigned Programs</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Последние назначения</h2>
                </div>
                <Badge className="rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
                  {assignments.length} активных
                </Badge>
              </div>

              <div className="mt-4 divide-y divide-zinc-800/80 overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-black/18">
                {assignments.slice(0, 6).map((item) => (
                  <div key={item.id} className="grid gap-3 p-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-200">
                        {item.clientName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{item.clientName}</p>
                        <p className="text-xs text-zinc-500">{item.clientGoal} · {item.currentWeight}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.programTitle}</p>
                      <p className="text-xs text-zinc-500">Назначена {item.assignedAt}</p>
                    </div>
                    <Button asChild variant="outline" className="h-9 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                      <Link href={`/trainer/clients/${item.clientId}`}>Открыть клиента</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/78 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Program Health</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Что работает</h2>
                </div>
                <TrendingUp className="h-5 w-5 text-lime-100" />
              </div>
              <div className="mt-4 space-y-3">
                {healthRows.map((row) => (
                  <div key={row.title} className="rounded-[1.2rem] border border-zinc-800 bg-black/18 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{row.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.clients} клиентов</p>
                      </div>
                      <span className="text-sm font-semibold text-lime-100">{row.completion}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                      <div className="h-full rounded-full bg-lime-300" style={{ width: `${row.completion}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/78 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Templates</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Быстро повторить</h2>
                </div>
                <Layers3 className="h-5 w-5 text-lime-100" />
              </div>
              <div className="mt-4 grid gap-2">
                {templatePresets.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleCreateFromTemplate(template.title)}
                    className="rounded-[1.15rem] border border-zinc-800 bg-black/18 p-3 text-left transition hover:border-lime-300/24 hover:bg-lime-300/6"
                  >
                    <p className="text-sm font-semibold text-zinc-100">{template.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{template.helper} · {template.focus}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-lime-300/12 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),rgba(9,9,11,0.98))] p-4">
              <Target className="h-5 w-5 text-lime-100" />
              <h2 className="mt-3 text-lg font-semibold text-zinc-50">Quick Actions</h2>
              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                  onClick={handleOpenProgramCreator}
                >
                  Создать из тренировок
                </Button>
                <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                  <Link href="/trainer/clients">Выбрать клиента</Link>
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>

      <Sheet open={Boolean(assignProgram)} onOpenChange={(open) => !open && setAssignProgram(null)}>
        <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 text-zinc-100 sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Назначить программу</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Контекст клиента перед назначением, чтобы план не выбирался вслепую.
            </SheetDescription>
          </SheetHeader>

          {assignProgram ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-[1.3rem] border border-lime-300/14 bg-lime-300/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-lime-100/70">Программа</p>
                <h3 className="mt-2 text-lg font-semibold text-zinc-50">{assignProgram.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{assignProgram.weeks} недель · {assignProgram.focus}</p>
              </div>

              {clients.map((client) => (
                <div key={client.id} className="rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-200">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{client.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{client.goal} · {client.currentWeight}</p>
                        <p className="mt-1 text-xs text-zinc-600">Сейчас: {client.currentProgram}</p>
                        <p className="mt-2 text-xs text-amber-100/75">{client.restriction}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="h-9 rounded-full bg-zinc-100 px-3 text-black hover:bg-white"
                      onClick={() => handleAssign(assignProgram, client)}
                    >
                      Назначить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={programCreatorOpen} onOpenChange={setProgramCreatorOpen}>
        <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:max-w-[720px]">
          <SheetHeader className="border-b border-zinc-800/80 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Program Creator</p>
            <SheetTitle className="text-2xl font-semibold tracking-tight text-zinc-50">
              Создать программу из тренировок
            </SheetTitle>
            <SheetDescription className="max-w-2xl text-zinc-400">
              Соберите недельную структуру из сохранённых тренировок builder. Позже каждый день можно открыть и доработать в Builder.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label className="text-zinc-300">Название программы</Label>
                <Input
                  value={programDraft.title}
                  onChange={(event) =>
                    setProgramDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Например: Набор массы · 8 недель"
                  className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Фокус</Label>
                <Input
                  value={programDraft.focus}
                  onChange={(event) =>
                    setProgramDraft((prev) => ({ ...prev, focus: event.target.value }))
                  }
                  placeholder="Гипертрофия"
                  className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Заметка</Label>
              <Textarea
                value={programDraft.note}
                onChange={(event) =>
                  setProgramDraft((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="Для каких клиентов подходит эта программа, как прогрессировать нагрузку, какие ограничения учитывать."
                className="min-h-24 rounded-[1.2rem] border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="rounded-[1.45rem] border border-lime-300/14 bg-lime-300/7 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Доступно тренировок: {builderTemplates.length}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Используются сохранённые шаблоны из Builder. Суперсеты и режимы выполнения сохраняются внутри тренировочного дня.
                  </p>
                </div>
                <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900">
                  <Link href="/trainer/builder">Открыть Builder</Link>
                </Button>
              </div>
            </div>

            {builderTemplates.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/22 px-6 py-10 text-center">
                <Layers3 className="mx-auto h-6 w-6 text-lime-100" />
                <p className="mt-4 text-base font-semibold text-zinc-100">Нет сохранённых тренировок</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                  Сначала сохраните несколько тренировок как шаблоны в Builder, затем соберите из них программу.
                </p>
                <Button asChild className="mt-4 rounded-full bg-lime-300 text-black hover:bg-lime-200">
                  <Link href="/trainer/builder">Создать тренировку</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Неделя программы</p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-50">Дни и тренировки</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                    onClick={handleAddProgramDraftDay}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить день
                  </Button>
                </div>

                <div className="space-y-3">
                  {programDraft.days.map((day, index) => {
                    const template = builderTemplates.find((item) => item.id === day.templateId);

                    return (
                      <div key={day.id} className="rounded-[1.35rem] border border-zinc-800 bg-black/18 p-3">
                        <div className="grid gap-3 lg:grid-cols-[130px_minmax(0,1fr)]">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-lime-300/16 bg-lime-300/8 text-sm font-semibold text-lime-100">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <Input
                                value={day.weekLabel}
                                onChange={(event) =>
                                  handleProgramDraftDayChange(day.id, { weekLabel: event.target.value })
                                }
                                className="h-9 rounded-xl border-zinc-800 bg-zinc-950/70 text-xs text-zinc-100"
                              />
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                            <Input
                              value={day.label}
                              onChange={(event) =>
                                handleProgramDraftDayChange(day.id, { label: event.target.value })
                              }
                              placeholder="Пн · Push"
                              className="h-10 rounded-2xl border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-600"
                            />
                            <select
                              value={day.templateId}
                              onChange={(event) =>
                                handleProgramDraftDayChange(day.id, { templateId: event.target.value })
                              }
                              className="h-10 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none"
                            >
                              <option value="">Выберите тренировку</option>
                              {builderTemplates.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title} · {item.trainingType}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-10 rounded-full px-3 text-zinc-400 hover:bg-zinc-900 hover:text-rose-100"
                              onClick={() => handleRemoveProgramDraftDay(day.id)}
                              disabled={programDraft.days.length <= 1}
                            >
                              Убрать
                            </Button>
                          </div>
                        </div>

                        {template ? (
                          <div className="mt-3 flex flex-wrap gap-2 pl-0 lg:pl-[142px]">
                            <SmallMetric label="Папка" value={template.folder} />
                            <SmallMetric label="Упр." value={String(template.exerciseCount)} />
                            <SmallMetric label="Блоки" value={String(template.blockCount)} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-zinc-800/80 p-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              onClick={() => setProgramCreatorOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"
              onClick={handleCreateProgramFromWorkouts}
              disabled={builderTemplates.length === 0}
            >
              Создать программу
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TrainerShell>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  tone?: "default" | "warning" | "good";
}) {
  return (
    <div className="rounded-[1.35rem] border border-zinc-800 bg-black/22 p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className={cn("h-5 w-5", tone === "warning" ? "text-amber-100" : "text-lime-100")} />
        {tone === "good" ? <CheckCircle2 className="h-4 w-4 text-lime-100" /> : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/22 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
