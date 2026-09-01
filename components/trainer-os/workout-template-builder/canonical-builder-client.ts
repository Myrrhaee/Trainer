import type { WorkoutTemplateDraft } from "./builder-model";

type TemplateResponse = {
  template: WorkoutTemplateDraft;
  replay: boolean;
  outcome: string;
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "request_failed");
  }
  return response;
}

function commandId() {
  return crypto.randomUUID();
}

function persistedIdentity(template: WorkoutTemplateDraft) {
  const templateId = /^[0-9a-f-]{36}$/i.test(template.id) ? template.id : crypto.randomUUID();
  const revisionId = template.revisionId && /^[0-9a-f-]{36}$/i.test(template.revisionId)
    ? template.revisionId
    : crypto.randomUUID();
  return { templateId, revisionId };
}

export async function loadCanonicalBuilderTemplates() {
  const response = await request("/api/trainer/workout-builder/templates");
  return (await response.json() as { templates: WorkoutTemplateDraft[] }).templates;
}

export async function saveCanonicalBuilderDraft(template: WorkoutTemplateDraft) {
  const identity = persistedIdentity(template);
  const body = JSON.stringify({
    commandId: commandId(),
    templateId: identity.templateId,
    revisionId: identity.revisionId,
    expectedEditToken: template.editToken ?? null,
    content: { ...template, id: identity.templateId, revisionId: identity.revisionId },
  });
  const response = await request("/api/trainer/workout-builder/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return (await response.json() as TemplateResponse).template;
}

export async function publishCanonicalBuilderTemplate(template: WorkoutTemplateDraft) {
  if (!template.revisionId || !template.editToken) throw new Error("editable_draft_not_persisted");
  const response = await request(`/api/trainer/workout-builder/templates/${template.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: commandId(),
      revisionId: template.revisionId,
      expectedEditToken: template.editToken,
    }),
  });
  return (await response.json() as TemplateResponse).template;
}

export async function createCanonicalBuilderRevision(template: WorkoutTemplateDraft) {
  const response = await request(`/api/trainer/workout-builder/templates/${template.id}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: commandId(), expectedTemplateToken: template.templateToken ?? null }),
  });
  return (await response.json() as TemplateResponse).template;
}

export async function duplicateCanonicalBuilderTemplate(template: WorkoutTemplateDraft, title: string) {
  const response = await request("/api/trainer/workout-builder/templates/duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: commandId(),
      sourceTemplateId: template.id,
      sourceRevisionIntent: template.status === "published" ? "published" : "latest_saved",
      newTemplateId: crypto.randomUUID(),
      newRevisionId: crypto.randomUUID(),
      title,
    }),
  });
  return (await response.json() as TemplateResponse).template;
}

export async function archiveCanonicalBuilderTemplate(template: WorkoutTemplateDraft) {
  const response = await request(`/api/trainer/workout-builder/templates/${template.id}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: commandId(), expectedTemplateToken: template.templateToken ?? null }),
  });
  return (await response.json() as TemplateResponse).template;
}
