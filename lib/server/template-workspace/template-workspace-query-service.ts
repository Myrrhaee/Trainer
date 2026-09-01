import "server-only";

import type { TemplateWorkspaceReadModel } from "@/lib/template-workspace-contract";
import type { Actor } from "@/lib/server/database/actor-context";
import {
  decodeTemplateWorkspaceCursor,
  encodeTemplateWorkspaceCursor,
} from "./template-workspace-cursor";
import { TemplateWorkspaceRepository } from "./template-workspace-repository";
import {
  TemplateWorkspaceValidationError,
  type NormalizedTemplateWorkspaceInput,
  type TemplateWorkspaceFindInput,
} from "./template-workspace-types";

const lifecycleFilters = ["all", "drafts", "published", "updates", "archive"] as const;

export class TemplateWorkspaceQueryService {
  constructor(private readonly repository = new TemplateWorkspaceRepository()) {}

  async list(
    actor: Actor,
    raw: TemplateWorkspaceFindInput = {},
  ): Promise<TemplateWorkspaceReadModel> {
    const input = normalizeTemplateWorkspaceInput(raw);
    const cursorScope = {
      trainerUserId: actor.userId,
      lifecycle: input.lifecycle,
      query: input.query,
      category: input.category,
      sort: "meaningful_updated_desc" as const,
    };
    const cursor = input.after
      ? decodeTemplateWorkspaceCursor(input.after, cursorScope)
      : null;
    const page = await this.repository.list(actor, input, cursor);
    const endCursor = page.hasNextPage && page.last
      ? encodeTemplateWorkspaceCursor({
          ...cursorScope,
          meaningfulUpdatedAt: page.last.meaningful_updated_at.toISOString(),
          templateId: page.last.template_id,
        })
      : null;
    const lifecycle = {
      all: page.facets.drafts + page.facets.published + page.facets.updates,
      drafts: page.facets.drafts,
      published: page.facets.published,
      updates: page.facets.updates,
      archive: page.facets.archive,
    };
    return {
      actor: {
        trainerUserId: actor.userId,
        capabilities: { canRead: true, canCreateTemplate: true },
      },
      filters: {
        lifecycle: input.lifecycle,
        query: input.query,
        category: input.category,
        sort: "meaningful_updated_desc",
        pageSize: input.first,
      },
      items: page.items,
      facets: {
        availability: "exact",
        lifecycle,
        categories: page.facets.categories,
        categoryOptionsTruncated: page.facets.categoryOptionsTruncated,
      },
      pageInfo: { endCursor, hasNextPage: page.hasNextPage },
      resultCount: { availability: "exact", value: lifecycle[input.lifecycle] },
      dataAvailability: page.items.length === 0 ? "empty" : "ready",
      readAt: page.readAt,
    };
  }
}

export function normalizeTemplateWorkspaceInput(
  raw: TemplateWorkspaceFindInput = {},
): NormalizedTemplateWorkspaceInput {
  const lifecycle = (raw.status ?? "all").trim() || "all";
  const query = normalizeText(raw.query, 200);
  const category = normalizeText(raw.category, 120);
  const first = raw.first ?? 25;
  if (!lifecycleFilters.includes(lifecycle as (typeof lifecycleFilters)[number])) {
    throw new TemplateWorkspaceValidationError();
  }
  if (!Number.isInteger(first) || first < 1 || first > 50) {
    throw new TemplateWorkspaceValidationError();
  }
  const after = raw.after?.trim() || null;
  if (after && after.length > 4096) throw new TemplateWorkspaceValidationError();
  return {
    lifecycle: lifecycle as NormalizedTemplateWorkspaceInput["lifecycle"],
    query,
    category,
    first,
    after,
  };
}

function normalizeText(value: string | null | undefined, max: number) {
  const result = (value ?? "").trim().replace(/\s+/g, " ");
  if (result.length > max || result.includes("\0")) throw new TemplateWorkspaceValidationError();
  return result.toLocaleLowerCase("ru-RU");
}
