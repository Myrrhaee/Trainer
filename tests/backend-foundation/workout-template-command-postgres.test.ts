import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { PoolClient } from "pg";
import { Pool } from "pg";

import {
  WorkoutBuilderCommandError,
  WorkoutBuilderRepository,
} from "../../lib/server/workouts/workout-builder-repository";
import { workoutTemplateRequestFingerprint } from "../../lib/server/workouts/workout-template-command-crypto";
import type {
  BuilderItem,
  SaveBuilderTemplateInput,
} from "../../lib/server/workouts/workout-builder-types";

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

function exercise(instanceId: string, complete = true) {
  return {
    instanceId,
    exerciseId: `legacy-${instanceId}`,
    title: `Упражнение ${instanceId}`,
    category: "Сила",
    prescription: {
      type: "repetitions" as const,
      sets: complete ? "3" : "",
      repetitionMode: "range" as const,
      repetitionsMin: complete ? "8" : "",
      repetitionsMax: complete ? "10" : "",
      durationSec: "",
      targetWeightKg: "",
      restSec: complete ? "90" : "",
    },
    perSetMode: false,
    setOverrides: [],
    trainerNote: "",
  };
}

function content(input: {
  title?: string;
  revision?: number;
  items?: BuilderItem[];
} = {}): SaveBuilderTemplateInput {
  return {
    title: input.title ?? "R2D3 template",
    revision: input.revision ?? 1,
    description: "Command contract",
    category: "Сила",
    estimatedDurationMin: "45",
    generalInstruction: "Без отказа.",
    items: input.items ?? [{ id: "exercise-row", kind: "exercise", exercise: exercise("one") }],
  };
}

function command<T extends object>(value: T) {
  return { ...value, requestFingerprint: workoutTemplateRequestFingerprint(value) };
}

async function createDraft(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  draft: SaveBuilderTemplateInput,
) {
  const input = command({
    commandId: randomUUID(),
    templateId: randomUUID(),
    revisionId: randomUUID(),
    expectedEditToken: null,
    content: draft,
  });
  return { input, result: await repository.saveDraft(actor, input) };
}

async function publish(
  repository: WorkoutBuilderRepository,
  actor: { userId: string },
  template: { id: string; revisionId: string; editToken: string | null },
) {
  assert.ok(template.editToken);
  const input = command({
    commandId: randomUUID(),
    templateId: template.id,
    revisionId: template.revisionId,
    expectedEditToken: template.editToken,
  });
  return { input, result: await repository.publish(actor, input) };
}

function expectCode(code: string) {
  return (error: unknown) => error instanceof WorkoutBuilderCommandError && error.commandCode === code;
}

test("partial Draft persists null facts and only a complete persisted Draft can publish", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new WorkoutBuilderRepository(app);
  const owner = await trainer(admin, "R2D3 partial owner");
  try {
    const partialItem: BuilderItem = {
      id: "partial-superset",
      kind: "superset",
      label: "",
      instruction: "",
      exercises: [exercise("partial", false)],
    };
    const created = await createDraft(repository, owner, content({ title: "", items: [partialItem] }));
    assert.equal(created.result.template.title, "");
    assert.equal(created.result.template.items[0].kind, "superset");
    const stored = await admin.query<{
      sets: number | null;
      repetitions: number | null;
      repetitions_min: number | null;
      rest_seconds: number | null;
    }>(`SELECT sets, repetitions, repetitions_min, rest_seconds
        FROM app.workout_template_exercises WHERE revision_id = $1`,
    [created.result.template.revisionId]);
    assert.deepEqual(stored.rows[0], {
      sets: null,
      repetitions: null,
      repetitions_min: null,
      rest_seconds: null,
    });
    await assert.rejects(
      publish(repository, owner, created.result.template),
      (error: unknown) => error instanceof WorkoutBuilderCommandError
        && error.commandCode === "publication_validation_failed"
        && error.issues.some((entry) => entry.path === "template.title")
        && error.issues.some((entry) => entry.path === "supersets.partial-superset.members")
        && error.issues.some((entry) => entry.path === "exercises.partial.prescription.sets"),
    );

    const saveInput = command({
      commandId: randomUUID(),
      templateId: created.result.template.id,
      revisionId: created.result.template.revisionId,
      expectedEditToken: created.result.template.editToken,
      content: content({ revision: 1 }),
    });
    const saved = await repository.saveDraft(owner, saveInput);
    assert.notEqual(saved.template.editToken, created.result.template.editToken);
    const published = await publish(repository, owner, saved.template);
    assert.equal(published.result.template.status, "published");
    assert.equal(published.result.template.editToken, null);
    const replay = await repository.publish(owner, published.input);
    assert.equal(replay.replay, true);
    assert.equal(replay.template.revisionId, published.result.template.revisionId);

    const invalid = await createDraft(repository, owner, content({ title: "Invalid direct publish", items: [] }));
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE app.workout_template_revisions
        SET status = 'published', published_at = clock_timestamp()
        WHERE id = $1`, [invalid.result.template.revisionId]);
      await client.query(`UPDATE app.workout_templates
        SET status = 'published',
            published_revision_id = $2,
            editable_revision_id = NULL,
            updated_at = clock_timestamp()
        WHERE id = $1`, [invalid.result.template.id, invalid.result.template.revisionId]);
      await assert.rejects(client.query("SET CONSTRAINTS ALL IMMEDIATE"), /workout_template_publication_invalid/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("edit tokens and durable command receipts prevent stale or changed retries", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new WorkoutBuilderRepository(app);
  const owner = await trainer(admin, "R2D3 concurrency owner");
  const stranger = await trainer(admin, "R2D3 concurrency stranger");
  try {
    const created = await createDraft(repository, owner, content());
    const original = created.result.template;
    const firstInput = command({
      commandId: randomUUID(),
      templateId: original.id,
      revisionId: original.revisionId,
      expectedEditToken: original.editToken,
      content: content({ title: "First tab wins" }),
    });
    const concurrent = await Promise.all([
      repository.saveDraft(owner, firstInput),
      repository.saveDraft(owner, firstInput),
    ]);
    assert.deepEqual(concurrent.map((result) => result.replay).sort(), [false, true]);
    const first = concurrent.find((result) => !result.replay)!;
    const exactReplay = await repository.saveDraft(owner, firstInput);
    assert.equal(exactReplay.replay, true);
    assert.equal(exactReplay.template.title, "First tab wins");

    const staleInput = command({
      commandId: randomUUID(),
      templateId: original.id,
      revisionId: original.revisionId,
      expectedEditToken: original.editToken,
      content: content({ title: "Second tab loses" }),
    });
    await assert.rejects(repository.saveDraft(owner, staleInput), expectCode("draft_version_conflict"));
    await assert.rejects(repository.saveDraft(owner, {
      ...firstInput,
      content: content({ title: "Changed retry" }),
      requestFingerprint: workoutTemplateRequestFingerprint({ ...firstInput, content: content({ title: "Changed retry" }) }),
    }), expectCode("command_id_conflict"));
    await assert.rejects(repository.saveDraft(owner, command({
      commandId: randomUUID(),
      templateId: first.template.id,
      revisionId: first.template.revisionId,
      expectedEditToken: `${first.template.editToken}tampered`,
      content: content({ title: "Tampered" }),
    })), expectCode("draft_version_conflict"));
    await assert.rejects(repository.saveDraft(stranger, command({
      commandId: randomUUID(),
      templateId: first.template.id,
      revisionId: first.template.revisionId,
      expectedEditToken: first.template.editToken,
      content: content({ title: "Foreign" }),
    })), expectCode("template_not_found"));
    await assert.rejects(repository.saveDraft(stranger, firstInput), expectCode("template_not_found"));

    await assert.rejects(repository.saveDraft(owner, command({
      commandId: randomUUID(),
      templateId: first.template.id,
      revisionId: first.template.revisionId,
      expectedEditToken: null,
      content: content({ title: "Missing token" }),
    })), expectCode("draft_version_conflict"));

    const persisted = await repository.list(owner);
    assert.equal(persisted.find((template) => template.id === first.template.id)?.title, "First tab wins");
    const audits = await admin.query<{ count: string }>(`SELECT count(*)::text AS count
      FROM app.audit_events WHERE event_type = 'workout.template.draft_saved'
        AND metadata->>'template_id' = $1`, [first.template.id]);
    assert.equal(audits.rows[0].count, "2");
    const receipts = await admin.query<{ count: string }>(`SELECT count(*)::text AS count
      FROM app.workout_template_command_receipts WHERE result_template_id = $1`, [first.template.id]);
    assert.equal(receipts.rows[0].count, "2");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("create revision, duplicate and archive are replay-safe and preserve immutable lineage", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const repository = new WorkoutBuilderRepository(app);
  const owner = await trainer(admin, "R2D3 lifecycle owner");
  try {
    const created = await createDraft(repository, owner, content());
    const published = await publish(repository, owner, created.result.template);
    const createRevisionInput = command({
      commandId: randomUUID(),
      templateId: published.result.template.id,
      expectedTemplateToken: published.result.template.templateToken,
    });
    const revision = await repository.createRevision(owner, createRevisionInput);
    const revisionReplay = await repository.createRevision(owner, createRevisionInput);
    assert.equal(revisionReplay.replay, true);
    assert.equal(revisionReplay.template.revisionId, revision.template.revisionId);
    assert.equal(revision.template.latestPublishedRevision?.revisionId, published.result.template.revisionId);

    const duplicateInput = command({
      commandId: randomUUID(),
      sourceTemplateId: published.result.template.id,
      sourceRevisionIntent: "published" as const,
      newTemplateId: randomUUID(),
      newRevisionId: randomUUID(),
      title: "Independent copy",
    });
    const duplicate = await repository.duplicate(owner, duplicateInput);
    const duplicateReplay = await repository.duplicate(owner, duplicateInput);
    assert.equal(duplicateReplay.replay, true);
    assert.equal(duplicateReplay.template.id, duplicate.template.id);
    assert.equal(duplicate.template.status, "draft");
    assert.equal(duplicate.template.latestPublishedRevision, null);
    assert.notEqual(duplicate.template.items[0].id, published.result.template.items[0].id);
    if (duplicate.template.items[0].kind !== "exercise" || published.result.template.items[0].kind !== "exercise") {
      throw new Error("unexpected_item");
    }
    assert.equal(duplicate.template.items[0].exercise.exerciseId,
      published.result.template.items[0].exercise.exerciseId);
    assert.notEqual(duplicate.template.items[0].exercise.instanceId,
      published.result.template.items[0].exercise.instanceId);

    const archiveInput = command({
      commandId: randomUUID(),
      templateId: duplicate.template.id,
      expectedTemplateToken: duplicate.template.templateToken,
    });
    const archived = await repository.archive(owner, archiveInput);
    assert.equal(archived.template.status, "archived");
    assert.equal((await repository.archive(owner, archiveInput)).replay, true);
    const secondArchive = command({
      commandId: randomUUID(),
      templateId: duplicate.template.id,
      expectedTemplateToken: null,
    });
    assert.equal((await repository.archive(owner, secondArchive)).outcome, "already_archived");
    const assignmentCount = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.workout_assignments WHERE source_template_id = ANY($1::uuid[])",
      [[published.result.template.id, duplicate.template.id]],
    );
    assert.equal(assignmentCount.rows[0].count, "0");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("aggregate save query count remains bounded from one to forty exercises", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const owner = await trainer(admin, "R2D3 query owner");
  try {
    async function measure(size: number) {
      const counted = countedPool(app);
      const repository = new WorkoutBuilderRepository(counted.pool);
      const items = Array.from({ length: size }, (_, index) => ({
        id: `row-${index}`,
        kind: "exercise" as const,
        exercise: exercise(`query-${index}`),
      }));
      await createDraft(repository, owner, content({ title: `Query ${size}`, items }));
      return counted.count();
    }
    const one = await measure(1);
    const ten = await measure(10);
    const forty = await measure(40);
    assert.equal(ten, one);
    assert.equal(forty, one);
    assert.ok(forty <= 20, `expected bounded save query count, got ${forty}`);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("Builder mutation API exposes strict commands and no content-bearing Publish path", async () => {
  const files = await Promise.all([
    "app/api/trainer/workout-builder/templates/route.ts",
    "app/api/trainer/workout-builder/templates/[templateId]/publish/route.ts",
    "app/api/trainer/workout-builder/templates/[templateId]/revisions/route.ts",
    "app/api/trainer/workout-builder/templates/[templateId]/archive/route.ts",
    "app/api/trainer/workout-builder/templates/duplicate/route.ts",
    "app/api/trainer/workout-templates/route.ts",
  ].map((file) => readFile(path.join(process.cwd(), file), "utf8")));
  assert.match(files[0], /saveDraft\(actor, body\)/);
  assert.match(files[1], /publish\(actor, templateId, body\)/);
  assert.match(files[4], /duplicate\(actor, body\)/);
  assert.match(files[5], /legacy_template_mutation_removed/);
  const service = await readFile(path.join(process.cwd(), "lib/server/workouts/workout-builder-service.ts"), "utf8");
  assert.match(service, /publish_content_forbidden/);
  assert.doesNotMatch(files.join("\n"), /createAssignment|ProgramAssignment|localStorage|demo-data/);
});

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
