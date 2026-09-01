import { setTimeout as delay } from "node:timers/promises";

import {
  checksum,
  ensureMigrationTable,
  listSqlFiles,
  migrationsDirectory,
  readSql,
  withMigrationClient,
} from "./shared.mjs";
import { splitPostgresStatements } from "./sql-statements.mjs";

const maxAttempts = 3;
const statementsPerBatch = 8;
const expectedMigrationOwner = "ai_strength_migrator";
const transientCodes = new Set([
  "57P01",
  "08001",
  "08003",
  "08006",
  "ECONNRESET",
  "ETIMEDOUT",
]);

function isTransient(error) {
  return error instanceof Error
    && "code" in error
    && transientCodes.has(String(error.code));
}

async function withRetry(label, operation) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransient(error) || attempt === maxAttempts) throw error;
      process.stdout.write(`Retrying ${label} after transient database error (${attempt}/${maxAttempts})\n`);
      // Managed PostgreSQL can retain a severed transaction until its
      // idle-in-transaction timeout releases transaction-scoped locks.
      await delay(attempt * 6_000);
    }
  }
  throw new Error(`Unreachable retry state for ${label}`);
}

async function inLockedTransaction(
  callback,
  { setMigratorRole = true, useSerializationLock = true } = {},
) {
  return withMigrationClient(async (client) => {
    await client.query("BEGIN");
    try {
      if (setMigratorRole) {
        await client.query("SET LOCAL ROLE ai_strength_migrator");
      }
      if (useSerializationLock) {
        await client.query(
          "LOCK TABLE public.app_schema_migrations IN SHARE ROW EXCLUSIVE MODE",
        );
      }
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  });
}

async function assertMigrationOwnership() {
  const drift = await withMigrationClient(async (client) => client.query(`
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
    ORDER BY
      CASE object_kind
        WHEN 'table' THEN 0
        WHEN 'sequence' THEN 1
        WHEN 'schema' THEN 2
        WHEN 'function' THEN 3
        WHEN 'procedure' THEN 4
        ELSE 5
      END,
      object_identity
  `, [expectedMigrationOwner]));

  if (!drift.rowCount) return;

  const details = drift.rows
    .slice(0, 30)
    .map((row) => `- ${row.object_kind} ${row.object_identity}: ${row.current_owner}`)
    .join("\n");
  const omitted = drift.rowCount > 30 ? `\n- ... ${drift.rowCount - 30} more object(s)` : "";
  throw new Error([
    `Migration ownership preflight failed: ${drift.rowCount} object(s) are not owned by ${expectedMigrationOwner}.`,
    details + omitted,
    "Local clean reset: node --env-file=.env.development.local scripts/local/reset-database.mjs --confirm-reset",
    `Local preserve-data inspection: node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs --dry-run --target-owner ${expectedMigrationOwner}`,
    `Local preserve-data recovery: node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs --apply --target-owner ${expectedMigrationOwner}`,
  ].join("\n"));
}

await assertMigrationOwnership();

await withRetry("migration table setup", () => (
  inLockedTransaction(async (client) => {
    await ensureMigrationTable(client);
  }, { setMigratorRole: false, useSerializationLock: false })
));

const allFiles = await listSqlFiles(migrationsDirectory, ".up.sql");
const throughIndex = process.argv.indexOf("--through");
const throughMigration = throughIndex >= 0 ? process.argv[throughIndex + 1] : null;

if (throughIndex >= 0 && !throughMigration) {
  throw new Error("--through requires a migration name");
}

const targetFilename = throughMigration ? `${throughMigration}.up.sql` : null;
const targetIndex = targetFilename ? allFiles.indexOf(targetFilename) : -1;

if (targetFilename && targetIndex < 0) {
  throw new Error(`Unknown migration target ${throughMigration}`);
}

const files = targetIndex >= 0 ? allFiles.slice(0, targetIndex + 1) : allFiles;

for (const filename of files) {
  const name = filename.slice(0, -".up.sql".length);
  const sql = await readSql(migrationsDirectory, filename);
  const statements = splitPostgresStatements(sql);
  const executableStatements = statements.filter((statement) => (
    !/^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto$/i.test(statement)
  ));
  const batches = [];
  for (let index = 0; index < executableStatements.length; index += statementsPerBatch) {
    batches.push(executableStatements.slice(index, index + statementsPerBatch));
  }
  const expectedChecksum = checksum(sql);
  const status = await withRetry(`migration ${name}`, () => (
    inLockedTransaction(async (client) => {
      const existing = await client.query(
        "SELECT checksum FROM public.app_schema_migrations WHERE name = $1",
        [name],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== expectedChecksum) {
          throw new Error(`Applied migration ${name} has changed`);
        }
        return "existing";
      }

      for (const [index, batch] of batches.entries()) {
        try {
          await client.query(batch.join(";\n"));
        } catch (error) {
          const code = error instanceof Error && "code" in error
            ? String(error.code)
            : "unknown";
          process.stderr.write(
            `Migration ${name} batch ${index + 1}/${batches.length} failed (${code})\n`,
          );
          throw error;
        }
      }
      await client.query(
        "INSERT INTO public.app_schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, expectedChecksum],
      );
      return "applied";
    })
  ));
  process.stdout.write(`${status === "existing" ? "Already applied" : "Applied migration"} ${name}\n`);
}
