import { Buffer } from "node:buffer";

export class ClientHistoryInputError extends Error {}
export const historyUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type HistoryKey = { at: string; id: string };
export type HistoryCursor = {
  v: 1;
  domain: "client-history";
  actor: string;
  upper: HistoryKey;
  after: HistoryKey | null;
};

function validKey(value: unknown): value is HistoryKey {
  if (!value || typeof value !== "object") return false;
  const key = value as HistoryKey;
  return (
    typeof key.id === "string" &&
    historyUuid.test(key.id) &&
    typeof key.at === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(key.at) &&
    Number.isFinite(Date.parse(key.at)) &&
    new Date(key.at).toISOString().slice(0, 23) === key.at.slice(0, 23)
  );
}

export function encodeHistoryCursor(cursor: HistoryCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeHistoryCursor(
  value: string,
  actor: string,
  purpose: "start" | "after",
): HistoryCursor {
  try {
    if (!value || value.length > 2048 || !/^[\w-]+$/.test(value))
      throw new Error();
    const cursor = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as HistoryCursor;
    if (
      cursor.v !== 1 ||
      cursor.domain !== "client-history" ||
      cursor.actor !== actor ||
      !validKey(cursor.upper) ||
      (purpose === "start" ? cursor.after !== null : !validKey(cursor.after))
    )
      throw new Error();
    if (
      cursor.after &&
      (cursor.after.at > cursor.upper.at ||
        (cursor.after.at === cursor.upper.at &&
          cursor.after.id > cursor.upper.id))
    )
      throw new Error();
    return cursor;
  } catch {
    throw new ClientHistoryInputError("invalid_history_cursor");
  }
}

export function historyLimit(value?: unknown) {
  if (value === undefined) return 10;
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    Number(value) > 30
  )
    throw new ClientHistoryInputError("invalid_history_limit");
  return Number(value);
}
