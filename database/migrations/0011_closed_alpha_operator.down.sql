REVOKE EXECUTE ON FUNCTION app_private.closed_alpha_cohort_status(text, text, text) FROM ai_strength_operator;
REVOKE EXECUTE ON FUNCTION app_private.closed_alpha_activate_trainer(text, text, text) FROM ai_strength_operator;
REVOKE USAGE ON SCHEMA app_private FROM ai_strength_operator;

DROP FUNCTION IF EXISTS app_private.closed_alpha_cohort_status(text, text, text);
DROP FUNCTION IF EXISTS app_private.closed_alpha_activate_trainer(text, text, text);
DROP FUNCTION IF EXISTS app_private.closed_alpha_identity_status(text);

DROP POLICY IF EXISTS audit_events_migrator_operator_functions ON app.audit_events;
DROP POLICY IF EXISTS relations_migrator_operator_functions ON app.trainer_athlete_relations;
DROP POLICY IF EXISTS athlete_profiles_migrator_operator_functions ON app.athlete_profiles;
DROP POLICY IF EXISTS trainer_profiles_migrator_operator_functions ON app.trainer_profiles;
DROP POLICY IF EXISTS users_migrator_operator_lock ON app.users;
DROP POLICY IF EXISTS users_migrator_operator_functions ON app.users;

REVOKE SELECT, UPDATE (revoked_at) ON app_private.auth_identities FROM ai_strength_migrator;
REVOKE USAGE ON SCHEMA app, app_private FROM ai_strength_migrator;
REVOKE INSERT ON app.audit_events FROM ai_strength_migrator;
REVOKE SELECT, UPDATE (status) ON app.trainer_profiles FROM ai_strength_migrator;
REVOKE SELECT, UPDATE (status) ON app.users FROM ai_strength_migrator;
REVOKE SELECT ON app.athlete_profiles, app.trainer_athlete_relations FROM ai_strength_migrator;
