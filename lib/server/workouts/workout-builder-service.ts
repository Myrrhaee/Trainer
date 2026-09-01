import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { WorkoutBuilderRepository } from "@/lib/server/workouts/workout-builder-repository";
import type { BuilderExercise, BuilderItem, BuilderSet, SaveBuilderTemplateInput } from "@/lib/server/workouts/workout-builder-types";

export class WorkoutBuilderValidationError extends Error {}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkoutBuilderValidationError("invalid_request");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string") throw new WorkoutBuilderValidationError("invalid_text");
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new WorkoutBuilderValidationError("invalid_text");
  return result;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new WorkoutBuilderValidationError("invalid_option");
  }
  return value as T;
}

function numericText(value: unknown, min: number, max: number, required = false) {
  if (typeof value !== "string") throw new WorkoutBuilderValidationError("invalid_number");
  if (!value.trim() && !required) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new WorkoutBuilderValidationError("invalid_number");
  }
  return String(parsed);
}

function id(value: unknown) {
  return text(value, 160, true);
}

function setInput(value: unknown, expectedOrder: number, type: "repetitions" | "duration"): BuilderSet {
  const row = object(value);
  const order = Number(row.order);
  if (!Number.isInteger(order) || order !== expectedOrder) {
    throw new WorkoutBuilderValidationError("invalid_set_order");
  }
  return {
    id: id(row.id),
    order,
    kind: oneOf(row.kind, ["warmup", "working"] as const),
    repetitionsMin: type === "repetitions" ? numericText(row.repetitionsMin, 1, 500, true) : "",
    repetitionsMax: type === "repetitions" ? numericText(row.repetitionsMax, 1, 500, true) : "",
    durationSec: type === "duration" ? numericText(row.durationSec, 1, 86400, true) : "",
    targetWeightKg: numericText(row.targetWeightKg, 0, 2000),
    restSec: numericText(row.restSec, 0, 3600, true),
    usesOverride: Boolean(row.usesOverride),
  };
}

function exerciseInput(value: unknown): BuilderExercise {
  const row = object(value);
  const prescription = object(row.prescription);
  const type = oneOf(prescription.type, ["repetitions", "duration"] as const);
  const repetitionMode = oneOf(prescription.repetitionMode, ["fixed", "range"] as const);
  const sets = numericText(prescription.sets, 1, 20, true);
  const setOverrides = Array.isArray(row.setOverrides)
    ? row.setOverrides.map((set, index) => setInput(set, index + 1, type))
    : [];
  if (setOverrides.length > 20 || (Boolean(row.perSetMode) && setOverrides.length !== Number(sets))) {
    throw new WorkoutBuilderValidationError("invalid_sets");
  }
  const repetitionsMin = type === "repetitions" ? numericText(prescription.repetitionsMin, 1, 500, true) : "";
  const repetitionsMax = type === "repetitions"
    ? numericText(repetitionMode === "fixed" ? prescription.repetitionsMin : prescription.repetitionsMax, 1, 500, true)
    : "";
  if (type === "repetitions" && Number(repetitionsMax) < Number(repetitionsMin)) {
    throw new WorkoutBuilderValidationError("invalid_repetition_range");
  }
  return {
    instanceId: id(row.instanceId),
    exerciseId: id(row.exerciseId),
    title: text(row.title, 160, true),
    category: text(row.category, 120),
    ...(row.equipment ? { equipment: text(row.equipment, 160) } : {}),
    ...(row.description ? { description: text(row.description, 4000) } : {}),
    ...(row.imageUrl ? { imageUrl: text(row.imageUrl, 2000) } : {}),
    prescription: {
      type,
      sets,
      repetitionMode,
      repetitionsMin,
      repetitionsMax,
      durationSec: type === "duration" ? numericText(prescription.durationSec, 1, 86400, true) : "",
      targetWeightKg: numericText(prescription.targetWeightKg, 0, 2000),
      restSec: numericText(prescription.restSec, 0, 3600, true),
    },
    perSetMode: Boolean(row.perSetMode),
    setOverrides,
    trainerNote: text(row.trainerNote, 2000),
  };
}

function itemInput(value: unknown): BuilderItem {
  const row = object(value);
  const kind = oneOf(row.kind, ["exercise", "superset"] as const);
  if (kind === "exercise") {
    return { id: id(row.id), kind, exercise: exerciseInput(row.exercise) };
  }
  if (!Array.isArray(row.exercises) || row.exercises.length < 2 || row.exercises.length > 4) {
    throw new WorkoutBuilderValidationError("invalid_superset");
  }
  return {
    id: id(row.id),
    kind,
    label: text(row.label, 160),
    instruction: text(row.instruction, 2000),
    exercises: row.exercises.map(exerciseInput),
  };
}

function templateInput(value: unknown, publishing: boolean): SaveBuilderTemplateInput {
  const row = object(value);
  const items = Array.isArray(row.items) ? row.items.map(itemInput) : [];
  const exercises = items.flatMap((item) => item.kind === "exercise" ? [item.exercise] : item.exercises);
  if (items.length > 30 || exercises.length > 40) throw new WorkoutBuilderValidationError("too_many_exercises");
  if (publishing && exercises.length === 0) throw new WorkoutBuilderValidationError("template_empty");
  const uniqueInstances = new Set(exercises.map((exercise) => exercise.instanceId));
  const uniqueSets = new Set(exercises.flatMap((exercise) => exercise.setOverrides.map((set) => set.id)));
  if (uniqueInstances.size !== exercises.length || uniqueSets.size !== exercises.flatMap((exercise) => exercise.setOverrides).length) {
    throw new WorkoutBuilderValidationError("duplicate_ids");
  }
  const revision = Number(row.revision);
  if (!Number.isInteger(revision) || revision < 1) throw new WorkoutBuilderValidationError("invalid_revision");
  return {
    ...(typeof row.id === "string" && /^[0-9a-f-]{36}$/i.test(row.id) ? { id: row.id } : {}),
    title: text(row.title, 120, publishing),
    revision,
    description: text(row.description, 2000),
    category: text(row.category, 120),
    estimatedDurationMin: numericText(row.estimatedDurationMin, 1, 600),
    generalInstruction: text(row.generalInstruction, 4000),
    items,
  };
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new WorkoutBuilderValidationError("invalid_id");
  }
  return value;
}

export class WorkoutBuilderService {
  constructor(private readonly repository = new WorkoutBuilderRepository()) {}

  list(actor: Actor) {
    return this.repository.list(actor);
  }

  saveDraft(actor: Actor, value: unknown) {
    return this.repository.saveDraft(actor, templateInput(value, false));
  }

  async publish(actor: Actor, templateId: unknown, value: unknown) {
    const parsedId = uuid(templateId);
    await this.repository.saveDraft(actor, { ...templateInput(value, true), id: parsedId });
    return this.repository.publish(actor, parsedId);
  }

  createRevision(actor: Actor, templateId: unknown) {
    return this.repository.createRevision(actor, uuid(templateId));
  }

  archive(actor: Actor, templateId: unknown) {
    return this.repository.archive(actor, uuid(templateId));
  }
}
