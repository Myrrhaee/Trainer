import type { WorkoutSession } from "@/lib/server/workout-sessions/workout-session-types";

export class CompletionValidationError extends Error {}

export type CompletionContent = {
  expectedVersion: number;
  zeroResultConfirmed: boolean;
  zeroResultReason: string;
  overallComment: string | null;
  discomfortReported: boolean;
  discomfortComment: string | null;
};

function normalizedText(value: unknown, limit: number, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new CompletionValidationError(field);
  const text = value.trim();
  // PostgreSQL char_length counts Unicode code points, not UTF-16 code units.
  if (Array.from(text).length > limit || /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) {
    throw new CompletionValidationError(field);
  }
  return text || null;
}

export function normalizeCompletion(value: Record<string, unknown>): CompletionContent {
  if (!Number.isInteger(value.expectedVersion) || Number(value.expectedVersion) < 1 || Number(value.expectedVersion) > 1_000_000) {
    throw new CompletionValidationError("expectedVersion");
  }
  if (typeof value.discomfortReported !== "boolean") throw new CompletionValidationError("discomfortReported");
  const overallComment = normalizedText(value.overallComment, 2000, "overallComment");
  const discomfortComment = value.discomfortReported
    ? normalizedText(value.discomfortComment, 1000, "discomfortComment") : null;
  if (value.discomfortReported && !discomfortComment) throw new CompletionValidationError("discomfortComment");
  return {
    expectedVersion: Number(value.expectedVersion),
    zeroResultConfirmed: value.zeroResultConfirmed === true,
    zeroResultReason: normalizedText(value.zeroResultReason, 1000, "zeroResultReason") ?? "",
    overallComment, discomfortReported: value.discomfortReported, discomfortComment,
  };
}

export function completionLogicalRequest(sessionId: string, assignmentId: string, content: CompletionContent) {
  return { sessionId, assignmentId, expectedVersion: content.expectedVersion,
    zeroResultConfirmed: content.zeroResultConfirmed, zeroResultReason: content.zeroResultReason,
    overallComment: content.overallComment, discomfortReported: content.discomfortReported,
    discomfortComment: content.discomfortComment };
}

export type CompletionAttempt = {
  operation: "complete_session";
  commandId: string;
  sessionId: string;
  assignmentId: string;
  expectedVersion: number;
  frozenPayload: CompletionContent & { idempotencyKey: string };
  fingerprint: string;
  startedAt: number;
};

export async function createCompletionAttempt(session: WorkoutSession, value: Record<string, unknown>): Promise<CompletionAttempt> {
  const content = normalizeCompletion({ ...value, expectedVersion: session.version });
  const logical = JSON.stringify(completionLogicalRequest(session.id, session.assignmentId, content));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(logical));
  const commandId = crypto.randomUUID();
  return { operation: "complete_session", commandId, sessionId: session.id, assignmentId: session.assignmentId,
    expectedVersion: session.version, frozenPayload: Object.freeze({ ...content, idempotencyKey: commandId }),
    fingerprint: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""), startedAt: Date.now() };
}

export function reconcileCompletion(attempt: CompletionAttempt, session: WorkoutSession): "success" | "already_completed" | "replay" | "conflict" {
  if (session.id !== attempt.sessionId || session.assignmentId !== attempt.assignmentId) return "conflict";
  const correlation = session.completion?.correlation;
  if (session.status === "completed" || session.status === "completed_with_omissions") {
    if (correlation === "own") return "success";
    if (correlation === "equivalent") return "already_completed";
    return "conflict";
  }
  return session.status === "active" && session.version === attempt.expectedVersion && correlation === "none"
    ? "replay" : "conflict";
}
