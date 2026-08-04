# Backend Foundation B18: Isolated Staging Provisioning

- Date: 2026-08-04
- Status: **managed PostgreSQL provisioned and verified; application deployment blocked by email delivery and restore evidence**
- Scope: create an isolated external staging boundary without reusing the legacy Vercel/Supabase environment or exposing operator credentials to the application runtime

## Provisioned Boundary

1. A separate Vercel project named `ai-strength-coach-staging` is linked locally. The existing `trainer` project and its legacy Supabase variables were inspected but not modified or reused.
2. A separate Neon PostgreSQL resource named `ai-strength-staging-db` is connected only to the staging Vercel project. The selected region is Frankfurt (`fra1`, AWS `eu-central-1`) and Neon Auth is disabled because application-owned identity remains canonical.
3. The database starts empty. No legacy rows, real participant identities, test fixtures or production personal data were imported.
4. Six distinct login identities map to the canonical non-login group roles: migrator, authenticator, app, health, worker and operator.
5. The Vercel runtime has not received migration, operator, owner or generic fallback database credentials.
6. Local staging runtime and operator profiles are Git-ignored and owner-readable only. The temporary role-secret generation file was deleted after role verification.

## Managed PostgreSQL Portability Work

The canonical bootstrap initially assumed a PostgreSQL superuser could explicitly clear superuser-only role flags. Neon supplies a managed owner with `CREATEROLE`, not superuser. The bootstrap now:

- creates the trusted `pgcrypto` extension under the managed database owner;
- verifies that canonical group roles are not superuser, replication or bypass-RLS roles;
- changes only role attributes permitted to a managed `CREATEROLE` owner;
- grants the migrator group the minimum schema/database creation boundary required by canonical migrations;
- remains valid against the local PostgreSQL 16 verification environment.

The ordinary PostgreSQL wire runner now uses fresh connections, transaction-scoped serialization, transient retries and PostgreSQL-aware statement splitting. Because the operator's local route to the managed Frankfurt endpoint repeatedly dropped long TCP transactions, `npm run db:migrate:neon` provides an operator-only HTTPS transport fallback through the official Neon driver. It applies the same SQL files and SHA-256 checksum contract in one transaction per migration. A timed-out or lost response is reconciled against the migration checksum before retrying.

This transport fallback does not introduce a Neon dependency into the application runtime, repositories, domain model or schema.

## Verification Evidence

| Check | Result |
| --- | --- |
| Managed owner bootstrap | pass |
| Canonical managed migrations | 11/11 applied |
| Idempotent managed checksum rerun | pass |
| Managed role identity checks | app, authenticator, health, worker and operator pass |
| Managed health-role isolation | cannot read `app.users` or `app_private.sessions` |
| Real staging preflight | correctly fails only `resend_api_key_required` and `auth_email_from_required` |
| Database-only preflight with ephemeral synthetic email values | all migration, role and isolation checks pass; values were not saved or sent |
| Disposable local PostgreSQL integration suite | 71/71 pass |
| Canonical browser suite | 2/2 pass |
| ESLint | pass |
| TypeScript `--noEmit` | pass |
| Next.js production build | pass, 54 static pages generated |
| External HTTPS smoke | not run; no application deployment exists |
| Live email OTP delivery | not run; Resend sender is not configured |
| Managed backup restore rehearsal | not run |

## Deliberately Not Deployed

No application deployment, production alias, participant invitation, real registration, live email, Telegram delivery, DNS change, Git push or automatic deployment was performed. Runtime secrets were not uploaded because the exact immutable release and the required Resend sender are not ready together.

## Remaining Gate

Before inviting the trainer or either athlete:

1. Founder supplies a controlled domain and DNS access for a dedicated transactional-email subdomain.
2. Provision Resend, verify the sender domain and add SPF/DKIM records without weakening the parent domain's DMARC policy.
3. Send one synthetic OTP to an engineering-owned address and verify delivery, expiry, replay rejection and provider-log privacy.
4. Commit the verified managed-PostgreSQL portability changes and set `APP_RELEASE` to that immutable commit.
5. Upload runtime-only variables to the isolated staging project and deploy that exact commit.
6. Run the real preflight, external HTTPS smoke and a synthetic three-role workflow.
7. Capture a managed backup/restore rehearsal before any real participant identity is stored.

Until all seven steps pass, the environment is a verified empty staging database, not an externally usable closed-alpha product.
