import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { AthleteProfileQueryService } from "../../lib/server/athlete-profile/athlete-profile-query-service";
import { AthleteProfileRepository } from "../../lib/server/athlete-profile/athlete-profile-repository";
import { withActorTransaction } from "../../lib/server/database/actor-context";

const connectionString = process.env.TEST_DATABASE_URL;

async function user(pool: Pool, displayName: string, kind: "trainer" | "athlete") {
  const account = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  if (kind === "trainer") {
    await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
      VALUES ($1, 'active', clock_timestamp())`, [account.rows[0].id]);
  } else {
    await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [account.rows[0].id]);
  }
  return { userId: account.rows[0].id };
}

test("canonical athlete profile is athlete-owned, trainer-readable and relation-scoped", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  try {
    const trainer = await user(admin, "R1 Trainer", "trainer");
    const athlete = await user(admin, "R1 Athlete", "athlete");
    const stranger = await user(admin, "R1 Stranger", "trainer");
    const relation = await admin.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
      (trainer_user_id, athlete_user_id, status, is_primary)
      VALUES ($1,$2,'active',true) RETURNING id`, [trainer.userId, athlete.userId]);

    await withActorTransaction(athlete, (client) => client.query(`UPDATE app.athlete_profiles SET
      goal_summary = 'Вернуться к регулярным тренировкам',
      biography = 'Работаю в офисе и тренируюсь вечером',
      training_preferences = ARRAY['Силовые тренировки'],
      available_equipment = ARRAY['Штанга', 'Гантели'],
      schedule_context = 'Три вечера в неделю'
      WHERE user_id = $1`, [athlete.userId]), app);

    const trainerMutation = await withActorTransaction(trainer, (client) => client.query(
      "UPDATE app.athlete_profiles SET biography = 'trainer mutation' WHERE user_id = $1",
      [athlete.userId],
    ), app);
    assert.equal(trainerMutation.rowCount, 0);

    const service = new AthleteProfileQueryService(new AthleteProfileRepository(app));
    const profile = await service.find(trainer, athlete.userId, { from: "clients" });
    assert.ok(profile);
    assert.equal(profile.frame.identity.displayName, "R1 Athlete");
    assert.equal(profile.frame.identity.goal, "Вернуться к регулярным тренировкам");
    assert.equal(profile.frame.currentState.kind, "no_next_assignment");
    assert.equal(profile.frame.availableActions.primary?.kind, "assign");
    assert.equal(profile.frame.permissions.canEditAthleteFacts, false);
    assert.deepEqual(profile.overview.trainingContext.availableEquipment, ["Штанга", "Гантели"]);
    assert.equal(await service.find(stranger, athlete.userId, {}), null);

    await admin.query(`UPDATE app.trainer_athlete_relations SET status = 'suspended'
      WHERE id = $1`, [relation.rows[0].id]);
    const suspended = await service.find(trainer, athlete.userId, {});
    assert.ok(suspended);
    assert.equal(suspended.frame.currentState.kind, "relation_unavailable");
    assert.equal(suspended.frame.availableActions.primary, null);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
