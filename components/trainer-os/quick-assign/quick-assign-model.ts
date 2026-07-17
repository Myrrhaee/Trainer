import { getAthleteProfile } from "@/components/trainer-os/client-profile/mock-data";
import { trainerHomeClients } from "@/components/trainer-os/home/mock-data";

export type QuickAssignSource = "dashboard" | "profile" | "review" | "clients" | "direct";
export type WorkoutTemplateState = "published" | "draft" | "archived";
export type TemplateGroup = "suitable" | "recent" | "all";

export type QuickAssignEntryContext = {
  source: QuickAssignSource;
  reason?: string;
  attentionItemId?: string;
  reviewSessionId?: string;
  returnTo?: string;
};

export type QuickAssignAthlete = {
  id: string;
  displayName: string;
  initials: string;
  goal?: string;
  status: string;
  state: "active" | "needs_assignment" | "after_review" | "calm" | "paused";
};

export type WorkoutTemplateExercise = {
  id: string;
  title: string;
  sets: number;
  repetitions: number;
  targetWeightKg?: number;
};

export type WorkoutTemplateListItem = {
  id: string;
  revision: number;
  title: string;
  description: string;
  category: string;
  focus: string[];
  durationMin: number;
  state: WorkoutTemplateState;
  lastUsed?: string;
  recent?: boolean;
  favourite?: boolean;
  instruction: string;
  hasSupersets: boolean;
  exercises: WorkoutTemplateExercise[];
};

export type AssignmentSummary = {
  id: string;
  templateId: string;
  title: string;
  scheduledDate: string;
};

export type ExerciseAssignmentOverride = {
  sets?: number;
  repetitions?: number;
  targetWeightKg?: number;
};

export type WorkoutAssignmentDraft = {
  athleteId: string;
  templateId: string | null;
  scheduledDate: string;
  trainerNote: string;
  generalInstruction: string;
  exerciseOverrides: Record<string, ExerciseAssignmentOverride>;
  conflictAccepted: boolean;
};

export type AssignmentReceipt = {
  id: string;
  athleteId: string;
  athleteName: string;
  templateId: string;
  templateTitle: string;
  scheduledDate: string;
  sourceTemplateRevision: number;
  snapshotExercises: Array<WorkoutTemplateExercise & { override?: ExerciseAssignmentOverride }>;
  overrideCount: number;
  trainerNote?: string;
  generalInstruction?: string;
  createdContext: QuickAssignEntryContext;
};

export type QuickAssignView = {
  athlete: QuickAssignAthlete;
  context: QuickAssignEntryContext;
  templates: WorkoutTemplateListItem[];
  recentAssignments: AssignmentSummary[];
  constraints: {
    assignmentAllowed: boolean;
    reason?: string;
  };
};

const workoutTemplates: WorkoutTemplateListItem[] = [
  {
    id: "pull-day-v3",
    revision: 3,
    title: "День тяги",
    description: "Рабочий объём для спины и задней цепи без тяжёлого жима.",
    category: "Гипертрофия",
    focus: ["Спина", "Бицепс"],
    durationMin: 55,
    state: "published",
    lastUsed: "3 дня назад",
    recent: true,
    favourite: true,
    instruction: "Сохранять 2 повтора в запасе в рабочих подходах.",
    hasSupersets: true,
    exercises: [
      { id: "deadlift", title: "Становая тяга", sets: 4, repetitions: 5, targetWeightKg: 120 },
      { id: "lat-pulldown", title: "Тяга верхнего блока", sets: 4, repetitions: 10, targetWeightKg: 70 },
      { id: "row", title: "Тяга гантели", sets: 3, repetitions: 10, targetWeightKg: 32 },
      { id: "curl", title: "Сгибание рук", sets: 3, repetitions: 12, targetWeightKg: 14 },
    ],
  },
  {
    id: "upper-light-v2",
    revision: 2,
    title: "Лёгкий верх",
    description: "Спокойная тренировка верха после тяжёлого дня или разбора.",
    category: "Восстановление",
    focus: ["Верх тела", "Техника"],
    durationMin: 45,
    state: "published",
    lastUsed: "Неделю назад",
    recent: true,
    instruction: "Не превышать RPE 7 и остановить подход при дискомфорте.",
    hasSupersets: false,
    exercises: [
      { id: "incline-press", title: "Жим гантелей на наклонной", sets: 3, repetitions: 10, targetWeightKg: 22 },
      { id: "cable-row", title: "Горизонтальная тяга", sets: 3, repetitions: 12, targetWeightKg: 55 },
      { id: "lateral-raise", title: "Разведения гантелей", sets: 3, repetitions: 15, targetWeightKg: 8 },
    ],
  },
  {
    id: "full-body-b-v4",
    revision: 4,
    title: "Полное тело B",
    description: "Универсальный силовой день с умеренным объёмом.",
    category: "Рекомпозиция",
    focus: ["Всё тело", "Сила"],
    durationMin: 60,
    state: "published",
    lastUsed: "2 недели назад",
    favourite: true,
    instruction: "Работать ровно, без отказных подходов.",
    hasSupersets: false,
    exercises: [
      { id: "goblet-squat", title: "Гоблет-присед", sets: 4, repetitions: 10, targetWeightKg: 28 },
      { id: "bench-press", title: "Жим лёжа", sets: 4, repetitions: 6, targetWeightKg: 75 },
      { id: "romanian-deadlift", title: "Румынская тяга", sets: 3, repetitions: 8, targetWeightKg: 70 },
      { id: "plank", title: "Планка", sets: 3, repetitions: 45 },
    ],
  },
  {
    id: "lower-technique-v1",
    revision: 1,
    title: "Низ тела: техника",
    description: "Контрольная тренировка ног с акцентом на качество движения.",
    category: "Сила",
    focus: ["Ноги", "Техника"],
    durationMin: 50,
    state: "published",
    lastUsed: "Месяц назад",
    instruction: "Снимать последний рабочий подход сбоку.",
    hasSupersets: false,
    exercises: [
      { id: "back-squat", title: "Присед со штангой", sets: 5, repetitions: 5, targetWeightKg: 85 },
      { id: "split-squat", title: "Болгарский сплит-присед", sets: 3, repetitions: 10, targetWeightKg: 18 },
      { id: "leg-curl", title: "Сгибание ног", sets: 3, repetitions: 12, targetWeightKg: 40 },
    ],
  },
  {
    id: "conditioning-draft-v1",
    revision: 1,
    title: "Кондиция 30",
    description: "Черновик короткой интервальной тренировки.",
    category: "Выносливость",
    focus: ["Кондиция"],
    durationMin: 30,
    state: "draft",
    instruction: "Черновик ещё не опубликован.",
    hasSupersets: false,
    exercises: [{ id: "bike", title: "Велотренажёр", sets: 8, repetitions: 1 }],
  },
  {
    id: "legacy-push-v1",
    revision: 1,
    title: "Старый жимовой день",
    description: "Архивная версия, сохранённая для истории.",
    category: "Гипертрофия",
    focus: ["Грудь"],
    durationMin: 65,
    state: "archived",
    instruction: "Архивный шаблон.",
    hasSupersets: false,
    exercises: [{ id: "old-bench", title: "Жим лёжа", sets: 5, repetitions: 5, targetWeightKg: 80 }],
  },
];

const athleteTemplateAccess: Record<string, string[] | undefined> = {
  "alexandra-konstantinova": [],
};

export function buildQuickAssignView(
  athleteId: string | null,
  context: QuickAssignEntryContext,
  today: string
): QuickAssignView | null {
  if (!athleteId) return null;

  const athlete = getQuickAssignAthlete(athleteId);
  if (!athlete) return null;

  const allowedTemplateIds = athleteTemplateAccess[athleteId];
  const templates = allowedTemplateIds
    ? workoutTemplates.filter((template) => allowedTemplateIds.includes(template.id))
    : workoutTemplates;

  return {
    athlete,
    context,
    templates,
    recentAssignments: getRecentAssignments(athleteId, today),
    constraints:
      athlete.state === "paused"
        ? {
            assignmentAllowed: false,
            reason: "Ведение спортсмена приостановлено. Откройте профиль и проверьте статус доступа перед новым назначением.",
          }
        : { assignmentAllowed: true },
  };
}

export function isTemplateSuitable(template: WorkoutTemplateListItem, athlete: QuickAssignAthlete) {
  const goal = athlete.goal?.toLocaleLowerCase("ru") ?? "";
  const searchText = [template.category, ...template.focus].join(" ").toLocaleLowerCase("ru");
  const matches = [
    ["мас", "гипертроф"],
    ["сил", "сил"],
    ["суш", "рекомп"],
    ["вес", "рекомп"],
    ["пауз", "восстанов"],
    ["тонус", "всё тело"],
  ];

  return matches.some(([goalToken, templateToken]) => goal.includes(goalToken) && searchText.includes(templateToken));
}

export function createAssignmentReceipt(
  view: QuickAssignView,
  draft: WorkoutAssignmentDraft,
  template: WorkoutTemplateListItem
): AssignmentReceipt {
  const snapshotExercises = template.exercises.map((exercise) => ({
    ...exercise,
    override: draft.exerciseOverrides[exercise.id],
  }));

  return {
    id: `demo-assignment-${view.athlete.id}-${template.id}-${draft.scheduledDate}`,
    athleteId: view.athlete.id,
    athleteName: view.athlete.displayName,
    templateId: template.id,
    templateTitle: template.title,
    scheduledDate: draft.scheduledDate,
    sourceTemplateRevision: template.revision,
    snapshotExercises,
    overrideCount: Object.keys(draft.exerciseOverrides).length,
    trainerNote: draft.trainerNote.trim() || undefined,
    generalInstruction: draft.generalInstruction.trim() || undefined,
    createdContext: view.context,
  };
}

export function getBuilderHref(view: QuickAssignView, templateId?: string) {
  const params = new URLSearchParams({
    clientId: view.athlete.id,
    from: "quick-assign",
    source: view.context.source,
  });

  if (templateId) params.set("templateId", templateId);
  if (isSafeTrainerPath(view.context.returnTo)) params.set("returnTo", view.context.returnTo);
  return `/trainer/builder?${params.toString()}`;
}

function getQuickAssignAthlete(athleteId: string): QuickAssignAthlete | null {
  const profile = getAthleteProfile(athleteId);
  const teamClient = trainerHomeClients.find((client) => client.id === athleteId);

  if (profile) {
    const paused = profile.membership.status === "paused";
    return {
      id: profile.id,
      displayName: profile.name,
      initials: profile.initials,
      goal: profile.goal,
      status: paused ? "На паузе" : profile.status,
      state: paused
        ? "paused"
        : teamClient?.state === "waiting_review"
          ? "after_review"
          : teamClient?.state === "no_next_workout"
            ? "needs_assignment"
            : "calm",
    };
  }

  if (!teamClient) return null;

  return {
    id: teamClient.id,
    displayName: teamClient.name,
    initials: teamClient.initials,
    goal: teamClient.goal,
    status: teamClient.stateLabel,
    state:
      teamClient.state === "inactive"
        ? "paused"
        : teamClient.state === "waiting_review"
          ? "after_review"
          : teamClient.state === "no_next_workout"
            ? "needs_assignment"
            : teamClient.state === "on_track"
              ? "calm"
              : "active",
  };
}

function getRecentAssignments(athleteId: string, today: string): AssignmentSummary[] {
  const date = (offset: number) => addDays(today, offset);
  if (athleteId === "maria-volkova") {
    return [{ id: "assignment-maria-lower", templateId: "lower-technique-v1", title: "Низ тела: техника", scheduledDate: date(2) }];
  }
  if (athleteId === "artem-smirnov") {
    return [{ id: "assignment-artem-review", templateId: "upper-light-v2", title: "Лёгкий верх", scheduledDate: date(1) }];
  }
  return [];
}

function addDays(isoDate: string, offset: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function isSafeTrainerPath(value?: string): value is string {
  return Boolean(value && value.startsWith("/trainer/") && !value.startsWith("//"));
}
