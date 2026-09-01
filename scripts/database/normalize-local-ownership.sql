-- Local recovery only. The runner supplies the target owner through a
-- transaction-local setting after validating the environment and role.

DO $guard$
DECLARE
  target_owner text := nullif(current_setting('ai_strength.ownership_target', true), '');
BEGIN
  IF current_database() !~ '(^|_)(local|dev|development|test|backend|upgrade)(_|$)' THEN
    RAISE EXCEPTION 'ownership normalization is restricted to local/test databases';
  END IF;

  IF target_owner IS NULL THEN
    RAISE EXCEPTION 'ownership target is required';
  END IF;

  IF NOT pg_has_role(current_user, target_owner, 'MEMBER') THEN
    RAISE EXCEPTION 'current role cannot set requested target owner';
  END IF;
END
$guard$;

DO $relations$
DECLARE
  target_owner text := current_setting('ai_strength.ownership_target');
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
      AND pg_get_userbyid(relation.relowner) <> target_owner
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
      '%s %I.%I OWNER TO %I',
      command,
      object_record.schema_name,
      object_record.object_name,
      target_owner
    );
  END LOOP;
END
$relations$;

DO $routines$
DECLARE
  target_owner text := current_setting('ai_strength.ownership_target');
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
      AND pg_get_userbyid(routine.proowner) <> target_owner
    ORDER BY namespace.nspname, routine.proname, identity_arguments
  LOOP
    command := CASE routine_record.prokind
      WHEN 'a' THEN 'ALTER AGGREGATE'
      WHEN 'p' THEN 'ALTER PROCEDURE'
      ELSE 'ALTER FUNCTION'
    END;

    EXECUTE format(
      '%s %I.%I(%s) OWNER TO %I',
      command,
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.identity_arguments,
      target_owner
    );
  END LOOP;
END
$routines$;

DO $types$
DECLARE
  target_owner text := current_setting('ai_strength.ownership_target');
  type_record record;
BEGIN
  FOR type_record IN
    SELECT namespace.nspname AS schema_name, type_definition.typname AS type_name
    FROM pg_type type_definition
    JOIN pg_namespace namespace ON namespace.oid = type_definition.typnamespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND type_definition.typtype IN ('d', 'e')
      AND pg_get_userbyid(type_definition.typowner) <> target_owner
    ORDER BY namespace.nspname, type_definition.typname
  LOOP
    EXECUTE format(
      'ALTER TYPE %I.%I OWNER TO %I',
      type_record.schema_name,
      type_record.type_name,
      target_owner
    );
  END LOOP;
END
$types$;

DO $schemas$
DECLARE
  target_owner text := current_setting('ai_strength.ownership_target');
  schema_record record;
BEGIN
  FOR schema_record IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname IN ('app', 'app_private')
      AND pg_get_userbyid(nspowner) <> target_owner
  LOOP
    EXECUTE format(
      'ALTER SCHEMA %I OWNER TO %I',
      schema_record.nspname,
      target_owner
    );
  END LOOP;
END
$schemas$;

DO $default_privileges$
DECLARE
  target_owner text := current_setting('ai_strength.ownership_target');
  schema_name text;
  object_kind text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['app', 'app_private']
  LOOP
    FOREACH object_kind IN ARRAY ARRAY['TABLES', 'SEQUENCES', 'FUNCTIONS', 'TYPES']
    LOOP
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON %s FROM PUBLIC',
        target_owner,
        schema_name,
        object_kind
      );
    END LOOP;
  END LOOP;
END
$default_privileges$;
