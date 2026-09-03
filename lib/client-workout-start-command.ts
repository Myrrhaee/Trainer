import type { ClientWorkoutExecutionReadModel } from "@/lib/server/client-workouts/client-workout-types";

export type ClientWorkoutStartAttempt = {
  commandId: string;
  assignmentId: string;
  clientTimezone: string;
  startedAt: string;
};

export function createClientWorkoutStartAttempt(input: {
  assignmentId: string;
  clientTimezone: string;
  commandId?: string;
  startedAt?: string;
}): ClientWorkoutStartAttempt {
  return {
    assignmentId: input.assignmentId,
    clientTimezone: input.clientTimezone,
    commandId: input.commandId ?? crypto.randomUUID(),
    startedAt: input.startedAt ?? new Date().toISOString(),
  };
}

export function reconcileClientWorkoutStart(
  attempt: ClientWorkoutStartAttempt,
  execution: ClientWorkoutExecutionReadModel,
): "accept" | "replay" | "conflict" {
  if (execution.assignment.assignmentId !== attempt.assignmentId) return "conflict";
  if (execution.session?.assignmentId === attempt.assignmentId) return "accept";
  return execution.assignment.capabilities.canStart ? "replay" : "conflict";
}
