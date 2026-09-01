import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { PoolClient } from "pg";
import { Pool } from "pg";

import {
  decodeTemplateWorkspaceCursor,
  TemplateWorkspaceInvalidCursorError,
} from "../../lib/server/template-workspace/template-workspace-cursor";
import {
  normalizeTemplateWorkspaceInput,
  TemplateWorkspaceQueryService,
} from "../../lib/server/template-workspace/template-workspace-query-service";
import { TemplateWorkspaceRepository } from "../../lib/server/template-workspace/template-workspace-repository";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import { workoutTemplateRequestFingerprint } from "../../lib/server/workouts/workout-template-command-crypto";
import type { BuilderItem, BuilderTemplate, SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";

const connectionString = process.env.TEST_DATABASE_URL;

test("Template Workspace projects four lifecycles, dual summaries, exact facets and server-side matches", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 5, options: "-c role=ai_strength_app" });
  const owner = await createTrainer(admin, "R2D4 lifecycle owner");
  const builder = new WorkoutBuilderRepository(app);
  const service = new TemplateWorkspaceQueryService(new TemplateWorkspaceRepository(app));
  try {
    const draftOnly = await createDraft(builder, owner, content({
      title: "Пустой черновик",
      category: "  Мобильность  ",
      items: [],
    }));
    const publishedOnly = await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Готовая силовая",
      category: "Сила",
    })));
    const publishedBase = await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Старое рабочее название",
      category: "Грудь",
    })));
    const editable = await createRevision(builder, owner, publishedBase);
    const update = await saveDraft(builder, owner, editable, content({
      title: "Новая версия ног",
      category: "Ноги",
      revision: editable.revision,
      items: [item("first", 2), item("second", 4)],
    }));

    const archivedDraft = await archive(builder, owner, await createDraft(builder, owner, content({
      title: "Архив черновика",
      category: "Архив",
    })));
    const archivedPublished = await archive(builder, owner, await publish(
      builder,
      owner,
      await createDraft(builder, owner, content({ title: "Архив публикации", category: "Архив" })),
    ));
    const archiveBase = await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Архив published",
      category: "История",
    })));
    const archiveEditable = await createRevision(builder, owner, archiveBase);
    const archivedBoth = await archive(builder, owner, await saveDraft(
      builder,
      owner,
      archiveEditable,
      content({
        title: "Архив draft",
        category: "Черновая история",
        revision: archiveEditable.revision,
      }),
    ));

    const all = await service.list(owner, { first: 50 });
    assert.deepEqual(new Set(all.items.map((entry) => entry.templateId)), new Set([
      draftOnly.id,
      publishedOnly.id,
      update.id,
    ]));
    assert.deepEqual(all.facets.lifecycle, {
      all: 3,
      drafts: 1,
      published: 1,
      updates: 1,
      archive: 3,
    });
    assert.equal(all.resultCount.value, 3);
    assert.equal(all.items.some((entry) => "canAssign" in entry.capabilities), false);

    const draftItem = all.items.find((entry) => entry.templateId === draftOnly.id);
    assert.equal(draftItem?.lifecycle, "draft_only");
    assert.equal(draftItem?.primaryRevision?.exerciseCount, 0);
    assert.equal(draftItem?.primaryRevision?.prescribedSetCount, 0);
    assert.equal(draftItem?.capabilities.canContinueDraft, true);
    assert.equal(draftItem?.capabilities.canCreateRevision, false);
    assert.ok(draftItem?.actionPreconditions.lifecycleActionToken);

    const publishedItem = all.items.find((entry) => entry.templateId === publishedOnly.id);
    assert.equal(publishedItem?.lifecycle, "published_only");
    assert.equal(publishedItem?.publishedRevision?.publicationAvailability, "assignable");
    assert.equal(publishedItem?.capabilities.canCreateRevision, true);

    const updateItem = all.items.find((entry) => entry.templateId === update.id);
    assert.equal(updateItem?.lifecycle, "published_with_draft");
    assert.equal(updateItem?.primaryRevision?.title, "Новая версия ног");
    assert.equal(updateItem?.editableRevision?.exerciseCount, 2);
    assert.equal(updateItem?.editableRevision?.prescribedSetCount, 6);
    assert.equal(updateItem?.publishedRevision?.title, "Старое рабочее название");
    assert.equal(updateItem?.publishedRevision?.exerciseCount, 1);
    assert.equal(updateItem?.capabilities.canCreateRevision, false);
    assert.deepEqual(updateItem?.matchContext, { query: null, category: null });
    assert.deepEqual(Object.keys(updateItem ?? {}).includes("items"), false);

    assert.deepEqual((await service.list(owner, { status: "drafts" })).items.map((entry) => entry.templateId), [draftOnly.id]);
    assert.deepEqual((await service.list(owner, { status: "published" })).items.map((entry) => entry.templateId), [publishedOnly.id]);
    assert.deepEqual((await service.list(owner, { status: "updates" })).items.map((entry) => entry.templateId), [update.id]);
    const archiveModel = await service.list(owner, { status: "archive", first: 50 });
    assert.deepEqual(new Set(archiveModel.items.map((entry) => entry.templateId)), new Set([
      archivedDraft.id,
      archivedPublished.id,
      archivedBoth.id,
    ]));
    const archivedBothItem = archiveModel.items.find((entry) => entry.templateId === archivedBoth.id);
    assert.equal(archivedBothItem?.primaryRevision?.title, "Архив draft");
    assert.equal(archivedBothItem?.publishedRevision?.title, "Архив published");
    assert.equal(archivedBothItem?.publishedRevision?.publicationAvailability, "historical");
    assert.equal(archivedBothItem?.capabilities.canOpenArchived, true);
    assert.equal(archivedBothItem?.capabilities.canArchive, false);
    assert.equal(archivedBothItem?.actionPreconditions.lifecycleActionToken, null);
    assert.equal(archivedBothItem?.actionPreconditions.duplicateSource?.intent, "latest_saved");

    const secondarySearch = await service.list(owner, { query: "старое рабочее название" });
    assert.deepEqual(secondarySearch.items.map((entry) => entry.templateId), [update.id]);
    assert.equal(secondarySearch.items[0].matchContext.query, "published_secondary");
    const secondaryCategory = await service.list(owner, { category: "  ГРУДЬ " });
    assert.deepEqual(secondaryCategory.items.map((entry) => entry.templateId), [update.id]);
    assert.equal(secondaryCategory.items[0].matchContext.category, "published_secondary");
    assert.equal((await service.list(owner, { category: "неизвестная категория" })).items.length, 0);
    assert.equal((await service.list(owner, { query: "" })).facets.lifecycle.all, 3);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("Template Workspace cursor is complete, actor-safe and query count stays constant for 100 templates", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const owner = await createTrainer(admin, "R2D4 pagination owner");
  const foreign = await createTrainer(admin, "R2D4 pagination foreign");
  const inactive = await createTrainer(admin, "R2D4 inactive", "pending");
  const athlete = await createAthlete(admin, "R2D4 client actor");
  try {
    await insertDraftTemplates(admin, owner.userId, 100);
    await insertDraftTemplates(admin, foreign.userId, 3);
    await insertDraftTemplates(admin, inactive.userId, 2);
    const builder = new WorkoutBuilderRepository(app);
    await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Mixed published",
      category: "Сила",
    })));
    const mixedBase = await publish(builder, owner, await createDraft(builder, owner, content({
      title: "Mixed update published",
      category: "Сила",
    })));
    await createRevision(builder, owner, mixedBase);
    await archive(builder, owner, await createDraft(builder, owner, content({
      title: "Mixed archive",
      category: "Сила",
    })));
    const service = new TemplateWorkspaceQueryService(new TemplateWorkspaceRepository(app));
    const seen: string[] = [];
    let after: string | null = null;
    do {
      const page = await service.list(owner, { status: "drafts", first: 17, after });
      seen.push(...page.items.map((entry) => entry.templateId));
      after = page.pageInfo.endCursor;
      if (!page.pageInfo.hasNextPage) assert.equal(after, null);
    } while (after);
    assert.equal(seen.length, 100);
    assert.equal(new Set(seen).size, 100);

    const first = await service.list(owner, { status: "drafts", first: 17 });
    assert.ok(first.pageInfo.endCursor);
    await assert.rejects(
      service.list(foreign, { status: "drafts", first: 17, after: first.pageInfo.endCursor }),
      TemplateWorkspaceInvalidCursorError,
    );
    await assert.rejects(
      service.list(owner, { status: "all", first: 17, after: first.pageInfo.endCursor }),
      TemplateWorkspaceInvalidCursorError,
    );
    await assert.rejects(
      service.list(owner, { status: "drafts", query: "другое", first: 17, after: first.pageInfo.endCursor }),
      TemplateWorkspaceInvalidCursorError,
    );
    await assert.rejects(
      service.list(owner, { status: "drafts", category: "другое", first: 17, after: first.pageInfo.endCursor }),
      TemplateWorkspaceInvalidCursorError,
    );
    assert.equal((await service.list(foreign, { status: "drafts" })).items.length, 3);
    assert.equal((await service.list(inactive)).items.length, 0);
    assert.equal((await service.list(athlete)).items.length, 0);

    const small = countedPool(app);
    const large = countedPool(app);
    await new TemplateWorkspaceQueryService(new TemplateWorkspaceRepository(small.pool)).list(owner, { first: 1 });
    await new TemplateWorkspaceQueryService(new TemplateWorkspaceRepository(large.pool)).list(owner, { first: 50 });
    assert.equal(small.count(), large.count());
    assert.ok(large.count() <= 7, `expected two set-based reads in one transaction, got ${large.count()}`);

    const repository = new TemplateWorkspaceRepository(app);
    const explainCases = [
      {},
      { status: "drafts" },
      { status: "published" },
      { status: "updates" },
      { status: "archive" },
      { query: "шаблон" },
      { category: "сила" },
      { query: "шаблон", category: "сила" },
    ];
    for (const raw of explainCases) {
      const input = normalizeTemplateWorkspaceInput(raw);
      const plan = await repository.explainList(owner, input, null);
      const text = plan.rows.map((row) => Object.values(row)[0]).join("\n");
      assert.match(text, /workout_templates/i);
    }
    const cursorInput = normalizeTemplateWorkspaceInput({ status: "drafts", first: 17 });
    const cursor = decodeTemplateWorkspaceCursor(first.pageInfo.endCursor ?? "", {
      trainerUserId: owner.userId,
      lifecycle: cursorInput.lifecycle,
      query: cursorInput.query,
      category: cursorInput.category,
      sort: "meaningful_updated_desc",
    });
    const cursorPlan = await repository.explainList(owner, cursorInput, cursor);
    assert.match(cursorPlan.rows.map((row) => Object.values(row)[0]).join("\n"), /workout_templates/i);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

function content(input: {
  title: string;
  category: string;
  revision?: number;
  items?: BuilderItem[];
}): SaveBuilderTemplateInput {
  return {
    title: input.title,
    revision: input.revision ?? 1,
    description: `Описание ${input.title}`,
    category: input.category,
    estimatedDurationMin: "45",
    generalInstruction: "Спокойный темп.",
    items: input.items ?? [item("base", 3)],
  };
}

function item(key: string, sets: number): BuilderItem {
  return {
    id: `row-${key}`,
    kind: "exercise",
    exercise: {
      instanceId: key,
      exerciseId: `legacy-${key}`,
      title: `Упражнение ${key}`,
      category: "Сила",
      prescription: {
        type: "repetitions",
        sets: String(sets),
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
    },
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
  const value = {
    commandId: randomUUID(),
    templateId: template.id,
    revisionId: template.revisionId,
    expectedEditToken: template.editToken,
    content: draft,
  };
  assert.ok(value.expectedEditToken);
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

async function insertDraftTemplates(pool: Pool, trainerUserId: string, count: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE r2d4_templates ON COMMIT DROP AS
      SELECT gen_random_uuid() AS template_id, gen_random_uuid() AS revision_id, value
      FROM generate_series(1, $1::integer) value`, [count]);
    await client.query(`INSERT INTO app.workout_templates
      (id, trainer_user_id, title, description, status, current_revision)
      SELECT template_id, $1, 'Шаблон ' || value, 'Массовый список', 'draft', 1
      FROM r2d4_templates`, [trainerUserId]);
    await client.query(`INSERT INTO app.workout_template_revisions
      (id, template_id, revision_number, title, description, category,
       estimated_duration_min, general_instruction, status, published_at)
      SELECT revision_id, template_id, 1, 'Шаблон ' || value, 'Массовый список',
             'Сила', NULL, '', 'draft', NULL
      FROM r2d4_templates`);
    await client.query(`UPDATE app.workout_templates template
      SET editable_revision_id = source.revision_id,
          updated_at = clock_timestamp() + source.value * interval '1 millisecond'
      FROM r2d4_templates source WHERE template.id = source.template_id`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
