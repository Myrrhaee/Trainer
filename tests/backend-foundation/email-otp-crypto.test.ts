import assert from "node:assert/strict";
import test from "node:test";

import {
  createChallengeId,
  createEmailOtpCode,
  hashOtpSecret,
  hashOtpTarget,
  isEmailOtpCode,
} from "../../lib/server/auth/email/email-otp-crypto";
import { normalizeEmail } from "../../lib/server/auth/email/email-normalization";

test("email normalization is stable and rejects malformed input", () => {
  assert.deepEqual(normalizeEmail("  User@Example.COM "), {
    original: "User@Example.COM",
    normalized: "user@example.com",
  });
  assert.equal(normalizeEmail("missing-at.example.com"), null);
  assert.equal(normalizeEmail("two@@example.com"), null);
  assert.equal(normalizeEmail("a@b"), null);
});

test("OTP codes and HMAC values are scoped to challenge and target", () => {
  const pepper = Buffer.alloc(32, 7);
  const challengeId = createChallengeId();
  const code = createEmailOtpCode();

  assert.equal(isEmailOtpCode(code), true);
  assert.equal(hashOtpTarget(pepper, "a@example.com").byteLength, 32);
  assert.equal(
    hashOtpSecret(pepper, challengeId, "a@example.com", code).equals(
      hashOtpSecret(pepper, challengeId, "a@example.com", code),
    ),
    true,
  );
  assert.equal(
    hashOtpSecret(pepper, challengeId, "a@example.com", code).equals(
      hashOtpSecret(pepper, createChallengeId(), "a@example.com", code),
    ),
    false,
  );
});
