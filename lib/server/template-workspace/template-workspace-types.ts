import type { TemplateWorkspaceLifecycleFilter } from "@/lib/template-workspace-contract";

export type TemplateWorkspaceFindInput = {
  status?: string | null;
  query?: string | null;
  category?: string | null;
  after?: string | null;
  first?: number;
};

export type NormalizedTemplateWorkspaceInput = {
  lifecycle: TemplateWorkspaceLifecycleFilter;
  query: string;
  category: string;
  first: number;
  after: string | null;
};

export class TemplateWorkspaceValidationError extends Error {
  constructor() {
    super("invalid_filter");
  }
}
