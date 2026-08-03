import "server-only";

import type { Pool, PoolClient } from "pg";

import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type {
  SessionRecord,
  SessionRevocationReason,
} from "@/lib/server/auth/session-types";

interface SessionRow {
  id: string;
  user_id: string;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
}

export interface NewSession {
  userId: string;
  tokenHash: Buffer;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface SessionRepository {
  create(input: NewSession): Promise<SessionRecord>;
  findAndTouch(tokenHash: Buffer, idleTtlSeconds: number): Promise<SessionRecord | null>;
  rotate(
    oldTokenHash: Buffer,
    replacement: Omit<NewSession, "userId">,
  ): Promise<SessionRecord | null>;
  revoke(tokenHash: Buffer, reason: SessionRevocationReason): Promise<boolean>;
  revokeAllForUser(userId: string, reason: SessionRevocationReason): Promise<number>;
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    revocationReason: row.revocation_reason,
  };
}

async function insertSession(client: PoolClient, input: NewSession) {
  const result = await client.query<SessionRow>(
    `INSERT INTO app_private.sessions (
       user_id, token_hash, idle_expires_at, absolute_expires_at
     ) VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId, input.tokenHash, input.idleExpiresAt, input.absoluteExpiresAt],
  );
  return mapSession(result.rows[0]);
}

async function recordSessionEvent(
  client: PoolClient,
  userId: string,
  eventType: string,
  sessionId: string,
) {
  await client.query(
    `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
     VALUES ($1, $1, $2, jsonb_build_object('session_id', $3::text))`,
    [userId, eventType, sessionId],
  );
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool = getDatabasePool("auth")) {}

  async create(input: NewSession) {
    return withDatabaseTransaction(this.pool, async (client) => {
      const session = await insertSession(client, input);
      await recordSessionEvent(client, input.userId, "auth.session.created", session.id);
      return session;
    });
  }

  async findAndTouch(tokenHash: Buffer, idleTtlSeconds: number) {
    const result = await this.pool.query<SessionRow>(
      `UPDATE app_private.sessions AS session
       SET last_seen_at = clock_timestamp(),
           idle_expires_at = LEAST(
             clock_timestamp() + ($2::integer * interval '1 second'),
             session.absolute_expires_at
           )
       FROM app.users AS account
       WHERE session.token_hash = $1
         AND account.id = session.user_id
         AND account.status = 'active'
         AND session.revoked_at IS NULL
         AND session.idle_expires_at > clock_timestamp()
         AND session.absolute_expires_at > clock_timestamp()
       RETURNING session.*`,
      [tokenHash, idleTtlSeconds],
    );
    return result.rowCount ? mapSession(result.rows[0]) : null;
  }

  async rotate(oldTokenHash: Buffer, replacement: Omit<NewSession, "userId">) {
    return withDatabaseTransaction(this.pool, async (client) => {
      const revoked = await client.query<SessionRow>(
        `UPDATE app_private.sessions AS session
         SET revoked_at = clock_timestamp(), revocation_reason = 'rotated'
         FROM app.users AS account
         WHERE session.token_hash = $1
           AND account.id = session.user_id
           AND account.status = 'active'
           AND session.revoked_at IS NULL
           AND session.idle_expires_at > clock_timestamp()
           AND session.absolute_expires_at > clock_timestamp()
         RETURNING session.*`,
        [oldTokenHash],
      );
      if (!revoked.rowCount) return null;

      const previous = mapSession(revoked.rows[0]);
      const session = await insertSession(client, {
        ...replacement,
        userId: previous.userId,
        idleExpiresAt: new Date(Math.min(
          replacement.idleExpiresAt.getTime(),
          previous.absoluteExpiresAt.getTime(),
        )),
        absoluteExpiresAt: previous.absoluteExpiresAt,
      });
      await recordSessionEvent(client, previous.userId, "auth.session.rotated", session.id);
      return session;
    });
  }

  async revoke(tokenHash: Buffer, reason: SessionRevocationReason) {
    return withDatabaseTransaction(this.pool, async (client) => {
      const result = await client.query<SessionRow>(
        `UPDATE app_private.sessions
         SET revoked_at = clock_timestamp(), revocation_reason = $2
         WHERE token_hash = $1 AND revoked_at IS NULL
         RETURNING *`,
        [tokenHash, reason],
      );
      if (!result.rowCount) return false;
      const session = mapSession(result.rows[0]);
      await recordSessionEvent(client, session.userId, "auth.session.revoked", session.id);
      return true;
    });
  }

  async revokeAllForUser(userId: string, reason: SessionRevocationReason) {
    return withDatabaseTransaction(this.pool, async (client) => {
      const result = await client.query<{ id: string }>(
        `UPDATE app_private.sessions
         SET revoked_at = clock_timestamp(), revocation_reason = $2
         WHERE user_id = $1 AND revoked_at IS NULL
         RETURNING id`,
        [userId, reason],
      );
      if (result.rowCount) {
        await client.query(
          `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
           VALUES ($1, $1, 'auth.sessions.revoked_all', jsonb_build_object('count', $2::integer))`,
          [userId, result.rowCount],
        );
      }
      return result.rowCount ?? 0;
    });
  }
}
