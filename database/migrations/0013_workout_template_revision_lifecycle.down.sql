DROP TRIGGER IF EXISTS workout_template_revisions_lifecycle_constraint ON app.workout_template_revisions;
DROP TRIGGER IF EXISTS workout_templates_lifecycle_constraint ON app.workout_templates;
DROP FUNCTION IF EXISTS app.enforce_workout_template_lifecycle_constraint();
DROP FUNCTION IF EXISTS app.validate_workout_template_lifecycle(uuid);

DROP POLICY IF EXISTS workout_assignments_insert_active_trainer ON app.workout_assignments;
DROP POLICY IF EXISTS workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_update_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY IF EXISTS workout_template_exercises_delete_owner_draft ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_exercises_update_owner_draft ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_exercises_insert_owner ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_revisions_update_owner_draft ON app.workout_template_revisions;
DROP POLICY IF EXISTS workout_template_revisions_insert_owner ON app.workout_template_revisions;

ALTER TABLE app.workout_templates DISABLE TRIGGER workout_templates_enforce_update;
UPDATE app.workout_templates template
SET status = CASE
      WHEN template.status = 'archived' THEN 'archived'::app.workout_template_status
      ELSE revision.status::text::app.workout_template_status
    END,
    archived_at = CASE WHEN template.status = 'archived' THEN template.archived_at ELSE NULL END
FROM app.workout_template_revisions revision
WHERE revision.template_id = template.id
  AND revision.revision_number = template.current_revision;
ALTER TABLE app.workout_templates ENABLE TRIGGER workout_templates_enforce_update;

DROP INDEX IF EXISTS app.workout_templates_editable_revision_idx;
DROP INDEX IF EXISTS app.workout_templates_published_revision_idx;
DROP INDEX IF EXISTS app.workout_template_revisions_one_draft_idx;

ALTER TABLE app.workout_templates
  DROP CONSTRAINT IF EXISTS workout_templates_editable_revision_fk,
  DROP CONSTRAINT IF EXISTS workout_templates_published_revision_fk,
  DROP CONSTRAINT IF EXISTS workout_templates_pointer_distinct,
  DROP COLUMN IF EXISTS editable_revision_id,
  DROP COLUMN IF EXISTS published_revision_id;
ALTER TABLE app.workout_template_revisions
  DROP CONSTRAINT IF EXISTS workout_template_revisions_template_id_id_unique;

CREATE OR REPLACE FUNCTION app.enforce_workout_template_update()
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

CREATE POLICY workout_template_revisions_insert_owner ON app.workout_template_revisions
  FOR INSERT TO ai_strength_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_templates template
    WHERE template.id = app.workout_template_revisions.template_id
      AND template.trainer_user_id = app.current_actor_user_id()
      AND template.status <> 'archived'
  ));
CREATE POLICY workout_template_revisions_update_owner_draft ON app.workout_template_revisions
  FOR UPDATE TO ai_strength_app
  USING (status = 'draft' AND EXISTS (
    SELECT 1 FROM app.workout_templates template
    WHERE template.id = app.workout_template_revisions.template_id
      AND template.trainer_user_id = app.current_actor_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_templates template
    WHERE template.id = app.workout_template_revisions.template_id
      AND template.trainer_user_id = app.current_actor_user_id()
  ));

CREATE POLICY workout_template_exercises_insert_owner ON app.workout_template_exercises
  FOR INSERT TO ai_strength_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND template.trainer_user_id = app.current_actor_user_id()
      AND template.status <> 'archived'
  ));
CREATE POLICY workout_template_exercises_update_owner_draft ON app.workout_template_exercises
  FOR UPDATE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));
CREATE POLICY workout_template_exercises_delete_owner_draft ON app.workout_template_exercises
  FOR DELETE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));

CREATE POLICY workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets
  FOR INSERT TO ai_strength_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));
CREATE POLICY workout_template_sets_update_owner_draft ON app.workout_template_exercise_sets
  FOR UPDATE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  )) WITH CHECK (true);
CREATE POLICY workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets
  FOR DELETE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));

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
      SELECT 1 FROM app.workout_template_revisions revision
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

REVOKE ALL ON FUNCTION app.enforce_workout_template_update() FROM PUBLIC;
