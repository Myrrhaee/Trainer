import "server-only";

import type { Pool, PoolClient } from "pg";

import { normalizeEmail } from "@/lib/server/auth/email/email-normalization";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";

type AccountStatus = "pending" | "active" | "suspended" | "deletion_pending" | "deleted";
type TrainerStatus = "pending" | "active" | "suspended" | "archived";
type AthleteStatus = "active" | "suspended" | "archived";

type AccountMatch = {
  kind: "missing" | "ambiguous" | "unique";
  userId: string | null;
  accountStatus: AccountStatus | null;
  identityVerified: boolean;
};

export type PilotParticipantStatus = {
  registered: boolean;
  ambiguousIdentity: boolean;
  accountActive: boolean;
  identityVerified: boolean;
  capabilityStatus: TrainerStatus | AthleteStatus | null;
  activeTrainerRelation: boolean;
};

export type LocalPilotStatus = {
  trainer: PilotParticipantStatus;
  athletes: PilotParticipantStatus[];
  workflow: {
    activeAthletes: number;
    publishedTemplates: number;
    assignments: number;
    completedSessions: number;
    openReviews: number;
    feedbackMessages: number;
    pendingNotifications: number;
    deadLetterNotifications: number;
  };
  readyForWorkoutLoop: boolean;
  blockers: string[];
};

export type TrainerActivationResult =
  | { ok: true; state: "activated" | "already_active" }
  | {
    ok: false;
    reason:
      | "invalid_email"
      | "account_not_found"
      | "ambiguous_email"
      | "account_unavailable"
      | "identity_unverified"
      | "trainer_request_missing"
      | "trainer_state_unavailable";
  };

type IdentityRow = {
  user_id: string;
  status: AccountStatus;
  verified_at: Date;
  revoked_at: Date | null;
};

export class LocalPilotOperator {
  constructor(private readonly pool: Pool) {}

  async activateTrainer(email: unknown): Promise<TrainerActivationResult> {
    const normalized = normalizeEmail(email);
    if (!normalized) return { ok: false, reason: "invalid_email" };

    return withDatabaseTransaction(this.pool, async (client) => {
      const match = await this.accountByEmail(client, normalized.normalized, true);
      if (match.kind === "missing") return { ok: false, reason: "account_not_found" };
      if (match.kind === "ambiguous") return { ok: false, reason: "ambiguous_email" };
      if (match.accountStatus !== "active") return { ok: false, reason: "account_unavailable" };
      if (!match.identityVerified) return { ok: false, reason: "identity_unverified" };

      const profile = await client.query<{ status: TrainerStatus }>(
        "SELECT status::text FROM app.trainer_profiles WHERE user_id = $1 FOR UPDATE",
        [match.userId],
      );
      if (!profile.rowCount) return { ok: false, reason: "trainer_request_missing" };
      if (profile.rows[0].status === "active") return { ok: true, state: "already_active" };
      if (profile.rows[0].status !== "pending") {
        return { ok: false, reason: "trainer_state_unavailable" };
      }

      await client.query(
        "UPDATE app.trainer_profiles SET status = 'active' WHERE user_id = $1",
        [match.userId],
      );
      await client.query(
        `INSERT INTO app.audit_events (subject_user_id, event_type, metadata)
         VALUES ($1, 'access.trainer_capability.operator_activated',
           jsonb_build_object('source', 'local_pilot_operator'))`,
        [match.userId],
      );
      return { ok: true, state: "activated" };
    });
  }

  async status(input: { trainerEmail: unknown; athleteEmails: unknown[] }): Promise<LocalPilotStatus> {
    const trainerEmail = normalizeEmail(input.trainerEmail);
    const athleteEmails = input.athleteEmails.map(normalizeEmail);
    if (!trainerEmail || athleteEmails.some((email) => !email)) {
      throw new Error("invalid_pilot_email");
    }

    return withDatabaseTransaction(this.pool, async (client) => {
      const trainerMatch = await this.accountByEmail(client, trainerEmail.normalized, false);
      const trainer = await this.participantStatus(client, trainerMatch, "trainer", null);
      const athletes: PilotParticipantStatus[] = [];
      for (const athleteEmail of athleteEmails) {
        const match = await this.accountByEmail(client, athleteEmail!.normalized, false);
        athletes.push(await this.participantStatus(client, match, "athlete", trainerMatch.userId));
      }

      const workflow = await this.workflowStatus(client, trainerMatch.userId);
      const blockers = this.blockers(trainer, athletes);
      return {
        trainer,
        athletes,
        workflow,
        readyForWorkoutLoop: blockers.length === 0,
        blockers,
      };
    });
  }

  private async accountByEmail(client: PoolClient, email: string, lock: boolean): Promise<AccountMatch> {
    const result = await client.query<IdentityRow>(
      `SELECT identity.user_id, account.status::text, identity.verified_at, identity.revoked_at
       FROM app_private.auth_identities identity
       JOIN app.users account ON account.id = identity.user_id
       WHERE identity.email_normalized = $1
       ${lock ? "FOR UPDATE OF identity, account" : ""}`,
      [email],
    );
    const userIds = [...new Set(result.rows.map((row) => row.user_id))];
    if (!userIds.length) {
      return { kind: "missing", userId: null, accountStatus: null, identityVerified: false };
    }
    if (userIds.length > 1) {
      return { kind: "ambiguous", userId: null, accountStatus: null, identityVerified: false };
    }
    const rows = result.rows.filter((row) => row.user_id === userIds[0]);
    return {
      kind: "unique",
      userId: userIds[0],
      accountStatus: rows[0].status,
      identityVerified: rows.some((row) => Boolean(row.verified_at) && !row.revoked_at),
    };
  }

  private async participantStatus(
    client: PoolClient,
    match: AccountMatch,
    role: "trainer" | "athlete",
    trainerUserId: string | null,
  ): Promise<PilotParticipantStatus> {
    if (match.kind !== "unique" || !match.userId) {
      return {
        registered: match.kind !== "missing",
        ambiguousIdentity: match.kind === "ambiguous",
        accountActive: false,
        identityVerified: false,
        capabilityStatus: null,
        activeTrainerRelation: false,
      };
    }
    const table = role === "trainer" ? "trainer_profiles" : "athlete_profiles";
    const capability = await client.query<{ status: TrainerStatus | AthleteStatus }>(
      `SELECT status::text FROM app.${table} WHERE user_id = $1`,
      [match.userId],
    );
    let activeTrainerRelation = false;
    if (role === "athlete" && trainerUserId) {
      const relation = await client.query(
        `SELECT id FROM app.trainer_athlete_relations
         WHERE trainer_user_id = $1 AND athlete_user_id = $2
           AND status = 'active' AND is_primary`,
        [trainerUserId, match.userId],
      );
      activeTrainerRelation = Boolean(relation.rowCount);
    }
    return {
      registered: true,
      ambiguousIdentity: false,
      accountActive: match.accountStatus === "active",
      identityVerified: match.identityVerified,
      capabilityStatus: capability.rows[0]?.status ?? null,
      activeTrainerRelation,
    };
  }

  private async workflowStatus(client: PoolClient, trainerUserId: string | null) {
    const empty = {
      activeAthletes: 0,
      publishedTemplates: 0,
      assignments: 0,
      completedSessions: 0,
      openReviews: 0,
      feedbackMessages: 0,
      pendingNotifications: 0,
      deadLetterNotifications: 0,
    };
    if (!trainerUserId) return empty;

    const result = await client.query<Record<keyof typeof empty, string>>(
      `SELECT
         (SELECT count(*) FROM app.trainer_athlete_relations
          WHERE trainer_user_id = $1 AND status = 'active')::text AS "activeAthletes",
         (SELECT count(*) FROM app.workout_templates
          WHERE trainer_user_id = $1 AND status = 'published')::text AS "publishedTemplates",
         (SELECT count(*) FROM app.workout_assignments
          WHERE trainer_user_id = $1)::text AS assignments,
         (SELECT count(*) FROM app.workout_sessions
          WHERE trainer_user_id = $1 AND status IN ('completed', 'completed_with_omissions'))::text
          AS "completedSessions",
         (SELECT count(*) FROM app.attention_items
          WHERE trainer_user_id = $1 AND status = 'open')::text AS "openReviews",
         (SELECT count(*) FROM app.trainer_feedback
          WHERE trainer_user_id = $1)::text AS "feedbackMessages",
         (SELECT count(*) FROM app.notification_outbox
          WHERE actor_user_id = $1 AND status IN ('pending', 'processing', 'retry_wait'))::text
          AS "pendingNotifications",
         (SELECT count(*) FROM app.notification_outbox
          WHERE actor_user_id = $1 AND status = 'dead_letter')::text AS "deadLetterNotifications"`,
      [trainerUserId],
    );
    const row = result.rows[0];
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)]),
    ) as typeof empty;
  }

  private blockers(trainer: PilotParticipantStatus, athletes: PilotParticipantStatus[]) {
    const blockers: string[] = [];
    if (!trainer.registered) blockers.push("trainer_registration_missing");
    else if (trainer.ambiguousIdentity) blockers.push("trainer_email_ambiguous");
    else if (!trainer.accountActive || !trainer.identityVerified) blockers.push("trainer_identity_unavailable");
    else if (trainer.capabilityStatus === null) blockers.push("trainer_request_missing");
    else if (trainer.capabilityStatus !== "active") blockers.push("trainer_activation_required");

    athletes.forEach((athlete, index) => {
      const label = `athlete_${index + 1}`;
      if (!athlete.registered) blockers.push(`${label}_registration_missing`);
      else if (athlete.ambiguousIdentity) blockers.push(`${label}_email_ambiguous`);
      else if (!athlete.accountActive || !athlete.identityVerified) blockers.push(`${label}_identity_unavailable`);
      else if (athlete.capabilityStatus !== "active" || !athlete.activeTrainerRelation) {
        blockers.push(`${label}_invitation_acceptance_required`);
      }
    });
    return blockers;
  }
}
