-- Session INSERT -> Assignment SELECT -> Session SELECT recurses at rewrite time.
-- This non-inlined scalar boundary reads only the actor's exact terminal lineage.
-- FORCE RLS remains enabled, including for the non-BYPASSRLS function owner.
CREATE POLICY workout_sessions_lineage_migrator ON app.workout_sessions FOR SELECT TO ai_strength_migrator
USING (trainer_user_id = app.current_actor_user_id() AND status IN ('completed', 'completed_with_omissions'));
CREATE FUNCTION app.has_terminal_assignment_workflow(target_assignment uuid, target_relation uuid, target_athlete uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM app.workout_sessions session
    WHERE session.assignment_id = target_assignment AND session.relation_id = target_relation
      AND session.athlete_user_id = target_athlete
      AND session.trainer_user_id = app.current_actor_user_id()
      AND session.status IN ('completed', 'completed_with_omissions'));
END
$function$;
REVOKE ALL ON FUNCTION app.has_terminal_assignment_workflow(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.has_terminal_assignment_workflow(uuid, uuid, uuid) TO ai_strength_app;

ALTER TABLE app.workout_sessions
  ADD COLUMN overall_comment text,
  ADD COLUMN discomfort_reported boolean,
  ADD COLUMN discomfort_comment text,
  ADD CONSTRAINT workout_session_context_v1 CHECK (
    (overall_comment IS NULL OR char_length(overall_comment) <= 2000)
    AND (discomfort_comment IS NULL OR char_length(discomfort_comment) <= 1000)
    AND (
      (discomfort_reported IS NULL AND overall_comment IS NULL AND discomfort_comment IS NULL)
      OR (discomfort_reported IS NOT NULL AND status IN ('completed', 'completed_with_omissions')
        AND ((discomfort_reported = false AND discomfort_comment IS NULL)
          OR (discomfort_reported = true AND discomfort_comment IS NOT NULL
            AND char_length(btrim(discomfort_comment, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0)))
    )
  );

CREATE FUNCTION app.enforce_workout_session_context()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' THEN
      RAISE EXCEPTION 'session must start active' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'completed_with_omissions')
        AND NEW.discomfort_reported IS NULL THEN
    RAISE EXCEPTION 'explicit discomfort answer required' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER workout_sessions_enforce_context BEFORE INSERT OR UPDATE ON app.workout_sessions
FOR EACH ROW EXECUTE FUNCTION app.enforce_workout_session_context();
REVOKE ALL ON FUNCTION app.enforce_workout_session_context() FROM PUBLIC;

-- SELECT FOR SHARE uses UPDATE USING. This permits an own-row lock, never a mutation.
-- Existing trainer WITH CHECK still authorizes only that row's original trainer.
CREATE POLICY relations_lock_athlete ON app.trainer_athlete_relations FOR UPDATE TO ai_strength_app
USING (athlete_user_id = app.current_actor_user_id()) WITH CHECK (false);

DROP POLICY workout_sessions_select_participant ON app.workout_sessions;
CREATE POLICY workout_sessions_select_participant ON app.workout_sessions FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.workout_sessions.relation_id
      AND relation.trainer_user_id = app.workout_sessions.trainer_user_id
      AND relation.athlete_user_id = app.workout_sessions.athlete_user_id
      AND (relation.status = 'active' OR app.workout_sessions.status IN ('completed', 'completed_with_omissions'))
  ))
);

DROP POLICY workout_assignments_select_participant ON app.workout_assignments;
CREATE POLICY workout_assignments_select_participant ON app.workout_assignments FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND (
    EXISTS (SELECT 1 FROM app.trainer_athlete_relations relation
      WHERE relation.id = app.workout_assignments.relation_id
        AND relation.trainer_user_id = app.workout_assignments.trainer_user_id
        AND relation.athlete_user_id = app.workout_assignments.athlete_user_id
        AND relation.status = 'active')
    OR app.has_terminal_assignment_workflow(id, relation_id, athlete_user_id)
  ))
);

DROP POLICY attention_items_select_owner_trainer ON app.attention_items;
CREATE POLICY attention_items_select_owner_trainer ON app.attention_items FOR SELECT TO ai_strength_app
USING (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.workout_sessions session
    WHERE session.id = app.attention_items.source_session_id
      AND session.trainer_user_id = app.attention_items.trainer_user_id
      AND session.athlete_user_id = app.attention_items.athlete_user_id
      AND session.relation_id = app.attention_items.relation_id
      AND session.status IN ('completed', 'completed_with_omissions')
  ));

DROP POLICY attention_items_update_owner_trainer ON app.attention_items;
CREATE POLICY attention_items_update_owner_trainer ON app.attention_items FOR UPDATE TO ai_strength_app
USING (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.workout_sessions session
    WHERE session.id = app.attention_items.source_session_id
      AND session.trainer_user_id = app.attention_items.trainer_user_id
      AND session.athlete_user_id = app.attention_items.athlete_user_id
      AND session.relation_id = app.attention_items.relation_id
      AND session.status IN ('completed', 'completed_with_omissions')
  ))
WITH CHECK (trainer_user_id = app.current_actor_user_id() AND status = 'resolved' AND EXISTS (
    SELECT 1 FROM app.workout_sessions session
    WHERE session.id = app.attention_items.source_session_id
      AND session.trainer_user_id = app.attention_items.trainer_user_id
      AND session.athlete_user_id = app.attention_items.athlete_user_id
      AND session.relation_id = app.attention_items.relation_id
      AND session.status IN ('completed', 'completed_with_omissions')
  ));

DROP POLICY trainer_feedback_select_participants ON app.trainer_feedback;
CREATE POLICY trainer_feedback_select_participants ON app.trainer_feedback FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    WHERE attention.id = app.trainer_feedback.attention_item_id
      AND attention.source_session_id = app.trainer_feedback.source_session_id
      AND attention.relation_id = app.trainer_feedback.relation_id
      AND attention.trainer_user_id = app.trainer_feedback.trainer_user_id
      AND attention.athlete_user_id = app.trainer_feedback.athlete_user_id
  ))
);

DROP POLICY trainer_feedback_insert_owner ON app.trainer_feedback;
CREATE POLICY trainer_feedback_insert_owner ON app.trainer_feedback FOR INSERT TO ai_strength_app
WITH CHECK (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1
    FROM app.attention_items attention
    JOIN app.workout_sessions session ON session.id = attention.source_session_id
    WHERE attention.id = app.trainer_feedback.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
      AND attention.athlete_user_id = app.trainer_feedback.athlete_user_id
      AND attention.relation_id = app.trainer_feedback.relation_id
      AND attention.source_session_id = app.trainer_feedback.source_session_id
      AND session.status IN ('completed', 'completed_with_omissions')
  )
);

DROP POLICY attention_manual_resolutions_select_owner ON app.attention_manual_resolutions;
CREATE POLICY attention_manual_resolutions_select_owner ON app.attention_manual_resolutions FOR SELECT TO ai_strength_app
USING (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    WHERE attention.id = app.attention_manual_resolutions.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
  )
);

DROP POLICY attention_manual_resolutions_insert_owner ON app.attention_manual_resolutions;
CREATE POLICY attention_manual_resolutions_insert_owner ON app.attention_manual_resolutions FOR INSERT TO ai_strength_app
WITH CHECK (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    WHERE attention.id = app.attention_manual_resolutions.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
      AND attention.status = 'open'
  )
);

DROP POLICY review_command_receipts_insert_actor ON app.review_command_receipts;
CREATE POLICY review_command_receipts_insert_actor ON app.review_command_receipts FOR INSERT TO ai_strength_app
WITH CHECK (
  actor_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    WHERE attention.id = app.review_command_receipts.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
  )
);
