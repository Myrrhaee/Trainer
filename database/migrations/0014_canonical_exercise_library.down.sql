DROP TRIGGER IF EXISTS workout_template_exercises_validate_source ON app.workout_template_exercises;
DROP FUNCTION IF EXISTS app.enforce_workout_template_exercise_source();
DROP FUNCTION IF EXISTS app.backfill_workout_template_exercise_sources();
DROP POLICY IF EXISTS workout_template_exercises_backfill_migrator_update ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_exercises_backfill_migrator_select ON app.workout_template_exercises;
DROP POLICY IF EXISTS workout_template_revisions_exercise_backfill_migrator ON app.workout_template_revisions;
DROP POLICY IF EXISTS workout_templates_exercise_backfill_migrator ON app.workout_templates;

DROP INDEX IF EXISTS app.workout_template_exercises_source_idx;
ALTER TABLE app.workout_template_exercises
  DROP CONSTRAINT IF EXISTS workout_template_exercise_source_fk,
  DROP COLUMN IF EXISTS source_exercise_id;

DROP TRIGGER IF EXISTS exercises_prevent_delete ON app.exercises;
DROP TRIGGER IF EXISTS exercises_touch_updated_at ON app.exercises;
DROP FUNCTION IF EXISTS app.prevent_exercise_delete();
DROP TABLE IF EXISTS app.exercises;
DROP TYPE IF EXISTS app.exercise_status;
DROP TYPE IF EXISTS app.exercise_scope;
