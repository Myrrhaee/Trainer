# R3E: Canonical Client Feedback And Completed History

Date: 2026-09-04
Branch: `codex/r3e-client-feedback-history`
Documentation checkpoint: `2d076f39f92764858779d004b5604d6571355bc1`
Message: `docs(client-workouts): define R3E feedback and history`
Implementation status: implemented and locally verified; unstaged and uncommitted, ready for review. External rollout and native-device accessibility checks remain separate.

## 1. Scope And Authority

Implements the accepted [architecture](client-workout-r3e-architecture-v1.md) and [design](client-workout-r3e-design-v1.md), including the founder-approved append-style R3E-03 amendment. Their historical review-status text was deliberately left unchanged after acceptance. Only those two documents were explicitly staged and committed; the resulting tree was clean before implementation.

The canonical flow is:

```text
Completed WorkoutSession -> own history -> exact completed Session
-> same TrainerFeedback records -> Home or full restored history depth
```

No history/feedback domain copy, new write command, migration, index, schema/RLS change, Template hydration or R3F work. Existing Complete, Review, Feedback and relation-lineage commands remain untouched. This is local implementation evidence, not approval for external deployment or a production latency benchmark.

## 2. Before Map And Treatment

| Surface | Before / source | Classification / R3E treatment | Migration |
| --- | --- | --- | --- |
| `/client/me` | `app/client/me/page.tsx`, `ClientMePageContent` production branch -> `CanonicalClientHome`; PostgreSQL current Assignments | MIGRATED composition: independent one-item latest-feedback band and always-available Workouts link; compact empty-current state | None |
| Neutral `/client/workouts` | `app/client/workouts/page.tsx`, `ClientWorkoutsPage` -> current/upcoming only | MIGRATED: current region retained, independent completed-history region added | None |
| Exact `/client/workouts?session=S` | `CanonicalWorkoutExecution`; rich exact execution read and unbounded shared feedback DTO | MIGRATED terminal presentation: explicit client-safe exact detail and bounded feedback thread; active remains R3C/R3D | None |
| `/api/client/workouts` | `ClientWorkoutQueryService.collection/execution` | Extended with read modes; existing default execution/correlation path retained | None |
| `/api/client/feedback` | `ReviewService.listAthleteFeedback`, shared DTO, unbounded newest-first list | New R3E consumers use `latest`/`thread`; default legacy-compatible response retained for existing callers/tests, not used by new UI | None |
| `/api/workout-sessions` GET | `WorkoutSessionRepository.listAthlete`, broad list and per-Session hydration | Not used for history; unchanged legacy read surface | None |
| `/client/activity`, `/client/progress` | Production redirects to `/history`; demo/runtime branches otherwise | DEFERRED REDIRECT CLEANUP; neither route is migrated to history or R3F | None |
| `/history` | `app/(client)/history/page.tsx`, Supabase `workout_logs`, date grouping and limit 300 | LEGACY DIRECT ROUTE; unchanged and not linked from new canonical history | None |
| Old Home history/reviews | Supabase `workout_logs` / `trainer_workout_reviews` inside old `app/client/me/page.tsx` branches | Legacy opt-in retained; not a canonical data source | None |
| Demo client cabinet/runtime | `DemoClientWorkoutsPage`, `ClientRuntimeWorkouts`, explicit demo checks | PRESERVED DEMO ONLY; no state imported into R3E | None |
| Trainer profile history | `AthleteTrainingRepository.findHistory`, relation/Attention-scoped DTO | Unchanged; no client reuse of trainer-private DTO or authorization | None |

Evidence: the listed route files and symbols; architecture evidence register E01-E14 describes the pre-implementation baseline. Current canonical page protection remains `app/client/layout.tsx` -> `requireCapability("athlete")`, plus active-athlete API gate and PostgreSQL actor/RLS. This task does not broaden proxy coverage.

## 3. Read Contracts And Routes

| GET | Result / source |
| --- | --- |
| `/api/client/workouts` | Existing current/upcoming collection |
| `/api/client/workouts?mode=history&first=10[&start=C or &after=A]` | `ClientWorkoutHistoryReadModel`, actor-owned terminal Sessions only |
| `/api/client/workouts?mode=presentation&sessionId=S` | `completed` for own terminal Session; otherwise existing active `execution` |
| `/api/client/workouts?mode=completed&sessionId=S` | Terminal-only, client-safe detail; active/foreign/missing unavailable |
| Existing exact GET without mode | Existing execution and R3D completion correlation, unchanged command contract |
| `/api/client/feedback?mode=thread&sessionId=S[&first=20&after=A or &focus=F]` | Authorized completed-Session feedback page, ASC sentAt/id |
| `/api/client/feedback?mode=latest` | At most one own reply joined to immutable Assignment title |

Read responses and errors are `Cache-Control: no-store`. Actor is not accepted as a query parameter. Query keys, duplicates, IDs, limits and cursor purpose are validated. Foreign/missing exact Sessions receive generic unavailable without a fallback to another Session. `mode=completed` cannot turn an active Session into terminal presentation. R3E read modes cannot bypass R3D completion-command correlation.

Page URLs remain the existing routes. Duplicate/blank supplied Assignment/Session identities fail closed; a neutral collection is selected only when both are absent. Exact component keys reset state for changed identity/feedback selection. `safeClientReturn` allows only Home or neutral Workouts navigation metadata; external URLs, trainer flows, nested returns and execution identities are rejected. Invalid history metadata reaches the collection's explicit history-only reset. Arbitrary hashes normalize to `#history`.

## 4. History And Exact Facts

`ClientHistoryRepository.history` first materializes up to `first + 1` Session IDs, then aggregates prescription, recorded Sets and feedback independently over those IDs. It does not multiply counts by joining feedback to Sets, hydrate each Session's exercises, or fetch mutable Templates. Sort is `completed_at DESC, id DESC`; full PostgreSQL microseconds survive in the cursor. SQL has explicit athlete filtering in addition to RLS.

Row facts: Session/Assignment IDs, snapshot title, scheduled date, completion timestamp/timezone, completed/omissions status, planned exercise/Set counts, actual completed/skipped/incomplete counts and feedback count/latest timestamp. Context text, Attention IDs/reasons, resolution/audit data, capabilities and trainer queue fields are excluded. Summary is partial when coverage is absent/incomplete or unexpected pending rows exist; missing logs are not displayed as zero results.

`ClientCompletedRepository.find` uses one read-only repeatable-read transaction: Session metadata, exact Assignment snapshot, all Exercise Logs, and one batch Set Log query. The client allowlist contains prescribed fields, original athlete context/zero-result reason, exact log IDs and actual null/zero values. It does not query Attention. The exported existing `assignmentSelect` is reused without changing its query or write semantics.

Completed UI matches by Assignment Exercise/Set IDs, never position. Source-less legacy Sets show their persisted Session plan with a label. Missing prescribed rows and identifiable orphan results retain honest unavailable-plan copy. Range/duration/load/rest, per-Set differences, supersets, RPE and original Set comments remain factual. Completed controls are text/disclosures, not disabled forms. Legacy context null is not-collected, false is explicit No, true shows original text, malformed tuples are unavailable. No medical interpretation or aggregate scoring.

## 5. R3E-03 Pagination And Return

Implemented in `client-history-cursor.ts`, `client-history-navigation.ts` and `CanonicalClientHistory`:

- Initial page 10; `Показать ещё` appends. Dedupe by Session ID with stable first-seen order.
- Server default 10 / max 30 bounds one request. UI uses 10 consistently; no total history limit.
- Start token is an inclusive initial upper boundary; continuation token is an exclusive tuple below the last page. Tokens include version, domain and actor; token possession is not authorization.
- URL records `historyStart=C&historyDepth=D#workout-S`. D advances only after distinct successful page reads. Double-submit is guarded; non-advancing cursors fail locally.
- Return, Browser Back/Forward and hard reload replay pages 1..D through sequential canonical PostgreSQL reads. There is no saved row cache or hidden maximum depth.
- Partial replay preserves successful rows, cursor, requested D and anchor. Retry starts at the failed page, not page 1. Leaving early records only successfully loaded depth.
- Invalid cursor resets history only with a notice; current/upcoming remains. Exhaustion before D normalizes to actual depth with a source-change notice.
- Focus returns to the semantic row only after full requested replay or genuine exhaustion; an absent row falls back to the History heading with notice. Final Show More hands focus to the exhaustion status.
- End state: `Все тренировки показаны`. In-flight reads cancel on navigation. No localStorage/sessionStorage/history-state copy of Session/Feedback facts.

The initial boundary excludes later completions but is not a frozen database snapshot: authorized facts may change between page requests. D available pages inherently cost D history HTTP requests and D data queries, with growing rendered memory. No constant-total-cost claim and no silent cap.

## 6. Feedback And Home

`ClientFeedbackRepository.thread/latest` serialize existing `{id, sessionId, kind, body, sentAt, followUpOfId, author}` facts. No copied feedback, read receipt, notification inbox or Messages dependency. All three kinds are supported; same persisted IDs remain visible cross-role.

Feedback is an independent bounded contract: chronological ASC window, 20 default / 50 max, `Следующие ответы` replaces its window. Exact Feedback focus or explicit parent navigation requests a bounded same-Session window; it does not replay all earlier messages and never recursively hydrates parents. Invalid/foreign parents do not open another Session. Unavailable parent lookup preserves already authorized child text with a notice. Passive refetch does not repeatedly focus the newest message; only explicit entry/selection establishes initial focus.

Known-empty thread says `Тренер ещё не оставил обратную связь.` A read failure keeps Session facts and has a local Retry; confirmed account/capability/Session denial clears sensitive completed content. Window focus refreshes the same thread; duplicate overlapping refreshes are guarded.

`CanonicalRecentFeedback` displays at most one latest reply/title/date and exact Session/Feedback link. No unread/new badge. Current-work failure/empty state does not prevent the independent latest/history entry. A feedback read failure is not presented as no feedback. No write is performed on view.

## 7. Authorization And Regression Boundary

- Own Sessions, snapshots, Logs and feedback use actor-scoped SQL plus existing RLS; foreign cursors fail purpose/actor validation and foreign exact Sessions disclose no facts.
- Trainer-only accounts fail the client API's active-athlete gate. Dual-role actors can exercise their own athlete capability, not another athlete identity.
- Suspended/ended trainer relation does not remove athlete-owned history or original-trainer feedback. R3D historical lineage behavior remains unchanged.
- No trainer access expansion, Attention resolution, completion mutation, discomfort persistence change, new command or migration.
- Production R3E imports only canonical read contracts; legacy/demo branches are untouched.

## 8. Measured Performance

Observed by proxying real PostgreSQL driver calls in `tests/backend-foundation/client-workout-r3e-postgres.test.ts`, against a disposable database and app RLS. Counts include repository transactions but exclude separate HTTP auth/access reads, network round trips and route rendering.

| Read | Data SELECT/CTE statements | Total driver statements including BEGIN/actor/isolation/COMMIT |
| --- | --- | --- |
| Current/upcoming | 1 | 4 |
| First history, 10 rows | 1 | 4 |
| History, 30 rows | 1 | 4 |
| Next cursor page | 1 | 4 |
| Exact completed core | 4 | 8 |
| Feedback thread | 1 | 4 |
| Home latest feedback | 1 | 4 |

Browser observation: neutral Workouts requests current and history separately; depth-4 reload uses exactly four history GETs. A page-3 replay failure leaves 20 rows; retry finishes 34 rows with five total history attempts, not a replay restart. Exact historical reopen uses one presentation GET plus a separate thread GET; completion can add one terminal presentation GET after the R3D command/reconciliation read. The R3D browser counter is explicitly scoped to reconciliation reads; POST count/key/receipt checks were not relaxed.

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for the new history SQL:

| Disposable fixture | Returned SQL page including sentinel | Planning / execution |
| --- | --- | --- |
| 34 terminal Sessions | 11 | 2.106 ms / 1.012 ms |
| 5,034 terminal Sessions | 11 | 2.098 ms / 3.523 ms |

Small plan uses existing `workout_sessions_athlete_status_idx`; larger fixture uses sequential scan plus top-N sort before the page-scoped aggregates. Existing child indexes/RLS subplans are not application N+1 requests. The larger synthetic rows are imported-size partial facts in the disposable test database, not production seeded data or a full workload benchmark. No observed plan establishes a required new index at this tested scale, so no migration was created. This does not prove constant scan cost at arbitrary scale: a completed_at/id index decision would require separate review and the task's STOP gate.

## 9. Tests And Visual Evidence

Final gates on this working tree:

| Gate | Result |
| --- | --- |
| `npm run test:backend:postgres` | PASS: 154/154, zero skipped; includes R3B/R3C/R3D and R3E |
| `node --import tsx --test tests/ui/*.test.ts` | PASS: 89/89 |
| `npm run test:e2e:canonical -- client-feedback-history.spec.ts` | PASS: targeted R3E scenario; subsequent additional assertions also pass in the full suite |
| `npm run test:e2e:canonical` | PASS: 11/11, final run about 2 minutes |
| `npx --offline tsc --noEmit` | PASS |
| `npm run lint` | PASS, no ESLint warnings |
| `npm run build` | PASS: compiled and generated 57 static pages |
| `git diff --check` + no-index whitespace checks for untracked files | PASS |
| Restored local dev server | PASS: port 3011; protected client route redirects to login, public Home loads; agent-browser reports no page errors or error overlay |

Full E2E output still contains pre-existing DialogContent Description warnings in other workflows and NO_COLOR/FORCE_COLOR environment warnings. The R3E scenario introduces no Dialog and records no hydration/page errors. Build emitted no Recharts warning in this run; no warning-suppression fix was made. An initial invocation of nonexistent `npm run test:ui` failed; the actual repository UI test command above was then executed successfully, without adding a package script.

- PostgreSQL: 154 tests passed, none skipped; includes R3E own/foreign/current-vs-terminal scope, 10/30 pages, deterministic equal-time cursor continuation, summary availability, original detailed/acknowledgement/follow-up IDs, same-Session parent scope, suspended/ended history, allowlist checks, actual query counts and EXPLAIN.
- UI/unit: 89 tests passed. R3E tests cover cursor precision/actor/purpose/limit validation, Session-ID dedupe, depth 1000 without a hidden cap, return allowlist and malformed navigation.
- Canonical browser: initial full R3E run exposed two test expectations, corrected without relaxing command invariants. Final full run passed all 11 scenarios, including the added assertions and existing Editor/Quick Assign/Review/three-role flows.
- R3E browser coverage: current + empty/history, 34-row append, failed append, full return/reload, Back/Forward, page-3 failed replay/Retry, absent anchor, no feedback, original linked detailed/follow-up, acknowledgement, legacy-null read-boundary fixture, original discomfort/comment, ended-relation feedback, scoped read failures, foreign unavailable, invalid cursor and trainer API denial.
- Legacy-null browser data is an explicitly intercepted read-boundary fixture. Canonical persisted relation/Session/feedback cases use real commands; R3D's separate 0015-to-0016 PostgreSQL upgrade test remains the legacy-null storage evidence. No schema/constraints were disabled to create browser fixtures.
- Viewports: 390x844, 390x500, 720x512 (200%-equivalent reflow), 1440x1024. Long persisted feedback and unbroken text wrap; Plan/Actual stack on narrow screens. Semantic row focus and keyboard Tab were exercised. No new pageerror/hydration/DialogDescription error in the R3E scenario. Native OS zoom, screen reader and physical device were not claimed as tested.

Ignored artifacts under `test-results/canonical/client-feedback-history-R3-78814-y-partial-errors-and-mobile-canonical-desktop-chrome/`: `r3e-history-390x844.png`, `r3e-detail-390x844.png`, `r3e-detail-390x500.png`, `r3e-detail-720x512.png`, `r3e-detail-1440x1024.png`. Detail captures show scrolled context/results as well as reflow; they are not all top-of-page captures. Screenshots/traces are not staged.

## 10. Changed Files

Modified existing files:

- `app/api/client/workouts/route.ts`: strict read modes, auth/no-store/error boundaries.
- `app/api/client/feedback/route.ts`: bounded thread and latest read modes; existing compatibility mode retained.
- `app/client/workouts/page.tsx`: exact identity/reset and safe return context.
- `components/client/canonical-client-home.tsx`: independent history/latest composition and compact current-empty state.
- `components/client/canonical-workout-execution.tsx`: terminal presenter dispatch; old shared/unbounded feedback presenter removed.
- `lib/server/client-workouts/client-workout-repository.ts`: export existing Assignment SELECT for exact reuse.
- `tests/e2e-canonical/client-workout-completion.spec.ts`: separate R3D reconciliation count from R3E completed presentation read; command assertions unchanged.

New implementation files:

- `components/client/canonical-client-history.tsx`
- `components/client/canonical-completed-workout.tsx`
- `components/client/canonical-recent-feedback.tsx`
- `lib/client-history-navigation.ts`
- `lib/server/client-workouts/client-history-cursor.ts`
- `lib/server/client-workouts/client-history-types.ts`
- `lib/server/client-workouts/client-history-repository.ts`
- `lib/server/client-workouts/client-completed-types.ts`
- `lib/server/client-workouts/client-completed-repository.ts`
- `lib/server/client-workouts/client-feedback-repository.ts`
- `tests/ui/client-history-navigation.test.ts`
- `tests/backend-foundation/client-workout-r3e-postgres.test.ts`
- `tests/e2e-canonical/client-feedback-history.spec.ts`
- This report.

## 11. Remaining Risks And Boundaries

1. External 0016 migration rollout remains HOLD pending the independent provenance/backup/rollout gate from R3D. R3E adds no migration and does not close that external gate.
2. Full history depth deliberately has growing requests, memory and DOM size. The tests exercise 34 rendered rows/four replay pages and 5,034 database rows, not arbitrary-depth browser capacity. Any cap/index requires a separate product/architecture decision.
3. `/client/activity` and `/client/progress` still lead to legacy `/history`; they are outside R3E/R3F scope. Old default feedback and Session-list API surfaces remain broader than the new client-safe reads; no new UI calls them for history/feedback.
4. The fixed Home login return in the existing client layout still does not guarantee expired-auth exact-link restoration. Authenticated return/reload is tested; auth redesign is not included.
5. Generic feedback notifications still target Home; the single latest block cannot identify an older notification after newer replies arrive. No unread receipt or transport deep-link redesign.
6. Current/upcoming's existing 20-row bound/hasMore UX remains unchanged. History pagination must not be mistaken for current-assignment pagination.
7. Native 200% zoom, screen-reader and physical-device QA remain manual checks. Equivalent narrow reflow/keyboard/focus/overflow are browser-tested; this is not a blanket accessibility certification.

## 12. Git And Scope Confirmation

The only new commit is the two-document checkpoint above. R3E implementation and this report remain unstaged and uncommitted: 7 modified tracked files and 14 untracked files, staged diff empty. Ordinary tracked diff: 227 insertions / 113 deletions; new files are additional to `git diff --stat` and are explicitly listed in section 10. The accepted architecture/design files still match the checkpoint exactly. No push, schema/index/migration/RLS change, package/config change, R3F implementation, or legacy cleanup. Generated test/build outputs remain ignored.
