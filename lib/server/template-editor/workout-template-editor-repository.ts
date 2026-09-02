import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type { WorkoutTemplateEditorViewIntent } from "@/lib/workout-template-editor-contract";

export type EditorHeaderRow = {
  template_id: string;
  template_status: "draft" | "published" | "archived";
  current_revision: number;
  lifecycle_version: string;
  template_created_at: Date;
  template_updated_at: Date;
  archived_at: Date | null;
  editable_revision_id: string | null;
  editable_revision_number: number | null;
  editable_revision_status: "draft" | "published" | null;
  editable_title: string | null;
  editable_category: string | null;
  editable_created_at: Date | null;
  editable_updated_at: Date | null;
  editable_published_at: Date | null;
  published_revision_id: string | null;
  published_revision_number: number | null;
  published_revision_status: "draft" | "published" | null;
  published_title: string | null;
  published_category: string | null;
  published_created_at: Date | null;
  published_updated_at: Date | null;
  published_published_at: Date | null;
  selected_revision_id: string | null;
  selected_revision_role: "editable" | "published" | "archived_editable" | "archived_published" | null;
  selected_revision_number: number | null;
  selected_revision_status: "draft" | "published" | null;
  selected_title: string | null;
  selected_description: string | null;
  selected_category: string | null;
  selected_general_instruction: string | null;
  selected_estimated_duration_min: number | null;
  selected_created_at: Date | null;
  selected_updated_at: Date | null;
  selected_published_at: Date | null;
  selected_lock_version: string | null;
  publication_issues: Array<{ path?: unknown; code?: unknown }>;
  read_at: Date;
};

export type EditorExerciseRow = {
  template_exercise_id: string;
  instance_key: string;
  source_exercise_id: string | null;
  source_exercise_key: string;
  position: number;
  title: string;
  category: string;
  equipment: string | null;
  description: string | null;
  image_url: string | null;
  prescription_type: "repetitions" | "duration";
  repetition_mode: "fixed" | "range";
  sets: number | null;
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number | null;
  per_set_mode: boolean;
  trainer_note: string;
  superset_key: string | null;
  superset_position: number | null;
  superset_label: string | null;
  superset_instruction: string | null;
  source_visible_id: string | null;
  source_current_key: string | null;
  source_status: "active" | "archived" | null;
  source_image_path: string | null;
  source_image_available: boolean | null;
};

export type EditorSetRow = {
  template_set_id: string;
  exercise_id: string;
  set_key: string;
  position: number;
  kind: "warmup" | "working";
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number | null;
  uses_override: boolean;
};

export type WorkoutTemplateEditorBundle = {
  header: EditorHeaderRow;
  exercises: EditorExerciseRow[];
  sets: EditorSetRow[];
};

const headerSql = `WITH owned AS (
  SELECT template.id AS template_id, template.status::text AS template_status,
         template.current_revision, template.lifecycle_version::text,
         template.created_at AS template_created_at, template.updated_at AS template_updated_at,
         template.archived_at, template.editable_revision_id, template.published_revision_id,
         CASE
           WHEN $3 = 'editable' AND template.status <> 'archived' THEN template.editable_revision_id
           WHEN $3 = 'published' AND template.status <> 'archived' THEN template.published_revision_id
           WHEN $3 = 'archived' AND template.status = 'archived'
             THEN coalesce(template.editable_revision_id, template.published_revision_id)
           WHEN $3 = 'default' AND template.status = 'archived'
             THEN coalesce(template.editable_revision_id, template.published_revision_id)
           WHEN $3 = 'default' AND template.editable_revision_id IS NOT NULL
             THEN template.editable_revision_id
           WHEN $3 = 'default' THEN template.published_revision_id
           ELSE NULL
         END AS selected_revision_id,
         CASE
           WHEN ($3 = 'archived' OR $3 = 'default') AND template.status = 'archived'
             AND template.editable_revision_id IS NOT NULL THEN 'archived_editable'
           WHEN ($3 = 'archived' OR $3 = 'default') AND template.status = 'archived'
             AND template.published_revision_id IS NOT NULL THEN 'archived_published'
           WHEN ($3 = 'editable' OR ($3 = 'default' AND template.editable_revision_id IS NOT NULL))
             AND template.status <> 'archived' THEN 'editable'
           WHEN ($3 = 'published' OR $3 = 'default') AND template.status <> 'archived'
             AND template.published_revision_id IS NOT NULL THEN 'published'
           ELSE NULL
         END AS selected_revision_role
  FROM app.workout_templates template
  WHERE template.id = $1 AND template.trainer_user_id = $2
    AND EXISTS (
      SELECT 1 FROM app.trainer_profiles trainer
      WHERE trainer.user_id = $2 AND trainer.status = 'active'
    )
)
SELECT owned.*,
  editable.revision_number AS editable_revision_number,
  editable.status::text AS editable_revision_status,
  editable.title AS editable_title, editable.category AS editable_category,
  editable.created_at AS editable_created_at, editable.updated_at AS editable_updated_at,
  editable.published_at AS editable_published_at,
  published.revision_number AS published_revision_number,
  published.status::text AS published_revision_status,
  published.title AS published_title, published.category AS published_category,
  published.created_at AS published_created_at, published.updated_at AS published_updated_at,
  published.published_at AS published_published_at,
  selected.revision_number AS selected_revision_number,
  selected.status::text AS selected_revision_status,
  selected.title AS selected_title, selected.description AS selected_description,
  selected.category AS selected_category, selected.general_instruction AS selected_general_instruction,
  selected.estimated_duration_min AS selected_estimated_duration_min,
  selected.created_at AS selected_created_at, selected.updated_at AS selected_updated_at,
  selected.published_at AS selected_published_at, selected.lock_version::text AS selected_lock_version,
  CASE WHEN selected.id IS NULL THEN '[]'::jsonb
       ELSE app.workout_template_publication_issues(selected.id) END AS publication_issues,
  transaction_timestamp() AS read_at
FROM owned
LEFT JOIN app.workout_template_revisions editable ON editable.id = owned.editable_revision_id
LEFT JOIN app.workout_template_revisions published ON published.id = owned.published_revision_id
LEFT JOIN app.workout_template_revisions selected ON selected.id = owned.selected_revision_id`;

const exercisesSql = `SELECT exercise.id AS template_exercise_id, exercise.instance_key,
  exercise.source_exercise_id, exercise.source_exercise_key, exercise.position,
  exercise.title, exercise.category, exercise.equipment, exercise.description, exercise.image_url,
  exercise.prescription_type::text, exercise.repetition_mode::text, exercise.sets,
  exercise.repetitions_min, exercise.repetitions_max, exercise.duration_seconds,
  exercise.target_weight_kg::text, exercise.rest_seconds, exercise.per_set_mode,
  exercise.trainer_note, exercise.superset_key, exercise.superset_position,
  exercise.superset_label, exercise.superset_instruction,
  source.id AS source_visible_id, source.stable_key AS source_current_key,
  source.status::text AS source_status, source.image_asset_path AS source_image_path,
  source.image_asset_available AS source_image_available
FROM app.workout_template_exercises exercise
LEFT JOIN app.exercises source ON source.id = exercise.source_exercise_id
WHERE exercise.revision_id = $1
ORDER BY exercise.position, exercise.id`;

const setsSql = `SELECT template_set.id AS template_set_id, template_set.exercise_id,
  template_set.set_key, template_set.position, template_set.kind::text,
  template_set.repetitions_min, template_set.repetitions_max,
  template_set.duration_seconds, template_set.target_weight_kg::text,
  template_set.rest_seconds, template_set.uses_override
FROM app.workout_template_exercise_sets template_set
JOIN app.workout_template_exercises exercise ON exercise.id = template_set.exercise_id
WHERE exercise.revision_id = $1
ORDER BY exercise.position, template_set.position, template_set.id`;

export class WorkoutTemplateEditorRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async read(actor: Actor, templateId: string, view: WorkoutTemplateEditorViewIntent): Promise<WorkoutTemplateEditorBundle | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      const header = await client.query<EditorHeaderRow>(headerSql, [templateId, actor.userId, view]);
      if (!header.rowCount) return null;
      const selectedRevisionId = header.rows[0].selected_revision_id;
      const exercises = selectedRevisionId
        ? await client.query<EditorExerciseRow>(exercisesSql, [selectedRevisionId])
        : { rows: [] as EditorExerciseRow[] };
      const sets = selectedRevisionId
        ? await client.query<EditorSetRow>(setsSql, [selectedRevisionId])
        : { rows: [] as EditorSetRow[] };
      return { header: header.rows[0], exercises: exercises.rows, sets: sets.rows };
    });
  }

  async canBootstrap(actor: Actor) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      const result = await client.query(`SELECT EXISTS (
        SELECT 1 FROM app.trainer_profiles trainer
        WHERE trainer.user_id = $1 AND trainer.status = 'active'
      ) AS allowed`, [actor.userId]);
      return result.rows[0]?.allowed === true;
    });
  }

  async explainExact(actor: Actor, templateId: string, view: WorkoutTemplateEditorViewIntent, revisionId: string) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      const header = await client.query(`EXPLAIN (FORMAT TEXT) ${headerSql}`, [templateId, actor.userId, view]);
      const exercises = await client.query(`EXPLAIN (FORMAT TEXT) ${exercisesSql}`, [revisionId]);
      const sets = await client.query(`EXPLAIN (FORMAT TEXT) ${setsSql}`, [revisionId]);
      return { header: header.rows, exercises: exercises.rows, sets: sets.rows };
    });
  }
}
