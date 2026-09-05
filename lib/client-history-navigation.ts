import type { ClientWorkoutHistoryItem } from "@/lib/server/client-workouts/client-history-types";
import type { ClientWorkoutAssignmentReadModel } from "@/lib/server/client-workouts/client-workout-types";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cursor = /^[\w-]{1,2048}$/;
export type HistoryNavigation = {
  start: string | null;
  depth: number;
  anchor: string;
  invalid: boolean;
};

export type CurrentWorkoutNavigation = {
  start: string | null;
  depth: number;
  anchor: string;
  invalid: boolean;
};

const collectionKeys = [
  "currentStart",
  "currentDepth",
  "historyStart",
  "historyDepth",
] as const;

function collectionAnchor(value: string) {
  return (
    value === "" ||
    value === "#history" ||
    value === "#current-workouts" ||
    (value.startsWith("#workout-") && uuid.test(value.slice(9))) ||
    (value.startsWith("#current-workout-") && uuid.test(value.slice(17)))
  );
}

function preservedCollectionQuery(base?: URL) {
  const query = new URLSearchParams();
  if (!base) return query;
  for (const key of collectionKeys) {
    const values = base.searchParams.getAll(key);
    if (values.length === 1) query.set(key, values[0]);
  }
  return query;
}

export function readHistoryNavigation(url: URL): HistoryNavigation {
  const start = url.searchParams.get("historyStart");
  const rawDepth = url.searchParams.get("historyDepth");
  const depth = rawDepth === null ? 1 : Number(rawDepth);
  const invalid =
    url.searchParams.getAll("historyStart").length > 1 ||
    url.searchParams.getAll("historyDepth").length > 1 ||
    (start === null) !== (rawDepth === null) ||
    (start !== null && !cursor.test(start)) ||
    (rawDepth !== null &&
      (!/^[1-9]\d*$/.test(rawDepth) || !Number.isSafeInteger(depth)));
  const historyAnchor =
    url.hash === "#history" ||
    (url.hash.startsWith("#workout-") && uuid.test(url.hash.slice(9)))
      ? url.hash
      : null;
  const anchor = historyAnchor ?? (collectionAnchor(url.hash) ? url.hash : "");
  return {
    start: invalid ? null : start,
    depth: invalid ? 1 : depth,
    anchor,
    invalid,
  };
}

export function historyCollectionUrl(
  start: string | null,
  depth: number,
  anchor = "#history",
  base?: URL,
) {
  const query = preservedCollectionQuery(base);
  query.delete("historyStart");
  query.delete("historyDepth");
  if (start) {
    query.set("historyStart", start);
    query.set("historyDepth", String(depth));
  }
  const search = query.size ? `?${query}` : "";
  return `/client/workouts${search}${collectionAnchor(anchor) ? anchor : ""}`;
}

export function readCurrentWorkoutNavigation(url: URL): CurrentWorkoutNavigation {
  const start = url.searchParams.get("currentStart");
  const rawDepth = url.searchParams.get("currentDepth");
  const depth = rawDepth === null ? 1 : Number(rawDepth);
  const invalid =
    url.searchParams.getAll("currentStart").length > 1 ||
    url.searchParams.getAll("currentDepth").length > 1 ||
    (start === null) !== (rawDepth === null) ||
    (start !== null && !cursor.test(start)) ||
    (rawDepth !== null &&
      (!/^[1-9]\d*$/.test(rawDepth) || !Number.isSafeInteger(depth)));
  const currentAnchor =
    url.hash === "#current-workouts" ||
    (url.hash.startsWith("#current-workout-") && uuid.test(url.hash.slice(17)))
      ? url.hash
      : null;
  return {
    start: invalid ? null : start,
    depth: invalid ? 1 : depth,
    anchor: currentAnchor ?? (collectionAnchor(url.hash) ? url.hash : ""),
    invalid,
  };
}

export function currentWorkoutCollectionUrl(
  start: string | null,
  depth: number,
  anchor = "#current-workouts",
  base?: URL,
) {
  const query = preservedCollectionQuery(base);
  query.delete("currentStart");
  query.delete("currentDepth");
  if (start) {
    query.set("currentStart", start);
    query.set("currentDepth", String(depth));
  }
  const search = query.size ? `?${query}` : "";
  return `/client/workouts${search}${collectionAnchor(anchor) ? anchor : ""}`;
}

export function replaceClientWorkoutCollectionUrl(value: string) {
  window.history.replaceState(window.history.state, "", value);
  window.dispatchEvent(new Event("client-workout-navigation"));
}

export function safeClientReturn(value: string | undefined) {
  const fallback = "/client/workouts#history";
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://client.invalid");
    if (url.origin !== "https://client.invalid") return fallback;
    if (
      url.pathname === "/client/me" &&
      !url.search &&
      ["", "#recent-feedback"].includes(url.hash)
    )
      return url.pathname + url.hash;
    if (
      url.pathname !== "/client/workouts" ||
      [...url.searchParams.keys()].some(
        (key) => !(collectionKeys as readonly string[]).includes(key),
      ) ||
      !collectionAnchor(url.hash)
    )
      return fallback;
    // Preserve invalid scope metadata so the collection can show a scope-local reset notice.
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function appendHistory(
  previous: ClientWorkoutHistoryItem[],
  page: ClientWorkoutHistoryItem[],
) {
  const merged = new Map(previous.map((item) => [item.sessionId, item]));
  for (const item of page) merged.set(item.sessionId, item);
  return [...merged.values()];
}

export function appendCurrentWorkouts(
  previous: ClientWorkoutAssignmentReadModel[],
  page: ClientWorkoutAssignmentReadModel[],
) {
  const assignments = new Map(
    previous.map((item) => [item.assignmentId, item]),
  );
  const sessions = new Set(
    previous.flatMap((item) =>
      item.session ? [item.session.sessionId] : [],
    ),
  );
  for (const item of page) {
    if (assignments.has(item.assignmentId)) {
      assignments.set(item.assignmentId, item);
      continue;
    }
    if (item.session && sessions.has(item.session.sessionId)) continue;
    assignments.set(item.assignmentId, item);
    if (item.session) sessions.add(item.session.sessionId);
  }
  return [...assignments.values()];
}
