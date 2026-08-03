CREATE TYPE app.workout_template_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE app.workout_assignment_status AS ENUM (
  'available',
  'cancelled'
);

CREATE TABLE app.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status app.workout_template_status NOT NULL DEFAULT 'draft',
  current_revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz,
  CONSTRAINT workout_template_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT workout_template_description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT workout_template_revision_positive CHECK (current_revision > 0),
  CONSTRAINT workout_template_archive_consistent CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status <> 'archived' AND archived_at IS NULL)
  )
);

CREATE TABLE app.workout_template_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES app.workout_templates(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  general_instruction text NOT NULL DEFAULT '',
  estimated_duration_min integer,
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_template_revision_number_positive CHECK (revision_number > 0),
  CONSTRAINT workout_template_revision_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT workout_template_revision_description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT workout_template_revision_instruction_length CHECK (char_length(general_instruction) <= 4000),
  CONSTRAINT workout_template_revision_duration_range CHECK (
    estimated_duration_min IS NULL OR estimated_duration_min BETWEEN 1 AND 600
  ),
  UNIQUE (template_id, revision_number)
);

CREATE TABLE app.workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES app.workout_template_revisions(id) ON DELETE RESTRICT,
  instance_key text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  sets integer NOT NULL,
  repetitions integer NOT NULL,
  target_weight_kg numeric(7,2),
  rest_seconds integer NOT NULL DEFAULT 90,
  trainer_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_template_exercise_instance_key_length CHECK (char_length(btrim(instance_key)) BETWEEN 1 AND 120),
  CONSTRAINT workout_template_exercise_position_positive CHECK (position > 0),
  CONSTRAINT workout_template_exercise_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT workout_template_exercise_sets_range CHECK (sets BETWEEN 1 AND 20),
  CONSTRAINT workout_template_exercise_repetitions_range CHECK (repetitions BETWEEN 1 AND 500),
  CONSTRAINT workout_template_exercise_weight_range CHECK (target_weight_kg IS NULL OR target_weight_kg BETWEEN 0 AND 2000),
  CONSTRAINT workout_template_exercise_rest_range CHECK (rest_seconds BETWEEN 0 AND 3600),
  CONSTRAINT workout_template_exercise_note_length CHECK (char_length(trainer_note) <= 2000),
  UNIQUE (revision_id, instance_key),
  UNIQUE (revision_id, position)
);

CREATE TABLE app.workout_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relation_id uuid NOT NULL REFERENCES app.trainer_athlete_relations(id) ON DELETE RESTRICT,
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  athlete_user_id uuid NOT NULL REFERENCES app.athlete_profiles(user_id) ON DELETE RESTRICT,
  source_template_id uuid NOT NULL REFERENCES app.workout_templates(id) ON DELETE RESTRICT,
  source_revision_id uuid NOT NULL REFERENCES app.workout_template_revisions(id) ON DELETE RESTRICT,
  source_revision_number integer NOT NULL,
  title_snapshot text NOT NULL,
  instruction_snapshot text NOT NULL DEFAULT '',
  trainer_note text NOT NULL DEFAULT '',
  scheduled_for date NOT NULL,
  status app.workout_assignment_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz,
  CONSTRAINT workout_assignment_title_length CHECK (char_length(btrim(title_snapshot)) BETWEEN 1 AND 120),
  CONSTRAINT workout_assignment_revision_positive CHECK (source_revision_number > 0),
  CONSTRAINT workout_assignment_instruction_length CHECK (char_length(instruction_snapshot) <= 4000),
  CONSTRAINT workout_assignment_note_length CHECK (char_length(trainer_note) <= 2000),
  CONSTRAINT workout_assignment_cancel_consistent CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled' AND cancelled_at IS NULL)
  )
);

CREATE TABLE app.workout_assignment_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES app.workout_assignments(id) ON DELETE RESTRICT,
  source_template_exercise_id uuid NOT NULL REFERENCES app.workout_template_exercises(id) ON DELETE RESTRICT,
  instance_key text NOT NULL,
  position integer NOT NULL,
  title_snapshot text NOT NULL,
  sets_snapshot integer NOT NULL,
  repetitions_snapshot integer NOT NULL,
  target_weight_kg_snapshot numeric(7,2),
  rest_seconds_snapshot integer NOT NULL,
  trainer_note_snapshot text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_assignment_exercise_instance_key_length CHECK (char_length(btrim(instance_key)) BETWEEN 1 AND 120),
  CONSTRAINT workout_assignment_exercise_position_positive CHECK (position > 0),
  CONSTRAINT workout_assignment_exercise_title_length CHECK (char_length(btrim(title_snapshot)) BETWEEN 1 AND 160),
  CONSTRAINT workout_assignment_exercise_sets_range CHECK (sets_snapshot BETWEEN 1 AND 20),
  CONSTRAINT workout_assignment_exercise_repetitions_range CHECK (repetitions_snapshot BETWEEN 1 AND 500),
  CONSTRAINT workout_assignment_exercise_weight_range CHECK (
    target_weight_kg_snapshot IS NULL OR target_weight_kg_snapshot BETWEEN 0 AND 2000
  ),
  CONSTRAINT workout_assignment_exercise_rest_range CHECK (rest_seconds_snapshot BETWEEN 0 AND 3600),
  CONSTRAINT workout_assignment_exercise_note_length CHECK (char_length(trainer_note_snapshot) <= 2000),
  UNIQUE (assignment_id, instance_key),
  UNIQUE (assignment_id, position)
);

CREATE INDEX workout_templates_trainer_status_idx
  ON app.workout_templates (trainer_user_id, status, updated_at DESC);
CREATE INDEX workout_template_revisions_template_idx
  ON app.workout_template_revisions (template_id, revision_number DESC);
CREATE INDEX workout_template_exercises_revision_idx
  ON app.workout_template_exercises (revision_id, position);
CREATE INDEX workout_assignments_trainer_schedule_idx
  ON app.workout_assignments (trainer_user_id, scheduled_for DESC, created_at DESC);
CREATE INDEX workout_assignments_athlete_schedule_idx
  ON app.workout_assignments (athlete_user_id, scheduled_for DESC, created_at DESC);
CREATE INDEX workout_assignment_exercises_assignment_idx
  ON app.workout_assignment_exercises (assignment_id, position);

CREATE TRIGGER workout_templates_touch_updated_at
  BEFORE UPDATE ON app.workout_templates
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER workout_assignments_touch_updated_at
  BEFORE UPDATE ON app.workout_assignments
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignment_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_assignment_exercises FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select_active_coaching_participant ON app.users
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.trainer_athlete_relations relation
      WHERE relation.status = 'active'
        AND (
          (relation.trainer_user_id = app.current_actor_user_id() AND relation.athlete_user_id = app.users.id)
          OR (relation.athlete_user_id = app.current_actor_user_id() AND relation.trainer_user_id = app.users.id)
        )
    )
  );

CREATE POLICY workout_templates_select_owner ON app.workout_templates
  FOR SELECT TO ai_strength_app
  USING (trainer_user_id = app.current_actor_user_id());

CREATE POLICY workout_templates_insert_active_owner ON app.workout_templates
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    trainer_user_id = app.current_actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app.trainer_profiles trainer
      WHERE trainer.user_id = app.current_actor_user_id() AND trainer.status = 'active'
    )
  );

CREATE POLICY workout_template_revisions_select_owner ON app.workout_template_revisions
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = template_id AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_revisions_insert_owner ON app.workout_template_revisions
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = template_id
        AND template.trainer_user_id = app.current_actor_user_id()
        AND template.status <> 'archived'
    )
  );

CREATE POLICY workout_template_exercises_select_owner ON app.workout_template_exercises
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = revision_id AND template.trainer_user_id = app.current_actor_user_id()
    )
  );

CREATE POLICY workout_template_exercises_insert_owner ON app.workout_template_exercises
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = revision_id
        AND template.trainer_user_id = app.current_actor_user_id()
        AND template.status <> 'archived'
    )
  );

CREATE POLICY workout_assignments_select_participant ON app.workout_assignments
  FOR SELECT TO ai_strength_app
  USING (
    athlete_user_id = app.current_actor_user_id()
    OR (
      trainer_user_id = app.current_actor_user_id()
      AND EXISTS (
        SELECT 1 FROM app.trainer_athlete_relations relation
        WHERE relation.id = app.workout_assignments.relation_id
          AND relation.trainer_user_id = app.current_actor_user_id()
          AND relation.status = 'active'
      )
    )
  );

CREATE POLICY workout_assignments_insert_active_trainer ON app.workout_assignments
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    trainer_user_id = app.current_actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app.trainer_athlete_relations relation
      WHERE relation.id = app.workout_assignments.relation_id
        AND relation.trainer_user_id = app.workout_assignments.trainer_user_id
        AND relation.athlete_user_id = app.workout_assignments.athlete_user_id
        AND relation.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM app.workout_template_revisions revision
      JOIN app.workout_templates template ON template.id = revision.template_id
      WHERE revision.id = app.workout_assignments.source_revision_id
        AND template.id = app.workout_assignments.source_template_id
        AND template.trainer_user_id = app.workout_assignments.trainer_user_id
        AND template.status = 'published'
        AND revision.revision_number = app.workout_assignments.source_revision_number
        AND EXISTS (
          SELECT 1 FROM app.workout_template_exercises exercise
          WHERE exercise.revision_id = revision.id
        )
    )
  );

CREATE POLICY workout_assignment_exercises_select_participant ON app.workout_assignment_exercises
  FOR SELECT TO ai_strength_app
  USING (
    EXISTS (
      SELECT 1 FROM app.workout_assignments assignment
      WHERE assignment.id = assignment_id
        AND (
          assignment.trainer_user_id = app.current_actor_user_id()
          OR assignment.athlete_user_id = app.current_actor_user_id()
        )
    )
  );

CREATE POLICY workout_assignment_exercises_insert_snapshot_owner ON app.workout_assignment_exercises
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app.workout_assignments assignment
      JOIN app.workout_template_exercises source ON source.id = source_template_exercise_id
      WHERE assignment.id = assignment_id
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

GRANT SELECT, INSERT ON app.workout_templates TO ai_strength_app;
GRANT SELECT, INSERT ON app.workout_template_revisions, app.workout_template_exercises TO ai_strength_app;
GRANT SELECT, INSERT ON app.workout_assignments, app.workout_assignment_exercises TO ai_strength_app;

GRANT SELECT, INSERT, UPDATE ON app.workout_templates, app.workout_template_revisions,
  app.workout_template_exercises, app.workout_assignments, app.workout_assignment_exercises
  TO ai_strength_authenticator;

GRANT SELECT ON app.workout_templates, app.workout_template_revisions,
  app.workout_template_exercises, app.workout_assignments, app.workout_assignment_exercises
  TO ai_strength_worker;

COMMENT ON TABLE app.workout_templates IS 'Trainer-owned reusable workout template identity';
COMMENT ON TABLE app.workout_template_revisions IS 'Immutable published prescription revision';
COMMENT ON TABLE app.workout_assignments IS 'Athlete-specific prescription created from a saved published template revision';
COMMENT ON TABLE app.workout_assignment_exercises IS 'Independent immutable exercise snapshot owned by the assignment';
