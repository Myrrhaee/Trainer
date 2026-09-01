import { spawnSync } from "node:child_process";
import path from "node:path";

import { Pool } from "pg";

const root = process.cwd();
const targetOwner = "ai_strength_migrator";
const databaseNames = {
  clean: `ai_strength_upgrade_clean_${process.pid}`,
  legacy: `ai_strength_upgrade_legacy_${process.pid}`,
  inconsistent: `ai_strength_upgrade_inconsistent_${process.pid}`,
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

async function seedLegacyLifecycleStates(databaseName) {
  const trainer = await query(databaseName, `
    WITH account AS (
      INSERT INTO app.users (status, display_name) VALUES ('active', 'R2D migration trainer') RETURNING id
    )
    INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    SELECT id, 'active', clock_timestamp() FROM account RETURNING user_id
  `);
  const athlete = await query(databaseName, `
    WITH account AS (
      INSERT INTO app.users (status, display_name) VALUES ('active', 'R2D migration athlete') RETURNING id
    )
    INSERT INTO app.athlete_profiles (user_id, status)
    SELECT id, 'active' FROM account RETURNING user_id
  `);
  const relation = await query(databaseName, `
    INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, 'active', true) RETURNING id
  `, [trainer.rows[0].user_id, athlete.rows[0].user_id]);

  async function template(status, currentRevision, title, archived = false) {
    const result = await query(databaseName, `
      INSERT INTO app.workout_templates
        (trainer_user_id, title, description, status, current_revision, archived_at)
      VALUES ($1, $2, '', $3::app.workout_template_status, $4,
        CASE WHEN $5 THEN clock_timestamp() ELSE NULL END)
      RETURNING id
    `, [trainer.rows[0].user_id, title, status, currentRevision, archived]);
    return result.rows[0].id;
  }

  async function revision(templateId, number, status, title) {
    const result = await query(databaseName, `
      INSERT INTO app.workout_template_revisions
        (template_id, revision_number, title, description, general_instruction,
         status, published_at)
      VALUES ($1, $2, $3, '', '', $4::app.workout_template_revision_status,
        CASE WHEN $4 = 'published' THEN clock_timestamp() ELSE NULL END)
      RETURNING id
    `, [templateId, number, title, status]);
    return result.rows[0].id;
  }

  const publishedOnly = await template("published", 1, "Published only");
  const publishedOnlyRevision = await revision(publishedOnly, 1, "published", "Published only");
  const draftOnly = await template("draft", 1, "Draft only");
  const draftOnlyRevision = await revision(draftOnly, 1, "draft", "Draft only");
  const publishedWithDraft = await template("draft", 2, "Published with draft");
  const publishedWithDraftRevision = await revision(publishedWithDraft, 1, "published", "Published with draft v1");
  const publishedWithDraftEditable = await revision(publishedWithDraft, 2, "draft", "Published with draft v2");
  const archived = await template("archived", 2, "Archived", true);
  const archivedPublishedRevision = await revision(archived, 1, "published", "Archived v1");
  const archivedEditableRevision = await revision(archived, 2, "draft", "Archived v2");

  const mappedExercise = await query(databaseName, `
    INSERT INTO app.workout_template_exercises
      (revision_id, instance_key, position, title, sets, repetitions,
       target_weight_kg, rest_seconds, trainer_note, source_exercise_key,
       category, equipment, description, image_url, prescription_type,
       repetition_mode, repetitions_min, repetitions_max, per_set_mode)
    VALUES
      ($1, 'legacy-mapped-instance', 1, 'Legacy mapped snapshot', 3, 8,
       70, 120, 'Keep this note', 'demo-ex-back-1',
       'Legacy category', 'Legacy equipment', 'Legacy description', '/legacy.webp',
       'repetitions', 'fixed', 8, 8, false)
    RETURNING id
  `, [publishedOnlyRevision]);
  const unmatchedExercise = await query(databaseName, `
    INSERT INTO app.workout_template_exercises
      (revision_id, instance_key, position, title, sets, repetitions,
       rest_seconds, source_exercise_key, category, prescription_type,
       repetition_mode, repetitions_min, repetitions_max, per_set_mode)
    VALUES
      ($1, 'legacy-unmatched-instance', 2, 'Legacy unmatched snapshot', 2, 12,
       90, 'legacy-unmatched-key', 'Legacy category', 'repetitions',
       'fixed', 12, 12, false)
    RETURNING id
  `, [publishedOnlyRevision]);

  const assignment = await query(databaseName, `
    INSERT INTO app.workout_assignments
      (relation_id, trainer_user_id, athlete_user_id, source_template_id,
       source_revision_id, source_revision_number, title_snapshot,
       instruction_snapshot, trainer_note, scheduled_for)
    VALUES ($1, $2, $3, $4, $5, 1, 'Published only snapshot',
      'Snapshot instruction', 'Snapshot note', DATE '2026-09-01')
    RETURNING id
  `, [
    relation.rows[0].id,
    trainer.rows[0].user_id,
    athlete.rows[0].user_id,
    publishedOnly,
    publishedOnlyRevision,
  ]);
  const snapshot = await query(databaseName,
    `SELECT to_jsonb(assignment) AS value FROM app.workout_assignments assignment WHERE id = $1`,
    [assignment.rows[0].id]);
  await query(databaseName, `
    INSERT INTO app.workout_assignment_exercises
      (assignment_id, source_template_exercise_id, instance_key, position,
       title_snapshot, sets_snapshot, repetitions_snapshot, target_weight_kg_snapshot,
       rest_seconds_snapshot, trainer_note_snapshot, source_exercise_key_snapshot,
       category_snapshot, equipment_snapshot, prescription_type_snapshot,
       repetition_mode_snapshot, repetitions_min_snapshot, repetitions_max_snapshot,
       per_set_mode_snapshot)
    VALUES
      ($1, $2, 'legacy-mapped-instance', 1, 'Legacy mapped snapshot', 3, 8, 70,
       120, 'Keep this note', 'demo-ex-back-1', 'Legacy category',
       'Legacy equipment', 'repetitions', 'fixed', 8, 8, false)
  `, [assignment.rows[0].id, mappedExercise.rows[0].id]);
  const assignmentExerciseSnapshot = await query(databaseName, `
    SELECT to_jsonb(exercise) AS value
    FROM app.workout_assignment_exercises exercise
    WHERE assignment_id = $1
  `, [assignment.rows[0].id]);

  return {
    publishedOnly: [publishedOnly, publishedOnlyRevision],
    draftOnly: [draftOnly, draftOnlyRevision],
    publishedWithDraft: [publishedWithDraft, publishedWithDraftRevision, publishedWithDraftEditable],
    archived: [archived, archivedPublishedRevision, archivedEditableRevision],
    assignmentId: assignment.rows[0].id,
    assignmentSnapshot: snapshot.rows[0].value,
    assignmentExerciseSnapshot: assignmentExerciseSnapshot.rows[0].value,
    mappedExerciseId: mappedExercise.rows[0].id,
    unmatchedExerciseId: unmatchedExercise.rows[0].id,
  };
}

async function verifyLifecycleBackfill(databaseName, fixture) {
  const templates = await query(databaseName, `
    SELECT id, status::text, current_revision, published_revision_id, editable_revision_id
    FROM app.workout_templates
    WHERE id = ANY($1::uuid[])
    ORDER BY id
  `, [[
    fixture.publishedOnly[0],
    fixture.draftOnly[0],
    fixture.publishedWithDraft[0],
    fixture.archived[0],
  ]]);
  const byId = new Map(templates.rows.map((row) => [row.id, row]));
  const expected = [
    [fixture.publishedOnly[0], "published", 1, fixture.publishedOnly[1], null],
    [fixture.draftOnly[0], "draft", 1, null, fixture.draftOnly[1]],
    [fixture.publishedWithDraft[0], "published", 2, fixture.publishedWithDraft[1], fixture.publishedWithDraft[2]],
    [fixture.archived[0], "archived", 2, fixture.archived[1], fixture.archived[2]],
  ];
  for (const [id, status, currentRevision, publishedRevisionId, editableRevisionId] of expected) {
    const row = byId.get(id);
    if (!row
      || row.status !== status
      || row.current_revision !== currentRevision
      || row.published_revision_id !== publishedRevisionId
      || row.editable_revision_id !== editableRevisionId) {
      throw new Error(`lifecycle_backfill_mismatch:${JSON.stringify({ expected: [id, status, currentRevision, publishedRevisionId, editableRevisionId], row })}`);
    }
  }
  const snapshot = await query(databaseName,
    `SELECT to_jsonb(assignment) AS value FROM app.workout_assignments assignment WHERE id = $1`,
    [fixture.assignmentId]);
  if (JSON.stringify(snapshot.rows[0].value) !== JSON.stringify(fixture.assignmentSnapshot)) {
    throw new Error("existing_assignment_snapshot_changed");
  }
  const assignmentExercise = await query(databaseName, `
    SELECT to_jsonb(exercise) AS value
    FROM app.workout_assignment_exercises exercise
    WHERE assignment_id = $1
  `, [fixture.assignmentId]);
  if (JSON.stringify(assignmentExercise.rows[0].value) !== JSON.stringify(fixture.assignmentExerciseSnapshot)) {
    throw new Error("existing_assignment_exercise_snapshot_changed");
  }
}

async function verifyExerciseBackfill(databaseName, fixture, expectSourceColumn = true) {
  const sourceColumn = await query(databaseName, `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'workout_template_exercises'
        AND column_name = 'source_exercise_id'
    ) AS exists
  `);
  if (sourceColumn.rows[0].exists !== expectSourceColumn) {
    throw new Error("exercise_source_column_state_mismatch");
  }
  if (!expectSourceColumn) return;
  const rows = await query(databaseName, `
    SELECT template_exercise.id, template_exercise.title, template_exercise.source_exercise_id,
      source.stable_key
    FROM app.workout_template_exercises template_exercise
    LEFT JOIN app.exercises source ON source.id = template_exercise.source_exercise_id
    WHERE template_exercise.id = ANY($1::uuid[])
    ORDER BY template_exercise.id
  `, [[fixture.mappedExerciseId, fixture.unmatchedExerciseId]]);
  const byId = new Map(rows.rows.map((row) => [row.id, row]));
  const mapped = byId.get(fixture.mappedExerciseId);
  const unmatched = byId.get(fixture.unmatchedExerciseId);
  if (!mapped?.source_exercise_id || mapped.stable_key !== "demo-ex-back-1"
    || mapped.title !== "Legacy mapped snapshot") {
    throw new Error(`exercise_source_backfill_failed:${JSON.stringify(mapped)}`);
  }
  if (unmatched?.source_exercise_id !== null || unmatched?.title !== "Legacy unmatched snapshot") {
    throw new Error(`exercise_unmatched_source_not_safe:${JSON.stringify(unmatched)}`);
  }
}

async function runCleanUpgrade() {
  const databaseName = databaseNames.clean;
  const env = scenarioEnv(databaseName);
  await resetDatabase(databaseName, true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], env);
  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0012_athlete_profile_read_model"], env);
  const before = await verifyState(databaseName, "0012_athlete_profile_read_model", true);
  if (before.migration_count !== 12) throw new Error("clean_upgrade_expected_12_migrations");
  const fixture = await seedLegacyLifecycleStates(databaseName);

  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0013_workout_template_revision_lifecycle"], env);
  const r2d1 = await verifyState(databaseName, "0013_workout_template_revision_lifecycle", true);
  if (r2d1.migration_count !== 13) throw new Error("clean_upgrade_expected_13_migrations");
  await verifyLifecycleBackfill(databaseName, fixture);

  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  const after = await verifyState(databaseName, "0014_canonical_exercise_library", true);
  if (after.migration_count !== 14) throw new Error("clean_upgrade_expected_14_migrations");
  await verifyExerciseBackfill(databaseName, fixture);
  await verifyLifecycleBackfill(databaseName, fixture);

  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  const repeated = await verifyState(databaseName, "0014_canonical_exercise_library", true);
  if (repeated.migration_count !== 14) throw new Error("clean_upgrade_idempotency_failed");

  run(process.execPath, ["scripts/db/rollback.mjs"], env);
  const rolledBack = await verifyState(databaseName, "0013_workout_template_revision_lifecycle", true);
  if (rolledBack.migration_count !== 13) throw new Error("rollback_expected_13_migrations");
  await verifyExerciseBackfill(databaseName, fixture, false);
  await verifyLifecycleBackfill(databaseName, fixture);
  run(process.execPath, ["scripts/db/migrate.mjs"], env);
  await verifyExerciseBackfill(databaseName, fixture);

  run(process.execPath, ["scripts/database/seed-system-exercises.mjs"], env);
  run(process.execPath, ["scripts/database/seed-system-exercises.mjs"], env);
  const seed = await query(databaseName, `
    SELECT count(*)::integer AS count, count(DISTINCT id)::integer AS ids,
      count(DISTINCT stable_key)::integer AS keys
    FROM app.exercises WHERE scope = 'system'
  `);
  if (seed.rows[0].count !== 182 || seed.rows[0].ids !== 182 || seed.rows[0].keys !== 182) {
    throw new Error(`system_exercise_seed_not_deterministic:${JSON.stringify(seed.rows[0])}`);
  }
  process.stdout.write(`CLEAN UPGRADE PASS ${JSON.stringify(repeated)}\n`);
}

async function runInconsistentPreflight() {
  const databaseName = databaseNames.inconsistent;
  const env = scenarioEnv(databaseName);
  await resetDatabase(databaseName, true);
  run(process.execPath, ["scripts/db/bootstrap.mjs"], env);
  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0012_athlete_profile_read_model"], env);
  const trainer = await query(databaseName, `
    WITH account AS (
      INSERT INTO app.users (status, display_name) VALUES ('active', 'R2D inconsistent trainer') RETURNING id
    )
    INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    SELECT id, 'active', clock_timestamp() FROM account RETURNING user_id
  `);
  const template = await query(databaseName, `
    INSERT INTO app.workout_templates (trainer_user_id, title, status, current_revision)
    VALUES ($1, 'Inconsistent', 'published', 1) RETURNING id
  `, [trainer.rows[0].user_id]);
  await query(databaseName, `
    INSERT INTO app.workout_template_revisions
      (template_id, revision_number, title, status, published_at)
    VALUES ($1, 1, 'Inconsistent draft', 'draft', NULL)
  `, [template.rows[0].id]);
  const failed = execute(process.execPath, ["scripts/db/migrate.mjs"], env, true);
  const output = `${failed.stdout ?? ""}\n${failed.stderr ?? ""}`;
  if (failed.status === 0 || !output.includes("r2d1_template_lifecycle_preflight_failed")) {
    throw new Error(`lifecycle_preflight_diagnostic_missing:${output}`);
  }
  process.stdout.write("INCONSISTENT LIFECYCLE PREFLIGHT PASS\n");
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
  run(process.execPath, ["scripts/db/migrate.mjs", "--through", "0012_athlete_profile_read_model"], env);
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
  const state = await verifyState(databaseName, "0014_canonical_exercise_library", true);
  if (state.migration_count !== 14) throw new Error("legacy_upgrade_expected_14_migrations");
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
  await runInconsistentPreflight();
  await runLegacyRecovery();
  exitCode = 0;
} finally {
  await Promise.all(
    Object.values(databaseNames).map((databaseName) => resetDatabase(databaseName, false)),
  ).catch(() => undefined);
}

process.exitCode = exitCode;
