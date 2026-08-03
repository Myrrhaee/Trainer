CREATE TYPE app.trainer_feedback_kind AS ENUM ('detailed', 'acknowledgement', 'follow_up');
CREATE TYPE app.review_command_kind AS ENUM ('send_feedback', 'manual_resolution', 'follow_up');

CREATE TABLE app.trainer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  athlete_user_id uuid NOT NULL REFERENCES app.athlete_profiles(user_id) ON DELETE RESTRICT,
  relation_id uuid NOT NULL REFERENCES app.trainer_athlete_relations(id) ON DELETE RESTRICT,
  source_session_id uuid NOT NULL REFERENCES app.workout_sessions(id) ON DELETE RESTRICT,
  attention_item_id uuid NOT NULL REFERENCES app.attention_items(id) ON DELETE RESTRICT,
  kind app.trainer_feedback_kind NOT NULL,
  body text NOT NULL,
  follow_up_of_id uuid REFERENCES app.trainer_feedback(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT trainer_feedback_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  CONSTRAINT trainer_feedback_follow_up_consistent CHECK (
    (kind = 'follow_up' AND follow_up_of_id IS NOT NULL)
    OR (kind <> 'follow_up' AND follow_up_of_id IS NULL)
  )
);

CREATE TABLE app.attention_manual_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attention_item_id uuid NOT NULL UNIQUE REFERENCES app.attention_items(id) ON DELETE RESTRICT,
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  reason text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT attention_manual_resolution_reason_length CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000)
);

CREATE TABLE app.review_command_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attention_item_id uuid NOT NULL REFERENCES app.attention_items(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  kind app.review_command_kind NOT NULL,
  idempotency_key_hash text NOT NULL,
  request_hash text NOT NULL,
  result_entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT review_command_key_hash_length CHECK (char_length(idempotency_key_hash) = 64),
  CONSTRAINT review_command_request_hash_length CHECK (char_length(request_hash) = 64),
  UNIQUE (actor_user_id, kind, idempotency_key_hash)
);

CREATE INDEX trainer_feedback_session_sent_idx ON app.trainer_feedback (source_session_id, sent_at);
CREATE INDEX trainer_feedback_athlete_sent_idx ON app.trainer_feedback (athlete_user_id, sent_at DESC);
CREATE INDEX review_command_attention_idx ON app.review_command_receipts (attention_item_id, created_at);

CREATE FUNCTION app.enforce_attention_item_review_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id <> OLD.id OR NEW.trainer_user_id <> OLD.trainer_user_id
     OR NEW.athlete_user_id <> OLD.athlete_user_id OR NEW.relation_id <> OLD.relation_id
     OR NEW.source_session_id <> OLD.source_session_id OR NEW.item_type <> OLD.item_type
     OR NEW.priority_reasons <> OLD.priority_reasons OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'attention item source is immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status <> 'open' OR NEW.status <> 'resolved' OR NEW.resolved_at IS NULL THEN
    RAISE EXCEPTION 'invalid attention item resolution transition' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER attention_items_enforce_review_update
  BEFORE UPDATE ON app.attention_items
  FOR EACH ROW EXECUTE FUNCTION app.enforce_attention_item_review_update();

ALTER TABLE app.trainer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trainer_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE app.attention_manual_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.attention_manual_resolutions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.review_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.review_command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY trainer_feedback_select_participants ON app.trainer_feedback FOR SELECT TO ai_strength_app
USING (
  athlete_user_id = app.current_actor_user_id()
  OR (trainer_user_id = app.current_actor_user_id() AND EXISTS (
    SELECT 1 FROM app.trainer_athlete_relations relation
    WHERE relation.id = app.trainer_feedback.relation_id AND relation.status = 'active'
  ))
);

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

CREATE POLICY review_command_receipts_select_actor ON app.review_command_receipts FOR SELECT TO ai_strength_app
USING (actor_user_id = app.current_actor_user_id());

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

GRANT SELECT, INSERT ON app.trainer_feedback, app.attention_manual_resolutions,
  app.review_command_receipts TO ai_strength_app;
GRANT UPDATE (status, resolved_at) ON app.attention_items TO ai_strength_app;

GRANT SELECT, INSERT ON app.trainer_feedback, app.attention_manual_resolutions,
  app.review_command_receipts TO ai_strength_authenticator;
GRANT SELECT ON app.trainer_feedback, app.attention_manual_resolutions,
  app.review_command_receipts TO ai_strength_worker;

REVOKE ALL ON FUNCTION app.enforce_attention_item_review_update() FROM PUBLIC;

COMMENT ON TABLE app.trainer_feedback IS 'Immutable client-visible trainer feedback linked to one completed workout session';
COMMENT ON TABLE app.attention_manual_resolutions IS 'Trainer-private auditable reason for resolving a review without client feedback';
COMMENT ON TABLE app.review_command_receipts IS 'Durable idempotency boundary for trainer review commands';
