import { spawnSync } from "node:child_process";
import path from "node:path";

import { Pool } from "pg";

const root = process.cwd();
const databaseName = `ai_strength_upgrade_${process.pid}`;

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`migration_upgrade_step_failed:${path.basename(command)}`);
  }
}

function databaseUrl(name) {
  const source = process.env[name]?.trim();
  if (!source) throw new Error(`${name.toLowerCase()}_required`);
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

const migrationUrl = databaseUrl("DATABASE_MIGRATION_URL");
const testEnv = {
  ...process.env,
  APP_ENV: "test",
  DATABASE_MIGRATION_URL: migrationUrl,
};

async function resetDatabase(create) {
  const adminUrl = new URL(process.env.DATABASE_MIGRATION_URL);
  adminUrl.pathname = "/postgres";
  const pool = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    await pool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await pool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    if (create) await pool.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await pool.end();
  }
}

async function simulateLegacyOwnership() {
  const pool = new Pool({ connectionString: migrationUrl, max: 1 });
  try {
    await pool.query("REASSIGN OWNED BY ai_strength_migrator TO ai_strength_local_owner");
    const result = await pool.query(`
      SELECT count(*)::integer AS legacy_objects
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname IN ('app', 'app_private')
        AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
        AND pg_get_userbyid(relation.relowner) = 'ai_strength_local_owner'
    `);
    if (!result.rows[0]?.legacy_objects) {
      throw new Error("legacy_ownership_simulation_failed");
    }
  } finally {
    await pool.end();
  }
}

async function verifyUpgrade() {
  const pool = new Pool({ connectionString: migrationUrl, max: 1 });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT max(name) FROM public.app_schema_migrations) AS latest_migration,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'app'
            AND table_name = 'athlete_profiles'
            AND column_name = 'goal_summary'
        ) AS has_profile_columns,
        (
          SELECT count(*)::integer
          FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname IN ('app', 'app_private')
            AND relation.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
            AND pg_get_userbyid(relation.relowner) <> 'ai_strength_migrator'
        ) AS noncanonical_relations
    `);
    const state = result.rows[0];
    if (
      state?.latest_migration !== "0012_athlete_profile_read_model"
      || !state?.has_profile_columns
      || state?.noncanonical_relations !== 0
    ) {
      throw new Error(`migration_upgrade_verification_failed:${JSON.stringify(state)}`);
    }
    process.stdout.write(`Verified 0011 -> 0012 upgrade: ${JSON.stringify(state)}\n`);
  } finally {
    await pool.end();
  }
}

let exitCode = 1;
try {
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
  await resetDatabase(true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], testEnv);
  run(
    process.execPath,
    ["scripts/db/migrate.mjs", "--through", "0011_closed_alpha_operator"],
    testEnv,
  );
  await simulateLegacyOwnership();
  run(process.execPath, ["scripts/database/normalize-local-ownership.mjs"], testEnv);
  run(process.execPath, ["scripts/db/migrate.mjs"], testEnv);
  await verifyUpgrade();
  exitCode = 0;
} finally {
  await resetDatabase(false).catch(() => undefined);
}

process.exitCode = exitCode;
