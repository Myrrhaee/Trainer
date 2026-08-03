import type { WorkoutTemplateDraft } from "./builder-model";

type TemplateResponse = { template: WorkoutTemplateDraft };

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "request_failed");
  }
  return response;
}

export async function loadCanonicalBuilderTemplates() {
  const response = await request("/api/trainer/workout-builder/templates");
  return (await response.json() as { templates: WorkoutTemplateDraft[] }).templates;
}

export async function saveCanonicalBuilderDraft(template: WorkoutTemplateDraft) {
  const response = await request("/api/trainer/workout-builder/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
  return (await response.json() as TemplateResponse).template;
}

export async function publishCanonicalBuilderTemplate(template: WorkoutTemplateDraft) {
  const saved = /^[0-9a-f-]{36}$/i.test(template.id)
    ? template
    : await saveCanonicalBuilderDraft(template);
  const response = await request(`/api/trainer/workout-builder/templates/${saved.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saved),
  });
  return (await response.json() as TemplateResponse).template;
}

export async function createCanonicalBuilderRevision(templateId: string) {
  const response = await request(`/api/trainer/workout-builder/templates/${templateId}/revisions`, { method: "POST" });
  return (await response.json() as TemplateResponse).template;
}

export async function archiveCanonicalBuilderTemplate(templateId: string) {
  const response = await request(`/api/trainer/workout-builder/templates/${templateId}/archive`, { method: "POST" });
  return (await response.json() as TemplateResponse).template;
}
