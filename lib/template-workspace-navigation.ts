import type { TemplateWorkspaceLifecycleFilter } from "@/lib/template-workspace-contract";

export const TEMPLATE_WORKSPACE_MAX_RESTORE_PAGES = 5;

const lifecycleFilters = new Set<TemplateWorkspaceLifecycleFilter>([
  "all",
  "drafts",
  "published",
  "updates",
  "archive",
]);
const allowedKeys = new Set(["status", "q", "category", "page", "anchor"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TemplateWorkspaceUrlState = {
  status: TemplateWorkspaceLifecycleFilter;
  q: string;
  category: string;
  page: number;
  anchor: string | null;
};

export type ParsedTemplateWorkspaceUrlState = {
  state: TemplateWorkspaceUrlState;
  invalidStatus: boolean;
  invalidPage: boolean;
  invalidAnchor: boolean;
};

type SearchReader = Pick<URLSearchParams, "get">;

export function parseTemplateWorkspaceUrlState(search: SearchReader): ParsedTemplateWorkspaceUrlState {
  const rawStatus = search.get("status")?.trim() ?? "";
  const status = lifecycleFilters.has(rawStatus as TemplateWorkspaceLifecycleFilter)
    ? rawStatus as TemplateWorkspaceLifecycleFilter
    : "all";
  const rawPage = search.get("page")?.trim() ?? "";
  const parsedPage = rawPage === "" ? 1 : Number(rawPage);
  const validPage = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= TEMPLATE_WORKSPACE_MAX_RESTORE_PAGES;
  const rawAnchor = search.get("anchor")?.trim() || null;
  const validAnchor = rawAnchor === null || uuidPattern.test(rawAnchor);
  return {
    state: {
      status,
      q: normalizeBounded(search.get("q"), 200),
      category: normalizeBounded(search.get("category"), 120),
      page: validPage ? parsedPage : 1,
      anchor: validPage && validAnchor ? rawAnchor : null,
    },
    invalidStatus: rawStatus !== "" && !lifecycleFilters.has(rawStatus as TemplateWorkspaceLifecycleFilter),
    invalidPage: rawPage !== "" && !validPage,
    invalidAnchor: rawAnchor !== null && !validAnchor,
  };
}

export function templateWorkspaceHref(state: Partial<TemplateWorkspaceUrlState> = {}) {
  const params = new URLSearchParams();
  if (state.status && state.status !== "all") params.set("status", state.status);
  if (state.q?.trim()) params.set("q", normalizeBounded(state.q, 200));
  if (state.category?.trim()) params.set("category", normalizeBounded(state.category, 120));
  if (state.page && state.page > 1) params.set("page", String(Math.min(state.page, TEMPLATE_WORKSPACE_MAX_RESTORE_PAGES)));
  if (state.anchor && uuidPattern.test(state.anchor)) params.set("anchor", state.anchor);
  const query = params.toString();
  return query ? `/trainer/templates?${query}` : "/trainer/templates";
}

export function safeTemplateWorkspaceReturnPath(value: string | null | undefined) {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value, "http://trainer.local");
    if (url.origin !== "http://trainer.local" || url.pathname !== "/trainer/templates") return null;
    if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) return null;
    const parsed = parseTemplateWorkspaceUrlState(url.searchParams);
    if (parsed.invalidStatus || parsed.invalidPage || parsed.invalidAnchor) return null;
    return templateWorkspaceHref(parsed.state);
  } catch {
    return null;
  }
}

export function templateWorkspaceReturnWithAnchor(value: string | null | undefined, anchor: string | null | undefined) {
  const safe = safeTemplateWorkspaceReturnPath(value);
  if (!safe || !anchor || !uuidPattern.test(anchor)) return safe;
  const url = new URL(safe, "http://trainer.local");
  return templateWorkspaceHref({ ...parseTemplateWorkspaceUrlState(url.searchParams).state, anchor });
}

export function templateWorkspaceBuilderHref(input: {
  mode: "create" | "editable" | "published" | "archived";
  templateId?: string;
  returnState: TemplateWorkspaceUrlState;
}) {
  const params = new URLSearchParams({ returnTo: templateWorkspaceHref(input.returnState) });
  if (input.mode === "create") return `/trainer/builder/new?${params.toString()}`;
  if (!input.templateId || !uuidPattern.test(input.templateId)) throw new Error("invalid_template_workspace_builder_target");
  if (input.mode === "published") params.set("view", "published");
  if (input.mode === "archived") params.set("view", "archived");
  return `/trainer/builder/${input.templateId}?${params.toString()}`;
}

function normalizeBounded(value: string | null | undefined, max: number) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}
