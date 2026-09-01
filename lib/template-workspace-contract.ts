export type TemplateWorkspaceLifecycle =
  | "draft_only"
  | "published_only"
  | "published_with_draft"
  | "archived";

export type TemplateWorkspaceLifecycleFilter =
  | "all"
  | "drafts"
  | "published"
  | "updates"
  | "archive";

export type TemplateWorkspaceRevisionSummary = {
  revisionId: string;
  revisionNumber: number;
  status: "draft" | "published";
  title: string;
  category: string;
  exerciseCount: number;
  prescribedSetCount: number;
  estimatedDurationMin: number | null;
  updatedAt: string;
  publishedAt: string | null;
  publicationAvailability: "not_published" | "assignable" | "historical";
};

export type TemplateWorkspaceAnomaly =
  | "lifecycle_pointer_mismatch"
  | "editable_revision_missing"
  | "published_revision_missing"
  | "summary_revision_unavailable"
  | "duplicate_revision_pointer"
  | "invalid_revision_status"
  | "count_unavailable";

export type TemplateWorkspaceCapabilities = {
  canOpen: boolean;
  canContinueDraft: boolean;
  canViewPublished: boolean;
  canCreateRevision: boolean;
  canDuplicate: boolean;
  canArchive: boolean;
  canOpenArchived: boolean;
};

export type TemplateWorkspaceItem = {
  templateId: string;
  lifecycle: TemplateWorkspaceLifecycle;
  primaryRevision: TemplateWorkspaceRevisionSummary | null;
  editableRevision: TemplateWorkspaceRevisionSummary | null;
  publishedRevision: TemplateWorkspaceRevisionSummary | null;
  archived: boolean;
  meaningfulUpdatedAt: string;
  capabilities: TemplateWorkspaceCapabilities;
  actionPreconditions: {
    lifecycleActionToken: string | null;
    duplicateSource: {
      intent: "editable" | "published" | "latest_saved";
      revisionId: string;
    } | null;
  };
  matchContext: {
    query: "primary" | "published_secondary" | "both" | null;
    category: "primary" | "published_secondary" | "both" | null;
  };
  anomalies: TemplateWorkspaceAnomaly[];
};

export type TemplateWorkspaceReadModel = {
  actor: {
    trainerUserId: string;
    capabilities: {
      canRead: true;
      canCreateTemplate: true;
    };
  };
  filters: {
    lifecycle: TemplateWorkspaceLifecycleFilter;
    query: string;
    category: string;
    sort: "meaningful_updated_desc";
    pageSize: number;
  };
  items: TemplateWorkspaceItem[];
  facets: {
    availability: "exact";
    lifecycle: {
      all: number;
      drafts: number;
      published: number;
      updates: number;
      archive: number;
    };
    categories: Array<{ key: string; label: string; count: number }>;
    categoryOptionsTruncated: boolean;
  };
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  resultCount: { availability: "exact"; value: number };
  dataAvailability: "ready" | "empty";
  readAt: string;
};
