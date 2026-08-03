DROP POLICY IF EXISTS users_select_active_coaching_participant ON app.users;

DROP TABLE IF EXISTS app.workout_assignment_exercises;
DROP TABLE IF EXISTS app.workout_assignments;
DROP TABLE IF EXISTS app.workout_template_exercises;
DROP TABLE IF EXISTS app.workout_template_revisions;
DROP TABLE IF EXISTS app.workout_templates;

DROP TYPE IF EXISTS app.workout_assignment_status;
DROP TYPE IF EXISTS app.workout_template_status;
