import { setTimeout as delay } from "node:timers/promises";

import { neon } from "@neondatabase/serverless";

import {
  checksum,
  listSqlFiles,
  migrationConnectionString,
  migrationsDirectory,
  readSql,
} from "./shared.mjs";
import { splitPostgresStatements } from "./sql-statements.mjs";

const maxAttempts = 6;
const requestTimeoutMs = 120_000;
const sql = neon(migrationConnectionString());

function requestOptions() {
  return { fetchOptions: { signal: AbortSignal.timeout(requestTimeoutMs) } };
}

async function withRetry(label, operation) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      process.stdout.write(`Retrying ${label} over Neon HTTPS (${attempt}/${maxAttempts})\n`);
      await delay(Math.min(attempt * 2_000, 10_000));
    }
  }
  throw new Error(`Unreachable retry state for ${label}`);
}

await withRetry("migration table setup", () => (
  sql.transaction((transaction) => [
    transaction.query("SET LOCAL ROLE ai_strength_migrator"),
    transaction.query(`
      CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `),
  ], requestOptions())
));

const files = await listSqlFiles(migrationsDirectory, ".up.sql");
for (const filename of files) {
  const name = filename.slice(0, -".up.sql".length);
  const migrationSql = await readSql(migrationsDirectory, filename);
  const expectedChecksum = checksum(migrationSql);
  const existing = await withRetry(`migration check ${name}`, () => (
    sql.query(
      "SELECT checksum FROM public.app_schema_migrations WHERE name = $1",
      [name],
      requestOptions(),
    )
  ));

  if (existing.length > 0) {
    if (existing[0].checksum !== expectedChecksum) {
      throw new Error(`Applied migration ${name} has changed`);
    }
    process.stdout.write(`Already applied ${name}\n`);
    continue;
  }

  const statements = splitPostgresStatements(migrationSql).filter((statement) => (
    !/^CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto$/i.test(statement)
  ));
  let recoveredCompletedMigration = false;
  await withRetry(`migration ${name}`, async () => {
    const retryCheck = await sql.query(
      "SELECT checksum FROM public.app_schema_migrations WHERE name = $1",
      [name],
      requestOptions(),
    );
    if (retryCheck.length > 0) {
      if (retryCheck[0].checksum !== expectedChecksum) {
        throw new Error(`Applied migration ${name} has changed`);
      }
      recoveredCompletedMigration = true;
      return;
    }

    await sql.transaction((transaction) => [
      transaction.query("SET LOCAL ROLE ai_strength_migrator"),
      transaction.query(
        "LOCK TABLE public.app_schema_migrations IN SHARE ROW EXCLUSIVE MODE",
      ),
      ...statements.map((statement) => transaction.query(statement)),
      transaction.query(
        "INSERT INTO public.app_schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, expectedChecksum],
      ),
    ], requestOptions());
  });
  process.stdout.write(
    `${recoveredCompletedMigration ? "Already applied after retry" : "Applied"} ${name}\n`,
  );
}
