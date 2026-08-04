import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  client.on("error", () => undefined);

  await client.connect();
  try {
    return await callback(client);
  } finally {
    const gracefulClose = client.end().catch(() => undefined);
    await Promise.race([gracefulClose, delay(1_000)]);
    if (!client.connection.stream.destroyed) {
      client.connection.stream.destroy();
    }
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
  const owner = await client.query(`
    SELECT pg_get_userbyid(relowner) AS owner
    FROM pg_class
    WHERE oid = 'public.app_schema_migrations'::regclass
  `);
  if (owner.rows[0]?.owner !== "ai_strength_migrator") {
    await client.query("ALTER TABLE public.app_schema_migrations OWNER TO ai_strength_migrator");
  }
}
