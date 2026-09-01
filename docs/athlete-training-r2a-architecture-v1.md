# R2A: canonical athlete training architecture

Status: `proposed`
Date: 2026-08-30
Scope: trainer-facing `Тренировки` tab inside the canonical athlete profile
Implementation status: architecture only; no production code, API, UI, or migration changes are part of R2A analysis.

## 1. Executive verdict

R2A can be built on the current PostgreSQL workout lifecycle without introducing a second domain model:

`WorkoutTemplate -> WorkoutTemplateRevision -> WorkoutAssignment snapshot -> WorkoutSession -> Exercise/Set logs -> AttentionItem -> TrainerFeedback`.

All entities required for the first canonical Training tab are production-backed. The missing part is a trainer-facing, athlete-scoped query projection and a complete transition contract. The current production Training tab is only a two-card R1 placeholder over `currentAssignment` and `lastSession`; the visually richer legacy tab is prototype-only and derives state from mock strings.

The proposed model from the task should **not** be accepted as written. A single nested `current.assignment/session/attentionItem/feedback` incorrectly implies that all four objects belong to one workout. In reality, the athlete may simultaneously have:

- an active session for assignment A;
- an open review item for completed assignment B;
- a future assignment C;
- feedback already sent for session D.

R2A should therefore expose independent canonical facts (`activeExecution`, `nextAssignment`, `pendingReview`, `latestFeedback`) and derive one `focus` from them. History should be one row per assignment because the database permits at most one session for an assignment.

No new domain tables are required. Optional indexes may be justified later by `EXPLAIN (ANALYZE, BUFFERS)` after the actual history query exists. Suspended-relation history is a separate product and privacy decision because current workout RLS permits trainer reads only while the relation is active.

## 2. Current implementation map

### Canonical production path

| Surface | Current implementation | Evidence | Assessment |
| --- | --- | --- | --- |
| Athlete profile route | Uses `AthleteProfileQueryService` outside demo mode and selects tabs from `?tab=` | `app/trainer/clients/[clientId]/page.tsx:16-34`, `app/trainer/clients/[clientId]/page.tsx:51-53` | Canonical route and URL tab contract exist |
| Profile frame | Header, entry context, current state, permissions and one CTA | `lib/server/athlete-profile/athlete-profile-query-service.ts:17-52`, `components/trainer/canonical-athlete-profile.tsx:71-138` | Reusable R1 frame |
| Training tab | Shows only current assignment and last completed session | `components/trainer/canonical-athlete-profile.tsx:284-314` | Production-backed but incomplete R1 placeholder |
| Current snapshot | One SQL statement finds relation, selected next work, latest completed session, latest feedback and first open review | `lib/server/athlete-profile/athlete-profile-repository.ts:77-160` | Useful critical projection, not a full Training read model |
| Client assignment list | Reads `/api/workout-assignments` | `components/client/canonical-client-home.tsx:28-51`, `app/api/workout-assignments/route.ts:11-24` | Production-backed |
| Client execution | Resolves exact `assignmentId` or `sessionId`, starts/saves/completes through canonical APIs | `components/client/canonical-workout-execution.tsx:85-109`, `components/client/canonical-workout-execution.tsx:150-227` | Production-backed |
| Trainer review | Path parameter is a canonical session ID; review reads canonical session/log/attention/feedback facts | `app/trainer/review/[workoutId]/page.tsx:22-24`, `components/trainer/canonical-workout-review.tsx:57-77` | Production-backed |
| Quick assignment | Canonical dialogs POST to `/api/workout-assignments`; builder only opens assignment for a published template | `components/trainer-os/workout-template-builder/canonical-builder-assignment-dialog.tsx:36-49`, `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:383-400` | Production-backed command path |

### Existing inconsistencies relevant to R2A

1. `AthleteProfileRepository` accepts `active` and `suspended` relations, but the route layout redirects unless the relation is active. Evidence: `lib/server/athlete-profile/athlete-profile-repository.ts:155-159`; `app/trainer/clients/[clientId]/layout.tsx:17-23`.
2. R1 selects an active assignment primarily by scheduled date, while the client default session selection uses the most recently started active session returned by the session repository. Evidence: `lib/server/athlete-profile/athlete-profile-repository.ts:105-119`; `lib/server/workout-sessions/workout-session-repository.ts:63-68`; `components/client/canonical-workout-execution.tsx:95-100`.
3. The schema guarantees one session per assignment, but it does not guarantee one active session per athlete. Evidence: `database/migrations/0007_workout_session_execution.up.sql:6-31`. R2A must define deterministic behavior for multiple active sessions.
4. The canonical review route parses `from`, `attentionItem`, and `returnTo`, but discards them when rendering `CanonicalWorkoutReview`. Its visible return link is fixed to `/trainer/attention`. Evidence: `app/trainer/review/[workoutId]/page.tsx:12-24`; `components/trainer/canonical-workout-review.tsx:79-88`.
5. The profile review CTA hard-codes `tab=overview` as its return target. R2A needs `tab=training`. Evidence: `lib/server/athlete-profile/athlete-capabilities-service.ts:14-22`.
6. Assignment `cancelled` and session `abandoned` exist in schema/types, but no application command currently transitions either entity. Evidence: `database/migrations/0005_workout_templates_and_assignments.up.sql:7-10`; `lib/server/workout-sessions/workout-session-types.ts:1`; repository search finds no product update for these statuses.

## 3. Confirmed production-backed entities

### WorkoutTemplate and revision

- Templates are trainer-owned and have `draft`, `published`, and `archived` lifecycle states: `database/migrations/0005_workout_templates_and_assignments.up.sql:1-29`.
- Revisions have stable UUIDs and a unique `(template_id, revision_number)` identity: `database/migrations/0005_workout_templates_and_assignments.up.sql:31-49`.
- Canonical assignment creation accepts only the trainer's current published revision: `lib/server/workouts/workout-repository.ts:228-246`.
- Builder production code publishes before opening assignment, including the publish-and-assign path: `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:300-329`, `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:383-400`.

### WorkoutAssignment snapshot

- Stable ID: `workout_assignments.id`.
- Stable provenance: `source_template_id`, `source_revision_id`, and `source_revision_number`.
- Immutable working prescription: title, instruction, trainer note, exercises, and per-set values are copied into assignment-owned snapshot tables: `database/migrations/0005_workout_templates_and_assignments.up.sql:75-125`; `lib/server/workouts/workout-repository.ts:278-349`.
- Later template edits do not change athlete assignments; this is covered by PostgreSQL tests: `tests/backend-foundation/workout-flow-postgres.test.ts:79-129`; richer per-set independence is covered by `tests/backend-foundation/workout-builder-postgres.test.ts:127-170`.
- Creation requires an active trainer-athlete relation and a published, non-empty template revision: `database/migrations/0005_workout_templates_and_assignments.up.sql:247-272`.

### WorkoutSession and logs

- Stable IDs: session, exercise log, and set log UUIDs; logs retain stable links to assignment snapshot entities: `database/migrations/0007_workout_session_execution.up.sql:6-87`.
- `UNIQUE (assignment_id)` means an assignment can have no more than one session in total, therefore no more than one active session: `database/migrations/0007_workout_session_execution.up.sql:30`.
- Starting a session is idempotent and returns the existing session after an assignment conflict: `lib/server/workout-sessions/workout-session-repository.ts:75-136`.
- Only the athlete owns progress and completion commands; optimistic version checks and durable idempotency receipts protect concurrent writes: `lib/server/workout-sessions/workout-session-repository.ts:139-173`, `lib/server/workout-sessions/workout-session-repository.ts:175-236`.
- Database tests confirm one resumable session, durable progress, version conflict behavior, and exact cross-actor isolation: `tests/backend-foundation/workout-session-postgres.test.ts:77-136`, `tests/backend-foundation/workout-session-postgres.test.ts:188-237`.

### AttentionItem

- Completion writes one `workout_review` item linked to the exact session; uniqueness is `(source_session_id, item_type)`: `database/migrations/0007_workout_session_execution.up.sql:104-122`.
- Completion and attention creation occur in the same database transaction: `lib/server/workout-sessions/workout-session-repository.ts:175-235`.
- A completed-with-omissions session receives `partial_completion`; the current implementation does not derive `discomfort` during completion, although other fixtures/projections support that reason: `lib/server/workout-sessions/workout-session-repository.ts:207-220`.
- Tests confirm one item under concurrent completion retries: `tests/backend-foundation/workout-session-postgres.test.ts:138-185`.

### TrainerFeedback and review resolution

- Feedback has stable links to trainer, athlete, relation, source session, and AttentionItem: `database/migrations/0008_workout_review_feedback.up.sql:4-21`.
- A normal feedback command inserts immutable athlete-visible feedback and resolves the open AttentionItem in the same transaction: `lib/server/reviews/review-repository.ts:168-225`.
- Manual resolution stores a trainer-private reason, creates no feedback, and resolves the item: `lib/server/reviews/review-repository.ts:228-258`.
- Follow-up feedback is allowed only after resolution and must reference feedback from the same attention/session lineage: `lib/server/reviews/review-repository.ts:181-190`.
- Tests confirm exact canonical facts, isolation, idempotent resolution, athlete visibility, immutability, follow-up linking, and manual privacy: `tests/backend-foundation/workout-review-postgres.test.ts:104-224`.

### Shared stable IDs across trainer and athlete surfaces

| Identity | Trainer surface | Athlete surface | Verdict |
| --- | --- | --- | --- |
| `athleteUserId` | Profile path and review details | Actor ownership | Shared canonical UUID |
| `assignmentId` | Profile snapshot/review details | `/client/workouts?assignment=` and session start | Shared canonical UUID |
| `sessionId` | `/trainer/review/{sessionId}` | `/client/workouts?session=` and feedback filter | Shared canonical UUID |
| `attentionItemId` | Review queue/profile entry/review commands | Not exposed as an athlete command | Canonical trainer work-item UUID |
| `feedbackId` | Review details/follow-up parent | Athlete feedback response | Shared immutable UUID |

The end-to-end canonical test exercises the same assignment/session across trainer and athlete contexts and verifies cross-athlete denial: `tests/e2e-canonical/three-role-pilot.spec.ts:95-185`.

## 4. Prototype and mock zones

The old `components/trainer-os/client-profile/training-tab.tsx` is visual and interaction evidence only:

- It receives `AthleteProfile` from the demo runtime rather than a PostgreSQL read model: `components/trainer-os/client-profile/training-tab.tsx:13-21`.
- Review state is inferred from localized text containing `"ждёт"`: `components/trainer-os/client-profile/training-tab.tsx:22-24`, `components/trainer-os/client-profile/training-tab.tsx:355-369`.
- It displays programs, adherence percentages, current/target weight, top exercise results, and timeline comments that are outside R2A canonical facts: `components/trainer-os/client-profile/training-tab.tsx:63-113`, `components/trainer-os/client-profile/training-tab.tsx:216-289`.
- Its workout history is supplied by `components/trainer-os/client-profile/mock-data.ts:426` and `components/trainer-os/client-profile/mock-data.ts:789`.
- `QuickAssignDrawer` is demo-runtime-owned; non-demo builder uses `CanonicalBuilderAssignmentDialog`: `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:450`.
- Demo client workout/runtime surfaces remain intentionally separate. Non-demo `/client/workouts` selects `CanonicalWorkoutExecution`: `app/client/workouts/page.tsx:6-14`.

Reusable prototype ideas are limited to information hierarchy: current plan versus history, compact history rows, a visible review state, and direct links to existing commands. Prototype metrics and string-derived statuses must not be ported.

## 5. Proposed AthleteTrainingReadModel

Recommended contract:

```ts
type AthleteTrainingReadModel = {
  scope: {
    athleteUserId: string;
    relationId: string;
    relationStatus: "active" | "suspended";
    readAt: string;
  };

  critical: {
    focus: AthleteTrainingFocus;
    pendingReview: PendingReviewSummary | null;
    activeExecution: ActiveExecutionSummary | null;
    nextAssignment: AssignmentSummary | null;
    latestFeedback: FeedbackReceiptSummary | null;
    counts: {
      pendingReviews: number;
      activeSessions: number;
      upcomingAssignments: number;
    };
    availableActions: AthleteTrainingAction[];
  };

  history: {
    items: AthleteTrainingHistoryItem[];
    pageInfo: {
      endCursor: string | null;
      hasNextPage: boolean;
    };
  };

  dataAvailability: {
    hasCurrentWork: boolean;
    hasHistory: boolean;
    historyStatus: "ready" | "unavailable";
    anomalies: Array<"multiple_active_sessions" | "source_unavailable">;
  };

  permissions: {
    canReadTraining: boolean;
    canAssign: boolean;
    canOpenSession: boolean;
    canReview: boolean;
    canSendFeedback: boolean;
    canResolveAttention: boolean;
    canEditSessionFacts: false;
  };
};
```

`AthleteTrainingFocus` should be a discriminated union carrying only the IDs needed for its action:

```ts
type AthleteTrainingFocus =
  | { kind: "relation_unavailable" }
  | { kind: "review_required"; attentionItemId: string; sessionId: string; reason: "discomfort" | "partial_completion" | "standard" }
  | { kind: "session_in_progress"; assignmentId: string; sessionId: string }
  | { kind: "assignment_scheduled"; assignmentId: string }
  | { kind: "no_next_assignment" }
  | { kind: "no_current_work" };
```

Why this is safer than the initially proposed tree:

1. It does not falsely join feedback from an old session to the next assignment.
2. It makes multiple open review items and active sessions observable through counts.
3. It keeps the operational focus small while history remains independently pageable.
4. It preserves R1 frame ownership; the Training tab consumes the same facts instead of recomputing header state in React.
5. `feedback_sent` is a receipt/history fact, not a permanent primary state. Otherwise every athlete who ever received feedback would remain in that state forever.

## 6. Current-state projection and priorities

The projection must be server-side, deterministic, and shared by the R1 header and R2A tab.

| Priority | Condition | Focus | Primary trainer action |
| --- | --- | --- | --- |
| 1 | Relation or athlete capability is not active | `relation_unavailable` | None |
| 2 | At least one open AttentionItem exists | `review_required` | Open exact review session |
| 3 | No open review; at least one active session exists | `session_in_progress` | Read exact session/result context; no athlete mutation |
| 4 | No review/active session; an available assignment with no session exists | `assignment_scheduled` | Open assignment details |
| 5 | Active relation; no current assignment/session | `no_next_assignment` | Quick Assign / builder |
| 6 | Facts are readable but no actionable category matches | `no_current_work` | None |

Conflict rules:

- `discomfort` changes the tone/reason inside `review_required`; it does not create a second lifecycle.
- Multiple open reviews: select discomfort first, then oldest completion, then AttentionItem UUID; expose total count. This matches the existing queue ordering in `lib/server/reviews/review-repository.ts:102-105`.
- Multiple active sessions across assignments: select latest `started_at`, then session UUID; expose an anomaly and count. The database does not currently prevent this.
- Multiple unstarted assignments: select earliest `scheduled_for`, then oldest `created_at`, then assignment UUID. This preserves the idea of "next" and makes ties stable.
- An open review outranks an active/future workout because it is already trainer-owned work. The unrelated next assignment remains visible as secondary data.
- `feedback_sent` is shown on its exact history row and may be shown as a short return receipt. It must not outrank `no_next_assignment` or an open review.
- Opening the tab or source session never resolves an AttentionItem. Resolution remains owned by feedback or manual resolution commands.

Current R1 already uses relation -> discomfort -> review -> no assignment -> active -> scheduled ordering: `lib/server/athlete-profile/athlete-current-state-projector.ts:16-74`. R2A should correct the `no assignment` versus active-session ambiguity by deriving each category from independent sets, not from one preselected assignment.

## 7. History item contract

One history row represents one assignment lineage. The session is nullable because a cancelled assignment may never start; a completed assignment always has at most one session.

```ts
type AthleteTrainingHistoryItem = {
  assignment: {
    id: string;
    title: string;             // title_snapshot
    scheduledFor: string;
    status: "available" | "cancelled";
    createdAt: string;
  };
  session: null | {
    id: string;
    status: "active" | "completed" | "completed_with_omissions" | "abandoned";
    startedAt: string;
    completedAt: string | null;
    version: number;
  };
  completion: null | {
    completedSets: number;
    skippedSets: number;
    incompleteSets: number;
    totalSets: number;
  };
  attention: null | {
    id: string;
    status: "open" | "resolved" | "archived";
    priorityReasons: string[];
    resolvedAt: string | null;
    resolutionKind: "feedback" | "manual" | "unknown" | null;
  };
  feedback: {
    count: number;
    latestFeedbackId: string | null;
    latestKind: "detailed" | "acknowledgement" | "follow_up" | null;
    latestSentAt: string | null;
  };
  links: {
    assignment: string | null;
    session: string | null;
    review: string | null;
  };
};
```

Allowed derived labels are limited to direct mappings such as `scheduled`, `in_progress`, `awaiting_review`, `reviewed_with_feedback`, `resolved_without_feedback`, `cancelled`, and `abandoned`. R2A must not invent adherence, load, calorie, progress, readiness, or best-result metrics.

The trainer-private manual reason may be used in the trainer review detail but should not be required in a compact history row. It must never be added to an athlete-facing model. `TrainerReviewDetails` already keeps it trainer-side: `lib/server/reviews/review-types.ts:57-85`; the athlete feedback endpoint returns feedback only: `lib/server/reviews/review-repository.ts:156-165`.

## 8. Query and service ownership

### Recommended ownership

Create a dedicated `AthleteTrainingQueryService` and `AthleteTrainingRepository` in the existing athlete-profile server boundary. They are read-only composition layers; they do not own workout commands.

Suggested paths for implementation:

```text
lib/server/athlete-profile/athlete-training-types.ts
lib/server/athlete-profile/athlete-training-repository.ts
lib/server/athlete-profile/athlete-training-query-service.ts
lib/server/athlete-profile/athlete-training-projector.ts
```

### Query split

1. Keep the R1 frame query critical and available for every tab.
2. Load R2A critical facts in one set-based athlete/relation-scoped SQL statement: top open review plus count, top active session plus count, next unstarted assignment plus count, and latest feedback.
3. Load the first history page independently. A history failure must not erase identity, current state, or primary action.
4. Load additional pages by cursor through a read-only route or server action when implementation begins.
5. Use aggregate subqueries/CTEs for set counts, attention resolution, and latest feedback. Do not call `WorkoutSessionRepository.listAthlete()` for history: it hydrates exercises and sets separately for every session (`lib/server/workout-sessions/workout-session-repository.ts:63-68`, `lib/server/workout-sessions/workout-session-repository.ts:278-299`) and is both over-detailed and N+1-shaped for a summary list.

### Pagination

Cursor pagination is required because workout history is unbounded. Offset pagination would duplicate or skip rows when a new session completes between requests.

Recommended terminal-history ordering:

```text
sort_at = COALESCE(session.completed_at, assignment.cancelled_at, session.started_at, assignment.created_at)
ORDER BY sort_at DESC, assignment.id DESC
cursor = opaque encoding of (sort_at, assignment.id)
```

Upcoming unstarted assignments are not terminal history. The critical query returns the selected next assignment and count; a future expansion may add a separately pageable upcoming list without changing history semantics.

### Consistency

- Return `readAt` for diagnostics and stale-state messaging.
- Include session `version`, AttentionItem status/resolved timestamp, and assignment status in the projection.
- R1 frame and R2A critical state should share one projector or one underlying snapshot contract. React components must not derive competing priorities.

## 9. Command ownership

The Training tab introduces no commands.

| Action | Canonical owner | Existing path | R2A behavior |
| --- | --- | --- | --- |
| Quick Assign from saved template | `WorkoutService.createAssignment` / `PostgresWorkoutRepository.createAssignment` | `POST /api/workout-assignments` | Open existing canonical dialog or builder; refresh on success |
| Publish and assign | `WorkoutBuilderService` then assignment API | Builder canonical path | Never assign an unsaved draft |
| Open assignment | Read surface only | Client currently uses `?assignment={id}` | Add/choose trainer read destination during implementation; no mutation |
| Start/resume/save/complete session | `WorkoutSessionService` | `/api/workout-sessions*` | Athlete-owned; trainer tab must never issue these commands |
| Open Workout Review | `ReviewService.findReview` | `/trainer/review/{sessionId}` | Link exact session and preserve return context |
| Send feedback | `ReviewService.sendFeedback` | `POST /api/trainer/reviews/{sessionId}/feedback` | Existing command, idempotent |
| Resolve without feedback | `ReviewService.resolveManually` | `POST /api/trainer/reviews/{sessionId}/resolve` | Existing command, private reason |

Assignment cancellation and session abandonment are not command-ready today. R2A may render those persisted statuses if present, but must not display enabled commands for them until explicit services, authorization, audit, tests, and product semantics exist.

## 10. Permissions matrix

| Actor/relation | Assignment | Session/logs | Attention | Feedback | Commands |
| --- | --- | --- | --- | --- | --- |
| Active linked trainer | Read linked facts | Read linked facts | Read own items | Read/send linked feedback | Assign, review, feedback, manual resolve |
| Suspended linked trainer | Identity/profile policy allows read, but workout RLS denies training facts | Denied | Denied | Denied | None |
| Ended/former trainer | Denied | Denied | Denied | Denied | None |
| Unrelated trainer | Denied | Denied | Denied | Denied | None |
| Athlete owner | Read own assignments, including historical | Read own sessions/logs; mutate only active own session | No trainer queue read | Read own feedback | Start/save/complete while capability/relation checks permit |

Evidence:

- Assignment trainer reads require an active relation; athlete reads own assignments: `database/migrations/0005_workout_templates_and_assignments.up.sql:232-245`.
- Session trainer reads require an active relation; athlete reads own sessions: `database/migrations/0007_workout_session_execution.up.sql:202-209`.
- Only athlete-owned active sessions can update: `database/migrations/0007_workout_session_execution.up.sql:225-227`.
- Attention reads/updates and feedback trainer reads/inserts require an active relation: `database/migrations/0007_workout_session_execution.up.sql:279-293`; `database/migrations/0008_workout_review_feedback.up.sql:78-103`, `database/migrations/0008_workout_review_feedback.up.sql:143-157`.
- Former trainer loss of history and athlete retention are covered in tests: `tests/backend-foundation/workout-flow-postgres.test.ts:171-215`; `tests/backend-foundation/workout-session-postgres.test.ts:231-234`; `tests/backend-foundation/workout-review-postgres.test.ts:185-188`.

Privacy notes:

- `trainer_note` on assignment is currently athlete-visible and rendered as the trainer's comment: `components/client/canonical-client-home.tsx:131-136`. It is not a private field despite its database name.
- `attention_manual_resolutions.reason` is trainer-private and must never enter client reads: `database/migrations/0008_workout_review_feedback.up.sql:170-172`.
- Athlete comments and actual set facts are shared source facts used by trainer review; trainer cannot edit them.
- Every R2A query must run through `withActorTransaction` so RLS remains the final isolation boundary.

## 11. Entry, transition, and return map

### Canonical profile entry

```text
/trainer/clients/{athleteUserId}?tab=training
```

Optional validated context:

```text
from=dashboard|clients|review|history
attentionItem={uuid}
session={uuid}
```

Rules:

1. Neutral entry has no `attentionItem`; it still shows canonical open work if one exists, but no "reason for entry" strip.
2. Attention entry validates that the item belongs to the trainer and athlete. Open, resolved, and archived states are displayable; an invalid/inaccessible item degrades to an explicit unavailable source state rather than leaking data.
3. `session` selects/anchors an exact history row only after the same athlete/relation authorization check.
4. Tab links preserve validated source, AttentionItem, and selected session. Current R1 already preserves source and AttentionItem: `components/trainer/canonical-athlete-profile.tsx:361-365`.

### Review transition

```text
/trainer/review/{sessionId}
  ?from=profile
  &attentionItem={attentionItemId}
  &returnTo={encoded /trainer/clients/{athleteId}?tab=training...}
```

The canonical review component must receive normalized entry context. Today the route parses it but the canonical component ignores it, which is the main return-context gap.

After feedback or manual resolution:

- keep the exact review visible with its resolved state;
- return to `tab=training` using a validated internal path;
- refresh critical facts and the affected history row;
- display the former AttentionItem as closed if it was the source of entry;
- never resolve merely because the tab or review was opened.

### Quick Assign transition

```text
/trainer/builder
  ?athleteId={athleteUserId}
  &from=quick-assign
  &returnTo={encoded /trainer/clients/{athleteId}?tab=training...}
```

After assignment creation, return to or refresh the same Training tab and select the new assignment. Current production builder accepts `returnTo` but only the demo drawer applies the safe return helper; canonical assignment currently closes in place: `app/trainer/builder/page.tsx:12-21`; `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:450`.

Only internal `/trainer/` return paths are valid. The existing helper provides a starting rule: `components/trainer-os/demo-runtime/flow-context.ts:24-26`. R2A implementation should move/duplicate this behavior into a non-demo server-safe boundary.

## 12. Loading, empty, error, stale, and long-data states

| State | Required behavior |
| --- | --- |
| Frame loading | Preserve existing profile loading shell; no mock data |
| Critical loading | Stable skeleton for current-work region; history can load separately |
| Empty current + empty history | Explain that no training has been assigned; show Assign only when permitted |
| Empty current + non-empty history | Show `no_next_assignment` focus and retained history |
| Current assignment + empty history | Show assignment and a local history empty state |
| Critical error | Keep profile identity/return navigation; show retryable local error for Training |
| History error | Keep critical current state; retry history independently |
| Long history | Cursor-paginated "load more"; no full-session log hydration in the list |
| Multiple active sessions | Show selected latest execution plus a visible data anomaly/count; do not silently discard others |
| Closed source AttentionItem | Show closed entry receipt, no review CTA, and refreshed current focus |
| Missing/inaccessible source | Show source unavailable without athlete/session details not otherwise authorized |
| Session completed elsewhere | On focus/refetch, replace active state with pending review and invalidate session action |
| Feedback sent elsewhere | Command receives conflict, refetches review and Training facts, preserves unsent draft until user decides |
| Assignment cancelled elsewhere | Remove from current/upcoming; retain a cancelled history row if authorized |
| New assignment created elsewhere | Revalidate critical state; deterministic next-assignment order decides selection |

Core entities use `ON DELETE RESTRICT`, so normal source deletion is prevented: assignments reference template/revision, sessions reference assignment, AttentionItems reference session, and feedback references both session and AttentionItem (`database/migrations/0005_workout_templates_and_assignments.up.sql:75-82`; `database/migrations/0007_workout_session_execution.up.sql:6-11`, `database/migrations/0007_workout_session_execution.up.sql:104-110`; `database/migrations/0008_workout_review_feedback.up.sql:4-13`). "Unavailable" is therefore expected mainly from authorization/lifecycle changes or corrupt administrative intervention, not ordinary product deletion.

## 13. Component reuse map

| Component/concept | Decision | Reason |
| --- | --- | --- |
| `CanonicalAthleteProfile` frame/header | Reuse unchanged initially | R1 identity and current-state shell are canonical |
| `ProfileTabs` URL behavior | Reuse; preserve extra validated context | Already canonical and accessible |
| `AttentionContextStrip` | Reuse/extract | Already distinguishes open versus closed source context |
| `AthleteCurrentStateProjector` | Extend/refactor to consume shared R2A critical snapshot | Avoid header/tab disagreement |
| `CanonicalWorkoutReview` | Reuse as destination | Owns exact session facts and feedback commands |
| `CanonicalFeedbackPanel` | Do not embed in Training history | Keep mutation surface in Review; history links to it |
| `CanonicalBuilderAssignmentDialog` | Reuse for published-template assignment | Uses canonical assignment API |
| `CanonicalRosterAssignmentDialog` | Reuse only after deciding whether inline template creation belongs in profile | It can create a published template then assignment, but is broader than simple Quick Assign |
| Prototype `WorkoutHistoryPanel` | Use hierarchy only; rewrite against R2A contract | Current statuses and metrics are mock/string-derived |
| Demo `QuickAssignDrawer` | Do not reuse in production | Demo runtime owns its data and commands |
| Client canonical execution components | Do not embed; link by shared IDs | Trainer is read/review-only for athlete execution facts |

## 14. Migration decision

### Required for R2A v1

No new domain migration is required. Existing schema already represents every fact in the requested lifecycle and enforces stable identity, snapshot provenance, one session per assignment, one review item per session/type, feedback linkage, idempotency, and RLS.

### Potential later migration

After implementing the real set-based queries and measuring them, a performance-only migration may add indexes such as:

```text
workout_assignments (relation_id, scheduled_for, created_at, id)
workout_sessions (relation_id, completed_at DESC, id DESC)
```

Exact index shape must follow the final SQL and `EXPLAIN`; it should not be guessed during architecture.

### Product decision that could require migration

If the founder decides a suspended trainer-athlete relation must retain trainer-visible workout history, current workout/attention/feedback RLS must be deliberately changed and tested. R1 identity policy already allows suspended relations (`database/migrations/0012_athlete_profile_read_model.up.sql:29-56`), but workout policies remain active-only. This is not a hidden R2A implementation detail; it changes privacy semantics.

No Program, ProgramAssignment, Motivation, Progress, achievement, title, or reputation migration belongs to R2A.

## 15. Implementation sequence

1. Accept the R2A state priority, including the policy for multiple active sessions and suspended relations.
2. Add pure `athlete-training-types` and projector tests before SQL/UI.
3. Add an athlete-scoped repository critical query under actor transaction/RLS.
4. Add a set-based cursor-paginated history query with aggregate completion, attention, and feedback state.
5. Add PostgreSQL tests for unrelated trainer, ended/suspended relation, multiple assignments, one session per assignment, open/resolved review, feedback, manual resolution, and pagination stability.
6. Add `AthleteTrainingQueryService`; make R1 header and R2A tab use the same focus projector.
7. Replace only the canonical `TrainingTab` placeholder; keep R1 header and other tabs outside the change.
8. Wire canonical Quick Assign success to refresh/return to `?tab=training`.
9. Pass normalized entry/return context into `CanonicalWorkoutReview` and validate internal return paths.
10. Add local loading/error/empty/stale states and cursor loading.
11. Add canonical E2E for neutral entry, attention entry, exact session, assign return, review return, stale resolution, cross-athlete denial, and mobile layout.
12. Run PostgreSQL suite, lint, production build, and focused canonical E2E before an implementation commit.

## 16. Acceptance criteria

### Data and architecture

- Training production path contains no mock, demo adapter, Supabase legacy read, or localStorage domain fact.
- Every row is traceable to one canonical assignment UUID and at most one canonical session UUID.
- Assignment title/prescription comes from the assignment snapshot, not the current template revision.
- Header and tab show the same primary state for the same database snapshot.
- Open review, active execution, next assignment, and latest feedback may coexist without being attached to the wrong lineage.
- History is cursor-paginated and does not hydrate all exercise/set details per row.

### Authorization and privacy

- An unrelated or former trainer cannot infer another athlete's assignment, session, attention, feedback, counts, or existence through R2A.
- Trainer commands remain limited to assignment and review owners; athlete session facts remain athlete-owned.
- Manual resolution reason never appears in client APIs or client UI.
- Invalid `session`, `attentionItem`, and `returnTo` inputs fail closed.

### Workflow

- Neutral `/trainer/clients/{id}?tab=training` shows current facts without a fabricated entry reason.
- Attention entry opens the same tab, identifies the exact source item, and links to the exact session review.
- Review/feedback/manual resolution returns to the same athlete and tab, with refreshed closed/open state.
- Quick Assign cannot assign an unsaved draft and returns to the same athlete/tab after success.
- Opening Training or Review does not resolve AttentionItem.
- Session completion in another tab becomes review-required after refresh/revalidation.
- Feedback conflict and already-resolved AttentionItem recover by reloading canonical data.

### Quality

- Focused PostgreSQL tests cover query authorization and pagination.
- Canonical browser tests cover desktop and mobile without horizontal overflow or React overlays.
- Lint and production build pass when implementation is complete.

## 17. Risks and open decisions

### Founder/product decisions

1. **Suspended relation history:** should a trainer retain read-only training history while the relation is suspended? Current database answer is no; R1 identity intent appears broader.
2. **Multiple active athlete sessions:** should R2A merely surface the anomaly, or should a later command/schema rule prevent starting a second active session across assignments?
3. **Upcoming depth:** is one next assignment plus count enough for v1, or must the tab show the full upcoming queue?
4. **Assignment detail destination:** should trainers inspect assignment prescription inline, in a modal, or on a dedicated read-only route? The canonical trainer detail route does not currently exist.
5. **Cancellation/abandonment:** are these v1 commands or display-only latent states? They currently have schema states but no application lifecycle.
6. **Inline quick creation:** should profile Quick Assign choose only published templates, or retain the roster dialog's ability to create and publish a simple new template before assignment?

### Engineering risks

- The current R1 current-work query can disagree with client session selection when multiple sessions are active.
- Current profile route access and repository relation policy disagree on suspended relations.
- Canonical review currently drops parsed return context.
- Current session list hydration is unsuitable for history and would become an N+1/performance issue if reused.
- Existing indexes are not designed specifically for relation-scoped cursor history; measure before adding indexes.
- `feedback_sent` can easily become a misleading sticky state if modeled as primary instead of an exact-session receipt.
- The database makes core entities effectively non-deletable through FK restrictions, but lifecycle-based invisibility must still have explicit stale UX.

## 18. Change confirmation

This R2A pass creates only this architecture document.

- No production code was changed.
- No UI was implemented.
- No API route was added or changed.
- No PostgreSQL migration or schema change was created.
- No existing product document was rewritten.
- No Git commit was created.
