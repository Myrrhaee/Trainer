CREATE TYPE app.notification_event_type AS ENUM (
  'workout_assigned',
  'workout_completed',
  'review_feedback_ready'
);

CREATE TYPE app.notification_delivery_status AS ENUM (
  'pending',
  'processing',
  'retry_wait',
  'delivered',
  'cancelled',
  'dead_letter'
);

CREATE TABLE app.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type app.notification_event_type NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  deduplication_key text NOT NULL UNIQUE,
  status app.notification_delivery_status NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '7 days'),
  attempt_count integer NOT NULL DEFAULT 0,
  lock_token uuid,
  locked_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT notification_outbox_aggregate_type CHECK (
    aggregate_type IN ('workout_assignment', 'workout_session', 'trainer_feedback')
  ),
  CONSTRAINT notification_outbox_deduplication_key_length CHECK (
    char_length(deduplication_key) BETWEEN 1 AND 180
  ),
  CONSTRAINT notification_outbox_deduplication_key_canonical CHECK (
    deduplication_key = event_type::text || ':' || aggregate_id::text
  ),
  CONSTRAINT notification_outbox_attempt_count_nonnegative CHECK (attempt_count >= 0),
  CONSTRAINT notification_outbox_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT notification_outbox_lock_consistent CHECK (
    (status = 'processing' AND lock_token IS NOT NULL AND locked_at IS NOT NULL)
    OR (status <> 'processing' AND lock_token IS NULL AND locked_at IS NULL)
  ),
  CONSTRAINT notification_outbox_delivery_consistent CHECK (
    (status = 'delivered' AND delivered_at IS NOT NULL)
    OR (status <> 'delivered' AND delivered_at IS NULL)
  ),
  CONSTRAINT notification_outbox_event_aggregate_match CHECK (
    (event_type = 'workout_assigned' AND aggregate_type = 'workout_assignment')
    OR (event_type = 'workout_completed' AND aggregate_type = 'workout_session')
    OR (event_type = 'review_feedback_ready' AND aggregate_type = 'trainer_feedback')
  )
);

CREATE INDEX notification_outbox_claim_idx
  ON app.notification_outbox (available_at, created_at, id)
  WHERE status IN ('pending', 'retry_wait', 'processing');

CREATE INDEX notification_outbox_recipient_idx
  ON app.notification_outbox (recipient_user_id, created_at DESC);

CREATE TRIGGER notification_outbox_touch_updated_at
  BEFORE UPDATE ON app.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_outbox_insert_canonical_event ON app.notification_outbox
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    actor_user_id = app.current_actor_user_id()
    AND status = 'pending'
    AND attempt_count = 0
    AND lock_token IS NULL
    AND locked_at IS NULL
    AND delivered_at IS NULL
    AND provider_message_id IS NULL
    AND last_error_code IS NULL
    AND created_at BETWEEN clock_timestamp() - interval '5 minutes'
      AND clock_timestamp() + interval '5 minutes'
    AND available_at BETWEEN created_at - interval '5 minutes' AND created_at + interval '5 minutes'
    AND expires_at BETWEEN created_at + interval '1 hour' AND created_at + interval '7 days'
    AND (
      (
        event_type = 'workout_assigned'
        AND EXISTS (
          SELECT 1 FROM app.workout_assignments assignment
          WHERE assignment.id = aggregate_id
            AND assignment.trainer_user_id = app.current_actor_user_id()
            AND assignment.athlete_user_id = recipient_user_id
        )
      )
      OR (
        event_type = 'workout_completed'
        AND EXISTS (
          SELECT 1 FROM app.workout_sessions session
          WHERE session.id = aggregate_id
            AND session.athlete_user_id = app.current_actor_user_id()
            AND session.trainer_user_id = recipient_user_id
            AND session.status IN ('completed', 'completed_with_omissions')
        )
      )
      OR (
        event_type = 'review_feedback_ready'
        AND EXISTS (
          SELECT 1 FROM app.trainer_feedback feedback
          WHERE feedback.id = aggregate_id
            AND feedback.trainer_user_id = app.current_actor_user_id()
            AND feedback.athlete_user_id = recipient_user_id
        )
      )
    )
  );

CREATE POLICY notification_outbox_worker_access ON app.notification_outbox
  FOR ALL TO ai_strength_worker
  USING (true)
  WITH CHECK (true);

CREATE FUNCTION app_private.telegram_notification_recipient(target_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, app_private, app
AS $function$
  SELECT identity.provider_subject
  FROM app_private.auth_identities identity
  JOIN app.users account ON account.id = identity.user_id
  WHERE identity.user_id = target_user_id
    AND identity.provider = 'telegram'
    AND identity.revoked_at IS NULL
    AND account.status = 'active'
    AND identity.provider_subject ~ '^[1-9][0-9]{0,15}$'
    AND (
      identity.provider_metadata @> '{"botAccessGranted": true}'::jsonb
      OR identity.provider_metadata @> '{"allowsWriteToPm": true}'::jsonb
    )
  ORDER BY identity.last_used_at DESC NULLS LAST, identity.created_at DESC
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION app_private.telegram_notification_recipient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.telegram_notification_recipient(uuid) TO ai_strength_worker;

GRANT INSERT ON app.notification_outbox TO ai_strength_app;
GRANT SELECT ON app.notification_outbox TO ai_strength_worker;
GRANT UPDATE (
  status,
  available_at,
  attempt_count,
  lock_token,
  locked_at,
  delivered_at,
  provider_message_id,
  last_error_code,
  updated_at
) ON app.notification_outbox TO ai_strength_worker;

COMMENT ON TABLE app.notification_outbox IS
  'Transactional, channel-neutral notification events claimed only by the background worker';
COMMENT ON COLUMN app.notification_outbox.deduplication_key IS
  'Stable product-event key; request retries cannot enqueue duplicate delivery';
COMMENT ON FUNCTION app_private.telegram_notification_recipient(uuid) IS
  'Returns a Telegram recipient only when an active identity carries explicit bot messaging permission';
