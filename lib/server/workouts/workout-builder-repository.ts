import "server-only";

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor, withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import {
  issueWorkoutTemplateEditToken,
  issueWorkoutTemplateLifecycleToken,
  verifyWorkoutTemplateEditToken,
  verifyWorkoutTemplateLifecycleToken,
} from "@/lib/server/workouts/workout-template-command-crypto";
import type {
  ArchiveTemplateCommandInput,
  BuilderExercise,
  BuilderItem,
  BuilderSet,
  BuilderTemplate,
  CreateRevisionCommandInput,
  DuplicateTemplateCommandInput,
  PublishRevisionCommandInput,
  SaveDraftCommandInput,
  WorkoutBuilderCommandResult,
  WorkoutBuilderOperation,
  WorkoutBuilderValidationIssue,
} from "@/lib/server/workouts/workout-builder-types";

type Head = {
  id: string;
  trainer_user_id: string;
  title: string;
  status: "draft" | "published" | "archived";
  revision_id: string;
  revision_status: "draft" | "published";
  revision_number: number;
  description: string;
  category: string;
  estimated_duration_min: number | null;
  general_instruction: string;
  updated_at: Date;
  usage_count: string;
  published_revision_id: string | null;
  published_revision_number: number | null;
  editable_revision_id: string | null;
  editable_revision_number: number | null;
  lock_version: string;
  lifecycle_version: string;
};

type ExerciseRow = {
  id: string;
  instance_key: string;
  source_exercise_id: string | null;
  source_exercise_key: string;
  title: string;
  category: string;
  equipment: string | null;
  description: string | null;
  image_url: string | null;
  prescription_type: "repetitions" | "duration";
  repetition_mode: "fixed" | "range";
  sets: number | null;
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number | null;
  per_set_mode: boolean;
  trainer_note: string;
  superset_key: string | null;
  superset_position: number | null;
  superset_label: string | null;
  superset_instruction: string | null;
};

type SetRow = {
  exercise_id: string;
  set_key: string;
  position: number;
  kind: "warmup" | "working";
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number | null;
  uses_override: boolean;
};

type ReceiptRow = {
  operation: WorkoutBuilderOperation;
  request_fingerprint: string;
  result_template_id: string;
  result_revision_id: string | null;
  result_lifecycle: string;
  result_version: string;
  result_payload: { outcome?: WorkoutBuilderCommandResult["outcome"] };
};

type PreparedExercise = {
  instanceKey: string;
  position: number;
  sourceExerciseId: string | null;
  sourceExerciseKey: string;
  title: string;
  category: string;
  equipment: string | null;
  description: string | null;
  imageUrl: string | null;
  prescriptionType: "repetitions" | "duration";
  repetitionMode: "fixed" | "range";
  sets: number | null;
  repetitions: number | null;
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  perSetMode: boolean;
  trainerNote: string;
  supersetKey: string | null;
  supersetPosition: number | null;
  supersetLabel: string | null;
  supersetInstruction: string | null;
};

type PreparedSet = {
  instanceKey: string;
  setKey: string;
  position: number;
  kind: "warmup" | "working";
  repetitionsMin: number | null;
  repetitionsMax: number | null;
  durationSeconds: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  usesOverride: boolean;
};

const headSelect = `SELECT template.id, template.trainer_user_id, revision.title,
  CASE WHEN template.status = 'archived' THEN 'archived' ELSE revision.status::text END AS status,
  revision.id AS revision_id, revision.status::text AS revision_status,
  revision.revision_number, revision.description, revision.category,
  revision.estimated_duration_min, revision.general_instruction,
  greatest(template.updated_at, revision.updated_at) AS updated_at,
  template.published_revision_id, published.revision_number AS published_revision_number,
  template.editable_revision_id, editable.revision_number AS editable_revision_number,
  revision.lock_version::text, template.lifecycle_version::text,
  (SELECT count(*)::text FROM app.workout_assignments assignment
   WHERE assignment.source_template_id = template.id) AS usage_count
FROM app.workout_templates template
JOIN app.workout_template_revisions revision ON revision.template_id = template.id
LEFT JOIN app.workout_template_revisions published ON published.id = template.published_revision_id
LEFT JOIN app.workout_template_revisions editable ON editable.id = template.editable_revision_id`;

export type WorkoutBuilderCommandErrorCode =
  | "draft_version_conflict"
  | "command_id_conflict"
  | "template_not_found"
  | "template_archived"
  | "editable_draft_not_found"
  | "editable_draft_already_exists"
  | "published_revision_not_found"
  | "revision_already_published"
  | "publication_validation_failed"
  | "draft_validation_failed"
  | "source_exercise_unavailable"
  | "source_exercise_forbidden"
  | "template_lifecycle_conflict"
  | "command_outcome_unavailable";

export class WorkoutBuilderCommandError extends Error {
  constructor(
    public readonly commandCode: WorkoutBuilderCommandErrorCode,
    public readonly issues: WorkoutBuilderValidationIssue[] = [],
  ) {
    super(commandCode);
  }
}

function valueText(value: number | string | null) {
  return value === null ? "" : String(Number(value));
}

function numeric(value: string) {
  return value === "" ? null : Number(value);
}

function updatedLabel(value: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 2) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ч назад` : value.toLocaleDateString("ru-RU");
}

function mapSet(row: SetRow): BuilderSet {
  return {
    id: row.set_key,
    order: row.position,
    kind: row.kind,
    repetitionsMin: valueText(row.repetitions_min),
    repetitionsMax: valueText(row.repetitions_max),
    durationSec: valueText(row.duration_seconds),
    targetWeightKg: valueText(row.target_weight_kg),
    restSec: valueText(row.rest_seconds),
    usesOverride: row.uses_override,
  };
}

function mapExercise(row: ExerciseRow, sets: BuilderSet[]): BuilderExercise {
  return {
    instanceId: row.instance_key,
    exerciseId: row.source_exercise_key,
    ...(row.source_exercise_id ? { sourceExerciseId: row.source_exercise_id } : {}),
    title: row.title,
    category: row.category,
    ...(row.equipment ? { equipment: row.equipment } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    prescription: {
      type: row.prescription_type,
      sets: valueText(row.sets),
      repetitionMode: row.repetition_mode,
      repetitionsMin: valueText(row.repetitions_min),
      repetitionsMax: valueText(row.repetitions_max),
      durationSec: valueText(row.duration_seconds),
      targetWeightKg: valueText(row.target_weight_kg),
      restSec: valueText(row.rest_seconds),
    },
    perSetMode: row.per_set_mode,
    setOverrides: sets,
    trainerNote: row.trainer_note,
  };
}

function mapItems(rows: ExerciseRow[], sets: Map<string, BuilderSet[]>): BuilderItem[] {
  const items: BuilderItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.superset_key) {
      items.push({ id: row.instance_key, kind: "exercise", exercise: mapExercise(row, sets.get(row.id) ?? []) });
      continue;
    }
    if (seen.has(row.superset_key)) continue;
    seen.add(row.superset_key);
    items.push({
      id: row.superset_key,
      kind: "superset",
      label: row.superset_label ?? "",
      instruction: row.superset_instruction ?? "",
      exercises: rows.filter((item) => item.superset_key === row.superset_key)
        .sort((left, right) => (left.superset_position ?? 0) - (right.superset_position ?? 0))
        .map((item) => mapExercise(item, sets.get(item.id) ?? [])),
    });
  }
  return items;
}

export class WorkoutBuilderRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  list(actor: Actor): Promise<BuilderTemplate[]> {
    return withActorTransaction(actor, async (client) => {
      const heads = await client.query<Head>(`${headSelect}
        WHERE template.trainer_user_id = $1
          AND revision.id = coalesce(template.editable_revision_id, template.published_revision_id)
        ORDER BY template.updated_at DESC`, [actor.userId]);
      if (!heads.rowCount) return [];
      return this.hydrateMany(client, actor.userId, heads.rows);
    }, this.pool);
  }

  saveDraft(actor: Actor, input: SaveDraftCommandInput): Promise<WorkoutBuilderCommandResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const operation: WorkoutBuilderOperation = input.expectedEditToken ? "save_draft" : "create_draft";
      const replay = await this.replay(client, actor.userId, input.commandId, operation, input.requestFingerprint);
      if (replay) return replay;

      let lockVersion = 1;
      if (!input.expectedEditToken) {
        const template = await client.query(`INSERT INTO app.workout_templates
          (id, trainer_user_id, title, description, status, current_revision)
          VALUES ($1,$2,$3,$4,'draft',1)
          ON CONFLICT (id) DO NOTHING RETURNING id`, [
          input.templateId, actor.userId, input.content.title, input.content.description,
        ]);
        if (!template.rowCount) {
          const existing = await client.query<{ status: "draft" | "published" | "archived" }>(
            `SELECT status::text FROM app.workout_templates
             WHERE id = $1 AND trainer_user_id = $2`,
            [input.templateId, actor.userId],
          );
          if (existing.rows[0]?.status === "archived") {
            throw new WorkoutBuilderCommandError("template_archived");
          }
          if (existing.rowCount) throw new WorkoutBuilderCommandError("draft_version_conflict");
          throw new WorkoutBuilderCommandError("template_lifecycle_conflict");
        }
        const revision = await client.query(`INSERT INTO app.workout_template_revisions
          (id, template_id, revision_number, title, description, category,
           estimated_duration_min, general_instruction, status, published_at)
          VALUES ($1,$2,1,$3,$4,$5,$6,$7,'draft',NULL) RETURNING id`, [
          input.revisionId, input.templateId, input.content.title, input.content.description,
          input.content.category, numeric(input.content.estimatedDurationMin), input.content.generalInstruction,
        ]);
        if (!revision.rowCount) throw new WorkoutBuilderCommandError("template_lifecycle_conflict");
        await client.query(`UPDATE app.workout_templates
          SET editable_revision_id = $2 WHERE id = $1`, [input.templateId, input.revisionId]);
      } else {
        const current = await client.query<{
          status: "draft" | "published" | "archived";
          editable_revision_id: string | null;
          revision_status: "draft" | "published";
          revision_number: number;
          lock_version: string;
        }>(`SELECT template.status::text AS status, template.editable_revision_id,
              revision.status::text AS revision_status, revision.revision_number,
              revision.lock_version::text
            FROM app.workout_templates template
            JOIN app.workout_template_revisions revision ON revision.id = $2
            WHERE template.id = $1 AND template.trainer_user_id = $3
            FOR UPDATE OF template, revision`, [input.templateId, input.revisionId, actor.userId]);
        if (!current.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
        const state = current.rows[0];
        if (state.status === "archived") throw new WorkoutBuilderCommandError("template_archived");
        if (state.editable_revision_id !== input.revisionId || state.revision_status !== "draft") {
          throw new WorkoutBuilderCommandError("editable_draft_not_found");
        }
        lockVersion = Number(state.lock_version);
        if (!verifyWorkoutTemplateEditToken(input.expectedEditToken, {
          actorUserId: actor.userId,
          templateId: input.templateId,
          revisionId: input.revisionId,
          version: lockVersion,
        })) {
          throw new WorkoutBuilderCommandError("draft_version_conflict");
        }
        if (state.revision_number !== input.content.revision) {
          throw new WorkoutBuilderCommandError("draft_version_conflict");
        }
        await client.query(`UPDATE app.workout_templates
          SET title = CASE WHEN published_revision_id IS NULL THEN $2 ELSE title END,
              description = CASE WHEN published_revision_id IS NULL THEN $3 ELSE description END
          WHERE id = $1`, [input.templateId, input.content.title, input.content.description]);
        lockVersion += 1;
        await client.query(`UPDATE app.workout_template_revisions
          SET title = $2, description = $3, category = $4, estimated_duration_min = $5,
              general_instruction = $6, lock_version = $7
          WHERE id = $1`, [input.revisionId, input.content.title, input.content.description,
          input.content.category, numeric(input.content.estimatedDurationMin),
          input.content.generalInstruction, lockVersion]);
      }

      await this.replaceItems(client, actor.userId, input.revisionId, input.content.items);
      await client.query(`INSERT INTO app.audit_events
        (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.template.draft_saved',jsonb_build_object(
          'template_id',$2::text,'revision_id',$3::text,'version',$4::bigint))`,
      [actor.userId, input.templateId, input.revisionId, lockVersion]);
      await this.saveReceipt(client, actor.userId, input.commandId, operation,
        input.requestFingerprint, input.templateId, input.revisionId, "draft", lockVersion,
        input.expectedEditToken ? "saved" : "created");
      const template = await this.findRevision(client, actor.userId, input.templateId, input.revisionId);
      if (!template) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
      return { template, replay: false, outcome: input.expectedEditToken ? "saved" : "created" };
    });
  }

  publish(actor: Actor, input: PublishRevisionCommandInput): Promise<WorkoutBuilderCommandResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const replay = await this.replay(client, actor.userId, input.commandId,
        "publish_revision", input.requestFingerprint);
      if (replay) return replay;
      const current = await client.query<{
        status: "draft" | "published" | "archived";
        editable_revision_id: string | null;
        revision_status: "draft" | "published";
        revision_number: number;
        lock_version: string;
      }>(`SELECT template.status::text AS status, template.editable_revision_id,
            revision.status::text AS revision_status, revision.revision_number,
            revision.lock_version::text
          FROM app.workout_templates template
          JOIN app.workout_template_revisions revision ON revision.id = $2
          WHERE template.id = $1 AND template.trainer_user_id = $3
          FOR UPDATE OF template`, [input.templateId, input.revisionId, actor.userId]);
      if (!current.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
      const state = current.rows[0];
      if (state.status === "archived") throw new WorkoutBuilderCommandError("template_archived");
      if (state.revision_status === "published") throw new WorkoutBuilderCommandError("revision_already_published");
      if (state.editable_revision_id !== input.revisionId) throw new WorkoutBuilderCommandError("editable_draft_not_found");
      const lockVersion = Number(state.lock_version);
      if (!verifyWorkoutTemplateEditToken(input.expectedEditToken, {
        actorUserId: actor.userId,
        templateId: input.templateId,
        revisionId: input.revisionId,
        version: lockVersion,
      })) throw new WorkoutBuilderCommandError("draft_version_conflict");

      const validation = await client.query<{ issues: WorkoutBuilderValidationIssue[] }>(
        `SELECT app.workout_template_publication_issues($1) AS issues`, [input.revisionId],
      );
      const issues = validation.rows[0]?.issues ?? [];
      if (issues.length) throw new WorkoutBuilderCommandError("publication_validation_failed", issues);

      const nextVersion = lockVersion + 1;
      await client.query(`UPDATE app.workout_template_revisions
        SET status = 'published', published_at = clock_timestamp(), lock_version = $2
        WHERE id = $1`, [input.revisionId, nextVersion]);
      await client.query(`UPDATE app.workout_templates template
        SET status = 'published', published_revision_id = $2, editable_revision_id = NULL,
            current_revision = $3, title = revision.title, description = revision.description,
            lifecycle_version = lifecycle_version + 1
        FROM app.workout_template_revisions revision
        WHERE template.id = $1 AND revision.id = $2`,
      [input.templateId, input.revisionId, state.revision_number]);
      await client.query(`INSERT INTO app.audit_events
        (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.template.published',jsonb_build_object(
          'template_id',$2::text,'revision_id',$3::text,'revision',$4::integer))`,
      [actor.userId, input.templateId, input.revisionId, state.revision_number]);
      await this.saveReceipt(client, actor.userId, input.commandId, "publish_revision",
        input.requestFingerprint, input.templateId, input.revisionId, "published", nextVersion, "published");
      const template = await this.findRevision(client, actor.userId, input.templateId, input.revisionId);
      if (!template) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
      return { template, replay: false, outcome: "published" };
    });
  }

  createRevision(actor: Actor, input: CreateRevisionCommandInput): Promise<WorkoutBuilderCommandResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const replay = await this.replay(client, actor.userId, input.commandId,
        "create_revision", input.requestFingerprint);
      if (replay) return replay;
      const template = await client.query<{
        status: "draft" | "published" | "archived";
        published_revision_id: string | null;
        editable_revision_id: string | null;
        lifecycle_version: string;
      }>(`SELECT status::text, published_revision_id, editable_revision_id,
            lifecycle_version::text FROM app.workout_templates
          WHERE id = $1 AND trainer_user_id = $2 FOR UPDATE`, [input.templateId, actor.userId]);
      if (!template.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
      const state = template.rows[0];
      if (state.status === "archived") throw new WorkoutBuilderCommandError("template_archived");
      if (input.expectedTemplateToken && !verifyWorkoutTemplateLifecycleToken(input.expectedTemplateToken, {
        actorUserId: actor.userId,
        templateId: input.templateId,
        version: Number(state.lifecycle_version),
      })) throw new WorkoutBuilderCommandError("draft_version_conflict");
      if (state.editable_revision_id) {
        await this.saveReceipt(client, actor.userId, input.commandId, "create_revision",
          input.requestFingerprint, input.templateId, state.editable_revision_id, "draft",
          Number(state.lifecycle_version), "existing_draft");
        const existing = await this.findRevision(client, actor.userId, input.templateId, state.editable_revision_id);
        if (!existing) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
        return { template: existing, replay: false, outcome: "existing_draft" };
      }
      if (!state.published_revision_id) throw new WorkoutBuilderCommandError("published_revision_not_found");
      const source = await client.query<{
        revision_number: number;
        title: string;
        description: string;
        category: string;
        estimated_duration_min: number | null;
        general_instruction: string;
      }>(`SELECT revision_number, title, description, category,
            estimated_duration_min, general_instruction
          FROM app.workout_template_revisions
          WHERE id = $1 AND template_id = $2 AND status = 'published'`,
      [state.published_revision_id, input.templateId]);
      if (!source.rowCount) throw new WorkoutBuilderCommandError("published_revision_not_found");
      const revisionId = randomUUID();
      const nextRevision = source.rows[0].revision_number + 1;
      await client.query(`INSERT INTO app.workout_template_revisions
        (id, template_id, revision_number, title, description, category,
         estimated_duration_min, general_instruction, status, published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',NULL)`, [
        revisionId, input.templateId, nextRevision, source.rows[0].title, source.rows[0].description,
        source.rows[0].category, source.rows[0].estimated_duration_min, source.rows[0].general_instruction,
      ]);
      await client.query(`UPDATE app.workout_templates
        SET editable_revision_id = $2, current_revision = $3,
            lifecycle_version = lifecycle_version + 1 WHERE id = $1`,
      [input.templateId, revisionId, nextRevision]);
      await this.cloneRevisionRows(client, state.published_revision_id, revisionId, false);
      const lifecycleVersion = Number(state.lifecycle_version) + 1;
      await client.query(`INSERT INTO app.audit_events
        (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.template.revision_created',jsonb_build_object(
          'template_id',$2::text,'revision_id',$3::text,'revision',$4::integer))`,
      [actor.userId, input.templateId, revisionId, nextRevision]);
      await this.saveReceipt(client, actor.userId, input.commandId, "create_revision",
        input.requestFingerprint, input.templateId, revisionId, "draft", lifecycleVersion, "created");
      const result = await this.findRevision(client, actor.userId, input.templateId, revisionId);
      if (!result) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
      return { template: result, replay: false, outcome: "created" };
    });
  }

  duplicate(actor: Actor, input: DuplicateTemplateCommandInput): Promise<WorkoutBuilderCommandResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const replay = await this.replay(client, actor.userId, input.commandId,
        "duplicate_template", input.requestFingerprint);
      if (replay) return replay;
      const sourceHead = await client.query<{
        published_revision_id: string | null;
        editable_revision_id: string | null;
      }>(`SELECT published_revision_id, editable_revision_id
          FROM app.workout_templates
          WHERE id = $1 AND trainer_user_id = $2 FOR UPDATE`, [input.sourceTemplateId, actor.userId]);
      if (!sourceHead.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
      const sourceRevisionId = input.sourceRevisionIntent === "published"
        ? sourceHead.rows[0].published_revision_id
        : input.sourceRevisionIntent === "editable"
          ? sourceHead.rows[0].editable_revision_id
          : sourceHead.rows[0].editable_revision_id ?? sourceHead.rows[0].published_revision_id;
      if (!sourceRevisionId) {
        throw new WorkoutBuilderCommandError(input.sourceRevisionIntent === "published"
          ? "published_revision_not_found" : "editable_draft_not_found");
      }
      const sourceRevision = await client.query<{
        description: string;
        category: string;
        estimated_duration_min: number | null;
        general_instruction: string;
      }>(`SELECT description, category, estimated_duration_min, general_instruction
          FROM app.workout_template_revisions
          WHERE id = $1 AND template_id = $2`, [sourceRevisionId, input.sourceTemplateId]);
      if (!sourceRevision.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
      const created = await client.query(`INSERT INTO app.workout_templates
        (id, trainer_user_id, title, description, status, current_revision)
        VALUES ($1,$2,$3,$4,'draft',1) ON CONFLICT (id) DO NOTHING RETURNING id`, [
        input.newTemplateId, actor.userId, input.title, sourceRevision.rows[0].description,
      ]);
      if (!created.rowCount) throw new WorkoutBuilderCommandError("template_lifecycle_conflict");
      await client.query(`INSERT INTO app.workout_template_revisions
        (id, template_id, revision_number, title, description, category,
         estimated_duration_min, general_instruction, status, published_at)
        VALUES ($1,$2,1,$3,$4,$5,$6,$7,'draft',NULL)`, [
        input.newRevisionId, input.newTemplateId, input.title, sourceRevision.rows[0].description,
        sourceRevision.rows[0].category, sourceRevision.rows[0].estimated_duration_min,
        sourceRevision.rows[0].general_instruction,
      ]);
      await client.query(`UPDATE app.workout_templates
        SET editable_revision_id = $2 WHERE id = $1`, [input.newTemplateId, input.newRevisionId]);
      await this.cloneRevisionRows(client, sourceRevisionId, input.newRevisionId, true);
      await client.query(`INSERT INTO app.audit_events
        (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.template.duplicated',jsonb_build_object(
          'source_template_id',$2::text,'source_revision_id',$3::text,
          'template_id',$4::text,'revision_id',$5::text))`,
      [actor.userId, input.sourceTemplateId, sourceRevisionId, input.newTemplateId, input.newRevisionId]);
      await this.saveReceipt(client, actor.userId, input.commandId, "duplicate_template",
        input.requestFingerprint, input.newTemplateId, input.newRevisionId, "draft", 1, "duplicated");
      const result = await this.findRevision(client, actor.userId, input.newTemplateId, input.newRevisionId);
      if (!result) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
      return { template: result, replay: false, outcome: "duplicated" };
    });
  }

  archive(actor: Actor, input: ArchiveTemplateCommandInput): Promise<WorkoutBuilderCommandResult> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await setTransactionActor(client, actor);
      const replay = await this.replay(client, actor.userId, input.commandId,
        "archive_template", input.requestFingerprint);
      if (replay) return replay;
      const current = await client.query<{
        status: "draft" | "published" | "archived";
        lifecycle_version: string;
        revision_id: string;
      }>(`SELECT template.status::text, template.lifecycle_version::text,
            coalesce(template.editable_revision_id, template.published_revision_id) AS revision_id
          FROM app.workout_templates template
          WHERE template.id = $1 AND template.trainer_user_id = $2
          FOR UPDATE`, [input.templateId, actor.userId]);
      if (!current.rowCount) throw new WorkoutBuilderCommandError("template_not_found");
      const state = current.rows[0];
      if (state.status === "archived") {
        await this.saveReceipt(client, actor.userId, input.commandId, "archive_template",
          input.requestFingerprint, input.templateId, state.revision_id, "archived",
          Number(state.lifecycle_version), "already_archived");
        const existing = await this.findRevision(client, actor.userId, input.templateId, state.revision_id);
        if (!existing) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
        return { template: existing, replay: false, outcome: "already_archived" };
      }
      if (input.expectedTemplateToken && !verifyWorkoutTemplateLifecycleToken(input.expectedTemplateToken, {
        actorUserId: actor.userId,
        templateId: input.templateId,
        version: Number(state.lifecycle_version),
      })) throw new WorkoutBuilderCommandError("draft_version_conflict");
      const nextVersion = Number(state.lifecycle_version) + 1;
      await client.query(`UPDATE app.workout_templates
        SET status = 'archived', lifecycle_version = $2 WHERE id = $1`, [input.templateId, nextVersion]);
      await client.query(`INSERT INTO app.audit_events
        (actor_user_id, subject_user_id, event_type, metadata)
        VALUES ($1,$1,'workout.template.archived',jsonb_build_object('template_id',$2::text))`,
      [actor.userId, input.templateId]);
      await this.saveReceipt(client, actor.userId, input.commandId, "archive_template",
        input.requestFingerprint, input.templateId, state.revision_id, "archived", nextVersion, "archived");
      const result = await this.findRevision(client, actor.userId, input.templateId, state.revision_id);
      if (!result) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
      return { template: result, replay: false, outcome: "archived" };
    });
  }

  private async replay(
    client: PoolClient,
    trainerId: string,
    commandId: string,
    operation: WorkoutBuilderOperation,
    fingerprint: string,
  ): Promise<WorkoutBuilderCommandResult | null> {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`workout-template-command:${trainerId}:${commandId}`],
    );
    const result = await client.query<ReceiptRow>(`SELECT operation, request_fingerprint,
      result_template_id, result_revision_id, result_lifecycle, result_version::text, result_payload
      FROM app.workout_template_command_receipts
      WHERE trainer_user_id = $1 AND command_id = $2`, [trainerId, commandId]);
    if (!result.rowCount) return null;
    const receipt = result.rows[0];
    if (receipt.operation !== operation || receipt.request_fingerprint !== fingerprint) {
      throw new WorkoutBuilderCommandError("command_id_conflict");
    }
    const template = receipt.result_revision_id
      ? await this.findRevision(client, trainerId, receipt.result_template_id, receipt.result_revision_id)
      : await this.find(client, trainerId, receipt.result_template_id);
    if (!template) throw new WorkoutBuilderCommandError("command_outcome_unavailable");
    return {
      template,
      replay: true,
      outcome: receipt.result_payload.outcome ?? this.outcomeFromLifecycle(receipt.result_lifecycle),
    };
  }

  private outcomeFromLifecycle(lifecycle: string): WorkoutBuilderCommandResult["outcome"] {
    if (lifecycle === "published") return "published";
    if (lifecycle === "archived") return "archived";
    return "saved";
  }

  private saveReceipt(
    client: PoolClient,
    trainerId: string,
    commandId: string,
    operation: WorkoutBuilderOperation,
    fingerprint: string,
    templateId: string,
    revisionId: string | null,
    lifecycle: string,
    version: number,
    outcome: WorkoutBuilderCommandResult["outcome"],
  ) {
    return client.query(`INSERT INTO app.workout_template_command_receipts
      (trainer_user_id, command_id, operation, request_fingerprint,
       result_template_id, result_revision_id, result_lifecycle, result_version, result_payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,jsonb_build_object('outcome',$9::text))`, [
      trainerId, commandId, operation, fingerprint, templateId, revisionId, lifecycle, version, outcome,
    ]);
  }

  private async find(client: PoolClient, trainerId: string, templateId: string) {
    const result = await client.query<Head>(`${headSelect}
      WHERE template.id = $1 AND template.trainer_user_id = $2
        AND revision.id = coalesce(template.editable_revision_id, template.published_revision_id)`,
    [templateId, trainerId]);
    return result.rowCount ? this.hydrate(client, trainerId, result.rows[0]) : null;
  }

  private async findRevision(client: PoolClient, trainerId: string, templateId: string, revisionId: string) {
    const result = await client.query<Head>(`${headSelect}
      WHERE template.id = $1 AND template.trainer_user_id = $2 AND revision.id = $3`,
    [templateId, trainerId, revisionId]);
    return result.rowCount ? this.hydrate(client, trainerId, result.rows[0]) : null;
  }

  private async hydrate(client: PoolClient, trainerId: string, head: Head): Promise<BuilderTemplate> {
    const exercises = await client.query<ExerciseRow>(`SELECT * FROM app.workout_template_exercises
      WHERE revision_id = $1 ORDER BY position`, [head.revision_id]);
    const ids = exercises.rows.map((row) => row.id);
    const rows = ids.length ? (await client.query<SetRow>(`SELECT * FROM app.workout_template_exercise_sets
      WHERE exercise_id = ANY($1::uuid[]) ORDER BY exercise_id, position`, [ids])).rows : [];
    return this.mapTemplate(trainerId, head, exercises.rows, rows);
  }

  private async hydrateMany(client: PoolClient, trainerId: string, heads: Head[]) {
    const revisionIds = heads.map((head) => head.revision_id);
    const exercises = await client.query<ExerciseRow & { revision_id: string }>(`SELECT *
      FROM app.workout_template_exercises WHERE revision_id = ANY($1::uuid[])
      ORDER BY revision_id, position`, [revisionIds]);
    const exerciseIds = exercises.rows.map((row) => row.id);
    const sets = exerciseIds.length ? (await client.query<SetRow>(`SELECT *
      FROM app.workout_template_exercise_sets WHERE exercise_id = ANY($1::uuid[])
      ORDER BY exercise_id, position`, [exerciseIds])).rows : [];
    return heads.map((head) => this.mapTemplate(
      trainerId,
      head,
      exercises.rows.filter((row) => row.revision_id === head.revision_id),
      sets,
    ));
  }

  private mapTemplate(trainerId: string, head: Head, exercises: ExerciseRow[], setRows: SetRow[]): BuilderTemplate {
    const sets = new Map<string, BuilderSet[]>();
    for (const row of setRows) {
      if (!exercises.some((exercise) => exercise.id === row.exercise_id)) continue;
      sets.set(row.exercise_id, [...(sets.get(row.exercise_id) ?? []), mapSet(row)]);
    }
    const lockVersion = Number(head.lock_version);
    const lifecycleVersion = Number(head.lifecycle_version);
    return {
      id: head.id,
      revisionId: head.revision_id,
      title: head.title,
      status: head.status,
      revision: head.revision_number,
      description: head.description,
      category: head.category,
      estimatedDurationMin: valueText(head.estimated_duration_min),
      generalInstruction: head.general_instruction,
      items: mapItems(exercises, sets),
      updatedLabel: updatedLabel(head.updated_at),
      usageCount: Number(head.usage_count),
      latestPublishedRevision: head.published_revision_id && head.published_revision_number
        ? { revisionId: head.published_revision_id, revision: head.published_revision_number }
        : null,
      editableRevision: head.editable_revision_id && head.editable_revision_number
        ? { revisionId: head.editable_revision_id, revision: head.editable_revision_number }
        : null,
      editToken: head.revision_status === "draft" && head.editable_revision_id === head.revision_id
        ? issueWorkoutTemplateEditToken({
          actorUserId: trainerId,
          templateId: head.id,
          revisionId: head.revision_id,
          version: lockVersion,
        })
        : null,
      templateToken: issueWorkoutTemplateLifecycleToken({
        actorUserId: trainerId,
        templateId: head.id,
        version: lifecycleVersion,
      }),
    };
  }

  private async replaceItems(client: PoolClient, trainerId: string, revisionId: string, items: BuilderItem[]) {
    const existing = await client.query<{
      instance_key: string;
      source_exercise_id: string | null;
      source_exercise_key: string;
    }>(`SELECT instance_key, source_exercise_id, source_exercise_key
        FROM app.workout_template_exercises WHERE revision_id = $1`, [revisionId]);
    const existingByInstance = new Map(existing.rows.map((row) => [row.instance_key, row]));
    const prepared = await this.prepareRows(client, trainerId, items, existingByInstance);
    await client.query(`DELETE FROM app.workout_template_exercise_sets
      WHERE exercise_id IN (SELECT id FROM app.workout_template_exercises WHERE revision_id = $1)`, [revisionId]);
    await client.query(`DELETE FROM app.workout_template_exercises WHERE revision_id = $1`, [revisionId]);
    await this.insertPreparedRows(client, revisionId, prepared.exercises, prepared.sets);
  }

  private async prepareRows(
    client: PoolClient,
    trainerId: string,
    items: BuilderItem[],
    existingByInstance = new Map<string, { source_exercise_id: string | null; source_exercise_key: string }>(),
  ) {
    const all = items.flatMap((item) => item.kind === "exercise" ? [item.exercise] : item.exercises);
    const requestedIds = all.flatMap((exercise) => exercise.sourceExerciseId ? [exercise.sourceExerciseId] : []);
    const requestedKeys = [...new Set(all.map((exercise) => exercise.exerciseId))];
    const sources = await client.query<{
      id: string;
      stable_key: string;
      status: "active" | "archived";
    }>(`SELECT id, stable_key, status::text FROM app.exercises
      WHERE (id = ANY($1::uuid[]) OR stable_key = ANY($2::text[]))
        AND (scope = 'system' OR owner_trainer_user_id = $3)`,
    [requestedIds, requestedKeys, trainerId]);
    const exercises: PreparedExercise[] = [];
    const sets: PreparedSet[] = [];
    let position = 0;
    for (const item of items) {
      const members = item.kind === "exercise" ? [item.exercise] : item.exercises;
      for (const [index, exercise] of members.entries()) {
        position += 1;
        const previous = existingByInstance.get(exercise.instanceId);
        let sourceExerciseId: string | null = null;
        if (previous?.source_exercise_key === exercise.exerciseId) {
          sourceExerciseId = previous.source_exercise_id;
        } else if (exercise.sourceExerciseId) {
          const source = sources.rows.find((row) => row.id === exercise.sourceExerciseId
            && row.stable_key === exercise.exerciseId);
          if (!source) throw new WorkoutBuilderCommandError("source_exercise_forbidden");
          if (source.status !== "active") throw new WorkoutBuilderCommandError("source_exercise_unavailable");
          sourceExerciseId = source.id;
        } else {
          sourceExerciseId = null;
        }
        const repetitionsMin = numeric(exercise.prescription.repetitionsMin);
        exercises.push({
          instanceKey: exercise.instanceId,
          position,
          sourceExerciseId,
          sourceExerciseKey: exercise.exerciseId,
          title: exercise.title,
          category: exercise.category,
          equipment: exercise.equipment ?? null,
          description: exercise.description ?? null,
          imageUrl: exercise.imageUrl ?? null,
          prescriptionType: exercise.prescription.type,
          repetitionMode: exercise.prescription.repetitionMode,
          sets: numeric(exercise.prescription.sets),
          repetitions: exercise.prescription.type === "repetitions" ? repetitionsMin : null,
          repetitionsMin: exercise.prescription.type === "repetitions" ? repetitionsMin : null,
          repetitionsMax: exercise.prescription.type === "repetitions"
            ? numeric(exercise.prescription.repetitionsMax) : null,
          durationSeconds: exercise.prescription.type === "duration"
            ? numeric(exercise.prescription.durationSec) : null,
          targetWeightKg: numeric(exercise.prescription.targetWeightKg),
          restSeconds: numeric(exercise.prescription.restSec),
          perSetMode: exercise.perSetMode,
          trainerNote: exercise.trainerNote,
          supersetKey: item.kind === "superset" ? item.id : null,
          supersetPosition: item.kind === "superset" ? index + 1 : null,
          supersetLabel: item.kind === "superset" ? item.label : null,
          supersetInstruction: item.kind === "superset" ? item.instruction : null,
        });
        for (const set of exercise.setOverrides) {
          sets.push({
            instanceKey: exercise.instanceId,
            setKey: set.id,
            position: set.order,
            kind: set.kind,
            repetitionsMin: exercise.prescription.type === "repetitions" ? numeric(set.repetitionsMin) : null,
            repetitionsMax: exercise.prescription.type === "repetitions" ? numeric(set.repetitionsMax) : null,
            durationSeconds: exercise.prescription.type === "duration" ? numeric(set.durationSec) : null,
            targetWeightKg: numeric(set.targetWeightKg),
            restSeconds: numeric(set.restSec),
            usesOverride: set.usesOverride,
          });
        }
      }
    }
    return { exercises, sets };
  }

  private async insertPreparedRows(
    client: PoolClient,
    revisionId: string,
    exercises: PreparedExercise[],
    sets: PreparedSet[],
  ) {
    if (!exercises.length) return;
    await client.query(`INSERT INTO app.workout_template_exercises
      (revision_id, instance_key, position, source_exercise_id, source_exercise_key,
       title, category, equipment, description, image_url, prescription_type,
       repetition_mode, sets, repetitions, repetitions_min, repetitions_max,
       duration_seconds, target_weight_kg, rest_seconds, per_set_mode, trainer_note,
       superset_key, superset_position, superset_label, superset_instruction)
      SELECT $1, row.instance_key, row.position, row.source_exercise_id, row.source_exercise_key,
        row.title, row.category, row.equipment, row.description, row.image_url,
        row.prescription_type::app.workout_prescription_type,
        row.repetition_mode::app.workout_repetition_mode, row.sets, row.repetitions,
        row.repetitions_min, row.repetitions_max, row.duration_seconds,
        row.target_weight_kg, row.rest_seconds, row.per_set_mode, row.trainer_note,
        row.superset_key, row.superset_position, row.superset_label, row.superset_instruction
      FROM jsonb_to_recordset($2::jsonb) AS row(
        instance_key text, position integer, source_exercise_id uuid, source_exercise_key text,
        title text, category text, equipment text, description text, image_url text,
        prescription_type text, repetition_mode text, sets integer, repetitions integer,
        repetitions_min integer, repetitions_max integer, duration_seconds integer,
        target_weight_kg numeric, rest_seconds integer, per_set_mode boolean, trainer_note text,
        superset_key text, superset_position integer, superset_label text, superset_instruction text
      )`, [revisionId, JSON.stringify(exercises.map((row) => ({
        instance_key: row.instanceKey,
        position: row.position,
        source_exercise_id: row.sourceExerciseId,
        source_exercise_key: row.sourceExerciseKey,
        title: row.title,
        category: row.category,
        equipment: row.equipment,
        description: row.description,
        image_url: row.imageUrl,
        prescription_type: row.prescriptionType,
        repetition_mode: row.repetitionMode,
        sets: row.sets,
        repetitions: row.repetitions,
        repetitions_min: row.repetitionsMin,
        repetitions_max: row.repetitionsMax,
        duration_seconds: row.durationSeconds,
        target_weight_kg: row.targetWeightKg,
        rest_seconds: row.restSeconds,
        per_set_mode: row.perSetMode,
        trainer_note: row.trainerNote,
        superset_key: row.supersetKey,
        superset_position: row.supersetPosition,
        superset_label: row.supersetLabel,
        superset_instruction: row.supersetInstruction,
      })))]);
    if (!sets.length) return;
    await client.query(`INSERT INTO app.workout_template_exercise_sets
      (exercise_id, set_key, position, kind, repetitions_min, repetitions_max,
       duration_seconds, target_weight_kg, rest_seconds, uses_override)
      SELECT exercise.id, row.set_key, row.position, row.kind::app.workout_set_kind,
        row.repetitions_min, row.repetitions_max, row.duration_seconds,
        row.target_weight_kg, row.rest_seconds, row.uses_override
      FROM jsonb_to_recordset($2::jsonb) AS row(
        instance_key text, set_key text, position integer, kind text,
        repetitions_min integer, repetitions_max integer, duration_seconds integer,
        target_weight_kg numeric, rest_seconds integer, uses_override boolean
      )
      JOIN app.workout_template_exercises exercise
        ON exercise.revision_id = $1 AND exercise.instance_key = row.instance_key`,
    [revisionId, JSON.stringify(sets.map((row) => ({
      instance_key: row.instanceKey,
      set_key: row.setKey,
      position: row.position,
      kind: row.kind,
      repetitions_min: row.repetitionsMin,
      repetitions_max: row.repetitionsMax,
      duration_seconds: row.durationSeconds,
      target_weight_kg: row.targetWeightKg,
      rest_seconds: row.restSeconds,
      uses_override: row.usesOverride,
    })))]);
  }

  private async cloneRevisionRows(client: PoolClient, sourceRevisionId: string, targetRevisionId: string, regenerateKeys: boolean) {
    if (!regenerateKeys) {
      await client.query(`INSERT INTO app.workout_template_exercises
        (revision_id, instance_key, position, source_exercise_id, source_exercise_key, title,
         category, equipment, description, image_url, prescription_type, repetition_mode,
         sets, repetitions, repetitions_min, repetitions_max, duration_seconds,
         target_weight_kg, rest_seconds, per_set_mode, trainer_note, superset_key,
         superset_position, superset_label, superset_instruction)
        SELECT $1, instance_key, position, source_exercise_id, source_exercise_key, title,
         category, equipment, description, image_url, prescription_type, repetition_mode,
         sets, repetitions, repetitions_min, repetitions_max, duration_seconds,
         target_weight_kg, rest_seconds, per_set_mode, trainer_note, superset_key,
         superset_position, superset_label, superset_instruction
        FROM app.workout_template_exercises WHERE revision_id = $2 ORDER BY position`,
      [targetRevisionId, sourceRevisionId]);
      await client.query(`INSERT INTO app.workout_template_exercise_sets
        (exercise_id, set_key, position, kind, repetitions_min, repetitions_max,
         duration_seconds, target_weight_kg, rest_seconds, uses_override)
        SELECT target.id, source_set.set_key, source_set.position, source_set.kind,
          source_set.repetitions_min, source_set.repetitions_max, source_set.duration_seconds,
          source_set.target_weight_kg, source_set.rest_seconds, source_set.uses_override
        FROM app.workout_template_exercise_sets source_set
        JOIN app.workout_template_exercises source ON source.id = source_set.exercise_id
        JOIN app.workout_template_exercises target
          ON target.revision_id = $1 AND target.instance_key = source.instance_key
        WHERE source.revision_id = $2`, [targetRevisionId, sourceRevisionId]);
      return;
    }
    const sourceExercises = await client.query<ExerciseRow>(`SELECT *
      FROM app.workout_template_exercises WHERE revision_id = $1 ORDER BY position`, [sourceRevisionId]);
    const ids = sourceExercises.rows.map((row) => row.id);
    const sourceSets = ids.length ? (await client.query<SetRow>(`SELECT *
      FROM app.workout_template_exercise_sets WHERE exercise_id = ANY($1::uuid[])
      ORDER BY exercise_id, position`, [ids])).rows : [];
    const supersetKeys = new Map<string, string>();
    const instanceKeys = new Map<string, string>();
    const preparedExercises = sourceExercises.rows.map((row) => {
      const instanceKey = randomUUID();
      instanceKeys.set(row.id, instanceKey);
      let supersetKey: string | null = null;
      if (row.superset_key) {
        supersetKey = supersetKeys.get(row.superset_key) ?? randomUUID();
        supersetKeys.set(row.superset_key, supersetKey);
      }
      return {
        instanceKey,
        position: sourceExercises.rows.indexOf(row) + 1,
        sourceExerciseId: row.source_exercise_id,
        sourceExerciseKey: row.source_exercise_key,
        title: row.title,
        category: row.category,
        equipment: row.equipment,
        description: row.description,
        imageUrl: row.image_url,
        prescriptionType: row.prescription_type,
        repetitionMode: row.repetition_mode,
        sets: row.sets,
        repetitions: row.prescription_type === "repetitions" ? row.repetitions_min : null,
        repetitionsMin: row.repetitions_min,
        repetitionsMax: row.repetitions_max,
        durationSeconds: row.duration_seconds,
        targetWeightKg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
        restSeconds: row.rest_seconds,
        perSetMode: row.per_set_mode,
        trainerNote: row.trainer_note,
        supersetKey,
        supersetPosition: row.superset_position,
        supersetLabel: row.superset_label,
        supersetInstruction: row.superset_instruction,
      } satisfies PreparedExercise;
    });
    const preparedSets = sourceSets.map((row) => ({
      instanceKey: instanceKeys.get(row.exercise_id)!,
      setKey: randomUUID(),
      position: row.position,
      kind: row.kind,
      repetitionsMin: row.repetitions_min,
      repetitionsMax: row.repetitions_max,
      durationSeconds: row.duration_seconds,
      targetWeightKg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
      restSeconds: row.rest_seconds,
      usesOverride: row.uses_override,
    } satisfies PreparedSet));
    await this.insertPreparedRows(client, targetRevisionId, preparedExercises, preparedSets);
  }
}
