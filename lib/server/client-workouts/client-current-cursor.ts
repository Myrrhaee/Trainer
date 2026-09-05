import { Buffer } from "node:buffer";

export class ClientCurrentInputError extends Error {}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClientCurrentKey = {
  bucket: 0 | 1;
  scheduledFor: string;
  createdAt: string;
  assignmentId: string;
};

export type ClientCurrentCursor = {
  v: 1;
  domain: "client-current-workouts";
  actor: string;
  upper: ClientCurrentKey;
  after: ClientCurrentKey | null;
};

function validKey(value: unknown): value is ClientCurrentKey {
  if (!value || typeof value !== "object") return false;
  const key = value as ClientCurrentKey;
  return (
    (key.bucket === 0 || key.bucket === 1) &&
    /^\d{4}-\d\d-\d\d$/.test(key.scheduledFor) &&
    Number.isFinite(Date.parse(`${key.scheduledFor}T00:00:00Z`)) &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(key.createdAt) &&
    Number.isFinite(Date.parse(key.createdAt)) &&
    new Date(key.createdAt).toISOString().slice(0, 23) ===
      key.createdAt.slice(0, 23) &&
    uuid.test(key.assignmentId)
  );
}

function compareKey(left: ClientCurrentKey, right: ClientCurrentKey) {
  if (left.bucket !== right.bucket) return left.bucket - right.bucket;
  if (left.scheduledFor !== right.scheduledFor)
    return left.scheduledFor < right.scheduledFor ? -1 : 1;
  if (left.createdAt !== right.createdAt)
    return left.createdAt < right.createdAt ? -1 : 1;
  return left.assignmentId.localeCompare(right.assignmentId);
}

export function encodeClientCurrentCursor(cursor: ClientCurrentCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeClientCurrentCursor(
  value: string,
  actor: string,
  purpose: "start" | "after",
) {
  try {
    if (!value || value.length > 2048 || !/^[\w-]+$/.test(value))
      throw new Error();
    const cursor = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as ClientCurrentCursor;
    if (
      cursor.v !== 1 ||
      cursor.domain !== "client-current-workouts" ||
      cursor.actor !== actor ||
      !validKey(cursor.upper) ||
      (purpose === "start" ? cursor.after !== null : !validKey(cursor.after)) ||
      (cursor.after !== null && compareKey(cursor.after, cursor.upper) < 0)
    )
      throw new Error();
    return cursor;
  } catch {
    throw new ClientCurrentInputError("invalid_current_cursor");
  }
}

export function clientCurrentAdvanced(
  previous: ClientCurrentKey,
  next: ClientCurrentKey,
) {
  return compareKey(next, previous) > 0;
}
