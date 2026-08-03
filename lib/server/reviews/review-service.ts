import "server-only";

import { createHash } from "node:crypto";

import type { Actor } from "@/lib/server/database/actor-context";
import { WorkoutSessionRepository } from "@/lib/server/workout-sessions/workout-session-repository";
import { ReviewRepository } from "./review-repository";
import type { ReviewFeedbackKind, TrainerReviewDetails } from "./review-types";

export class ReviewValidationError extends Error {}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReviewValidationError("invalid_request");
  return value as Record<string, unknown>;
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new ReviewValidationError("invalid_id");
  return value;
}

function text(value: unknown, max: number, required = true) {
  if (typeof value !== "string" || value.length > max) throw new ReviewValidationError("invalid_text");
  const result = value.trim();
  if (required && !result) throw new ReviewValidationError("invalid_text");
  return result;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function idempotencyKey(value: unknown) {
  const key = text(value, 200);
  if (key.length < 8) throw new ReviewValidationError("invalid_idempotency_key");
  return hash(key);
}

function requestHash(value: unknown) {
  return hash(JSON.stringify(value));
}

function feedbackKind(value: unknown): ReviewFeedbackKind {
  if (value !== "detailed" && value !== "acknowledgement" && value !== "follow_up") {
    throw new ReviewValidationError("invalid_feedback_kind");
  }
  return value;
}

export class ReviewService {
  constructor(
    private readonly repository = new ReviewRepository(),
    private readonly sessions = new WorkoutSessionRepository(),
  ) {}

  listQueue(actor: Actor) {
    return this.repository.listQueue(actor);
  }

  async findReview(actor: Actor, sessionIdValue: unknown): Promise<TrainerReviewDetails | null> {
    const sessionId = uuid(sessionIdValue);
    const [source, session, feedback] = await Promise.all([
      this.repository.findSource(actor, sessionId),
      this.sessions.find(actor, sessionId),
      this.repository.listSessionFeedback(actor, sessionId),
    ]);
    if (!source || !session || !session.completedAt || session.status === "active" || session.status === "abandoned") return null;
    const displayName = source.athlete_display_name?.trim() || `Спортсмен ${source.athlete_user_id.slice(0, 6)}`;
    return {
      attention: {
        id: source.attention_item_id,
        status: source.attention_status,
        createdAt: source.attention_created_at.toISOString(),
        resolvedAt: source.attention_resolved_at?.toISOString() ?? null,
        priorityReasons: source.priority_reasons,
        manualResolutionReason: source.manual_resolution_reason,
      },
      session: {
        id: session.id,
        assignmentId: session.assignmentId,
        title: session.title,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationMin: Math.max(0, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60_000)),
      },
      athlete: { id: source.athlete_user_id, displayName, initials: initials(displayName) },
      assignment: {
        id: source.assignment_id,
        scheduledFor: source.scheduled_for instanceof Date
          ? source.scheduled_for.toISOString().slice(0, 10)
          : source.scheduled_for.slice(0, 10),
      },
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        title: exercise.title,
        position: exercise.position,
        status: exercise.status,
        athleteNote: exercise.athleteNote,
        sets: exercise.sets.map((set) => ({ ...set, position: set.position })),
      })),
      feedback,
    };
  }

  listAthleteFeedback(actor: Actor, sessionIdValue?: unknown) {
    return this.repository.listAthleteFeedback(actor, sessionIdValue === undefined ? undefined : uuid(sessionIdValue));
  }

  sendFeedback(actor: Actor, sessionIdValue: unknown, value: unknown) {
    const sessionId = uuid(sessionIdValue);
    const input = object(value);
    const kind = feedbackKind(input.kind);
    const request = {
      attentionItemId: uuid(input.attentionItemId),
      sessionId,
      kind,
      body: text(input.body, 5000),
      followUpOfId: kind === "follow_up" ? uuid(input.followUpOfId) : null,
    };
    return this.repository.sendFeedback(actor, {
      ...request,
      idempotencyKeyHash: idempotencyKey(input.idempotencyKey),
      requestHash: requestHash(request),
    });
  }

  resolveManually(actor: Actor, sessionIdValue: unknown, value: unknown) {
    const sessionId = uuid(sessionIdValue);
    const input = object(value);
    const request = {
      attentionItemId: uuid(input.attentionItemId),
      sessionId,
      reason: text(input.reason, 1000),
    };
    return this.repository.resolveManually(actor, {
      ...request,
      idempotencyKeyHash: idempotencyKey(input.idempotencyKey),
      requestHash: requestHash(request),
    });
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "С";
}
