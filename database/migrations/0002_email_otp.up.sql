CREATE TYPE app_private.challenge_delivery_status AS ENUM (
  'pending',
  'sent',
  'failed'
);

CREATE TABLE app_private.verification_challenges (
  id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'email_login',
  target_hash bytea NOT NULL,
  secret_hash bytea NOT NULL,
  request_ip_hash bytea NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL,
  resend_sequence smallint NOT NULL DEFAULT 0,
  delivery_status app_private.challenge_delivery_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT verification_challenges_kind CHECK (kind IN ('email_login', 'identity_link', 'recovery')),
  CONSTRAINT verification_challenges_hash_lengths CHECK (
    octet_length(target_hash) = 32
    AND octet_length(secret_hash) = 32
    AND octet_length(request_ip_hash) = 32
  ),
  CONSTRAINT verification_challenges_attempts CHECK (
    max_attempts BETWEEN 1 AND 10
    AND attempt_count BETWEEN 0 AND max_attempts
  ),
  CONSTRAINT verification_challenges_resend_sequence CHECK (resend_sequence BETWEEN 0 AND 20),
  CONSTRAINT verification_challenges_expiry CHECK (expires_at > created_at),
  CONSTRAINT verification_challenges_terminal_state CHECK (
    consumed_at IS NULL OR invalidated_at IS NULL
  )
);

CREATE INDEX verification_challenges_target_created_idx
  ON app_private.verification_challenges(target_hash, created_at DESC);

CREATE INDEX verification_challenges_ip_created_idx
  ON app_private.verification_challenges(request_ip_hash, created_at DESC);

CREATE INDEX verification_challenges_active_expiry_idx
  ON app_private.verification_challenges(expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON app_private.verification_challenges
  TO ai_strength_authenticator;

COMMENT ON TABLE app_private.verification_challenges IS 'Hashed, expiring and single-use verification challenges';
COMMENT ON COLUMN app_private.verification_challenges.target_hash IS 'HMAC of normalized target; raw target is not stored in challenge persistence';
COMMENT ON COLUMN app_private.verification_challenges.secret_hash IS 'HMAC of challenge ID, normalized target and one-time secret';
