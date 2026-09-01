import "server-only";

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { enqueueNotification } from "@/lib/server/notifications/notification-outbox";
import {
  assignmentStateTokensEqual,
  projectAssignmentStateToken,
} from "@/lib/server/quick-assign/assignment-state-token";
import type { QuickAssignUpcomingAssignment } from "@/lib/server/quick-assign/quick-assign-types";
import type {
  CreateWorkoutAssignmentInput,
  CreateWorkoutTemplateInput,
  TrainerAthlete,
  WorkoutAssignment,
  WorkoutExerciseInput,
  WorkoutTemplate,
} from "@/lib/server/workouts/workout-types";

export type WorkoutAssignmentCommandErrorCode =
  | "template_revision_stale"
  | "template_unavailable"
  | "template_not_found"
  | "assignment_state_changed"
  | "assignment_duplicate"
  | "same_date_confirmation_required"
  | "athlete_relation_changed"
  | "assignment_forbidden"
  | "assignment_idempotency_conflict";

export class WorkoutAssignmentCommandError extends Error {
  constructor(
    public readonly commandCode: WorkoutAssignmentCommandErrorCode,
    public readonly existingAssignmentId?: string,
  ) {
    super(commandCode);
  }
}

export class WorkoutAssignmentIdempotencyConflictError extends WorkoutAssignmentCommandError {
  constructor() {
    super("assignment_idempotency_conflict");
  }
}

interface AthleteRow {
  relation_id: string;
  athlete_user_id: string;
  display_name: string | null;
  accepted_at: Date;
}

interface TemplateRow {
  id: string;
  title: string;
  description: string;
  status: "published";
  revision_id: string;
  revision_number: number;
  general_instruction: string;
  estimated_duration_min: number | null;
  exercises: Array<{
    instanceKey: string;
    title: string;
    sets: number;
    repetitions: number;
    targetWeightKg: number | string | null;
    restSeconds: number;
    trainerNote: string;
  }>;
  created_at: Date;
}

interface AssignmentRow {
  id: string;
  athlete_user_id: string;
  trainer_user_id: string;
  title_snapshot: string;
  trainer_note: string;
  instruction_snapshot: string;
  scheduled_for: string | Date;
  status: "available" | "cancelled";
  source_template_id: string;
  source_revision_id: string;
  revision_number: number;
  exercises: TemplateRow["exercises"];
  created_at: Date;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "С";
}

function mapExercises(rows: TemplateRow["exercises"]): WorkoutExerciseInput[] {
  return rows.map((row) => ({
    ...row,
    targetWeightKg: row.targetWeightKg === null ? null : Number(row.targetWeightKg),
  }));
}

function mapTemplate(row: TemplateRow): WorkoutTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    revisionId: row.revision_id,
    revision: row.revision_number,
    generalInstruction: row.general_instruction,
    estimatedDurationMin: row.estimated_duration_min,
    exercises: mapExercises(row.exercises),
    createdAt: row.created_at.toISOString(),
  };
}

function mapAssignment(row: AssignmentRow): WorkoutAssignment {
  return {
    id: row.id,
    assignmentId: row.id,
    athleteUserId: row.athlete_user_id,
    trainerUserId: row.trainer_user_id,
    title: row.title_snapshot,
    titleSnapshot: row.title_snapshot,
    trainerNote: row.trainer_note,
    generalInstruction: row.instruction_snapshot,
    scheduledFor: row.scheduled_for instanceof Date
      ? row.scheduled_for.toISOString().slice(0, 10)
      : row.scheduled_for.slice(0, 10),
    status: row.status,
    sourceTemplateId: row.source_template_id,
    sourceRevisionId: row.source_revision_id,
    sourceRevision: row.revision_number,
    sourceRevisionNumber: row.revision_number,
    exercises: mapExercises(row.exercises),
    createdAt: row.created_at.toISOString(),
  };
}

const templateSelect = `
  SELECT template.id, template.title, template.description, template.status::text,
         revision.id AS revision_id, revision.revision_number,
         revision.general_instruction, revision.estimated_duration_min,
         template.created_at,
         coalesce(jsonb_agg(
           jsonb_build_object(
             'instanceKey', exercise.instance_key,
             'title', exercise.title,
             'sets', exercise.sets,
             'repetitions', exercise.repetitions,
             'targetWeightKg', exercise.target_weight_kg,
             'restSeconds', exercise.rest_seconds,
             'trainerNote', exercise.trainer_note
           ) ORDER BY exercise.position
         ) FILTER (WHERE exercise.id IS NOT NULL), '[]'::jsonb) AS exercises
  FROM app.workout_templates template
  JOIN app.workout_template_revisions revision
    ON revision.template_id = template.id
   AND revision.revision_number = template.current_revision
  LEFT JOIN app.workout_template_exercises exercise ON exercise.revision_id = revision.id`;

export class PostgresWorkoutRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async listTrainerAthletes(actor: Actor): Promise<TrainerAthlete[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<AthleteRow>(
        `SELECT relation.id AS relation_id, relation.athlete_user_id,
                account.display_name, relation.accepted_at
         FROM app.trainer_athlete_relations relation
         JOIN app.users account ON account.id = relation.athlete_user_id
         WHERE relation.trainer_user_id = $1 AND relation.status = 'active'
         ORDER BY relation.accepted_at DESC`,
        [actor.userId],
      );
      return result.rows.map((row) => {
        const displayName = row.display_name?.trim() || `Спортсмен ${row.athlete_user_id.slice(0, 6)}`;
        return {
          relationId: row.relation_id,
          athleteUserId: row.athlete_user_id,
          displayName,
          initials: initials(displayName),
          acceptedAt: row.accepted_at.toISOString(),
        };
      });
    }, this.pool);
  }

  async listTemplates(actor: Actor): Promise<WorkoutTemplate[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<TemplateRow>(
        `${templateSelect}
         WHERE template.trainer_user_id = $1 AND template.status = 'published'
         GROUP BY template.id, revision.id
         ORDER BY template.updated_at DESC`,
        [actor.userId],
      );
      return result.rows.map(mapTemplate);
    }, this.pool);
  }

  async createPublishedTemplate(actor: Actor, input: CreateWorkoutTemplateInput) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const template = await client.query<{ id: string }>(
        `INSERT INTO app.workout_templates (
           trainer_user_id, title, description, status, current_revision
         ) VALUES ($1, $2, $3, 'published', 1)
         RETURNING id`,
        [actor.userId, input.title, input.description],
      );
      const revision = await client.query<{ id: string }>(
        `INSERT INTO app.workout_template_revisions (
           template_id, revision_number, title, description,
           general_instruction, estimated_duration_min
         ) VALUES ($1, 1, $2, $3, $4, $5)
         RETURNING id`,
        [
          template.rows[0].id,
          input.title,
          input.description,
          input.generalInstruction,
          input.estimatedDurationMin,
        ],
      );
      await this.insertTemplateExercises(client, revision.rows[0].id, input.exercises);
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $1, 'workout.template.published',
           jsonb_build_object('template_id', $2::text, 'revision', 1))`,
        [actor.userId, template.rows[0].id],
      );
      const result = await client.query<TemplateRow>(
        `${templateSelect}
         WHERE template.id = $1
         GROUP BY template.id, revision.id`,
        [template.rows[0].id],
      );
      return mapTemplate(result.rows[0]);
    });
  }

  async createAssignment(
    actor: Actor,
    input: CreateWorkoutAssignmentInput,
  ) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const assignmentId = input.assignmentId ?? randomUUID();
      const existing = await this.findAssignment(client, assignmentId);
      if (existing) {
        assertAssignmentReplay(existing, actor.userId, input);
        return existing;
      }
      const strictR2C = Boolean(input.templateRevisionId && input.assignmentStateToken);
      const relation = await client.query<{ id: string; status: "active" | "suspended" }>(
        `SELECT id, status::text
         FROM app.trainer_athlete_relations
         WHERE trainer_user_id = $1
           AND athlete_user_id = $2
           AND status IN ('active', 'suspended')
         ORDER BY (status = 'active') DESC, accepted_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [actor.userId, input.athleteUserId],
      );
      if (!relation.rowCount) {
        if (strictR2C) throw new WorkoutAssignmentCommandError("assignment_forbidden");
        return null;
      }
      if (relation.rows[0].status !== "active") {
        if (strictR2C) throw new WorkoutAssignmentCommandError("athlete_relation_changed");
        return null;
      }

      const upcoming = await this.findUpcomingAssignments(
        client,
        actor.userId,
        input.athleteUserId,
        relation.rows[0].id,
      );
      const currentStateToken = projectAssignmentStateToken({
        trainerUserId: actor.userId,
        athleteUserId: input.athleteUserId,
        relationId: relation.rows[0].id,
        assignments: upcoming,
      });
      if (input.assignmentStateToken
        && !assignmentStateTokensEqual(input.assignmentStateToken, currentStateToken)) {
        throw new WorkoutAssignmentCommandError("assignment_state_changed");
      }

      const templateHead = await client.query<{
        id: string;
        status: "draft" | "published" | "archived";
        current_revision: number;
      }>(
        `SELECT id, status::text, current_revision
         FROM app.workout_templates
         WHERE id = $1 AND trainer_user_id = $2
         FOR UPDATE`,
        [input.templateId, actor.userId],
      );
      if (!templateHead.rowCount) {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_not_found");
        return null;
      }

      const revisionResult = input.templateRevisionId
        ? await client.query<{
            revision_id: string;
            revision_number: number;
            revision_status: "draft" | "published";
            title: string;
            general_instruction: string;
          }>(
            `SELECT id AS revision_id, revision_number, status::text AS revision_status,
                    title, general_instruction
             FROM app.workout_template_revisions
             WHERE id = $1 AND template_id = $2`,
            [input.templateRevisionId, input.templateId],
          )
        : await client.query<{
            revision_id: string;
            revision_number: number;
            revision_status: "draft" | "published";
            title: string;
            general_instruction: string;
          }>(
            `SELECT id AS revision_id, revision_number, status::text AS revision_status,
                    title, general_instruction
             FROM app.workout_template_revisions
             WHERE template_id = $1 AND revision_number = $2`,
            [input.templateId, templateHead.rows[0].current_revision],
          );
      if (!revisionResult.rowCount) {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_not_found");
        return null;
      }
      const template = {
        id: templateHead.rows[0].id,
        status: templateHead.rows[0].status,
        currentRevision: templateHead.rows[0].current_revision,
        ...revisionResult.rows[0],
      };
      if (template.status === "archived") {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_unavailable");
        return null;
      }
      if (template.revision_number !== template.currentRevision) {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_revision_stale");
        return null;
      }
      if (template.status !== "published" || template.revision_status !== "published") {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_unavailable");
        return null;
      }

      const exercises = await client.query<{
        id: string;
        instance_key: string;
        position: number;
        title: string;
        sets: number;
        repetitions: number;
        target_weight_kg: string | null;
        rest_seconds: number;
        trainer_note: string;
        source_exercise_key: string;
        category: string;
        equipment: string | null;
        prescription_type: "repetitions" | "duration";
        repetition_mode: "fixed" | "range";
        repetitions_min: number | null;
        repetitions_max: number | null;
        duration_seconds: number | null;
        per_set_mode: boolean;
        superset_key: string | null;
        superset_position: number | null;
        superset_label: string | null;
        superset_instruction: string | null;
      }>(
        `SELECT * FROM app.workout_template_exercises
         WHERE revision_id = $1 ORDER BY position`,
        [template.revision_id],
      );
      if (!exercises.rowCount) {
        if (strictR2C) throw new WorkoutAssignmentCommandError("template_unavailable");
        return null;
      }

      const duplicate = upcoming.find((item) => (
        item.sourceRevisionId === template.revision_id
        && item.scheduledFor === input.scheduledFor
      ));
      if (duplicate) {
        throw new WorkoutAssignmentCommandError("assignment_duplicate", duplicate.assignmentId);
      }
      const sameDate = upcoming.find((item) => item.scheduledFor === input.scheduledFor);
      if (sameDate && !input.allowAdditionalAssignment) {
        throw new WorkoutAssignmentCommandError("same_date_confirmation_required", sameDate.assignmentId);
      }

      const assignment = await client.query<{ id: string }>(
        `INSERT INTO app.workout_assignments (
           id, relation_id, trainer_user_id, athlete_user_id,
           source_template_id, source_revision_id, source_revision_number,
           title_snapshot, instruction_snapshot, trainer_note, scheduled_for
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          assignmentId,
          relation.rows[0].id,
          actor.userId,
          input.athleteUserId,
          template.id,
          template.revision_id,
          template.revision_number,
          template.title,
          template.general_instruction,
          input.trainerNote,
          input.scheduledFor,
        ],
      );
      if (!assignment.rowCount) {
        const replay = await this.findAssignment(client, assignmentId);
        if (!replay) throw new WorkoutAssignmentIdempotencyConflictError();
        assertAssignmentReplay(replay, actor.userId, input);
        return replay;
      }
      for (const exercise of exercises.rows) {
        const assignmentExercise = await client.query<{ id: string }>(
          `INSERT INTO app.workout_assignment_exercises (
             assignment_id, source_template_exercise_id, instance_key, position,
             title_snapshot, sets_snapshot, repetitions_snapshot,
             target_weight_kg_snapshot, rest_seconds_snapshot, trainer_note_snapshot,
             source_exercise_key_snapshot, category_snapshot, equipment_snapshot,
             prescription_type_snapshot, repetition_mode_snapshot,
             repetitions_min_snapshot, repetitions_max_snapshot, duration_seconds_snapshot,
             per_set_mode_snapshot, superset_key_snapshot, superset_position_snapshot,
             superset_label_snapshot, superset_instruction_snapshot
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           RETURNING id`,
          [
            assignment.rows[0].id,
            exercise.id,
            exercise.instance_key,
            exercise.position,
            exercise.title,
            exercise.sets,
            exercise.repetitions,
            exercise.target_weight_kg,
            exercise.rest_seconds,
            exercise.trainer_note,
            exercise.source_exercise_key,
            exercise.category,
            exercise.equipment,
            exercise.prescription_type,
            exercise.repetition_mode,
            exercise.repetitions_min,
            exercise.repetitions_max,
            exercise.duration_seconds,
            exercise.per_set_mode,
            exercise.superset_key,
            exercise.superset_position,
            exercise.superset_label,
            exercise.superset_instruction,
          ],
        );
        await client.query(
          `INSERT INTO app.workout_assignment_exercise_sets (
             assignment_exercise_id, source_template_set_id, set_key_snapshot, position,
             kind_snapshot, repetitions_min_snapshot, repetitions_max_snapshot,
             duration_seconds_snapshot, target_weight_kg_snapshot, rest_seconds_snapshot,
             uses_override_snapshot
           ) SELECT $1, source.id, source.set_key, source.position, source.kind,
                    source.repetitions_min, source.repetitions_max, source.duration_seconds,
                    source.target_weight_kg, source.rest_seconds, source.uses_override
             FROM app.workout_template_exercise_sets source
             WHERE source.exercise_id = $2 ORDER BY source.position`,
          [assignmentExercise.rows[0].id, exercise.id],
        );
      }
      await client.query(
        `INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
         VALUES ($1, $2, 'workout.assignment.created',
           jsonb_build_object('assignment_id', $3::text, 'template_id', $4::text, 'revision', $5::int))`,
        [
          actor.userId,
          input.athleteUserId,
          assignment.rows[0].id,
          template.id,
          template.revision_number,
        ],
      );
      await enqueueNotification(client, {
        eventType: "workout_assigned",
        recipientUserId: input.athleteUserId,
        actorUserId: actor.userId,
        aggregateType: "workout_assignment",
        aggregateId: assignment.rows[0].id,
      });
      return this.findAssignment(client, assignment.rows[0].id);
    });
  }

  async listAthleteAssignments(actor: Actor): Promise<WorkoutAssignment[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<AssignmentRow>(
        `${this.assignmentSelect()}
         WHERE assignment.athlete_user_id = $1 AND assignment.status = 'available'
         GROUP BY assignment.id
         ORDER BY assignment.scheduled_for ASC, assignment.created_at ASC`,
        [actor.userId],
      );
      return result.rows.map(mapAssignment);
    }, this.pool);
  }

  findTrainerAssignment(actor: Actor, assignmentId: string) {
    return withActorTransaction(actor, (client) => this.findAssignment(client, assignmentId), this.pool);
  }

  private async findUpcomingAssignments(
    client: PoolClient,
    trainerUserId: string,
    athleteUserId: string,
    relationId: string,
  ): Promise<QuickAssignUpcomingAssignment[]> {
    const result = await client.query<{
      assignment_id: string;
      source_revision_id: string;
      title_snapshot: string;
      scheduled_for: string;
      created_at: Date;
    }>(`
      SELECT assignment.id AS assignment_id,
             assignment.source_revision_id,
             assignment.title_snapshot,
             assignment.scheduled_for::text AS scheduled_for,
             assignment.created_at
      FROM app.workout_assignments assignment
      LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
      WHERE assignment.relation_id = $3
        AND assignment.trainer_user_id = $1
        AND assignment.athlete_user_id = $2
        AND assignment.status = 'available'
        AND session.id IS NULL
      ORDER BY assignment.scheduled_for ASC, assignment.created_at ASC, assignment.id ASC
    `, [trainerUserId, athleteUserId, relationId]);
    return result.rows.map((row) => ({
      assignmentId: row.assignment_id,
      sourceRevisionId: row.source_revision_id,
      title: row.title_snapshot,
      scheduledFor: row.scheduled_for.slice(0, 10),
      createdAt: row.created_at.toISOString(),
    }));
  }

  private async insertTemplateExercises(
    client: PoolClient,
    revisionId: string,
    exercises: WorkoutExerciseInput[],
  ) {
    for (const [index, exercise] of exercises.entries()) {
      await client.query(
        `INSERT INTO app.workout_template_exercises (
           revision_id, instance_key, position, title, sets, repetitions,
           target_weight_kg, rest_seconds, trainer_note,
           source_exercise_key, repetitions_min, repetitions_max
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $6, $6)`,
        [
          revisionId,
          exercise.instanceKey,
          index + 1,
          exercise.title,
          exercise.sets,
          exercise.repetitions,
          exercise.targetWeightKg,
          exercise.restSeconds,
          exercise.trainerNote,
          exercise.instanceKey,
        ],
      );
    }
  }

  private assignmentSelect() {
    return `SELECT assignment.id, assignment.athlete_user_id, assignment.trainer_user_id,
                   assignment.title_snapshot, assignment.trainer_note,
                   assignment.instruction_snapshot, assignment.scheduled_for::text AS scheduled_for,
                   assignment.status::text, assignment.source_template_id,
                   assignment.source_revision_id,
                   assignment.source_revision_number AS revision_number, assignment.created_at,
                   coalesce(jsonb_agg(
                     jsonb_build_object(
                       'instanceKey', exercise.instance_key,
                       'title', exercise.title_snapshot,
                       'sets', exercise.sets_snapshot,
                       'repetitions', exercise.repetitions_snapshot,
                       'targetWeightKg', exercise.target_weight_kg_snapshot,
                       'restSeconds', exercise.rest_seconds_snapshot,
                       'trainerNote', exercise.trainer_note_snapshot
                     ) ORDER BY exercise.position
                   ) FILTER (WHERE exercise.id IS NOT NULL), '[]'::jsonb) AS exercises
            FROM app.workout_assignments assignment
            LEFT JOIN app.workout_assignment_exercises exercise ON exercise.assignment_id = assignment.id`;
  }

  private async findAssignment(client: PoolClient, assignmentId: string) {
    const result = await client.query<AssignmentRow>(
      `${this.assignmentSelect()}
       WHERE assignment.id = $1
       GROUP BY assignment.id`,
      [assignmentId],
    );
    return result.rowCount ? mapAssignment(result.rows[0]) : null;
  }
}

function assertAssignmentReplay(
  assignment: WorkoutAssignment,
  trainerUserId: string,
  input: CreateWorkoutAssignmentInput,
) {
  if (assignment.trainerUserId !== trainerUserId
    || assignment.athleteUserId !== input.athleteUserId
    || assignment.sourceTemplateId !== input.templateId
    || (input.templateRevisionId !== undefined && assignment.sourceRevisionId !== input.templateRevisionId)
    || assignment.scheduledFor !== input.scheduledFor
    || assignment.trainerNote !== input.trainerNote) {
    throw new WorkoutAssignmentIdempotencyConflictError();
  }
}
