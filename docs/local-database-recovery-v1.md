# Local database ownership recovery

## Status

The canonical development database is a clean database created by the ordered bootstrap and migration sequence. An older local database may contain the same schema with objects owned by the original login role instead of `ai_strength_migrator`. That state is local infrastructure drift, not part of the product schema.

Migration `0012_athlete_profile_read_model` intentionally contains no environment-specific `ALTER OWNER` statements.

## Recommended local path

If local data has no value, recreate the local database through the normal setup flow. This produces the most reproducible development environment. Database recreation is destructive and must remain an explicit developer decision.

## Preserve-data recovery path

If local data must be preserved, run the ownership recovery as the local database owner before the normal migrator:

```bash
node --env-file=.env.development.local scripts/database/normalize-local-ownership.mjs
node --env-file=.env.development.local scripts/db/migrate.mjs
```

The recovery script:

- refuses to run unless `APP_ENV` is `local`, `development`, or `test`;
- refuses database names that do not clearly identify a local or test database;
- requires the connected role to be able to set `ai_strength_migrator`;
- changes ownership for application schemas, relations, sequences, routines, enum/domain types, and migration metadata;
- normalizes default privileges for future migrator-owned objects;
- performs all changes in one transaction;
- does not modify application rows.

It is idempotent and is not a product migration. Do not run it in staging or production.

## Upgrade verification

The isolated upgrade check creates a disposable PostgreSQL database, applies migrations through `0011`, simulates legacy ownership, runs the recovery, and then applies `0012`:

```bash
node --env-file=.env.development.local scripts/test/run-migration-upgrade-postgres.mjs
```

The check succeeds only when `0012` is recorded, the athlete profile columns exist, and application relations are owned by `ai_strength_migrator`.
