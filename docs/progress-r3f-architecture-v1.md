# R3F-A: Shared Progress Metric Architecture

Date: 2026-09-04
Status: founder review decisions recorded; R3F strength progress DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY; document revision awaiting review
Baseline: `ac7b67535ed7f45fb6b9d3b776ec14074917c350`
Branch: `codex/r3f-progress-metric`
Companion: [UX design](progress-r3f-design-v1.md)

## 1. Executive Verdict

**R3F strength progress = DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY.**

An honest first strength-progress metric has not been demonstrated from the current canonical facts. No replacement metric is selected artificially. Exercise-specific candidates remain blocked by stable identity and data-eligibility gaps.

Founder review **rejects R3F-01 completed-workout weekly count as the first Progress metric**. It is a training activity / recorded consistency fact, not a measurement of strength improvement. It includes completed Sessions with no results and cannot answer whether the athlete became stronger. Retain it only as a possible future secondary metric named `Тренировочная активность`; do not implement it in R3F. This is not an approved adherence score or activity implementation contract.

The evidence behind deferral remains:

1. Exercise Library UUID is persisted on Template Exercise, but is NOT copied into Assignment Exercise. A snapshot key does not provide sufficient global uniqueness/provenance. A real database fixture accepts a system and trainer exercise with the same key. Today's key/title match is not proof of historical exercise identity.
2. Nullable load, duration/bodyweight work, incomplete/skipped Sets, changed repetition ranges and absent effort/load conventions require explicit eligibility before any strength formula can be trusted.
3. Client and trainer visibility differs. **Explicit relation scope is accepted** for any future shared metric so both roles count the same Session population. A relation-scoped value must never be called lifetime/overall athlete progress.

**UTC week semantics are not accepted.** A future weekly metric requires one canonical timezone contract shared by both roles; independent browser timezone bucketing is prohibited. The old eight-week/count/UTC design is withdrawn, not a default for future implementation.

**No new trainer Progress capability after suspension/end is accepted.** Athlete access to own data remains. Bounded historical Review permission cannot authorize Progress. Existing broad 0012 suspended Profile reads are a separate security-hardening issue, not product authorization for a new Progress read.

R3F implementation is deferred. No schema/API/code changes were performed. The core workout-feedback loop is complete, so **R4 may proceed independently** of this deferred strength metric; R4 is not started in this task. These review decisions are recorded below; the edited documents await review and no commit is created.

### Evidence Register

Paths are repository-relative; line anchors refer to the baseline. Symbol references remain the authority if lines move.

| ID | Files / symbols | Confirmed evidence |
| --- | --- | --- |
| E01 | `database/migrations/0005_workout_templates_and_assignments.up.sql:75,101`; `0006_workout_builder_lifecycle.up.sql:105,161` | Independent Assignment, Exercise and Set snapshots; source revision, instance, source key, prescription, per-set overrides and superset fields. |
| E02 | `database/migrations/0007_workout_session_execution.up.sql:1,6,33,48,124,130` | Session/log enums, fields, uniqueness, numeric constraints, indexes and immutable terminal Session. |
| E03 | `database/migrations/0016_workout_session_completion.up.sql:1-85`; `lib/server/workout-sessions/workout-session-service.ts`, `complete` | Completion context and retained original-lineage historical access; current command validation. |
| E04 | `lib/server/workout-sessions/workout-session-repository.ts:132-157`, `start`; `WorkoutSessionService.saveProgress`, `setInput` | Snapshot-backed log creation, fallback Set generation, explicit Save/Skip, optional weight, rounded numeric input. |
| E05 | `database/migrations/0014_canonical_exercise_library.up.sql:1-117,133-140,157-267`; `WorkoutBuilderRepository.prepareRows:774-812` | Catalog UUID, scoped key uniqueness, trainer-only catalog RLS, Template UUID validation/backfill and nullable unmapped sources. |
| E06 | `lib/server/workouts/workout-repository.ts:462-506`, `createAssignment`; `:599`, legacy template creation | Copies source key but not catalog UUID. Old simplified template source key is based on instance identity. |
| E07 | `lib/server/client-workouts/client-history-repository.ts:16`, `clientHistorySql`; `client-completed-types.ts`; `client-completed-repository.ts`, `find` | Own terminal Session page-first reads, safe exact snapshots/context/logs. No canonical progress projection. |
| E08 | `lib/server/athlete-profile/athlete-profile-repository.ts:74-159`, `findSnapshot`; `athlete-profile-query-service.ts:43`, permissions; `database/migrations/0012_athlete_profile_read_model.up.sql:29-56` | Current Profile accepts active/suspended relation, not ended; operational facts scoped to selected relation. |
| E09 | `app/client/progress/page.tsx:7-15`; `components/trainer/canonical-athlete-profile.tsx:218,336` | Client production redirects to `/history`; canonical trainer Progress tab exists but shows only last-session facts. |
| E10 | `app/(client)/history/page.tsx:21-78`; `components/client/WeightTracker.tsx:30-60,130` | Supabase log/day grouping and nullable values treated as zero for tonnage; separate explicit bodyweight reads/writes. |
| E11 | `components/demo/demo-client-cabinet.tsx:4610-4715`; `components/trainer-os/client-profile/progress-tab.tsx:64,428,616`; `mock-data.ts:458-505` | Fabricated demo progression, title-keyed series, Program-based score, rounding/clamping. Visual evidence only. |
| E12 | `components/client/runtime/client-runtime-progress.tsx:10`; `components/trainer-os/demo-runtime/client-selectors.ts:142-153` | Runtime demo store; strength series mixes weight or repetitions; not canonical production data. |
| E13 | `lib/client-history-navigation.ts:42-78`, `safeClientReturn`; `lib/trainer-workflow-transition.ts:5-7,16-27,117` | Client return allows Home/history, not Progress. Trainer command flow tab is training only. Exact Progress return is a new read-navigation requirement, not already supported. |
| E14 | `tests/backend-foundation/client-workout-r3e-postgres.test.ts:65-136,355-418`; `workout-builder-test-driver.ts`; `workout-session-postgres.test.ts` | Disposable PostgreSQL fixture patterns, canonical commands, synthetic scale data, original Session identity and omissions. |

Read product inputs: [R3A](client-workout-r3a-architecture-v1.md), [R3B](client-workout-r3b-design-v1.md), [R3C](client-workout-r3c-design-v1.md), [R3D](client-workout-r3d-architecture-v1.md), [R3E architecture](client-workout-r3e-architecture-v1.md), [R3E design](client-workout-r3e-design-v1.md), [Core Workflow](core-workflow-v1.md), [Product Principles](product-principles-v1.md), [MVP Scope](mvp-scope-v1.md). Principles 3/4/10/13 govern parity and prototype isolation. Old readiness text is historical, not evidence that R3B-R3E remain unimplemented. R3D's accepted bounded workflow rule supersedes older suspend behavior, but does not authorize broad Progress.

## 2. Canonical Data Audit

The metric consequences below describe the investigated candidates, not an approved Progress predicate or payload. Count-related observations remain activity diagnostics only; no candidate is selected for implementation.

| Entity / field | Persisted meaning and caveat | Metric consequence |
| --- | --- | --- |
| Assignment identity | `id`, relation/trainer/athlete IDs, source Template/revision ID/number; `available/cancelled`, not a completed enum | Completion must come from Session, not Assignment status. |
| Assignment snapshot | Title, description/instruction/note, scheduled date; Exercise instance/position/title/category/equipment/source key; range/duration/weight/rest; per-set/superset facts | Prescription is not actual execution. Do not substitute planned weight for null actual weight. |
| Session status | `active/completed/completed_with_omissions/abandoned`; no cancelled Session enum | Include only the two completed states. Cancelled Assignment does not rewrite an already-completed Session. |
| Session completion/time | `completed_at timestamptz` required for terminal completed states; started/created/updated timestamps; `client_timezone` string, validated as a timezone by Start service | Use completed time, not scheduled date. No athlete-wide persisted progress timezone. |
| Session identity | One Session per Assignment; immutable athlete, trainer, relation, Assignment identity | Count Session IDs once, not log rows or distinct days. |
| Session context | `overall_comment`, nullable discomfort tuple, zero-result reason | Activity count does not require this context, but a zero-result completion cannot prove strength. All-null legacy context is not false. No Progress payload is selected. |
| Exercise Log source | FK `assignment_exercise_id`; Session FK; title/key resolved through Assignment snapshot | Log does not carry an independent global Exercise UUID/title. |
| Exercise Log state/order/time | `pending/completed/skipped/incomplete`, position, athlete note, created/updated timestamps; unique Session+AssignmentExercise and Session+position | Repeated exercise instances are separate logs, not two Sessions. Timestamp is not an exercise-completion timestamp. |
| Set source | Nullable `source_assignment_set_id`; required `set_key`; position; unique within ExerciseLog | Keys/positions are instance-local, never cross-Session grouping keys. Fallback uniform Sets can have null source FK. |
| Set kind/status | `warmup/working`; `pending/completed/skipped/incomplete` | Exclude warmup/skipped/incomplete from proposed strength candidates. Count does not inspect Set kind. |
| Planned repetitions | Nullable min/max, positive bounded range | Rep range can change; not a comparable measured result. |
| Planned duration/load | Duration nullable 1..86400 seconds; weight nullable numeric(7,2), 0..2000 kg | Duration and bodyweight work need not have load. Equipment is free text, not a canonical load convention. |
| Actual repetitions/duration | Nullable integers, respectively 0..500 and 0..86400; completed requires at least one non-null result | A completed Set can have zero repetitions or only duration. Completed does not imply full ROM, failure or prescribed reps met. |
| Actual weight | Nullable numeric(7,2), 0..2000; service rounds numeric input to one decimal | Null legal for ANY completed Set. DB precision is not proof of sensor/measurement accuracy. No body-mass, assistance, per-hand or total-load discriminator. |
| RPE/comment | Nullable RPE 1..10, original athlete text; Set created/updated timestamps | No mandatory effort/failure/ROM data. Comments cannot be parsed into trustworthy metric facts. |
| Per-set overrides | Snapshot contains kind, reps/range/duration/weight/rest/override flag; Session copies actual planned Set values | Use exact Set source, not exercise-level defaults; no flattening supersets into duplicate counts. |

E01-E07 are the schema and executable evidence. No `weight_logs` DDL was found in tracked `*.sql` by repository search; the legacy component proves usage, not the deployed Supabase schema, RLS or completeness. No external database was queried.

## 3. Exercise Identity Verdict

Actual chain:

```text
Exercise.id + scoped stable_key
  -> TemplateExercise.source_exercise_id (nullable) + source_exercise_key
  -> AssignmentExercise.source_template_exercise_id + source_exercise_key_snapshot
  -> ExerciseLog.assignment_exercise_id -> SetLog
```

Catalog UUID is the appropriate future grouping identity. TemplateExercise row UUID, instanceKey, Set key, title and array position are NOT that identity. Builder draft replacement creates rows; subsequent revisions/Assignments have distinct instance-row identities even when the catalog Exercise remains the same (E05/E06).

`stable_key` uniqueness is system-wide only for system rows, and owner+key for trainer rows. System and trainer rows may share a key. `sourceExerciseKey` alone, or `(trainer,key)` with a system fallback, can therefore remain ambiguous. The fixture demonstrated two matching candidates without disabling constraints. An exercise-only historical lookup of the current catalog can also change after catalog maintenance. Hard delete is prohibited; general catalog metadata/key immutability is not established by that fact.

Legacy/unmapped cases are supported deliberately: null source UUID is retained, and old simplified templates use instance-derived source keys. Do NOT silently resolve titles. A key-only row stays `unmapped` unless a reviewed, durable provenance mapping proves exact identity. Today's unique match is insufficient historical evidence. Archive must not erase already-recorded facts, but archive alone does not resolve identity.

An exact join through the original immutable Published Template Exercise could recover its non-null source UUID for some rows. That is audit evidence, not a selected repair or permission to depend on Template reads. Unmapped originals remain unresolved. Neither a key/title guess nor an origin join is adopted here as the future Progress contract.

### Future Prerequisite: Stable Exercise Identity Hardening

Required end-to-end provenance:

```text
Exercise UUID
  -> Template
  -> Assignment snapshot
  -> Session/log evidence
```

The same stable Exercise UUID must be provable across different Assignments and Sessions, while Assignment/Session facts remain independent of later Template edits. No title/key guessing, positional matching or temporary TemplateExercise row ID as grouping identity. Unmapped legacy evidence must remain explicitly unmapped until provenance is proven.

This is a **future prerequisite only**. No migration, column layout, backfill procedure, schema/RLS change or implementation is designed or performed in this pass. Identity hardening alone is insufficient: strength-data eligibility and comparable execution semantics must also be reviewed before selecting a metric.

## 4. Metric Candidates

Ratings concern this repository and first MVP, not physiological validity in general.

| Candidate | Completeness / nulls | Clarity / trainer usefulness | Parity / evidence | Robustness / false precision | Cost / MVP decision |
| --- | --- | --- | --- | --- | --- |
| Max completed working-set weight per exercise/Session | Needs actual positive reps and weight; drops duration, null load, unmapped | Literal max is understandable; useful only with repetition/context evidence | One query possible only after grouping identity and shared scope are solved; winning Set IDs required | Warmup/partial status filter helps, but completed heavy single vs 8 reps is not comparable strength improvement; assisted/bodyweight load semantics unknown | Read-only possible eventually; identity is a blocker now. DEFER. |
| Top-set weight | No canonical designated top Set; could alias max or infer from position | Term sounds meaningful but inference would invent designation | Same identity gap | Do not infer top Set from last/heaviest/first row without a product definition | No stronger than max. DEFER. |
| Median completed working weight | Same missing data; even-sized median may not be an observed Set | Less obvious; changes when trainer adds light/back-off Sets | Evidence needs all contributing Sets; midpoint needs both middle Sets | Resistant to one outlier, sensitive to composition/duplicate instance/rep-range changes | More explanation without fixing identity. DEFER. |
| Volume `sum(weight*reps)` | Null is not zero; duration/bodyweight missing; whole-workout cross-exercise sums combine unlike work | Shows logged external tonnage, not strength or work in joules | Set traceability possible; repeated instances should count each unique Set once | A heavier low-rep session may have lower volume; adding Sets increases value without strength gain; equipment/assistance conventions absent | Only partial recorded volume unless missingness is exposed; not a simple trustworthy total. DEFER. |
| e1RM | Needs reliable loaded reps, exercise identity and comparable effort; none guaranteed | Model harder to explain; potentially useful after explicit protocol | Can trace selected Set but estimate is not a measured maximum | Rep threshold/formula/failure/RPE/load convention decisions; huge risk of labelling estimated strength as fact | Too many unresolved assumptions for one v1 metric. DEFER. |
| Completed workout count per week | Terminal status/ID/time are required; weight, duration, bodyweight and mapping irrelevant | Transparent count of closures; useful for discussing recorded cadence, not training success | Shared scoped query; all contributing Session IDs pageable | Insensitive to warmup/rep range/duplicate exercises; zero-result completion and splitting workouts increase count | REJECTED as first strength Progress metric. Possible future secondary `Тренировочная активность` only; not implemented in R3F. |

No strength candidate is selected. The completed-count candidate is classified as activity, not strength progress. No adherence/readiness/calories/quality/pain/AI/motivation score is selected as a fallback. Count must not become a target-compliance ratio.

## 5. Data Quality: Actual PostgreSQL Experiment

### Isolation And Method

Created a unique disposable database on the configured loopback PostgreSQL server. Applied only the repository's existing bootstrap/migrations there. Used existing Builder test-driver functions to save/publish, then existing Assignment, Start, Save and Complete services/repositories under app-role actor context. No ordinary local or external user data was read/seeded/modified. No tests, constraints, migrations or RLS were edited. All disposable databases were dropped, including the exploratory failed run.

Fixture: one synthetic trainer/athlete relation, foreign trainer; five Assignments, each five Exercise instances/eight Sets. Two instances share one catalog Exercise, three are intentionally unmapped; one duration and one bodyweight instance. Three Sessions record results, a fourth explicitly completes with zero results, a fifth remains active. Actual values are deterministic; generated UUIDs/times are not fixed. This is an edge-case cohort, NOT estimated real-user frequency.

| Terminal cohort measure | Observed |
| --- | --- |
| Sessions | 4 terminal: 1 completed, 3 completed_with_omissions; 1 active excluded |
| Set logs | 32: 21 completed, 10 incomplete, 1 skipped |
| Completed with actual weight | 14/21 = 66.67% |
| Completed with actual repetitions | 18/21 = 85.71% |
| Completed with null weight | 7/21 = 33.33% |
| Duration planned / completed with duration | 4/32 planned; 3/21 completed results |
| Warmup / working | 4/32 = 12.5%; 28/32 = 87.5% |
| Explicit zero-weight completed Sets | 1/21; not the same as the 7 null weights |
| Repeated same source key | Two instances per Session, including all 4 terminal Sessions |
| All Assignment exercise instances | 25; 4 keys; 10 have a catalog UUID on the original Template row, none have an Assignment UUID column |
| Same-key lookup after legal synthetic trainer catalog insert | 2 catalog candidates for one historical snapshot key |

Reproducible result recipe: main exercise four Sets: warmup 40x10; working (60+2.5*i)x8; working (62.5+2.5*i)x6; working null x8. Repeated instance: 65x3, then 70x1, then incomplete 100x3. Main null-weight Set becomes incomplete in Session 3. Bodyweight: null x10, zero x10, null x10. Hold: 30 seconds, null weight. Unmapped exercise: 20x12, skipped, 20x12. Remaining zero-result Session turns eight pending Sets into incomplete through Complete. Set overrides preserve a 6..8 planned range, warmup kind and load/rest differences. No assumption that completing a Set means meeting its range.

| Session | Max weight on matched-key working results | Median | Naive partial whole-workout volume | Epley max, 1..10 reps, matched key |
| --- | ---: | ---: | ---: | ---: |
| S1 | 65 | 62.5 | 1290 | 76.00 |
| S2 | 70 | 65 | 960 | 79.17 |
| S3 | 67.5 | 66.25 | 1165 | 82.33 |
| S4, zero result | null | null | null | null |

These are **candidate diagnostics, not proposed displayed metrics**. Max rises 65 -> 70 because 3 reps became 1; volume falls despite that max rise. Missing-load work is silently absent from the naive sum. Incomplete 100 kg does not win. Median 66.25 is not an observed Set. All four Sessions still truthfully count as completed workflow records. The fixture exposes divergent meanings, not a winner in strength improvement.

An exploratory script attempted ended -> active and correctly failed the existing relation transition guard. The final run placed measurements before end; no database guard was bypassed or fixed.

Local analysis evidence (temporary, outside repository): script basename `r3f-discovery.cjs`, SHA-256 `421c66a201100e4123ca3b0597e9cf2dfd161cd430079b19c8a9762af23a4b05`; final output `r3f-discovery-final.log`, SHA-256 `5daba5b4e264ee8cef0c251563337f83101604af09718783544f6d1f0e94fb91`. The recipe/results above are retained here; these temporary files are not a new test suite or deliverable.

## 6. Formula Comparison

Candidate-only notation: w = actual kg, r = actual repetitions; unique SetLog IDs. Planned values never fill missing actuals.

| Formula | Required caveats |
| --- | --- |
| Max weight: `max(w)` | Completed working Sets, non-null w, positive r; all repeated instances of the same proven exercise within a Session; return all tied source Set references through bounded evidence, not an arbitrary unlabelled winner. No duration Sets. Zero loaded weight could be a literal fact but not proof of zero resistance. |
| Median: `percentile_cont(0.5)` | Same eligibility; no fabricated Set for interpolated median; evidence must identify the middle pair/all contributing population. |
| Volume: `sum(w*r)` | Completed working, actual w/r non-null; distinguish zero from null; skipped/incomplete/duration excluded; all unique repeated-instance Sets included once. Missing inputs mean partial external-load volume, NOT complete workout volume. Body mass not inferred from weight_logs. Decimal kg retained. |
| Epley diagnostic: `w*(1+r/30)` | Illustrative estimate, not measured 1RM. Consider 1..10 reps only if separately approved; single-rep estimate differs from literal weight. |
| Brzycki diagnostic: `w/(1.0278-0.0278*r)` | Rounded published coefficients; often expressed approximately as `36*w/(37-r)`. Do not mix variants silently. Same 1..10 proposed threshold, not validation for arbitrary exercises/users. |

For example 100x5 gives Epley about 116.67 kg versus Brzycki about 112.51 kg. Neither is an observed maximum. A future e1RM proposal would require proven grouping, loaded repetition-only working Sets, w>0, 1<=r<=10, a defined near-failure protocol, exclusions for assistance/duration/null/skips/incomplete, best-estimate selection with deterministic tie handling, and the visible label `Расчётный 1ПМ`. Optional RPE alone does not establish that protocol. **Reject e1RM v1**, rather than claiming those decisions are accepted.

External formula context: [University of Pittsburgh primary research thesis, formula comparison](https://d-scholarship.pitt.edu/downloads/1783459d-701d-4643-abd9-7993c744c13c?locale=en). [Reynolds et al., 2006](https://pubmed.ncbi.nlm.nih.gov/16937972/) studied repetition-to-failure tests for bench/leg press, not this app's arbitrary training logs. Its repetition-range findings are not a blanket validation of app estimates. This supports caution; repository gaps determine the actual recommendation.

## 7. R3F-01 Review Decision

| Item | Final review disposition |
| --- | --- |
| Weekly completed-workout count as first Progress metric | **REJECTED** by founder: activity/consistency fact, not strength measurement; zero-result completions further prevent that interpretation. |
| Possible later use | Future secondary `Тренировочная активность` only; not implemented or scheduled in R3F. |
| First strength metric | **Not selected.** Honest strength progress has not yet been demonstrated. |
| Strength Progress status | **DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY.** |
| Other candidates | Keep comparison/diagnostics as evidence; do not select weight, volume or e1RM simply to unblock the stage. |
| Relation scope | **ACCEPTED** for every future shared trainer/client metric. Same explicit relation and Session population; no lifetime/overall athlete claim. |
| UTC week / eight-week activity UI | **Not accepted / withdrawn.** No weekly product contract fixed by this audit. |
| Suspended trainer Progress | **No new capability accepted.** Existing 0012 broad reads are a separate security concern. |
| R3F implementation | Deferred, not authorized. |
| R4 dependency | Core workout-feedback loop is complete; R4 may proceed independently. No R4 work in this task. |

The historical diagnostic formulas in section 6 are not approved production formulas or eligibility contracts. The count query's successful execution cannot convert an activity metric into strength progress. There is therefore no selected strength formula, rep threshold, minimum point count or production eligibility predicate in this revision.

## 8. Future Shared Read Requirements, Not A Selected Model

The earlier count-specific `AthleteProgressMetricReadModel`, weekly points, eight-week default, relation-selector defaults and source-pagination parameters are withdrawn as implementation specifications.

Retain only requirements for a future reviewed strength model:

- One neutral projection over canonical persisted facts, not separate trainer/client formulas or copied analytics data.
- Explicit `athleteUserId` and `relationId`, identical Session population for both authorized roles, declared formula/version and comparable input selection. Relation-scoped progress is not lifetime/overall athlete progress.
- Proven Exercise UUID lineage and exact source Session/Exercise/Set references for exercise-specific points; no grouping by title/key guess.
- Metric kind, unit, meaning, eligibility/exclusions and availability must be defined only after the prerequisites pass.
- Missing or ineligible data remains distinguishable from numeric zero. One observed result must not be extrapolated into a fake trend; the minimum number/comparability of points is still open.
- Source facts must remain navigable and permission-checked; a read must not mutate Session, Feedback, Attention or read-receipt state.
- Bounded reads, no full history cache or per-Session/exercise/set N+1. Exact budgets/cursors require the eventual metric and query.

No concrete API DTO, route parameters, count point formula, weekly bucket or selector behavior is accepted here. If a weekly metric is revisited, a **single canonical timezone contract** must first be defined for both roles. UTC is not the chosen user-facing week semantics; per-viewer browser timezone cannot independently determine buckets.

## 9. Authorization And Security Boundary

| Actor/state | Review constraint |
| --- | --- |
| Athlete, own data | Retains own historical data after relation suspension/end, subject to existing account/auth boundaries. This does not create a new Progress endpoint now. |
| Future authorized trainer/client pair | Explicit relation scope and identical authorized Session population are mandatory; neither role's broader access may silently change the formula population. |
| Foreign athlete/relation substitution | Must remain non-disclosing; context, cursor and relation ID are not authorization evidence. |
| Trainer after suspension/end | R3F grants **no new Progress access**. Bounded historical Review permission must not authorize Progress. |
| Existing suspended Profile policy | 0012 currently permits broad Profile reads. This is a separate security-hardening issue, NOT product permission for a new Progress capability. |
| New trainer / different relation | No inherited old-trainer Progress population; relation-scoped values cannot be presented as overall athlete history. |

**Measured audit evidence, not product authorization:** the four-source fixture's raw app RLS allowed the original trainer four Sessions for active/suspended/ended. `findSnapshot` allowed active/suspended, denied ended. Foreign trainer saw zero raw rows. With 5004 scale Sessions, the same suspended/ended distinction remained. These observations reveal the boundary problem; they do not authorize a Progress read by reusing raw Session SELECT or the broad suspended Profile predicate.

The former recommendation to mirror active/suspended Profile reading for a new Progress API is **rejected**. A future permission contract must be reviewed explicitly without using historical Review access or broad 0012 behavior as an implicit grant. No change to 0012, RLS or existing Profile behavior is made now. Authorization denial must never become a misleading smaller/zero metric.

## 10. Historical Performance Evidence And Future Cost

The earlier weekly-count SQL was a **diagnostic activity query**, not a selected strength query. Retain its measurement for audit reproducibility, not as an implementation budget or proof that future strength progress needs no index.

Existing indexes (E02): Session `(athlete_user_id,status,started_at DESC)` and trainer equivalent; child `(session_id,position)` / `(exercise_log_id,position)`; unique Assignment and Session IDs. No existing `(athlete,relation,completed_at,id)` index covers the previously explored weekly order/window. Bounded output does not imply bounded scan cost.

Historical research SQL: `bounds` plus `generate_series(0,7)`, UTC `date_trunc` grouping, exact athlete/relation/terminal/time predicates, count and `min(id::text)` representative evidence, LEFT JOIN to eight buckets. **UTC here describes the experiment only; it is not an accepted product timezone.**

Scale experiment: four command-created terminal Sessions plus 5000 synthetic imported-size zero-result terminal records, only in disposable DB following E14. Constraints/triggers stayed enabled. Scale records had no composition and therefore measured count query cost, not exercise analytics. `ANALYZE` ran only in that disposable database. Same asOf/actor-scoped SQL returned identical eight count buckets for active trainer and athlete: six zero weeks, 5000 in the preceding week and four in the current week.

EXPLAIN ANALYZE under athlete app RLS: **0.209 ms planning, 3.598 ms execution, 8 output rows** at 5004 terminal Sessions; Seq Scan + grouping/sort/join. Small four-Session count used the existing athlete index. These were local single-run measurements, not production p95. No mandatory new index was demonstrated for that activity query. They do not establish performance, index needs or completeness for a future strength metric.

Future requirements: bounded set-based source reads, no full Session composition/Feedback/Template download for overview, no all-history browser load and no per-point N+1. Re-measure the actual selected strength query under both authorized roles after identity/eligibility review. **API shape, numerical query budgets and migration/index needs are deferred.** No API/schema/index/migration is designed or changed now.

## 11. Legacy / Demo And Reuse Disposition

| Surface | Current disposition |
| --- | --- |
| `/client/progress` production redirect (E09) | Existing redirect remains unchanged. Future canonical route convergence is deferred with strength Progress, not replaced by weekly activity. |
| `/history` + Supabase workout_logs (E10) | KEEP VISUAL EVIDENCE; DO NOT REUSE DATA MODEL. Day grouping is not Session identity; null-to-zero tonnage and 300-log cap are unsuitable. No deletion/redirect here. |
| WeightTracker + weight_logs | KEEP VISUAL EVIDENCE; DEFER separate measurement system. Do not infer body mass/load semantics from this legacy source; deployed schema/RLS unknown. |
| Canonical Profile Progress (E08/E09) | Preserve current Header/tabs/body. Existing last-Session facts are not proof of a completed strength metric or a grant for new suspended reads. |
| R3E history/completed components | CANONICAL REUSE evidence: exact facts, safe detail and availability semantics; no edits or count-based replacement in this task. |
| demo-client-cabinet and trainer-os Progress/mock-data | KEEP VISUAL EVIDENCE; DO NOT REUSE generated e1RM, title series, Program scores or clamped growth as production facts. |
| ClientRuntimeProgress/selectors | DO NOT REUSE DATA MODEL: demo persistence, mixed kg/reps and consistency calculations. |
| Recharts / UI primitives | Available for future design, not selected for a metric that is currently blocked. |
| Achievements/title/reputation/photos/measurements | DEFER; untouched. |
| Completed-workout weekly count proposal | Retain audit evidence and possible future secondary `Тренировочная активность`; no R3F implementation. |

## 12. Decision Register After Founder Review

| ID | Evidence | Review status / decision | Remaining requirement / consequence |
| --- | --- | --- | --- |
| R3F-01 First metric | E01-E07; nulls, changed reps and zero-result fixture | **Weekly count REJECTED as first Progress; strength metric DEFERRED/BLOCKED** | Activity may be a future secondary feature. Do not select another metric artificially. |
| R3F-02 Exercise identity | E05/E06; key collision and missing Assignment UUID | **Future prerequisite recorded: Stable Exercise Identity Hardening** | Exercise UUID -> Template -> Assignment snapshot -> Session/log evidence. No title/key guessing; no migration design now. |
| R3F-03 Minimum points | Eligibility/comparability not yet established | **DEFERRED** | No accepted weekly or strength minimum. Do not make a trend from one point. |
| R3F-04 Exercise selection | Exercise-specific grouping blocked | **DEFERRED** | Neither most-data auto-selection nor a selector is accepted; old count-specific no-selector design withdrawn. |
| R3F-05 Visualization | No selected strength metric | **DEFERRED** | Weekly list/line/dots proposal is not an approved Progress screen. Preserve textual accessibility requirement. |
| R3F-06 Shared scope/model | E07/E08; different role visibility | **Explicit relation scope ACCEPTED** | Same Session population for both roles; never lifetime/overall athlete progress. Detailed model/selector defaults remain deferred. |
| R3F-07 Redirect | E09/E10 | **Implementation DEFERRED** | No route/body/redirect change now. Future canonicalization must not import legacy facts. |
| R3F-08 Authorization | E03/E08; suspended/ended raw visibility | **New suspended trainer Progress capability NOT ACCEPTED** | Athlete own access retained. Review permission not reusable; 0012 broad policy is separate security hardening. |
| R3F-09 Week/timezone | UTC was an activity experiment | **UTC week contract NOT ACCEPTED** | Any future weekly metric requires one canonical timezone contract shared by both roles; no independent browser bucketing. |
| R3F-10 Source return | E13; current return allowlists | **Implementation DEFERRED** | Future exact source traceability/return needed; R3E-03 and R2A.3 remain untouched. |

This register records the founder's supplied review decisions. The revised documents await review; it is not a new implementation approval.

## 13. Future Prerequisites And Independent R4

**R3F implementation is deferred.** Do not execute the earlier count-query -> API -> client/trainer UI sequence.

Before any future strength implementation:

1. Establish Stable Exercise Identity Hardening as the explicit end-to-end UUID provenance prerequisite from section 3. This task records the requirement, not its schema, migration or backfill design.
2. Prove data eligibility/comparability: actual load/reps/duration, bodyweight/assistance/load conventions, warmup/skipped/incomplete handling, repeated instances, changed rep ranges and nulls. A stable UUID alone does not prove strength improvement.
3. Re-review candidate formulas against eligible canonical evidence; select a strength metric only when quality is demonstrated. Do not use activity as a fallback to mark Progress done.
4. Design one neutral relation-scoped projection, permissions and source traceability. No implicit suspended/end access through Review or 0012.
5. If any weekly metric is later proposed, resolve one shared canonical timezone contract first. No accepted UTC default in this stage.
6. Only after separate product/architecture approval, plan bounded reads, API, client/trainer UX, measurements and regressions. No such implementation begins now.

**R4 may proceed independently because the core workout-feedback loop is complete.** R3F deferral does not reopen that completed loop or make strength analytics a new core-loop blocker. R4 is explicitly **not started in this task**.

## 14. Risks, Non-Goals And Scope Verification

- Honest strength-progress quality is unproven; this is a documented blocker, not a completed Progress feature.
- Canonical exercise identity and data eligibility are both prerequisites. Key/title guessing or swapping in another easy metric would hide, not resolve, the gap.
- Synthetic completeness ratios are not population statistics. The preserved experiment measured diagnostics and count performance, not validated strength change.
- Accepted relation scope must be explicit. Do not call a coaching-relation value lifetime/overall athlete progress or silently compare it with an all-relations client value.
- Existing 0012 suspended Profile reads remain a separate security-hardening question, not authorization for new Progress access.
- UTC/eight-week/count contracts are withdrawn. Future weekly semantics need one canonical timezone shared by both roles.
- No activity implementation, second metric, body measurement/photos, PR engine, achievements/rank/title, Motivation, AI, readiness/adherence, Program, reports or legacy cleanup.
- No schema/API/code changes were performed. No migration is designed now; the earlier experiment applied existing migrations only in disposable databases.

Only the two R3F documents are updated by this review pass. Baseline HEAD remains unchanged; production code/UI/routes/API/tests/schema/RLS/migrations and package/config files are untouched. No staging, commit or push. R3F implementation is deferred; R4 may proceed independently but is not started here.
