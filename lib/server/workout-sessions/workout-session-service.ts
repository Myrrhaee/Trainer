import "server-only";

import { createHash } from "node:crypto";

import type { Actor } from "@/lib/server/database/actor-context";
import { WorkoutSessionRepository } from "./workout-session-repository";
import type { ProgressSetInput } from "./workout-session-types";

export class WorkoutSessionValidationError extends Error {}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkoutSessionValidationError("invalid_request");
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new WorkoutSessionValidationError("invalid_id");
  }
  return value;
}

function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max) throw new WorkoutSessionValidationError("invalid_text");
  return value.trim();
}

function integer(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new WorkoutSessionValidationError("invalid_number");
  }
  return value;
}

function nullableNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new WorkoutSessionValidationError("invalid_number");
  }
  return Math.round(value * 10) / 10;
}

function idempotencyKey(value: unknown) {
  const key = text(value, 200);
  if (key.length < 8) throw new WorkoutSessionValidationError("invalid_idempotency_key");
  return hash(key);
}

function timezone(value: unknown) {
  const zone = text(value, 100) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
  } catch {
    throw new WorkoutSessionValidationError("invalid_timezone");
  }
  return zone;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableRequestHash(value: unknown) {
  return hash(JSON.stringify(value));
}

function setInput(value: unknown): ProgressSetInput {
  const row = object(value);
  const status = row.status;
  if (status !== "completed" && status !== "skipped" && status !== "incomplete") {
    throw new WorkoutSessionValidationError("invalid_status");
  }
  const actualRepetitions = status === "skipped" ? null : nullableNumber(row.actualRepetitions, 0, 500);
  const actualDurationSeconds = status === "skipped" ? null : nullableNumber(row.actualDurationSeconds, 0, 86400);
  if (status === "completed" && actualRepetitions === null && actualDurationSeconds === null) {
    throw new WorkoutSessionValidationError("result_required");
  }
  return {
    setLogId: uuid(row.setLogId), status,
    actualRepetitions: actualRepetitions === null ? null : Math.round(actualRepetitions),
    actualDurationSeconds: actualDurationSeconds === null ? null : Math.round(actualDurationSeconds),
    actualWeightKg: status === "skipped" ? null : nullableNumber(row.actualWeightKg, 0, 2000),
    rpe: status === "skipped" ? null : nullableNumber(row.rpe, 1, 10),
    athleteComment: text(row.athleteComment ?? "", 1000),
  };
}

export class WorkoutSessionService {
  constructor(private readonly repository = new WorkoutSessionRepository()) {}

  list(actor: Actor) {
    return this.repository.listAthlete(actor);
  }

  find(actor: Actor, sessionId: unknown) {
    return this.repository.find(actor, uuid(sessionId));
  }

  start(actor: Actor, value: unknown) {
    const input = object(value);
    return this.repository.start(actor, {
      assignmentId: uuid(input.assignmentId),
      clientTimezone: timezone(input.clientTimezone),
      idempotencyKeyHash: idempotencyKey(input.idempotencyKey),
    });
  }

  saveProgress(actor: Actor, sessionId: unknown, value: unknown) {
    const input = object(value);
    if (!Array.isArray(input.sets) || input.sets.length < 1 || input.sets.length > 20) {
      throw new WorkoutSessionValidationError("invalid_sets");
    }
    const sets = input.sets.map(setInput);
    if (new Set(sets.map((set) => set.setLogId)).size !== sets.length) {
      throw new WorkoutSessionValidationError("duplicate_sets");
    }
    const request = { expectedVersion: integer(input.expectedVersion, 1, 1_000_000), sets };
    return this.repository.saveProgress(actor, {
      sessionId: uuid(sessionId), ...request,
      idempotencyKeyHash: idempotencyKey(input.idempotencyKey),
      requestHash: stableRequestHash(request),
    });
  }

  complete(actor: Actor, sessionId: unknown, value: unknown) {
    const input = object(value);
    const request = {
      expectedVersion: integer(input.expectedVersion, 1, 1_000_000),
      zeroResultConfirmed: input.zeroResultConfirmed === true,
      zeroResultReason: text(input.zeroResultReason ?? "", 1000),
    };
    return this.repository.complete(actor, {
      sessionId: uuid(sessionId), ...request,
      idempotencyKeyHash: idempotencyKey(input.idempotencyKey),
      requestHash: stableRequestHash(request),
    });
  }
}
