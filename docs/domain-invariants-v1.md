# Domain Invariants v1

Status: accepted working enforcement contract for the first vertical MVP. Final database implementation details remain a schema decision.

## Enforcement levels

- **Database**: unique/check/foreign-key/transactional constraint or equivalent durable rule.
- **API/service**: authorization, orchestration, idempotency and audit behavior.
- **UI**: interaction prevention and clear state; never the only integrity boundary.
- **Combined**: more than one layer is necessary.

## Required invariants

| ID | Invariant | Rationale | Entities | Enforcement | Failure consequence | Test requirement |
|---|---|---|---|---|---|---|
| INV-01 | A `WorkoutAssignment` contains a complete snapshot of the assigned `WorkoutTemplate` revision | Execution must not depend on later template state | Template, Assignment and children | Combined | Athlete receives incomplete or mutable work | Contract test verifies snapshot completeness at assignment creation |
| INV-02 | Editing a template never changes an existing assignment | Accepted Stage 2 rule | Template, Assignment | Database + service | Historical and scheduled work changes silently | Integration test edits template and compares assignment snapshot/hash |
| INV-03 | After session start, assignment structure cannot change in the ordinary flow | Keeps logs bound to stable exercise/set identities | Assignment, Session, logs | Combined | Orphan/misaligned logs | Authorization and persistence tests reject structural update after start |
| INV-04 | An assignment has at most one active/resumable session | Resume must reopen the same attempt | Assignment, Session | Database | Duplicate attempts and review items | Concurrent start test proves one session wins |
| INV-05 | Reopening execution resumes the active session | Prevents accidental reset | Session | API/service + UI | Lost entered sets | End-to-end resume test preserves progress and session id |
| INV-06 | Session completion is idempotent | Mobile retries and repeated events are expected | Session | Combined | Duplicate completion, queue, notification or projections | Repeat same idempotency key and concurrent completion tests |
| INV-07 | A completed session has at most one review `AttentionItem`; missed/abandoned sessions do not create workout-review items | Accepted review lifecycle | Session, AttentionItem | Combined | Duplicate or invalid work queue | Unique-source and lifecycle integration tests |
| INV-08 | Feedback references one concrete session and its `TrainerAthleteRelation` | Feedback must have factual source and authorization scope | Feedback, Session, Relation | Database + service | Date/name joins and cross-client disclosure | FK/authorization tests including ended relation policy |
| INV-09 | Feedback resolves an AttentionItem only after successful durable feedback save | Accepted Stage 2 rule | Feedback, AttentionItem | Database transaction/service | Queue disappears without athlete receiving feedback | Transaction rollback and retry tests |
| INV-10 | Manual resolution requires a non-empty reason | Accepted Stage 2 rule | AttentionItem, ManualResolution | Combined | Unexplained loss from queue | Validation and persistence tests |
| INV-11 | Client and trainer read the same `WorkoutSession`, `ExerciseLog` and `SetLog` facts | Prevents UI-specific truth | Session and logs | API/read-model layer | Contradictory history/progress/review | Shared fixture read-model tests for both roles |
| INV-12 | Derived progress is rebuildable and never a competing source of truth | Volume/PR/consistency can change with algorithms | Facts, ProgressProjection | Service + data architecture | Irreconcilable metric values | Rebuild test compares projection with source facts |
| INV-13 | A discomfort signal preserves the athlete's original wording and explicit input | Safety and audit principle | DiscomfortSignal, comment/log | Database + service | Medical inference or source loss | Round-trip and no-rewrite tests |
| INV-14 | AI output cannot replace, delete, or silently mutate factual session data | AI is optional layer | All facts, optional AI output | Service + permission | Non-deterministic corruption | Permission tests and AI-disabled workflow test |
| INV-15 | A trainer cannot read athlete-private data without the required active `TrainerAthleteRelation`, except explicit historical-access policy | Core privacy boundary | Relation and athlete entities | Database/RLS + service | Cross-client data breach | Negative RLS tests with unrelated trainer |
| INV-16 | An athlete cannot edit a template, assignment prescription, or trainer feedback | Separates authoring, execution and review ownership | Template, Assignment, Feedback | Database/RLS + UI | Prescription or feedback tampering | Negative RLS/command tests |
| INV-17 | A trainer cannot silently overwrite completed athlete logs | Factual execution belongs to athlete record | Session and logs | Database + service | Audit loss and trust failure | Update rejection plus explicit correction audit test |
| INV-18 | Retried webhook/API/event processing does not create duplicate domain records | External and client retries are normal | Session, AttentionItem, Feedback, Notification | Combined | Duplicate queues/messages/charges | Idempotency and concurrency tests per command |
| INV-19 | Archiving/deleting a template does not delete historical assignments | Snapshot history is independent | Template, Assignment | Database | Workout history destroyed | Referential deletion/archive test |
| INV-20 | Ending/deleting a relation does not destroy historical workout records | Legal/audit/product history must survive access revocation | Relation, Assignment, Session, Feedback | Database + policy | Data loss or uncontrolled continued access | End-relation test: future access denied, retained records intact |

## Additional consistency invariants

| ID | Invariant | Rationale | Entities | Enforcement | Failure consequence | Test requirement |
|---|---|---|---|---|---|---|
| INV-21 | Assignment, session, logs, attention and feedback carry compatible athlete/trainer relation scope | Blocks cross-relation references | Core chain | Database + service | Cross-athlete data contamination | Attempt mixed-relation inserts/commands |
| INV-22 | Set identity is stable within an assignment snapshot and session | Enables resumable upserts and special sets | Prescription, SetLog | Database + service | Duplicate or overwritten sets | Save same set twice and reorder-template tests |
| INV-23 | Queue ordering is deterministic: explicit discomfort first, remaining items by oldest completion | Accepted Stage 2 behavior | AttentionItem, Session, DiscomfortSignal | Read model | Unstable trainer workflow | Ordering fixture test |
| INV-24 | Merely opening the queue item, drawer or page does not change its lifecycle state | Accepted Stage 2 behavior | AttentionItem | API + UI | False progress reporting | UI integration test observes no mutation on open |
| INV-25 | Sent feedback corrections are new follow-up records | Accepted Stage 2 behavior | TrainerFeedback | Service + database | Silent historical rewrite | Update denied; follow-up chain retained |
| INV-26 | Read receipt does not resolve or reopen an AttentionItem | Accepted Stage 2 behavior | Feedback/read receipt, AttentionItem | Service | Queue state coupled to athlete viewing | Receipt command state-isolation test |
| INV-27 | Assignment creation is only allowed from a saved template revision | Accepted Stage 2 behavior | Template, Assignment | Service + UI | Untraceable snapshot source | Unsaved-draft assignment rejection test |
| INV-28 | Demo/mock identifiers never enter production foreign keys through automatic migration | Demo IDs are non-UUID and non-authoritative | All persisted entities | Migration/service | Broken ownership and accidental fake users | Import validator and migration dry-run tests |
| INV-29 | Public trainer projections contain no athlete-private fields | Public route must not inherit profile table breadth | TrainerProfile, public projection | API/database + test | Privacy breach | Anonymous response schema test |
| INV-30 | Ordinary client/trainer UI never uses service-role credentials or unverified service commands | Service role bypasses RLS | All entities | Deployment + API/service | Full database compromise | Static secret scan and unauthenticated API tests |
| INV-31 | One auth user has one UserProfile and may hold both TrainerProfile and AthleteProfile capabilities | Capabilities are not mutually exclusive string roles | Identity entities | Database + service | Duplicate identity or incorrect authorization | Capability/uniqueness and dual-capability routing tests |
| INV-32 | An athlete has at most one active primary trainer in first MVP; ended relations remain historical | Establishes canonical relation cardinality without erasing history | TrainerAthleteRelation | Database + service | Ambiguous authorization or history loss | Concurrent activation and relation-end tests |
| INV-33 | Published template revisions are immutable; substantial edit creates a new revision | Assignment provenance must remain reproducible | Template revisions | Database + service | Historical snapshot source changes | Publish/edit/archive tests |
| INV-34 | Partial completion preserves skipped exercises and incomplete sets; zero-result completion requires explicit confirmation and does not invent results | Completion reflects reality rather than form compliance | Session, ExerciseLog, SetLog | Service + UI + database facts | False progress facts | Partial, skipped and zero-result completion tests |
| INV-35 | An MVP superset contains 2-4 explicitly ordered exercises, has no nesting, and an exercise belongs to at most one group | Keeps authoring/execution deterministic | SupersetGroup, template/assignment exercises | Combined | Ambiguous execution order | Group validation, ungroup and reorder tests |
| INV-36 | Timestamps are persisted as UTC; schedule dates use athlete IANA time zone; normalized weight/length facts use kg/cm | Cross-role and cross-zone facts must agree | UserProfile, Assignment, Session, Measurements | Combined | Wrong workout day or inconsistent progress | DST/time-zone and unit round-trip tests |
| INV-37 | Ordinary archive/deletion never cascades away historical assignments, sessions, feedback or attention records | Audit and shared history must survive root lifecycle | Core chain | Database + service | Irrecoverable data loss | Archive and privacy-procedure separation tests |

## Current violations or unenforced areas

- `trainer_workout_reviews` is unique by trainer/client/date, not session. **Migration evidence:** `supabase/migrations/20260403120000_trainer_workout_reviews.sql`; conflicts with INV-07/08.
- Current localStorage assignment embeds workout data but is neither durable nor restricted to a saved template. **Code write evidence:** trainer builder components; conflicts with INV-01/27.
- Client completion writes flat `workout_logs` and not a durable session completion. **Code write evidence:** `app/(client)/client/[id]/page.tsx`; conflicts with INV-04/06/11/22.
- Current authorization alternates between `profiles.trainer_id` and `trainer_clients`; `/trainer/*` and `/client/*` are not covered by `proxy.ts`. **Code evidence:** conflicts with INV-15/30.
- Several service-role API routes do not demonstrate authenticated actor checks, especially `app/api/ensure-profile/route.ts` and `app/api/send-reminder/route.ts`. **Code evidence:** conflicts with INV-15/30.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Preserve historical records after relation end while revoking normal live access | Delete all history; retain unlimited trainer access | Retain facts, define narrow historical access policy | INV-20 requires data retention and privacy | Current FK cascades and relation duplication | Relation and core chain | Profile FKs in migrations | Before schema |
