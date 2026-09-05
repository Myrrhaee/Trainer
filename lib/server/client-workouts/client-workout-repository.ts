import "server-only";

import type { Pool } from "pg";

import type { RelationStatus } from "@/lib/server/access/access-types";
import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import type {
  ClientWorkoutAssignmentReadModel,
  ClientWorkoutCollectionReadModel,
  ClientWorkoutExercisePrescription,
} from "./client-workout-types";
import {
  ClientCurrentInputError,
  clientCurrentAdvanced,
  decodeClientCurrentCursor,
  encodeClientCurrentCursor,
  type ClientCurrentKey,
} from "./client-current-cursor";

const COLLECTION_LIMIT = 20;

export type ClientAssignmentProjectionRow = {
  assignment_id: string;
  athlete_user_id: string;
  trainer_display_name: string | null;
  source_template_id: string;
  source_revision_id: string;
  source_revision_number: number;
  scheduled_for: string;
  assignment_status: "available" | "cancelled";
  relation_status: RelationStatus;
  title_snapshot: string;
  instruction_snapshot: string;
  trainer_note: string;
  created_at: Date;
  current_bucket: 0 | 1;
  current_created_at: string;
  session_id: string | null;
  session_status: "active" | "completed" | "completed_with_omissions" | "abandoned" | null;
  session_version: number | null;
  session_started_at: Date | null;
  session_completed_at: Date | null;
  exercises: ClientWorkoutExercisePrescription[];
};

function numberValue(value: number | string | null) {
  return value === null ? null : Number(value);
}

function normalizeExercises(exercises: ClientWorkoutExercisePrescription[]) {
  return exercises.map((exercise) => ({
    ...exercise,
    targetWeightKg: numberValue(exercise.targetWeightKg),
    sets: exercise.sets.map((set) => ({ ...set, targetWeightKg: numberValue(set.targetWeightKg) })),
  }));
}

export function mapClientAssignmentRow(row: ClientAssignmentProjectionRow): ClientWorkoutAssignmentReadModel {
  const session = row.session_id && row.session_status && row.session_version !== null && row.session_started_at
    ? {
      sessionId: row.session_id,
      status: row.session_status,
      version: row.session_version,
      startedAt: row.session_started_at.toISOString(),
      completedAt: row.session_completed_at?.toISOString() ?? null,
    }
    : null;
  const available = row.assignment_status === "available" && row.relation_status === "active";
  return {
    assignmentId: row.assignment_id,
    athleteUserId: row.athlete_user_id,
    trainer: { displayName: row.trainer_display_name?.trim() || "Тренер" },
    source: {
      templateId: row.source_template_id,
      revisionId: row.source_revision_id,
      revisionNumber: row.source_revision_number,
    },
    scheduledFor: row.scheduled_for.slice(0, 10),
    status: row.assignment_status,
    relationStatus: row.relation_status,
    title: row.title_snapshot,
    generalInstruction: row.instruction_snapshot,
    trainerNote: row.trainer_note,
    exercises: normalizeExercises(row.exercises),
    session,
    capabilities: {
      canStart: available && session === null,
      canResume: session?.status === "active",
      canViewResult: session !== null && session.status !== "active",
    },
    createdAt: row.created_at.toISOString(),
  };
}

export class ClientWorkoutRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  listCurrent(
    actor: Actor,
    input: { start?: string; after?: string } = {},
  ): Promise<ClientWorkoutCollectionReadModel> {
    if (input.start !== undefined && input.after !== undefined)
      throw new ClientCurrentInputError("invalid_current_cursor");
    const cursor =
      input.start !== undefined
        ? decodeClientCurrentCursor(input.start, actor.userId, "start")
        : input.after !== undefined
          ? decodeClientCurrentCursor(input.after, actor.userId, "after")
          : null;
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ClientAssignmentProjectionRow>(clientCurrentSql, [
          actor.userId,
          cursor?.upper.bucket ?? null,
          cursor?.upper.scheduledFor ?? null,
          cursor?.upper.createdAt ?? null,
          cursor?.upper.assignmentId ?? null,
          cursor?.after?.bucket ?? null,
          cursor?.after?.scheduledFor ?? null,
          cursor?.after?.createdAt ?? null,
          cursor?.after?.assignmentId ?? null,
          COLLECTION_LIMIT + 1,
        ]);
      const page = result.rows.slice(0, COLLECTION_LIMIT);
      const assignments = page.map(mapClientAssignmentRow);
      const key = (row: ClientAssignmentProjectionRow): ClientCurrentKey => ({
        bucket: Number(row.current_bucket) as 0 | 1,
        scheduledFor: row.scheduled_for.slice(0, 10),
        createdAt: row.current_created_at,
        assignmentId: row.assignment_id,
      });
      const upper = cursor?.upper ?? (page[0] ? key(page[0]) : null);
      const hasNextPage = result.rows.length > COLLECTION_LIMIT;
      const last = page.length ? key(page[page.length - 1]) : null;
      if (
        hasNextPage &&
        cursor?.after &&
        last &&
        !clientCurrentAdvanced(cursor.after, last)
      )
        throw new ClientCurrentInputError("non_advancing_current_cursor");
      const token = (after: ClientCurrentKey | null) =>
        upper
          ? encodeClientCurrentCursor({
              v: 1,
              domain: "client-current-workouts",
              actor: actor.userId,
              upper,
              after,
            })
          : null;
      return {
        currentAssignmentId: assignments[0]?.assignmentId ?? null,
        assignments,
        limit: COLLECTION_LIMIT,
        hasMore: hasNextPage,
        pageInfo: {
          hasNextPage,
          startCursor: token(null),
          endCursor: hasNextPage && last ? token(last) : null,
        },
      };
    }, this.pool);
  }

  findAssignment(actor: Actor, assignmentId: string): Promise<ClientWorkoutAssignmentReadModel | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ClientAssignmentProjectionRow>(`${assignmentSelect}
        WHERE assignment.id = $1 AND assignment.athlete_user_id = $2`, [assignmentId, actor.userId]);
      return result.rowCount ? mapClientAssignmentRow(result.rows[0]) : null;
    }, this.pool);
  }

}

export const assignmentSelect = `
  SELECT assignment.id AS assignment_id, assignment.athlete_user_id,
         trainer.display_name AS trainer_display_name,
         assignment.source_template_id, assignment.source_revision_id,
         assignment.source_revision_number, assignment.scheduled_for::text AS scheduled_for,
         assignment.status::text AS assignment_status, relation.status::text AS relation_status,
         assignment.title_snapshot, assignment.instruction_snapshot, assignment.trainer_note,
         assignment.created_at,
         CASE WHEN session.status = 'active' THEN 0 ELSE 1 END AS current_bucket,
         to_char(assignment.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS current_created_at,
         session.id AS session_id, session.status::text AS session_status,
         session.version AS session_version, session.started_at AS session_started_at,
         session.completed_at AS session_completed_at,
         coalesce(composition.exercises, '[]'::jsonb) AS exercises
  FROM app.workout_assignments assignment
  JOIN app.trainer_athlete_relations relation ON relation.id = assignment.relation_id
  LEFT JOIN app.users trainer ON trainer.id = assignment.trainer_user_id
  LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'assignmentExerciseId', exercise.id,
      'instanceKey', exercise.instance_key,
      'sourceExerciseKey', exercise.source_exercise_key_snapshot,
      'position', exercise.position,
      'title', exercise.title_snapshot,
      'category', exercise.category_snapshot,
      'equipment', exercise.equipment_snapshot,
      'prescriptionType', exercise.prescription_type_snapshot,
      'repetitionMode', exercise.repetition_mode_snapshot,
      'setCount', exercise.sets_snapshot,
      'repetitionsMin', exercise.repetitions_min_snapshot,
      'repetitionsMax', exercise.repetitions_max_snapshot,
      'durationSeconds', exercise.duration_seconds_snapshot,
      'targetWeightKg', exercise.target_weight_kg_snapshot,
      'restSeconds', exercise.rest_seconds_snapshot,
      'trainerNote', exercise.trainer_note_snapshot,
      'perSetMode', exercise.per_set_mode_snapshot,
      'superset', CASE WHEN exercise.superset_key_snapshot IS NULL THEN NULL ELSE jsonb_build_object(
        'key', exercise.superset_key_snapshot,
        'position', exercise.superset_position_snapshot,
        'label', exercise.superset_label_snapshot,
        'instruction', exercise.superset_instruction_snapshot
      ) END,
      'sets', coalesce(prescribed_sets.items, '[]'::jsonb)
    ) ORDER BY exercise.position) AS exercises
    FROM app.workout_assignment_exercises exercise
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'assignmentSetId', prescribed.id,
        'setKey', prescribed.set_key_snapshot,
        'position', prescribed.position,
        'kind', prescribed.kind_snapshot,
        'repetitionsMin', prescribed.repetitions_min_snapshot,
        'repetitionsMax', prescribed.repetitions_max_snapshot,
        'durationSeconds', prescribed.duration_seconds_snapshot,
        'targetWeightKg', prescribed.target_weight_kg_snapshot,
        'restSeconds', prescribed.rest_seconds_snapshot,
        'usesOverride', prescribed.uses_override_snapshot
      ) ORDER BY prescribed.position) AS items
      FROM app.workout_assignment_exercise_sets prescribed
      WHERE prescribed.assignment_exercise_id = exercise.id
    ) prescribed_sets ON true
    WHERE exercise.assignment_id = assignment.id
  ) composition ON true`;

// Page identity is selected before prescription hydration so work stays bounded.
export const clientCurrentSql = `WITH page AS MATERIALIZED (
  SELECT assignment.id,
         CASE WHEN session.status = 'active' THEN 0 ELSE 1 END AS bucket,
         assignment.scheduled_for,
         assignment.created_at
  FROM app.workout_assignments assignment
  LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
  WHERE assignment.athlete_user_id = $1
    AND assignment.status = 'available'
    AND (session.id IS NULL OR session.status = 'active')
    AND ($2::integer IS NULL OR ROW(
      CASE WHEN session.status = 'active' THEN 0 ELSE 1 END,
      assignment.scheduled_for,
      assignment.created_at,
      assignment.id
    ) >= ROW($2::integer, $3::date, $4::timestamptz, $5::uuid))
    AND ($6::integer IS NULL OR ROW(
      CASE WHEN session.status = 'active' THEN 0 ELSE 1 END,
      assignment.scheduled_for,
      assignment.created_at,
      assignment.id
    ) > ROW($6::integer, $7::date, $8::timestamptz, $9::uuid))
  ORDER BY bucket ASC, assignment.scheduled_for ASC,
           assignment.created_at ASC, assignment.id ASC
  LIMIT $10
)
${assignmentSelect}
JOIN page current_page ON current_page.id = assignment.id
ORDER BY current_page.bucket ASC, current_page.scheduled_for ASC,
         current_page.created_at ASC, current_page.id ASC`;
