# R4 Core Loop Test Plan v1

Дата: 2026-09-04. Baseline: `fdaf2be82a01ac5c9d780f409a412e5587d02e7a`.
Статус: proposed verification plan; no tests or application code changed.
Findings/evidence: [integration audit](core-loop-r4-integration-audit-v1.md). UX assertions: [UX gate](core-loop-r4-ux-gate-v1.md).

## 1. Deterministic fixture and execution discipline

Use a disposable loopback PostgreSQL database with existing migrations 0001..0016 and normal app/authenticator/migrator role separation. Run trainer and athlete in isolated browser contexts, not shared cookies or role labels over one actor. Never use real participant data. Existing test runners are the pattern, not authorization to change live DB ownership or bypass RLS.

Seed identities/catalog and onboarding prerequisites through the existing test harness only. Create workout-domain data through the same authenticated commands as production. No manual SQL repair during the happy path; privileged SQL is read-only for assertions. Controlled malformed/legacy fixtures belong in separate disposable failure tests. Capture generated UUIDs in an in-memory test manifest; deterministic relationships and values matter, not invented production IDs.

| Alias | Fixture requirement / identity assertion |
| --- | --- |
| T, A, B, T2, D | Trainer, linked athlete, foreign athlete, other trainer, dual-capability actor. Capture real User UUIDs and separate sessions. Synthetic addresses only. |
| R | Active T/A relation created by existing invitation/onboarding contract. Record Relation UUID; assert A's primary active relation and no accidental second active pair. |
| E1..E4 | Four available canonical catalog Exercises selected by UUID; do not infer identity from title. Catalog source UUID is tested up to Template only, not fabricated in downstream snapshots. |
| M, V1 | New Template via Workspace/Editor. Save Draft, exact GET, Publish. Record Template UUID, Draft/Published Revision UUID, edit token and command receipts. |
| X1 | Repetition exercise: one warmup + two working sets; fixed target, load/rest instruction. Save actual repetitions 10 and weight 55 on one working Set. |
| X2 | Repetition-range exercise: two working sets, one explicitly skipped; separate actual numeric zero case in source-quality variant. |
| X3 | Duration exercise: two sets with seconds; first saved, second left pending for partial-completion cycle. |
| X4 | Unloaded repetition exercise: null weight retained as null, not 0. Optional two-member superset with X2 only if existing canonical Editor supports the chosen composition. |
| W1, S1, I1 | Exact V1 Assignment -> started Session -> generated Attention. Capture source AssignmentExercise/Set and Log UUID pairs, not DOM index. |
| F1, F2 | Initial detailed feedback on I1, then a follow-up referencing F1. Stable synthetic body markers, persisted sentAt. |
| W2, S2, I2, F3 | Second complete cycle under same R; new W/S/I/F IDs; V1 remains usable even if M now has an editable Draft V2. |

Use one explicit fixture date and server/browser clock arrangement documented in the run report. Do not add a weekly UTC product contract. Assignment scheduled date and started/completed instants are different facts. Complete S1 with omissions and explicit discomfort `true` plus a short synthetic comment; S2 has all sets addressed and explicit discomfort `false`. Legacy all-null context is a separate upgrade fixture, not a newly submitted completion.

## 2. Happy path: two full cycles, exact IDs at every boundary

The current R4 audit did **not** freshly run this browser sequence. Existing PostgreSQL tests support components of it. Mark PASS only after collecting browser + response + persisted evidence.

| Step | User action | Required evidence |
| --- | --- | --- |
| 1 | T opens Dashboard; A has no next assignment | Row A/R, derived no-assignment action; no fabricated persisted Attention UUID. |
| 2 | Open A then Training | URL A, active R, neutral/attention reason consistent; one Header primary action. |
| 3 | Open Quick Assign; no template -> Builder | Exact A, safe flow/handoff preserved; no foreign default. |
| 4 | Create four-exercise M, Save, Publish V1 | Exact M/V1 IDs, prescribed order/sets, stable command receipts; Preview uses saved V1. |
| 5 | Return Sheet, choose V1, assign W1 | Receipt W1/R/A/M/V1; duplicate identical submit does not create W1b. |
| 6 | A reads Home then opens assignment | Same W1/V1 prescription values; test both fresh Home and already-open Home (F02). |
| 7 | Start W1 | Returned S1; DB unique Assignment -> Session; URL/next exact read carries S1/W1. |
| 8 | Save/Skip exact K values | Actual facts, Session version and receipt advance consistently; no unrelated K changed. |
| 9 | Hard reload and Resume | Same S1/K IDs and values, no new Session or loss; unresolved command reconciles separately. |
| 10 | Complete with omissions/context | Same S1 terminal, incomplete/skipped distinction; I1 once, receipt/audit/outbox logical event once. |
| 11 | T refreshes Dashboard and Queue | I1 points to S1/A/R, discomfort/omissions from persisted S1; multiple S for A remain separate rows. |
| 12 | Exact Review | Header S1/W1/I1; sets match K/source IDs and values; explicit true/false/null context preserved. |
| 13 | Send initial F1 | Same I1 resolved, F1 body/S1/R persisted; same key replay gives same logical effect. |
| 14 | A focuses Home, opens latest response | Latest F1 links S1 and F1; body/sentAt same as trainer result, no trainer-private note. |
| 15 | Send F2 follow-up; read completed thread | Parent F1 exact, F2 unique; latest becomes F2; thread retains F1. |
| 16 | A opens collection history | One S1 terminal row, not W1 masquerading as Session. Open row -> exact S1. |
| 17 | Return from S1 | Same collection URL/depth/semantic row anchor; focus returns to S1. |
| 18 | T chooses next valid action | Receipt destination is authorized; active R permits W2. No forced assignment if not needed. |
| 19 | Assign W2 from unchanged Published V1 | W2 != W1; assignment snapshot independent of Draft V2; A sees W2. |
| 20 | Repeat Start -> all results -> Complete -> Review -> F3 | S2 != S1, I2 != I1; exactly two terminal history rows; F3 points only S2; S1/F1/F2 unchanged. |

Evidence manifest per step: actor User ID, R/M/V/W/S/I/F IDs as applicable, command ID hash (not auth token), expected/returned version, URL without credentials, response status, persisted row counts, screenshot/trace checkpoint. Do not publish cookies, raw secrets, participant comments or email addresses.

## 3. Command retries and atomicity

For every command below execute loss **before** persistence and loss **after** COMMIT as distinct tests. Intercept before-persistence failure without `route.fetch()`; after-COMMIT loss calls the real route and drops its response. Reconciliation must not equate HTTP failure with no commit.

| Command | Same-key repeat | Changed payload / stale state | Unknown recovery / side-effect assertion |
| --- | --- | --- | --- |
| Save Draft | Frozen command/content/token repeat | Same ID different payload conflicts; newer token blocks overwrite | Exact GET then replay only when appropriate; one accepted receipt/audit. |
| Publish Draft-only | First POST lost before commit, check publication, repeat same command ID | Published/Editable changed independently -> conflict | Null previous Published normalization; one Publish receipt/audit. |
| Publish with older Published + next Draft | Existing Published unchanged -> replay exact Draft attempt | Foreign/new Published or edited Draft -> conflict | Do not confuse older Published with attempted revision success. |
| Create Revision | One Draft despite double submit | Pointer/token changed -> conflict | Read exact lifecycle, no duplicate editable revision. |
| Duplicate / Archive | Same intent returns same created aggregate / archive effect | Modified source/expected token conflicts | Existing W snapshots remain independent. |
| Assign | Same W UUID yields same logical assignment | Same UUID modified note/date/V conflicts; new concurrent assignment invalidates state token | One W/audit; refresh and explicit changed-state acknowledgement, never silently choose another V. |
| Start | Two simultaneous same W starts converge on S | Foreign W denied; suspended R denies new start | Reconcile exact W/S; natural unique-W rule, not assumed general command receipt semantics. |
| Save / Skip | Same progress key + payload replay | Session version stale, wrong K or changed payload conflicts/fails | Same K/source identity; one accepted receipt; no random key on retry. |
| Complete | Exact logical request replay, including response lost after commit | Changed context/version; legacy null versus explicit boolean | One terminal transition/I/receipt/audit/outbox; prior saved logs survive failed completion. |
| Feedback / manual resolve | Same I/key/payload replay | Resolved item, changed body, parent F substitution | Initial sends one F; manual resolve sends no F. Test unknown follow-up then reload before retry. |

**F01 regression, mandatory before pilot:** valid own K first + nonexistent K last; then foreign K last; then invalid first. Each denied batch must leave all actual values, exercise aggregate, Session version, receipts and audit unchanged. Repeat with existing non-null actuals, not just blank sets. Current audit reproduction fails this atomicity invariant. Do not repair it within this documentation stage.

Existing evidence files: `tests/backend-foundation/workout-template-command-postgres.test.ts`, `workout-builder-postgres.test.ts`, `workout-flow-postgres.test.ts`, `workout-session-postgres.test.ts`, `workout-review-postgres.test.ts`, `client-workout-r3b-postgres.test.ts`, `client-workout-r3c-postgres.test.ts`, `client-workout-r3d-postgres.test.ts`, `client-workout-r3e-postgres.test.ts`; UI command tests under `tests/ui/`; canonical browser specs under `tests/e2e-canonical/`.

## 4. Concurrency and stale state

| Test | Required behavior |
| --- | --- |
| Two tabs Start same W | One S; both exact reads converge, no duplicate log sets. |
| Two tabs save same K or different K in same S | Session-level version conflict recognized; no independent Set-version assumption; explicit reconcile preserves already persisted facts. |
| Save in flight then Complete | Completion must not silently omit a pending browser save; settle/reconcile before terminal command. |
| Two Complete tabs / different context | One terminal transition; second same logical request replays, different request conflicts; no duplicated I/outbox. |
| Two Review tabs initial feedback | One initial resolution; stale tab shows exact resolved state, not another Session. |
| Initial feedback versus manual resolution | Serialized I ownership/state; no duplicate closure or invented athlete feedback. |
| Follow-up repeated / edited / response lost then reload | Same intent not duplicated; changed body explicit new intent; preserve exact parent. Browser reload behavior must be proven separately from repository replay. |
| Template Published V changes during Sheet | Exact requested revision/status revalidated; stale selection requires refresh. |
| Template archived between read/submit | No new W from now-ineligible template; existing W still usable. |
| Assignment created in another trainer tab | State-token conflict/acknowledgement; do not silently ignore existing future W. |
| Review receipt Next Item with non-default ordering | Must honor accepted queue contract or surface explicitly accepted server priority; current selection ignores order/position (F05). |

## 5. Relation lifecycle and authorization

Run each relevant row for T/A/B/T2/D and with altered URL/body IDs, not only hidden buttons. API denial must not reveal foreign facts in error payload or latest fallback. Transition context never authenticates an actor.

| Scenario | Read/command expectation |
| --- | --- |
| Active R | T assigns own Published V to A; A starts own W; both exact participant projections agree. |
| Suspend before Start | Start/Assign denied; no Session/log/receipt side effects. |
| Suspend concurrent with Start | Relation row lock serializes decision: either started valid work or denied start, not orphan partial S. |
| Suspend/end after Start | A can resume/save/complete own started S; T cannot gain broad live tracking; original terminal workflow later allows bounded Review. |
| Reactivate same R | Re-evaluate current capability from DB; old browser denial does not become cached authority. |
| New R with same athlete / new T | A retains own S/F; new T cannot read/resolve original T/R workflow. Same title or same athlete is not sufficient. |
| Suspended Profile versus terminal Review | Record broad 0012 Profile permission separately; do not use it to justify Progress or new assignment. Founder acceptance/hardening required. |
| Signed out / expired session | Safe login continuation should retain exact allowed destination; current fixed layout next target needs browser evidence (F03). |
| Wrong capability / dual-role | Capability union still actor scoped; trainer role cannot submit athlete results on A's behalf. |
| Substitute foreign V/W/S/K/I/F/parentF | DENY with no changes; context matching does not bypass ownership; mixed own/foreign Set batch is F01 atomicity regression. |

## 6. Navigation, history and return fidelity

R3E-03 is frozen: initial 10; append via `Показать ещё`; dedupe Session ID; 10 default / 30 max per server request; startCursor + successful depth + semantic S anchor; full PostgreSQL replay 1..D on return/reload; no hidden maximum D and no localStorage/sessionStorage history cache. Feedback pagination is a separate bounded-window contract.

| Navigation case | Assertion |
| --- | --- |
| Direct exact W/S/F link | Load requested own entity or unavailable; no array-first/title/latest replacement. |
| Duplicate/malformed/foreign query | Reject or documented safe context reset; never select another domain entity. Trainer Review's first duplicated context value needs explicit coverage. |
| Dashboard/Profile/Queue entry | Preserve source I/S and queue return; opening Profile/Training does not resolve I. |
| Editor Save-and-Exit | Dashboard/Clients/Library/Settings/Workspace/valid Quick Assign destinations preserved. Failed exit -> Stay -> ordinary Save does not execute stale exit. |
| Quick Assign -> Builder -> Publish -> return | Same A/date/note/context and exact published V; invalid/foreign handoff rejected. |
| Back / Forward / hard reload | URL tabs/exact identity stable; dirty command protection and deterministic fallback, not `router.back()` only. |
| History append 3+ pages | Prefix rows remain, Session IDs unique, successful depth advances only after response. |
| History -> S -> return | Replay all previously successful pages and focus S anchor, including after hard reload of collection URL. |
| Partial replay failure at page k | Preserve prefix 1..k-1; retry k; do not lose history or falsely claim exhaustion. |
| Invalid cursor | Reset history pagination only, with notice; current assignments and feedback are unaffected. |
| Exhaustion | `Все тренировки показаны`; no hidden restore-depth truncation. |
| Feedback page navigation | Do not append history semantics to feedback; exact F focus works even on another thread page. |
| Navigation fails after command success | Persisted receipt remains truth; safe explicit destination/reload; do not run command again as new intent. |
| 21 current assignments | Expose F04 discoverability gap; test is not about completed-history total limit. |

## 7. Source gaps and display states

For each core surface exercise initial/local loading, empty, retriable GET failure, fatal unavailable, permission loss, stale conflict and command unknown where applicable. A read-only screen has no invented mutation state; an empty response must not mask network or permission errors.

Required fact variants: no feedback, feedback read failure, legacy all-null R3D context, explicit false/true discomfort, partial/missing logs, numeric zero, null weight, skipped versus incomplete, all-zero completion with explicit acknowledgement, long comments, repeated Exercise title with different instances, missing catalog source after snapshot creation. Missing evidence must be labeled, not replaced by mock volume or guessed current Template facts.

Current fresh evidence: 154 PostgreSQL tests pass, including R3D/E source-quality cases; F01 independent probe fails. A full screen-state/browser matrix remains PLAN. The UX gate enumerates component-specific gaps rather than asserting all states pass.

## 8. Mobile and accessibility run matrix

Run every main core surface at 1440x1024, 390x844, 390x500 and 200% reflow equivalent; record native 200% zoom separately when available. Keyboard/virtual-keyboard occlusion requires actual device/emulation evidence, not a screenshot of a closed keyboard.

Check horizontal overflow via scrollWidth/clientWidth, longest comments/names, viewport-height Sheets/dialogs, sticky action footer visibility when inputs focused, Builder exercise expansion, Quick Assign confirm, execution numeric input, completion radios/comments, Review send region, history Load More/return focus. Capture screen and console for loading/error/success, not only happy empty state.

Keyboard-only checks: landmarks and heading order; explicit input labels; radio/checkbox semantics; DialogTitle/Description references; focus trap/Escape safety during unknown command; semantic row return; exact validation field focus; success announcement; disclosure expanded state; visible focus; reduced motion; distinguish repeated Session links by accessible name.

Warning catalog: legacy `components/trainer/exercise-detail-sheet.tsx` has `SheetContent` without Radix Title/Description; mounted by old `app/trainer/review/[workoutId]/workout-review-client.tsx`. Canonical Review route does not mount that old client. Current Quick Assign, canonical Editor leave/duplicate/convert dialogs and client Completion include descriptions. Fresh runtime warning origin remains unverified because E2E server did not start; do not attribute all historical DialogDescription warnings to canonical Completion.

## 9. Performance and database checks

Reuse measurements in integration audit section 9 as initial regression baselines, not fixed latency SLAs. Capture HTTP trace separately from SQL queries. Measure small and long fixtures with app RLS; no admin-only EXPLAIN. Track SQL totals, data reads, returned rows, repeated list-card requests, and D history replay requests.

Required hot paths: Dashboard, Profile plus Training, Workspace, Quick Assign list/preview, current, exact active, completion first/replay, Queue, Review, history page/restore, completed detail, feedback. Constant query count must remain constant as exercises/templates increase; bounded history must remain page-first. No optimization is authorized in this stage. New migration/index requirement -> STOP and review evidence.

Fresh installation: normal bootstrap/migrator 0001..0016, app role with RLS, entire two-cycle fixture. Upgrade: pre-0016 legacy terminal + active Session + old receipt; migrate normally; preserve legacy null/replay and finish existing active work; then run the two-cycle fixture. Existing suite already passed SQL upgrade, but full upgraded-browser cycle is not checked yet. Ownership recovery for 0011/0012 is a separate existing runner, not manual product-migration ALTER OWNER.

External 0016 rollout remains HOLD pending provenance preflight, backup, rollout review. Real down drops context data; test rollback in a disposable transaction is not an approved recovery procedure for external data.

## 10. Binary pilot checklist and pass/fail criteria

Checkboxes intentionally remain unchecked until the **integrated pilot scenario** is verified. Existing lower-layer PASS evidence does not mark a whole user job complete. Require P0=0, P1=0, explicit owner acceptance of each remaining P2, and all 20 checks below.

- [ ] Trainer can onboard/use existing athlete relation.
- [ ] Trainer can find who needs next step.
- [ ] Trainer can create/select workout.
- [ ] Trainer can assign exact revision.
- [ ] Athlete sees correct Assignment.
- [ ] Athlete can start/resume.
- [ ] Results survive reload, with command atomicity including F01.
- [ ] Completion is safe/idempotent.
- [ ] Review appears once.
- [ ] Trainer sees exact facts.
- [ ] Feedback persists.
- [ ] Athlete sees same feedback.
- [ ] History retains Session and restored depth.
- [ ] Suspension paths do not lose started work.
- [ ] Foreign access fails closed.
- [ ] Mobile core loop works.
- [ ] Error recovery is available.
- [ ] No core path requires demo/Supabase source.
- [ ] Fresh DB can run core loop twice.
- [ ] Upgrade DB can run core loop twice.

Fail gate on any identity substitution, silent fact loss/partial failed-command mutation, cross-role leakage, duplicate logical command effect, unrecoverable unknown, hidden history truncation or mandatory navigation dead end. P2 workaround requires named founder/product acceptance and a bounded scenario, not merely documenting the bug. R3F Progress and external notification delivery are not prerequisites for the in-app workout-feedback loop.

## 11. Execution status and scope

Executed: existing PostgreSQL suite (154/154), disposable F01 reproduction and repository performance probe. Attempted canonical E2E: runner stopped before tests because existing Next dev lock; no browser PASS claimed. Existing app server untouched. No production, tests, API, schema, migrations, routes or config changed; no new test files, no R4 fixes, stage or commit. This is the plan for the next approved correctness/verification pass, not an implementation authorization.
