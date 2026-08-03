CREATE FUNCTION app_private.closed_alpha_identity_status(target_email text)
RETURNS TABLE (
  user_id uuid,
  registered boolean,
  ambiguous boolean,
  account_active boolean,
  identity_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, app_private, app
AS $function$
  SELECT
    CASE
      WHEN count(DISTINCT identity.user_id) = 1
        THEN min(identity.user_id::text)::uuid
      ELSE NULL
    END,
    count(DISTINCT identity.user_id) > 0,
    count(DISTINCT identity.user_id) > 1,
    coalesce(bool_or(account.status = 'active'), false),
    coalesce(bool_or(identity.verified_at IS NOT NULL AND identity.revoked_at IS NULL), false)
  FROM app_private.auth_identities identity
  JOIN app.users account ON account.id = identity.user_id
  WHERE identity.email_normalized = lower(btrim(target_email))
$function$;

CREATE FUNCTION app_private.closed_alpha_activate_trainer(
  target_email text,
  operator_ref text,
  release_ref text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_private, app
AS $function$
DECLARE
  matched record;
  trainer_status text;
BEGIN
  IF target_email IS NULL
     OR char_length(btrim(target_email)) NOT BETWEEN 3 AND 320
     OR position('@' IN target_email) = 0 THEN
    RETURN 'invalid_email';
  END IF;
  IF operator_ref IS NULL OR operator_ref !~ '^[a-z0-9][a-z0-9._-]{2,63}$' THEN
    RAISE EXCEPTION 'invalid operator reference' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF release_ref IS NULL OR char_length(btrim(release_ref)) NOT BETWEEN 7 AND 128 THEN
    RAISE EXCEPTION 'invalid release reference' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO matched
  FROM app_private.closed_alpha_identity_status(target_email);

  IF NOT matched.registered THEN RETURN 'account_not_found'; END IF;
  IF matched.ambiguous THEN RETURN 'ambiguous_email'; END IF;

  PERFORM 1 FROM app.users account
  WHERE account.id = matched.user_id AND account.status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RETURN 'account_unavailable'; END IF;

  PERFORM 1 FROM app_private.auth_identities identity
  WHERE identity.user_id = matched.user_id
    AND identity.email_normalized = lower(btrim(target_email))
    AND identity.verified_at IS NOT NULL
    AND identity.revoked_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RETURN 'identity_unverified'; END IF;

  SELECT status::text INTO trainer_status
  FROM app.trainer_profiles
  WHERE user_id = matched.user_id
  FOR UPDATE;

  IF trainer_status IS NULL THEN RETURN 'trainer_request_missing'; END IF;
  IF trainer_status = 'active' THEN RETURN 'already_active'; END IF;
  IF trainer_status <> 'pending' THEN RETURN 'trainer_state_unavailable'; END IF;

  UPDATE app.trainer_profiles
  SET status = 'active'
  WHERE user_id = matched.user_id;

  INSERT INTO app.audit_events (subject_user_id, event_type, metadata)
  VALUES (
    matched.user_id,
    'access.trainer_capability.operator_activated',
    jsonb_build_object(
      'source', 'closed_alpha_operator',
      'operator_ref', operator_ref,
      'release', btrim(release_ref)
    )
  );
  RETURN 'activated';
END
$function$;

CREATE FUNCTION app_private.closed_alpha_cohort_status(
  trainer_email text,
  athlete_one_email text,
  athlete_two_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, app_private, app
AS $function$
DECLARE
  trainer record;
  athlete_one record;
  athlete_two record;
  trainer_capability text;
  athlete_one_capability text;
  athlete_two_capability text;
  athlete_one_relation boolean := false;
  athlete_two_relation boolean := false;
  blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO trainer FROM app_private.closed_alpha_identity_status(trainer_email);
  SELECT * INTO athlete_one FROM app_private.closed_alpha_identity_status(athlete_one_email);
  SELECT * INTO athlete_two FROM app_private.closed_alpha_identity_status(athlete_two_email);

  IF trainer.user_id IS NOT NULL THEN
    SELECT status::text INTO trainer_capability
    FROM app.trainer_profiles WHERE user_id = trainer.user_id;
  END IF;
  IF athlete_one.user_id IS NOT NULL THEN
    SELECT status::text INTO athlete_one_capability
    FROM app.athlete_profiles WHERE user_id = athlete_one.user_id;
  END IF;
  IF athlete_two.user_id IS NOT NULL THEN
    SELECT status::text INTO athlete_two_capability
    FROM app.athlete_profiles WHERE user_id = athlete_two.user_id;
  END IF;

  IF trainer.user_id IS NOT NULL AND athlete_one.user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM app.trainer_athlete_relations relation
      WHERE relation.trainer_user_id = trainer.user_id
        AND relation.athlete_user_id = athlete_one.user_id
        AND relation.status = 'active' AND relation.is_primary
    ) INTO athlete_one_relation;
  END IF;
  IF trainer.user_id IS NOT NULL AND athlete_two.user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM app.trainer_athlete_relations relation
      WHERE relation.trainer_user_id = trainer.user_id
        AND relation.athlete_user_id = athlete_two.user_id
        AND relation.status = 'active' AND relation.is_primary
    ) INTO athlete_two_relation;
  END IF;

  IF NOT trainer.registered THEN blockers := array_append(blockers, 'trainer_registration_missing');
  ELSIF trainer.ambiguous THEN blockers := array_append(blockers, 'trainer_email_ambiguous');
  ELSIF NOT trainer.account_active OR NOT trainer.identity_verified THEN blockers := array_append(blockers, 'trainer_identity_unavailable');
  ELSIF trainer_capability IS NULL THEN blockers := array_append(blockers, 'trainer_request_missing');
  ELSIF trainer_capability <> 'active' THEN blockers := array_append(blockers, 'trainer_activation_required');
  END IF;

  IF NOT athlete_one.registered THEN blockers := array_append(blockers, 'athlete_1_registration_missing');
  ELSIF athlete_one.ambiguous THEN blockers := array_append(blockers, 'athlete_1_email_ambiguous');
  ELSIF NOT athlete_one.account_active OR NOT athlete_one.identity_verified THEN blockers := array_append(blockers, 'athlete_1_identity_unavailable');
  ELSIF athlete_one_capability <> 'active' OR NOT athlete_one_relation THEN blockers := array_append(blockers, 'athlete_1_invitation_acceptance_required');
  END IF;

  IF NOT athlete_two.registered THEN blockers := array_append(blockers, 'athlete_2_registration_missing');
  ELSIF athlete_two.ambiguous THEN blockers := array_append(blockers, 'athlete_2_email_ambiguous');
  ELSIF NOT athlete_two.account_active OR NOT athlete_two.identity_verified THEN blockers := array_append(blockers, 'athlete_2_identity_unavailable');
  ELSIF athlete_two_capability <> 'active' OR NOT athlete_two_relation THEN blockers := array_append(blockers, 'athlete_2_invitation_acceptance_required');
  END IF;

  RETURN jsonb_build_object(
    'ready', cardinality(blockers) = 0,
    'trainer', jsonb_build_object(
      'registered', trainer.registered,
      'identityVerified', trainer.identity_verified,
      'active', trainer_capability = 'active'
    ),
    'athletes', jsonb_build_array(
      jsonb_build_object(
        'registered', athlete_one.registered,
        'identityVerified', athlete_one.identity_verified,
        'relationActive', athlete_one_relation
      ),
      jsonb_build_object(
        'registered', athlete_two.registered,
        'identityVerified', athlete_two.identity_verified,
        'relationActive', athlete_two_relation
      )
    ),
    'blockers', to_jsonb(blockers)
  );
END
$function$;

CREATE POLICY users_migrator_operator_functions ON app.users
  FOR SELECT TO ai_strength_migrator USING (true);
CREATE POLICY users_migrator_operator_lock ON app.users
  FOR UPDATE TO ai_strength_migrator USING (true) WITH CHECK (true);
CREATE POLICY trainer_profiles_migrator_operator_functions ON app.trainer_profiles
  FOR ALL TO ai_strength_migrator USING (true) WITH CHECK (true);
CREATE POLICY athlete_profiles_migrator_operator_functions ON app.athlete_profiles
  FOR SELECT TO ai_strength_migrator USING (true);
CREATE POLICY relations_migrator_operator_functions ON app.trainer_athlete_relations
  FOR SELECT TO ai_strength_migrator USING (true);
CREATE POLICY audit_events_migrator_operator_functions ON app.audit_events
  FOR INSERT TO ai_strength_migrator WITH CHECK (true);

GRANT USAGE ON SCHEMA app, app_private TO ai_strength_migrator;
GRANT USAGE ON SCHEMA app_private TO ai_strength_operator;
GRANT SELECT, UPDATE (status) ON app.users TO ai_strength_migrator;
GRANT SELECT ON app.athlete_profiles, app.trainer_athlete_relations TO ai_strength_migrator;
GRANT SELECT, UPDATE (status) ON app.trainer_profiles TO ai_strength_migrator;
GRANT INSERT ON app.audit_events TO ai_strength_migrator;
GRANT SELECT, UPDATE (revoked_at) ON app_private.auth_identities TO ai_strength_migrator;

ALTER FUNCTION app_private.closed_alpha_identity_status(text) OWNER TO ai_strength_migrator;
ALTER FUNCTION app_private.closed_alpha_activate_trainer(text, text, text) OWNER TO ai_strength_migrator;
ALTER FUNCTION app_private.closed_alpha_cohort_status(text, text, text) OWNER TO ai_strength_migrator;

REVOKE ALL ON FUNCTION app_private.closed_alpha_identity_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.closed_alpha_activate_trainer(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.closed_alpha_cohort_status(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.closed_alpha_activate_trainer(text, text, text) TO ai_strength_operator;
GRANT EXECUTE ON FUNCTION app_private.closed_alpha_cohort_status(text, text, text) TO ai_strength_operator;

COMMENT ON FUNCTION app_private.closed_alpha_activate_trainer(text, text, text) IS
  'Activates only a verified pending trainer request and records pseudonymous operator provenance';
COMMENT ON FUNCTION app_private.closed_alpha_cohort_status(text, text, text) IS
  'Returns non-PII readiness flags for one trainer and exactly two invited athletes';
