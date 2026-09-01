import type { ExerciseLibraryRow } from "@/lib/exercise-library";

export type TemplateStatus = "draft" | "published" | "archived";
export type PrescriptionType = "repetitions" | "duration";
export type RepetitionMode = "fixed" | "range";
export type SetKind = "warmup" | "working";

export type WorkoutPrescriptionDraft = {
  type: PrescriptionType;
  sets: string;
  repetitionMode: RepetitionMode;
  repetitionsMin: string;
  repetitionsMax: string;
  durationSec: string;
  targetWeightKg: string;
  restSec: string;
};

export type WorkoutSetOverrideDraft = {
  id: string;
  order: number;
  kind: SetKind;
  repetitionsMin: string;
  repetitionsMax: string;
  durationSec: string;
  targetWeightKg: string;
  restSec: string;
  usesOverride: boolean;
};

export type WorkoutTemplateExerciseDraft = {
  instanceId: string;
  exerciseId: string;
  title: string;
  category: string;
  equipment?: string;
  description?: string;
  imageUrl?: string;
  prescription: WorkoutPrescriptionDraft;
  perSetMode: boolean;
  setOverrides: WorkoutSetOverrideDraft[];
  trainerNote: string;
};

export type SupersetGroupDraft = {
  id: string;
  kind: "superset";
  label: string;
  instruction: string;
  exercises: WorkoutTemplateExerciseDraft[];
};

export type WorkoutTemplateItemDraft =
  | { id: string; kind: "exercise"; exercise: WorkoutTemplateExerciseDraft }
  | SupersetGroupDraft;

export type WorkoutTemplateDraft = {
  id: string;
  revisionId?: string;
  title: string;
  status: TemplateStatus;
  revision: number;
  sourceTemplateId?: string;
  sourceRevision?: number;
  description: string;
  category: string;
  estimatedDurationMin: string;
  generalInstruction: string;
  items: WorkoutTemplateItemDraft[];
  updatedLabel: string;
  usageCount: number;
};

export type WorkoutTemplateSummary = Pick<
  WorkoutTemplateDraft,
  "id" | "title" | "status" | "revision" | "description" | "category" | "updatedLabel" | "usageCount"
> & {
  exerciseCount: number;
  estimatedDurationMin: string;
  recent?: boolean;
};

export type TemplateValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  itemId?: string;
  field?: string;
};

export type TemplateValidationResult = {
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
  canPublish: boolean;
};

export type TemplatePublishReceipt = {
  templateId: string;
  title: string;
  revision: number;
  athleteId?: string;
};

export type BuilderEntryContext = {
  athleteId?: string;
  templateId?: string;
  returnTo?: string;
  transitionContext?: string;
  handoffToken?: string;
  source: "quick-assign" | "templates" | "direct";
  initialGoal?: string;
  emptyWorkspace?: boolean;
};

const defaultPrescription: WorkoutPrescriptionDraft = {
  type: "repetitions",
  sets: "3",
  repetitionMode: "range",
  repetitionsMin: "8",
  repetitionsMax: "10",
  durationSec: "45",
  targetWeightKg: "",
  restSec: "90",
};

let localId = 0;

export function createBuilderId(prefix: string) {
  localId += 1;
  return `${prefix}-${Date.now().toString(36)}-${localId.toString(36)}`;
}

export function createBlankTemplate(id = "template-new-draft"): WorkoutTemplateDraft {
  return {
    id,
    title: "Новый шаблон",
    status: "draft",
    revision: 1,
    description: "",
    category: "",
    estimatedDurationMin: "",
    generalInstruction: "",
    items: [],
    updatedLabel: "только что",
    usageCount: 0,
  };
}

export function createExerciseInstance(
  exercise: ExerciseLibraryRow,
  instanceId = createBuilderId("exercise-instance")
): WorkoutTemplateExerciseDraft {
  return {
    instanceId,
    exerciseId: exercise.id,
    title: exercise.title,
    category: exercise.muscle_group ?? "Без категории",
    equipment: exercise.equipment ?? undefined,
    description: exercise.description ?? undefined,
    imageUrl: exercise.image_url ?? undefined,
    prescription: { ...defaultPrescription },
    perSetMode: false,
    setOverrides: createSetRows(3, defaultPrescription, instanceId),
    trainerNote: "",
  };
}

export function createSetRows(
  count: number,
  prescription: WorkoutPrescriptionDraft,
  seed: string,
  existing: WorkoutSetOverrideDraft[] = []
) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: existing[index]?.id ?? `${seed}-set-${index + 1}`,
    order: index + 1,
    kind: existing[index]?.kind ?? "working",
    repetitionsMin: existing[index]?.repetitionsMin ?? prescription.repetitionsMin,
    repetitionsMax: existing[index]?.repetitionsMax ?? prescription.repetitionsMax,
    durationSec: existing[index]?.durationSec ?? prescription.durationSec,
    targetWeightKg: existing[index]?.targetWeightKg ?? prescription.targetWeightKg,
    restSec: existing[index]?.restSec ?? prescription.restSec,
    usesOverride: existing[index]?.usesOverride ?? false,
  } satisfies WorkoutSetOverrideDraft));
}

export function cloneTemplate(source: WorkoutTemplateDraft, title = `Копия — ${source.title}`): WorkoutTemplateDraft {
  const id = createBuilderId("template-copy");
  return {
    ...source,
    id,
    title,
    status: "draft",
    revision: 1,
    sourceTemplateId: source.id,
    sourceRevision: source.revision,
    updatedLabel: "только что",
    usageCount: 0,
    items: source.items.map((item, itemIndex) => cloneItem(item, `${id}-${itemIndex + 1}`)),
  };
}

export function createDraftRevision(source: WorkoutTemplateDraft): WorkoutTemplateDraft {
  const id = `${source.id}-draft-r${source.revision + 1}`;
  return {
    ...source,
    id,
    status: "draft",
    revision: source.revision + 1,
    sourceTemplateId: source.id,
    sourceRevision: source.revision,
    updatedLabel: "новая версия",
    items: source.items.map((item, itemIndex) => cloneItem(item, `${id}-${itemIndex + 1}`)),
  };
}

export function publishTemplate(draft: WorkoutTemplateDraft): WorkoutTemplateDraft {
  return { ...draft, status: "published", updatedLabel: "только что" };
}

export function summarizeTemplate(template: WorkoutTemplateDraft): WorkoutTemplateSummary {
  return {
    id: template.id,
    title: template.title,
    status: template.status,
    revision: template.revision,
    description: template.description,
    category: template.category,
    updatedLabel: template.updatedLabel,
    usageCount: template.usageCount,
    exerciseCount: getTemplateExercises(template).length,
    estimatedDurationMin: template.estimatedDurationMin || estimateDuration(template).toString(),
    recent: template.usageCount > 0,
  };
}

export function getTemplateExercises(template: WorkoutTemplateDraft) {
  return template.items.flatMap((item) => (item.kind === "exercise" ? [item.exercise] : item.exercises));
}

export function findExerciseInstance(template: WorkoutTemplateDraft, instanceId: string) {
  return getTemplateExercises(template).find((exercise) => exercise.instanceId === instanceId) ?? null;
}

export function updateExerciseInstance(
  template: WorkoutTemplateDraft,
  instanceId: string,
  updater: (exercise: WorkoutTemplateExerciseDraft) => WorkoutTemplateExerciseDraft
) {
  return {
    ...template,
    items: template.items.map((item) => {
      if (item.kind === "exercise") {
        return item.exercise.instanceId === instanceId ? { ...item, exercise: updater(item.exercise) } : item;
      }
      return {
        ...item,
        exercises: item.exercises.map((exercise) =>
          exercise.instanceId === instanceId ? updater(exercise) : exercise
        ),
      };
    }),
  };
}

export function removeExerciseInstance(template: WorkoutTemplateDraft, instanceId: string) {
  const items: WorkoutTemplateItemDraft[] = [];
  template.items.forEach((item) => {
    if (item.kind === "exercise") {
      if (item.exercise.instanceId !== instanceId) items.push(item);
      return;
    }
    const exercises = item.exercises.filter((exercise) => exercise.instanceId !== instanceId);
    if (exercises.length === 1) {
      items.push({ id: exercises[0].instanceId, kind: "exercise", exercise: exercises[0] });
    } else if (exercises.length > 1) {
      items.push({ ...item, exercises });
    }
  });
  return { ...template, items };
}

export function validateTemplate(template: WorkoutTemplateDraft): TemplateValidationResult {
  const errors: TemplateValidationIssue[] = [];
  const warnings: TemplateValidationIssue[] = [];
  const exercises = getTemplateExercises(template);

  if (!template.title.trim()) {
    errors.push({ id: "template-title", severity: "error", message: "Укажите название шаблона.", field: "template-title" });
  }
  if (exercises.length === 0) {
    errors.push({ id: "template-empty", severity: "error", message: "Добавьте минимум одно упражнение.", field: "workout-canvas" });
  }
  if (!template.description.trim()) warnings.push({ id: "description", severity: "warning", message: "Нет короткого описания." });
  if (!template.category.trim()) warnings.push({ id: "category", severity: "warning", message: "Не выбран focus или категория." });
  if (!positive(template.estimatedDurationMin)) warnings.push({ id: "duration", severity: "warning", message: "Не указана примерная длительность." });
  if (exercises.length > 10) warnings.push({ id: "long", severity: "warning", message: "В шаблоне больше 10 упражнений." });

  const sourceCounts = new Map<string, number>();
  exercises.forEach((exercise) => sourceCounts.set(exercise.exerciseId, (sourceCounts.get(exercise.exerciseId) ?? 0) + 1));
  if ([...sourceCounts.values()].some((count) => count > 1)) {
    warnings.push({ id: "duplicates", severity: "warning", message: "Одно упражнение добавлено несколько раз." });
  }

  const instanceIds = exercises.map((exercise) => exercise.instanceId);
  if (instanceIds.some((id) => !id.trim()) || new Set(instanceIds).size !== instanceIds.length) {
    errors.push({ id: "exercise-instance-ids", severity: "error", message: "Exercise instances должны иметь уникальные стабильные ID." });
  }

  const setIds = exercises.flatMap((exercise) => exercise.setOverrides.map((set) => set.id));
  if (setIds.some((id) => !id.trim()) || new Set(setIds).size !== setIds.length) {
    errors.push({ id: "set-instance-ids", severity: "error", message: "Подходы должны иметь уникальные стабильные ID." });
  }

  template.items.forEach((item) => {
    if (item.kind === "superset" && (item.exercises.length < 2 || item.exercises.length > 4)) {
      errors.push({ id: `superset-${item.id}`, severity: "error", message: "Суперсет должен содержать от 2 до 4 упражнений.", itemId: item.id });
    }
  });

  exercises.forEach((exercise) => {
    const prescription = exercise.prescription;
    if (!positive(prescription.sets)) {
      errors.push(issue(exercise, "Укажите минимум один подход."));
    }
    if (prescription.type === "duration") {
      if (!positive(prescription.durationSec)) errors.push(issue(exercise, "Длительность должна быть больше нуля."));
    } else if (prescription.repetitionMode === "fixed") {
      if (!positive(prescription.repetitionsMin)) errors.push(issue(exercise, "Количество повторений должно быть больше нуля."));
    } else {
      const min = numberValue(prescription.repetitionsMin);
      const max = numberValue(prescription.repetitionsMax);
      if (!min || !max || min > max) errors.push(issue(exercise, "Диапазон повторений задан неверно."));
    }
    if (numberValue(prescription.restSec) < 0) errors.push(issue(exercise, "Отдых не может быть отрицательным."));
    if (numberValue(prescription.targetWeightKg) < 0) errors.push(issue(exercise, "Целевой вес не может быть отрицательным."));
    if (!prescription.restSec.trim()) warnings.push({ ...issue(exercise, "Не указан отдых."), severity: "warning" });

    if (exercise.perSetMode && exercise.setOverrides.length !== Math.max(1, numberValue(prescription.sets))) {
      errors.push(issue(exercise, "Количество индивидуальных подходов не совпадает с prescription."));
    }
    if (exercise.perSetMode) {
      exercise.setOverrides.forEach((set) => {
        if (prescription.type === "duration" && !positive(set.durationSec)) {
          errors.push(issue(exercise, `Подход ${set.order}: длительность должна быть больше нуля.`));
        }
        if (prescription.type === "repetitions") {
          const min = numberValue(set.repetitionsMin);
          const max = numberValue(set.repetitionsMax);
          if (!min || !max || min > max) errors.push(issue(exercise, `Подход ${set.order}: повторения заданы неверно.`));
        }
        if (numberValue(set.restSec) < 0) errors.push(issue(exercise, `Подход ${set.order}: отдых не может быть отрицательным.`));
        if (numberValue(set.targetWeightKg) < 0) errors.push(issue(exercise, `Подход ${set.order}: вес не может быть отрицательным.`));
      });
    }
  });

  return { errors, warnings, canPublish: errors.length === 0 };
}

export function getPrescriptionSummary(exercise: WorkoutTemplateExerciseDraft) {
  const prescription = exercise.prescription;
  const sets = positive(prescription.sets) ? prescription.sets : "?";
  const target = prescription.type === "duration"
    ? `${prescription.durationSec || "?"} сек`
    : prescription.repetitionMode === "fixed"
      ? `${prescription.repetitionsMin || "?"} повт.`
      : `${prescription.repetitionsMin || "?"}–${prescription.repetitionsMax || "?"} повт.`;
  const rest = prescription.restSec ? ` · отдых ${prescription.restSec} сек` : "";
  return `${sets} × ${target}${rest}`;
}

export function estimateDuration(template: WorkoutTemplateDraft) {
  const seconds = getTemplateExercises(template).reduce((sum, exercise) => {
    const sets = Math.max(1, numberValue(exercise.prescription.sets));
    const work = exercise.prescription.type === "duration" ? Math.max(1, numberValue(exercise.prescription.durationSec)) : 45;
    return sum + sets * work + Math.max(0, sets - 1) * Math.max(0, numberValue(exercise.prescription.restSec));
  }, 0);
  return Math.max(10, Math.round(seconds / 60));
}

export function getDemoBuilderTemplates(): WorkoutTemplateDraft[] {
  const simple = template("strength-base-v3", "Силовая база", "published", 3, [
    exercise("bench", "Жим лёжа", "Грудь", "4", "6", "8", "120"),
    exercise("row", "Тяга штанги в наклоне", "Спина", "4", "8", "10", "90"),
    exercise("squat", "Присед со штангой", "Квадрицепс", "4", "6", "8", "150"),
  ], { category: "Сила", duration: "65", usageCount: 12, description: "Базовая силовая тренировка на всё тело." });

  const warmup = template("warmup-lower-draft", "Низ тела · техника", "draft", 1, [
    withWarmup(exercise("back-squat", "Присед со штангой", "Квадрицепс", "4", "5", "5", "150")),
    exercise("rdl", "Румынская тяга", "Хамстринги", "3", "8", "10", "120"),
  ], { category: "Техника", duration: "55", description: "Техника ног с разминочными подходами." });

  const overrides = template("upper-overrides-draft", "Верх · разные подходы", "draft", 2, [
    withOverrides(exercise("incline", "Жим гантелей на наклонной", "Грудь", "4", "8", "10", "90")),
    exercise("pulldown", "Тяга верхнего блока", "Спина", "3", "10", "12", "75"),
  ], { category: "Гипертрофия", duration: "50", description: "Верх тела с индивидуальными параметрами подходов." });

  const superset2 = templateWithItems("superset-push-pull", "Push / Pull суперсет", "published", 2, [
    superset("superset-a", "A · Грудь + спина", [
      exercise("chest-press", "Жим в тренажёре", "Грудь", "3", "10", "12", "60"),
      exercise("seated-row", "Горизонтальная тяга", "Спина", "3", "10", "12", "60"),
    ]),
    single(exercise("lateral", "Разведения гантелей", "Плечи", "3", "12", "15", "60")),
  ], { category: "Гипертрофия", duration: "45", description: "Чередование жима и тяги." });

  const superset4 = templateWithItems("superset-four-draft", "Финишер на 4 движения", "draft", 1, [
    superset("superset-four", "A · Финишер", [
      exercise("push-up", "Отжимания", "Грудь", "3", "12", "15", "30"),
      exercise("band-row", "Тяга резины", "Спина", "3", "15", "20", "30"),
      exercise("lunge", "Выпады назад", "Квадрицепс", "3", "10", "12", "30"),
      durationExercise("plank", "Планка", "Пресс", "3", "45", "30"),
    ]),
  ], { category: "Кондиция", duration: "30", description: "Четыре упражнения подряд, без вложенных групп." });

  const long = template("long-full-body", "Полное тело · длинная", "draft", 1,
    Array.from({ length: 11 }, (_, index) => exercise(`long-${index + 1}`, `Упражнение ${index + 1}`, index % 2 ? "Спина" : "Ноги", "3", "8", "12", "75")),
    { category: "Всё тело", duration: "95", description: "Длинный демонстрационный шаблон." });

  const invalid = template("invalid-template", "", "draft", 1, [
    { ...exercise("invalid", "Неполное упражнение", "Без категории", "0", "12", "8", "-1"), prescription: { ...defaultPrescription, sets: "0", repetitionsMin: "12", repetitionsMax: "8", restSec: "-1" } },
  ], { category: "", duration: "", description: "" });

  const archived = { ...simple, id: "archived-strength-v1", title: "Архив · Силовая база", status: "archived" as const, revision: 1, updatedLabel: "3 месяца назад", items: simple.items.map((item, index) => cloneItem(item, `archived-${index + 1}`)) };
  const revision = { ...simple, id: "strength-base-draft-r4", title: "Силовая база · revision 4", status: "draft" as const, revision: 4, sourceTemplateId: simple.id, sourceRevision: 3, updatedLabel: "сегодня", items: simple.items.map((item, index) => cloneItem(item, `revision-4-${index + 1}`)) };
  return [simple, warmup, overrides, superset2, superset4, long, revision, invalid, archived];
}

function template(id: string, title: string, status: TemplateStatus, revision: number, exercises: WorkoutTemplateExerciseDraft[], meta: { category: string; duration: string; description: string; usageCount?: number }) {
  return templateWithItems(id, title, status, revision, exercises.map(single), meta);
}

function templateWithItems(id: string, title: string, status: TemplateStatus, revision: number, items: WorkoutTemplateItemDraft[], meta: { category: string; duration: string; description: string; usageCount?: number }): WorkoutTemplateDraft {
  return { id, title, status, revision, description: meta.description, category: meta.category, estimatedDurationMin: meta.duration, generalInstruction: "Сохранять качественную технику и рабочий запас.", items, updatedLabel: status === "published" ? "2 дня назад" : status === "archived" ? "3 месяца назад" : "сегодня", usageCount: meta.usageCount ?? 0 };
}

function exercise(exerciseId: string, title: string, category: string, sets: string, min: string, max: string, rest: string): WorkoutTemplateExerciseDraft {
  const instanceId = `instance-${exerciseId}`;
  const prescription = { ...defaultPrescription, sets, repetitionsMin: min, repetitionsMax: max, restSec: rest };
  return { instanceId, exerciseId, title, category, prescription, perSetMode: false, setOverrides: createSetRows(Number(sets) || 1, prescription, instanceId), trainerNote: "" };
}

function durationExercise(exerciseId: string, title: string, category: string, sets: string, duration: string, rest: string) {
  const value = exercise(exerciseId, title, category, sets, "1", "1", rest);
  value.prescription = { ...value.prescription, type: "duration", durationSec: duration };
  value.setOverrides = createSetRows(Number(sets), value.prescription, value.instanceId);
  return value;
}

function withWarmup(value: WorkoutTemplateExerciseDraft) {
  value.perSetMode = true;
  value.setOverrides = createSetRows(Number(value.prescription.sets), value.prescription, value.instanceId).map((set, index) => ({ ...set, kind: index < 2 ? "warmup" : "working", usesOverride: index < 2, targetWeightKg: index === 0 ? "20" : index === 1 ? "40" : "70" }));
  return value;
}

function withOverrides(value: WorkoutTemplateExerciseDraft) {
  value.perSetMode = true;
  value.setOverrides = createSetRows(Number(value.prescription.sets), value.prescription, value.instanceId).map((set, index) => ({ ...set, usesOverride: index === value.setOverrides.length - 1 || index === 3, repetitionsMin: index === 3 ? "12" : set.repetitionsMin, repetitionsMax: index === 3 ? "12" : set.repetitionsMax }));
  return value;
}

function single(exercise: WorkoutTemplateExerciseDraft): WorkoutTemplateItemDraft {
  return { id: exercise.instanceId, kind: "exercise", exercise };
}

function superset(id: string, label: string, exercises: WorkoutTemplateExerciseDraft[]): SupersetGroupDraft {
  return { id, kind: "superset", label, instruction: "Выполнить последовательно, отдых после последнего упражнения.", exercises };
}

function cloneItem(item: WorkoutTemplateItemDraft, seed: string): WorkoutTemplateItemDraft {
  if (item.kind === "exercise") return single(cloneExercise(item.exercise, `${seed}-exercise`));
  return { ...item, id: `${seed}-superset`, exercises: item.exercises.map((exercise, index) => cloneExercise(exercise, `${seed}-exercise-${index + 1}`)) };
}

function cloneExercise(exercise: WorkoutTemplateExerciseDraft, instanceId: string): WorkoutTemplateExerciseDraft {
  return { ...exercise, instanceId, prescription: { ...exercise.prescription }, setOverrides: exercise.setOverrides.map((set, index) => ({ ...set, id: `${instanceId}-set-${index + 1}` })) };
}

function issue(exercise: WorkoutTemplateExerciseDraft, message: string): TemplateValidationIssue {
  return { id: `${exercise.instanceId}-${message}`, severity: "error", message: `${exercise.title}: ${message}`, itemId: exercise.instanceId };
}

function numberValue(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value: string) {
  return numberValue(value) > 0;
}
