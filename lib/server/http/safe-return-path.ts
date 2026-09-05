export function safeReturnPath(value: unknown, fallback = "/auth/continue") {
  if (
    typeof value !== "string"
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.length > 2_048
  ) {
    return fallback;
  }
  return value;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cursor = /^[\w-]{1,2048}$/;
const collectionKeys = new Set(["currentStart", "currentDepth", "historyStart", "historyDepth"]);

export function safeAuthReturnPath(value: unknown, fallback = "/auth/continue") {
  const basic = safeReturnPath(value, fallback);
  if (basic === fallback || !basic.startsWith("/client")) return basic;

  try {
    const url = new URL(basic, "https://client.invalid");
    if (url.origin !== "https://client.invalid") return fallback;
    if (url.pathname === "/client/me") {
      return !url.search && ["", "#recent-feedback"].includes(url.hash)
        ? url.pathname + url.hash
        : fallback;
    }
    if (url.pathname !== "/client/workouts") return fallback;
    if (hasDuplicateParams(url.searchParams)) return fallback;

    const assignmentId = url.searchParams.get("assignment");
    const sessionId = url.searchParams.get("session");
    const isExact = assignmentId !== null || sessionId !== null;
    if (isExact) {
      const allowed = new Set(["assignment", "session", "feedback", "returnTo"]);
      if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return fallback;
      if (Boolean(assignmentId) === Boolean(sessionId)) return fallback;
      if (!uuid.test(assignmentId ?? sessionId ?? "")) return fallback;
      const feedbackId = url.searchParams.get("feedback");
      if (feedbackId !== null && (!sessionId || !uuid.test(feedbackId))) return fallback;
      const returnTo = url.searchParams.get("returnTo");
      if (returnTo !== null && !isSafeClientCollectionReturn(returnTo)) return fallback;
      if (url.hash) return fallback;
      return url.pathname + url.search;
    }

    if ([...url.searchParams.keys()].some((key) => !collectionKeys.has(key))) return fallback;
    if (!validPaginationPair(url.searchParams, "currentStart", "currentDepth")) return fallback;
    if (!validPaginationPair(url.searchParams, "historyStart", "historyDepth")) return fallback;
    if (!isCollectionAnchor(url.hash)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

function hasDuplicateParams(params: URLSearchParams) {
  return [...new Set(params.keys())].some((key) => params.getAll(key).length !== 1);
}

function validPaginationPair(params: URLSearchParams, startKey: string, depthKey: string) {
  const start = params.get(startKey);
  const depth = params.get(depthKey);
  if ((start === null) !== (depth === null)) return false;
  if (start === null) return true;
  return cursor.test(start) && /^[1-9]\d*$/.test(depth ?? "") && Number.isSafeInteger(Number(depth));
}

function isCollectionAnchor(value: string) {
  return value === ""
    || value === "#history"
    || value === "#current-workouts"
    || (value.startsWith("#workout-") && uuid.test(value.slice(9)))
    || (value.startsWith("#current-workout-") && uuid.test(value.slice(17)));
}

function isSafeClientCollectionReturn(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return false;
  const url = new URL(value, "https://client.invalid");
  if (url.origin !== "https://client.invalid") return false;
  if (url.pathname === "/client/me") {
    return !url.search && ["", "#recent-feedback"].includes(url.hash);
  }
  if (
    url.pathname !== "/client/workouts"
    || hasDuplicateParams(url.searchParams)
    || [...url.searchParams.keys()].some((key) => !collectionKeys.has(key))
    || !validPaginationPair(url.searchParams, "currentStart", "currentDepth")
    || !validPaginationPair(url.searchParams, "historyStart", "historyDepth")
  ) return false;
  return isCollectionAnchor(url.hash);
}
