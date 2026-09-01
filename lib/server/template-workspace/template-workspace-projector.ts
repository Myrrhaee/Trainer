import type {
  TemplateWorkspaceAnomaly,
  TemplateWorkspaceCapabilities,
  TemplateWorkspaceLifecycle,
} from "@/lib/template-workspace-contract";

export type TemplateLifecycleProjectionInput = {
  templateStatus: "draft" | "published" | "archived";
  archivedAt: string | null;
  editableRevisionId: string | null;
  editableRevisionStatus: "draft" | "published" | null;
  publishedRevisionId: string | null;
  publishedRevisionStatus: "draft" | "published" | null;
};

export function projectTemplateLifecycle(input: TemplateLifecycleProjectionInput): {
  lifecycle: TemplateWorkspaceLifecycle;
  anomalies: TemplateWorkspaceAnomaly[];
} {
  const anomalies: TemplateWorkspaceAnomaly[] = [];
  const archived = input.templateStatus === "archived" || input.archivedAt !== null;
  const hasEditablePointer = input.editableRevisionId !== null;
  const hasPublishedPointer = input.publishedRevisionId !== null;

  if ((input.templateStatus === "archived") !== (input.archivedAt !== null)) {
    anomalies.push("lifecycle_pointer_mismatch");
  }
  if (hasEditablePointer && input.editableRevisionStatus === null) {
    anomalies.push("editable_revision_missing");
  } else if (hasEditablePointer && input.editableRevisionStatus !== "draft") {
    anomalies.push("invalid_revision_status");
  }
  if (hasPublishedPointer && input.publishedRevisionStatus === null) {
    anomalies.push("published_revision_missing");
  } else if (hasPublishedPointer && input.publishedRevisionStatus !== "published") {
    anomalies.push("invalid_revision_status");
  }
  if (
    hasEditablePointer
    && hasPublishedPointer
    && input.editableRevisionId === input.publishedRevisionId
  ) {
    anomalies.push("duplicate_revision_pointer");
  }
  if (!archived) {
    const expectedStatus = hasPublishedPointer ? "published" : "draft";
    if (input.templateStatus !== expectedStatus || (!hasEditablePointer && !hasPublishedPointer)) {
      anomalies.push("lifecycle_pointer_mismatch");
    }
  }

  const lifecycle: TemplateWorkspaceLifecycle = archived
    ? "archived"
    : hasPublishedPointer && hasEditablePointer
      ? "published_with_draft"
      : hasPublishedPointer
        ? "published_only"
        : "draft_only";
  return { lifecycle, anomalies: [...new Set(anomalies)] };
}

export function projectTemplateWorkspaceCapabilities(input: {
  lifecycle: TemplateWorkspaceLifecycle;
  hasPrimaryRevision: boolean;
  hasEditableRevision: boolean;
  hasPublishedRevision: boolean;
  anomalies: TemplateWorkspaceAnomaly[];
}): TemplateWorkspaceCapabilities {
  const readable = input.hasPrimaryRevision;
  if (input.anomalies.length > 0) {
    return {
      canOpen: readable,
      canContinueDraft: false,
      canViewPublished: input.hasPublishedRevision,
      canCreateRevision: false,
      canDuplicate: false,
      canArchive: false,
      canOpenArchived: input.lifecycle === "archived" && readable,
    };
  }
  return {
    canOpen: readable,
    canContinueDraft: input.lifecycle !== "archived" && input.hasEditableRevision,
    canViewPublished: input.hasPublishedRevision,
    canCreateRevision: input.lifecycle === "published_only",
    canDuplicate: readable,
    canArchive: input.lifecycle !== "archived" && readable,
    canOpenArchived: input.lifecycle === "archived" && readable,
  };
}
