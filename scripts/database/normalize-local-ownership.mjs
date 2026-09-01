import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const allowedEnvironments = new Set(["local", "development", "test"]);
const databaseNamePattern = /(^|_)(local|dev|development|test|backend|upgrade)(_|$)/;
const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();

if (!appEnvironment || !allowedEnvironments.has(appEnvironment)) {
  throw new Error("ownership_normalization_requires_local_or_test_app_env");
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run");
if (apply === dryRun) {
  throw new Error("choose_exactly_one_of_--dry-run_or_--apply");
}

const targetOwnerIndex = args.indexOf("--target-owner");
const targetOwner = (
  targetOwnerIndex >= 0 ? args[targetOwnerIndex + 1] : process.env.DATABASE_MIGRATION_OWNER
)?.trim();
if (!targetOwner) {
  throw new Error("target_owner_required_via_--target-owner_or_DATABASE_MIGRATION_OWNER");
}

const connectionString = process.env.DATABASE_MIGRATION_URL?.trim();
if (!connectionString) {
  throw new Error("database_migration_url_required");
}

const client = new Client({
  connectionString,
  application_name: "ai-strength-local-ownership-recovery",
});

const ownershipQuery = `
  SELECT object_kind, object_identity, current_owner
  FROM (
    SELECT
      'schema'::text AS object_kind,
      quote_ident(namespace.nspname) AS object_identity,
      pg_get_userbyid(namespace.nspowner) AS current_owner
    FROM pg_namespace namespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND pg_get_userbyid(namespace.nspowner) <> $1

    UNION ALL

    SELECT
      CASE relation.relkind
        WHEN 'S' THEN 'sequence'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized_view'
        WHEN 'f' THEN 'foreign_table'
        ELSE 'table'
      END,
      format('%I.%I', namespace.nspname, relation.relname),
      pg_get_userbyid(relation.relowner)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE (
      namespace.nspname IN ('app', 'app_private')
      OR relation.oid = to_regclass('public.app_schema_migrations')
    )
      AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
      AND pg_get_userbyid(relation.relowner) <> $1

    UNION ALL

    SELECT
      CASE routine.prokind WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' ELSE 'function' END,
      format('%I.%I(%s)', namespace.nspname, routine.proname, pg_get_function_identity_arguments(routine.oid)),
      pg_get_userbyid(routine.proowner)
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND pg_get_userbyid(routine.proowner) <> $1

    UNION ALL

    SELECT
      CASE type_definition.typtype WHEN 'd' THEN 'domain' ELSE 'enum' END,
      format('%I.%I', namespace.nspname, type_definition.typname),
      pg_get_userbyid(type_definition.typowner)
    FROM pg_type type_definition
    JOIN pg_namespace namespace ON namespace.oid = type_definition.typnamespace
    WHERE namespace.nspname IN ('app', 'app_private')
      AND type_definition.typtype IN ('d', 'e')
      AND pg_get_userbyid(type_definition.typowner) <> $1
  ) ownership_drift
  ORDER BY object_kind, object_identity
`;

const recoverySql = await readFile(
  path.join(process.cwd(), "scripts/database/normalize-local-ownership.sql"),
  "utf8",
);

await client.connect();
try {
  const identity = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS connected_as,
      pg_get_userbyid(database_definition.datdba) AS database_owner
    FROM pg_database database_definition
    WHERE database_definition.datname = current_database()
  `);
  const databaseName = String(identity.rows[0]?.database_name ?? "");
  if (!databaseNamePattern.test(databaseName)) {
    throw new Error("ownership_normalization_refused_for_non_local_database");
  }

  const role = await client.query(`
    SELECT
      rolsuper,
      rolreplication,
      rolbypassrls,
      pg_has_role(current_user, oid, 'MEMBER') AS current_user_is_member
    FROM pg_roles
    WHERE rolname = $1
  `, [targetOwner]);
  if (!role.rowCount) throw new Error("ownership_target_role_does_not_exist");
  if (!role.rows[0].current_user_is_member) {
    throw new Error("current_role_cannot_set_requested_target_owner");
  }
  if (role.rows[0].rolsuper || role.rows[0].rolreplication || role.rows[0].rolbypassrls) {
    throw new Error("ownership_target_role_has_unsafe_privileges");
  }

  const before = await client.query(ownershipQuery, [targetOwner]);
  const report = {
    mode: apply ? "apply" : "dry-run",
    database: databaseName,
    databaseOwner: identity.rows[0]?.database_owner,
    connectedAs: identity.rows[0]?.connected_as,
    targetOwner,
    driftCount: before.rowCount,
    objects: before.rows,
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    await client.query("BEGIN");
    try {
      await client.query(
        "SELECT set_config('ai_strength.ownership_target', $1, true)",
        [targetOwner],
      );
      await client.query(recoverySql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    const after = await client.query(ownershipQuery, [targetOwner]);
    process.stdout.write(`${JSON.stringify({
      ...report,
      remainingDriftCount: after.rowCount,
      remainingObjects: after.rows,
    }, null, 2)}\n`);
  }
} finally {
  await client.end();
}
