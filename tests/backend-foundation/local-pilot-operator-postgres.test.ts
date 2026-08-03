import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { LocalPilotOperator } from "../../lib/server/ops/local-pilot";

const connectionString = process.env.TEST_DATABASE_URL;

async function account(pool: Pool, email: string, displayName: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  await pool.query(`INSERT INTO app_private.auth_identities
    (user_id, provider, provider_subject, email_original, email_normalized, verified_at, last_used_at)
    VALUES ($1,'email_otp',$2,$2,$2,clock_timestamp(),clock_timestamp())`,
    [user.rows[0].id, email],
  );
  return user.rows[0].id;
}

test("local operator activates only an existing verified trainer request and records the action", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  try {
    const trainerId = await account(pool, "pilot-trainer@example.test", "Pilot Trainer");
    await pool.query("INSERT INTO app.trainer_profiles (user_id, status) VALUES ($1, 'pending')", [trainerId]);
    const operator = new LocalPilotOperator(pool);

    assert.deepEqual(await operator.activateTrainer(" PILOT-TRAINER@example.test "), {
      ok: true,
      state: "activated",
    });
    assert.deepEqual(await operator.activateTrainer("pilot-trainer@example.test"), {
      ok: true,
      state: "already_active",
    });
    const profile = await pool.query<{ status: string; activated_at: Date | null }>(
      "SELECT status::text, activated_at FROM app.trainer_profiles WHERE user_id = $1",
      [trainerId],
    );
    assert.equal(profile.rows[0].status, "active");
    assert.ok(profile.rows[0].activated_at);
    const audit = await pool.query(
      `SELECT id FROM app.audit_events
       WHERE subject_user_id = $1 AND event_type = 'access.trainer_capability.operator_activated'`,
      [trainerId],
    );
    assert.equal(audit.rowCount, 1);
  } finally {
    await pool.end();
  }
});

test("local readiness identifies the exact missing registration and invitation steps", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  try {
    const trainerId = await account(pool, "readiness-trainer@example.test", "Readiness Trainer");
    const firstAthleteId = await account(pool, "readiness-one@example.test", "Readiness One");
    const secondAthleteId = await account(pool, "readiness-two@example.test", "Readiness Two");
    await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
      VALUES ($1,'active',clock_timestamp())`, [trainerId]);
    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1,'active')", [firstAthleteId]);
    await pool.query(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
      VALUES ($1,$2,'active',true)`, [trainerId, firstAthleteId]);

    const operator = new LocalPilotOperator(pool);
    const waiting = await operator.status({
      trainerEmail: "readiness-trainer@example.test",
      athleteEmails: ["readiness-one@example.test", "readiness-two@example.test"],
    });
    assert.equal(waiting.readyForWorkoutLoop, false);
    assert.deepEqual(waiting.blockers, ["athlete_2_invitation_acceptance_required"]);
    assert.equal(waiting.workflow.activeAthletes, 1);

    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1,'active')", [secondAthleteId]);
    await pool.query(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
      VALUES ($1,$2,'active',true)`, [trainerId, secondAthleteId]);
    const ready = await operator.status({
      trainerEmail: "readiness-trainer@example.test",
      athleteEmails: ["readiness-one@example.test", "readiness-two@example.test"],
    });
    assert.equal(ready.readyForWorkoutLoop, true);
    assert.deepEqual(ready.blockers, []);
    assert.equal(ready.workflow.activeAthletes, 2);
  } finally {
    await pool.end();
  }
});

test("local operator fails closed for missing requests, revoked identities and ambiguous email", {
  skip: !connectionString,
}, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  try {
    await account(pool, "no-request@example.test", "No Request");
    const revokedId = await account(pool, "revoked@example.test", "Revoked Identity");
    await pool.query("INSERT INTO app.trainer_profiles (user_id, status) VALUES ($1,'pending')", [revokedId]);
    await pool.query(`UPDATE app_private.auth_identities SET revoked_at = clock_timestamp()
      WHERE user_id = $1`, [revokedId]);
    await account(pool, "ambiguous@example.test", "Ambiguous One");
    const duplicate = await pool.query<{ id: string }>(
      "INSERT INTO app.users (status, display_name) VALUES ('active','Ambiguous Two') RETURNING id",
    );
    await pool.query(`INSERT INTO app_private.auth_identities
      (user_id, provider, provider_subject, email_original, email_normalized, verified_at)
      VALUES ($1,'google','ambiguous-google-subject','ambiguous@example.test','ambiguous@example.test',clock_timestamp())`,
      [duplicate.rows[0].id],
    );

    const operator = new LocalPilotOperator(pool);
    assert.deepEqual(await operator.activateTrainer("no-request@example.test"), {
      ok: false,
      reason: "trainer_request_missing",
    });
    assert.deepEqual(await operator.activateTrainer("revoked@example.test"), {
      ok: false,
      reason: "identity_unverified",
    });
    assert.deepEqual(await operator.activateTrainer("ambiguous@example.test"), {
      ok: false,
      reason: "ambiguous_email",
    });
    assert.deepEqual(await operator.activateTrainer("not-an-email"), {
      ok: false,
      reason: "invalid_email",
    });
  } finally {
    await pool.end();
  }
});
