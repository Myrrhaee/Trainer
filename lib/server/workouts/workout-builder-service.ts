import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { WorkoutBuilderRepository } from "@/lib/server/workouts/workout-builder-repository";
import { workoutTemplateRequestFingerprint } from "@/lib/server/workouts/workout-template-command-crypto";
import type {
  ArchiveTemplateCommandInput,
  BuilderExercise,
  BuilderItem,
  BuilderSet,
  CreateRevisionCommandInput,
  DuplicateTemplateCommandInput,
  PublishRevisionCommandInput,
  SaveBuilderTemplateInput,
  SaveDraftCommandInput,
  WorkoutBuilderValidationIssue,
} from "@/lib/server/workouts/workout-builder-types";

export class WorkoutBuilderValidationError extends Error {
  constructor(
    public readonly validationCode: "draft_validation_failed" | "payload_too_large",
    public readonly issues: WorkoutBuilderValidationIssue[] = [],
  ) {
    super(validationCode);
  }
}

function issue(path: string, code: string): never {
  throw new WorkoutBuilderValidationError("draft_validation_failed", [{ path, code }]);
}

function object(value: unknown, path = "request") {
  if (!value || typeof value !== "object" || Array.isArray(value)) issue(path, "invalid_object");
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, path: string, required = false) {
  if (typeof value !== "string") issue(path, "invalid_text");
  const result = value.trim();
  if ((required && !result) || result.length > max) issue(path, required && !result ? "required" : "too_long");
  return result;
}

function optionalText(value: unknown, max: number, path: string) {
  if (value === undefined || value === null || value === "") return "";
  return text(value, max, path);
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) issue(path, "invalid_option");
  return value as T;
}

function numericText(value: unknown, min: number, max: number, path: string) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" && typeof value !== "number") issue(path, "invalid_number");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) issue(path, "invalid_number");
  return String(parsed);
}

function semanticId(value: unknown, path: string) {
  return text(value, 160, path, true);
}

function uuid(value: unknown, path: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    issue(path, "invalid_id");
  }
  return value;
}

function commandId(value: unknown) {
  return uuid(value, "commandId");
}

function setInput(value: unknown, expectedOrder: number, type: "repetitions" | "duration", exerciseKey: string): BuilderSet {
  const row = object(value, `exercises.${exerciseKey}.sets`);
  const setKey = semanticId(row.id, `exercises.${exerciseKey}.sets.identity`);
  const path = `exercises.${exerciseKey}.sets.${setKey}`;
  const order = Number(row.order);
  if (!Number.isInteger(order) || order !== expectedOrder) issue(path, "invalid_order");
  const repetitionsMin = type === "repetitions" ? numericText(row.repetitionsMin, 1, 500, `${path}.repetitionsMin`) : "";
  const repetitionsMax = type === "repetitions" ? numericText(row.repetitionsMax, 1, 500, `${path}.repetitionsMax`) : "";
  if (repetitionsMin && repetitionsMax && Number(repetitionsMax) < Number(repetitionsMin)) {
    issue(`${path}.repetitions`, "invalid_range");
  }
  return {
    id: setKey,
    order,
    kind: oneOf(row.kind, ["warmup", "working"] as const, `${path}.kind`),
    repetitionsMin,
    repetitionsMax,
    durationSec: type === "duration" ? numericText(row.durationSec, 1, 86400, `${path}.durationSec`) : "",
    targetWeightKg: numericText(row.targetWeightKg, 0, 2000, `${path}.targetWeightKg`),
    restSec: numericText(row.restSec, 0, 3600, `${path}.restSec`),
    usesOverride: Boolean(row.usesOverride),
  };
}

function exerciseInput(value: unknown): BuilderExercise {
  const row = object(value, "exercise");
  const instanceId = semanticId(row.instanceId, "exercise.instanceId");
  const path = `exercises.${instanceId}`;
  const prescription = object(row.prescription, `${path}.prescription`);
  const type = oneOf(prescription.type, ["repetitions", "duration"] as const, `${path}.prescription.type`);
  const repetitionMode = oneOf(prescription.repetitionMode, ["fixed", "range"] as const, `${path}.prescription.repetitionMode`);
  const sets = numericText(prescription.sets, 1, 20, `${path}.prescription.sets`);
  const setOverrides = Array.isArray(row.setOverrides)
    ? row.setOverrides.map((set, index) => setInput(set, index + 1, type, instanceId))
    : [];
  if (setOverrides.length > 20) issue(`${path}.sets`, "too_many_sets");
  const repetitionsMin = type === "repetitions"
    ? numericText(prescription.repetitionsMin, 1, 500, `${path}.prescription.repetitionsMin`)
    : "";
  const requestedMax = repetitionMode === "fixed" && repetitionsMin ? repetitionsMin : prescription.repetitionsMax;
  const repetitionsMax = type === "repetitions"
    ? numericText(requestedMax, 1, 500, `${path}.prescription.repetitionsMax`)
    : "";
  if (repetitionsMin && repetitionsMax && Number(repetitionsMax) < Number(repetitionsMin)) {
    issue(`${path}.prescription.repetitions`, "invalid_range");
  }
  return {
    instanceId,
    exerciseId: semanticId(row.exerciseId, `${path}.sourceExerciseKey`),
    ...(row.sourceExerciseId ? { sourceExerciseId: uuid(row.sourceExerciseId, `${path}.sourceExerciseId`) } : {}),
    title: text(row.title, 160, `${path}.title`, true),
    category: optionalText(row.category, 120, `${path}.category`),
    ...(row.equipment ? { equipment: text(row.equipment, 160, `${path}.equipment`) } : {}),
    ...(row.description ? { description: text(row.description, 4000, `${path}.description`) } : {}),
    ...(row.imageUrl ? { imageUrl: text(row.imageUrl, 2000, `${path}.imageUrl`) } : {}),
    prescription: {
      type,
      sets,
      repetitionMode,
      repetitionsMin,
      repetitionsMax,
      durationSec: type === "duration"
        ? numericText(prescription.durationSec, 1, 86400, `${path}.prescription.durationSec`)
        : "",
      targetWeightKg: numericText(prescription.targetWeightKg, 0, 2000, `${path}.prescription.targetWeightKg`),
      restSec: numericText(prescription.restSec, 0, 3600, `${path}.prescription.restSec`),
    },
    perSetMode: Boolean(row.perSetMode),
    setOverrides,
    trainerNote: optionalText(row.trainerNote, 2000, `${path}.trainerNote`),
  };
}

function itemInput(value: unknown): BuilderItem {
  const row = object(value, "item");
  const kind = oneOf(row.kind, ["exercise", "superset"] as const, "item.kind");
  const itemId = semanticId(row.id, "item.id");
  if (kind === "exercise") return { id: itemId, kind, exercise: exerciseInput(row.exercise) };
  if (!Array.isArray(row.exercises) || row.exercises.length < 1 || row.exercises.length > 4) {
    issue(`supersets.${itemId}.members`, "invalid_storage_cardinality");
  }
  return {
    id: itemId,
    kind,
    label: optionalText(row.label, 160, `supersets.${itemId}.label`),
    instruction: optionalText(row.instruction, 2000, `supersets.${itemId}.instruction`),
    exercises: row.exercises.map(exerciseInput),
  };
}

function templateContent(value: unknown): SaveBuilderTemplateInput {
  const row = object(value, "content");
  const items = Array.isArray(row.items) ? row.items.map(itemInput) : [];
  const exercises = items.flatMap((item) => item.kind === "exercise" ? [item.exercise] : item.exercises);
  if (items.length > 30 || exercises.length > 40) issue("template.exercises", "too_many_exercises");
  const instanceIds = exercises.map((exercise) => exercise.instanceId);
  const setIds = exercises.flatMap((exercise) => exercise.setOverrides.map((set) => set.id));
  const itemIds = items.map((item) => item.id);
  if (new Set(instanceIds).size !== instanceIds.length) issue("template.exercises", "duplicate_instance_key");
  if (new Set(setIds).size !== setIds.length) issue("template.sets", "duplicate_set_key");
  if (new Set(itemIds).size !== itemIds.length) issue("template.items", "duplicate_item_key");
  const revision = Number(row.revision ?? 1);
  if (!Number.isInteger(revision) || revision < 1) issue("template.revision", "invalid_revision");
  return {
    title: optionalText(row.title, 120, "template.title"),
    revision,
    description: optionalText(row.description, 2000, "template.description"),
    category: optionalText(row.category, 120, "template.category"),
    estimatedDurationMin: numericText(row.estimatedDurationMin, 1, 600, "template.estimatedDurationMin"),
    generalInstruction: optionalText(row.generalInstruction, 4000, "template.generalInstruction"),
    items,
  };
}

function saveInput(value: unknown): SaveDraftCommandInput {
  const row = object(value);
  const content = templateContent(row.content);
  const input = {
    commandId: commandId(row.commandId),
    templateId: uuid(row.templateId, "templateId"),
    revisionId: uuid(row.revisionId, "revisionId"),
    expectedEditToken: typeof row.expectedEditToken === "string" ? row.expectedEditToken : null,
    content,
  };
  return { ...input, requestFingerprint: workoutTemplateRequestFingerprint(input) };
}

function publishInput(templateId: unknown, value: unknown): PublishRevisionCommandInput {
  const row = object(value);
  if ("content" in row) issue("content", "publish_content_forbidden");
  const input = {
    commandId: commandId(row.commandId),
    templateId: uuid(templateId, "templateId"),
    revisionId: uuid(row.revisionId, "revisionId"),
    expectedEditToken: text(row.expectedEditToken, 2048, "expectedEditToken", true),
  };
  return { ...input, requestFingerprint: workoutTemplateRequestFingerprint(input) };
}

function createRevisionInput(templateId: unknown, value: unknown): CreateRevisionCommandInput {
  const row = object(value);
  const input = {
    commandId: commandId(row.commandId),
    templateId: uuid(templateId, "templateId"),
    expectedTemplateToken: typeof row.expectedTemplateToken === "string" ? row.expectedTemplateToken : null,
  };
  return { ...input, requestFingerprint: workoutTemplateRequestFingerprint(input) };
}

function duplicateInput(value: unknown): DuplicateTemplateCommandInput {
  const row = object(value);
  const input = {
    commandId: commandId(row.commandId),
    sourceTemplateId: uuid(row.sourceTemplateId, "sourceTemplateId"),
    sourceRevisionIntent: oneOf(row.sourceRevisionIntent, ["editable", "published", "latest_saved"] as const, "sourceRevisionIntent"),
    newTemplateId: uuid(row.newTemplateId, "newTemplateId"),
    newRevisionId: uuid(row.newRevisionId, "newRevisionId"),
    title: text(row.title, 120, "template.title", true),
  };
  return { ...input, requestFingerprint: workoutTemplateRequestFingerprint(input) };
}

function archiveInput(templateId: unknown, value: unknown): ArchiveTemplateCommandInput {
  const row = object(value);
  const input = {
    commandId: commandId(row.commandId),
    templateId: uuid(templateId, "templateId"),
    expectedTemplateToken: typeof row.expectedTemplateToken === "string" ? row.expectedTemplateToken : null,
  };
  return { ...input, requestFingerprint: workoutTemplateRequestFingerprint(input) };
}

export class WorkoutBuilderService {
  constructor(private readonly repository = new WorkoutBuilderRepository()) {}

  list(actor: Actor) {
    return this.repository.list(actor);
  }

  saveDraft(actor: Actor, value: unknown) {
    return this.repository.saveDraft(actor, saveInput(value));
  }

  publish(actor: Actor, templateId: unknown, value: unknown) {
    return this.repository.publish(actor, publishInput(templateId, value));
  }

  createRevision(actor: Actor, templateId: unknown, value: unknown) {
    return this.repository.createRevision(actor, createRevisionInput(templateId, value));
  }

  duplicate(actor: Actor, value: unknown) {
    return this.repository.duplicate(actor, duplicateInput(value));
  }

  archive(actor: Actor, templateId: unknown, value: unknown) {
    return this.repository.archive(actor, archiveInput(templateId, value));
  }
}
