import { spawnSync } from "node:child_process";
import path from "node:path";

import { Pool } from "pg";

const root = process.cwd();
const targetOwner = "ai_strength_migrator";
const databaseNames = {
  clean: `ai_strength_upgrade_clean_${process.pid}`,
  legacy: `ai_strength_upgrade_legacy_${process.pid}`,
};

function execute(command, args, env = process.env, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  return result;
}

function run(command, args, env = process.env) {
  const result = execute(command, args, env);
  if (result.status !== 0) {
    throw new Error(`migration_upgrade_step_failed:${path.basename(command)}`);
  }
}

function sourceUrl(name) {
  const source = process.env[name]?.trim();
  if (!source) throw new Error(`${name.toLowerCase()}_required`);
  return new URL(source);
}

function databaseUrl(name, databaseName) {
  const url = sourceUrl(name);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function scenarioEnv(databaseName) {
  return {
    ...process.env,
    APP_ENV: "test",
    DATABASE_MIGRATION_OWNER: targetOwner,
    DATABASE_MIGRATION_URL: databaseUrl("DATABASE_MIGRATION_URL", databaseName),
  };
}

async function resetDatabase(databaseName, create) {
  const adminUrl = sourceUrl("DATABASE_MIGRATION_URL");
  adminUrl.pathname = "/postgres";
  const pool = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    await pool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    if (create) await pool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  } finally {
    await pool.end();
  }
}

async function query(databaseName, sql, params = []) {
  const pool = new Pool({
    connectionString: databaseUrl("DATABASE_MIGRATION_URL", databaseName),
    max: 1,
  });
  try {
    return await pool.query(sql, params);
  } finally {
    await pool.end();
  }
}

async function verifyState(databaseName, expectedMigration, hasProfileColumns) {
  const result = await query(databaseName, `
    SELECT
      (SELECT max(name) FROM public.app_schema_migrations) AS latest_migration,
      (SELECT count(*)::integer FROM public.app_schema_migrations) AS migration_count,
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
          AND pg_get_userbyid(relation.relowner) <> $1
      ) AS noncanonical_relations
  `, [targetOwner]);
  const state = result.rows[0];
  if (
    state?.latest_migration !== expectedMigration
    || state?.has_profile_columns !== hasProfileColumns
    || state?.noncanonical_relations !== 0
  ) {
    throw new Error(`migration_upgrade_verification_failed:${JSON.stringify(state)}`);
  }
  return state;
}

async function runCleanUpgrade() {
  const databaseName = databaseNames.clean;
  const env = scenarioEnv(databaseName);
  await resetDatabase(databaseName, true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], env);
  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0011_closed_alpha_operator"], env);
  const before = await verifyState(databaseName, "0011_closed_alpha_operator", false);
  if (before.migration_count !== 11) throw new Error("clean_upgrade_expected_11_migrations");

  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  const after = await verifyState(databaseName, "0012_athlete_profile_read_model", true);
  if (after.migration_count !== 12) throw new Error("clean_upgrade_expected_12_migrations");

  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  const repeated = await verifyState(databaseName, "0012_athlete_profile_read_model", true);
  if (repeated.migration_count !== 12) throw new Error("clean_upgrade_idempotency_failed");
  process.stdout.write(`CLEAN UPGRADE PASS ${JSON.stringify(repeated)}\n`);
}

async function simulateLegacyOwnership(databaseName) {
  const identity = await query(databaseName, "SELECT current_user AS legacy_owner");
  const legacyOwner = String(identity.rows[0]?.legacy_owner ?? "");
  if (!legacyOwner || legacyOwner === targetOwner) {
    throw new Error("legacy_owner_simulation_requires_distinct_login_role");
  }
  await query(
    databaseName,
    `REASSIGN OWNED BY ${quoteIdentifier(targetOwner)} TO ${quoteIdentifier(legacyOwner)}`,
  );
  const catalog = await query(databaseName, `
    SELECT object_kind, object_identity, current_owner
    FROM (
      SELECT
        'schema'::text AS object_kind,
        quote_ident(namespace.nspname) AS object_identity,
        pg_get_userbyid(namespace.nspowner) AS current_owner
      FROM pg_namespace namespace
      WHERE namespace.nspname IN ('app', 'app_private')

      UNION ALL

      SELECT
        CASE relation.relkind WHEN 'S' THEN 'sequence' ELSE 'table' END,
        format('%I.%I', namespace.nspname, relation.relname),
        pg_get_userbyid(relation.relowner)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname IN ('app', 'app_private')
        AND relation.relkind IN ('r', 'p', 'S')

      UNION ALL

      SELECT
        CASE routine.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END,
        format('%I.%I(%s)', namespace.nspname, routine.proname, pg_get_function_identity_arguments(routine.oid)),
        pg_get_userbyid(routine.proowner)
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      WHERE namespace.nspname IN ('app', 'app_private')

      UNION ALL

      SELECT
        CASE type_definition.typtype WHEN 'd' THEN 'domain' ELSE 'enum' END,
        format('%I.%I', namespace.nspname, type_definition.typname),
        pg_get_userbyid(type_definition.typowner)
      FROM pg_type type_definition
      JOIN pg_namespace namespace ON namespace.oid = type_definition.typnamespace
      WHERE namespace.nspname IN ('app', 'app_private')
        AND type_definition.typtype IN ('d', 'e')
    ) catalog_state
    WHERE current_owner = $1
    ORDER BY object_kind, object_identity
  `, [legacyOwner]);
  if (!catalog.rowCount) throw new Error("legacy_ownership_simulation_failed");
  return { legacyOwner, catalog: catalog.rows };
}

async function runLegacyRecovery() {
  const databaseName = databaseNames.legacy;
  const env = scenarioEnv(databaseName);
  await resetDatabase(databaseName, true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], env);
  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0011_closed_alpha_operator"], env);
  const legacy = await simulateLegacyOwnership(databaseName);

  const failedMigration = execute(process.execPath, ["scripts/db/migrate.mjs"], env, true);
  const failureOutput = `${failedMigration.stdout ?? ""}\n${failedMigration.stderr ?? ""}`;
  if (failedMigration.status === 0) throw new Error("legacy_migration_was_expected_to_fail");
  if (
    !failureOutput.includes("Migration ownership preflight failed")
    || !failureOutput.includes("app.athlete_profiles")
    || !failureOutput.includes(legacy.legacyOwner)
  ) {
    throw new Error(`legacy_failure_diagnostic_missing:${failureOutput}`);
  }
  process.stdout.write("LEGACY FAILURE REPRODUCED with catalog-confirmed ownership drift\n");

  const recoveryArgs = [
    "scripts/database/normalize-local-ownership.mjs",
    "--target-owner",
    targetOwner,
  ];
  const dryRun = execute(process.execPath, [...recoveryArgs, "--dry-run"], env, true);
  if (dryRun.status !== 0) throw new Error(`legacy_recovery_dry_run_failed:${dryRun.stderr}`);
  const dryRunReport = JSON.parse(String(dryRun.stdout));
  if (!dryRunReport.driftCount || dryRunReport.objects.length !== dryRunReport.driftCount) {
    throw new Error("legacy_recovery_dry_run_did_not_report_drift");
  }

  run(process.execPath, [...recoveryArgs, "--apply"], env);
  const repeatedDryRun = execute(process.execPath, [...recoveryArgs, "--dry-run"], env, true);
  if (repeatedDryRun.status !== 0) throw new Error(`legacy_recovery_repeat_failed:${repeatedDryRun.stderr}`);
  const repeatedReport = JSON.parse(String(repeatedDryRun.stdout));
  if (repeatedReport.driftCount !== 0) throw new Error("legacy_recovery_not_idempotent");

  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  const state = await verifyState(databaseName, "0012_athlete_profile_read_model", true);
  if (state.migration_count !== 12) throw new Error("legacy_upgrade_expected_12_migrations");
  process.stdout.write(`LEGACY RECOVERY PASS ${JSON.stringify({
    legacyOwner: legacy.legacyOwner,
    catalogObjects: legacy.catalog.length,
    recoveredObjects: dryRunReport.driftCount,
    finalState: state,
  })}\n`);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
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
  await runCleanUpgrade();
  await runLegacyRecovery();
  exitCode = 0;
} finally {
  await Promise.all(
    Object.values(databaseNames).map((databaseName) => resetDatabase(databaseName, false)),
  ).catch(() => undefined);
}

process.exitCode = exitCode;
