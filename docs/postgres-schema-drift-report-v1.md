# PostgreSQL Schema Drift Report v1

## Comparison boundary

Four layers are compared: unknown legacy remote PostgreSQL (unavailable), 11 local migrations, current code expectations, and the accepted Stage 3 canonical model. PostgreSQL is canonical; clean Supabase staging is the default place for verified additive migrations. A remote mismatch cannot be claimed where evidence is absent.

## Drift summary

| Drift type | Count/evidence | Severity |
|---|---|---|
| Remote vs local | Unknown: endpoint DNS failure and no migration-history access | Critical blocker |
| Code-only database tables | 9 | Critical/high |
| Migration-created tables not used by current Supabase code | 3 | Medium |
| Missing baseline | `profiles` and likely older core tables predate migrations | Critical |
| Definite column/concept mismatch | Duplicate profile anthropometry; exercise `image_url`; builder/program/log shapes | High |
| Canonical-only core entities | Most Stage 3 workflow entities | Expected, blocker before vertical slice |

## Material drift register

| Object/concept | Drift | Evidence | Effect / portability | Severity | Recommendation | Timing |
|---|---|---|---|---|---|---|
| Remote project | Unknown provenance | Configured host unresolved | No source-of-truth or beta-readiness conclusion | Critical | Restore read-only identity/catalog access | Before SQL |
| Migration history | Remote unknown | CLI/link/catalog absent | Cannot label migrations matching/local-only/remote-only | Critical | Recover remote history without repair | Before SQL |
| `profiles` | Code-only baseline; migration only ALTERs it | Two anthropometry migrations | Core FKs cannot build on clean PostgreSQL | Critical | Capture actual schema, then create verified baseline | Before schema |
| `trainer_clients` | Code-only and duplicated by `profiles.trainer_id` | Linking/API/readers | Authorization ambiguity | Critical | Map to canonical TrainerAthleteRelation | Before vertical slice |
| `workout_templates` | Code-only; Program/template overload | 13 code files and Program API | Cannot represent immutable revisions safely | Critical | Isolate legacy Program and add canonical revisions | Before vertical slice |
| `assigned_programs` | Code-only legacy assignment | 8 readers | No independent snapshot or schedule contract | High | Read-only adapter/backfill after inventory | Before vertical slice |
| `client_programs` | Code-only entitlement | Payment/client readers | Assignment/access conflation | High | Keep outside workout assignment model | Before beta |
| `workout_logs` | Code-only flat log | Browser set inserts and history aggregation | Missing Session/Set identity/idempotency | Critical | Preserve source; canonical Session/ExerciseLog/SetLog | Before vertical slice |
| `weight_logs` | Code-only | Check-in/browser writes | Useful facts but schema/RLS unknown | High | Inventory and map to WeightMeasurement | Before progress cutover |
| `payments` | Code-only, browser writes | Admin analytics page | Financial integrity/RLS unknown | Critical | Stop treating browser write as trusted in target architecture | Before beta |
| legacy `exercises` | Code-only fallback | exercise helper | Dual exercise truth | Medium | Inventory, migrate/adapt, then retire | Later/vertical slice |
| `exercise_library.image_url` | Column mismatch | Code selects it; local SQL does not create it | Runtime schema errors and nonportable assumptions | High | Reconcile after remote inventory | Before builder cutover |
| Profile body fields | Duplicated concept | `current_weight_kg` vs `weight` families | Competing facts | High | Map to measurement facts/projection | Before progress migration |
| Builder templates | JSON draft vs canonical revisions | Local table and browser writes | No immutable published model | High | Import as draft; preserve JSON | Before builder cutover |
| Reviews | Date-based mutable row vs session-sourced attention/feedback | Local migration/RPC | Ambiguous migration and lifecycle | Critical | High-confidence migration only; archive ambiguity | Before review slice |
| Messages | Relation-policy mismatch | Local policies | Cross-relation write risk | High | Relation-scoped policy/server command | Before beta |
| Insights/reports | Migration-only vs mock/local UI | Three later migrations/pages | Split source; derived data may become truth | Medium | Defer and treat as projections | Later |
| Status vocabularies | Incompatible | SQL checks, TS types, mocks | Adapter/state-machine complexity | High | Canonical transitions; final SQL enums after recovery | Before schema |
| Canonical identity extensions | Canonical-only | Stage 3 | Required capability model absent locally | High | Additive schema after baseline | Before vertical slice |
| Canonical assignment/session/review chain | Canonical-only | Stage 3 | MVP core cannot use current facts safely | Critical | New additive vertical-slice schema | Before vertical slice |
| Archive fields | Canonical-only | Local tables hard-delete/cascade | Historical loss risk | High | Add archive semantics; separate physical deletion | Before canonical schema |

## Local migration status

All 11 versions are unique and ordered lexically. Remote matching, remote-only and local-only versions are unknown. No duplicate timestamp exists. A missing baseline is definite because migrations ALTER/reference objects they never create. Comments explicitly mention possible SQL Editor execution, which is evidence of a manual-operation workflow, not proof that a remote change occurred.

## Canonical mapping summary

| Canonical entity | Closest current object | Match | Migration complexity / loss risk |
|---|---|---|---|
| UserProfile | `profiles` | Partial/unknown | High until baseline recovered |
| TrainerProfile / AthleteProfile | fields in `profiles` | Poor | Medium-high split/backfill |
| TrainerAthleteRelation | `trainer_clients` + `profiles.trainer_id` | Conflicting | High privacy risk |
| Exercise | `exercise_library` / `exercises` | Partial | Medium |
| WorkoutTemplate revision | builder JSON / program `workout_templates` | Poor | High |
| WorkoutAssignment snapshot | localStorage / `assigned_programs` | Poor | High loss risk |
| WorkoutSession / ExerciseLog / SetLog | flat `workout_logs` | Poor | High/ambiguous grouping |
| AttentionItem / TrainerFeedback | date review + mock queues | Poor | High/ambiguous source |
| BodyMeasurement | profile fields / `weight_logs` | Partial | Medium-high |
| ProgressPhoto | mock/UI only | Missing | New sensitive model |

## Decision candidates for Product Lead review

| Candidate | Recommendation | Timing |
|---|---|---|
| Repair current migration history immediately | Reject until remote baseline is verified | Before any repair |
| Replace legacy tables in place | Prefer additive canonical schema and adapters | Before vertical slice |
| Recover old remote after clean staging | Proposed only for evidenced valuable data/audit need | Later |
| Include ProgressPhoto in first Storage baseline | Keep proposed | Before sensitive media |
| Permit direct browser reads of legacy shapes | Do not; define a narrow canonical allowlist | Before vertical slice |
