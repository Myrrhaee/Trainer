import { randomUUID } from "node:crypto";

import type { Actor } from "../../lib/server/database/actor-context";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import { workoutTemplateRequestFingerprint } from "../../lib/server/workouts/workout-template-command-crypto";
import type { BuilderTemplate, SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";

export async function saveBuilderDraft(
  repository: WorkoutBuilderRepository,
  actor: Actor,
  content: SaveBuilderTemplateInput,
) {
  const existing = content.id
    ? (await repository.list(actor)).find((template) => template.id === content.id)
    : null;
  const input = {
    commandId: randomUUID(),
    templateId: existing?.id ?? content.id ?? randomUUID(),
    revisionId: existing?.revisionId ?? randomUUID(),
    expectedEditToken: existing?.editToken ?? null,
    content,
  };
  return (await repository.saveDraft(actor, {
    ...input,
    requestFingerprint: workoutTemplateRequestFingerprint(input),
  })).template;
}

export async function publishBuilderDraft(
  repository: WorkoutBuilderRepository,
  actor: Actor,
  templateId: string,
) {
  const template = (await repository.list(actor)).find((item) => item.id === templateId);
  if (!template) throw new Error("editable_draft_not_found");
  const input = {
    commandId: randomUUID(),
    templateId,
    revisionId: template.editableRevision?.revisionId
      ?? template.latestPublishedRevision?.revisionId
      ?? template.revisionId,
    expectedEditToken: template.editToken ?? "already-published",
  };
  return (await repository.publish(actor, {
    ...input,
    requestFingerprint: workoutTemplateRequestFingerprint(input),
  })).template;
}

export async function createBuilderRevision(
  repository: WorkoutBuilderRepository,
  actor: Actor,
  templateId: string,
) {
  const input = {
    commandId: randomUUID(),
    templateId,
    expectedTemplateToken: null,
  };
  return (await repository.createRevision(actor, {
    ...input,
    requestFingerprint: workoutTemplateRequestFingerprint(input),
  })).template;
}

export async function archiveBuilderTemplate(
  repository: WorkoutBuilderRepository,
  actor: Actor,
  templateId: string,
) {
  const template = (await repository.list(actor)).find((item) => item.id === templateId);
  const input = {
    commandId: randomUUID(),
    templateId,
    expectedTemplateToken: template?.templateToken ?? null,
  };
  return (await repository.archive(actor, {
    ...input,
    requestFingerprint: workoutTemplateRequestFingerprint(input),
  })).template;
}

export function requireBuilderTemplate(value: BuilderTemplate | null | undefined) {
  if (!value) throw new Error("builder_template_required");
  return value;
}
