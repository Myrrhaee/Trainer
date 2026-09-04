# R3D: canonical workout completion architecture v1

Date: 2026-09-03
Status: architecture proposal; implementation and migration NOT authorized by this document
Audited baseline: `bdd60a99eb07f07666eacf160af6ac51735fcfe6`
Branch: `codex/r3d-client-workout-completion`
Companion: [R3D UX design](client-workout-r3d-design-v1.md)

## 1. Executive verdict

Reuse `WorkoutSessionService.complete` and `WorkoutSessionRepository.complete`. The canonical completion command already atomically finalizes Session and omissions, creates one Review AttentionItem, stores a command receipt and audit event, and inserts a notification outbox event. Do not replace it with a context-save workflow followed by a separate completion workflow.

R3D nevertheless requires a reviewed PostgreSQL migration and an API/read-contract extension. Overall comment and structured discomfort do not exist on the canonical Session. Relation suspension also breaks the end-to-end path in RLS, identity joins, Resume projection, Dashboard composition and Review transitions. A UI-only capability change cannot implement the accepted rule.

Recommended minimum: three nullable Session context columns, completion-only writes, existing immutable Session/Assignment identities as the bounded workflow authorization source, and narrowly scoped policy/query changes. No Program, new context aggregate, generic permissions engine or medical interpretation.

### Decision authority

| Decision | Status and authority |
| --- | --- |
| R3-REL-01: no new Assignment/Start after suspension/end; preserve Save/Complete and trainer Review/Feedback for an already-started Session | **Accepted product rule**, founder's current R3D task. Supersedes the open/restrictive candidates in R3A/R3B/R3C. |
| R3D-CONTEXT-V1: optional overall comment, required explicit discomfort Yes/No, comment required for Yes | **Accepted product rule**, founder's current R3D task. |
| Three columns, atomic command extension, bounded Session policy predicates and rollout below | **Proposed technical implementation**, not an accepted schema or permission migration. |
| Body area, severity, session RPE, readiness, AI | Explicitly out of scope, even where older R3 documents mention them as future completion candidates. |

Earlier documents remain historical evidence, not a reason to implement superseded behavior. In particular, the conceptual Assignment `completed` label in [Core Workflow](core-workflow-v1.md), sections C-D, is not a current persisted enum. Product principles 3, 4, 9, 10 and 13 require shared facts and prohibit deriving the domain from demo screens.

## 2. Existing completion evidence

### Evidence register

References use repository-relative paths and audited symbols/line anchors; no secrets or machine-local paths are embedded.

| ID | Source | Confirmed fact |
| --- | --- | --- |
| E01 | `app/api/workout-sessions/[sessionId]/complete/route.ts:18`, `POST` | Same-origin, 32 KiB object body, authenticated active athlete, existing service; 400/401/403/404/409/422/503 responses. |
| E02 | `lib/server/workout-sessions/workout-session-service.ts:127`, `complete` | Validates UUID, version, key, optional zero-result confirmation/reason; hashes normalized request. No overall/discomfort fields. |
| E03 | `lib/server/workout-sessions/workout-session-repository.ts:188`, `complete`; `:251`, `receipt` | Row lock, terminal/version checks, omissions, Session update, Attention insert, receipt, audit, outbox, exact hydration. |
| E04 | `lib/server/database/transaction.ts:11`, `withDatabaseTransaction`; `lib/server/database/actor-context.ts:11` | One pooled connection, BEGIN, transaction-local actor, COMMIT; thrown errors ROLLBACK. |
| E05 | `database/migrations/0007_workout_session_execution.up.sql:6`, `:89`, `:104`, `:130` | Session fields, unique Assignment, receipts, Attention uniqueness, immutable Session identity/terminal state. |
| E06 | `database/migrations/0007_workout_session_execution.up.sql:202-293` | Participant SELECT, athlete active-session writes, active-relation Start, trainer-only Attention SELECT, athlete completion insert. |
| E07 | `database/migrations/0008_workout_review_feedback.up.sql:4`, `:51`, `:78-156` | Immutable Feedback, Attention resolution transition, active-relation read/write policies and review receipts. |
| E08 | `lib/server/reviews/review-repository.ts:270`, `listQueue`; `:314`, `findReview`; `:487`, `sendFeedback`; `:717`, context projection | Exact repeatable-read Review, explicit active relation predicate, set-based sources, unsupported context, feedback transaction. |
| E09 | `lib/server/reviews/review-types.ts:6`, `ReviewAvailability`; `ReviewReadModel.sessionContext`; `lib/server/reviews/review-read-model-projector.ts:78`, `reviewCapabilities` | Ready/empty/unsupported/unavailable/partial taxonomy; current discomfort type is `readonly never[]`. |
| E10 | `lib/server/notifications/notification-outbox.ts:10`; `database/migrations/0010_notification_outbox.up.sql:75`; `lib/server/notifications/notification-worker.ts:29` | Transactional enqueue, canonical-event RLS, separate leased worker with retry/dead-letter behavior. |
| E11 | `database/migrations/0004_capabilities_and_invitations.up.sql:47`, `:121`; `lib/server/access/access-repository.ts:214` | Immutable relation provenance; suspension/end timestamps; suspension can be followed by reactivation and another suspension. |
| E12 | `database/migrations/0005_workout_templates_and_assignments.up.sql:160`, `:232`; `database/migrations/0012_athlete_profile_read_model.up.sql:29`, `:46` | Identity/Assignment policies depend on relation; 0012 currently also permits trainer profile/identity reads while suspended. |
| E13 | `lib/server/client-workouts/client-workout-repository.ts:51`, `:91`, `:120`; `client-workout-query-service.ts:27` | Exact own Assignment/Session; required trainer identity JOIN; Resume currently requires active relation; execution capability uses active Session. |
| E14 | `components/client/canonical-workout-execution.tsx:405`, `:596-659` | Existing completion dialog, zero-result confirmation, fresh key per POST; no frozen completion attempt/reconciliation. |
| E15 | `lib/server/trainer-dashboard/trainer-dashboard-repository.ts:59`; `components/trainer/canonical-trainer-dashboard-model.ts:20`, `:74`; `lib/server/trainer-workflow/trainer-workflow-transition-service.ts:28` | Dashboard roster is active-only; UI review items are derived from that roster, one review per athlete; Review return assumes profile route. |
| E16 | `tests/backend-foundation/workout-session-postgres.test.ts:138`, `:188`; `notification-outbox-postgres.test.ts:37`; `workout-review-postgres.test.ts:142`, `:307` | Idempotent partial completion, one Attention, zero confirmation, access loss after end, outbox and feedback regressions. These do not prove the future suspension rule. |

Inputs reviewed: [R3A](client-workout-r3a-architecture-v1.md), [R3B](client-workout-r3b-design-v1.md), [R3C](client-workout-r3c-design-v1.md), [Core Workflow](core-workflow-v1.md), [Principles](product-principles-v1.md), [MVP Scope](mvp-scope-v1.md). Old readiness descriptions are not treated as current implementation evidence.

### Current command contract

| Aspect | Current behavior |
| --- | --- |
| Route | `POST /api/workout-sessions/{sessionId}/complete` |
| Payload | `expectedVersion`, `idempotencyKey`, `zeroResultConfirmed`, `zeroResultReason` |
| Ownership | Actor is resolved from authentication, not payload. Session query requires `athlete_user_id = actor.userId`; API requires active athlete capability. |
| Concurrency | Lock exact Session `FOR UPDATE`; require exact Session version; progress and completion serialize on the same row. |
| Eligibility | Active own Session; not all Sets need completion. Zero completed Sets require explicit confirmation. Reason is currently optional, max 1000. |
| Omissions | `pending` becomes `incomplete`; skipped stays skipped; numeric missing facts remain null. Exercise aggregates are server-derived. |
| Session outcome | `completed` if every Set is completed; otherwise `completed_with_omissions`; version increments and server completion time is stored. |
| Assignment outcome | **No Assignment UPDATE.** Persisted statuses are `available/cancelled`; execution/completion is derived from the linked Session. |
| Attention | New `workout_review` with source Session and exact trainer/athlete/relation IDs; `partial_completion` reason when applicable. |
| Receipt | Actor + kind `complete` + hashed key; request hash, result version, Session FK. |
| Audit | `workout.session.completed` with IDs and outcome, not comment text. |
| Notification | `workout_completed`, recipient original trainer; outbox key `workout_completed:{sessionId}`. No external delivery inside transaction. |
| Response | Hydrated Session, not a typed browser completion receipt. Athlete generally sees `attentionItemId=null` because Attention SELECT is trainer-only. |

The Assignment participates as immutable read/source data, not a separately transitioned row. Do not claim that Session, Assignment status, omissions, Attention and notification delivery are all mutated atomically: that statement is false for Assignment status and delivery.

## 3. Transaction, exactly-one Attention and idempotency

### Current order

```text
BEGIN -> actor -> lock exact Session -> existing receipt check
-> active/version checks -> completed Set count -> zero-result check
-> pending to incomplete -> derive Exercise statuses -> omissions count
-> update Session -> insert Attention -> insert receipt -> audit
-> insert outbox -> hydrate Session -> COMMIT
```

The DB invariant is `UNIQUE (source_session_id, item_type)` plus `item_type='workout_review'` (E05). Source identity and priority reasons become immutable (E07).

| Question | Evidence-based answer |
| --- | --- |
| Can canonical completion commit without Attention? | No, if this command returns committed success. Attention insert failure throws and rolls back Session/omissions/receipt/audit/outbox. Previously committed progress remains. |
| Is every terminal Session guaranteed to have Attention by schema alone? | No. There is no inverse/deferred constraint requiring an Attention for every terminal Session. Privileged SQL/imports or a different write path could violate the command invariant. Report this distinction; do not invent a repair job. |
| Can identical retry create a second item? | No. Matching receipt returns persisted Session; unique source/type is the additional DB guard. |
| Same key, different normalized request? | `SessionIdempotencyConflictError`, HTTP 409; never replace original context. |
| New key after completion / other tab completed? | Current command returns null/404 rather than a typed already-completed result. R3D must reconcile exact persisted completion; do not keep generating keys. |
| Notification enqueue SQL fails? | Entire completion rolls back. UI cannot call it saved. |
| Delivery fails later? | Completion, Attention and context remain persisted; worker retries/dead-letters separately. No promise of delivery or trainer response time. |
| Hydration or COMMIT response fails? | Rollback if transaction failed; lost COMMIT acknowledgement is unknown. Client must reconcile, not assume rollback. |

### Proposed browser attempt

Extend the existing logical-command pattern, not a second server command model:

```text
operation = complete_session
commandId, sessionId, assignmentId
expectedVersion
frozen normalized context + zero-result confirmation/reason
frozenPayload, fingerprint, startedAt
```

Freeze after explicit confirmation; same logical Retry/Check uses the same key and exact payload. Known non-persisting validation failure permits editing and a new logical attempt. Unknown freezes the attempt/context and prohibits edits or a new Complete POST until resolved. No background completion.

### Exact reconciliation contract (proposed)

Use the existing actor-scoped exact execution read, extended with completion facts and an optional command correlation input. The input selects an own receipt; it is not authorization. In one coherent read snapshot return Session ID/Assignment ID, status/version, canonical context, and a minimal match result for the actor's `complete` receipt. Never expose raw idempotency hashes, other actors' commands or trainer-private Attention data.

1. Terminal Session + matching receipt + matching normalized context: accept success.
2. Terminal Session + different command but equal context: accept persisted completion as `already_completed`, not as evidence that this command ran. Never create another receipt/notification.
3. Terminal Session + different context: no replay/overwrite; show completed-elsewhere conflict and preserve local text in-page. Show actual persisted result separately.
4. Active Session + no matching receipt + **same expected version** + same identity + editable capability: replay the same key/payload. Version is required: unchanged status alone does not prove unchanged logs.
5. Active Session with changed version, inconsistent receipt/result, missing source, permission loss or abandoned state: no replay; refresh/explicit conflict.
6. Read failure: remain unknown. No declaration that persistence failed.

The server rechecks receipt/version under lock after the read, closing the read/replay race. Current receipt hashes already support this; a read projection is missing, not a new receipt table.

On reload after a lost response, exact completed facts can show the persisted receipt without recovering browser text or generating a new completion command. If still active and the in-memory attempt was lost, do not silently recreate it: reload current logs and require explicit new confirmation. Do not introduce persistent browser storage for sensitive discomfort text merely to survive reload.

## 4. Session context model

Proposed fields on `app.workout_sessions`:

| Column / API name | Proposed storage and normalization |
| --- | --- |
| `overall_comment` / `overallComment` | Nullable text, max 2000 characters; whitespace-only -> null; preserve substantive original wording, internal whitespace and line breaks. |
| `discomfort_reported` / `discomfortReported` | Nullable boolean, **no false default**. New completion must carry a real boolean, not a truthy string or omitted value. |
| `discomfort_comment` / `discomfortComment` | Nullable text, max 1000 characters; true requires non-empty trimmed text; false normalizes to null so hidden stale text is not persisted. |

Exact linkage, original trainer/relation provenance, athlete ownership and immutable terminal state already exist on Session (E05-E07). Therefore a separate context row is unnecessary for this one-at-completion context v1. There is no edit-after-completion workflow in R3D.

No content is merged with trainer instruction, Assignment note, Exercise note, Set comment or `zero_result_reason`. Reason for zero completed Sets remains its own existing field. New context is written only during the active-to-completed transition, in the same UPDATE that persists completion time/version; not during progress saves.

The proposed server/UI length definition must be the same for Unicode, including emoji; do not rely on divergent JavaScript UTF-16 length and PostgreSQL character counts without tests. Render text as text, never HTML. No interpretation, translation or paraphrase of the athlete's original signal.

## 5. Discomfort semantics and backward compatibility

| Persisted state | Review availability | Meaning |
| --- | --- | --- |
| `discomfort_reported=null`, all context columns null | `unsupported` | Legacy/context question not collected, **not** an explicit No. |
| `false`, comment null | `known_empty` | Athlete explicitly answered No. |
| `true`, non-empty comment | `ready({reported: true, comment: originalText})` | Original athlete-reported discomfort, not a severity or diagnosis. |
| Query/source unavailable | `unavailable` | No conclusion about whether discomfort exists. |
| Invalid persisted pair, e.g. true without comment | `unavailable` plus anomaly | Corrupt source, never silently convert to false. |

For overall comment: context not collected (`discomfort_reported=null`) -> unsupported; context collected with empty overall comment -> known_empty; non-empty -> ready; source failure -> unavailable. Using the required boolean's nullability as the v1 collection discriminator avoids an extra marker column. This is safe only because both fields are introduced and collected together atomically. Future independent context versions must introduce an explicit discriminator, not reinterpret legacy nulls.

Active Sessions before this migration remain null until they are completed through new v1 flow. Existing terminal rows remain null forever unless a separately reviewed source-preserving import exists. No null-to-false backfill and no inference from Set comments, zero-result reason or Attention reason.

## 6. R3-REL-01 relation-suspension architecture

### Current path and confirmed gaps

| Boundary | Current behavior / gap |
| --- | --- |
| New Assignment | Active relation required by command and RLS, including current lifecycle policy in migration 0013. Keep. |
| New Session | Active relation required by Start and Session INSERT policy. Keep; additionally serialize Start against suspension. |
| Already-started Save/Complete | Athlete ownership + active Session currently permits writes even after relation suspension. Keep the guarantee, retain active account/capability gates. |
| Client reload/Resume | Required JOIN to `app.users trainer` can eliminate the exact Assignment because reciprocal identity SELECT is active-relation-only. `canResume` also uses active relation. Fix read projection; repository write permission alone is insufficient (E12-E13). |
| Trainer Session/Assignment/logs | Active-relation SELECT restrictions suppress exact Review sources. Child RLS inherits visibility through joins (E06/E12). |
| Attention | Insert can succeed after suspension but original trainer cannot SELECT or resolve it (E06-E07). |
| Review GET | Explicit `relation.status='active'`, required identity/Assignment JOINs and RLS all gate it (E08). |
| Feedback and resolution | Feedback INSERT/SELECT, Attention UPDATE, manual-resolution policies and receipt INSERT require active relation. Athlete feedback query also requires trainer identity JOIN (E07-E08). |
| Dashboard | Even a visible Review from `listQueue` is dropped by `clients.flatMap` if the athlete is absent from active roster. Map by athlete also collapses multiple pending Sessions (E15). |
| Review return | Current R2A.3 transition offers profile return and assignment-related actions; these may be forbidden after suspension. Preserve transition contract but return to Queue/exact receipt, not an unavailable profile (E15). |
| Profile privacy | Migration 0012 still grants live profile fields to suspended trainers. Do not mistake this for accepted completion permission. The new rule requires narrowing this exposure, not extending it to ended relations (E12). |

### Technical options

| Option | Schema impact | RLS / authorization | Security / compatibility | Complexity / auditability | Verdict |
| --- | --- | --- | --- | --- | --- |
| A. Require active relation for every write/review | No new columns | Broad active check everywhere | Blocks finishing saved work; contradicts accepted rule | Simple, but wrong product behavior | Reject. |
| B. Existing Session records original Assignment/relation/trainer/athlete at Start; retain bounded workflow capability | Existing immutable IDs and started_at suffice; no new capability entity | Explicit original-trainer, exact Session/child/source policies; Start locking; query changes | Never authorize by current athlete-trainer pair alone. New relation/trainer does not inherit old Session. Legacy canonical Start is already active-gated. | Moderate; provenance is visible in Session FK + start audit | **Recommend**, conditional on concurrency/RLS tests. |
| C. Historical timestamps: rows before suspension only | Existing suspended_at/ended_at partly usable | Time-cutoff predicates | Latest suspended_at is overwritten on repeated suspension; historical intervals are incomplete. Must not hide a valid completion/feedback written after suspension. Clock-only tests are not sufficient proof. | Appears simple, but audit history/race logic becomes fragile | Supporting evidence, not sole authorization. |
| D. Persisted grant/snapshot per workflow | Extra flag/snapshot or new table, backfill and revocation rules | Explicit grant checked for each exact Session | Strong if imported legacy provenance cannot be trusted; adds new authority and lifecycle | Highest complexity; clear grant audit if designed well | Defer unless B cannot be proved for actual legacy data. |

### Recommended bounded policy contract

Use B, not a global exception to the active-relation rule. Existing Session identity proves a canonical Start, provided creation is active-gated and race-safe. No generic `canAccessAthlete` change.

1. Keep active account and role capability checks independent of relation status. An account/capability suspension is not the product's relation suspension guarantee.
2. Start locks the exact relation with a lock mode that conflicts with relation status UPDATE, verifies active state in the transaction, then creates/resumes by Assignment uniqueness. Lock order must be documented for Start/assignment/relation-management paths. Current SELECT lacks that locking; a concurrent suspension race is a required test, not proven closed today.
3. Own active Session remains editable/completable and exact-resumable after suspension/end. Do not call Start to resume it. Preserve Session and logs without widening athlete access to the trainer account row.
4. Original trainer with active trainer capability can see only their exact terminal Session's workout evidence, source Assignment/exercises/sets, Attention and same-Session Feedback after suspension/end. Do not expose live active execution telemetry merely to support completion Review.
5. Original trainer can send initial feedback/acknowledgement and resolve that Session's open item. Existing correction/follow-up semantics, if retained, are limited to that Session and prior Feedback, never to new athlete context. Readable persisted receipt must not disappear immediately after resolving the item or retries become unverifiable.
6. New Assignment, new Start, general athlete history/progress/biography/profile updates and sessions owned by another relation/trainer remain denied. Roster/no-assignment projection stays active-only. Suspended Review items enter the decision queue directly, not by reactivating an athlete in the roster.
7. Non-active relation must not keep the broad 0012 live-profile exception. Propose active-only general profile/identity policies and non-disclosing label fallback for exact historical workflow. Do not grant a full `app.users` row to recover a display name. Client and Review identity JOINs must become non-eliminating; unavailable names use a neutral label derived from already-authorized identity.
8. For a proposed historical workflow SELECT, compare every original identity: actor trainer, Session trainer/athlete/relation/Assignment, Attention source and Feedback source. Do not authorize by URL flow, receipt ID, current roster membership or an arbitrary suspended relation belonging to the same athlete.

Persisted terminal context necessarily arrives after suspension for a Session started earlier; this is precisely the bounded new data permitted by the product rule. The exception is by exact workflow lineage, not by unrestricted athlete history access. Historical retention duration and exceptional administrator revocation are separate policy decisions; propose preserving exact completed evidence/receipt for now, not silently discarding it when the item resolves.

### RLS implementation risks to review before SQL

- `Assignment SELECT -> Session EXISTS` combined with `Session SELECT -> Assignment EXISTS` can recurse. Use a reviewed acyclic predicate graph. If a security-definer predicate is necessary, fixed search_path, no caller-controlled actor, minimal scalar result, explicit grants/revoke PUBLIC and foreign-source tests are mandatory. Do not use authenticator/worker bypass in application repositories.
- Child policies for Assignment exercises/sets and Session logs must remain source-scoped. Exact source predicates cannot rely on unrestricted athlete/profile SELECT.
- Account display names are not authorization evidence. Use LEFT JOIN/fallback when identity metadata becomes inaccessible; preserve exact Session/Feedback rather than returning another entity.
- Suspension, end, reactivation and a new relation ID with the same pair all need tests. Do not synthesize history from `updated_at`.
- Existing direct SQL/imports under privileged roles are not proven legitimate Starts. If rollout discovers rows with unverifiable/mismatched provenance, stop for a selective recovery decision; do not bulk grant all imported rows.

## 7. Review and Attention impact

### Read model changes (proposed, not implemented)

- Select three context fields and project them in the existing repeatable-read `findReview` transaction.
- Keep `overallComment: ReviewAvailability<string>` and make `discomfort: ReviewAvailability<{reported: true; comment: string}>`, replacing the placeholder `readonly never[]`.
- Mirror the same projection in `dataAvailability.sessionContext`; do not make two independently interpreted copies.
- Preserve `subjectiveMetrics=unsupported`. Do not add session RPE/readiness to remove an unsupported label.
- Split the current blanket `unsupported_session_context` anomaly: legacy context is unsupported; malformed new context is unavailable/anomalous. Unsupported subjective metrics alone must not imply that the required v1 discomfort answer was not collected.
- Revise `canAssertNoDeviations` conservatively. Known No is not proof of perfect execution; true discomfort prevents an all-clear even when all recorded reps match the plan. Missing logs/context remain explicit.
- Keep original session comment and discomfort text out of the Set/Exercise comment arrays; source linkage is Session ID, not a fabricated Set ID.
- Add narrowly scoped read/capability facts needed for bounded Review return and assignment availability. R2A.3 remains the transition contract; valid flow context is not authorization.

Required later rendering is limited to exposing the new facts: discomfort and original text before ordinary deviations, then general comment. Current `CanonicalReviewSessionContext` at `components/trainer/review/canonical-review-evidence.tsx:420` only renders placeholder availability; returning data without a renderer would not satisfy the product rule. No Review redesign or UI edit is made now.

### Priority taxonomy

Current persisted completion emits only `partial_completion`. Existing Queue SQL already sorts `discomfort` first, then `completed_at ASC`, then Attention ID (E08). Existing Profile projectors also recognize `discomfort` and `partial_completion`.

Proposed deterministic reasons, computed from finalized Session facts before Attention insert:

| Facts | Reasons |
| --- | --- |
| No discomfort, all Sets completed | `[]` |
| No discomfort, omissions | `[partial_completion]` |
| Discomfort, all Sets completed | `[discomfort]` |
| Discomfort and omissions | `[discomfort, partial_completion]` |

Neither false nor legacy null creates a discomfort reason. Free-text keyword detection, severity weights and AI scoring are prohibited. Preserve original comment on Session, not in Attention JSON, audit metadata or notification payload.

Dashboard must preserve one item per Session, existing deterministic queue order and suspended-workflow entries. Current athlete Map can overwrite a discomfort-first review with a later review; mapping the queue directly by Attention ID is required. `priorityLabel` currently handles `omissions`, while persistence uses `partial_completion`; normalize presentation vocabulary to the canonical reason without rewriting historic reasons.

## 8. Migration proposal (no SQL)

One reviewed forward migration may carry the cohesive context and RLS changes. Choose its number against the repository at implementation time; do not create migration files now.

| Change | Proposal |
| --- | --- |
| Columns | Three nullable Session columns in section 4; no false default, no backfill. |
| Length checks | Overall <=2000, discomfort comment <=1000; whitespace normalization consistent with service. |
| Context tuple check | Legacy all-null accepted; false requires null discomfort comment; true requires non-empty comment. Null discriminator cannot accompany new context text. Nonterminal Sessions have no persisted completion context. |
| Transition enforcement | Extend Session update trigger to require explicit boolean for every new active -> completed/completed_with_omissions transition; context cannot be changed by progress/active -> active UPDATE. Existing terminal rows untouched and immutable. |
| RLS | Exact bounded Session/source/Attention/Feedback/receipt policy adjustments; narrow live profile exception; acyclic helpers if necessary. Do not alter general Assignment INSERT into a historical permission. |
| Indexes | Existing PK/FK/unique indexes cover Session/Assignment/Attention/receipt lookup. No index on comments/boolean by default. Add only if measured plan requires a scoped relation/source lookup. |
| Legacy | Null means not collected. Old completed Session remains readable with unsupported context; old active Session collects context at new completion. |
| Privileges | No new broad actor grants; no raw table bypass for convenience. Terminal original text cannot be edited by trainer. |
| Rollback | Prefer forward correction. Disable new submissions and preserve captured context before code rollback. A down migration dropping columns is data-destructive and needs export/explicit approval; old policy rollback can hide pending suspended reviews. Never claim a lossless drop. |

Migration gate: clean install and upgrade from current 0015 chain, old terminal rows unchanged, no null->false conversion, authorized/foreign/RLS tests, repeated suspension and Start race, completion rollback, same-key legacy retry. Backend and UI rollout must be coordinated: stale pre-R3D active completion requests must be rejected with refresh guidance, not accepted with fake No.

The old optional-field request hash differs from the new context payload. Preserve receipt compatibility for already-persisted legacy completions: recognize an old-shape retry only by its own existing receipt and original normalized hash, never allow that compatibility path to complete a still-active Session without the mandatory question. New requests use the normalized context in the hash. This needs implementation tests before release.

## 9. API and command proposal

| Option | Atomicity | UX / failure impact | Recommendation |
| --- | --- | --- | --- |
| Extend existing Complete payload | Context, completion and Attention share one lock/transaction/key | One confirmation and one recoverable result | Use. |
| Separate Save Context before Complete | Two operations can diverge; partial context becomes visible before finalization | Extra save states, retries, stale overwrites and abandoned text | Reject for v1. |

Extend the current payload with the three camelCase fields; keep `expectedVersion`, `idempotencyKey`, zero-result confirmation and reason. Session/athlete/trainer/relation identity is derived server-side. Strict boolean validation; bounded strings; false clears stale discomfort comment; trim-only empty normalization. No client-supplied Attention priority/status/time/recipient.

Extend exact read and command result with server-authoritative completion eligibility and a minimal persisted completion receipt: exact IDs, terminal status, result version, completedAt, collected context and `reviewQueued` evidence/correlation. Return a safe completion acknowledgement from the command's own successful transaction/receipt, not by granting athlete SELECT on trainer-private Attention. Existing athlete-visible `attentionItemId=null` must not be treated as enqueue failure.

Do not return notification delivery as part of completion success. Transport retry/navigation error after persisted completion cannot revert Session success. Keep errors local and distinguish known validation, stale version, unknown transport and permission failure. API names/shape are proposals for implementation review, not new routes committed here.

## 10. Authorization and security matrix

| Case | Required result |
| --- | --- |
| Active athlete, own active Session, current version | Complete with explicit context, partial allowed. |
| Foreign/malformed/nonexistent Session | Non-disclosing failure; no context, receipt or alternate Session fallback. |
| Terminal Session, matching own command | Same persisted result, no second side effect. |
| Terminal Session, changed command/context | Exact completed state/conflict; no edit of original text. |
| Inactive account or athlete capability | Fail closed; relation-continuation rule does not override account security. |
| Suspended/ended relation before Start | No new Session or Assignment. |
| Suspended/ended relation after legitimate Start | Own Save/Complete allowed; exact Resume works; original trainer has bounded completion Review/Feedback. |
| Other trainer, new trainer relation, manipulated source IDs | Deny. Current coaching relation cannot take ownership of old Session. |
| Original trainer, own terminal workflow | Read exact context and source evidence; send feedback/resolve under existing state rules; no athlete mutation. |
| Original trainer, non-active relation, broad profile/history/new work | No added capability; narrow existing live-profile exposure. |
| `discomfortReported` missing/null/string or true+blank | Reject new completion; never coerce to false. |
| False plus stale comment | Canonically normalize comment to null; no hidden retention. |
| Oversized text/body, markup in comments | Reject limits; text-only render, no interpreted markup/script. |
| Client-forged `priorityReasons`, owner IDs or completedAt | Reject/ignore as non-command fields; derive only server facts. |

Sensitive original context stays on Session. Generic outbox messages contain no discomfort text or medical fields. Do not log request bodies in audit/errors. Access/retention policy is a deployment requirement, not an invitation to invent medical classification or a new consent system in this step.

## 11. Performance and request budget

Numbers below distinguish measured R3C baseline from **static source counts / proposed budgets**. No R3D runtime exists and no R3D performance benchmark was run.

| Operation | Current evidence | Proposed expectation |
| --- | --- | --- |
| Pre-completion exact execution read | R3C measured 10 statements, including two transaction wrappers; one HTTP GET | Single coherent completion basis, constant set-based queries; <= current 10 plus one bounded receipt lookup. Avoid mixed-version summary. |
| First completion transaction | E03/E04 static count: 17 statements on non-empty Session, including BEGIN/actor/COMMIT and response hydration | Same bounded count if context piggybacks existing UPDATE and receipt result; document any extra authorization query. No Set-by-Set completion loop. |
| Identical completed command replay | Static bounded receipt lookup and exact hydration, no writes | One POST with same key or exact read + same-key replay when active/unchanged. |
| Receipt reconciliation | Existing exact read lacks command projection | One exact GET, at most one receipt lookup; optional same-key POST only for proven unchanged active state. |
| Dashboard appearance | `snapshot`: three transactions with one set-based SELECT each, statically 12 statements including wrappers; not one atomic snapshot | One no-store refresh on mount/focus/return; review items must not be filtered by active roster. Delivery not required. |
| Review exact read | `findReview`: five data SELECTs + SET isolation/actor/BEGIN/COMMIT = 9 statements; no per-Set query | Context fields piggyback source SELECT. Current GET also builds R2A.3 transition using Dashboard snapshot; budget that extra 12 separately, plus authentication/access lookup. |
| Reload receipt | Same exact source, not Session list scan | One exact GET; terminal read-only result, no completion POST on mount. |

Query counts exclude HTTP auth/session/access lookup unless stated. Constant statement count is not proof of bounded rows: current review queue is unbounded, and widening it for suspended workflows needs a bounded/cursor strategy or explicit accepted pilot bound. Do not silently truncate pending work or implement history in this step. R3D implementation must instrument actual query/request counts and plans at small/large Set counts and multiple pending reviews.

## 12. Implementation sequence and acceptance gates

This is a proposed sequence for a later authorized task, not work performed here.

1. Review this design and approve exact RLS/legacy compatibility plan. Inventory unexpected imported Session provenance and choose retention policy; no blanket bypass.
2. Implement migration with context consistency/transition checks and bounded relation policies, plus Start/suspension serialization. Prove clean install/upgrade and rollback implications.
3. Extend existing completion validation/hash/receipt/read contracts. Preserve legacy receipt replay and atomic side effects; exercise all rollback points.
4. Repair exact Client Resume/identity projection for already-started suspended Sessions. Extend current model with coherent completion basis; never load mutable Template.
5. Implement completion form/attempt/unknown reconciliation and receipt as designed; unresolved Save blocks submission.
6. Expose context in existing Review and minimal original-signal rendering. Connect suspended Review items directly to Queue and constrain R2A.3 return/assignment capabilities. No broad Review redesign.
7. Run unit, PostgreSQL, browser and cross-role regression gates. Do not begin R3E history.

### Required tests for implementation

| Group | Minimum evidence |
| --- | --- |
| Validation/model | True/false/null distinctions; whitespace; Unicode limits; false clears hidden text; no fake zero or severity; partial summary excludes local edits. |
| PostgreSQL completion | Own full/partial/zero result; preserved skipped/incomplete; exactly one Attention/receipt/audit/outbox; duplicate same-key; changed payload; expectedVersion conflict; terminal immutability. |
| Failure atomicity | Inject failure at Attention, receipt, audit and outbox insertion; verify rollback of completion/context/omissions, but earlier committed logs survive. |
| Unknown | Persisted response loss; non-persisted 503; exact read fails; same key replay; second-tab same/different context; server logs changed before retry; never fresh-key retry. |
| Suspension | Before Start denied; after Start Save/Complete/Resume; simultaneous Start/suspend; completed queue visibility; exact Review + feedback + receipt; no new assignment; repeat suspend/reactivate/end/new relation. |
| Privacy/RLS | Foreign athlete/session/log, other trainer/new trainer, inactive capabilities, direct actor-role SQL, no generic suspended profile access; no recursive RLS or privileged repository bypass. |
| Legacy | Terminal null context stays unsupported; active legacy collects v1; existing legacy receipt replay; old client request cannot create null new context. |
| Browser | Dirty/unresolved Sets block; Yes/No explicit; true comment required; partial/zero confirmation; reload result; focus targets; 390x844, 390x500, 200% zoom, keyboard and no overflow. |
| Cross-role | Discomfort before deviations/other reviews; all pending Sessions retained; suspended roster absence does not hide item; same feedback IDs to athlete; safe Queue return, no forbidden Quick Assign. |

## 13. Risks, open decisions and evidence limits

- Product rules are accepted; proposed SQL/policy implementation is not. An API-only workaround would leave RLS/joins/Queue inconsistent.
- The reviewed tests prove current atomicity/idempotency behavior, not future context or full suspension workflow. The latter still needs failure injection and concurrency tests.
- R3C document still says R3-REL-01 open and mentions broader subjective metrics. It is intentionally not rewritten in this task; section 1 records current authority/scope.
- Exactly-one Attention is command-level existence plus schema at-most-one, not inverse relational existence. Privileged repair/imports need separate review.
- Existing Session FK/identity is sufficient for canonical Starts; imported/bypassed rows may require option D or explicit quarantine, never an inferred permission.
- Repeated suspension timestamps do not provide full authorization history; do not use them as sole capability source.
- Current client identity JOIN and active-only Resume are rollout blockers for the accepted suspension UX even though repository Save/Complete works.
- Existing 0012 suspended live-profile exposure must be narrowed; confirm any desired frozen athlete label rather than adding general live profile rights. Neutral authorized-ID label is proposed v1 fallback, not invented profile data.
- Original trainer's exact receipt/read retention and correction scope after resolution need explicit operational retention review. Proposed v1 keeps same-workflow read/receipt and existing follow-up semantics only, no new athlete history access.
- Zero numerical actual is currently valid and counted as completed; R3D does not redefine it as medical/workout quality. Zero-result confirmation concerns zero Sets with completed status, not sum of repetitions.
- No formal accessibility or performance validation of the proposed screens is claimed until implementation exists.

## 14. Explicit non-goals and scope confirmation

No body area/map, severity, session RPE, feeling/readiness, diagnosis, AI, Progress, R3E History, Trainer Review redesign, Motivation, achievements/titles/rank, Program, messaging or payments. No exercise-level athlete-note write command.

R3C was committed separately as `bdd60a99eb07f07666eacf160af6ac51735fcfe6` (`feat(client-workouts): add canonical workout execution`). Fresh pre-commit gates: targeted Start/Set unit 5/5; full PostgreSQL 145/145 including targeted R3C test; canonical E2E 9/9; TypeScript, ESLint, production build and staged diff check passed. Existing Radix description and color-environment warnings remain, not introduced by documentation.

R3D changes only this document and its design companion. Production code, API, repositories/services, RLS, schema, migrations, tests and routes were not changed in R3D. No migration SQL was written. No R3D implementation or R3D commit was created.
