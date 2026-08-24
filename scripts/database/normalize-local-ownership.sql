-- Local recovery only. This is not a product migration and must never run in
-- staging or production. It changes ownership and default privileges only.

DO $guard$
BEGIN
  IF current_database() !~ '(^|_)(local|dev|development|test|backend|upgrade)(_|$)' THEN
    RAISE EXCEPTION 'ownership normalization is restricted to local/test databases';
  END IF;

  IF NOT pg_has_role(current_user, 'ai_strength_migrator', 'MEMBER') THEN
    RAISE EXCEPTION 'current role must be able to SET ROLE ai_strength_migrator';
  END IF;
END
$guard$;

DO $relations$
DECLARE
  object_record record;
  command text;
BEGIN
  FOR object_record IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS object_name,
      relation.relkind
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE (
      namespace.nspname IN ('app', 'app_private')
      OR relation.oid = to_regclass('public.app_schema_migrations')
    )
      AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
      AND pg_get_userbyid(relation.relowner) <> 'ai_strength_migrator'
    ORDER BY namespace.nspname, relation.relkind, relation.relname
  LOOP
    command := CASE object_record.relkind
      WHEN 'S' THEN 'ALTER SEQUENCE'
      WHEN 'v' THEN 'ALTER VIEW'
      WHEN 'm' THEN 'ALTER MATERIALIZED VIEW'
      WHEN 'f' THEN 'ALTER FOREIGN TABLE'
      ELSE 'ALTER TABLE'
    END;

    EXECUTE format(
      '%s %I.%I OWNER TO ai_strength_migrator',
      command,
      object_record.schema_name,
      object_record.object_name
    );
  END LOOP;
END
$relations$;

DO $routines$
DECLARE
  routine_record record;
  command text;
BEGIN
  FOR routine_record IN
    SELECT
      namespace.nspname AS schema_name,
      routine.proname AS routine_name,
      routine.prokind,
      pg_get_function_identity_arguments(routine.oid) AS identity_arguments
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND pg_get_userbyid(routine.proowner) <> 'ai_strength_migrator'
    ORDER BY namespace.nspname, routine.proname, identity_arguments
  LOOP
    command := CASE routine_record.prokind
      WHEN 'a' THEN 'ALTER AGGREGATE'
      WHEN 'p' THEN 'ALTER PROCEDURE'
      ELSE 'ALTER FUNCTION'
    END;

    EXECUTE format(
      '%s %I.%I(%s) OWNER TO ai_strength_migrator',
      command,
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.identity_arguments
    );
  END LOOP;
END
$routines$;

DO $types$
DECLARE
  type_record record;
BEGIN
  FOR type_record IN
    SELECT namespace.nspname AS schema_name, type_definition.typname AS type_name
    FROM pg_type type_definition
    JOIN pg_namespace namespace ON namespace.oid = type_definition.typnamespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND type_definition.typtype IN ('d', 'e')
      AND pg_get_userbyid(type_definition.typowner) <> 'ai_strength_migrator'
    ORDER BY namespace.nspname, type_definition.typname
  LOOP
    EXECUTE format(
      'ALTER TYPE %I.%I OWNER TO ai_strength_migrator',
      type_record.schema_name,
      type_record.type_name
    );
  END LOOP;
END
$types$;

DO $schemas$
DECLARE
  schema_record record;
BEGIN
  FOR schema_record IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname IN ('app', 'app_private')
      AND pg_get_userbyid(nspowner) <> 'ai_strength_migrator'
  LOOP
    EXECUTE format(
      'ALTER SCHEMA %I OWNER TO ai_strength_migrator',
      schema_record.nspname
    );
  END LOOP;
END
$schemas$;

ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app
  REVOKE ALL ON TYPES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app_private
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app_private
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app_private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ai_strength_migrator IN SCHEMA app_private
  REVOKE ALL ON TYPES FROM PUBLIC;
