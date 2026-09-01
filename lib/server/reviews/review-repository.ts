import "server-only";

import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { enqueueNotification } from "@/lib/server/notifications/notification-outbox";
import { projectReviewDeviations, reviewCapabilities } from "./review-read-model-projector";
import type {
  ReviewAnomaly,
  ReviewAvailability,
  ReviewExerciseReadModel,
  ReviewFeedback,
  ReviewFeedbackKind,
  ReviewReadModel,
  ReviewSetReadModel,
  ReviewSourceComment,
  TrainerReviewQueueItem,
} from "./review-types";

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

type CanonicalReviewSourceRow = {
  attention_item_id: string;
  attention_source_session_id: string;
  attention_athlete_user_id: string;
  attention_relation_id: string;
  attention_status: "open" | "resolved" | "archived";
  attention_created_at: Date;
  attention_resolved_at: Date | null;
  priority_reasons: string[];
  manual_resolution_reason: string | null;
  session_id: string;
  session_assignment_id: string;
  session_relation_id: string;
  session_trainer_user_id: string;
  session_athlete_user_id: string;
  session_status: "completed" | "completed_with_omissions";
  client_timezone: string;
  session_started_at: Date;
  session_completed_at: Date;
  zero_result_reason: string | null;
  session_created_at: Date;
  session_updated_at: Date;
  assignment_id: string;
  assignment_relation_id: string;
  assignment_trainer_user_id: string;
  assignment_athlete_user_id: string;
  source_template_id: string;
  source_revision_id: string;
  source_revision_number: number;
  title_snapshot: string;
  instruction_snapshot: string;
  trainer_note: string;
  scheduled_for: string | Date;
  assignment_created_at: Date;
  athlete_display_name: string | null;
};

type CanonicalExerciseRow = {
  assignment_exercise_id: string;
  instance_key: string;
  position: number;
  title_snapshot: string;
  category_snapshot: string;
  equipment_snapshot: string | null;
  prescription_type_snapshot: "repetitions" | "duration";
  repetition_mode_snapshot: "fixed" | "range";
  repetitions_min_snapshot: number | null;
  repetitions_max_snapshot: number | null;
  duration_seconds_snapshot: number | null;
  target_weight_kg_snapshot: string | null;
  rest_seconds_snapshot: number;
  trainer_note_snapshot: string;
  exercise_log_id: string | null;
  exercise_status: "pending" | "completed" | "skipped" | "incomplete" | null;
  athlete_note: string | null;
  exercise_log_created_at: Date | null;
  exercise_log_updated_at: Date | null;
};

type CanonicalSetSnapshotRow = {
  source_assignment_set_id: string;
  assignment_exercise_id: string;
  set_key_snapshot: string;
  position: number;
  kind_snapshot: "warmup" | "working";
  repetitions_min_snapshot: number | null;
  repetitions_max_snapshot: number | null;
  duration_seconds_snapshot: number | null;
  target_weight_kg_snapshot: string | null;
  rest_seconds_snapshot: number;
};

type CanonicalSetLogRow = {
  set_log_id: string;
  exercise_log_id: string;
  assignment_exercise_id: string;
  source_assignment_set_id: string | null;
  set_key: string;
  position: number;
  kind: "warmup" | "working";
  planned_repetitions_min: number | null;
  planned_repetitions_max: number | null;
  planned_duration_seconds: number | null;
  planned_weight_kg: string | null;
  status: "pending" | "completed" | "skipped" | "incomplete";
  actual_repetitions: number | null;
  actual_duration_seconds: number | null;
  actual_weight_kg: string | null;
  rpe: string | null;
  athlete_comment: string;
  created_at: Date;
  updated_at: Date;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "С";
}

function numberValue(value: string | number | null) {
  return value === null ? null : Number(value);
}

function dateValue(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function unsupported<T>(reason: string): ReviewAvailability<T> {
  return { status: "unsupported", reason };
}

function sourceComment(log: CanonicalSetLogRow): ReviewSourceComment[] {
  const text = log.athlete_comment.trim();
  return text ? [{
    source: "set_comment",
    sourceId: log.set_log_id,
    exerciseLogId: log.exercise_log_id,
    setLogId: log.set_log_id,
    text,
  }] : [];
}

function projectSet(
  exerciseLogId: string | null,
  snapshot: CanonicalSetSnapshotRow | null,
  log: CanonicalSetLogRow | null,
  anomalies: ReviewAnomaly[],
): ReviewSetReadModel {
  const sourceAssignmentSetId = snapshot?.source_assignment_set_id ?? log?.source_assignment_set_id ?? null;
  if (log && (!sourceAssignmentSetId || !snapshot)) {
    anomalies.push({
      type: "set_source_identity_missing",
      exerciseLogId,
      setLogId: log.set_log_id,
      detail: "Set log has no matching assignment-set snapshot; no positional substitution was applied.",
    });
  }
  const comments = log ? sourceComment(log) : [];
  return {
    identity: {
      setLogId: log?.set_log_id ?? null,
      sourceAssignmentSetId,
      setKey: snapshot?.set_key_snapshot ?? log?.set_key ?? "missing-source-set",
      position: snapshot?.position ?? log?.position ?? 0,
    },
    prescribed: snapshot ? {
      source: "assignment_snapshot",
      kind: snapshot.kind_snapshot,
      repetitionsMin: snapshot.repetitions_min_snapshot,
      repetitionsMax: snapshot.repetitions_max_snapshot,
      durationSeconds: snapshot.duration_seconds_snapshot,
      weightKg: numberValue(snapshot.target_weight_kg_snapshot),
      restSeconds: snapshot.rest_seconds_snapshot,
    } : {
      source: "session_snapshot",
      kind: log?.kind ?? "working",
      repetitionsMin: log?.planned_repetitions_min ?? null,
      repetitionsMax: log?.planned_repetitions_max ?? null,
      durationSeconds: log?.planned_duration_seconds ?? null,
      weightKg: numberValue(log?.planned_weight_kg ?? null),
      restSeconds: null,
    },
    actual: {
      status: log?.status ?? "missing",
      repetitions: log?.actual_repetitions ?? null,
      durationSeconds: log?.actual_duration_seconds ?? null,
      weightKg: numberValue(log?.actual_weight_kg ?? null),
      rpe: numberValue(log?.rpe ?? null),
      createdAt: log?.created_at.toISOString() ?? null,
      updatedAt: log?.updated_at.toISOString() ?? null,
    },
    athleteComment: !log
      ? { status: "unavailable", reason: "set_log_unavailable" }
      : comments.length
        ? { status: "ready", value: comments[0].text }
        : { status: "known_empty", value: null },
    sourceComments: comments,
    deviations: [],
  };
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

  findReview(actor: Actor, sessionId: string): Promise<ReviewReadModel | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);

      const sourceResult = await client.query<CanonicalReviewSourceRow>(`SELECT
          attention.id AS attention_item_id,
          attention.source_session_id AS attention_source_session_id,
          attention.athlete_user_id AS attention_athlete_user_id,
          attention.relation_id AS attention_relation_id,
          attention.status::text AS attention_status,
          attention.created_at AS attention_created_at,
          attention.resolved_at AS attention_resolved_at,
          attention.priority_reasons,
          resolution.reason AS manual_resolution_reason,
          session.id AS session_id,
          session.assignment_id AS session_assignment_id,
          session.relation_id AS session_relation_id,
          session.trainer_user_id AS session_trainer_user_id,
          session.athlete_user_id AS session_athlete_user_id,
          session.status::text AS session_status,
          session.client_timezone,
          session.started_at AS session_started_at,
          session.completed_at AS session_completed_at,
          session.zero_result_reason,
          session.created_at AS session_created_at,
          session.updated_at AS session_updated_at,
          assignment.id AS assignment_id,
          assignment.relation_id AS assignment_relation_id,
          assignment.trainer_user_id AS assignment_trainer_user_id,
          assignment.athlete_user_id AS assignment_athlete_user_id,
          assignment.source_template_id,
          assignment.source_revision_id,
          assignment.source_revision_number,
          assignment.title_snapshot,
          assignment.instruction_snapshot,
          assignment.trainer_note,
          assignment.scheduled_for,
          assignment.created_at AS assignment_created_at,
          account.display_name AS athlete_display_name
        FROM app.workout_sessions session
        JOIN app.trainer_athlete_relations relation ON relation.id = session.relation_id
        JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
        JOIN app.attention_items attention
          ON attention.source_session_id = session.id AND attention.item_type = 'workout_review'
        JOIN app.users account ON account.id = session.athlete_user_id
        LEFT JOIN app.attention_manual_resolutions resolution ON resolution.attention_item_id = attention.id
        WHERE session.id = $1 AND session.trainer_user_id = $2
          AND attention.trainer_user_id = $2 AND relation.status = 'active'
          AND session.status IN ('completed', 'completed_with_omissions')`, [sessionId, actor.userId]);
      const source = sourceResult.rows[0];
      if (!source) return null;

      const exercisesResult = await client.query<CanonicalExerciseRow>(`SELECT
          assignment_exercise.id AS assignment_exercise_id,
          assignment_exercise.instance_key,
          assignment_exercise.position,
          assignment_exercise.title_snapshot,
          assignment_exercise.category_snapshot,
          assignment_exercise.equipment_snapshot,
          assignment_exercise.prescription_type_snapshot::text,
          assignment_exercise.repetition_mode_snapshot::text,
          assignment_exercise.repetitions_min_snapshot,
          assignment_exercise.repetitions_max_snapshot,
          assignment_exercise.duration_seconds_snapshot,
          assignment_exercise.target_weight_kg_snapshot,
          assignment_exercise.rest_seconds_snapshot,
          assignment_exercise.trainer_note_snapshot,
          exercise_log.id AS exercise_log_id,
          exercise_log.status::text AS exercise_status,
          exercise_log.athlete_note,
          exercise_log.created_at AS exercise_log_created_at,
          exercise_log.updated_at AS exercise_log_updated_at
        FROM app.workout_assignment_exercises assignment_exercise
        LEFT JOIN app.workout_exercise_logs exercise_log
          ON exercise_log.assignment_exercise_id = assignment_exercise.id
          AND exercise_log.session_id = $2
        WHERE assignment_exercise.assignment_id = $1
        ORDER BY assignment_exercise.position, assignment_exercise.id`, [source.assignment_id, source.session_id]);

      const assignmentExerciseIds = exercisesResult.rows.map((row) => row.assignment_exercise_id);
      const setSnapshotsResult = assignmentExerciseIds.length
        ? await client.query<CanonicalSetSnapshotRow>(`SELECT
            source_set.id AS source_assignment_set_id,
            source_set.assignment_exercise_id,
            source_set.set_key_snapshot,
            source_set.position,
            source_set.kind_snapshot::text,
            source_set.repetitions_min_snapshot,
            source_set.repetitions_max_snapshot,
            source_set.duration_seconds_snapshot,
            source_set.target_weight_kg_snapshot,
            source_set.rest_seconds_snapshot
          FROM app.workout_assignment_exercise_sets source_set
          WHERE source_set.assignment_exercise_id = ANY($1::uuid[])
          ORDER BY source_set.assignment_exercise_id, source_set.position, source_set.id`, [assignmentExerciseIds])
        : { rows: [] as CanonicalSetSnapshotRow[] };

      const setLogsResult = await client.query<CanonicalSetLogRow>(`SELECT
          set_log.id AS set_log_id,
          set_log.exercise_log_id,
          exercise_log.assignment_exercise_id,
          set_log.source_assignment_set_id,
          set_log.set_key,
          set_log.position,
          set_log.kind::text,
          set_log.planned_repetitions_min,
          set_log.planned_repetitions_max,
          set_log.planned_duration_seconds,
          set_log.planned_weight_kg,
          set_log.status::text,
          set_log.actual_repetitions,
          set_log.actual_duration_seconds,
          set_log.actual_weight_kg,
          set_log.rpe,
          set_log.athlete_comment,
          set_log.created_at,
          set_log.updated_at
        FROM app.workout_set_logs set_log
        JOIN app.workout_exercise_logs exercise_log ON exercise_log.id = set_log.exercise_log_id
        WHERE exercise_log.session_id = $1
        ORDER BY exercise_log.position, set_log.position, set_log.id`, [source.session_id]);

      const feedbackResult = await client.query<FeedbackRow>(`${feedbackSelect}
        WHERE feedback.source_session_id = $1
        ORDER BY feedback.sent_at, feedback.id`, [source.session_id]);

      return this.projectReview(source, exercisesResult.rows, setSnapshotsResult.rows, setLogsResult.rows, feedbackResult.rows);
    });
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

  private projectReview(
    source: CanonicalReviewSourceRow,
    exerciseRows: CanonicalExerciseRow[],
    setSnapshotRows: CanonicalSetSnapshotRow[],
    setLogRows: CanonicalSetLogRow[],
    feedbackRows: FeedbackRow[],
  ): ReviewReadModel {
    const anomalies: ReviewAnomaly[] = [{
      type: "unsupported_session_context",
      detail: "Overall comment, discomfort and session-level subjective metrics are not canonically collected.",
    }];
    const sourceIdentityValid = source.attention_source_session_id === source.session_id
      && source.attention_athlete_user_id === source.session_athlete_user_id
      && source.attention_relation_id === source.session_relation_id
      && source.session_assignment_id === source.assignment_id
      && source.assignment_relation_id === source.session_relation_id
      && source.assignment_trainer_user_id === source.session_trainer_user_id
      && source.assignment_athlete_user_id === source.session_athlete_user_id;
    if (!sourceIdentityValid) {
      anomalies.push({
        type: "attention_source_mismatch",
        attentionItemId: source.attention_item_id,
        detail: "Attention, Session, Assignment, relation or athlete identities do not match.",
      });
    }

    const snapshotsByExercise = new Map<string, CanonicalSetSnapshotRow[]>();
    for (const snapshot of setSnapshotRows) {
      snapshotsByExercise.set(snapshot.assignment_exercise_id, [
        ...(snapshotsByExercise.get(snapshot.assignment_exercise_id) ?? []),
        snapshot,
      ]);
    }
    const logsByExercise = new Map<string, CanonicalSetLogRow[]>();
    for (const log of setLogRows) {
      logsByExercise.set(log.assignment_exercise_id, [
        ...(logsByExercise.get(log.assignment_exercise_id) ?? []),
        log,
      ]);
    }

    const exercises = exerciseRows.map<ReviewExerciseReadModel>((row) => {
      const snapshots = snapshotsByExercise.get(row.assignment_exercise_id) ?? [];
      const logs = logsByExercise.get(row.assignment_exercise_id) ?? [];
      const logBySource = new Map(logs
        .filter((log) => log.source_assignment_set_id)
        .map((log) => [log.source_assignment_set_id as string, log]));
      const usedLogIds = new Set<string>();
      const sets = snapshots.map((snapshot) => {
        const log = logBySource.get(snapshot.source_assignment_set_id) ?? null;
        if (log) usedLogIds.add(log.set_log_id);
        return projectSet(row.exercise_log_id, snapshot, log, anomalies);
      });
      for (const log of logs) {
        if (!usedLogIds.has(log.set_log_id)) sets.push(projectSet(row.exercise_log_id, null, log, anomalies));
      }
      sets.sort((left, right) => left.identity.position - right.identity.position
        || left.identity.setKey.localeCompare(right.identity.setKey));

      const note = row.athlete_note?.trim() ?? "";
      const sourceComments: ReviewSourceComment[] = note && row.exercise_log_id ? [{
        source: "exercise_note",
        sourceId: row.exercise_log_id,
        exerciseLogId: row.exercise_log_id,
        setLogId: null,
        text: note,
      }] : [];
      const exercise: ReviewExerciseReadModel = {
        identity: {
          exerciseLogId: row.exercise_log_id,
          assignmentExerciseId: row.assignment_exercise_id,
          position: row.position,
          title: row.title_snapshot,
        },
        prescribed: {
          instanceKey: row.instance_key,
          category: row.category_snapshot,
          equipment: row.equipment_snapshot,
          prescriptionType: row.prescription_type_snapshot,
          repetitionMode: row.repetition_mode_snapshot,
          repetitionsMin: row.repetitions_min_snapshot,
          repetitionsMax: row.repetitions_max_snapshot,
          durationSeconds: row.duration_seconds_snapshot,
          targetWeightKg: numberValue(row.target_weight_kg_snapshot),
          restSeconds: row.rest_seconds_snapshot,
          trainerNote: row.trainer_note_snapshot,
        },
        actual: {
          status: row.exercise_status ?? "missing",
          athleteNote: !row.exercise_log_id
            ? { status: "unavailable", reason: "exercise_log_unavailable" }
            : note
              ? { status: "ready", value: note }
              : unsupported("exercise_note_write_path_not_confirmed"),
          createdAt: row.exercise_log_created_at?.toISOString() ?? null,
          updatedAt: row.exercise_log_updated_at?.toISOString() ?? null,
        },
        sets,
        sourceComments,
        deviations: [],
      };
      for (const set of exercise.sets) set.deviations = projectReviewDeviations({ ...exercise, sets: [set] })
        .filter((item) => item.setLogId !== null || item.sourceAssignmentSetId !== null);
      exercise.deviations = projectReviewDeviations(exercise);
      return exercise;
    });

    const feedback = feedbackRows.map((row) => ({ ...mapFeedback(row), assignmentId: source.assignment_id }));
    for (const item of feedback) {
      if (item.attentionItemId !== source.attention_item_id || item.sessionId !== source.session_id) {
        anomalies.push({
          type: "feedback_attention_mismatch",
          attentionItemId: source.attention_item_id,
          feedbackId: item.id,
          detail: "Feedback belongs to a different Attention item or Session.",
        });
      }
    }

    const hasMissingLogs = exercises.some((exercise) => exercise.actual.status === "missing"
      || exercise.sets.some((set) => set.actual.status === "missing"));
    const hasMissingSetIdentity = anomalies.some((item) => item.type === "set_source_identity_missing");
    const actualExerciseCount = exerciseRows.filter((row) => row.exercise_log_id).length;
    const logCount = setLogRows.length;
    let logsAvailability: ReviewReadModel["dataAvailability"]["logs"];
    if (actualExerciseCount === 0 && logCount === 0) {
      logsAvailability = { status: "known_empty", value: null };
    } else if (hasMissingLogs || hasMissingSetIdentity) {
      logsAvailability = {
        status: "partial",
        value: { exerciseCount: actualExerciseCount, setCount: logCount },
        reason: "one_or_more_log_sources_are_incomplete",
      };
      anomalies.push({ type: "logs_partial", detail: "One or more expected exercise/set logs are missing or unlinked." });
    } else {
      logsAvailability = { status: "ready", value: { exerciseCount: actualExerciseCount, setCount: logCount } };
    }

    const overallComment = unsupported<string>("overall_session_comment_not_collected");
    const discomfort = unsupported<readonly never[]>("structured_discomfort_not_collected");
    const subjectiveMetrics = unsupported<Record<string, never>>("session_subjective_metrics_not_collected");
    const capabilities = reviewCapabilities({
      attentionStatus: source.attention_status,
      feedbackCount: feedback.length,
      sourceIdentityValid: sourceIdentityValid
        && !anomalies.some((item) => item.type === "feedback_attention_mismatch"),
    });
    const displayName = source.athlete_display_name?.trim()
      || `Спортсмен ${source.session_athlete_user_id.slice(0, 6)}`;
    const sourceAvailability = { status: "ready" as const, value: { sessionId: source.session_id } };
    const assignmentAvailability = { status: "ready" as const, value: { assignmentId: source.assignment_id } };
    const feedbackAvailability: ReviewReadModel["dataAvailability"]["feedback"] = feedback.length
      ? { status: "ready", value: { count: feedback.length } }
      : { status: "known_empty", value: null };

    return {
      identity: {
        sessionId: source.session_id,
        assignmentId: source.assignment_id,
        attentionItemId: source.attention_item_id,
        athleteUserId: source.session_athlete_user_id,
        relationId: source.session_relation_id,
      },
      athlete: { id: source.session_athlete_user_id, displayName, initials: initials(displayName) },
      attention: {
        id: source.attention_item_id,
        status: source.attention_status,
        createdAt: source.attention_created_at.toISOString(),
        resolvedAt: source.attention_resolved_at?.toISOString() ?? null,
        priorityReasons: source.priority_reasons,
        manualResolutionReason: source.manual_resolution_reason,
        sourceAvailability,
      },
      assignmentSnapshot: {
        id: source.assignment_id,
        sourceTemplateId: source.source_template_id,
        sourceRevisionId: source.source_revision_id,
        sourceRevisionNumber: source.source_revision_number,
        title: source.title_snapshot,
        scheduledFor: dateValue(source.scheduled_for),
        instruction: source.instruction_snapshot,
        trainerNote: source.trainer_note,
        createdAt: source.assignment_created_at.toISOString(),
      },
      session: {
        id: source.session_id,
        assignmentId: source.assignment_id,
        title: source.title_snapshot,
        status: source.session_status,
        clientTimezone: source.client_timezone,
        startedAt: source.session_started_at.toISOString(),
        completedAt: source.session_completed_at.toISOString(),
        durationMin: Math.max(0, Math.round((source.session_completed_at.getTime() - source.session_started_at.getTime()) / 60_000)),
        zeroResultReason: source.zero_result_reason?.trim()
          ? { status: "ready", value: source.zero_result_reason.trim() }
          : { status: "known_empty", value: null },
        createdAt: source.session_created_at.toISOString(),
        updatedAt: source.session_updated_at.toISOString(),
      },
      exercises,
      sessionContext: { overallComment, discomfort, subjectiveMetrics },
      existingFeedback: feedback,
      capabilities,
      anomalies,
      dataAvailability: {
        sourceSession: sourceAvailability,
        assignmentSnapshot: assignmentAvailability,
        logs: logsAvailability,
        feedback: feedbackAvailability,
        sessionContext: { overallComment, discomfort, subjectiveMetrics },
        canAssertNoDeviations: logsAvailability.status === "ready"
          && discomfort.status !== "unsupported"
          && anomalies.length === 0,
      },
    };
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
