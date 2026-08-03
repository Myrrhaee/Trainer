import "server-only";

import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "asc_s1_";
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^asc_s1_[A-Za-z0-9_-]{43}$/;

export function createOpaqueSessionToken() {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function isPlausibleSessionToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}
