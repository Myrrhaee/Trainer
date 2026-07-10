"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Layers3,
  Loader2,
  PanelLeft,
  Save,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ExerciseDetailSheet } from "@/components/trainer/exercise-detail-sheet";
import { ExerciseLibraryPanel } from "@/components/trainer/exercise-library-panel";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { WorkoutExerciseCard } from "@/components/trainer/workout-exercise-card";
import { WorkoutSupersetBlockCard } from "@/components/trainer/workout-superset-block-card";
import type {
  WorkoutBuilderBlock,
  WorkoutBuilderDay,
  WorkoutBuilderExercise,
  WorkoutSetEntry,
} from "@/components/trainer/workout-builder-types";
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
  getDemoLibraryExercises,
  getDemoProgramDays,
  getDemoPrograms,
  getDemoRosterClients,
} from "@/lib/demo-data";
import {
  copySystemExerciseToMyLibrary,
  loadVisibleExerciseLibrary,
  type ExerciseLibraryRow,
} from "@/lib/exercise-library";
import {
  EXERCISE_FILTER_CATEGORIES,
  matchesExerciseCategory,
} from "@/lib/exercise-categories";
import { DEMO_TRAINER, isDemoModeEnabled } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase-client";
import { cn, createSafeId, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type LibraryScope = "mine" | "system";

type TrainerClient = {
  id: string;
  name: string;
  status: string;
  goal: string;
  currentWeight?: string;
  lastActive?: string;
  program?: string;
};

type TrainerProgram = {
  id: string;
  title: string;
  weeks: number | null;
};

type ProgramDayOption = {
  id: string;
  label: string;
  weekLabel: string;
};

type SavedWorkoutTemplate = {
  id: string;
  title: string;
  trainingType: string;
  note: string;
  folder?: string;
  exercises: WorkoutBuilderExercise[];
  blocks: WorkoutBuilderBlock[];
  savedAt: string;
  source?: "server" | "local";
};

type TemplateSaveDraft = {
  title: string;
  folder: string;
  trainingType: string;
  note: string;
};

type AssignWorkoutDraft = {
  clientId: string;
  scheduledDate: string;
  placement: string;
  visibility: string;
  coachNote: string;
};

type AssignedWorkoutPayload = {
  id: string;
  clientId: string;
  clientName: string;
  scheduledDate: string;
  placement: string;
  visibility: string;
  coachNote: string;
  workout: WorkoutBuilderDay;
  assignedAt: string;
};

type DraftPayload = {
  clientId: string;
  programId: string;
  targetDayId: string;
  workout: WorkoutBuilderDay;
  savedAt: string;
};

type BuilderTemplateRow = {
  id: string;
  title: string | null;
  training_type: string | null;
  note: string | null;
  exercises: unknown;
  updated_at: string | null;
  created_at: string | null;
};

function createEmptyWorkout(): WorkoutBuilderDay {
  return {
    id: createSafeId(),
    name: "Новая тренировка",
    trainingType: "Силовая тренировка",
    note: "",
    exercises: [],
    blocks: [],
  };
}

function createSetEntries(
  count: number,
  existing: WorkoutSetEntry[] = [],
  defaults: Partial<Pick<WorkoutSetEntry, "reps" | "weight" | "rest" | "rpe">> = {}
) {
  return Array.from({ length: count }, (_, index) => ({
    id: existing[index]?.id ?? createSafeId(),
    reps: existing[index]?.reps ?? defaults.reps ?? "",
    weight: existing[index]?.weight ?? defaults.weight ?? "",
    rest: existing[index]?.rest ?? defaults.rest ?? "",
    rpe: existing[index]?.rpe ?? defaults.rpe ?? "",
  }));
}

function normalizeSetCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(12, Math.max(1, parsed));
}

function cloneExercise(
  exercise: WorkoutBuilderExercise,
  expanded = exercise.expanded
): WorkoutBuilderExercise {
  return {
    ...exercise,
    id: createSafeId(),
    expanded,
    setEntries: exercise.setEntries.map((entry) => ({
      ...entry,
      id: createSafeId(),
    })),
  };
}

function cloneBlock(block: WorkoutBuilderBlock): WorkoutBuilderBlock {
  return {
    ...block,
    id: createSafeId(),
    expanded: true,
    exercises: block.exercises.map((exercise, index) =>
      cloneExercise({ ...exercise, expanded: index === 0 }, index === 0)
    ),
  };
}

function hydrateExercise(value: Partial<WorkoutBuilderExercise>): WorkoutBuilderExercise {
  const sets = value.sets ?? "4";
  return {
    id: value.id ?? createSafeId(),
    exercise_id: value.exercise_id ?? createSafeId(),
    title: value.title ?? "Упражнение",
    category: value.category ?? null,
    equipment: value.equipment ?? null,
    difficulty: value.difficulty ?? null,
    description: value.description ?? null,
    imageUrl: value.imageUrl ?? null,
    muscleGroups: Array.isArray(value.muscleGroups) ? value.muscleGroups : [],
    sets,
    reps: value.reps ?? "10",
    weight: value.weight ?? "",
    rest: value.rest ?? "90 сек",
    comment: value.comment ?? "",
    rpe: value.rpe ?? "",
    tempo: value.tempo ?? "",
    note: value.note ?? "",
    executionType: value.executionType ?? "Обычное",
    effortMode: value.effortMode ?? "Обычный",
    expanded: value.expanded ?? false,
    perSetMode: value.perSetMode ?? false,
    setEntries: createSetEntries(
      normalizeSetCount(sets),
      Array.isArray(value.setEntries) ? value.setEntries : [],
      {
        reps: value.reps ?? "10",
        weight: value.weight ?? "",
        rest: value.rest ?? "90 сек",
        rpe: value.rpe ?? "",
      }
    ),
  };
}

function hydrateBlock(value: Partial<WorkoutBuilderBlock>): WorkoutBuilderBlock {
  return {
    id: value.id ?? createSafeId(),
    type: "superset",
    title: value.title?.trim() || "Суперсет",
    note: value.note ?? "",
    rounds: value.rounds ?? "3",
    restBetweenRounds: value.restBetweenRounds ?? "120 сек",
    expanded: value.expanded ?? true,
    exercises: Array.isArray(value.exercises)
      ? value.exercises.map((exercise, index) =>
          hydrateExercise({
            ...exercise,
            executionType: exercise.executionType ?? "Суперсет",
            expanded: index === 0 ? true : Boolean(exercise.expanded),
          })
        )
      : [],
  };
}

function hydrateWorkout(value: Partial<WorkoutBuilderDay> | null | undefined): WorkoutBuilderDay {
  return {
    id: value?.id ?? createSafeId(),
    name: value?.name ?? "Новая тренировка",
    trainingType: value?.trainingType ?? "Силовая тренировка",
    note: value?.note ?? "",
    exercises: Array.isArray(value?.exercises)
      ? value.exercises.map((exercise, index) =>
          hydrateExercise({
            ...exercise,
            expanded: index === 0 ? true : Boolean(exercise.expanded),
          })
        )
      : [],
    blocks: Array.isArray(value?.blocks) ? value.blocks.map((block) => hydrateBlock(block)) : [],
  };
}

function createExerciseFromLibrary(exercise: ExerciseLibraryRow): WorkoutBuilderExercise {
  return hydrateExercise({
    exercise_id: exercise.id,
    title: exercise.title,
    category: exercise.muscle_group,
    equipment: exercise.equipment,
    difficulty: exercise.difficulty,
    description: exercise.description,
    imageUrl: exercise.image_url,
    muscleGroups: exercise.muscle_groups,
    sets: "4",
    reps: "10",
    weight: "",
    rest: "90 сек",
    comment: "",
    rpe: "",
    tempo: "",
    note: "",
    executionType: "Обычное",
    effortMode: "Обычный",
    expanded: true,
    perSetMode: false,
  });
}

function draftStorageKey(userId: string) {
  return `trainer-builder-draft:${userId}`;
}

function templateStorageKey(userId: string) {
  return `trainer-builder-templates:${userId}`;
}

function assignmentStorageKey(userId: string) {
  return `trainer-builder-assignments:${userId}`;
}

const quickTemplates = [
  {
    id: "push",
    title: "Push Day",
    helper: "Грудь, плечи, трицепс",
    trainingType: "Push · гипертрофия",
    exerciseHints: ["Жим штанги лежа", "Жим гантелей лежа", "Жим на плечи сидя", "Разгибание рук на верхнем блоке"],
  },
  {
    id: "pull",
    title: "Pull Day",
    helper: "Спина, задняя дельта, бицепс",
    trainingType: "Pull · сила и объём",
    exerciseHints: ["Тяга верхнего блока", "Тяга штанги в наклоне", "Тяга горизонтального блока", "Подъем штанги на бицепс"],
  },
  {
    id: "legs",
    title: "Ноги",
    helper: "Квадрицепс, ягодицы, задняя поверхность",
    trainingType: "Ноги · силовой день",
    exerciseHints: ["Приседания со штангой", "Жим ногами", "Румынская тяга", "Разгибание ног"],
  },
  {
    id: "full-body",
    title: "Full Body",
    helper: "Быстрый день на всё тело",
    trainingType: "Full Body · 60 минут",
    exerciseHints: ["Приседания со штангой", "Жим штанги лежа", "Тяга верхнего блока", "Жим на плечи сидя"],
  },
];

const templateFolderOptions = [
  "Общие",
  "Push / Pull / Legs",
  "Ноги",
  "Спина",
  "Грудь и плечи",
  "Full Body",
  "Реабилитация",
];

function inferTemplateFolder(trainingType: string) {
  const lower = trainingType.toLowerCase();
  if (lower.includes("push") || lower.includes("pull")) return "Push / Pull / Legs";
  if (lower.includes("ног")) return "Ноги";
  if (lower.includes("спин") || lower.includes("pull")) return "Спина";
  if (lower.includes("full")) return "Full Body";
  return "Общие";
}

function splitTemplatePayload(value: unknown) {
  if (Array.isArray(value)) {
    return {
      exercises: value,
      blocks: [],
      folder: undefined,
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
      folder: typeof payload.folder === "string" ? payload.folder : undefined,
    };
  }

  return {
    exercises: [],
    blocks: [],
    folder: undefined,
  };
}

function createTemplatePayload(template: SavedWorkoutTemplate) {
  return {
    version: 2,
    folder: template.folder ?? "Общие",
    exercises: template.exercises,
    blocks: template.blocks,
  };
}

function hydrateTemplate(template: Partial<SavedWorkoutTemplate>): SavedWorkoutTemplate {
  return {
    id: template.id ?? createSafeId(),
    title: template.title?.trim() || "Шаблон без названия",
    trainingType: template.trainingType?.trim() || "Силовая тренировка",
    note: template.note ?? "",
    folder: template.folder?.trim() || "Общие",
    exercises: Array.isArray(template.exercises)
      ? template.exercises.map((exercise) => hydrateExercise(exercise))
      : [],
    blocks: Array.isArray(template.blocks)
      ? template.blocks.map((block) => hydrateBlock(block))
      : [],
    savedAt: template.savedAt ?? new Date().toISOString(),
    source: template.source ?? "local",
  };
}

function templateFromRow(row: BuilderTemplateRow): SavedWorkoutTemplate {
  const payload = splitTemplatePayload(row.exercises);

  return hydrateTemplate({
    id: row.id,
    title: row.title ?? "Шаблон без названия",
    trainingType: row.training_type ?? "Силовая тренировка",
    note: row.note ?? "",
    folder: payload.folder,
    exercises: payload.exercises,
    blocks: payload.blocks,
    savedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    source: "server",
  });
}

function loadLocalTemplates(userId: string): SavedWorkoutTemplate[] {
  try {
    const templatesRaw = window.localStorage.getItem(templateStorageKey(userId));
    if (!templatesRaw) return [];
    const parsed = JSON.parse(templatesRaw) as SavedWorkoutTemplate[];
    return Array.isArray(parsed) ? parsed.map((template) => hydrateTemplate(template)) : [];
  } catch (error) {
    console.error("builder local templates restore failed", error);
    return [];
  }
}

function persistLocalTemplates(userId: string, templates: SavedWorkoutTemplate[]) {
  window.localStorage.setItem(templateStorageKey(userId), JSON.stringify(templates));
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocalAssignments(userId: string): AssignedWorkoutPayload[] {
  try {
    const raw = window.localStorage.getItem(assignmentStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssignedWorkoutPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("builder assignments restore failed", error);
    return [];
  }
}

function persistLocalAssignment(userId: string, assignment: AssignedWorkoutPayload) {
  const nextAssignments = [assignment, ...loadLocalAssignments(userId)].slice(0, 40);
  window.localStorage.setItem(assignmentStorageKey(userId), JSON.stringify(nextAssignments));
}

async function loadTrainerBuilderTemplates(trainerId: string) {
  const res = await supabase
    .from("trainer_builder_templates")
    .select("id, title, training_type, note, exercises, created_at, updated_at")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [] as SavedWorkoutTemplate[], error: null, schemaMissing: true };
  }

  return {
    data: ((res.data ?? []) as BuilderTemplateRow[]).map(templateFromRow),
    error: res.error,
    schemaMissing: false,
  };
}

async function saveTrainerBuilderTemplate(
  trainerId: string,
  template: SavedWorkoutTemplate
) {
  const res = await supabase
    .from("trainer_builder_templates")
    .insert({
      trainer_id: trainerId,
      title: template.title,
      training_type: template.trainingType,
      note: template.note,
      exercises: createTemplatePayload(template),
    })
    .select("id, title, training_type, note, exercises, created_at, updated_at")
    .single();

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: null as SavedWorkoutTemplate | null, error: null, schemaMissing: true };
  }

  return {
    data: res.data ? templateFromRow(res.data as BuilderTemplateRow) : null,
    error: res.error,
    schemaMissing: false,
  };
}

async function loadTrainerClients(trainerId: string): Promise<TrainerClient[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, updated_at, weight, target_weight")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });

  if (error) {
    logSupabaseError("builder clients load failed", error);
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    full_name?: string | null;
    email?: string | null;
    updated_at?: string | null;
    weight?: number | null;
    target_weight?: number | null;
  }>).map((row, index) => {
    const weight = typeof row.weight === "number" ? row.weight : null;
    const targetWeight = typeof row.target_weight === "number" ? row.target_weight : null;
    const goal =
      weight != null && targetWeight != null
        ? targetWeight < weight
          ? "Снижение веса"
          : targetWeight > weight
            ? "Набор массы"
            : "Поддержание формы"
        : "Поддержание формы";

    return {
      id: row.id,
      name: row.full_name?.trim() || row.email?.trim() || `Клиент ${index + 1}`,
      status: index % 5 === 0 ? "На паузе" : index % 3 === 0 ? "Ждёт ответа" : "Активен",
      goal,
      currentWeight: weight != null ? `${weight.toLocaleString("ru-RU")} кг` : undefined,
      lastActive: row.updated_at ? new Date(row.updated_at).toLocaleDateString("ru-RU") : undefined,
      program: "Рабочая программа",
    };
  });
}

async function loadTrainerPrograms(trainerId: string): Promise<TrainerProgram[]> {
  const { data, error } = await supabase
    .from("workout_templates")
    .select("id, title, weeks")
    .eq("trainer_id", trainerId);

  if (error) {
    logSupabaseError("builder programs load failed", error);
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    title?: string | null;
    weeks?: number | null;
  }>).map((row) => ({
    id: row.id,
    title: row.title?.trim() || "Программа без названия",
    weeks: row.weeks ?? null,
  }));
}

async function loadProgramDayOptions(programId: string): Promise<ProgramDayOption[]> {
  const { data, error } = await supabase
    .from("workout_templates")
    .select("plan_json")
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    logSupabaseError("builder program days load failed", error);
    return [];
  }

  const plan = (
    data as {
      plan_json?: {
        weeks?: Array<{
          name?: string;
          days?: Array<{ id?: string; name?: string }>;
        }>;
      } | null;
    } | null
  )?.plan_json;

  if (!plan?.weeks || !Array.isArray(plan.weeks)) {
    return [];
  }

  return plan.weeks.flatMap((week, weekIndex) => {
    const weekLabel =
      typeof week?.name === "string" && week.name.trim()
        ? week.name.trim()
        : `Неделя ${weekIndex + 1}`;
    const days = Array.isArray(week?.days) ? week.days : [];

    return days
      .filter((day): day is { id?: string; name?: string } => Boolean(day))
      .map((day, dayIndex) => ({
        id:
          typeof day.id === "string" && day.id.trim()
            ? day.id.trim()
            : `${weekLabel}-${dayIndex + 1}`,
        label:
          typeof day.name === "string" && day.name.trim()
            ? day.name.trim()
            : `День ${dayIndex + 1}`,
        weekLabel,
      }));
  });
}

export default function TrainerBuilderPage() {
  const router = useRouter();
  const demoMode = isDemoModeEnabled();

  const [loading, setLoading] = useState(true);
  const [trainerId, setTrainerId] = useState<string | null>(null);

  const [clients, setClients] = useState<TrainerClient[]>([]);
  const [programs, setPrograms] = useState<TrainerProgram[]>([]);
  const [programDayOptions, setProgramDayOptions] = useState<ProgramDayOption[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedWorkoutTemplate[]>([]);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedProgramDayId, setSelectedProgramDayId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [workout, setWorkout] = useState<WorkoutBuilderDay>(() => createEmptyWorkout());

  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLibraryRow[]>([]);
  const [scope, setScope] = useState<LibraryScope>("mine");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [equipment, setEquipment] = useState("Всё оборудование");
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLibraryRow | null>(null);
  const [activeSupersetBlockId, setActiveSupersetBlockId] = useState<string | null>(null);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateSaveDraft>({
    title: "",
    folder: "Общие",
    trainingType: "",
    note: "",
  });
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<AssignWorkoutDraft>({
    clientId: "",
    scheduledDate: getTodayInputValue(),
    placement: "Следующая тренировка",
    visibility: "Назначить сразу",
    coachNote: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      const searchParams = new URLSearchParams(window.location.search);
      const requestedClientId = searchParams.get("clientId") ?? "";
      const requestedProgramId = searchParams.get("programId") ?? "";
      const requestedDayId = searchParams.get("dayId") ?? "";

      if (demoMode) {
        const currentTrainerId = DEMO_TRAINER.id;
        if (!cancelled) {
          setTrainerId(currentTrainerId);
          setLibraryExercises(getDemoLibraryExercises());
          setClients(
            getDemoRosterClients().map((client) => ({
              id: client.id,
              name: client.name,
              status: client.status,
              goal: client.goal,
              currentWeight: client.currentWeight,
              lastActive: client.lastActive,
              program: client.program,
            }))
          );
          setPrograms(
            getDemoPrograms().map((program) => ({
              id: program.id,
              title: program.title,
              weeks: program.weeks,
            }))
          );
        }

        try {
          const draftRaw = window.localStorage.getItem(draftStorageKey(currentTrainerId));
          if (draftRaw) {
            const draft = JSON.parse(draftRaw) as DraftPayload;
            setWorkout(hydrateWorkout(draft.workout));
            setSelectedClientId(requestedClientId || draft.clientId || "");
            setSelectedProgramId(requestedProgramId || draft.programId || "");
            setSelectedProgramDayId(requestedDayId || draft.targetDayId || "");
          } else if (requestedClientId) {
            setSelectedClientId(requestedClientId);
            setSelectedProgramId(requestedProgramId);
            setSelectedProgramDayId(requestedDayId);
          } else {
            setSelectedProgramId(requestedProgramId);
            setSelectedProgramDayId(requestedDayId);
          }

          setSavedTemplates(loadLocalTemplates(currentTrainerId));
        } catch (error) {
          console.error("builder demo storage restore failed", error);
        }

        setLibraryLoading(false);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          router.replace("/login");
        }
        return;
      }

      const currentTrainerId = user.id;
      if (!cancelled) {
        setTrainerId(currentTrainerId);
      }

      setLibraryLoading(true);

      const [libraryRes, loadedClients, loadedPrograms, loadedTemplates] = await Promise.all([
        loadVisibleExerciseLibrary(supabase, currentTrainerId),
        loadTrainerClients(currentTrainerId),
        loadTrainerPrograms(currentTrainerId),
        loadTrainerBuilderTemplates(currentTrainerId),
      ]);

      if (cancelled) return;

      if (libraryRes.error) {
        logSupabaseError("builder library load failed", libraryRes.error);
      }

      setLibraryExercises(libraryRes.data ?? []);
      setClients(loadedClients);
      setPrograms(loadedPrograms.sort((a, b) => a.title.localeCompare(b.title, "ru")));
      if (loadedTemplates.error) {
        logSupabaseError("builder templates load failed", loadedTemplates.error);
      }
      setSavedTemplates(
        loadedTemplates.schemaMissing
          ? loadLocalTemplates(currentTrainerId)
          : loadedTemplates.data
      );

      try {
        const draftRaw = window.localStorage.getItem(draftStorageKey(currentTrainerId));
        if (draftRaw) {
          const draft = JSON.parse(draftRaw) as DraftPayload;
          setWorkout(hydrateWorkout(draft.workout));
          setSelectedClientId(requestedClientId || draft.clientId || "");
          setSelectedProgramId(requestedProgramId || draft.programId || "");
          setSelectedProgramDayId(requestedDayId || draft.targetDayId || "");
        } else if (requestedClientId) {
          setSelectedClientId(requestedClientId);
          setSelectedProgramId(requestedProgramId);
          setSelectedProgramDayId(requestedDayId);
        } else {
          setSelectedProgramId(requestedProgramId);
          setSelectedProgramDayId(requestedDayId);
        }

      } catch (error) {
        console.error("builder storage restore failed", error);
      }

      setLibraryLoading(false);
      setLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [demoMode, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadDays() {
      if (!selectedProgramId) {
        setProgramDayOptions([]);
        setSelectedProgramDayId("");
        return;
      }

      if (demoMode) {
        const days = getDemoProgramDays(selectedProgramId);
        setProgramDayOptions(days);
        setSelectedProgramDayId((currentValue) =>
          days.some((day) => day.id === currentValue) ? currentValue : ""
        );
        return;
      }

      const days = await loadProgramDayOptions(selectedProgramId);
      if (cancelled) return;

      setProgramDayOptions(days);
      setSelectedProgramDayId((currentValue) =>
        days.some((day) => day.id === currentValue) ? currentValue : ""
      );
    }

    void loadDays();

    return () => {
      cancelled = true;
    };
  }, [demoMode, selectedProgramId]);

  const visibleExercises = useMemo(() => {
    return libraryExercises.filter((exercise) => {
      if (scope === "mine" && exercise.is_system) return false;
      if (scope === "system" && !exercise.is_system) return false;
      if (!matchesExerciseCategory(exercise, category)) return false;
      if (equipment !== "Всё оборудование" && exercise.equipment !== equipment) return false;

      const haystack = [
        exercise.title,
        exercise.muscle_group,
        exercise.equipment,
        exercise.description,
        ...(exercise.muscle_groups ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.trim().toLowerCase());
    });
  }, [category, equipment, libraryExercises, scope, search]);

  const categories = useMemo(() => [...EXERCISE_FILTER_CATEGORIES], []);

  const equipmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          libraryExercises
            .map((exercise) => exercise.equipment)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [libraryExercises]
  );

  const totalExerciseCount = useMemo(
    () =>
      workout.exercises.length +
      workout.blocks.reduce((sum, block) => sum + block.exercises.length, 0),
    [workout.blocks, workout.exercises.length]
  );

  const totalSets = useMemo(
    () =>
      workout.exercises.reduce((sum, exercise) => sum + normalizeSetCount(exercise.sets), 0) +
      workout.blocks.reduce(
        (sum, block) =>
          sum +
          block.exercises.reduce(
            (blockSum, exercise) => blockSum + normalizeSetCount(exercise.sets),
            0
          ),
        0
      ),
    [workout.blocks, workout.exercises]
  );

  const estimatedDuration = useMemo(() => {
    const minutes = workout.exercises.reduce((sum, exercise) => {
      const sets = normalizeSetCount(exercise.sets);
      const restSeconds = Number.parseInt(exercise.rest, 10);
      const safeRestSeconds = Number.isNaN(restSeconds) ? 75 : restSeconds;
      return sum + sets * 0.6 + ((sets - 1) * safeRestSeconds) / 60;
    }, 0);

    const blockMinutes = workout.blocks.reduce((sum, block) => {
      const rounds = normalizeSetCount(block.rounds);
      const restSeconds = Number.parseInt(block.restBetweenRounds, 10);
      const safeRestSeconds = Number.isNaN(restSeconds) ? 90 : restSeconds;
      const workSeconds = Math.max(1, block.exercises.length) * 45;
      return sum + (rounds * workSeconds + rounds * safeRestSeconds) / 60;
    }, 0);

    return Math.max(20, Math.round(minutes + blockMinutes));
  }, [workout.blocks, workout.exercises]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) ?? null;
  const selectedProgramDay =
    programDayOptions.find((day) => day.id === selectedProgramDayId) ?? null;
  const currentWeekLabel = selectedProgramDay?.weekLabel ?? "Неделя 4";
  const programWeeksTotal = selectedProgram?.weeks ?? 8;
  const clientProgramLabel =
    selectedClient?.program ?? selectedProgram?.title ?? "Рабочая программа";
  const clientLastWeight = selectedClient?.currentWeight ?? "74.2 кг";
  const clientLastWorkout = selectedClient?.lastActive ?? "вчера";
  const programStructure = useMemo(() => {
    if (programDayOptions.length > 0) {
      return programDayOptions.reduce<Array<{ weekLabel: string; days: ProgramDayOption[] }>>(
        (acc, day) => {
          const group = acc.find((item) => item.weekLabel === day.weekLabel);
          if (group) {
            group.days.push(day);
          } else {
            acc.push({ weekLabel: day.weekLabel, days: [day] });
          }
          return acc;
        },
        []
      );
    }

    return [
      {
        weekLabel: "Неделя 1",
        days: [
          { id: "demo-w1-d1", label: "Пн · Push", weekLabel: "Неделя 1" },
          { id: "demo-w1-d2", label: "Ср · Pull", weekLabel: "Неделя 1" },
          { id: "demo-w1-d3", label: "Пт · Ноги", weekLabel: "Неделя 1" },
        ],
      },
      {
        weekLabel: "Неделя 2",
        days: [
          { id: "demo-w2-d1", label: "Пн · Верх", weekLabel: "Неделя 2" },
          { id: "demo-w2-d2", label: "Чт · Full Body", weekLabel: "Неделя 2" },
        ],
      },
    ];
  }, [programDayOptions]);
  const saveDestination = selectedProgram
    ? selectedProgramDayId
      ? "Обновит выбранный день программы"
      : "Добавит новый день в программу"
    : selectedClient
      ? "Сохранит черновик под выбранного клиента"
      : "Сохранит общий черновик";

  function updateWorkoutField(field: keyof WorkoutBuilderDay, value: string) {
    setWorkout((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddExercise(exercise: ExerciseLibraryRow) {
    if (activeSupersetBlockId) {
      setWorkout((prev) => ({
        ...prev,
        blocks: prev.blocks.map((block) =>
          block.id === activeSupersetBlockId
            ? {
                ...block,
                expanded: true,
                exercises: [
                  ...block.exercises,
                  hydrateExercise({
                    ...createExerciseFromLibrary(exercise),
                    executionType: "Суперсет",
                    expanded: true,
                  }),
                ],
              }
            : block
        ),
      }));
      toast.success(`A-упражнение «${exercise.title}» добавлено в суперсет`);
      return;
    }

    setWorkout((prev) => ({
      ...prev,
      exercises: [...prev.exercises, createExerciseFromLibrary(exercise)],
    }));
    toast.success(`Упражнение «${exercise.title}» добавлено в тренировку`);
  }

  function findExerciseDetails(exercise: WorkoutBuilderExercise) {
    return (
      libraryExercises.find((item) => item.id === exercise.exercise_id) ??
      libraryExercises.find((item) => item.title.toLowerCase() === exercise.title.toLowerCase()) ??
      null
    );
  }

  function handleQuickTemplate(templateId: string) {
    const template = quickTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const pickedExercises = template.exerciseHints
      .map((hint) =>
        libraryExercises.find((exercise) =>
          exercise.title.toLowerCase().includes(hint.toLowerCase())
        )
      )
      .filter((exercise): exercise is ExerciseLibraryRow => Boolean(exercise))
      .slice(0, 5);

    if (pickedExercises.length === 0) {
      toast.error("Не удалось собрать шаблон из текущей библиотеки");
      return;
    }

    setWorkout({
      id: createSafeId(),
      name: `${template.title} · ${selectedClient?.name ?? "новый клиент"}`,
      trainingType: template.trainingType,
      note: selectedClient
        ? `Корректировка под цель: ${selectedClient.goal}. Держать запас 1-2 повтора в рабочих подходах.`
        : "Быстрый шаблон для дальнейшей настройки под клиента.",
      exercises: pickedExercises.map((exercise, index) =>
        hydrateExercise({
          ...createExerciseFromLibrary(exercise),
          sets: index === 0 ? "4" : "3",
          reps: index === 0 ? "6-8" : "8-12",
          rpe: index === 0 ? "8" : "7",
          expanded: index === 0,
        })
      ),
      blocks: [],
    });
    setActiveSupersetBlockId(null);
    setSelectedTemplateId("");
    toast.success(`Шаблон «${template.title}» загружен в canvas`);
  }

  async function handleAddToMine(exercise: ExerciseLibraryRow) {
    if (demoMode) {
      if (exercise.is_system) {
        const copy: ExerciseLibraryRow = {
          ...exercise,
          id: createSafeId(),
          is_system: false,
          owner_user_id: trainerId,
          source_exercise_id: exercise.id,
        };
        setLibraryExercises((prev) => [copy, ...prev]);
        setScope("mine");
        toast.success(`Упражнение «${exercise.title}» добавлено в ваши упражнения`);
      }
      return;
    }

    if (copyingId) return;
    setCopyingId(exercise.id);

    const result = await copySystemExerciseToMyLibrary(supabase, exercise.id);
    setCopyingId(null);

    if (result.error || !result.data) {
      logSupabaseError("builder copy system exercise failed", result.error);
      toast.error("Не удалось добавить упражнение в личную библиотеку");
      return;
    }

    setLibraryExercises((prev) => {
      if (prev.some((item) => item.id === result.data?.id)) return prev;
      return [result.data as ExerciseLibraryRow, ...prev];
    });
    setScope("mine");
    toast.success(`Упражнение «${exercise.title}» добавлено в ваши упражнения`);
  }

  function handleExerciseFieldChange(
    exerciseId: string,
    field: keyof WorkoutBuilderExercise,
    value: string
  ) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
      ),
    }));
  }

  function handleToggleExpand(exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, expanded: !exercise.expanded } : exercise
      ),
    }));
  }

  function handleCreateSuperset() {
    const block = hydrateBlock({
      title: `Суперсет ${workout.blocks.length + 1}`,
      note: "Выполнить упражнения подряд, отдых только после круга.",
      rounds: "3",
      restBetweenRounds: "120 сек",
      expanded: true,
    });

    setWorkout((prev) => ({
      ...prev,
      blocks: [...prev.blocks, block],
    }));
    setActiveSupersetBlockId(block.id);
    toast.success("Суперсет создан. Добавьте упражнения из библиотеки справа.");
    window.setTimeout(() => scrollToLibrary(), 80);
  }

  function handleToggleBlockExpand(blockId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId ? { ...block, expanded: !block.expanded } : block
      ),
    }));
  }

  function handleDeleteBlock(blockId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((block) => block.id !== blockId),
    }));
    setActiveSupersetBlockId((current) => (current === blockId ? null : current));
  }

  function handleBlockFieldChange(
    blockId: string,
    field: keyof Pick<WorkoutBuilderBlock, "title" | "note" | "rounds" | "restBetweenRounds">,
    value: string
  ) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId ? { ...block, [field]: value } : block
      ),
    }));
  }

  function handleSupersetExerciseFieldChange(
    blockId: string,
    exerciseId: string,
    field: keyof WorkoutBuilderExercise,
    value: string
  ) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: block.exercises.map((exercise) =>
                exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
              ),
            }
          : block
      ),
    }));
  }

  function handleSupersetExerciseToggleExpand(blockId: string, exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: block.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, expanded: !exercise.expanded }
                  : exercise
              ),
            }
          : block
      ),
    }));
  }

  function handleSupersetExerciseTogglePerSetMode(blockId: string, exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: block.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, perSetMode: !exercise.perSetMode }
                  : exercise
              ),
            }
          : block
      ),
    }));
  }

  function handleSupersetSetCountChange(blockId: string, exerciseId: string, value: string) {
    const count = normalizeSetCount(value);
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: block.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? {
                      ...exercise,
                      sets: String(count),
                      setEntries: createSetEntries(count, exercise.setEntries, {
                        reps: exercise.reps,
                        weight: exercise.weight,
                        rest: exercise.rest,
                        rpe: exercise.rpe,
                      }),
                    }
                  : exercise
              ),
            }
          : block
      ),
    }));
  }

  function handleSupersetSetEntryChange(
    blockId: string,
    exerciseId: string,
    setEntryId: string,
    field: keyof WorkoutSetEntry,
    value: string
  ) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              exercises: block.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? {
                      ...exercise,
                      setEntries: exercise.setEntries.map((entry) =>
                        entry.id === setEntryId ? { ...entry, [field]: value } : entry
                      ),
                    }
                  : exercise
              ),
            }
          : block
      ),
    }));
  }

  function handleDuplicateSupersetExercise(blockId: string, exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const index = block.exercises.findIndex((exercise) => exercise.id === exerciseId);
        if (index === -1) return block;
        const nextExercises = [...block.exercises];
        nextExercises.splice(index + 1, 0, cloneExercise(block.exercises[index], true));
        return { ...block, exercises: nextExercises };
      }),
    }));
  }

  function handleDeleteSupersetExercise(blockId: string, exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === blockId
          ? { ...block, exercises: block.exercises.filter((exercise) => exercise.id !== exerciseId) }
          : block
      ),
    }));
  }

  function handleMoveSupersetExercise(
    blockId: string,
    exerciseId: string,
    direction: "up" | "down"
  ) {
    setWorkout((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const index = block.exercises.findIndex((exercise) => exercise.id === exerciseId);
        if (index === -1) return block;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= block.exercises.length) return block;

        const nextExercises = [...block.exercises];
        const [moved] = nextExercises.splice(index, 1);
        nextExercises.splice(targetIndex, 0, moved);
        return { ...block, exercises: nextExercises };
      }),
    }));
  }

  function handleTogglePerSetMode(exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, perSetMode: !exercise.perSetMode } : exercise
      ),
    }));
  }

  function handleSetCountChange(exerciseId: string, value: string) {
    const count = normalizeSetCount(value);
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: String(count),
              setEntries: createSetEntries(count, exercise.setEntries, {
                reps: exercise.reps,
                weight: exercise.weight,
                rest: exercise.rest,
                rpe: exercise.rpe,
              }),
            }
          : exercise
      ),
    }));
  }

  function handleSetEntryChange(
    exerciseId: string,
    setEntryId: string,
    field: keyof WorkoutSetEntry,
    value: string
  ) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              setEntries: exercise.setEntries.map((entry) =>
                entry.id === setEntryId ? { ...entry, [field]: value } : entry
              ),
            }
          : exercise
      ),
    }));
  }

  function handleDuplicateExercise(exerciseId: string) {
    setWorkout((prev) => {
      const index = prev.exercises.findIndex((exercise) => exercise.id === exerciseId);
      if (index === -1) return prev;
      const duplicated = cloneExercise(prev.exercises[index], true);
      const nextExercises = [...prev.exercises];
      nextExercises.splice(index + 1, 0, duplicated);
      return { ...prev, exercises: nextExercises };
    });
  }

  function handleDeleteExercise(exerciseId: string) {
    setWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  }

  function handleMoveExercise(exerciseId: string, direction: "up" | "down") {
    setWorkout((prev) => {
      const index = prev.exercises.findIndex((exercise) => exercise.id === exerciseId);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.exercises.length) return prev;

      const nextExercises = [...prev.exercises];
      const [moved] = nextExercises.splice(index, 1);
      nextExercises.splice(targetIndex, 0, moved);
      return { ...prev, exercises: nextExercises };
    });
  }

  function persistDraft(currentTrainerId: string) {
    const payload: DraftPayload = {
      clientId: selectedClientId,
      programId: selectedProgramId,
      targetDayId: selectedProgramDayId,
      workout,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey(currentTrainerId), JSON.stringify(payload));
  }

  async function handleSave() {
    if (!trainerId) return;
    setSaving(true);

    try {
      persistDraft(trainerId);

      if (demoMode) {
        toast.success(
          selectedProgram
            ? `Тренировка сохранена в demo-программу «${selectedProgram.title}»`
            : selectedClient
              ? `Черновик для ${selectedClient.name} сохранён локально`
              : "Черновик тренировки сохранён локально"
        );
        return;
      }

      if (selectedProgramId) {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          logSupabaseError("builder save session failed", sessionError ?? new Error("no session"));
          toast.error("Сессия истекла. Перезайдите и попробуйте снова.");
          return;
        }

        const response = await fetch("/api/trainer/programs", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            programId: selectedProgramId,
            targetDayId: selectedProgramDayId || undefined,
            workout,
          }),
        });

        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          day?: { id?: string; name?: string };
        };

        if (!response.ok) {
          logSupabaseError("builder save to program failed", result.error ?? new Error("empty"));
          toast.error(result.error ?? "Не удалось сохранить тренировку в программу");
          return;
        }

        if (typeof result.day?.id === "string" && result.day.id) {
          setSelectedProgramDayId(result.day.id);
        }

        toast.success(
          selectedProgram
            ? `Тренировка сохранена в программу «${selectedProgram.title}»`
            : "Тренировка сохранена"
        );
        return;
      }

      toast.success(
        selectedClient
          ? `Черновик для ${selectedClient.name} сохранён`
          : "Черновик тренировки сохранён"
      );
    } catch (error) {
      console.error("builder save failed", error);
      toast.error("Не удалось сохранить черновик");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenAssignToClient() {
    if (totalExerciseCount === 0) {
      toast.error("Добавьте хотя бы одно упражнение, чтобы назначить тренировку");
      return;
    }

    if (clients.length === 0) {
      toast.error("Сначала добавьте клиента");
      return;
    }

    setAssignDraft({
      clientId: selectedClientId || clients[0]?.id || "",
      scheduledDate: getTodayInputValue(),
      placement: selectedProgramDay ? `${selectedProgramDay.weekLabel} · ${selectedProgramDay.label}` : "Следующая тренировка",
      visibility: "Назначить сразу",
      coachNote: workout.note,
    });
    setAssignSheetOpen(true);
  }

  async function handleAssignToClient() {
    if (!trainerId) return;
    const targetClient = clients.find((client) => client.id === assignDraft.clientId) ?? null;

    if (!targetClient) {
      toast.error("Выберите клиента перед назначением тренировки");
      return;
    }

    if (totalExerciseCount === 0) {
      toast.error("Добавьте хотя бы одно упражнение, чтобы назначить тренировку");
      return;
    }

    setSaving(true);

    try {
      const assignedWorkout = hydrateWorkout({
        ...workout,
        id: createSafeId(),
        exercises: workout.exercises.map((exercise, index) =>
          cloneExercise({ ...exercise, expanded: index === 0 }, index === 0)
        ),
        blocks: workout.blocks.map((block) => cloneBlock(block)),
      });

      const assignment: AssignedWorkoutPayload = {
        id: createSafeId(),
        clientId: targetClient.id,
        clientName: targetClient.name,
        scheduledDate: assignDraft.scheduledDate,
        placement: assignDraft.placement,
        visibility: assignDraft.visibility,
        coachNote: assignDraft.coachNote,
        workout: assignedWorkout,
        assignedAt: new Date().toISOString(),
      };

      persistLocalAssignment(trainerId, assignment);
      persistDraft(trainerId);
      setSelectedClientId(targetClient.id);
      setAssignSheetOpen(false);
      toast.success(`Тренировка назначена клиенту ${targetClient.name}`);
    } catch (error) {
      console.error("builder assign failed", error);
      toast.error("Не удалось назначить тренировку");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenTemplateSave() {
    if (totalExerciseCount === 0) {
      toast.error("Добавьте хотя бы одно упражнение, чтобы сохранить шаблон");
      return;
    }

    setTemplateDraft({
      title: workout.name.trim() || "Тренировка без названия",
      folder: inferTemplateFolder(workout.trainingType),
      trainingType: workout.trainingType.trim() || "Силовая тренировка",
      note: workout.note,
    });
    setTemplateSheetOpen(true);
  }

  async function handleSaveAsTemplate() {
    if (!trainerId) return;
    if (totalExerciseCount === 0) {
      toast.error("Добавьте хотя бы одно упражнение, чтобы сохранить шаблон");
      return;
    }

    const title = templateDraft.title.trim();
    if (!title) {
      toast.error("Назовите шаблон перед сохранением");
      return;
    }

    const template: SavedWorkoutTemplate = {
      id: createSafeId(),
      title,
      trainingType: templateDraft.trainingType.trim() || workout.trainingType || "Силовая тренировка",
      note: templateDraft.note,
      folder: templateDraft.folder || "Общие",
      exercises: workout.exercises.map((exercise, index) =>
        cloneExercise({ ...exercise, expanded: index === 0 }, index === 0)
      ),
      blocks: workout.blocks.map((block) => cloneBlock(block)),
      savedAt: new Date().toISOString(),
      source: demoMode ? "local" : "server",
    };

    if (demoMode) {
      const nextTemplates = [template, ...savedTemplates].slice(0, 8);
      setSavedTemplates(nextTemplates);
      setSelectedTemplateId(template.id);
      persistLocalTemplates(trainerId, nextTemplates);
      setTemplateSheetOpen(false);
      toast.success("Шаблон сохранён локально и доступен для повторного использования");
      return;
    }

    setSaving(true);

    try {
      const result = await saveTrainerBuilderTemplate(trainerId, template);

      if (result.schemaMissing) {
        const localTemplate = { ...template, source: "local" as const };
        const nextTemplates = [localTemplate, ...savedTemplates].slice(0, 8);
        setSavedTemplates(nextTemplates);
        setSelectedTemplateId(localTemplate.id);
        persistLocalTemplates(trainerId, nextTemplates);
        setTemplateSheetOpen(false);
        toast.error("Таблица шаблонов ещё не применена в Supabase. Шаблон сохранён локально.");
        return;
      }

      if (result.error || !result.data) {
        logSupabaseError("builder template save failed", result.error);
        toast.error("Не удалось сохранить шаблон на сервере");
        return;
      }

      setSavedTemplates((prev) => [result.data as SavedWorkoutTemplate, ...prev].slice(0, 40));
      setSelectedTemplateId(result.data.id);
      setTemplateSheetOpen(false);
      toast.success("Шаблон сохранён на сервере");
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setWorkout(createEmptyWorkout());
    setSelectedTemplateId("");
    setActiveSupersetBlockId(null);
    toast.success("Конструктор очищен");
  }

  function scrollToLibrary() {
    document.getElementById("builder-library")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setWorkout({
      id: createSafeId(),
      name: template.title,
      trainingType: template.trainingType,
      note: template.note,
      exercises: template.exercises.map((exercise, index) =>
        hydrateExercise({
          ...exercise,
          expanded: index === 0,
        })
      ),
      blocks: template.blocks.map((block) => hydrateBlock(block)),
    });
    setActiveSupersetBlockId(null);
    toast.success(`Загружен шаблон «${template.title}»`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-black/30 px-4 py-3 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаем конструктор тренировки
        </div>
      </div>
    );
  }

  return (
    <TrainerShell
      title="Builder"
      description="Рабочее место тренера для сборки тренировочного дня в контексте клиента."
      headerAction={
        <div className="hidden items-center gap-2 xl:flex">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-zinc-800 bg-zinc-950/55 px-4 text-zinc-200 hover:bg-zinc-900"
            onClick={handleSave}
            disabled={saving}
          >
            Сохранить черновик
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200"
            onClick={handleOpenAssignToClient}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Назначаем..." : "Назначить клиенту"}
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
        <section className="rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.13),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.94),rgba(3,7,18,0.98))] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/12 text-base font-semibold text-lime-100">
                {selectedClient?.name
                  ?.split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("") || "TR"}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                    {selectedClient?.name ?? "Тренировочный день"}
                  </h1>
                  <Badge className="rounded-full border border-lime-300/18 bg-lime-300/10 text-lime-100">
                    {selectedClient?.goal ?? "Без клиента"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {clientProgramLabel} · {currentWeekLabel} из {programWeeksTotal} · {saveDestination}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <ContextStat label="Последний вес" value={clientLastWeight} />
              <ContextStat label="Последняя тренировка" value={clientLastWorkout} />
              <ContextStat label="Упражнения" value={String(totalExerciseCount)} />
              <ContextStat label="~ длительность" value={`${estimatedDuration} мин`} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
            <SelectorBlock label="Клиент">
              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="h-10 w-full rounded-2xl border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
              >
                <option value="">Без привязки к клиенту</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.status}
                  </option>
                ))}
              </select>
            </SelectorBlock>
            <SelectorBlock label="Программа">
              <select
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                className="h-10 w-full rounded-2xl border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
              >
                <option value="">Новая тренировка без программы</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                    {program.weeks ? ` · ${program.weeks} нед.` : ""}
                  </option>
                ))}
              </select>
            </SelectorBlock>
            <SelectorBlock label="Сохранённый шаблон">
              <select
                value={selectedTemplateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
                className="h-10 w-full rounded-2xl border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
              >
                <option value="">Без шаблона</option>
                {savedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                    {template.source === "server" ? " · сервер" : " · локально"}
                  </option>
                ))}
              </select>
            </SelectorBlock>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/72 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Шаблоны</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Быстрый старт тренировочного дня</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {quickTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleQuickTemplate(template.id)}
                  className="rounded-[1.2rem] border border-zinc-800 bg-black/20 px-4 py-3 text-left transition hover:border-lime-300/24 hover:bg-lime-300/6"
                >
                  <p className="text-sm font-semibold text-zinc-50">{template.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{template.helper}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 2xl:grid-cols-[280px_minmax(0,1fr)_390px]">
          <aside className="space-y-4 2xl:sticky 2xl:top-6 2xl:self-start">
            <div className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Программа</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-50">Структура</h2>
                </div>
                <PanelLeft className="h-5 w-5 text-lime-100" />
              </div>

              <div className="mt-4 space-y-4">
                {programStructure.map((week) => (
                  <div key={week.weekLabel}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      {week.weekLabel}
                    </p>
                    <div className="space-y-2">
                      {week.days.map((day) => {
                        const selected = selectedProgramDayId === day.id;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => setSelectedProgramDayId(day.id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-sm transition",
                              selected
                                ? "border-lime-300/24 bg-lime-300/10 text-lime-50"
                                : "border-zinc-800 bg-black/18 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/70"
                            )}
                          >
                            <span>{day.label}</span>
                            {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сохранение</p>
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-zinc-800 bg-black/18 text-zinc-100 hover:bg-zinc-900"
                  onClick={handleSave}
                  disabled={saving}
                >
                  Сохранить черновик
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                  onClick={handleOpenAssignToClient}
                  disabled={saving}
                >
                  Назначить клиенту
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                  onClick={handleOpenTemplateSave}
                  disabled={saving}
                >
                  Сохранить как шаблон
                </Button>
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <section className="overflow-hidden rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_12%_0%,rgba(190,242,100,0.1),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(7,7,9,0.99))] shadow-2xl shadow-black/20">
              <div className="border-b border-zinc-800/80 p-4 lg:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Canvas тренировки</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Тренировочный день</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                      Соберите день так, как клиент потом увидит его у себя: понятные блоки, карточки упражнений и тренерские подсказки.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 xl:w-[320px]">
                    <CanvasMetric icon={Dumbbell} label="Упр." value={String(totalExerciseCount)} />
                    <CanvasMetric icon={ClipboardList} label="Подходы" value={String(totalSets)} />
                    <CanvasMetric icon={CalendarDays} label="Время" value={`${estimatedDuration} мин`} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Название дня</Label>
                    <Input
                      value={workout.name}
                      onChange={(event) => updateWorkoutField("name", event.target.value)}
                      placeholder="Например: День 2 · Верх тела"
                      className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Тип</Label>
                    <Input
                      value={workout.trainingType}
                      onChange={(event) => updateWorkoutField("trainingType", event.target.value)}
                      placeholder="Push / Pull / Ноги"
                      className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-zinc-300">Акцент для клиента</Label>
                  <Textarea
                    value={workout.note}
                    onChange={(event) => updateWorkoutField("note", event.target.value)}
                    placeholder="Акцент дня, ограничения, подсказки по технике и самочувствию клиента."
                    className="mt-2 min-h-20 rounded-[1.2rem] border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="p-4 lg:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Основной блок</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
                      {totalExerciseCount > 0 ? "Структура тренировочного дня" : "Начните сборку тренировки"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                      onClick={() => {
                        setActiveSupersetBlockId(null);
                        scrollToLibrary();
                      }}
                    >
                      Добавить обычное
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                      onClick={handleCreateSuperset}
                    >
                      <Layers3 className="mr-2 h-4 w-4" />
                      Создать суперсет
                    </Button>
                  </div>
                </div>

                {totalExerciseCount === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/22 px-6 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-lime-100">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-zinc-100">Тренировка пока пустая</p>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
                      Выберите быстрый шаблон сверху или добавьте упражнения из правой библиотеки. Карточки уже готовы к настройке, дублированию и перемещению.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workout.exercises.length > 0 ? (
                      <div className="rounded-[1.6rem] border border-zinc-800/90 bg-black/18 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-full border border-lime-300/18 bg-lime-300/8 text-xs font-semibold text-lime-100">
                              A
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">Обычные упражнения</p>
                              <p className="text-xs text-zinc-600">Последовательное выполнение · {workout.exercises.length} упр.</p>
                            </div>
                          </div>
                          <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-500">
                            клиент увидит этот порядок
                          </span>
                        </div>

                        <div className="space-y-3">
                          {workout.exercises.map((exercise, index) => (
                            <WorkoutExerciseCard
                              key={exercise.id}
                              exercise={exercise}
                              index={index}
                              canMoveUp={index > 0}
                              canMoveDown={index < workout.exercises.length - 1}
                              onToggleExpand={() => handleToggleExpand(exercise.id)}
                              onDuplicate={() => handleDuplicateExercise(exercise.id)}
                              onDelete={() => handleDeleteExercise(exercise.id)}
                              onMoveUp={() => handleMoveExercise(exercise.id, "up")}
                              onMoveDown={() => handleMoveExercise(exercise.id, "down")}
                              onReplace={() => {
                                setActiveSupersetBlockId(null);
                                scrollToLibrary();
                              }}
                              onInspectImage={() => setSelectedExercise(findExerciseDetails(exercise))}
                              onFieldChange={(field, value) =>
                                handleExerciseFieldChange(exercise.id, field, value)
                              }
                              onTogglePerSetMode={() => handleTogglePerSetMode(exercise.id)}
                              onSetCountChange={(value) => handleSetCountChange(exercise.id, value)}
                              onSetEntryChange={(setEntryId, field, value) =>
                                handleSetEntryChange(exercise.id, setEntryId, field, value)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-zinc-800 bg-black/16 px-4 py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">Обычных упражнений пока нет</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              Текущая тренировка собрана из сложных блоков. Можно добавить отдельное упражнение перед или после суперсета.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                            onClick={() => {
                              setActiveSupersetBlockId(null);
                              scrollToLibrary();
                            }}
                          >
                            Добавить обычное
                          </Button>
                        </div>
                      </div>
                    )}

                    {workout.blocks.length > 0 ? (
                      <div className="rounded-[1.6rem] border border-zinc-800/90 bg-black/18 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-full border border-lime-300/18 bg-lime-300/8 text-xs font-semibold text-lime-100">
                              B
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">Сложные блоки</p>
                              <p className="text-xs text-zinc-600">Суперсеты, круги и будущие связки · {workout.blocks.length} блок.</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                            onClick={handleCreateSuperset}
                          >
                            <Layers3 className="mr-2 h-4 w-4" />
                            Ещё суперсет
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {workout.blocks.map((block, blockIndex) => (
                            <WorkoutSupersetBlockCard
                              key={block.id}
                              block={block}
                              blockIndex={blockIndex}
                              activeAddTarget={activeSupersetBlockId === block.id}
                              onToggleExpand={() => handleToggleBlockExpand(block.id)}
                              onDelete={() => handleDeleteBlock(block.id)}
                              onStartAdding={() => {
                                setActiveSupersetBlockId(block.id);
                                scrollToLibrary();
                              }}
                              onStopAdding={() => setActiveSupersetBlockId(null)}
                              onFieldChange={(field, value) =>
                                handleBlockFieldChange(block.id, field, value)
                              }
                              onExerciseFieldChange={(exerciseId, field, value) =>
                                handleSupersetExerciseFieldChange(block.id, exerciseId, field, value)
                              }
                              onExerciseToggleExpand={(exerciseId) =>
                                handleSupersetExerciseToggleExpand(block.id, exerciseId)
                              }
                              onExerciseTogglePerSetMode={(exerciseId) =>
                                handleSupersetExerciseTogglePerSetMode(block.id, exerciseId)
                              }
                              onExerciseSetCountChange={(exerciseId, value) =>
                                handleSupersetSetCountChange(block.id, exerciseId, value)
                              }
                              onExerciseSetEntryChange={(exerciseId, setEntryId, field, value) =>
                                handleSupersetSetEntryChange(
                                  block.id,
                                  exerciseId,
                                  setEntryId,
                                  field,
                                  value
                                )
                              }
                              onExerciseDuplicate={(exerciseId) =>
                                handleDuplicateSupersetExercise(block.id, exerciseId)
                              }
                              onExerciseDelete={(exerciseId) =>
                                handleDeleteSupersetExercise(block.id, exerciseId)
                              }
                              onExerciseMove={(exerciseId, direction) =>
                                handleMoveSupersetExercise(block.id, exerciseId, direction)
                              }
                              onExerciseReplace={() => {
                                setActiveSupersetBlockId(block.id);
                                scrollToLibrary();
                              }}
                              onExerciseInspectImage={(exercise) =>
                                setSelectedExercise(findExerciseDetails(exercise))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-zinc-800 bg-black/16 px-4 py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">Сложных блоков пока нет</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              Суперсет нужен, когда клиент выполняет два упражнения подряд и отдыхает только после круга.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                            onClick={handleCreateSuperset}
                          >
                            Создать суперсет
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/80 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Сохранение</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Черновик можно оставить себе, назначить клиенту или превратить в шаблон для следующих недель.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  onClick={handleClear}
                >
                  Очистить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  onClick={handleSave}
                  disabled={saving}
                >
                  Сохранить черновик
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  onClick={handleOpenTemplateSave}
                  disabled={saving}
                >
                  Сохранить как шаблон
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
                  onClick={handleOpenAssignToClient}
                  disabled={saving}
                >
                  Назначить клиенту
                </Button>
              </div>
            </section>
          </main>

          <aside className="2xl:sticky 2xl:top-6 2xl:self-start">
            <ExerciseLibraryPanel
              exercises={visibleExercises}
              search={search}
              onSearchChange={setSearch}
              scope={scope}
              onScopeChange={setScope}
              category={category}
              onCategoryChange={setCategory}
              equipment={equipment}
              onEquipmentChange={setEquipment}
              categories={categories}
              equipmentOptions={equipmentOptions}
              loading={libraryLoading}
              copyingId={copyingId}
              addLabel={activeSupersetBlockId ? "Добавить в суперсет" : "Добавить в тренировку"}
              modeHint={
                activeSupersetBlockId
                  ? "Выберите упражнение для активного суперсета. Оно добавится как следующий элемент A."
                  : "Найдите упражнение и добавьте его в тренировку за 1–2 клика."
              }
              onAdd={handleAddExercise}
              onAddToMine={handleAddToMine}
              onInspect={setSelectedExercise}
            />
          </aside>
        </section>
      </div>

      <ExerciseDetailSheet exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      <TemplateSaveSheet
        open={templateSheetOpen}
        draft={templateDraft}
        folders={templateFolderOptions}
        exerciseCount={totalExerciseCount}
        blockCount={workout.blocks.length}
        estimatedDuration={estimatedDuration}
        saving={saving}
        onOpenChange={setTemplateSheetOpen}
        onDraftChange={(patch) => setTemplateDraft((prev) => ({ ...prev, ...patch }))}
        onSave={handleSaveAsTemplate}
      />
      <AssignWorkoutSheet
        open={assignSheetOpen}
        draft={assignDraft}
        clients={clients}
        selectedClient={clients.find((client) => client.id === assignDraft.clientId) ?? null}
        workoutName={workout.name}
        trainingType={workout.trainingType}
        exerciseCount={totalExerciseCount}
        blockCount={workout.blocks.length}
        estimatedDuration={estimatedDuration}
        saving={saving}
        onOpenChange={setAssignSheetOpen}
        onDraftChange={(patch) => setAssignDraft((prev) => ({ ...prev, ...patch }))}
        onAssign={handleAssignToClient}
      />
    </TrainerShell>
  );
}

function AssignWorkoutSheet({
  open,
  draft,
  clients,
  selectedClient,
  workoutName,
  trainingType,
  exerciseCount,
  blockCount,
  estimatedDuration,
  saving,
  onOpenChange,
  onDraftChange,
  onAssign,
}: {
  open: boolean;
  draft: AssignWorkoutDraft;
  clients: TrainerClient[];
  selectedClient: TrainerClient | null;
  workoutName: string;
  trainingType: string;
  exerciseCount: number;
  blockCount: number;
  estimatedDuration: number;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (patch: Partial<AssignWorkoutDraft>) => void;
  onAssign: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:max-w-[580px]">
        <SheetHeader className="border-b border-zinc-800/80 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Назначение тренировки</p>
          <SheetTitle className="text-2xl font-semibold tracking-tight text-zinc-50">
            Отправить клиенту
          </SheetTitle>
          <SheetDescription className="max-w-md text-zinc-400">
            Проверьте контекст, дату и видимость. Тренировка сохранится как отдельный снимок для клиента.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="rounded-[1.45rem] border border-lime-300/14 bg-lime-300/7 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-lime-100/70">Тренировка</p>
                <h3 className="mt-1 truncate text-lg font-semibold text-zinc-50">
                  {workoutName.trim() || "Тренировка без названия"}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">{trainingType || "Силовая тренировка"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:w-[250px]">
                <TemplateSummaryMetric label="Упр." value={String(exerciseCount)} />
                <TemplateSummaryMetric label="Блоки" value={String(blockCount)} />
                <TemplateSummaryMetric label="Время" value={`${estimatedDuration}м`} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Клиент</Label>
            <select
              value={draft.clientId}
              onChange={(event) => onDraftChange({ clientId: event.target.value })}
              className="h-11 w-full rounded-2xl border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.goal}
                </option>
              ))}
            </select>
          </div>

          {selectedClient ? (
            <div className="rounded-[1.3rem] border border-zinc-800 bg-black/22 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-lime-300/18 bg-lime-300/10 text-sm font-semibold text-lime-100">
                  {selectedClient.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{selectedClient.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {selectedClient.goal} · {selectedClient.program ?? "Без программы"} · {selectedClient.status}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">Дата тренировки</Label>
              <Input
                type="date"
                value={draft.scheduledDate}
                onChange={(event) => onDraftChange({ scheduledDate: event.target.value })}
                className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Видимость</Label>
              <select
                value={draft.visibility}
                onChange={(event) => onDraftChange({ visibility: event.target.value })}
                className="h-11 w-full rounded-2xl border border-zinc-800 bg-black/24 px-3 text-sm text-zinc-100 outline-none"
              >
                <option value="Назначить сразу">Назначить сразу</option>
                <option value="Сохранить как черновик">Сохранить как черновик</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Куда поставить</Label>
            <Input
              value={draft.placement}
              onChange={(event) => onDraftChange({ placement: event.target.value })}
              placeholder="Например: следующая тренировка / Неделя 4 · День 2"
              className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Комментарий клиенту</Label>
            <Textarea
              value={draft.coachNote}
              onChange={(event) => onDraftChange({ coachNote: event.target.value })}
              placeholder="Короткий акцент перед тренировкой: техника, самочувствие, запас повторов."
              className="min-h-28 rounded-[1.2rem] border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="rounded-[1.3rem] border border-zinc-800 bg-black/22 p-4">
            <p className="text-sm font-semibold text-zinc-100">Что получит клиент</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Полный тренировочный день: обычные упражнения, суперсеты, режимы выполнения, подходы, веса,
              RPE, отдых и комментарии тренера. Изменения в builder после назначения не изменят уже отправленный снимок.
            </p>
          </div>
        </div>

        <SheetFooter className="border-t border-zinc-800/80 p-5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"
            onClick={onAssign}
            disabled={saving}
          >
            {saving ? "Назначаем..." : "Назначить клиенту"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TemplateSaveSheet({
  open,
  draft,
  folders,
  exerciseCount,
  blockCount,
  estimatedDuration,
  saving,
  onOpenChange,
  onDraftChange,
  onSave,
}: {
  open: boolean;
  draft: TemplateSaveDraft;
  folders: string[];
  exerciseCount: number;
  blockCount: number;
  estimatedDuration: number;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (patch: Partial<TemplateSaveDraft>) => void;
  onSave: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:max-w-[560px]">
        <SheetHeader className="border-b border-zinc-800/80 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Шаблон тренировки</p>
          <SheetTitle className="text-2xl font-semibold tracking-tight text-zinc-50">
            Сохранить в библиотеку
          </SheetTitle>
          <SheetDescription className="max-w-md text-zinc-400">
            Шаблон можно будет быстро выбрать при назначении клиенту или использовать как основу для программы.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="rounded-[1.4rem] border border-lime-300/14 bg-lime-300/7 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TemplateSummaryMetric label="Упражнения" value={String(exerciseCount)} />
              <TemplateSummaryMetric label="Сложные блоки" value={String(blockCount)} />
              <TemplateSummaryMetric label="~ длительность" value={`${estimatedDuration} мин`} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Название шаблона</Label>
            <Input
              value={draft.title}
              onChange={(event) => onDraftChange({ title: event.target.value })}
              placeholder="Например: Pull Day · спина без осевой нагрузки"
              className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Папка</Label>
            <div className="flex flex-wrap gap-2">
              {folders.map((folder) => {
                const active = draft.folder === folder;
                return (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => onDraftChange({ folder })}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      active
                        ? "border-lime-300/26 bg-lime-300/12 text-lime-50"
                        : "border-zinc-800 bg-black/22 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                    )}
                  >
                    {folder}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Тип тренировки</Label>
            <Input
              value={draft.trainingType}
              onChange={(event) => onDraftChange({ trainingType: event.target.value })}
              placeholder="Push / Pull / Full Body"
              className="h-11 rounded-2xl border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Описание для себя</Label>
            <Textarea
              value={draft.note}
              onChange={(event) => onDraftChange({ note: event.target.value })}
              placeholder="Для каких клиентов подходит, ограничения, как прогрессировать нагрузку."
              className="min-h-28 rounded-[1.2rem] border-zinc-800 bg-black/24 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="rounded-[1.3rem] border border-zinc-800 bg-black/22 p-4">
            <p className="text-sm font-semibold text-zinc-100">Что сохранится</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Название дня, тип тренировки, обычные упражнения, суперсеты, режимы выполнения, подходы по сетам,
              комментарии и тренерские подсказки. Клиентская привязка и программа не попадут в шаблон.
            </p>
          </div>
        </div>

        <SheetFooter className="border-t border-zinc-800/80 p-5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Сохраняем..." : "Сохранить шаблон"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TemplateSummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-black/22 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/22 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function SelectorBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

function CanvasMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/22 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-100" />
        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
