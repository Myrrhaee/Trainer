import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { Pool, type PoolClient } from "pg";

import {
  ClientWorkoutRepository,
  clientCurrentSql,
} from "../../lib/server/client-workouts/client-workout-repository";
import { ClientCurrentInputError } from "../../lib/server/client-workouts/client-current-cursor";
import { withActorTransaction } from "../../lib/server/database/actor-context";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";

const connectionString = process.env.TEST_DATABASE_URL;

function observedPool(pool: Pool) {
  const statements: string[] = [];
  return {
    statements,
    pool: {
      async connect() {
        const client = await pool.connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === "query")
              return async (...args: Parameters<PoolClient["query"]>) => {
                statements.push(String(args[0]));
                return (
                  target.query as (
                    ...values: Parameters<PoolClient["query"]>
                  ) => Promise<unknown>
                )(...args);
              };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    } as unknown as Pool,
  };
}

async function cloneAssignment(
  admin: Pool,
  sourceId: string,
  scheduledFor: string,
  createdAt: string,
  active: boolean,
) {
  const id = randomUUID();
  await admin.query(
    `INSERT INTO app.workout_assignments (
       id, relation_id, trainer_user_id, athlete_user_id,
       source_template_id, source_revision_id, source_revision_number,
       title_snapshot, instruction_snapshot, trainer_note, scheduled_for,
       status, created_at, updated_at
     )
     SELECT $2, relation_id, trainer_user_id, athlete_user_id,
       source_template_id, source_revision_id, source_revision_number,
       title_snapshot, instruction_snapshot, trainer_note, $3::date,
       'available', $4::timestamptz, $4::timestamptz
     FROM app.workout_assignments WHERE id = $1`,
    [sourceId, id, scheduledFor, createdAt],
  );
  if (active)
    await admin.query(
      `INSERT INTO app.workout_sessions (
         assignment_id, relation_id, trainer_user_id, athlete_user_id,
         status, version, client_timezone, start_idempotency_key_hash,
         started_at, created_at, updated_at
       )
       SELECT id, relation_id, trainer_user_id, athlete_user_id,
         'active', 1, 'UTC', $2, $3::timestamptz, $3::timestamptz, $3::timestamptz
       FROM app.workout_assignments WHERE id = $1`,
      [
        id,
        createHash("sha256").update(randomUUID()).digest("hex"),
        createdAt,
      ],
    );
  return id;
}

test(
  "R4 current workouts are cursor-bounded, actor-bound and keep every active Session reachable",
  { skip: !connectionString },
  async () => {
    const admin = new Pool({ connectionString, max: 3 });
    const app = new Pool({
      connectionString,
      max: 6,
      options: "-c role=ai_strength_app",
    });
    try {
      const users = await admin.query<{ id: string }>(
        "INSERT INTO app.users(status,display_name) VALUES ('active','R4 Current Trainer'),('active','R4 Current Athlete'),('active','R4 Current Foreign') RETURNING id",
      );
      const [trainer, athlete, foreign] = users.rows.map((row) => ({
        userId: row.id,
      }));
      await admin.query(
        "INSERT INTO app.trainer_profiles(user_id,status,activated_at) VALUES ($1,'active',clock_timestamp())",
        [trainer.userId],
      );
      await admin.query(
        "INSERT INTO app.athlete_profiles(user_id,status) VALUES ($1,'active'),($2,'active')",
        [athlete.userId, foreign.userId],
      );
      await admin.query(
        "INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true)",
        [trainer.userId, athlete.userId],
      );
      const workouts = new PostgresWorkoutRepository(app);
      const template = await workouts.createPublishedTemplate(trainer, {
        title: "R4 current pagination",
        description: "",
        generalInstruction: "",
        estimatedDurationMin: 20,
        exercises: [
          {
            instanceKey: "r4-current-squat",
            title: "Squat",
            sets: 1,
            repetitions: 5,
            targetWeightKg: 40,
            restSeconds: 60,
            trainerNote: "",
          },
        ],
      });
      const source = await workouts.createAssignment(trainer, {
        athleteUserId: athlete.userId,
        templateId: template.id,
        scheduledFor: "2026-12-01",
        trainerNote: "",
      });
      assert.ok(source);

      const activeIds: string[] = [];
      for (let index = 0; index < 21; index++)
        activeIds.push(
          await cloneAssignment(
            admin,
            source.id,
            "2026-10-01",
            `2026-09-04T10:00:00.${String(index).padStart(6, "0")}Z`,
            true,
          ),
        );
      const cancelledBetweenPages = await cloneAssignment(
        admin,
        source.id,
        "2026-12-02",
        "2026-09-04T11:00:00.000001Z",
        false,
      );
      const retainedUpcoming = await cloneAssignment(
        admin,
        source.id,
        "2026-12-03",
        "2026-09-04T11:00:00.000002Z",
        false,
      );

      const repository = new ClientWorkoutRepository(app);
      const first = await repository.listCurrent(athlete);
      assert.equal(first.assignments.length, 20);
      assert.equal(first.limit, 20);
      assert.equal(first.hasMore, true);
      assert.equal(first.pageInfo.hasNextPage, true);
      assert.ok(first.pageInfo.startCursor && first.pageInfo.endCursor);
      assert.ok(first.assignments.every((item) => item.session?.status === "active"));
      assert.equal(new Set(first.assignments.map((item) => item.assignmentId)).size, 20);

      const insertedBeforeCursor = await cloneAssignment(
        admin,
        source.id,
        "2026-09-01",
        "2026-09-04T09:00:00.000001Z",
        true,
      );
      const insertedAfterCursor = await cloneAssignment(
        admin,
        source.id,
        "2026-11-01",
        "2026-09-04T12:00:00.000001Z",
        true,
      );
      await admin.query(
        "UPDATE app.workout_assignments SET status='cancelled', cancelled_at=clock_timestamp() WHERE id=$1",
        [cancelledBetweenPages],
      );

      const second = await repository.listCurrent(athlete, {
        after: first.pageInfo.endCursor!,
      });
      const combined = [...first.assignments, ...second.assignments];
      assert.equal(new Set(combined.map((item) => item.assignmentId)).size, combined.length);
      assert.equal(combined.some((item) => item.assignmentId === insertedBeforeCursor), false);
      assert.equal(combined.some((item) => item.assignmentId === insertedAfterCursor), true);
      assert.equal(combined.some((item) => item.assignmentId === cancelledBetweenPages), false);
      assert.equal(combined.some((item) => item.assignmentId === retainedUpcoming), true);
      for (const id of activeIds)
        assert.equal(combined.some((item) => item.assignmentId === id), true);
      const firstUpcoming = combined.findIndex((item) => item.session === null);
      assert.ok(firstUpcoming > 0);
      assert.ok(combined.slice(0, firstUpcoming).every((item) => item.session?.status === "active"));
      assert.ok(combined.slice(firstUpcoming).every((item) => item.session === null));

      const replay = await repository.listCurrent(athlete, {
        start: first.pageInfo.startCursor!,
      });
      assert.deepEqual(
        replay.assignments.map((item) => item.assignmentId),
        first.assignments.map((item) => item.assignmentId),
      );
      assert.throws(
        () =>
          repository.listCurrent(foreign, {
            start: first.pageInfo.startCursor!,
          }),
        ClientCurrentInputError,
      );
      assert.throws(
        () => repository.listCurrent(athlete, { after: "malformed" }),
        ClientCurrentInputError,
      );

      await admin.query(
        `INSERT INTO app.workout_assignments (
           relation_id, trainer_user_id, athlete_user_id,
           source_template_id, source_revision_id, source_revision_number,
           title_snapshot, instruction_snapshot, trainer_note, scheduled_for,
           status, created_at, updated_at
         )
         SELECT relation_id, trainer_user_id, athlete_user_id,
           source_template_id, source_revision_id, source_revision_number,
           title_snapshot, instruction_snapshot, trainer_note, '2030-01-01',
           'available', clock_timestamp() + (n * interval '1 microsecond'),
           clock_timestamp() + (n * interval '1 microsecond')
         FROM app.workout_assignments source_assignment
         CROSS JOIN generate_series(1,5000) n
         WHERE source_assignment.id=$1`,
        [source.id],
      );
      const observed = observedPool(app);
      const measured = await new ClientWorkoutRepository(observed.pool).listCurrent(
        athlete,
      );
      assert.equal(measured.assignments.length, 20);
      assert.equal(
        observed.statements.filter((sql) => /^\s*WITH page AS MATERIALIZED/i.test(sql))
          .length,
        1,
      );
      const plan = await withActorTransaction(
        athlete,
        (client) =>
          client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${clientCurrentSql}`, [
            athlete.userId,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            21,
          ]),
        app,
      );
      const planText = JSON.stringify(plan.rows[0]["QUERY PLAN"]);
      assert.match(planText, /CTE page/);
      assert.match(planText, /Limit/);
      console.log("R4 current workouts EXPLAIN (5000+ eligible rows)", planText);
    } finally {
      await Promise.all([admin.end(), app.end()]);
    }
  },
);
