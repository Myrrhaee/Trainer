import assert from "node:assert/strict";
import test from "node:test";

import { GoogleIdentityAdapter } from "../../lib/server/auth/federated/google-adapter";
import { TelegramIdentityAdapter } from "../../lib/server/auth/federated/telegram-adapter";
import {
  createFederatedNonce,
  createPkceChallenge,
  createPkceVerifier,
  decryptFlowCookie,
  encryptFlowCookie,
  hashFederatedValue,
} from "../../lib/server/auth/federated/federated-crypto";

test("federated state, PKCE and encrypted callback cookie are scoped and tamper-evident", () => {
  const secret = Buffer.alloc(32, 19);
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);
  const nonce = createFederatedNonce();
  const encrypted = encryptFlowCookie(secret, {
    flowId: crypto.randomUUID(),
    nonce,
    pkceVerifier: verifier,
  });

  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(decryptFlowCookie(secret, encrypted)?.nonce, nonce);
  assert.equal(decryptFlowCookie(Buffer.alloc(32, 20), encrypted), null);
  const encryptedParts = encrypted.split(".");
  const ciphertext = encryptedParts[2];
  const middle = Math.floor(ciphertext.length / 2);
  encryptedParts[2] = `${ciphertext.slice(0, middle)}${ciphertext[middle] === "a" ? "b" : "a"}${ciphertext.slice(middle + 1)}`;
  assert.equal(decryptFlowCookie(secret, encryptedParts.join(".")), null);
  assert.equal(hashFederatedValue(secret, "state", nonce).byteLength, 32);
  assert.equal(
    hashFederatedValue(secret, "state", nonce).equals(
      hashFederatedValue(secret, "nonce", nonce),
    ),
    false,
  );
});

test("Google adapter requires the expected nonce and uses sub as identity key", async () => {
  const nonce = createFederatedNonce();
  const verifier = {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          sub: "google-stable-subject",
          nonce,
          email: "User@Example.COM",
          email_verified: true,
          name: "  Test   User  ",
          hd: "example.com",
          locale: "ru",
        }),
      };
    },
  };
  const adapter = new GoogleIdentityAdapter("client-id", verifier as never);
  const proof = await adapter.verify("signed-token", nonce);

  assert.equal(proof?.subject, "google-stable-subject");
  assert.equal(proof?.emailNormalized, "user@example.com");
  assert.equal(proof?.displayName, "Test User");
  assert.equal(await adapter.verify("signed-token", "wrong-nonce"), null);
});

test("Telegram adapter uses the stable Telegram user ID and rejects a nonce mismatch", async () => {
  const nonce = createFederatedNonce();
  const dependencies = {
    fetch: async () => new Response(JSON.stringify({
      id_token: "signed-telegram-token",
      scope: "openid profile telegram:bot_access",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    verifyJwt: async () => ({
      sub: "42424242",
      id: 81818181,
      nonce,
      exp: Math.floor(Date.now() / 1_000) + 300,
      iat: Math.floor(Date.now() / 1_000),
      name: "Telegram User",
      preferred_username: "strength_user",
    }),
  };
  const adapter = new TelegramIdentityAdapter({
    clientId: "telegram-client",
    clientSecret: "telegram-secret",
    redirectUri: "https://example.test/api/auth/telegram/callback",
  }, dependencies as never);
  const proof = await adapter.exchangeAndVerify("code", createPkceVerifier(), nonce);

  assert.equal(proof?.subject, "81818181");
  assert.equal(proof?.metadata.oidcSubject, "42424242");
  assert.equal(proof?.metadata.botAccessGranted, true);
  assert.equal(proof?.metadata.username, "strength_user");
  assert.equal(
    await adapter.exchangeAndVerify("code", createPkceVerifier(), "wrong-nonce"),
    null,
  );
});
