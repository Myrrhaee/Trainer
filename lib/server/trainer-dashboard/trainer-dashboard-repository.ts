import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { ReviewRepository } from "@/lib/server/reviews/review-repository";
import type {
  TrainerDashboardActivity,
  TrainerDashboardAthlete,
  TrainerDashboardSnapshot,
} from "@/lib/server/trainer-dashboard/trainer-dashboard-types";

type AthleteRow = {
  relation_id: string;
  athlete_user_id: string;
  athlete_status: "active" | "suspended" | "archived";
  display_name: string | null;
  accepted_at: Date;
  latest_activity_at: Date;
  assignment_id: string | null;
  assignment_title: string | null;
  scheduled_for: string | null;
  session_id: string | null;
  session_status: "active" | null;
};

type ActivityRow = {
  id: string;
  athlete_user_id: string;
  display_name: string | null;
  kind: TrainerDashboardActivity["kind"];
  title: string;
  detail: string;
  occurred_at: Date;
  session_id: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "С";
}

function displayName(value: string | null, athleteUserId: string) {
  return value?.trim() || `Спортсмен ${athleteUserId.slice(0, 6)}`;
}

export class TrainerDashboardRepository {
  private readonly reviews: ReviewRepository;

  constructor(private readonly pool: Pool = getDatabasePool("app")) {
    this.reviews = new ReviewRepository(pool);
  }

  async snapshot(actor: Actor): Promise<TrainerDashboardSnapshot> {
    const [athletes, reviews, activities] = await Promise.all([
      this.listAthletes(actor),
      this.reviews.listQueue(actor),
      this.listActivity(actor),
    ]);
    return { athletes, reviews, activities };
  }

  private listAthletes(actor: Actor): Promise<TrainerDashboardAthlete[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<AthleteRow>(`
        SELECT relation.id AS relation_id, relation.athlete_user_id,
               profile.status::text AS athlete_status,
               account.display_name, relation.accepted_at,
               greatest(
                 relation.accepted_at,
                 coalesce(latest_assignment.created_at, relation.accepted_at),
                 coalesce(latest_session.updated_at, relation.accepted_at),
                 coalesce(latest_feedback.sent_at, relation.accepted_at)
               ) AS latest_activity_at,
               next_work.assignment_id, next_work.assignment_title,
               next_work.scheduled_for, next_work.session_id, next_work.session_status
        FROM app.trainer_athlete_relations relation
        JOIN app.users account ON account.id = relation.athlete_user_id
        JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
        LEFT JOIN LATERAL (
          SELECT assignment.created_at
          FROM app.workout_assignments assignment
          WHERE assignment.trainer_user_id = $1
            AND assignment.athlete_user_id = relation.athlete_user_id
            AND assignment.status = 'available'
          ORDER BY assignment.created_at DESC
          LIMIT 1
        ) latest_assignment ON true
        LEFT JOIN LATERAL (
          SELECT session.updated_at
          FROM app.workout_sessions session
          WHERE session.trainer_user_id = $1
            AND session.athlete_user_id = relation.athlete_user_id
          ORDER BY session.updated_at DESC
          LIMIT 1
        ) latest_session ON true
        LEFT JOIN LATERAL (
          SELECT feedback.sent_at
          FROM app.trainer_feedback feedback
          WHERE feedback.trainer_user_id = $1
            AND feedback.athlete_user_id = relation.athlete_user_id
          ORDER BY feedback.sent_at DESC
          LIMIT 1
        ) latest_feedback ON true
        LEFT JOIN LATERAL (
          SELECT assignment.id AS assignment_id,
                 assignment.title_snapshot AS assignment_title,
                 assignment.scheduled_for::text AS scheduled_for,
                 session.id AS session_id,
                 session.status::text AS session_status
          FROM app.workout_assignments assignment
          LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
          WHERE assignment.trainer_user_id = $1
            AND assignment.athlete_user_id = relation.athlete_user_id
            AND assignment.status = 'available'
            AND (session.id IS NULL OR session.status = 'active')
          ORDER BY (session.status = 'active') DESC NULLS LAST,
                   assignment.scheduled_for ASC, assignment.created_at DESC
          LIMIT 1
        ) next_work ON true
        WHERE relation.trainer_user_id = $1 AND relation.status = 'active'
        ORDER BY latest_activity_at DESC, relation.id
      `, [actor.userId]);

      return result.rows.map((row) => {
        const name = displayName(row.display_name, row.athlete_user_id);
        return {
          relationId: row.relation_id,
          relationStatus: "active",
          athleteUserId: row.athlete_user_id,
          athleteStatus: row.athlete_status,
          displayName: name,
          initials: initials(name),
          acceptedAt: row.accepted_at.toISOString(),
          latestActivityAt: row.latest_activity_at.toISOString(),
          nextAssignment: row.assignment_id && row.assignment_title && row.scheduled_for
            ? {
                id: row.assignment_id,
                title: row.assignment_title,
                scheduledFor: row.scheduled_for.slice(0, 10),
                sessionId: row.session_id,
                status: row.session_status === "active" ? "in_progress" : "scheduled",
              }
            : null,
        };
      });
    }, this.pool);
  }

  private listActivity(actor: Actor): Promise<TrainerDashboardActivity[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ActivityRow>(`
        WITH team AS (
          SELECT relation.athlete_user_id
          FROM app.trainer_athlete_relations relation
          WHERE relation.trainer_user_id = $1 AND relation.status = 'active'
        ), activity AS (
          SELECT 'assignment:' || assignment.id::text AS id,
                 assignment.athlete_user_id,
                 'workout_assigned'::text AS kind,
                 'Назначена тренировка'::text AS title,
                 assignment.title_snapshot::text AS detail,
                 assignment.created_at AS occurred_at,
                 NULL::uuid AS session_id
          FROM app.workout_assignments assignment
          JOIN team ON team.athlete_user_id = assignment.athlete_user_id
          WHERE assignment.trainer_user_id = $1 AND assignment.status = 'available'

          UNION ALL

          SELECT 'session:' || session.id::text,
                 session.athlete_user_id,
                 'workout_completed'::text,
                 'Тренировка завершена'::text,
                 assignment.title_snapshot::text,
                 session.completed_at,
                 session.id
          FROM app.workout_sessions session
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          JOIN team ON team.athlete_user_id = session.athlete_user_id
          WHERE session.trainer_user_id = $1
            AND session.status IN ('completed', 'completed_with_omissions')

          UNION ALL

          SELECT 'feedback:' || feedback.id::text,
                 feedback.athlete_user_id,
                 'feedback_sent'::text,
                 'Отправлена обратная связь'::text,
                 assignment.title_snapshot::text,
                 feedback.sent_at,
                 feedback.source_session_id
          FROM app.trainer_feedback feedback
          JOIN app.workout_sessions session ON session.id = feedback.source_session_id
          JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id
          JOIN team ON team.athlete_user_id = feedback.athlete_user_id
          WHERE feedback.trainer_user_id = $1
        )
        SELECT activity.id, activity.athlete_user_id, account.display_name,
               activity.kind, activity.title, activity.detail,
               activity.occurred_at, activity.session_id
        FROM activity
        JOIN app.users account ON account.id = activity.athlete_user_id
        ORDER BY activity.occurred_at DESC, activity.id
        LIMIT 40
      `, [actor.userId]);

      return result.rows.map((row) => ({
        id: row.id,
        athleteUserId: row.athlete_user_id,
        athleteDisplayName: displayName(row.display_name, row.athlete_user_id),
        kind: row.kind,
        title: row.title,
        detail: row.detail,
        occurredAt: row.occurred_at.toISOString(),
        sessionId: row.session_id,
      }));
    }, this.pool);
  }
}
