import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { PostgresAccessRepository } from "../../lib/server/access/access-repository";
import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";

const connectionString = process.env.TEST_DATABASE_URL;

function hashToken(token: Buffer) {
  return createHash("sha256").update(token).digest();
}

async function createUser(pool: Pool, name: string) {
  const result = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  return { userId: result.rows[0].id };
}

async function activateTrainer(pool: Pool, userId: string) {
  await pool.query(
    `UPDATE app.trainer_profiles
     SET status = 'active', activated_at = clock_timestamp()
     WHERE user_id = $1`,
    [userId],
  );
}

test("capabilities are explicit and trainer activation is manual", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 2, options: "-c role=ai_strength_app" });
  const repository = new PostgresAccessRepository(app);
  const actor = await createUser(admin, "Pending Trainer");

  try {
    const initial = await repository.context(actor);
    assert.equal(initial.trainer, null);
    assert.equal(initial.athlete, null);
    assert.equal(initial.destination, "/onboarding");

    assert.equal(await repository.requestTrainerCapability(actor), "pending");
    assert.equal((await repository.context(actor)).trainer?.status, "pending");

    await assert.rejects(
      repository.createInvitation(actor, hashToken(randomBytes(32)), new Date(Date.now() + 60_000)),
      (error: NodeJS.ErrnoException) => error.code === "42501",
    );

    await activateTrainer(admin, actor.userId);
    assert.equal((await repository.context(actor)).destination, "/trainer/dashboard");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("invitation acceptance is actor-bound, single-use and retry-safe", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new PostgresAccessRepository(app);
  const trainer = await createUser(admin, "Active Trainer");
  const athlete = await createUser(admin, "Invited Athlete");
  const replayActor = await createUser(admin, "Replay Actor");
  const tokenHash = hashToken(randomBytes(32));

  try {
    await repository.requestTrainerCapability(trainer);
    await activateTrainer(admin, trainer.userId);
    const invitation = await repository.createInvitation(
      trainer,
      tokenHash,
      new Date(Date.now() + 60_000),
    );
    assert.ok(invitation.id);

    const accepted = await repository.acceptInvitation(athlete, tokenHash);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.retry, false);
    assert.equal(accepted.relation.trainerUserId, trainer.userId);
    assert.equal(accepted.relation.athleteUserId, athlete.userId);

    const retry = await repository.acceptInvitation(athlete, tokenHash);
    assert.equal(retry.ok, true);
    if (retry.ok) {
      assert.equal(retry.retry, true);
      assert.equal(retry.relation.id, accepted.relation.id);
    }

    const replay = await repository.acceptInvitation(replayActor, tokenHash);
    assert.deepEqual(replay, { ok: false, reason: "invalid_or_expired" });

    const expiringHash = hashToken(randomBytes(32));
    await repository.createInvitation(
      trainer,
      expiringHash,
      new Date(Date.now() + 500),
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.deepEqual(
      await repository.acceptInvitation(replayActor, expiringHash),
      { ok: false, reason: "invalid_or_expired" },
    );
    assert.equal((await repository.context(athlete)).destination, "/client/me");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("RLS isolates unrelated actors and ended relations stop authorizing athlete access", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new PostgresAccessRepository(app);
  const trainer = await createUser(admin, "Relation Trainer");
  const unrelatedTrainer = await createUser(admin, "Unrelated Trainer");
  const athlete = await createUser(admin, "Private Athlete");
  const unrelatedAthlete = await createUser(admin, "Unrelated Athlete");
  const tokenHash = hashToken(randomBytes(32));

  try {
    for (const actor of [trainer, unrelatedTrainer]) {
      await repository.requestTrainerCapability(actor);
      await activateTrainer(admin, actor.userId);
    }
    await repository.createInvitation(trainer, tokenHash, new Date(Date.now() + 60_000));
    const accepted = await repository.acceptInvitation(athlete, tokenHash);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;

    const unrelatedTrainerRows = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, unrelatedTrainer);
      return client.query(
        "SELECT id FROM app.trainer_athlete_relations WHERE athlete_user_id = $1",
        [athlete.userId],
      );
    });
    assert.equal(unrelatedTrainerRows.rowCount, 0);
    assert.equal(await repository.hasActiveAthleteRelation(unrelatedTrainer, athlete.userId), false);
    assert.equal(await repository.hasActiveAthleteRelation(trainer, athlete.userId), true);

    const unrelatedAthleteRows = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, unrelatedAthlete);
      return client.query(
        "SELECT user_id FROM app.athlete_profiles WHERE user_id = $1",
        [athlete.userId],
      );
    });
    assert.equal(unrelatedAthleteRows.rowCount, 0);

    assert.equal((await repository.transitionRelation(
      trainer,
      accepted.relation.id,
      "ended",
    ))?.status, "ended");

    const trainerAfterEnd = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, trainer);
      return client.query(
        `SELECT id FROM app.trainer_athlete_relations
         WHERE id = $1 AND status = 'active'`,
        [accepted.relation.id],
      );
    });
    assert.equal(trainerAfterEnd.rowCount, 0);
    assert.equal(await repository.hasActiveAthleteRelation(trainer, athlete.userId), false);

    const athleteHistory = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, athlete);
      return client.query(
        "SELECT status::text FROM app.trainer_athlete_relations WHERE id = $1",
        [accepted.relation.id],
      );
    });
    assert.equal(athleteHistory.rows[0].status, "ended");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
