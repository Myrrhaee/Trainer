# Data Migration Plan v1

Status: accepted rollout strategy; execution remains blocked on Stage 4 remote schema/source-of-truth recovery. No SQL, backfill or production access was performed.

## Migration principles

1. Preserve original records and provenance before transforming them.
2. Never infer production identity from display name, demo slug or mock id.
3. Prefer additive canonical schema and a vertical cutover over in-place mutation.
4. Keep dual-write short or avoid it; dual-read adapters are safer during verification.
5. Every backfill is restartable, idempotent, counted and produces an exception report.
6. Accepted workflow rules define the target; conflicting code remains legacy input.

## Phase 0 - inventory and safety

- Stage 4 first recovers every actual environment identity and exports actual tables, columns, constraints, indexes, RLS policies, triggers/functions, row counts and migration history. Repository migrations are not a proven complete source of truth for core tables.
- Capture backups and tested restore instructions before any write. Record backup owner, encryption, retention and restore RTO.
- Record row counts, min/max timestamps, null/duplicate rates and foreign-key orphans for every source table.
- Separate local/dev/staging/production projects and verify project URLs without exposing keys in documents/logs.
- Tag demo/test data using explicit evidence. `demo-*`, slug IDs and localStorage are not automatically production data.
- Assign one migration owner and one Product Lead sign-off owner. Require dry run and reconciliation report.
- Define rollback per phase: additive objects can be abandoned; cutover rolls readers/writers back while canonical writes are retained for replay.
- Confirm UTC timestamp semantics, UserProfile IANA time zones, athlete-time-zone calendar interpretation, normalized kg/cm values and preservation rules for original entered value/unit.

Exit gate: deployed schema and data inventory reconciles with repository evidence, or every unknown is explicitly accepted.

## Phase 1 - canonical schema addition

Add conceptual stores for:

- one UserProfile per auth user with optional non-exclusive TrainerProfile/AthleteProfile capabilities and canonical `TrainerAthleteRelation` (many historical relations, at most one active primary trainer for an athlete in MVP);
- mutable WorkoutTemplate draft revisions, immutable published revisions and ordered exercise/prescription/group children;
- normalized WorkoutAssignment snapshot children, source-revision reference, optional hash/version and optional non-authoritative diagnostic JSON;
- WorkoutSession, ExerciseLog, SetLog, comments and discomfort signals;
- AttentionItem, append-only TrainerFeedback and ManualResolution;
- measurement facts and rebuildable progress projection only if included in beta scope.

Add archive/audit/idempotency mechanisms and relation-scoped policy contracts. Ordinary flow must not cascade-delete historical templates, relations, assignments, sessions, feedback or attention items. Keep existing tables untouched. Exact table/column/SQL design follows Stage 4 recovery; no broad final enum is implied by conceptual states.

Exit gate: invariants and permission tests pass against an empty canonical schema.

## Phase 2 - compatibility adapters

- Read legacy programs/assignments/history through explicit adapters that label provenance and confidence.
- Convert `trainer_builder_templates` JSON to/from `WorkoutTemplateEditor` only while draft migration is incomplete.
- Keep legacy client history visible through a legacy read model; new execution uses canonical contracts.
- Isolate demo adapters by environment/session. They cannot call canonical production mutation commands with demo IDs.
- Do not make new canonical assignment visible through old localStorage as a second source of truth.

Exit gate: old UI continues to read its sources while the new vertical slice can execute entirely on canonical data.

## Phase 3 - backfill maps

| Legacy source -> target | Mapping and transformation | Confidence / loss risk | Review, preservation and blockers |
|---|---|---|---|
| `profiles` + `trainer_clients` -> profiles/extensions + Relation | Match only by auth UUID; reconcile capabilities and compare both trainer links; enforce at most one active primary relation while retaining history | Medium / high privacy risk | Preserve source snapshots. Manual review conflicts. Blocked by live schemas and inconsistent source links |
| `workout_templates` program rows -> legacy Program archive/adapter | Preserve program JSON/product fields; do not coerce multi-week plan to one WorkoutTemplate automatically | High for archive, low for workout conversion / high semantic loss | Manual product mapping if individual days are later imported. Blocked by program strategy |
| `assigned_programs` -> WorkoutAssignment | Map athlete/template/status only when schedule, workout content and source day can be identified; create snapshot from preserved source version | Low-medium / high | Preserve original. Manual review for missing snapshot/date and duplicate active rows. Blocked by live schema and status mapping |
| `client_programs` -> AccessStatus/Subscription adapter | Treat as purchase/access, not workout assignment; map provider/status only with webhook/payment provenance | Medium / medium | Preserve original. Blocked by commercial model, outside vertical core |
| `trainer_builder_templates` -> WorkoutTemplate drafts | Parse current version 2 `{folder, exercises, blocks}` and known older array shape; map core sets/repetitions plus optional basic fields; validate 2-4 member non-nested groups; retain raw JSON/hash | Medium / medium | Exception queue for malformed/unknown exercise IDs or advanced unsupported fields. Blocked by live schema/source exercise mapping |
| Builder localStorage templates -> explicit draft import | User-initiated export/import only for authenticated trainer; dedupe by source id/content hash | Low-medium / medium | Preserve browser export. Never silently scan/migrate production users |
| Builder localStorage assignments -> demo-only or exceptional reviewed import | Default is no migration because localStorage is prototype/demo and non-authoritative; only migrate if real data requiring preservation is discovered and mapped to real relation/template | Low / high | Manual review mandatory; preserve JSON. Blocked by non-UUID clients and unsaved-template provenance |
| `workout_logs` -> Session/ExerciseLog/SetLog | Group only using reliable assignment/session identifier if live schema has one; otherwise date/time heuristics produce candidates, not authoritative sessions; map performed/skipped/incomplete facts without inventing results | Low / high | Preserve every row and confidence. Manual review ambiguous groups/orphans. Blocked by live columns and stable set/session identity |
| `trainer_workout_reviews` -> Feedback or legacy review archive | Deterministic/high-confidence match by trainer/client/date to exactly one real completed session; map only when unambiguous and preserve original reference/record | Low / high | Ambiguous/multiple/no-session rows stay legacy archive. Never fabricate WorkoutSession. Blocked by session backfill |
| `weight_logs` -> WeightMeasurement | Map client, value, timestamp/unit after schema validation; dedupe exact source id, not same-day value alone | Medium-high / medium | Preserve row. Blocked by unit/null/schema confirmation |
| profile weight fields -> current-value legacy projection | Use only as latest snapshot candidate; do not invent historical measurement time | Low / medium | Preserve both field families; manual conflict policy needed |
| Body/progress mocks -> none | Do not migrate mock charts/photos/measurements as facts | High / none because skipped | Retain source code until UI cutover; no data backfill |
| Demo IDs -> isolated demo identities | Never match by name. Optionally seed deterministic demo-only UUIDs in non-production | High / identity risk avoided | Production import prohibited without explicit human mapping |

Backfill validation for every map: source count, migrated count, skipped count by reason, duplicate count, orphan count, checksum/sample comparison and reversible source-reference map.

## Phase 4 - dual-read or dual-write

Accepted approach:

- Use **dual-read comparison** for templates/history/progress where legacy display must coexist. Log mismatches without changing user facts.
- Avoid dual-write for sessions, logs, AttentionItems and feedback. Route one controlled athlete/trainer cohort entirely through the canonical vertical slice.
- If a brief dual-write is unavoidable for notifications or reporting, canonical write is primary, legacy write is an idempotent downstream adapter, and failure must not roll back canonical completion.
- Set a removal date and owner before enabling any dual path.

Exit gate: canonical cohort completes and reviews workouts without reading legacy facts for the core chain; reconciliation is acceptable.

## Phase 5 - canonical cutover

1. Switch template builder commands/read models for the selected cohort.
2. Switch assignment writer and client current-assignment reader.
3. Switch execution/session/log writer and both history readers.
4. Switch completion to durable AttentionItem creation and trainer queue.
5. Switch feedback and client feedback reader.
6. Monitor command error rate, idempotency conflicts, orphan sources, completion-to-queue latency, queue-to-feedback time and cross-role factual equality.
7. Roll back readers/routing if authorization failure, fact loss, duplicate sessions/items, or unexplained reconciliation drift crosses agreed threshold.

## Phase 6 - legacy deprecation

- Mark adapters and routes with owner, final read date and replacement.
- Export/archive original rows and migration reconciliation artifacts.
- Remove code references and localStorage fallbacks only after telemetry and repository search confirm zero production dependency.
- Remove tables/columns only through a separately reviewed migration after retention/legal approval and tested restore.
- Update route, data-source, current-state and decision documents after actual cutover.

## Migration blockers

1. Stage 4 has not recovered remote actual tables, columns, constraints, indexes, RLS, triggers/functions, row counts, migration history and environment identity.
2. Session/set identity is absent from confirmed current log writes.
3. Date reviews cannot always map to a unique real session.
4. Final SQL lifecycle enums and historical trainer-access policy are undecided.
5. Program-table status/data mapping still requires separate inventory despite accepted Program isolation.
6. Existing unauthenticated service-role paths must not be reused as migration interfaces.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Preserve trainer access to historical shared records in canonical RLS | Revoke after end; permanent access | Keep unresolved until privacy/legal review; migration retains data either way | Retention does not itself determine access | Historical relation decision remains proposed | Relation, Session, Feedback | Future RLS/backfill | Before schema |
| Migrate ProgressPhoto prototype data | Skip mock data; import reviewed real media | Skip by default and defer schema scope | Current data is not proven factual and is highly sensitive | Progress implementation is mock/prototype | ProgressPhoto | Progress UI/local assets | Before beta |
