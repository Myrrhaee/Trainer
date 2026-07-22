"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useTrainerDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import { registerDemoTransientReset } from "@/components/trainer-os/demo-runtime/transient-reset";

import type { TrainerFeedbackRecord, WorkoutReviewDetails } from "./review-model";

export type ReviewFeedbackMode = "detailed" | "acknowledgement";
export type ReviewResolution =
  | { kind: "feedback"; feedbackId: string; resolvedAt: string }
  | { kind: "manual"; reason: string; resolvedAt: string };

export type ReviewWorkflowState = {
  draft: string;
  mode: ReviewFeedbackMode;
  feedback: TrainerFeedbackRecord[];
  resolution?: ReviewResolution;
  saveStatus: "idle" | "saving" | "failed";
  saveError?: string;
  attempts: number;
  aiStatus: "idle" | "generating" | "ready" | "unavailable" | "failed";
};

const stateBySession = new Map<string, ReviewWorkflowState>();
const listenersBySession = new Map<string, Set<() => void>>();
const hydratedSessionIds = new Set<string>();

registerDemoTransientReset(() => {
  const activeSessionIds = [...listenersBySession.keys()];
  stateBySession.clear();
  hydratedSessionIds.clear();
  activeSessionIds.forEach(emit);
});

function initialState(review: WorkoutReviewDetails): ReviewWorkflowState {
  const existing = review.feedback.existing;
  return {
    draft: "",
    mode: "detailed",
    feedback: existing,
    resolution: existing[0]
      ? { kind: "feedback", feedbackId: existing[0].id, resolvedAt: existing[0].sentAt }
      : undefined,
    saveStatus: "idle",
    attempts: 0,
    aiStatus: review.feedback.aiState === "unavailable" || review.feedback.aiState === "no-context" ? "unavailable" : review.feedback.aiState === "failed" ? "failed" : "idle",
  };
}

function ensureState(review: WorkoutReviewDetails) {
  const current = stateBySession.get(review.session.id);
  if (current) return current;
  const created = initialState(review);
  stateBySession.set(review.session.id, created);
  return created;
}

function emit(sessionId: string) {
  listenersBySession.get(sessionId)?.forEach((listener) => listener());
}

function update(sessionId: string, updater: (current: ReviewWorkflowState) => ReviewWorkflowState) {
  const current = stateBySession.get(sessionId);
  if (!current) return;
  const next = updater(current);
  stateBySession.set(sessionId, next);
  persistState(sessionId, next);
  emit(sessionId);
}

export function useReviewWorkflow(review: WorkoutReviewDetails) {
  const runtime = useTrainerDemoRuntime();
  const sessionId = review.session.id;
  ensureState(review);

  useEffect(() => {
    if (hydratedSessionIds.has(sessionId)) return;
    hydratedSessionIds.add(sessionId);
    const stored = readPersistedState(sessionId);
    if (!stored) return;
    stateBySession.set(sessionId, stored);
    emit(sessionId);
  }, [sessionId]);

  const state = useSyncExternalStore(
    (listener) => {
      const listeners = listenersBySession.get(sessionId) ?? new Set();
      listeners.add(listener);
      listenersBySession.set(sessionId, listeners);
      return () => listeners.delete(listener);
    },
    () => ensureState(review),
    () => ensureState(review)
  );

  return {
    state,
    setDraft: (draft: string) => update(sessionId, (current) => ({ ...current, draft, saveStatus: "idle", saveError: undefined })),
    setMode: (mode: ReviewFeedbackMode) => update(sessionId, (current) => ({ ...current, mode })),
    useAiDraft: async () => {
      if (!review.feedback.aiDraft) return;
      update(sessionId, (current) => ({ ...current, aiStatus: "generating" }));
      await wait(450);
      update(sessionId, (current) => ({ ...current, draft: review.feedback.aiDraft ?? current.draft, mode: "detailed", aiStatus: "ready" }));
    },
    send: async (kind: ReviewFeedbackMode | "follow-up") => {
      const before = ensureState(review);
      if (!before.draft.trim() || before.saveStatus === "saving") return false;
      update(sessionId, (current) => ({ ...current, saveStatus: "saving", saveError: undefined }));
      await wait(500);

      if (review.feedback.demoSendBehavior === "fail-once" && before.attempts === 0) {
        update(sessionId, (current) => ({ ...current, attempts: current.attempts + 1, saveStatus: "failed", saveError: "Demo-сохранение не удалось. Черновик сохранён, задача остаётся открытой." }));
        return false;
      }

      const sentAt = formatTimestamp(new Date());
      const record: TrainerFeedbackRecord = {
        id: `feedback-${sessionId}-${Date.now()}`,
        kind,
        body: before.draft.trim(),
        author: "Алексей Романов",
        sentAt,
      };
      const result = kind === "follow-up"
        ? runtime.commands.createFollowUpFeedback({
            actor: runtime.actor,
            athleteId: review.athlete.id,
            workoutSessionId: sessionId,
            feedback: record,
          })
        : (kind === "acknowledgement"
            ? runtime.commands.resolveAttentionItemWithAcknowledgement
            : runtime.commands.resolveAttentionItemWithFeedback)({
              actor: runtime.actor,
              athleteId: review.athlete.id,
              workoutSessionId: sessionId,
              attentionItemId: review.attentionContext?.id,
              feedback: record,
            });
      if (!result.ok) {
        update(sessionId, (current) => ({
          ...current,
          attempts: current.attempts + 1,
          saveStatus: "failed",
          saveError: result.error.message,
        }));
        return false;
      }
      update(sessionId, (current) => ({
        ...current,
        attempts: current.attempts + 1,
        draft: "",
        feedback: [...current.feedback, record],
        resolution: current.resolution ?? { kind: "feedback", feedbackId: record.id, resolvedAt: sentAt },
        saveStatus: "idle",
        saveError: undefined,
      }));
      return true;
    },
    resolveManually: async (reason: string) => {
      if (!reason.trim()) return false;
      update(sessionId, (current) => ({ ...current, saveStatus: "saving", saveError: undefined }));
      await wait(350);
      const attentionItemId = review.attentionContext?.id;
      if (!attentionItemId) {
        update(sessionId, (current) => ({ ...current, saveStatus: "failed", saveError: "Для этой сессии нет активной задачи разбора." }));
        return false;
      }
      const result = runtime.commands.resolveAttentionItemManually({
        actor: runtime.actor,
        athleteId: review.athlete.id,
        attentionItemId,
        workoutSessionId: sessionId,
        reason,
      });
      if (!result.ok) {
        update(sessionId, (current) => ({ ...current, saveStatus: "failed", saveError: result.error.message }));
        return false;
      }
      update(sessionId, (current) => ({ ...current, resolution: { kind: "manual", reason: reason.trim(), resolvedAt: formatTimestamp(new Date()) }, saveStatus: "idle" }));
      return true;
    },
  };
}

function persistState(sessionId: string, state: ReviewWorkflowState) {
  try {
    window.sessionStorage.setItem(`workout-review:${sessionId}`, JSON.stringify(state));
  } catch {
    // The in-memory store remains functional when browser storage is unavailable.
  }
}

function readPersistedState(sessionId: string): ReviewWorkflowState | null {
  try {
    const value = window.sessionStorage.getItem(`workout-review:${sessionId}`);
    return value ? (JSON.parse(value) as ReviewWorkflowState) : null;
  } catch {
    return null;
  }
}

function wait(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(value);
}
