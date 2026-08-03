import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { PostgresUserRepository } from "../../lib/server/users/user-repository";

const connectionString = process.env.TEST_DATABASE_URL;

test("an authenticated account updates only its own display name and records an audit event", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 2, options: "-c role=ai_strength_app" });
  const users = new PostgresUserRepository(admin, app);

  try {
    const first = await users.create({ status: "active", displayName: null });
    const second = await users.create({ status: "active", displayName: "Другой пользователь" });
    const updated = await users.updateDisplayName({ userId: first.id }, "Анна Пилот");

    assert.equal(updated?.displayName, "Анна Пилот");
    assert.equal((await users.findCurrent({ userId: first.id }))?.displayName, "Анна Пилот");

    const untouched = await admin.query<{ display_name: string | null }>(
      "SELECT display_name FROM app.users WHERE id = $1",
      [second.id],
    );
    assert.equal(untouched.rows[0].display_name, "Другой пользователь");

    const audit = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM app.audit_events
       WHERE actor_user_id = $1
         AND subject_user_id = $1
         AND event_type = 'account.profile.updated'`,
      [first.id],
    );
    assert.equal(Number(audit.rows[0].count), 1);
  } finally {
    await app.end();
    await admin.end();
  }
});
