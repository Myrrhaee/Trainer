import "server-only";

import type { Pool, PoolClient } from "pg";
import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type { BuilderExercise, BuilderItem, BuilderSet, BuilderTemplate, SaveBuilderTemplateInput } from "./workout-builder-types";

type Head = {
  id: string; title: string; status: "draft" | "published" | "archived";
  revision_id: string; revision_number: number; description: string; category: string;
  estimated_duration_min: number | null; general_instruction: string; updated_at: Date; usage_count: string;
  published_revision_id: string | null; published_revision_number: number | null;
  editable_revision_id: string | null; editable_revision_number: number | null;
};

type ExerciseRow = {
  id: string; instance_key: string; source_exercise_key: string; title: string; category: string;
  equipment: string | null; description: string | null; image_url: string | null;
  prescription_type: "repetitions" | "duration"; repetition_mode: "fixed" | "range";
  sets: number; repetitions_min: number | null; repetitions_max: number | null;
  duration_seconds: number | null; target_weight_kg: string | null; rest_seconds: number;
  per_set_mode: boolean; trainer_note: string; superset_key: string | null;
  superset_position: number | null; superset_label: string | null; superset_instruction: string | null;
};

type SetRow = {
  exercise_id: string; set_key: string; position: number; kind: "warmup" | "working";
  repetitions_min: number | null; repetitions_max: number | null; duration_seconds: number | null;
  target_weight_kg: string | null; rest_seconds: number; uses_override: boolean;
};

const headSelect = `SELECT template.id, revision.title,
  CASE WHEN template.status = 'archived' THEN 'archived' ELSE revision.status::text END AS status,
  revision.id AS revision_id, revision.revision_number, revision.description, revision.category,
  revision.estimated_duration_min, revision.general_instruction,
  greatest(template.updated_at, revision.updated_at) AS updated_at,
  template.published_revision_id, published.revision_number AS published_revision_number,
  template.editable_revision_id, editable.revision_number AS editable_revision_number,
  (SELECT count(*)::text FROM app.workout_assignments assignment
   WHERE assignment.source_template_id = template.id) AS usage_count
FROM app.workout_templates template
JOIN app.workout_template_revisions revision
  ON revision.id = coalesce(template.editable_revision_id, template.published_revision_id)
LEFT JOIN app.workout_template_revisions published ON published.id = template.published_revision_id
LEFT JOIN app.workout_template_revisions editable ON editable.id = template.editable_revision_id`;

export type WorkoutBuilderCommandErrorCode =
  | "template_archived"
  | "editable_draft_not_found"
  | "editable_draft_already_exists"
  | "published_revision_not_found"
  | "template_lifecycle_conflict"
  | "revision_already_published";

export class WorkoutBuilderCommandError extends Error {
  constructor(public readonly commandCode: WorkoutBuilderCommandErrorCode) {
    super(commandCode);
  }
}

function valueText(value: number | string | null) {
  return value === null ? "" : String(Number(value));
}

function updatedLabel(value: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 2) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ч назад` : value.toLocaleDateString("ru-RU");
}

function mapSet(row: SetRow): BuilderSet {
  return {
    id: row.set_key, order: row.position, kind: row.kind,
    repetitionsMin: valueText(row.repetitions_min), repetitionsMax: valueText(row.repetitions_max),
    durationSec: valueText(row.duration_seconds), targetWeightKg: valueText(row.target_weight_kg),
    restSec: String(row.rest_seconds), usesOverride: row.uses_override,
  };
}

function mapExercise(row: ExerciseRow, sets: BuilderSet[]): BuilderExercise {
  return {
    instanceId: row.instance_key, exerciseId: row.source_exercise_key, title: row.title, category: row.category,
    ...(row.equipment ? { equipment: row.equipment } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    prescription: {
      type: row.prescription_type, sets: String(row.sets), repetitionMode: row.repetition_mode,
      repetitionsMin: valueText(row.repetitions_min), repetitionsMax: valueText(row.repetitions_max),
      durationSec: valueText(row.duration_seconds), targetWeightKg: valueText(row.target_weight_kg),
      restSec: String(row.rest_seconds),
    },
    perSetMode: row.per_set_mode, setOverrides: sets, trainerNote: row.trainer_note,
  };
}

function mapItems(rows: ExerciseRow[], sets: Map<string, BuilderSet[]>): BuilderItem[] {
  const items: BuilderItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.superset_key) {
      items.push({ id: row.instance_key, kind: "exercise", exercise: mapExercise(row, sets.get(row.id) ?? []) });
      continue;
    }
    if (seen.has(row.superset_key)) continue;
    seen.add(row.superset_key);
    items.push({
      id: row.superset_key, kind: "superset", label: row.superset_label ?? "",
      instruction: row.superset_instruction ?? "",
      exercises: rows.filter((item) => item.superset_key === row.superset_key)
        .sort((a, b) => (a.superset_position ?? 0) - (b.superset_position ?? 0))
        .map((item) => mapExercise(item, sets.get(item.id) ?? [])),
    });
  }
  return items;
}

export class WorkoutBuilderRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  list(actor: Actor): Promise<BuilderTemplate[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<Head>(`${headSelect}
        WHERE template.trainer_user_id = $1 ORDER BY template.updated_at DESC`, [actor.userId]);
      return Promise.all(result.rows.map((row) => this.hydrate(client, row)));
    }, this.pool);
  }

  saveDraft(actor: Actor, input: SaveBuilderTemplateInput): Promise<BuilderTemplate | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      let templateId = input.id;
      let revisionId: string;
      const current = templateId ? await client.query<Head>(`${headSelect}
        WHERE template.id = $1 AND template.trainer_user_id = $2
          AND template.status <> 'archived'
          AND revision.id = template.editable_revision_id
          AND revision.status = 'draft'
        FOR UPDATE OF template, revision`, [templateId, actor.userId]) : null;
      if (templateId && !current?.rowCount) {
        const lifecycle = await client.query<{
          status: "draft" | "published" | "archived";
          editable_revision_id: string | null;
        }>(`SELECT status::text, editable_revision_id
            FROM app.workout_templates
            WHERE id = $1 AND trainer_user_id = $2
            FOR UPDATE`, [templateId, actor.userId]);
        if (!lifecycle.rowCount) return null;
        return null;
      }
      if (current?.rowCount) {
        if (current.rows[0].revision_number !== input.revision) {
          throw new WorkoutBuilderCommandError("template_lifecycle_conflict");
        }
        revisionId = current.rows[0].revision_id;
        await client.query(`UPDATE app.workout_templates
          SET title = CASE WHEN published_revision_id IS NULL THEN $2 ELSE title END,
              description = CASE WHEN published_revision_id IS NULL THEN $3 ELSE description END
          WHERE id = $1`,
          [templateId, input.title, input.description]);
        await client.query(`UPDATE app.workout_template_revisions SET title = $2, description = $3,
          category = $4, estimated_duration_min = $5, general_instruction = $6 WHERE id = $1`,
          [revisionId, input.title, input.description, input.category, input.estimatedDurationMin || null, input.generalInstruction]);
        await client.query(`DELETE FROM app.workout_template_exercise_sets WHERE exercise_id IN
          (SELECT id FROM app.workout_template_exercises WHERE revision_id = $1)`, [revisionId]);
        await client.query(`DELETE FROM app.workout_template_exercises WHERE revision_id = $1`, [revisionId]);
      } else {
        const template = await client.query<{ id: string }>(`INSERT INTO app.workout_templates
          (trainer_user_id, title, description, status, current_revision)
          VALUES ($1, $2, $3, 'draft', 1) RETURNING id`, [actor.userId, input.title, input.description]);
        templateId = template.rows[0].id;
        const revision = await client.query<{ id: string }>(`INSERT INTO app.workout_template_revisions
          (template_id, revision_number, title, description, category, estimated_duration_min,
           general_instruction, status, published_at)
          VALUES ($1, 1, $2, $3, $4, $5, $6, 'draft', NULL) RETURNING id`,
          [templateId, input.title, input.description, input.category, input.estimatedDurationMin || null, input.generalInstruction]);
        revisionId = revision.rows[0].id;
        await client.query(`UPDATE app.workout_templates
          SET editable_revision_id = $2, current_revision = 1
          WHERE id = $1`, [templateId, revisionId]);
      }
      await this.insertItems(client, revisionId, input.items);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1, $1, 'workout.template.draft_saved', jsonb_build_object('template_id', $2::text))`,
        [actor.userId, templateId]);
      return this.find(client, actor.userId, templateId!);
    });
  }

  publish(actor: Actor, templateId: string): Promise<BuilderTemplate | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const current = await client.query<Head>(`${headSelect}
        WHERE template.id = $1 AND template.trainer_user_id = $2
          AND template.status <> 'archived'
          AND revision.id = template.editable_revision_id
          AND revision.status = 'draft'
        FOR UPDATE OF template, revision`, [templateId, actor.userId]);
      if (!current.rowCount) {
        const lifecycle = await client.query<{
          status: "draft" | "published" | "archived";
          published_revision_id: string | null;
          editable_revision_id: string | null;
        }>(`SELECT status::text, published_revision_id, editable_revision_id
            FROM app.workout_templates
            WHERE id = $1 AND trainer_user_id = $2
            FOR UPDATE`, [templateId, actor.userId]);
        if (!lifecycle.rowCount) return null;
        if (lifecycle.rows[0].status === "archived") throw new WorkoutBuilderCommandError("template_archived");
        if (lifecycle.rows[0].published_revision_id && !lifecycle.rows[0].editable_revision_id) {
          throw new WorkoutBuilderCommandError("revision_already_published");
        }
        throw new WorkoutBuilderCommandError("editable_draft_not_found");
      }
      await client.query(`UPDATE app.workout_template_revisions
        SET status = 'published', published_at = clock_timestamp() WHERE id = $1`, [current.rows[0].revision_id]);
      await client.query(`UPDATE app.workout_templates
        SET status = 'published',
            published_revision_id = $2,
            editable_revision_id = NULL,
            current_revision = $3,
            title = $4,
            description = $5
        WHERE id = $1`, [
        templateId,
        current.rows[0].revision_id,
        current.rows[0].revision_number,
        current.rows[0].title,
        current.rows[0].description,
      ]);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1, $1, 'workout.template.published', jsonb_build_object('template_id', $2::text))`,
        [actor.userId, templateId]);
      return this.find(client, actor.userId, templateId);
    });
  }

  createRevision(actor: Actor, templateId: string): Promise<BuilderTemplate | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const current = await client.query<Pick<Head,
        "title" | "revision_id" | "revision_number" | "description" | "category" |
        "estimated_duration_min" | "general_instruction"
      > & { template_status: "draft" | "published" | "archived"; editable_revision_id: string | null }>(
        `SELECT revision.title, revision.id AS revision_id, revision.revision_number,
                 revision.description, revision.category, revision.estimated_duration_min,
                 revision.general_instruction, template.status::text AS template_status,
                 template.editable_revision_id
          FROM app.workout_templates template
          JOIN app.workout_template_revisions revision
            ON revision.id = template.published_revision_id
          WHERE template.id = $1 AND template.trainer_user_id = $2
            AND revision.status = 'published'
          FOR UPDATE OF template`, [templateId, actor.userId]);
      if (!current.rowCount) {
        const lifecycle = await client.query<{
          status: "draft" | "published" | "archived";
          published_revision_id: string | null;
          editable_revision_id: string | null;
        }>(`SELECT status::text, published_revision_id, editable_revision_id
            FROM app.workout_templates
            WHERE id = $1 AND trainer_user_id = $2
            FOR UPDATE`, [templateId, actor.userId]);
        if (!lifecycle.rowCount) return null;
        if (lifecycle.rows[0].status === "archived") throw new WorkoutBuilderCommandError("template_archived");
        if (!lifecycle.rows[0].published_revision_id) {
          throw new WorkoutBuilderCommandError("published_revision_not_found");
        }
        throw new WorkoutBuilderCommandError("template_lifecycle_conflict");
      }
      if (current.rows[0].template_status === "archived") {
        throw new WorkoutBuilderCommandError("template_archived");
      }
      if (current.rows[0].editable_revision_id) {
        return this.find(client, actor.userId, templateId);
      }
      const source = current.rows[0];
      const revision = await client.query<{ id: string }>(`INSERT INTO app.workout_template_revisions
        (template_id, revision_number, title, description, category, estimated_duration_min,
         general_instruction, status, published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',NULL) RETURNING id`,
        [templateId, source.revision_number + 1, source.title, source.description, source.category,
          source.estimated_duration_min, source.general_instruction]);
      await client.query(`UPDATE app.workout_templates
        SET editable_revision_id = $2, current_revision = $3
        WHERE id = $1`, [templateId, revision.rows[0].id, source.revision_number + 1]);
      await client.query(`INSERT INTO app.workout_template_exercises
        (revision_id, instance_key, position, source_exercise_key, title, category, equipment,
         description, image_url, prescription_type, repetition_mode, sets, repetitions,
         repetitions_min, repetitions_max, duration_seconds, target_weight_kg, rest_seconds,
         per_set_mode, trainer_note, superset_key, superset_position, superset_label, superset_instruction)
        SELECT $1, instance_key, position, source_exercise_key, title, category, equipment,
         description, image_url, prescription_type, repetition_mode, sets, repetitions,
         repetitions_min, repetitions_max, duration_seconds, target_weight_kg, rest_seconds,
         per_set_mode, trainer_note, superset_key, superset_position, superset_label, superset_instruction
        FROM app.workout_template_exercises WHERE revision_id = $2 ORDER BY position`,
        [revision.rows[0].id, source.revision_id]);
      await client.query(`INSERT INTO app.workout_template_exercise_sets
        (exercise_id, set_key, position, kind, repetitions_min, repetitions_max,
         duration_seconds, target_weight_kg, rest_seconds, uses_override)
        SELECT target.id, source_set.set_key, source_set.position, source_set.kind,
         source_set.repetitions_min, source_set.repetitions_max, source_set.duration_seconds,
         source_set.target_weight_kg, source_set.rest_seconds, source_set.uses_override
        FROM app.workout_template_exercise_sets source_set
        JOIN app.workout_template_exercises source ON source.id = source_set.exercise_id
        JOIN app.workout_template_exercises target
          ON target.revision_id = $1 AND target.instance_key = source.instance_key
        WHERE source.revision_id = $2`, [revision.rows[0].id, source.revision_id]);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1, $1, 'workout.template.revision_created',
          jsonb_build_object('template_id', $2::text, 'revision', $3::integer))`,
        [actor.userId, templateId, source.revision_number + 1]);
      return this.find(client, actor.userId, templateId);
    });
  }

  archive(actor: Actor, templateId: string): Promise<BuilderTemplate | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const result = await client.query(`UPDATE app.workout_templates SET status = 'archived'
        WHERE id = $1 AND trainer_user_id = $2 AND status <> 'archived' RETURNING id`, [templateId, actor.userId]);
      return result.rowCount ? this.find(client, actor.userId, templateId) : null;
    });
  }

  private async find(client: PoolClient, trainerId: string, templateId: string) {
    const result = await client.query<Head>(`${headSelect}
      WHERE template.id = $1 AND template.trainer_user_id = $2`, [templateId, trainerId]);
    return result.rowCount ? this.hydrate(client, result.rows[0]) : null;
  }

  private async hydrate(client: PoolClient, head: Head): Promise<BuilderTemplate> {
    const exercises = await client.query<ExerciseRow>(`SELECT * FROM app.workout_template_exercises
      WHERE revision_id = $1 ORDER BY position`, [head.revision_id]);
    const ids = exercises.rows.map((row) => row.id);
    const rows: SetRow[] = ids.length ? (await client.query<SetRow>(`SELECT * FROM app.workout_template_exercise_sets
      WHERE exercise_id = ANY($1::uuid[]) ORDER BY exercise_id, position`, [ids])).rows : [];
    const sets = new Map<string, BuilderSet[]>();
    for (const row of rows) sets.set(row.exercise_id, [...(sets.get(row.exercise_id) ?? []), mapSet(row)]);
    return {
      id: head.id, revisionId: head.revision_id, title: head.title, status: head.status, revision: head.revision_number,
      description: head.description, category: head.category,
      estimatedDurationMin: head.estimated_duration_min === null ? "" : String(head.estimated_duration_min),
      generalInstruction: head.general_instruction, items: mapItems(exercises.rows, sets),
      updatedLabel: updatedLabel(head.updated_at), usageCount: Number(head.usage_count),
      latestPublishedRevision: head.published_revision_id && head.published_revision_number
        ? { revisionId: head.published_revision_id, revision: head.published_revision_number }
        : null,
      editableRevision: head.editable_revision_id && head.editable_revision_number
        ? { revisionId: head.editable_revision_id, revision: head.editable_revision_number }
        : null,
    };
  }

  private async insertItems(client: PoolClient, revisionId: string, items: BuilderItem[]) {
    let position = 0;
    for (const item of items) {
      const exercises = item.kind === "exercise" ? [item.exercise] : item.exercises;
      for (const [index, exercise] of exercises.entries()) {
        position += 1;
        const row = await client.query<{ id: string }>(`INSERT INTO app.workout_template_exercises
          (revision_id, instance_key, position, source_exercise_key, title, category, equipment,
           description, image_url, prescription_type, repetition_mode, sets, repetitions,
           repetitions_min, repetitions_max, duration_seconds, target_weight_kg, rest_seconds,
           per_set_mode, trainer_note, superset_key, superset_position, superset_label, superset_instruction)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
          RETURNING id`, [
          revisionId, exercise.instanceId, position, exercise.exerciseId, exercise.title, exercise.category,
          exercise.equipment ?? null, exercise.description ?? null, exercise.imageUrl ?? null,
          exercise.prescription.type, exercise.prescription.repetitionMode, Number(exercise.prescription.sets),
          Number(exercise.prescription.repetitionsMin || 1),
          exercise.prescription.type === "repetitions" ? Number(exercise.prescription.repetitionsMin) : null,
          exercise.prescription.type === "repetitions" ? Number(exercise.prescription.repetitionsMax) : null,
          exercise.prescription.type === "duration" ? Number(exercise.prescription.durationSec) : null,
          exercise.prescription.targetWeightKg || null, Number(exercise.prescription.restSec),
          exercise.perSetMode, exercise.trainerNote, item.kind === "superset" ? item.id : null,
          item.kind === "superset" ? index + 1 : null, item.kind === "superset" ? item.label : null,
          item.kind === "superset" ? item.instruction : null,
        ]);
        for (const set of exercise.setOverrides) {
          await client.query(`INSERT INTO app.workout_template_exercise_sets
            (exercise_id, set_key, position, kind, repetitions_min, repetitions_max,
             duration_seconds, target_weight_kg, rest_seconds, uses_override)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
            row.rows[0].id, set.id, set.order, set.kind,
            exercise.prescription.type === "repetitions" ? Number(set.repetitionsMin) : null,
            exercise.prescription.type === "repetitions" ? Number(set.repetitionsMax) : null,
            exercise.prescription.type === "duration" ? Number(set.durationSec) : null,
            set.targetWeightKg || null, Number(set.restSec), set.usesOverride,
          ]);
        }
      }
    }
  }
}
