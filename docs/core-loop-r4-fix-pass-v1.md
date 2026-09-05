# R4 Fix Pass 1: atomic batch Save evidence

Дата: 2026-09-04. Branch: `codex/r4-core-loop-integration-gate`.
Production baseline: `ac7b67535ed7f45fb6b9d3b776ec14074917c350`.
R3F docs: `fdaf2be82a01ac5c9d780f409a412e5587d02e7a`.
Part A audit commit: `ee1cb3dff07d4521a8bb8e8f80175708e908d272`, `docs(core-loop): audit R4 pilot readiness`.

## 1. Initial-pass verdict and stop condition (historical)

The initial pass below is retained as history. The authorized isolated-worktree continuation is recorded in sections 11-16; its results supersede the old same-checkout browser STOP, not the original audit evidence. The subsequent Final Fix Pass stopped at the explicit P1-A product-contract gate; see section 17. Its STOP does not invalidate the earlier regression results or claim new fixes.

Part A complete: exactly three reviewed R4 audit documents committed, then clean working tree confirmed. Original audit retained unchanged, including the historical P1.

Part B: server-side atomicity fix implemented; new PostgreSQL regressions PASS; existing R3C behavior preserved. Implementation is unstaged/uncommitted pending review. Browser invalid-second-Set regression added to existing canonical spec but not executed.

**Part C STOP: existing canonical harness cannot run beside the user's dev server in the same checkout.** Fresh invocation confirmed the lock conflict before any browser tests. No infrastructure workaround or config/package change was made. Therefore two-cycle browser, browser failure recovery, fresh mobile/a11y and final Part D reassessment are not complete. Pilot readiness remains **NOT READY / browser gate BLOCKED**, not PASS.

The original atomicity P1 is closed at repository/service regression level; its browser gate remains unverified. No new P0 was demonstrated. A global final P0=0/P1=0 certification is withheld until browser gate and P2 classification are completed. R3F is intentionally deferred; 0016 external rollout remains a separate HOLD.

## 2. Root cause: actual command path

1. `components/client/canonical-workout-execution.tsx`, `saveSet` / `submitSetAttempt`: current UI Save submits one Set in `attempt.frozenPayload`, not a series of hidden independent batch commands. It retains input until success, uses the same attempt identity for retry and has separate conflict/unknown states.
2. `lib/client-workout-progress-command.ts`: freezes Set ID, source identity, expected Session version, actual facts and idempotency key; exact reconciliation remains R3C.
3. `app/api/workout-sessions/[sessionId]/progress/route.ts`: same-origin/body/actor/athlete capability checks, then one service call. One response represents the whole request.
4. `WorkoutSessionService.saveProgress`: accepts **1..20 Sets in one logical command**, validates every input shape and numeric/null/status constraints, rejects duplicate IDs before DB work, hashes the normalized whole `{ expectedVersion, sets }` request with one idempotency key. Session ID is separately bound by receipt validation.
5. `WorkoutSessionRepository.saveProgress`: one transaction, actor context, exact owned Session `FOR UPDATE`, receipt lookup, active/version checks; previously updated Sets sequentially and returned null on a missing target.
6. `withDatabaseTransaction`: begins before repository reads, COMMIT on normal return (including null), ROLLBACK on throw. There was no nested transaction or premature driver commit; **normal-return error signaling after a write was the leak**.
7. Exercise aggregates, one Session version increment, one receipt and one audit event were after the loop. Missing Set B skipped those while Set A committed.

Original behavior from audit: valid A + missing B returned null, A became completed with 55 kg, version stayed 1, progress receipts stayed 0. API translates null to existing generic `404 active_session_not_found`; it does not disclose whether B exists or belongs to somebody else.

Logical contract is unchanged: one accepted Save request is all-or-nothing. UI currently submits one Set but the supported batch endpoint must also be atomic. No client-only workaround, valid-prefix preservation, fresh-key retry, local fact cache or optimistic browser rollback was introduced.

## 3. Exact fix

Only production file changed: `lib/server/workout-sessions/workout-session-repository.ts`, `saveProgress`.

After the existing exact Session lock, receipt/active/version checks, one set-based SELECT resolves **all** requested SetLog IDs before the first business UPDATE:

- exact athlete and active Session;
- SetLog -> ExerciseLog -> exact Session;
- AssignmentExercise belongs to that Session's Assignment;
- non-null source AssignmentSet belongs to that AssignmentExercise, with matching stable set key and position;
- existing generated legacy sets remain supported only with null source, canonical `generated-{position}` key, valid snapshot position, and no source set rows for that AssignmentExercise;
- returned target count must equal request count; an empty/direct duplicate batch cannot write.

This preserves nullable source semantics already created by `startOrResume`; it does not invent Exercise UUID continuity or require a migration. Service payload and duplicate validation remain in place.

Unknown/foreign/mismatched target returns the existing generic failure **before any writes**. After successful preflight, an unexpected UPDATE row count now **throws** `SessionVersionConflictError`, forcing rollback rather than returning null. SQL exceptions already roll back through the existing transaction helper. The defensive guard also covers an unexpected missing second row after preflight.

Lock order remains Session first, then its existing child writes. No global lock or new child lock order was added. The preflight reads immutable snapshot/log lineage while Session lock serializes canonical Save and Complete; catalog Exercise lookup is not involved.

## 4. Atomicity, version and receipt proof

New file: `tests/backend-foundation/workout-session-batch-atomicity-postgres.test.ts`.
Fresh suite executed real service normalization, PostgreSQL transactions and `ai_strength_app` RLS in disposable test DB; fixture setup uses existing identity/relation and Template/Assignment/Start conventions. The new fixture also covers the established generated/null-source Sets. Existing rich source-set R3C test remains enabled and passes.

| Required scenario | Fresh result |
| --- | --- |
| Valid first + invalid second, including previously persisted actuals | PASS: zero candidate UPDATEs; complete Session/log snapshot, version, receipts, audit and Attention unchanged. |
| Invalid first + valid second | PASS: same all-or-nothing invariant; not order dependent. |
| Valid + foreign Set | PASS: generic failure; own and foreign snapshots unchanged. |
| Duplicate Set ID | PASS: service `duplicate_sets` validation, no writes. |
| Stale expectedVersion | PASS: conflict with no changes. |
| Successful multi-Set batch | PASS: both Sets stored, null != numeric zero, version increments once, one receipt and progress audit. |
| Same key + same normalized batch | PASS: same persisted response, no extra receipt/version/audit. |
| Same key + changed batch | PASS: idempotency conflict, no changes. |
| Database exception after first real UPDATE | PASS: injected PostgreSQL division-by-zero; all actual/version/receipt state rolled back. |
| Unexpected second UPDATE rowCount=0 after valid preflight | PASS: defensive conflict throws, first update rolled back. |
| Database exception after receipt write | PASS: all Sets, aggregate/version/receipt/audit rolled back. |
| Lost response after successful batch | PASS at service layer: discard response, exact Session read, same-key replay; no duplicate mutation. Not a browser transport test. |
| Save vs Complete | PASS: Complete waits on held Session lock; independent read sees only old committed batch state; stale Complete conflicts after Save commits; refreshed Complete terminalizes all saved facts; no subsequent terminal Save. |
| Browser invalid second Set after reload | ADDED, NOT RUN due Part C STOP. |

Eleven new PostgreSQL subtests plus their parent run inside the full suite. Targeted atomicity results are reported from that full invocation, not claimed as an additional independent targeted run. Initial development run failed only in new fixture setup (missing required Template description/instance fields); fixture corrected, final suite fully passed. No original R3C test removed or weakened.

## 5. Completion serialization and other repository failures

The concurrency test deliberately pauses after the first actual Set UPDATE while retaining Session lock, starts Complete and observes its lock attempt, confirms a separate reader sees all-old facts, then releases Save. Save commits the full batch at version 2; Complete with version 1 rejects. Retrying Complete with version 2 yields terminal version 3 with all results present. A later Save returns unavailable without modifying terminal data.

Any thrown database/repository error still rolls back, including failures after writes or receipt insert. The specific formerly normal-return-after-write branch is now throwing. Early null exits for unknown Session/target occur before business writes. This is not a claim that every repository in the entire project was exhaustively audited for all possible normal-return failure patterns.

## 6. UI failure and browser test coverage

Execution UI not changed. Successful response alone clears dirty input and marks saved. Known 400 failures retain local values; existing 404/409 handling presents conflict and allows continued editing; 5xx/transport retains frozen unknown attempt for Check/reconcile. The API error shape/status was not changed. An unknown/foreign batch target therefore uses the existing generic 404/conflict presentation, not a new field-specific error disclosure.

Added a step to `tests/e2e-canonical/client-workout-completion.spec.ts`: intercept existing one-Set Save, append a nonexistent second Set and call **the real backend** with `route.fetch`; assert actual 404, local first input still 11, no saved label, exact Set focus; compare exact persisted Session and receipt count before/after reload. It is protocol fault injection through the browser, not a new multi-Set UI. This test has been type-checked but not browser-executed.

Existing R3C UI/unit tests passed (frozen attempts, null/zero, skip, reconciliation and conflict). No fresh browser claim for lost response, two-tab Start, suspension, feedback duplicate, history return or two complete cycles is made in this pass.

## 7. Harness limitation and required review

Current configuration inspected:

- `scripts/e2e/run-canonical.mjs` provisions a disposable DB, sets test auth/memory delivery, hardcodes origin `http://127.0.0.1:3101`, calls normal bootstrap/migrator, and drops the test DB in finally.
- `playwright.canonical.config.ts` hardcodes baseURL 3101 and `npm run dev -- --hostname 127.0.0.1 --port 3101`, with `reuseExistingServer: false`.
- `next.config.ts` has no isolated distDir option; package dev command is plain `next dev`.
- The user's server remains PID 12650 on 3011, same checkout and `.next` dev directory. Different port does **not** isolate the directory lock.

Fresh `npm run test:e2e:canonical`: disposable DB bootstrap and migrations through 0016 succeeded; Next rejected startup with `Another next dev server is already running`, identifying PID 12650/3011; Playwright reports webServer exit 1. **Zero browser tests executed**, not failed assertions. Server 3011 was not killed or reused as fixture. No tests ran against the ordinary user DB.

Per explicit task STOP: no config/package/harness workaround, copied checkout, alternative test DB binding to user's server, or replacement production webServer was introduced. Continuing requires review/authorization of isolated E2E build-directory/server support, or a separately scheduled run after the user releases the dev lock. Changing only PORT/BASE_URL is insufficient. Part C1-C4 and final Part D remain blocked.

## 8. Fresh regression and performance

| Command / gate | Result |
| --- | --- |
| `npm run test:backend:postgres` | PASS: **166/166**, 0 failed/skipped. New 11 atomicity subtests + parent; existing 154 retained. |
| `node --import tsx --test tests/ui/*.test.ts` | PASS: **89/89**, 0 failed/skipped. An initial incorrect invocation with React-server condition was discarded; this is the correct UI runner. |
| `npx tsc --noEmit --incremental false` | PASS, including browser regression. |
| `npm run lint` | PASS, no diagnostics. |
| `npm run build` | PASS; no Recharts warning printed in this run. No warning fix performed. |
| `npm run test:e2e:canonical` | BLOCKED startup, 0 executed; dev lock, not a test failure. |
| `git diff --check` | PASS; new files also checked for whitespace. |
| Fresh mobile / a11y | NOT RUN: 390x844, 390x500, desktop, 200% equivalent/native remain unverified in this pass. |

Temporary local logs: `/tmp/r4-fix-postgres.log`, `/tmp/r4-fix-ui.log`, `/tmp/r4-fix-typescript.log`, `/tmp/r4-fix-lint.log`, `/tmp/r4-fix-build.log`, `/tmp/r4-fix-e2e.log`. No logs/artifacts staged.

Performance cost is explicit: one set-based lineage SELECT per new Save, independent of number of requested targets. Existing R3C query-count assertions updated **13 -> 14**, retaining exact bounded checks for Save repetitions, duration and Skip. Existing exact-read 11 and R3D completion 19 / replay 10 / reconcile 12 / Dashboard 12 / Review 9 remain passing. Batch still has one UPDATE per Set as before, not a new read-per-Set pattern. No new latency SLA or fresh HTTP budget is claimed.

## 9. P2 reassessment: provisional only after browser STOP

No P2 fixed. The following are **code-based recommendations**, not founder acceptance and not a substitute for requested fresh browser evidence. Dispositions use the requested vocabulary; final Part D remains pending. Frequency is a pilot hypothesis, not measured usage.

| P2 | Evidence / user task / entry / failure | Recovery / likely frequency | Correctness / privacy | Recommended disposition |
| --- | --- | --- | --- | --- |
| 01 Open Home stale assignment | `canonical-client-home.tsx` mount-only current GET versus feedback component focus reload. A is already on Home when T assigns; current card does not auto-refetch on focus. | Reload/new mount can refresh; likely common two-role pilot interaction. Navigation remount vs retained state needs browser proof. | Commands server-check; no demonstrated wrong persisted mutation or privacy effect. | **ACCEPT FOR INTERNAL PILOT**, only if founder explicitly accepts manual reload and verifies discoverability; not accepted by this document. |
| 02 Auth loses exact return | Client/trainer layouts pass fixed Home/Dashboard to access guard. Logged-out/expired W/S link loses exact intent on login. | Home/Workouts may recover discoverability; intermittent expiry/direct-link use. Unsaved inputs across auth loss are not proven preserved; persisted facts survive. | No demonstrated stored-data change/leak; whether hidden W creates a dead end must be tested with P2-03. | **FIX BEFORE PILOT** unless browser evidence proves a safe, accepted bounded workaround. |
| 03 More than 20 current assignments | `ClientWorkoutRepository.listCurrent`: active Sessions first, then scheduled date/createdAt/ID, 20+sentinel. `hasMore` not presented. No single-active-Session invariant is enforced; current query also does not filter inactive relation rows before limit. | Exact link can read a hidden own W, but collection cannot reveal it. Probably low frequency in tiny pilot, not a guarantee. | Cannot certify that only distant future rows are hidden: many active Sessions or old unavailable-to-start assignments can crowd eligible work. No fresh >20 fixture executed; possible escalation requires evidence. No foreign-data leakage shown. | **FIX BEFORE PILOT** / reproduce ordering and relation variants first. Do not approve this as harmless distant-future pagination without proof or invent pagination now. |
| 04 Next Item inconsistency | Source A: entry queue filter/order/position; source B: transition service builds fresh reviews/assignments then `candidates[0]`, honoring filter but not order/position. Context can therefore imply a different secondary next row. | Explicit Queue lets T choose exact task; occurs after review/assign receipt with non-default ordering/position. | Selected candidate still canonical/authorized. No evidence yet of incorrect primary action; independent active/future Profile versus Dashboard selection also needs fixture. Retain P2, escalate if primary decision is wrong. | **ACCEPT FOR INTERNAL PILOT** only for explicit secondary server-priority ordering acceptance; not accepted here and not an unconditional PASS. |
| 05 GET failure shown as unavailable | Exact presentation fetch in `canonical-workout-execution.tsx`; catch sets `error`, then no-model branch returns unavailable before error rendering. | Browser reload/back can recover, but no local Retry and text suggests stale/changed assignment; network failures plausible on mobile. | Persisted facts unchanged; transport versus missing/forbidden meaning conflated, no privacy leak shown. | **FIX BEFORE PILOT**, targeted error/retry semantics, no redesign. |

Security item F06 (broad 0012 suspended Profile) remains separate **DEFER PRE-BETA** hardening only with explicit pilot-scope security acceptance; this pass grants no acceptance or new trainer rights. R3D historical Review stays bounded to original terminal lineage.

No recommendation above approves automatic P2 implementation. Global P1 count cannot be finalized on an unexecuted browser gate or the untested >20/Next Item edge cases.

## 10. Changed files and remaining scope

Uncommitted implementation:

1. `lib/server/workout-sessions/workout-session-repository.ts`: preflight full batch, defensive rollback on unexpected UPDATE miss.
2. `tests/backend-foundation/workout-session-batch-atomicity-postgres.test.ts`: new atomicity/replay/fault/concurrency tests.
3. `tests/backend-foundation/client-workout-r3c-postgres.test.ts`: three exact query-count budgets account for one preflight; other assertions retained.
4. `tests/e2e-canonical/client-workout-completion.spec.ts`: invalid-second-Set browser regression step.
5. `docs/core-loop-r4-fix-pass-v1.md`: this evidence report.

API handlers/contracts, UI production components, PostgreSQL schema/migrations, routes, package/config files unchanged. No R3F feature, R4 feature expansion, realtime/polling, extra cache or P2 fix introduced. Original audit docs unchanged after their standalone documentation commit. Implementation remains **unstaged and uncommitted**; no push.

Next required decision: approve isolated E2E harness support or arrange a non-conflicting dev-server window. Then run the existing new regression plus fresh two-cycle/failure/mobile gates, complete P2 reassessment and obtain explicit founder decisions. Do not mark internal pilot ready before those gates close; external 0016 deployment still needs provenance preflight, backup and rollout review.

## 11. Authorized isolated continuation, 2026-09-04

Method: detached temporary Git worktree `/tmp/ai-strength-r4-e2e-20260904` at `ee1cb3dff07d4521a8bb8e8f80175708e908d272`. Explicitly copied the four current modified/new production/test files and this report, not merely committed HEAD. Installed independent dependencies with `npm ci --no-audit --no-fund`; no dependency manifest/lockfile edits, no symlinked node_modules or shared `.next`.

The existing unchanged `scripts/e2e/run-canonical.mjs` / `playwright.canonical.config.ts` launched Chrome against **127.0.0.1:3101** in that worktree. Its disposable `ai_strength_e2e_<pid>` database was bootstrapped/migrated through 0016 and dropped by the harness. The ordinary user database was not used for browser fixtures. The existing PostgreSQL container was reused without recreation, using its existing Compose project name; only disposable databases were created/deleted. Backend tests likewise use the existing `ai_strength_backend_<pid>` convention.

Isolated ignored test environment: loopback PostgreSQL role connection URLs, Compose settings, numeric test OTP limits, fresh random local auth signing/OTP secrets; no real Telegram/Google/external service keys. Credentials are deliberately not reproduced here. Package, Next, Playwright, Compose and harness source were not modified. The original user Next process **PID 12650 on :3011** remained listening; it was never killed, restarted or reused by Playwright. The only explicitly terminated process during test development was an isolated Playwright worker stalled by a new-test readiness race; the harness then cleaned up normally.

An initial new-scenario run exposed a separate environment dependency: `app/client/me/page.tsx:43` invokes `createClient()` at module evaluation, before its canonical/legacy branch (`:446`); `lib/supabase-client.ts:4-15` requires public Supabase values even for canonical PostgreSQL Home. Subsequent runs supplied process-only **non-secret dummy** public values (URL `http://127.0.0.1:54321`, placeholder anon key), not a Supabase service/backend. This is an environment prerequisite, not a production fix or mock fact source. Request monitoring in the final R4 test checks that neither the dummy Supabase endpoint nor `.supabase.co` is used for browser facts. Removing this eager legacy dependency remains a separate pre-pilot environment-hardening recommendation.

### Source parity

SHA-256 equality was checked before testing and again after the new scenario was developed:

| File | Identical main / isolated SHA-256 |
| --- | --- |
| `lib/server/workout-sessions/workout-session-repository.ts` | `4a2ff674cac03206a8449f6a15f8b85c6a0556fe36477b26d0686e0c2237a72a` |
| `tests/backend-foundation/client-workout-r3c-postgres.test.ts` | `647659f617cf8c9963b9d7242de901b0b9d7807e3521f10916111b7c7b62611d` |
| `tests/e2e-canonical/client-workout-completion.spec.ts` | `8b9ddba0d093d06155ad7ee40a29b233de49b0df89c4429b08b7b4c845661000` |
| `tests/backend-foundation/workout-session-batch-atomicity-postgres.test.ts` | `b9abc535cb1ebb90eda7c144cb944c2f121cef4fb718e1021e6656f7183ef603` |

Thus fresh browser runs exercise the uncommitted production fix, not just HEAD. The new `tests/e2e-canonical/core-loop-r4.spec.ts` is test-only verification; exact transfer parity is checked separately at delivery.

## 12. Fresh browser evidence

**Targeted P1 FIRST: PASS, 1/1, 0 skipped, 50.7 s runner total / 22.6 s test.** Existing R3D spec includes the new real-backend invalid-second-Set regression. Valid local Set A=11 plus unknown Set B returns actual 404; A is not persisted, version/receipt and entire exact Session unchanged, including after reload; input 11 and exact Set focus remain available before reload. Reverse invalid-first order is covered by PostgreSQL, not a fabricated second browser editing UI.

`core-loop-r4.spec.ts` adds two sequential complete cycles, with no SQL domain edits between steps. Initial SQL is limited to synthetic identity/capability/relation fixture setup; Template Save/Publish, Assignment, Start, batch Save, Complete and Feedback use real authenticated production HTTP commands. One post-Start SQL SELECT checks the persisted relation ID; it does not mutate state. Template construction is fixture setup, not a new Builder browser claim.

Each cycle opens Dashboard and the exact Profile, invokes the production Quick Assign Sheet, checks selected revision and Assignment IDs, reloads stale Client Home, opens exact Assignment, starts exact Session, saves two Sets in one API command, replays the same key, reloads UI values, skips the third Set, completes via dialog, opens exact Queue/Review, sends Feedback, follows Client Home's exact Session/Feedback link, and returns from completed detail to focused History row. Cycle 2 creates distinct Assignment/Session/Attention/Feedback IDs. Dashboard-to-Profile is an explicit exact URL navigation in this new test; existing three-role coverage separately exercises Dashboard and roster entry buttons. Multi-Set Save is the supported batch HTTP operation, not a claim that the UI has a bulk-Save button.

The scenario deliberately **characterizes known P2 defects** with assertions. A green characterization test proves reproducibility, not product acceptance. See section 14 for escalations.

Existing unchanged canonical specs supply Start unknown/no-persist/same-key recovery, persisted unknown Save reconciliation, known Save failure retry, reload/second-tab resume, Save/Complete dirty/unknown interlock, Completion known failure/unknown/reconcile/concurrent terminalization, foreign Session denial, original-trainer suspended-after-Start completion/review, feedback read error distinct from empty feedback, history 10/20/30/34 append/dedupe/exact return/full replay/partial prefix recovery, malformed history navigation, and failed navigation after persisted completion. Authorization/RLS remains primarily PostgreSQL evidence, not synthetic UI-only checks.

## 13. Fresh mobile and accessibility scope

The new R4 scenario checks **Quick Assign, Execution, Completion, Review, History, Completed Detail** at 1440x1024, 390x844, 390x500 and 720x512 (200%-equivalent reflow, not native zoom). For each surface/viewport it checks document overflow <=1 px, scrolls the required action into view, asserts viewport intersection and Playwright trial-click actionability, and captures initial/action screenshots: 48 images. Long comments wrap; short-height sheets/dialogs require scrolling but their submit controls remain reachable.

Keyboard Enter is exercised on assignment and feedback submission. Exact heading/row focus is asserted after success, feedback entry and history return; the P1 test asserts error focus. Existing R3D/R2B tests cover exact validation-field focus and long-review jumps/sticky boundaries. This is **not** an all-keyboard-only journey, native-device, virtual-keyboard, native-zoom or screen-reader certification.

Fresh new-scenario console captures localized four `Missing Description / aria-describedby` warnings to the Profile Quick Assign Sheet. Evidence: `components/trainer/quick-assign/canonical-quick-assign-sheet.tsx:391-402` supplies custom `quick-assign-description`; the Radix description diagnostic looks up its generated context ID. A visible description exists, but this diagnostic still needs explicit a11y follow-up; it was recorded rather than suppressed/fixed. No hydration/page-error was accepted by the new test. Node NO_COLOR/FORCE_COLOR warnings and existing deprecated dependency install notices are tooling warnings, not silently repaired.

Visual sampling also showed that completion time uses Session timezone while feedback time uses the history formatter default (`canonical-completed-workout.tsx:125,518`); this can display different clock conventions in one detail view. No timestamp data mutation was demonstrated. Track a display-timezone review separately, without adding a Progress week contract or changing code in R4 verification.

## 14. Final P2 reassessment from fresh browser facts

These dispositions are engineering recommendations, **not founder acceptance**. Pilot frequencies are hypotheses for a trainer/two-athlete pilot, not usage measurements. No P2/P1 follow-up implementation is authorized by this report.

| Item / final severity | Evidence and reproduction / user task | Data correctness / privacy | Recovery / likely frequency | Disposition |
| --- | --- | --- | --- | --- |
| P2-01, remains P2 | Keep Client Home open, assign from trainer, dispatch focus; feedback GET runs but current card remains empty until reload. `canonical-client-home.tsx:42` mount-only read; new R4 `homeStaleOnFocus` evidence. Task: discover new work. | Persisted Assignment and exact GET correct; no leak demonstrated. | Reload reliably reveals exact Assignment; likely common in paired pilot. | **ACCEPT FOR INTERNAL PILOT**, conditional on explicit founder acceptance of manual refresh. Not accepted automatically. |
| P2-02, remains P2 | Guest exact Session/Assignment URL redirects to `/login?next=%2Fclient%2Fme`, losing exact intent. `app/client/layout.tsx` capability guard; R4 guest navigation. | No mutation/leak demonstrated. Exact link lost, not persisted data. | Reopen saved link or navigate History/current after login; hidden current edge makes discovery unreliable. Intermittent expiry/deep-link use. Full expired-session unsaved-input preservation is not certified. | **FIX BEFORE PILOT**. |
| P2-03 -> **P1** | `ClientWorkoutRepository.listCurrent:91-108` orders active first, then scheduled_for/created_at/id, reads 21 and returns 20. Via real commands create/start 21 distinct Assignments. Result: 20 active rows + hasMore; 21st active Session absent from current UI, while its exact GET is active. `core-loop-r4.spec.ts`, hiddenActive evidence. Task: find/resume an already started workout. | Stored Session correct; discovery loses an immediately actionable item. No foreign-data leakage shown. No global one-active-Session invariant prevents this fixture. | Known exact URL works, but UI cannot discover hidden ID or load more. Low expected tiny-pilot frequency, not a safety guarantee. | **FIX BEFORE PILOT**. Escalated because this is not merely farther upcoming work. |
| P2-04 -> **P1** | Same persisted facts: one active Session, no unstarted future Assignment, no pending Review. Dashboard projector marks on_track with no primary action (`canonical-trainer-dashboard-model.ts:40-55`); Profile primary is Assign (`athlete-training-profile-frame-projector.ts:106-145`). R4 reads real Dashboard snapshot and opens Profile. Task: choose next trainer action. | Canonical projections disagree about primary work; no write/leak demonstrated. | Explicit Profile allows assignment, but trainer must know Dashboard is incomplete. Normal in-progress-without-next scenario. | **FIX BEFORE PILOT**, mandatory escalation under review rule. Separate secondary next-item ordering issue remains subordinate, not the basis of this escalation. |
| P2-05, remains P2 | Inject first exact presentation GET 503; shows `Тренировка недоступна`, no Retry; reload recovers exact completed Session. `canonical-workout-execution.tsx:391-404` no-model branch precedes error presentation; completed detail has analogous no-model failed branch. | No data loss or ownership leak; transient failure misrepresented as terminal availability. | Reload works but isn't offered as Retry; plausible mobile network failures. | **FIX BEFORE PILOT**. |

F06 broad 0012 suspended Profile policy remains separate **DEFER PRE-BETA** security hardening, subject to explicit pilot-scope acceptance; this report adds no trainer access. Eager legacy Supabase Home dependency needs an explicit environment prerequisite or future removal before deployment; no real Supabase was used by this verification. Timezone display and existing description warnings are additional **DEFER PRE-BETA** review recommendations, not silently accepted accessibility/security waivers.

## 15. Current pilot conclusion

The original batch atomicity P1 is closed with PostgreSQL and fresh real-backend browser evidence. **Two P1s remain**: hidden active Session behind current-list hard limit and cross-surface primary-action disagreement. No P0 was demonstrated within the audited/tested scope. Consequently **internal pilot is NOT READY**, even when the canonical regression suite is green. This is not a claim of zero undiscovered defects outside the tested scope.

Next fix review must cover the two escalated P1s, auth exact return and transport/error Retry semantics; obtain founder disposition for stale Home and remaining P2/security warnings. No such fixes were made during isolated verification. **0016 external rollout remains a separate deployment HOLD**, independent of passing clean disposable-db migrations.

## 16. Final regression and delivery record

The earlier initial-pass results in section 8 remain historical and are not substituted for these fresh runs.

| Final gate | Fresh result |
| --- | --- |
| Targeted P1 browser, run before full suite | **1 passed**, 0 failed/skipped; 50.7 s total. |
| Full canonical, final source including two-tab stale Save | **12 passed**, 0 failed/skipped; **2.7 min**, Chrome channel, 3101, isolated workspace/database. |
| New two-cycle + P2 + two-tab R4 scenario | **PASS, 27.2 s** within final full suite. Earlier standalone two-cycle run: 1 passed / 28.2 s test, before adding two-tab assertion. |
| Save/Complete browser recovery | PASS through existing R3C/R3D scenarios; no-persist and persisted unknown, same-key retry, exact read, dirty/unknown completion interlock, concurrent terminal reconciliation. |
| Two-tab stale Save | PASS: both open one version; first saves 7, second submits local 8 -> actual409, local8 and exact row focus retained; persisted7/version+1; reload sees7. This is sequential stale-tab contention; simultaneous Save/Complete transaction locking is proved by PostgreSQL, not claimed as a browser-scheduled race. |
| Mobile/reflow/actionability | PASS for the six surfaces x four viewports; 48 screenshots and actionability checks; description warnings remain, no native/screen-reader certification. |
| `npm run test:backend:postgres` | **166/166**, 0 failed/skipped/cancelled; test duration 12,074 ms, disposable backend DB. |
| `node --import tsx --test tests/ui/*.test.ts` | **89/89**, 0 failed/skipped/cancelled; 486 ms. |
| `npx tsc --noEmit --incremental false` | PASS, no diagnostics. |
| `npm run lint` | PASS, no diagnostics. |
| `npm run build` | PASS with isolated test environment loaded; no Recharts warning printed or fixed. |
| `git diff --check` and new-file whitespace check | PASS. |

Build invocation used a Node `--env-file=.env.development.local` wrapper to spawn the unchanged `npm run build`, plus the process-only dummy Supabase public values noted above. An initial build without the env file failed prerender module initialization on missing `DATABASE_AUTH_URL`; the configured repeat passed. Production-mode compilation is verified, **external deployment configuration is not**. The placeholder DB pathname was not the user's DB and no real Supabase network requests occurred in the new browser scenario (`supabaseRequests: 0`).

Test-development failures are not hidden: the new test initially hit the eager Supabase dependency, an ambiguous repeated Review comment locator, and a feedback heading-vs-container locator. A later isolated test worker was terminated after trace diagnosis showed Enter sent to a still-disabled preview-loading button. Test-only fixes narrowed locators and awaited enabled submission; no original assertions or production semantics were weakened. Final full suite passed without retries (config retries=0). An earlier full invocation also passed 12/12 in 2.6 min; the 2.7 min run is the final source result.

Exact final two-cycle evidence (synthetic disposable fixture IDs):

| Cycle | Assignment | Session | AttentionItem | Feedback |
| --- | --- | --- | --- | --- |
| 1 | `860427b9-de19-4a14-96b1-4389955549d0` | `81e2f33a-f8cc-414f-a959-8cde5277677d` | `363519ae-0410-4906-a048-7a82efdbf11e` | `0124f9da-2da2-4f28-8d5a-70193bc736e1` |
| 2 | `a9c5d0ea-f69a-47eb-bf68-801efccb5505` | `61579c56-3dda-4bc3-bc5a-5086b1dfa09f` | `a23195c1-8a47-4115-9b65-7eda6223b5cc` | `cb790e74-5ad3-404f-a361-4ab9b51eba30` |

Only the explicitly new `tests/e2e-canonical/core-loop-r4.spec.ts` was copied back from isolated workspace. Main / isolated SHA-256: `b6527f6c64156e66c797ab93304a1bc3fe524e6e5a9cf9eeea4cc91bc57634d0`. This report was updated directly in main. The four pre-existing production/test source hashes in section 11 stayed unchanged.

Final main scope: **3 modified + 3 untracked**, index empty:

- Modified: `lib/server/workout-sessions/workout-session-repository.ts`.
- Modified: `tests/backend-foundation/client-workout-r3c-postgres.test.ts`.
- Modified: `tests/e2e-canonical/client-workout-completion.spec.ts`.
- Untracked: `tests/backend-foundation/workout-session-batch-atomicity-postgres.test.ts`.
- Untracked: `tests/e2e-canonical/core-loop-r4.spec.ts`.
- Untracked: `docs/core-loop-r4-fix-pass-v1.md`.

Tracked diff: 3 files, 50 insertions / 4 deletions; Git's tracked diff stat excludes the three untracked files. Working tree is intentionally **not clean**. Branch remains `codex/r4-core-loop-integration-gate`; HEAD remains `ee1cb3dff07d4521a8bb8e8f80175708e908d272`. No stage, implementation commit or push. UI/API/routes/schema/migrations/package/config and initial audit documents remain unchanged by this continuation. No R3F, R4 product expansion or unrelated work started.

Evidence copied outside the repository to `/tmp/r4-isolated-evidence-20260904/`: `full.log`, `p1.log`, `postgres.log`, `ui.log`, `typescript.log`, `lint.log`, `build.log`, browser HTML report, screenshots/attachments and `r4-observations.json`. These contain synthetic test evidence; no environment file/dependencies/build output were copied. They are temporary local artifacts, not committed product files; this document preserves the durable textual verdict. A post-test catalog check found no remaining `ai_strength_e2e_*` or `ai_strength_backend_*` databases. After confirming all five production/test source hashes matched main and saving evidence, the temporary worktree was removed (including only its own dependencies, build output and ignored test environment). Port 3101 was no longer listening; user port 3011 retained PID 12650 and HTTP200. Main diff/scope and whitespace checks passed; index remains empty.

## 17. Final Fix Pass: explicit P1-A STOP before implementation

Baseline rechecked: branch `codex/r4-core-loop-integration-gate`, HEAD `ee1cb3dff07d4521a8bb8e8f80175708e908d272`, same 3 modified + 3 untracked files. This pass changes **only this report**. The five production/test SHA-256 hashes in sections 11 and 16 match the current files byte-for-byte.

### Part 1: atomicity preserved

Re-read `WorkoutSessionRepository.saveProgress` (`lib/server/workout-sessions/workout-session-repository.ts:177-230`): exact athlete-owned Session lock; receipt/fingerprint and version validation; all target Set/Exercise/Assignment lineage checked before writes; defensive UPDATE miss throws; one transaction, one version increment and receipt on successful new command. `WorkoutSessionService.saveProgress` (`workout-session-service.ts:111-125`) still normalizes the entire batch and rejects duplicate targets. `withDatabaseTransaction` still rolls back thrown failures; Complete takes the same Session lock. Existing invalid-second-Set, rollback, replay and serialization tests were not weakened or changed.

This is a **fresh source/hash verification**, not a fresh execution of PostgreSQL/browser tests. The 166 PostgreSQL / 89 UI / 12 canonical passes above remain evidence from the preceding isolated run.

### Part 2: actual root cause and contradiction with a sort-only fix

| Question | Current code evidence |
| --- | --- |
| Where is the bound? | `lib/server/client-workouts/client-workout-repository.ts:15,91-108`: `COLLECTION_LIMIT=20`, SQL `LIMIT 21` sentinel, then `slice(0,20)`. |
| Actual ordering | `:97-98`: active Session first, then `scheduled_for ASC, created_at ASC, assignment.id ASC`. The preferred active-before-upcoming ordering is **already implemented**. |
| Where is resumability derived? | `mapClientAssignmentRow`, `:51-84`: `canResume = session.status === active`, independent of relation status; `canStart` additionally requires available Assignment and active relation. |
| Hydration/filter after limit | SQL joins and lateral JSON aggregation hydrate Assignment composition in the same statement (`:120-181`). The returned first 20 are mapped/normalized, not post-filtered or replenished. Home subsequently slices those to one (`components/client/canonical-client-home.tsx:71-72`); collection renders the returned rows. No post-limit filter selects a different resumable Session. |
| Number of active Sessions permitted | `WorkoutSessionService.start:102-108` delegates exact Assignment. `WorkoutSessionRepository.startOrResume:108-129` checks that Assignment/actor/relation, then inserts with conflict only on `assignment_id`. It does not check active Session count for the athlete. |
| Schema/RLS invariant | `database/migrations/0007_workout_session_execution.up.sql:6-30` has `UNIQUE(assignment_id)`, not one-active-per-athlete. Insert policy `:211-223` checks exact ownership and active relation, not aggregate Session count. Migration 0016 adds completion/context safeguards, not an active-count limit. |
| Does existing bounded navigation expose the rest? | `/api/client/workouts`, `app/api/client/workouts/route.ts:53-82,107-130`: cursor parameters belong to history only and are rejected for current collection. History is for terminal Sessions. Exact read needs an already known ID. `canonical-client-home.tsx` has no current `hasMore` action; its Workouts link leads to the same bounded collection. |
| Could the older Session listing substitute? | `WorkoutSessionRepository.listAthlete:73-77` has no LIMIT and hydrates each result; using it would violate the required bounded/no-N+1 contract. It is not an accepted bounded discovery path. |

Consequently, **25 upcoming + one active** does not explain the confirmed P1: SQL already ranks the one active first regardless of its scheduled date. The actual previously reproduced failure is **21 active/resumable Sessions competing with each other**. A deterministic sort can choose which 20 appear, but cannot make all 21 discoverable through an unchanged 20-row collection.

This is permitted by current canonical commands/schema, not a manually corrupted fixture. Whether product policy should permit this many simultaneous active workouts is precisely the open decision; this report does not invent a new product authorization for them or call them impossible anomalies.

### Reproduction evidence retained, not rerun

`tests/e2e-canonical/core-loop-r4.spec.ts:78-86,220-244` creates Assignments and starts Sessions using authenticated production HTTP commands. One active Session is followed by 20 more on distinct dates. Assertions prove all 20 visible rows are active, `hasMore=true`, the 21st active ID is absent from Workouts after the collection renders, and exact GET of that ID still returns active. No SQL domain writes manufacture those Sessions.

The saved final prior-run observation remains available in `/tmp/r4-isolated-evidence-20260904/r4-observations.json`: hidden Session `e8029f34-f96e-4136-bf8e-774ceb3bcd29`, Assignment `a4390598-2f23-4bfb-890d-960acba171af`, visibleCurrent=20, totalActive=21. Current test SHA matches that run. No new browser PASS is claimed in this stopped pass.

The new task expressly requires STOP if the actual domain permits more than 20 actionable active Sessions without a bounded discovery path, or if resolving the defect requires new current-list pagination/UI or changing the Assignment/Session lifecycle. Those conditions are met. Therefore no sort-only patch, larger arbitrary limit, unbounded active query, automatic abandonment, hidden preferred-session policy or new pagination was introduced.

### Decision required before continuing

Two options for separate review, neither accepted or implemented here:

1. **Recommended for review: bounded current-list pagination/access.** Preserve existing Sessions and active-first deterministic ordering, but allow discovery of subsequent current rows through bounded requests. This exceeds the present no-new-current-pagination/UI scope; agree its contract before implementation. Any confirmed index/migration need still requires its own STOP/review.
2. Define an explicit product invariant limiting concurrent active Sessions and a safe transition for existing multiple-active data. This changes Start/lifecycle/concurrency rules and cannot simply discard or conceal existing resumable Sessions. It also exceeds this pass's authorization.

Authorizing unrelated P1-B/auth/error fixes while P1-A awaits a decision is another possible scope split, but the current task says STOP; it was not assumed.

### Remaining parts, gates and pilot status

| Area | Status after STOP |
| --- | --- |
| P1-A | Root cause confirmed; not fixed, needs bounded-discovery or domain-policy decision. |
| P1-B shared primary-action resolver/equality matrix | Not implemented. Prior cross-surface mismatch remains; no new resolver/rules introduced. |
| P2-C exact auth return | Not implemented; FIX BEFORE PILOT remains. |
| P2-D retryable exact-read transport state | Not implemented; FIX BEFORE PILOT remains. |
| P2-E stale Home | Manual-reload acceptance remains conditional/candidate. No fresh mutation-safety gate or unconditional acceptance claimed; no polling/realtime. Pilot note: «Если тренер назначил тренировку, пока страница спортсмена уже открыта, обновите страницу.» |
| Atomicity | Code/tests intact; prior green regression retained, no rerun. |
| New targeted, two-cycle, canonical, PostgreSQL/UI, mobile, TypeScript/lint/build gates | Not run in this pass because the explicit architecture/product STOP occurred before implementation. Prior totals are not reported as fresh results. |
| Performance | Existing bound/order/SQL hydration audited; no query or N+1 changes, no new EXPLAIN/latency claim. |
| Pilot | **NOT READY**. Two previously confirmed P1s remain; no new P0 demonstrated, no fresh P0=0/P1=0 certification. P2-C/D still block. 0016 external deployment HOLD unchanged. |

Git exit state remains 3 modified + 3 untracked, same HEAD/branch, empty index. Only this already-untracked report was edited during this Final Fix Pass; all production/test source hashes remain unchanged. `git diff --check` passes. No API/UI/routes/schema/migration/package/config changes, no stage/commit/push, no R3F/Progress work. Server :3011 was not stopped or restarted; no isolated E2E worktree or test database needed to be created for this source-audit STOP.

## 18. Authorized bounded-discovery implementation and final fix evidence

Founder decision superseding the section 17 STOP: preserve the existing Assignment/Session lifecycle and make every current item reachable through bounded cursor pagination. No concurrent-active limit, automatic abandonment, arbitrary larger cap, OFFSET, unbounded read, mock fact or client storage cache was introduced.

### P1-A: bounded current-workout collection

`/client/workouts` now reads 20 rows plus one sentinel from the canonical PostgreSQL ordering: active Session first, then scheduled date, creation timestamp and Assignment UUID. Its opaque versioned cursor is actor-bound and current-domain-specific; it carries the exact ordering tuple with full PostgreSQL timestamp precision. `currentStart` freezes the collection boundary, `currentAfter` advances it, and a non-advancing cursor fails explicitly. Assignment and Session IDs are deduplicated when pages append. The collection URL keeps `currentStart`, successful `currentDepth` and a semantic row anchor independently from history pagination; return and hard reload replay pages 1..D from PostgreSQL and restore row focus. Invalid current state resets only current pagination with a notice. Initial and load-more failures have local Retry; a failed later page preserves the successful prefix. Exhaustion says `Все тренировки показаны`.

`/client/me` uses the same first canonical row but intentionally exposes neither pagination controls nor more than one primary current action. Repository eligibility is applied before pagination and the query remains one bounded set-based data read with one sentinel; hydration occurs only for the selected page and has no per-row query. A 5,000+ eligible-row EXPLAIN completed locally using existing indexes; no confirmed migration/index requirement arose.

### P1-B: one trainer primary-action decision

`lib/trainer-athlete-primary-action.ts` is the shared pure resolver used by Dashboard and Profile. Priority is: open completed-session Review, including discomfort and permitted suspended historical Review; otherwise Assign only for an active relation/athlete with no current Assignment; otherwise no primary action. Neutral entry manufactures no action. Dashboard now reads existing athlete status so both surfaces resolve from the same facts. Profile current-state copy still distinguishes discomfort, but discomfort affects presentation/priority rather than command selection.

The cross-surface matrix covers review, discomfort, no assignment, current/next assignment, neutral/calm and suspended relation. The fresh browser cycle confirmed Assign on both surfaces before assignment, Review on both after completion, and no primary action on both while a Session is active.

### P2-C and P2-D

Canonical client auth now preserves the exact allowlisted pathname/query via a request header supplied by `proxy.ts`; canonical PostgreSQL auth remains in the client layout and is not replaced by legacy Supabase auth. The sanitizer accepts `/client/me`, bounded collection state, and one exact Assignment or Session with validated UUIDs and a bounded client return destination. External URLs, backslashes, duplicate/unknown parameters, simultaneous Assignment+Session and uncontrolled nested returns fail to a safe route. Fresh browser evidence confirms guest Session -> OTP -> same exact completed Session, cleared-session Assignment -> exact login intent, and unsafe nested return -> `/client/me`.

Exact workout presentation now has distinct loading, retryable transport/server failure and terminal unavailable states. A 5xx or network error shows `Не удалось загрузить тренировку`, focuses that heading and offers a local `Повторить` for the same exact ID. A 404/foreign/missing resource remains `Тренировка недоступна` without Retry. Switching exact IDs clears the previous model before loading. Browser evidence confirms recovery from both injected 503 and network abort, plus terminal treatment of a random inaccessible Session.

### P2-E internal-pilot disposition

Stale open Client Home is accepted only as an **internal pilot candidate with manual reload**. Commands remain server-authoritative and a fresh canonical read shows the assigned workout; no polling, realtime, parallel cache or optimistic cross-role fact was added. Pilot instruction remains: «Если тренер назначил тренировку, пока страница спортсмена уже открыта, обновите страницу.» This is not a pre-beta quality waiver.

### Fresh gates and scope

| Gate | Result |
| --- | --- |
| Targeted model/navigation tests | PASS: auth sanitizer, shared primary resolver, Profile, Dashboard and roster. |
| `npx tsc --noEmit` | PASS. |
| Targeted ESLint | PASS, no diagnostics. |
| `npm run test:backend:postgres` | PASS: **170/170**, 0 failed/skipped/cancelled; migrations through 0016 on a disposable DB. |
| Targeted R4 canonical browser | PASS: **1/1**, 48.0 s total / 36.7 s test, retries disabled. |
| Full canonical browser | PASS: **12/12**, 0 failed/skipped, 2.7 min, retries disabled. |
| Current collection stress | PASS: 20 initial active rows, row 21 appended, exact return and hard-reload depth 2 restored, exhaustion explicit. |
| Browser network/auth | PASS: exact OTP return, cleared-session intent, unsafe fallback, 503 Retry, network Retry, 404 no Retry. |
| Supabase browser requests | **0**; only process-local public placeholders satisfy an unchanged eager legacy module. |
| `node --import tsx --test tests/ui/*.test.ts` | PASS: **92/92**, 0 failed/skipped/cancelled. |
| `npx tsc --noEmit --incremental false` | PASS, no diagnostics. |
| `npm run lint` | PASS, no diagnostics. |
| Production build | PASS: Next.js 16.2.12, 57 static pages; run through unchanged `npm run build` with isolated local test environment loaded. |
| `git diff --check` | PASS at targeted and final gates. |

The browser and build runs used a detached temporary worktree at HEAD `ee1cb3dff07d4521a8bb8e8f80175708e908d272`, port 3101 and disposable PostgreSQL databases. The user's server PID 12650 on port 3011 was not stopped, restarted or used as the fixture server. Existing Quick Assign Radix `Description/aria-describedby` console warnings remain recorded and were not fixed in this pass. The first build attempt compiled but correctly failed prerender without `DATABASE_AUTH_URL`; the unchanged build passed when spawned with the isolated `.env.development.local`, matching the repository's documented environment requirement.

The final targeted scenario also checked Client Home, the current Workouts collection, exact-load error, Trainer Dashboard and Athlete Profile at 1440x1024, 390x844, 390x500 and 720x512. Each surface had no document-level horizontal overflow beyond one pixel, and its semantic anchor remained scrollable into the viewport. This is responsive/reflow evidence, not native-device, screen-reader or browser-zoom certification.

Production changes are limited to bounded current reads/navigation/UI, the shared trainer action projection, exact auth return transport and exact-read Retry presentation. Existing workout lifecycle commands, API command contracts, PostgreSQL schema/migrations, package files and build configuration were not changed. This implementation remains unstaged and uncommitted; no push or R3F work was performed.
