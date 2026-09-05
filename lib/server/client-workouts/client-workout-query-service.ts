import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { WorkoutSessionRepository } from "@/lib/server/workout-sessions/workout-session-repository";
import { ClientWorkoutRepository } from "./client-workout-repository";
import type { ClientWorkoutExecutionReadModel } from "./client-workout-types";

export class ClientWorkoutInputError extends Error {}

export function clientWorkoutId(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ClientWorkoutInputError("workout_unavailable");
  }
  return value;
}

export class ClientWorkoutQueryService {
  constructor(
    private readonly workouts = new ClientWorkoutRepository(),
    private readonly sessions = new WorkoutSessionRepository(),
  ) {}

  collection(actor: Actor, input: { start?: string; after?: string } = {}) {
    return this.workouts.listCurrent(actor, input);
  }

  async execution(actor: Actor, input: { assignmentId?: unknown; sessionId?: unknown; completionCommandId?: string; completionFingerprint?: string }): Promise<ClientWorkoutExecutionReadModel | null> {
    const requestedAssignmentId = input.assignmentId === undefined ? null : clientWorkoutId(input.assignmentId);
    const requestedSessionId = input.sessionId === undefined ? null : clientWorkoutId(input.sessionId);
    if (!requestedAssignmentId && !requestedSessionId) throw new ClientWorkoutInputError("workout_unavailable");

    const correlation = input.completionCommandId !== undefined || input.completionFingerprint !== undefined
      ? { commandId: clientWorkoutId(input.completionCommandId), fingerprint: input.completionFingerprint ?? "" } : undefined;
    if (correlation && (!requestedSessionId || !/^[a-f0-9]{64}$/.test(correlation.fingerprint))) throw new ClientWorkoutInputError("workout_unavailable");
    const session = requestedSessionId ? await this.sessions.find(actor, requestedSessionId, correlation) : null;
    if (requestedSessionId && !session) return null;
    const assignmentId = requestedAssignmentId ?? session?.assignmentId ?? null;
    if (!assignmentId || (session && requestedAssignmentId && session.assignmentId !== requestedAssignmentId)) return null;

    const assignment = await this.workouts.findAssignment(actor, assignmentId);
    if (!assignment) return null;
    if (requestedSessionId && assignment.session?.sessionId !== requestedSessionId) return null;

    const exactSession = session ?? (assignment.session
      ? await this.sessions.find(actor, assignment.session.sessionId)
      : null);
    const active = exactSession?.status === "active";
    return {
      identity: {
        assignmentId: assignment.assignmentId,
        sessionId: exactSession?.id ?? null,
        athleteUserId: assignment.athleteUserId,
      },
      assignment,
      session: exactSession,
      capabilities: {
        canEdit: active,
        canSkip: active,
        canResume: active,
        canEnterCompletionFlow: active,
      },
    };
  }
}
