# R3A: production client workout flow architecture audit

Date: 2026-09-02
Mode: discovery / architecture only
Repository state audited: `codex/r2d8-template-authoring-convergence` at `d371368fdc15df66db0b77170abd19f62cab90ad`

## 1. Executive verdict

The repository already has one credible PostgreSQL workout reality from assignment through trainer feedback:

`WorkoutAssignment -> WorkoutSession -> WorkoutExerciseLog / WorkoutSetLog -> AttentionItem -> TrainerFeedback`.

The core persistence chain is materially stronger than the current client experience. One Assignment can create at most one Session, progress commands use optimistic concurrency and durable receipts, and completion plus exactly one Review AttentionItem is atomic. Canonical Trainer Review reads the same Session, Assignment, exercise/set identities, actual values, comments and RPE that the athlete writes. Feedback returns with the same `TrainerFeedback.id` and `source_session_id`.

R3 is therefore a convergence and hardening project, not a second workout implementation. The current production client pages are only partially converged:

- `/client/me` and `/client/workouts` use canonical PostgreSQL APIs when `NEXT_PUBLIC_DEMO_MODE=false`;
- the client selects current work and fallback entities in the browser instead of receiving an authoritative read model;
- Assignment reads expose an old simplified exercise DTO and omit canonical per-set/range/duration structure;
- Assignment and Session lists are unbounded, and Session list hydration is N+1 per Session;
- browser retries generate new idempotency keys, so unknown outcomes do not benefit from the server's durable receipts;
- `/client/progress` and `/client/activity` redirect into legacy Supabase `/history`;
- overall session comment, structured discomfort and subjective session metrics are not persisted canonically;
- no canonical client history or progress read model exists.

**Readiness verdict:** the database domain and trainer Review are ready to support R3B-R3F. The production client read contracts, retry protocol, route convergence and relation-lifecycle policy are not yet ready for an external pilot without hardening.

## 2. Evidence labels

| Label | Meaning |
| --- | --- |
| **CONFIRMED** | Directly established by executable code, schema, route imports or tests. |
| **INFERRED** | Strong conclusion from multiple confirmed facts; not itself encoded as a named contract. |
| **GAP** | Required behavior has no complete canonical implementation. |
| **PROTOTYPE** | Useful UX/domain evidence that is explicitly demo, local state or legacy Supabase. |
| **UNKNOWN** | Repository evidence is insufficient; a product or policy decision is required. |

File references are repository-relative and use current line numbers at the audited HEAD.

## 3. Current route and import map

### Production behavior with `NEXT_PUBLIC_DEMO_MODE=false`

| Route | Surface and import | Auth boundary | Data / mutation source | Status and reachability |
| --- | --- | --- | --- | --- |
| `/client/me` | `app/client/me/page.tsx` -> `CanonicalClientHome` | Server layout requires active athlete capability | `/api/workout-assignments`, `/api/workout-sessions`; PostgreSQL | **CONFIRMED canonical candidate.** Production selects this component at `app/client/me/page.tsx:444-448`; reachable after athlete login. |
| `/client/workouts` | `app/client/workouts/page.tsx` -> `CanonicalWorkoutExecution` | Same server athlete layout | canonical Assignment, Session, progress, completion and feedback APIs | **CONFIRMED canonical execution candidate** (`app/client/workouts/page.tsx:6-13`). |
| `/client/progress` | route-level redirect | Same server athlete layout before redirect | redirects to legacy Supabase `/history` | **GAP / mixed production path** (`app/client/progress/page.tsx:7-14`). |
| `/client/activity` | route-level redirect | Same server athlete layout before redirect | redirects to legacy Supabase `/history` | **GAP / mixed production path** (`app/client/activity/page.tsx:7-14`). |
| `/client/settings` | client page | Server athlete layout, then separate Supabase client auth/profile checks | Supabase `profiles` reads and updates | **Legacy-backed route inside canonical namespace** (`app/client/settings/page.tsx:7-15,93-140,177-201`). |
| `/client/library` | placeholder page | Server athlete layout | no production data | **Explicit placeholder**, not workout execution (`app/client/library/page.tsx:4-12`). |
| `/client/dashboard` | client redirect | Server athlete layout, then Supabase auth check | redirects to `/client/me` | **Compatibility route with redundant identity system** (`app/client/dashboard/page.tsx:10-21`). |

`app/client/layout.tsx:3-8` is the canonical namespace boundary: outside demo mode it calls `requireCapability("athlete", "/client/me")`.

### Legacy and prototype surfaces

| Route | Actual implementation | Dependencies | Production reachability verdict | Disposition |
| --- | --- | --- | --- | --- |
| `/today` | redirect to `/client/me` | none | Direct URLs converge | **COMPATIBILITY REDIRECT LATER:** already redirects (`app/(client)/today/page.tsx:1-4`). |
| `/today/select` | redirect to `/client/me` | none | Direct URLs converge | **COMPATIBILITY REDIRECT LATER:** already redirects (`app/(client)/today/select/page.tsx:1-4`). |
| `/workout/free` | in-memory free-workout mock | React state and static arrays only | Directly reachable without an explicit auth check; no canonical links found | **PRESERVE AS PROTOTYPE EVIDENCE**, remove from production import graph later (`app/(client)/workout/free/page.tsx:15-59,183-191`). |
| `/history` | old history page | Supabase auth and `workout_logs`, max 300 | Reachable from production `/client/progress` and `/client/activity` redirects | **MIGRATE CALLER**, then isolate (`app/(client)/history/page.tsx:21-53,80-116`). |
| `/check-in` | profile/weight check-in | Supabase `profiles`, `weight_logs`, `workout_logs`, Telegram links | Reachable from legacy profile, not from canonical home/execution | **PRESERVE AS PROTOTYPE EVIDENCE** pending separate profile/progress work. |
| `/client/[id]` | old all-in-one execution/profile | Supabase tables, `localStorage`, Telegram completion API | Not linked by canonical home; still directly addressable | **REMOVE FROM PRODUCTION IMPORT GRAPH LATER** after evidence extraction (`app/(client)/client/[id]/page.tsx:205-332,442-551,1227`). |
| `/client/[id]/program/[programId]` | purchase/program path | Supabase programs/templates and payment API | Legacy program links only | Outside R3; preserve until Program decision. |
| `/programs`, `/profile`, `/explore` | route-group client surfaces | Supabase and legacy navigation | Separate legacy product area | Outside R3; do not treat as canonical workout evidence. |

The `(client)` route-group layout adds `ClientNav`, which independently reads Supabase auth and profile role (`components/client-nav.tsx:17-55`). It does not wrap the physical `app/client/**` canonical pages. `MobileCabinetNav` points to canonical-looking URLs but is currently rendered by legacy `/history`, `/check-in`, `/profile` and `/programs`, not by `CanonicalClientHome` or `CanonicalWorkoutExecution` (`components/client/mobile-cabinet-nav.tsx:9-16`; import search).

### Effective production transition graph

```text
login / capability destination
  -> /client/me
     -> GET /api/workout-assignments
     -> GET /api/workout-sessions
     -> /client/workouts?assignment={ownAssignmentId}
        -> POST /api/workout-sessions
        -> /client/workouts?session={ownSessionId} (state only; URL is not replaced today)
        -> POST /api/workout-sessions/{sessionId}/progress
        -> POST /api/workout-sessions/{sessionId}/complete
        -> GET /api/client/feedback?sessionId={sessionId}
     -> /client/workouts?session={ownSessionId}

/client/progress -> /history -> Supabase workout_logs
/client/activity -> /history -> Supabase workout_logs
/today, /today/select -> /client/me
```

There is no production link from the canonical home to Progress, Activity, Settings or canonical history. The canonical workout component links back only to `/client/me` (`components/client/canonical-workout-execution.tsx:246-251`).

## 4. Assignment read

### Current contract

- **CONFIRMED:** `GET /api/workout-assignments` requires an authenticated actor with active athlete capability, then calls `WorkoutService.listAthleteAssignments` (`app/api/workout-assignments/route.ts:18-30`).
- **CONFIRMED:** the repository selects only rows where `athlete_user_id = actor.userId` and `status = 'available'`, ordered by scheduled date and creation date ascending (`lib/server/workouts/workout-repository.ts:536-546`). PostgreSQL RLS independently permits the athlete only their own rows (`database/migrations/0005_workout_templates_and_assignments.up.sql:232-245`).
- **CONFIRMED:** an Assignment is an independent immutable snapshot of template/revision identity, title, instruction, trainer note, schedule and exercise/set prescriptions (`database/migrations/0005_workout_templates_and_assignments.up.sql:75-125`; `database/migrations/0006_workout_builder_lifecycle.up.sql:104-185`). Session start copies set prescription facts from Assignment snapshots, not the live Template (`lib/server/workout-sessions/workout-session-repository.ts:98-128`).
- **CONFIRMED:** trainer note, scheduled date and source revision identity are exposed by the current API DTO (`lib/server/workouts/workout-types.ts:40-57`).
- **GAP:** the API DTO exposes only `sets`, a single `repetitions`, target weight, rest and trainer note. It omits assignment exercise IDs, assignment set IDs, range/duration, set kind, per-set overrides and superset facts even though PostgreSQL stores them (`lib/server/workouts/workout-repository.ts:617-636`). `repetitions_snapshot` is nullable in current schema while `WorkoutExerciseInput.repetitions` remains typed as required `number` (`database/migrations/0015_workout_template_command_hardening.up.sql:42-47`; `lib/server/workouts/workout-types.ts:1-9`).

### State semantics

The only persisted Assignment statuses are `available` and `cancelled` (`database/migrations/0005_workout_templates_and_assignments.up.sql:7-10`). There is no Assignment `in_progress` or `completed` transition. Those states are derived from the associated Session:

- available + no Session: not started / scheduled;
- available + active Session: in progress;
- available + terminal Session: completed history;
- cancelled: omitted by the current athlete list;
- missed/overdue: no persisted state or canonical projection.

`CanonicalClientHome` receives all available Assignments and all Sessions, joins them with `sessions.find`, and renders every Assignment in one list (`components/client/canonical-client-home.tsx:28-51,123-164`). It does not define one authoritative current or next Assignment. Completed Assignments remain in the same list because Assignment status remains available.

### Answers

**A. Best canonical entry today:** `/client/me` is the correct product entry, while `/client/workouts?assignment=...` and `?session=...` are contextual detail/execution entries.

**B. PostgreSQL-only viability:** yes. Both pages can be built entirely from canonical Assignment, Session and Feedback entities. No Template or Supabase read is required.

**C. Gaps:** exact/current read model, rich Assignment snapshot DTO, explicit current/next/multiple-active semantics, bounded pagination/history separation, cancelled-state UX, stale/foreign-ID state, and a server-owned selection contract.

## 5. Session lifecycle

### Persisted states and invariants

| Product state | Persisted representation | Current command support |
| --- | --- | --- |
| Not started | no `workout_sessions` row for Assignment | supported |
| In progress | Session `status='active'` | start, exact/list read, progress save |
| Completed | `completed`, `completed_at` present | completion supported |
| Completed with omissions | `completed_with_omissions`, `completed_at` present | completion supported |
| Abandoned | `abandoned`, no `completed_at` | schema/type only; no service/API command found |
| Cancelled | Assignment `cancelled` | schema/repository read semantics; no client command |

Schema constraints enforce terminal timestamp consistency and `UNIQUE (assignment_id)` (`database/migrations/0007_workout_session_execution.up.sql:6-31`). Session identity is immutable, version must advance exactly by one, and a terminal Session cannot be updated (`database/migrations/0007_workout_session_execution.up.sql:130-150`).

### Start and resume

- `POST /api/workout-sessions` validates same-origin, active athlete capability, UUID, timezone and idempotency key (`app/api/workout-sessions/route.ts:32-50`; `lib/server/workout-sessions/workout-session-service.ts:101-107`).
- The repository verifies own available Assignment plus active trainer-athlete relation, inserts with `ON CONFLICT (assignment_id) DO NOTHING`, then returns the existing Session (`lib/server/workout-sessions/workout-session-repository.ts:75-136`).
- A concurrent duplicate cannot create a second Session; PostgreSQL tests assert two starts return the same ID and one row (`tests/backend-foundation/workout-session-postgres.test.ts:77-104`).
- The stored start idempotency hash is not checked against a replay payload. The effective contract is stronger and simpler: **one Session per Assignment, return it on any later start**.
- Multiple active Sessions for different Assignments are allowed. No athlete-wide unique active invariant exists. Trainer R2A already models this as `activeExecution.items` plus `multiple_active_sessions` conflict (`lib/server/athlete-profile/athlete-training-types.ts:92-104`). The client silently chooses the first active Session from a descending `started_at` list (`components/client/canonical-workout-execution.tsx:85-100`; repository ordering at `lib/server/workout-sessions/workout-session-repository.ts:63-68`).

**Answers:** a practical start-or-resume command exists; one Assignment cannot have multiple Sessions; duplicate starts cannot create a second row; two-tab creation is database-safe. The response status is always `201`, even when returning an existing Session, and no explicit `created/replayed` receipt is exposed.

## 6. Exercise and set logs

### Identity chain

```text
WorkoutAssignment.id
  -> WorkoutAssignmentExercise.id
     -> WorkoutAssignmentExerciseSet.id (canonical set snapshot; may be absent for old assignments)
  -> WorkoutSession.id (unique assignment_id)
     -> WorkoutExerciseLog.id + assignment_exercise_id
        -> WorkoutSetLog.id + source_assignment_set_id + set_key
```

Stable client command identity is `WorkoutSetLog.id`; trainer reconciliation uses both `setLogId` and `sourceAssignmentSetId`. Exercise identity is `WorkoutExerciseLog.id` plus `assignmentExerciseId`. Position must not be used as identity. Review explicitly refuses positional substitution when source identity is missing (`lib/server/reviews/review-repository.ts:187-243`).

### Persisted facts

| Fact | Schema | Command write | Client UI | Trainer Review |
| --- | --- | --- | --- | --- |
| Actual repetitions | yes | yes | yes | yes |
| Actual duration | yes | yes | yes when duration prescribed | yes |
| Actual weight | yes | yes | yes | yes |
| RPE 1-10 | yes | yes | yes | yes |
| Set status | pending/completed/skipped/incomplete | yes | completed/skipped only | yes |
| Set athlete comment | yes | yes | yes | yes |
| Exercise athlete note | yes | no canonical write path | no | read model marks empty value unsupported |
| Set timestamps | yes | automatic | not exposed in client DTO | Review reads them |

Evidence: schema at `database/migrations/0007_workout_session_execution.up.sql:33-87`; service validation at `lib/server/workout-sessions/workout-session-service.ts:69-87`; public types at `lib/server/workout-sessions/workout-session-types.ts:4-29`; Review projection at `lib/server/reviews/review-repository.ts:203-243,638-675`.

### State and value semantics

- `skipped` forces repetitions, duration, weight and RPE to `null`; the comment may remain (`lib/server/workout-sessions/workout-session-service.ts:75-87`).
- `incomplete` is distinct from `skipped`; the API accepts it, but current UI does not issue it directly. Completion converts all remaining `pending` sets to `incomplete` (`lib/server/workout-sessions/workout-session-repository.ts:203-210`).
- `null` means absent. Zero is accepted as an explicit actual repetitions/duration/weight value. A `completed` set requires a non-null repetitions or duration value, so zero currently qualifies and is counted as completed. **GAP:** product semantics for zero-result completed sets are not explicitly decided.
- `source_assignment_set_id` is nullable for generated compatibility logs when an older Assignment has no per-set snapshot (`lib/server/workout-sessions/workout-session-repository.ts:113-128`). Review degrades those rows to `session_snapshot` and reports an identity anomaly rather than inventing a match (`tests/backend-foundation/workout-review-postgres.test.ts:231-252`).
- No canonical commands add/delete/reorder Session sets or exercises. Prescription identity and position are immutable (`database/migrations/0007_workout_session_execution.up.sql:153-181`). Added sets are therefore unsupported; deleted/reordered execution facts are not representable.

## 7. Persistence and idempotency

| Command | Endpoint | Transaction / concurrency | Durable retry | Current browser behavior |
| --- | --- | --- | --- | --- |
| Start/resume | `POST /api/workout-sessions` | transaction; unique Assignment; conflict returns existing | row uniqueness, but no typed replay receipt | creates fresh key per click; duplicate still converges by Assignment |
| Save progress | `POST /api/workout-sessions/{id}/progress` | row lock, `expectedVersion`, set updates, aggregate refresh, version, receipt and audit in one transaction | same actor/kind/key + same request returns Session; changed payload is 409 | new key on every attempt; unknown outcome becomes version conflict instead of receipt recovery |
| Complete | `POST /api/workout-sessions/{id}/complete` | row lock; completion, omissions, Attention, receipt, audit and outbox in one transaction | same key/request safely replays | new key on every attempt; unknown outcome retry can return terminal 404 until reload |

The receipt key is unique by actor, command kind and key hash; request hash mismatch raises idempotency conflict (`database/migrations/0007_workout_session_execution.up.sql:89-102`; `lib/server/workout-sessions/workout-session-repository.ts:238-254`). Version mismatch raises `409` at the API (`app/api/workout-sessions/[sessionId]/progress/route.ts:32-44`). PostgreSQL tests cover concurrent identical save, changed-payload conflict and stale-version conflict (`tests/backend-foundation/workout-session-postgres.test.ts:106-132`).

Persisted logs survive refresh because the Session is rehydrated from PostgreSQL. There is no fake local saved state. However:

- the client loads all Sessions rather than exact Session GET even when `sessionId` is present (`components/client/canonical-workout-execution.tsx:85-100`);
- a 409 only tells the athlete to refresh; there is no refetch/reconcile flow (`components/client/canonical-workout-execution.tsx:51-55`);
- the UI does not freeze payload + key across an uncertain request (`components/client/canonical-workout-execution.tsx:172-225`);
- batch progress loops one SQL update per set, up to 20, so the repository has O(number of submitted sets) statements (`lib/server/workout-sessions/workout-session-repository.ts:154-163`). Current UI submits one set, limiting impact.

Two tabs are not last-write-wins: the first versioned command wins and the second receives 409. This is correct server behavior but incomplete client recovery UX.

## 8. Mobile UI reuse audit

| Existing element | Classification | Evidence / required adaptation |
| --- | --- | --- |
| Planned vs actual per set; reps/duration, weight, RPE and comment inputs | **KEEP** | Uses canonical `WorkoutSetLog` and real progress endpoint (`components/client/canonical-workout-execution.tsx:427-489`). |
| Explicit Save and Skip commands | **KEEP** | Honest persistence boundary; no fake autosave. Preserve stable set ID. |
| Saved/skipped/incomplete labels and global success/error notices | **ADAPT** | Add per-set dirty/saving/saved/conflict state and receipt-aware retry. |
| Sticky completion action and confirmation dialog | **KEEP / ADAPT** | Good mobile anchor and omission summary; extend only after R3A-05/06 decisions (`components/client/canonical-workout-execution.tsx:317-378`). |
| All exercises and all set forms in one long page | **ADAPT** | Functional for short workouts; weak for long sessions and keyboard navigation. No active exercise focus. |
| Previous/next exercise or set navigation | **GAP** | Not present in canonical UI. |
| 2-column mobile field grid | **ADAPT** | Fits 390 px structurally, but standard Inputs/icon buttons are not explicitly verified as >=44 px and sticky footer/virtual keyboard interaction has no targeted test. |
| Demo focused exercise tabs, progress bar, previous/next, 56 px numeric inputs and save-and-advance | **DEMO EVIDENCE ONLY** | Strong interaction evidence but calls demo runtime commands (`components/client/runtime/client-workout-focus.tsx:36-99,103-207,215-280`). Reuse composition ideas, not data/state code. |
| Demo overall comment, discomfort, completion summary and history | **DEMO EVIDENCE ONLY** | No canonical persistence (`components/client/runtime/client-runtime-workouts.tsx:35-76,111-145,171-197`). |
| Legacy `/client/[id]` execution and Telegram completion | **REMOVE FROM CANONICAL** | Separate Supabase `workout_logs`, localStorage custom exercises and unauthenticated notification path. |

The production canonical flow has a real 390 px E2E for one-set save/completion and no horizontal overflow (`tests/e2e-canonical/three-role-pilot.spec.ts:210-239`), but it does not cover long workouts, soft keyboard behavior, conflict recovery or repeated unknown-outcome commands.

## 9. Completion

`POST /api/workout-sessions/{sessionId}/complete` accepts `expectedVersion`, `idempotencyKey`, `zeroResultConfirmed` and `zeroResultReason` (`lib/server/workout-sessions/workout-session-service.ts:127-138`). It:

1. locks the athlete-owned Session;
2. checks receipt, active status and expected version;
3. requires explicit confirmation if there are zero `completed` set statuses;
4. changes remaining pending sets to incomplete;
5. recomputes exercise statuses;
6. derives `completed` or `completed_with_omissions`;
7. updates Session and version;
8. inserts one AttentionItem;
9. stores receipt, audit event and notification outbox event;
10. commits once.

All steps are inside one `withDatabaseTransaction` callback (`lib/server/workout-sessions/workout-session-repository.ts:175-235`). Therefore:

- **A:** under this command, Session cannot commit completed without AttentionItem; a failure rolls back both.
- **B:** same-key retry cannot create a second AttentionItem; a different-key concurrent retry is blocked by the Session lock/terminal state, and schema also enforces uniqueness.
- **C:** `UNIQUE (source_session_id, item_type)` enforces at most one Review item (`database/migrations/0007_workout_session_execution.up.sql:104-122`).
- **D:** server-side unknown outcome is recoverable with the same key and request; current client does not retain them, so browser recovery is incomplete.
- **E:** client receives the terminal Session, renders the persisted result and says it was sent to the trainer; the athlete cannot see `attentionItemId` because Attention RLS is trainer-only. The PostgreSQL test explicitly observes null for athlete and a value for trainer (`tests/backend-foundation/workout-session-postgres.test.ts:168-182`).

Assignment status is not changed on completion. Aggregate exercise statuses are derived from set statuses. No AttentionItem is created for a missed Assignment, an active incomplete Session or an abandoned Session. `completed_with_omissions` does create Review attention with `partial_completion` reason.

## 10. Session context and discomfort

| Context | Classification | Evidence |
| --- | --- | --- |
| Per-set athlete comment | **SUPPORTED AND WRITTEN** | progress command and set log column |
| Exercise note | **SCHEMA EXISTS BUT COMMAND DOES NOT WRITE** | `athlete_note` exists; Review reports write path unconfirmed |
| Zero-result reason | **SUPPORTED AND WRITTEN** | Session column and completion command; Review displays it |
| Overall session comment | **UNSUPPORTED** | no schema/type/command field |
| Discomfort/pain free text | **DEMO ONLY** | demo runtime only |
| Body area | **DEMO ONLY** | demo runtime only |
| Athlete-selected severity | **DEMO ONLY** | demo fixes severity to `medium`; no canonical persistence |
| Session RPE | **UNSUPPORTED** | only set RPE exists |
| Feeling/readiness | **UNSUPPORTED** | no canonical field |

Canonical Review deliberately emits `unsupported_session_context` and represents overall comment, discomfort and subjective metrics as `unsupported`, not `known_empty` (`lib/server/reviews/review-repository.ts:586-589,717-725`). The UI communicates that those data were not collected (`components/trainer/review/canonical-review-evidence.tsx:420-434`). This distinction is correct and must remain until a write contract exists.

Overall comment would require at least a PostgreSQL migration, command/read DTO changes and Review projection changes. Structured discomfort requires a product taxonomy and persistence decision before a migration can be designed. Neither can be solved honestly by mapping demo fields or by reusing `zero_result_reason`.

## 11. Attention creation

- `source_session_id` is required and immutable; `item_type` is constrained to `workout_review` (`database/migrations/0007_workout_session_execution.up.sql:104-122`; `database/migrations/0008_workout_review_feedback.up.sql:51-69`).
- Completion copies trainer, athlete and relation identity from the locked Session (`lib/server/workout-sessions/workout-session-repository.ts:181-220`).
- Athlete insert RLS permits Attention only for their own terminal `completed`/`completed_with_omissions` Session with matching identities (`database/migrations/0007_workout_session_execution.up.sql:284-293`).
- `priority_reasons` is `['partial_completion']` only when omissions exist; canonical completion does not currently add `client_comment` or `discomfort` reasons (`lib/server/workout-sessions/workout-session-repository.ts:215-220`). Queue separately computes `hasClientComments` from set comments (`lib/server/reviews/review-repository.ts:270-309`).
- Trainer read/update requires an active relation. A suspended relation hides the AttentionItem from Trainer Review.

Exact rule today:

```text
one successful completion of an assigned Session
  -> exactly one committed workout_review AttentionItem
  -> at most one row by database uniqueness
```

## 12. Trainer Review compatibility

| Fact | Client can persist | ReviewReadModel reads | Production Review displays | Verdict |
| --- | --- | --- | --- | --- |
| Session ID / Assignment ID | yes | yes | route/context | exact identity shared |
| Assignment exercise / set identity | server creates | yes | anchors/details | exact or explicit anomaly |
| Planned reps/range/duration/weight/rest/kind | via Assignment snapshot at start | yes | yes | complete |
| Actual reps/duration/weight | yes | yes | yes | complete |
| Set RPE | yes | yes | yes | complete |
| Set status | yes | yes | yes | complete |
| Set comment | yes | yes | yes | complete |
| Exercise note | no current write UI/API | reads if present | yes | storage/read exists; write gap |
| Set created/updated timestamps | automatic | yes | not prominent | available, not lost by projector |
| Zero-result reason | completion | yes | yes | complete |
| Overall comment/discomfort/subjective metrics | no | explicit unsupported | explicit unsupported | honest gap |

The Review repository uses a repeatable-read transaction, exact identity joins and set-based queries for source, exercises, assignment-set snapshots, logs and feedback (`lib/server/reviews/review-repository.ts:314-442`). A test fixes the server path at a constant six `client.query` calls and rejects demo imports (`tests/backend-foundation/review-read-model.test.ts:70-80`). Actual RPE is included in presentation (`components/trainer/review/canonical-review-presentation.ts:170-179`).

No canonical client-written field is lost by the current Review projector. The inverse gap exists: `athlete_note` can be read but cannot be written by the canonical client.

## 13. Client feedback

`TrainerFeedback` stores immutable ID, Session, Attention, trainer, athlete, relation, kind, body, optional follow-up link and timestamps (`database/migrations/0008_workout_review_feedback.up.sql:1-21`). Athlete RLS permits only own feedback (`database/migrations/0008_workout_review_feedback.up.sql:78-85`). `GET /api/client/feedback` requires active athlete capability and optionally filters exact Session ID (`app/api/client/feedback/route.ts:10-23`). The repository returns the same persisted feedback ID and `source_session_id`, ordered newest-first for athlete reads (`lib/server/reviews/review-repository.ts:246-258,474-483`). Tests assert the same athlete-visible ID and immutable feedback behavior (`tests/backend-foundation/workout-review-postgres.test.ts:279-307`).

**A. Current visibility:** only the terminal `CanonicalWorkoutExecution` screen fetches and renders feedback (`components/client/canonical-workout-execution.tsx:120-138,326-334,383-424`). `/client/me` does not show it.

**B. Reuse:** the same feedback model can be projected into `/client/me`, `/client/workouts` and future history. No new feedback entity or migration is required.

**C. Remaining legacy stores:** Supabase `trainer_workout_reviews` is read by legacy client/trainer pages; demo Review persists into `sessionStorage` via `components/trainer-os/workout-review/review-store.ts`. Both are outside the canonical Review repository.

There is no feedback read receipt. Notification outbox exists and is independent from read correctness, but its action currently targets generic `/client/me`, where feedback is not displayed (`lib/server/notifications/notification-messages.ts:17-20`).

## 14. History

No actor-scoped canonical client history read model or endpoint exists. The current Session list technically contains terminal Sessions, but it is unbounded and fully hydrates every log, so it is not an acceptable history contract. `/history` uses a different Supabase `workout_logs` reality and groups rows by calendar date (`app/(client)/history/page.tsx:21-77`).

Trainer-side R2A already has a strong cursor-paginated, set-based history projection containing Assignment, optional Session, completion counts, Attention resolution, feedback summary and stable destination IDs (`lib/server/athlete-profile/athlete-training-types.ts:113-164`; `lib/server/athlete-profile/athlete-training-repository.ts:279-407`). It is scoped and authorized for a trainer/relation and cannot be exposed directly to an athlete. Its query/projection can be extracted or mirrored under athlete ownership without creating a new domain entity.

Proposed client history contract:

- source: terminal own Sessions joined to their Assignment snapshots and own Feedback;
- ordering: `completed_at DESC, session_id DESC` (or the existing stable assignment cursor if cancelled assignments are intentionally included);
- cursor pagination, default 10, bounded maximum;
- summary: title, scheduled/start/completion timestamps, terminal status, completed/skipped/incomplete/total set counts, persisted comment indicator, latest feedback summary/count;
- detail destination: exact `sessionId`;
- no-history is a known-empty state;
- cancelled Assignment history is a separate product choice, not silently mixed with completed workouts.

## 15. Progress readiness

No Progress UI is designed here. Canonical facts support these limited candidates:

| Candidate metric | Source | Completeness / parity | Limitation |
| --- | --- | --- | --- |
| Completed workout count | terminal `workout_sessions` | high; same Session IDs for client/trainer | must decide whether `completed_with_omissions` counts equally and exclude abandoned |
| Set completion rate | terminal Session set statuses | high for assigned sets; symmetric | measures logging/compliance, not physiological progress |
| Working load trend for one exercise | completed set reps + weight, grouped by `source_exercise_key_snapshot` | medium | bodyweight/duration/missing weight; key snapshot rather than assignment snapshot of canonical exercise UUID |
| Tonnage | sum weight x reps | low/medium | excludes duration/bodyweight, zero/missing weight; can be misleading |
| e1RM | weight and repetitions | medium only for weighted repetition sets | formula and eligibility are not canonical decisions; no current metric contract |

Recommended shortlist for R3A-08: (1) completed workout count, (2) set completion rate, (3) working-load trend for one stable exercise. The first is the safest single R3F metric. Tonnage and e1RM should not be selected automatically.

## 16. Authorization

### Confirmed controls

- Client API routes resolve the signed session actor and require active athlete capability (`app/api/workout-sessions/route.ts:14-25`; exact/progress/complete routes use the same pattern).
- Assignment query and RLS constrain athlete reads to `actor.userId` (`lib/server/workouts/workout-repository.ts:536-546`; migration `0005:232-245`).
- Session repository constrains start, exact progress and completion to the athlete user ID. RLS protects Session and child logs (`database/migrations/0007_workout_session_execution.up.sql:202-277`).
- Trainer Session/Review read is allowed only through matching trainer identity and active relation (`database/migrations/0007_workout_session_execution.up.sql:202-209`; `lib/server/reviews/review-repository.ts:354-363`).
- Trainer cannot update client execution facts; a PostgreSQL test confirms the update affects zero rows (`tests/backend-foundation/workout-session-postgres.test.ts:203-210`).
- Foreign athlete cannot read another Session; PostgreSQL and canonical browser tests cover this (`tests/backend-foundation/workout-session-postgres.test.ts:195-204`; `tests/e2e-canonical/three-role-pilot.spec.ts:241-245`).

### Risks and unresolved policy

1. **URL fallback is not fail-closed at the UI semantic level.** If requested `sessionId` or `assignmentId` is not in the athlete's lists, `CanonicalWorkoutExecution` falls back to `assignments[0]` (`components/client/canonical-workout-execution.tsx:140-143`). No foreign facts leak, but a manipulated/stale URL can open or start the athlete's unrelated first Assignment instead of showing not-found.
2. **Suspended/ended relation command policy is inconsistent.** Start requires active relation, but progress/complete repository selection and RLS require only athlete ownership plus active Session, not active relation (`lib/server/workout-sessions/workout-session-repository.ts:145-153,181-196`; migration `0007:225-268`). An athlete can therefore continue/complete a previously active Session after relation suspension, creating Attention that the trainer cannot read while suspended. Whether continuation is allowed is **UNKNOWN**, but current behavior is not an explicit contract.
3. Athlete can continue reading own historical Assignment/Session/Feedback after relation end because athlete RLS is ownership-based. This is likely desirable, but must be distinguished from mutation permission.
4. `GET /api/workout-sessions` and Assignment/Feedback lists are unbounded. Authorization is correct, but data minimization and denial-of-service characteristics are weak.
5. `/api/notify-complete` is a legacy public POST with no request actor, same-origin check or relation authorization; it accepts a `clientId`, reads Supabase profile and sends Telegram (`app/api/notify-complete/route.ts:4-62`). It is not used by canonical completion but remains an exposed legacy risk.
6. Trainer-only actors without athlete capability cannot call client routes. A dual-capability user can act as athlete on their own athlete-owned entities; role exclusivity is not assumed by the access model (`lib/server/access/access-repository.ts:32-38,55-75`).

## 17. Demo and legacy isolation map

| Source | Classification | Reason |
| --- | --- | --- |
| `components/client/runtime/**` + `components/trainer-os/demo-runtime/**` | **PRESERVE AS PROTOTYPE EVIDENCE** | Strong complete-CJM and mobile interaction evidence, but demo state/commands. |
| `components/demo/demo-client-cabinet.tsx`, `lib/demo-data.ts` | **PRESERVE AS PROTOTYPE EVIDENCE** | Visual/product scenarios only; guarded by demo mode. |
| legacy `/client/[id]` Supabase execution | **REMOVE FROM PRODUCTION IMPORT GRAPH LATER** | parallel workout reality and localStorage custom exercises. |
| Supabase `workout_logs` in `/history`, `/check-in`, legacy dashboards | **MIGRATE CALLER** | conflicts with canonical Session/Logs as source of truth. |
| Supabase `trainer_workout_reviews` | **MIGRATE CALLER / ISOLATE LATER** | separate review state, superseded by AttentionItem + TrainerFeedback. |
| `sessionStorage` demo `workout-review:*` | **DEMO EVIDENCE ONLY** | transient demo Review store, not production persistence. |
| `/workout/free` in-memory workout | **PRESERVE AS PROTOTYPE EVIDENCE** | free training is outside assigned-session R3 scope. |
| `/today`, `/today/select` | **COMPATIBILITY REDIRECT LATER** | already converge to `/client/me`; retain while measuring inbound use. |
| Telegram `notify-complete` | **REMOVE FROM PRODUCTION IMPORT GRAPH LATER** | canonical notification outbox already represents completion durably. |

No mock, demo, localStorage or Supabase fallback is imported by `CanonicalClientHome`, `CanonicalWorkoutExecution`, Workout Session service/repository or Review repository.

## 18. Performance

### Current query/request behavior

- Client home makes two HTTP requests in parallel: all available Assignments and all Sessions (`components/client/canonical-client-home.tsx:28-41`). Each API also performs an AccessContext query.
- Assignment list is one set-based aggregate query, but unbounded (`lib/server/workouts/workout-repository.ts:536-546,617-636`). It does not hydrate Templates.
- Session list is unbounded and performs one Session query plus two hydration queries per Session (`lib/server/workout-sessions/workout-session-repository.ts:63-68,278-299`): **1 + 2N database queries**, plus access lookup.
- Exact Session GET exists and costs a constant Session query + exercise query + set query, but production execution does not call it (`app/api/workout-sessions/[sessionId]/route.ts:13-28`).
- Progress is constant for current one-set UI; API permits up to 20 and repository performs one UPDATE per submitted set.
- Completion uses a fixed transactional query budget; no per-exercise/set read loop.
- Feedback list is one query, but unbounded; exact Session filter exists.
- Trainer Review uses a constant set-based budget and no demo cache. Trainer history is one cursor-paginated set-based query.

### Target request/query budget

| Screen/action | Target browser requests | Target DB shape |
| --- | --- | --- |
| `/client/me` | 1 read-model request | 1 authorization/current-work transaction; fixed set-based queries |
| Assignment detail | 1 exact read | Assignment + rich snapshot in fixed set-based query/queries |
| Session resume | 1 exact execution read | Session + exercises + sets + relevant feedback; constant 3-5 queries |
| Save one/batch results | 1 command | fixed transaction; set-based batch update preferred |
| Completion | 1 command | current atomic transaction, hardened receipt UX |
| History page | 1 request per cursor page | one set-based summary query, no full log hydration |
| Feedback detail | included in execution/history when practical | avoid duplicate global feedback cache |

No parallel client cache should be added; server read models should be revalidated/refetched from PostgreSQL after commands.

## 19. Architecture gaps

Ordered blockers:

1. No authoritative `ClientAssignmentReadModel` / `ClientWorkoutExecutionReadModel`; browser chooses entities.
2. Current Assignment DTO is structurally behind the canonical snapshot schema.
3. Stale/foreign URL IDs fall back to unrelated own Assignment.
4. Client does not preserve command identity/payload across unknown progress/completion outcomes.
5. Relation suspension during an active Session has no explicit policy and can produce trainer-invisible completed work.
6. Session/Assignment list reads are unbounded; Session hydration is N+1 per Session.
7. No canonical client history; Progress and Activity enter legacy Supabase history.
8. Overall comment and structured discomfort are unsupported, while demo UX implies they exist.
9. Exercise note has schema/read support but no write command.
10. No canonical single progress metric contract.
11. Zero as a completed result has ambiguous product meaning.
12. Legacy unauthenticated Telegram completion route remains exposed.

## 20. Decision candidates

### R3A-01: canonical client workout routes

- **Evidence:** `/client/me` and `/client/workouts` are PostgreSQL-backed; Progress/Activity redirect to Supabase history.
- **Problem:** canonical namespace contains mixed sources and no dedicated history state.
- **Options:** keep two routes and add history mode to workouts; add a canonical `/client/workouts/history`; repurpose Activity/Progress prematurely.
- **Recommendation:** `/client/me` for current summary; `/client/workouts` for Assignment/Session detail and execution; `/client/workouts?view=history` or nested `/client/workouts/history` only after R3E. Keep Progress separate and inactive until R3F. Do not use `/client/activity` for workout history.
- **Migration:** no. **API change:** yes, read models/history. **UX:** clear current/detail/history separation. **Risk:** redirect compatibility. **Urgency:** R3B.

### R3A-02: start/resume adequacy

- **Evidence:** one Session per Assignment and conflict-return-existing are database-enforced.
- **Problem:** response does not distinguish created/replayed; current read chooses active Session client-side.
- **Options:** keep POST as-is; expose explicit `startOrResumeSession` receipt; split start/resume endpoints.
- **Recommendation:** keep one command and repository invariant, expose a typed `{ session, outcome: created|resumed }`, then navigate/replace to exact Session URL. Do not split commands.
- **Migration:** no. **API change:** response contract/read model. **UX:** deterministic resume. **Risk:** existing tests/callers. **Urgency:** R3B.

### R3A-03: incremental log concurrency and idempotency

- **Evidence:** expected version + durable receipt are correct; browser discards key/payload after failure.
- **Problem:** unknown outcome and two-tab conflict require manual reload and may show misleading generic failure.
- **Options:** simple refetch on any error; frozen command retry plus exact reconciliation; offline queue/autosave.
- **Recommendation:** freeze command ID, expected version and payload until known outcome; on unknown response, exact-refetch Session and reconcile receipt/result, then retry same command only when safe. Keep explicit save in R3C; no offline queue.
- **Migration:** no. **API change:** likely exact command-status or enriched conflict/replay response; can begin with exact GET. **UX:** saving/unknown/conflict states. **Risk:** accidental duplicate intent if keys rotate. **Urgency:** R3C.

### R3A-04: completion atomicity

- **Evidence:** completion and Attention are already one transaction with unique source constraint and receipt.
- **Problem:** server is correct; browser unknown-outcome recovery is not.
- **Options:** leave command; add outbox repair; split Attention worker.
- **Recommendation:** preserve current atomic transaction. Add client same-key reconciliation; do not move Attention creation asynchronous.
- **Migration:** no. **API change:** recovery response/status may be useful. **UX:** “checking completion” state. **Risk:** regression if transaction is split. **Urgency:** R3D.

### R3A-05: overall session comment

- **Evidence:** only per-set comments and zero-result reason persist; Review explicitly marks overall comment unsupported.
- **Problem:** athlete cannot summarize the session once.
- **Options:** defer; add nullable Session field written only at completion; create separate context entity.
- **Recommendation:** if pilot requires it, add a bounded nullable athlete-owned Session comment and write it atomically with completion. Do not overload zero-result reason or concatenate set comments.
- **Migration:** yes. **API change:** completion/read/review. **UX:** one optional field in completion. **Risk:** trigger/read-model compatibility. **Urgency:** founder decision before R3D.

### R3A-06: structured discomfort

- **Evidence:** canonical schema has none; demo has free text, area and a hard-coded severity; Review correctly says unsupported.
- **Problem:** no accepted vocabulary, cardinality or privacy contract.
- **Options:** defer; free-text only; dedicated structured signal(s) preserving original athlete text plus explicit body area/severity fields.
- **Recommendation:** do not migrate the demo shape automatically. Decide whether discomfort is mandatory for the pilot. If yes, define taxonomy, cardinality, access/retention and Review priority semantics first, then prefer a dedicated Session-linked structure over opaque JSON.
- **Migration:** yes if accepted. **API change:** yes. **UX:** completion/context capture. **Risk:** health-data sensitivity and false clinical interpretation. **Urgency:** decision before R3D.

### R3A-07: client history read model

- **Evidence:** trainer cursor history exists; client uses unbounded full Session list or legacy Supabase logs.
- **Problem:** no canonical athlete-scoped summary/history contract.
- **Options:** reuse trainer endpoint; derive from Session list; implement athlete-owned projection sharing types/query helpers.
- **Recommendation:** create a dedicated athlete-authorized `ClientWorkoutHistoryReadModel` over the same entities, reuse projection logic where safe, cursor paginate, and never expose trainer-private manual resolution reason.
- **Migration:** no. **API change:** yes. **UX:** canonical history and feedback entry. **Risk:** leaking trainer-private facts if trainer model is reused wholesale. **Urgency:** R3E.

### R3A-08: first real progress metric

- **Evidence:** terminal Sessions and set statuses are complete; load/e1RM semantics are conditional.
- **Problem:** Progress currently redirects to legacy tonnage history.
- **Options:** completed workouts, set completion rate, working-load trend, tonnage/e1RM.
- **Recommendation:** start with completed workout count over a declared period, optionally showing completed-with-omissions separately. Validate with product before R3F. Do not choose e1RM or tonnage by default.
- **Migration:** no. **API change:** aggregate read model. **UX:** one factual metric. **Risk:** low, except misleading period/status definitions. **Urgency:** R3F.

### R3A-09: relation lifecycle during active execution

- **Evidence:** start requires active relation; progress/complete do not; trainer cannot see resulting Attention while relation is suspended.
- **Problem:** current policy can create work that the trainer cannot review.
- **Options:** block all mutations after suspension; allow finishing an already-started Session and retain trainer review access; introduce explicit grace/transfer policy.
- **Recommendation:** founder must choose. For closed alpha, safest rule is to block new progress/completion once relation is not active and preserve read-only athlete history, unless operational requirements explicitly demand completion after suspension.
- **Migration:** probably no. **API/RLS change:** yes. **UX:** explicit unavailable state. **Risk:** data loss/frustration if suspension occurs mid-session. **Urgency:** R3B before pilot.

## 21. Proposed target architecture

```text
PostgreSQL source of truth

ClientAssignmentReadModel
  - current/next/all-current summaries
  - rich independent Assignment snapshot
  - active/terminal Session linkage
  - explicit capabilities and data availability
          |
          v
ClientWorkoutExecutionReadModel (exact Assignment or Session)
  - exact IDs; no fallback
  - Session version
  - Assignment prescription + Exercise/Set Logs
  - terminal feedback summary
          |
          +--> startOrResumeSession
          |      existing WorkoutSessionService.start, typed outcome
          |
          +--> saveSetResults
          |      existing saveProgress, hardened retry/reconcile
          |
          +--> completeSession
                 existing atomic completion
                 + accepted session context fields only
                 -> exactly one existing AttentionItem
                 -> existing ReviewReadModel
                 -> existing TrainerFeedback
          |
          v
ClientWorkoutHistoryReadModel
  - cursor summaries over the same Sessions/Assignments/Feedback
          |
          v
one shared factual Progress projection
```

Reuse:

- `WorkoutSessionService` and `WorkoutSessionRepository` for commands;
- Assignment snapshot tables and Workout repository mapping concepts, but replace the old athlete DTO;
- ReviewReadModel and TrainerFeedback unchanged as downstream canonical entities;
- trainer athlete-history query/projection patterns, not trainer authorization or private fields;
- canonical set editor data fields and completion dialog;
- demo focused navigation only as interaction evidence.

Hardening required:

- actor-scoped client read repositories with exact IDs and capabilities;
- rich Assignment snapshot projection;
- bounded set-based list/history reads;
- receipt-aware browser command state;
- relation-lifecycle enforcement;
- optional schema only after R3A-05/06 acceptance.

No second Workout, Session, Log, Review or Feedback entity family is justified.

## 22. Implementation sequence

### R3B: Assignment list/detail and Start/Resume

1. Accept R3A-01, R3A-02 and R3A-09.
2. Add exact actor-scoped Client Assignment/Execution read models using rich snapshots.
3. Remove browser entity fallback and return explicit not-found/unavailable/conflict states.
4. Use exact Session GET and URL replacement after start/resume.
5. Bound current lists and test multiple active Sessions, cancelled Assignment and suspended relation.

### R3C: incremental execution and mobile UI

1. Accept retry/reconciliation contract R3A-03.
2. Implement frozen command intent and exact refetch/reconcile.
3. Adapt canonical set editor to focused exercise/set navigation for 390x844.
4. Decide exercise-note scope; do not silently expose unwritable controls.
5. Test reload, two tabs, unknown outcome, long workout, duration/range/per-set plans and keyboard viewport.

### R3D: completion, context, discomfort and Attention

1. Preserve atomic completion/Attention transaction.
2. Decide R3A-05 and R3A-06 before schema work.
3. Add only accepted context fields and honest Review availability states.
4. Implement same-key completion reconciliation and zero semantics.
5. Verify exactly one Attention, priority reasons and suspended relation behavior.

### R3E: feedback and completed history

1. Add cursor-paginated athlete history read model.
2. Include same Feedback IDs and exact Session destination.
3. Surface latest feedback on home/history; align notification deep link.
4. Remove production redirects from Progress/Activity to Supabase history only in a separately approved route migration.

### R3F: one shared real Progress metric

1. Accept R3A-08 definition and period.
2. Build one PostgreSQL aggregate used by client and trainer.
3. Verify identical source Sessions and exclusion rules.

### Full vertical E2E

Published Revision -> Quick Assign -> athlete sees exact Assignment -> start/resume -> save/reload/conflict -> complete -> one Attention -> Review -> same Feedback -> athlete history -> shared metric, including second athlete, stale IDs, suspended relation and mobile 390x844.

## 23. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Client read model starts a second workout reality | Critical | Reuse existing Assignment/Session/Log/Feedback IDs and repositories. |
| Suspended relation yields unreviewable completion | High | Decide/enforce R3A-09 before pilot. |
| Unknown outcome causes duplicate user intent or false failure | High | Freeze idempotency key/payload and reconcile exact Session. |
| Simplified Assignment DTO misrepresents duration/range/per-set workouts | High | Rich snapshot read model in R3B. |
| Foreign/stale URL starts unrelated own Assignment | High | Exact lookup; no `assignments[0]` fallback. |
| Unbounded Session hydration degrades with history | High | Current/history split and cursor pagination. |
| Demo discomfort is mistaken for production health data | High | Keep Review unsupported until explicit schema/policy decision. |
| Trainer-private manual resolution leaks to client history | Medium | Separate client projection and field allowlist. |
| Zero completed result inflates completion semantics | Medium | Explicit zero semantics and tests. |
| Legacy Supabase/Telegram routes remain externally callable | Medium/High | Inventory and isolate after canonical caller migration; secure exposed API independently. |
| Notification links do not land on feedback | Medium | Deep-link exact Session after R3E. |

## 24. Explicit non-goals

This audit does not design or implement:

- Program or ProgramAssignment;
- AI prescription;
- achievements, rank, title or Motivation;
- Progress UI redesign;
- client profile redesign;
- trainer UI redesign;
- messaging;
- billing;
- external notification redesign;
- free-workout domain support;
- production code, API routes, schema, migrations, tests, redirects or legacy cleanup;
- a Git commit.

Only this architecture document was created. All decision recommendations remain proposed until accepted.
