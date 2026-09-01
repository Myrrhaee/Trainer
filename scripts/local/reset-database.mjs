import { spawnSync } from "node:child_process";
import path from "node:path";

import { Pool } from "pg";

const root = process.cwd();
const allowedEnvironments = new Set(["local", "development"]);
const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();

if (!allowedEnvironments.has(appEnvironment)) {
  throw new Error("local_database_reset_requires_local_or_development_app_env");
}
if (!process.argv.includes("--confirm-reset")) {
  throw new Error("local_database_reset_requires_--confirm-reset");
}

const connectionString = process.env.DATABASE_MIGRATION_URL?.trim();
if (!connectionString) throw new Error("database_migration_url_required");
const databaseUrl = new URL(connectionString);
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
if (!databaseName || !/(^|_)(local|dev|development)(_|$)/.test(databaseName)) {
  throw new Error("local_database_reset_refused_for_database_name");
}
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(databaseUrl.hostname)) {
  throw new Error("local_database_reset_refused_for_non_local_host");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`local_database_reset_step_failed:${path.basename(command)}`);
  }
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

run("docker", [
  "compose",
  "--env-file",
  ".env.development.local",
  "-f",
  "compose.local.yml",
  "up",
  "-d",
  "--wait",
]);

const adminUrl = new URL(connectionString);
adminUrl.pathname = "/postgres";
const pool = new Pool({ connectionString: adminUrl.toString(), max: 1 });
try {
  process.stdout.write(`Resetting local database ${databaseName}; all rows will be deleted.\n`);
  await pool.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName],
  );
  await pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
  await pool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
} finally {
  await pool.end();
}

run(process.execPath, ["scripts/db/bootstrap.mjs"]);
run(process.execPath, ["scripts/db/migrate.mjs"]);
process.stdout.write(`Local database ${databaseName}: RESET AND MIGRATED\n`);
