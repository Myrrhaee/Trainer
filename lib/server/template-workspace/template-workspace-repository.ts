import "server-only";

import type { Pool } from "pg";

import type {
  TemplateWorkspaceAnomaly,
  TemplateWorkspaceItem,
  TemplateWorkspaceRevisionSummary,
} from "@/lib/template-workspace-contract";
import type { Actor } from "@/lib/server/database/actor-context";
import { setTransactionActor } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import { issueWorkoutTemplateLifecycleToken } from "@/lib/server/workouts/workout-template-command-crypto";
import type { TemplateWorkspaceCursor } from "./template-workspace-cursor";
import {
  projectTemplateLifecycle,
  projectTemplateWorkspaceCapabilities,
} from "./template-workspace-projector";
import type { NormalizedTemplateWorkspaceInput } from "./template-workspace-types";

type WorkspaceRow = {
  template_id: string;
  template_status: "draft" | "published" | "archived";
  lifecycle_version: string;
  archived_at: Date | null;
  meaningful_updated_at: Date;
  editable_revision_id: string | null;
  editable_revision_number: number | null;
  editable_revision_status: "draft" | "published" | null;
  editable_title: string | null;
  editable_category: string | null;
  editable_exercise_count: number | null;
  editable_prescribed_set_count: number | null;
  editable_estimated_duration_min: number | null;
  editable_updated_at: Date | null;
  editable_published_at: Date | null;
  published_revision_id: string | null;
  published_revision_number: number | null;
  published_revision_status: "draft" | "published" | null;
  published_title: string | null;
  published_category: string | null;
  published_exercise_count: number | null;
  published_prescribed_set_count: number | null;
  published_estimated_duration_min: number | null;
  published_updated_at: Date | null;
  published_published_at: Date | null;
  editable_query_match: boolean;
  published_query_match: boolean;
  editable_category_match: boolean;
  published_category_match: boolean;
};

type FacetRow = {
  draft_count: number;
  published_count: number;
  update_count: number;
  archive_count: number;
  categories: Array<{ key: string; label: string; count: number }>;
  read_at: Date;
};

const categoryKey = (alias: string) =>
  `lower(regexp_replace(btrim(coalesce(${alias}.category, '')), '\\s+', ' ', 'g'))`;
const searchable = (alias: string) =>
  `lower(regexp_replace(concat_ws(' ', ${alias}.title, ${alias}.description, ${alias}.category), '\\s+', ' ', 'g'))`;

const baseCtes = `
  WITH set_counts AS (
    SELECT source.exercise_id, count(*)::integer AS set_count
    FROM app.workout_template_exercise_sets source
    GROUP BY source.exercise_id
  ), revision_counts AS (
    SELECT exercise.revision_id,
           count(*)::integer AS exercise_count,
           coalesce(sum(coalesce(set_counts.set_count, exercise.sets, 0)), 0)::integer
             AS prescribed_set_count
    FROM app.workout_template_exercises exercise
    LEFT JOIN set_counts ON set_counts.exercise_id = exercise.id
    GROUP BY exercise.revision_id
  ), base AS (
    SELECT template.id AS template_id,
           template.status::text AS template_status,
           template.lifecycle_version::text,
           template.archived_at,
           date_trunc('milliseconds', CASE
             WHEN template.status = 'archived' THEN coalesce(template.archived_at, template.updated_at)
             WHEN template.editable_revision_id IS NOT NULL
               THEN coalesce(editable.updated_at, template.updated_at)
             WHEN template.published_revision_id IS NOT NULL
               THEN greatest(coalesce(published.updated_at, template.updated_at),
                             coalesce(published.published_at, template.updated_at))
             ELSE template.updated_at
           END) AS meaningful_updated_at,
           template.editable_revision_id,
           editable.revision_number AS editable_revision_number,
           editable.status::text AS editable_revision_status,
           editable.title AS editable_title,
           editable.category AS editable_category,
           coalesce(editable_count.exercise_count, 0)::integer AS editable_exercise_count,
           coalesce(editable_count.prescribed_set_count, 0)::integer AS editable_prescribed_set_count,
           editable.estimated_duration_min AS editable_estimated_duration_min,
           editable.updated_at AS editable_updated_at,
           editable.published_at AS editable_published_at,
           template.published_revision_id,
           published.revision_number AS published_revision_number,
           published.status::text AS published_revision_status,
           published.title AS published_title,
           published.category AS published_category,
           coalesce(published_count.exercise_count, 0)::integer AS published_exercise_count,
           coalesce(published_count.prescribed_set_count, 0)::integer AS published_prescribed_set_count,
           published.estimated_duration_min AS published_estimated_duration_min,
           published.updated_at AS published_updated_at,
           published.published_at AS published_published_at,
           ($3 <> '' AND strpos(${searchable("editable")}, $3) > 0) AS editable_query_match,
           ($3 <> '' AND strpos(${searchable("published")}, $3) > 0) AS published_query_match,
           ($4 <> '' AND ${categoryKey("editable")} = $4) AS editable_category_match,
           ($4 <> '' AND ${categoryKey("published")} = $4) AS published_category_match
    FROM app.workout_templates template
    LEFT JOIN app.workout_template_revisions editable
      ON editable.id = template.editable_revision_id
    LEFT JOIN revision_counts editable_count ON editable_count.revision_id = editable.id
    LEFT JOIN app.workout_template_revisions published
      ON published.id = template.published_revision_id
    LEFT JOIN revision_counts published_count ON published_count.revision_id = published.id
    WHERE template.trainer_user_id = $1
      AND EXISTS (
        SELECT 1 FROM app.trainer_profiles trainer
        WHERE trainer.user_id = $1 AND trainer.status = 'active'
      )
  )`;

const lifecyclePredicate = `(
  ($2 = 'all' AND base.template_status <> 'archived')
  OR ($2 = 'drafts' AND base.template_status <> 'archived'
      AND base.editable_revision_id IS NOT NULL AND base.published_revision_id IS NULL)
  OR ($2 = 'published' AND base.template_status <> 'archived'
      AND base.published_revision_id IS NOT NULL AND base.editable_revision_id IS NULL)
  OR ($2 = 'updates' AND base.template_status <> 'archived'
      AND base.published_revision_id IS NOT NULL AND base.editable_revision_id IS NOT NULL)
  OR ($2 = 'archive' AND base.template_status = 'archived')
)`;

const matchingPredicate = `
  ($3 = '' OR base.editable_query_match OR base.published_query_match)
  AND ($4 = '' OR base.editable_category_match OR base.published_category_match)`;

const itemsSql = `${baseCtes}
  SELECT * FROM base
  WHERE ${lifecyclePredicate}
    AND ${matchingPredicate}
    AND ($5::timestamptz IS NULL
      OR base.meaningful_updated_at < $5
      OR (base.meaningful_updated_at = $5 AND base.template_id < $6::uuid))
  ORDER BY base.meaningful_updated_at DESC, base.template_id DESC
  LIMIT $7`;

const facetsSql = `${baseCtes},
  matched AS (
    SELECT * FROM base WHERE ${matchingPredicate}
  ), category_rows AS (
    SELECT base.template_id, category.value AS label, category.key
    FROM base
    CROSS JOIN LATERAL (VALUES
      (base.editable_category,
       lower(regexp_replace(btrim(coalesce(base.editable_category, '')), '\\s+', ' ', 'g'))),
      (base.published_category,
       lower(regexp_replace(btrim(coalesce(base.published_category, '')), '\\s+', ' ', 'g')))
    ) AS category(value, key)
    WHERE category.key <> ''
      AND ($3 = '' OR base.editable_query_match OR base.published_query_match)
      AND ${lifecyclePredicate}
    GROUP BY base.template_id, category.value, category.key
  ), category_facets AS (
    SELECT key, min(btrim(label)) AS label, count(DISTINCT template_id)::integer AS count
    FROM category_rows
    GROUP BY key
    ORDER BY (key = $4) DESC, count(DISTINCT template_id) DESC, key ASC
    LIMIT 51
  )
  SELECT
    count(*) FILTER (WHERE template_status <> 'archived'
      AND editable_revision_id IS NOT NULL AND published_revision_id IS NULL)::integer AS draft_count,
    count(*) FILTER (WHERE template_status <> 'archived'
      AND published_revision_id IS NOT NULL AND editable_revision_id IS NULL)::integer AS published_count,
    count(*) FILTER (WHERE template_status <> 'archived'
      AND published_revision_id IS NOT NULL AND editable_revision_id IS NOT NULL)::integer AS update_count,
    count(*) FILTER (WHERE template_status = 'archived')::integer AS archive_count,
    coalesce((SELECT jsonb_agg(to_jsonb(category_facets) ORDER BY
      (key = $4) DESC, count DESC, key ASC) FROM category_facets), '[]'::jsonb) AS categories,
    transaction_timestamp() AS read_at
  FROM matched`;

export class TemplateWorkspaceRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async list(
    actor: Actor,
    input: NormalizedTemplateWorkspaceInput,
    cursor: TemplateWorkspaceCursor | null,
  ) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      const parameters = [
        actor.userId,
        input.lifecycle,
        input.query,
        input.category,
        cursor?.meaningfulUpdatedAt ?? null,
        cursor?.templateId ?? null,
        input.first + 1,
      ];
      const pageResult = await client.query<WorkspaceRow>(itemsSql, parameters);
      const facetResult = await client.query<FacetRow>(facetsSql, parameters.slice(0, 4));
      const hasNextPage = pageResult.rows.length > input.first;
      const rows = pageResult.rows.slice(0, input.first);
      const categories = facetResult.rows[0]?.categories ?? [];
      return {
        items: rows.map((row) => mapItem(actor.userId, row)),
        hasNextPage,
        last: rows.at(-1) ?? null,
        facets: {
          drafts: facetResult.rows[0]?.draft_count ?? 0,
          published: facetResult.rows[0]?.published_count ?? 0,
          updates: facetResult.rows[0]?.update_count ?? 0,
          archive: facetResult.rows[0]?.archive_count ?? 0,
          categories: categories.slice(0, 50),
          categoryOptionsTruncated: categories.length > 50,
        },
        readAt: (facetResult.rows[0]?.read_at ?? new Date(0)).toISOString(),
      };
    });
  }

  explainList(
    actor: Actor,
    input: NormalizedTemplateWorkspaceInput,
    cursor: TemplateWorkspaceCursor | null,
  ) {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await setTransactionActor(client, actor);
      return client.query(`EXPLAIN (FORMAT TEXT) ${itemsSql}`, [
        actor.userId,
        input.lifecycle,
        input.query,
        input.category,
        cursor?.meaningfulUpdatedAt ?? null,
        cursor?.templateId ?? null,
        input.first + 1,
      ]);
    });
  }
}

function mapItem(actorUserId: string, row: WorkspaceRow): TemplateWorkspaceItem {
  const archivedAt = row.archived_at?.toISOString() ?? null;
  const projection = projectTemplateLifecycle({
    templateStatus: row.template_status,
    archivedAt,
    editableRevisionId: row.editable_revision_id,
    editableRevisionStatus: row.editable_revision_status,
    publishedRevisionId: row.published_revision_id,
    publishedRevisionStatus: row.published_revision_status,
  });
  const editable = revisionSummary(row, "editable", projection.lifecycle === "archived");
  const published = revisionSummary(row, "published", projection.lifecycle === "archived");
  const primary = editable ?? published;
  const anomalies: TemplateWorkspaceAnomaly[] = [...projection.anomalies];
  if (!primary) anomalies.push("summary_revision_unavailable");
  const uniqueAnomalies = [...new Set(anomalies)];
  const capabilities = projectTemplateWorkspaceCapabilities({
    lifecycle: projection.lifecycle,
    hasPrimaryRevision: primary !== null,
    hasEditableRevision: editable !== null,
    hasPublishedRevision: published !== null,
    anomalies: uniqueAnomalies,
  });
  const lifecycleActionToken = uniqueAnomalies.length === 0 && projection.lifecycle !== "archived"
    ? issueWorkoutTemplateLifecycleToken({
        actorUserId,
        templateId: row.template_id,
        version: Number(row.lifecycle_version),
      })
    : null;
  const duplicateSource = primary && capabilities.canDuplicate
    ? {
        intent: projection.lifecycle === "archived"
          ? "latest_saved" as const
          : editable
            ? "editable" as const
            : "published" as const,
        revisionId: primary.revisionId,
      }
    : null;
  return {
    templateId: row.template_id,
    lifecycle: projection.lifecycle,
    primaryRevision: primary,
    editableRevision: editable,
    publishedRevision: published,
    archived: projection.lifecycle === "archived",
    meaningfulUpdatedAt: row.meaningful_updated_at.toISOString(),
    capabilities,
    actionPreconditions: { lifecycleActionToken, duplicateSource },
    matchContext: {
      query: matchContext(row.editable_query_match, row.published_query_match, editable !== null),
      category: matchContext(row.editable_category_match, row.published_category_match, editable !== null),
    },
    anomalies: uniqueAnomalies,
  };
}

function revisionSummary(
  row: WorkspaceRow,
  kind: "editable" | "published",
  archived: boolean,
): TemplateWorkspaceRevisionSummary | null {
  const revisionId = row[`${kind}_revision_id`];
  const revisionNumber = row[`${kind}_revision_number`];
  const status = row[`${kind}_revision_status`];
  const title = row[`${kind}_title`];
  const updatedAt = row[`${kind}_updated_at`];
  if (!revisionId || revisionNumber === null || !status || title === null || !updatedAt) return null;
  return {
    revisionId,
    revisionNumber,
    status,
    title,
    category: row[`${kind}_category`] ?? "",
    exerciseCount: row[`${kind}_exercise_count`] ?? 0,
    prescribedSetCount: row[`${kind}_prescribed_set_count`] ?? 0,
    estimatedDurationMin: row[`${kind}_estimated_duration_min`],
    updatedAt: updatedAt.toISOString(),
    publishedAt: row[`${kind}_published_at`]?.toISOString() ?? null,
    publicationAvailability: archived
      ? "historical"
      : status === "published"
        ? "assignable"
        : "not_published",
  };
}

function matchContext(editableMatch: boolean, publishedMatch: boolean, hasEditable: boolean) {
  if (editableMatch && publishedMatch) return "both" as const;
  if (editableMatch) return "primary" as const;
  if (publishedMatch) return hasEditable ? "published_secondary" as const : "primary" as const;
  return null;
}
