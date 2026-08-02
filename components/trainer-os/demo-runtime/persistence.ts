import { isDemoFixtureId } from "./fixtures";
import type { DemoFixtureId, TrainerDemoState } from "./types";

const TRAINER_DEMO_STORAGE_KEY = "ai-strength-coach:demo-runtime:v1";
const TRAINER_DEMO_STORAGE_VERSION = 1;

type PersistedTrainerDemoRuntime = {
  version: typeof TRAINER_DEMO_STORAGE_VERSION;
  savedAt: string;
  fixtureId: DemoFixtureId | null;
  researchEnabled: boolean;
  isDirty: boolean;
  state: TrainerDemoState;
};

export function readPersistedTrainerDemoRuntime(): PersistedTrainerDemoRuntime | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TRAINER_DEMO_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isPersistedTrainerDemoRuntime(value)) {
      window.localStorage.removeItem(TRAINER_DEMO_STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    window.localStorage.removeItem(TRAINER_DEMO_STORAGE_KEY);
    return null;
  }
}

export function persistTrainerDemoRuntime(input: {
  fixtureId: DemoFixtureId | null;
  researchEnabled: boolean;
  isDirty: boolean;
  state: TrainerDemoState;
}) {
  if (typeof window === "undefined") return false;

  const snapshot: PersistedTrainerDemoRuntime = {
    version: TRAINER_DEMO_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    fixtureId: input.fixtureId,
    researchEnabled: input.researchEnabled,
    isDirty: input.isDirty,
    state: input.state,
  };

  try {
    window.localStorage.setItem(TRAINER_DEMO_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

function isPersistedTrainerDemoRuntime(value: unknown): value is PersistedTrainerDemoRuntime {
  if (!isRecord(value)) return false;
  if (value.version !== TRAINER_DEMO_STORAGE_VERSION) return false;
  if (typeof value.savedAt !== "string") return false;
  if (value.fixtureId !== null && !isDemoFixtureId(typeof value.fixtureId === "string" ? value.fixtureId : null)) return false;
  if (typeof value.researchEnabled !== "boolean" || typeof value.isDirty !== "boolean" || !isTrainerDemoState(value.state)) return false;
  return true;
}

function isTrainerDemoState(value: unknown): value is TrainerDemoState {
  if (!isRecord(value)) return false;
  return [
    "athletes",
    "athleteProfiles",
    "workoutTemplates",
    "workoutAssignments",
    "workoutSessions",
    "attentionItems",
    "trainerFeedback",
    "manualResolutions",
    "teamActivity",
    "pilotEvents",
  ].every((key) => Array.isArray(value[key]))
    && (value.selectedAttentionItemId === null || typeof value.selectedAttentionItemId === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
