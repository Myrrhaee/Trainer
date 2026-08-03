import {
  checksum,
  ensureMigrationTable,
  listSqlFiles,
  migrationsDirectory,
  readSql,
  withMigrationClient,
} from "./shared.mjs";

const lockKey = 4_191_106_202;

await withMigrationClient(async (client) => {
  await client.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    await ensureMigrationTable(client);
    const files = await listSqlFiles(migrationsDirectory, ".up.sql");

    for (const filename of files) {
      const name = filename.slice(0, -".up.sql".length);
      const sql = await readSql(migrationsDirectory, filename);
      const expectedChecksum = checksum(sql);
      const existing = await client.query(
        "SELECT checksum FROM public.app_schema_migrations WHERE name = $1",
        [name],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== expectedChecksum) {
          throw new Error(`Applied migration ${name} has changed`);
        }
        process.stdout.write(`Already applied ${name}\n`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public.app_schema_migrations (name, checksum) VALUES ($1, $2)",
          [name, expectedChecksum],
        );
        await client.query("COMMIT");
        process.stdout.write(`Applied migration ${name}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
});
