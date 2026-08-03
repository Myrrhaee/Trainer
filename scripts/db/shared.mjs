import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptDirectory, "../..");
export const migrationsDirectory = path.join(projectRoot, "database/migrations");
export const bootstrapDirectory = path.join(projectRoot, "database/bootstrap");

export function migrationConnectionString() {
  const value = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required");
  }
  return value;
}

export function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export async function listSqlFiles(directory, suffix = ".sql") {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function readSql(directory, filename) {
  return readFile(path.join(directory, filename), "utf8");
}

export async function withMigrationClient(callback) {
  const client = new Client({
    connectionString: migrationConnectionString(),
    application_name: "ai-strength-migrations",
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )
  `);
}
