import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { PoolClient } from "pg";
import { Pool } from "pg";

import {
  WorkoutTemplateEditorNotFoundError,
  WorkoutTemplateEditorViewUnavailableError,
} from "../../lib/server/template-editor/workout-template-editor-types";
import { WorkoutTemplateEditorQueryService } from "../../lib/server/template-editor/workout-template-editor-query-service";
import { WorkoutTemplateEditorRepository } from "../../lib/server/template-editor/workout-template-editor-repository";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import { workoutTemplateRequestFingerprint } from "../../lib/server/workouts/workout-template-command-crypto";
import type {
  BuilderExercise,
  BuilderItem,
  BuilderSet,
  BuilderTemplate,
  SaveBuilderTemplateInput,
} from "../../lib/server/workouts/workout-builder-types";

const connectionString = process.env.TEST_DATABASE_URL;

test("Editor resolves canonical Draft, Published and Archived pointers without creating bootstrap rows", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const owner = await createTrainer(admin, "R2D6 lifecycle owner");
  const foreign = await createTrainer(admin, "R2D6 lifecycle foreign");
  const inactive = await createTrainer(admin, "R2D6 lifecycle inactive", "pending");
  const athlete = await createAthlete(admin, "R2D6 lifecycle athlete");
  const builder = new WorkoutBuilderRepository(app);
  const service = new WorkoutTemplateEditorQueryService(new WorkoutTemplateEditorRepository(app));
  try {
    const before = await templateCount(admin, owner.userId);
    const bootstrap = await service.bootstrapNew(owner);
    assert.equal(bootstrap.mode, "new");
    assert.equal(bootstrap.identity, null);
    assert.equal(await templateCount(admin, owner.userId), before);
    await assert.rejects(service.bootstrapNew(inactive), WorkoutTemplateEditorNotFoundError);
    await assert.rejects(service.bootstrapNew(athlete), WorkoutTemplateEditorNotFoundError);

    const draft = await createDraft(builder, owner, content({ title: "", items: [] }));
    const draftDefault = await service.read(owner, draft.id, "default");
    const draftExact = await service.read(owner, draft.id, "editable");
    assert.equal(draftDefault.mode, "editable");
    assert.equal(draftDefault.identity?.selectedRevisionId, draft.revisionId);
    assert.equal(draftExact.identity?.selectedRevisionId, draft.revisionId);
    assert.equal(draftDefault.content.exercises.length, 0);
    assert.ok(draftDefault.validation.publicationBlockers.some((issue) => issue.path === "template.title"));
    assert.ok(draftDefault.validation.publicationBlockers.some((issue) => issue.path === "template.exercises"));
    assert.equal(draftDefault.capabilities.canSaveDraft, true);
    assert.ok(draftDefault.concurrency.editToken);
    assert.equal("canAssign" in draftDefault.capabilities, false);
    await assert.rejects(
      service.read(owner, draft.id, "published"),
      (error) => error instanceof WorkoutTemplateEditorViewUnavailableError
        && error.code === "published_revision_not_found",
    );

    const published = await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Published exact",
      items: [exerciseItem(exercise("published-a"))],
    })));
    const publishedDefault = await service.read(owner, published.id, "default");
    const publishedExact = await service.read(owner, published.id, "published");
    assert.equal(publishedDefault.mode, "published");
    assert.equal(publishedDefault.identity?.selectedRevisionId, published.revisionId);
    assert.equal(publishedExact.identity?.selectedRevisionId, published.revisionId);
    assert.equal(publishedExact.capabilities.canSaveDraft, false);
    assert.equal(publishedExact.concurrency.editToken, null);
    await assert.rejects(
      service.read(owner, published.id, "editable"),
      (error) => error instanceof WorkoutTemplateEditorViewUnavailableError
        && error.code === "editable_draft_not_found",
    );

    const revision = await createRevision(builder, owner, published);
    const updated = await saveDraft(builder, owner, revision, content({
      title: "Editable exact",
      revision: revision.revision,
      items: [exerciseItem(exercise("editable-a", { title: "Draft exercise" }))],
    }));
    const activeDefault = await service.read(owner, updated.id, "default");
    const activePublished = await service.read(owner, updated.id, "published");
    assert.equal(activeDefault.mode, "editable");
    assert.equal(activeDefault.content.title, "Editable exact");
    assert.equal(activePublished.mode, "published");
    assert.equal(activePublished.content.title, "Published exact");
    assert.equal(activePublished.identity?.selectedRevisionId, published.revisionId);
    assert.equal(activePublished.lifecycle.editableRevisionSummary?.title, "Editable exact");
    assert.equal(activePublished.lifecycle.publishedRevisionSummary?.title, "Published exact");
    assert.equal(activePublished.capabilities.canContinueDraft, true);
    assert.equal(activePublished.capabilities.canCreateRevision, false);

    const archived = await archive(builder, owner, updated);
    const archivedDefault = await service.read(owner, archived.id, "default");
    const archivedExact = await service.read(owner, archived.id, "archived");
    assert.equal(archivedDefault.mode, "archived");
    assert.equal(archivedDefault.identity?.selectedRevisionRole, "archived_editable");
    assert.equal(archivedExact.content.title, "Editable exact");
    assert.equal(archivedExact.capabilities.canSaveDraft, false);
    assert.equal(archivedExact.capabilities.canAttemptPublish, false);
    assert.equal(archivedExact.capabilities.canCreateRevision, false);
    assert.equal(archivedExact.capabilities.canArchive, false);
    assert.equal(archivedExact.concurrency.editToken, null);
    await assert.rejects(service.read(owner, archived.id, "editable"), WorkoutTemplateEditorViewUnavailableError);

    await assert.rejects(service.read(foreign, archived.id, "default"), WorkoutTemplateEditorNotFoundError);
    await assert.rejects(service.read(athlete, archived.id, "default"), WorkoutTemplateEditorNotFoundError);
    const inactiveTemplate = await insertSimpleDraft(admin, inactive.userId, "Inactive exact");
    await assert.rejects(service.read(inactive, inactiveTemplate, "default"), WorkoutTemplateEditorNotFoundError);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("Editor preserves snapshot, semantic identities, partial Draft values, supersets and source states", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const owner = await createTrainer(admin, "R2D6 content owner");
  const foreign = await createTrainer(admin, "R2D6 content foreign");
  const ownSource = await insertTrainerExercise(admin, {
    owner: owner.userId,
    stableKey: "r2d6-own-source",
    title: "Canonical source title",
    imagePath: "exercises/r2d6-own.webp",
  });
  const noImageSource = await insertTrainerExercise(admin, {
    owner: owner.userId,
    stableKey: "r2d6-no-image",
    title: "Canonical source without image",
  });
  const foreignSource = await insertTrainerExercise(admin, {
    owner: foreign.userId,
    stableKey: "r2d6-foreign-source",
    title: "Foreign source title",
  });
  const builder = new WorkoutBuilderRepository(app);
  const service = new WorkoutTemplateEditorQueryService(new WorkoutTemplateEditorRepository(app));
  try {
    const perSet = exercise("own-instance", {
      exerciseId: "r2d6-own-source",
      sourceExerciseId: ownSource,
      title: "Persisted snapshot title",
      perSetMode: true,
      setOverrides: [
        set("warmup-key", 1, { kind: "warmup", repetitionsMin: "", repetitionsMax: "", restSec: "" }),
        set("working-key", 2, { targetWeightKg: "80" }),
      ],
    });
    const noImage = exercise("no-image-instance", {
      exerciseId: "r2d6-no-image",
      sourceExerciseId: noImageSource,
      title: "No-image snapshot",
    });
    const partialDuration = exercise("duration-instance", {
      exerciseId: "legacy-duration",
      title: "Partial duration",
      prescription: {
        type: "duration",
        sets: "",
        repetitionMode: "fixed",
        repetitionsMin: "",
        repetitionsMax: "",
        durationSec: "",
        targetWeightKg: "",
        restSec: "",
      },
    });
    const singleSuperset: BuilderItem = {
      id: "superset-one",
      kind: "superset",
      label: "Незавершённая пара",
      instruction: "Без отдыха",
      exercises: [noImage],
    };
    const saved = await createDraft(builder, owner, content({
      title: "Rich partial Draft",
      items: [exerciseItem(perSet), singleSuperset, exerciseItem(partialDuration)],
    }));

    const initial = await service.read(owner, saved.id, "editable");
    assert.deepEqual(initial.content.exercises.map((entry) => entry.instanceKey), [
      "own-instance",
      "no-image-instance",
      "duration-instance",
    ]);
    assert.deepEqual(initial.content.exercises[0].sets.map((entry) => entry.setKey), ["warmup-key", "working-key"]);
    assert.equal(initial.content.exercises[0].sets[0].repetitionsMin, null);
    assert.equal(initial.content.exercises[0].sets[0].restSeconds, null);
    assert.equal(initial.content.exercises[2].prescription.setCount, null);
    assert.equal(initial.content.exercises[2].prescription.durationSeconds, null);
    assert.equal(initial.content.exercises[0].source.availability, "ready");
    assert.equal(initial.content.exercises[1].source.availability, "image_unavailable");
    assert.equal(initial.content.exercises[2].source.availability, "source_not_mapped");
    assert.equal(initial.dataAvailability, "source_partial");
    assert.ok(initial.validation.publicationBlockers.some((issue) => issue.setKey === "warmup-key"));
    assert.ok(initial.validation.publicationBlockers.some((issue) => issue.supersetKey === "superset-one"));
    assert.equal(initial.content.exercises[1].superset?.supersetKey, "superset-one");
    assert.ok(initial.anomalies.includes("invalid_superset"));

    await admin.query("UPDATE app.exercises SET title = 'Changed canonical title' WHERE id = $1", [ownSource]);
    const afterSourceUpdate = await service.read(owner, saved.id, "editable");
    assert.equal(afterSourceUpdate.content.exercises[0].snapshot.title, "Persisted snapshot title");
    assert.equal(afterSourceUpdate.content.exercises[0].source.currentStableKey, "r2d6-own-source");

    await admin.query(`UPDATE app.exercises
      SET status = 'archived', archived_at = clock_timestamp() WHERE id = $1`, [ownSource]);
    const afterSourceArchive = await service.read(owner, saved.id, "editable");
    assert.equal(afterSourceArchive.content.exercises[0].source.availability, "archived");
    assert.equal(afterSourceArchive.content.exercises[0].snapshot.title, "Persisted snapshot title");

    await assert.rejects(createDraft(builder, owner, content({
      title: "Foreign source attempt",
      items: [exerciseItem(exercise("foreign-instance", {
        exerciseId: "r2d6-foreign-source",
        sourceExerciseId: foreignSource,
      }))],
    })), /source_exercise_forbidden/);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("Editor exact-read query count is constant for 1, 10 and 40 exercises and plans stay bounded", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  const owner = await createTrainer(admin, "R2D6 query owner");
  const builder = new WorkoutBuilderRepository(app);
  try {
    const templates: BuilderTemplate[] = [];
    for (const count of [1, 10, 40]) {
      templates.push(await createDraft(builder, owner, content({
        title: `Query shape ${count}`,
        items: Array.from({ length: count }, (_, index) => exerciseItem(exercise(`query-${count}-${index + 1}`))),
      })));
    }

    const queryCounts: number[] = [];
    for (const template of templates) {
      const counted = countedPool(app);
      const model = await new WorkoutTemplateEditorQueryService(
        new WorkoutTemplateEditorRepository(counted.pool),
      ).read(owner, template.id, "editable");
      assert.equal(model.content.exercises.length, Number(model.content.title.split(" ").at(-1)));
      queryCounts.push(counted.count());
    }
    assert.deepEqual(new Set(queryCounts).size, 1);
    assert.ok(queryCounts[0] <= 7, `expected three bounded reads in one transaction, got ${queryCounts[0]}`);

    const repository = new WorkoutTemplateEditorRepository(app);
    const revisionId = templates[2].revisionId;
    const plans = await repository.explainExact(owner, templates[2].id, "editable", revisionId);
    const headerPlan = plans.header.map((row) => Object.values(row)[0]).join("\n");
    const exercisePlan = plans.exercises.map((row) => Object.values(row)[0]).join("\n");
    const setPlan = plans.sets.map((row) => Object.values(row)[0]).join("\n");
    assert.match(headerPlan, /workout_templates/i);
    assert.match(exercisePlan, /workout_template_exercises/i);
    assert.match(setPlan, /workout_template_exercise_sets/i);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

function content(input: {
  title: string;
  revision?: number;
  items: BuilderItem[];
}): SaveBuilderTemplateInput {
  return {
    title: input.title,
    revision: input.revision ?? 1,
    description: input.title ? `Описание ${input.title}` : "",
    category: input.title ? "Сила" : "",
    estimatedDurationMin: input.title ? "45" : "",
    generalInstruction: input.title ? "Спокойный темп." : "",
    items: input.items,
  };
}

function exercise(instanceId: string, overrides: Partial<BuilderExercise> = {}): BuilderExercise {
  return {
    instanceId,
    exerciseId: `legacy-${instanceId}`,
    title: `Упражнение ${instanceId}`,
    category: "Сила",
    prescription: {
      type: "repetitions",
      sets: "3",
      repetitionMode: "fixed",
      repetitionsMin: "8",
      repetitionsMax: "8",
      durationSec: "",
      targetWeightKg: "",
      restSec: "90",
    },
    perSetMode: false,
    setOverrides: [],
    trainerNote: "",
    ...overrides,
  };
}

function exerciseItem(value: BuilderExercise): BuilderItem {
  return { id: `row-${value.instanceId}`, kind: "exercise", exercise: value };
}

function set(id: string, order: number, overrides: Partial<BuilderSet> = {}): BuilderSet {
  return {
    id,
    order,
    kind: "working",
    repetitionsMin: "8",
    repetitionsMax: "8",
    durationSec: "",
    targetWeightKg: "",
    restSec: "90",
    usesOverride: true,
    ...overrides,
  };
}

async function createDraft(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  draft: SaveBuilderTemplateInput,
) {
  const value = {
    commandId: randomUUID(),
    templateId: randomUUID(),
    revisionId: randomUUID(),
    expectedEditToken: null,
    content: draft,
  };
  return (await repository.saveDraft(actor, {
    ...value,
    requestFingerprint: workoutTemplateRequestFingerprint(value),
  })).template;
}

async function saveDraft(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  template: BuilderTemplate,
  draft: SaveBuilderTemplateInput,
) {
  assert.ok(template.editToken);
  const value = {
    commandId: randomUUID(),
    templateId: template.id,
    revisionId: template.revisionId,
    expectedEditToken: template.editToken,
    content: draft,
  };
  return (await repository.saveDraft(actor, {
    ...value,
    requestFingerprint: workoutTemplateRequestFingerprint(value),
  })).template;
}

async function publish(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  template: BuilderTemplate,
) {
  assert.ok(template.editToken);
  const value = {
    commandId: randomUUID(),
    templateId: template.id,
    revisionId: template.revisionId,
    expectedEditToken: template.editToken,
  };
  return (await repository.publish(actor, {
    ...value,
    requestFingerprint: workoutTemplateRequestFingerprint(value),
  })).template;
}

async function createRevision(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  template: BuilderTemplate,
) {
  const value = {
    commandId: randomUUID(),
    templateId: template.id,
    expectedTemplateToken: template.templateToken,
  };
  return (await repository.createRevision(actor, {
    ...value,
    requestFingerprint: workoutTemplateRequestFingerprint(value),
  })).template;
}

async function archive(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  template: BuilderTemplate,
) {
  const value = {
    commandId: randomUUID(),
    templateId: template.id,
    expectedTemplateToken: template.templateToken,
  };
  return (await repository.archive(actor, {
    ...value,
    requestFingerprint: workoutTemplateRequestFingerprint(value),
  })).template;
}

async function createTrainer(pool: Pool, name: string, status = "active") {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    VALUES ($1, $2::app.trainer_capability_status,
      CASE WHEN $2::text = 'active' THEN clock_timestamp() ELSE NULL END)`, [user.rows[0].id, status]);
  return { userId: user.rows[0].id };
}

async function createAthlete(pool: Pool, name: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [name],
  );
  await pool.query("INSERT INTO app.athlete_profiles (user_id, status) VALUES ($1, 'active')", [user.rows[0].id]);
  return { userId: user.rows[0].id };
}

async function insertSimpleDraft(pool: Pool, trainerUserId: string, title: string) {
  const templateId = randomUUID();
  const revisionId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO app.workout_templates
      (id, trainer_user_id, title, description, status, current_revision)
      VALUES ($1, $2, $3, '', 'draft', 1)`, [templateId, trainerUserId, title]);
    await client.query(`INSERT INTO app.workout_template_revisions
      (id, template_id, revision_number, title, description, category,
       estimated_duration_min, general_instruction, status, published_at)
      VALUES ($1, $2, 1, $3, '', '', NULL, '', 'draft', NULL)`, [revisionId, templateId, title]);
    await client.query("UPDATE app.workout_templates SET editable_revision_id = $2 WHERE id = $1", [templateId, revisionId]);
    await client.query("COMMIT");
    return templateId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertTrainerExercise(pool: Pool, input: {
  owner: string;
  stableKey: string;
  title: string;
  imagePath?: string;
}) {
  const result = await pool.query<{ id: string }>(`INSERT INTO app.exercises
    (id, stable_key, scope, owner_trainer_user_id, status, title,
     category, image_asset_path, image_asset_available)
    VALUES (gen_random_uuid(), $1, 'trainer', $2, 'active', $3, 'Сила', $4, $4::text IS NOT NULL)
    RETURNING id`, [input.stableKey, input.owner, input.title, input.imagePath ?? null]);
  return result.rows[0].id;
}

async function templateCount(pool: Pool, trainerUserId: string) {
  const result = await pool.query<{ count: number }>(
    "SELECT count(*)::integer AS count FROM app.workout_templates WHERE trainer_user_id = $1",
    [trainerUserId],
  );
  return result.rows[0].count;
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
