import "server-only";

import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { enqueueNotification } from "@/lib/server/notifications/notification-outbox";
import type { ReviewFeedback, ReviewFeedbackKind, TrainerReviewQueueItem } from "./review-types";

export class ReviewAlreadyResolvedError extends Error {}
export class ReviewIdempotencyConflictError extends Error {}
export class ReviewInvalidFollowUpError extends Error {}

type AttentionRow = {
  id: string;
  source_session_id: string;
  athlete_user_id: string;
  relation_id: string;
  status: "open" | "resolved" | "archived";
};

type FeedbackRow = {
  id: string;
  attention_item_id: string;
  source_session_id: string;
  trainer_user_id: string;
  athlete_user_id: string;
  kind: ReviewFeedbackKind;
  body: string;
  follow_up_of_id: string | null;
  display_name: string | null;
  sent_at: Date;
};

type ReviewSourceRow = {
  attention_item_id: string;
  attention_status: "open" | "resolved" | "archived";
  attention_created_at: Date;
  attention_resolved_at: Date | null;
  priority_reasons: string[];
  manual_resolution_reason: string | null;
  session_id: string;
  assignment_id: string;
  session_title: string;
  session_status: "completed" | "completed_with_omissions";
  session_started_at: Date;
  session_completed_at: Date;
  scheduled_for: string | Date;
  athlete_user_id: string;
  athlete_display_name: string | null;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "С";
}

function mapFeedback(row: FeedbackRow): ReviewFeedback {
  return {
    id: row.id,
    attentionItemId: row.attention_item_id,
    sessionId: row.source_session_id,
    trainerUserId: row.trainer_user_id,
    athleteUserId: row.athlete_user_id,
    kind: row.kind,
    body: row.body,
    followUpOfId: row.follow_up_of_id,
    author: row.display_name?.trim() || "Тренер",
    sentAt: row.sent_at.toISOString(),
  };
}

const feedbackSelect = `SELECT feedback.id, feedback.attention_item_id, feedback.source_session_id,
  feedback.trainer_user_id, feedback.athlete_user_id, feedback.kind::text, feedback.body,
  feedback.follow_up_of_id, account.display_name, feedback.sent_at
FROM app.trainer_feedback feedback
LEFT JOIN app.users account ON account.id = feedback.trainer_user_id`;

export class ReviewRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  listQueue(actor: Actor): Promise<TrainerReviewQueueItem[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<{
        id: string; source_session_id: string; athlete_user_id: string; display_name: string | null;
        title_snapshot: string; status: "open" | "resolved" | "archived"; completed_at: Date;
        created_at: Date; completed_sets: string; total_sets: string; has_client_comments: boolean;
        priority_reasons: string[];
      }>(`SELECT attention.id, attention.source_session_id, attention.athlete_user_id,
          account.display_name, assignment.title_snapshot, attention.status::text,
          session.completed_at, attention.created_at, attention.priority_reasons,
          count(set_log.id) FILTER (WHERE set_log.status = 'completed')::text AS completed_sets,
          count(set_log.id)::text AS total_sets,
          coalesce(bool_or(btrim(set_log.athlete_comment) <> ''), false) AS has_client_comments
        FROM app.attention_items attention
        JOIN app.workout_sessions session ON session.id = attention.source_session_id
        JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
        JOIN app.users account ON account.id = attention.athlete_user_id
        LEFT JOIN app.workout_exercise_logs exercise ON exercise.session_id = session.id
        LEFT JOIN app.workout_set_logs set_log ON set_log.exercise_log_id = exercise.id
        WHERE attention.trainer_user_id = $1 AND attention.status = 'open'
        GROUP BY attention.id, session.id, assignment.id, account.id
        ORDER BY (attention.priority_reasons ? 'discomfort') DESC,
          session.completed_at ASC, attention.id ASC`, [actor.userId]);
      return result.rows.map((row) => {
        const displayName = row.display_name?.trim() || `Спортсмен ${row.athlete_user_id.slice(0, 6)}`;
        return {
          id: row.id,
          sessionId: row.source_session_id,
          athleteUserId: row.athlete_user_id,
          athleteDisplayName: displayName,
          athleteInitials: initials(displayName),
          sessionTitle: row.title_snapshot,
          status: row.status,
          completedAt: row.completed_at.toISOString(),
          createdAt: row.created_at.toISOString(),
          completedSets: Number(row.completed_sets),
          totalSets: Number(row.total_sets),
          hasClientComments: row.has_client_comments,
          priorityReasons: row.priority_reasons,
        };
      });
    }, this.pool);
  }

  findSource(actor: Actor, sessionId: string): Promise<ReviewSourceRow | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ReviewSourceRow>(`SELECT
          attention.id AS attention_item_id, attention.status::text AS attention_status,
          attention.created_at AS attention_created_at, attention.resolved_at AS attention_resolved_at,
          attention.priority_reasons,
          resolution.reason AS manual_resolution_reason,
          session.id AS session_id, session.assignment_id, assignment.title_snapshot AS session_title,
          session.status::text AS session_status, session.started_at AS session_started_at,
          session.completed_at AS session_completed_at, assignment.scheduled_for,
          session.athlete_user_id, account.display_name AS athlete_display_name
        FROM app.attention_items attention
        JOIN app.workout_sessions session ON session.id = attention.source_session_id
        JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
        JOIN app.users account ON account.id = session.athlete_user_id
        LEFT JOIN app.attention_manual_resolutions resolution ON resolution.attention_item_id = attention.id
        WHERE attention.trainer_user_id = $1 AND session.id = $2`, [actor.userId, sessionId]);
      return result.rows[0] ?? null;
    }, this.pool);
  }

  listSessionFeedback(actor: Actor, sessionId: string) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<FeedbackRow>(`${feedbackSelect}
        WHERE feedback.source_session_id = $1 ORDER BY feedback.sent_at, feedback.id`, [sessionId]);
      return result.rows.map(mapFeedback);
    }, this.pool);
  }

  listAthleteFeedback(actor: Actor, sessionId?: string) {
    return withActorTransaction(actor, async (client) => {
      const values: unknown[] = [actor.userId];
      const sessionFilter = sessionId ? " AND feedback.source_session_id = $2" : "";
      if (sessionId) values.push(sessionId);
      const result = await client.query<FeedbackRow>(`${feedbackSelect}
        WHERE feedback.athlete_user_id = $1${sessionFilter}
        ORDER BY feedback.sent_at DESC, feedback.id DESC`, values);
      return result.rows.map(mapFeedback);
    }, this.pool);
  }

  sendFeedback(actor: Actor, input: {
    attentionItemId: string; sessionId: string; kind: ReviewFeedbackKind; body: string;
    followUpOfId: string | null; idempotencyKeyHash: string; requestHash: string;
  }): Promise<ReviewFeedback | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const attention = await this.lockAttention(client, actor.userId, input.attentionItemId, input.sessionId);
      if (!attention) return null;
      const commandKind = input.kind === "follow_up" ? "follow_up" : "send_feedback";
      const duplicateId = await this.receipt(client, actor.userId, input.attentionItemId,
        commandKind, input.idempotencyKeyHash, input.requestHash);
      if (duplicateId) return this.findFeedback(client, duplicateId);

      if (input.kind === "follow_up") {
        if (attention.status !== "resolved" || !input.followUpOfId) {
          throw new ReviewInvalidFollowUpError("invalid_follow_up");
        }
        const parent = await client.query(`SELECT id FROM app.trainer_feedback
          WHERE id = $1 AND attention_item_id = $2 AND source_session_id = $3`,
          [input.followUpOfId, input.attentionItemId, input.sessionId]);
        if (!parent.rowCount) throw new ReviewInvalidFollowUpError("invalid_follow_up");
      } else if (attention.status !== "open") {
        throw new ReviewAlreadyResolvedError("review_already_resolved");
      }

      const inserted = await client.query<FeedbackRow>(`WITH created AS (
          INSERT INTO app.trainer_feedback
            (trainer_user_id, athlete_user_id, relation_id, source_session_id,
             attention_item_id, kind, body, follow_up_of_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        ) SELECT created.id, created.attention_item_id, created.source_session_id,
          created.trainer_user_id, created.athlete_user_id, created.kind::text,
          created.body, created.follow_up_of_id, account.display_name, created.sent_at
        FROM created JOIN app.users account ON account.id = created.trainer_user_id`,
        [actor.userId, attention.athlete_user_id, attention.relation_id, input.sessionId,
          input.attentionItemId, input.kind, input.body, input.followUpOfId]);
      const feedback = mapFeedback(inserted.rows[0]);

      if (input.kind !== "follow_up") {
        await client.query(`UPDATE app.attention_items SET status = 'resolved',
          resolved_at = clock_timestamp() WHERE id = $1`, [input.attentionItemId]);
      }
      await this.saveReceipt(client, actor.userId, input.attentionItemId, commandKind,
        input.idempotencyKeyHash, input.requestHash, feedback.id);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$2,$3,jsonb_build_object('session_id',$4::text,'attention_item_id',$5::text,'feedback_id',$6::text,'kind',$7::text))`,
        [actor.userId, attention.athlete_user_id,
          input.kind === "follow_up" ? "workout.review.follow_up_sent" : "workout.review.feedback_sent",
          input.sessionId, input.attentionItemId, feedback.id, input.kind]);
      await enqueueNotification(client, {
        eventType: "review_feedback_ready",
        recipientUserId: attention.athlete_user_id,
        actorUserId: actor.userId,
        aggregateType: "trainer_feedback",
        aggregateId: feedback.id,
      });
      return feedback;
    });
  }

  resolveManually(actor: Actor, input: {
    attentionItemId: string; sessionId: string; reason: string;
    idempotencyKeyHash: string; requestHash: string;
  }): Promise<{ id: string; reason: string; resolvedAt: string } | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const attention = await this.lockAttention(client, actor.userId, input.attentionItemId, input.sessionId);
      if (!attention) return null;
      const duplicateId = await this.receipt(client, actor.userId, input.attentionItemId,
        "manual_resolution", input.idempotencyKeyHash, input.requestHash);
      if (duplicateId) return this.findManualResolution(client, duplicateId);
      if (attention.status !== "open") throw new ReviewAlreadyResolvedError("review_already_resolved");

      const inserted = await client.query<{ id: string; reason: string; resolved_at: Date }>(`
        INSERT INTO app.attention_manual_resolutions (attention_item_id, trainer_user_id, reason)
        VALUES ($1,$2,$3) RETURNING id, reason, resolved_at`,
        [input.attentionItemId, actor.userId, input.reason]);
      await client.query(`UPDATE app.attention_items SET status = 'resolved',
        resolved_at = clock_timestamp() WHERE id = $1`, [input.attentionItemId]);
      await this.saveReceipt(client, actor.userId, input.attentionItemId, "manual_resolution",
        input.idempotencyKeyHash, input.requestHash, inserted.rows[0].id);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$2,'workout.review.manually_resolved',jsonb_build_object(
          'session_id',$3::text,'attention_item_id',$4::text,'resolution_id',$5::text))`,
        [actor.userId, attention.athlete_user_id, input.sessionId, input.attentionItemId, inserted.rows[0].id]);
      return {
        id: inserted.rows[0].id,
        reason: inserted.rows[0].reason,
        resolvedAt: inserted.rows[0].resolved_at.toISOString(),
      };
    });
  }

  private async lockAttention(client: PoolClient, actorId: string, attentionId: string, sessionId: string) {
    const result = await client.query<AttentionRow>(`SELECT id, source_session_id, athlete_user_id,
      relation_id, status::text FROM app.attention_items
      WHERE id = $1 AND source_session_id = $2 AND trainer_user_id = $3 FOR UPDATE`,
      [attentionId, sessionId, actorId]);
    return result.rows[0] ?? null;
  }

  private async receipt(client: PoolClient, actorId: string, attentionId: string,
    kind: "send_feedback" | "manual_resolution" | "follow_up", keyHash: string, requestHash: string) {
    const result = await client.query<{ attention_item_id: string; request_hash: string; result_entity_id: string }>(`
      SELECT attention_item_id, request_hash, result_entity_id FROM app.review_command_receipts
      WHERE actor_user_id = $1 AND kind = $2 AND idempotency_key_hash = $3`, [actorId, kind, keyHash]);
    if (!result.rowCount) return null;
    if (result.rows[0].attention_item_id !== attentionId || result.rows[0].request_hash !== requestHash) {
      throw new ReviewIdempotencyConflictError("idempotency_conflict");
    }
    return result.rows[0].result_entity_id;
  }

  private saveReceipt(client: PoolClient, actorId: string, attentionId: string,
    kind: "send_feedback" | "manual_resolution" | "follow_up", keyHash: string, requestHash: string, resultId: string) {
    return client.query(`INSERT INTO app.review_command_receipts
      (attention_item_id, actor_user_id, kind, idempotency_key_hash, request_hash, result_entity_id)
      VALUES ($1,$2,$3,$4,$5,$6)`, [attentionId, actorId, kind, keyHash, requestHash, resultId]);
  }

  private async findFeedback(client: PoolClient, feedbackId: string) {
    const result = await client.query<FeedbackRow>(`${feedbackSelect} WHERE feedback.id = $1`, [feedbackId]);
    return result.rowCount ? mapFeedback(result.rows[0]) : null;
  }

  private async findManualResolution(client: PoolClient, resolutionId: string) {
    const result = await client.query<{ id: string; reason: string; resolved_at: Date }>(`
      SELECT id, reason, resolved_at FROM app.attention_manual_resolutions WHERE id = $1`, [resolutionId]);
    return result.rowCount ? {
      id: result.rows[0].id,
      reason: result.rows[0].reason,
      resolvedAt: result.rows[0].resolved_at.toISOString(),
    } : null;
  }
}
