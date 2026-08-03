CREATE TYPE app_private.federated_auth_intent AS ENUM (
  'login',
  'link'
);

ALTER TABLE app_private.verification_challenges
  ADD COLUMN actor_user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
  ADD COLUMN session_id uuid REFERENCES app_private.sessions(id) ON DELETE RESTRICT;

DELETE FROM app_private.verification_challenges
WHERE kind = 'identity_link'
  AND (actor_user_id IS NULL OR session_id IS NULL);

ALTER TABLE app_private.verification_challenges
  ADD CONSTRAINT verification_challenges_identity_binding CHECK (
    (kind IN ('email_login', 'recovery') AND actor_user_id IS NULL AND session_id IS NULL)
    OR (kind = 'identity_link' AND actor_user_id IS NOT NULL AND session_id IS NOT NULL)
  );

CREATE TABLE app_private.federated_auth_flows (
  id uuid PRIMARY KEY,
  provider app_private.auth_identity_provider NOT NULL,
  intent app_private.federated_auth_intent NOT NULL,
  state_hash bytea NOT NULL UNIQUE,
  nonce_hash bytea NOT NULL,
  request_ip_hash bytea NOT NULL,
  actor_user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES app_private.sessions(id) ON DELETE RESTRICT,
  result_user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  CONSTRAINT federated_auth_flows_provider CHECK (provider IN ('google', 'telegram')),
  CONSTRAINT federated_auth_flows_hash_lengths CHECK (
    octet_length(state_hash) = 32
    AND octet_length(nonce_hash) = 32
    AND octet_length(request_ip_hash) = 32
  ),
  CONSTRAINT federated_auth_flows_binding CHECK (
    (intent = 'login' AND actor_user_id IS NULL AND session_id IS NULL)
    OR (intent = 'link' AND actor_user_id IS NOT NULL AND session_id IS NOT NULL)
  ),
  CONSTRAINT federated_auth_flows_expiry CHECK (expires_at > created_at),
  CONSTRAINT federated_auth_flows_terminal_state CHECK (
    consumed_at IS NULL OR invalidated_at IS NULL
  ),
  CONSTRAINT federated_auth_flows_result CHECK (
    (consumed_at IS NULL AND result_user_id IS NULL)
    OR (consumed_at IS NOT NULL AND result_user_id IS NOT NULL)
  )
);

CREATE INDEX federated_auth_flows_ip_created_idx
  ON app_private.federated_auth_flows(request_ip_hash, created_at DESC);

CREATE INDEX federated_auth_flows_expiry_idx
  ON app_private.federated_auth_flows(expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON app_private.federated_auth_flows
  TO ai_strength_authenticator;

COMMENT ON TABLE app_private.federated_auth_flows IS 'Short-lived, single-use Google and Telegram login/linking state';
COMMENT ON COLUMN app_private.federated_auth_flows.state_hash IS 'HMAC of provider state; raw state is never persisted';
COMMENT ON COLUMN app_private.federated_auth_flows.nonce_hash IS 'HMAC of OIDC nonce; raw nonce is never persisted';
COMMENT ON COLUMN app_private.verification_challenges.actor_user_id IS 'Authenticated user binding for explicit email identity linking';
