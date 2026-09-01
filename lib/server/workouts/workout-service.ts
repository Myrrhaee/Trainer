import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { randomUUID } from "node:crypto";
import { isAssignmentStateToken } from "@/lib/server/quick-assign/assignment-state-token";
import { PostgresWorkoutRepository } from "@/lib/server/workouts/workout-repository";
import type { CreateWorkoutTemplateInput, WorkoutExerciseInput } from "@/lib/server/workouts/workout-types";

export class WorkoutValidationError extends Error {}

function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new WorkoutValidationError("invalid_text");
    return "";
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) {
    throw new WorkoutValidationError("invalid_text");
  }
  return normalized;
}

function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new WorkoutValidationError("invalid_number");
  }
  return value;
}

function nullableNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new WorkoutValidationError("invalid_number");
  }
  return Math.round(value * 100) / 100;
}

function uuid(value: unknown) {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new WorkoutValidationError("invalid_id");
  }
  return value;
}

function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new WorkoutValidationError("invalid_date");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new WorkoutValidationError("invalid_date");
  }
  return value;
}

function exercise(value: unknown, index: number): WorkoutExerciseInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkoutValidationError("invalid_exercise");
  }
  const row = value as Record<string, unknown>;
  return {
    instanceKey: `exercise-${index + 1}`,
    title: text(row.title, 160, true),
    sets: integer(row.sets, 1, 20),
    repetitions: integer(row.repetitions, 1, 500),
    targetWeightKg: nullableNumber(row.targetWeightKg, 0, 2000),
    restSeconds: row.restSeconds === undefined ? 90 : integer(row.restSeconds, 0, 3600),
    trainerNote: text(row.trainerNote, 2000),
  };
}

function templateInput(value: unknown): CreateWorkoutTemplateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkoutValidationError("invalid_request");
  }
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.exercises) || input.exercises.length < 1 || input.exercises.length > 20) {
    throw new WorkoutValidationError("invalid_exercises");
  }
  return {
    title: text(input.title, 120, true),
    description: text(input.description, 2000),
    generalInstruction: text(input.generalInstruction, 4000),
    estimatedDurationMin: input.estimatedDurationMin === null || input.estimatedDurationMin === undefined
      ? null
      : integer(input.estimatedDurationMin, 1, 600),
    exercises: input.exercises.map(exercise),
  };
}

export class WorkoutService {
  constructor(private readonly repository = new PostgresWorkoutRepository()) {}

  listTrainerAthletes(actor: Actor) {
    return this.repository.listTrainerAthletes(actor);
  }

  listTemplates(actor: Actor) {
    return this.repository.listTemplates(actor);
  }

  createTemplate(actor: Actor, input: unknown) {
    return this.repository.createPublishedTemplate(actor, templateInput(input));
  }

  createAssignment(actor: Actor, value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new WorkoutValidationError("invalid_request");
    }
    const input = value as Record<string, unknown>;
    const hasRevision = input.templateRevisionId !== undefined;
    const hasStateToken = input.assignmentStateToken !== undefined;
    if (hasRevision !== hasStateToken) throw new WorkoutValidationError("invalid_quick_assign_contract");
    if (hasStateToken && !isAssignmentStateToken(input.assignmentStateToken)) {
      throw new WorkoutValidationError("invalid_assignment_state_token");
    }
    if (input.allowAdditionalAssignment !== undefined && typeof input.allowAdditionalAssignment !== "boolean") {
      throw new WorkoutValidationError("invalid_confirmation");
    }
    return this.repository.createAssignment(actor, {
      assignmentId: input.assignmentId === undefined ? randomUUID() : uuid(input.assignmentId),
      athleteUserId: uuid(input.athleteUserId),
      templateId: uuid(input.templateId),
      templateRevisionId: hasRevision ? uuid(input.templateRevisionId) : undefined,
      scheduledFor: date(input.scheduledFor),
      trainerNote: text(input.trainerNote, 2000),
      assignmentStateToken: hasStateToken ? input.assignmentStateToken as string : undefined,
      allowAdditionalAssignment: input.allowAdditionalAssignment === true,
    });
  }

  listAthleteAssignments(actor: Actor) {
    return this.repository.listAthleteAssignments(actor);
  }

  findTrainerAssignment(actor: Actor, assignmentIdValue: unknown) {
    return this.repository.findTrainerAssignment(actor, uuid(assignmentIdValue));
  }
}
