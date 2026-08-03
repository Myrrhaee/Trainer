# Backend Foundation B1

- Date: **2026-08-02**
- Status: **implementation complete; managed deployment pending**
- Scope: PostgreSQL, server database boundary, application sessions and first actor-scoped RLS proof

## Implemented

1. Provider-neutral PostgreSQL connection uses server-only `DATABASE_*_URL` values and bounded `pg` pools.
2. Explicit SQL migration tooling applies checksummed up migrations and supports rollback of the latest migration.
3. Separate non-login roles define migration, authentication/session, ordinary application and worker boundaries.
4. Canonical `users`, `auth_identities`, `sessions` and `audit_events` persistence exists under `app` and `app_private` schemas.
5. User status transitions, provider-subject uniqueness, SHA-256 session-hash length, expiry and revocation constraints are enforced by PostgreSQL.
6. Opaque application sessions support issue, lookup/touch, rotation, current-session revoke and all-user-session revoke. Rotation preserves the original absolute expiry.
7. Cookie helpers use `HttpOnly`, `SameSite=Lax`, `Secure` in production and a production `__Host-` cookie name.
8. Canonical actor resolution comes from the application session; actor context is transaction-local for RLS.
9. `/api/health/ready` reports only `ready` or `unavailable` and does not disclose connection details.
10. Next.js was moved from vulnerable `16.1.6` to patched `16.2.12`; transitive `ws` is `8.21.1`.

## Evidence

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| Clean database migrates deterministically | pass | `scripts/db/migrate.mjs`, PostgreSQL 16 ephemeral verification |
| Applied migration is idempotent/checksummed | pass | second migrate reports already applied |
| Synthetic user and session create/read/revoke | pass | `tests/backend-foundation/postgres-foundation.test.ts` |
| Browser has no database credential | pass | all connection variables and pool constructors live under `lib/server/`; no `NEXT_PUBLIC_DATABASE_*` contract |
| Second user cannot read first user through app role | pass | actor-scoped `app.users` RLS negative test |
| Ordinary app role cannot read private sessions | pass | role/grant negative test |
| Pool reuse does not leak actor | pass | one-connection transaction reuse test |
| Rollback and remigrate | pass | schema removal assertion followed by successful migration/tests |
| Backup and restore with synthetic data | pass locally | `pg_dump`/`pg_restore` into a second PostgreSQL database |
| Lint | pass | `npm run lint` |
| Production build | pass | `npm run build` on Next.js 16.2.12 |

## Deliberately Not Switched

- Existing product screens and `proxy.ts` continue using the legacy Supabase path.
- No real login provider or auth UI is connected in B1.
- No managed database or production secret is created automatically.
- No existing Supabase migration is rewritten or deleted.
- No workout/client/trainer domain data is migrated yet.

## Operational Gate

The foundation is ready for a standard managed PostgreSQL connection, but B1 is not deployed. Before staging or real-user data, the founder and engineering owner must record:

- managed provider and region;
- billing and production access owner;
- point-in-time recovery/backup retention and a restore drill;
- pooled/direct connection endpoints and limits;
- secret storage and rotation owner;
- separate login-role membership for migration, auth, app and health.

Until this gate is complete, the new backend remains a verified implementation path rather than an operational source of truth.

## B2 Entry

B2 may begin in code after selecting a non-production email delivery provider and sender domain. The managed PostgreSQL gate must be closed before storing real identities or running an external authentication pilot.
