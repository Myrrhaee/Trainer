# Migration 0016 Rollout Runbook v1

Дата: 2026-09-05. Статус: operational draft; rollout remains **HOLD**.
Связанный gate: [Internal Pilot Deployment Gate v1](internal-pilot-deployment-gate-v1.md).

## 1. Purpose and hard boundaries

This runbook applies the canonical migration chain through `0016_workout_session_completion` to one explicitly designated internal-pilot PostgreSQL environment. It does not authorize execution by itself.

Hard boundaries:

- do not run against an environment that has not been named and approved;
- do not print connection strings, passwords, tokens, cookies or participant data;
- do not use the app runtime login for DDL;
- do not put migration/owner/operator credentials in the deployed application;
- do not repair provenance, ownership or RLS findings automatically;
- do not start participants until the post-migration smoke passes;
- do not treat `0016.down.sql` as lossless rollback;
- do not use Supabase or demo data as canonical pilot facts.

Current observed candidate state is `0011`, so the expected forward chain is `0012..0016`, not only `0016`.

## 2. Operator record

Complete before any command that writes:

| Field | Value |
| --- | --- |
| Environment name | |
| Application HTTPS origin | |
| Release commit | `7b396f4e0ead054af7d63477bcccddb6384c9dbc` or reviewed successor |
| Database host / name | |
| Current migration | |
| Target migration | `0016_workout_session_completion` |
| Rollout operator | |
| Restore owner | |
| Incident owner/channel | |
| Maintenance start/end UTC | |
| Backup reference and UTC time | |
| Explicit rollout approval reference | |

Never place secret values in this table.

## 3. Required operator tooling

- repository checkout at the approved release;
- Node.js and installed repository dependencies;
- PostgreSQL client tools compatible with the target server for backup/restore, or a verified provider-native restore mechanism;
- isolated environment injection for `DATABASE_MIGRATION_URL` and runtime URLs;
- a separate browser/device context for trainer and athlete smoke identities;
- a redacted evidence location outside Git.

This development machine did not have `psql`, `pg_dump` or `pg_restore` available during the gate. Run catalog SQL from an approved SQL console or an operator host with those tools.

## 4. Preflight: source and environment

1. Confirm source without changing Git:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git diff --check
```

2. Confirm that only environment-variable names, never values, are logged:

```bash
env | cut -d= -f1 | sort
```

3. Required external configuration:

- `APP_ENV=staging` for an internal-pilot staging environment;
- immutable `APP_RELEASE`;
- distinct `DATABASE_APP_URL`, `DATABASE_AUTH_URL`, `DATABASE_HEALTH_URL`, `DATABASE_WORKER_URL`;
- isolated `DATABASE_MIGRATION_URL` and `DATABASE_OPERATOR_URL` available only to operator jobs;
- `ALPHA_OPERATOR_REF`;
- HTTPS `AUTH_PUBLIC_ORIGIN`;
- production-strength, distinct `AUTH_OTP_PEPPER` and `AUTH_FLOW_SECRET`;
- external email delivery configuration;
- `AUTH_DEV_OTP_DISCLOSURE=false`;
- `NEXT_PUBLIC_DEMO_MODE=false`;
- all legacy Supabase feature flags false/unset;
- notification delivery explicitly `disabled` or approved `telegram`.

4. For the temporary eager client dependency, set non-secret dummy public Supabase values. Do not inherit a real legacy service-role key into runtime. Record only that values are configured, never their content.

5. Confirm that the named database is the same database used in every following check. A different hostname/database invalidates all prior evidence.

## 5. Read-only migration ledger and checksum preflight

Run in a read-only transaction with the migration connection. Save redacted results.

```sql
BEGIN READ ONLY;

SELECT current_database() AS database,
       current_user AS login,
       current_setting('server_version') AS postgres_version;

SELECT name, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY name;

SELECT pg_get_userbyid(relowner) AS migration_table_owner
FROM pg_class
WHERE oid = 'public.app_schema_migrations'::regclass;

ROLLBACK;
```

Compare every applied checksum with SHA-256 of the matching repository `*.up.sql`. Expected current candidate result is exact `0001..0011` with no mismatch. Any changed checksum or unknown applied migration is **STOP**.

Do not run `npm run ops:preflight` as the only pre-migration ledger check: it correctly fails while target migrations are pending. Run it after the migration as a full environment gate.

## 6. Read-only provenance preflight

The query below returns aggregate counts only.

```sql
BEGIN READ ONLY;

SELECT status::text, count(*) AS rows
FROM app.workout_sessions
GROUP BY status
ORDER BY status;

SELECT
  count(*) FILTER (WHERE assignment.id IS NULL) AS missing_assignment,
  count(*) FILTER (
    WHERE assignment.id IS NOT NULL
      AND session.athlete_user_id <> assignment.athlete_user_id
  ) AS athlete_mismatch,
  count(*) FILTER (
    WHERE assignment.id IS NOT NULL
      AND session.trainer_user_id <> assignment.trainer_user_id
  ) AS trainer_mismatch,
  count(*) FILTER (
    WHERE assignment.id IS NOT NULL
      AND session.relation_id <> assignment.relation_id
  ) AS assignment_relation_mismatch,
  count(*) FILTER (WHERE relation.id IS NULL) AS missing_relation,
  count(*) FILTER (
    WHERE relation.id IS NOT NULL
      AND (
        session.athlete_user_id <> relation.athlete_user_id
        OR session.trainer_user_id <> relation.trainer_user_id
      )
  ) AS relation_party_mismatch,
  count(*) FILTER (WHERE started.id IS NULL) AS missing_start_audit,
  count(*) FILTER (
    WHERE started.id IS NOT NULL
      AND (
        started.actor_user_id <> session.athlete_user_id
        OR started.subject_user_id <> session.athlete_user_id
      )
  ) AS start_audit_actor_mismatch
FROM app.workout_sessions session
LEFT JOIN app.workout_assignments assignment
  ON assignment.id = session.assignment_id
LEFT JOIN app.trainer_athlete_relations relation
  ON relation.id = session.relation_id
LEFT JOIN LATERAL (
  SELECT event.id, event.actor_user_id, event.subject_user_id
  FROM app.audit_events event
  WHERE event.event_type = 'workout.session.started'
    AND event.metadata ->> 'session_id' = session.id::text
  ORDER BY event.occurred_at
  LIMIT 1
) started ON true;

SELECT count(*) AS duplicate_assignment_session_groups
FROM (
  SELECT assignment_id
  FROM app.workout_sessions
  GROUP BY assignment_id
  HAVING count(*) > 1
) duplicate;

SELECT kind::text, count(*) AS rows
FROM app.workout_session_command_receipts
GROUP BY kind
ORDER BY kind;

SELECT count(*) AS terminal_without_completion_receipt
FROM app.workout_sessions session
WHERE session.status IN ('completed', 'completed_with_omissions')
  AND NOT EXISTS (
    SELECT 1
    FROM app.workout_session_command_receipts receipt
    WHERE receipt.session_id = session.id
      AND receipt.kind = 'complete'
  );

SELECT
  count(*) FILTER (WHERE session.id IS NULL) AS missing_session,
  count(*) FILTER (
    WHERE session.id IS NOT NULL
      AND (
        attention.trainer_user_id <> session.trainer_user_id
        OR attention.athlete_user_id <> session.athlete_user_id
        OR attention.relation_id <> session.relation_id
      )
  ) AS attention_tuple_mismatch,
  count(*) FILTER (
    WHERE session.id IS NOT NULL
      AND session.status NOT IN ('completed', 'completed_with_omissions')
  ) AS attention_nonterminal_source
FROM app.attention_items attention
LEFT JOIN app.workout_sessions session
  ON session.id = attention.source_session_id;

SELECT count(*) AS terminal_without_review_attention
FROM app.workout_sessions session
WHERE session.status IN ('completed', 'completed_with_omissions')
  AND NOT EXISTS (
    SELECT 1
    FROM app.attention_items attention
    WHERE attention.source_session_id = session.id
      AND attention.item_type = 'workout_review'
  );

ROLLBACK;
```

Decision:

- every lineage/audit/Attention mismatch must be zero;
- nonzero Sessions may be valid, but each missing start audit or privileged/imported origin requires case-by-case provenance review;
- a pre-0016 completion receipt is an old-shape receipt and must remain replay-compatible;
- legacy terminal context remains null after migration and must never be interpreted as false;
- any unverifiable imported or privileged Session is **STOP**; do not repair it or grant historical access automatically.

## 7. Ownership, roles, RLS and grants preflight

### 7.1 Role flags

```sql
BEGIN READ ONLY;

SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
FROM pg_roles
WHERE rolname IN (
  'ai_strength_migrator',
  'ai_strength_app',
  'ai_strength_authenticator',
  'ai_strength_health',
  'ai_strength_worker',
  'ai_strength_operator'
)
ORDER BY rolname;

ROLLBACK;
```

Every application group role must be non-superuser and `rolbypassrls=false`.

### 7.2 Full ownership drift

Use the same object classes as `scripts/db/migrate.mjs:71-137`: schemas `app`/`app_private`, all relations/sequences/views, migration metadata, routines and enum/domain types. Expected owner is `ai_strength_migrator`; expected drift count is zero.

The wire migrator runs this preflight automatically. The HTTPS Neon fallback does not, so a saved zero-row result is mandatory before `migrate-neon.mjs`.

At minimum verify touched objects explicitly:

```sql
BEGIN READ ONLY;

SELECT namespace.nspname AS schema,
       relation.relname AS object,
       pg_get_userbyid(relation.relowner) AS owner,
       relation.relrowsecurity AS rls,
       relation.relforcerowsecurity AS force_rls
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'app'
  AND relation.relname IN (
    'workout_sessions',
    'workout_assignments',
    'trainer_athlete_relations',
    'attention_items',
    'trainer_feedback',
    'attention_manual_resolutions',
    'review_command_receipts'
  )
ORDER BY relation.relname;

SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'app'
  AND grantee = 'PUBLIC'
ORDER BY table_name, privilege_type;

ROLLBACK;
```

Unexpected owner, missing FORCE RLS or PUBLIC workflow grants are **STOP**.

## 8. Backup gate

Do not continue until backup evidence is complete.

Preferred order:

1. Create a provider-native restore point/branch if supported by the approved environment.
2. Create a logical custom-format backup from an operator host with a PostgreSQL client version compatible with the target server.
3. Store it in the approved restricted backup location.
4. Verify that the artifact is readable and perform a restore into a disposable database/branch when policy permits.
5. Record timestamp, restore owner, evidence reference and retention.

Example logical backup command using a protected PostgreSQL service definition rather than a credential-bearing URL in process arguments:

```bash
pg_dump --format=custom --verbose --file="$BACKUP_FILE" --dbname="$PGSERVICE"
pg_restore --list "$BACKUP_FILE" >/dev/null
```

Configure `PGSERVICE`/`PGSERVICEFILE` and any password file outside Git with restricted permissions. Do not put a connection string in shell history, process arguments or filenames. Do not claim restore readiness from `pg_restore --list` alone; provider restore or a disposable restore test is stronger evidence.

If no verified backup/restore point exists, verdict remains **HOLD**.

## 9. Maintenance and coordination

Before applying:

- [ ] explicit user/founder authorization recorded;
- [ ] rollout operator and restore owner online;
- [ ] no participant Session in progress;
- [ ] application writes paused or application not yet exposed;
- [ ] exact database identity rechecked;
- [ ] release commit fixed;
- [ ] preflight outputs stored redacted;
- [ ] backup gate complete;
- [ ] forward-fix owner identified;
- [ ] post-migration smoke identities prepared with no real participant data.

## 10. Migration application

Preferred wire-protocol command:

```bash
node scripts/db/migrate.mjs --through 0016_workout_session_completion
```

The process must receive `DATABASE_MIGRATION_URL` through secure environment injection. Expected behavior from the observed external candidate is five atomic applications in order: `0012`, `0013`, `0014`, `0015`, `0016`.

Do not continue if:

- owner preflight returns any object;
- an applied checksum differs;
- migration order is not contiguous;
- a lifecycle/backfill preflight in `0013` or later fails;
- the connection target differs from the recorded database;
- any statement fails.

If PostgreSQL wire transport is unreliable and the operator explicitly approves Neon HTTPS fallback:

```bash
node scripts/db/migrate-neon.mjs
```

Before this fallback, retain a separate full ownership-preflight result because the HTTPS runner does not perform the object-owner check itself. Never retry by manually executing only the failed SQL batch; first inspect the migration ledger and transaction outcome.

## 11. Post-migration catalog verification

```sql
BEGIN READ ONLY;

SELECT name, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY name;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'workout_sessions'
  AND column_name IN (
    'overall_comment',
    'discomfort_reported',
    'discomfort_comment'
  )
ORDER BY column_name;

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'workout_session_context_v1';

SELECT trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'app'
  AND event_object_table = 'workout_sessions'
ORDER BY trigger_name, event_manipulation;

SELECT routine.proname,
       pg_get_userbyid(routine.proowner) AS owner,
       routine.prosecdef AS security_definer,
       routine.provolatile,
       pg_get_function_result(routine.oid) AS result_type,
       routine.proconfig,
       routine.proacl
FROM pg_proc routine
JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
WHERE namespace.nspname = 'app'
  AND routine.proname = 'has_terminal_assignment_workflow';

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'app'
  AND tablename IN (
    'workout_sessions',
    'workout_assignments',
    'trainer_athlete_relations',
    'attention_items',
    'trainer_feedback',
    'attention_manual_resolutions',
    'review_command_receipts'
  )
ORDER BY tablename, policyname;

ROLLBACK;
```

Expected:

- exactly 16 migration ledger rows and matching checksums;
- all three new columns nullable with no default;
- `workout_session_context_v1` present;
- context trigger present;
- helper owned by `ai_strength_migrator`, `SECURITY DEFINER`, `STABLE`, boolean result, fixed `search_path=pg_catalog, app`;
- helper ACL has no PUBLIC execute and grants only intended app execution;
- all touched tables retain RLS and FORCE RLS;
- no unexpected PUBLIC grant.

Run full deployment preflight with final environment injection:

```bash
npm run ops:preflight
```

Every check must pass. Because the runtime health schema marker is currently stale at `0011`, do not use `/api/health/ready` as the sole proof of schema currency. Close that code blocker in a separately reviewed change before pilot deployment.

## 12. Read-only RLS proof matrix

After creating synthetic smoke facts through normal product commands, use separate app-role sessions for each actor. Do not run as the owner without `SET LOCAL ROLE ai_strength_app`, because the managed owner has `BYPASSRLS`.

Per actor transaction:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE ai_strength_app;
SELECT set_config('app.actor_user_id', :'actor_user_id', true);

SELECT id, assignment_id, relation_id, trainer_user_id, athlete_user_id, status
FROM app.workout_sessions
WHERE id = :'session_id'::uuid;

SELECT id, relation_id, trainer_user_id, athlete_user_id
FROM app.workout_assignments
WHERE id = :'assignment_id'::uuid;

SELECT id, source_session_id, relation_id, trainer_user_id, athlete_user_id, status
FROM app.attention_items
WHERE source_session_id = :'session_id'::uuid;

SELECT id, source_session_id, relation_id, trainer_user_id, athlete_user_id
FROM app.trainer_feedback
WHERE source_session_id = :'session_id'::uuid;

ROLLBACK;
```

Run and record for:

| Actor | Expected visibility |
| --- | --- |
| Athlete A | Own active/terminal Session, own logs and own Feedback only |
| Original Trainer T, active relation | Normal current workflow |
| Original T after suspension/end | Exact terminal Session/Assignment/Attention/Feedback only |
| Other Trainer T2 | Zero old workflow rows |
| Foreign Athlete B | Zero Athlete A workflow rows |
| New relation for same pair | Does not inherit rows from old relation |

Also prove that historical Review access does not expose general Profile, Progress, a new Assignment capability or unrelated history. Opening a transition URL is not authorization evidence.

Any foreign row, inherited old workflow or unexpected general access is **STOP**.

## 13. Synthetic post-migration smoke

Use only fixture identities and one disposable synthetic relation.

Trainer:

1. Sign in through canonical auth.
2. Open `/trainer/dashboard`.
3. Open exact `/trainer/clients/{athleteId}`.
4. Open Quick Assign and assign an exact Published revision once.

Athlete:

5. Sign in separately and open `/client/me`.
6. Confirm the same Assignment; if Home was already open, use the documented manual reload once and record it.
7. Start the exact Session.
8. Save one Set.
9. Reload and Resume; confirm the Set remains.
10. Complete with explicit discomfort `No`.

Trainer:

11. Confirm exactly one Review appears.
12. Open exact Review; verify Assignment/Session/Set/context identity.
13. Send one Feedback and resolve once.

Athlete:

14. Confirm Home shows the same Feedback.
15. Open the exact completed Session and confirm history contains it.

Additional security/network checks:

- second trainer cannot access the first athlete's Profile/Review/Session;
- second athlete cannot access the first athlete's facts;
- no duplicate logical effects after normal retry/reload;
- browser makes 0 requests to `.supabase.co` and the configured dummy Supabase endpoint during canonical flow;
- deferred `/history`, `/client/activity`, `/client/progress` and `/client/dashboard` are not used.

No destructive test may target unrelated real users.

## 14. Incident handling

| Condition | Decision | Action |
| --- | --- | --- |
| Environment unavailable, approval missing or backup incomplete | HOLD | Stop before migration. |
| Checksum mismatch, schema drift, owner conflict or unexpected grants | STOP | Preserve evidence; no repair. |
| Imported/unverifiable Session lineage | STOP | Do not grant bounded historical access. |
| Migration transaction fails with no ledger row | HOLD | Inspect error and DB state; review before retry. |
| Network outcome unknown | HOLD | Read ledger/catalog first; never execute partial SQL manually. |
| Post-migration catalog/RLS mismatch | STOP | Keep participants out; choose restore or reviewed forward fix. |
| Smoke P0/P1 | STOP | Contain, preserve redacted IDs/evidence, no participant retries. |
| Known stale already-open Client Home only | Accepted internal-pilot limitation | Normal page reload; record frequency. |

## 15. Forward-fix and rollback rule

### Before any post-0016 context write

A technical rollback may be considered only if:

- participants have not started;
- the backup/restore point is verified;
- operator confirms no new completion context exists;
- code and database rollback are coordinated;
- explicit approval is recorded.

### After any collected context exists

Prefer a reviewed forward fix. `0016.down.sql` drops `overall_comment`, `discomfort_reported` and `discomfort_comment`; running it requires export and explicit data-loss approval. Never label that operation lossless.

Do not deploy old completion code against the new schema without proving that required discomfort input remains satisfied. Do not restore only schema while keeping incompatible newer application code.

## 16. Completion checklist

- [ ] Exact pilot environment named.
- [ ] Current migration and all checksums verified.
- [ ] Provenance preflight clean.
- [ ] Ownership drift zero.
- [ ] Runtime identities distinct and non-privileged.
- [ ] Backup and restore evidence recorded.
- [ ] Explicit rollout approval recorded.
- [ ] `0012..0016` applied atomically and ledger verified.
- [ ] Columns, constraints, triggers, helper ACL/search path and RLS verified.
- [ ] `npm run ops:preflight` passed.
- [ ] Runtime schema-marker blocker closed separately.
- [ ] Exact release deployed.
- [ ] Synthetic two-role smoke passed.
- [ ] Cross-role denial and 0 Supabase request evidence captured.
- [ ] Rollback/forward-fix decision recorded.
- [ ] Pilot owner gives final GO before participant admission.

Until every required item is checked, migration rollout or pilot start remains **HOLD**.
