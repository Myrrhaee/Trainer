import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const allowedEnvironments = new Set(["local", "development", "test"]);
const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();

if (!appEnvironment || !allowedEnvironments.has(appEnvironment)) {
  throw new Error("ownership_normalization_requires_local_or_test_app_env");
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
  SELECT
    (
      SELECT count(*)::integer
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE (
        namespace.nspname IN ('app', 'app_private')
        OR relation.oid = to_regclass('public.app_schema_migrations')
      )
        AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
        AND pg_get_userbyid(relation.relowner) <> 'ai_strength_migrator'
    ) AS relations,
    (
      SELECT count(*)::integer
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      WHERE namespace.nspname IN ('app', 'app_private')
        AND pg_get_userbyid(routine.proowner) <> 'ai_strength_migrator'
    ) AS routines,
    (
      SELECT count(*)::integer
      FROM pg_type type_definition
      JOIN pg_namespace namespace ON namespace.oid = type_definition.typnamespace
      WHERE namespace.nspname IN ('app', 'app_private')
        AND type_definition.typtype IN ('d', 'e')
        AND pg_get_userbyid(type_definition.typowner) <> 'ai_strength_migrator'
    ) AS types,
    (
      SELECT count(*)::integer
      FROM pg_namespace
      WHERE nspname IN ('app', 'app_private')
        AND pg_get_userbyid(nspowner) <> 'ai_strength_migrator'
    ) AS schemas
`;

const recoverySql = await readFile(
  path.join(process.cwd(), "scripts/database/normalize-local-ownership.sql"),
  "utf8",
);

await client.connect();
try {
  const identity = await client.query(
    "SELECT current_database() AS database_name, current_user AS connected_as",
  );
  const databaseName = String(identity.rows[0]?.database_name ?? "");
  if (!/(^|_)(local|dev|development|test|backend|upgrade)(_|$)/.test(databaseName)) {
    throw new Error("ownership_normalization_refused_for_non_local_database");
  }

  const before = await client.query(ownershipQuery);
  await client.query("BEGIN");
  try {
    await client.query(recoverySql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  const after = await client.query(ownershipQuery);

  process.stdout.write(`${JSON.stringify({
    database: databaseName,
    connectedAs: identity.rows[0]?.connected_as,
    before: before.rows[0],
    after: after.rows[0],
  }, null, 2)}\n`);
} finally {
  await client.end();
}
