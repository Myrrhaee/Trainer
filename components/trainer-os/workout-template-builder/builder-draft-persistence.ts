"use client";

import { registerDemoTransientReset } from "@/components/trainer-os/demo-runtime/transient-reset";

import type { WorkoutTemplateDraft } from "./builder-model";

const STORAGE_KEY = "ai-strength-coach:builder-active-draft:v1";

type StoredBuilderDraft = {
  version: 1;
  athleteId?: string;
  draft: WorkoutTemplateDraft;
};

registerDemoTransientReset(clearBuilderDraft);

export function readBuilderDraft(athleteId?: string): WorkoutTemplateDraft | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const stored = JSON.parse(value) as Partial<StoredBuilderDraft>;
    if (
      stored.version !== 1
      || normalizeAthleteId(stored.athleteId) !== normalizeAthleteId(athleteId)
      || !isWorkoutTemplateDraft(stored.draft)
    ) {
      return null;
    }
    return stored.draft;
  } catch {
    return null;
  }
}

export function writeBuilderDraft(draft: WorkoutTemplateDraft, athleteId?: string) {
  try {
    const stored: StoredBuilderDraft = { version: 1, athleteId, draft };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The editor remains usable when browser storage is unavailable.
  }
}

export function clearBuilderDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

function normalizeAthleteId(value?: string) {
  return value ?? "";
}

function isWorkoutTemplateDraft(value: unknown): value is WorkoutTemplateDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<WorkoutTemplateDraft>;
  return typeof draft.id === "string" && draft.status === "draft" && Array.isArray(draft.items);
}
