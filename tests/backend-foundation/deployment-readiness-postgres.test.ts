import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import {
  expectedSchemaMigration,
  expectedSchemaMigrationCount,
} from "../../lib/server/runtime/schema-version";
import { runPreflight } from "../../scripts/ops/preflight";

const connectionString = process.env.TEST_DATABASE_URL;

test("health role can verify schema but cannot read product or session data", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 1 });
  const app = new Pool({ connectionString, max: 1, options: "-c role=ai_strength_app" });
  const health = new Pool({ connectionString, max: 1, options: "-c role=ai_strength_health" });
  try {
    const role = await admin.query<{
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolbypassrls: boolean;
    }>(`SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
      FROM pg_roles WHERE rolname = 'ai_strength_health'`);
    assert.deepEqual(role.rows[0], {
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolbypassrls: false,
    });

    const migration = await health.query(
      `SELECT
         count(*)::integer AS migration_count,
         count(*) FILTER (WHERE name = $1)::integer AS expected_count
       FROM public.app_schema_migrations`,
      [expectedSchemaMigration],
    );
    assert.deepEqual(migration.rows[0], {
      migration_count: expectedSchemaMigrationCount,
      expected_count: 1,
    });

    const appPrincipal = await app.query<{
      current_user: string;
      rolbypassrls: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(`SELECT current_user, rolbypassrls, rolsuper, rolcreatedb, rolcreaterole
      FROM pg_roles WHERE rolname = current_user`);
    assert.deepEqual(appPrincipal.rows[0], {
      current_user: "ai_strength_app",
      rolbypassrls: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });

    await assert.rejects(health.query("SELECT id FROM app.users LIMIT 1"), permissionDenied);
    await assert.rejects(health.query("SELECT id FROM app_private.sessions LIMIT 1"), permissionDenied);
  } finally {
    await Promise.all([admin.end(), app.end(), health.end()]);
  }
});

test("deployment preflight accepts the isolated local role projections", {
  skip: !connectionString,
}, async () => {
  const report = await runPreflight({
    ...process.env,
    APP_ENV: "test",
    NOTIFICATION_DELIVERY_MODE: "disabled",
  });
  const failed = report.checks.filter((check) => !check.ok);
  assert.deepEqual(failed, []);
  assert.ok(report.checks.some((check) => (
    check.code === "ai_strength_app_principal_restricted" && check.ok
  )));
  assert.ok(report.checks.some((check) => (
    check.code === "migration_expected_schema" && check.ok
  )));
});

function permissionDenied(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}
