LOCK TABLE app.workout_templates, app.workout_template_revisions IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE app.workout_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_revisions DISABLE ROW LEVEL SECURITY;

DO $preflight$
DECLARE
  conflict record;
BEGIN
  SELECT template.id, template.status::text AS status, template.current_revision, reason
  INTO conflict
  FROM (
    SELECT template.*,
      CASE
        WHEN current_revision.id IS NULL THEN 'current_revision_missing'
        WHEN template.status = 'draft' AND current_revision.status <> 'draft' THEN 'draft_template_current_revision_not_draft'
        WHEN template.status = 'published' AND current_revision.status <> 'published' THEN 'published_template_current_revision_not_published'
        WHEN draft_count.count > 1 THEN 'multiple_draft_revisions'
        WHEN draft_count.count = 1 AND draft_count.revision_number <> template.current_revision THEN 'draft_revision_not_current'
        WHEN template.status = 'draft' AND draft_count.count = 0 THEN 'draft_template_without_draft_revision'
        WHEN template.status = 'published' AND published_count.count = 0 THEN 'published_template_without_published_revision'
      END AS reason
    FROM app.workout_templates template
    LEFT JOIN app.workout_template_revisions current_revision
      ON current_revision.template_id = template.id
     AND current_revision.revision_number = template.current_revision
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS count, max(revision_number) AS revision_number
      FROM app.workout_template_revisions revision
      WHERE revision.template_id = template.id AND revision.status = 'draft'
    ) draft_count ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS count
      FROM app.workout_template_revisions revision
      WHERE revision.template_id = template.id AND revision.status = 'published'
    ) published_count ON true
  ) template
  WHERE reason IS NOT NULL
  ORDER BY template.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'r2d1_template_lifecycle_preflight_failed: template=%, status=%, current_revision=%, reason=%',
      conflict.id, conflict.status, conflict.current_revision, conflict.reason
      USING ERRCODE = 'check_violation';
  END IF;
END
$preflight$;

ALTER TABLE app.workout_template_revisions
  ADD CONSTRAINT workout_template_revisions_template_id_id_unique UNIQUE (template_id, id);

ALTER TABLE app.workout_templates
  ADD COLUMN published_revision_id uuid,
  ADD COLUMN editable_revision_id uuid;

ALTER TABLE app.workout_templates DISABLE TRIGGER workout_templates_enforce_update;

UPDATE app.workout_templates template
SET published_revision_id = (
  SELECT revision.id
  FROM app.workout_template_revisions revision
  WHERE revision.template_id = template.id AND revision.status = 'published'
  ORDER BY revision.revision_number DESC
  LIMIT 1
);

UPDATE app.workout_templates template
SET editable_revision_id = (
  SELECT revision.id
  FROM app.workout_template_revisions revision
  WHERE revision.template_id = template.id AND revision.status = 'draft'
  ORDER BY revision.revision_number DESC
  LIMIT 1
);

UPDATE app.workout_templates template
SET title = coalesce((
      SELECT revision.title FROM app.workout_template_revisions revision
      WHERE revision.id = template.published_revision_id
    ), template.title),
    description = coalesce((
      SELECT revision.description FROM app.workout_template_revisions revision
      WHERE revision.id = template.published_revision_id
    ), template.description),
    status = CASE
      WHEN template.status = 'archived' THEN 'archived'::app.workout_template_status
      WHEN template.published_revision_id IS NOT NULL THEN 'published'::app.workout_template_status
      ELSE 'draft'::app.workout_template_status
    END,
    current_revision = (
      SELECT revision.revision_number
      FROM app.workout_template_revisions revision
      WHERE revision.id = coalesce(template.editable_revision_id, template.published_revision_id)
    );

ALTER TABLE app.workout_templates ENABLE TRIGGER workout_templates_enforce_update;

ALTER TABLE app.workout_templates
  ADD CONSTRAINT workout_templates_pointer_distinct CHECK (
    published_revision_id IS NULL OR editable_revision_id IS NULL OR published_revision_id <> editable_revision_id
  ),
  ADD CONSTRAINT workout_templates_published_revision_fk
    FOREIGN KEY (id, published_revision_id)
    REFERENCES app.workout_template_revisions (template_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT workout_templates_editable_revision_fk
    FOREIGN KEY (id, editable_revision_id)
    REFERENCES app.workout_template_revisions (template_id, id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX workout_template_revisions_one_draft_idx
  ON app.workout_template_revisions (template_id)
  WHERE status = 'draft';
CREATE INDEX workout_templates_published_revision_idx
  ON app.workout_templates (published_revision_id)
  WHERE published_revision_id IS NOT NULL;
CREATE INDEX workout_templates_editable_revision_idx
  ON app.workout_templates (editable_revision_id)
  WHERE editable_revision_id IS NOT NULL;

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
  IF NEW.status = 'archived' THEN
    NEW.archived_at := coalesce(NEW.archived_at, clock_timestamp());
  ELSIF NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'non-archived template cannot have archived_at' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.validate_workout_template_lifecycle(target_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $function$
DECLARE
  template_row app.workout_templates%ROWTYPE;
  published_row app.workout_template_revisions%ROWTYPE;
  editable_row app.workout_template_revisions%ROWTYPE;
  latest_published_id uuid;
  draft_count integer;
BEGIN
  SELECT * INTO template_row FROM app.workout_templates WHERE id = target_template_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF template_row.published_revision_id IS NOT NULL THEN
    SELECT * INTO published_row FROM app.workout_template_revisions WHERE id = template_row.published_revision_id;
    IF NOT FOUND OR published_row.template_id <> template_row.id OR published_row.status <> 'published' THEN
      RAISE EXCEPTION 'template_lifecycle_conflict: invalid published revision pointer for template %', template_row.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF template_row.editable_revision_id IS NOT NULL THEN
    SELECT * INTO editable_row FROM app.workout_template_revisions WHERE id = template_row.editable_revision_id;
    IF NOT FOUND OR editable_row.template_id <> template_row.id OR editable_row.status <> 'draft' THEN
      RAISE EXCEPTION 'template_lifecycle_conflict: invalid editable revision pointer for template %', template_row.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT count(*)::integer INTO draft_count
  FROM app.workout_template_revisions revision
  WHERE revision.template_id = template_row.id AND revision.status = 'draft';
  IF draft_count <> (CASE WHEN template_row.editable_revision_id IS NULL THEN 0 ELSE 1 END) THEN
    RAISE EXCEPTION 'template_lifecycle_conflict: editable draft mismatch for template %', template_row.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT revision.id INTO latest_published_id
  FROM app.workout_template_revisions revision
  WHERE revision.template_id = template_row.id AND revision.status = 'published'
  ORDER BY revision.revision_number DESC
  LIMIT 1;
  IF latest_published_id IS DISTINCT FROM template_row.published_revision_id THEN
    RAISE EXCEPTION 'template_lifecycle_conflict: published pointer is not latest for template %', template_row.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF template_row.current_revision IS DISTINCT FROM coalesce(editable_row.revision_number, published_row.revision_number) THEN
    RAISE EXCEPTION 'template_lifecycle_conflict: compatibility current_revision mismatch for template %', template_row.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF template_row.status = 'draft' AND (template_row.published_revision_id IS NOT NULL OR template_row.editable_revision_id IS NULL) THEN
    RAISE EXCEPTION 'template_lifecycle_conflict: invalid draft-only state for template %', template_row.id
      USING ERRCODE = 'check_violation';
  ELSIF template_row.status = 'published' AND template_row.published_revision_id IS NULL THEN
    RAISE EXCEPTION 'template_lifecycle_conflict: published template has no published revision for template %', template_row.id
      USING ERRCODE = 'check_violation';
  END IF;
END
$function$;

CREATE FUNCTION app.enforce_workout_template_lifecycle_constraint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'workout_templates' THEN
    PERFORM app.validate_workout_template_lifecycle(coalesce(NEW.id, OLD.id));
  ELSE
    IF TG_OP <> 'INSERT' THEN
      PERFORM app.validate_workout_template_lifecycle(OLD.template_id);
    END IF;
    IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.template_id IS DISTINCT FROM OLD.template_id) THEN
      PERFORM app.validate_workout_template_lifecycle(NEW.template_id);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

CREATE CONSTRAINT TRIGGER workout_templates_lifecycle_constraint
  AFTER INSERT OR UPDATE ON app.workout_templates
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_template_lifecycle_constraint();
CREATE CONSTRAINT TRIGGER workout_template_revisions_lifecycle_constraint
  AFTER INSERT OR UPDATE OR DELETE ON app.workout_template_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_template_lifecycle_constraint();

ALTER TABLE app.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_template_revisions FORCE ROW LEVEL SECURITY;

DROP POLICY workout_template_revisions_insert_owner ON app.workout_template_revisions;
CREATE POLICY workout_template_revisions_insert_owner ON app.workout_template_revisions
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = app.workout_template_revisions.template_id
        AND template.trainer_user_id = app.current_actor_user_id()
        AND template.status <> 'archived'
        AND template.editable_revision_id IS NULL
    )
  );

DROP POLICY workout_template_revisions_update_owner_draft ON app.workout_template_revisions;
CREATE POLICY workout_template_revisions_update_owner_draft ON app.workout_template_revisions
  FOR UPDATE TO ai_strength_app
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = app.workout_template_revisions.template_id
        AND template.trainer_user_id = app.current_actor_user_id()
        AND template.status <> 'archived'
        AND template.editable_revision_id = app.workout_template_revisions.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.workout_templates template
      WHERE template.id = app.workout_template_revisions.template_id
        AND template.trainer_user_id = app.current_actor_user_id()
        AND template.status <> 'archived'
        AND template.editable_revision_id = app.workout_template_revisions.id
    )
  );

DROP POLICY workout_template_exercises_insert_owner ON app.workout_template_exercises;
DROP POLICY workout_template_exercises_update_owner_draft ON app.workout_template_exercises;
DROP POLICY workout_template_exercises_delete_owner_draft ON app.workout_template_exercises;
CREATE POLICY workout_template_exercises_insert_owner ON app.workout_template_exercises
  FOR INSERT TO ai_strength_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));
CREATE POLICY workout_template_exercises_update_owner_draft ON app.workout_template_exercises
  FOR UPDATE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));
CREATE POLICY workout_template_exercises_delete_owner_draft ON app.workout_template_exercises
  FOR DELETE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_revisions revision
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE revision.id = app.workout_template_exercises.revision_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));

DROP POLICY workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY workout_template_sets_update_owner_draft ON app.workout_template_exercise_sets;
DROP POLICY workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets;
CREATE POLICY workout_template_sets_insert_owner_draft ON app.workout_template_exercise_sets
  FOR INSERT TO ai_strength_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
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
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));
CREATE POLICY workout_template_sets_delete_owner_draft ON app.workout_template_exercise_sets
  FOR DELETE TO ai_strength_app
  USING (EXISTS (
    SELECT 1 FROM app.workout_template_exercises exercise
    JOIN app.workout_template_revisions revision ON revision.id = exercise.revision_id
    JOIN app.workout_templates template ON template.id = revision.template_id
    WHERE exercise.id = app.workout_template_exercise_sets.exercise_id
      AND revision.status = 'draft'
      AND template.editable_revision_id = revision.id
      AND template.status <> 'archived'
      AND template.trainer_user_id = app.current_actor_user_id()
  ));

DROP POLICY workout_assignments_insert_active_trainer ON app.workout_assignments;
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
        AND template.status <> 'archived'
        AND template.published_revision_id = revision.id
        AND revision.status = 'published'
        AND revision.revision_number = app.workout_assignments.source_revision_number
        AND EXISTS (
          SELECT 1 FROM app.workout_template_exercises exercise
          WHERE exercise.revision_id = revision.id
        )
    )
  );

GRANT UPDATE (published_revision_id, editable_revision_id) ON app.workout_templates TO ai_strength_app;

REVOKE ALL ON FUNCTION app.validate_workout_template_lifecycle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_workout_template_lifecycle_constraint() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.validate_workout_template_lifecycle(uuid) TO ai_strength_app;

COMMENT ON COLUMN app.workout_templates.published_revision_id IS
  'Canonical latest published revision available to Quick Assign and assignment commands';
COMMENT ON COLUMN app.workout_templates.editable_revision_id IS
  'Canonical single editable draft revision; null when no draft is open';
COMMENT ON COLUMN app.workout_templates.current_revision IS
  'Compatibility revision number: editable revision when present, otherwise latest published revision';
