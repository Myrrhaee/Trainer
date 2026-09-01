import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { PoolClient } from "pg";
import { Pool } from "pg";

import {
  createExerciseSelectionSnapshot,
  projectExerciseSourceAvailability,
} from "../../lib/exercise-library-contract";
import { ExerciseLibraryInvalidCursorError } from "../../lib/server/exercise-library/exercise-library-cursor";
import { ExerciseLibraryQueryService } from "../../lib/server/exercise-library/exercise-library-query-service";
import { ExerciseLibraryRepository } from "../../lib/server/exercise-library/exercise-library-repository";
import { normalizeExerciseLibraryInput } from "../../lib/server/exercise-library/exercise-library-query-service";
import { QuickAssignQueryService } from "../../lib/server/quick-assign/quick-assign-query-service";
import { QuickAssignRepository } from "../../lib/server/quick-assign/quick-assign-repository";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import type { SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";
import { publishBuilderDraft, saveBuilderDraft } from "./workout-builder-test-driver";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

async function createTrainer(pool: Pool, displayName: string, status = "active") {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    VALUES ($1, $2::app.trainer_capability_status,
      CASE WHEN $2::text = 'active' THEN clock_timestamp() ELSE NULL END)`,
  [user.rows[0].id, status]);
  return { userId: user.rows[0].id };
}

async function createAthlete(pool: Pool, displayName: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [user.rows[0].id]);
  return { userId: user.rows[0].id };
}

async function relate(pool: Pool, trainerUserId: string, athleteUserId: string) {
  const result = await pool.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, 'active', true) RETURNING id`, [trainerUserId, athleteUserId]);
  return result.rows[0].id;
}

async function insertTrainerExercise(pool: Pool, input: {
  owner: string;
  stableKey: string;
  title: string;
  status?: "active" | "archived";
  description?: string | null;
  category?: string | null;
  equipment?: string | null;
  bodyRegion?: string | null;
  imagePath?: string | null;
}) {
  const status = input.status ?? "active";
  const result = await pool.query<{ id: string }>(`
    INSERT INTO app.exercises
      (id, stable_key, scope, owner_trainer_user_id, status, title, description,
       category, equipment, body_region, image_asset_path, image_asset_available, archived_at)
    VALUES
      (gen_random_uuid(), $1, 'trainer', $2, $3::app.exercise_status, $4, $5, $6, $7, $8, $9::text,
       $9::text IS NOT NULL, CASE WHEN $3::text = 'archived' THEN clock_timestamp() ELSE NULL END)
    RETURNING id
  `, [
    input.stableKey,
    input.owner,
    status,
    input.title,
    input.description ?? null,
    input.category ?? null,
    input.equipment ?? null,
    input.bodyRegion ?? null,
    input.imagePath ?? null,
  ]);
  return result.rows[0].id;
}

test("R2D.2 seed is deterministic, canonical and excludes unsupported demo facts", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 2 });
  try {
    const seedSource = JSON.parse(await readFile(
      path.join(process.cwd(), "database/seeds/system-exercises-v1.json"),
      "utf8",
    )) as { version: number; exercises: Array<Record<string, unknown>> };
    assert.equal(seedSource.version, 1);
    assert.equal(seedSource.exercises.length, 182);
    assert.equal(new Set(seedSource.exercises.map((row) => row.exerciseId)).size, 182);
    assert.equal(new Set(seedSource.exercises.map((row) => row.stableKey)).size, 182);
    assert.equal(seedSource.exercises.some((row) => (
      "recommendation" in row || "difficulty" in row || "tips" in row || "videoUrl" in row
    )), false);

    const rows = await admin.query<{
      count: number;
      ids: number;
      keys: number;
      unsafe_paths: number;
      unavailable_images: number;
    }>(`
      SELECT count(*)::integer AS count,
        count(DISTINCT id)::integer AS ids,
        count(DISTINCT stable_key)::integer AS keys,
        count(*) FILTER (WHERE image_asset_path IS NOT NULL AND (
          image_asset_path NOT LIKE 'exercises/%'
          OR image_asset_path LIKE '%..%'
          OR image_asset_path LIKE '%://%'
        ))::integer AS unsafe_paths,
        count(*) FILTER (WHERE NOT image_asset_available)::integer AS unavailable_images
      FROM app.exercises WHERE scope = 'system'
    `);
    assert.deepEqual(rows.rows[0], {
      count: 182,
      ids: 182,
      keys: 182,
      unsafe_paths: 0,
      unavailable_images: 5,
    });
    const databaseIds = await admin.query<{ id: string; stable_key: string }>(
      "SELECT id, stable_key FROM app.exercises WHERE scope = 'system' ORDER BY stable_key",
    );
    assert.deepEqual(
      databaseIds.rows,
      seedSource.exercises
        .map((row) => ({ id: row.exerciseId, stable_key: row.stableKey }))
        .sort((left, right) => String(left.stable_key).localeCompare(String(right.stable_key))),
    );
    const unsupportedColumns = await admin.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'exercises'
        AND column_name = ANY($1::text[])
    `, [["popularity", "recommendation", "difficulty_score", "athlete_suitability"]]);
    assert.equal(unsupportedColumns.rowCount, 0);
    await assert.rejects(
      admin.query("DELETE FROM app.exercises WHERE id = $1", [databaseIds.rows[0].id]),
      /hard delete is not supported/,
    );
    await assert.rejects(
      admin.query(`INSERT INTO app.exercises
        (id, stable_key, scope, status, title, image_asset_path, image_asset_available)
        VALUES (gen_random_uuid(), 'r2d2-unsafe-path', 'system', 'active',
          'Unsafe path', '/Users/private/exercise.webp', true)`),
      /exercises_image_asset_path/,
    );
    await assert.rejects(
      admin.query(`INSERT INTO app.exercises
        (id, stable_key, scope, status, title)
        VALUES (gen_random_uuid(), 'r2d2-empty-title', 'system', 'active', '   ')`),
      /exercises_title_length/,
    );
  } finally {
    await admin.end();
  }
});

test("Exercise Library list is actor-scoped, searchable, filterable and cursor-safe with constant query count", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 5, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2D2 list trainer");
  const stranger = await createTrainer(admin, "R2D2 list stranger");
  const inactive = await createTrainer(admin, "R2D2 inactive trainer", "pending");
  const client = await createAthlete(admin, "R2D2 list athlete");
  await insertTrainerExercise(admin, {
    owner: trainer.userId,
    stableKey: "r2d2-list-own-row",
    title: "Моя тяга для поиска",
    description: "Контроль лопаток",
    category: "Спина",
    equipment: "Гантели",
    bodyRegion: "Верх тела",
  });
  await insertTrainerExercise(admin, {
    owner: stranger.userId,
    stableKey: "r2d2-list-foreign-row",
    title: "Скрытое чужое упражнение",
    category: "Секрет",
  });
  await insertTrainerExercise(admin, {
    owner: trainer.userId,
    stableKey: "r2d2-list-archived-row",
    title: "Архивное упражнение",
    status: "archived",
  });
  const service = new ExerciseLibraryQueryService(new ExerciseLibraryRepository(app));
  try {
    const mutationClient = await app.connect();
    try {
      await mutationClient.query("BEGIN");
      await mutationClient.query("SELECT set_config('app.actor_user_id', $1, true)", [trainer.userId]);
      await assert.rejects(
        mutationClient.query(`UPDATE app.exercises SET title = 'Forbidden mutation'
          WHERE id = '1bd102f7-3ba3-56e5-9f72-e0f2e3cd472e'`),
        /permission denied/,
      );
      await mutationClient.query("ROLLBACK");
    } finally {
      mutationClient.release();
    }

    const mine = await service.list(trainer, { scope: "trainer" });
    assert.deepEqual(mine.items.map((item) => item.stableKey), ["r2d2-list-own-row"]);
    assert.equal(mine.items.some((item) => item.title.includes("чужое")), false);
    assert.equal(mine.items.some((item) => item.title.includes("Архивное")), false);

    const titleSearch = await service.list(trainer, { query: "моя тяга для поиска" });
    const descriptionSearch = await service.list(trainer, { query: "контроль лопаток" });
    const category = await service.list(trainer, { category: "спина", scope: "trainer" });
    const equipment = await service.list(trainer, { equipment: "гантели", scope: "trainer" });
    const bodyRegion = await service.list(trainer, { bodyRegion: "верх тела", scope: "trainer" });
    for (const model of [titleSearch, descriptionSearch, category, equipment, bodyRegion]) {
      assert.equal(model.items.some((item) => item.stableKey === "r2d2-list-own-row"), true);
    }

    const first = await service.list(trainer, { first: 17 });
    assert.equal(first.items.length, 17);
    assert.equal(first.pageInfo.hasNextPage, true);
    assert.ok(first.pageInfo.endCursor);
    const second = await service.list(trainer, { first: 17, after: first.pageInfo.endCursor });
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.exerciseId)).size, 34);
    await assert.rejects(
      service.list(stranger, { first: 17, after: first.pageInfo.endCursor }),
      ExerciseLibraryInvalidCursorError,
    );
    await assert.rejects(
      service.list(trainer, { first: 17, query: "спина", after: first.pageInfo.endCursor }),
      ExerciseLibraryInvalidCursorError,
    );

    assert.equal((await service.list(inactive)).items.length, 0);
    assert.equal((await service.list(client)).items.length, 0);
    assert.equal((await service.list(stranger, { scope: "trainer", query: "нет такого" })).items.length, 0);

    const countedSmall = countedPool(app);
    const countedLarge = countedPool(app);
    await new ExerciseLibraryQueryService(new ExerciseLibraryRepository(countedSmall.pool)).list(trainer, { first: 1 });
    await new ExerciseLibraryQueryService(new ExerciseLibraryRepository(countedLarge.pool)).list(trainer, { first: 50 });
    assert.equal(countedSmall.count(), countedLarge.count());
    assert.ok(countedLarge.count() <= 4, `expected one set-based read transaction, got ${countedLarge.count()}`);

    const repository = new ExerciseLibraryRepository(app);
    const explainInputs = [
      normalizeExerciseLibraryInput({}),
      normalizeExerciseLibraryInput({ query: "тяга" }),
      normalizeExerciseLibraryInput({ category: "спина", equipment: "гантели" }),
      normalizeExerciseLibraryInput({ scope: "trainer" }),
    ];
    for (const input of explainInputs) {
      const plan = await repository.explainList(trainer, input, null);
      assert.equal(plan.rows.length > 0, true);
      assert.match(plan.rows.map((row) => Object.values(row)[0]).join("\n"), /exercises/i);
    }
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("exact detail exposes archived and image-unavailable states without foreign disclosure", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2D2 detail trainer");
  const stranger = await createTrainer(admin, "R2D2 detail stranger");
  const archivedId = await insertTrainerExercise(admin, {
    owner: trainer.userId,
    stableKey: "r2d2-detail-archived",
    title: "Архивный detail",
    status: "archived",
  });
  const noImageId = await insertTrainerExercise(admin, {
    owner: trainer.userId,
    stableKey: "r2d2-detail-no-image",
    title: "Detail без изображения",
    category: "Ноги",
  });
  const foreignId = await insertTrainerExercise(admin, {
    owner: stranger.userId,
    stableKey: "r2d2-detail-foreign",
    title: "Foreign detail",
  });
  const service = new ExerciseLibraryQueryService(new ExerciseLibraryRepository(app));
  try {
    const system = await service.detail(trainer, "1bd102f7-3ba3-56e5-9f72-e0f2e3cd472e");
    assert.equal(system?.scope, "system");
    assert.equal(system?.canSelect, true);
    assert.equal(system?.image.availability, "ready");

    const archived = await service.detail(trainer, archivedId);
    assert.equal(archived?.sourceAvailability, "archived");
    assert.equal(archived?.canSelect, false);
    assert.deepEqual(archived?.anomalies, ["source_archived", "image_unavailable"]);

    const noImage = await service.detail(trainer, noImageId);
    assert.equal(noImage?.image.availability, "image_unavailable");
    assert.equal(noImage?.canSelect, true);
    assert.deepEqual(noImage?.anomalies, ["image_unavailable"]);
    assert.equal(await service.detail(trainer, foreignId), null);
    assert.equal(projectExerciseSourceAvailability({
      sourceExerciseId: null,
      sourceExerciseKey: "legacy-unmapped",
      detail: null,
    }), "source_not_mapped");
    assert.equal(projectExerciseSourceAvailability({
      sourceExerciseId: foreignId,
      sourceExerciseKey: "r2d2-detail-foreign",
      detail: null,
    }), "unavailable");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("canonical source provenance preserves Template and Assignment snapshots", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2D2 snapshot trainer");
  const stranger = await createTrainer(admin, "R2D2 snapshot stranger");
  const athlete = await createAthlete(admin, "R2D2 snapshot athlete");
  await relate(admin, trainer.userId, athlete.userId);
  const sourceId = await insertTrainerExercise(admin, {
    owner: trainer.userId,
    stableKey: "r2d2-snapshot-source",
    title: "Canonical source title",
    description: "Canonical source description",
    category: "Ноги",
    equipment: "Штанга",
    bodyRegion: "Низ тела",
    imagePath: "exercises/test/r2d2-source.webp",
  });
  const foreignSourceId = await insertTrainerExercise(admin, {
    owner: stranger.userId,
    stableKey: "r2d2-foreign-source",
    title: "Foreign source",
  });
  const builder = new WorkoutBuilderRepository(app);
  const workouts = new PostgresWorkoutRepository(app);
  try {
    const detail = await new ExerciseLibraryQueryService(new ExerciseLibraryRepository(app)).detail(trainer, sourceId);
    assert.ok(detail);
    const selection = createExerciseSelectionSnapshot(detail);
    assert.deepEqual(selection, {
      sourceExerciseId: sourceId,
      sourceExerciseKey: "r2d2-snapshot-source",
      title: "Canonical source title",
      category: "Ноги",
      equipment: "Штанга",
      description: "Canonical source description",
      imageUrl: "/exercises/test/r2d2-source.webp",
    });

    const saved = await saveBuilderDraft(builder, trainer, snapshotDraft());
    assert.ok(saved);
    const revision = await admin.query<{ id: string }>(`
      SELECT id FROM app.workout_template_revisions
      WHERE template_id = $1 AND revision_number = $2
    `, [saved.id, saved.revision]);
    await admin.query("SELECT app.backfill_workout_template_exercise_sources()");
    const linked = await admin.query<{
      id: string;
      instance_key: string;
      source_exercise_id: string;
      title: string;
    }>(`
      SELECT id, instance_key, source_exercise_id, title
      FROM app.workout_template_exercises
      WHERE revision_id = $1 ORDER BY position
    `, [revision.rows[0].id]);
    assert.equal(linked.rows.length, 2);
    assert.equal(new Set(linked.rows.map((row) => row.instance_key)).size, 2);
    assert.deepEqual(linked.rows.map((row) => row.source_exercise_id), [sourceId, sourceId]);
    assert.deepEqual(linked.rows.map((row) => row.title), ["Snapshot A", "Snapshot B"]);

    await assert.rejects(
      admin.query(`UPDATE app.workout_template_exercises
        SET source_exercise_id = $1, source_exercise_key = 'r2d2-foreign-source'
        WHERE id = $2`, [foreignSourceId, linked.rows[0].id]),
      /source is not selectable/,
    );

    const published = await publishBuilderDraft(builder, trainer, saved.id);
    assert.ok(published);
    const quickAssign = await new QuickAssignQueryService(new QuickAssignRepository(app)).find(trainer, athlete.userId);
    assert.ok(quickAssign);
    const assignment = await workouts.createAssignment(trainer, {
      assignmentId: "71717171-7171-4717-8717-717171717171",
      athleteUserId: athlete.userId,
      templateId: saved.id,
      templateRevisionId: revision.rows[0].id,
      scheduledFor: quickAssign.calendar.tomorrow,
      trainerNote: "Snapshot contract",
      assignmentStateToken: quickAssign.athlete.assignmentStateToken,
      allowAdditionalAssignment: false,
    });
    assert.ok(assignment);
    const beforeAssignment = await admin.query<{ value: unknown }>(`
      SELECT jsonb_agg(to_jsonb(exercise) ORDER BY exercise.position) AS value
      FROM app.workout_assignment_exercises exercise WHERE assignment_id = $1
    `, [assignment.id]);

    await admin.query(`UPDATE app.exercises
      SET title = 'Updated source title', status = 'archived', archived_at = clock_timestamp()
      WHERE id = $1`, [sourceId]);
    const afterTemplate = await admin.query<{ title: string; source_exercise_id: string }>(`
      SELECT title, source_exercise_id FROM app.workout_template_exercises
      WHERE revision_id = $1 ORDER BY position
    `, [revision.rows[0].id]);
    const afterAssignment = await admin.query<{ value: unknown }>(`
      SELECT jsonb_agg(to_jsonb(exercise) ORDER BY exercise.position) AS value
      FROM app.workout_assignment_exercises exercise WHERE assignment_id = $1
    `, [assignment.id]);
    assert.deepEqual(afterTemplate.rows.map((row) => row.title), ["Snapshot A", "Snapshot B"]);
    assert.deepEqual(afterTemplate.rows.map((row) => row.source_exercise_id), [sourceId, sourceId]);
    assert.deepEqual(afterAssignment.rows[0].value, beforeAssignment.rows[0].value);
    const archivedDetail = await new ExerciseLibraryQueryService(new ExerciseLibraryRepository(app)).detail(trainer, sourceId);
    assert.equal(archivedDetail?.sourceAvailability, "archived");
    assert.equal(createExerciseSelectionSnapshot(archivedDetail!), null);

    const ambiguous = await saveBuilderDraft(builder, trainer, ambiguousDraft());
    assert.ok(ambiguous);
    await insertTrainerExercise(admin, {
      owner: trainer.userId,
      stableKey: "demo-ex-back-1",
      title: "Trainer duplicate of system key",
    });
    await assert.rejects(
      admin.query("SELECT app.backfill_workout_template_exercise_sources()"),
      /r2d2_exercise_source_preflight_failed/,
    );
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("Exercise Library API surface is read-only and has no demo or Supabase runtime fallback", async () => {
  const sources = await Promise.all([
    readFile(path.join(process.cwd(), "app/api/trainer/exercises/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "app/api/trainer/exercises/[exerciseId]/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "lib/server/exercise-library/exercise-library-repository.ts"), "utf8"),
    readFile(path.join(process.cwd(), "lib/server/exercise-library/exercise-library-query-service.ts"), "utf8"),
  ]);
  const combined = sources.join("\n");
  assert.match(sources[0], /export async function GET/);
  assert.match(sources[1], /export async function GET/);
  assert.doesNotMatch(combined, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(combined, /demo-data|getDemoLibraryExercises|supabase|localStorage/i);
  assert.match(combined, /ExerciseLibraryQueryService/);
});

function snapshotDraft(): SaveBuilderTemplateInput {
  const exercise = (instanceId: string, title: string) => ({
    instanceId,
    exerciseId: "r2d2-snapshot-source",
    title,
    category: "Snapshot category",
    equipment: "Snapshot equipment",
    description: "Snapshot description",
    imageUrl: "/snapshot.webp",
    prescription: {
      type: "repetitions" as const,
      sets: "3",
      repetitionMode: "fixed" as const,
      repetitionsMin: "8",
      repetitionsMax: "8",
      durationSec: "",
      targetWeightKg: "70",
      restSec: "120",
    },
    perSetMode: false,
    setOverrides: [],
    trainerNote: "Snapshot note",
  });
  return {
    title: "R2D2 snapshot template",
    revision: 1,
    description: "Snapshot independence",
    category: "Сила",
    estimatedDurationMin: "45",
    generalInstruction: "Keep snapshot facts",
    items: [
      { id: "row-a", kind: "exercise", exercise: exercise("source-instance-a", "Snapshot A") },
      { id: "row-b", kind: "exercise", exercise: exercise("source-instance-b", "Snapshot B") },
    ],
  };
}

function ambiguousDraft(): SaveBuilderTemplateInput {
  const draft = snapshotDraft();
  const item = draft.items[0];
  if (item.kind !== "exercise") throw new Error("unexpected_snapshot_fixture");
  return {
    ...draft,
    title: "R2D2 ambiguous source",
    items: [{
      ...item,
      id: "ambiguous-row",
      exercise: {
        ...item.exercise,
        instanceId: "ambiguous-instance",
        exerciseId: "demo-ex-back-1",
        title: "Ambiguous legacy snapshot",
      },
    }],
  };
}

function countedPool(pool: Pool) {
  let queries = 0;
  const counted = {
    async connect() {
      const client = await pool.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query") {
            return (...args: Parameters<PoolClient["query"]>) => {
              queries += 1;
              return (target.query as (...queryArgs: Parameters<PoolClient["query"]>) => unknown)(...args);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
  return { pool: counted, count: () => queries };
}
