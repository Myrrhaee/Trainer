import type { ExerciseDetailReadModel, ExerciseLibraryReadModel } from "@/lib/exercise-library-contract";
import type { WorkoutTemplateEditorIssue, WorkoutTemplateEditorReadModel, WorkoutTemplateEditorViewIntent } from "@/lib/workout-template-editor-contract";

export class EditorRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly issues: WorkoutTemplateEditorIssue[] = [],
    public readonly uncertain = false,
  ) {
    super(code);
  }
}

async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new EditorRequestError("network_error", 0, [], true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; issues?: WorkoutTemplateEditorIssue[] };
    throw new EditorRequestError(body.error ?? "request_failed", response.status, body.issues ?? [], response.status >= 500);
  }
  return response;
}

export async function readExactEditor(templateId: string, view: WorkoutTemplateEditorViewIntent = "default") {
  const params = view === "default" ? "" : `?view=${view}`;
  const response = await request(`/api/trainer/workout-builder/templates/${templateId}/editor${params}`);
  return (await response.json() as { editor: WorkoutTemplateEditorReadModel }).editor;
}

export async function saveEditorDraft(input: {
  commandId: string;
  templateId: string;
  revisionId: string;
  expectedEditToken: string | null;
  content: unknown;
}) {
  const response = await request("/api/trainer/workout-builder/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json() as { template: { id: string; revisionId: string }; replay: boolean; outcome: string };
}

export async function publishEditorDraft(input: {
  commandId: string;
  templateId: string;
  revisionId: string;
  expectedEditToken: string;
}) {
  const response = await request(`/api/trainer/workout-builder/templates/${input.templateId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: input.commandId, revisionId: input.revisionId, expectedEditToken: input.expectedEditToken }),
  });
  return await response.json() as { template: { id: string; revisionId: string }; replay: boolean; outcome: string };
}

export async function createEditorRevision(input: { templateId: string; commandId: string; expectedTemplateToken: string | null }) {
  const response = await request(`/api/trainer/workout-builder/templates/${input.templateId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: input.commandId, expectedTemplateToken: input.expectedTemplateToken }),
  });
  return await response.json() as { template: { id: string; revisionId: string }; replay: boolean; outcome: string };
}

export async function fetchExerciseLibrary(search: URLSearchParams) {
  const response = await request(`/api/trainer/exercises?${search.toString()}`);
  return (await response.json() as { exerciseLibrary: ExerciseLibraryReadModel }).exerciseLibrary;
}

export async function fetchExerciseDetail(exerciseId: string) {
  const response = await request(`/api/trainer/exercises/${exerciseId}`);
  return (await response.json() as { exercise: ExerciseDetailReadModel }).exercise;
}
