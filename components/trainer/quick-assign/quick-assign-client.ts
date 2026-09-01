import type { QuickAssignReadModel } from "@/lib/server/quick-assign/quick-assign-types";
import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";
import type { WorkoutAssignment } from "@/lib/server/workouts/workout-types";
import type { QuickAssignCommandPayload } from "./quick-assign-state";

export class QuickAssignHttpError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly existingAssignmentId: string | null = null,
  ) {
    super(code);
  }
}

export type QuickAssignPersistedResponse = {
  ok: true;
  assignment: WorkoutAssignment;
  transition: TrainerWorkflowTransition;
};

export async function loadQuickAssignModel(input: {
  athleteUserId: string;
  query?: string;
  cursor?: string | null;
  templateRevisionId?: string | null;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({ first: "25" });
  if (input.query) params.set("query", input.query);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.templateRevisionId) params.set("templateRevisionId", input.templateRevisionId);
  const response = await fetch(`/api/trainer/athletes/${input.athleteUserId}/quick-assign?${params}`, {
    cache: "no-store",
    signal: input.signal,
  });
  const body = await readBody(response);
  if (!response.ok || !body.quickAssign) {
    throw new QuickAssignHttpError(body.error ?? "temporarily_unavailable", response.status);
  }
  return body.quickAssign as QuickAssignReadModel;
}

export async function submitQuickAssignment(payload: QuickAssignCommandPayload) {
  const response = await fetch("/api/workout-assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readBody(response);
  if (!response.ok || !body.assignment || !body.transition) {
    const existing = body.existingAssignment;
    throw new QuickAssignHttpError(
      body.error ?? "temporarily_unavailable",
      response.status,
      existing && typeof existing === "object" && typeof existing.assignmentId === "string"
        ? existing.assignmentId
        : null,
    );
  }
  return body as QuickAssignPersistedResponse;
}

async function readBody(response: Response) {
  return response.json().catch(() => ({})) as Promise<{
    error?: string;
    quickAssign?: QuickAssignReadModel;
    assignment?: WorkoutAssignment;
    transition?: TrainerWorkflowTransition;
    existingAssignment?: { assignmentId?: string };
  }>;
}
