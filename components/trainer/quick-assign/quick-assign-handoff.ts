"use client";

import { isQuickAssignHandoffToken, quickAssignHref } from "@/lib/quick-assign-navigation";
import {
  decodeTrainerWorkflowContext,
  type TrainerWorkflowContext,
} from "@/lib/trainer-workflow-transition";

const STORAGE_PREFIX = "quick-assign-builder-handoff:v1:";
const TTL_MS = 30 * 60 * 1_000;

export type QuickAssignBuilderHandoff = {
  version: 1;
  token: string;
  createdAt: number;
  expiresAt: number;
  athleteUserId: string;
  transitionContext: string;
  query: string;
  scheduledFor: string;
  trainerNote: string;
  status: "editing" | "published";
  publishedRevisionId?: string;
};

export function createQuickAssignBuilderHandoff(input: {
  athleteUserId: string;
  transitionContext: string;
  query: string;
  scheduledFor: string;
  trainerNote: string;
}) {
  const token = opaqueToken();
  const createdAt = Date.now();
  const handoff: QuickAssignBuilderHandoff = {
    version: 1,
    token,
    createdAt,
    expiresAt: createdAt + TTL_MS,
    athleteUserId: input.athleteUserId,
    transitionContext: input.transitionContext,
    query: input.query.slice(0, 120),
    scheduledFor: input.scheduledFor,
    trainerNote: input.trainerNote.slice(0, 2_000),
    status: "editing",
  };
  window.sessionStorage.setItem(storageKey(token), JSON.stringify(handoff));
  return handoff;
}

export function readQuickAssignBuilderHandoff(token: string, athleteUserId?: string) {
  if (!isQuickAssignHandoffToken(token)) return null;
  const raw = window.sessionStorage.getItem(storageKey(token));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<QuickAssignBuilderHandoff>;
    if (!validHandoff(value, token)) {
      window.sessionStorage.removeItem(storageKey(token));
      return null;
    }
    const handoff = value as QuickAssignBuilderHandoff;
    if (handoff.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(storageKey(token));
      return null;
    }
    if (athleteUserId && handoff.athleteUserId !== athleteUserId) return null;
    return handoff;
  } catch {
    window.sessionStorage.removeItem(storageKey(token));
    return null;
  }
}

export function publishQuickAssignBuilderHandoff(input: {
  token: string;
  athleteUserId: string;
  publishedRevisionId: string;
}) {
  const handoff = readQuickAssignBuilderHandoff(input.token, input.athleteUserId);
  if (!handoff || !isUuid(input.publishedRevisionId)) return null;
  const published: QuickAssignBuilderHandoff = {
    ...handoff,
    status: "published",
    publishedRevisionId: input.publishedRevisionId,
  };
  window.sessionStorage.setItem(storageKey(input.token), JSON.stringify(published));
  return published;
}

export function quickAssignHrefFromHandoff(handoff: QuickAssignBuilderHandoff) {
  const context = decodeTrainerWorkflowContext(handoff.transitionContext)
    ?? directContext(handoff.athleteUserId);
  return quickAssignHref({
    athleteUserId: handoff.athleteUserId,
    context,
    handoffToken: handoff.token,
  });
}

export function builderHrefForQuickAssign(handoff: QuickAssignBuilderHandoff) {
  const params = new URLSearchParams({
    athleteId: handoff.athleteUserId,
    handoff: handoff.token,
    from: "quick-assign",
  });
  return `/trainer/builder?${params}`;
}

function validHandoff(value: Partial<QuickAssignBuilderHandoff>, token: string) {
  return value.version === 1
    && value.token === token
    && typeof value.createdAt === "number"
    && typeof value.expiresAt === "number"
    && isUuid(value.athleteUserId)
    && typeof value.transitionContext === "string"
    && Boolean(decodeTrainerWorkflowContext(value.transitionContext))
    && typeof value.query === "string"
    && typeof value.scheduledFor === "string"
    && typeof value.trainerNote === "string"
    && (value.status === "editing" || value.status === "published")
    && (value.publishedRevisionId === undefined || isUuid(value.publishedRevisionId));
}

function directContext(athleteUserId: string): TrainerWorkflowContext {
  return { version: 1, origin: "direct", athleteUserId, tab: "training" };
}

function storageKey(token: string) {
  return `${STORAGE_PREFIX}${token}`;
}

function opaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
