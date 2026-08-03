CREATE TYPE app.workout_template_revision_status AS ENUM ('draft', 'published');
CREATE TYPE app.workout_prescription_type AS ENUM ('repetitions', 'duration');
CREATE TYPE app.workout_repetition_mode AS ENUM ('fixed', 'range');
CREATE TYPE app.workout_set_kind AS ENUM ('warmup', 'working');

ALTER TABLE app.workout_templates
  DROP CONSTRAINT workout_template_title_length,
  ADD CONSTRAINT workout_template_title_length CHECK (
    char_length(btrim(title)) <= 120
    AND (status = 'draft' OR char_length(btrim(title)) >= 1)
  );

ALTER TABLE app.workout_template_revisions
  ADD COLUMN status app.workout_template_revision_status NOT NULL DEFAULT 'published',
  ADD COLUMN category text NOT NULL DEFAULT '',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ALTER COLUMN published_at DROP NOT NULL,
  DROP CONSTRAINT workout_template_revision_title_length,
  ADD CONSTRAINT workout_template_revision_title_length CHECK (
    char_length(btrim(title)) <= 120
    AND (status = 'draft' OR char_length(btrim(title)) >= 1)
  ),
  ADD CONSTRAINT workout_template_revision_category_length CHECK (char_length(category) <= 120),
  ADD CONSTRAINT workout_template_revision_publish_consistent CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status = 'draft' AND published_at IS NULL)
  );

ALTER TABLE app.workout_template_exercises
  ADD COLUMN source_exercise_key text,
  ADD COLUMN category text NOT NULL DEFAULT '',
  ADD COLUMN equipment text,
  ADD COLUMN description text,
  ADD COLUMN image_url text,
  ADD COLUMN prescription_type app.workout_prescription_type NOT NULL DEFAULT 'repetitions',
  ADD COLUMN repetition_mode app.workout_repetition_mode NOT NULL DEFAULT 'fixed',
  ADD COLUMN repetitions_min integer,
  ADD COLUMN repetitions_max integer,
  ADD COLUMN duration_seconds integer,
  ADD COLUMN per_set_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN superset_key text,
  ADD COLUMN superset_position integer,
  ADD COLUMN superset_label text,
  ADD COLUMN superset_instruction text;

UPDATE app.workout_template_exercises
SET source_exercise_key = instance_key,
    repetitions_min = repetitions,
    repetitions_max = repetitions;

ALTER TABLE app.workout_template_exercises
  ALTER COLUMN source_exercise_key SET NOT NULL,
  ADD CONSTRAINT workout_template_exercise_source_key_length CHECK (char_length(btrim(source_exercise_key)) BETWEEN 1 AND 160),
  ADD CONSTRAINT workout_template_exercise_category_length CHECK (char_length(category) <= 120),
  ADD CONSTRAINT workout_template_exercise_equipment_length CHECK (equipment IS NULL OR char_length(equipment) <= 160),
  ADD CONSTRAINT workout_template_exercise_description_length CHECK (description IS NULL OR char_length(description) <= 4000),
  ADD CONSTRAINT workout_template_exercise_image_url_length CHECK (image_url IS NULL OR char_length(image_url) <= 2000),
  ADD CONSTRAINT workout_template_exercise_repetition_range CHECK (
    (prescription_type = 'duration' AND duration_seconds BETWEEN 1 AND 86400)
    OR (
      prescription_type = 'repetitions'
      AND repetitions_min BETWEEN 1 AND 500
      AND repetitions_max BETWEEN repetitions_min AND 500
    )
  ),
  ADD CONSTRAINT workout_template_exercise_superset_consistent CHECK (
    (superset_key IS NULL AND superset_position IS NULL AND superset_label IS NULL AND superset_instruction IS NULL)
    OR (
      char_length(btrim(superset_key)) BETWEEN 1 AND 120
      AND superset_position BETWEEN 1 AND 4
      AND superset_label IS NOT NULL
      AND char_length(superset_label) <= 160
      AND superset_instruction IS NOT NULL
      AND char_length(superset_instruction) <= 2000
    )
  );

CREATE TABLE app.workout_template_exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES app.workout_template_exercises(id) ON DELETE RESTRICT,
  set_key text NOT NULL,
  position integer NOT NULL,
  kind app.workout_set_kind NOT NULL DEFAULT 'working',
  repetitions_min integer,
  repetitions_max integer,
  duration_seconds integer,
  target_weight_kg numeric(7,2),
  rest_seconds integer NOT NULL,
  uses_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_template_set_key_length CHECK (char_length(btrim(set_key)) BETWEEN 1 AND 160),
  CONSTRAINT workout_template_set_position_positive CHECK (position > 0),
  CONSTRAINT workout_template_set_repetitions_range CHECK (
    (repetitions_min IS NULL AND repetitions_max IS NULL)
    OR (repetitions_min BETWEEN 1 AND 500 AND repetitions_max BETWEEN repetitions_min AND 500)
  ),
  CONSTRAINT workout_template_set_duration_range CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400),
  CONSTRAINT workout_template_set_weight_range CHECK (target_weight_kg IS NULL OR target_weight_kg BETWEEN 0 AND 2000),
  CONSTRAINT workout_template_set_rest_range CHECK (rest_seconds BETWEEN 0 AND 3600),
  UNIQUE (exercise_id, set_key),
  UNIQUE (exercise_id, position)
);

ALTER TABLE app.workout_assignment_exercises
  ADD COLUMN source_exercise_key_snapshot text,
  ADD COLUMN category_snapshot text NOT NULL DEFAULT '',
  ADD COLUMN equipment_snapshot text,
  ADD COLUMN prescription_type_snapshot app.workout_prescription_type NOT NULL DEFAULT 'repetitions',
  ADD COLUMN repetition_mode_snapshot app.workout_repetition_mode NOT NULL DEFAULT 'fixed',
  ADD COLUMN repetitions_min_snapshot integer,
  ADD COLUMN repetitions_max_snapshot integer,
  ADD COLUMN duration_seconds_snapshot integer,
  ADD COLUMN per_set_mode_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN superset_key_snapshot text,
  ADD COLUMN superset_position_snapshot integer,
  ADD COLUMN superset_label_snapshot text,
  ADD COLUMN superset_instruction_snapshot text;

UPDATE app.workout_assignment_exercises assignment_exercise
SET source_exercise_key_snapshot = source.source_exercise_key,
    category_snapshot = source.category,
    equipment_snapshot = source.equipment,
    prescription_type_snapshot = source.prescription_type,
    repetition_mode_snapshot = source.repetition_mode,
    repetitions_min_snapshot = source.repetitions_min,
    repetitions_max_snapshot = source.repetitions_max,
    duration_seconds_snapshot = source.duration_seconds,
    per_set_mode_snapshot = source.per_set_mode,
    superset_key_snapshot = source.superset_key,
    superset_position_snapshot = source.superset_position,
    superset_label_snapshot = source.superset_label,
    superset_instruction_snapshot = source.superset_instruction
FROM app.workout_template_exercises source
WHERE source.id = assignment_exercise.source_template_exercise_id;

ALTER TABLE app.workout_assignment_exercises
  ALTER COLUMN source_exercise_key_snapshot SET NOT NULL,
  ADD CONSTRAINT workout_assignment_exercise_source_key_length CHECK (char_length(btrim(source_exercise_key_snapshot)) BETWEEN 1 AND 160),
  ADD CONSTRAINT workout_assignment_exercise_category_length CHECK (char_length(category_snapshot) <= 120),
  ADD CONSTRAINT workout_assignment_exercise_equipment_length CHECK (equipment_snapshot IS NULL OR char_length(equipment_snapshot) <= 160),
  ADD CONSTRAINT workout_assignment_exercise_repetition_range_v2 CHECK (
    (prescription_type_snapshot = 'duration' AND duration_seconds_snapshot BETWEEN 1 AND 86400)
    OR (
      prescription_type_snapshot = 'repetitions'
      AND repetitions_min_snapshot BETWEEN 1 AND 500
      AND repetitions_max_snapshot BETWEEN repetitions_min_snapshot AND 500
    )
  ),
  ADD CONSTRAINT workout_assignment_exercise_superset_consistent CHECK (
    (superset_key_snapshot IS NULL AND superset_position_snapshot IS NULL AND superset_label_snapshot IS NULL AND superset_instruction_snapshot IS NULL)
    OR (
      char_length(btrim(superset_key_snapshot)) BETWEEN 1 AND 120
      AND superset_position_snapshot BETWEEN 1 AND 4
      AND superset_label_snapshot IS NOT NULL
      AND char_length(superset_label_snapshot) <= 160
      AND superset_instruction_snapshot IS NOT NULL
      AND char_length(superset_instruction_snapshot) <= 2000
    )
  );

CREATE TABLE app.workout_assignment_exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_exercise_id uuid NOT NULL REFERENCES app.workout_assignment_exercises(id) ON DELETE RESTRICT,
  source_template_set_id uuid NOT NULL REFERENCES app.workout_template_exercise_sets(id) ON DELETE RESTRICT,
  set_key_snapshot text NOT NULL,
  position integer NOT NULL,
  kind_snapshot app.workout_set_kind NOT NULL,
  repetitions_min_snapshot integer,
  repetitions_max_snapshot integer,
  duration_seconds_snapshot integer,
  target_weight_kg_snapshot numeric(7,2),
  rest_seconds_snapshot integer NOT NULL,
  uses_override_snapshot boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_assignment_set_key_length CHECK (char_length(btrim(set_key_snapshot)) BETWEEN 1 AND 160),
  CONSTRAINT workout_assignment_set_position_positive CHECK (position > 0),
  CONSTRAINT workout_assignment_set_repetitions_range CHECK (
    (repetitions_min_snapshot IS NULL AND repetitions_max_snapshot IS NULL)
    OR (repetitions_min_snapshot BETWEEN 1 AND 500 AND repetitions_max_snapshot BETWEEN repetitions_min_snapshot AND 500)
  ),
  CONSTRAINT workout_assignment_set_duration_range CHECK (duration_seconds_snapshot IS NULL OR duration_seconds_snapshot BETWEEN 1 AND 86400),
  CONSTRAINT workout_assignment_set_weight_range CHECK (target_weight_kg_snapshot IS NULL OR target_weight_kg_snapshot BETWEEN 0 AND 2000),
  CONSTRAINT workout_assignment_set_rest_range CHECK (rest_seconds_snapshot BETWEEN 0 AND 3600),
  UNIQUE (assignment_exercise_id, set_key_snapshot),
  UNIQUE (assignment_exercise_id, position)
);

CREATE INDEX workout_template_exercise_sets_exercise_idx
  ON app.workout_template_exercise_sets (exercise_id, position);
CREATE INDEX workout_assignment_exercise_sets_exercise_idx
  ON app.workout_assignment_exercise_sets (assignment_exercise_id, position);

CREATE FUNCTION app.enforce_workout_template_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.trainer_user_id <> OLD.trainer_user_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'workout template identity and owner are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'archived' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'archived workout template is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.current_revision < OLD.current_revision OR NEW.current_revision > OLD.current_revision + 1 THEN
    RAISE EXCEPTION 'invalid workout template revision transition' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'published' AND NEW.status = 'draft' AND NEW.current_revision <> OLD.current_revision + 1 THEN
    RAISE EXCEPTION 'new draft must advance the revision' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'archived' THEN
    NEW.archived_at := coalesce(NEW.archived_at, clock_timestamp());
  ELSIF NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'non-archived template cannot have archived_at' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_workout_revision_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.template_id <> OLD.template_id
     OR NEW.revision_number <> OLD.revision_number OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'workout revision identity is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'published workout revision is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'invalid workout revision status' USING ERRCODE = 'check_violation';
  END IF;
  NEW.published_at := CASE WHEN NEW.status = 'published' THEN coalesce(NEW.published_at, clock_timestamp()) ELSE NULL END;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

DROP TRIGGER workout_templates_touch_updated_at ON app.workout_templates;
CREATE TRIGGER workout_templates_enforce_update
  BEFORE UPDATE ON app.workout_templates
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_template_update();
CREATE TRIGGER workout_templates_touch_updated_at
  BEFORE UPDATE ON app.workout_templates
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER workout_template_revisions_enforce_update
  BEFORE UPDATE ON app.workout_template_revisions
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_revision_update();

ALTER TABLE app.workout_template_exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_exercise_sets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignment_exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignment_exercise_sets FORCE ROW LEVEL SECURITY;

DROP POLICY workout_assignment_exercises_insert_snapshot_owner ON app.workout_assignment_exercises;

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

CREATE POLICY workout_templates_update_owner ON app.workout_templates
  FOR UPDATE TO ai_strength_app
  USING (trainer_user_id = app.current_actor_user_id())
  WITH CHECK (trainer_user_id = app.current_actor_user_id());

CREATE POLICY workout_template_revisions_update_owner_draft ON app.workout_template_revisions
  FOR UPDATE TO ai_strength_app
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = app.workout_template_revisions.template_id
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = app.workout_template_revisions.template_id
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_exercises_update_owner_draft ON app.workout_template_exercises
  FOR UPDATE TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = app.workout_template_exercises.revision_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = app.workout_template_exercises.revision_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_exercises_delete_owner_draft ON app.workout_template_exercises
  FOR DELETE TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = app.workout_template_exercises.revision_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_sets_select_owner ON app.workout_template_exercise_sets
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_exercises exercise
      JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_template_exercises exercise
      JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_sets_update_owner_draft ON app.workout_template_exercise_sets
  FOR UPDATE TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_exercises exercise
      JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  )
  WITH CHECK (true);

CREATE POLICY workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets
  FOR DELETE TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_exercises exercise
      JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
        AND revision.status = 'draft'
        AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_assignment_sets_select_participant ON app.workout_assignment_exercise_sets
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_assignment_exercises assignment_exercise
      JOIN app.workout_assignments assignment ON assignment.id = assignment_exercise.assignment_id
      WHERE assignment_exercise.id = app.workout_assignment_exercise_sets.assignment_exercise_id
        AND (
          assignment.athlete_user_id = app.current_actor_user_id()
          OR (
            assignment.trainer_user_id = app.current_actor_user_id()
            AND EXISTS (
              SELECT 1 FROM app.trainer_athlete_relations relation
              WHERE relation.id = assignment.relation_id
                AND relation.status = 'active'
                AND relation.trainer_user_id = app.current_actor_user_id()
            )
          )
        )
    )
  );

CREATE POLICY workout_assignment_sets_insert_snapshot_owner ON app.workout_assignment_exercise_sets
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_assignment_exercises assignment_exercise
      JOIN app.workout_assignments assignment ON assignment.id = assignment_exercise.assignment_id
      JOIN app.workout_template_exercise_sets source ON source.id = app.workout_assignment_exercise_sets.source_template_set_id
      WHERE assignment_exercise.id = app.workout_assignment_exercise_sets.assignment_exercise_id
        AND assignment.trainer_user_id = app.current_actor_user_id()
        AND source.exercise_id = assignment_exercise.source_template_exercise_id
        AND source.set_key = app.workout_assignment_exercise_sets.set_key_snapshot
        AND source.position = app.workout_assignment_exercise_sets.position
        AND source.kind = app.workout_assignment_exercise_sets.kind_snapshot
        AND source.repetitions_min IS NOT DISTINCT FROM app.workout_assignment_exercise_sets.repetitions_min_snapshot
        AND source.repetitions_max IS NOT DISTINCT FROM app.workout_assignment_exercise_sets.repetitions_max_snapshot
        AND source.duration_seconds IS NOT DISTINCT FROM app.workout_assignment_exercise_sets.duration_seconds_snapshot
        AND source.target_weight_kg IS NOT DISTINCT FROM app.workout_assignment_exercise_sets.target_weight_kg_snapshot
        AND source.rest_seconds = app.workout_assignment_exercise_sets.rest_seconds_snapshot
        AND source.uses_override = app.workout_assignment_exercise_sets.uses_override_snapshot
    )
  );

GRANT UPDATE (title, description, status, current_revision, archived_at) ON app.workout_templates TO ai_strength_app;
GRANT UPDATE (title, description, general_instruction, estimated_duration_min, status, category, published_at)
  ON app.workout_template_revisions TO ai_strength_app;
GRANT DELETE ON app.workout_template_exercises TO ai_strength_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.workout_template_exercise_sets TO ai_strength_app;
GRANT SELECT, INSERT ON app.workout_assignment_exercise_sets TO ai_strength_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON app.workout_template_exercise_sets,
  app.workout_assignment_exercise_sets TO ai_strength_authenticator;
GRANT SELECT ON app.workout_template_exercise_sets, app.workout_assignment_exercise_sets TO ai_strength_worker;

REVOKE ALL ON FUNCTION app.enforce_workout_template_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_workout_revision_update() FROM PUBLIC;

COMMENT ON TABLE app.workout_template_exercise_sets IS 'Normalized optional per-set prescription for a mutable draft or immutable published revision';
COMMENT ON TABLE app.workout_assignment_exercise_sets IS 'Independent per-set prescription snapshot owned by an assignment';
