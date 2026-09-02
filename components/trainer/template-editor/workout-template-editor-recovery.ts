"use client";

import type { EditorDraftContent } from "./workout-template-editor-state";

const PREFIX = "ai-strength:template-editor-recovery:v1:";
const TTL_MS = 24 * 60 * 60 * 1_000;

export type EditorRecovery = {
  version: 1;
  actorUserId: string;
  scope: string;
  templateId: string | null;
  revisionId: string | null;
  editToken: string | null;
  content: EditorDraftContent;
  returnTo: string | null;
  handoffToken: string | null;
  savedAt: number;
  expiresAt: number;
};

export function readEditorRecovery(actorUserId: string, scope: string) {
  try {
    const raw = sessionStorage.getItem(key(actorUserId, scope));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<EditorRecovery>;
    if (value.version !== 1 || value.actorUserId !== actorUserId || value.scope !== scope
      || !value.content || typeof value.savedAt !== "number" || typeof value.expiresAt !== "number") {
      clearEditorRecovery(actorUserId, scope);
      return null;
    }
    if (value.expiresAt <= Date.now()) {
      clearEditorRecovery(actorUserId, scope);
      return null;
    }
    return value as EditorRecovery;
  } catch {
    return null;
  }
}

export function writeEditorRecovery(input: Omit<EditorRecovery, "version" | "savedAt" | "expiresAt">) {
  try {
    const savedAt = Date.now();
    sessionStorage.setItem(key(input.actorUserId, input.scope), JSON.stringify({
      ...input,
      version: 1,
      savedAt,
      expiresAt: savedAt + TTL_MS,
    } satisfies EditorRecovery));
  } catch {
    // Recovery is best-effort; PostgreSQL remains authoritative.
  }
}

export function clearEditorRecovery(actorUserId: string, scope: string) {
  try {
    sessionStorage.removeItem(key(actorUserId, scope));
  } catch {
    // No recovery exists when storage is unavailable.
  }
}

function key(actorUserId: string, scope: string) {
  return `${PREFIX}${actorUserId}:${scope}`;
}
