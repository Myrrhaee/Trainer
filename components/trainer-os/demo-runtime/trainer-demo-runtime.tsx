"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  archiveWorkoutTemplate,
  createFollowUpFeedback,
  createWorkoutAssignment,
  createWorkoutTemplateRevision,
  publishWorkoutTemplate,
  resolveAttentionManually,
  resolveAttentionWithFeedback,
  saveWorkoutTemplateDraft,
  selectAttentionItem,
} from "./commands";
import {
  completeWorkoutSession,
  resumeWorkoutSession,
  saveClientSessionComment,
  saveSetLog,
  setDiscomfortSignal,
  skipExercise,
  startWorkoutSession,
} from "./client-commands";
import { createInitialTrainerDemoState } from "./seed";
import {
  TRAINER_DEMO_ACTOR_ID,
  type TrainerDemoActor,
  type TrainerDemoCommandReceipt,
  type TrainerDemoCommandResult,
  type TrainerDemoRuntimeValue,
  type TrainerDemoState,
  type TrainerPilotEvent,
} from "./types";

const TrainerDemoRuntimeContext = createContext<TrainerDemoRuntimeValue | null>(null);

const actor: TrainerDemoActor = { id: TRAINER_DEMO_ACTOR_ID, role: "trainer" };

export function TrainerDemoRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrainerDemoState>(createInitialTrainerDemoState);
  const stateRef = useRef(state);

  const apply = useCallback(<TReceipt extends TrainerDemoCommandReceipt>(
    command: (current: TrainerDemoState) => { state: TrainerDemoState; result: TrainerDemoCommandResult<TReceipt> }
  ): TrainerDemoCommandResult<TReceipt> => {
    const execution = command(stateRef.current);
    if (execution.state !== stateRef.current) {
      stateRef.current = execution.state;
      setState(execution.state);
      logLatestPilotEvent(execution.state);
    }
    if (!execution.result.ok) {
      const current = stateRef.current;
      const event: TrainerPilotEvent = {
        id: `pilot-${current.pilotEvents.length + 1}`,
        name: "command_failed",
        at: new Date().toISOString(),
        errorCode: execution.result.error.code,
      };
      const next = { ...current, pilotEvents: [...current.pilotEvents, event] };
      stateRef.current = next;
      setState(next);
      logPilotError(execution.result.error.code);
    }
    return execution.result;
  }, []);

  const recordPilotEvent = useCallback((event: Omit<TrainerPilotEvent, "id" | "at">) => {
    const current = stateRef.current;
    if (event.name === "flow_completed" && current.pilotEvents.some((candidate) =>
      candidate.name === event.name
      && candidate.athleteId === event.athleteId
      && candidate.workoutSessionId === event.workoutSessionId
    )) return;
    const nextEvent = { ...event, id: `pilot-${current.pilotEvents.length + 1}`, at: new Date().toISOString() };
    const next = { ...current, pilotEvents: [...current.pilotEvents, nextEvent] };
    stateRef.current = next;
    setState(next);
    logPilotEvent(nextEvent);
  }, []);

  const commands = useMemo<TrainerDemoRuntimeValue["commands"]>(() => ({
    resolveAttentionItemWithFeedback: (input) => apply((current) => resolveAttentionWithFeedback(current, input, "ResolveAttentionItemWithFeedback")),
    resolveAttentionItemWithAcknowledgement: (input) => apply((current) => resolveAttentionWithFeedback(current, input, "ResolveAttentionItemWithAcknowledgement")),
    resolveAttentionItemManually: (input) => apply((current) => resolveAttentionManually(current, input)),
    createWorkoutAssignment: (input) => apply((current) => createWorkoutAssignment(current, input)),
    saveWorkoutTemplateDraft: (input) => apply((current) => saveWorkoutTemplateDraft(current, input)),
    publishWorkoutTemplate: (input) => apply((current) => publishWorkoutTemplate(current, input)),
    createWorkoutTemplateRevision: (input) => apply((current) => createWorkoutTemplateRevision(current, input)),
    archiveWorkoutTemplatePrototype: (input) => apply((current) => archiveWorkoutTemplate(current, input)),
    createFollowUpFeedback: (input) => apply((current) => createFollowUpFeedback(current, input)),
    startWorkoutSession: (input) => apply((current) => startWorkoutSession(current, input)),
    resumeWorkoutSession: (input) => apply((current) => resumeWorkoutSession(current, input)),
    saveSetLog: (input) => apply((current) => saveSetLog(current, input, "SaveSetLog")),
    updateSetLog: (input) => apply((current) => saveSetLog(current, input, "UpdateSetLog")),
    skipExercise: (input) => apply((current) => skipExercise(current, input)),
    saveClientSessionComment: (input) => apply((current) => saveClientSessionComment(current, input)),
    setDiscomfortSignal: (input) => apply((current) => setDiscomfortSignal(current, input)),
    completeWorkoutSession: (input) => apply((current) => completeWorkoutSession(current, input)),
    selectAttentionItem: (attentionItemId) => apply((current) => selectAttentionItem(current, attentionItemId)),
    recordPilotEvent,
  }), [apply, recordPilotEvent]);

  const value = useMemo<TrainerDemoRuntimeValue>(() => ({ actor, state, commands }), [commands, state]);
  return <TrainerDemoRuntimeContext.Provider value={value}>{children}</TrainerDemoRuntimeContext.Provider>;
}

export function useTrainerDemoRuntime() {
  const runtime = useContext(TrainerDemoRuntimeContext);
  if (!runtime) throw new Error("useTrainerDemoRuntime must be used inside TrainerDemoRuntimeProvider");
  return runtime;
}

export const ProductDemoRuntimeProvider = TrainerDemoRuntimeProvider;
export const useProductDemoRuntime = useTrainerDemoRuntime;

function logLatestPilotEvent(state: TrainerDemoState) {
  const event = state.pilotEvents.at(-1);
  if (event) logPilotEvent(event);
}

function logPilotEvent(event: TrainerPilotEvent) {
  if (process.env.NODE_ENV !== "production") console.info("[trainer-pilot]", event);
}

function logPilotError(errorCode: string) {
  if (process.env.NODE_ENV !== "production") console.warn("[trainer-pilot]", { name: "error_encountered", errorCode });
}
