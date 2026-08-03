import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { setTransactionActor } from "../../lib/server/database/actor-context";
import { withDatabaseTransaction } from "../../lib/server/database/transaction";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

async function createUser(pool: Pool, displayName: string) {
  const result = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  return { userId: result.rows[0].id };
}

async function createTrainer(pool: Pool, displayName: string) {
  const actor = await createUser(pool, displayName);
  await pool.query(
    `INSERT INTO app.trainer_profiles (user_id, status, activated_at)
     VALUES ($1, 'active', clock_timestamp())`,
    [actor.userId],
  );
  return actor;
}

async function createAthlete(pool: Pool, displayName: string) {
  const actor = await createUser(pool, displayName);
  await pool.query(
    "INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')",
    [actor.userId],
  );
  return actor;
}

async function relate(pool: Pool, trainerUserId: string, athleteUserId: string) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO app.trainer_athlete_relations (
       trainer_user_id, athlete_user_id, status, is_primary
     ) VALUES ($1, $2, 'active', true)
     RETURNING id`,
    [trainerUserId, athleteUserId],
  );
  return result.rows[0].id;
}

function templateInput(title = "Полное тело A") {
  return {
    title,
    description: "Базовая тренировка",
    generalInstruction: "Оставить два повтора в запасе.",
    estimatedDurationMin: 50,
    exercises: [
      {
        instanceKey: "exercise-1",
        title: "Присед со штангой",
        sets: 4,
        repetitions: 6,
        targetWeightKg: 80,
        restSeconds: 120,
        trainerNote: "Контролировать глубину",
      },
      {
        instanceKey: "exercise-2",
        title: "Жим лёжа",
        sets: 3,
        repetitions: 8,
        targetWeightKg: 60,
        restSeconds: 90,
        trainerNote: "",
      },
    ],
  };
}

test("trainer creates a saved template and athlete receives an independent assignment snapshot", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new PostgresWorkoutRepository(app);
  const trainer = await createTrainer(admin, "B5 Trainer");
  const athlete = await createAthlete(admin, "B5 Athlete");
  await relate(admin, trainer.userId, athlete.userId);

  try {
    const roster = await repository.listTrainerAthletes(trainer);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].displayName, "B5 Athlete");

    const template = await repository.createPublishedTemplate(trainer, templateInput());
    assert.equal(template.status, "published");
    assert.equal(template.revision, 1);
    assert.equal(template.exercises.length, 2);

    const assignment = await repository.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-05",
      trainerNote: "Сними последний подход.",
    });
    assert.ok(assignment);
    assert.equal(assignment.title, "Полное тело A");
    assert.equal(assignment.scheduledFor, "2026-08-05");
    assert.equal(assignment.exercises[0].targetWeightKg, 80);

    await assert.rejects(
      app.query(
        "UPDATE app.workout_template_exercises SET title = 'Mutation' WHERE revision_id = $1",
        [template.revisionId],
      ),
      (error: NodeJS.ErrnoException) => error.code === "42501",
    );

    await admin.query(
      "UPDATE app.workout_templates SET title = 'Новое имя шаблона' WHERE id = $1",
      [template.id],
    );
    const athleteAssignments = await repository.listAthleteAssignments(athlete);
    assert.equal(athleteAssignments.length, 1);
    assert.equal(athleteAssignments[0].title, "Полное тело A");
    assert.equal(athleteAssignments[0].scheduledFor, "2026-08-05");
    assert.equal(athleteAssignments[0].exercises[0].title, "Присед со штангой");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("unrelated actors cannot see templates, roster or another athlete assignment", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new PostgresWorkoutRepository(app);
  const trainer = await createTrainer(admin, "Isolated Trainer");
  const otherTrainer = await createTrainer(admin, "Other Trainer");
  const athlete = await createAthlete(admin, "Private Athlete B5");
  const otherAthlete = await createAthlete(admin, "Other Athlete B5");
  await relate(admin, trainer.userId, athlete.userId);
  await relate(admin, otherTrainer.userId, otherAthlete.userId);

  try {
    const template = await repository.createPublishedTemplate(trainer, templateInput("Закрытый шаблон"));
    await repository.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-06",
      trainerNote: "",
    });

    assert.equal((await repository.listTemplates(otherTrainer)).length, 0);
    assert.deepEqual(
      (await repository.listTrainerAthletes(otherTrainer)).map((row) => row.athleteUserId),
      [otherAthlete.userId],
    );
    assert.equal((await repository.listAthleteAssignments(otherAthlete)).length, 0);
    assert.equal(await repository.createAssignment(otherTrainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-06",
      trainerNote: "",
    }), null);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("ending a relation blocks future assignment but preserves athlete history", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new PostgresWorkoutRepository(app);
  const trainer = await createTrainer(admin, "Lifecycle Trainer");
  const athlete = await createAthlete(admin, "Lifecycle Athlete");
  const relationId = await relate(admin, trainer.userId, athlete.userId);

  try {
    const template = await repository.createPublishedTemplate(trainer, templateInput("Историческая тренировка"));
    assert.ok(await repository.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-07",
      trainerNote: "",
    }));

    await admin.query(
      `UPDATE app.trainer_athlete_relations
       SET status = 'ended', ended_at = clock_timestamp()
       WHERE id = $1`,
      [relationId],
    );

    assert.equal((await repository.listTrainerAthletes(trainer)).length, 0);
    assert.equal(await repository.createAssignment(trainer, {
      athleteUserId: athlete.userId,
      templateId: template.id,
      scheduledFor: "2026-08-08",
      trainerNote: "",
    }), null);
    assert.equal((await repository.listAthleteAssignments(athlete)).length, 1);
    const formerTrainerRows = await withDatabaseTransaction(app, async (client) => {
      await setTransactionActor(client, trainer);
      return client.query(
        "SELECT id FROM app.workout_assignments WHERE athlete_user_id = $1",
        [athlete.userId],
      );
    });
    assert.equal(formerTrainerRows.rowCount, 0);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
