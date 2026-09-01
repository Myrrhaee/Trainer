import "server-only";

import { createHash } from "node:crypto";

import type { Actor } from "@/lib/server/database/actor-context";
import { ReviewRepository } from "./review-repository";
import type { ReviewFeedbackKind, ReviewReadModel } from "./review-types";

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
  constructor(private readonly repository = new ReviewRepository()) {}

  listQueue(actor: Actor) {
    return this.repository.listQueue(actor);
  }

  async findReview(actor: Actor, sessionIdValue: unknown): Promise<ReviewReadModel | null> {
    const sessionId = uuid(sessionIdValue);
    const review = await this.repository.findReview(actor, sessionId);
    return review?.capabilities.canRead ? review : null;
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
