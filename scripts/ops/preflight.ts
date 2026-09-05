import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import {
  validateDeploymentConfig,
  type EnvironmentMap,
} from "../../lib/server/runtime/deployment-config";
import { expectedSchemaMigration } from "../../lib/server/runtime/schema-version";

type CheckResult = { code: string; ok: boolean };

const runtimeRoles = [
  ["DATABASE_APP_URL", "ai_strength_app"],
  ["DATABASE_AUTH_URL", "ai_strength_authenticator"],
  ["DATABASE_HEALTH_URL", "ai_strength_health"],
  ["DATABASE_WORKER_URL", "ai_strength_worker"],
] as const;
const operationalRoles = [
  ["DATABASE_MIGRATION_URL", "ai_strength_migrator"],
  ["DATABASE_OPERATOR_URL", "ai_strength_operator"],
] as const;

function configuredUrl(env: EnvironmentMap, name: string) {
  return env[name]?.trim() || env.DATABASE_URL?.trim() || null;
}

function migrationUrl(env: EnvironmentMap) {
  return env.DATABASE_MIGRATION_URL?.trim() || env.DATABASE_URL?.trim() || null;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function localMigrations() {
  const directory = path.join(process.cwd(), "database/migrations");
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".up.sql"))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(files.map(async (filename) => {
    const sql = await readFile(path.join(directory, filename), "utf8");
    return {
      name: filename.slice(0, -".up.sql".length),
      checksum: digest(sql),
    };
  }));
}

async function migrationChecks(connectionString: string): Promise<CheckResult[]> {
  const client = new Client({ connectionString, application_name: "ai-strength-preflight-migrations" });
  await client.connect();
  try {
    const expected = await localMigrations();
    const applied = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM public.app_schema_migrations ORDER BY name",
    );
    const byName = new Map(applied.rows.map((row) => [row.name, row.checksum]));
    const checks = expected.map((migration) => ({
      code: `migration_${migration.name}`,
      ok: byName.get(migration.name) === migration.checksum,
    }));
    checks.push({
      code: "migration_expected_schema",
      ok: expected.at(-1)?.name === expectedSchemaMigration
        && byName.size === expected.length
        && byName.get(expectedSchemaMigration)
          === expected.find((item) => item.name === expectedSchemaMigration)?.checksum,
    });
    checks.push({
      code: "migration_no_unknown_entries",
      ok: applied.rows.every((migration) => expected.some((item) => item.name === migration.name)),
    });
    return checks;
  } finally {
    await client.end();
  }
}

async function roleCheck(
  connectionString: string,
  expectedRole: string,
  restrictedRuntime: boolean,
): Promise<CheckResult[]> {
  const client = new Client({ connectionString, application_name: "ai-strength-preflight-role" });
  await client.connect();
  try {
    const result = await client.query<{
      role_ok: boolean;
      principal_restricted: boolean;
    }>(
      `SELECT
         current_user = $1 OR pg_has_role(current_user, $1, 'member') AS role_ok,
         NOT (
           login.rolsuper OR login.rolbypassrls OR login.rolcreatedb
           OR login.rolcreaterole OR login.rolreplication
           OR pg_has_role(current_user, 'ai_strength_migrator', 'member')
           OR pg_has_role(current_user, 'ai_strength_operator', 'member')
         ) AS principal_restricted
       FROM pg_roles login
       WHERE login.rolname = current_user`,
      [expectedRole],
    );
    const checks: CheckResult[] = [
      { code: `${expectedRole}_active`, ok: result.rows[0]?.role_ok === true },
    ];
    if (restrictedRuntime) {
      checks.push({
        code: `${expectedRole}_principal_restricted`,
        ok: result.rows[0]?.principal_restricted === true,
      });
    }
    return checks;
  } finally {
    await client.end();
  }
}

async function healthIsolationCheck(connectionString: string): Promise<CheckResult[]> {
  const client = new Client({ connectionString, application_name: "ai-strength-preflight-health" });
  await client.connect();
  try {
    const checks: CheckResult[] = [];
    for (const [code, sql] of [
      ["health_cannot_read_users", "SELECT id FROM app.users LIMIT 1"],
      ["health_cannot_read_sessions", "SELECT id FROM app_private.sessions LIMIT 1"],
    ] as const) {
      try {
        await client.query(sql);
        checks.push({ code, ok: false });
      } catch (error) {
        const errorCode = typeof error === "object" && error && "code" in error ? error.code : null;
        checks.push({ code, ok: errorCode === "42501" });
      }
    }
    return checks;
  } finally {
    await client.end();
  }
}

export async function runPreflight(env: EnvironmentMap = process.env) {
  const config = validateDeploymentConfig(env, "preflight");
  const checks: CheckResult[] = config.issues.map((item) => ({ code: item.code, ok: false }));
  if (!config.ready) return { stage: config.stage, checks, ready: false };

  const migrationConnection = migrationUrl(env);
  if (!migrationConnection) checks.push({ code: "database_migration_connection_missing", ok: false });
  else {
    try {
      checks.push(...await migrationChecks(migrationConnection));
    } catch {
      checks.push({ code: "database_migration_connection_failed", ok: false });
    }
  }

  const workerEnabled = (env.NOTIFICATION_DELIVERY_MODE?.trim() || "disabled") !== "disabled";
  const runtimeRoleChecks = runtimeRoles.filter(([name]) => (
    name !== "DATABASE_WORKER_URL" || workerEnabled || Boolean(configuredUrl(env, name))
  ));
  for (const [name, expectedRole] of runtimeRoleChecks) {
    const connectionString = configuredUrl(env, name);
    if (!connectionString) {
      checks.push({ code: `${name.toLowerCase()}_connection_missing`, ok: false });
      continue;
    }
    try {
      checks.push(...await roleCheck(connectionString, expectedRole, true));
    } catch {
      checks.push({ code: `${expectedRole}_connection_failed`, ok: false });
    }
  }

  const operationalRoleChecks = config.stage === "staging" || config.stage === "production"
    ? operationalRoles
    : operationalRoles.filter(([name]) => Boolean(configuredUrl(env, name)));
  for (const [name, expectedRole] of operationalRoleChecks) {
    const connectionString = configuredUrl(env, name);
    if (!connectionString) {
      checks.push({ code: `${name.toLowerCase()}_connection_missing`, ok: false });
      continue;
    }
    try {
      checks.push(...await roleCheck(connectionString, expectedRole, false));
    } catch {
      checks.push({ code: `${expectedRole}_connection_failed`, ok: false });
    }
  }

  const healthConnection = configuredUrl(env, "DATABASE_HEALTH_URL");
  if (healthConnection) {
    try {
      checks.push(...await healthIsolationCheck(healthConnection));
    } catch {
      checks.push({ code: "health_isolation_unverifiable", ok: false });
    }
  }

  return { stage: config.stage, checks, ready: checks.every((item) => item.ok) };
}

async function main() {
  const report = await runPreflight();
  process.stdout.write(`Deployment preflight: ${report.ready ? "PASS" : "FAIL"} (${report.stage})\n`);
  for (const check of report.checks) {
    process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${check.code}\n`);
  }
  if (!report.ready) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("scripts/ops/preflight.ts")) {
  void main().catch(() => {
    process.stdout.write("Deployment preflight: FAIL\nFAIL preflight_unhandled\n");
    process.exitCode = 1;
  });
}
