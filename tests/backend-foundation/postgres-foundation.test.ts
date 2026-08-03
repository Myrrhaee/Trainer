import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { PostgresSessionRepository } from "../../lib/server/auth/session-repository";
import { SessionService } from "../../lib/server/auth/session-service";
import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";
import { PostgresUserRepository } from "../../lib/server/users/user-repository";

const connectionString = process.env.TEST_DATABASE_URL;

test("clean PostgreSQL schema supports users, sessions and revocation", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 2 });
  const users = new PostgresUserRepository(pool, pool);
  const sessions = new SessionService(
    new PostgresSessionRepository(pool),
    { idleTtlSeconds: 60, absoluteTtlSeconds: 600 },
  );

  try {
    const user = await users.create({ status: "active", displayName: "Synthetic B1 User" });
    const issued = await sessions.issue(user.id);

    assert.equal((await sessions.authenticate(issued.token))?.userId, user.id);
    assert.equal(await sessions.revoke(issued.token), true);
    assert.equal(await sessions.authenticate(issued.token), null);
  } finally {
    await pool.end();
  }
});

test("RLS exposes only the actor and pooled connections do not leak actor context", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const first = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status, display_name) VALUES ('active', 'Actor One') RETURNING id",
    );
    const second = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status, display_name) VALUES ('active', 'Actor Two') RETURNING id",
    );
    const firstId = first.rows[0].id;
    const secondId = second.rows[0].id;

    const visibleToFirst = await withDatabaseTransaction(pool, async (client) => {
      await client.query("SET LOCAL ROLE ai_strength_app");
      await setTransactionActor(client, { userId: firstId });
      return client.query<{ id: string }>("SELECT id FROM app.users ORDER BY id");
    });
    assert.deepEqual(visibleToFirst.rows.map((row) => row.id), [firstId]);
    assert.equal(visibleToFirst.rows.some((row) => row.id === secondId), false);

    const noActorAfterReuse = await withDatabaseTransaction(pool, async (client) => {
      await client.query("SET LOCAL ROLE ai_strength_app");
      const context = await client.query<{ actor_id: string | null }>(
        "SELECT app.current_actor_user_id()::text AS actor_id",
      );
      const visible = await client.query("SELECT id FROM app.users");
      return { actorId: context.rows[0].actor_id, count: visible.rowCount };
    });
    assert.equal(noActorAfterReuse.actorId, null);
    assert.equal(noActorAfterReuse.count, 0);
  } finally {
    await pool.end();
  }
});

test("ordinary application role cannot read private session persistence", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    await assert.rejects(
      withDatabaseTransaction(pool, async (client) => {
        await client.query("SET LOCAL ROLE ai_strength_app");
        await client.query("SELECT id FROM app_private.sessions");
      }),
      /permission denied/,
    );

    const authenticatorCanRead = await withDatabaseTransaction(pool, async (client) => {
      await client.query("SET LOCAL ROLE ai_strength_authenticator");
      return client.query("SELECT id FROM app_private.sessions");
    });
    assert.ok(authenticatorCanRead.rowCount !== null);
  } finally {
    await pool.end();
  }
});
