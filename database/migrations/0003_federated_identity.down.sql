DROP TABLE IF EXISTS app_private.federated_auth_flows;
DELETE FROM app_private.verification_challenges
WHERE kind = 'identity_link';
ALTER TABLE app_private.verification_challenges
  DROP CONSTRAINT IF EXISTS verification_challenges_identity_binding,
  DROP COLUMN IF EXISTS session_id,
  DROP COLUMN IF EXISTS actor_user_id;
DROP TYPE IF EXISTS app_private.federated_auth_intent;
