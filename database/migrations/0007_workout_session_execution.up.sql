CREATE TYPE app.workout_session_status AS ENUM ('active', 'completed', 'completed_with_omissions', 'abandoned');
CREATE TYPE app.workout_log_status AS ENUM ('pending', 'completed', 'skipped', 'incomplete');
CREATE TYPE app.workout_session_command_kind AS ENUM ('progress', 'complete');
CREATE TYPE app.attention_item_status AS ENUM ('open', 'resolved', 'archived');

CREATE TABLE app.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES app.workout_assignments(id) ON DELETE RESTRICT,
  relation_id uuid NOT NULL REFERENCES app.trainer_athlete_relations(id) ON DELETE RESTRICT,
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  athlete_user_id uuid NOT NULL REFERENCES app.athlete_profiles(user_id) ON DELETE RESTRICT,
  status app.workout_session_status NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  client_timezone text NOT NULL DEFAULT 'UTC',
  start_idempotency_key_hash text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  zero_result_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_session_version_positive CHECK (version > 0),
  CONSTRAINT workout_session_timezone_length CHECK (char_length(btrim(client_timezone)) BETWEEN 1 AND 100),
  CONSTRAINT workout_session_start_key_hash_length CHECK (char_length(start_idempotency_key_hash) = 64),
  CONSTRAINT workout_session_zero_reason_length CHECK (zero_result_reason IS NULL OR char_length(zero_result_reason) <= 1000),
  CONSTRAINT workout_session_completion_consistent CHECK (
    (status = 'active' AND completed_at IS NULL)
    OR (status IN ('completed', 'completed_with_omissions') AND completed_at IS NOT NULL)
    OR (status = 'abandoned' AND completed_at IS NULL)
  ),
  UNIQUE (assignment_id)
);

CREATE TABLE app.workout_exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app.workout_sessions(id) ON DELETE RESTRICT,
  assignment_exercise_id uuid NOT NULL REFERENCES app.workout_assignment_exercises(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  status app.workout_log_status NOT NULL DEFAULT 'pending',
  athlete_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_exercise_log_position_positive CHECK (position > 0),
  CONSTRAINT workout_exercise_log_note_length CHECK (char_length(athlete_note) <= 2000),
  UNIQUE (session_id, assignment_exercise_id),
  UNIQUE (session_id, position)
);

CREATE TABLE app.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_log_id uuid NOT NULL REFERENCES app.workout_exercise_logs(id) ON DELETE RESTRICT,
  source_assignment_set_id uuid REFERENCES app.workout_assignment_exercise_sets(id) ON DELETE RESTRICT,
  set_key text NOT NULL,
  position integer NOT NULL,
  kind app.workout_set_kind NOT NULL,
  planned_repetitions_min integer,
  planned_repetitions_max integer,
  planned_duration_seconds integer,
  planned_weight_kg numeric(7,2),
  status app.workout_log_status NOT NULL DEFAULT 'pending',
  actual_repetitions integer,
  actual_duration_seconds integer,
  actual_weight_kg numeric(7,2),
  rpe numeric(3,1),
  athlete_comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_set_log_key_length CHECK (char_length(btrim(set_key)) BETWEEN 1 AND 160),
  CONSTRAINT workout_set_log_position_positive CHECK (position > 0),
  CONSTRAINT workout_set_log_planned_repetitions CHECK (
    (planned_repetitions_min IS NULL AND planned_repetitions_max IS NULL)
    OR (planned_repetitions_min BETWEEN 1 AND 500 AND planned_repetitions_max BETWEEN planned_repetitions_min AND 500)
  ),
  CONSTRAINT workout_set_log_planned_duration CHECK (planned_duration_seconds IS NULL OR planned_duration_seconds BETWEEN 1 AND 86400),
  CONSTRAINT workout_set_log_planned_weight CHECK (planned_weight_kg IS NULL OR planned_weight_kg BETWEEN 0 AND 2000),
  CONSTRAINT workout_set_log_actual_repetitions CHECK (actual_repetitions IS NULL OR actual_repetitions BETWEEN 0 AND 500),
  CONSTRAINT workout_set_log_actual_duration CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds BETWEEN 0 AND 86400),
  CONSTRAINT workout_set_log_actual_weight CHECK (actual_weight_kg IS NULL OR actual_weight_kg BETWEEN 0 AND 2000),
  CONSTRAINT workout_set_log_rpe CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  CONSTRAINT workout_set_log_comment_length CHECK (char_length(athlete_comment) <= 1000),
  CONSTRAINT workout_set_log_completed_has_result CHECK (
    status <> 'completed'
    OR actual_repetitions IS NOT NULL
    OR actual_duration_seconds IS NOT NULL
  ),
  UNIQUE (exercise_log_id, set_key),
  UNIQUE (exercise_log_id, position)
);

CREATE TABLE app.workout_session_command_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app.workout_sessions(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  kind app.workout_session_command_kind NOT NULL,
  idempotency_key_hash text NOT NULL,
  request_hash text NOT NULL,
  result_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workout_session_command_key_hash_length CHECK (char_length(idempotency_key_hash) = 64),
  CONSTRAINT workout_session_command_request_hash_length CHECK (char_length(request_hash) = 64),
  CONSTRAINT workout_session_command_version_positive CHECK (result_version > 0),
  UNIQUE (actor_user_id, kind, idempotency_key_hash)
);

CREATE TABLE app.attention_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  athlete_user_id uuid NOT NULL REFERENCES app.athlete_profiles(user_id) ON DELETE RESTRICT,
  relation_id uuid NOT NULL REFERENCES app.trainer_athlete_relations(id) ON DELETE RESTRICT,
  source_session_id uuid NOT NULL REFERENCES app.workout_sessions(id) ON DELETE RESTRICT,
  item_type text NOT NULL DEFAULT 'workout_review',
  status app.attention_item_status NOT NULL DEFAULT 'open',
  priority_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  CONSTRAINT attention_item_type_workout_review CHECK (item_type = 'workout_review'),
  CONSTRAINT attention_item_reasons_array CHECK (jsonb_typeof(priority_reasons) = 'array'),
  CONSTRAINT attention_item_resolution_consistent CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL)
    OR (status <> 'resolved' AND resolved_at IS NULL)
  ),
  UNIQUE (source_session_id, item_type)
);

CREATE INDEX workout_sessions_athlete_status_idx ON app.workout_sessions (athlete_user_id, status, started_at DESC);
CREATE INDEX workout_sessions_trainer_status_idx ON app.workout_sessions (trainer_user_id, status, started_at DESC);
CREATE INDEX workout_exercise_logs_session_idx ON app.workout_exercise_logs (session_id, position);
CREATE INDEX workout_set_logs_exercise_idx ON app.workout_set_logs (exercise_log_id, position);
CREATE INDEX attention_items_trainer_status_idx ON app.attention_items (trainer_user_id, status, created_at);

CREATE FUNCTION app.enforce_workout_session_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.assignment_id <> OLD.assignment_id OR NEW.relation_id <> OLD.relation_id
     OR NEW.trainer_user_id <> OLD.trainer_user_id OR NEW.athlete_user_id <> OLD.athlete_user_id
     OR NEW.started_at <> OLD.started_at OR NEW.created_at <> OLD.created_at
     OR NEW.start_idempotency_key_hash <> OLD.start_idempotency_key_hash THEN
    RAISE EXCEPTION 'workout session identity is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal workout session is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'workout session version must advance by one' USING ERRCODE = 'serialization_failure';
  END IF;
  IF NEW.status NOT IN ('active', 'completed', 'completed_with_omissions', 'abandoned') THEN
    RAISE EXCEPTION 'invalid workout session transition' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_workout_exercise_log_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.session_id <> OLD.session_id
     OR NEW.assignment_exercise_id <> OLD.assignment_exercise_id
     OR NEW.position <> OLD.position OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'workout exercise log identity is immutable' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_workout_set_log_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.exercise_log_id <> OLD.exercise_log_id
     OR NEW.source_assignment_set_id IS DISTINCT FROM OLD.source_assignment_set_id
     OR NEW.set_key <> OLD.set_key OR NEW.position <> OLD.position OR NEW.kind <> OLD.kind
     OR NEW.planned_repetitions_min IS DISTINCT FROM OLD.planned_repetitions_min
     OR NEW.planned_repetitions_max IS DISTINCT FROM OLD.planned_repetitions_max
     OR NEW.planned_duration_seconds IS DISTINCT FROM OLD.planned_duration_seconds
     OR NEW.planned_weight_kg IS DISTINCT FROM OLD.planned_weight_kg
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'workout set log prescription is immutable' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER workout_sessions_enforce_update BEFORE UPDATE ON app.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_session_update();
CREATE TRIGGER workout_exercise_logs_enforce_update BEFORE UPDATE ON app.workout_exercise_logs
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_exercise_log_update();
CREATE TRIGGER workout_set_logs_enforce_update BEFORE UPDATE ON app.workout_set_logs
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_set_log_update();

ALTER TABLE app.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_exercise_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_set_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.workout_session_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workout_session_command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.attention_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.attention_items FORCE ROW LEVEL SECURITY;

CREATE POLICY workout_sessions_select_participant ON app.workout_sessions FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.workout_sessions.relation_id AND relation.status = 'active'
  ))
);

CREATE POLICY workout_sessions_insert_athlete ON app.workout_sessions FOR INSERT TO ai_strength_app
WITH CHECK (
  athlete_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.workout_assignments assignment
    JOIN app.trainer_athlete_relations relation ON relation.id = assignment.relation_id
    WHERE assignment.id = app.workout_sessions.assignment_id
      AND assignment.athlete_user_id = app.current_actor_user_id()
      AND assignment.trainer_user_id = app.workout_sessions.trainer_user_id
      AND assignment.relation_id = app.workout_sessions.relation_id
      AND assignment.status = 'available' AND relation.status = 'active'
  )
);

CREATE POLICY workout_sessions_update_athlete_active ON app.workout_sessions FOR UPDATE TO ai_strength_app
USING (athlete_user_id = app.current_actor_user_id() AND status = 'active')
WITH CHECK (athlete_user_id = app.current_actor_user_id());

CREATE POLICY workout_exercise_logs_select_participant ON app.workout_exercise_logs FOR SELECT TO ai_strength_app
USING (EXISTS (
  SELECT 1 FROM app.workout_sessions session
  WHERE session.id = app.workout_exercise_logs.session_id
));
CREATE POLICY workout_exercise_logs_insert_athlete ON app.workout_exercise_logs FOR INSERT TO ai_strength_app
WITH CHECK (EXISTS (
  SELECT 1 FROM app.workout_sessions session
  JOIN app.workout_assignment_exercises source ON source.id = app.workout_exercise_logs.assignment_exercise_id
  WHERE session.id = app.workout_exercise_logs.session_id
    AND session.athlete_user_id = app.current_actor_user_id() AND session.status = 'active'
    AND source.assignment_id = session.assignment_id AND source.position = app.workout_exercise_logs.position
));
CREATE POLICY workout_exercise_logs_update_athlete ON app.workout_exercise_logs FOR UPDATE TO ai_strength_app
USING (EXISTS (
  SELECT 1 FROM app.workout_sessions session
  WHERE session.id = app.workout_exercise_logs.session_id
    AND session.athlete_user_id = app.current_actor_user_id() AND session.status = 'active'
)) WITH CHECK (true);

CREATE POLICY workout_set_logs_select_participant ON app.workout_set_logs FOR SELECT TO ai_strength_app
USING (EXISTS (
  SELECT 1 FROM app.workout_exercise_logs exercise
  JOIN app.workout_sessions session ON session.id = exercise.session_id
  WHERE exercise.id = app.workout_set_logs.exercise_log_id
));
CREATE POLICY workout_set_logs_insert_athlete ON app.workout_set_logs FOR INSERT TO ai_strength_app
WITH CHECK (EXISTS (
  SELECT 1 FROM app.workout_exercise_logs exercise
  JOIN app.workout_sessions session ON session.id = exercise.session_id
  WHERE exercise.id = app.workout_set_logs.exercise_log_id
    AND session.athlete_user_id = app.current_actor_user_id() AND session.status = 'active'
));
CREATE POLICY workout_set_logs_update_athlete ON app.workout_set_logs FOR UPDATE TO ai_strength_app
USING (EXISTS (
  SELECT 1 FROM app.workout_exercise_logs exercise
  JOIN app.workout_sessions session ON session.id = exercise.session_id
  WHERE exercise.id = app.workout_set_logs.exercise_log_id
    AND session.athlete_user_id = app.current_actor_user_id() AND session.status = 'active'
)) WITH CHECK (true);

CREATE POLICY workout_session_commands_select_actor ON app.workout_session_command_receipts FOR SELECT TO ai_strength_app
USING (actor_user_id = app.current_actor_user_id());
CREATE POLICY workout_session_commands_insert_actor ON app.workout_session_command_receipts FOR INSERT TO ai_strength_app
WITH CHECK (actor_user_id = app.current_actor_user_id() AND EXISTS (
  SELECT 1 FROM app.workout_sessions session
  WHERE session.id = app.workout_session_command_receipts.session_id
    AND session.athlete_user_id = app.current_actor_user_id()
));

CREATE POLICY attention_items_select_owner_trainer ON app.attention_items FOR SELECT TO ai_strength_app
USING (trainer_user_id = app.current_actor_user_id() AND EXISTS (
  SELECT 1 FROM app.trainer_athlete_relations relation
  WHERE relation.id = app.attention_items.relation_id AND relation.status = 'active'
));
CREATE POLICY attention_items_insert_completion_athlete ON app.attention_items FOR INSERT TO ai_strength_app
WITH CHECK (EXISTS (
  SELECT 1 FROM app.workout_sessions session
  WHERE session.id = app.attention_items.source_session_id
    AND session.athlete_user_id = app.current_actor_user_id()
    AND session.status IN ('completed', 'completed_with_omissions')
    AND session.trainer_user_id = app.attention_items.trainer_user_id
    AND session.athlete_user_id = app.attention_items.athlete_user_id
    AND session.relation_id = app.attention_items.relation_id
));

GRANT SELECT, INSERT, UPDATE ON app.workout_sessions, app.workout_exercise_logs, app.workout_set_logs TO ai_strength_app;
GRANT SELECT, INSERT ON app.workout_session_command_receipts, app.attention_items TO ai_strength_app;
GRANT SELECT, INSERT, UPDATE ON app.workout_sessions, app.workout_exercise_logs, app.workout_set_logs,
  app.workout_session_command_receipts, app.attention_items TO ai_strength_authenticator;
GRANT SELECT ON app.workout_sessions, app.workout_exercise_logs, app.workout_set_logs,
  app.workout_session_command_receipts, app.attention_items TO ai_strength_worker;

REVOKE ALL ON FUNCTION app.enforce_workout_session_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_workout_exercise_log_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_workout_set_log_update() FROM PUBLIC;

COMMENT ON TABLE app.workout_sessions IS 'One resumable athlete execution attempt per workout assignment';
COMMENT ON TABLE app.workout_set_logs IS 'Stable planned set identity with athlete-owned actual performance facts';
COMMENT ON TABLE app.workout_session_command_receipts IS 'Durable idempotency boundary for progress and completion commands';
COMMENT ON TABLE app.attention_items IS 'Durable trainer review work item created once per completed workout session';
