# Data Contracts v1

Status: accepted working UI-independent command and read-model contracts. Names and fields are conceptual; final SQL/API names remain implementation decisions.

## Contract principles

- Commands authenticate the actor outside the payload and authorize against ownership/relation.
- UUIDs are opaque canonical identifiers. Client-generated idempotency keys are distinct from entity IDs.
- Commands return stable domain results and typed errors, not raw database errors.
- Read models compose canonical facts and derived presentation values. Client and trainer share session/log facts, with role-specific additions.
- AI summaries are optional annotations and never required to execute, complete or review a workout.
- Timestamps cross the contract boundary as UTC instants with explicit IANA time-zone context where calendar interpretation matters. Weight/length facts normalize to kg/cm while optionally retaining original entry/unit for audit.

## Command contracts

| Command | Actor; required input | Optional input | Preconditions / idempotency | Entities changed; output | Expected errors / audit record |
|---|---|---|---|---|---|
| **CreateWorkoutTemplate** | Trainer; title, initial exercise/prescription draft | notes, folder/category | Trainer capability; idempotency key | Creates draft Template and children; returns template id/version/state | Unauthorized, invalid prescription/exercise; audit actor and correlation |
| **UpdateWorkoutTemplateDraft** | Owner trainer; template id, expected revision, patch | reordered exercises, groups, overrides | Draft and owner; optimistic version/idempotency key | Updates draft children; returns new revision token | Not found, conflict, published/archived, validation; audit changed sections |
| **PublishWorkoutTemplate** | Owner trainer; template id, expected draft revision | publication note | Valid complete draft; idempotency key | Creates immutable published revision; later substantial editing begins a new draft revision; returns revision id | Invalid/incomplete, conflict, unauthorized; audit source revision |
| **CreateWorkoutAssignment** | Trainer; active relation id, saved template revision id, athlete-calendar schedule | coach note; target weight/rest/note/duration adjustments; snapshot hash/diagnostic JSON | Own template; active relation; no unsaved draft; core prescription has sets plus repetitions/range; idempotency key | Atomically creates normalized Assignment snapshot children and source-revision reference; archival JSON is non-authoritative | Relation inactive, template invalid, schedule invalid, duplicate; audit source and snapshot version |
| **UpdateScheduledWorkoutAssignment** | Trainer; assignment id, expected version, allowed patch | schedule/note/pre-start prescription adjustments | Own relation; no session started; idempotency key | Updates permitted assignment fields/snapshot version; returns summary | Locked, canceled/completed, conflict, unauthorized; audit before/after metadata |
| **StartWorkoutSession** | Athlete; assignment id | device/client time zone | Own eligible assignment; at most one active session; idempotency key | Creates or returns active Session and initial logs; output execution contract | Not available/canceled, relation invalid, completed, conflict; audit session start/resume |
| **SaveWorkoutSessionProgress** | Athlete; session id, expected version, changed exercise/set facts | comment draft; `hasDiscomfort`, optional area/severity and original comment | Own active session; stable set identities; idempotency key per save batch | Upserts performed/skipped/incomplete facts and structured/raw signal; returns version and saved watermark | Completed/abandoned, validation, conflict, unauthorized; audit metadata without unnecessary sensitive-text duplication |
| **CompleteWorkoutSession** | Athlete; session id, expected version, explicit completion declaration | final comment/discomfort; zero-result confirmation/reason; client time-zone context | Own active session; partial completion allowed; no invented result required; zero results require confirmation; stable idempotency key | Atomically marks conceptual completed/completed-with-omissions outcome, preserves skipped/incomplete facts, creates/gets AttentionItem; returns completion and review-source ids | Confirmation required, conflict, unauthorized; repeated call returns same result; final status enum remains schema decision |
| **CreateOrGetReviewAttentionItem** | Trusted completion workflow/service; completed session id | computed deterministic priority reasons | Session completed; source relation valid; idempotency key/session unique key | Creates or returns exactly one AttentionItem | Invalid state/source; audit source event. Not a direct browser command |
| **SendTrainerFeedback** | Owner trainer; attention id, feedback type, explicit-send body/payload | next-assignment request data; AI-authored draft provenance | Related source session; item unresolved; draft mutable but not feedback until send; idempotency key | Creates immutable sent Feedback with author/audit times, then resolves item transactionally; correction uses follow-up | Empty/invalid, already resolved, relation/owner denial, persistence failure; audit feedback id/type, not secrets |
| **ResolveAttentionItemManually** | Owner trainer; attention id, reason | category | Unresolved item; non-empty reason; idempotency key | Creates ManualResolution and resolves item | Already resolved, invalid reason, unauthorized; audit full reason under private access |
| **CreateNextWorkoutAssignment** | Trainer; source relation, saved template revision, schedule | link to reviewed session, note/adjustments | Same rules as CreateWorkoutAssignment; review completion is not conditional on success | Creates independent Assignment; returns summary | Same assignment errors; audit reviewed source link if supplied |

### Command error vocabulary

Minimum stable error categories: `unauthenticated`, `forbidden`, `not_found`, `invalid_state`, `validation_failed`, `version_conflict`, `idempotency_conflict`, `relation_inactive`, `source_unavailable`, `rate_limited`, `temporarily_unavailable`. UI copy is localized separately.

## Read models

| Read model | Consumer and source entities | Required and derived fields | Freshness / empty state | Sensitive fields and role sharing |
|---|---|---|---|---|
| **TrainerAttentionQueueItem** | Trainer queue; AttentionItem, Session, Relation, AthleteProfile, DiscomfortSignal | item/session/athlete ids, athlete display, completed time, status, factual exception flags, preview; derived deterministic priority/order and elapsed time | Near-real-time after completion; empty = no sessions needing review | Raw discomfort preview is sensitive; trainer only. Session facts shared with review details |
| **TrainerDashboardSummary** | Trainer dashboard; queue, assignments, sessions, relations | counts for due assignments, open reviews, recent completions and athletes needing action; derived presentation statuses | Eventual seconds/minutes acceptable; empty = active club with no work or onboarding state | Aggregate private data; no broad athlete details |
| **AthleteProfileHeader** | Trainer athlete page and athlete profile variant; User/AthleteProfile, Relation, derived workout facts | athlete id/display, self-description, goal, relation tenure, compact factual KPIs, rank projection if retained | Profile changes near-real-time; clear missing-profile state | Shared self profile; trainer-only relation/admin controls separated |
| **AthleteWorkoutHistoryItem** | Trainer athlete history; Assignment, Session, logs, Feedback | assignment/session ids, workout title snapshot, schedule/start/completion, state, compact performed summary, feedback state | Near-real-time; empty = no sessions | Shared facts; trainer sees queue/action metadata, athlete does not |
| **WorkoutReviewDetails** | Trainer detailed review/drawer; Session, assignment snapshot, logs, comments, discomfort, AttentionItem, feedback | exact prescription vs performance by stable instance/set, completion times, raw comments/signals, feedback history | Strong consistency after completion; error if source incomplete rather than fabricated | Sensitive; trainer relation-scoped. Same factual section as athlete history/detail |
| **ClientCurrentAssignment** | Athlete dashboard; Assignment and active Session | assignment id, workout title snapshot, schedule, availability/state, active session id/progress, coach note | Near-real-time; empty = no assigned workout | Own athlete only; no internal trainer note/queue state |
| **ClientWorkoutExecution** | Athlete execution; Assignment snapshot, active Session/logs | ordered exercises/prescriptions, performed values, stable instance/set ids, save version, completion eligibility | Strong consistency/resumable; empty/error if assignment invalid | Own session; excludes trainer-private data and authoring controls |
| **ClientWorkoutHistoryItem** | Athlete history; Session, snapshot, logs, Feedback | session/workout ids, completed date, compact factual result, feedback preview/read state | Near-real-time; empty = no completed sessions | Own facts and feedback; excludes AttentionItem internals |
| **ClientFeedbackItem** | Athlete feedback list/detail; Feedback, Session/snapshot | feedback id/type/body/sent time, trainer display, linked workout/session, follow-up ordering | Near-real-time; empty = no feedback | Athlete own; immutable content; no manual resolution reason/internal note |
| **ProgressSummary** | Athlete and trainer progress; Sessions, SetLogs and measurements | completed history/count/consistency; selected-exercise working weight, repetitions and best completed set; bodyweight trend only with measurements; definition/version/source watermark | Rebuildable; no composite score; empty identifies missing fact type | Same derived definitions for both roles; trainer access through relation; ProgressPhoto remains separate/open |
| **WorkoutTemplateListItem** | Trainer template library; Template/revision | id, title, state, revision, exercise count, updated/published time, usage count derived | Near-real-time; empty = create first template | Owner trainer only |
| **WorkoutTemplateEditor** | Trainer builder; Template revision and children, Exercise references | draft id/revision, ordered instances, prescriptions/overrides/groups, validation issues, dirty/save state | Strong consistency with optimistic version; blank template state supported | Owner trainer; no Supabase row leakage |

## Shared factual core and role additions

| Factual core | Athlete additions | Trainer additions |
|---|---|---|
| Assignment snapshot title/order/prescription | Availability, resumable controls | Source template provenance, scheduling controls before start |
| Session state and timestamps | Save/completion eligibility | Review/attention status |
| ExerciseLog and SetLog performed facts | Editable active values | Prescription comparison after completion |
| Client comment and discomfort signal | Original entry/clarification | Exception-first presentation |
| TrainerFeedback | Read status/display | Authoring history and follow-up controls |

## Current contract conflicts

- `src/types/index.ts` exposes database-like `WorkoutTemplate`, `WorkoutAssignment`, `Workout` and JSON `WorkoutLog` shapes that do not match current row-per-set writes or the target session hierarchy.
- Builder assignment payloads contain client name and full workout in localStorage, but there is no shared client read contract.
- Client review joins by `workout_date`, so `WorkoutReviewDetails` cannot identify the source session reliably.
- Dashboard/profile mock types embed derived statuses and athlete data directly instead of composing canonical facts.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Support advanced prescription types in the first schema | Narrow extensible MVP; generic metric/value model | Keep narrow MVP and validate later additions before schema expansion | Premature generalization complicates builder and log contracts | Initial prescription scope is now accepted | Prescription, SetLog | Builder/execution contracts | Later |
| Include ProgressPhoto fields in ProgressSummary | Separate consented media model; defer | Keep separate and defer until scope/privacy decision | Photos have different sensitivity and freshness semantics | ProgressPhoto remains proposed | ProgressPhoto, ProgressSummary | Progress UI | Before beta |
