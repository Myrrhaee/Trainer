import "server-only";
import type { Pool } from "pg";
import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import {
  ClientHistoryInputError,
  decodeHistoryCursor,
  encodeHistoryCursor,
  historyLimit,
  type HistoryKey,
} from "./client-history-cursor";
import type { ClientWorkoutHistoryReadModel } from "./client-history-types";

// Select the page before touching prescription, result or feedback aggregates.
export const clientHistorySql = `WITH page AS MATERIALIZED (
  SELECT s.id, s.assignment_id, s.status, s.completed_at, s.client_timezone
  FROM app.workout_sessions s
  WHERE s.athlete_user_id = $1 AND s.status IN ('completed','completed_with_omissions')
    AND ($2::timestamptz IS NULL OR (s.completed_at,s.id) <= ($2::timestamptz,$3::uuid))
    AND ($4::timestamptz IS NULL OR (s.completed_at,s.id) < ($4::timestamptz,$5::uuid))
  ORDER BY s.completed_at DESC,s.id DESC LIMIT $6
), plan AS (
  SELECT p.id, count(e.id)::int AS exercises, coalesce(sum(e.sets_snapshot),0)::int AS sets
  FROM page p LEFT JOIN app.workout_assignment_exercises e ON e.assignment_id=p.assignment_id
  GROUP BY p.id
), actual AS (
  SELECT p.id, count(l.id)::int AS recorded,
    count(l.id) FILTER (WHERE l.status='completed')::int AS completed,
    count(l.id) FILTER (WHERE l.status='skipped')::int AS skipped,
    count(l.id) FILTER (WHERE l.status='incomplete')::int AS incomplete,
    count(l.id) FILTER (WHERE l.status='pending')::int AS pending
  FROM page p LEFT JOIN app.workout_exercise_logs e ON e.session_id=p.id
  LEFT JOIN app.workout_set_logs l ON l.exercise_log_id=e.id GROUP BY p.id
), feedback AS (
  SELECT p.id, count(f.id)::int AS count, max(f.sent_at) AS latest
  FROM page p LEFT JOIN app.trainer_feedback f ON f.source_session_id=p.id AND f.athlete_user_id=$1 GROUP BY p.id
)
SELECT p.id, p.assignment_id, p.status::text, p.client_timezone,
  to_char(p.completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS completed_at,
  a.title_snapshot, a.scheduled_for::text, plan.exercises, plan.sets,
  actual.recorded, actual.completed, actual.skipped, actual.incomplete, actual.pending,
  feedback.count AS feedback_count, feedback.latest AS latest_feedback_at
FROM page p JOIN app.workout_assignments a ON a.id=p.assignment_id AND a.athlete_user_id=$1
JOIN plan ON plan.id=p.id JOIN actual ON actual.id=p.id JOIN feedback ON feedback.id=p.id
ORDER BY p.completed_at DESC,p.id DESC`;

type Row = {
  id: string;
  assignment_id: string;
  status: "completed" | "completed_with_omissions";
  client_timezone: string;
  completed_at: string;
  title_snapshot: string;
  scheduled_for: string;
  exercises: number;
  sets: number;
  recorded: number;
  completed: number;
  skipped: number;
  incomplete: number;
  pending: number;
  feedback_count: number;
  latest_feedback_at: Date | null;
};

export class ClientHistoryRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async history(
    actor: Actor,
    input: { first?: string; start?: string; after?: string } = {},
  ): Promise<ClientWorkoutHistoryReadModel> {
    const first = historyLimit(input.first);
    if (input.start !== undefined && input.after !== undefined)
      throw new ClientHistoryInputError("invalid_history_cursor");
    const cursor =
      input.start !== undefined
        ? decodeHistoryCursor(input.start, actor.userId, "start")
        : input.after !== undefined
          ? decodeHistoryCursor(input.after, actor.userId, "after")
          : null;
    return withActorTransaction(
      actor,
      async (client) => {
        const { rows } = await client.query<Row>(clientHistorySql, [
          actor.userId,
          cursor?.upper.at ?? null,
          cursor?.upper.id ?? null,
          cursor?.after?.at ?? null,
          cursor?.after?.id ?? null,
          first + 1,
        ]);
        const page = rows.slice(0, first);
        const key = (row: Row): HistoryKey => ({
          at: row.completed_at,
          id: row.id,
        });
        const upper = cursor?.upper ?? (page[0] ? key(page[0]) : null);
        const token = (after: HistoryKey | null) =>
          upper
            ? encodeHistoryCursor({
                v: 1,
                domain: "client-history",
                actor: actor.userId,
                upper,
                after,
              })
            : null;
        return {
          items: page.map((row) => ({
            sessionId: row.id,
            assignmentId: row.assignment_id,
            title: row.title_snapshot,
            scheduledFor: row.scheduled_for,
            completedAt: row.completed_at,
            clientTimezone: row.client_timezone,
            status: row.status,
            summary: {
              availability:
                row.exercises > 0 &&
                row.sets > 0 &&
                row.recorded === row.sets &&
                row.pending === 0
                  ? "ready"
                  : "partial",
              exerciseCount: row.exercises,
              plannedSetCount: row.sets,
              completedSetCount: row.completed,
              skippedSetCount: row.skipped,
              incompleteSetCount: row.incomplete,
            },
            feedback: {
              hasFeedback: row.feedback_count > 0,
              feedbackCount: row.feedback_count,
              latestFeedbackAt: row.latest_feedback_at?.toISOString() ?? null,
            },
          })),
          pageInfo: {
            hasNextPage: rows.length > first,
            startCursor: token(null),
            endCursor:
              rows.length > first && page.length
                ? token(key(page[page.length - 1]))
                : null,
          },
        };
      },
      this.pool,
    );
  }
}
