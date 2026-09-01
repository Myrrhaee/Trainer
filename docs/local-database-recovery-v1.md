# Local PostgreSQL setup and ownership recovery

## Ownership model

The local login role owns the local database and may create roles. The canonical group role `ai_strength_migrator` owns the `app` and `app_private` schemas, their application objects, and `public.app_schema_migrations`. Product migrations run in a transaction after `SET LOCAL ROLE ai_strength_migrator`.

An older local database may have application objects owned by its original login role. That state is infrastructure drift, not canonical schema state. Migration `0012_athlete_profile_read_model` intentionally contains no environment-specific ownership repair.

## A. Recommended clean path

Start PostgreSQL, ensure roles, and apply all pending migrations:

```bash
npm run local:setup
```

This command is non-destructive and can be repeated. It does not erase an existing database.

To deliberately recreate the local database and apply all migrations from zero:

```bash
node --env-file=.env.development.local scripts/local/reset-database.mjs --confirm-reset
```

The reset command refuses non-local hosts, non-local database names, and execution without `--confirm-reset`. It deletes all rows in the selected local database. Do not use it when local data must be preserved.

Verification commands:

```bash
node --env-file=.env.development.local scripts/test/run-migration-upgrade-postgres.mjs
npm run test:backend:postgres
npm run test:e2e:canonical
```

## B. Preserve an older local database

Use ownership recovery only when the database contains useful local data and the migration preflight reports objects owned by a legacy role.

Create a backup first:

```bash
pg_dump --dbname="$DATABASE_MIGRATION_URL" --format=custom --file=ai-strength-local-before-owner-recovery.dump
```

The connected administrative login must own the legacy objects and be able to set the requested target role. The target must exist and must not be a superuser, replication role, or RLS-bypass role.

Inspect the exact database, connected login, database owner, schemas, tables, sequences, routines, enum/domain types, current owners, and target owner without changing anything:

```bash
node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs \
  --dry-run \
  --target-owner ai_strength_migrator
```

Apply ownership normalization explicitly:

```bash
node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs \
  --apply \
  --target-owner ai_strength_migrator
```

Then run the normal migrator and repeat dry-run verification:

```bash
node --env-file=.env.development.local scripts/db/migrate.mjs
node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs \
  --dry-run \
  --target-owner ai_strength_migrator
```

The final dry-run must report `driftCount: 0`. Recovery is local/test-only, transactional, limited to application schemas plus migration metadata, and changes ownership/default privileges only. It does not update application rows. A backup is still required because ownership changes affect future administration and restore behavior.

`DATABASE_MIGRATION_OWNER` may be used instead of `--target-owner`. The command deliberately has no implicit target owner.

## C. Do not

- Do not edit rows in `public.app_schema_migrations` manually.
- Do not add a developer login, machine path, or `ALTER OWNER` recovery to migration `0012`.
- Do not run local recovery against staging or production.
- Do not treat an old local database as the canonical schema baseline.
- Do not run reset without confirming that its data may be deleted.
- Do not weaken application roles, grants, RLS, or authorization to bypass an ownership error.

## Reproducible upgrade evidence

`scripts/test/run-migration-upgrade-postgres.mjs` uses two disposable databases:

1. Clean path: migrate through `0011`, verify the pre-`0012` schema, apply `0012`, rerun the migrator, and confirm exactly 12 applied migrations.
2. Legacy path: migrate through `0011`, reassign application objects to the connected legacy login, confirm catalog ownership, require the migration preflight to fail, inspect with dry-run, apply recovery, confirm a zero-drift second dry-run, apply `0012`, and rerun the migrator.

Both disposable databases are removed in the script's cleanup path.
