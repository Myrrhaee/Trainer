import "server-only";

import type { Pool, PoolClient } from "pg";

import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type {
  FederatedCompletionResult,
  FederatedFlowContext,
  FederatedIdentityProof,
  FederatedIntent,
  FederatedProvider,
} from "@/lib/server/auth/federated/federated-types";

interface FlowRow {
  id: string;
  provider: FederatedProvider;
  intent: FederatedIntent;
  actor_user_id: string | null;
  session_id: string | null;
  expires_at: Date;
  consumed_at: Date | null;
  invalidated_at: Date | null;
}

interface IdentityRow {
  id: string;
  user_id: string;
  revoked_at: Date | null;
  status: string;
}

export interface StoredIdentitySummary {
  id: string;
  provider: "email_otp" | FederatedProvider;
  email: string | null;
  verifiedAt: Date;
}

async function audit(
  client: PoolClient,
  input: {
    actorUserId?: string | null;
    subjectUserId?: string | null;
    eventType: string;
    metadata?: Record<string, string | boolean | number>;
  },
) {
  await client.query(
    `INSERT INTO app.audit_events (
       actor_user_id, subject_user_id, event_type, metadata
     ) VALUES ($1, $2, $3, $4::jsonb)`,
    [
      input.actorUserId ?? null,
      input.subjectUserId ?? null,
      input.eventType,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

function toFlowContext(row: FlowRow): FederatedFlowContext {
  return {
    id: row.id,
    provider: row.provider,
    intent: row.intent,
    actorUserId: row.actor_user_id,
    sessionId: row.session_id,
    expiresAt: row.expires_at,
  };
}

export class PostgresFederatedAuthRepository {
  constructor(private readonly pool: Pool = getDatabasePool("auth")) {}

  async createFlow(input: {
    id: string;
    provider: FederatedProvider;
    intent: FederatedIntent;
    stateHash: Buffer;
    nonceHash: Buffer;
    requestIpHash: Buffer;
    actorUserId: string | null;
    sessionId: string | null;
    expiresAt: Date;
    rateWindowSeconds: number;
    maxRequestsPerIp: number;
  }) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 3))",
        [input.requestIpHash],
      );
      const recent = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count
         FROM app_private.federated_auth_flows
         WHERE request_ip_hash = $1
           AND created_at > clock_timestamp() - ($2::integer * interval '1 second')`,
        [input.requestIpHash, input.rateWindowSeconds],
      );
      if (recent.rows[0].count >= input.maxRequestsPerIp) {
        await audit(client, {
          actorUserId: input.actorUserId,
          subjectUserId: input.actorUserId,
          eventType: "auth.federated_flow.rate_limited",
          metadata: { provider: input.provider, intent: input.intent },
        });
        return false;
      }

      await client.query(
        `INSERT INTO app_private.federated_auth_flows (
           id, provider, intent, state_hash, nonce_hash, request_ip_hash,
           actor_user_id, session_id, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.id,
          input.provider,
          input.intent,
          input.stateHash,
          input.nonceHash,
          input.requestIpHash,
          input.actorUserId,
          input.sessionId,
          input.expiresAt,
        ],
      );
      await audit(client, {
        actorUserId: input.actorUserId,
        subjectUserId: input.actorUserId,
        eventType: "auth.federated_flow.started",
        metadata: { provider: input.provider, intent: input.intent },
      });
      return true;
    });
  }

  async createTelegramMiniAppFlow(input: {
    id: string;
    replayHash: Buffer;
    authDateHash: Buffer;
    requestIpHash: Buffer;
    expiresAt: Date;
    rateWindowSeconds: number;
    maxRequestsPerIp: number;
  }): Promise<"created" | "replayed" | "rate_limited"> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 3))",
        [input.requestIpHash],
      );
      const recent = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count
         FROM app_private.federated_auth_flows
         WHERE request_ip_hash = $1
           AND created_at > clock_timestamp() - ($2::integer * interval '1 second')`,
        [input.requestIpHash, input.rateWindowSeconds],
      );
      if (recent.rows[0].count >= input.maxRequestsPerIp) return "rate_limited";

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO app_private.federated_auth_flows (
           id, provider, intent, state_hash, nonce_hash, request_ip_hash, expires_at
         ) VALUES ($1, 'telegram', 'login', $2, $3, $4, $5)
         ON CONFLICT (state_hash) DO NOTHING
         RETURNING id`,
        [input.id, input.replayHash, input.authDateHash, input.requestIpHash, input.expiresAt],
      );
      if (!inserted.rows[0]) {
        await audit(client, {
          eventType: "auth.telegram_mini_app.replay_rejected",
          metadata: { provider: "telegram" },
        });
        return "replayed";
      }
      await audit(client, {
        eventType: "auth.federated_flow.started",
        metadata: { provider: "telegram", intent: "login", source: "mini_app" },
      });
      return "created";
    });
  }

  async findActiveById(input: {
    id: string;
    provider: FederatedProvider;
    nonceHash: Buffer;
  }) {
    const result = await this.pool.query<FlowRow>(
      `SELECT id, provider::text, intent::text, actor_user_id, session_id,
              expires_at, consumed_at, invalidated_at
       FROM app_private.federated_auth_flows
       WHERE id = $1 AND provider = $2 AND nonce_hash = $3`,
      [input.id, input.provider, input.nonceHash],
    );
    return this.activeContext(result.rows[0]);
  }

  async findActiveByState(input: {
    id: string;
    provider: FederatedProvider;
    stateHash: Buffer;
    nonceHash: Buffer;
  }) {
    const result = await this.pool.query<FlowRow>(
      `SELECT id, provider::text, intent::text, actor_user_id, session_id,
              expires_at, consumed_at, invalidated_at
       FROM app_private.federated_auth_flows
       WHERE id = $1 AND provider = $2 AND state_hash = $3 AND nonce_hash = $4`,
      [input.id, input.provider, input.stateHash, input.nonceHash],
    );
    return this.activeContext(result.rows[0]);
  }

  async complete(input: {
    flowId: string;
    proof: FederatedIdentityProof;
    actorUserId: string | null;
    sessionId: string | null;
  }): Promise<FederatedCompletionResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      const flowResult = await client.query<FlowRow>(
        `SELECT id, provider::text, intent::text, actor_user_id, session_id,
                expires_at, consumed_at, invalidated_at
         FROM app_private.federated_auth_flows
         WHERE id = $1
         FOR UPDATE`,
        [input.flowId],
      );
      const flow = flowResult.rows[0];
      if (
        !flow
        || flow.provider !== input.proof.provider
        || flow.consumed_at
        || flow.invalidated_at
        || flow.expires_at.getTime() <= Date.now()
        || (flow.intent === "link" && (
          flow.actor_user_id !== input.actorUserId
          || flow.session_id !== input.sessionId
        ))
        || (flow.intent === "login" && (input.actorUserId || input.sessionId))
      ) {
        return { ok: false, reason: "invalid_flow" };
      }

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 4))",
        [`${input.proof.provider}:${input.proof.subject}`],
      );
      const identityResult = await client.query<IdentityRow>(
        `SELECT identity.id, identity.user_id, identity.revoked_at, account.status::text
         FROM app_private.auth_identities AS identity
         JOIN app.users AS account ON account.id = identity.user_id
         WHERE identity.provider = $1 AND identity.provider_subject = $2
         FOR UPDATE OF identity, account`,
        [input.proof.provider, input.proof.subject],
      );
      const existing = identityResult.rows[0];

      if (existing && flow.intent === "link" && existing.user_id !== flow.actor_user_id) {
        await client.query(
          "UPDATE app_private.federated_auth_flows SET invalidated_at = clock_timestamp() WHERE id = $1",
          [flow.id],
        );
        await audit(client, {
          actorUserId: flow.actor_user_id,
          subjectUserId: flow.actor_user_id,
          eventType: "auth.identity.link_conflict",
          metadata: { provider: input.proof.provider },
        });
        return { ok: false, reason: "identity_conflict" };
      }

      if (existing && flow.intent === "login" && (existing.revoked_at || existing.status !== "active")) {
        await client.query(
          "UPDATE app_private.federated_auth_flows SET invalidated_at = clock_timestamp() WHERE id = $1",
          [flow.id],
        );
        return { ok: false, reason: "account_unavailable" };
      }

      let userId: string;
      let identityId: string;
      let isNewUser = false;
      if (existing) {
        userId = existing.user_id;
        identityId = existing.id;
        await client.query(
          `UPDATE app_private.auth_identities
           SET revoked_at = NULL,
               verified_at = clock_timestamp(),
               last_used_at = clock_timestamp(),
               email_original = $3,
               email_normalized = $4,
               provider_metadata = $5::jsonb
           WHERE provider = $1 AND provider_subject = $2`,
          [
            input.proof.provider,
            input.proof.subject,
            input.proof.emailOriginal,
            input.proof.emailNormalized,
            JSON.stringify(input.proof.metadata),
          ],
        );
      } else if (flow.intent === "login") {
        const user = await client.query<{ id: string }>(
          `INSERT INTO app.users (status, display_name)
           VALUES ('active', $1)
           RETURNING id`,
          [input.proof.displayName],
        );
        userId = user.rows[0].id;
        const identity = await client.query<{ id: string }>(
          `INSERT INTO app_private.auth_identities (
             user_id, provider, provider_subject, email_original, email_normalized,
             verified_at, last_used_at, provider_metadata
           ) VALUES ($1, $2, $3, $4, $5, clock_timestamp(), clock_timestamp(), $6::jsonb)
           RETURNING id`,
          [
            userId,
            input.proof.provider,
            input.proof.subject,
            input.proof.emailOriginal,
            input.proof.emailNormalized,
            JSON.stringify(input.proof.metadata),
          ],
        );
        identityId = identity.rows[0].id;
        isNewUser = true;
      } else {
        const account = await client.query<{ status: string }>(
          "SELECT status::text FROM app.users WHERE id = $1 FOR UPDATE",
          [flow.actor_user_id],
        );
        if (account.rows[0]?.status !== "active") {
          return { ok: false, reason: "account_unavailable" };
        }
        userId = flow.actor_user_id!;
        const identity = await client.query<{ id: string }>(
          `INSERT INTO app_private.auth_identities (
             user_id, provider, provider_subject, email_original, email_normalized,
             verified_at, last_used_at, provider_metadata
           ) VALUES ($1, $2, $3, $4, $5, clock_timestamp(), clock_timestamp(), $6::jsonb)
           RETURNING id`,
          [
            userId,
            input.proof.provider,
            input.proof.subject,
            input.proof.emailOriginal,
            input.proof.emailNormalized,
            JSON.stringify(input.proof.metadata),
          ],
        );
        identityId = identity.rows[0].id;
      }

      await client.query(
        `UPDATE app_private.federated_auth_flows
         SET consumed_at = clock_timestamp(), result_user_id = $2
         WHERE id = $1`,
        [flow.id, userId],
      );
      await audit(client, {
        actorUserId: flow.intent === "link" ? userId : null,
        subjectUserId: userId,
        eventType: flow.intent === "link"
          ? "auth.identity.linked"
          : "auth.federated_identity.verified",
        metadata: { provider: input.proof.provider, newUser: isNewUser },
      });
      return { ok: true, userId, intent: flow.intent, isNewUser, identityId };
    });
  }

  async listIdentities(userId: string): Promise<StoredIdentitySummary[]> {
    const result = await this.pool.query<{
      id: string;
      provider: "email_otp" | FederatedProvider;
      email_original: string | null;
      verified_at: Date;
    }>(
      `SELECT id, provider::text, email_original, verified_at
       FROM app_private.auth_identities
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      email: row.email_original,
      verifiedAt: row.verified_at,
    }));
  }

  async unlinkIdentity(userId: string, identityId: string) {
    return withDatabaseTransaction(this.pool, async (client) => {
      const identities = await client.query<{ id: string; provider: string }>(
        `SELECT id, provider::text
         FROM app_private.auth_identities
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY id
         FOR UPDATE`,
        [userId],
      );
      const target = identities.rows.find((identity) => identity.id === identityId);
      if (!target) return { ok: false as const, reason: "not_found" as const };
      if (identities.rows.length <= 1) {
        return { ok: false as const, reason: "last_identity" as const };
      }
      await client.query(
        "UPDATE app_private.auth_identities SET revoked_at = clock_timestamp() WHERE id = $1",
        [identityId],
      );
      await audit(client, {
        actorUserId: userId,
        subjectUserId: userId,
        eventType: "auth.identity.unlinked",
        metadata: { provider: target.provider },
      });
      return { ok: true as const };
    });
  }

  private activeContext(row: FlowRow | undefined) {
    if (
      !row
      || row.consumed_at
      || row.invalidated_at
      || row.expires_at.getTime() <= Date.now()
    ) return null;
    return toFlowContext(row);
  }
}
