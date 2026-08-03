import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { expectedSchemaMigration } from "../../lib/server/runtime/schema-version";

const connectionString = process.env.TEST_DATABASE_URL;

test("health role can verify schema but cannot read product or session data", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 1 });
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
      "SELECT checksum FROM public.app_schema_migrations WHERE name = $1",
      [expectedSchemaMigration],
    );
    assert.equal(migration.rowCount, 1);

    await assert.rejects(health.query("SELECT id FROM app.users LIMIT 1"), permissionDenied);
    await assert.rejects(health.query("SELECT id FROM app_private.sessions LIMIT 1"), permissionDenied);
  } finally {
    await Promise.all([admin.end(), health.end()]);
  }
});

function permissionDenied(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}
