import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const root = process.cwd();
const sourcePath = path.join(root, "database/seeds/system-exercises-v1.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));

if (source.version !== 1 || !Array.isArray(source.exercises)) {
  throw new Error("invalid_system_exercise_seed");
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("database_migration_url_required");

const pool = new Pool({ connectionString, max: 1 });
try {
  await pool.query("BEGIN");
  await pool.query("SET LOCAL ROLE ai_strength_migrator");
  for (const exercise of source.exercises) {
    await pool.query(
      `INSERT INTO app.exercises (
         id, stable_key, scope, owner_trainer_user_id, status, title, description,
         category, equipment, body_region, image_asset_path, image_asset_available
       ) VALUES ($1, $2, 'system', NULL, 'active', $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         stable_key = EXCLUDED.stable_key,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         equipment = EXCLUDED.equipment,
         body_region = EXCLUDED.body_region,
         image_asset_path = EXCLUDED.image_asset_path,
         image_asset_available = EXCLUDED.image_asset_available,
         updated_at = clock_timestamp()
       WHERE app.exercises.scope = 'system'
         AND (app.exercises.stable_key, app.exercises.title, app.exercises.description,
              app.exercises.category, app.exercises.equipment, app.exercises.body_region,
              app.exercises.image_asset_path, app.exercises.image_asset_available)
             IS DISTINCT FROM
             (EXCLUDED.stable_key, EXCLUDED.title, EXCLUDED.description,
              EXCLUDED.category, EXCLUDED.equipment, EXCLUDED.body_region,
              EXCLUDED.image_asset_path, EXCLUDED.image_asset_available)`,
      [
        exercise.exerciseId,
        exercise.stableKey,
        exercise.title,
        exercise.description,
        exercise.category,
        exercise.equipment,
        exercise.bodyRegion,
        exercise.imageAssetPath,
        exercise.imageAvailable,
      ],
    );
  }
  await pool.query("SELECT app.backfill_workout_template_exercise_sources()");
  await pool.query("COMMIT");
  process.stdout.write(`Applied system exercise seed v${source.version}: ${source.exercises.length} rows\n`);
} catch (error) {
  await pool.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
