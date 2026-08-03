import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpaqueSessionToken,
  hashSessionToken,
  isPlausibleSessionToken,
} from "../../lib/server/auth/session-crypto";

test("opaque session tokens are versioned, random and never persisted raw", () => {
  const first = createOpaqueSessionToken();
  const second = createOpaqueSessionToken();

  assert.notEqual(first, second);
  assert.equal(isPlausibleSessionToken(first), true);
  assert.equal(hashSessionToken(first).byteLength, 32);
  assert.equal(hashSessionToken(first).equals(hashSessionToken(first)), true);
  assert.equal(hashSessionToken(first).equals(hashSessionToken(second)), false);
});

test("malformed session tokens are rejected before repository access", () => {
  assert.equal(isPlausibleSessionToken(""), false);
  assert.equal(isPlausibleSessionToken("asc_s1_short"), false);
  assert.equal(isPlausibleSessionToken("asc_s2_" + "a".repeat(43)), false);
  assert.equal(isPlausibleSessionToken("asc_s1_" + "/".repeat(43)), false);
});
