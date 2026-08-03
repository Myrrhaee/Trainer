import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type {
  ChallengeVerificationResult,
  CreateChallengeInput,
  CreateChallengeResult,
} from "@/lib/server/auth/email/email-otp-types";

interface ChallengeRow {
  id: string;
  secret_hash: Buffer;
  attempt_count: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  invalidated_at: Date | null;
  kind: "email_login" | "identity_link";
  actor_user_id: string | null;
  session_id: string | null;
}

export interface EmailOtpRepository {
  createChallenge(input: CreateChallengeInput): Promise<CreateChallengeResult>;
  markDelivery(challengeId: string, delivered: boolean): Promise<void>;
  verifyAndResolve(input: {
    challengeId: string;
    targetHash: Buffer;
    candidateSecretHash: Buffer;
    emailOriginal: string;
    emailNormalized: string;
    actorUserId: string | null;
    sessionId: string | null;
  }): Promise<ChallengeVerificationResult>;
}

async function recordSecurityEvent(
  client: PoolClient,
  eventType: string,
  metadata: Record<string, string | number | boolean>,
) {
  await client.query(
    `INSERT INTO app.audit_events (event_type, metadata)
     VALUES ($1, $2::jsonb)`,
    [eventType, JSON.stringify(metadata)],
  );
}

export class PostgresEmailOtpRepository implements EmailOtpRepository {
  constructor(private readonly pool: Pool = getDatabasePool("auth")) {}

  async createChallenge(input: CreateChallengeInput): Promise<CreateChallengeResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 1))",
        [input.requestIpHash],
      );
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 0))",
        [input.targetHash],
      );

      const limits = await client.query<{
        target_count: number;
        ip_count: number;
        seconds_since_latest: number | null;
        latest_resend_sequence: number | null;
      }>(
        `SELECT
           count(*) FILTER (WHERE target_hash = $1)::integer AS target_count,
           count(*) FILTER (WHERE request_ip_hash = $2)::integer AS ip_count,
           extract(epoch FROM (clock_timestamp() - max(created_at) FILTER (WHERE target_hash = $1)))::integer
             AS seconds_since_latest,
           max(resend_sequence) FILTER (WHERE target_hash = $1)::integer AS latest_resend_sequence
         FROM app_private.verification_challenges
         WHERE created_at > clock_timestamp() - ($3::integer * interval '1 second')`,
        [input.targetHash, input.requestIpHash, input.rateWindowSeconds],
      );
      const state = limits.rows[0];
      const cooldownRemaining = state.seconds_since_latest === null
        ? 0
        : Math.max(0, input.resendCooldownSeconds - state.seconds_since_latest);

      if (
        cooldownRemaining > 0
        || state.target_count >= input.maxRequestsPerTarget
        || state.ip_count >= input.maxRequestsPerIp
      ) {
        await recordSecurityEvent(client, "auth.email_challenge.rate_limited", {
          targetLimit: state.target_count >= input.maxRequestsPerTarget,
          ipLimit: state.ip_count >= input.maxRequestsPerIp,
          cooldown: cooldownRemaining > 0,
        });
        return {
          created: false,
          retryAfterSeconds: Math.max(cooldownRemaining, input.resendCooldownSeconds),
        };
      }

      await client.query(
        `UPDATE app_private.verification_challenges
         SET invalidated_at = clock_timestamp()
         WHERE target_hash = $1
           AND consumed_at IS NULL
           AND invalidated_at IS NULL`,
        [input.targetHash],
      );

      const resendSequence = (state.latest_resend_sequence ?? -1) + 1;
      await client.query(
        `INSERT INTO app_private.verification_challenges (
           id, kind, target_hash, secret_hash, request_ip_hash, max_attempts,
           expires_at, resend_sequence, actor_user_id, session_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.id,
          input.intent === "link" ? "identity_link" : "email_login",
          input.targetHash,
          input.secretHash,
          input.requestIpHash,
          input.maxAttempts,
          input.expiresAt,
          resendSequence,
          input.actorUserId,
          input.sessionId,
        ],
      );
      await recordSecurityEvent(client, "auth.email_challenge.requested", {
        challengeId: input.id,
        resendSequence,
      });
      return { created: true, resendSequence };
    });
  }

  async markDelivery(challengeId: string, delivered: boolean) {
    await withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE app_private.verification_challenges
         SET delivery_status = $2::app_private.challenge_delivery_status,
             invalidated_at = CASE WHEN $2::text = 'failed' THEN clock_timestamp() ELSE invalidated_at END
         WHERE id = $1`,
        [challengeId, delivered ? "sent" : "failed"],
      );
      await recordSecurityEvent(
        client,
        delivered ? "auth.email_challenge.delivered" : "auth.email_challenge.delivery_failed",
        { challengeId },
      );
    });
  }

  async verifyAndResolve(input: {
    challengeId: string;
    targetHash: Buffer;
    candidateSecretHash: Buffer;
    emailOriginal: string;
    emailNormalized: string;
    actorUserId: string | null;
    sessionId: string | null;
  }): Promise<ChallengeVerificationResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 0))",
        [input.targetHash],
      );
      const result = await client.query<ChallengeRow>(
        `SELECT id, secret_hash, attempt_count, max_attempts, expires_at,
                consumed_at, invalidated_at, kind, actor_user_id, session_id
         FROM app_private.verification_challenges
         WHERE id = $1 AND target_hash = $2
         FOR UPDATE`,
        [input.challengeId, input.targetHash],
      );
      if (!result.rowCount) {
        return { ok: false, reason: "not_found", remainingAttempts: null };
      }

      const challenge = result.rows[0];
      const intent = challenge.kind === "identity_link" ? "link" : "login";
      if (
        (intent === "link" && (
          challenge.actor_user_id !== input.actorUserId
          || challenge.session_id !== input.sessionId
        ))
        || (intent === "login" && (input.actorUserId || input.sessionId))
      ) {
        return { ok: false, reason: "invalid", remainingAttempts: 0 };
      }
      if (challenge.consumed_at) {
        return { ok: false, reason: "consumed", remainingAttempts: 0 };
      }
      if (challenge.invalidated_at) {
        return { ok: false, reason: "invalid", remainingAttempts: 0 };
      }
      if (challenge.expires_at.getTime() <= Date.now()) {
        await client.query(
          "UPDATE app_private.verification_challenges SET invalidated_at = clock_timestamp() WHERE id = $1",
          [input.challengeId],
        );
        return { ok: false, reason: "expired", remainingAttempts: 0 };
      }
      if (challenge.attempt_count >= challenge.max_attempts) {
        return { ok: false, reason: "attempts_exceeded", remainingAttempts: 0 };
      }

      const secretMatches = challenge.secret_hash.length === input.candidateSecretHash.length
        && timingSafeEqual(challenge.secret_hash, input.candidateSecretHash);
      if (!secretMatches) {
        const nextAttemptCount = challenge.attempt_count + 1;
        const exhausted = nextAttemptCount >= challenge.max_attempts;
        await client.query(
          `UPDATE app_private.verification_challenges
           SET attempt_count = $2,
               invalidated_at = CASE WHEN $3 THEN clock_timestamp() ELSE invalidated_at END
           WHERE id = $1`,
          [input.challengeId, nextAttemptCount, exhausted],
        );
        await recordSecurityEvent(client, "auth.email_challenge.rejected", {
          challengeId: input.challengeId,
          exhausted,
        });
        return {
          ok: false,
          reason: exhausted ? "attempts_exceeded" : "invalid",
          remainingAttempts: Math.max(0, challenge.max_attempts - nextAttemptCount),
        };
      }

      await client.query(
        `UPDATE app_private.verification_challenges
         SET consumed_at = clock_timestamp()
         WHERE id = $1`,
        [input.challengeId],
      );

      const identity = await client.query<{
        user_id: string;
        revoked_at: Date | null;
        status: string;
      }>(
        `SELECT identity.user_id, identity.revoked_at, account.status::text
         FROM app_private.auth_identities AS identity
         JOIN app.users AS account ON account.id = identity.user_id
         WHERE identity.provider = 'email_otp'
           AND identity.provider_subject = $1
         FOR UPDATE OF identity, account`,
        [input.emailNormalized],
      );

      if (identity.rowCount) {
        const existing = identity.rows[0];
        if (intent === "link" && existing.user_id !== challenge.actor_user_id) {
          await recordSecurityEvent(client, "auth.identity.link_conflict", {
            provider: "email_otp",
          });
          return { ok: false, reason: "identity_conflict", remainingAttempts: 0 };
        }
        if (existing.status !== "active" || (intent === "login" && existing.revoked_at)) {
          return { ok: false, reason: "account_unavailable", remainingAttempts: 0 };
        }
        await client.query(
          `UPDATE app_private.auth_identities
           SET revoked_at = NULL,
               verified_at = clock_timestamp(),
               last_used_at = clock_timestamp(),
               email_original = $2
           WHERE provider = 'email_otp' AND provider_subject = $1`,
          [input.emailNormalized, input.emailOriginal],
        );
        await client.query(
          `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
           VALUES ($1, $1, 'auth.email_identity.verified', '{}'::jsonb)`,
          [existing.user_id],
        );
        return { ok: true, userId: existing.user_id, isNewUser: false, intent };
      }

      if (intent === "link") {
        const account = await client.query<{ status: string }>(
          "SELECT status::text FROM app.users WHERE id = $1 FOR UPDATE",
          [challenge.actor_user_id],
        );
        if (account.rows[0]?.status !== "active") {
          return { ok: false, reason: "account_unavailable", remainingAttempts: 0 };
        }
        const userId = challenge.actor_user_id!;
        await client.query(
          `INSERT INTO app_private.auth_identities (
             user_id, provider, provider_subject, email_original, email_normalized,
             verified_at, last_used_at
           ) VALUES ($1, 'email_otp', $2, $3, $2, clock_timestamp(), clock_timestamp())`,
          [userId, input.emailNormalized, input.emailOriginal],
        );
        await client.query(
          `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
           VALUES ($1, $1, 'auth.identity.linked', '{"provider":"email_otp"}'::jsonb)`,
          [userId],
        );
        return { ok: true, userId, isNewUser: false, intent };
      }

      const user = await client.query<{ id: string }>(
        "INSERT INTO app.users (status) VALUES ('active') RETURNING id",
      );
      const userId = user.rows[0].id;
      await client.query(
        `INSERT INTO app_private.auth_identities (
           user_id, provider, provider_subject, email_original, email_normalized,
           verified_at, last_used_at
         ) VALUES ($1, 'email_otp', $2, $3, $2, clock_timestamp(), clock_timestamp())`,
        [userId, input.emailNormalized, input.emailOriginal],
      );
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'auth.email_identity.created', '{}'::jsonb)`,
        [userId],
      );
      return { ok: true, userId, isNewUser: true, intent };
    });
  }
}
