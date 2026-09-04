# R3E: Client Feedback And Completed History Architecture

Date: 2026-09-04
Status: architecture accepted by founder; R3E-03 amended to append-style pagination; documentation update awaiting review, not implemented
Baseline: `83ecb22651fb927cc3bf1970be79678331ae30ef`
Branch: `codex/r3e-client-feedback-history`
Companion: [R3E UX design](client-workout-r3e-design-v1.md)

## 1. Executive Verdict

PostgreSQL already contains the facts needed for the next part of the core loop:

```text
Completed WorkoutSession -> own completed history -> exact Session
-> same persisted TrainerFeedback / follow-up -> History or Home
```

Recommend an athlete-scoped, bounded history projection and a client-safe completed-detail projection over existing Assignment, Session, Exercise Log, Set Log and TrainerFeedback. These are read models, not new domain entities or persisted copies. Do not expose the trainer Review/History DTO wholesale.

Keep `/client/workouts?session={sessionId}` for exact active and completed Sessions. PostgreSQL status selects the appropriate presentation. The existing query route can support direct links and reload; its current return parser and terminal rendering need adaptation. No page-route split is justified yet. `/history` is not a source of truth.

No schema migration or new mutation is justified by this audit. New/extended read APIs are needed for bounded history, client-safe feedback and exact completed detail. R3D's external migration rollout remains a separate HOLD, not an R3E schema requirement.

### Evidence And Authority

**CONFIRMED** means inspected current code/schema/tests. **GAP** means missing or unsuitable current behavior. **PROPOSED** means an R3E recommendation awaiting acceptance and later implementation. Earlier product documents describe historical implementations and conceptual states, not necessarily today's code.

Reviewed inputs: [R3A](client-workout-r3a-architecture-v1.md), [R3B](client-workout-r3b-design-v1.md), [R3C](client-workout-r3c-design-v1.md), [R3D architecture](client-workout-r3d-architecture-v1.md), [R3D design](client-workout-r3d-design-v1.md), [R3D implementation](client-workout-r3d-implementation-v1.md), [Core Workflow](core-workflow-v1.md), [Principles](product-principles-v1.md), [MVP Scope](mvp-scope-v1.md).

Core Workflow A/H/I and Principles 3/4/8/9/12 require one shared training reality and in-product feedback. R3D supersedes older open/restrictive suspension recommendations and unsupported-context statements in R3A/R3C. Assignment still has `available/cancelled`, not a persisted `completed` status. Read receipt was optional in Core Workflow, not an accepted requirement to create one.

### Part A Checkpoint

R3D was audited and committed first, on `codex/r3d-client-workout-completion`:

`83ecb22651fb927cc3bf1970be79678331ae30ef` - `feat(client-workouts): add canonical workout completion`.

Parent: `2d2c27af7747a6c243fd5bf684ea245ae5daacbd`; R3C baseline: `bdd60a99eb07f07666eacf160af6ac51735fcfe6`. Explicit staging included 34 R3D files: 19 production, 2 migration, 12 test/fixture, 1 implementation report. No dependency/config/generated files. Reviewed changes did not reveal credentials or real user fixtures. Largest candidate was under 67 KB. Post-commit status, ordinary diff and staged diff were empty before creating the R3E branch. The implementation report remains a historical pre-commit report; it was not rewritten.

Fresh pre-commit gates: PostgreSQL 153/153, including eight R3D tests; UI/unit 86/86, including two R3D tests; canonical browser E2E 10/10, including the R3D completion scenario; TypeScript, ESLint, production build and staged whitespace check passed. Targeted tests ran within these full suites, not as separately isolated targeted invocations. Existing non-R3D DialogDescription warnings and color-environment warnings remain. R3D viewport tests include 390x844, 390x500 and equivalent 200% reflow, not physical-device or native zoom verification.

0016 was reviewed up/down. No older migration changed; no false default or legacy-null backfill. Current local catalog confirmed helper owner `ai_strength_migrator`, no BYPASSRLS for app/migrator, fixed `pg_catalog, app` search path and FORCE RLS. **External rollout 0016: HOLD until external provenance preflight, backup and separate rollout review.** Down drops collected context and is not lossless. The broad suspended-profile policies from 0012 remain a separate hardening issue, not redesigned by R3D or this document.

## 2. Existing Route And Data Audit

References use current repository-relative files plus symbols/line anchors. Line numbers are baseline anchors; symbols are authoritative if later edits move them.

| Evidence | Surface/source | Current classification, data and authorization | Pagination/performance | Private fields or gaps |
| --- | --- | --- | --- | --- |
| E01 | `app/client/me/page.tsx:432`, `ClientMePageContent`; `components/client/canonical-client-home.tsx`, `CanonicalClientHome` | Canonical Home in production when demo is off; `/api/client/workouts` -> PostgreSQL. `app/client/layout.tsx` calls `requireCapability("athlete")`. Dev-only legacy opt-in and explicit demo branches remain. | One bounded current query; Home presents the first server-ordered item. | No feedback/Home history block. Empty-current screen hides access to history because collection link is inside nonempty branch. |
| E02 | `app/client/workouts/page.tsx:7`, `ClientWorkoutsPage`, `safeReturnTo` | Neutral URL -> `CanonicalClientHome mode="collection"`; exact Assignment/Session -> `CanonicalWorkoutExecution`; same athlete layout. | Current collection only, exact read for detail. | Only bare `/client/workouts` survives return validation; everything else becomes `/client/me`. History cursor/anchor cannot survive today. |
| E03 | `app/client/progress/page.tsx`, `app/client/activity/page.tsx` | Production redirects to `/history`; explicit demo/runtime branches otherwise. Canonical layout runs before redirect, legacy auth then takes over. | No canonical history/metric read here. | Mixed PostgreSQL-auth/Supabase-data route graph. Neither route is a completed-history implementation. |
| E04 | `app/(client)/history/page.tsx:21`, `loadWorkoutLogs`, `groupHistory`, `HistoryPage`; `app/(client)/layout.tsx` | Legacy Supabase `workout_logs`, browser `supabase.auth.getUser`, client_id filter; different layout/ClientNav, not canonical athlete API. | Limit 300 logs, optional second fallback query, browser date grouping; no cursor. | Groups days, not Session IDs; nulls become zero for tonnage; failure can look empty; links to Home, not exact Session. Do not import. |
| E05 | `app/api/client/workouts/route.ts:10`; `lib/server/client-workouts/client-workout-query-service.ts:27`, `execution` | Authenticated active athlete capability; exact UUID parsing, own Assignment filter and matching Session/Assignment IDs, no alternate-entity fallback. PostgreSQL. | Exact Session plus rich Assignment, no global list. Current API is no-store. | Execution DTO includes source revision, relation status, capabilities and legacy Session Attention field; not a minimal completed DTO. |
| E06 | `lib/server/client-workouts/client-workout-repository.ts:91`, `listCurrent`; `:110`, `findAssignment`; `assignmentSelect` | Own available Assignments with no Session or active Session; active first, then scheduled/created/id. `findAssignment` requires own athlete ID. Identity LEFT JOIN prevents ended-name loss from hiding Assignment. | LIMIT 21, returns 20 + hasMore. Rich nested prescription included. No current-list cursor consumer. | Terminal Sessions excluded. Suspended unstarted Assignment can remain in list with canStart=false; current UI label does not fully respect that capability. Preserve as a separate current-work UX risk. |
| E07 | `app/api/workout-sessions/route.ts`, GET; `lib/server/workout-sessions/workout-session-repository.ts:70`, `listAthlete` | Authenticated active athlete, own Session query plus RLS. Canonical persistence, obsolete broad list contract. | Unbounded; one source SELECT + up to two hydration SELECTs per Session (1+2N for nonempty Sessions), plus transaction/auth. | Full results/context returned unnecessarily. Do not wire it into R3E. |
| E08 | `app/api/workout-sessions/[sessionId]/route.ts`; Session repository `find`, `findInTransaction`, `hydrate` | Exact participant RLS; client API athlete gate. R3D repeatable-read Session/log snapshot. Composed client read also checks own Assignment. | Constant exact Session/exercise/batch-Set reads; no Template read. | `zero_result_reason` exists in SQL but is omitted from current Session DTO. Missing logs can yield empty arrays; future projection must distinguish missing from true empty. |
| E09 | `components/client/canonical-workout-execution.tsx:181`, feedback effect; `ClientFeedbackHistory`; `components/client/canonical-workout-completion.tsx`, `WorkoutCompletionReceipt` | Terminal execution displays persisted receipt and separate feedback request. No mock facts. | One exact GET then one feedback GET; feedback list unbounded. | Feedback fetch catch sets []; outage appears as no answer. Thread is flat newest-first, parent linkage not displayed. Own overall/discomfort text is not presented as a full completed-context section. |
| E10 | `app/api/client/feedback/route.ts`; `lib/server/reviews/review-service.ts:64`; `review-repository.ts:250`, `mapFeedback`, `:481`, `listAthleteFeedback` | Existing canonical TrainerFeedback. Active athlete gate; own athlete filter, optional exact Session UUID; RLS independent of relation status. | One SELECT, unbounded globally and per Session; order sent_at DESC,id DESC; trainer name LEFT JOIN. | Shared `ReviewFeedback` includes attentionItemId and trainer/athlete IDs; client-safe allowlist needed. Valid foreign Session currently gives empty array, not proof that a Session exists. |
| E11 | `lib/server/athlete-profile/athlete-training-repository.ts:279`, `findHistory`; `athlete-training-cursor.ts`; training-history API | Trainer/relation-scoped canonical history with active relation and athlete profile gates; **not** client authorization. | One set-based cursor query, default 10 / max 50, first+1; summaries aggregate the whole relation before limiting terminal rows. | Includes cancelled/abandoned, Attention state/priority and manual resolution kind. Do not reuse endpoint/DTO. Reuse approach, but page IDs before aggregating in R3E. |
| E12 | `database/migrations/0007_workout_session_execution.up.sql:6`, `:124`; `0006_workout_builder_lifecycle.up.sql:104`; `0016_workout_session_completion.up.sql` | Immutable Assignment/Session source and Set identity; nullable context; own athlete historical access; exact original-trainer terminal lineage. | Existing Session index uses athlete/status/**started_at**, not completed_at/id. Child FKs/indexes support bounded hydration. | Need measured history query plan later; index adequacy is not proved by schema sufficiency. |
| E13 | `database/migrations/0008_workout_review_feedback.up.sql:4`; `review-repository.ts:495`, `sendFeedback`; `review-types.ts:13` | Immutable feedback kinds detailed/acknowledgement/follow_up; canonical parent validation and idempotent send. | Session/sent and athlete/sent indexes; no bounded read contract or read receipt. | DB has created_at AND sent_at; current public contract exposes **sentAt**, not createdAt. Preserve that distinction. |
| E14 | `lib/server/notifications/notification-messages.ts`, `review_feedback_ready` | Canonical generic notification points to `/client/me`. Delivery is separate from persistence. | One generic destination, no exact Session identity in presentation message. | Latest-feedback Home block improves landing but cannot guarantee finding the exact old notification when several replies exist. Exact notification links are a separate follow-up decision, not transport redesign here. |

`proxy.ts` matches `/dashboard/*` and `/api/notify-complete`, not canonical client pages. Current canonical protection is server layout + API actor/capability + PostgreSQL actor/RLS, not that proxy. `lib/server/access/access-guard.ts`, `requireCapability`, redirects unauthenticated users with the layout's fixed Home return; preserving an exact link across expired-login is a future integration test/gap, not already guaranteed by the exact route.

## 3. Proposed ClientWorkoutHistoryReadModel

One read-only projection; no history table. Actor is resolved server-side, never accepted as a query owner. Scope is **all own completed Sessions across relations**, not current trainer.

| Field | Source and rule |
| --- | --- |
| identity.sessionId / assignmentId | Exact own Session and immutable Assignment FK. No date-based identity. |
| workout.title | Assignment title_snapshot, never current Template title. |
| workout.scheduledFor | Assignment date-only scheduled_for. Do not convert date-only into an arbitrary UTC timestamp. |
| workout.completedAt / clientTimezone | Session persisted completion instant/timezone. Only completed/completed_with_omissions included. |
| workout.status | Those two existing terminal statuses; no abandoned/cancelled entry disguised as completed. |
| summary | Availability-wrapped planned exercise count, expected Set count when provable, recorded completed/skipped/incomplete counts; all derived set-based. |
| context | Optional availability/hasOverallComment/explicit discomfort fact only; omit original sensitive text from list. Not required in visible row v1. |
| feedback | Availability-wrapped `{hasFeedback, latestFeedbackAt, latestFeedbackId, latestKind}` from own same-Session feedback. No full body or global message count. |
| pageInfo | `hasNextPage`, `endCursor`, `startCursor` (replay boundary for the initial page); accumulated-depth navigation described in section 6. No total count required. |
| availability | ready / known_empty / partial / unavailable at appropriate collection/summary/feedback boundaries. |

Do not sum joined Set and Feedback rows in one multiplied aggregate. Aggregate independently for the selected Session IDs, then join one summary per Session. Count exercises by Assignment exercise ID, distinguish planned from actually recorded. Compare expected structure to log coverage; zero observed logs in a nonempty prescription is partial/unavailable, not a zero-result workout. Explicit completed numeric zero is still a recorded result. Unexpected pending rows in a terminal Session are an integrity gap, not silently counted incomplete. Canonical completion converts pending to incomplete, but imported sources are not guaranteed valid.

Exclude elapsed duration from list v1. started_at/completed_at can give an interval, not active exercise time; an open Session overnight would be misleading. Exclude volume, trends, e1RM, PRs, adherence, calories, scores, streaks and inferred workload.

No Attention IDs, priority, resolution reason/kind, queue status, R2A.3 flow, private audit, trainer capabilities or relation-management fields. A projection may reuse canonical scalar/types, not serialize whole Review objects. Availability is derived at the server boundary, not inferred from a missing browser value.

## 4. Proposed ClientCompletedWorkoutReadModel

Exact own Session, terminal status required. One coherent read-only PostgreSQL snapshot for Assignment/Session/results/context; Feedback is an independently bounded, separately available section over the same Session ID.

| Section | Allowed facts |
| --- | --- |
| identity | sessionId, assignmentId, completed status and persisted version; no Attention identity. |
| workout | title_snapshot, scheduledFor, startedAt, completedAt, clientTimezone; accessible trainer displayName or neutral `Тренер`. |
| instructions | Athlete-visible Assignment instruction_snapshot and trainer_note; per-exercise trainer notes and superset snapshot instructions. These are prescribed notes, not private trainer notes. |
| summary | Same definitions as history, with explicit partial-source availability. |
| composition/results | Ordered Assignment exercise/set IDs, instanceKey/setKey/supersetKey, planned prescription and associated ExerciseLog/SetLog IDs, actual repetitions/duration/weight and existing per-Set RPE where present. No Session RPE. |
| result states | completed, skipped, incomplete, missing/unsupported source; preserve null versus numeric zero. No editable forms on terminal detail. |
| athlete comments | Own Set comments; original overall comment; explicit discomfort answer and original text. Exercise note only if persisted and supported, no invented write capability. |
| zeroResultReason | Existing workout_sessions.zero_result_reason if readable/nonempty. Existing client DTO omits it: add an explicit read projection, not a new column or write. |
| feedback | Client-safe thread page of the same TrainerFeedback records, with availability/pageInfo, section 5. |

Match logs to prescription by stable source IDs and validate same exercise/session. A legacy null source_assignment_set_id may display its **persisted Session planned snapshot**, labelled as such; never match by array index or load a new Template revision. Missing prescribed/log rows produce a partial section. Retain identifiable orphan result facts separately with a factual unavailable-plan label rather than dropping or fabricating a match.

Context projection mirrors R3D semantics, not trainer Review's private DTO: all-null legacy -> unsupported; collected false -> known empty discomfort; true + text -> ready. Overall comment unsupported when context was not collected, known_empty when collected but blank, ready when present. Malformed tuple -> unavailable, not false. Original wording is text-only and wraps. Missing context-source read is unavailable, not legacy.

Core identity failure or foreign Session -> generic unavailable, never another Session. Feedback failure alone does not hide preserved results. No join to Attention/manual resolutions is needed to render this client model. `reviewQueued` in R3D proves command handoff, not current queue-open state; do not project it as "still waiting for review".

## 5. Feedback Contract

**CONFIRMED:** `app.trainer_feedback` has id, source_session_id, kind, body, follow_up_of_id, sent_at and created_at. `mapFeedback` currently maps `sent_at -> sentAt`. R3E must preserve the existing public timestamp name **sentAt**; the task's suggested createdAt is not the existing DTO. No synthetic timestamp and no timestamp migration.

Proposed client serializer allowlist: `{id, sessionId, kind, body, sentAt, followUpOfId, author}`. It is a view of existing records, not a client feedback copy/store or new feedback domain model. Do not return attentionItemId, command receipts, manual reason or private audit. Body unchanged; existing limit is 5000 characters (0008). Author name is optional accessible metadata with neutral fallback, not a reason to broaden profile permissions.

Thread ordering: sent_at ASC,id ASC using full database precision, not browser receipt time. Initial detailed/acknowledgement stays immutable; follow_up appears as `Уточнение` with a link to its **actual** followUpOfId. `sendFeedback` accepts a same-Session parent, including another follow-up; do not assume all follow-ups directly reference the first message. Flat chronological list with explicit parent links avoids arbitrary nesting depth. Canonical parent validation is in the command, not a composite FK proving every possible imported chain.

Bound thread pages, proposed 20/max 50 messages. Initial read returns oldest page and accurate hasNextPage; no silent clipping. Resolve an incoming feedback anchor with a server-bounded window containing that exact own same-Session message, not by downloading earlier pages. Parent outside window: load a bounded same-Session parent context on demand; never a request per visible message. Cycles/foreign parents in legacy imports cannot recursively fetch forever: unavailable parent label, finite one-parent lookup, same ownership check. Exact feedback not in requested Session must not open another Session or leak content.

No feedback after a successful authorized read is normal: `Тренер ещё не оставил обратную связь.` It does not prove Attention is open; manual resolution may exist privately. Failed source reads use `Не удалось загрузить ответ тренера` with section Retry, never empty. Follow-up can arrive after first view; revalidate on return/focus or explicit refresh, without auto-mark-read or fixed response-time promises.

### Home Proposal

One bounded latest-feedback query across own completed Sessions, ORDER BY feedback.sent_at DESC,id DESC LIMIT 1, joined to Session/Assignment for exact title/destination and lineage. Render one compact `Тренер ответил на тренировку «{title}»` block plus `Посмотреть ответ`, date and optional `Уточнение` kind. It coexists with current work and does not replace it. No reply body/context text required on Home. No feedback -> omit block; query failure -> small unavailable/Retry state independent of current work.

**Read receipt: do not add.** No canonical feedback read-receipt field/command found in database/migrations, server reviews or client APIs. Legacy Supabase `trainer_workout_reviews.client_seen_at` and its RPC (`supabase/migrations/20260403120000_trainer_workout_reviews.sql:9,113`; old `app/client/me/page.tsx:1649`) belong to a different date-based entity. Other `readAt` DTO fields are read timestamps, not user receipts. Demo feedback_viewed events are not canonical receipt evidence. Use "последний ответ", not "новый/непрочитанный"; opening never mutates feedback or Attention.

## 6. Pagination And Route Contract

### Route Alternatives

| Option | Reload/direct link | Back and collection restoration | Active/completed distinction | Migration cost / complexity |
| --- | --- | --- | --- | --- |
| A: `/client/workouts?session=ID` | Existing exact lookup, no list prerequisite | Extend strict returnTo to collection start cursor, loaded depth and row anchor; replay canonical pages on return | Server status chooses distinct read-only/composition rendering, not a `view=history` flag | Lowest: keep R3B/R3C/R3D links, test state changes and same-route remount/reset carefully |
| B: `/client/workouts/ID` | Naturally exact path; requires new page | Still needs the same depth/cursor/anchor replay contract; route alone does not restore accumulated rows | Requires a status branch too, or splits active/completed destinations | Moderate: new page plus query compatibility and cross-flow link migration; no clear extra user benefit now |
| C: new history detail route | Exact if designed correctly | Same restoration burden, plus collection namespace | Clear label, but duplicates ownership/detail pathways | Highest: third navigation area and compatibility decisions; avoid for v1 |

**R3E-01 recommendation: A**, because exact lookup and terminal status already work and no route defect forces replacement. Acceptance is conditional on reliable restoration and identity resets; do not preserve A merely to avoid work if those gates fail. No fallback to legacy `/history`.

Proposed page URLs:

```text
/client/me
/client/workouts
/client/workouts?historyStart={startCursor}&historyDepth={successfulPages}#history
/client/workouts?session={sessionId}&returnTo={encoded-safe-collection-url}
/client/workouts?session={sessionId}&feedback={feedbackId}&returnTo=%2Fclient%2Fme#feedback-{feedbackId}
```

`feedback` selects a thread window/focus only after exact Session authorization. Assignment+Session mismatch, duplicate identity parameters, malformed/empty supplied identity must fail closed, not fall through to neutral collection. This is stricter than the current page's `single()`/falsy handling and is a later navigation gate, not a change made now.

Allow return destinations only `/client/me` (optional known feedback anchor) and `/client/workouts` with **only** the validated `historyStart` / `historyDepth` pair plus `#history` or `#workout-{UUID}`. Bare Workouts starts with one page of 10. `historyDepth` is a positive exactly parsed integer counting successfully loaded cursor pages, not rows or an OFFSET; reject malformed/unrepresentable values rather than silently clamping them. No hidden product maximum restore depth. The UI always requests 10 per history page, so depth has one stable meaning; API consumers may request up to 30 per request without changing this UI convention. Reject duplicate parameters, external/protocol-relative/backslash URLs, nested returnTo, execution identity in return and unknown query. Do not forward arbitrary query strings. Direct exact URLs default to `/client/workouts#history`; existing explicit Home origins retain Home. Invalid history cursor/depth resets only history navigation with an explicit notice; unsafe return URLs use the safe fallback without altering exact Session identity. URL, cursor and return context are never authorization.

### History Cursor

Accepted R3E-03: append-style forward keyset pagination. Initial history displays 10 rows; `Показать ещё` fetches the next page and appends it without replacing prior rows. **Default 10 / max 30 is the size of one server request, not a total history or restoration limit.** Fetch first+1 to determine hasNextPage; never append the sentinel. Sort completed_at DESC,session.id DESC. Cursor is versioned base64url structure with domain discriminator, actor scope, upper-bound completed tuple from initial page, and last completed tuple for continuation. No relation ID scope. Reject oversized (>2 KB), malformed, wrong-version/domain/actor, invalid UUID/timestamp or impossible boundary. A cursor is untrusted navigation data: SQL always binds authenticated actor independently. No database/schema-backed cursor entity or cache.

The initial response also returns `startCursor`: a typed replay token containing the same actor/domain/sort/version and inclusive upper-bound tuple, but no after-position. This permits refetching the initial page under its original boundary. Continuation uses an exclusive last tuple (`after`), never the start token as an after-position. Validate token purpose and matching boundaries. The URL stores only startCursor, successful page depth and semantic Session anchor, not every continuation token or any workout data. During restoration the server supplies each fresh next cursor in order. This read-contract detail requires no schema change; parameter spelling remains a documentation proposal for implementation review.

Preserve PostgreSQL microsecond timestamp precision in opaque cursor fields; do not pass cursor keys through JavaScript Date.toISOString's millisecond truncation. Existing trainer cursor is useful as a validation pattern, not a byte-for-byte implementation. Equal completion timestamps use UUID tie-break. Display dates may use conventional ISO/locale formatting separately.

Select page Session IDs first, then aggregate only those IDs. Do not paginate in the browser or hydrate all Sessions. Terminal keys are immutable; new completions normally appear above the initial upper bound and do not shift older pages. Explicit refresh resets to latest page. This is stable keyset navigation, not an MVCC snapshot across requests: concurrent transaction commit ordering, imports or administrator deletes can still change membership. Do not promise perfect frozen history without a stronger contract.

Append merges by Session ID, preserving server order and replacing a duplicate's summary in place with the latest successful canonical read, never displaying two copies. A successful next-page response advances the loaded page depth and cursor once, even when dedupe removes overlapping rows. Failed, cancelled or superseded requests do not advance depth. Serialize load-more requests; repeated clicks/retries must not append or count the same response twice. A non-advancing next cursor is a controlled pagination error, not an infinite retry. Current/upcoming remains independent.

### Return, Reload And Replay

After each successful page, update the collection URL with startCursor and successful depth using replace navigation, without scrolling or creating one Back entry per append. Before opening exact detail, add `#workout-{sessionId}` to that collection context and carry the same allowlisted URL in returnTo. Browser Back/Forward, explicit return and hard reload reconstruct **all previously loaded pages**, starting with the initial page under startCursor and following fresh canonical PostgreSQL cursors sequentially to saved depth D. This intentionally requires D history requests when all D pages remain available. Do not restore only the final page, bypass cursors with OFFSET, or download an unbounded Session list.

Keep response rows only in the current component's transient rendered state; do not use localStorage/sessionStorage, a persisted query cache or a separate history-data store. URL/history state holds navigation metadata only. A remount/reload re-reads canonical facts. No hidden maximum restore depth, row count or automatic truncation is permitted. Depth can grow as the user loads pages; aggregate time, network and rendered memory grow with it. Any future product cap requires a separate decision.

During replay show progress and preserve successfully restored rows. Track target depth D separately from successfully restored depth k. A transient failure on page k+1 preserves the prefix, target URL and anchor; Retry continues from that cursor, without refetching the prefix or claiming restoration is complete. If the user leaves partial restoration, any new exact return intent records only the actually loaded depth k. Ignore stale responses after navigation/account changes. Stop at requested depth or genuine exhaustion. If exhaustion occurs earlier because source membership changed, keep all available rows, update depth to actual successfully read pages and show an explicit notice, without an artificial cap. Only after restoration finishes, focus/scroll to the original row; if absent, focus the history heading and explain its absence, never another workout. On partial failure do not falsely report the anchor missing before remaining pages can load.

An invalid cursor returns a controlled client-safe API error. The UI clears only history cursors/depth/accumulated rows, resets that section to the initial canonical page and announces `История обновлена: сохранённая позиция недоступна.` Preserve current/upcoming data, exact Session identity and Home state. Do not loop-reset if the fresh request fails; show history Retry. First-page [] is `Завершённых тренировок пока нет.` On exhaustion remove Load More and show `Все тренировки показаны` (including after a later empty page); no invented total. Reset/refresh never claims the previous depth was restored.

## 7. Authorization

Use existing authenticated actor, active athlete capability and app-role transaction-local actor/RLS. Own history queries explicitly require session.athlete_user_id=actor.userId, and exact Assignment and Feedback lineage must agree. Do not call trainer history/Review service for client authorization, even if a dual-role actor could access it.

| Case | Required behavior / test |
| --- | --- |
| Athlete A own completed Session and same Feedback | Allowed; same persisted IDs as trainer Review, no copy. |
| A requests B's Session or Feedback | Generic unavailable; never empty-feedback proof of Session existence; no alternate own Session. |
| Trainer-only actor at client history/read endpoint | Denied by athlete capability; proposed403 for authenticated wrong capability,401 for unauthenticated, consistent non-sensitive copy. Existing feedback endpoint currently uses401 for both. |
| Dual-capability actor | Own athlete facts only in client endpoints; trainer role is not authority to read another athlete's client history. |
| Malformed/nonexistent/foreign exact identity | Same user-facing unavailable; generic validation/not-found API errors contain no ownership details. |
| Suspended/ended relation | Own terminal history/context/Feedback remain readable. Account/capability security suspension is separate and still fails closed. |
| Original trainer or new trainer | No new rights through R3E; R3D exact original lineage remains unchanged. A new relation cannot inherit old workflow. |
| Forged cursor/return/feedback anchor | Cannot override actor or exact Session scope. Reject invalid navigation, reauthorize every read. |

0016's own athlete policies do not require relation.status=active. Avoid mandatory live trainer/profile INNER JOIN: missing display name must not hide historical work. Do not widen 0012 or add SECURITY DEFINER helpers for client history. Trainer-private manual resolution remains private even when no Feedback exists.

## 8. Legacy And Demo Disposition

| Surface/store | Evidence | Proposed disposition, no changes now |
| --- | --- | --- |
| `/history` | E04, Supabase day grouping and 300-log cap | PRESERVE AS VISUAL EVIDENCE; COMPATIBILITY REDIRECT LATER to canonical history after caller/inbound audit. No automatic Session-ID mapping from date. |
| `/client/activity` | E03, production redirect / demo social activity | MIGRATE CALLER; REMOVE FROM PRODUCTION GRAPH LATER as history entry, separately approve compatibility route. Do not build a social feed. |
| `/client/progress` -> `/history` | E03 | MIGRATE CALLER later under R3F/route approval. R3E must not promote this as canonical history or implement a metric. |
| Demo client history | `components/demo/demo-client-cabinet.tsx`, `DemoClientWorkoutsPage`, plan/history tabs; `lib/demo-data.ts` imports | PRESERVE AS VISUAL EVIDENCE; no mock workouts/counts/charts in production. |
| Runtime history/feedback | `components/client/runtime/client-runtime-workouts.tsx:28`, `client-runtime-home.tsx:15`; `components/trainer-os/demo-runtime/client-selectors.ts:122`; `persistence.ts:20,52` | PRESERVE AS VISUAL EVIDENCE; localStorage-backed runtime commands/selectors do not become canonical read/retry state. Demo actor ID is not auth. |
| Supabase `workout_logs` | E04, legacy Home/execution imports | MIGRATE CALLER; REMOVE FROM PRODUCTION GRAPH LATER. No blending into canonical Session list. Historical data migration requires separate identity/provenance review. |
| Supabase `trainer_workout_reviews` / client_seen_at | E01, old Home loader, supabase/migrations/20260403120000_trainer_workout_reviews.sql | MIGRATE CALLER; preserve evidence, no client feedback mirror or canonical read-receipt inference. |
| Demo Review sessionStorage | `components/trainer-os/workout-review/review-store.ts:184,192` | PRESERVE AS VISUAL EVIDENCE only; no persisted canonical outcome. |
| Broad canonical Session/Feedback list endpoints | E07/E10 | MIGRATE CALLER to bounded reads; restrict/deprecate only after caller audit. Do not remove while current consumers/tests rely on old contract. |

No file, route, caller or data was removed by this pass. Legacy styles may inform composition, not statuses, privacy or entities.

## 9. Performance Assessment And Proposed Budgets

**Static audit:** Session list still has 1+2N hydration; feedback lists remain unbounded. Trainer history has constant statement count but preaggregates relation-wide data. Constant queries alone do not mean bounded work. R3B current query is capped at 20 but includes all prescription Sets; do not reuse it as history list.

**Measured R3D baseline**, not R3E: exact client read11 and correlated read12 repository statements, Review9; includes transaction wrappers, excludes HTTP auth/revalidation and internal RLS helper SQL. New tests in PartA reconfirmed these counts. No R3E performance measurement or EXPLAIN was run.

| Operation | Proposed browser budget | Proposed application data-query budget, excluding auth/transaction wrappers |
| --- | --- | --- |
| History initial or one Load More page | 1 GET | 1 page-first set-based summary query; default 10/max 30 per request + sentinel; no per-Session hydration |
| Current work + history collection | 2 independent GETs initially | Existing current query + history query; subsequent history page fetches history only |
| Home | Current GET + at most 1 latest-feedback GET | Existing current query + one own latest Feedback/title query LIMIT 1 |
| Exact terminal detail | 1 exact core GET + 1 bounded thread GET | Target <=4 coherent core SELECTs (source, prescription, Exercise Logs, Set Logs) +1 feedback page SELECT |
| Thread next page / exact parent context | 1 GET per explicit interaction |1 bounded same-Session query; never one query per visible message |
| Detail -> accumulated history; Back/Forward; hard reload at depth D | D sequential history GETs if D pages remain, plus optional independent current-work GET | D page-first summary queries; every request bounded, total cost grows with depth. Stop earlier only for genuine exhaustion or an explicit error, not a hidden depth cap |
| Replay interrupted after k successful pages | Retry failed page then remaining pages through D | Preserve prefix; no automatic replay of the first k pages in the same mounted restoration; no unbounded list or mutable Template |

Budgets are proposals, not claims of measured R3E performance. Query count is constant **per page**, not per whole restored history. With UI page size 10, accumulated rows/rendered memory are O(10D), and successful complete replay is O(D) requests/summary queries; this is page traversal, not per-Session N+1. No total history limit follows from the API maximum of 30. Measure initial load, append, representative shallow/deep restoration and partial-retry costs separately; document latency only if actually measured. No hidden restore-depth cap, data cache or replacement of prior rows may be used to satisfy a one-request budget. A failure-isolated combined read endpoint is possible later but must not turn partial feedback outage into total Session failure. Keep one fact source and normal no-store/refetch ownership; no second browser cache containing sensitive histories. In-flight request dedup/cancellation and navigation metadata are not domain storage.

Existing child and feedback indexes cover key lookups. Session athlete/status/started_at index does not directly cover completed_at,id ordering. Measure EXPLAIN ANALYZE under app actor/RLS with long histories, equal timestamps and many follow-ups before approving an index migration. Avoid relation-wide array_agg for latest feedback, and inspect joins/row counts as well as statement counts. No latency or load-test claims yet.

## 10. API And Schema Verdict

**Schema sufficient for v1 facts: no migration proposed.** 0005/0006 store independent prescription; 0007 Session/logs/timestamps/zero reason; 0008 feedback/kinds/parent/sent time; 0016 context and own historical access. Index optimization is conditional on measurement, not assumed required. No read-receipt table/column or new completion/feedback command.

Proposed read-only boundary shape, final endpoint naming subject to implementation review:

| Read | Minimum contract change |
| --- | --- |
| `GET /api/client/workouts/history?after=...&first=10` | Athlete-owned bounded summary page; optional `start` replay token for page 1 or `after` continuation token for later pages, never both. Return startCursor/endCursor/hasNextPage. Final endpoint naming remains subject to implementation review as above. Do not reuse the old unbounded Session list. |
| Existing exact client workout GET with explicit completed projection | Return client-safe terminal model without losing active execution/R3D correlation contract. Add zero-result reason and truthful context/log availability. May use a discriminated response or explicit read projection selector; never alter active command semantics. |
| Bounded mode of existing `/api/client/feedback` | Exact Session thread page, same IDs, safe serializer, cursor/focus support and existence/ownership verification. Inventory callers before changing default response. |
| Latest mode of same feedback API or lightweight client Home query | LIMIT 1 plus exact title/Session destination; not global feedback download+slice. |

GET only, authenticated, no-store; no read-caused audit/Attention mutation required. Client-safe serialization must happen before response, not merely hiding fields in JSX. Section errors must be typed; stale data cannot be labelled fresh/empty. R3D APIs/schema are unchanged in this task.

## 11. Decision Register

The founder accepted the architecture/design and explicitly amended **R3E-03 to append-style cursor pagination** in the current request. This register records that direction; implementation and this revised document's review are still pending. Evidence-backed current facts remain distinct from future contracts.

| ID | Evidence | Options | Recommendation | API needed? | Migration needed? | UX impact | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R3E-01 Route | E02/E05/E09 exact query route works, return parser is bare-path only | A query; B nested Session page; C history namespace | A with strict context parsing and status-owned separate presentation | Extend completed read; route decision itself no command | No | Direct/reload and return to accumulated depth/row | Same-route state bleed and expired-login exact intent need tests |
| R3E-02 History model | E07 unbounded; E11 trainer-private contract; E12/E13 shared facts | Full Session list; trainer DTO; athlete-owned summaries | ClientWorkoutHistoryReadModel, page-first aggregation | Yes, bounded client read | No | Scan exact workouts, no analytics wall | False zeros on partial logs; private field leakage |
| R3E-03 Cursor (accepted amendment) | E11 pattern; E12 immutable completion timestamp; explicit founder approval of append/replay | Offset; replace rows; append-style keyset reads | Append and dedupe by Session ID; completed_at/id descending, full precision; 10 default / 30 max per request, UI pages of 10; URL start cursor + successful depth + row anchor; replay all saved pages, no hidden restore cap | Yes, bounded page and start/replay cursor | No, index only after evidence | Prior rows stay visible; Back/reload restores accumulated depth; `Все тренировки показаны` at exhaustion | Replay cost/memory grows with depth; microsecond loss; concurrent membership changes; invalid cursor resets history only with notice |
| R3E-04 Feedback placement | E09 feedback currently after logs, failures become [] | After execution; above execution; separate inbox | Below identity/date, before own context/results; linked chronological thread | Bounded safe thread and exact anchor | No | Answer easy to find, facts still directly below | Long follow-ups must not hide missing earlier messages |
| R3E-05 Home feedback | E01 no block; E14 notification lands Home | None; inbox; one latest block | One latest exact-link block independent of current work | Yes, bounded latest read | No | Answer discoverable even with no next Assignment | Latest is not unread and may not match old notification |
| R3E-06 Read receipt | E13 no canonical field; legacy client_seen_at elsewhere | New entity; legacy RPC; no receipt | No read receipt or unread label in R3E | No mutation | No | Honest latest-answer state | Cannot promise unread count or acknowledgement analytics |
| R3E-07 Legacy /history | E03/E04 separate Supabase/day domain | Adopt; delete; isolate and redirect later | Preserve evidence, migrate callers and separately approve compatibility redirect | Canonical history must exist first | No automatic data migration | One future history entry, no dual reality | External links and old auth/data identity require audit |

## 12. Proposed Implementation Sequence

1. Review the documentation amendment for accepted R3E-03 append/replay behavior; other accepted architecture decisions and feedback paging remain unchanged. Record unresolved active-current list and expired-login return boundaries; do not expand scope silently.
2. Implement actor-scoped client history repository/query/serializer with page-first aggregates, full-precision cursor and authorization tests. Do not call trainer history endpoint.
3. Add exact completed projection and bounded same-Session feedback/latest reads with truthful availability, source identity and partial legacy behavior. Preserve active execution/R3D receipt contracts.
4. Connect neutral collection/history and distinct terminal presentation; integrate Home latest block. Add append/dedupe, strict return start-cursor/depth/anchor, sequential canonical replay and feedback-focus navigation without new entity/cache.
5. Verify full cross-role loop and same Feedback IDs, follow-up parent links, no feedback versus outage, suspension/end, foreign/substituted IDs, long histories and source gaps.
6. Verify multiple appended pages -> exact -> full-depth return/reload/Back/Forward, dedupe, failed append/replay, exhaustion and invalid-cursor history-only reset. Test deep restoration beyond 30 accumulated rows without a hidden cap, fresh completion, delayed feedback, login expiry, 390x844/200%/keyboard/focus and depth-dependent measured query budgets. Run existing R3B/R3C/R3D regressions.
7. Review legacy route/caller migration separately. R3F selects a metric later. No automatic progression to implementation from this document.

## 13. Risks And Open Decisions

- Completed history does not exist today. These documents close design discovery, not feature readiness or browser quality gates.
- R3E-03 append/replay is explicitly accepted. Total restoration time, request count and rendered memory grow with saved depth; no total-depth cap is accepted. Sequential replay must expose progress/retry and cancellation on navigation, not silently truncate the list. Exact feedback-focus paging remains separate from history pagination.
- Current feedback DTO leaks an unnecessary internal Attention ID to its athlete owner; no manual reason presently returned by that DTO. R3E must narrow it without conflating this with a proven cross-user leak.
- Current feedback error-as-empty is confirmed. Home empty-current layout currently monopolizes the screen; history/feedback must render independently in later UI.
- Session source has zero-result reason, but current client DTO omits it. API-read extension needed, no migration.
- Current relation-independent list can show an unstartable unstarted Assignment with Start-looking copy. Do not alter R3D permissions; guard capability presentation as a narrowly scoped follow-up decision.
- Exact route can be represented safely, but duplicated/blank query values, same-route identity changes and fixed Home login return need targeted navigation tests. Current authenticated reload support does not prove logged-out exact-intent restoration.
- No canonical read receipt exists. Demo viewed events/legacy seen fields must not become R3E evidence of reading.
- No benchmark for completed-order index suitability. A bounded result with an unbounded aggregation/scan remains a risk; measurement gate before external pilot.
- Feedback follow-up count is not schema-bounded; exact thread must paginate and reveal parent linkage without recursive or per-row network work.
- Missing/invalid old facts need availability, not repaired invented rows. Supabase-to-PostgreSQL data reconciliation and provenance remain separate work.
- External 0016 rollout HOLD and general 0012 suspended-profile finding remain open. Client ownership guarantees do not widen trainer rights.

## 14. Non-Goals And Scope Confirmation

No Progress/R3F metric, charts, e1RM/volume/adherence/PRs, Motivation, achievements/rank/title, Program, AI, inbox/messages, payments, social activity or trainer profile redesign. No new feedback/history entity, no client feedback copy, no new mutation and no legacy cleanup.

The previous checkpoint created exactly one R3D feature commit and no push. This amendment edits only this document and `docs/client-workout-r3e-design-v1.md`. Production code, UI, API, routes, tests, schema, migrations and RLS are unchanged from the R3D commit. R3E implementation has not started; no staging or R3E commit is created. The documentation checkpoint waits for review of these amendments.
