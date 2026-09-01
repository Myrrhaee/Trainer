import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import {
  decodeQuickAssignCursor,
  encodeQuickAssignCursor,
  normalizeQuickAssignSearch,
} from "./quick-assign-cursor";
import type {
  QuickAssignExercisePreview,
  QuickAssignListInput,
  QuickAssignScope,
  QuickAssignSelectedTemplate,
  QuickAssignTemplateListItem,
  QuickAssignUpcomingAssignment,
} from "./quick-assign-types";

type ScopeRow = {
  relation_id: string;
  athlete_user_id: string;
  relation_status: "active" | "suspended";
  athlete_status: "active" | "suspended" | "archived";
  display_name: string | null;
  read_at: Date;
  today: string;
  tomorrow: string;
};

type UpcomingRow = {
  assignment_id: string;
  source_revision_id: string;
  title_snapshot: string;
  scheduled_for: string;
  created_at: Date;
};

type TemplateSummaryRow = {
  template_id: string;
  revision_id: string;
  revision_number: number;
  title: string;
  description: string;
  category: string;
  exercise_count: number;
  prescribed_set_count: number;
  superset_count: number;
  estimated_duration_min: number | null;
  updated_at: Date;
};

type PreviewHeadRow = {
  template_id: string;
  template_status: "draft" | "published" | "archived";
  current_revision: number;
  revision_id: string;
  revision_number: number;
  revision_status: "draft" | "published";
  title: string;
  description: string;
  category: string;
  general_instruction: string;
  estimated_duration_min: number | null;
  updated_at: Date;
};

type PreviewExerciseRow = {
  id: string;
  instance_key: string;
  position: number;
  title: string;
  category: string;
  equipment: string | null;
  prescription_type: "repetitions" | "duration";
  repetition_mode: "fixed" | "range";
  sets: number;
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number;
  trainer_note: string;
  superset_key: string | null;
  superset_position: number | null;
  superset_label: string | null;
  superset_instruction: string | null;
};

type PreviewSetRow = {
  id: string;
  exercise_id: string;
  set_key: string;
  position: number;
  kind: "warmup" | "working";
  repetitions_min: number | null;
  repetitions_max: number | null;
  duration_seconds: number | null;
  target_weight_kg: string | null;
  rest_seconds: number;
  uses_override: boolean;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

export class QuickAssignRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  findScope(actor: Actor, athleteUserId: string): Promise<QuickAssignScope | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ScopeRow>(`
        SELECT relation.id AS relation_id,
               relation.athlete_user_id,
               relation.status::text AS relation_status,
               profile.status::text AS athlete_status,
               account.display_name,
               clock_timestamp() AS read_at,
               current_date::text AS today,
               (current_date + 1)::text AS tomorrow
        FROM app.trainer_athlete_relations relation
        JOIN app.athlete_profiles profile ON profile.user_id = relation.athlete_user_id
        LEFT JOIN app.users account ON account.id = relation.athlete_user_id
        WHERE relation.trainer_user_id = $1
          AND relation.athlete_user_id = $2
          AND relation.status IN ('active', 'suspended')
        ORDER BY (relation.status = 'active') DESC, relation.accepted_at DESC, relation.id DESC
        LIMIT 1
      `, [actor.userId, athleteUserId]);
      const row = result.rows[0];
      if (!row) return null;
      const displayName = row.display_name?.trim() || `Спортсмен ${row.athlete_user_id.slice(0, 6)}`;
      return {
        athleteUserId: row.athlete_user_id,
        relationId: row.relation_id,
        displayName,
        initials: initials(displayName),
        relationStatus: row.relation_status,
        athleteStatus: row.athlete_status,
        readAt: row.read_at.toISOString(),
        today: row.today,
        tomorrow: row.tomorrow,
      };
    }, this.pool);
  }

  findUpcoming(
    actor: Actor,
    scope: Pick<QuickAssignScope, "relationId" | "athleteUserId">,
  ): Promise<QuickAssignUpcomingAssignment[]> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<UpcomingRow>(`
        SELECT assignment.id AS assignment_id,
               assignment.source_revision_id,
               assignment.title_snapshot,
               assignment.scheduled_for::text AS scheduled_for,
               assignment.created_at
        FROM app.workout_assignments assignment
        LEFT JOIN app.workout_sessions session ON session.assignment_id = assignment.id
        WHERE assignment.relation_id = $2
          AND assignment.trainer_user_id = $1
          AND assignment.athlete_user_id = $3
          AND assignment.status = 'available'
          AND session.id IS NULL
        ORDER BY assignment.scheduled_for ASC, assignment.created_at ASC, assignment.id ASC
      `, [actor.userId, scope.relationId, scope.athleteUserId]);
      return result.rows.map(mapUpcoming);
    }, this.pool);
  }

  async listTemplates(
    actor: Actor,
    scope: Pick<QuickAssignScope, "relationId" | "athleteUserId">,
    input: QuickAssignListInput = {},
  ) {
    const query = normalizeQuickAssignSearch(input.query);
    const first = normalizePageSize(input.first);
    const cursor = input.after
      ? decodeQuickAssignCursor(input.after, {
          trainerUserId: actor.userId,
          athleteUserId: scope.athleteUserId,
          relationId: scope.relationId,
          query,
        })
      : null;

    return withActorTransaction(actor, async (client) => {
      const result = await client.query<TemplateSummaryRow>(`
        WITH set_counts AS (
          SELECT source.exercise_id, count(*)::int AS set_count
          FROM app.workout_template_exercise_sets source
          GROUP BY source.exercise_id
        ), revision_summary AS (
          SELECT exercise.revision_id,
                 count(*)::int AS exercise_count,
                 sum(coalesce(set_counts.set_count, exercise.sets))::int AS prescribed_set_count,
                 count(DISTINCT exercise.superset_key)
                   FILTER (WHERE exercise.superset_key IS NOT NULL)::int AS superset_count
          FROM app.workout_template_exercises exercise
          LEFT JOIN set_counts ON set_counts.exercise_id = exercise.id
          GROUP BY exercise.revision_id
        )
        SELECT template.id AS template_id,
               revision.id AS revision_id,
               revision.revision_number,
               revision.title,
               revision.description,
               revision.category,
               summary.exercise_count,
               summary.prescribed_set_count,
               summary.superset_count,
               revision.estimated_duration_min,
               template.updated_at
        FROM app.workout_templates template
        JOIN app.workout_template_revisions revision
          ON revision.template_id = template.id
         AND revision.revision_number = template.current_revision
        JOIN revision_summary summary ON summary.revision_id = revision.id
        WHERE template.trainer_user_id = $1
          AND template.status = 'published'
          AND template.archived_at IS NULL
          AND revision.status = 'published'
          AND summary.exercise_count > 0
          AND ($2 = '' OR lower(revision.title) LIKE '%' || $2 || '%'
            OR lower(revision.description) LIKE '%' || $2 || '%'
            OR lower(revision.category) LIKE '%' || $2 || '%')
          AND ($3::timestamptz IS NULL
            OR template.updated_at < $3
            OR (template.updated_at = $3 AND template.id < $4::uuid))
        ORDER BY template.updated_at DESC, template.id DESC
        LIMIT $5
      `, [actor.userId, query, cursor?.updatedAt ?? null, cursor?.templateId ?? null, first + 1]);
      const hasNextPage = result.rows.length > first;
      const rows = result.rows.slice(0, first);
      const items = rows.map(mapTemplateSummary);
      const last = rows.at(-1);
      return {
        items,
        pageInfo: {
          hasNextPage,
          endCursor: hasNextPage && last
            ? encodeQuickAssignCursor({
                trainerUserId: actor.userId,
                athleteUserId: scope.athleteUserId,
                relationId: scope.relationId,
                query,
                updatedAt: last.updated_at.toISOString(),
                templateId: last.template_id,
              })
            : null,
        },
        search: { query, pageSize: first },
      };
    }, this.pool);
  }

  findPreview(actor: Actor, templateRevisionId: string): Promise<QuickAssignSelectedTemplate> {
    return withActorTransaction(actor, async (client) => {
      const head = await client.query<PreviewHeadRow>(`
        SELECT template.id AS template_id,
               template.status::text AS template_status,
               template.current_revision,
               revision.id AS revision_id,
               revision.revision_number,
               revision.status::text AS revision_status,
               revision.title,
               revision.description,
               revision.category,
               revision.general_instruction,
               revision.estimated_duration_min,
               template.updated_at
        FROM app.workout_template_revisions revision
        JOIN app.workout_templates template ON template.id = revision.template_id
        WHERE revision.id = $2
          AND template.trainer_user_id = $1
      `, [actor.userId, templateRevisionId]);
      const source = head.rows[0];
      if (!source) return { status: "unavailable" };
      const tombstone = {
        templateId: source.template_id,
        revisionId: source.revision_id,
        revisionNumber: source.revision_number,
        title: source.title,
      };
      if (source.template_status === "archived") return { status: "archived", tombstone };
      if (source.revision_number !== source.current_revision) return { status: "stale_revision", tombstone };
      if (source.template_status !== "published" || source.revision_status !== "published") {
        return { status: "draft", tombstone };
      }

      const [exerciseResult, setResult] = await Promise.all([
        client.query<PreviewExerciseRow>(`
          SELECT exercise.id, exercise.instance_key, exercise.position, exercise.title,
                 exercise.category, exercise.equipment,
                 exercise.prescription_type::text, exercise.repetition_mode::text,
                 exercise.sets, exercise.repetitions_min, exercise.repetitions_max,
                 exercise.duration_seconds, exercise.target_weight_kg,
                 exercise.rest_seconds, exercise.trainer_note,
                 exercise.superset_key, exercise.superset_position,
                 exercise.superset_label, exercise.superset_instruction
          FROM app.workout_template_exercises exercise
          WHERE exercise.revision_id = $1
          ORDER BY exercise.position ASC, exercise.id ASC
        `, [source.revision_id]),
        client.query<PreviewSetRow>(`
          SELECT source_set.id, source_set.exercise_id, source_set.set_key,
                 source_set.position, source_set.kind::text,
                 source_set.repetitions_min, source_set.repetitions_max,
                 source_set.duration_seconds, source_set.target_weight_kg,
                 source_set.rest_seconds, source_set.uses_override
          FROM app.workout_template_exercise_sets source_set
          JOIN app.workout_template_exercises exercise ON exercise.id = source_set.exercise_id
          WHERE exercise.revision_id = $1
          ORDER BY exercise.position ASC, source_set.position ASC, source_set.id ASC
        `, [source.revision_id]),
      ]);
      if (!exerciseResult.rowCount) return { status: "unavailable" };
      const setsByExercise = new Map<string, PreviewSetRow[]>();
      for (const row of setResult.rows) {
        const rows = setsByExercise.get(row.exercise_id) ?? [];
        rows.push(row);
        setsByExercise.set(row.exercise_id, rows);
      }
      const exercises = exerciseResult.rows.map((row) => mapPreviewExercise(row, setsByExercise.get(row.id) ?? []));
      return {
        status: "ready",
        template: {
          templateId: source.template_id,
          revisionId: source.revision_id,
          revisionNumber: source.revision_number,
          title: source.title,
          description: source.description,
          category: source.category,
          exerciseCount: exercises.length,
          prescribedSetCount: exercises.reduce((total, exercise) => total + (exercise.setPrescriptions.length || exercise.sets), 0),
          supersetCount: new Set(exercises.map((exercise) => exercise.superset?.key).filter(Boolean)).size,
          estimatedDurationMin: source.estimated_duration_min,
          updatedAt: source.updated_at.toISOString(),
          eligibility: { assignable: true, reason: "ready" },
          generalInstruction: source.general_instruction,
          exercises,
        },
      };
    }, this.pool);
  }
}

function normalizePageSize(value: number | undefined) {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "С";
}

function mapUpcoming(row: UpcomingRow): QuickAssignUpcomingAssignment {
  return {
    assignmentId: row.assignment_id,
    sourceRevisionId: row.source_revision_id,
    title: row.title_snapshot,
    scheduledFor: row.scheduled_for.slice(0, 10),
    createdAt: row.created_at.toISOString(),
  };
}

function mapTemplateSummary(row: TemplateSummaryRow): QuickAssignTemplateListItem {
  return {
    templateId: row.template_id,
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    title: row.title,
    description: row.description,
    category: row.category,
    exerciseCount: row.exercise_count,
    prescribedSetCount: row.prescribed_set_count,
    supersetCount: row.superset_count,
    estimatedDurationMin: row.estimated_duration_min,
    updatedAt: row.updated_at.toISOString(),
    eligibility: { assignable: true, reason: "ready" },
  };
}

function mapPreviewExercise(row: PreviewExerciseRow, sets: PreviewSetRow[]): QuickAssignExercisePreview {
  return {
    templateExerciseId: row.id,
    instanceKey: row.instance_key,
    position: row.position,
    title: row.title,
    category: row.category,
    equipment: row.equipment,
    prescriptionType: row.prescription_type,
    repetitionMode: row.repetition_mode,
    sets: row.sets,
    repetitionsMin: row.repetitions_min,
    repetitionsMax: row.repetitions_max,
    durationSeconds: row.duration_seconds,
    targetWeightKg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
    restSeconds: row.rest_seconds,
    trainerNote: row.trainer_note,
    superset: row.superset_key && row.superset_position !== null
      ? {
          key: row.superset_key,
          position: row.superset_position,
          label: row.superset_label ?? "",
          instruction: row.superset_instruction ?? "",
        }
      : null,
    setPrescriptions: sets.map((set) => ({
      templateSetId: set.id,
      setKey: set.set_key,
      position: set.position,
      kind: set.kind,
      repetitionsMin: set.repetitions_min,
      repetitionsMax: set.repetitions_max,
      durationSeconds: set.duration_seconds,
      targetWeightKg: set.target_weight_kg === null ? null : Number(set.target_weight_kg),
      restSeconds: set.rest_seconds,
      usesOverride: set.uses_override,
    })),
  };
}
