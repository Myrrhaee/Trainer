"use client";

import { isQuickAssignHandoffToken, quickAssignHref } from "@/lib/quick-assign-navigation";
import {
  decodeTrainerWorkflowContext,
} from "@/lib/trainer-workflow-transition";
import { workoutTemplateEditorHref } from "@/lib/workout-template-editor-navigation";

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
  const context = decodeTrainerWorkflowContext(handoff.transitionContext);
  if (!context || (context.athleteUserId && context.athleteUserId !== handoff.athleteUserId)) {
    throw new Error("invalid_quick_assign_handoff_context");
  }
  return quickAssignHref({
    athleteUserId: handoff.athleteUserId,
    context,
    handoffToken: handoff.token,
  });
}

export function builderHrefForQuickAssign(handoff: QuickAssignBuilderHandoff) {
  return workoutTemplateEditorHref({
    mode: "new",
    handoffToken: handoff.token,
    returnTo: quickAssignHrefFromHandoff(handoff),
  });
}

function validHandoff(value: Partial<QuickAssignBuilderHandoff>, token: string) {
  const context = typeof value.transitionContext === "string"
    ? decodeTrainerWorkflowContext(value.transitionContext)
    : null;
  const validStatus = value.status === "editing"
    ? value.publishedRevisionId === undefined
    : value.status === "published" && isUuid(value.publishedRevisionId);
  return value.version === 1
    && value.token === token
    && typeof value.createdAt === "number"
    && typeof value.expiresAt === "number"
    && value.expiresAt > value.createdAt
    && value.expiresAt - value.createdAt <= TTL_MS
    && isUuid(value.athleteUserId)
    && Boolean(context)
    && (!context?.athleteUserId || context.athleteUserId === value.athleteUserId)
    && typeof value.query === "string" && value.query.length <= 120
    && typeof value.scheduledFor === "string" && (value.scheduledFor === "" || /^\d{4}-\d{2}-\d{2}$/.test(value.scheduledFor))
    && typeof value.trainerNote === "string" && value.trainerNote.length <= 2_000
    && validStatus;
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
