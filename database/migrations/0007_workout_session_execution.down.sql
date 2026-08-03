DROP POLICY IF EXISTS attention_items_insert_completion_athlete ON app.attention_items;
DROP POLICY IF EXISTS attention_items_select_owner_trainer ON app.attention_items;
DROP POLICY IF EXISTS workout_session_commands_insert_actor ON app.workout_session_command_receipts;
DROP POLICY IF EXISTS workout_session_commands_select_actor ON app.workout_session_command_receipts;
DROP POLICY IF EXISTS workout_set_logs_update_athlete ON app.workout_set_logs;
DROP POLICY IF EXISTS workout_set_logs_insert_athlete ON app.workout_set_logs;
DROP POLICY IF EXISTS workout_set_logs_select_participant ON app.workout_set_logs;
DROP POLICY IF EXISTS workout_exercise_logs_update_athlete ON app.workout_exercise_logs;
DROP POLICY IF EXISTS workout_exercise_logs_insert_athlete ON app.workout_exercise_logs;
DROP POLICY IF EXISTS workout_exercise_logs_select_participant ON app.workout_exercise_logs;
DROP POLICY IF EXISTS workout_sessions_update_athlete_active ON app.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_insert_athlete ON app.workout_sessions;
DROP POLICY IF EXISTS workout_sessions_select_participant ON app.workout_sessions;

DROP TRIGGER IF EXISTS workout_set_logs_enforce_update ON app.workout_set_logs;
DROP TRIGGER IF EXISTS workout_exercise_logs_enforce_update ON app.workout_exercise_logs;
DROP TRIGGER IF EXISTS workout_sessions_enforce_update ON app.workout_sessions;
DROP FUNCTION IF EXISTS app.enforce_workout_set_log_update();
DROP FUNCTION IF EXISTS app.enforce_workout_exercise_log_update();
DROP FUNCTION IF EXISTS app.enforce_workout_session_update();

DROP TABLE IF EXISTS app.attention_items;
DROP TABLE IF EXISTS app.workout_session_command_receipts;
DROP TABLE IF EXISTS app.workout_set_logs;
DROP TABLE IF EXISTS app.workout_exercise_logs;
DROP TABLE IF EXISTS app.workout_sessions;

DROP TYPE IF EXISTS app.attention_item_status;
DROP TYPE IF EXISTS app.workout_session_command_kind;
DROP TYPE IF EXISTS app.workout_log_status;
DROP TYPE IF EXISTS app.workout_session_status;
