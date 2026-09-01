import assert from "node:assert/strict";
import test from "node:test";

import type { PoolClient } from "pg";
import { Pool } from "pg";

import { QuickAssignInvalidCursorError } from "../../lib/server/quick-assign/quick-assign-cursor";
import { QuickAssignQueryService } from "../../lib/server/quick-assign/quick-assign-query-service";
import { QuickAssignRepository } from "../../lib/server/quick-assign/quick-assign-repository";
import { WorkoutBuilderRepository } from "../../lib/server/workouts/workout-builder-repository";
import type { SaveBuilderTemplateInput } from "../../lib/server/workouts/workout-builder-types";
import {
  PostgresWorkoutRepository,
  WorkoutAssignmentCommandError,
  WorkoutAssignmentIdempotencyConflictError,
} from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

async function createTrainer(pool: Pool, displayName: string) {
  const user = await pool.query<{ id: string }>(
    "INSERT INTO app.users (status, display_name) VALUES ('active', $1) RETURNING id",
    [displayName],
  );
  await pool.query(`INSERT INTO app.trainer_profiles (user_id, status, activated_at)
    VALUES ($1, 'active', clock_timestamp())`, [user.rows[0].id]);
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

async function relate(pool: Pool, trainerUserId: string, athleteUserId: string, status = "active") {
  const result = await pool.query<{ id: string }>(`INSERT INTO app.trainer_athlete_relations
    (trainer_user_id, athlete_user_id, status, is_primary)
    VALUES ($1, $2, $3, true) RETURNING id`, [trainerUserId, athleteUserId, status]);
  return result.rows[0].id;
}

function simpleTemplate(title: string, description = "Базовая тренировка") {
  return {
    title,
    description,
    generalInstruction: "Оставить два повтора в запасе.",
    estimatedDurationMin: 45,
    exercises: [{
      instanceKey: `exercise-${title}`,
      title: "Присед со штангой",
      sets: 3,
      repetitions: 8,
      targetWeightKg: 70,
      restSeconds: 120,
      trainerNote: "Контроль техники",
    }],
  };
}

function richDraft(title: string): SaveBuilderTemplateInput {
  const exercise = (suffix: string, weight: string) => ({
    instanceId: `instance-${suffix}`,
    exerciseId: `exercise-${suffix}`,
    title: `Упражнение ${suffix}`,
    category: "Ноги",
    equipment: "Штанга",
    prescription: {
      type: "repetitions" as const,
      sets: "2",
      repetitionMode: "range" as const,
      repetitionsMin: "6",
      repetitionsMax: "8",
      durationSec: "",
      targetWeightKg: weight,
      restSec: "120",
    },
    perSetMode: true,
    setOverrides: [
      { id: `set-${suffix}-1`, order: 1, kind: "warmup" as const, repetitionsMin: "8", repetitionsMax: "8", durationSec: "", targetWeightKg: "30", restSec: "60", usesOverride: true },
      { id: `set-${suffix}-2`, order: 2, kind: "working" as const, repetitionsMin: "6", repetitionsMax: "8", durationSec: "", targetWeightKg: weight, restSec: "120", usesOverride: true },
    ],
    trainerNote: "Сохранять темп.",
  });
  return {
    title,
    revision: 1,
    description: "Силовая работа для нижней части тела",
    category: "Сила",
    estimatedDurationMin: "55",
    generalInstruction: "Без отказных повторов.",
    items: [{
      id: "superset-1",
      kind: "superset",
      label: "Суперсет A",
      instruction: "Без паузы между упражнениями.",
      exercises: [exercise("a", "80"), exercise("b", "60")],
    }],
  };
}

async function publishRich(builder: WorkoutBuilderRepository, actor: { userId: string }, title: string) {
  const saved = await builder.saveDraft(actor, richDraft(title));
  assert.ok(saved);
  const published = await builder.publish(actor, saved.id);
  assert.ok(published);
  return published;
}

function addDays(date: string, amount: number) {
  const source = new Date(`${date}T00:00:00Z`);
  source.setUTCDate(source.getUTCDate() + amount);
  return source.toISOString().slice(0, 10);
}

function expectCommandCode(code: string) {
  return (error: unknown) => error instanceof WorkoutAssignmentCommandError && error.commandCode === code;
}

test("QuickAssignReadModel scopes athlete, filters/searches/paginates templates and keeps query budget bounded", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 5, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2C Read Trainer");
  const athlete = await createAthlete(admin, "R2C Read Athlete");
  await relate(admin, trainer.userId, athlete.userId);
  const workouts = new PostgresWorkoutRepository(app);
  const builder = new WorkoutBuilderRepository(app);
  try {
    const rich = await publishRich(builder, trainer, "Силовой низ");
    const draft = await builder.saveDraft(trainer, richDraft("Черновик скрыт"));
    assert.ok(draft);
    const archived = await builder.saveDraft(trainer, richDraft("Архив скрыт"));
    assert.ok(archived);
    assert.ok(await builder.archive(trainer, archived.id));
    for (let index = 0; index < 27; index += 1) {
      await workouts.createPublishedTemplate(trainer, simpleTemplate(`Шаблон ${String(index).padStart(2, "0")}`, `Описание поиск ${index}`));
    }
    const emptyClient = await admin.connect();
    try {
      await emptyClient.query("BEGIN");
      const emptyTemplate = await emptyClient.query<{ id: string }>(`
        INSERT INTO app.workout_templates (trainer_user_id, title, description, status, current_revision)
        VALUES ($1, 'Пустой опубликованный', '', 'draft', 1) RETURNING id`, [trainer.userId]);
      const emptyRevision = await emptyClient.query<{ id: string }>(`
        INSERT INTO app.workout_template_revisions
          (template_id, revision_number, title, description, general_instruction,
           estimated_duration_min, status, published_at)
        VALUES ($1, 1, 'Пустой опубликованный', '', '', NULL, 'draft', NULL)
        RETURNING id`, [emptyTemplate.rows[0].id]);
      await emptyClient.query(`UPDATE app.workout_templates
        SET editable_revision_id = $2 WHERE id = $1`, [emptyTemplate.rows[0].id, emptyRevision.rows[0].id]);
      await emptyClient.query(`UPDATE app.workout_template_revisions
        SET status = 'published', published_at = clock_timestamp() WHERE id = $1`, [emptyRevision.rows[0].id]);
      await emptyClient.query(`UPDATE app.workout_templates
        SET status = 'published', published_revision_id = $2, editable_revision_id = NULL
        WHERE id = $1`, [emptyTemplate.rows[0].id, emptyRevision.rows[0].id]);
      await emptyClient.query("COMMIT");
    } finally {
      emptyClient.release();
    }

    const service = new QuickAssignQueryService(new QuickAssignRepository(app));
    const first = await service.find(trainer, athlete.userId, { first: 25 });
    assert.ok(first);
    assert.equal(first.athlete.displayName, "R2C Read Athlete");
    assert.equal(first.athlete.capabilities.canAssign, true);
    assert.equal(first.calendar.selectedScheduledFor, null);
    assert.equal(first.calendar.timezoneAvailability, "unavailable");
    assert.equal(first.templates.items.length, 25);
    assert.equal(first.templates.pageInfo.hasNextPage, true);
    assert.equal(first.templates.items.some((item) => item.title.includes("Черновик")), false);
    assert.equal(first.templates.items.some((item) => item.title.includes("Архив")), false);
    assert.equal(first.templates.items.some((item) => item.title.includes("Пустой")), false);
    const second = await service.find(trainer, athlete.userId, { first: 25, after: first.templates.pageInfo.endCursor });
    assert.ok(second);
    const ids = [...first.templates.items, ...second.templates.items].map((item) => item.templateId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(second.templates.pageInfo.hasNextPage, false);

    const titleSearch = await service.find(trainer, athlete.userId, { query: "силовой низ" });
    const descriptionSearch = await service.find(trainer, athlete.userId, { query: "описание поиск 7" });
    const categorySearch = await service.find(trainer, athlete.userId, { query: "сила" });
    assert.deepEqual(titleSearch?.templates.items.map((item) => item.templateId), [rich.id]);
    assert.equal(descriptionSearch?.templates.items.length, 1);
    assert.equal(categorySearch?.templates.items.some((item) => item.templateId === rich.id), true);
    await assert.rejects(
      service.find(trainer, athlete.userId, { query: "другой запрос", after: first.templates.pageInfo.endCursor }),
      QuickAssignInvalidCursorError,
    );

    const counted = countedPool(app);
    const richRevision = await revisionId(admin, rich.id, rich.revision);
    const measured = await new QuickAssignQueryService(new QuickAssignRepository(counted.pool)).find(
      trainer,
      athlete.userId,
      { templateRevisionId: richRevision },
    );
    assert.ok(measured);
    assert.equal(measured.selectedTemplate.status, "ready");
    assert.ok(counted.count() <= 20, `expected bounded query budget, got ${counted.count()}`);

    const lifecycleCounted = countedPool(app);
    const editable = await new WorkoutBuilderRepository(lifecycleCounted.pool).createRevision(trainer, rich.id);
    assert.ok(editable);
    assert.ok(lifecycleCounted.count() <= 16,
      `expected bounded lifecycle query budget, got ${lifecycleCounted.count()}`);
    assert.equal((await new QuickAssignRepository(app).findPreview(trainer, richRevision)).status, "ready");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("exact preview includes complete per-set and superset facts and returns authorized tombstones", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 3 });
  const app = new Pool({ connectionString, max: 4, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2C Preview Trainer");
  const stranger = await createTrainer(admin, "R2C Preview Stranger");
  const athlete = await createAthlete(admin, "R2C Preview Athlete");
  const strangerAthlete = await createAthlete(admin, "R2C Preview Other Athlete");
  await relate(admin, trainer.userId, athlete.userId);
  await relate(admin, stranger.userId, strangerAthlete.userId);
  const builder = new WorkoutBuilderRepository(app);
  try {
    const published = await publishRich(builder, trainer, "Точный preview");
    const revision = await revisionId(admin, published.id, published.revision);
    const repository = new QuickAssignRepository(app);
    const ready = await repository.findPreview(trainer, revision);
    assert.equal(ready.status, "ready");
    if (ready.status !== "ready") throw new Error("preview_not_ready");
    assert.equal(ready.template.exercises.length, 2);
    assert.equal(ready.template.exercises[0].setPrescriptions.length, 2);
    assert.equal(ready.template.exercises[0].setPrescriptions[1].targetWeightKg, 80);
    assert.equal(ready.template.exercises[0].superset?.label, "Суперсет A");
    assert.equal(ready.template.supersetCount, 1);
    assert.equal((await repository.findPreview(stranger, revision)).status, "unavailable");
    assert.equal(await new QuickAssignQueryService(repository).find(trainer, strangerAthlete.userId), null);

    const editable = await builder.createRevision(trainer, published.id);
    assert.ok(editable);
    assert.equal((await repository.findPreview(trainer, revision)).status, "ready");
    assert.equal((await repository.findPreview(trainer, editable.revisionId)).status, "draft");
    assert.ok(await builder.publish(trainer, published.id));
    assert.equal((await repository.findPreview(trainer, revision)).status, "stale_revision");

    const archived = await builder.saveDraft(trainer, richDraft("Архивный preview"));
    assert.ok(archived);
    const archivedRevision = await revisionId(admin, archived.id, archived.revision);
    assert.ok(await builder.archive(trainer, archived.id));
    assert.equal((await repository.findPreview(trainer, archivedRevision)).status, "archived");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("exact assignment enforces revision, state, duplicate and same-date contracts while preserving replay", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 6, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2C Command Trainer");
  const athlete = await createAthlete(admin, "R2C Command Athlete");
  const relationId = await relate(admin, trainer.userId, athlete.userId);
  const workouts = new PostgresWorkoutRepository(app);
  const builder = new WorkoutBuilderRepository(app);
  const query = new QuickAssignQueryService(new QuickAssignRepository(app));
  try {
    const firstTemplate = await publishRich(builder, trainer, "R2C Exact A");
    const secondTemplate = await publishRich(builder, trainer, "R2C Exact B");
    const firstRevision = await revisionId(admin, firstTemplate.id, firstTemplate.revision);
    const secondRevision = await revisionId(admin, secondTemplate.id, secondTemplate.revision);
    const initial = await query.find(trainer, athlete.userId);
    assert.ok(initial);
    const date = initial.calendar.tomorrow;
    const assignmentId = "10101010-1010-4010-8010-101010101010";
    const input = {
      assignmentId,
      athleteUserId: athlete.userId,
      templateId: firstTemplate.id,
      templateRevisionId: firstRevision,
      scheduledFor: date,
      trainerNote: "Точная версия",
      assignmentStateToken: initial.athlete.assignmentStateToken,
      allowAdditionalAssignment: false,
    };
    const assignment = await workouts.createAssignment(trainer, input);
    assert.ok(assignment);
    assert.equal(assignment.assignmentId, assignmentId);
    assert.equal(assignment.sourceRevisionId, firstRevision);
    assert.equal(assignment.sourceRevisionNumber, firstTemplate.revision);
    assert.equal(assignment.titleSnapshot, "R2C Exact A");

    const replay = await workouts.createAssignment(trainer, input);
    assert.equal(replay?.id, assignment.id);
    const effects = await admin.query<{ audits: string; outbox: string }>(`
      SELECT
        (SELECT count(*)::text FROM app.audit_events
          WHERE event_type = 'workout.assignment.created' AND metadata->>'assignment_id' = $1) AS audits,
        (SELECT count(*)::text FROM app.notification_outbox
          WHERE aggregate_type = 'workout_assignment' AND aggregate_id = $1::uuid) AS outbox
    `, [assignment.id]);
    assert.equal(effects.rows[0].audits, "1");
    assert.equal(effects.rows[0].outbox, "1");
    await assert.rejects(
      workouts.createAssignment(trainer, { ...input, scheduledFor: addDays(date, 1) }),
      WorkoutAssignmentIdempotencyConflictError,
    );

    const afterFirst = await query.find(trainer, athlete.userId);
    assert.ok(afterFirst);
    await assert.rejects(
      workouts.createAssignment(trainer, {
        ...input,
        assignmentId: "20202020-2020-4020-8020-202020202020",
        assignmentStateToken: initial.athlete.assignmentStateToken,
      }),
      expectCommandCode("assignment_state_changed"),
    );
    await assert.rejects(
      workouts.createAssignment(trainer, {
        ...input,
        assignmentId: "30303030-3030-4030-8030-303030303030",
        assignmentStateToken: afterFirst.athlete.assignmentStateToken,
      }),
      expectCommandCode("assignment_duplicate"),
    );
    await assert.rejects(
      workouts.createAssignment(trainer, {
        ...input,
        assignmentId: "40404040-4040-4040-8040-404040404040",
        templateId: secondTemplate.id,
        templateRevisionId: secondRevision,
        assignmentStateToken: afterFirst.athlete.assignmentStateToken,
      }),
      expectCommandCode("same_date_confirmation_required"),
    );
    const confirmed = await workouts.createAssignment(trainer, {
      ...input,
      assignmentId: "50505050-5050-4050-8050-505050505050",
      templateId: secondTemplate.id,
      templateRevisionId: secondRevision,
      assignmentStateToken: afterFirst.athlete.assignmentStateToken,
      allowAdditionalAssignment: true,
    });
    assert.ok(confirmed);
    const afterConfirmed = await query.find(trainer, athlete.userId);
    assert.ok(afterConfirmed);
    assert.ok(await workouts.createAssignment(trainer, {
      ...input,
      assignmentId: "60606060-6060-4060-8060-606060606060",
      templateId: secondTemplate.id,
      templateRevisionId: secondRevision,
      scheduledFor: addDays(date, 2),
      assignmentStateToken: afterConfirmed.athlete.assignmentStateToken,
      allowAdditionalAssignment: false,
    }));

    await admin.query(`UPDATE app.trainer_athlete_relations
      SET status = 'suspended' WHERE id = $1`, [relationId]);
    await assert.rejects(
      workouts.createAssignment(trainer, {
        ...input,
        assignmentId: "70707070-7070-4070-8070-707070707070",
        scheduledFor: addDays(date, 3),
        assignmentStateToken: (await query.find(trainer, athlete.userId))!.athlete.assignmentStateToken,
      }),
      expectCommandCode("athlete_relation_changed"),
    );
    assert.equal((await query.find(trainer, athlete.userId))?.athlete.capabilities.canAssign, false);
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

test("assignment rejects stale, archived, foreign and concurrent commands without partial mutation", {
  skip: !connectionString,
}, async () => {
  const admin = new Pool({ connectionString, max: 4 });
  const app = new Pool({ connectionString, max: 8, options: "-c role=ai_strength_app" });
  const trainer = await createTrainer(admin, "R2C Race Trainer");
  const otherTrainer = await createTrainer(admin, "R2C Race Other");
  const athlete = await createAthlete(admin, "R2C Race Athlete");
  const foreignAthlete = await createAthlete(admin, "R2C Race Foreign Athlete");
  await relate(admin, trainer.userId, athlete.userId);
  await relate(admin, otherTrainer.userId, foreignAthlete.userId);
  const workouts = new PostgresWorkoutRepository(app);
  const builder = new WorkoutBuilderRepository(app);
  const query = new QuickAssignQueryService(new QuickAssignRepository(app));
  try {
    const staleTemplate = await publishRich(builder, trainer, "R2C Stale");
    const staleRevision = await revisionId(admin, staleTemplate.id, staleTemplate.revision);
    const staleRead = await query.find(trainer, athlete.userId);
    assert.ok(staleRead);
    assert.ok(await builder.createRevision(trainer, staleTemplate.id));
    assert.ok(await builder.publish(trainer, staleTemplate.id));
    await assert.rejects(
      workouts.createAssignment(trainer, {
        assignmentId: "80808080-8080-4080-8080-808080808080",
        athleteUserId: athlete.userId,
        templateId: staleTemplate.id,
        templateRevisionId: staleRevision,
        scheduledFor: staleRead.calendar.tomorrow,
        trainerNote: "",
        assignmentStateToken: staleRead.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
      expectCommandCode("template_revision_stale"),
    );

    const archivedTemplate = await publishRich(builder, trainer, "R2C Archived");
    const archivedRevision = await revisionId(admin, archivedTemplate.id, archivedTemplate.revision);
    const archivedRead = await query.find(trainer, athlete.userId);
    assert.ok(archivedRead);
    assert.ok(await builder.archive(trainer, archivedTemplate.id));
    await assert.rejects(
      workouts.createAssignment(trainer, {
        assignmentId: "90909090-9090-4090-8090-909090909090",
        athleteUserId: athlete.userId,
        templateId: archivedTemplate.id,
        templateRevisionId: archivedRevision,
        scheduledFor: archivedRead.calendar.tomorrow,
        trainerNote: "",
        assignmentStateToken: archivedRead.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
      expectCommandCode("template_unavailable"),
    );

    const foreignTemplate = await publishRich(builder, otherTrainer, "R2C Foreign");
    const foreignRevision = await revisionId(admin, foreignTemplate.id, foreignTemplate.revision);
    const current = await query.find(trainer, athlete.userId);
    assert.ok(current);
    await assert.rejects(
      workouts.createAssignment(trainer, {
        assignmentId: "aaaaaaaa-1010-4010-8010-aaaaaaaaaaaa",
        athleteUserId: athlete.userId,
        templateId: foreignTemplate.id,
        templateRevisionId: foreignRevision,
        scheduledFor: current.calendar.tomorrow,
        trainerNote: "",
        assignmentStateToken: current.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
      expectCommandCode("template_not_found"),
    );
    await assert.rejects(
      workouts.createAssignment(trainer, {
        assignmentId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        athleteUserId: foreignAthlete.userId,
        templateId: staleTemplate.id,
        templateRevisionId: staleRevision,
        scheduledFor: current.calendar.tomorrow,
        trainerNote: "",
        assignmentStateToken: current.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
      expectCommandCode("assignment_forbidden"),
    );

    const raceA = await publishRich(builder, trainer, "R2C Race A");
    const raceB = await publishRich(builder, trainer, "R2C Race B");
    const raceARevision = await revisionId(admin, raceA.id, raceA.revision);
    const raceBRevision = await revisionId(admin, raceB.id, raceB.revision);
    const raceRead = await query.find(trainer, athlete.userId);
    assert.ok(raceRead);
    const results = await Promise.allSettled([
      workouts.createAssignment(trainer, {
        assignmentId: "aaaaaaaa-2020-4020-8020-aaaaaaaaaaaa",
        athleteUserId: athlete.userId,
        templateId: raceA.id,
        templateRevisionId: raceARevision,
        scheduledFor: raceRead.calendar.tomorrow,
        trainerNote: "A",
        assignmentStateToken: raceRead.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
      workouts.createAssignment(trainer, {
        assignmentId: "aaaaaaaa-3030-4030-8030-aaaaaaaaaaaa",
        athleteUserId: athlete.userId,
        templateId: raceB.id,
        templateRevisionId: raceBRevision,
        scheduledFor: addDays(raceRead.calendar.tomorrow, 1),
        trainerNote: "B",
        assignmentStateToken: raceRead.athlete.assignmentStateToken,
        allowAdditionalAssignment: false,
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected"
      && expectCommandCode("assignment_state_changed")(result.reason)).length, 1);
    const mutationCount = await admin.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM app.workout_assignments
      WHERE trainer_user_id = $1 AND athlete_user_id = $2`, [trainer.userId, athlete.userId]);
    assert.equal(mutationCount.rows[0].count, "1");
  } finally {
    await Promise.all([admin.end(), app.end()]);
  }
});

async function revisionId(pool: Pool, templateId: string, revision: number) {
  const result = await pool.query<{ id: string }>(`
    SELECT id FROM app.workout_template_revisions
    WHERE template_id = $1 AND revision_number = $2`, [templateId, revision]);
  return result.rows[0].id;
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
