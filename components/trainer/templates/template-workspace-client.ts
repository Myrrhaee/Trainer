import type { TemplateWorkspaceReadModel } from "@/lib/template-workspace-contract";

type PersistedTemplate = { id: string; revisionId: string; title: string };
type CommandResult = { template: PersistedTemplate; replay: boolean; outcome: string };

export class TemplateWorkspaceRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function fetchTemplateWorkspace(input: {
  status: string;
  q: string;
  category: string;
  cursor?: string | null;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({ status: input.status, limit: "25" });
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.cursor) params.set("cursor", input.cursor);
  const response = await fetch(`/api/trainer/workout-builder/workspace?${params.toString()}`, {
    cache: "no-store",
    signal: input.signal,
  });
  if (!response.ok) throw await requestError(response);
  return (await response.json() as { templateWorkspace: TemplateWorkspaceReadModel }).templateWorkspace;
}

export function createTemplateRevision(input: {
  templateId: string;
  commandId: string;
  expectedTemplateToken: string | null;
}) {
  return command(`/api/trainer/workout-builder/templates/${input.templateId}/revisions`, {
    commandId: input.commandId,
    expectedTemplateToken: input.expectedTemplateToken,
  });
}

export function duplicateTemplate(input: {
  commandId: string;
  sourceTemplateId: string;
  sourceRevisionIntent: "editable" | "published" | "latest_saved";
  newTemplateId: string;
  newRevisionId: string;
  title: string;
}) {
  return command("/api/trainer/workout-builder/templates/duplicate", input);
}

export function archiveTemplate(input: {
  templateId: string;
  commandId: string;
  expectedTemplateToken: string | null;
}) {
  return command(`/api/trainer/workout-builder/templates/${input.templateId}/archive`, {
    commandId: input.commandId,
    expectedTemplateToken: input.expectedTemplateToken,
  });
}

async function command(path: string, body: object): Promise<CommandResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await requestError(response);
  return response.json() as Promise<CommandResult>;
}

async function requestError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return new TemplateWorkspaceRequestError(response.status, body.error ?? "temporarily_unavailable");
}
