# R4 Core Loop Integration Audit v1

Дата: 2026-09-04. Статус: audit complete; internal pilot NOT READY.
Baseline: `fdaf2be82a01ac5c9d780f409a412e5587d02e7a`, branch `codex/r4-core-loop-integration-gate`.
R3F documentation commit: `fdaf2be`, `docs(progress): document R3F metric deferral`.

## 1. Executive verdict and evidence limits

Canonical vertical exists in production code: Template/revision -> Assignment snapshot -> Session/logs -> completion/Attention -> Review/Feedback -> athlete completed detail/history. PostgreSQL is the source of those facts; Program, Progress and demo data are not prerequisites. This is **implementation linkage evidence, not a fresh full browser-loop PASS**.

**Pilot gate is blocked by one reproduced P1:** `saveProgress` may commit an earlier Set update when a later Set ID in the same accepted batch is missing, returning failure without advancing Session version or writing a command receipt. No P0 was demonstrated. Absence of a demonstrated P0 is not a complete security certification.

Fresh execution in this audit:

| Evidence | Result and limits |
| --- | --- |
| `npm run test:backend:postgres` | PASS: 154 tests, 0 failed, 0 skipped; fresh disposable PostgreSQL databases; includes real `0015 -> 0016` upgrade test. Log: `/tmp/r4-postgres.log` (temporary local evidence, not a repository artifact). |
| Additional isolated repository/service probe | Reproduced mixed-Set partial commit; measured critical repository reads under `ai_strength_app`; created and dropped a disposable database. No application database fixture changed. Reproduction recipe is in section 11 and the test plan. |
| `npm run test:e2e:canonical` | ENVIRONMENT BLOCKED before browser tests: another Next dev process, PID 12650 on 3011, owns this repository's `.next` dev lock. The runner's server could not start. Log: `/tmp/r4-canonical-e2e.log`. Existing server was not stopped. This is not a failed browser assertion. |
| Earlier browser gates | Historical evidence only: R3E implementation report and committed E2E sources. They do not prove this R4 fixture, repeat cycle, all viewports or native zoom today. |
| Build, lint, TypeScript | Not rerun in this docs-only audit; previous implementation reports are not relabelled as fresh R4 results. |

Evidence vocabulary: **CODE** = inspected current symbols/schema; **RUN** = fresh execution above; **PRIOR** = existing report; **PLAN** = required verification not executed. Recommendations below are not accepted product decisions or implemented fixes.

### Authoritative requirements versus historical implementation descriptions

Requirements reviewed: `product-principles-v1.md`, `core-workflow-v1.md`, `mvp-scope-v1.md`, `non-goals-v1.md`; R1 profile/restoration documents; R2A Training architecture/design; R2B Review architecture/design; R2C Quick Assign architecture/design; R2D Templates/Editor architecture/design; R3A architecture, R3B/C designs, R3D/E architecture/design/implementation, and both accepted R3F documents. Paths are under `docs/`.

Older documents describe now-resolved prototype/read-model gaps. Current implementations and migrations 0013-0016 supersede those implementation snapshots; they do not supersede human-first Profile, single next action, independent pending/active/next work, exact identity, or accepted R3E append pagination. The code evidence below is the implementation authority.

## 2. Canonical domain graph

```text
authenticated Actor -> User + capabilities
Trainer T <-- TrainerAthleteRelation R --> Athlete A / athlete-owned Profile
T -> Exercise catalog -> Template M -> Published Revision V
(T, A, R, M, V) -> Assignment W [independent prescription snapshot]
W -> Session S -> ExerciseLog L -> SetLog K [actual facts]
Complete S -> Attention I -> Feedback F -> optional follow-up F2
commands -> receipts/audit; completion/feedback -> NotificationOutbox O
```

Identity is a persisted UUID unless explicitly stated otherwise. A display title, catalog key, row position or route parameter name is not interchangeable with that UUID.

| Entity / canonical table | Identity, ownership, creation | Reads / terminal state / visibility / route identity |
| --- | --- | --- |
| User / Actor: `app.users`, `app_private.auth_identities`, `app_private.sessions` | User UUID; authenticated session resolves Actor and active capabilities. Auth creates identity; actor is request context, not a second person record. | Auth/access services; private credentials never enter domain DTO. Trainer and athlete capabilities can coexist. User inactive/access loss blocks commands. No token in URL. |
| Relation: `app.trainer_athlete_relations` | Relation UUID; exact T/A pair; invitation/access workflow. New relation is a new scope, not inherited old ownership. | Roster/Profile/assignment/RLS; active/suspended/ended. Profile path carries **athlete User UUID**, not Relation UUID. |
| Profile: `app.athlete_profiles` | `user_id`; athlete-owned questionnaire, trainer read-only. | `AthleteProfileQueryService`; no workout terminal state. `/trainer/clients/{A}`. 0012 additionally grants current suspended-trainer reads; see security finding. |
| Exercise: `app.exercises` | Catalog Exercise UUID; base/owner visibility under library contract. | Exercise library/editor. Archive/availability is not a reason to rewrite existing snapshots. Template can carry `source_exercise_id`; Assignment/log chain does not yet prove stable catalog UUID continuity. R3F blocked, core execution not blocked. |
| Template: `app.workout_templates` | Template UUID; trainer owner; Builder create/save. | Workspace, Editor, Quick Assign. Latest Published and editable Draft pointers coexist; archive is aggregate state. `/trainer/builder/{M}`. Athlete reads assigned snapshot, not trainer's library. |
| Revision: `app.workout_template_revisions`, `app.workout_template_exercises`, `app.workout_template_exercise_sets` | Revision UUID plus revision number; exercise instance/set keys identify members, not Exercise catalog identity. Save/Publish/Create Revision. | Exact editor/revision selection and Quick Assign preview. Published immutable; next Draft does not mutate Published. |
| Assignment: `app.workout_assignments`, `app.workout_assignment_exercises`, `app.workout_assignment_exercise_sets` | Assignment UUID W; T/A/R + source M/V. Only `WorkoutService.createAssignment` for canonical assignment. | Independent title/instruction/exercise/set prescription snapshot; subsequent Template edit/archive does not rewrite W. Both roles read W. Client `?assignment={W}`. Status/due date are not Session completion. |
| Session: `app.workout_sessions` | Session UUID S; unique Assignment; athlete starts/resumes. Exact T/A/R/W lineage. | Client execution/completed, trainer Review/Training. Active -> completed/completed_with_omissions/abandoned; completion is immutable. Client `?session={S}`, trainer `/trainer/review/{S}` despite folder named `[workoutId]`. |
| ExerciseLog: `app.workout_exercise_logs` | Log UUID L; Session + source AssignmentExercise; created at Start. | Execution and Review; exact source join, not matching title/index. Status derived from persisted child sets. No standalone navigation route. |
| SetLog: `app.workout_set_logs` | SetLog UUID K + source AssignmentSet; created at Start; Save/Skip actual values. | Same repetitions/duration/weight/RPE/comment/status in both roles. Session version is concurrency unit; no independent Set version. Terminal Session prohibits edits. |
| Attention: `app.attention_items` | Attention UUID I; exact source Session; unique Session/item type. Created by Complete. | Trainer Dashboard/Queue/Review; open -> resolved/archived. Client DTO does not expose trainer workflow internals. No-assignment Dashboard signal is a **derived condition**, not another persisted Attention kind. |
| Feedback: `app.trainer_feedback` | Feedback UUID F; exact I/S/T/A/R, optional parent Feedback UUID. `ReviewService` send/follow-up. | Immutable body/sent timestamp; same F in send result, latest, thread and exact completed view. Client link carries S plus optional F. Manual resolution does not invent a Feedback. |
| Receipts: `app.workout_template_command_receipts`, `app.workout_session_command_receipts`, `app.review_command_receipts` | Actor + operation + command/key hash and request fingerprint; server-owned. | Replay/reconciliation, no public collection route. Assignment uses stable Assignment UUID and snapshot equality; Start also has natural unique-Assignment convergence, not a new universal receipt table. |
| Outbox: `app.notification_outbox` | Outbox UUID/dedupe key; command transaction creates event, worker delivers. | Pending/leased/sent/retry/failure lifecycle; private worker/operator access. A notification is not the source of Assignment/Feedback or proof the recipient viewed it. |

Schema evidence: `database/migrations/0001_backend_foundation.up.sql`, `0004_capabilities_and_invitations.up.sql`, `0005_workout_templates_and_assignments.up.sql`, `0006_workout_builder_lifecycle.up.sql`, `0007_workout_session_execution.up.sql`, `0008_workout_review_feedback.up.sql`, `0010_notification_outbox.up.sql`, `0012_athlete_profile_read_model.up.sql`, `0013_workout_template_revision_lifecycle.up.sql`, `0014_canonical_exercise_library.up.sql`, `0015_workout_template_command_hardening.up.sql`, `0016_workout_session_completion.up.sql`.

## 3. Production route graph

Production classification assumes demo mode disabled. Importing a prototype is not proof that its branch executes.

| Route / implementation | Classification | Source and boundary |
| --- | --- | --- |
| `/trainer/dashboard` -> `canonical-trainer-dashboard.tsx` | CANONICAL | Dashboard PostgreSQL snapshot. Same route retains a separate demo branch. |
| `/trainer/clients` -> `canonical-trainer-roster.tsx` | CANONICAL | Linked athlete roster; shared Quick Assign Sheet, not the old inline authoring form. |
| `/trainer/clients/{A}?tab=training` -> `canonical-athlete-profile.tsx` | CANONICAL | Profile/Training query services; exact A. Invalid/unavailable profile returns roster, not another athlete. No canonical `/trainer/athletes` route needed. |
| `/trainer/templates` -> `canonical-templates-workspace.tsx` | CANONICAL | Actor-scoped Workspace query, exact revision lifecycle. |
| `/trainer/builder/new`, `/trainer/builder/{M}` | CANONICAL | `canonical-workout-template-editor.tsx`; guarded Editor, explicit dirty/return intent. |
| `/trainer/builder` | COMPATIBILITY / REDIRECT | `resolveLegacyWorkoutTemplateBuilderHref`; not a second canonical authoring surface. |
| `/trainer/attention` | CANONICAL | `canonical-review-queue.tsx`; exact source Session rows. |
| `/trainer/review/{S}` | CANONICAL | Page aliases `workoutId` to `sessionId`; `CanonicalWorkoutReview`. Legacy full client and demo Review are not this production dispatch. |
| Profile/roster `assign=1&flow=...&handoff=...` | CANONICAL contextual host | Shared `canonical-quick-assign-sheet.tsx`; URL intent is validated, not authorization. No independent Assignment mutation in host. |
| `/client/me` | CANONICAL | `CanonicalClientHome`; PostgreSQL current + independently loaded latest feedback. Legacy imports remain in the page module. |
| `/client/workouts` | CANONICAL | Current collection + completed history; no required Progress detour. |
| `/client/workouts?assignment={W}` or `?session={S}` | CANONICAL | Exact execution/completed projection; malformed/foreign identities fail closed. `feedback` and `returnTo` support exact feedback and history return. |
| `/client/activity`, `/client/progress` | REDIRECT -> LEGACY in production | Page explicitly redirects to `/history`; demo versions remain. They are not links required by canonical Home/Workouts. |
| `/history` (`app/(client)/history/page.tsx`) | LEGACY | Older Supabase client workflow, not R3E history. Do not use to satisfy the R4 history gate. |
| `/client/dashboard` | LEGACY / ambiguous compatibility | Client component still checks Supabase auth before redirect. Not canonical sign-in destination. |
| `/dashboard/*`, old standalone workout screens | LEGACY | Separate namespace/source assumptions; no demonstrated dependency from canonical core CTA graph. |
| Trainer Library / settings / non-MVP zones | Supporting / mixed legacy boundary | Preserve navigation-return tests; not evidence of a second canonical workout command. Exercise selection inside Editor uses canonical PostgreSQL library. |

Route evidence: the listed `app/**/page.tsx`; `app/trainer/layout.tsx`, `app/client/layout.tsx`; `lib/demo-mode.ts`; `lib/quick-assign-navigation.ts`; `lib/workout-template-editor-navigation.ts`. Remaining legacy links are classified in section 8, not silently removed.

## 4. Transition and return matrix

Common authorization: authenticated Actor + active capability + repository ownership/RLS. A signed-looking `flow`, `handoff`, `returnTo` or UUID in the browser is never permission evidence. Server revalidates the target. R2A.3 service returns typed destinations/receipts; R3E navigation returns explicit allowlisted collection URL and semantic anchor, not `router.back()` alone.

| From / task / CTA | Exact identity and context | Destination / return | Refresh and failure |
| --- | --- | --- | --- |
| Dashboard -> inspect athlete | A, optional I/S; queue filter/order/origin | `/trainer/clients/{A}`; explicit queue return | Profile/Training fresh reads; inaccessible A -> roster. |
| Dashboard -> Review | I + S + A, validated flow | `/trainer/review/{S}`; queue context | Exact Review GET; stale/resolved stays exact, no next-Session substitution. |
| Profile Header -> assign | A, current relation capability, flow | Shared Sheet on contextual host | Quick Assign read; suspended/foreign denies. |
| Roster -> assign | Exact row A, roster return | Same Sheet | Same service, no inline template creation command. |
| Quick Assign -> no suitable template | A + validated handoff with assignment intent | `/trainer/builder/new`; preserved return intent | No unsaved template assigned. Invalid handoff falls back safely. |
| Workspace -> Editor | M + selected revision / workspace query and anchor | Exact Editor; explicit Workspace return | Exact GET; no latest-title matching; unavailable selection is shown. |
| Editor -> Quick Assign | Saved/published M/V, handoff | Original A host/Sheet | Re-read selected revision and assignment state; stale published pointer requires confirmation, not forced assignment. |
| Quick Assign success -> Profile / Queue / next | Persisted W, A; completion receipt | Typed allowed destinations | `revalidation.ts` invalidates trainer/client paths; mounted remote actor state still needs a new read (F02). |
| Client Home -> workout | W or S from canonical projection | `/client/workouts?...`; safe Home return | Exact owner read; no fallback to another Assignment. |
| Assignment -> Start/Resume | W; browser attempt key/timezone; returned S | Same exact flow with S | Natural unique-W Start; unknown reconciles exact W/S; suspension before Start denies. |
| Execution -> save/skip -> Complete | S, exact K, expected Session version; frozen attempt | Same execution; completion dialog -> terminal S | Persisted facts only; unknown check/replay. Batch atomicity defect F01. |
| Completion -> Home / Workouts | Exact terminal S + explicit return | `/client/me` or collection with semantic context | Terminal exact re-read; navigation failure must not repeat Complete as a new intent. |
| Queue -> Review -> Queue | I/S; flow and queue anchor | Exact Review, receipt Queue link | Fresh queue; next-item sort/position mismatch F05. |
| Review -> Athlete / next Assignment | Same A/R from Review capability | Profile or contextual Sheet only if allowed | Suspended/end historical Review does not imply Profile/Assign rights. |
| Send Feedback -> client Home | Persisted F/S body/sentAt | No cross-browser navigation push; latest feedback read | Latest component reloads on focus; latest means server-ordered feedback, not independent role recomputation. |
| Home feedback -> completed detail | Exact S + F | Exact completed view; explicit Home return | Thread verifies own completed Session; missing F does not select a foreign response. |
| History -> completed -> history | S anchor + start cursor + successful depth D | Exact S, then original collection URL | Canonical replay pages 1..D; partial prefix preserved; invalid cursor resets history only. |

Sources: `lib/trainer-workflow-transition.ts`; `lib/server/trainer-workflow/trainer-workflow-transition-service.ts` (`destinations`, `validatedReviewContext`); `lib/server/trainer-workflow/revalidation.ts`; `lib/quick-assign-navigation.ts`; `lib/workout-template-editor-navigation.ts`; `lib/client-history-navigation.ts`; `app/client/workouts/page.tsx`; canonical client components.

**Selection audit:** `destinations` uses `candidates[0]` after server-filtered candidates, but does not honor `queue.order/position` in selection (F05). Home's first card is a bounded server-ordered current projection, not a title-selected entity; still test multiple independent current/next items. Review page `firstValue(query)` chooses first duplicated query parameter, whereas client exact route rejects duplicates; this is navigation parser inconsistency, not proof of authorization bypass. No title/date guessing was found in exact W/S/F retrieval. Repository sort for an explicitly defined latest/next projection is distinct from guessing the entity for an exact link.

## 5. Command idempotency and concurrency

| Command | Identity / fingerprint / concurrency | Replay, unknown outcome and side effects |
| --- | --- | --- |
| Template Save Draft | Stable browser `commandId`, frozen content/payload, expected edit token; actor/operation receipt fingerprint | Same attempt replay; changed content same ID conflicts; exact GET reconciles. Recovery uses TTL + same edit token + changed content, explicit Restore/Discard, not browser/server clock comparison. |
| Publish | Stable command ID + exact editable revision/token and previous Published identity | Exact published identity -> success; unchanged previous Published, including null, plus same Draft -> replay same command; other revision change -> conflict. One receipt/audit. |
| Create Revision | Command ID, source Published identity and token | One editable Draft; replay versus stale pointer distinguished. Does not mutate existing Published/Assignments. |
| Duplicate / Archive | Command ID + exact source/expected lifecycle state | Duplicate receipt binds created aggregate; Archive aggregate-wide, existing Assignment remains usable. Unknown read/replay must retain intended source. |
| Quick Assign | Stable Assignment UUID from Sheet, exact Published V and assignment-state token; equality of persisted logical input | Identical W replay; modified W payload conflict; concurrent assignment/state change requires refresh/acknowledgement. `WorkoutService.createAssignment` still generates UUID when omitted by a compatibility caller; canonical Sheet supplies it. |
| Start / Resume | Frozen browser attempt; Assignment unique constraint + owner/relation lock | Two starts converge on same S. This is natural identity idempotency, not a general same-key/different-payload receipt protocol. Different W is another command. |
| Save Set / Skip Set | Same progress command, actor/key/request hash, expected **Session** version | Same-key replay; modified retry conflict; concurrent version conflict; exact K reconciliation. **F01 breaks batch atomicity** before receipt/version when a later K is absent. UI currently submits one Set, service accepts 1..20. |
| Complete | Actor/key/logical request fingerprint, Session lock/version, exact context | Completion/omissions/Attention/receipt/audit/outbox atomic; same-key and equivalent committed outcome reconcile. Legacy receipt path tested. Null legacy context is not false. |
| Feedback / acknowledgement / follow-up | Browser ref owns stable key for same trimmed payload; I lock; receipt request hash | Initial feedback resolves I atomically; follow-up references exact parent F. Changed content is new intent. Reload does not persist browser ref; resolved-state gate protects initial resend. Lost-response follow-up/reload remains a required browser test, not a proven bug. |
| Manual resolution | Exact I + private reason + stable review receipt | Resolve once; reason not athlete Feedback; no fabricated notification/body. Stale item checked; no Profile grant. |

Evidence: `workout-builder-service.ts` / `workout-builder-repository.ts` under `lib/server/workouts/`; migration 0015; `workout-service.ts:createAssignment`; `workout-repository.ts:createAssignment`; `workout-session-service.ts`, `workout-session-repository.ts`; `review-service.ts`, `review-repository.ts`; `lib/client-workout-{start,progress,completion}-command.ts`; `canonical-review-action-region.tsx`; `canonical-workout-template-editor.tsx`; `canonical-quick-assign-sheet.tsx`.

No per-retry random key was identified in the canonical frozen-attempt paths. This does not certify every old endpoint/caller: optional assignment ID and old demo commands remain outside that statement. Receipt protects logical effects; it does not promise exactly-once external Telegram delivery.

## 6. Cross-role fact consistency

| Fact | Shared source / parity assertion | Audit verdict |
| --- | --- | --- |
| Assignment | W + M/V + R; trainer receipt versus client assignment snapshot, title/instructions/date/sets | Same persisted W; no Template rehydration changing a past prescription. CODE + existing PostgreSQL tests. |
| Session | S/W/A/T/R + started/completed timestamps and terminal status | Exact client and Review repositories join the same S. Code/projections and PostgreSQL tests support parity. |
| Set | K -> L -> AssignmentExercise/Set; repetitions/duration/weight/RPE/comment/status | Same stored actuals; null is absent, numeric 0 remains 0; skipped/incomplete not completed. F01 shows version/receipt parity can diverge from actual mutation. |
| Discomfort | `discomfort_reported`, comment and overall context on S | Explicit false, true, and legacy all-null differ. Dashboard severity/history markers are projections, not replacement facts. Migration 0016 and R3D/E tests. |
| Feedback | F/S/parent/body/sentAt | Same persisted Feedback across trainer result, client latest/thread/exact. Latest sorts by persisted timestamp/ID, not browser clock. Missing feedback != read failure. |

Full two-role rendered parity for the deterministic four-exercise fixture is **PLAN**, not freshly executed. PostgreSQL `timestamptz` is authoritative; local date formatting may differ but cannot change semantic timestamp or history cursor precision. No weekly/timezone Progress contract is added.

## 7. Auth and RLS matrix

Legend: ALLOW is scoped to owned/exact lineage and active account/capability; DENY means unrelated actor even if URL context is valid. Dual-role actor gets the union of its own scoped capabilities, never blanket ownership. Service authorization remains required in addition to RLS.

| Entity/read/command | T (active R) | A | B / T2 foreign | Dual-role | R suspended / ended |
| --- | --- | --- | --- | --- | --- |
| Own User/auth state | ALLOW self | ALLOW self | DENY other's private auth | Own only | Own account independent of R |
| Relation read | ALLOW own pair | ALLOW own pair | DENY | Own pair only | Original pair readable; no transfer to new T |
| Athlete Profile read/write | Read A; DENY athlete questionnaire write | Own read/write | DENY | Evaluate self vs trainer separately | T read suspended under **0012 broad policy**; ended no general Profile grant. |
| Exercise catalog | Base + owned visible library | No access to T private library via assignment | DENY private owner substitution | Owned/base capability scope | T own catalog unaffected by R |
| Template/revision read and lifecycle writes | Own only | DENY trainer library | DENY | Own trainer aggregate only | Own templates unaffected; no assignment right implied |
| Assign | ALLOW own Published V to linked A | DENY | DENY foreign V/A | Trainer capability + exact R | DENY new assignment |
| Client current/history/exact | No athlete endpoint access merely by coaching | ALLOW own W/S/F | DENY | Athlete self only | A retains own data after end |
| Start | DENY on behalf of A | ALLOW own eligible W, active R | DENY | Athlete self only | DENY new Start; concurrent suspend serialized by relation lock |
| Resume/save/skip/complete started S | DENY athlete mutation | ALLOW own active S | DENY | Athlete self only | Started work remains completable; no new Start permission |
| Trainer active Session read | ALLOW exact R | Own read | DENY | Exact role scope | Historical exception is terminal only; not general live tracking after end |
| Terminal S/snapshot/log Review | ALLOW exact original T/A/R/I | Own safe completed projection | DENY new T inheriting old R | Exact role scope | **ALLOW bounded original terminal workflow**, migration 0016; not Profile/Progress access |
| Attention queue / resolve / Feedback send | ALLOW original workflow | DENY trainer internals/write | DENY | Trainer scope only | Bounded exact terminal lineage can finish review; no new Assign/Profile capability |
| Feedback read | Own exact review scope | Own F regardless R lifecycle | DENY | Own participant scope | Original lineage; new relation does not transfer feedback |
| Receipt / audit / outbox | Domain services scoped actor; no generic user browse | Same | DENY | No elevated capability by union | Outbox worker/authenticator grants separate; never authorized by return context |

Sources: migration policies 0001/0004-0008/0012-0016; `lib/server/access/access-guard.ts`; `lib/server/database/transaction.ts`; repositories' explicit owner WHERE clauses. Fresh suite includes foreign, lifecycle, RLS and terminal-lineage cases. Complete role-by-entity browser matrix, especially dual-role expired auth, remains planned.

Security classification: F01 is a **PILOT BLOCKER** for integrity, not a demonstrated foreign-data leak. Broad 0012 suspended Profile access is **PRE-BETA HARDENING / P2, acceptance required for pilot**; it is not an accepted new Progress capability or automatically “known accepted legacy”. No new access is approved by this audit. Private auth tables without RLS are not automatically a leak: schema/table grants and authenticator separation are their boundary.

## 8. Legacy production graph

| Residual path | Classification / impact / evidence |
| --- | --- |
| `/client/activity` and `/client/progress` -> `/history` | COMPATIBILITY ONLY / DEFERRED CLEANUP. Real legacy redirect, but canonical history uses `/client/workouts`. Do not direct pilot participants to these URLs. Page code confirms. |
| `/client/dashboard` Supabase auth | DEFERRED CLEANUP; misleading old entry. Canonical login target is `/client/me`. Test bookmarks/old links; no requirement to restore it for R4. |
| Supabase/demo imports in `/client/me`, trainer Dashboard/roster pages | DEMO EVIDENCE / mixed module boundary; canonical branches use new components. Static import alone does not prove production data read. Verify production-mode requests in later browser gate. |
| Old Review `workout-review-client.tsx` / `ExerciseDetailSheet` | DEAD PRODUCTION CALLER from canonical Review route; prototype evidence. Accessibility source in UX document, not current canonical Review warning claim. |
| `/trainer/builder` old query URL | COMPATIBILITY ONLY, explicit resolver. Preserve handoff and malformed-ID tests; no alternate authoring mutation needed. |
| GET `/api/workout-sessions`, `WorkoutSessionRepository.listAthlete` | Obsolete unbounded endpoint: 1+2N Session hydration queries. No canonical current/history caller found; **DEAD PRODUCTION CALLER** means no core UI caller, not an unreachable API. Auth/RLS still required; defer removal, pre-beta resource hardening. |
| Default `/api/client/feedback`, `ReviewRepository.listAthleteFeedback` | Unbounded compatibility read. Canonical callers use `mode=latest` or bounded exact thread. Do not substitute default endpoint into new history. |
| localStorage demo domain facts | DEMO EVIDENCE, not canonical core source. Editor recovery stores a local unsaved draft offer, not authoritative saved Template; client history does not cache facts in localStorage/sessionStorage. |
| Dashboard pure helper imported from `home/mock-data.ts` | Import provenance merits cleanup, but `getTeamSummary` aggregation over canonical input is not proof of mock athletes in current projection. Distinguish helpers from fabricated facts. |

No demonstrated core CTA currently requires the Supabase legacy history. Legacy absence from primary navigation does not prove all bookmarks/inbound URLs harmless; the test plan checks them without deleting anything.

## 9. Performance evidence

Measured SQL counts include transaction/actor/isolation/COMMIT; **data reads** count SELECT/WITH calls separately. HTTP authentication queries are excluded. Tiny isolated diagnostic fixture is one published template, one athlete/relation and two Sets; it measures query shape, not load capacity or the planned four-exercise pilot fixture. Milliseconds are one local run, not p95/SLA.

| Read/command | Fresh total SQL / data reads | Shape / local observed repository wall time |
| --- | --- | --- |
| Dashboard snapshot | 12 / 3 | Athletes + queue + activity; 23.711 ms. Three transactions, not one atomic multi-section snapshot. |
| Profile snapshot | 4 / 1 | One athlete aggregate; 10.966 ms. Training tab has independent current/history reads; not included in this count. |
| Templates Workspace | 6 / 2 | Page summaries and counts; 14.554 ms; no per-template exercise hydration. |
| Quick Assign initial | 12 / 3 | Athlete/state + template page; 12.242 ms. |
| Quick Assign selected preview | 18 / 6 | Exact revision exercises/sets only for selection; 14.725 ms; not one query per list card. |
| Client current | 4 / 1 | 20 + sentinel; 6.513 ms. `hasMore` not exposed by current UI (F04). |
| Client exact active | 11 / 4 | Assignment/Session/exercises/batch Sets; 15.260 ms. |
| Complete first / replay / reconcile | 19 / 10 / 12 **total statements respectively** | Fresh R3D test counts. Diagnostic first completion 29.584 ms; locks/writing CTEs are not all “data reads”. |
| Queue | 4 / 1 | 6.433 ms; set-based but currently unbounded open queue. |
| Exact Review | 9 / 5 | 15.198 ms; exact header/exercises/sets/feedback reads, no per-exercise query. Feedback thread row count can grow. |
| History 10 / 30 / next page | 4 / 1 each | Fresh R3E suite; page-first keyset + aggregates; 10 default / 30 max **per request**. |
| Completed detail | 8 / 4 | Fresh R3E suite; consistent exact Session/snapshot/log data. |
| Feedback latest / thread | 4 / 1 each | Fresh R3E suite; separate bounded feedback pagination. |

Fresh R3E `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` under app RLS: 34 terminal Sessions -> 11 returned rows, planning 2.314 ms / execution 0.724 ms; 5,034 terminal Sessions -> 11 rows, planning 2.350 ms / execution 3.437 ms. These existing query/index results do not justify a new migration. No index or migration is proposed here.

**HTTP evidence:** source-level expected data calls, not a captured R4 network trace: Home 1 current + 1 latest; collection adds 1 initial history; each history append 1 page; return/reload D successful pages requires D sequential history reads. Exact completed view reads detail and separate feedback; Quick Assign re-reads on selection/search; commands may trigger reconciliation/receipt reads. Auth, RSC navigations, aborted requests and dev double effects must be counted separately in the browser gate.

Risks: unbounded review queue, feedback attached to exact trainer Review, upcoming-assignment state used for Quick Assign conflict token, and legacy lists. Constant SQL count does not mean bounded rows or constant work. History depth replay cost is O(D) requests by accepted R3E-03; **no hidden restore-depth cap**, no client fact cache. If later EXPLAIN requires migration/index, STOP for review rather than silently adding it.

## 10. Database and deployment gate

Chain 0001..0016 has paired up/down files. Fresh PostgreSQL suite applies the current chain; R3D test creates pre-0016 legacy terminal/active rows and receipt, applies 0016 with the normal migrator, and checks null/replay/new completion rules. That is real upgrade evidence, not merely clean install. It does not certify an unknown external database's provenance/owners.

Existing `scripts/test/run-migration-upgrade-postgres.mjs` and `docs/local-database-recovery-v1.md` describe 0011 -> 0012 clean/legacy ownership recovery. Not rerun in this R4 pass. Old local ownership repair is infrastructure, not an environment-specific ALTER OWNER inside product migration 0012.

Isolated catalog probe: 28 ordinary tables in app/app_private, 24 FORCE RLS. Auth-private tables use revoked public/schema access and authenticator grants; do not read this as “4 publicly accessible tables”. Migrator owns schema/product objects; app role is not their owner. Inspect migrator checksum/owner guards in `scripts/db/migrate.mjs` and bootstrap before every rollout.

0016 helper `app.has_terminal_assignment_workflow(uuid,uuid,uuid)` is SECURITY DEFINER with fixed `search_path = pg_catalog, app`, explicit PUBLIC revoke and app grant; non-inline PL/pgSQL avoids policy recursion. Scope is exact terminal lineage, not all athlete history for any trainer. The relation-lock policy permits athlete row locking while `WITH CHECK (false)` prevents athlete relation mutation.

Down caveat: real 0016 rollback drops completion context columns and removes newer policy behavior; data is lost without a preservation plan. R3D exercises down inside a rolled-back test transaction, not a safe production destructive rollback guarantee. Older lifecycle/receipt migration downs also remove schema/data; back up before any real down.

**0016 external rollout = HOLD** until provenance preflight, backup and rollout review. No external rollout performed. This is a deployment gate, separate from local F01 correctness. Local upgrade SQL PASS does not mean the full upgraded-browser loop has passed.

## 11. Findings and required fixes

### F01 / P1 / confirmed RUN: partial SaveProgress command commits

Reproduce against fresh disposable database with real migrations and `ai_strength_app`: create T/A/active R, Published Template and Assignment through repositories, Start through service, then call `WorkoutSessionService.saveProgress` with current version and two syntactically valid distinct Set UUIDs: first belongs to S, second does not exist. First update sets completed repetitions/weight (55 kg). The service accepts batches of 1..20 (`workout-session-service.ts:110`); repository updates sequentially.

Observed output:

```json
{"returnedNull":true,"beforeVersion":1,"afterVersion":1,"beforeStatus":"pending","afterStatus":"completed","afterWeight":55,"progressReceipts":0}
```

Root cause: `lib/server/workout-sessions/workout-session-repository.ts:196`, `if (!updated.rowCount) return null` exits normally after earlier writes. `lib/server/database/transaction.ts:15` commits a normally returned value, including null. Session version, aggregate refresh and receipt occur after the loop and are skipped. API maps null to `404 active_session_not_found` (`app/api/workout-sessions/[sessionId]/progress/route.ts`). Probe invoked the real service/repository, not HTTP; HTTP status follows handler code.

Impact: failed command changed persisted facts without version/receipt, defeating stale-write protection and trustworthy retry. No foreign Set was modified; not a demonstrated privacy breach. Browser currently sends one Set per command, so this is not a claim that every ordinary click fails. Nonetheless the supported canonical command is not atomic. Full existing 154-test suite misses this case.

Required later fix: validate ownership/existence of the entire batch before writes or ensure missing member aborts the transaction; all-or-nothing failure, no version/receipt/audit partial effects. Add valid-first/invalid-last and foreign-member regressions, including existing actual values. **Not implemented in R4 audit.**

### Other findings

| ID / severity | Evidence / impact | Required disposition |
| --- | --- | --- |
| F02 / P2 / CODE | `canonical-client-home.tsx:42` current read runs on mount only, unlike `canonical-recent-feedback.tsx` focus reload. Trainer revalidation cannot replace an already-mounted other actor's local state. Assignment can remain invisible until reload; current load error has no local retry. | Test two role tabs; add scoped refresh/retry later or explicit pilot acceptance of reload workaround. |
| F03 / P2 / CODE | `app/client/layout.tsx:7` and trainer layout pass fixed Home/Dashboard to `requireCapability`. Signed-out/expired deep link can lose exact workout/history/handoff intent. | Browser prove expiry/return behavior and preserve safe exact route later; no data-loss claim. |
| F04 / P2 / CODE | Current repository returns 20 and `hasMore`; Home collection does not render a way to reach further current rows. | Test 21+ assignments. Accept pilot bound explicitly or fix discoverability; do not confuse this with unlimited appended completed history. |
| F05 / P2 / CODE | `TrainerWorkflowTransitionService.destinations` selects `candidates[0]` after filter, ignores requested order/position. | Assert queue-order semantics; fix or explicitly accept server-priority “next item”, never assume existing return-context fidelity. |
| F06 / P2 / PRE-BETA HARDENING | Broad 0012 suspended Profile policy separate from bounded 0016 Review permission. | Founder/security review must explicitly accept pilot exposure or require narrowing; no new permission inferred. |
| F07 / P3 / CODE | Old Supabase redirects/unbounded unused core callers and legacy `ExerciseDetailSheet` accessibility semantics. | Deferred cleanup; promote only on demonstrated core route/privacy/resource impact. |
| F08 / P2 / verification gap, not confirmed runtime bug | No fresh authenticated full browser cycle/mobile/focus/unknown-after-reload proof in this audit due dev-server lock. | Run isolated browser gate; this P2 label does not waive mandatory pilot verification. |
| F09 / P2 / CODE | `canonical-workout-execution.tsx:154` puts non-404 first-load failure in `error`, but `:391` returns the generic unavailable screen when no model exists, before rendering that error. A transport/503 failure is presented as possibly stale link and no local retry is offered. | Separate transient GET failure from unavailable; test first-load 503/network loss versus true 404. Reload can recover, so not P1. |

Dashboard next-work projection also compresses active execution/future assignment into one selector, unlike independent Profile Training states; trainer+athlete subqueries deserve a new-relation parity test. These are test hypotheses, not proven cross-relation leakage. Check in F05 follow-up before elevating severity.

## 12. Pilot readiness and follow-up order

**NOT READY:** P0 demonstrated = 0; P1 confirmed = 1 (F01). P2 findings are not implicitly accepted. Mobile/a11y and two repeated full cycles are not freshly certified. The companion test plan has the binary 20-item gate; unchecked means not verified, not automatically broken.

Next scope, only after review: (1) approve minimal F01 correction and regression; (2) run the deterministic two-cycle role-isolated browser fixture on fresh and upgraded DB; (3) resolve or explicitly accept F02-F06/F09 and verify navigation/focus; (4) close binary checklist. External rollout remains a separate HOLD. Do not use shared administrator credentials or manually repair DB rows to make the loop pass.

## 13. Non-goals and scope confirmation

R3F strength Progress is intentionally **DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY**. Completed-week count is future secondary activity, not strength. Future prerequisite only: Exercise UUID -> Template -> Assignment snapshot -> Session/log evidence, no title/key guessing. Future shared metric needs relation scope and shared timezone contract; UTC week and post-suspension trainer Progress are not accepted. R3F does not block R4.

No Progress, weekly activity, Exercise identity migration, Program, calendar, Messages, AI, Motivation/achievements/titles/rank, payments, analytics, Dashboard feature, Profile/Review redesign or visual polish is introduced.

This pass changes only the three R4 documents after the separate R3F documentation commit. Production code, UI, APIs, tests, routes, configuration, schema and migrations were not edited. No R4 fix, stage, commit or external deployment was performed.
