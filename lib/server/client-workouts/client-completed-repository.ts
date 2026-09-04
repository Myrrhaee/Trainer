import "server-only";
import type { Pool } from "pg";
import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor } from "@/lib/server/database/actor-context";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { getDatabasePool } from "@/lib/server/database/pool";
import {
  assignmentSelect,
  mapClientAssignmentRow,
  type ClientAssignmentProjectionRow,
} from "./client-workout-repository";
import type {
  ClientCompletedWorkoutReadModel,
  ClientCompletedSet,
} from "./client-completed-types";

export class ClientCompletedRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  find(
    actor: Actor,
    sessionId: string,
  ): Promise<ClientCompletedWorkoutReadModel | "active" | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      await setTransactionActor(client, actor);
      const source = await client.query<{
        assignment_id: string;
        status: string;
        completed_at: Date;
        client_timezone: string;
        overall_comment: string | null;
        discomfort_reported: boolean | null;
        discomfort_comment: string | null;
        zero_result_reason: string | null;
      }>(
        `SELECT assignment_id,status::text,completed_at,client_timezone,overall_comment,discomfort_reported,discomfort_comment,zero_result_reason
         FROM app.workout_sessions WHERE id=$1 AND athlete_user_id=$2`,
        [sessionId, actor.userId],
      );
      const row = source.rows[0];
      if (!row) return null;
      if (row.status === "active") return "active";
      if (
        row.status !== "completed" &&
        row.status !== "completed_with_omissions"
      )
        return null;
      const prescribed = await client.query<ClientAssignmentProjectionRow>(
        `${assignmentSelect} WHERE assignment.id=$1 AND assignment.athlete_user_id=$2`,
        [row.assignment_id, actor.userId],
      );
      if (!prescribed.rows[0]) return null;
      const assignment = mapClientAssignmentRow(prescribed.rows[0]);
      const exercises = await client.query<{
        id: string;
        assignmentExerciseId: string;
        position: number;
        athleteNote: string;
      }>(
        `SELECT id,assignment_exercise_id AS "assignmentExerciseId",position,athlete_note AS "athleteNote" FROM app.workout_exercise_logs WHERE session_id=$1 ORDER BY position,id`,
        [sessionId],
      );
      const sets = await client.query<
        ClientCompletedSet & { exerciseId: string }
      >(
        `SELECT id,exercise_log_id AS "exerciseId",source_assignment_set_id AS "sourceAssignmentSetId",set_key AS "setKey",position,kind::text,
        planned_repetitions_min AS "plannedRepetitionsMin",planned_repetitions_max AS "plannedRepetitionsMax",planned_duration_seconds AS "plannedDurationSeconds",planned_weight_kg::float8 AS "plannedWeightKg",
        status::text,actual_repetitions AS "actualRepetitions",actual_duration_seconds AS "actualDurationSeconds",actual_weight_kg::float8 AS "actualWeightKg",rpe::float8,athlete_comment AS "athleteComment"
        FROM app.workout_set_logs WHERE exercise_log_id=ANY($1::uuid[]) ORDER BY exercise_log_id,position,id`,
        [exercises.rows.map((item) => item.id)],
      );
      return {
        sessionId,
        assignmentId: row.assignment_id,
        status: row.status,
        title: assignment.title,
        scheduledFor: assignment.scheduledFor,
        completedAt: row.completed_at.toISOString(),
        clientTimezone: row.client_timezone,
        generalInstruction: assignment.generalInstruction,
        trainerNote: assignment.trainerNote,
        context: {
          overallComment: row.overall_comment,
          discomfortReported: row.discomfort_reported,
          discomfortComment: row.discomfort_comment,
          zeroResultReason: row.zero_result_reason,
        },
        exercises: assignment.exercises,
        logs: exercises.rows.map((exercise) => ({
          ...exercise,
          sets: sets.rows
            .filter((set) => set.exerciseId === exercise.id)
            .map(({ exerciseId, ...set }) => {
              void exerciseId;
              return set;
            }),
        })),
      };
    });
  }
}
