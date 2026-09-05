# Internal Pilot Deployment Gate v1

Дата: 2026-09-05. Ветка: `codex/internal-pilot-deployment-gate`.
Продуктовый baseline: `7b396f4e0ead054af7d63477bcccddb6384c9dbc` (`fix(core-loop): close R4 pilot blockers`).
Pilot documentation checkpoint: `ba659e1de25caaca5154d887e24a1a8a68a1aba5` (`docs(pilot): define internal pilot plan`).

## 1. Executive verdict

**PRODUCT READINESS: PASS для ограниченного internal pilot по R4 evidence.**

**DEPLOYMENT READINESS: HOLD.**

**PILOT START: HOLD**, пока deployment gate не будет повторён в явно назначенном pilot environment и не будут закрыты все HOLD-пункты.

Read-only audit нашёл доступную внешнюю Neon database, но её назначение как pilot environment не подтверждено. База пуста по ключевым domain tables, checksums `0001..0011` совпадают, ownership drift и lineage anomalies не найдены. При этом база отстаёт на пять migrations (`0012..0016`), verified backup отсутствует, раздельные runtime logins не доступны и external application origin не обнаружен.

| Gate | Result | Evidence |
| --- | --- | --- |
| R4 product/core loop | PASS | `docs/core-loop-r4-fix-pass-v1.md:321-370` |
| External database access | PASS, candidate only | Read-only Neon catalog probe on 2026-09-05 |
| Applied migration checksums | PASS for `0001..0011` | `public.app_schema_migrations`; local SHA-256 comparison |
| Migration target | HOLD | External latest `0011`; pending `0012..0016` |
| Provenance | PASS for inspected candidate, empty dataset | 0 users, relations, assignments, Sessions, AttentionItems and Feedback |
| Ownership | PASS before rollout | All application objects and migration ledger owned by `ai_strength_migrator` |
| RLS / helper source | PASS locally; external verification pending | Migration source, local post-0016 catalog and R3D tests |
| Runtime role separation | HOLD | Only owner connection is locally available; staging preflight reports missing dedicated URLs |
| Backup | HOLD | No backup timestamp, restore owner or restore-test evidence |
| Application deployment | HOLD | No linked deployment metadata or `EXTERNAL_BASE_URL` found |
| Eager Supabase dependency | Accepted prerequisite, gated | Non-secret placeholders required; canonical browser evidence had 0 Supabase requests |
| External application of `0016` | NOT PERFORMED | Explicit task boundary |

There are no current STOP findings in the inspected empty candidate database. A different actual pilot database must be treated as **unknown** and audited from the beginning.

## 2. Authoritative evidence and limits

Evidence reviewed:

- `docs/core-loop-r4-integration-audit-v1.md`;
- `docs/core-loop-r4-fix-pass-v1.md`;
- `docs/internal-pilot-plan-v1.md`;
- `docs/internal-pilot-runbook-v1.md`;
- `docs/client-workout-r3d-architecture-v1.md`;
- `docs/client-workout-r3d-implementation-v1.md`;
- `database/migrations/0016_workout_session_completion.up.sql`;
- `database/migrations/0016_workout_session_completion.down.sql`;
- `scripts/db/migrate.mjs`, `scripts/db/migrate-neon.mjs`, `scripts/db/shared.mjs`;
- `scripts/test/run-migration-upgrade-postgres.mjs`;
- `database/bootstrap/001_roles.sql`;
- `scripts/ops/preflight.ts` and runtime readiness code;
- canonical R3D PostgreSQL tests.

Catalog and aggregate data checks were executed read-only. No row contents, credentials, OTP values, tokens or personal fields were printed. A local clean install is not used as proof of the external environment. The external candidate is empty, so clean aggregate results do not prove how a future imported dataset will behave.

## 3. Environment inventory

### 3.1 Local canonical development database

| Field | Observed value |
| --- | --- |
| Name | local canonical development |
| Host / database | `127.0.0.1:55432` / `ai_strength_local` |
| PostgreSQL | 16.14 |
| Available login | `ai_strength_local_owner` |
| Migration state | 16 migrations; latest `0016_workout_session_completion`; no checksum mismatch |
| Schema/object owner | `ai_strength_migrator` for inspected application objects |
| App/migrator flags | Both group roles are non-superuser and `NOBYPASSRLS` |
| RLS | Inspected workflow tables have RLS and FORCE RLS |
| Data | 5 users; 0 relations, assignments, Sessions, AttentionItems and Feedback |
| Backup | No verified backup evidence |
| Pilot data | No core-loop pilot data |

All local database URLs currently resolve to the same owner login. This is acceptable for local convenience only and is not evidence of external runtime separation (`database/README.md:69-116`).

### 3.2 External Neon candidate

| Field | Observed value |
| --- | --- |
| Name | external Neon candidate; pilot purpose unconfirmed |
| Host / database | `ep-lively-mud-a28l1t5l.eu-central-1.aws.neon.tech` / `neondb` |
| PostgreSQL | 17.11 |
| Available login | `neondb_owner` |
| Login characteristics | Not superuser; `CREATEROLE`, `CREATEDB`, replication and `BYPASSRLS`; member of all six application group roles |
| Migration state | 11 migrations; latest `0011_closed_alpha_operator`; checksums match local files |
| Pending chain | `0012`, `0013`, `0014`, `0015`, `0016` |
| Schema/object owner | `ai_strength_migrator`; full ownership-drift query returned 0 rows |
| RLS | 22/26 ordinary `app`/`app_private` tables at this version have RLS and FORCE RLS; all seven inspected workflow tables do |
| Public table grants | None on inspected workflow tables |
| Domain data | 0 users, relations, assignments, Sessions, AttentionItems and Feedback |
| Backup | Unknown / not evidenced |
| Pilot data | None in inspected canonical tables |

The only locally available external credential is the owner credential. It must not be supplied to application runtime. The repository requires distinct app, auth, health, worker, migration and operator identities for staging/production (`lib/server/runtime/deployment-config.ts:138-179`).

### 3.3 External web application

No `.vercel/project.json`, deployment configuration or `EXTERNAL_BASE_URL` was found in this checkout. Therefore hostname, deployed release, runtime variables, login flow, health endpoint and browser network behavior cannot be verified here. This is an unavailable environment, not a failed environment.

## 4. Migration state and chain

The migration before `0016` is `0015_workout_template_command_hardening`. The canonical runner applies `*.up.sql` in lexical order, stores SHA-256 checksums, rejects changed applied files, acquires a migration-ledger lock and applies each migration atomically after `SET LOCAL ROLE ai_strength_migrator` (`scripts/db/migrate.mjs:46-67,155-227`).

Current external reality is not `0015 -> 0016`; it is `0011 -> 0012 -> 0013 -> 0014 -> 0015 -> 0016`. Skipping intermediate migrations is prohibited.

Evidence available:

- external `0001..0011` checksums match current repository files;
- `scripts/test/run-migration-upgrade-postgres.mjs` contains disposable upgrade coverage through `0015`, including lifecycle/exercise backfills and ownership recovery;
- `tests/backend-foundation/client-workout-r3d-postgres.test.ts:317-361` covers a real disposable `0015 -> 0016` upgrade with a legacy terminal Session, old completion receipt and active Session;
- R4 records a fresh PostgreSQL suite of 170/170 on the current chain (`docs/core-loop-r4-fix-pass-v1.md:347-364`);
- no migration or migration runner changed after the R4 production baseline.

Limitations and tooling gaps:

1. The standalone upgrade harness still expects migration count 15 after an unrestricted `migrate.mjs` call (`scripts/test/run-migration-upgrade-postgres.mjs:359-368`). At current HEAD that command includes `0016`; the harness must not be presented as a current end-to-end `0011 -> 0016` gate without correction/review.
2. `lib/server/runtime/schema-version.ts:1` still declares `0011_closed_alpha_operator`. Runtime health checks only that marker (`lib/server/database/health.ts:40-46`) and can therefore report schema-ready while `0012..0016` are absent. Post-migration catalog and full `ops:preflight` evidence are mandatory; health alone is insufficient. Updating the marker is a separate production change and was not performed here.
3. `scripts/db/migrate-neon.mjs` preserves checksum, role switch, lock and transaction behavior, but does not execute the full object-ownership preflight implemented in `scripts/db/migrate.mjs:71-155`. If HTTPS transport is used, the operator must first run the ownership query in the rollout runbook and retain the result.

## 5. Migration 0016 semantics

`0016` has the expected data-preservation semantics:

- adds nullable `overall_comment`, `discomfort_reported` and `discomfort_comment`;
- adds no defaults and performs no backfill (`database/migrations/0016_workout_session_completion.up.sql:21-35`);
- preserves every legacy terminal tuple as all-null, meaning "not collected", never "No";
- requires a real discomfort boolean when a post-migration active Session becomes `completed` or `completed_with_omissions` (`:37-52`);
- false requires a null discomfort comment; true requires a substantive comment;
- existing Session identity and terminal immutability remain enforced by the `0007` trigger;
- introduces bounded historical policies for exact original workflow lineage, not general Profile/Progress/new Assignment access;
- does not modify earlier migration files.

The down migration drops all three context columns and is explicitly destructive (`database/migrations/0016_workout_session_completion.down.sql:1,120-128`). It is not a lossless rollback.

## 6. External provenance preflight

Read-only result for the inspected external candidate:

| Check | Result |
| --- | ---: |
| Sessions | 0 |
| Missing Assignment | 0 |
| Assignment athlete mismatch | 0 |
| Assignment trainer mismatch | 0 |
| Assignment relation mismatch | 0 |
| Missing relation | 0 |
| Relation party mismatch | 0 |
| Duplicate Sessions for one Assignment | 0 |
| Session without `workout.session.started` audit | 0 |
| Start-audit actor mismatch | 0 |
| Completion/progress receipts | 0 |
| Terminal Session without completion receipt | 0 |
| Attention source/tuple/nonterminal mismatch | 0 |
| Terminal completed Session without review Attention | 0 |
| Imported or privileged Session requiring review | 0 detectable rows |

**Provenance verdict: PASS FOR THIS EMPTY CANDIDATE ONLY.** If the designated pilot environment differs or gains imported rows before rollout, rerun the complete query. Any unverifiable Session start or lineage mismatch is STOP; do not grant historical permissions or repair rows automatically.

## 7. Ownership and role preflight

The external candidate currently has:

- `app`, `app_private`, migration ledger, relations, routines and custom enum/domain types owned by `ai_strength_migrator`;
- zero objects returned by the runner-equivalent ownership-drift query;
- `ai_strength_app`, `ai_strength_migrator`, auth, worker, health and operator group roles all `NOBYPASSRLS`;
- no PUBLIC table grants on the inspected workflow tables;
- RLS and FORCE RLS on every workflow table touched by `0016`.

**Ownership verdict: PASS before migration for the candidate.**

**Runtime credential verdict: HOLD.** The only available external URL authenticates as the privileged managed owner. Before deployment, separate login URLs must exist and pass membership checks for app, auth, health, worker, migration and operator. The owner URL may be used only in isolated administration/bootstrap according to an approved operator procedure; it must never reach application runtime.

## 8. SECURITY DEFINER and RLS review

Source and local post-0016 catalog confirm `app.has_terminal_assignment_workflow(uuid,uuid,uuid)`:

- is PL/pgSQL, `STABLE`, `SECURITY DEFINER`;
- is owned by `ai_strength_migrator`, which is `NOBYPASSRLS`;
- fixes `search_path=pg_catalog, app`;
- returns one boolean and derives trainer actor from `app.current_actor_user_id()`;
- reads only exact Assignment/relation/athlete lineage and terminal Session states;
- has no PUBLIC execute privilege;
- grants execute to `ai_strength_app` only;
- is paired with a migrator Session policy limited to the current trainer and terminal states.

R3D PostgreSQL coverage proves original-trainer access after suspension/end, athlete continuation of an already-started Session, foreign-trainer denial, new-relation denial and no inherited Profile/new-work capability (`tests/backend-foundation/client-workout-r3d-postgres.test.ts:169-221`).

| Actor / fact after 0016 | Intended result | Current evidence |
| --- | --- | --- |
| Athlete A: own active Session/logs | Allow | R3D service/RLS tests |
| Athlete A: own terminal Session/Feedback | Allow | R3D and Review tests |
| Original Trainer T: active workflow | Allow under normal relation rules | Existing canonical tests |
| Original T: exact terminal Review after suspend/end | Allow | R3D historical-workflow test |
| Other Trainer T2 | Deny old Session/Review/Feedback | R3D foreign-trainer test |
| New relation for same pair | Does not inherit old relation workflow | R3D identity contract and tests |
| Historical permission -> general Profile/Progress/new Assignment | Deny/not granted by 0016 | Capability assertions and exact helper scope |

**RLS/helper verdict: SOURCE AND LOCAL PASS; EXTERNAL POST-MIGRATION VERIFICATION PENDING.** The helper does not yet exist in the external candidate because `0016` is not applied.

The broad `0012` suspended Profile policies remain a separate security-hardening issue. Applying `0012` will introduce that known policy before `0016`; `0016` does not narrow it. Internal pilot documents classify this as a pre-beta risk, not as authority for Progress or general historical access.

## 9. Backup gate

No verified backup exists in available evidence. This machine also has no `pg_dump`, `pg_restore` or `psql` binary installed. A provider-native restore point or a logical backup must be created by the rollout operator from an environment with compatible PostgreSQL 17 client tools.

Before GO, record all of:

| Required evidence | Current state |
| --- | --- |
| Backup type | Missing |
| Tool/command or provider operation | Missing |
| Storage destination category | Missing |
| UTC timestamp | Missing |
| Restore owner | Missing |
| Restore test / branch-open evidence | Missing |
| Retention/deletion decision | Missing |

**Backup verdict: HOLD.** An empty database does not waive the backup gate because roles, grants, migration ledger and environment provenance are still state.

## 10. Eager Supabase and legacy routes

Canonical core-loop facts are PostgreSQL-backed. R4 browser evidence captured 0 Supabase requests (`docs/core-loop-r4-fix-pass-v1.md:347-366`). Nevertheless, `/client/me` imports and creates the legacy browser client at module evaluation before choosing `CanonicalClientHome` (`app/client/me/page.tsx:27-43,436-449`). `lib/supabase-client.ts:4-15` therefore requires two public values merely to build/boot that route.

Pilot classification: **ACCEPTED PILOT ENVIRONMENT PREREQUISITE**, only under all conditions below:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are non-secret dummy public values accepted by the client constructor;
- the pilot runtime does not inherit the real legacy Supabase URL, anon key or service-role key from local developer configuration;
- `ENABLE_LEGACY_SUPABASE_ONBOARDING`, `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER` and `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_CLIENT_HOME` are false/unset;
- `NEXT_PUBLIC_DEMO_MODE=false`;
- post-deployment network evidence shows no request to the dummy endpoint or `.supabase.co` during the canonical smoke;
- no canonical pilot fact is read from or written to Supabase.

Pilot-visible canonical routes:

- `/trainer/dashboard`;
- `/trainer/clients/{athleteId}`;
- `/trainer/templates`;
- `/trainer/builder/{templateId}`;
- `/trainer/review/{sessionId}`;
- `/client/me`;
- `/client/workouts` and exact Assignment/Session query states.

Deferred/legacy routes include `/history`, `/client/activity`, `/client/progress` and `/client/dashboard`. The pilot runbook does not direct participants there. No route cleanup is part of this gate.

## 11. Risks and blockers

| ID | Severity | Finding | Required disposition |
| --- | --- | --- | --- |
| DG-01 | HOLD | External candidate is not formally designated as pilot environment; no web deployment origin/release identified. | Founder/operator names environment and release. |
| DG-02 | HOLD | Candidate latest migration is `0011`; rollout is five migrations, not isolated `0016`. | Review and apply `0012..0016` in order after approval. |
| DG-03 | HOLD | No verified backup or restore owner/test. | Complete backup gate. |
| DG-04 | HOLD | Dedicated external runtime credentials are unavailable; current owner login has `BYPASSRLS`. | Provision distinct logins and pass `ops:preflight`. |
| DG-05 | BLOCKER | Runtime health schema marker remains `0011` and can false-pass an outdated DB. | Review a separate production fix to target `0016`; do not rely on health alone. |
| DG-06 | VERIFICATION GAP | Standalone upgrade harness has a stale final expectation of migration 15 after unrestricted migrate. | Repair/review harness separately or use reviewed disposable-chain evidence before rollout. |
| DG-07 | HOLD | External post-0016 helper, policies and RLS actor matrix are unverified. | Run catalog/RLS checks after migration, before participants. |
| DG-08 | HOLD | Current local external config fails staging preflight with missing database identities, auth/email settings and demo mode enabled. | Build a dedicated pilot environment configuration; do not reuse `.env.local`. |
| DG-09 | ACCEPTED PILOT RISK | Already-open Client Home may remain stale after trainer assignment. | Use the documented manual reload instruction and record frequency. |
| DG-10 | PRE-BETA SECURITY | Broad suspended Profile policy from `0012` remains. | Do not treat as historical Progress/Profile capability; review before external beta. |

## 12. GO / HOLD / STOP decision

### Current decision: HOLD

The inspected candidate has no provenance or ownership condition requiring STOP. It still fails GO because backup, environment identity, runtime roles, migration level, post-migration RLS verification, application deployment and operator approval are incomplete.

### Required operator actions

1. Name the exact pilot database and HTTPS application origin; confirm whether the inspected Neon database is it.
2. Name rollout operator, restore owner, incident owner and maintenance window.
3. Provision distinct external app/auth/health/worker/migration/operator login URLs; keep owner and migration credentials out of runtime.
4. Review DG-05 and update the expected schema marker in a separate approved code change before deployment.
5. Produce a verified backup/restore point and record timestamp/evidence.
6. Repeat read-only ledger, checksum, provenance and ownership checks immediately before migration.
7. Obtain explicit authorization to apply the full `0012..0016` chain.
8. Apply with the canonical migrator; if HTTPS fallback is needed, run the separate ownership preflight first.
9. Verify ledger, columns, constraint, trigger, helper ACL/search path and RLS policies.
10. Run `ops:preflight` with the final isolated environment configuration.
11. Deploy the exact reviewed release and run the synthetic two-role smoke.
12. Record GO/HOLD/STOP after smoke before creating real participant accounts or Sessions.

STOP immediately if a repeated preflight finds lineage mismatches, unverifiable imported Sessions, ownership drift, unexpected PUBLIC/RLS grants, changed migration checksums or schema objects inconsistent with the ledger. Do not auto-repair.

## 13. Rollback reality

Before any first post-0016 context write, a technical rollback may be considered only with explicit operator approval and a verified restore path. After `overall_comment` or discomfort context is collected, prefer a forward fix. Running `0016.down.sql` drops collected context and requires export plus explicit data-loss approval. A code rollback must not silently send old completion payloads to an active database that requires the new explicit discomfort answer.

## 14. Post-migration smoke summary

Use only synthetic pilot fixtures:

1. Trainer login -> Dashboard -> Athlete Profile -> Quick Assign.
2. Athlete Home sees the exact Assignment.
3. Athlete starts, saves one Set, reloads and resumes.
4. Athlete completes once with explicit discomfort No; repeat a separate Session with Yes and original text if approved for the fixture.
5. Trainer receives one exact Review, sees plan/actual/context and sends Feedback.
6. Athlete sees the same Feedback ID, exact completed Session and history row.
7. Verify role isolation with a second trainer/athlete identity and 0 Supabase browser requests.

The full executable checklist is in `docs/migration-0016-rollout-runbook-v1.md`.

## 15. Scope confirmation

This gate created documentation only. Production code, UI, API, routes, configuration, PostgreSQL schema, migrations and tests were not changed. No external migration, deployment, pilot start, push or product feature work was performed.
