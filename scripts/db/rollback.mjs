import {
  ensureMigrationTable,
  migrationsDirectory,
  readSql,
  withMigrationClient,
} from "./shared.mjs";

const lockKey = 4_191_106_202;

await withMigrationClient(async (client) => {
  await client.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    await ensureMigrationTable(client);
    const latest = await client.query(
      "SELECT name FROM public.app_schema_migrations ORDER BY applied_at DESC, name DESC LIMIT 1",
    );

    if (!latest.rowCount) {
      process.stdout.write("No migration to roll back\n");
      return;
    }

    const name = latest.rows[0].name;
    const sql = await readSql(migrationsDirectory, `${name}.down.sql`);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("DELETE FROM public.app_schema_migrations WHERE name = $1", [name]);
      await client.query("COMMIT");
      process.stdout.write(`Rolled back migration ${name}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
});
