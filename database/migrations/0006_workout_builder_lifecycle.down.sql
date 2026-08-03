DROP POLICY IF EXISTS workout_assignment_sets_insert_snapshot_owner ON app.workout_assignment_exercise_sets;
DROP POLICY IF EXISTS workout_assignment_sets_select_participant ON app.workout_assignment_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_update_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_select_owner ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_exercises_delete_owner_draft ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_exercises_update_owner_draft ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_revisions_update_owner_draft ON app.workout_template_revisions;
DROP POLICY IF EXISTS workout_templates_update_owner ON app.workout_templates;
DROP POLICY IF EXISTS workout_assignment_exercises_insert_snapshot_owner ON app.workout_assignment_exercises;

DROP TRIGGER IF EXISTS workout_template_revisions_enforce_update ON app.workout_template_revisions;
DROP TRIGGER IF EXISTS workout_templates_enforce_update ON app.workout_templates;
DROP FUNCTION IF EXISTS app.enforce_workout_revision_update();
DROP FUNCTION IF EXISTS app.enforce_workout_template_update();

REVOKE UPDATE, DELETE ON app.workout_template_exercises FROM ai_strength_app;

DELETE FROM app.workout_template_exercise_sets template_set
USING app.workout_template_exercises exercise, app.workout_template_revisions revision
WHERE template_set.exercise_id = exercise.id
  AND exercise.revision_id = revision.id
  AND revision.status = 'draft';
DELETE FROM app.workout_template_exercises exercise
USING app.workout_template_revisions revision
WHERE exercise.revision_id = revision.id AND revision.status = 'draft';
DELETE FROM app.workout_template_revisions WHERE status = 'draft';
UPDATE app.workout_templates template
SET current_revision = published.revision_number,
    status = 'published',
    archived_at = NULL
FROM (
  SELECT template_id, max(revision_number) AS revision_number
  FROM app.workout_template_revisions
  GROUP BY template_id
) published
WHERE template.id = published.template_id
  AND template.current_revision <> published.revision_number;
DELETE FROM app.workout_templates template
WHERE NOT EXISTS (
  SELECT 1 FROM app.workout_template_revisions revision WHERE revision.template_id = template.id
);

DROP TABLE IF EXISTS app.workout_assignment_exercise_sets;
DROP TABLE IF EXISTS app.workout_template_exercise_sets;

ALTER TABLE app.workout_assignment_exercises
  DROP CONSTRAINT IF EXISTS workout_assignment_exercise_superset_consistent,
  DROP CONSTRAINT IF EXISTS workout_assignment_exercise_repetition_range_v2,
  DROP CONSTRAINT IF EXISTS workout_assignment_exercise_equipment_length,
  DROP CONSTRAINT IF EXISTS workout_assignment_exercise_category_length,
  DROP CONSTRAINT IF EXISTS workout_assignment_exercise_source_key_length,
  DROP COLUMN IF EXISTS superset_instruction_snapshot,
  DROP COLUMN IF EXISTS superset_label_snapshot,
  DROP COLUMN IF EXISTS superset_position_snapshot,
  DROP COLUMN IF EXISTS superset_key_snapshot,
  DROP COLUMN IF EXISTS per_set_mode_snapshot,
  DROP COLUMN IF EXISTS duration_seconds_snapshot,
  DROP COLUMN IF EXISTS repetitions_max_snapshot,
  DROP COLUMN IF EXISTS repetitions_min_snapshot,
  DROP COLUMN IF EXISTS repetition_mode_snapshot,
  DROP COLUMN IF EXISTS prescription_type_snapshot,
  DROP COLUMN IF EXISTS equipment_snapshot,
  DROP COLUMN IF EXISTS category_snapshot,
  DROP COLUMN IF EXISTS source_exercise_key_snapshot;

ALTER TABLE app.workout_template_exercises
  DROP CONSTRAINT IF EXISTS workout_template_exercise_superset_consistent,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_repetition_range,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_image_url_length,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_description_length,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_equipment_length,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_category_length,
  DROP CONSTRAINT IF EXISTS workout_template_exercise_source_key_length,
  DROP COLUMN IF EXISTS superset_instruction,
  DROP COLUMN IF EXISTS superset_label,
  DROP COLUMN IF EXISTS superset_position,
  DROP COLUMN IF EXISTS superset_key,
  DROP COLUMN IF EXISTS per_set_mode,
  DROP COLUMN IF EXISTS duration_seconds,
  DROP COLUMN IF EXISTS repetitions_max,
  DROP COLUMN IF EXISTS repetitions_min,
  DROP COLUMN IF EXISTS repetition_mode,
  DROP COLUMN IF EXISTS prescription_type,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS equipment,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS source_exercise_key;

ALTER TABLE app.workout_template_revisions
  DROP CONSTRAINT IF EXISTS workout_template_revision_publish_consistent,
  DROP CONSTRAINT IF EXISTS workout_template_revision_category_length,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS status,
  ALTER COLUMN published_at SET NOT NULL;

ALTER TABLE app.workout_template_revisions
  DROP CONSTRAINT IF EXISTS workout_template_revision_title_length,
  ADD CONSTRAINT workout_template_revision_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120);

ALTER TABLE app.workout_templates
  DROP CONSTRAINT workout_template_title_length,
  ADD CONSTRAINT workout_template_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120);

DROP TYPE IF EXISTS app.workout_set_kind;
DROP TYPE IF EXISTS app.workout_repetition_mode;
DROP TYPE IF EXISTS app.workout_prescription_type;
DROP TYPE IF EXISTS app.workout_template_revision_status;

CREATE POLICY workout_assignment_exercises_insert_snapshot_owner ON app.workout_assignment_exercises
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_assignments assignment
      JOIN app.workout_template_exercises source
        ON source.id = app.workout_assignment_exercises.source_template_exercise_id
      WHERE assignment.id = app.workout_assignment_exercises.assignment_id
        AND assignment.trainer_user_id = app.current_actor_user_id()
        AND source.revision_id = assignment.source_revision_id
        AND source.instance_key = app.workout_assignment_exercises.instance_key
        AND source.position = app.workout_assignment_exercises.position
        AND source.title = app.workout_assignment_exercises.title_snapshot
        AND source.sets = app.workout_assignment_exercises.sets_snapshot
        AND source.repetitions = app.workout_assignment_exercises.repetitions_snapshot
        AND source.target_weight_kg IS NOT DISTINCT FROM app.workout_assignment_exercises.target_weight_kg_snapshot
        AND source.rest_seconds = app.workout_assignment_exercises.rest_seconds_snapshot
        AND source.trainer_note = app.workout_assignment_exercises.trainer_note_snapshot
    )
  );
