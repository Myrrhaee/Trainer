DROP POLICY IF EXISTS athlete_profiles_accept_invitation ON app.athlete_profiles;
DROP POLICY IF EXISTS relations_accept_invitation ON app.trainer_athlete_relations;

DROP TABLE IF EXISTS app.athlete_invitations;
DROP TABLE IF EXISTS app.trainer_athlete_relations;
DROP TABLE IF EXISTS app.athlete_profiles;
DROP TABLE IF EXISTS app.trainer_profiles;

DROP FUNCTION IF EXISTS app.enforce_invitation_update();
DROP FUNCTION IF EXISTS app.enforce_relation_transition();
DROP FUNCTION IF EXISTS app.enforce_athlete_capability_transition();
DROP FUNCTION IF EXISTS app.enforce_trainer_capability_transition();
DROP FUNCTION IF EXISTS app.current_invitation_token_hash();

DROP TYPE IF EXISTS app.trainer_athlete_relation_status;
DROP TYPE IF EXISTS app.athlete_capability_status;
DROP TYPE IF EXISTS app.trainer_capability_status;
