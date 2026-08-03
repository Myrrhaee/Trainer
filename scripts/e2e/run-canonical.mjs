import { spawnSync } from "node:child_process";

import { Pool } from "pg";

const root = process.cwd();
const databaseName = `ai_strength_e2e_${process.pid}`;

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`canonical_e2e_step_failed:${command}`);
}

function databaseUrl(name) {
  const source = process.env[name]?.trim();
  if (!source) throw new Error(`${name.toLowerCase()}_required`);
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

const migrationUrl = databaseUrl("DATABASE_MIGRATION_URL");
const runtimeEnv = {
  ...process.env,
  APP_ENV: "test",
  AUTH_PUBLIC_ORIGIN: "http://127.0.0.1:3101",
  NEXT_PUBLIC_DEMO_MODE: "false",
  AUTH_EMAIL_DELIVERY_MODE: "memory",
  AUTH_DEV_OTP_DISCLOSURE: "true",
  NOTIFICATION_DELIVERY_MODE: "memory",
  GOOGLE_CLIENT_ID: "",
  TELEGRAM_CLIENT_ID: "",
  TELEGRAM_CLIENT_SECRET: "",
  TELEGRAM_BOT_TOKEN: "",
  DATABASE_MIGRATION_URL: migrationUrl,
  DATABASE_APP_URL: databaseUrl("DATABASE_APP_URL"),
  DATABASE_AUTH_URL: databaseUrl("DATABASE_AUTH_URL"),
  DATABASE_HEALTH_URL: databaseUrl("DATABASE_HEALTH_URL"),
  DATABASE_WORKER_URL: databaseUrl("DATABASE_WORKER_URL"),
};

async function resetDatabase(create) {
  const adminUrl = new URL(process.env.DATABASE_MIGRATION_URL);
  adminUrl.pathname = "/postgres";
  const pool = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
    await pool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    if (create) await pool.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await pool.end();
  }
}

let exitCode = 1;
try {
  run("docker", ["compose", "--env-file", ".env.development.local", "-f", "compose.local.yml", "up", "-d", "--wait"]);
  await resetDatabase(true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], runtimeEnv);
  run(process.execPath, ["scripts/db/migrate.mjs"], runtimeEnv);
  const result = spawnSync("npx", ["playwright", "test", "--config=playwright.canonical.config.ts", ...process.argv.slice(2)], {
    cwd: root,
    env: runtimeEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  await resetDatabase(false).catch(() => undefined);
}

process.exitCode = exitCode;
