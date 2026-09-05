# Internal Pilot Rollout Preparation v1

Date: 2026-09-05
Repository checkpoint: `3b9e2566ab68adc33934586849f84909a4283c88`
Preparation branch: `codex/internal-pilot-rollout-prep`
Scope: operator preparation only; no rollout is authorized by this document.

## 1. Executive status

**Verdict: HOLD — OPERATOR CONFIGURATION INCOMPLETE**

The repository-side deployment hardening is complete and committed. The canonical schema contract is the immutable sequence `0001..0016`; runtime readiness distinguishes `current`, `outdated`, `ahead_or_unknown` and `inconsistent`; unknown ledger entries cannot produce a false-green result; external demo mode is rejected; and web, auth, health, worker and operations connections have explicit role boundaries.

The real pilot environment is not ready for migration application because this checkout does not identify an actual deployment project, pilot origin or operator-owned credential set. A current external Neon provenance refresh could not be completed because both authorized read-only connection attempts timed out. Backup and restore evidence is also absent.

This document prepares the remaining operator actions. It does not grant `GO FOR ROLLOUT`, apply migrations, provision roles, create secrets or mutate an external service. Founder approval remains a separate final gate.

Repository evidence:

- canonical migration names: `lib/server/runtime/schema-version.ts`;
- schema-state classification: `lib/server/database/health.ts`;
- deployment and connection validation: `lib/server/runtime/deployment-config.ts`;
- principal, checksum and health checks: `scripts/ops/preflight.ts`;
- normal migration runner: `scripts/db/migrate.mjs`;
- migration-specific procedure: `docs/migration-0016-rollout-runbook-v1.md`;
- hardening rationale and accepted test evidence: `docs/internal-pilot-deployment-hardening-v1.md`.

## 2. Pilot environment

| Item | Status | Current evidence | Required operator action |
| --- | --- | --- | --- |
| `PILOT_ENVIRONMENT` | **NOT DEFINED** | No linked hosting project, deployment metadata or explicit environment identifier exists in this checkout. | Select and record `<PILOT_ENVIRONMENT>`. |
| `PILOT_ORIGIN` | **NOT DEFINED** | The repository contains example origins only. `AUTH_PUBLIC_ORIGIN` is the implemented canonical origin variable. | Select the exact HTTPS `<PILOT_ORIGIN>` and configure it consistently. |
| Application release | Not deployed by this task | `APP_RELEASE` is required by the external configuration contract. | Deploy the reviewed commit and record its release identifier. |
| External database | Candidate known only from stale evidence | The previous gate identified a Neon candidate, but the current refresh timed out. | Re-establish authorized read-only access and repeat Section 8. |

No environment or domain is inferred from `deployment/staging-*.env.example`; their values are placeholders, not deployment evidence. No `.vercel/project.json`, `vercel.json`, Dockerfile, Procfile, Railway config or Render config was found. `EXTERNAL_BASE_URL` is consumed only by the operator smoke script and is not configured in the repository.

Until chosen by the operator, all procedural references use:

```text
<PILOT_ENVIRONMENT>
<PILOT_ORIGIN>
```

## 3. Operator prerequisites

Every required item is binary. An unknown item is not a pass.

1. Identify the hosting/deployment project and exact HTTPS origin.
2. Confirm that the deployed artifact is built from reviewed commit `3b9e2566ab68adc33934586849f84909a4283c88` or an explicitly reviewed descendant.
3. Provision independent restricted runtime logins for app, auth and health.
4. Either provision the worker login or explicitly keep notification delivery disabled.
5. Provision an isolated operations login for migration and operator work. One isolated login may hold both operations memberships, but it must never be injected into the application runtime.
6. Store all connection strings and secrets in the platform secret store. Do not create a tracked `.env` file.
7. Configure production email OTP through Resend and verify the sender.
8. Configure demo mode off and exact inert public Supabase placeholders.
9. Capture current backup and restore evidence.
10. Complete the read-only provenance pack with no anomaly.
11. Validate the environment before migration; readiness must truthfully report `outdated` while the database is at `0011`.
12. Obtain explicit founder `GO FOR ROLLOUT` only after every checklist item in Section 14 passes.

Required tooling for the operator workstation/job:

- the reviewed Git checkout;
- the repository-supported Node.js/npm toolchain;
- a PostgreSQL client capable of TLS connections;
- secure environment injection for all database URLs and secrets;
- access to the hosting health endpoint, Resend configuration and Neon console/API;
- an audit record identifying the operator, environment, database and release.

## 4. Connection matrix

| Connection variable | Expected membership | Allowed use | Forbidden properties/use | Ownership | Sharing rule |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_APP_URL` | `ai_strength_app` | Product business reads and writes under transaction-local actor context and FORCE RLS | Owner, superuser, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, replication, operations memberships | Owns no application objects | Dedicated web runtime login; cannot be shared with auth, health or operations |
| `DATABASE_AUTH_URL` | `ai_strength_authenticator` | Narrow identity, OTP and session operations | Product-wide grants, owner, superuser, `BYPASSRLS`, operations memberships | Owns no application objects | Dedicated auth login |
| `DATABASE_HEALTH_URL` | `ai_strength_health` | Connection liveness and `public.app_schema_migrations` metadata only | Product/private data reads, owner, superuser, `BYPASSRLS`, operations memberships | Owns no application objects | Dedicated health login |
| `DATABASE_WORKER_URL` | `ai_strength_worker` | Narrow notification outbox claim/delivery and recipient lookup | General product access, owner, superuser, `BYPASSRLS`, operations memberships | Owns no application objects | Dedicated worker login when enabled; absent when delivery is disabled |
| `DATABASE_MIGRATION_URL` | `ai_strength_migrator` | Apply reviewed migrations through the normal runner; validate ownership/checksums | Any product request or application runtime | `ai_strength_migrator` owns canonical schemas and objects | May share one isolated operations login with `DATABASE_OPERATOR_URL` only |
| `DATABASE_OPERATOR_URL` | `ai_strength_operator` | Reviewed manual/closed-alpha operator commands | Any product request or application runtime | No general ownership requirement | May share one isolated operations login with migration if both membership checks pass |

`BYPASSRLS` is not required for any role in this matrix. A managed database owner may inherently be privileged, but that owner cannot be used as proof of RLS and cannot back `DATABASE_APP_URL`, `DATABASE_AUTH_URL`, `DATABASE_HEALTH_URL` or `DATABASE_WORKER_URL`.

Runtime principals must be distinct from each other and from the operations principal. The preflight enforces the role/capability boundary in `scripts/ops/preflight.ts` and `lib/server/database/health.ts`.

## 5. Environment variables

Only names implemented by the repository are listed. Values below are semantic requirements or placeholders, never real credentials.

### Application runtime: required

```text
APP_ENV=staging
APP_RELEASE=<reviewed-release-id>
AUTH_PUBLIC_ORIGIN=<PILOT_ORIGIN>
DATABASE_APP_URL=<restricted-app-connection>
DATABASE_AUTH_URL=<restricted-auth-connection>
DATABASE_HEALTH_URL=<restricted-health-connection>
AUTH_OTP_PEPPER=<server-only-random-secret-at-least-32-bytes>
AUTH_FLOW_SECRET=<different-server-only-random-secret-at-least-32-bytes>
AUTH_DEV_OTP_DISCLOSURE=false
AUTH_EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=<server-only-resend-key>
AUTH_EMAIL_FROM=<verified-sender>
NEXT_PUBLIC_DEMO_MODE=false
ENABLE_LEGACY_SUPABASE_ONBOARDING=false
NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER=false
NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_CLIENT_HOME=false
NOTIFICATION_DELIVERY_MODE=disabled
NEXT_PUBLIC_SUPABASE_URL=https://legacy-supabase-disabled.invalid
NEXT_PUBLIC_SUPABASE_ANON_KEY=legacy-supabase-disabled-public-anon-key
```

`AUTH_PUBLIC_ORIGIN` is the actual implementation name; there is no separate active `APP_ORIGIN` contract.

### Application runtime: conditional

When Telegram notification delivery is explicitly approved:

```text
NOTIFICATION_DELIVERY_MODE=telegram
DATABASE_WORKER_URL=<restricted-worker-connection>
TELEGRAM_BOT_TOKEN=<server-only-bot-token>
```

When delivery remains disabled, do not run a worker and do not require `DATABASE_WORKER_URL` or `TELEGRAM_BOT_TOKEN`.

Optional auth tuning variables are supported by the existing implementation and should be changed only through a reviewed operational decision:

```text
AUTH_OTP_TTL_SECONDS
AUTH_OTP_RESEND_COOLDOWN_SECONDS
AUTH_OTP_MAX_REQUESTS_PER_WINDOW
AUTH_OTP_REQUEST_WINDOW_SECONDS
AUTH_OTP_MAX_ATTEMPTS
WORKOUT_TEMPLATE_TOKEN_SECRET
```

If `WORKOUT_TEMPLATE_TOKEN_SECRET` is absent, the current implementation uses `AUTH_FLOW_SECRET`. Federated providers are not required for the email-OTP pilot; if later enabled, their existing names are `GOOGLE_CLIENT_ID`, `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET` and `TELEGRAM_BOT_TOKEN` as applicable.

### Isolated migration/operator job

The isolated job receives the non-secret release/origin contract, all runtime URLs needed by preflight, plus:

```text
DATABASE_MIGRATION_URL=<isolated-operations-connection>
DATABASE_OPERATOR_URL=<isolated-operations-connection>
ALPHA_OPERATOR_REF=<pseudonymous-operator-reference>
EXTERNAL_BASE_URL=<PILOT_ORIGIN>
```

`EXTERNAL_BASE_URL` is needed only by `npm run ops:smoke-external`.

### Explicitly forbidden in product runtime

```text
DATABASE_URL
DATABASE_MIGRATION_URL
DATABASE_OPERATOR_URL
SUPABASE_SERVICE_ROLE_KEY
```

The product runtime must not receive a real legacy Supabase project URL/key or any database owner credential.

## 6. Auth/email

### Intended pilot authentication path

The production pilot uses application-owned email OTP. `AUTH_EMAIL_DELIVERY_MODE=resend` selects the Resend provider in `lib/server/auth/email/email-otp-delivery.ts`. The provider requires:

- `RESEND_API_KEY`;
- a verified `AUTH_EMAIL_FROM` sender;
- `AUTH_PUBLIC_ORIGIN=<PILOT_ORIGIN>`;
- independent `AUTH_OTP_PEPPER` and `AUTH_FLOW_SECRET`, each at least 32 bytes;
- `AUTH_DEV_OTP_DISCLOSURE=false`.

The in-memory email mode is restricted to local/test behavior and is not a valid pilot substitute. Email sending cannot be disabled if the pilot is expected to log in through the production OTP path.

Before migration, the operator must perform an intended-path login smoke against the deployed origin. A database readiness response of `outdated` is expected at schema `0011`; an inability to request or receive OTP is not expected and blocks rollout.

### Failure semantics

- deployment config validation fails on missing/invalid production email settings, short/equal signing secrets, invalid origin, demo mode, privileged runtime URLs or non-inert Supabase placeholders;
- provider transport/status failures remain authentication failures and must be captured from server logs without exposing keys or OTPs;
- the external smoke checks public behavior but does not replace a real inbox delivery test;
- a successful request without receipt in the intended mailbox is not sufficient evidence.

### Notifications/worker

Workout notifications are separate from authentication email. For this pilot they may remain disabled with `NOTIFICATION_DELIVERY_MODE=disabled`. If Telegram delivery is enabled, the restricted worker connection and bot token become mandatory and HTTPS origin validation applies. Worker readiness is therefore **READY ONLY IF DISABLED** until a Telegram-specific gate is completed.

## 7. Backup/restore

**BACKUP_READY: UNKNOWN**
**RESTORE_READY: UNKNOWN**

No backup or restore operation was authorized or executed in this preparation pass. Before founder review, the operator must attach all of the following evidence:

| Evidence | Required content |
| --- | --- |
| Backup mechanism | Neon restore point, branch, snapshot or another environment-supported mechanism |
| Capture identity | Exact database/project identifier and `<PILOT_ENVIRONMENT>` |
| Capture time | UTC timestamp immediately relevant to the migration window |
| Responsible operator | Pseudonymous/auditable operator reference |
| Retention/availability | How long the recovery point remains usable |
| Restore procedure | Exact provider-supported steps, destination and credential owner |
| Restore test | Date, environment and result of the latest non-production restore rehearsal |
| Recovery objective | Expected decision and recovery time if migration verification fails |

`GO FOR ROLLOUT` is impossible while either state is `NO` or `UNKNOWN`.

### Restore versus forward fix

Before any `0016` context-bearing production writes, rollback is a separate operator decision requiring explicit approval and confirmed recovery evidence. After pilot data contains `overall_comment`, `discomfort_reported` or `discomfort_comment`, prefer a reviewed forward fix. `0016_workout_session_completion.down.sql` drops these columns and is data-destructive; it must never be described as lossless.

## 8. External read-only preflight

### Refresh result on 2026-09-05

Two authorized read-only attempts were made against the previously known Neon candidate. The unpooled endpoint connected but the query ended with `Error: Query read timeout`; the pooled endpoint ended with `read ETIMEDOUT`. Both attempts were read-only transactions and were rolled back. No DDL or DML was issued.

Therefore current external state is **UNVERIFIED**. This is not evidence of a database anomaly; it is an unavailable evidence channel. The previous observations below are stale and cannot authorize migration:

| Previous observation | Stale value | Current status |
| --- | --- | --- |
| PostgreSQL version | `17.11` | Must re-query |
| Database identity | `neondb` | Must re-query |
| Latest migration | `0011_closed_alpha_operator` | Must re-query |
| Pending chain | `0012..0016` | Must re-query |
| Canonical product rows | `0` | Must re-query |
| Canonical object owner | `ai_strength_migrator` | Must re-query |
| Connected managed owner | Had `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, replication and app memberships | Must re-query and must not be used as runtime |

**Final provenance verdict: NOT CURRENTLY ESTABLISHED. Operator rerun required.**
**Ownership/RLS verdict: NOT CURRENTLY ESTABLISHED. Operator rerun required under restricted principals.**

### Operator-ready read-only query pack

Run this pack immediately before migration using an authorized read-only or operations connection. Save the complete output in the change record. Do not repair anomalies in the same session.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Database and connected principal.
SELECT current_database() AS database,
       current_user AS login,
       current_setting('server_version') AS postgres_version;

SELECT rolname,
       rolsuper,
       rolbypassrls,
       rolcreatedb,
       rolcreaterole,
       rolreplication
FROM pg_roles
WHERE rolname = current_user;

-- Exact migration ledger. Compare each checksum with the matching repository
-- *.up.sql SHA-256 before proceeding.
SELECT name, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY name;

-- Canonical workflow counts. A non-zero count is not automatically a defect,
-- but it requires lineage validation and changes rollback risk.
SELECT 'trainer_athlete_relations' AS entity, count(*) AS rows FROM app.trainer_athlete_relations
UNION ALL SELECT 'workout_assignments', count(*) FROM app.workout_assignments
UNION ALL SELECT 'workout_sessions', count(*) FROM app.workout_sessions
UNION ALL SELECT 'attention_items', count(*) FROM app.attention_items
UNION ALL SELECT 'trainer_feedback', count(*) FROM app.trainer_feedback
ORDER BY entity;

-- Session -> Assignment -> athlete/trainer -> relation provenance.
SELECT session.id AS session_id,
       session.assignment_id,
       session.athlete_user_id AS session_athlete_id,
       session.trainer_user_id AS session_trainer_id,
       assignment.athlete_user_id AS assignment_athlete_id,
       assignment.trainer_user_id AS assignment_trainer_id,
       relation.id AS relation_id,
       relation.status AS relation_status
FROM app.workout_sessions AS session
LEFT JOIN app.workout_assignments AS assignment
  ON assignment.id = session.assignment_id
LEFT JOIN app.trainer_athlete_relations AS relation
  ON relation.athlete_user_id = session.athlete_user_id
 AND relation.trainer_user_id = session.trainer_user_id
WHERE assignment.id IS NULL
   OR assignment.athlete_user_id IS DISTINCT FROM session.athlete_user_id
   OR assignment.trainer_user_id IS DISTINCT FROM session.trainer_user_id
   OR relation.id IS NULL
ORDER BY session.id;

-- Ownership for canonical schemas, migration ledger, relations and routines.
SELECT 'schema' AS object_kind,
       namespace.nspname AS object_identity,
       pg_get_userbyid(namespace.nspowner) AS owner
FROM pg_namespace AS namespace
WHERE namespace.nspname IN ('app', 'app_private')
UNION ALL
SELECT relation.relkind::text,
       format('%I.%I', namespace.nspname, relation.relname),
       pg_get_userbyid(relation.relowner)
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname IN ('app', 'app_private')
   OR relation.oid = to_regclass('public.app_schema_migrations')
UNION ALL
SELECT 'routine',
       routine.oid::regprocedure::text,
       pg_get_userbyid(routine.proowner)
FROM pg_proc AS routine
JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname IN ('app', 'app_private')
ORDER BY object_kind, object_identity;

-- RLS and FORCE RLS state for every canonical ordinary/partitioned table.
SELECT namespace.nspname AS schema_name,
       relation.relname AS table_name,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS force_rls
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname IN ('app', 'app_private')
  AND relation.relkind IN ('r', 'p')
ORDER BY schema_name, table_name;

-- Any PUBLIC table/sequence privileges in canonical schemas.
SELECT table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND table_schema IN ('app', 'app_private')
ORDER BY table_schema, table_name, privilege_type;

SELECT object_schema AS schema_name,
       object_name,
       object_type,
       privilege_type
FROM information_schema.role_usage_grants
WHERE grantee = 'PUBLIC'
  AND object_schema IN ('app', 'app_private')
ORDER BY schema_name, object_name, privilege_type;

-- PUBLIC routine execution and security-definer posture.
SELECT namespace.nspname AS schema_name,
       routine.oid::regprocedure AS routine,
       routine.prosecdef AS security_definer,
       routine.proconfig AS routine_config,
       has_function_privilege('PUBLIC', routine.oid, 'EXECUTE') AS public_execute
FROM pg_proc AS routine
JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname IN ('app', 'app_private')
ORDER BY schema_name, routine::text;

ROLLBACK;
```

Locally calculate repository checksums without opening or changing the database, then compare every applied ledger row exactly:

```bash
find database/migrations -maxdepth 1 -type f -name '*.up.sql' -print0 \
  | sort -z \
  | xargs -0 shasum -a 256
```

Expected pre-migration ledger is exactly `0001..0011` only if the rerun confirms the previous candidate state. Any unknown name, missing prefix row, duplicate, reordered lineage or checksum mismatch is a stop condition.

After connection credentials are provisioned, run repository preflight from the reviewed checkout:

```bash
npm run ops:validate-config
npm run ops:preflight
```

Before migration, preflight/readiness must classify an exact `0001..0011` prefix as `outdated`, never `current`. Do not substitute an owner connection to make readiness pass.

## 9. Migration apply plan

This plan is prepared but **must not be executed without explicit founder approval**.

Preconditions:

- `<PILOT_ENVIRONMENT>` and `<PILOT_ORIGIN>` are recorded;
- the deployment artifact/release is identified;
- restricted app, auth and health connections are provisioned;
- worker is either disabled or has its restricted connection;
- isolated migration/operator credentials are provisioned;
- production OTP and Resend delivery pass;
- demo mode is off and Supabase placeholders are exact;
- backup and restore evidence pass;
- the final read-only preflight confirms an exact known ledger, checksums, ownership, grants, RLS and verifiable lineage;
- explicit founder `GO FOR ROLLOUT` is recorded.

Expected ordered chain from a confirmed `0011` candidate:

```text
0012_athlete_profile_read_model
-> 0013_workout_template_revision_lifecycle
-> 0014_canonical_exercise_library
-> 0015_workout_template_command_hardening
-> 0016_workout_session_completion
```

Use the normal repository migrator with secure environment injection:

```bash
node scripts/db/migrate.mjs --through 0016_workout_session_completion
```

Do not copy SQL manually, skip intermediate migrations or edit old migration files. The runner validates the immutable checksum contract, obtains its migration lock, enters the `ai_strength_migrator` role and applies pending migrations transactionally in lexical order. Preserve complete output and the operator/change reference.

If the rerun does not confirm the exact expected prefix, do not execute this plan.

## 10. Post-migration checks

Immediately after successful migration application, and before synthetic or real participant use:

1. Query `public.app_schema_migrations`; require exactly the known `0001..0016` chain and repository-matching checksums.
2. Require latest migration `0016_workout_session_completion` and total expected ledger size `16`.
3. Call readiness through the deployed health route using `DATABASE_HEALTH_URL`; require schema state `current`.
4. Re-run `npm run ops:preflight`; require no role, ownership, checksum, demo or legacy-placeholder issue.
5. Re-run the ownership query; canonical schemas, relations, sequences, routines, types and migration metadata must have the expected `ai_strength_migrator` ownership.
6. Re-run the RLS/FORCE query and compare it with the reviewed migration contract. Product tables must retain FORCE RLS where required.
7. Inspect all `SECURITY DEFINER` helpers changed/introduced by the applied chain. Require a fixed `search_path`, PUBLIC execution revoked and only intended role grants.
8. Prove that the actual app login is neither owner nor superuser nor `BYPASSRLS`, and has no operations memberships.
9. Prove the auth and health logins are separate restricted principals with only their intended capabilities.
10. Confirm migration/operator credentials are absent from the deployed product runtime.
11. Boot the canonical application with `NEXT_PUBLIC_DEMO_MODE=false` and exact inert Supabase placeholders.
12. Run external HTTP smoke against the exact origin:

```bash
EXTERNAL_BASE_URL=<PILOT_ORIGIN> npm run ops:smoke-external
```

Do not expose detailed readiness issues in public HTTP output; preserve server-side evidence in the operator record.

## 11. RLS matrix

Use synthetic users Athlete A, Trainer T and unrelated Trainer T2. Create setup identities/relationship facts only through the approved fixture/operator process. Execute product assertions through `DATABASE_APP_URL` with transaction-local actor context; owner/operator observations do not prove RLS.

| Relation/workflow state | Athlete A | Trainer T | Trainer T2 |
| --- | --- | --- | --- |
| Active relation, current assignment/session | Can see and execute own canonical workflow | Can see linked athlete workflow, assign and review according to capabilities | Cannot read, mutate or inherit the workflow |
| Active relation, completed session/feedback | Can see own completed detail and feedback | Can review/send feedback through canonical commands | Cannot see session, attention or feedback |
| Suspended/ended after a session started | Retains own exact session/history access | Only exact bounded historical workflow allowed by the accepted R3D contract | No access |
| Suspended/ended, unrelated profile surface | No new restriction introduced here | No broad suspended Profile capability is granted by this rollout | No access |
| Foreign ID substitution | Request denied without revealing foreign data | Request denied without revealing foreign data | Request denied |

Minimum assertions:

- Trainer T2 cannot select or update A's Assignment, Session, AttentionItem or Feedback by replacing IDs.
- A cannot act as trainer or read another athlete's data.
- T cannot use a former relationship to open unrelated new work after suspension/end.
- Started-session historical access is exact and bounded; it does not become broad Profile access.
- Runtime tests use the restricted app principal and verify database-enforced behavior.

Broad suspended Profile policy remains a separate pre-beta security-hardening decision and is not redesigned in this rollout preparation.

## 12. Synthetic smoke

Run one synthetic core loop after Sections 9–11 pass and before inviting real participants. Use non-personal test identities and record every canonical identifier.

1. Trainer T signs in through the intended email OTP path.
2. T opens Dashboard, Athlete A's Profile and canonical Quick Assign.
3. T selects a saved/published Template Revision and creates one Assignment.
4. A signs in through the intended email OTP path and opens Home.
5. A starts the Assignment, saves progress, reloads and resumes the same Session.
6. A completes the Session with the accepted completion context.
7. T opens the resulting Review/AttentionItem and sends Feedback.
8. A sees latest Feedback, opens the exact completed Session and returns to History.
9. Verify cross-role identity continuity and no duplicate commands/receipts.

Record:

```text
Relation ID:
Template Revision ID:
Assignment ID:
Session ID:
AttentionItem ID:
Feedback ID:
Deployed release:
Pilot environment:
UTC started/completed/reviewed timestamps:
```

After initial fixture/user setup, do not use direct database writes to advance the workflow. Do not use unrelated real-user data. An already-open Client Home may require manual reload during this internal pilot; record whether that accepted stale-Home behavior occurs. Confirm browser network traffic does not call a real Supabase project.

## 13. Stop conditions

Stop immediately and return exact evidence without repair if any of the following occurs:

- pilot environment, origin, database identity or release is ambiguous;
- read-only preflight cannot be completed before the approved window;
- migration ledger is not the exact expected known prefix;
- an applied checksum differs from the reviewed repository file;
- any unknown, reordered or duplicate migration is present;
- imported/canonical Sessions have unverifiable Assignment, athlete, trainer or relation lineage;
- ownership differs from the expected migrator ownership for canonical objects;
- RLS/FORCE RLS is missing where required;
- unexpected PUBLIC table, sequence or routine grants exist;
- a security-definer routine has unsafe `search_path` or broad execution grants;
- app/auth/health/worker uses an owner, superuser, `BYPASSRLS` or operations principal;
- product runtime receives migration/operator/owner credentials;
- canonical runtime points to a real legacy Supabase data source;
- demo mode is enabled;
- OTP uses memory/test delivery or Resend delivery is unverified;
- backup or restore evidence is missing;
- the migration run or post-migration verification deviates from the reviewed chain;
- synthetic smoke shows foreign access, duplicate commands, broken ID continuity or production-path fallback.

An external timeout before any result is `HOLD`, not a database anomaly. A confirmed mismatch/anomaly from successful read-only queries is `STOP — EXTERNAL ENVIRONMENT ANOMALY`.

## 14. Founder GO checklist

- [ ] Pilot environment chosen
- [ ] Pilot origin chosen
- [ ] Reviewed release selected and recorded
- [ ] Restricted APP principal provisioned
- [ ] Restricted AUTH principal provisioned
- [ ] HEALTH principal provisioned
- [ ] WORKER principal provisioned or worker disabled
- [ ] Operations principal configured
- [ ] Runtime and operations credentials isolated
- [ ] Demo mode OFF
- [ ] Auth/OTP secrets configured
- [ ] Email provider and verified sender configured
- [ ] Intended production OTP delivery smoke passed
- [ ] Disabled Supabase public placeholders configured exactly
- [ ] Legacy Supabase flags false/unset
- [ ] Backup confirmed
- [ ] Restore procedure confirmed
- [ ] Restore rehearsal evidence accepted
- [ ] Final external read-only preflight PASS
- [ ] Exact `0001..0011` ledger/checksums confirmed
- [ ] Ownership, RLS/FORCE and PUBLIC grants PASS
- [ ] Pre-migration environment smoke PASS with truthful `outdated` readiness
- [ ] Founder `GO FOR ROLLOUT` received and recorded

Only when every applicable box is true may the preparation verdict become `READY FOR FOUNDER GO REVIEW`. This document never changes the verdict to `GO FOR ROLLOUT` automatically.

## 15. Remaining risks

| Risk | Current state | Closure evidence |
| --- | --- | --- |
| No designated pilot environment | Open blocker | Hosting project/environment identifier |
| No exact pilot origin | Open blocker | Verified HTTPS origin and matching `AUTH_PUBLIC_ORIGIN` |
| External Neon evidence stale | Open blocker | Fresh successful read-only query pack |
| Runtime roles not evidenced | Open blocker | Principal names/capability output and successful preflight |
| Auth/Resend not evidenced in deployment | Open blocker | Config validation plus delivered OTP through intended path |
| Backup unknown | Open blocker | Timestamped provider recovery point evidence |
| Restore unknown | Open blocker | Reviewed procedure and rehearsal evidence |
| Notification worker | Controlled | Keep disabled, or complete Telegram worker gate |
| `0016` down migration is destructive after context writes | Accepted operational risk | Forward-fix rule and recovery record |
| Client Home may remain stale in an open tab | Accepted internal-pilot risk | Manual reload instruction and occurrence log |
| Broad suspended Profile policy | Deferred pre-beta hardening | Separate security/product decision; not expanded here |

### Exact pending operator actions

1. Choose `<PILOT_ENVIRONMENT>` and `<PILOT_ORIGIN>`.
2. Provision and securely inject the connection matrix from Section 4.
3. Configure application/auth/email/runtime variables from Section 5.
4. Keep the worker disabled or explicitly complete its Telegram gate.
5. Prove real OTP delivery through the deployed origin.
6. Produce backup and restore evidence.
7. Re-run the complete external read-only pack and repository preflight.
8. Resolve any anomaly through a separately reviewed change; do not auto-repair.
9. Complete pre-migration deployment smoke and record truthful `outdated` readiness.
10. Present the evidence bundle to the founder for an explicit decision.
11. Only after founder approval, execute the migration plan in Section 9.
12. Complete post-migration RLS/health checks and the synthetic core loop before real invitations.

**Final verdict: HOLD — OPERATOR CONFIGURATION INCOMPLETE**

No external database was modified. Migrations `0012..0016` were not applied. No external roles, grants, secrets or deployments were created or changed.
