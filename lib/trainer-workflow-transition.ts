export const TRAINER_WORKFLOW_CONTEXT_PARAM = "flow";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const origins = new Set(["profile", "dashboard", "clients", "review", "direct"] as const);
const tabs = new Set(["training"] as const);
const queueFilters = new Set(["all", "review", "assignment"] as const);
const queueOrders = new Set(["priority"] as const);
const anchors = new Set(["workflow-receipt", "latest-feedback", "next-assignment", "pending-reviews"] as const);

export type TrainerWorkflowOrigin = "profile" | "dashboard" | "clients" | "review" | "direct";
export type TrainerWorkflowQueueFilter = "all" | "review" | "assignment";
export type TrainerWorkflowReturnAnchor = "workflow-receipt" | "latest-feedback" | "next-assignment" | "pending-reviews";

export type TrainerWorkflowContext = {
  version: 1;
  origin: TrainerWorkflowOrigin;
  athleteUserId?: string;
  tab: "training";
  sourceAttentionItemId?: string;
  sourceSessionId?: string;
  queue?: {
    filter: TrainerWorkflowQueueFilter;
    order: "priority";
    position?: number;
  };
  returnTo?: string;
  returnAnchor?: TrainerWorkflowReturnAnchor;
};

export type TrainerWorkflowNextItem = {
  kind: "review" | "assignment";
  athleteUserId: string;
  athleteDisplayName: string;
  href: string;
};

export type TrainerWorkflowTransition = {
  context: TrainerWorkflowContext;
  profileHref: string;
  queueHref: string;
  returnHref: string;
  nextItem: TrainerWorkflowNextItem | null;
  allCalm: boolean;
  result: {
    kind: "review" | "assignment" | "manual_resolution" | "current";
    entityId: string;
    athleteUserId: string;
    sessionId?: string;
    title: string;
    detail: string;
    resolutionState?: "resolved" | "already_resolved" | "not_applicable";
    deliveryWarning?: string;
  };
  refreshWarning?: string;
};

export function createTrainerWorkflowContext(
  value: Partial<Omit<TrainerWorkflowContext, "version" | "tab">> & Pick<TrainerWorkflowContext, "origin">,
): TrainerWorkflowContext {
  return normalizeTrainerWorkflowContext({ ...value, version: 1, tab: "training" }) ?? {
    version: 1,
    origin: "direct",
    tab: "training",
  };
}

export function encodeTrainerWorkflowContext(context: TrainerWorkflowContext) {
  return JSON.stringify(context);
}

export function decodeTrainerWorkflowContext(value: unknown): TrainerWorkflowContext | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    return normalizeTrainerWorkflowContext(JSON.parse(value));
  } catch {
    return null;
  }
}

export function trainerWorkflowHref(path: string, context: TrainerWorkflowContext) {
  const url = new URL(path, "http://trainer.local");
  url.searchParams.set(TRAINER_WORKFLOW_CONTEXT_PARAM, encodeTrainerWorkflowContext(context));
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function safeTrainerWorkflowDestination(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, "http://trainer.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://trainer.local" || url.username || url.password) return null;
  const profileMatch = url.pathname.match(/^\/trainer\/clients\/([0-9a-f-]{36})$/i);
  const allowedPath = url.pathname === "/trainer/dashboard"
    || url.pathname === "/trainer/attention"
    || url.pathname === "/trainer/clients"
    || Boolean(profileMatch && UUID_PATTERN.test(profileMatch[1]));
  if (!allowedPath) return null;

  const allowedKeys = profileMatch
    ? new Set(["tab", "from", "attentionItem", "focus", "receipt", "receiptId"])
    : new Set(["filter", "order", "position", "focus", "receipt", "receiptId"]);
  for (const key of url.searchParams.keys()) {
    if (!allowedKeys.has(key)) return null;
  }
  if (profileMatch && url.searchParams.has("tab") && url.searchParams.get("tab") !== "training") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeTrainerWorkflowContext(value: unknown): TrainerWorkflowContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !origins.has(input.origin as TrainerWorkflowOrigin) || !tabs.has(input.tab as "training")) return null;
  if (input.athleteUserId !== undefined && !isUuid(input.athleteUserId)) return null;
  if (input.sourceAttentionItemId !== undefined && !isUuid(input.sourceAttentionItemId)) return null;
  if (input.sourceSessionId !== undefined && !isUuid(input.sourceSessionId)) return null;
  if (input.returnAnchor !== undefined && !anchors.has(input.returnAnchor as TrainerWorkflowReturnAnchor)) return null;

  let queue: TrainerWorkflowContext["queue"];
  if (input.queue !== undefined) {
    if (!input.queue || typeof input.queue !== "object" || Array.isArray(input.queue)) return null;
    const rawQueue = input.queue as Record<string, unknown>;
    if (!queueFilters.has(rawQueue.filter as TrainerWorkflowQueueFilter) || !queueOrders.has(rawQueue.order as "priority")) return null;
    if (rawQueue.position !== undefined && (!Number.isInteger(rawQueue.position) || Number(rawQueue.position) < 0 || Number(rawQueue.position) > 10_000)) return null;
    queue = {
      filter: rawQueue.filter as TrainerWorkflowQueueFilter,
      order: "priority",
      position: rawQueue.position === undefined ? undefined : Number(rawQueue.position),
    };
  }

  return {
    version: 1,
    origin: input.origin as TrainerWorkflowOrigin,
    athleteUserId: input.athleteUserId as string | undefined,
    tab: "training",
    sourceAttentionItemId: input.sourceAttentionItemId as string | undefined,
    sourceSessionId: input.sourceSessionId as string | undefined,
    queue,
    returnTo: safeTrainerWorkflowDestination(input.returnTo) ?? undefined,
    returnAnchor: input.returnAnchor as TrainerWorkflowReturnAnchor | undefined,
  };
}
