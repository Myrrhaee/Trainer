import type { ClientWorkoutHistoryItem } from "@/lib/server/client-workouts/client-history-types";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cursor = /^[\w-]{1,2048}$/;
export type HistoryNavigation = {
  start: string | null;
  depth: number;
  anchor: string;
  invalid: boolean;
};

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
  const anchor =
    url.hash === "#history" ||
    (url.hash.startsWith("#workout-") && uuid.test(url.hash.slice(9)))
      ? url.hash
      : "#history";
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
) {
  const query = start
    ? `?${new URLSearchParams({ historyStart: start, historyDepth: String(depth) })}`
    : "";
  return `/client/workouts${query}${anchor}`;
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
        (key) => !["historyStart", "historyDepth"].includes(key),
      )
    )
      return fallback;
    // Preserve invalid pagination metadata for the collection's explicit history-only reset notice.
    return url.pathname + url.search + readHistoryNavigation(url).anchor;
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
