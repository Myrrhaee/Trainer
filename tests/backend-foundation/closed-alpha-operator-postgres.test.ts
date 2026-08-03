import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { Pool } from "pg";

import { ClosedAlphaOperator } from "../../lib/server/ops/closed-alpha";

const connectionString = process.env.TEST_DATABASE_URL;

async function account(pool: Pool, email: string) {
  const userId = randomUUID();
  await pool.query("INSERT INTO app.users (id, status) VALUES ($1, 'active')", [userId]);
  await pool.query(
    `INSERT INTO app_private.auth_identities
      (user_id, provider, provider_subject, email_original, email_normalized, verified_at)
     VALUES ($1, 'email_otp', $2, $2, $2, clock_timestamp())`,
    [userId, email],
  );
  return userId;
}

function permissionDenied(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}

test("closed-alpha operator activates only a verified pending request and records provenance", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 1 });
  const operatorPool = new Pool({
    connectionString,
    max: 1,
    options: "-c role=ai_strength_operator",
  });
  const email = `trainer-${randomUUID()}@example.test`;
  try {
    const role = await admin.query<{
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolbypassrls: boolean;
    }>(`SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
      FROM pg_roles WHERE rolname = 'ai_strength_operator'`);
    assert.deepEqual(role.rows[0], {
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolbypassrls: false,
    });
    await assert.rejects(
      operatorPool.query("SELECT id FROM app.users LIMIT 1"),
      permissionDenied,
    );
    await assert.rejects(
      operatorPool.query("SELECT * FROM app_private.closed_alpha_identity_status($1)", [email]),
      permissionDenied,
    );

    const trainerUserId = await account(admin, email);
    const operator = new ClosedAlphaOperator(operatorPool);
    assert.equal(await operator.activateTrainer({
      trainerEmail: email,
      operatorRef: "founder-alpha",
      release: "448e244-test",
    }), "trainer_request_missing");

    await admin.query(
      "INSERT INTO app.trainer_profiles (user_id, status) VALUES ($1, 'pending')",
      [trainerUserId],
    );
    assert.equal(await operator.activateTrainer({
      trainerEmail: email,
      operatorRef: "founder-alpha",
      release: "448e244-test",
    }), "activated");
    assert.equal(await operator.activateTrainer({
      trainerEmail: email,
      operatorRef: "founder-alpha",
      release: "448e244-test",
    }), "already_active");

    const profile = await admin.query<{ status: string }>(
      "SELECT status::text FROM app.trainer_profiles WHERE user_id = $1",
      [trainerUserId],
    );
    assert.equal(profile.rows[0].status, "active");
    const audit = await admin.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM app.audit_events
       WHERE subject_user_id = $1
         AND event_type = 'access.trainer_capability.operator_activated'`,
      [trainerUserId],
    );
    assert.equal(audit.rowCount, 1);
    assert.deepEqual(audit.rows[0].metadata, {
      source: "closed_alpha_operator",
      operator_ref: "founder-alpha",
      release: "448e244-test",
    });
    assert.equal(JSON.stringify(audit.rows[0].metadata).includes(email), false);
  } finally {
    await Promise.all([admin.end(), operatorPool.end()]);
  }
});

test("closed-alpha cohort status reveals readiness flags without participant identity", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 1 });
  const operatorPool = new Pool({
    connectionString,
    max: 1,
    options: "-c role=ai_strength_operator",
  });
  const emails = [0, 1, 2].map((index) => `cohort-${index}-${randomUUID()}@example.test`);
  try {
    const [trainerUserId, athleteOneUserId, athleteTwoUserId] = await Promise.all(
      emails.map((email) => account(admin, email)),
    );
    await admin.query(
      "INSERT INTO app.trainer_profiles (user_id, status, activated_at) VALUES ($1, 'active', clock_timestamp())",
      [trainerUserId],
    );
    await admin.query(
      "INSERT INTO app.athlete_profiles (user_id) VALUES ($1), ($2)",
      [athleteOneUserId, athleteTwoUserId],
    );
    await admin.query(
      `INSERT INTO app.trainer_athlete_relations (trainer_user_id, athlete_user_id)
       VALUES ($1, $2)`,
      [trainerUserId, athleteOneUserId],
    );

    const operator = new ClosedAlphaOperator(operatorPool);
    await assert.rejects(
      operator.status({ trainerEmail: emails[0], athleteEmails: [emails[1], emails[1]] }),
      /alpha_participant_emails_must_be_distinct/,
    );
    const waiting = await operator.status({ trainerEmail: emails[0], athleteEmails: emails.slice(1) });
    assert.equal(waiting.ready, false);
    assert.deepEqual(waiting.blockers, ["athlete_2_invitation_acceptance_required"]);
    assert.equal(JSON.stringify(waiting).includes("@example.test"), false);

    await admin.query(
      `INSERT INTO app.trainer_athlete_relations (trainer_user_id, athlete_user_id)
       VALUES ($1, $2)`,
      [trainerUserId, athleteTwoUserId],
    );
    const ready = await operator.status({ trainerEmail: emails[0], athleteEmails: emails.slice(1) });
    assert.equal(ready.ready, true);
    assert.deepEqual(ready.blockers, []);
    assert.equal(ready.athletes.every((athlete) => athlete.relationActive), true);
  } finally {
    await Promise.all([admin.end(), operatorPool.end()]);
  }
});
