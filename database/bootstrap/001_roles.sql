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
END
$roles$;

ALTER ROLE ai_strength_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_strength_authenticator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_strength_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_strength_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_strength_health NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

COMMENT ON ROLE ai_strength_migrator IS 'Schema migration privileges; never used by product requests';
COMMENT ON ROLE ai_strength_authenticator IS 'Narrow identity and session persistence privileges';
COMMENT ON ROLE ai_strength_app IS 'Ordinary actor-scoped product transactions';
COMMENT ON ROLE ai_strength_worker IS 'Background and maintenance jobs with explicit grants';
COMMENT ON ROLE ai_strength_health IS 'Readiness only; migration metadata and connection liveness';
