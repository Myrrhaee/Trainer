import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { CompletionValidationError, completionLogicalRequest, normalizeCompletion } from "@/lib/client-workout-completion-command";
import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { enqueueNotification } from "@/lib/server/notifications/notification-outbox";
import type { ProgressSetInput, WorkoutExerciseLog, WorkoutSession, WorkoutSetLog } from "./workout-session-types";
import type { StartOrResumeSessionResult } from "@/lib/server/client-workouts/client-workout-types";

export class SessionVersionConflictError extends Error {}
export class SessionIdempotencyConflictError extends Error {}
export class ZeroResultConfirmationRequiredError extends Error {}

type SessionRow = {
  id: string; assignment_id: string; trainer_user_id: string; athlete_user_id: string;
  title_snapshot: string; status: WorkoutSession["status"]; version: number; client_timezone: string;
  started_at: Date; completed_at: Date | null; attention_item_id: string | null; updated_at: Date;
  overall_comment: string | null; discomfort_reported: boolean | null; discomfort_comment: string | null;
  review_queued: boolean;
};
type ExerciseRow = {
  id: string; assignment_exercise_id: string; title_snapshot: string; position: number;
  status: WorkoutExerciseLog["status"]; athlete_note: string; updated_at: Date;
};
type SetRow = {
  id: string; exercise_log_id: string; source_assignment_set_id: string | null;
  set_key: string; position: number; kind: "warmup" | "working";
  planned_repetitions_min: number | null; planned_repetitions_max: number | null;
  planned_duration_seconds: number | null; planned_weight_kg: string | null;
  status: WorkoutSetLog["status"]; actual_repetitions: number | null;
  actual_duration_seconds: number | null; actual_weight_kg: string | null;
  rpe: string | null; athlete_comment: string; updated_at: Date;
};

const sessionSelect = `SELECT session.id, session.assignment_id, session.trainer_user_id,
  session.athlete_user_id, assignment.title_snapshot, session.status::text, session.version,
  session.client_timezone, session.started_at, session.completed_at, session.updated_at,
  session.overall_comment, session.discomfort_reported, session.discomfort_comment,
  EXISTS (SELECT 1 FROM app.workout_session_command_receipts receipt
    WHERE receipt.session_id = session.id AND receipt.kind = 'complete'
      AND receipt.result_version = session.version) AS review_queued,
  (SELECT attention.id FROM app.attention_items attention
   WHERE attention.source_session_id = session.id AND attention.item_type = 'workout_review') AS attention_item_id
FROM app.workout_sessions session
JOIN app.workout_assignments assignment ON assignment.id = session.assignment_id`;

function numberValue(value: string | number | null) {
  return value === null ? null : Number(value);
}

function mapSet(row: SetRow): WorkoutSetLog {
  return {
    id: row.id, sourceAssignmentSetId: row.source_assignment_set_id,
    setKey: row.set_key, position: row.position, kind: row.kind,
    plannedRepetitionsMin: row.planned_repetitions_min,
    plannedRepetitionsMax: row.planned_repetitions_max,
    plannedDurationSeconds: row.planned_duration_seconds,
    plannedWeightKg: numberValue(row.planned_weight_kg), status: row.status,
    actualRepetitions: row.actual_repetitions, actualDurationSeconds: row.actual_duration_seconds,
    actualWeightKg: numberValue(row.actual_weight_kg), rpe: numberValue(row.rpe),
    athleteComment: row.athlete_comment, updatedAt: row.updated_at.toISOString(),
  };
}

export class WorkoutSessionRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  listAthlete(actor: Actor): Promise<WorkoutSession[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<SessionRow>(`${sessionSelect}
        WHERE session.athlete_user_id = $1 ORDER BY session.started_at DESC`, [actor.userId]);
      return Promise.all(result.rows.map((row) => this.hydrate(client, row)));
    }, this.pool);
  }

  find(actor: Actor, sessionId: string, correlation?: { commandId: string; fingerprint: string }): Promise<WorkoutSession | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      const session = await this.findInTransaction(client, sessionId);
      if (session && correlation) {
        const receipts = await client.query<{ same_key: boolean; request_hash: string; result_version: number }>(
          `SELECT idempotency_key_hash = $3 AS same_key, request_hash, result_version
           FROM app.workout_session_command_receipts
           WHERE session_id = $1 AND actor_user_id = $2 AND kind = 'complete'`,
          [sessionId, actor.userId, createHash("sha256").update(correlation.commandId).digest("hex")]);
        const own = receipts.rows.find((row) => row.same_key);
        const equal = receipts.rows.find((row) => row.request_hash === correlation.fingerprint && row.result_version === session.version);
        session.completion = { ...session.completion!, correlation: own
          ? own === equal ? "own" : "different"
          : equal ? "equivalent" : receipts.rowCount ? "different" : "none" };
      }
      return session;
    });
  }

  start(actor: Actor, input: {
    assignmentId: string; clientTimezone: string; idempotencyKeyHash: string;
  }): Promise<WorkoutSession | null> {
    return this.startOrResume(actor, input).then((result) => result?.session ?? null);
  }

  startOrResume(actor: Actor, input: {
    assignmentId: string; clientTimezone: string; idempotencyKeyHash: string;
  }): Promise<StartOrResumeSessionResult | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const source = await client.query<{
        assignment_id: string; relation_id: string; trainer_user_id: string; athlete_user_id: string;
      }>(`SELECT assignment.id AS assignment_id, assignment.relation_id,
                 assignment.trainer_user_id, assignment.athlete_user_id
          FROM app.workout_assignments assignment
          JOIN app.trainer_athlete_relations relation ON relation.id = assignment.relation_id
          WHERE assignment.id = $1 AND assignment.athlete_user_id = $2
            AND assignment.status = 'available' AND relation.status = 'active'
          FOR SHARE OF relation`,
        [input.assignmentId, actor.userId]);
      if (!source.rowCount) return null;
      const row = source.rows[0];
      const inserted = await client.query<{ id: string }>(`INSERT INTO app.workout_sessions
        (assignment_id, relation_id, trainer_user_id, athlete_user_id, client_timezone, start_idempotency_key_hash)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (assignment_id) DO NOTHING RETURNING id`,
        [row.assignment_id, row.relation_id, row.trainer_user_id, row.athlete_user_id,
          input.clientTimezone, input.idempotencyKeyHash]);
      if (inserted.rowCount) {
        const sessionId = inserted.rows[0].id;
        await client.query(`INSERT INTO app.workout_exercise_logs
          (session_id, assignment_exercise_id, position)
          SELECT $1, source.id, source.position FROM app.workout_assignment_exercises source
          WHERE source.assignment_id = $2 ORDER BY source.position`, [sessionId, row.assignment_id]);
        await client.query(`INSERT INTO app.workout_set_logs
          (exercise_log_id, source_assignment_set_id, set_key, position, kind,
           planned_repetitions_min, planned_repetitions_max, planned_duration_seconds, planned_weight_kg)
          SELECT exercise_log.id, source_set.id, source_set.set_key_snapshot, source_set.position,
                 source_set.kind_snapshot, source_set.repetitions_min_snapshot,
                 source_set.repetitions_max_snapshot, source_set.duration_seconds_snapshot,
                 source_set.target_weight_kg_snapshot
          FROM app.workout_exercise_logs exercise_log
          JOIN app.workout_assignment_exercise_sets source_set
            ON source_set.assignment_exercise_id = exercise_log.assignment_exercise_id
          WHERE exercise_log.session_id = $1 ORDER BY exercise_log.position, source_set.position`, [sessionId]);
        await client.query(`INSERT INTO app.workout_set_logs
          (exercise_log_id, set_key, position, kind, planned_repetitions_min,
           planned_repetitions_max, planned_duration_seconds, planned_weight_kg)
          SELECT exercise_log.id, 'generated-' || generated.position::text, generated.position,
                 'working'::app.workout_set_kind,
                 CASE WHEN source.prescription_type_snapshot = 'repetitions' THEN source.repetitions_min_snapshot END,
                 CASE WHEN source.prescription_type_snapshot = 'repetitions' THEN source.repetitions_max_snapshot END,
                 CASE WHEN source.prescription_type_snapshot = 'duration' THEN source.duration_seconds_snapshot END,
                 source.target_weight_kg_snapshot
          FROM app.workout_exercise_logs exercise_log
          JOIN app.workout_assignment_exercises source ON source.id = exercise_log.assignment_exercise_id
          CROSS JOIN LATERAL generate_series(1, source.sets_snapshot) AS generated(position)
          WHERE exercise_log.session_id = $1 AND NOT EXISTS (
            SELECT 1 FROM app.workout_assignment_exercise_sets source_set
            WHERE source_set.assignment_exercise_id = source.id
          ) ORDER BY exercise_log.position, generated.position`, [sessionId]);
        await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
          VALUES ($1,$1,'workout.session.started',jsonb_build_object('session_id',$2::text,'assignment_id',$3::text))`,
          [actor.userId, sessionId, input.assignmentId]);
      }
      const existing = await client.query<SessionRow>(`${sessionSelect}
        WHERE session.assignment_id = $1 AND session.athlete_user_id = $2`, [input.assignmentId, actor.userId]);
      if (!existing.rowCount) return null;
      return {
        session: await this.hydrate(client, existing.rows[0]),
        outcome: inserted.rowCount ? "created" : "resumed",
      };
    });
  }

  saveProgress(actor: Actor, input: {
    sessionId: string; expectedVersion: number; idempotencyKeyHash: string; requestHash: string;
    sets: ProgressSetInput[];
  }): Promise<WorkoutSession | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const session = await client.query<{ version: number; status: WorkoutSession["status"] }>(
        `SELECT version, status::text FROM app.workout_sessions
         WHERE id = $1 AND athlete_user_id = $2 FOR UPDATE`, [input.sessionId, actor.userId]);
      if (!session.rowCount) return null;
      const duplicate = await this.receipt(client, actor.userId, input.sessionId,
        "progress", input.idempotencyKeyHash, input.requestHash);
      if (duplicate) return this.findInTransaction(client, input.sessionId);
      if (session.rows[0].status !== "active") return null;
      if (session.rows[0].version !== input.expectedVersion) throw new SessionVersionConflictError("version_conflict");
      // The Session lock serializes Save/Complete; validate the entire immutable lineage before writing.
      const targets = await client.query(`SELECT target.id
        FROM app.workout_set_logs target
        JOIN app.workout_exercise_logs exercise ON exercise.id = target.exercise_log_id
        JOIN app.workout_sessions session ON session.id = exercise.session_id
        JOIN app.workout_assignment_exercises source
          ON source.id = exercise.assignment_exercise_id AND source.assignment_id = session.assignment_id
        LEFT JOIN app.workout_assignment_exercise_sets source_set ON source_set.id = target.source_assignment_set_id
        WHERE session.id = $1 AND session.athlete_user_id = $2 AND session.status = 'active'
          AND target.id = ANY($3::uuid[])
          AND ((source_set.assignment_exercise_id = source.id
            AND source_set.set_key_snapshot = target.set_key AND source_set.position = target.position)
          OR (target.source_assignment_set_id IS NULL
            AND target.set_key = 'generated-' || target.position::text
            AND target.position BETWEEN 1 AND source.sets_snapshot
            AND NOT EXISTS (SELECT 1 FROM app.workout_assignment_exercise_sets existing
              WHERE existing.assignment_exercise_id = source.id)))`,
      [input.sessionId, actor.userId, input.sets.map((set) => set.setLogId)]);
      if (targets.rowCount !== input.sets.length || input.sets.length === 0) return null;
      for (const set of input.sets) {
        const updated = await client.query(`UPDATE app.workout_set_logs target SET
          status = $3, actual_repetitions = $4, actual_duration_seconds = $5,
          actual_weight_kg = $6, rpe = $7, athlete_comment = $8
          FROM app.workout_exercise_logs exercise
          WHERE target.id = $1 AND target.exercise_log_id = exercise.id
            AND exercise.session_id = $2`, [set.setLogId, input.sessionId, set.status,
          set.actualRepetitions, set.actualDurationSeconds, set.actualWeightKg, set.rpe, set.athleteComment]);
        if (updated.rowCount !== 1) throw new SessionVersionConflictError("version_conflict");
      }
      await this.refreshExerciseStatuses(client, input.sessionId);
      await client.query(`UPDATE app.workout_sessions SET version = version + 1 WHERE id = $1`, [input.sessionId]);
      await this.saveReceipt(client, actor.userId, input.sessionId, "progress",
        input.idempotencyKeyHash, input.requestHash, input.expectedVersion + 1);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.session.progress_saved',jsonb_build_object('session_id',$2::text,'set_count',$3::int))`,
        [actor.userId, input.sessionId, input.sets.length]);
      return this.findInTransaction(client, input.sessionId);
    });
  }

  complete(actor: Actor, input: {
    sessionId: string; expectedVersion: number; idempotencyKeyHash: string; requestHash: string;
    zeroResultConfirmed: boolean; zeroResultReason: string;
    overallComment?: string | null; discomfortReported?: boolean; discomfortComment?: string | null;
  }): Promise<WorkoutSession | null> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const session = await client.query<{
        version: number; status: WorkoutSession["status"];
        trainer_user_id: string; athlete_user_id: string; relation_id: string; assignment_id: string;
      }>(`SELECT version, status::text, trainer_user_id, athlete_user_id, relation_id, assignment_id
          FROM app.workout_sessions WHERE id = $1 AND athlete_user_id = $2`,
        [input.sessionId, actor.userId]);
      if (!session.rowCount) return null;
      // The active-row UPDATE policy cannot lock terminal rows. Lock active, then reread
      // after waiting so a concurrent completion is reconciled rather than overwritten.
      await client.query(`SELECT id FROM app.workout_sessions
        WHERE id = $1 AND athlete_user_id = $2 AND status = 'active' FOR UPDATE`, [input.sessionId, actor.userId]);
      const current = await client.query<{ version: number; status: WorkoutSession["status"] }>(
        `SELECT version, status::text FROM app.workout_sessions WHERE id = $1`, [input.sessionId]);
      if (!current.rowCount) return null;
      Object.assign(session.rows[0], current.rows[0]);
      const legacy = input.discomfortReported === undefined;
      const content = legacy ? null : normalizeCompletion(input);
      const requestHash = content ? createHash("sha256").update(JSON.stringify(
        completionLogicalRequest(input.sessionId, session.rows[0].assignment_id, content))).digest("hex") : input.requestHash;
      const duplicate = await this.receipt(client, actor.userId, input.sessionId,
        "complete", input.idempotencyKeyHash, requestHash);
      if (duplicate) return this.findInTransaction(client, input.sessionId);
      if (!content) throw new CompletionValidationError("discomfortReported");
      if (session.rows[0].status !== "active") {
        const equivalent = await client.query(`SELECT 1 FROM app.workout_session_command_receipts
          WHERE session_id = $1 AND actor_user_id = $2 AND kind = 'complete'
            AND request_hash = $3 AND result_version = $4`,
          [input.sessionId, actor.userId, requestHash, session.rows[0].version]);
        if (equivalent.rowCount) return this.findInTransaction(client, input.sessionId);
        throw new SessionIdempotencyConflictError("completed_elsewhere");
      }
      if (session.rows[0].version !== input.expectedVersion) throw new SessionVersionConflictError("version_conflict");
      const results = await client.query<{ completed: string }>(`SELECT count(*) FILTER (WHERE set_log.status = 'completed')::text AS completed
        FROM app.workout_set_logs set_log JOIN app.workout_exercise_logs exercise ON exercise.id = set_log.exercise_log_id
        WHERE exercise.session_id = $1`, [input.sessionId]);
      if (Number(results.rows[0].completed) === 0 && !input.zeroResultConfirmed) {
        throw new ZeroResultConfirmationRequiredError("zero_result_confirmation_required");
      }
      await client.query(`UPDATE app.workout_set_logs target SET status = 'incomplete'
        FROM app.workout_exercise_logs exercise
        WHERE target.exercise_log_id = exercise.id AND exercise.session_id = $1 AND target.status = 'pending'`, [input.sessionId]);
      await this.refreshExerciseStatuses(client, input.sessionId);
      const omissions = await client.query<{ count: string }>(`SELECT count(*)::text FROM app.workout_set_logs set_log
        JOIN app.workout_exercise_logs exercise ON exercise.id = set_log.exercise_log_id
        WHERE exercise.session_id = $1 AND set_log.status <> 'completed'`, [input.sessionId]);
      const status = Number(omissions.rows[0].count) > 0 ? "completed_with_omissions" : "completed";
      await client.query(`UPDATE app.workout_sessions SET status = $2, version = version + 1,
        completed_at = clock_timestamp(), zero_result_reason = NULLIF($3, ''),
        overall_comment = $4, discomfort_reported = $5, discomfort_comment = $6 WHERE id = $1`,
        [input.sessionId, status, content.zeroResultReason, content.overallComment,
          content.discomfortReported, content.discomfortComment]);
      const source = session.rows[0];
      const attentionItemId = randomUUID();
      await client.query(`INSERT INTO app.attention_items
        (id, trainer_user_id, athlete_user_id, relation_id, source_session_id, priority_reasons)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [attentionItemId, source.trainer_user_id, source.athlete_user_id, source.relation_id, input.sessionId,
          JSON.stringify([...(content.discomfortReported ? ["discomfort"] : []),
            ...(status === "completed_with_omissions" ? ["partial_completion"] : [])])]);
      await this.saveReceipt(client, actor.userId, input.sessionId, "complete",
        input.idempotencyKeyHash, requestHash, input.expectedVersion + 1);
      await client.query(`INSERT INTO app.audit_events (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.session.completed',jsonb_build_object(
          'session_id',$2::text,'attention_item_id',$3::text,'outcome',$4::text))`,
        [actor.userId, input.sessionId, attentionItemId, status]);
      await enqueueNotification(client, {
        eventType: "workout_completed",
        recipientUserId: source.trainer_user_id,
        actorUserId: actor.userId,
        aggregateType: "workout_session",
        aggregateId: input.sessionId,
      });
      return this.findInTransaction(client, input.sessionId);
    });
  }

  private async receipt(client: PoolClient, actorId: string, sessionId: string,
    kind: "progress" | "complete", keyHash: string, requestHash: string) {
    const result = await client.query<{ session_id: string; request_hash: string }>(`SELECT session_id, request_hash
      FROM app.workout_session_command_receipts
      WHERE actor_user_id = $1 AND kind = $2 AND idempotency_key_hash = $3`, [actorId, kind, keyHash]);
    if (!result.rowCount) return false;
    if (result.rows[0].session_id !== sessionId || result.rows[0].request_hash !== requestHash) {
      throw new SessionIdempotencyConflictError("idempotency_conflict");
    }
    return true;
  }

  private saveReceipt(client: PoolClient, actorId: string, sessionId: string, kind: "progress" | "complete",
    keyHash: string, requestHash: string, version: number) {
    return client.query(`INSERT INTO app.workout_session_command_receipts
      (session_id, actor_user_id, kind, idempotency_key_hash, request_hash, result_version)
      VALUES ($1,$2,$3,$4,$5,$6)`, [sessionId, actorId, kind, keyHash, requestHash, version]);
  }

  private async refreshExerciseStatuses(client: PoolClient, sessionId: string) {
    await client.query(`UPDATE app.workout_exercise_logs exercise SET status = derived.status
      FROM (
        SELECT exercise_log.id,
          CASE
            WHEN bool_and(set_log.status = 'skipped') THEN 'skipped'::app.workout_log_status
            WHEN bool_and(set_log.status = 'completed') THEN 'completed'::app.workout_log_status
            WHEN bool_and(set_log.status = 'pending') THEN 'pending'::app.workout_log_status
            ELSE 'incomplete'::app.workout_log_status
          END AS status
        FROM app.workout_exercise_logs exercise_log
        JOIN app.workout_set_logs set_log ON set_log.exercise_log_id = exercise_log.id
        WHERE exercise_log.session_id = $1 GROUP BY exercise_log.id
      ) derived WHERE exercise.id = derived.id`, [sessionId]);
  }

  private async findInTransaction(client: PoolClient, sessionId: string): Promise<WorkoutSession | null> {
    const result = await client.query<SessionRow>(`${sessionSelect} WHERE session.id = $1`, [sessionId]);
    return result.rowCount ? this.hydrate(client, result.rows[0]) : null;
  }

  private async hydrate(client: PoolClient, row: SessionRow): Promise<WorkoutSession> {
    const exercises = await client.query<ExerciseRow>(`SELECT exercise.id, exercise.assignment_exercise_id,
      source.title_snapshot, exercise.position, exercise.status::text, exercise.athlete_note, exercise.updated_at
      FROM app.workout_exercise_logs exercise
      JOIN app.workout_assignment_exercises source ON source.id = exercise.assignment_exercise_id
      WHERE exercise.session_id = $1 ORDER BY exercise.position`, [row.id]);
    const ids = exercises.rows.map((exercise) => exercise.id);
    const sets = ids.length ? (await client.query<SetRow>(`SELECT *, status::text FROM app.workout_set_logs
      WHERE exercise_log_id = ANY($1::uuid[]) ORDER BY exercise_log_id, position`, [ids])).rows : [];
    const byExercise = new Map<string, WorkoutSetLog[]>();
    for (const set of sets) byExercise.set(set.exercise_log_id, [...(byExercise.get(set.exercise_log_id) ?? []), mapSet(set)]);
    return {
      id: row.id, assignmentId: row.assignment_id, trainerUserId: row.trainer_user_id,
      athleteUserId: row.athlete_user_id, title: row.title_snapshot, status: row.status,
      version: row.version, clientTimezone: row.client_timezone, startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null, attentionItemId: row.attention_item_id,
      completion: { overallComment: row.overall_comment, discomfortReported: row.discomfort_reported,
        discomfortComment: row.discomfort_comment, reviewQueued: row.review_queued },
      exercises: exercises.rows.map((exercise) => ({
        id: exercise.id, assignmentExerciseId: exercise.assignment_exercise_id,
        title: exercise.title_snapshot, position: exercise.position, status: exercise.status,
        athleteNote: exercise.athlete_note, sets: byExercise.get(exercise.id) ?? [],
        updatedAt: exercise.updated_at.toISOString(),
      })),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
