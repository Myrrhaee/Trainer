import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

import { setTransactionActor } from "../../lib/server/database/actor-context";
import {
  WorkoutBuilderCommandError,
  WorkoutBuilderRepository,
} from "../../lib/server/workouts/workout-builder-repository";
import type { SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";
import {
  archiveBuilderTemplate,
  createBuilderRevision,
  publishBuilderDraft,
  saveBuilderDraft,
} from "./workout-builder-test-driver";
import {
  PostgresWorkoutRepository,
  WorkoutAssignmentIdempotencyConflictError,
} from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

async function trainer(pool: Pool, name: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    VALUES ($1, 'active', clock_timestamp())`, [user.rows[0].id]);
  return { userId: user.rows[0].id };
}

async function athlete(pool: Pool, name: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [user.rows[0].id]);
  return { userId: user.rows[0].id };
}

function draft(title = "Силовая база"): SaveBuilderTemplateInput {
  return {
    title,
    revision: 1,
    description: "Рабочий шаблон",
    category: "Сила",
    estimatedDurationMin: "55",
    generalInstruction: "Оставить два повтора в запасе.",
    items: [{
      id: "exercise-item-1",
      kind: "exercise",
      exercise: {
        instanceId: "exercise-instance-1",
        exerciseId: "barbell-squat",
        title: "Присед со штангой",
        category: "Ноги",
        equipment: "Штанга",
        prescription: {
          type: "repetitions",
          sets: "2",
          repetitionMode: "range",
          repetitionsMin: "6",
          repetitionsMax: "8",
          durationSec: "",
          targetWeightKg: "80",
          restSec: "120",
        },
        perSetMode: true,
        setOverrides: [
          { id: "set-1", order: 1, kind: "warmup", repetitionsMin: "8", repetitionsMax: "8", durationSec: "", targetWeightKg: "40", restSec: "60", usesOverride: true },
          { id: "set-2", order: 2, kind: "working", repetitionsMin: "6", repetitionsMax: "8", durationSec: "", targetWeightKg: "80", restSec: "120", usesOverride: true },
        ],
        trainerNote: "Колени по линии стоп.",
      },
    }],
  };
}

test("builder persists a rich draft, publishes it and creates an isolated next revision", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 3, options: "-c role=ai_strength_app" });
  const repository = new WorkoutBuilderRepository(app);
  const owner = await trainer(admin, "B6 Builder Owner");
  const stranger = await trainer(admin, "B6 Other Trainer");
  try {
    const empty = await saveBuilderDraft(repository, owner, { ...draft(""), title: "", items: [] });
    assert.ok(empty);
    assert.equal(empty.status, "draft");
    assert.equal(empty.items.length, 0);

    const saved = await saveBuilderDraft(repository, owner, { ...draft(), id: empty.id });
    assert.ok(saved);
    assert.equal(saved.items[0].kind, "exercise");
    if (saved.items[0].kind !== "exercise") throw new Error("unexpected_item");
    assert.equal(saved.items[0].exercise.setOverrides[0].kind, "warmup");
    assert.equal(saved.items[0].exercise.prescription.repetitionsMax, "8");

    const published = await publishBuilderDraft(repository, owner, saved.id);
    assert.equal(published?.status, "published");
    await assert.rejects(
      publishBuilderDraft(repository, owner, saved.id),
      (error: unknown) => error instanceof WorkoutBuilderCommandError
        && error.commandCode === "revision_already_published",
    );
    await assert.rejects(
      saveBuilderDraft(repository, owner, { ...draft("Mutation"), id: saved.id }),
      WorkoutBuilderCommandError,
    );
    assert.equal((await repository.list(stranger)).length, 0);
    assert.equal((await repository.list(owner)).find((item) => item.id === saved.id)?.status, "published");

    const revision = await createBuilderRevision(repository, owner, saved.id);
    assert.equal(revision?.status, "draft");
    assert.equal(revision?.revision, 2);
    assert.equal(revision?.latestPublishedRevision?.revision, 1);
    assert.equal(revision?.editableRevision?.revision, 2);
    assert.equal(revision?.items.length, 1);
    if (revision?.items[0].kind !== "exercise") throw new Error("unexpected_item");
    assert.equal(revision.items[0].exercise.setOverrides[1].targetWeightKg, "80");
    const replayedRevision = await createBuilderRevision(repository, owner, saved.id);
    assert.equal(replayedRevision?.revisionId, revision.revisionId);
    const revisionCount = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.workout_template_revisions WHERE template_id = $1",
      [saved.id],
    );
    assert.equal(revisionCount.rows[0].count, "2");
    await assert.rejects(createBuilderRevision(repository, stranger, saved.id), WorkoutBuilderCommandError);

    const appClient = await app.connect();
    try {
      await appClient.query("BEGIN");
      await setTransactionActor(appClient, owner);
      await appClient.query(
        "UPDATE app.workout_templates SET published_revision_id = NULL WHERE id = $1",
        [saved.id],
      );
      await assert.rejects(
        appClient.query("SET CONSTRAINTS ALL IMMEDIATE"),
        /template_lifecycle_conflict/,
      );
      await appClient.query("ROLLBACK");
    } finally {
      appClient.release();
    }

    const immutableClient = await app.connect();
    try {
      await immutableClient.query("BEGIN");
      await setTransactionActor(immutableClient, owner);
      const mutation = await immutableClient.query(
        "UPDATE app.workout_template_revisions SET title = 'Mutation denied' WHERE id = $1",
        [revision.latestPublishedRevision!.revisionId],
      );
      assert.equal(mutation.rowCount, 0);
      await immutableClient.query("COMMIT");
    } finally {
      immutableClient.release();
    }
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("archived builder templates are immutable and invisible to unrelated trainers", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 3, options: "-c role=ai_strength_app" });
  const repository = new WorkoutBuilderRepository(app);
  const owner = await trainer(admin, "B6 Archive Owner");
  const stranger = await trainer(admin, "B6 Archive Stranger");
  try {
    const saved = await saveBuilderDraft(repository, owner, draft("Архивный шаблон"));
    assert.ok(saved);
    const archived = await archiveBuilderTemplate(repository, owner, saved.id);
    assert.equal(archived?.status, "archived");
    await assert.rejects(
      saveBuilderDraft(repository, owner, { ...draft("Нельзя изменить"), id: saved.id }),
      WorkoutBuilderCommandError,
    );
    await assert.rejects(archiveBuilderTemplate(repository, stranger, saved.id), WorkoutBuilderCommandError);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("assignment copies rich per-set data and survives later template revisions", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  const app = new Pool({ connectionString, max: 3, options: "-c role=ai_strength_app" });
  const builder = new WorkoutBuilderRepository(app);
  const workouts = new PostgresWorkoutRepository(app);
  const owner = await trainer(admin, "B6 Snapshot Owner");
  const recipient = await athlete(admin, "B6 Snapshot Athlete");
  await admin.query(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, 'active', true)`, [owner.userId, recipient.userId]);
  try {
    const saved = await saveBuilderDraft(builder, owner, draft("Снимок подходов"));
    assert.ok(saved);
    const published = await publishBuilderDraft(builder, owner, saved.id);
    assert.ok(published);
    const assignment = await workouts.createAssignment(owner, {
      assignmentId: "11111111-2222-4333-8444-555555555555",
      athleteUserId: recipient.userId,
      templateId: published.id,
      scheduledFor: "2026-08-10",
      trainerNote: "Первое назначение",
    });
    assert.ok(assignment);
    const replay = await workouts.createAssignment(owner, {
      assignmentId: assignment.id,
      athleteUserId: recipient.userId,
      templateId: published.id,
      scheduledFor: "2026-08-10",
      trainerNote: "Первое назначение",
    });
    assert.equal(replay?.id, assignment.id);
    const assignmentCount = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.workout_assignments WHERE id = $1",
      [assignment.id],
    );
    assert.equal(assignmentCount.rows[0].count, "1");
    await assert.rejects(
      workouts.createAssignment(owner, {
        assignmentId: assignment.id,
        athleteUserId: recipient.userId,
        templateId: published.id,
        scheduledFor: "2026-08-11",
        trainerNote: "Другой запрос",
      }),
      WorkoutAssignmentIdempotencyConflictError,
    );
    const snapshot = await admin.query<{ target_weight_kg_snapshot: string }>(`
      SELECT assignment_set.target_weight_kg_snapshot
      FROM app.workout_assignment_exercise_sets assignment_set
      JOIN app.workout_assignment_exercises exercise
        ON exercise.id = assignment_set.assignment_exercise_id
      WHERE exercise.assignment_id = $1 AND assignment_set.position = 2`, [assignment.id]);
    assert.equal(Number(snapshot.rows[0].target_weight_kg_snapshot), 80);

    const revision = await createBuilderRevision(builder, owner, published.id);
    assert.ok(revision);
    const changed = draft("Снимок подходов v2");
    if (changed.items[0].kind !== "exercise") throw new Error("unexpected_item");
    changed.items[0].exercise.setOverrides[1].targetWeightKg = "90";
    assert.ok(await saveBuilderDraft(builder, owner, { ...changed, id: revision.id, revision: 2 }));
    const unchanged = await admin.query<{ target_weight_kg_snapshot: string }>(`
      SELECT assignment_set.target_weight_kg_snapshot
      FROM app.workout_assignment_exercise_sets assignment_set
      JOIN app.workout_assignment_exercises exercise
        ON exercise.id = assignment_set.assignment_exercise_id
      WHERE exercise.assignment_id = $1 AND assignment_set.position = 2`, [assignment.id]);
    assert.equal(Number(unchanged.rows[0].target_weight_kg_snapshot), 80);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});
