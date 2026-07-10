# Domain Open Decisions

Status: unresolved questions after Stage 3 Product Lead finalization. Accepted working decisions are listed first for traceability and recorded in `docs/decision-log.md`.

## Resolved working decisions

| Area | Accepted working decision | Remaining implementation freedom |
|---|---|---|
| Identity | One auth user has one UserProfile and optional, non-exclusive TrainerProfile/AthleteProfile capabilities | Physical table layout and capability provisioning workflow |
| Relation | TrainerAthleteRelation is canonical; trainer has many relations; athlete has historical relations and at most one active primary trainer in MVP | Final SQL state names and invitation UI |
| Prescription scope | Core sets plus repetitions/range; optional target weight, rest, trainer note and duration | Exact API/SQL representation |
| Set model | MVP set kinds are warmup and working; advanced techniques use notes/optional overrides | Broad future taxonomy |
| Completion | Explicit client action; partial completion allowed; skipped/incomplete facts preserved; zero results require confirmation/reason prompt | Final persisted status enum and copy |
| Supersets | 2-4 explicitly ordered exercises, no nesting, at most one group per exercise; ungroup preserves exercises | Exact builder interaction details |
| Progress | Completed history/count/consistency; selected-exercise weight/reps/best set; bodyweight trend only with facts; no composite score | Metric definitions/versioning and chart presentation |
| Time and units | UTC timestamps, UserProfile IANA time zone, athlete-time-zone calendar, normalized kg/cm with optional original value/unit | Storage precision and presentation preference model |
| Templates/assignments | Mutable draft, immutable published revisions, normalized independent assignment snapshot | Final table/column names and diagnostic JSON format |
| Session/review | Session/ExerciseLog/SetLog facts, durable AttentionItem, append-only sent feedback | Transaction/RPC implementation and final SQL enums |

## Requires founder or privacy/legal decision

| ID | Question | Why it matters; affected entities/UX/migrations | Recommendation | Alternatives | Evidence needed | Urgency |
|---|---|---|---|---|---|---|
| OPEN-01 | May a trainer read historical shared records after TrainerAthleteRelation becomes ended? | Defines post-relationship RLS for Relation, Session, Feedback and history UI; retention itself is accepted | Retain records; default no trainer UI access until privacy/legal review approves a narrow historical scope | Permanent historical access; time-limited access; athlete-controlled access | Privacy/legal review and coaching contract expectations | Before schema |
| OPEN-02 | Is ProgressPhoto included in the first vertical slice? | Adds sensitive storage, consent, permissions, deletion and progress UX | Defer from first slice unless beta evidence makes it essential | Include trainer-visible with consent; athlete-only; include later | Founder scope plus athlete/trainer research and privacy review | Before beta |
| OPEN-03 | What exact retention/privacy periods apply per entity? | Controls archive duration and separate physical deletion procedure | Retain during beta with restricted access and a dated policy review; do not cascade-delete | Fixed global period; entity-specific periods; user-triggered purge | Privacy/legal guidance and market geography | Before beta |

## Requires trainer research

| ID | Question | Why it matters; affected entities/UX/migrations | Recommendation | Alternatives | Evidence needed | Urgency |
|---|---|---|---|---|---|---|
| OPEN-04 | What is the trainer's primary device? | Determines builder/review density and navigation UX, not canonical facts | Keep desktop/tablet-first full builder as proposed working hypothesis | Mobile-first; full cross-device parity | Interviews/analytics from beta trainers | Before final UX implementation |
| OPEN-05 | What weekly review volume must the queue support? | Determines pagination, filters, notification frequency and performance targets | Test at 50 reviews/week/trainer until measured | 10, 100 or 300+ | Target roster size and observed completion cadence | Before beta |
| OPEN-06 | Is a complete mobile builder required for MVP? | Materially expands responsive authoring scope | Support mobile core editing only until research proves full authoring need | Full mobile parity; read/assign only; desktop-only | Task-based mobile builder tests | Before final UX implementation |

## Requires technical/product follow-up

| ID | Question | Why it matters; affected entities/UX/migrations | Recommendation | Alternatives | Evidence needed | Urgency |
|---|---|---|---|---|---|---|
| OPEN-07 | Which external beta notification channel is required? | Selects Notification adapter but must not affect durable completion/review | In-app source of truth; use Telegram only if beta trainers require it | Email, push, WhatsApp, no external channel | Beta preference and delivery reliability | Before beta |
| OPEN-08 | Which advanced prescription types are added after MVP? | Extends Prescription, builder and SetLog beyond sets/reps and optional basic fields | Add only from validated use cases; candidates include distance, pace, calories, intervals, percentage loading and formulas | Generic metric model now; separate sport-specific models | Real workout corpus and trainer research | Later |
| OPEN-09 | Which advanced special set types become explicit? | Affects set taxonomy, progress inclusion and UI | Keep warmup/working plus note/override until a technique requires behavior, not just a label | Drop/backoff/AMRAP/rest-pause/cluster enum now; free text forever | Workout corpus and reporting needs | Later |
| OPEN-10 | What are final persisted SQL status enums and transition names? | Impacts constraints, adapters and generated types across Relation, Template, Assignment, Session, AttentionItem and Feedback | Decide after Stage 4 schema recovery and transition-table review; conceptual states are not SQL contract | Shared generic enum; per-entity enums; lookup tables | Remote schema inventory, command contracts and migration mappings | Before canonical SQL |

## Dependency notes

- Stage 4 remote schema/source-of-truth recovery precedes OPEN-10 and all canonical SQL.
- OPEN-01 must be resolved before final historical RLS, but it does not block retaining historical records.
- OPEN-02/03 must be resolved before private media storage and production retention procedures.
- OPEN-04/06 affect UI scope only; they do not reopen canonical template/assignment contracts.
- OPEN-07 remains a delivery-layer decision; the core workflow must work without an external channel.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Historical trainer access after ended relation | No access; permanent; time-limited; athlete-controlled | Default revoke pending privacy/legal review | Retention and authorization should not be conflated | Current product has no accepted post-relation policy | Relation, Session, Feedback | Future RLS and history readers | Before schema |
| Desktop/tablet-first full builder | Mobile-first; full parity | Retain as proposed hypothesis pending trainer research | Current builder is dense and repeated-work oriented | Stage 2 device question remains unanswered | Template authoring | Builder UI | Before final UX implementation |
| ProgressPhoto in first vertical slice | Defer; athlete-only; trainer-visible with consent | Defer pending privacy and beta validation | High sensitivity and non-core to workout review | Current photo representation is prototype/mock | ProgressPhoto | Progress UI/storage | Before beta |
