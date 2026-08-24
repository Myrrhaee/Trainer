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
