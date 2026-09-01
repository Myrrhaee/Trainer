LOCK TABLE app.workout_templates, app.workout_template_revisions,
  app.workout_template_exercises, app.workout_template_exercise_sets,
  app.workout_assignment_exercises IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE app.workout_template_revisions
  ADD COLUMN lock_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT workout_template_revision_lock_version_positive CHECK (lock_version > 0);

ALTER TABLE app.workout_templates
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT workout_template_lifecycle_version_positive CHECK (lifecycle_version > 0);

ALTER TABLE app.workout_template_exercises
  DROP CONSTRAINT workout_template_exercise_sets_range,
  DROP CONSTRAINT workout_template_exercise_repetitions_range,
  DROP CONSTRAINT workout_template_exercise_rest_range,
  DROP CONSTRAINT workout_template_exercise_repetition_range,
  ALTER COLUMN sets DROP NOT NULL,
  ALTER COLUMN repetitions DROP NOT NULL,
  ALTER COLUMN rest_seconds DROP NOT NULL,
  ADD CONSTRAINT workout_template_exercise_sets_range CHECK (sets IS NULL OR sets BETWEEN 1 AND 20),
  ADD CONSTRAINT workout_template_exercise_repetitions_range CHECK (
    repetitions IS NULL OR repetitions BETWEEN 1 AND 500
  ),
  ADD CONSTRAINT workout_template_exercise_rest_range CHECK (
    rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600
  ),
  ADD CONSTRAINT workout_template_exercise_repetition_range CHECK (
    (repetitions_min IS NULL OR repetitions_min BETWEEN 1 AND 500)
    AND (repetitions_max IS NULL OR repetitions_max BETWEEN 1 AND 500)
    AND (repetitions_min IS NULL OR repetitions_max IS NULL OR repetitions_max >= repetitions_min)
    AND (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400)
  );

ALTER TABLE app.workout_template_exercise_sets
  DROP CONSTRAINT workout_template_set_rest_range,
  ALTER COLUMN rest_seconds DROP NOT NULL,
  ADD CONSTRAINT workout_template_set_rest_range CHECK (
    rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600
  );

ALTER TABLE app.workout_assignment_exercises
  DROP CONSTRAINT workout_assignment_exercise_repetitions_range,
  ALTER COLUMN repetitions_snapshot DROP NOT NULL,
  ADD CONSTRAINT workout_assignment_exercise_repetitions_range CHECK (
    repetitions_snapshot IS NULL OR repetitions_snapshot BETWEEN 1 AND 500
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
        AND source.repetitions IS NOT DISTINCT FROM app.workout_assignment_exercises.repetitions_snapshot
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

CREATE TABLE app.workout_template_command_receipts (
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  command_id uuid NOT NULL,
  operation text NOT NULL,
  request_fingerprint text NOT NULL,
  result_template_id uuid NOT NULL REFERENCES app.workout_templates(id) ON DELETE RESTRICT,
  result_revision_id uuid REFERENCES app.workout_template_revisions(id) ON DELETE RESTRICT,
  result_lifecycle text NOT NULL,
  result_version bigint NOT NULL,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (trainer_user_id, command_id),
  CONSTRAINT workout_template_command_operation CHECK (operation IN (
    'create_draft', 'save_draft', 'create_revision', 'publish_revision',
    'duplicate_template', 'archive_template'
  )),
  CONSTRAINT workout_template_command_fingerprint CHECK (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT workout_template_command_result_version CHECK (result_version > 0),
  CONSTRAINT workout_template_command_payload_object CHECK (jsonb_typeof(result_payload) = 'object')
);

ALTER TABLE app.workout_template_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY workout_template_command_receipts_select_owner
  ON app.workout_template_command_receipts
  FOR SELECT TO ai_strength_app
  USING (trainer_user_id = app.current_actor_user_id());

CREATE POLICY workout_template_command_receipts_insert_active_owner
  ON app.workout_template_command_receipts
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    trainer_user_id = app.current_actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app.trainer_profiles trainer
      WHERE trainer.user_id = app.current_actor_user_id()
        AND trainer.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION app.workout_template_publication_issues(target_revision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, app
AS $function$
DECLARE
  revision_row app.workout_template_revisions%ROWTYPE;
  exercise_row record;
  set_row record;
  superset_row record;
  issues jsonb := '[]'::jsonb;
  exercise_count integer;
  set_count integer;
BEGIN
  SELECT * INTO revision_row
  FROM app.workout_template_revisions
  WHERE id = target_revision_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'path', 'template.revision', 'code', 'editable_draft_not_found'
    ));
  END IF;

  IF char_length(btrim(revision_row.title)) = 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'path', 'template.title', 'code', 'required'
    ));
  END IF;

  SELECT count(*)::integer INTO exercise_count
  FROM app.workout_template_exercises
  WHERE revision_id = target_revision_id;

  IF exercise_count = 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'path', 'template.exercises', 'code', 'required'
    ));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app.workout_template_exercises exercise
    WHERE exercise.revision_id = target_revision_id
    GROUP BY exercise.revision_id
    HAVING min(exercise.position) <> 1
      OR max(exercise.position) <> count(*)
  ) THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'path', 'template.exercises', 'code', 'invalid_order'
    ));
  END IF;

  FOR exercise_row IN
    SELECT exercise.*
    FROM app.workout_template_exercises exercise
    WHERE exercise.revision_id = target_revision_id
    ORDER BY exercise.position
  LOOP
    IF char_length(btrim(exercise_row.title)) = 0
      OR char_length(btrim(exercise_row.source_exercise_key)) = 0
    THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.source', exercise_row.instance_key),
        'code', 'incomplete_snapshot'
      ));
    END IF;

    IF exercise_row.sets IS NULL THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.prescription.sets', exercise_row.instance_key),
        'code', 'required'
      ));
    END IF;

    IF exercise_row.rest_seconds IS NULL THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.prescription.restSec', exercise_row.instance_key),
        'code', 'required'
      ));
    END IF;

    IF exercise_row.prescription_type = 'repetitions' THEN
      IF exercise_row.repetitions_min IS NULL OR exercise_row.repetitions_max IS NULL THEN
        issues := issues || jsonb_build_array(jsonb_build_object(
          'path', format('exercises.%s.prescription.repetitions', exercise_row.instance_key),
          'code', 'required'
        ));
      END IF;
    ELSIF exercise_row.duration_seconds IS NULL THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.prescription.durationSec', exercise_row.instance_key),
        'code', 'required'
      ));
    END IF;

    SELECT count(*)::integer INTO set_count
    FROM app.workout_template_exercise_sets template_set
    WHERE template_set.exercise_id = exercise_row.id;

    IF (exercise_row.per_set_mode AND (exercise_row.sets IS NULL OR set_count <> exercise_row.sets))
      OR (NOT exercise_row.per_set_mode AND set_count > 0)
    THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.sets', exercise_row.instance_key),
        'code', 'set_count_mismatch'
      ));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM app.workout_template_exercise_sets template_set
      WHERE template_set.exercise_id = exercise_row.id
      GROUP BY template_set.exercise_id
      HAVING min(template_set.position) <> 1
        OR max(template_set.position) <> count(*)
    ) THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('exercises.%s.sets', exercise_row.instance_key),
        'code', 'invalid_order'
      ));
    END IF;

    FOR set_row IN
      SELECT template_set.*
      FROM app.workout_template_exercise_sets template_set
      WHERE template_set.exercise_id = exercise_row.id
      ORDER BY template_set.position
    LOOP
      IF set_row.rest_seconds IS NULL THEN
        issues := issues || jsonb_build_array(jsonb_build_object(
          'path', format('exercises.%s.sets.%s.restSec', exercise_row.instance_key, set_row.set_key),
          'code', 'required'
        ));
      END IF;
      IF exercise_row.prescription_type = 'repetitions'
        AND (set_row.repetitions_min IS NULL OR set_row.repetitions_max IS NULL)
      THEN
        issues := issues || jsonb_build_array(jsonb_build_object(
          'path', format('exercises.%s.sets.%s.repetitions', exercise_row.instance_key, set_row.set_key),
          'code', 'required'
        ));
      ELSIF exercise_row.prescription_type = 'duration' AND set_row.duration_seconds IS NULL THEN
        issues := issues || jsonb_build_array(jsonb_build_object(
          'path', format('exercises.%s.sets.%s.durationSec', exercise_row.instance_key, set_row.set_key),
          'code', 'required'
        ));
      END IF;
    END LOOP;
  END LOOP;

  FOR superset_row IN
    SELECT superset_key, count(*)::integer AS member_count,
      count(DISTINCT instance_key)::integer AS distinct_members,
      count(DISTINCT superset_position)::integer AS distinct_positions,
      min(superset_position) AS first_position,
      max(superset_position) AS last_position,
      count(DISTINCT superset_label)::integer AS label_count,
      count(DISTINCT superset_instruction)::integer AS instruction_count
    FROM app.workout_template_exercises
    WHERE revision_id = target_revision_id AND superset_key IS NOT NULL
    GROUP BY superset_key
  LOOP
    IF superset_row.member_count NOT BETWEEN 2 AND 4
      OR superset_row.distinct_members <> superset_row.member_count
      OR superset_row.distinct_positions <> superset_row.member_count
      OR superset_row.first_position <> 1
      OR superset_row.last_position <> superset_row.member_count
      OR superset_row.label_count <> 1
      OR superset_row.instruction_count <> 1
    THEN
      issues := issues || jsonb_build_array(jsonb_build_object(
        'path', format('supersets.%s.members', superset_row.superset_key),
        'code', 'invalid_superset'
      ));
    END IF;
  END LOOP;

  RETURN issues;
END
$function$;

CREATE FUNCTION app.enforce_workout_template_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $function$
DECLARE
  issues jsonb;
BEGIN
  IF NEW.status = 'published' AND OLD.status = 'draft' THEN
    issues := app.workout_template_publication_issues(NEW.id);
    IF jsonb_array_length(issues) > 0 THEN
      RAISE EXCEPTION 'workout_template_publication_invalid:%', issues::text
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE CONSTRAINT TRIGGER workout_template_revisions_publication_constraint
  AFTER UPDATE OF status ON app.workout_template_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status = 'published' AND OLD.status = 'draft')
  EXECUTE FUNCTION app.enforce_workout_template_publication();

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
      AND source.status IN ('active', 'archived')
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

GRANT SELECT, INSERT ON app.workout_template_command_receipts TO ai_strength_app;
GRANT SELECT, INSERT ON app.workout_template_command_receipts TO ai_strength_authenticator;
GRANT SELECT ON app.workout_template_command_receipts TO ai_strength_worker;
GRANT UPDATE (lifecycle_version) ON app.workout_templates TO ai_strength_app;
GRANT UPDATE (lock_version) ON app.workout_template_revisions TO ai_strength_app;

REVOKE ALL ON FUNCTION app.workout_template_publication_issues(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_workout_template_publication() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.workout_template_publication_issues(uuid) TO ai_strength_app;

COMMENT ON COLUMN app.workout_template_revisions.lock_version IS
  'Monotonic server-owned version used to reject stale editable Draft commands';
COMMENT ON COLUMN app.workout_templates.lifecycle_version IS
  'Monotonic server-owned version for Template lifecycle commands';
COMMENT ON TABLE app.workout_template_command_receipts IS
  'Actor-scoped durable idempotency receipts for WorkoutTemplate commands';
