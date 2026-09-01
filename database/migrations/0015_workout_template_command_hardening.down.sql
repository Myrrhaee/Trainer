DO $preflight$
DECLARE
  partial record;
BEGIN
  SELECT revision.id AS revision_id, exercise.instance_key, template_set.set_key, reason
  INTO partial
  FROM app.workout_template_revisions revision
  JOIN app.workout_template_exercises exercise ON exercise.revision_id = revision.id
  LEFT JOIN app.workout_template_exercise_sets template_set ON template_set.exercise_id = exercise.id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN exercise.sets IS NULL THEN 'exercise_sets_null'
      WHEN exercise.repetitions IS NULL THEN 'exercise_repetitions_null'
      WHEN exercise.rest_seconds IS NULL THEN 'exercise_rest_null'
      WHEN exercise.prescription_type = 'repetitions'
        AND (exercise.repetitions_min IS NULL OR exercise.repetitions_max IS NULL)
        THEN 'exercise_repetition_range_partial'
      WHEN exercise.prescription_type = 'duration' AND exercise.duration_seconds IS NULL
        THEN 'exercise_duration_null'
      WHEN template_set.id IS NOT NULL AND template_set.rest_seconds IS NULL THEN 'set_rest_null'
    END AS reason
  ) state
  WHERE state.reason IS NOT NULL
  ORDER BY revision.id, exercise.position, template_set.position
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'r2d3_lossy_down_migration_blocked: revision=%, exercise=%, set=%, reason=%',
      partial.revision_id, partial.instance_key, partial.set_key, partial.reason
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.workout_assignment_exercises
    WHERE repetitions_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION 'r2d3_lossy_down_migration_blocked: duration assignment uses nullable legacy repetitions snapshot'
      USING ERRCODE = 'check_violation';
  END IF;
END
$preflight$;

DROP TRIGGER IF EXISTS workout_template_revisions_publication_constraint
  ON app.workout_template_revisions;
DROP FUNCTION IF EXISTS app.enforce_workout_template_publication();
DROP FUNCTION IF EXISTS app.workout_template_publication_issues(uuid);

DROP POLICY IF EXISTS workout_template_command_receipts_insert_active_owner
  ON app.workout_template_command_receipts;
DROP POLICY IF EXISTS workout_template_command_receipts_select_owner
  ON app.workout_template_command_receipts;
DROP TABLE app.workout_template_command_receipts;

ALTER TABLE app.workout_assignment_exercises
  DROP CONSTRAINT workout_assignment_exercise_repetitions_range,
  ALTER COLUMN repetitions_snapshot SET NOT NULL,
  ADD CONSTRAINT workout_assignment_exercise_repetitions_range CHECK (
    repetitions_snapshot BETWEEN 1 AND 500
  );

ALTER POLICY workout_assignment_exercises_insert_snapshot_owner
  ON app.workout_assignment_exercises
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
        AND source.source_exercise_key = app.workout_assignment_exercises.source_exercise_key_snapshot
        AND source.category = app.workout_assignment_exercises.category_snapshot
        AND source.equipment IS NOT DISTINCT FROM app.workout_assignment_exercises.equipment_snapshot
        AND source.prescription_type = app.workout_assignment_exercises.prescription_type_snapshot
        AND source.repetition_mode = app.workout_assignment_exercises.repetition_mode_snapshot
        AND source.repetitions_min IS NOT DISTINCT FROM app.workout_assignment_exercises.repetitions_min_snapshot
        AND source.repetitions_max IS NOT DISTINCT FROM app.workout_assignment_exercises.repetitions_max_snapshot
        AND source.duration_seconds IS NOT DISTINCT FROM app.workout_assignment_exercises.duration_seconds_snapshot
        AND source.per_set_mode = app.workout_assignment_exercises.per_set_mode_snapshot
        AND source.superset_key IS NOT DISTINCT FROM app.workout_assignment_exercises.superset_key_snapshot
        AND source.superset_position IS NOT DISTINCT FROM app.workout_assignment_exercises.superset_position_snapshot
        AND source.superset_label IS NOT DISTINCT FROM app.workout_assignment_exercises.superset_label_snapshot
        AND source.superset_instruction IS NOT DISTINCT FROM app.workout_assignment_exercises.superset_instruction_snapshot
    )
  );

ALTER TABLE app.workout_template_exercise_sets
  DROP CONSTRAINT workout_template_set_rest_range,
  ALTER COLUMN rest_seconds SET NOT NULL,
  ADD CONSTRAINT workout_template_set_rest_range CHECK (rest_seconds BETWEEN 0 AND 3600);

ALTER TABLE app.workout_template_exercises
  DROP CONSTRAINT workout_template_exercise_sets_range,
  DROP CONSTRAINT workout_template_exercise_repetitions_range,
  DROP CONSTRAINT workout_template_exercise_rest_range,
  DROP CONSTRAINT workout_template_exercise_repetition_range,
  ALTER COLUMN sets SET NOT NULL,
  ALTER COLUMN repetitions SET NOT NULL,
  ALTER COLUMN rest_seconds SET NOT NULL,
  ADD CONSTRAINT workout_template_exercise_sets_range CHECK (sets BETWEEN 1 AND 20),
  ADD CONSTRAINT workout_template_exercise_repetitions_range CHECK (repetitions BETWEEN 1 AND 500),
  ADD CONSTRAINT workout_template_exercise_rest_range CHECK (rest_seconds BETWEEN 0 AND 3600),
  ADD CONSTRAINT workout_template_exercise_repetition_range CHECK (
    (prescription_type = 'duration' AND duration_seconds BETWEEN 1 AND 86400)
    OR (
      prescription_type = 'repetitions'
      AND repetitions_min BETWEEN 1 AND 500
      AND repetitions_max BETWEEN repetitions_min AND 500
    )
  );

ALTER TABLE app.workout_template_revisions
  DROP CONSTRAINT workout_template_revision_lock_version_positive,
  DROP COLUMN lock_version;

ALTER TABLE app.workout_templates
  DROP CONSTRAINT workout_template_lifecycle_version_positive,
  DROP COLUMN lifecycle_version;

CREATE OR REPLACE FUNCTION app.enforce_workout_template_exercise_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $function$
DECLARE
  source_allowed boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.revision_id IS NOT DISTINCT FROM OLD.revision_id
    AND NEW.source_exercise_id IS NOT DISTINCT FROM OLD.source_exercise_id
    AND NEW.source_exercise_key IS NOT DISTINCT FROM OLD.source_exercise_key
  THEN
    RETURN NEW;
  END IF;

  IF NEW.source_exercise_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM app.exercises source
    JOIN app.workout_template_revisions revision ON revision.id = NEW.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE source.id = NEW.source_exercise_id
      AND source.stable_key = NEW.source_exercise_key
      AND source.status = 'active'
      AND (
        source.scope = 'system'
        OR (source.scope = 'trainer' AND source.owner_trainer_user_id = template.trainer_user_id)
      )
  ) INTO source_allowed;

  IF NOT source_allowed THEN
    RAISE EXCEPTION 'workout template exercise source is not selectable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;
