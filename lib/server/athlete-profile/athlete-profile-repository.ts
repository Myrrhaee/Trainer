import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import type {
  AthleteProfileAttentionSnapshot,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";

type ProfileRow = {
  relation_id: string;
  relation_status: "active" | "suspended";
  accepted_at: Date;
  athlete_user_id: string;
  display_name: string | null;
  athlete_status: "active" | "suspended" | "archived";
  goal_summary: string | null;
  biography: string | null;
  training_experience: string | null;
  athlete_context: string | null;
  training_preferences: string[];
  available_equipment: string[];
  schedule_context: string | null;
  athlete_reported_limitations: string | null;
  assignment_id: string | null;
  assignment_title: string | null;
  scheduled_for: string | Date | null;
  assignment_session_id: string | null;
  assignment_session_status: "active" | null;
  last_session_id: string | null;
  last_assignment_id: string | null;
  last_session_title: string | null;
  last_session_status: "completed" | "completed_with_omissions" | null;
  last_started_at: Date | null;
  last_completed_at: Date | null;
  completed_sets: string | null;
  total_sets: string | null;
  feedback_id: string | null;
  feedback_session_id: string | null;
  feedback_kind: "detailed" | "acknowledgement" | "follow_up" | null;
  feedback_sent_at: Date | null;
  attention_id: string | null;
  attention_session_id: string | null;
  attention_title: string | null;
  attention_reasons: string[] | null;
};

type AttentionRow = {
  id: string;
  source_session_id: string;
  title_snapshot: string;
  status: "open" | "resolved" | "archived";
  priority_reasons: string[];
};

function displayName(value: string | null, athleteUserId: string) {
  return value?.trim() || `Спортсмен ${athleteUserId.slice(0, 6)}`;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "").join("") || "С";
}

function dateValue(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export class AthleteProfileRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  findSnapshot(actor: Actor, athleteUserId: string): Promise<AthleteProfileSnapshot | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ProfileRow>(`
        SELECT relation.id AS relation_id, relation.status::text AS relation_status,
               relation.accepted_at, relation.athlete_user_id, account.display_name,
               profile.status::text AS athlete_status, profile.goal_summary,
               profile.biography, profile.training_experience, profile.athlete_context,
               profile.training_preferences, profile.available_equipment,
               profile.schedule_context, profile.athlete_reported_limitations,
               next_work.assignment_id, next_work.assignment_title, next_work.scheduled_for,
               next_work.session_id AS assignment_session_id,
               next_work.session_status AS assignment_session_status,
               recent.session_id AS last_session_id,
               recent.assignment_id AS last_assignment_id,
               recent.session_title AS last_session_title,
               recent.session_status AS last_session_status,
               recent.started_at AS last_started_at,
               recent.completed_at AS last_completed_at,
               recent.completed_sets, recent.total_sets,
               feedback.id AS feedback_id,
               feedback.source_session_id AS feedback_session_id,
               feedback.kind AS feedback_kind,
               feedback.sent_at AS feedback_sent_at,
               attention.id AS attention_id,
               attention.source_session_id AS attention_session_id,
               attention.title_snapshot AS attention_title,
               attention.priority_reasons AS attention_reasons
        FROM app.trainer_athlete_relations relation
        JOIN app.users account ON account.id = relation.athlete_user_id
        JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
        LEFT JOIN LATERAL (
          SELECT assignment.id AS assignment_id,
                 assignment.title_snapshot AS assignment_title,
                 assignment.scheduled_for,
                 session.id AS session_id,
                 session.status::text AS session_status
          FROM app.workout_assignments assignment
          LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
          WHERE assignment.relation_id = relation.id
            AND assignment.status = 'available'
            AND (session.id IS NULL OR session.status = 'active')
          ORDER BY (session.status = 'active') DESC NULLS LAST,
                   assignment.scheduled_for, assignment.created_at DESC
          LIMIT 1
        ) next_work ON true
        LEFT JOIN LATERAL (
          SELECT session.id AS session_id, session.assignment_id,
                 assignment.title_snapshot AS session_title,
                 session.status::text AS session_status,
                 session.started_at, session.completed_at,
                 count(set_log.id) FILTER (WHERE set_log.status = 'completed')::text AS completed_sets,
                 count(set_log.id)::text AS total_sets
          FROM app.workout_sessions session
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          LEFT JOIN app.workout_exercise_logs exercise ON exercise.session_id = session.id
          LEFT JOIN app.workout_set_logs set_log ON set_log.exercise_log_id = exercise.id
          WHERE session.relation_id = relation.id
            AND session.status IN ('completed', 'completed_with_omissions')
          GROUP BY session.id, assignment.id
          ORDER BY session.completed_at DESC, session.id DESC
          LIMIT 1
        ) recent ON true
        LEFT JOIN LATERAL (
          SELECT item.id, item.source_session_id, item.kind::text AS kind, item.sent_at
          FROM app.trainer_feedback item
          WHERE item.relation_id = relation.id
          ORDER BY item.sent_at DESC, item.id DESC
          LIMIT 1
        ) feedback ON true
        LEFT JOIN LATERAL (
          SELECT item.id, item.source_session_id, assignment.title_snapshot,
                 item.priority_reasons
          FROM app.attention_items item
          JOIN app.workout_sessions session ON session.id = item.source_session_id
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          WHERE item.relation_id = relation.id AND item.status = 'open'
          ORDER BY (item.priority_reasons ? 'discomfort') DESC,
                   item.created_at, item.id
          LIMIT 1
        ) attention ON true
        WHERE relation.trainer_user_id = $1
          AND relation.athlete_user_id = $2
          AND relation.status IN ('active', 'suspended')
        ORDER BY (relation.status = 'active') DESC, relation.accepted_at DESC
        LIMIT 1
      `, [actor.userId, athleteUserId]);

      const row = result.rows[0];
      if (!row) return null;
      const name = displayName(row.display_name, row.athlete_user_id);
      return {
        athleteUserId: row.athlete_user_id,
        displayName: name,
        initials: initials(name),
        athleteStatus: row.athlete_status,
        relationId: row.relation_id,
        relationStatus: row.relation_status,
        acceptedAt: row.accepted_at.toISOString(),
        profile: {
          goal: row.goal_summary,
          biography: row.biography,
          trainingExperience: row.training_experience,
          athleteContext: row.athlete_context,
          preferences: row.training_preferences ?? [],
          availableEquipment: row.available_equipment ?? [],
          schedule: row.schedule_context,
          athleteReportedLimitations: row.athlete_reported_limitations,
        },
        currentAssignment: row.assignment_id && row.assignment_title && row.scheduled_for
          ? {
              id: row.assignment_id,
              title: row.assignment_title,
              scheduledFor: dateValue(row.scheduled_for),
              status: row.assignment_session_status === "active" ? "in_progress" : "scheduled",
              sessionId: row.assignment_session_id,
            }
          : null,
        lastSession: row.last_session_id && row.last_assignment_id && row.last_session_title
          && row.last_session_status && row.last_started_at && row.last_completed_at
          ? {
              id: row.last_session_id,
              assignmentId: row.last_assignment_id,
              title: row.last_session_title,
              status: row.last_session_status,
              startedAt: row.last_started_at.toISOString(),
              completedAt: row.last_completed_at.toISOString(),
              completedSets: Number(row.completed_sets ?? 0),
              totalSets: Number(row.total_sets ?? 0),
            }
          : null,
        lastFeedback: row.feedback_id && row.feedback_session_id && row.feedback_kind && row.feedback_sent_at
          ? {
              id: row.feedback_id,
              sessionId: row.feedback_session_id,
              kind: row.feedback_kind,
              sentAt: row.feedback_sent_at.toISOString(),
            }
          : null,
        openAttention: row.attention_id && row.attention_session_id && row.attention_title
          ? {
              id: row.attention_id,
              sessionId: row.attention_session_id,
              title: row.attention_title,
              status: "open",
              priorityReasons: row.attention_reasons ?? [],
            }
          : null,
      };
    }, this.pool);
  }

  findAttention(
    actor: Actor,
    athleteUserId: string,
    attentionItemId: string,
  ): Promise<AthleteProfileAttentionSnapshot | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<AttentionRow>(`
        SELECT attention.id, attention.source_session_id,
               assignment.title_snapshot, attention.status::text AS status,
               attention.priority_reasons
        FROM app.attention_items attention
        JOIN app.workout_sessions session ON session.id = attention.source_session_id
        JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
        WHERE attention.trainer_user_id = $1
          AND attention.athlete_user_id = $2
          AND attention.id = $3
      `, [actor.userId, athleteUserId, attentionItemId]);
      const row = result.rows[0];
      return row ? {
        id: row.id,
        sessionId: row.source_session_id,
        title: row.title_snapshot,
        status: row.status,
        priorityReasons: row.priority_reasons ?? [],
      } : null;
    }, this.pool);
  }
}
