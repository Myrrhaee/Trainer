-- Destructive rollback: export collected context and disable submissions before use.
DROP POLICY relations_lock_athlete ON app.trainer_athlete_relations;
DROP POLICY workout_sessions_select_participant ON app.workout_sessions;
CREATE POLICY workout_sessions_select_participant ON app.workout_sessions FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.workout_sessions.relation_id AND relation.status = 'active'
  ))
);

DROP POLICY workout_assignments_select_participant ON app.workout_assignments;
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

DROP POLICY attention_items_select_owner_trainer ON app.attention_items;
CREATE POLICY attention_items_select_owner_trainer ON app.attention_items FOR SELECT TO ai_strength_app
USING (trainer_user_id = app.current_actor_user_id() AND EXISTS (
  SELECT 1 FROM app.trainer_athlete_relations relation
  WHERE relation.id = app.attention_items.relation_id AND relation.status = 'active'
));

DROP POLICY attention_items_update_owner_trainer ON app.attention_items;
CREATE POLICY attention_items_update_owner_trainer ON app.attention_items FOR UPDATE TO ai_strength_app
USING (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.attention_items.relation_id AND relation.status = 'active'
  )
)
WITH CHECK (
  trainer_user_id = app.current_actor_user_id() AND status = 'resolved'
  AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.attention_items.relation_id AND relation.status = 'active'
  )
);

DROP POLICY trainer_feedback_select_participants ON app.trainer_feedback;
CREATE POLICY trainer_feedback_select_participants ON app.trainer_feedback FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.trainer_feedback.relation_id AND relation.status = 'active'
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
    JOIN app.trainer_athlete_relations relation ON relation.id = attention.relation_id
    WHERE attention.id = app.trainer_feedback.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
      AND attention.athlete_user_id = app.trainer_feedback.athlete_user_id
      AND attention.relation_id = app.trainer_feedback.relation_id
      AND attention.source_session_id = app.trainer_feedback.source_session_id
      AND session.status IN ('completed', 'completed_with_omissions')
      AND relation.status = 'active'
  )
);

DROP POLICY attention_manual_resolutions_select_owner ON app.attention_manual_resolutions;
CREATE POLICY attention_manual_resolutions_select_owner ON app.attention_manual_resolutions FOR SELECT TO ai_strength_app
USING (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    JOIN app.trainer_athlete_relations relation ON relation.id = attention.relation_id
    WHERE attention.id = app.attention_manual_resolutions.attention_item_id
      AND relation.status = 'active'
  )
);

DROP POLICY attention_manual_resolutions_insert_owner ON app.attention_manual_resolutions;
CREATE POLICY attention_manual_resolutions_insert_owner ON app.attention_manual_resolutions FOR INSERT TO ai_strength_app
WITH CHECK (
  trainer_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    JOIN app.trainer_athlete_relations relation ON relation.id = attention.relation_id
    WHERE attention.id = app.attention_manual_resolutions.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
      AND attention.status = 'open' AND relation.status = 'active'
  )
);

DROP POLICY review_command_receipts_insert_actor ON app.review_command_receipts;
CREATE POLICY review_command_receipts_insert_actor ON app.review_command_receipts FOR INSERT TO ai_strength_app
WITH CHECK (
  actor_user_id = app.current_actor_user_id()
  AND EXISTS (
    SELECT 1 FROM app.attention_items attention
    JOIN app.trainer_athlete_relations relation ON relation.id = attention.relation_id
    WHERE attention.id = app.review_command_receipts.attention_item_id
      AND attention.trainer_user_id = app.current_actor_user_id()
      AND relation.status = 'active'
  )
);

DROP TRIGGER workout_sessions_enforce_context ON app.workout_sessions;
DROP FUNCTION app.has_terminal_assignment_workflow(uuid, uuid, uuid);
DROP POLICY workout_sessions_lineage_migrator ON app.workout_sessions;
DROP FUNCTION app.enforce_workout_session_context();
ALTER TABLE app.workout_sessions
  DROP CONSTRAINT workout_session_context_v1,
  DROP COLUMN overall_comment,
  DROP COLUMN discomfort_reported,
  DROP COLUMN discomfort_comment;
