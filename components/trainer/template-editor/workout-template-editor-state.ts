import type {
  WorkoutTemplateEditorExercise,
  WorkoutTemplateEditorIssue,
  WorkoutTemplateEditorReadModel,
} from "@/lib/workout-template-editor-contract";
import type { ExerciseSelectionSnapshot } from "@/lib/exercise-library-contract";

export type EditorSaveState = "pristine" | "dirty" | "saved";
export type EditorCommandOperation = "save_draft" | "publish" | "save_as_new" | "create_revision";
export type EditorCommandPhase = "idle" | "running" | "outcome_unknown" | "failed" | "conflict";

export type EditorSetDraft = {
  templateSetId: string | null;
  setKey: string;
  position: number;
  kind: "warmup" | "working";
  repetitionsMin: string;
  repetitionsMax: string;
  durationSec: string;
  targetWeightKg: string;
  restSec: string;
  usesOverride: boolean;
};

export type EditorExerciseDraft = {
  templateExerciseId: string | null;
  instanceKey: string;
  sourceExerciseId: string | null;
  sourceExerciseKey: string;
  position: number;
  title: string;
  description: string;
  category: string;
  equipment: string;
  imageUrl: string;
  prescriptionType: "repetitions" | "duration";
  repetitionMode: "fixed" | "range";
  setCount: string;
  repetitionsMin: string;
  repetitionsMax: string;
  durationSec: string;
  targetWeightKg: string;
  restSec: string;
  trainerNote: string;
  perSetMode: boolean;
  sets: EditorSetDraft[];
  supersetKey: string | null;
  supersetPosition: number | null;
  supersetLabel: string;
  supersetInstruction: string;
  sourceAvailability: WorkoutTemplateEditorExercise["source"]["availability"];
};

export type EditorDraftContent = {
  title: string;
  description: string;
  category: string;
  generalInstruction: string;
  estimatedDurationMin: string;
  exercises: EditorExerciseDraft[];
};

type EditorCommandAttemptBase = {
  operation: EditorCommandOperation;
  commandId: string;
  templateId: string;
  revisionId: string | null;
  expectedToken: string | null;
  fingerprint: string;
  startedAt: number;
  resultState: Exclude<EditorCommandPhase, "idle">;
};

export type SaveDraftAttempt = EditorCommandAttemptBase & {
  operation: "save_draft";
  revisionId: string;
  frozenContent: EditorDraftContent;
  frozenPayload: ReturnType<typeof toCommandContent>;
  exitTo: string | null;
};

export type SaveAsNewAttempt = EditorCommandAttemptBase & {
  operation: "save_as_new";
  revisionId: string;
  frozenContent: EditorDraftContent;
  frozenPayload: ReturnType<typeof toCommandContent>;
};

export type PublishAttempt = EditorCommandAttemptBase & {
  operation: "publish";
  revisionId: string;
  previousPublishedRevisionId: string | null;
};

export type CreateRevisionAttempt = EditorCommandAttemptBase & {
  operation: "create_revision";
  sourceRevisionId: string;
};

export type EditorCommandAttempt = SaveDraftAttempt | SaveAsNewAttempt | PublishAttempt | CreateRevisionAttempt;

export type EditorCommandState = {
  phase: EditorCommandPhase;
  attempt: EditorCommandAttempt | null;
  errorCode: string | null;
};

export type EditorCommandAction =
  | { type: "begin"; attempt: EditorCommandAttempt }
  | { type: "outcome_unknown" }
  | { type: "failed"; errorCode?: string | null }
  | { type: "conflict"; errorCode?: string | null }
  | { type: "clear" };

export const initialEditorCommandState: EditorCommandState = { phase: "idle", attempt: null, errorCode: null };

export function editorCommandReducer(state: EditorCommandState, action: EditorCommandAction): EditorCommandState {
  if (action.type === "begin") return { phase: "running", attempt: { ...action.attempt, resultState: "running" }, errorCode: null };
  if (action.type === "clear") return initialEditorCommandState;
  if (!state.attempt) return state;
  if (action.type === "outcome_unknown") return { phase: "outcome_unknown", attempt: { ...state.attempt, resultState: "outcome_unknown" }, errorCode: null };
  if (action.type === "failed") return { phase: "failed", attempt: { ...state.attempt, resultState: "failed" }, errorCode: action.errorCode ?? null };
  return { phase: "conflict", attempt: { ...state.attempt, resultState: "conflict" }, errorCode: action.errorCode ?? null };
}

export function commandLocksEditor(state: EditorCommandState) {
  return state.phase === "running" || state.phase === "outcome_unknown" || state.phase === "conflict";
}

export function commandStartedAt() {
  return Date.now();
}

export type EditorUndoEntry = {
  message: string;
  content: EditorDraftContent;
};

export function draftFromEditorModel(model: WorkoutTemplateEditorReadModel): EditorDraftContent {
  return normalizeDraft({
    title: model.content.title,
    description: model.content.description,
    category: model.content.category,
    generalInstruction: model.content.generalInstruction,
    estimatedDurationMin: nullableNumber(model.content.estimatedDurationMin),
    exercises: model.content.exercises.map(exerciseFromModel),
  });
}

function exerciseFromModel(exercise: WorkoutTemplateEditorExercise): EditorExerciseDraft {
  return {
    templateExerciseId: exercise.templateExerciseId,
    instanceKey: exercise.instanceKey,
    sourceExerciseId: exercise.sourceExerciseId,
    sourceExerciseKey: exercise.sourceExerciseKey,
    position: exercise.position,
    title: exercise.snapshot.title,
    description: exercise.snapshot.description ?? "",
    category: exercise.snapshot.category,
    equipment: exercise.snapshot.equipment ?? "",
    imageUrl: exercise.snapshot.imageUrl ?? "",
    prescriptionType: exercise.prescription.type,
    repetitionMode: exercise.prescription.repetitionMode,
    setCount: nullableNumber(exercise.prescription.setCount),
    repetitionsMin: nullableNumber(exercise.prescription.repetitionsMin),
    repetitionsMax: nullableNumber(exercise.prescription.repetitionsMax),
    durationSec: nullableNumber(exercise.prescription.durationSeconds),
    targetWeightKg: nullableNumber(exercise.prescription.targetWeightKg),
    restSec: nullableNumber(exercise.prescription.restSeconds),
    trainerNote: exercise.trainerNote,
    perSetMode: exercise.perSetMode,
    sets: exercise.sets.map((set) => ({
      templateSetId: set.templateSetId,
      setKey: set.setKey,
      position: set.position,
      kind: set.kind,
      repetitionsMin: nullableNumber(set.repetitionsMin),
      repetitionsMax: nullableNumber(set.repetitionsMax),
      durationSec: nullableNumber(set.durationSeconds),
      targetWeightKg: nullableNumber(set.targetWeightKg),
      restSec: nullableNumber(set.restSeconds),
      usesOverride: set.usesOverride,
    })),
    supersetKey: exercise.superset?.supersetKey ?? null,
    supersetPosition: exercise.superset?.supersetPosition ?? null,
    supersetLabel: exercise.superset?.label ?? "",
    supersetInstruction: exercise.superset?.instruction ?? "",
    sourceAvailability: exercise.source.availability,
  };
}

export function newExerciseDraft(snapshot: ExerciseSelectionSnapshot): EditorExerciseDraft {
  return {
    templateExerciseId: null,
    instanceKey: crypto.randomUUID(),
    sourceExerciseId: snapshot.sourceExerciseId,
    sourceExerciseKey: snapshot.sourceExerciseKey,
    position: 1,
    title: snapshot.title,
    description: snapshot.description ?? "",
    category: snapshot.category,
    equipment: snapshot.equipment ?? "",
    imageUrl: snapshot.imageUrl ?? "",
    prescriptionType: "repetitions",
    repetitionMode: "fixed",
    setCount: "",
    repetitionsMin: "",
    repetitionsMax: "",
    durationSec: "",
    targetWeightKg: "",
    restSec: "",
    trainerNote: "",
    perSetMode: false,
    sets: [],
    supersetKey: null,
    supersetPosition: null,
    supersetLabel: "",
    supersetInstruction: "",
    sourceAvailability: "ready",
  };
}

export function normalizeDraft(content: EditorDraftContent): EditorDraftContent {
  return {
    ...content,
    exercises: content.exercises.map((exercise, index) => ({
      ...exercise,
      position: index + 1,
      sets: exercise.sets.map((set, setIndex) => ({ ...set, position: setIndex + 1 })),
    })),
  };
}

export type EditorSequenceItem = {
  key: string;
  kind: "exercise" | "superset";
  instanceKeys: string[];
};

export function editorSequence(exercises: EditorExerciseDraft[]): EditorSequenceItem[] {
  const emittedGroups = new Set<string>();
  const sourceIndex = new Map(exercises.map((exercise, index) => [exercise.instanceKey, index]));
  const sequence: EditorSequenceItem[] = [];
  for (const exercise of exercises) {
    if (!exercise.supersetKey) {
      sequence.push({ key: `exercise:${exercise.instanceKey}`, kind: "exercise", instanceKeys: [exercise.instanceKey] });
      continue;
    }
    if (emittedGroups.has(exercise.supersetKey)) continue;
    emittedGroups.add(exercise.supersetKey);
    const members = exercises
      .filter((candidate) => candidate.supersetKey === exercise.supersetKey)
      .sort((left, right) => {
        const position = (left.supersetPosition ?? Number.MAX_SAFE_INTEGER) - (right.supersetPosition ?? Number.MAX_SAFE_INTEGER);
        return position || (sourceIndex.get(left.instanceKey) ?? 0) - (sourceIndex.get(right.instanceKey) ?? 0);
      });
    sequence.push({
      key: `superset:${exercise.supersetKey}`,
      kind: "superset",
      instanceKeys: members.map((member) => member.instanceKey),
    });
  }
  return sequence;
}

export function normalizeEditorSequence(exercises: EditorExerciseDraft[]) {
  return flattenEditorSequence(exercises, editorSequence(exercises));
}

export function moveEditorSequenceItem(exercises: EditorExerciseDraft[], instanceKey: string, direction: -1 | 1) {
  const sequence = editorSequence(exercises);
  const index = sequence.findIndex((item) => item.instanceKeys.includes(instanceKey));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sequence.length) return normalizeEditorSequence(exercises);
  const next = [...sequence];
  [next[index], next[target]] = [next[target], next[index]];
  return flattenEditorSequence(exercises, next);
}

export function moveSupersetMember(exercises: EditorExerciseDraft[], instanceKey: string, direction: -1 | 1) {
  const sequence = editorSequence(exercises);
  const group = sequence.find((item) => item.kind === "superset" && item.instanceKeys.includes(instanceKey));
  if (!group) return normalizeEditorSequence(exercises);
  const index = group.instanceKeys.indexOf(instanceKey);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= group.instanceKeys.length) return normalizeEditorSequence(exercises);
  const members = [...group.instanceKeys];
  [members[index], members[target]] = [members[target], members[index]];
  return flattenEditorSequence(exercises, sequence.map((item) => item.key === group.key ? { ...item, instanceKeys: members } : item));
}

function flattenEditorSequence(exercises: EditorExerciseDraft[], sequence: EditorSequenceItem[]) {
  const byInstance = new Map(exercises.map((exercise) => [exercise.instanceKey, exercise]));
  const flattened: EditorExerciseDraft[] = [];
  for (const item of sequence) {
    item.instanceKeys.forEach((instanceKey, memberIndex) => {
      const exercise = byInstance.get(instanceKey);
      if (!exercise) return;
      flattened.push({
        ...exercise,
        position: flattened.length + 1,
        supersetPosition: item.kind === "superset" ? memberIndex + 1 : null,
      });
    });
  }
  return flattened;
}

export function semanticDraft(content: EditorDraftContent) {
  return JSON.stringify(toCommandContent(normalizeDraft(content)));
}

export function draftsEqual(left: EditorDraftContent, right: EditorDraftContent) {
  return semanticDraft(left) === semanticDraft(right);
}

export function toCommandContent(content: EditorDraftContent, revision = 1) {
  const normalized = normalizeDraft(content);
  const emittedGroups = new Set<string>();
  const items: Array<Record<string, unknown>> = [];
  for (const exercise of normalized.exercises) {
    if (exercise.supersetKey) {
      if (emittedGroups.has(exercise.supersetKey)) continue;
      emittedGroups.add(exercise.supersetKey);
      const members = normalized.exercises
        .filter((candidate) => candidate.supersetKey === exercise.supersetKey)
        .sort((left, right) => (left.supersetPosition ?? 0) - (right.supersetPosition ?? 0));
      items.push({
        id: exercise.supersetKey,
        kind: "superset",
        label: exercise.supersetLabel,
        instruction: exercise.supersetInstruction,
        exercises: members.map(commandExercise),
      });
    } else {
      items.push({ id: `row-${exercise.instanceKey}`, kind: "exercise", exercise: commandExercise(exercise) });
    }
  }
  return {
    title: normalized.title,
    revision,
    description: normalized.description,
    category: normalized.category,
    estimatedDurationMin: normalized.estimatedDurationMin,
    generalInstruction: normalized.generalInstruction,
    items,
  };
}

function commandExercise(exercise: EditorExerciseDraft) {
  return {
    instanceId: exercise.instanceKey,
    exerciseId: exercise.sourceExerciseKey,
    ...(exercise.sourceExerciseId ? { sourceExerciseId: exercise.sourceExerciseId } : {}),
    title: exercise.title,
    category: exercise.category,
    ...(exercise.equipment ? { equipment: exercise.equipment } : {}),
    ...(exercise.description ? { description: exercise.description } : {}),
    ...(exercise.imageUrl ? { imageUrl: exercise.imageUrl } : {}),
    prescription: {
      type: exercise.prescriptionType,
      sets: exercise.setCount,
      repetitionMode: exercise.repetitionMode,
      repetitionsMin: exercise.repetitionsMin,
      repetitionsMax: exercise.repetitionsMax,
      durationSec: exercise.durationSec,
      targetWeightKg: exercise.targetWeightKg,
      restSec: exercise.restSec,
    },
    perSetMode: exercise.perSetMode,
    setOverrides: exercise.sets.map((set) => ({
      id: set.setKey,
      order: set.position,
      kind: set.kind,
      repetitionsMin: set.repetitionsMin,
      repetitionsMax: set.repetitionsMax,
      durationSec: set.durationSec,
      targetWeightKg: set.targetWeightKg,
      restSec: set.restSec,
      usesOverride: set.usesOverride,
    })),
    trainerNote: exercise.trainerNote,
  };
}

export function localPublicationIssues(content: EditorDraftContent): WorkoutTemplateEditorIssue[] {
  const issues: WorkoutTemplateEditorIssue[] = [];
  const add = (path: string, code: string) => issues.push({
    severity: "publication_blocker",
    code,
    path,
    instanceKey: path.startsWith("exercises.") ? path.split(".")[1] ?? null : null,
    setKey: path.includes(".sets.") ? path.split(".sets.")[1]?.split(".")[0] ?? null : null,
    supersetKey: path.startsWith("supersets.") ? path.split(".")[1] ?? null : null,
    messageData: { code },
  });
  if (!content.title.trim()) add("template.title", "required");
  if (!content.exercises.length) add("template.exercises", "required");
  for (const exercise of content.exercises) {
    const base = `exercises.${exercise.instanceKey}`;
    if (!exercise.setCount) add(`${base}.prescription.sets`, "required");
    if (!exercise.restSec) add(`${base}.prescription.restSec`, "required");
    if (exercise.prescriptionType === "duration") {
      if (!exercise.durationSec) add(`${base}.prescription.durationSec`, "required");
    } else if (!exercise.repetitionsMin || !exercise.repetitionsMax) {
      add(`${base}.prescription.repetitions`, "required");
    }
    if (exercise.perSetMode && exercise.sets.length !== Number(exercise.setCount || 0)) add(`${base}.sets`, "set_count_mismatch");
    for (const set of exercise.sets) {
      if (!set.restSec) add(`${base}.sets.${set.setKey}.restSec`, "required");
      if (exercise.prescriptionType === "duration" ? !set.durationSec : (!set.repetitionsMin || !set.repetitionsMax)) {
        add(`${base}.sets.${set.setKey}.${exercise.prescriptionType === "duration" ? "durationSec" : "repetitions"}`, "required");
      }
    }
  }
  const groups = new Map<string, EditorExerciseDraft[]>();
  content.exercises.forEach((exercise) => {
    if (exercise.supersetKey) groups.set(exercise.supersetKey, [...(groups.get(exercise.supersetKey) ?? []), exercise]);
  });
  for (const [key, members] of groups) if (members.length < 2 || members.length > 4) add(`supersets.${key}.members`, "invalid_superset");
  return issues;
}

export function createPerSetRows(exercise: EditorExerciseDraft): EditorSetDraft[] {
  const count = Math.max(0, Math.min(20, Number(exercise.setCount || 0)));
  return Array.from({ length: count }, (_, index) => ({
    templateSetId: null,
    setKey: crypto.randomUUID(),
    position: index + 1,
    kind: "working",
    repetitionsMin: exercise.repetitionsMin,
    repetitionsMax: exercise.repetitionsMax,
    durationSec: exercise.durationSec,
    targetWeightKg: exercise.targetWeightKg,
    restSec: exercise.restSec,
    usesOverride: false,
  }));
}

export function issueLabel(issue: WorkoutTemplateEditorIssue) {
  const labels: Record<string, string> = {
    required: "Заполните обязательное поле",
    invalid_superset: "В суперсете должно быть от 2 до 4 упражнений",
    set_count_mismatch: "Количество подходов не совпадает",
    invalid_order: "Проверьте порядок элементов",
    source_not_mapped: "Источник упражнения больше не связан с библиотекой",
    source_unavailable: "Источник упражнения недоступен",
    image_unavailable: "Изображение упражнения недоступно",
    source_archived: "Упражнение перемещено в архив библиотеки",
  };
  return labels[issue.code] ?? "Проверьте данные";
}

export type EditorIssueFocusTarget = {
  id: string;
  instanceKey: string | null;
  supersetKey: string | null;
};

export function editorExerciseFieldId(instanceKey: string, field: string) {
  return `exercise-field:${instanceKey}:${field}`;
}

export function editorSetFieldId(instanceKey: string, setKey: string, field: string) {
  return `exercise-set-field:${instanceKey}:${setKey}:${field}`;
}

export function editorSupersetTargetId(supersetKey: string) {
  return `superset-target:${supersetKey}`;
}

export function editorIssueFocusTarget(issue: WorkoutTemplateEditorIssue): EditorIssueFocusTarget {
  if (issue.path === "template.title") return { id: "template-title", instanceKey: null, supersetKey: null };
  if (issue.supersetKey) return {
    id: editorSupersetTargetId(issue.supersetKey),
    instanceKey: issue.instanceKey,
    supersetKey: issue.supersetKey,
  };
  if (!issue.instanceKey) return { id: "template-composition-heading", instanceKey: null, supersetKey: null };
  const field = issueField(issue.path);
  if (issue.setKey) return {
    id: editorSetFieldId(issue.instanceKey, issue.setKey, field === "repetitionsMax" ? "repetitionsMin" : field),
    instanceKey: issue.instanceKey,
    supersetKey: null,
  };
  return {
    id: editorExerciseFieldId(issue.instanceKey, field),
    instanceKey: issue.instanceKey,
    supersetKey: null,
  };
}

export function failedCommandLabel(operation?: EditorCommandOperation) {
  if (operation === "publish") return "Не удалось опубликовать";
  if (operation === "save_as_new") return "Не удалось создать копию";
  if (operation === "create_revision") return "Не удалось создать версию";
  return "Не удалось сохранить";
}

function issueField(path: string) {
  if (path.endsWith(".restSec")) return "restSec";
  if (path.endsWith(".durationSec")) return "durationSec";
  if (path.endsWith(".targetWeightKg")) return "targetWeightKg";
  if (path.endsWith(".repetitions") || path.endsWith(".repetitionsMin")) return "repetitionsMin";
  if (path.endsWith(".repetitionsMax")) return "repetitionsMax";
  if (path.endsWith(".sets") || path.includes(".prescription.sets")) return "setCount";
  if (path.includes(".sets.")) return "row";
  return "disclosure";
}

function nullableNumber(value: number | null) {
  return value === null ? "" : String(value);
}
