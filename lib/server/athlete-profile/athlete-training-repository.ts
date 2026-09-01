import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import {
  decodeAthleteTrainingCursor,
  encodeAthleteTrainingCursor,
} from "./athlete-training-cursor";
import type {
  AthleteTrainingActiveExecution,
  AthleteTrainingCurrentSnapshot,
  AthleteTrainingHistoryInput,
  AthleteTrainingHistoryItem,
  AthleteTrainingHistoryPage,
  AthleteTrainingLatestFeedback,
  AthleteTrainingNextAssignment,
  AthleteTrainingPendingReview,
  AthleteTrainingScope,
} from "./athlete-training-types";

type ScopeRow = {
  relation_id: string;
  relation_status: "active" | "suspended";
  athlete_user_id: string;
  athlete_status: "active" | "suspended" | "archived";
};

type CurrentRow = {
  read_at: Date;
  training_available: boolean;
  pending_reviews: AthleteTrainingPendingReview[];
  active_executions: AthleteTrainingActiveExecution[];
  next_assignment: AthleteTrainingNextAssignment | null;
  upcoming_assignment_count: number;
  latest_feedback: AthleteTrainingLatestFeedback | null;
};

type HistoryRow = {
  assignment_id: string;
  title_snapshot: string;
  scheduled_for: string | Date;
  assignment_status: "available" | "cancelled";
  assignment_created_at: Date;
  cancelled_at: Date | null;
  session_id: string | null;
  session_status: "active" | "completed" | "completed_with_omissions" | "abandoned" | null;
  session_started_at: Date | null;
  session_completed_at: Date | null;
  session_version: number | null;
  completed_sets: string;
  skipped_sets: string;
  incomplete_sets: string;
  total_sets: string;
  has_persisted_comment: boolean;
  attention_id: string | null;
  attention_status: "open" | "resolved" | "archived" | null;
  priority_reasons: string[] | null;
  attention_resolved_at: Date | null;
  resolution_kind: "feedback" | "manual" | "unknown" | null;
  feedback_count: string;
  latest_feedback_id: string | null;
  latest_feedback_kind: "detailed" | "acknowledgement" | "follow_up" | null;
  latest_feedback_sent_at: Date | null;
  sort_at: Date;
};

const DEFAULT_HISTORY_PAGE_SIZE = 10;
const MAX_HISTORY_PAGE_SIZE = 50;

export class AthleteTrainingRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  findScope(actor: Actor, athleteUserId: string): Promise<AthleteTrainingScope | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ScopeRow>(`
        SELECT relation.id AS relation_id,
               relation.status::text AS relation_status,
               relation.athlete_user_id,
               profile.status::text AS athlete_status
        FROM app.trainer_athlete_relations relation
        JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
        WHERE relation.trainer_user_id = $1
          AND relation.athlete_user_id = $2
          AND relation.status IN ('active', 'suspended')
        ORDER BY (relation.status = 'active') DESC, relation.accepted_at DESC, relation.id DESC
        LIMIT 1
      `, [actor.userId, athleteUserId]);
      const row = result.rows[0];
      return row ? {
        athleteUserId: row.athlete_user_id,
        athleteStatus: row.athlete_status,
        relationId: row.relation_id,
        relationStatus: row.relation_status,
      } : null;
    }, this.pool);
  }

  findCurrent(
    actor: Actor,
    scope: AthleteTrainingScope,
  ): Promise<AthleteTrainingCurrentSnapshot> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<CurrentRow>(`
        WITH authorized AS (
          SELECT relation.id AS relation_id
          FROM app.trainer_athlete_relations relation
          JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
          WHERE relation.id = $2
            AND relation.trainer_user_id = $1
            AND relation.athlete_user_id = $3
            AND relation.status = 'active'
            AND profile.status = 'active'
        ), pending AS (
          SELECT attention.id AS attention_item_id,
                 session.id AS session_id,
                 assignment.id AS assignment_id,
                 coalesce(assignment.title_snapshot, 'Источник недоступен') AS title,
                 attention.priority_reasons,
                 attention.created_at,
                 session.completed_at,
                 CASE WHEN session.id IS NULL OR assignment.id IS NULL
                   THEN 'unavailable' ELSE 'ready' END AS source_availability
          FROM authorized authorized_scope
          JOIN app.attention_items attention ON attention.relation_id = authorized_scope.relation_id
          LEFT JOIN app.workout_sessions session ON session.id = attention.source_session_id
          LEFT JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          WHERE attention.relation_id = $2
            AND attention.trainer_user_id = $1
            AND attention.athlete_user_id = $3
            AND attention.status = 'open'
          ORDER BY (attention.priority_reasons ? 'discomfort') DESC,
                   session.completed_at ASC NULLS LAST,
                   attention.id ASC
        ), active AS (
          SELECT session.id AS session_id,
                 session.assignment_id,
                 assignment.title_snapshot AS title,
                 assignment.scheduled_for,
                 session.started_at,
                 session.version
          FROM authorized authorized_scope
          JOIN app.workout_sessions session ON session.relation_id = authorized_scope.relation_id
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          WHERE session.relation_id = $2
            AND session.trainer_user_id = $1
            AND session.athlete_user_id = $3
            AND session.status = 'active'
            AND assignment.status = 'available'
          ORDER BY session.started_at DESC, session.id DESC
        ), upcoming AS (
          SELECT assignment.id AS assignment_id,
                 assignment.title_snapshot AS title,
                 assignment.scheduled_for,
                 assignment.created_at
          FROM authorized authorized_scope
          JOIN app.workout_assignments assignment ON assignment.relation_id = authorized_scope.relation_id
          LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
          WHERE assignment.relation_id = $2
            AND assignment.trainer_user_id = $1
            AND assignment.athlete_user_id = $3
            AND assignment.status = 'available'
            AND session.id IS NULL
          ORDER BY assignment.scheduled_for ASC,
                   assignment.created_at ASC,
                   assignment.id ASC
        ), latest_feedback AS (
          SELECT feedback.id AS feedback_id,
                 feedback.attention_item_id,
                 feedback.source_session_id AS session_id,
                 session.assignment_id,
                 assignment.title_snapshot AS title,
                 feedback.kind::text AS kind,
                 feedback.body,
                 feedback.follow_up_of_id,
                 feedback.sent_at
          FROM authorized authorized_scope
          JOIN app.trainer_feedback feedback ON feedback.relation_id = authorized_scope.relation_id
          JOIN app.workout_sessions session ON session.id = feedback.source_session_id
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          WHERE feedback.relation_id = $2
            AND feedback.trainer_user_id = $1
            AND feedback.athlete_user_id = $3
          ORDER BY feedback.sent_at DESC, feedback.id DESC
          LIMIT 1
        )
        SELECT clock_timestamp() AS read_at,
          EXISTS (SELECT 1 FROM authorized) AS training_available,
          coalesce((SELECT jsonb_agg(jsonb_build_object(
            'attentionItemId', pending.attention_item_id,
            'sessionId', pending.session_id,
            'assignmentId', pending.assignment_id,
            'title', pending.title,
            'attentionStatus', 'open',
            'priorityReasons', pending.priority_reasons,
            'createdAt', pending.created_at,
            'completedAt', pending.completed_at,
            'sourceAvailability', pending.source_availability
          ) ORDER BY (pending.priority_reasons ? 'discomfort') DESC,
                     pending.completed_at ASC NULLS LAST,
                     pending.attention_item_id ASC) FROM pending), '[]'::jsonb) AS pending_reviews,
          coalesce((SELECT jsonb_agg(jsonb_build_object(
            'assignmentId', active.assignment_id,
            'sessionId', active.session_id,
            'title', active.title,
            'scheduledFor', active.scheduled_for,
            'startedAt', active.started_at,
            'version', active.version
          ) ORDER BY active.started_at DESC, active.session_id DESC) FROM active), '[]'::jsonb) AS active_executions,
          (SELECT jsonb_build_object(
            'assignmentId', upcoming.assignment_id,
            'title', upcoming.title,
            'scheduledFor', upcoming.scheduled_for,
            'createdAt', upcoming.created_at
          ) FROM upcoming LIMIT 1) AS next_assignment,
          (SELECT count(*)::int FROM upcoming) AS upcoming_assignment_count,
          (SELECT jsonb_build_object(
            'feedbackId', latest_feedback.feedback_id,
            'attentionItemId', latest_feedback.attention_item_id,
            'sessionId', latest_feedback.session_id,
            'assignmentId', latest_feedback.assignment_id,
            'title', latest_feedback.title,
            'kind', latest_feedback.kind,
            'body', latest_feedback.body,
            'followUpOfId', latest_feedback.follow_up_of_id,
            'sentAt', latest_feedback.sent_at
          ) FROM latest_feedback) AS latest_feedback
      `, [actor.userId, scope.relationId, scope.athleteUserId]);
      const row = result.rows[0];
      return {
        trainingAvailable: row.training_available,
        pendingReviews: row.pending_reviews,
        activeExecutions: row.active_executions,
        nextAssignment: row.next_assignment,
        upcomingAssignmentCount: row.upcoming_assignment_count,
        latestFeedback: row.latest_feedback,
        readAt: row.read_at.toISOString(),
      };
    }, this.pool);
  }

  findLatestFeedback(
    actor: Actor,
    scope: AthleteTrainingScope,
  ): Promise<AthleteTrainingLatestFeedback | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<AthleteTrainingLatestFeedback>(`
        SELECT feedback.id AS "feedbackId",
               feedback.attention_item_id AS "attentionItemId",
               feedback.source_session_id AS "sessionId",
               session.assignment_id AS "assignmentId",
               assignment.title_snapshot AS title,
               feedback.kind::text AS kind,
               feedback.body,
               feedback.follow_up_of_id AS "followUpOfId",
               feedback.sent_at AS "sentAt"
        FROM app.trainer_feedback feedback
        JOIN app.trainer_athlete_relations relation ON relation.id = feedback.relation_id
        JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
        JOIN app.workout_sessions session ON session.id = feedback.source_session_id
        JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
        WHERE relation.id = $2
          AND relation.trainer_user_id = $1
          AND relation.athlete_user_id = $3
          AND relation.status = 'active'
          AND profile.status = 'active'
          AND feedback.trainer_user_id = $1
          AND feedback.athlete_user_id = $3
        ORDER BY feedback.sent_at DESC, feedback.id DESC
        LIMIT 1
      `, [actor.userId, scope.relationId, scope.athleteUserId]);
      const feedback = result.rows[0];
      return feedback ? { ...feedback, sentAt: new Date(feedback.sentAt).toISOString() } : null;
    }, this.pool);
  }

  findHistory(
    actor: Actor,
    scope: AthleteTrainingScope,
    input: AthleteTrainingHistoryInput = {},
  ): Promise<AthleteTrainingHistoryPage> {
    const first = normalizePageSize(input.first);
    const cursor = input.after
      ? decodeAthleteTrainingCursor(input.after, scope)
      : null;

    return withActorTransaction(actor, async (client) => {
      const result = await client.query<HistoryRow>(`
        WITH authorized AS (
          SELECT relation.id AS relation_id
          FROM app.trainer_athlete_relations relation
          JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
          WHERE relation.id = $2
            AND relation.trainer_user_id = $1
            AND relation.athlete_user_id = $3
            AND relation.status = 'active'
            AND profile.status = 'active'
        ), set_summary AS (
          SELECT exercise.session_id,
                 count(set_log.id) FILTER (WHERE set_log.status = 'completed')::text AS completed_sets,
                 count(set_log.id) FILTER (WHERE set_log.status = 'skipped')::text AS skipped_sets,
                 count(set_log.id) FILTER (WHERE set_log.status = 'incomplete')::text AS incomplete_sets,
                 count(set_log.id)::text AS total_sets,
                 coalesce(bool_or(btrim(exercise.athlete_note) <> ''), false)
                   OR coalesce(bool_or(btrim(set_log.athlete_comment) <> ''), false) AS has_persisted_comment
          FROM authorized authorized_scope
          JOIN app.workout_sessions scoped_session
            ON scoped_session.relation_id = authorized_scope.relation_id
          JOIN app.workout_exercise_logs exercise ON exercise.session_id = scoped_session.id
          LEFT JOIN app.workout_set_logs set_log ON set_log.exercise_log_id = exercise.id
          WHERE scoped_session.relation_id = $2
            AND scoped_session.trainer_user_id = $1
            AND scoped_session.athlete_user_id = $3
          GROUP BY exercise.session_id
        ), feedback_summary AS (
          SELECT feedback.source_session_id,
                 count(*)::text AS feedback_count,
                 (array_agg(feedback.id ORDER BY feedback.sent_at DESC, feedback.id DESC))[1] AS latest_feedback_id,
                 (array_agg(feedback.kind::text ORDER BY feedback.sent_at DESC, feedback.id DESC))[1] AS latest_feedback_kind,
                 (array_agg(feedback.sent_at ORDER BY feedback.sent_at DESC, feedback.id DESC))[1] AS latest_feedback_sent_at
          FROM authorized authorized_scope
          JOIN app.trainer_feedback feedback ON feedback.relation_id = authorized_scope.relation_id
          WHERE feedback.relation_id = $2
            AND feedback.trainer_user_id = $1
            AND feedback.athlete_user_id = $3
          GROUP BY feedback.source_session_id
        ), terminal AS (
          SELECT assignment.id AS assignment_id,
                 assignment.title_snapshot,
                 assignment.scheduled_for,
                 assignment.status::text AS assignment_status,
                 assignment.created_at AS assignment_created_at,
                 assignment.cancelled_at,
                 session.id AS session_id,
                 session.status::text AS session_status,
                 session.started_at AS session_started_at,
                 session.completed_at AS session_completed_at,
                 session.version AS session_version,
                 coalesce(summary.completed_sets, '0') AS completed_sets,
                 coalesce(summary.skipped_sets, '0') AS skipped_sets,
                 coalesce(summary.incomplete_sets, '0') AS incomplete_sets,
                 coalesce(summary.total_sets, '0') AS total_sets,
                 coalesce(summary.has_persisted_comment, false) AS has_persisted_comment,
                 attention.id AS attention_id,
                 attention.status::text AS attention_status,
                 attention.priority_reasons,
                 attention.resolved_at AS attention_resolved_at,
                 CASE
                   WHEN feedback.feedback_count::int > 0 THEN 'feedback'
                   WHEN manual.attention_item_id IS NOT NULL THEN 'manual'
                   WHEN attention.status = 'resolved' THEN 'unknown'
                   ELSE NULL
                 END AS resolution_kind,
                 coalesce(feedback.feedback_count, '0') AS feedback_count,
                 feedback.latest_feedback_id,
                 feedback.latest_feedback_kind,
                 feedback.latest_feedback_sent_at,
                 coalesce(session.completed_at, assignment.cancelled_at,
                          session.started_at, assignment.created_at) AS sort_at
          FROM authorized authorized_scope
          JOIN app.workout_assignments assignment ON assignment.relation_id = authorized_scope.relation_id
          LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
          LEFT JOIN set_summary summary ON summary.session_id = session.id
          LEFT JOIN app.attention_items attention
            ON attention.source_session_id = session.id AND attention.item_type = 'workout_review'
          LEFT JOIN app.attention_manual_resolutions manual ON manual.attention_item_id = attention.id
          LEFT JOIN feedback_summary feedback ON feedback.source_session_id = session.id
          WHERE assignment.relation_id = $2
            AND assignment.trainer_user_id = $1
            AND assignment.athlete_user_id = $3
            AND (
              assignment.status = 'cancelled'
              OR session.status IN ('completed', 'completed_with_omissions', 'abandoned')
            )
        )
        SELECT * FROM terminal
        WHERE ($4::timestamptz IS NULL OR (sort_at, assignment_id) < ($4::timestamptz, $5::uuid))
        ORDER BY sort_at DESC, assignment_id DESC
        LIMIT $6
      `, [
        actor.userId,
        scope.relationId,
        scope.athleteUserId,
        cursor?.sortAt ?? null,
        cursor?.assignmentId ?? null,
        first + 1,
      ]);

      const hasNextPage = result.rows.length > first;
      const rows = hasNextPage ? result.rows.slice(0, first) : result.rows;
      const items = rows.map(mapHistoryRow);
      const last = rows.at(-1);
      return {
        items,
        pageInfo: {
          hasNextPage,
          endCursor: hasNextPage && last ? encodeAthleteTrainingCursor({
            athleteUserId: scope.athleteUserId,
            relationId: scope.relationId,
            sortAt: last.sort_at.toISOString(),
            assignmentId: last.assignment_id,
          }) : null,
        },
      };
    }, this.pool);
  }
}

function normalizePageSize(value: number | undefined) {
  if (value === undefined) return DEFAULT_HISTORY_PAGE_SIZE;
  if (!Number.isInteger(value) || value < 1 || value > MAX_HISTORY_PAGE_SIZE) {
    throw new RangeError("athlete_training_history_page_size_invalid");
  }
  return value;
}

function dateValue(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function mapHistoryRow(row: HistoryRow): AthleteTrainingHistoryItem {
  const session = row.session_id && row.session_status && row.session_started_at && row.session_version
    ? {
        id: row.session_id,
        status: row.session_status,
        startedAt: row.session_started_at.toISOString(),
        completedAt: row.session_completed_at?.toISOString() ?? null,
        version: row.session_version,
      }
    : null;
  return {
    assignment: {
      id: row.assignment_id,
      title: row.title_snapshot,
      scheduledFor: dateValue(row.scheduled_for),
      status: row.assignment_status,
      createdAt: row.assignment_created_at.toISOString(),
      cancelledAt: row.cancelled_at?.toISOString() ?? null,
    },
    session,
    completion: session ? {
      completedSets: Number(row.completed_sets),
      skippedSets: Number(row.skipped_sets),
      incompleteSets: Number(row.incomplete_sets),
      totalSets: Number(row.total_sets),
    } : null,
    attention: row.attention_id && row.attention_status ? {
      id: row.attention_id,
      status: row.attention_status,
      priorityReasons: row.priority_reasons ?? [],
      resolvedAt: row.attention_resolved_at?.toISOString() ?? null,
      resolutionKind: row.resolution_kind,
    } : null,
    feedback: {
      count: Number(row.feedback_count),
      latestFeedbackId: row.latest_feedback_id,
      latestKind: row.latest_feedback_kind,
      latestSentAt: row.latest_feedback_sent_at?.toISOString() ?? null,
    },
    hasPersistedComment: row.has_persisted_comment,
    sortAt: row.sort_at.toISOString(),
    destination: {
      assignmentId: row.assignment_id,
      sessionId: row.session_id,
      attentionItemId: row.attention_id,
    },
    degraded: null,
  };
}
