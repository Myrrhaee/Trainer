import "server-only";

import type { Pool, PoolClient } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import type {
  ExerciseDetailReadModel,
  ExerciseLibraryImage,
  ExerciseLibraryItem,
} from "@/lib/exercise-library-contract";
import type { ExerciseLibraryCursor } from "./exercise-library-cursor";
import type { NormalizedExerciseLibraryInput } from "./exercise-library-types";

type ExerciseRow = {
  id: string;
  stable_key: string;
  scope: "system" | "trainer";
  owner_trainer_user_id: string | null;
  status: "active" | "archived";
  title: string;
  description: string | null;
  category: string | null;
  equipment: string | null;
  body_region: string | null;
  image_asset_path: string | null;
  image_asset_available: boolean;
  created_at: Date;
  updated_at: Date;
  sort_title: string;
};

const selectColumns = `
  exercise.id, exercise.stable_key, exercise.scope::text, exercise.owner_trainer_user_id,
  exercise.status::text, exercise.title, exercise.description, exercise.category,
  exercise.equipment, exercise.body_region, exercise.image_asset_path,
  exercise.image_asset_available, exercise.created_at, exercise.updated_at,
  lower(exercise.title) AS sort_title`;

export class ExerciseLibraryRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  async list(
    actor: Actor,
    input: NormalizedExerciseLibraryInput,
    cursor: ExerciseLibraryCursor | null,
  ) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ExerciseRow>(
        `SELECT ${selectColumns}
         FROM app.exercises exercise
         WHERE exercise.status = 'active'
           AND ($1 = '' OR (
             lower(exercise.title) LIKE $2 ESCAPE '\\'
             OR lower(coalesce(exercise.description, '')) LIKE $2 ESCAPE '\\'
             OR lower(coalesce(exercise.category, '')) LIKE $2 ESCAPE '\\'
             OR lower(coalesce(exercise.equipment, '')) LIKE $2 ESCAPE '\\'
             OR lower(coalesce(exercise.body_region, '')) LIKE $2 ESCAPE '\\'
           ))
           AND ($3 = '' OR lower(coalesce(exercise.category, '')) = $3)
           AND ($4 = '' OR lower(coalesce(exercise.equipment, '')) = $4)
           AND ($5 = '' OR lower(coalesce(exercise.body_region, '')) = $5)
           AND ($6 = 'all' OR exercise.scope::text = $6)
           AND ($7::text IS NULL OR (lower(exercise.title), exercise.id) > ($7, $8::uuid))
         ORDER BY lower(exercise.title) ASC, exercise.id ASC
         LIMIT $9`,
        [
          input.query,
          `%${escapeLike(input.query)}%`,
          input.category,
          input.equipment,
          input.bodyRegion,
          input.scope,
          cursor?.sortTitle ?? null,
          cursor?.exerciseId ?? null,
          input.first + 1,
        ],
      );
      const hasNextPage = result.rows.length > input.first;
      const rows = result.rows.slice(0, input.first);
      return { items: rows.map(mapListItem), hasNextPage, last: rows.at(-1) ?? null };
    }, this.pool);
  }

  async findDetail(actor: Actor, exerciseId: string): Promise<ExerciseDetailReadModel | null> {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<ExerciseRow>(
        `SELECT ${selectColumns}
         FROM app.exercises exercise
         WHERE exercise.id = $1`,
        [exerciseId],
      );
      return result.rowCount ? mapDetail(result.rows[0]) : null;
    }, this.pool);
  }

  explainList(actor: Actor, input: NormalizedExerciseLibraryInput, cursor: ExerciseLibraryCursor | null) {
    return withActorTransaction(actor, async (client) => explainList(client, input, cursor), this.pool);
  }
}

async function explainList(
  client: PoolClient,
  input: NormalizedExerciseLibraryInput,
  cursor: ExerciseLibraryCursor | null,
) {
  return client.query<Record<string, string>>(
    `EXPLAIN (FORMAT TEXT)
     SELECT exercise.id
     FROM app.exercises exercise
     WHERE exercise.status = 'active'
       AND ($1 = '' OR lower(exercise.title) LIKE $2 ESCAPE '\\')
       AND ($3 = '' OR lower(coalesce(exercise.category, '')) = $3)
       AND ($4 = '' OR lower(coalesce(exercise.equipment, '')) = $4)
       AND ($5 = '' OR lower(coalesce(exercise.body_region, '')) = $5)
       AND ($6 = 'all' OR exercise.scope::text = $6)
       AND ($7::text IS NULL OR (lower(exercise.title), exercise.id) > ($7, $8::uuid))
     ORDER BY lower(exercise.title), exercise.id
     LIMIT $9`,
    [
      input.query,
      `%${escapeLike(input.query)}%`,
      input.category,
      input.equipment,
      input.bodyRegion,
      input.scope,
      cursor?.sortTitle ?? null,
      cursor?.exerciseId ?? null,
      input.first + 1,
    ],
  );
}

function mapListItem(row: ExerciseRow): ExerciseLibraryItem {
  return {
    exerciseId: row.id,
    stableKey: row.stable_key,
    scope: row.scope,
    title: row.title,
    category: row.category,
    equipment: row.equipment,
    bodyRegion: row.body_region,
    image: mapImage(row),
    sourceLabel: row.scope === "system" ? "Системная библиотека" : "Моё упражнение",
    status: "active",
    eligibility: { canSelect: true, reason: null },
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDetail(row: ExerciseRow): ExerciseDetailReadModel {
  const image = mapImage(row);
  const archived = row.status === "archived";
  return {
    exerciseId: row.id,
    stableKey: row.stable_key,
    scope: row.scope,
    ownerTrainerUserId: row.owner_trainer_user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    equipment: row.equipment,
    bodyRegion: row.body_region,
    image,
    sourceLabel: row.scope === "system" ? "Системная библиотека" : "Моё упражнение",
    status: row.status,
    sourceAvailability: archived ? "archived" : "ready",
    canSelect: !archived,
    anomalies: [
      ...(archived ? ["source_archived" as const] : []),
      ...(image.availability === "image_unavailable" ? ["image_unavailable" as const] : []),
    ],
    dataAvailability: "ready",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapImage(row: ExerciseRow): ExerciseLibraryImage {
  if (!row.image_asset_available || !row.image_asset_path) {
    return { availability: "image_unavailable", assetPath: null, url: null };
  }
  return {
    availability: "ready",
    assetPath: row.image_asset_path,
    url: `/${row.image_asset_path}`,
  };
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
