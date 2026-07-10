# Supabase Gap Analysis v1

Status: evidence-based comparison only. No live database was queried, and absence of a migration means **repository schema evidence is missing**, not that the table definitely does not exist in every deployed environment.

## Reproducibility finding

The repository contains 11 migration files. None creates `profiles`, `trainer_clients`, `workout_templates`, `assigned_programs`, `client_programs`, `workout_logs`, `weight_logs`, `payments`, legacy `exercises`, or `logos`, although application code reads or writes those names. Consequently the deployed schema, constraints, indexes and RLS for those structures are **unknown and not reproducible from this repository**.

> **BLOCKER - source of truth:** Repository migrations are not a proven complete source of truth because core tables are referenced by code but their creation migrations are absent.

Before canonical SQL migrations, Stage 4 must recover the remote schema/source of truth for every environment: actual tables, columns, constraints, indexes, RLS policies, triggers/functions, row counts, migration history and environment identity. No canonical migration may assume that the local migration directory fully describes deployed Supabase.

## Migration-evidenced structures

| Current structure | Migration evidence | Current purpose, readers and writers | Identifiers / canonical mapping | Assessment and migration risk | RLS / recommendation |
|---|---|---|---|---|---|
| `profiles` additions | `20250316120000_client_anthropometry.sql`; `20250317100000_client_weight_height_target.sql` | Broad identity/profile read across auth, client, trainer and public pages. APIs `ensure-profile`, `link-trainer`, payment webhook and profile UI write it | Appears keyed by auth user UUID; maps imperfectly to UserProfile + TrainerProfile + AthleteProfile | **Conflicting, high risk.** Base CREATE absent. Competing fields `current_weight_kg/height_cm/target_weight_kg` and `weight/height/target_weight`; also role, trainer relation, subscription and public fields in code | RLS unknown from repo. Split canonical responsibilities additively; do not migrate based only on TypeScript assumptions |
| `exercise_library` | `20260402120000_exercise_library.sql`; extended/seeded by `20260402143000_seed_system_exercise_library.sql` | `lib/exercise-library.ts` reads/writes system and trainer-owned exercises; builder consumes it | UUID; maps to Exercise; categories/media partly inline | **Reusable after migration, medium risk.** Good owner/system distinction. Code selects `image_url`, but creation migration shown here does not add that column; deployed drift possible | RLS covers system visibility and owner CRUD. Preserve and evolve; reconcile column drift, category vocabulary and archive semantics |
| `trainer_workout_reviews` | `20260403120000_trainer_workout_reviews.sql` | Client history/progress reads reviewed comment; trainer profile/dashboard code reads review state; trainer writes status/comment; mark-seen RPC writes receipt | UUID row, unique trainer/client/`workout_date`; approximates AttentionItem + TrainerFeedback + receipt | **Legacy/conflicting, high loss risk.** No session source, one row per date, mutable comment, two-state lifecycle | Policies use `profiles.trainer_id` and allow client only reviewed. Archive/backfill with cautious date matching; do not make canonical |
| `trainer_builder_templates` | `20260404120000_trainer_builder_templates.sql` | Builder saves/loads versioned JSON payload in `exercises`; localStorage fallback also used | UUID, trainer id; maps to template draft and children | **Reusable after migration, medium risk.** JSON contains version 2 folder/exercises/blocks, while table fields also carry title/type/note | Owner-only RLS is directionally sound. Parse/validate into canonical draft, preserve original JSON |
| `trainer_settings` | `20260405120000_trainer_settings.sql` | Settings page reads/writes JSON sections with local fallback | trainer UUID PK; adjacent, no core entity | **Reusable as-is for adjacent feature, low core risk** | Owner-only RLS. Keep outside vertical slice |
| `trainer_client_messages` | `20260406120000_trainer_client_messages.sql` | Message thread reads/writes Supabase with local fallback | UUID, trainer/client ids; maps to Message | **Reusable after security migration, medium risk.** Sender role and ids are caller-controlled within weak checks | RLS checks `auth.uid()` against supplied trainer/client id but not active relation. Require relation check and authenticated sender derivation |
| `trainer_automation_rules` | `20260407120000_trainer_automation_rules.sql` | Migration exists; current automation page uses localStorage rather than Supabase | UUID, trainer id; adjacent automation concept | **Unknown/experimental, low core risk**; deployed table and UI truth may diverge | Owner RLS. Defer until after core; do not migrate local rules automatically |
| `trainer_client_insights` | `20260408120000_trainer_client_insights.sql` | Stores score/segment/driver/recommendation/metrics; current insights UI has no confirmed Supabase read | UUID, trainer/client; optional derived insight, not factual progress | **Conflicting source-risk, medium.** May turn derived/AI data into independent truth | Trainer-only RLS. Treat as rebuildable projection with relation checks, never source facts |
| `trainer_client_reports` | `20260409120000_trainer_client_reports.sql` | Migration supports draft/ready/sent; current reports page persists localStorage | UUID, trainer/client; adjacent report | **Reusable after migration, medium.** Two sources currently | Trainer/client RLS by ids/status but relation validation needs review. Defer and choose one source later |

## Code-referenced structures without creation migrations

| Current structure | Migration evidence | Current readers/writers and identifiers | Canonical relation | Assessment / risk / recommendation |
|---|---|---|---|---|
| `trainer_clients` | None found | Legacy client pages/dashboard and `link-trainer` read/write trainer/client UUID pair | TrainerAthleteRelation | **Unknown, blocker.** Reconcile with `profiles.trainer_id`; backfill one canonical relation table with conflict report |
| `workout_templates` | None found | `/api/trainer/programs` and client/program pages read/write multi-week `plan_json`, weeks, price and metadata | Conflicts with WorkoutTemplate; also represents Program/product | **Legacy/conflicting, blocker.** Do not force program row into single-workout target. Keep adapter/read-only during slice |
| `assigned_programs` | None found | Client profile/dashboard reads status and template; program assignment code assumptions | Possible legacy source for WorkoutAssignment | **Unknown, blocker for backfill.** Missing schedule/snapshot/session semantics. Inventory live columns/rows before mapping |
| `client_programs` | None found | Payment webhook upserts access; client routes read purchased programs | Subscription/AccessStatus, not WorkoutAssignment | **Legacy/adjacent, high.** Do not conflate purchase access with coaching assignment |
| `workout_logs` | None found | Client execution inserts one row per completed set; history/progress/trainer list aggregate by created date | Partial SetLog facts, missing Session/ExerciseLog identity | **Conflicting, blocker.** Preserve rows; infer sessions only with confidence flags/manual review |
| `weight_logs` | None found | Client check-in inserts `client_id, weight`; progress reads history | WeightMeasurement | **Potentially reusable, high until schema known.** Profile weight is duplicated current snapshot; backfill facts before deriving current |
| `exercises` | None found | `lib/exercise-library.ts` reads/writes only as schema-mismatch fallback | Legacy Exercise | **Legacy, medium.** Preserve adapter until all environments verify `exercise_library`; map owner/title/media |
| `payments` | None found | Payment and subscription pages/API assumptions | Subscription/provider events | **Outside core, unknown.** Security and provider reconciliation required before beta |
| `logos` | None found | Branding/profile code references | Media/branding, outside core | **Unknown/low core.** Inventory later |

## Code and state representations outside Supabase

| Structure | Evidence | Mapping and risk | Recommendation |
|---|---|---|---|
| Builder draft localStorage `trainer-builder-draft:${userId}` | Builder components | TemplateDraft; browser/device-local and schema-versioned informally | Demo/temporary fallback only; explicit import if ever migrated |
| Builder templates localStorage `trainer-builder-templates:${userId}` | Builder components | WorkoutTemplate drafts; may duplicate Supabase rows | Deduplicate by explicit source/id/hash; preserve original export |
| Builder assignments localStorage `trainer-builder-assignments:${userId}` | Builder components | Full assignment-like snapshot, but no athlete-visible shared source | Do not treat as production assignment; demo-only unless explicit authenticated migration review |
| `trainer-message-threads-v1` | Message components | Message fallback that can diverge from Supabase | Disable only after canonical message verification; no automatic blind merge |
| Automation/report/settings local keys | Corresponding trainer pages | Duplicate source paths | Keep outside vertical; inventory and choose source independently |
| Demo client/program/exercise IDs | `lib/demo-data.ts`, `lib/demo-mode.ts` | Slugs and `demo-*` IDs cannot be trusted as UUID/FK identity | Never auto-map to production; maintain isolated demo namespace |
| Trainer dashboard/home/profile mocks | `components/trainer-os/**/mock-data.ts` | Competing Athlete, queue, progress and status shapes | Replace read models incrementally; never backfill as user data |

## Known gaps, severity and timing

| Gap | Evidence and impact | Severity | Timing | Recommendation |
|---|---|---|---|---|
| Two unrelated trainer attention queues | `/trainer/attention` uses inline local statuses; trainer dashboard/home use separate mock items | Blocker | Before vertical slice | One persisted AttentionItem and shared read model |
| Date-based reviews | Migration unique key and RPC use `workout_date`, not session | Blocker | Before schema | Session-sourced AttentionItem/Feedback; archive/backfill ambiguous rows |
| LocalStorage-only assignment | Builder stores full assignments only in browser | Blocker | Before vertical slice | Canonical server command creates atomic snapshot |
| Program-coupled current builder/API | `/api/trainer/programs` writes `workout_templates.plan_json` as multi-week program | High | Before vertical slice | Separate workout template slice; compatibility adapter for Program |
| Mock client identifiers | Demo uses slugs/`demo-*`; trainer mocks use independent string IDs | High | Before vertical slice | UUID-only production boundary and isolated demo adapter |
| Separate client/trainer progress structures | Client derives from logs; trainer profile is mock with different charts/types | High | Before beta | Shared factual entities and role-specific read models |
| Incompatible status vocabularies | `pending/in_progress/completed/missed`, assignment statuses, review `needs_review/reviewed`, attention `open/in-progress/snoozed/done`, dashboard presentation statuses | Blocker | Before schema | Canonical state machines plus mapping table; presentation status derived |
| Review lacks source entity | Review links trainer/client/date only | Blocker | Before schema | Unique source session id |
| Duplicated client/profile concepts | `profiles.trainer_id`, `trainer_clients`, mock AthleteProfile, nested client objects | High | Before schema | User/Athlete extensions plus canonical relation |
| Auth role and route guard gaps | `AuthGuard` checks authentication only; `proxy.ts` covers `/dashboard/*` but not `/trainer/*` or `/client/*` | Blocker | Before beta; service commands before vertical | RLS first, authenticated commands, role/relation checks, route defense in depth |
| Unauthenticated service-role mutation risk | `ensure-profile` accepts arbitrary user id; `send-reminder` accepts arbitrary client id with service backend | Blocker | Before vertical slice for reused APIs | Verify JWT and actor authorization; never trust body identity |
| Missing migration provenance for core tables | Code references core tables absent from migration history | Blocker | Before schema | Export live schemas/migration history per environment before design finalization |
| Remote schema/source-of-truth not recovered | Actual tables, columns, constraints, indexes, policies, triggers/functions, row counts, history and environment identity are unverified | Blocker | Stage 4 before canonical SQL | Perform read-only remote inventory and reconcile each environment with repository migrations |
| Duplicate anthropometry columns | Two ALTER migrations and code use different names | Medium | Before beta | Backfill facts, pick one projection, deprecate duplicates after verification |
| `exercise_library.image_url` drift | Code selects field not established by inspected creation migration | High | Before vertical slice if builder requires images | Compare live schema and generated types; additive reconciliation |
| Weak message relationship policies | Current RLS validates actor id but not active relationship | High | Before beta | Relation-scoped policy contract |
| Cascade deletion from profile FKs | Several migrations use `ON DELETE CASCADE` | High | Before schema | Historical roots reference stable profiles/relations with archive/restrict policy |
| Automation/insights/reports split sources | Tables exist but pages are local/mock | Low | Later | Freeze scope; migrate after core facts |

## Current writers that require special caution

- `app/api/ensure-profile/route.ts`: service-role upsert from body identity without demonstrated bearer verification. Critical authorization gap.
- `app/api/link-trainer/route.ts`: verifies bearer user and trainer role, but duplicates relation state across `profiles` and `trainer_clients`.
- `app/api/trainer/programs/route.ts`: verifies trainer role but writes program semantics into `workout_templates`.
- `app/api/notify-complete/route.ts`: sends a Telegram signal and does not establish canonical completion/AttentionItem facts.
- `app/api/send-reminder/route.ts`: service-role read/update by client id without demonstrated actor authorization.
- Payment webhook: writes `client_programs`/profile subscription state; table migration and provider/event idempotency evidence are incomplete.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Include progress photos in Stage 4 canonical schema | Defer schema; add private media immediately | Defer until vertical-slice scope and privacy requirements are accepted | Current evidence is mock/prototype and media is highly sensitive | Progress UI audit | ProgressPhoto | Client/trainer progress mocks | Before beta |
| Preserve trainer access to historical shared records after relation end | Revoke trainer access; permanent retained access | Keep proposed pending privacy/legal review | Storage retention and trainer authorization are different decisions | Relation/history gaps | Relation, sessions, feedback | Future RLS and current profile links | Before schema |
