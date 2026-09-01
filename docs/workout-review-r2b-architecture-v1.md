# Workout Review R2B Architecture v1

Date: 2026-08-31
Status: architecture proposal based on repository evidence
Scope: convergence of the production canonical Review page and the compact Review Drawer

## 1. Executive verdict

R2B must converge two presentation surfaces around the existing PostgreSQL review lifecycle, not create a second review product.

The canonical foundation already exists:

- `/trainer/review/[workoutId]` treats the route parameter as a `WorkoutSession.id` in production mode;
- `ReviewService.findReview` joins the exact Session to its Assignment snapshot, Athlete, review `AttentionItem`, exercise/set logs and persisted `TrainerFeedback`;
- detailed feedback and short acknowledgement already use one command with different `kind` values;
- feedback persistence, exact AttentionItem resolution, idempotency receipt, audit event and notification outbox enqueue happen in one transaction;
- the athlete reads the same feedback rows and IDs through `/api/client/feedback`;
- R2A.3 already provides the canonical transition, return, next-item and revalidation contract.

The Drawer is not currently a compact production projection. It is a demo/legacy workflow backed by `TrainerDemoState`, a module-level store, `sessionStorage`, synthetic feedback IDs and local commands. The production Dashboard already opens the canonical full page instead of this Drawer.

The recommended target is:

1. Evolve `TrainerReviewDetails` into the single `ReviewReadModel`; do not add a Drawer domain model.
2. Keep the current feedback and manual-resolution endpoints as the only command boundary.
3. Extract the production action panel and receipt into presentation-independent components used by Page and Drawer.
4. Make the Drawer a compact projection of the same GET response and the same R2A.3 context.
5. Keep the full page as the only canonical detailed URL and the safe fallback for direct links, complex sessions and unavailable context.
6. Treat structured discomfort, session-level comments and session-level subjective metrics as explicit schema gaps. Do not infer them from prose or demo data.

Core Page/Drawer convergence does not require a new API route or migration. Enabling safety-aware quick resolution in the Drawer without ambiguity about discomfort does require a later product/schema decision.

## 2. Current Review implementation map

| Surface/layer | Current implementation | Data/action source | Architectural status |
| --- | --- | --- | --- |
| Production route | `app/trainer/review/[workoutId]/page.tsx:10-40` | Route parameter passed as `sessionId`; R2A.3 `flow` envelope | Canonical |
| Production Page | `components/trainer/canonical-workout-review.tsx:62-157` | `/api/trainer/reviews/{sessionId}` | Canonical, production-backed |
| Production read API | `app/api/trainer/reviews/[sessionId]/route.ts:12-49` | `ReviewService.findReview` plus transition service | Canonical |
| Feedback command | `app/api/trainer/reviews/[sessionId]/feedback/route.ts:18-47` | `ReviewService.sendFeedback` | Canonical |
| Manual resolution | `app/api/trainer/reviews/[sessionId]/resolve/route.ts:18-46` | `ReviewService.resolveManually` | Canonical |
| Production Dashboard entry | `components/trainer/canonical-trainer-dashboard.tsx:118-137` | Pushes exact Session to canonical Page with `flow` | Canonical |
| Production Profile entry | R1/R2A profile capability and Training links | Exact AttentionItem and Session | Canonical |
| Drawer | `components/trainer-os/workout-review/workout-review-drawer.tsx:28-111` | `TrainerDemoState` selector | Demo/legacy |
| Drawer actions | `components/trainer-os/workout-review/review-store.ts:71-178` | Local runtime commands and synthetic records | Demo-only; must not enter production |
| Demo Page | `components/trainer-os/workout-review/workout-review-page.tsx` | Demo runtime | Demo-only |
| Demo model/seeds | `components/trainer-os/workout-review/review-model.ts:57-343` | Inline seeded reviews | Prototype contract, not source of truth |
| Old standalone page client | `app/trainer/review/[workoutId]/workout-review-client.tsx` | Inline hardcoded map | Legacy candidate; not the production route component |
| Athlete feedback | `app/api/client/feedback/route.ts:10-18`; `components/client/canonical-workout-execution.tsx:383-425` | Same `app.trainer_feedback` rows | Canonical |

`NEXT_PUBLIC_DEMO_MODE=true` deliberately selects the demo Page, Dashboard and profile branches (`lib/demo-mode.ts:26-28`; `app/trainer/dashboard/page.tsx:9-15`; `app/trainer/clients/[clientId]/page.tsx:23-96`). Production convergence must not make that runtime a hidden fallback.

## 3. Canonical entity linkage

The route identifier is a Session ID even though the parameter is named `workoutId`:

```text
/trainer/review/{WorkoutSession.id}
  -> AttentionItem.source_session_id
  -> WorkoutSession.assignment_id
  -> WorkoutAssignment snapshot
  -> WorkoutExerciseLog.assignment_exercise_id
  -> WorkoutAssignmentExercise snapshot
  -> WorkoutSetLog.source_assignment_set_id (nullable)
  -> TrainerFeedback.source_session_id + attention_item_id
```

Evidence:

- `ReviewService.findReview` validates the route value as UUID and calls all reads with that Session ID (`lib/server/reviews/review-service.ts:62-69`).
- `ReviewRepository.findSource` joins AttentionItem -> Session -> Assignment -> Athlete and filters both trainer and Session ID (`lib/server/reviews/review-repository.ts:127-145`).
- `WorkoutSessionRepository.find` loads the same Session and hydrates its exercise and set logs (`lib/server/workout-sessions/workout-session-repository.ts:71-73`, `:273-299`).
- one Session per Assignment is enforced by `UNIQUE (assignment_id)` (`database/migrations/0007_workout_session_execution.up.sql:6-31`).
- one review AttentionItem per Session is enforced by `UNIQUE (source_session_id, item_type)` (`database/migrations/0007_workout_session_execution.up.sql:104-122`).
- feedback references trainer, athlete, relation, Session and AttentionItem (`database/migrations/0008_workout_review_feedback.up.sql:4-21`).

The UI must not accept an independent Athlete ID, Assignment ID or AttentionItem ID as a substitute for this linkage. They may travel in the R2A.3 envelope, but the server must re-derive and compare them with the Session-linked records.

## 4. Existing query/read contracts

### 4.1 Production detail contract

`TrainerReviewDetails` currently contains:

- AttentionItem identity, status, creation/resolution timestamps, priority reasons and optional manual reason;
- Session identity, Assignment identity, title, terminal status, start/completion time and derived duration;
- Athlete identity and display name;
- Assignment date;
- exercises with status and athlete note;
- sets with immutable planned reps/duration/load, actual reps/duration/load, RPE, status and athlete comment;
- all persisted feedback for the Session.

Evidence: `lib/server/reviews/review-types.ts:32-86`.

### 4.2 Query shape

`ReviewService.findReview` currently starts three reads in parallel: source, Session and feedback (`lib/server/reviews/review-service.ts:62-68`). Session hydration then loads all exercises in one query and all sets with one `ANY(uuid[])` query (`lib/server/workout-sessions/workout-session-repository.ts:278-299`). This is constant-query and does not perform N+1 per exercise or set.

The weakness is consistency, not N+1: source, Session and feedback use separate actor transactions. A concurrent resolution can therefore produce a response whose Attention status and feedback list were observed at different moments. R2B implementation should provide a single actor-scoped query transaction without changing the public response shape.

### 4.3 Current projection loss

`CanonicalWorkoutReview` maps `TrainerReviewDetails` back into the demo-shaped `WorkoutReviewDetails` (`components/trainer/canonical-workout-review.tsx:372-483`). That projection currently:

- hard-codes `goal: ""`;
- hard-codes `hasDiscomfort: false`;
- invents queue position `1 / 1`;
- labels AI as unavailable;
- drops planned and actual duration from shared set presentation;
- drops rest prescription and source/update timestamps;
- flattens set comments into one client-comment string.

These values must not become part of the canonical model. R2B should remove the dependency direction from production data into the demo model.

## 5. Existing command contracts

### 5.1 Detailed feedback and acknowledgement

Both use:

```text
POST /api/trainer/reviews/{sessionId}/feedback
{
  attentionItemId,
  kind: "detailed" | "acknowledgement",
  body,
  idempotencyKey,
  transitionContext
}
```

`ReviewService` validates the exact IDs, kind, body and key (`lib/server/reviews/review-service.ts:112-127`). There is no separate acknowledgement command and none should be introduced.

### 5.2 Follow-up

A correction is another call to the same endpoint with `kind: "follow_up"` and `followUpOfId`. The repository verifies that the AttentionItem is already resolved and that the parent feedback belongs to the same AttentionItem and Session (`lib/server/reviews/review-repository.ts:181-188`).

### 5.3 Manual close

Manual resolution remains a separate explicit command because it creates no athlete-visible feedback and persists a trainer-private reason:

```text
POST /api/trainer/reviews/{sessionId}/resolve
{ attentionItemId, reason, idempotencyKey, transitionContext }
```

### 5.4 Atomicity and idempotency

For initial feedback/acknowledgement, one transaction:

1. locks the exact trainer + AttentionItem + Session tuple;
2. checks the durable command receipt;
3. inserts immutable feedback;
4. resolves the exact AttentionItem;
5. inserts the command receipt;
6. records audit;
7. enqueues a notification event.

Evidence: `lib/server/reviews/review-repository.ts:168-225`.

The same idempotency key and request returns the previous result; a changed payload raises `idempotency_conflict`; another new initial-feedback command after resolution raises `review_already_resolved` (`lib/server/reviews/review-repository.ts:269-290`). Page and Drawer must retain one key for retries of one logical submit.

## 6. Page/Drawer divergence map

| Concern | Canonical Page | Current Drawer | Required convergence |
| --- | --- | --- | --- |
| Read source | PostgreSQL API | Demo runtime selector | Same GET response |
| Route identity | Exact Session UUID | Demo Session string | Exact Session UUID |
| Attention context | Server-validated | Optional local prop/demo record | R2A.3 envelope + server validation |
| Planned/actual | Canonical logs mapped to demo shape | Seeded demo facts | One canonical projector |
| Feedback persistence | PostgreSQL | Synthetic ID and runtime state | Same POST command |
| Acknowledgement | Canonical `kind` | Local demo command | Same canonical `kind` |
| Manual close | Persisted private reason | Local runtime command | Same resolve endpoint |
| Follow-up | Persisted immutable record | Local runtime state | Same feedback endpoint |
| Idempotency | Durable receipt | Timestamp-generated record | Same stable key behavior |
| Stale/concurrent | `409`, reload persisted state | No real concurrency | Shared action controller |
| Receipt/next | R2A.3 transition | Parent callback/local text | Same completion receipt |
| Draft | Component state | Module store + sessionStorage | Shared ephemeral draft handoff |
| Permission | Auth + RLS | No production boundary | Same GET/POST authorization |
| Loading/error | Async loading and generic unavailable | Synchronous known/unknown | Shared state taxonomy |
| AI draft | Explicitly unavailable | Seeded fake AI draft | Exclude from R2B Core |

## 7. Proposed shared ReviewReadModel

The existing `TrainerReviewDetails` should be renamed or evolved in place. The following is a target read contract, not a new persisted entity:

```ts
type ReviewReadModel = {
  identity: {
    sessionId: string;
    assignmentId: string;
    attentionItemId: string;
    athleteUserId: string;
    relationId?: string; // server use only unless presentation needs it
  };
  athlete: {
    id: string;
    displayName: string;
    initials: string;
  };
  attention: {
    status: "open" | "resolved" | "archived";
    createdAt: string;
    resolvedAt: string | null;
    priorityReasons: string[];
    manualResolutionReason: string | null;
  };
  assignmentSnapshot: {
    id: string;
    title: string;
    scheduledFor: string;
    instruction: string;
    trainerNote: string;
    sourceRevisionNumber: number;
  };
  session: {
    id: string;
    status: "completed" | "completed_with_omissions";
    clientTimezone: string;
    startedAt: string;
    completedAt: string;
    durationMin: number;
    zeroResultReason: string | null;
  };
  exercises: Array<{
    exerciseLogId: string;
    assignmentExerciseId: string;
    title: string;
    position: number;
    status: "completed" | "skipped" | "incomplete";
    athleteNote: string;
    prescribed: {
      trainerNote: string;
      restSeconds: number | null;
      sets: Array<{
        setLogId: string;
        sourceAssignmentSetId: string | null;
        setKey: string;
        position: number;
        kind: "warmup" | "working";
        repetitionsMin: number | null;
        repetitionsMax: number | null;
        durationSeconds: number | null;
        weightKg: number | null;
        restSeconds: number | null;
      }>;
    };
    actual: {
      sets: Array<{
        setLogId: string;
        status: "completed" | "skipped" | "incomplete";
        repetitions: number | null;
        durationSeconds: number | null;
        weightKg: number | null;
        rpe: number | null;
        athleteComment: string;
        updatedAt: string;
      }>;
    };
    deviations: ReviewDeviation[];
  }>;
  sessionContext: {
    overallComment: Availability<string | null>;
    discomfort: Availability<DiscomfortSignal[]>;
    subjectiveMetrics: Availability<SessionSubjectiveMetrics | null>;
  };
  existingFeedback: ReviewFeedback[];
  capabilities: {
    canRead: boolean;
    canSendInitialFeedback: boolean;
    canSendFollowUp: boolean;
    canResolveManually: boolean;
  };
  anomalies: ReviewAnomaly[];
  dataAvailability: {
    assignmentSnapshot: "ready" | "unavailable";
    logs: "ready" | "partial" | "unavailable";
    sessionContext: "ready" | "unsupported" | "unavailable";
  };
};
```

`ReviewDeviation` is a derived factual projection such as `planned_repetitions_not_met`, `load_changed`, `set_skipped` or `log_missing`. It must contain source IDs and values, not a judgement such as good/bad, readiness or adherence score.

`Availability<T>` must distinguish absent data from unsupported persistence and query failure. A nullable discomfort array would incorrectly claim that the athlete reported no discomfort when the product currently has no canonical field to record it.

## 8. Drawer versus full-page boundary

The full page remains canonical for all direct links and detailed inspection. The Drawer is optional acceleration, never the only route to a Review.

### 8.1 Drawer may complete the task when all are true

- the exact canonical read model is loaded;
- AttentionItem is open and capabilities permit the command;
- assignment snapshot and logs are fully available;
- structured discomfort is known and empty;
- there are no missing-data anomalies;
- the session has at most 4 exercises and 16 prescribed sets;
- there is at most 1 non-safety deviation;
- combined athlete comments are at most 300 characters;
- the trainer chooses a short acknowledgement or writes a concise explicit response.

The numeric thresholds are presentation constants, not domain rules. They should be validated in pilot testing and changed centrally in one pure `classifyReviewPresentation` projector.

### 8.2 Full page is required when any are true

- discomfort or another safety-relevant original signal exists;
- discomfort availability is `unsupported` or `unavailable` and the product has not explicitly accepted that limitation;
- assignment snapshot or logs are partial/unavailable;
- more than 4 exercises or 16 sets;
- more than 1 meaningful deviation;
- multiple skipped/incomplete exercises;
- long exercise/session comment context;
- detailed set comparison is necessary;
- the AttentionItem is stale/resolved and history/follow-up context must be inspected;
- the trainer explicitly selects `Открыть подробный разбор`.

No AI scoring participates in this decision. If the classifier cannot prove that compact review is sufficient, it selects the full page.

### 8.3 Current rollout implication

Canonical discomfort persistence is absent. Therefore the safe initial production Drawer should be either:

- preview-only with promotion to the full page; or
- command-enabled only after an explicit Product decision that R2B v1 classifies using available facts despite the unsupported discomfort channel.

The architecture recommends preview-only first.

## 9. Planned-versus-actual contract

The minimal canonical comparison is set-based and identity-preserving.

| Fact | Canonical source | Current support |
| --- | --- | --- |
| Planned set identity/order/kind | Assignment set snapshot copied to WorkoutSetLog | Supported |
| Planned repetitions range | WorkoutSetLog planned fields | Supported |
| Planned duration | WorkoutSetLog `planned_duration_seconds` | Supported, currently dropped by UI projector |
| Planned load | WorkoutSetLog `planned_weight_kg` | Supported |
| Planned rest | Assignment exercise/set snapshot | Stored, not exposed by current review read model |
| Actual repetitions/duration/load | WorkoutSetLog actual fields | Supported |
| Actual RPE | WorkoutSetLog `rpe` | Supported |
| Skipped/incomplete | WorkoutSetLog and ExerciseLog status | Supported |
| Added sets | Nullable source set permits representation, but no canonical command creates them | Unsupported workflow |
| Exercise comment | `athlete_note` column | Stored field exists; current save command does not write it |
| Set comment | `athlete_comment` | Supported |
| Source timestamps | Session/ExerciseLog/SetLog timestamps | Stored; not exposed in current types |

Plan and actual must be paired by stable set identity/order, never only by array index after filtering. A skipped set remains a row with `status=skipped` and null actual values; it must not become zero repetitions. Added sets must not be shown until a canonical creation command exists.

## 10. Comments, skips and discomfort contract

### 10.1 Comments

- preserve set comments verbatim with exact set and exercise source IDs;
- preserve exercise note separately from set comments;
- do not concatenate all comments into one canonical string;
- a presentation summary may quote or group them without replacing originals;
- `zero_result_reason` is a special completion reason, not a general session comment.

The MVP documents require an overall completion comment, but the PostgreSQL model does not currently provide a general field or command for it. That is a confirmed schema/command gap.

### 10.2 Skips

- `skipped` and `incomplete` remain distinct;
- Exercise status is a server-maintained aggregate of set statuses (`lib/server/workout-sessions/workout-session-repository.ts:257-270`);
- skipped state must include the source set/exercise and original optional comment;
- no zero-value synthesis and no moral judgement.

### 10.3 Discomfort

The demo model has `ReviewSignal.kind="discomfort"`, original text, area and severity, but PostgreSQL has no corresponding field/table/write command. Production completion currently creates only an optional `partial_completion` priority reason (`lib/server/workout-sessions/workout-session-repository.ts:214-220`).

Required future contract:

- athlete-owned original text;
- optional body area and athlete-selected severity, if Product accepts those fields;
- source timestamp and Session linkage;
- copied as an Attention priority reason without replacing original text;
- displayed first in Drawer and Page;
- never transformed into diagnosis or hidden behind AI summary.

This requires a separate schema and client-completion design decision. R2B must report `discomfort: unsupported` until then.

## 11. Feedback and follow-up rules

1. `detailed` and `acknowledgement` are two kinds of the same `TrainerFeedback` entity and command.
2. Initial feedback resolves the exact open AttentionItem only after feedback insertion succeeds.
3. Sent feedback is immutable; database grants expose SELECT/INSERT but not UPDATE (`database/migrations/0008_workout_review_feedback.up.sql:159-166`).
4. A correction is a `follow_up` linked to one existing feedback ID.
5. Drawer and Page render the same feedback IDs, author, kind, body and timestamp.
6. Athlete surfaces read the same IDs through `ReviewRepository.listAthleteFeedback` and `/api/client/feedback`.
7. Opening either presentation creates no feedback and changes no Attention status.
8. Notification transport is not the source of truth. Provider failure cannot roll back feedback or resolution.
9. Current web-role cannot read worker-owned notification outbox delivery status. A late delivery warning needs a separate safe status projection; it is not part of R2B Core.

## 12. Draft handoff

Current demo behavior persists the entire local workflow, including synthetic feedback and resolution, in `sessionStorage` (`components/trainer-os/workout-review/review-store.ts:181-196`). Production must not reuse that state model.

Proposed same-tab handoff:

1. Drawer owns an ephemeral `ReviewDraft` containing only `sessionId`, `attentionItemId`, mode, body and `updatedAt`.
2. On `Открыть подробный разбор`, generate a random `draftToken`.
3. Store the draft under a namespaced `sessionStorage` key with a short TTL, for example 30 minutes.
4. Navigate to the canonical Page with the existing R2A.3 `flow` plus a separate opaque `draftToken`; never put draft text in the URL.
5. Page loads and authorizes the canonical Review first, then accepts the draft only if Session and Attention IDs match.
6. Draft remains editable and is not a `TrainerFeedback` until explicit submit succeeds.
7. Clear the draft on successful persistence or explicit discard. Do not clear it on network failure.

This browser-session draft is transport/recovery state, not domain source of truth and never authorizes a command. Reload within the same tab may recover it; cross-device and durable drafts are not promised.

If Product requires cross-tab/device draft durability, a server draft entity and API would be required. That is a separate feature and migration, not part of R2B Core.

The `draftToken` must remain outside `TrainerWorkflowContext`; draft transport is presentation state and is not a blocker requiring mutation of the accepted R2A.3 contract.

## 13. Attention resolution

| Action | Feedback row | Attention result | Receipt |
| --- | --- | --- | --- |
| Detailed feedback | Insert `detailed` | Exact open item -> resolved | Feedback ID |
| Short acknowledgement | Insert `acknowledgement` | Exact open item -> resolved | Feedback ID |
| Manual close | None | Exact open item -> resolved | Manual resolution ID |
| Follow-up | Insert `follow_up` | Already resolved; no new transition | Follow-up ID |
| Open Drawer/Page | None | No change | None |

The current schema has `open`, `resolved`, `archived`; it does not have persisted `in_progress` (`database/migrations/0007_workout_session_execution.up.sql:4`, `:104-122`). R2B must not create a local `in_progress` domain state. A typing draft is presentation state only.

Resolution is accepted only from the canonical repository lock on exact trainer, AttentionItem and Session (`lib/server/reviews/review-repository.ts:261-266`). Drawer callbacks must never remove queue items locally before the command response and revalidation.

## 14. Permissions matrix

| Operation | Trainer requirement | Relation/row requirement | Failure behavior |
| --- | --- | --- | --- |
| Load Review | Authenticated active trainer | Session, Attention and feedback visible under active relation RLS | Generic not-found/unavailable; no foreign data |
| Send initial feedback | Active trainer | Exact open owned AttentionItem; completed Session; active relation | 401/403/404/409 without payload disclosure |
| Send follow-up | Active trainer | Parent feedback belongs to same Session/Attention; relation active | 422/403/404 |
| Manual resolve | Active trainer | Exact open owned AttentionItem; active relation | 403/404/409 |
| Read athlete feedback | Active athlete | `athlete_user_id=current_actor` | Own records only |
| Use transition envelope | None by itself | Athlete/Session/Attention revalidated from Review | Invalid context falls back safely |

Evidence:

- Session SELECT allows the athlete or linked trainer only while relation is active (`database/migrations/0007_workout_session_execution.up.sql:202-209`).
- Attention SELECT/UPDATE is trainer-owned and requires an active relation (`database/migrations/0007_workout_session_execution.up.sql:279-283`; `database/migrations/0008_workout_review_feedback.up.sql:143-157`).
- feedback INSERT verifies all Attention/Session/relation identities (`database/migrations/0008_workout_review_feedback.up.sql:87-103`).
- R2A.3 rejects mismatched athlete, Session and Attention context (`lib/server/trainer-workflow/trainer-workflow-transition-service.ts:159-178`).

Drawer and Page must call the same GET and command endpoints. Presentation props, queue position, draft token and query strings are never permission evidence.

## 15. Entry/transition/return map

```text
Dashboard review item
  -> optional production Drawer(sessionId, flow)
       -> acknowledge/send/resolve
            -> same transition response + shared receipt
            -> Next item | Profile(training) | Queue
       -> Open full review
            -> /trainer/review/{sessionId}?flow=...&draftToken=...

Profile Training pending review
  -> optional Drawer(sessionId, flow)
       -> same commands and receipt
       -> return to same athlete, tab=training, changed block focus
       -> or promote to full Page with draft

Direct /trainer/review/{sessionId}
  -> canonical Page
  -> safe profile(training) fallback or Dashboard when athlete cannot be derived
```

Rules:

- the Drawer does not need its own canonical route;
- the full page remains addressable, reload-safe and shareable inside the authorized product;
- promotion preserves the exact R2A.3 envelope unchanged;
- returning from either presentation uses the server-provided transition, not `router.back()`;
- success receipt, server-selected next item and all-calm behavior are identical;
- source Attention reason remains until the command canonically resolves it;
- no local callback is allowed to pretend that resolution succeeded.

## 16. Loading, empty, error and stale states

| State | Shared behavior | Drawer | Full page |
| --- | --- | --- | --- |
| Loading | No stale facts/actions | Compact skeleton | Existing page skeleton |
| Session unavailable | Generic source unavailable; no fallback Session | Close + queue/page link | Safe not-found state |
| Assignment unavailable | Mark comparison unavailable; no invented plan | Promote to page | Show actual-only state |
| Partial logs | Preserve available facts and explicit partial status | Force full page | Show partial sections |
| No logs | Allow response only with clear no-log state | Force full page | Existing no-data explanation |
| Attention resolved | Show persisted history; disable initial send | Receipt/history; follow-up if allowed | Same |
| Feedback already sent | Reload same IDs and records | Same shared panel | Same shared panel |
| Relation suspended/ended | Fail closed; retain unsent local draft | Close/reauth guidance | Generic unavailable |
| Permission denied | No athlete/session disclosure | Generic unavailable | Generic unavailable |
| Concurrent initial submit | `409`, reload persisted state | Shared stale handler | Shared stale handler |
| Feedback save failed | Keep text and idempotency key | Inline retry | Inline retry |
| Persisted, delivery unavailable | Domain success remains | Non-blocking warning only if safe status exists | Same |
| Return/revalidation failure | Do not roll back domain success | Receipt with refresh warning | Same |
| Invalid context | Server safe fallback | Do not trust source props | Existing direct fallback |

The current GET is all-or-nothing and cannot distinguish assignment/log partial failures. Producing `dataAvailability` requires a query-service refactor, not a migration.

## 17. Performance/N+1 assessment

Current detail loading is bounded and not N+1:

- one query for source/Attention/Assignment/Athlete;
- one query for Session;
- one query for all exercises;
- one query for all sets using an array of exercise IDs;
- one query for all Session feedback.

Current queue loading is one grouped set-based query and prioritizes `discomfort` when that reason exists (`lib/server/reviews/review-repository.ts:83-124`).

Recommended R2B query refactor:

1. one actor-scoped transaction for the whole Review snapshot;
2. one source/header query;
3. one set-based exercise/set query or the existing two-query hydration;
4. one feedback query;
5. derive deviations, counts and presentation facts once in a shared pure projector;
6. keep `Cache-Control: no-store` and R2A.3 `revalidatePath`; do not add another cache system.

The Drawer should initially consume the same complete response. A compact database query is premature until payload size and query plans are measured. If later needed, it must remain a projection depth of the same `ReviewReadModel`, with explicit `dataAvailability`, not a second Drawer model.

Before optimization, capture `EXPLAIN (ANALYZE, BUFFERS)` for small and large completed Sessions. Existing indexes cover Session exercises, exercise sets, queue and feedback ordering (`database/migrations/0007_workout_session_execution.up.sql:124-128`; `database/migrations/0008_workout_review_feedback.up.sql:47-49`).

## 18. Component reuse map

| Component/module | Decision | Rationale |
| --- | --- | --- |
| `CanonicalWorkoutReview` | Keep as full-page shell | Canonical production surface |
| `ReviewSessionSummary` | Reuse after canonical typing | Already presentation-neutral visually |
| `ReviewSignals` | Reuse after canonical projector | Good exception-first hierarchy |
| `ReviewClientComment` | Reuse for original comments | Must receive structured originals, not flattened source |
| `ReviewExerciseList` | Reuse after set contract expansion | Supports compact and detailed presentation |
| private `CanonicalFeedbackPanel` | Extract to shared production action panel | Already uses canonical endpoints and stale behavior |
| `ReviewCompletionReceipt` | Extract/reuse | Must be identical in Drawer/Page |
| `WorkoutReviewDrawer` Sheet shell | Keep | Useful compact presentation boundary |
| Drawer runtime selector | Replace in production | Demo facts are not canonical |
| `ReviewFeedbackPanel` | Do not reuse for production actions as-is | Calls local demo workflow and exposes fake AI draft |
| `useReviewWorkflow` / `review-store` | Keep demo-only, then retire separately | Synthetic feedback/resolution and sessionStorage domain state |
| `review-model.ts` seeds | Keep demo-only, never import into canonical server contract | Contains unsupported goal, AI, discomfort and previous-result facts |
| `WorkoutReviewPage` demo component | Demo-only | Separate environment branch |
| old `workout-review-client.tsx` | Legacy removal candidate after separate import audit | Inline hardcoded implementation |
| `TrainerWorkflowTransitionService` | Reuse unchanged | Accepted R2A.3 contract |

The desired shared client layer is approximately:

```text
useCanonicalReview(sessionId, flow)
CanonicalReviewSummary
CanonicalReviewSignals
CanonicalReviewExerciseResults
CanonicalReviewActionPanel
CanonicalReviewCompletionReceipt
```

Page and Drawer compose these differently but do not own separate fetch, command or status logic.

## 19. Whether API or migrations are required

### R2B Core convergence

- **New API route:** no.
- **Existing API response changes:** likely additive fields and `dataAvailability`; keep the current route.
- **New command endpoint:** no.
- **New migration:** no.
- **R2A.3 change:** no.

### Confirmed gaps beyond Core

| Gap | Existing storage | Needed work |
| --- | --- | --- |
| General session comment | None; `zero_result_reason` is special-case only | Schema + athlete completion command/UI |
| Structured discomfort | None | Schema + command/UI + priority projection |
| Session subjective metrics | Per-set RPE only | Product decision; schema if session-level metrics accepted |
| Exercise note write | Column exists, no current write input | API/service extension; no schema change |
| Added sets | Schema shape partially permits, no creation command | Product/command decision; possible constraints review |
| Late notification warning | Worker-only outbox status | Safe read projection/API; possibly schema/policy work |

These gaps must not block read/action convergence itself. They do block claiming that the Drawer can safely auto-classify every Review as simple versus complex.

## 20. Implementation sequence

1. Freeze the canonical `ReviewReadModel`, availability taxonomy and factual deviation types.
2. Refactor the Review query into one actor-scoped consistent transaction; add fields already stored in Assignment/Session/log snapshots.
3. Add PostgreSQL tests for the expanded model, unavailable source, resolved state and suspended relation.
4. Replace the production mapper to demo `WorkoutReviewDetails` with canonical pure projectors.
5. Extract the production feedback/manual-resolution controller, panel and completion receipt from `CanonicalWorkoutReview`.
6. Make the full Page consume the extracted shared components without visual redesign; run regressions.
7. Add a production Drawer adapter that calls the existing GET route with the exact Session and R2A.3 envelope.
8. Implement the ephemeral same-tab draft bridge and lossless Drawer -> Page promotion.
9. Initially ship Drawer as preview/promotion-only while discomfort remains unsupported, or record an explicit Product acceptance before enabling commands.
10. When enabled, route Drawer commands through the same endpoints and render the same returned transition/receipt.
11. Add Page/Drawer contract tests, stale/idempotency tests and cross-presentation E2E.
12. Measure query plans and payloads before considering a compact read depth.
13. Retire demo/local Review actions from production imports in a separate cleanup change.
14. Design session comments/discomfort as a separate schema stage if accepted.

Each step should be independently reviewable. Do not mix the schema extension for discomfort with the first Page/Drawer convergence commit.

## 21. Acceptance criteria

R2B implementation is accepted when:

1. Page and Drawer load one canonical `ReviewReadModel` for the same Session ID.
2. No production Review component imports demo selectors, demo runtime commands or seeded review facts.
3. Route/query ID substitution cannot reveal another athlete's Session.
4. Assignment, Session, Athlete and Attention identities are re-derived server-side.
5. Planned and actual sets remain paired by stable source identity.
6. Planned reps/duration/load/rest and actual reps/duration/load/RPE are represented without invented values.
7. skipped, incomplete and missing data remain distinct.
8. Unsupported discomfort/session context is explicit, not interpreted as empty.
9. Drawer closes simple Reviews only under one central deterministic classifier.
10. Complex, safety-relevant and unavailable-data Reviews promote to the full page.
11. Drawer -> Page preserves draft and R2A.3 context without putting draft text in URL.
12. Draft is not persisted as TrainerFeedback before explicit send.
13. Detailed feedback and acknowledgement use the same canonical endpoint.
14. Retry uses the same idempotency key and creates no duplicate feedback.
15. Concurrent resolution reloads persisted feedback/resolution in both surfaces.
16. Follow-up creates a new linked feedback record; sent feedback is never edited.
17. Athlete sees the same feedback IDs, kinds, body and timestamps.
18. Opening either surface does not resolve AttentionItem.
19. Resolution occurs only after canonical persistence succeeds.
20. Both surfaces use the same completion receipt and R2A.3 next/profile/queue destinations.
21. Suspended relation and permission failure expose no source data.
22. Review detail queries remain constant-count with no exercise/set N+1.
23. Existing R1, R2A, PostgreSQL, canonical E2E, lint and production build tests pass.
24. Mobile Drawer remains keyboard accessible, focus-contained and provides a full-page escape.
25. No Program, Progress, Motivation, AI diagnosis or automatic feedback enters the workflow.

## 22. Risks and open decisions

| ID | Risk/decision | Recommendation |
| --- | --- | --- |
| R2B-01 | Structured discomfort is demo-only, while product principles treat it as safety-relevant. | Keep Drawer preview-only until accepted schema/write path or explicit MVP limitation. |
| R2B-02 | Overall session comment required by product documents is not canonically stored. | Design with discomfort/session context in a separate stage. |
| R2B-03 | Current read uses three transactions and can observe concurrent state inconsistently. | Move to one actor-scoped read transaction before Drawer rollout. |
| R2B-04 | Production model is projected through a demo-shaped type with hard-coded facts. | Reverse dependency: canonical model first, presentation projectors second. |
| R2B-05 | Draft in browser session is not cross-device durable. | Accept same-tab guarantee for MVP; server drafts only if pilot proves need. |
| R2B-06 | Drawer complexity thresholds are not validated with trainers. | Start conservative and measure promotion rate, completion time and mistakes. |
| R2B-07 | Notification delivery failure is worker-owned and not visible to web read model. | Separate safe delivery-status design; never resend feedback automatically. |
| R2B-08 | `workoutId` route naming hides that the identifier is Session ID. | Keep URL for compatibility; rename internal variables/types first. |
| R2B-09 | Demo and legacy Review implementations remain in repository. | Remove only after production Drawer parity and import audit, in a separate cleanup. |
| R2B-10 | Current Page duplicates action UI instead of using a shared component. | Extract without redesign before connecting Drawer. |
| R2B-11 | Exercise `athlete_note` exists but is not written by current progress command. | Do not present it as supported until the athlete command is extended. |
| R2B-12 | Added-set state exists in demo vocabulary but not canonical commands. | Mark unsupported and exclude from classifier until designed. |

Founder/Product decisions required before command-enabled Drawer rollout:

1. Is a preview-only Drawer acceptable for the first R2B release?
2. Must structured discomfort be implemented before acknowledgement can be sent from Drawer?
3. Are the initial compact thresholds (4 exercises, 16 sets, 1 deviation, 300 comment characters) acceptable for pilot validation?
4. Is same-tab, 30-minute draft recovery sufficient for MVP?
5. Should manual resolution be available in Drawer, or only on the full page?

## 23. Change-boundary confirmation

This task produced only this architecture document:

- `docs/workout-review-r2b-architecture-v1.md`

No application code, UI, route, API handler, PostgreSQL schema, migration, mock data, configuration or test was changed for R2B. R2A.3 transition behavior was not modified. No commit was created.
