import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import type { EmailOtpConfig } from "../../lib/server/auth/email/email-otp-config";
import { MemoryEmailOtpDelivery } from "../../lib/server/auth/email/email-otp-delivery";
import { PostgresEmailOtpRepository } from "../../lib/server/auth/email/email-otp-repository";
import { EmailOtpService } from "../../lib/server/auth/email/email-otp-service";
import { PostgresSessionRepository } from "../../lib/server/auth/session-repository";
import { SessionService } from "../../lib/server/auth/session-service";

const connectionString = process.env.TEST_DATABASE_URL;

function config(overrides: Partial<EmailOtpConfig> = {}): EmailOtpConfig {
  return {
    challengeTtlSeconds: 600,
    resendCooldownSeconds: 0,
    rateWindowSeconds: 900,
    maxRequestsPerTarget: 10,
    maxRequestsPerIp: 20,
    maxAttempts: 5,
    pepper: Buffer.alloc(32, 11),
    ...overrides,
  };
}

function service(pool: Pool, overrides: Partial<EmailOtpConfig> = {}) {
  const delivery = new MemoryEmailOtpDelivery();
  const sessions = new SessionService(
    new PostgresSessionRepository(pool),
    { idleTtlSeconds: 60, absoluteTtlSeconds: 600 },
  );
  return {
    delivery,
    sessions,
    otp: new EmailOtpService(
      new PostgresEmailOtpRepository(pool),
      delivery,
      sessions,
      config(overrides),
    ),
  };
}

test("new and returning email users resolve to one identity and replay fails", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 2 });
  const auth = service(pool);
  const email = `returning-${crypto.randomUUID()}@example.test`;

  try {
    const firstChallenge = await auth.otp.request(email, "192.0.2.1");
    const firstCode = auth.delivery.developmentCode(firstChallenge.challengeId);
    assert.ok(firstCode);

    const first = await auth.otp.verify({
      challengeId: firstChallenge.challengeId,
      email,
      code: firstCode,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.isNewUser, true);
    assert.equal((await auth.sessions.authenticate(first.issued.token))?.userId.length, 36);

    const replay = await auth.otp.verify({
      challengeId: firstChallenge.challengeId,
      email,
      code: firstCode,
    });
    assert.equal(replay.ok, false);

    const secondChallenge = await auth.otp.request(email.toUpperCase(), "192.0.2.1");
    const secondCode = auth.delivery.developmentCode(secondChallenge.challengeId);
    assert.ok(secondCode);
    const second = await auth.otp.verify({
      challengeId: secondChallenge.challengeId,
      email: email.toUpperCase(),
      code: secondCode,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.isNewUser, false);

    const identities = await pool.query<{ user_id: string; count: number }>(
      `SELECT min(user_id::text)::uuid AS user_id, count(*)::integer AS count
       FROM app_private.auth_identities
       WHERE provider = 'email_otp' AND provider_subject = $1
       GROUP BY provider_subject`,
      [email.toLowerCase()],
    );
    assert.equal(identities.rows[0].count, 1);
    assert.equal(identities.rows[0].user_id, first.issued.session.userId);
    assert.equal(second.issued.session.userId, first.issued.session.userId);
  } finally {
    await pool.end();
  }
});

test("attempt exhaustion, expiry and resend invalidation fail closed", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 2 });

  try {
    const attempts = service(pool, { maxAttempts: 2 });
    const attemptsEmail = `attempts-${crypto.randomUUID()}@example.test`;
    const attemptChallenge = await attempts.otp.request(attemptsEmail, "192.0.2.2");
    const actualCode = attempts.delivery.developmentCode(attemptChallenge.challengeId);
    assert.ok(actualCode);
    for (let index = 0; index < 2; index += 1) {
      const result = await attempts.otp.verify({
        challengeId: attemptChallenge.challengeId,
        email: attemptsEmail,
        code: actualCode === "000000" ? "111111" : "000000",
      });
      assert.equal(result.ok, false);
    }
    assert.equal((await attempts.otp.verify({
      challengeId: attemptChallenge.challengeId,
      email: attemptsEmail,
      code: actualCode,
    })).ok, false);

    const expiring = service(pool, { challengeTtlSeconds: 1 });
    const expiryEmail = `expiry-${crypto.randomUUID()}@example.test`;
    const expiryChallenge = await expiring.otp.request(expiryEmail, "192.0.2.3");
    const expiryCode = expiring.delivery.developmentCode(expiryChallenge.challengeId);
    assert.ok(expiryCode);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.equal((await expiring.otp.verify({
      challengeId: expiryChallenge.challengeId,
      email: expiryEmail,
      code: expiryCode,
    })).ok, false);

    const resend = service(pool);
    const resendEmail = `resend-${crypto.randomUUID()}@example.test`;
    const oldChallenge = await resend.otp.request(resendEmail, "192.0.2.4");
    const oldCode = resend.delivery.developmentCode(oldChallenge.challengeId);
    const newChallenge = await resend.otp.request(resendEmail, "192.0.2.4");
    const newCode = resend.delivery.developmentCode(newChallenge.challengeId);
    assert.ok(oldCode && newCode);
    assert.equal((await resend.otp.verify({
      challengeId: oldChallenge.challengeId,
      email: resendEmail,
      code: oldCode,
    })).ok, false);
    assert.equal((await resend.otp.verify({
      challengeId: newChallenge.challengeId,
      email: resendEmail,
      code: newCode,
    })).ok, true);
  } finally {
    await pool.end();
  }
});

test("request limits return a generic challenge without delivering another code", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 2 });
  const auth = service(pool, { maxRequestsPerTarget: 1 });
  const email = `limited-${crypto.randomUUID()}@example.test`;

  try {
    const accepted = await auth.otp.request(email, "192.0.2.5");
    const limited = await auth.otp.request(email, "192.0.2.5");
    assert.ok(auth.delivery.developmentCode(accepted.challengeId));
    assert.equal(auth.delivery.developmentCode(limited.challengeId), null);
    assert.equal(typeof limited.challengeId, "string");
    assert.ok(limited.retryAfterSeconds >= 0);
  } finally {
    await pool.end();
  }
});

test("parallel requests cannot race past the per-IP limit", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 5 });
  const auth = service(pool, { maxRequestsPerIp: 2 });
  const ipAddress = `parallel-ip-${crypto.randomUUID()}`;

  try {
    const challenges = await Promise.all(
      Array.from({ length: 4 }, (_, index) => auth.otp.request(
        `parallel-${index}-${crypto.randomUUID()}@example.test`,
        ipAddress,
      )),
    );
    const delivered = challenges.filter((challenge) => (
      auth.delivery.developmentCode(challenge.challengeId) !== null
    ));
    assert.equal(delivered.length, 2);
  } finally {
    await pool.end();
  }
});

test("authenticated users can link email explicitly and the session rotates", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 3 });
  const auth = service(pool);
  const email = `linked-email-${crypto.randomUUID()}@example.test`;

  try {
    const user = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status) VALUES ('active') RETURNING id",
    );
    await pool.query(
      `INSERT INTO app_private.auth_identities (
         user_id, provider, provider_subject, verified_at
       ) VALUES ($1, 'google', $2, clock_timestamp())`,
      [user.rows[0].id, `google-${crypto.randomUUID()}`],
    );
    const initialSession = await auth.sessions.issue(user.rows[0].id);
    const actor = await auth.sessions.authenticate(initialSession.token);
    assert.ok(actor);

    const challenge = await auth.otp.request(
      email,
      `link-ip-${crypto.randomUUID()}`,
      { intent: "link", actor },
    );
    const code = auth.delivery.developmentCode(challenge.challengeId);
    assert.ok(code);
    const linked = await auth.otp.verify({
      challengeId: challenge.challengeId,
      email,
      code,
      actor,
      currentSessionToken: initialSession.token,
    });
    assert.equal(linked.ok, true);
    if (!linked.ok) return;
    assert.equal(linked.intent, "link");
    assert.equal(linked.isNewUser, false);
    assert.equal(await auth.sessions.authenticate(initialSession.token), null);
    assert.equal((await auth.sessions.authenticate(linked.issued.token))?.userId, user.rows[0].id);

    const identity = await pool.query<{ user_id: string }>(
      `SELECT user_id
       FROM app_private.auth_identities
       WHERE provider = 'email_otp' AND provider_subject = $1 AND revoked_at IS NULL`,
      [email],
    );
    assert.equal(identity.rows[0].user_id, user.rows[0].id);
  } finally {
    await pool.end();
  }
});
