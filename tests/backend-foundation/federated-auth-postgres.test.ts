import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import {
  createFederatedFlowId,
  createFederatedNonce,
  createFederatedState,
  hashFederatedValue,
} from "../../lib/server/auth/federated/federated-crypto";
import type { FederatedAuthConfig } from "../../lib/server/auth/federated/federated-config";
import { PostgresFederatedAuthRepository } from "../../lib/server/auth/federated/federated-repository";
import { FederatedAuthService } from "../../lib/server/auth/federated/federated-service";
import type {
  FederatedIdentityProof,
  FederatedIntent,
  FederatedProvider,
} from "../../lib/server/auth/federated/federated-types";
import { PostgresSessionRepository } from "../../lib/server/auth/session-repository";
import { SessionService } from "../../lib/server/auth/session-service";

const connectionString = process.env.TEST_DATABASE_URL;
const secret = Buffer.alloc(32, 23);

function googleProof(subject: string, email = "same@example.test"): FederatedIdentityProof {
  return {
    provider: "google",
    subject,
    emailOriginal: email,
    emailNormalized: email.toLowerCase(),
    displayName: "Google Test User",
    metadata: { emailVerified: true },
  };
}

async function createFlow(
  repository: PostgresFederatedAuthRepository,
  input: {
    provider: FederatedProvider;
    intent?: FederatedIntent;
    actorUserId?: string | null;
    sessionId?: string | null;
    requestIp?: string;
  },
) {
  const id = createFederatedFlowId();
  const state = createFederatedState();
  const nonce = createFederatedNonce();
  const created = await repository.createFlow({
    id,
    provider: input.provider,
    intent: input.intent ?? "login",
    stateHash: hashFederatedValue(secret, "state", state),
    nonceHash: hashFederatedValue(secret, "nonce", nonce),
    requestIpHash: hashFederatedValue(
      secret,
      "request-ip",
      input.requestIp ?? `test-request-${crypto.randomUUID()}`,
    ),
    actorUserId: input.actorUserId ?? null,
    sessionId: input.sessionId ?? null,
    expiresAt: new Date(Date.now() + 600_000),
    rateWindowSeconds: 900,
    maxRequestsPerIp: 20,
  });
  assert.equal(created, true);
  return { id, state, nonce };
}

test("federated login resolves stable subjects and never silently merges matching email", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  const repository = new PostgresFederatedAuthRepository(pool);
  const subject = `google-${crypto.randomUUID()}`;
  const email = `collision-${crypto.randomUUID()}@example.test`;

  try {
    const emailUser = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status) VALUES ('active') RETURNING id",
    );
    await pool.query(
      `INSERT INTO app_private.auth_identities (
         user_id, provider, provider_subject, email_original, email_normalized, verified_at
       ) VALUES ($1, 'email_otp', $2, $2, $2, clock_timestamp())`,
      [emailUser.rows[0].id, email],
    );

    const firstFlow = await createFlow(repository, { provider: "google" });
    const first = await repository.complete({
      flowId: firstFlow.id,
      proof: googleProof(subject, email),
      actorUserId: null,
      sessionId: null,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.isNewUser, true);
    assert.notEqual(first.userId, emailUser.rows[0].id);

    const replay = await repository.complete({
      flowId: firstFlow.id,
      proof: googleProof(subject, email),
      actorUserId: null,
      sessionId: null,
    });
    assert.deepEqual(replay, { ok: false, reason: "invalid_flow" });

    const returningFlow = await createFlow(repository, { provider: "google" });
    const returning = await repository.complete({
      flowId: returningFlow.id,
      proof: googleProof(subject, email),
      actorUserId: null,
      sessionId: null,
    });
    assert.equal(returning.ok, true);
    if (returning.ok) {
      assert.equal(returning.userId, first.userId);
      assert.equal(returning.isNewUser, false);
    }
  } finally {
    await pool.end();
  }
});

test("link flow is session-bound, rejects identity theft and supports safe unlink", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  const repository = new PostgresFederatedAuthRepository(pool);
  const sessions = new SessionService(
    new PostgresSessionRepository(pool),
    { idleTtlSeconds: 600, absoluteTtlSeconds: 3_600 },
  );
  const subject = `linked-${crypto.randomUUID()}`;

  try {
    const ownerLogin = await createFlow(repository, { provider: "google" });
    const owner = await repository.complete({
      flowId: ownerLogin.id,
      proof: googleProof(subject),
      actorUserId: null,
      sessionId: null,
    });
    assert.equal(owner.ok, true);
    if (!owner.ok) return;

    const secondUser = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status) VALUES ('active') RETURNING id",
    );
    const emailIdentity = await pool.query<{ id: string }>(
      `INSERT INTO app_private.auth_identities (
         user_id, provider, provider_subject, email_original, email_normalized, verified_at
       ) VALUES ($1, 'email_otp', $2, $2, $2, clock_timestamp()) RETURNING id`,
      [secondUser.rows[0].id, `second-${crypto.randomUUID()}@example.test`],
    );
    const session = await sessions.issue(secondUser.rows[0].id);
    const linkFlow = await createFlow(repository, {
      provider: "google",
      intent: "link",
      actorUserId: secondUser.rows[0].id,
      sessionId: session.session.id,
    });

    const wrongSession = await repository.complete({
      flowId: linkFlow.id,
      proof: googleProof(`fresh-${crypto.randomUUID()}`),
      actorUserId: secondUser.rows[0].id,
      sessionId: crypto.randomUUID(),
    });
    assert.deepEqual(wrongSession, { ok: false, reason: "invalid_flow" });

    const conflict = await repository.complete({
      flowId: linkFlow.id,
      proof: googleProof(subject),
      actorUserId: secondUser.rows[0].id,
      sessionId: session.session.id,
    });
    assert.deepEqual(conflict, { ok: false, reason: "identity_conflict" });

    const freshLink = await createFlow(repository, {
      provider: "telegram",
      intent: "link",
      actorUserId: secondUser.rows[0].id,
      sessionId: session.session.id,
    });
    const telegramProof: FederatedIdentityProof = {
      provider: "telegram",
      subject: `telegram-${crypto.randomUUID()}`,
      emailOriginal: null,
      emailNormalized: null,
      displayName: "Telegram Test User",
      metadata: { username: "test_user" },
    };
    const linked = await repository.complete({
      flowId: freshLink.id,
      proof: telegramProof,
      actorUserId: secondUser.rows[0].id,
      sessionId: session.session.id,
    });
    assert.equal(linked.ok, true);
    if (!linked.ok) return;

    assert.equal((await repository.unlinkIdentity(secondUser.rows[0].id, linked.identityId)).ok, true);
    assert.deepEqual(
      await repository.unlinkIdentity(secondUser.rows[0].id, emailIdentity.rows[0].id),
      { ok: false, reason: "last_identity" },
    );
  } finally {
    await pool.end();
  }
});

test("parallel federated starts cannot race past the per-IP limit", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 6 });
  const repository = new PostgresFederatedAuthRepository(pool);
  const requestIpHash = hashFederatedValue(
    secret,
    "request-ip",
    `parallel-ip-${crypto.randomUUID()}`,
  );

  try {
    const results = await Promise.all(Array.from({ length: 5 }, () => {
      const state = createFederatedState();
      const nonce = createFederatedNonce();
      return repository.createFlow({
        id: createFederatedFlowId(),
        provider: "google",
        intent: "login",
        stateHash: hashFederatedValue(secret, "state", state),
        nonceHash: hashFederatedValue(secret, "nonce", nonce),
        requestIpHash,
        actorUserId: null,
        sessionId: null,
        expiresAt: new Date(Date.now() + 600_000),
        rateWindowSeconds: 900,
        maxRequestsPerIp: 2,
      });
    }));
    assert.equal(results.filter(Boolean).length, 2);
  } finally {
    await pool.end();
  }
});

test("Telegram Mini App flow rejects replay before resolving the canonical identity", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 3 });
  const repository = new PostgresFederatedAuthRepository(pool);
  const replayHash = hashFederatedValue(secret, "mini-app-replay", crypto.randomUUID());
  const requestIpHash = hashFederatedValue(secret, "request-ip", crypto.randomUUID());
  const firstFlowId = createFederatedFlowId();

  try {
    const first = await repository.createTelegramMiniAppFlow({
      id: firstFlowId,
      replayHash,
      authDateHash: hashFederatedValue(secret, "auth-date", new Date().toISOString()),
      requestIpHash,
      expiresAt: new Date(Date.now() + 600_000),
      rateWindowSeconds: 900,
      maxRequestsPerIp: 20,
    });
    assert.equal(first, "created");

    const replay = await repository.createTelegramMiniAppFlow({
      id: createFederatedFlowId(),
      replayHash,
      authDateHash: hashFederatedValue(secret, "auth-date", new Date().toISOString()),
      requestIpHash,
      expiresAt: new Date(Date.now() + 600_000),
      rateWindowSeconds: 900,
      maxRequestsPerIp: 20,
    });
    assert.equal(replay, "replayed");

    const completed = await repository.complete({
      flowId: firstFlowId,
      proof: {
        provider: "telegram",
        subject: `mini-app-${crypto.randomUUID()}`,
        emailOriginal: null,
        emailNormalized: null,
        displayName: "Mini App Athlete",
        metadata: { source: "mini_app" },
      },
      actorUserId: null,
      sessionId: null,
    });
    assert.equal(completed.ok, true);
    if (completed.ok) assert.equal(completed.isNewUser, true);
  } finally {
    await pool.end();
  }
});

test("configured starts produce Google nonce context and Telegram OIDC PKCE URL", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 3 });
  const repository = new PostgresFederatedAuthRepository(pool);
  const sessions = new SessionService(
    new PostgresSessionRepository(pool),
    { idleTtlSeconds: 600, absoluteTtlSeconds: 3_600 },
  );
  const config: FederatedAuthConfig = {
    flowTtlSeconds: 600,
    rateWindowSeconds: 900,
    maxRequestsPerIp: 20,
    secret,
    googleClientId: "google-client.apps.googleusercontent.com",
    telegramClientId: "telegram-client-id",
    telegramClientSecret: "telegram-client-secret",
    publicOrigin: "https://coach.example.test",
  };
  const service = new FederatedAuthService(repository, sessions, config);

  try {
    const google = await service.start({
      provider: "google",
      intent: "login",
      actor: null,
      requestIp: `google-start-${crypto.randomUUID()}`,
      requestOrigin: "http://localhost:3000",
    });
    assert.equal(google.ok, true);
    if (google.ok && google.provider === "google") {
      assert.equal(google.clientId, config.googleClientId);
      assert.match(google.nonce, /^[A-Za-z0-9_-]{43}$/);
    }

    const telegram = await service.start({
      provider: "telegram",
      intent: "login",
      actor: null,
      requestIp: `telegram-start-${crypto.randomUUID()}`,
      requestOrigin: "http://localhost:3000",
    });
    assert.equal(telegram.ok, true);
    if (telegram.ok && telegram.provider === "telegram") {
      const authorizationUrl = new URL(telegram.authorizationUrl);
      assert.equal(authorizationUrl.origin, "https://oauth.telegram.org");
      assert.equal(authorizationUrl.pathname, "/auth");
      assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
      assert.equal(
        authorizationUrl.searchParams.get("scope"),
        "openid profile telegram:bot_access",
      );
      assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
      assert.ok(authorizationUrl.searchParams.get("state"));
      assert.ok(authorizationUrl.searchParams.get("nonce"));
      assert.ok(authorizationUrl.searchParams.get("code_challenge"));
      assert.equal(
        authorizationUrl.searchParams.get("redirect_uri"),
        "https://coach.example.test/api/auth/telegram/callback",
      );
      assert.equal(authorizationUrl.searchParams.has("phone"), false);
    }
  } finally {
    await pool.end();
  }
});
