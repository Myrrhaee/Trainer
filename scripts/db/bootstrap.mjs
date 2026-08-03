import {
  bootstrapDirectory,
  listSqlFiles,
  readSql,
  withMigrationClient,
} from "./shared.mjs";

await withMigrationClient(async (client) => {
  const files = await listSqlFiles(bootstrapDirectory);
  for (const filename of files) {
    await client.query(await readSql(bootstrapDirectory, filename));
    process.stdout.write(`Applied bootstrap ${filename}\n`);
  }
});
