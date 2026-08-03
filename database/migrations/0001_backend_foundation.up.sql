CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA app;
CREATE SCHEMA app_private;

REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

CREATE TYPE app.user_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'deletion_pending',
  'deleted'
);

CREATE TYPE app_private.auth_identity_provider AS ENUM (
  'email_otp',
  'google',
  'telegram'
);

CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status app.user_status NOT NULL DEFAULT 'pending',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT users_display_name_length CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 120)
);

CREATE TABLE app_private.auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  provider app_private.auth_identity_provider NOT NULL,
  provider_subject text NOT NULL,
  email_original text,
  email_normalized text,
  verified_at timestamptz NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  provider_metadata jsonb,
  CONSTRAINT auth_identities_provider_subject_not_blank CHECK (btrim(provider_subject) <> ''),
  CONSTRAINT auth_identities_email_normalized_lowercase CHECK (
    email_normalized IS NULL OR email_normalized = lower(btrim(email_normalized))
  ),
  CONSTRAINT auth_identities_provider_metadata_object CHECK (
    provider_metadata IS NULL OR jsonb_typeof(provider_metadata) = 'object'
  ),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX auth_identities_user_id_idx ON app_private.auth_identities(user_id);

CREATE TABLE app_private.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason text,
  CONSTRAINT sessions_token_hash_sha256_length CHECK (octet_length(token_hash) = 32),
  CONSTRAINT sessions_absolute_expiry_after_creation CHECK (absolute_expires_at > created_at),
  CONSTRAINT sessions_idle_expiry_range CHECK (
    idle_expires_at > created_at AND idle_expires_at <= absolute_expires_at
  ),
  CONSTRAINT sessions_revocation_is_complete CHECK (
    (revoked_at IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND btrim(revocation_reason) <> '')
  )
);

CREATE INDEX sessions_user_id_idx ON app_private.sessions(user_id);
CREATE INDEX sessions_active_expiry_idx
  ON app_private.sessions(idle_expires_at, absolute_expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE app.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT audit_events_event_type_not_blank CHECK (btrim(event_type) <> ''),
  CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_events_actor_occurred_idx ON app.audit_events(actor_user_id, occurred_at DESC);
CREATE INDEX audit_events_subject_occurred_idx ON app.audit_events(subject_user_id, occurred_at DESC);

CREATE FUNCTION app.current_actor_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.actor_user_id', true), '')::uuid
$function$;

CREATE FUNCTION app.enforce_user_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('active', 'suspended', 'deletion_pending'))
    OR (OLD.status = 'active' AND NEW.status IN ('suspended', 'deletion_pending'))
    OR (OLD.status = 'suspended' AND NEW.status IN ('active', 'deletion_pending'))
    OR (OLD.status = 'deletion_pending' AND NEW.status IN ('active', 'deleted'))
  ) THEN
    RAISE EXCEPTION 'invalid user status transition from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$function$;

CREATE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.current_actor_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_user_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.touch_updated_at() FROM PUBLIC;

CREATE TRIGGER users_enforce_status_transition
  BEFORE UPDATE OF status ON app.users
  FOR EACH ROW EXECUTE FUNCTION app.enforce_user_status_transition();

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON app.users
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.users FORCE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select_self ON app.users
  FOR SELECT TO ai_strength_app
  USING (id = app.current_actor_user_id());

CREATE POLICY users_update_self ON app.users
  FOR UPDATE TO ai_strength_app
  USING (id = app.current_actor_user_id())
  WITH CHECK (id = app.current_actor_user_id());

CREATE POLICY users_authenticator_access ON app.users
  FOR ALL TO ai_strength_authenticator
  USING (true)
  WITH CHECK (true);

CREATE POLICY audit_events_insert_actor ON app.audit_events
  FOR INSERT TO ai_strength_app
  WITH CHECK (actor_user_id = app.current_actor_user_id());

CREATE POLICY audit_events_select_actor ON app.audit_events
  FOR SELECT TO ai_strength_app
  USING (actor_user_id = app.current_actor_user_id());

CREATE POLICY audit_events_authenticator_insert ON app.audit_events
  FOR INSERT TO ai_strength_authenticator
  WITH CHECK (true);

GRANT USAGE ON SCHEMA app TO ai_strength_app, ai_strength_authenticator, ai_strength_worker;
GRANT USAGE ON SCHEMA app_private TO ai_strength_authenticator, ai_strength_worker;

GRANT SELECT ON app.users TO ai_strength_app;
GRANT UPDATE (display_name) ON app.users TO ai_strength_app;
GRANT SELECT, INSERT ON app.audit_events TO ai_strength_app;

GRANT SELECT, INSERT, UPDATE ON app.users TO ai_strength_authenticator;
GRANT SELECT, INSERT, UPDATE ON app_private.auth_identities TO ai_strength_authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_private.sessions TO ai_strength_authenticator;
GRANT SELECT, INSERT ON app.audit_events TO ai_strength_authenticator;

GRANT SELECT ON app.users, app.audit_events TO ai_strength_worker;
GRANT SELECT, UPDATE, DELETE ON app_private.sessions TO ai_strength_worker;

GRANT EXECUTE ON FUNCTION app.current_actor_user_id() TO ai_strength_app, ai_strength_authenticator, ai_strength_worker;

COMMENT ON SCHEMA app IS 'Canonical product data and actor-scoped read models';
COMMENT ON SCHEMA app_private IS 'Server-only identity and session persistence';
COMMENT ON COLUMN app_private.sessions.token_hash IS 'SHA-256 hash of an opaque session token; raw tokens are never persisted';
