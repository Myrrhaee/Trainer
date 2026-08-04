CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_migrator') THEN
    CREATE ROLE ai_strength_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_authenticator') THEN
    CREATE ROLE ai_strength_authenticator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_app') THEN
    CREATE ROLE ai_strength_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_worker') THEN
    CREATE ROLE ai_strength_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_health') THEN
    CREATE ROLE ai_strength_health NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_strength_operator') THEN
    CREATE ROLE ai_strength_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$roles$;

DO $role_safety$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname IN (
      'ai_strength_migrator',
      'ai_strength_authenticator',
      'ai_strength_app',
      'ai_strength_worker',
      'ai_strength_health',
      'ai_strength_operator'
    )
      AND (rolsuper OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'AI Strength group roles must not be superuser, replication, or bypass-RLS roles';
  END IF;
END
$role_safety$;

-- Managed PostgreSQL CREATEROLE owners cannot alter superuser-only flags,
-- even when setting them to false. The safety block above verifies those flags.
ALTER ROLE ai_strength_migrator NOLOGIN NOCREATEDB NOCREATEROLE;
ALTER ROLE ai_strength_authenticator NOLOGIN NOCREATEDB NOCREATEROLE;
ALTER ROLE ai_strength_app NOLOGIN NOCREATEDB NOCREATEROLE;
ALTER ROLE ai_strength_worker NOLOGIN NOCREATEDB NOCREATEROLE;
ALTER ROLE ai_strength_health NOLOGIN NOCREATEDB NOCREATEROLE;
ALTER ROLE ai_strength_operator NOLOGIN NOCREATEDB NOCREATEROLE;

GRANT USAGE, CREATE ON SCHEMA public TO ai_strength_migrator;

DO $database_grants$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO ai_strength_migrator, ai_strength_authenticator, ai_strength_app, ai_strength_worker, ai_strength_health, ai_strength_operator',
    current_database()
  );
  EXECUTE format(
    'GRANT CREATE ON DATABASE %I TO ai_strength_migrator',
    current_database()
  );
END
$database_grants$;

COMMENT ON ROLE ai_strength_migrator IS 'Schema migration privileges; never used by product requests';
COMMENT ON ROLE ai_strength_authenticator IS 'Narrow identity and session persistence privileges';
COMMENT ON ROLE ai_strength_app IS 'Ordinary actor-scoped product transactions';
COMMENT ON ROLE ai_strength_worker IS 'Background and maintenance jobs with explicit grants';
COMMENT ON ROLE ai_strength_health IS 'Readiness only; migration metadata and connection liveness';
COMMENT ON ROLE ai_strength_operator IS 'Closed-alpha activation through narrow audited functions only';
