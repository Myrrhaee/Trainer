CREATE TYPE app.trainer_capability_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'archived'
);

CREATE TYPE app.athlete_capability_status AS ENUM (
  'active',
  'suspended',
  'archived'
);

CREATE TYPE app.trainer_athlete_relation_status AS ENUM (
  'active',
  'suspended',
  'ended'
);

CREATE TABLE app.trainer_profiles (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
  status app.trainer_capability_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT trainer_profile_lifecycle_consistent CHECK (
    (status <> 'active' OR activated_at IS NOT NULL)
    AND (status <> 'suspended' OR suspended_at IS NOT NULL)
    AND (status <> 'archived' OR archived_at IS NOT NULL)
  )
);

CREATE TABLE app.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
  status app.athlete_capability_status NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  suspended_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT athlete_profile_lifecycle_consistent CHECK (
    (status <> 'suspended' OR suspended_at IS NOT NULL)
    AND (status <> 'archived' OR archived_at IS NOT NULL)
  )
);

CREATE TABLE app.trainer_athlete_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  athlete_user_id uuid NOT NULL REFERENCES app.athlete_profiles(user_id) ON DELETE RESTRICT,
  status app.trainer_athlete_relation_status NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  suspended_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT trainer_cannot_coach_self CHECK (trainer_user_id <> athlete_user_id),
  CONSTRAINT relation_lifecycle_consistent CHECK (
    (status <> 'suspended' OR suspended_at IS NOT NULL)
    AND (status <> 'ended' OR ended_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX trainer_athlete_open_pair_unique
  ON app.trainer_athlete_relations (trainer_user_id, athlete_user_id)
  WHERE status IN ('active', 'suspended');

CREATE UNIQUE INDEX athlete_active_primary_trainer_unique
  ON app.trainer_athlete_relations (athlete_user_id)
  WHERE status = 'active' AND is_primary;

CREATE INDEX trainer_relations_active_idx
  ON app.trainer_athlete_relations (trainer_user_id, status, created_at DESC);

CREATE INDEX athlete_relations_idx
  ON app.trainer_athlete_relations (athlete_user_id, created_at DESC);

CREATE TABLE app.athlete_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_user_id uuid NOT NULL REFERENCES app.trainer_profiles(user_id) ON DELETE RESTRICT,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_by_user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
  relation_id uuid REFERENCES app.trainer_athlete_relations(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT athlete_invitation_token_hash_length CHECK (octet_length(token_hash) = 32),
  CONSTRAINT athlete_invitation_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT athlete_invitation_acceptance_complete CHECK (
    (accepted_at IS NULL AND accepted_by_user_id IS NULL AND relation_id IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL AND relation_id IS NOT NULL)
  ),
  CONSTRAINT athlete_invitation_not_accepted_and_revoked CHECK (
    accepted_at IS NULL OR revoked_at IS NULL
  )
);

CREATE INDEX athlete_invitations_trainer_created_idx
  ON app.athlete_invitations (trainer_user_id, created_at DESC);

CREATE INDEX athlete_invitations_expiry_idx
  ON app.athlete_invitations (expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE FUNCTION app.current_invitation_token_hash()
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT CASE
    WHEN current_setting('app.invitation_token_hash', true) ~ '^[0-9a-f]{64}$'
      THEN decode(current_setting('app.invitation_token_hash', true), 'hex')
    ELSE NULL
  END
$function$;

CREATE FUNCTION app.enforce_relation_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.trainer_user_id <> OLD.trainer_user_id
     OR NEW.athlete_user_id <> OLD.athlete_user_id
     OR NEW.is_primary <> OLD.is_primary
     OR NEW.accepted_at <> OLD.accepted_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'relation identity and provenance are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'active' AND NEW.status IN ('suspended', 'ended'))
    OR (OLD.status = 'suspended' AND NEW.status IN ('active', 'ended'))
  ) THEN
    RAISE EXCEPTION 'invalid relation status transition from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.suspended_at := CASE WHEN NEW.status = 'suspended' THEN clock_timestamp() ELSE NEW.suspended_at END;
  NEW.ended_at := CASE WHEN NEW.status = 'ended' THEN clock_timestamp() ELSE NEW.ended_at END;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_trainer_capability_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.requested_at <> OLD.requested_at THEN
    RAISE EXCEPTION 'trainer capability identity and request time are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('active', 'suspended', 'archived'))
    OR (OLD.status = 'active' AND NEW.status IN ('suspended', 'archived'))
    OR (OLD.status = 'suspended' AND NEW.status IN ('active', 'archived'))
  ) THEN
    RAISE EXCEPTION 'invalid trainer capability transition from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.activated_at := CASE WHEN NEW.status = 'active' THEN coalesce(NEW.activated_at, clock_timestamp()) ELSE NEW.activated_at END;
  NEW.suspended_at := CASE WHEN NEW.status = 'suspended' THEN clock_timestamp() ELSE NEW.suspended_at END;
  NEW.archived_at := CASE WHEN NEW.status = 'archived' THEN clock_timestamp() ELSE NEW.archived_at END;
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_athlete_capability_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.activated_at <> OLD.activated_at THEN
    RAISE EXCEPTION 'athlete capability identity and activation time are immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'active' AND NEW.status IN ('suspended', 'archived'))
    OR (OLD.status = 'suspended' AND NEW.status IN ('active', 'archived'))
  ) THEN
    RAISE EXCEPTION 'invalid athlete capability transition from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.suspended_at := CASE WHEN NEW.status = 'suspended' THEN clock_timestamp() ELSE NEW.suspended_at END;
  NEW.archived_at := CASE WHEN NEW.status = 'archived' THEN clock_timestamp() ELSE NEW.archived_at END;
  RETURN NEW;
END
$function$;

CREATE FUNCTION app.enforce_invitation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  actor_id uuid := app.current_actor_user_id();
  token_hash bytea := app.current_invitation_token_hash();
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.trainer_user_id <> OLD.trainer_user_id
     OR NEW.token_hash <> OLD.token_hash
     OR NEW.expires_at <> OLD.expires_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'invitation identity and provenance are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF actor_id = OLD.trainer_user_id THEN
    IF NEW.accepted_by_user_id IS DISTINCT FROM OLD.accepted_by_user_id
       OR NEW.relation_id IS DISTINCT FROM OLD.relation_id
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR OLD.accepted_at IS NOT NULL
       OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'trainer may only revoke an unused invitation'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF actor_id IS NULL
     OR token_hash IS NULL
     OR token_hash <> OLD.token_hash
     OR OLD.accepted_at IS NOT NULL
     OR OLD.revoked_at IS NOT NULL
     OR OLD.expires_at <= clock_timestamp()
     OR NEW.accepted_by_user_id <> actor_id
     OR NEW.accepted_at IS NULL
     OR NEW.relation_id IS NULL
     OR NEW.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid invitation acceptance'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER trainer_profiles_touch_updated_at
  BEFORE UPDATE ON app.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trainer_profiles_enforce_transition
  BEFORE UPDATE ON app.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION app.enforce_trainer_capability_transition();

CREATE TRIGGER athlete_profiles_touch_updated_at
  BEFORE UPDATE ON app.athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER athlete_profiles_enforce_transition
  BEFORE UPDATE ON app.athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION app.enforce_athlete_capability_transition();

CREATE TRIGGER relations_enforce_transition
  BEFORE UPDATE ON app.trainer_athlete_relations
  FOR EACH ROW EXECUTE FUNCTION app.enforce_relation_transition();

CREATE TRIGGER invitations_enforce_update
  BEFORE UPDATE ON app.athlete_invitations
  FOR EACH ROW EXECUTE FUNCTION app.enforce_invitation_update();

ALTER TABLE app.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trainer_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.athlete_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trainer_athlete_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trainer_athlete_relations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.athlete_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.athlete_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY trainer_profiles_select_self ON app.trainer_profiles
  FOR SELECT TO ai_strength_app
  USING (user_id = app.current_actor_user_id());

CREATE POLICY trainer_profiles_request_self ON app.trainer_profiles
  FOR INSERT TO ai_strength_app
  WITH CHECK (user_id = app.current_actor_user_id() AND status = 'pending');

CREATE POLICY athlete_profiles_select_self ON app.athlete_profiles
  FOR SELECT TO ai_strength_app
  USING (user_id = app.current_actor_user_id());

CREATE POLICY athlete_profiles_accept_invitation ON app.athlete_profiles
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    user_id = app.current_actor_user_id()
    AND status = 'active'
    AND EXISTS (
      SELECT 1
      FROM app.athlete_invitations invitation
      WHERE invitation.token_hash = app.current_invitation_token_hash()
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at > clock_timestamp()
    )
  );

CREATE POLICY relations_select_athlete ON app.trainer_athlete_relations
  FOR SELECT TO ai_strength_app
  USING (athlete_user_id = app.current_actor_user_id());

CREATE POLICY relations_select_trainer_history ON app.trainer_athlete_relations
  FOR SELECT TO ai_strength_app
  USING (trainer_user_id = app.current_actor_user_id());

CREATE POLICY relations_accept_invitation ON app.trainer_athlete_relations
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    athlete_user_id = app.current_actor_user_id()
    AND status = 'active'
    AND is_primary
    AND EXISTS (
      SELECT 1
      FROM app.athlete_invitations invitation
      WHERE invitation.token_hash = app.current_invitation_token_hash()
        AND invitation.trainer_user_id = trainer_user_id
        AND invitation.accepted_at IS NULL
        AND invitation.revoked_at IS NULL
        AND invitation.expires_at > clock_timestamp()
    )
  );

CREATE POLICY relations_manage_trainer ON app.trainer_athlete_relations
  FOR UPDATE TO ai_strength_app
  USING (
    trainer_user_id = app.current_actor_user_id()
    AND status IN ('active', 'suspended')
  )
  WITH CHECK (trainer_user_id = app.current_actor_user_id());

CREATE POLICY invitations_select_trainer_or_token ON app.athlete_invitations
  FOR SELECT TO ai_strength_app
  USING (
    trainer_user_id = app.current_actor_user_id()
    OR (
      token_hash = app.current_invitation_token_hash()
      AND (
        (accepted_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp())
        OR accepted_by_user_id = app.current_actor_user_id()
      )
    )
  );

CREATE POLICY invitations_create_active_trainer ON app.athlete_invitations
  FOR INSERT TO ai_strength_app
  WITH CHECK (
    trainer_user_id = app.current_actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app.trainer_profiles trainer
      WHERE trainer.user_id = app.current_actor_user_id()
        AND trainer.status = 'active'
    )
  );

CREATE POLICY invitations_update_participant ON app.athlete_invitations
  FOR UPDATE TO ai_strength_app
  USING (
    trainer_user_id = app.current_actor_user_id()
    OR token_hash = app.current_invitation_token_hash()
  )
  WITH CHECK (
    trainer_user_id = app.current_actor_user_id()
    OR accepted_by_user_id = app.current_actor_user_id()
  );

GRANT SELECT, INSERT ON app.trainer_profiles TO ai_strength_app;
GRANT SELECT, INSERT ON app.athlete_profiles TO ai_strength_app;
GRANT SELECT, INSERT, UPDATE (status) ON app.trainer_athlete_relations TO ai_strength_app;
GRANT SELECT, INSERT, UPDATE (accepted_by_user_id, relation_id, accepted_at, revoked_at)
  ON app.athlete_invitations TO ai_strength_app;

GRANT SELECT, INSERT, UPDATE ON app.trainer_profiles, app.athlete_profiles,
  app.trainer_athlete_relations, app.athlete_invitations TO ai_strength_authenticator;

GRANT SELECT ON app.trainer_profiles, app.athlete_profiles,
  app.trainer_athlete_relations, app.athlete_invitations TO ai_strength_worker;

REVOKE ALL ON FUNCTION app.current_invitation_token_hash() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_relation_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_trainer_capability_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_athlete_capability_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.enforce_invitation_update() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.current_invitation_token_hash() TO ai_strength_app;

COMMENT ON TABLE app.trainer_profiles IS 'Optional trainer capability; closed-alpha activation is explicit and never implied by authentication';
COMMENT ON TABLE app.athlete_profiles IS 'Optional athlete capability created by an accepted trainer invitation in MVP';
COMMENT ON TABLE app.trainer_athlete_relations IS 'Canonical coaching relationship and authorization boundary';
COMMENT ON COLUMN app.athlete_invitations.token_hash IS 'SHA-256 hash of an opaque single-use invitation token; raw tokens are never persisted';
