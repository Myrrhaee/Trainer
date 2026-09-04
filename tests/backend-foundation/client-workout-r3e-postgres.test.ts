import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { ClientWorkoutRepository } from "../../lib/server/client-workouts/client-workout-repository";
import { PostgresWorkoutRepository } from "../../lib/server/workouts/workout-repository";
import { WorkoutSessionRepository } from "../../lib/server/workout-sessions/workout-session-repository";
import { WorkoutSessionService } from "../../lib/server/workout-sessions/workout-session-service";
import {
  ClientHistoryRepository,
  clientHistorySql,
} from "../../lib/server/client-workouts/client-history-repository";
import { withActorTransaction } from "../../lib/server/database/actor-context";
import { ClientCompletedRepository } from "../../lib/server/client-workouts/client-completed-repository";
import { ClientFeedbackRepository } from "../../lib/server/client-workouts/client-feedback-repository";
import { ReviewRepository } from "../../lib/server/reviews/review-repository";

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

test(
  "R3E history is own, completed-only, cursor bounded and replayable; EXPLAIN under app RLS",
  { skip: !connectionString },
  async () => {
    const admin = new Pool({ connectionString });
    const app = new Pool({
      connectionString,
      options: "-c role=ai_strength_app",
    });
    try {
      const users = await admin.query<{ id: string }>(
        "INSERT INTO app.users(status,display_name) VALUES ('active','R3E Trainer'),('active','R3E Athlete'),('active','R3E Foreign') RETURNING id",
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
      const relation = await admin.query<{ id: string }>(
        "INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true) RETURNING id",
        [trainer.userId, athlete.userId],
      );
      const workouts = new PostgresWorkoutRepository(app);
      const template = await workouts.createPublishedTemplate(trainer, {
        title: "R3E history",
        description: "",
        generalInstruction: "",
        estimatedDurationMin: 20,
        exercises: [
          {
            instanceKey: "r3e-squat",
            title: "Squat",
            sets: 2,
            repetitions: 6,
            targetWeightKg: 50,
            restSeconds: 90,
            trainerNote: "",
          },
        ],
      });
      const repository = new WorkoutSessionRepository(app);
      const service = new WorkoutSessionService(repository);
      for (let index = 0; index < 35; index++) {
        const assignment = await workouts.createAssignment(trainer, {
          athleteUserId: athlete.userId,
          templateId: template.id,
          scheduledFor: "2026-09-04",
          trainerNote: "",
        });
        assert.ok(assignment);
        const session = await repository.start(athlete, {
          assignmentId: assignment.id,
          clientTimezone: "UTC",
          idempotencyKeyHash: createHash("sha256")
            .update(randomUUID())
            .digest("hex"),
        });
        assert.ok(session);
        if (index !== 34)
          await service.complete(athlete, session.id, {
            expectedVersion: 1,
            idempotencyKey: randomUUID(),
            zeroResultConfirmed: true,
            zeroResultReason: "",
            overallComment: "",
            discomfortReported: false,
            discomfortComment: "",
          });
      }
      const history = new ClientHistoryRepository(app);
      const first = await history.history(athlete);
      assert.equal(first.items.length, 10);
      assert.equal(first.items[0].summary.incompleteSetCount, 2);
      assert.equal(first.items[0].summary.availability, "ready");
      assert.ok(
        first.items.every((item) => item.status === "completed_with_omissions"),
      );
      assert.ok(first.pageInfo.startCursor && first.pageInfo.endCursor);
      const second = await history.history(athlete, {
        after: first.pageInfo.endCursor,
      });
      assert.equal(
        new Set([...first.items, ...second.items].map((item) => item.sessionId))
          .size,
        20,
      );
      assert.deepEqual(
        (await history.history(athlete, { start: first.pageInfo.startCursor }))
          .items,
        first.items,
      );
      assert.equal(
        (await history.history(athlete, { first: "30" })).items.length,
        30,
      );
      await assert.rejects(history.history(athlete, { first: "31" }));
      await assert.rejects(
        history.history(foreign, { start: first.pageInfo.startCursor }),
      );
      assert.deepEqual((await history.history(foreign)).items, []);
      assert.deepEqual((await history.history(trainer)).items, []);
      for (const status of ["suspended", "ended"]) {
        await admin.query(
          "UPDATE app.trainer_athlete_relations SET status=$2::app.trainer_athlete_relation_status, ended_at=CASE WHEN $2::text='ended' THEN clock_timestamp() ELSE NULL END WHERE id=$1",
          [relation.rows[0].id, status],
        );
        assert.deepEqual(
          (
            await history.history(athlete, {
              start: first.pageInfo.startCursor,
            })
          ).items,
          first.items,
        );
      }
      const exact = new ClientCompletedRepository(app);
      const completed = await exact.find(athlete, first.items[0].sessionId);
      assert.ok(completed && completed !== "active");
      assert.equal(completed.logs[0].sets.length, 2);
      assert.equal(completed.context.discomfortReported, false);
      assert.equal(await exact.find(foreign, first.items[0].sessionId), null);
      const feedback = new ClientFeedbackRepository(app);
      assert.deepEqual(
        (await feedback.thread(athlete, first.items[0].sessionId))?.items,
        [],
      );
      assert.equal(
        await feedback.thread(foreign, first.items[0].sessionId),
        null,
      );
      const review = new ReviewRepository(app);
      const attention = (
        await admin.query<{ id: string }>(
          "SELECT id FROM app.attention_items WHERE source_session_id=$1",
          [first.items[0].sessionId],
        )
      ).rows[0].id;
      const hash = () =>
        createHash("sha256").update(randomUUID()).digest("hex");
      const original = await review.sendFeedback(trainer, {
        attentionItemId: attention,
        sessionId: first.items[0].sessionId,
        kind: "detailed",
        body: "Original trainer answer",
        followUpOfId: null,
        idempotencyKeyHash: hash(),
        requestHash: hash(),
      });
      assert.ok(original);
      const followUp = await review.sendFeedback(trainer, {
        attentionItemId: attention,
        sessionId: first.items[0].sessionId,
        kind: "follow_up",
        body: "Original follow-up",
        followUpOfId: original.id,
        idempotencyKeyHash: hash(),
        requestHash: hash(),
      });
      assert.ok(followUp);
      const thread = await feedback.thread(athlete, first.items[0].sessionId, {
        first: "1",
      });
      assert.equal(thread?.items[0].id, original.id);
      assert.ok(thread?.endCursor);
      const tail = await feedback.thread(athlete, first.items[0].sessionId, {
        after: thread.endCursor,
      });
      assert.equal(tail?.items[0].id, followUp.id);
      assert.equal(tail?.items[0].followUpOfId, original.id);
      const focused = await feedback.thread(athlete, first.items[0].sessionId, {
        focus: followUp.id,
      });
      assert.equal(focused?.items[0].id, followUp.id);
      assert.equal(focused?.hasPrevious, true);
      assert.equal((await feedback.latest(athlete))?.id, followUp.id);
      const payload = JSON.stringify({ completed, thread });
      for (const privateField of [
        "attentionItemId",
        "trainerUserId",
        "athleteUserId",
        "priorityReasons",
        "manualResolution",
        "capabilities",
      ])
        assert.ok(!payload.includes(privateField));
      assert.equal(
        (await history.history(athlete)).items[0].feedback.feedbackCount,
        2,
      );
      const otherAttention = (
        await admin.query<{ id: string }>(
          "SELECT id FROM app.attention_items WHERE source_session_id=$1",
          [first.items[1].sessionId],
        )
      ).rows[0].id;
      const acknowledgement = await review.sendFeedback(trainer, {
        attentionItemId: otherAttention,
        sessionId: first.items[1].sessionId,
        kind: "acknowledgement",
        body: "Принято",
        followUpOfId: null,
        idempotencyKeyHash: hash(),
        requestHash: hash(),
      });
      assert.ok(acknowledgement);
      assert.equal(
        (await feedback.thread(athlete, first.items[1].sessionId))?.items[0]
          .kind,
        "acknowledgement",
      );
      assert.equal(
        (await feedback.thread(athlete, first.items[1].sessionId))?.items[0].id,
        acknowledgement.id,
      );
      assert.equal(
        (
          await feedback.thread(athlete, first.items[1].sessionId, {
            focus: original.id,
          })
        )?.focusUnavailable,
        true,
      );
      assert.throws(() =>
        feedback.thread(athlete, first.items[0].sessionId, { first: "51" }),
      );
      assert.throws(() =>
        feedback.thread(foreign, first.items[0].sessionId, {
          after: thread.endCursor!,
        }),
      );
      const observed = observedPool(app);
      const counts: Record<string, { statements: number; dataReads: number }> =
        {};
      const measure = async (name: string, read: () => Promise<unknown>) => {
        const before = observed.statements.length;
        await read();
        const calls = observed.statements.slice(before);
        counts[name] = {
          statements: calls.length,
          dataReads: calls.filter(
            (sql) =>
              /^\s*(WITH|SELECT)\b/i.test(sql) && !/set_config/.test(sql),
          ).length,
        };
      };
      await measure("currentUpcoming", () =>
        new ClientWorkoutRepository(observed.pool).listCurrent(athlete),
      );
      await measure("history10", () =>
        new ClientHistoryRepository(observed.pool).history(athlete),
      );
      await measure("history30", () =>
        new ClientHistoryRepository(observed.pool).history(athlete, {
          first: "30",
        }),
      );
      await measure("historyNext", () =>
        new ClientHistoryRepository(observed.pool).history(athlete, {
          after: first.pageInfo.endCursor!,
        }),
      );
      await measure("exactCompleted", () =>
        new ClientCompletedRepository(observed.pool).find(
          athlete,
          first.items[0].sessionId,
        ),
      );
      await measure("feedbackThread", () =>
        new ClientFeedbackRepository(observed.pool).thread(
          athlete,
          first.items[0].sessionId,
        ),
      );
      await measure("recentFeedback", () =>
        new ClientFeedbackRepository(observed.pool).latest(athlete),
      );
      assert.equal(counts.history10.dataReads, 1);
      assert.deepEqual(counts.history10, counts.history30);
      assert.deepEqual(counts.history10, counts.historyNext);
      assert.equal(counts.exactCompleted.dataReads, 4);
      assert.equal(counts.feedbackThread.dataReads, 1);
      assert.equal(counts.recentFeedback.dataReads, 1);
      console.log(
        "R3E measured repository statements/data reads (excludes HTTP auth)",
        JSON.stringify(counts),
      );
      const plan = await withActorTransaction(
        athlete,
        async (client) =>
          client.query(
            `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${clientHistorySql}`,
            [athlete.userId, null, null, null, null, 11],
          ),
        app,
      );
      console.log(
        "R3E history EXPLAIN (34 terminal Sessions, app RLS)",
        JSON.stringify(plan.rows[0]["QUERY PLAN"]),
      );
      // Synthetic imported-size history, only inside the disposable test database.
      const assignments = await admin.query<{ id: string }>(
        `INSERT INTO app.workout_assignments
      (relation_id,trainer_user_id,athlete_user_id,source_template_id,source_revision_id,source_revision_number,title_snapshot,scheduled_for)
      SELECT a.relation_id,a.trainer_user_id,a.athlete_user_id,a.source_template_id,a.source_revision_id,a.source_revision_number,'R3E scale fixture','2020-01-01'
      FROM (SELECT * FROM app.workout_assignments WHERE athlete_user_id=$1 LIMIT 1) a CROSS JOIN generate_series(1,5000) RETURNING id`,
        [athlete.userId],
      );
      await admin.query(
        `INSERT INTO app.workout_sessions(assignment_id,relation_id,trainer_user_id,athlete_user_id,start_idempotency_key_hash)
      SELECT id,relation_id,trainer_user_id,athlete_user_id,repeat('a',64) FROM app.workout_assignments WHERE id=ANY($1::uuid[])`,
        [assignments.rows.map((row) => row.id)],
      );
      await admin.query(
        `UPDATE app.workout_sessions SET status='completed_with_omissions',version=2,completed_at='2020-01-01',discomfort_reported=false
      WHERE assignment_id=ANY($1::uuid[])`,
        [assignments.rows.map((row) => row.id)],
      );
      await admin.query("ANALYZE app.workout_sessions");
      const largePlan = await withActorTransaction(
        athlete,
        async (client) =>
          client.query(
            `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${clientHistorySql}`,
            [athlete.userId, null, null, null, null, 11],
          ),
        app,
      );
      console.log(
        "R3E history EXPLAIN (5034 terminal Sessions, app RLS)",
        JSON.stringify(largePlan.rows[0]["QUERY PLAN"]),
      );
      // Equal timestamps must advance by UUID, never collapse same-day Sessions.
      const equalPage = await history.history(athlete, {
        first: "30",
        after: (await history.history(athlete, { first: "30" })).pageInfo
          .endCursor!,
      });
      assert.ok(
        equalPage.items.some((item) => item.summary.availability === "partial"),
      );
      const equalNext = await history.history(athlete, {
        first: "30",
        after: equalPage.pageInfo.endCursor!,
      });
      assert.equal(
        new Set(
          [...equalPage.items, ...equalNext.items].map(
            (item) => item.sessionId,
          ),
        ).size,
        60,
      );
      assert.deepEqual(
        (
          await history.history(athlete, {
            first: "30",
            after: equalPage.pageInfo.endCursor!,
          })
        ).items,
        equalNext.items,
      );
    } finally {
      await app.end();
      await admin.end();
    }
  },
);
