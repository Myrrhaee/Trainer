import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type {
  AccessContext,
  AthleteCapabilityStatus,
  RelationStatus,
  TrainerAthleteRelation,
  TrainerCapabilityStatus,
} from "@/lib/server/access/access-types";

interface ContextRow {
  display_name: string | null;
  trainer_status: TrainerCapabilityStatus | null;
  athlete_status: AthleteCapabilityStatus | null;
}

interface RelationRow {
  id: string;
  trainer_user_id: string;
  athlete_user_id: string;
  status: RelationStatus;
  is_primary: boolean;
  accepted_at: Date;
}

function destination(row: ContextRow): AccessContext["destination"] {
  const trainer = row.trainer_status === "active";
  const athlete = row.athlete_status === "active";
  if (trainer && athlete) return "/workspaces";
  if (trainer) return "/trainer/dashboard";
  if (athlete) return "/client/me";
  return "/onboarding";
}

function mapRelation(row: RelationRow): TrainerAthleteRelation {
  return {
    id: row.id,
    trainerUserId: row.trainer_user_id,
    athleteUserId: row.athlete_user_id,
    status: row.status,
    isPrimary: row.is_primary,
    acceptedAt: row.accepted_at,
  };
}

export class PostgresAccessRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async context(actor: Actor): Promise<AccessContext> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ContextRow>(
        `SELECT account.display_name,
                trainer.status::text AS trainer_status,
                athlete.status::text AS athlete_status
         FROM app.users account
         LEFT JOIN app.trainer_profiles trainer ON trainer.user_id = account.id
         LEFT JOIN app.athlete_profiles athlete ON athlete.user_id = account.id
         WHERE account.id = $1`,
        [actor.userId],
      );
      const row = result.rows[0] ?? { display_name: null, trainer_status: null, athlete_status: null };
      return {
        userId: actor.userId,
        displayName: row.display_name?.trim() || null,
        trainer: row.trainer_status ? { status: row.trainer_status } : null,
        athlete: row.athlete_status ? { status: row.athlete_status } : null,
        destination: destination(row),
      };
    }, this.pool);
  }

  async requestTrainerCapability(actor: Actor) {
    return withActorTransaction(actor, async (client) => {
      const existing = await client.query<{ status: TrainerCapabilityStatus }>(
        "SELECT status::text FROM app.trainer_profiles WHERE user_id = $1",
        [actor.userId],
      );
      if (existing.rowCount) return existing.rows[0].status;

      const result = await client.query<{ status: TrainerCapabilityStatus }>(
        `INSERT INTO app.trainer_profiles (user_id, status)
         VALUES ($1, 'pending')
         RETURNING status::text`,
        [actor.userId],
      );
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'access.trainer_capability.requested', '{}'::jsonb)`,
        [actor.userId],
      );
      return result.rows[0].status;
    }, this.pool);
  }

  async createInvitation(actor: Actor, tokenHash: Buffer, expiresAt: Date) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<{ id: string; expires_at: Date }>(
        `INSERT INTO app.athlete_invitations (trainer_user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, expires_at`,
        [actor.userId, tokenHash, expiresAt],
      );
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'access.athlete_invitation.created', jsonb_build_object('invitation_id', $2::text))`,
        [actor.userId, result.rows[0].id],
      );
      return { id: result.rows[0].id, expiresAt: result.rows[0].expires_at };
    }, this.pool);
  }

  async acceptInvitation(actor: Actor, tokenHash: Buffer) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      await client.query(
        "SELECT set_config('app.invitation_token_hash', $1, true)",
        [tokenHash.toString("hex")],
      );
      const invitation = await client.query<{
        id: string;
        trainer_user_id: string;
        accepted_by_user_id: string | null;
        relation_id: string | null;
      }>(
        `SELECT id, trainer_user_id, accepted_by_user_id, relation_id
         FROM app.athlete_invitations
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash],
      );
      const row = invitation.rows[0];
      if (!row) return { ok: false as const, reason: "invalid_or_expired" as const };

      if (row.accepted_by_user_id === actor.userId && row.relation_id) {
        const retry = await client.query<RelationRow>(
          "SELECT * FROM app.trainer_athlete_relations WHERE id = $1",
          [row.relation_id],
        );
        return retry.rowCount
          ? { ok: true as const, relation: mapRelation(retry.rows[0]), retry: true }
          : { ok: false as const, reason: "invalid_or_expired" as const };
      }

      await client.query(
        `INSERT INTO app.athlete_profiles (user_id, status)
         VALUES ($1, 'active')
         ON CONFLICT (user_id) DO NOTHING`,
        [actor.userId],
      );
      const athleteProfile = await client.query<{ status: AthleteCapabilityStatus }>(
        "SELECT status::text FROM app.athlete_profiles WHERE user_id = $1",
        [actor.userId],
      );
      if (athleteProfile.rows[0]?.status !== "active") {
        return { ok: false as const, reason: "account_unavailable" as const };
      }
      const relation = await client.query<RelationRow>(
        `INSERT INTO app.trainer_athlete_relations (
           trainer_user_id, athlete_user_id, status, is_primary
         ) VALUES ($1, $2, 'active', true)
         RETURNING *`,
        [row.trainer_user_id, actor.userId],
      );
      await client.query(
        `UPDATE app.athlete_invitations
         SET accepted_by_user_id = $2,
             relation_id = $3,
             accepted_at = clock_timestamp()
         WHERE id = $1`,
        [row.id, actor.userId, relation.rows[0].id],
      );
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'access.athlete_invitation.accepted',
           jsonb_build_object('invitation_id', $2::text, 'relation_id', $3::text))`,
        [actor.userId, row.id, relation.rows[0].id],
      );
      return { ok: true as const, relation: mapRelation(relation.rows[0]), retry: false };
    });
  }

  async transitionRelation(actor: Actor, relationId: string, status: RelationStatus) {
    return withActorTransaction(actor, async (client) => {
      const current = await client.query<RelationRow>(
        `SELECT * FROM app.trainer_athlete_relations
         WHERE id = $1 AND trainer_user_id = $2
         FOR UPDATE`,
        [relationId, actor.userId],
      );
      if (!current.rowCount) return null;
      const result = await client.query(
        `UPDATE app.trainer_athlete_relations
         SET status = $3
         WHERE id = $1 AND trainer_user_id = $2`,
        [relationId, actor.userId, status],
      );
      if (!result.rowCount) return null;
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'access.trainer_athlete_relation.transitioned',
           jsonb_build_object('relation_id', $2::text, 'status', $3::text))`,
        [actor.userId, relationId, status],
      );
      return mapRelation({ ...current.rows[0], status });
    }, this.pool);
  }

  async hasActiveAthleteRelation(actor: Actor, athleteUserId: string) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query(
        `SELECT id FROM app.trainer_athlete_relations
         WHERE trainer_user_id = $1
           AND athlete_user_id = $2
           AND status = 'active'`,
        [actor.userId, athleteUserId],
      );
      return Boolean(result.rowCount);
    }, this.pool);
  }

  async hasCurrentAthleteRelation(actor: Actor, athleteUserId: string) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query(
        `SELECT id FROM app.trainer_athlete_relations
         WHERE trainer_user_id = $1
           AND athlete_user_id = $2
           AND status IN ('active', 'suspended')`,
        [actor.userId, athleteUserId],
      );
      return Boolean(result.rowCount);
    }, this.pool);
  }
}
