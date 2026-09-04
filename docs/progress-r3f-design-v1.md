# R3F-A: Shared Progress UX Design

Date: 2026-09-04
Status: founder review decisions recorded; R3F strength progress DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY; document revision awaiting review
Baseline: `ac7b67535ed7f45fb6b9d3b776ec14074917c350`
Branch: `codex/r3f-progress-metric`
Authority and evidence: [Architecture, E01-E14 and R3F decision register](progress-r3f-architecture-v1.md)

## 1. User Task And Design Verdict

The athlete's question is whether their strength is improving, not just whether completed workout records exist.

**R3F strength progress = DEFERRED / BLOCKED BY CANONICAL EXERCISE IDENTITY AND DATA ELIGIBILITY.**

An honest strength metric has not been demonstrated. Exercise-specific metrics remain blocked by stable identity and data eligibility. No alternative metric is selected artificially.

Founder review rejects **R3F-01: completed-workout weekly count as the first Progress metric**. The count includes completed Sessions without results and measures training activity / recorded consistency, not strength improvement. Retain it only as a possible future secondary metric named `Тренировочная активность`; do not implement it in R3F.

The old weekly-count screen hierarchy, eight-week window, UTC semantics, chronological count list, minimum-point rules and desktop/mobile wireframes are withdrawn as implementation specifications. There is no selected strength visualization or replacement screen in this revision.

Accepted boundary: a future shared trainer/client metric requires explicit relation scope and the same Session population for both authorized roles. A relation-scoped value must not be called lifetime/overall athlete progress.

No schema/API/code changes were performed. R3F implementation is deferred. **R4 may proceed independently because the core workout-feedback loop is complete**, but R4 is not started in this task. The revised documents await review; no commit is created.

## 2. Entry Points And Current Evidence

| Entry | Current implementation / evidence | Disposition |
| --- | --- | --- |
| `/client/progress` | Production redirects to Supabase `/history`; demo branches use separate datasets (E09-E12) | Preserve current behavior. Do not replace it with weekly activity in R3F. |
| Client Home/Workouts | Canonical Home/history and exact completed Session flows exist | Preserve existing core loop; no new Progress navigation in this task. |
| Athlete Profile -> Progress | Existing `/trainer/clients/{athleteId}?tab=progress`; canonical body shows last-Session facts (E08/E09) | Preserve R1 Header, URL tabs and body. Not evidence of implemented strength analytics. |
| Direct contextual Progress URL | No canonical shared Progress read contract | Future design deferred; URL context is never authorization evidence. |
| Source Session return | Client safe return allows Home/history; trainer command tab is Training (E13) | Record the gap; do not extend return helpers or command contracts now. |

No route, redirect, shell or Profile capability changes in this task. Prototype screenshots remain visual evidence, not production facts or a mandate to restore demo graphs.

## 3. Screen Hierarchy Disposition

No new Progress screen hierarchy is selected. The former hierarchy of headline count -> weekly list -> weekly source rows -> eight-week controls is withdrawn.

For a future separately approved strength design, retain these requirements only:

1. Preserve the existing role shell and trainer R1 Header/URL tabs.
2. State the coaching relation scope explicitly, with no implied lifetime total.
3. Name a proven metric, its unit and comparable evidence; do not use a generic score to conceal missing eligibility.
4. Distinguish unavailable/ineligible data from zero.
5. Provide exact, independently authorized source evidence and safe return.

Metric choice, selector/defaults, point count, chart/list format, date ranges and source pagination remain deferred until the identity and eligibility prerequisites pass. This is not a UI implementation backlog for R3F.

## 4. Client Progress Boundary

The athlete retains access to their own data, including historical data after suspension/end, within existing account/auth boundaries. R3F deferral neither removes that access nor creates a new analytics endpoint.

A future shared value must describe the selected relation's Session population. The athlete's broader access to other relations does not make a relation-scoped metric lifetime/overall progress. Relation selection and defaults are not selected here.

Existing completed Session detail and Feedback/history remain usable core-loop evidence; they must not be relabelled as proof of strength improvement. A Session completed with no results does not support a strength point merely because it has a terminal status.

The earlier desktop weekly-count wireframe is withdrawn. No replacement metric card, empty-state screen or UI text is implemented now.

## 5. Trainer Progress Boundary

Preserve athlete identity, computed R1 primary action, neutral/Attention entry context and existing tabs. Opening Progress or a source must not resolve Attention, send Feedback or mutate Session state.

**R3F grants no new trainer Progress access after suspension/end.** Bounded historical Review permission is not authorization for Progress. Athlete access to own data remains a separate boundary.

At baseline, the broad 0012 Profile policy allows active/suspended Profile reads while the query service rejects ended relations (E08). That existing behavior is a **separate security-hardening issue**, not a product permission to add a Progress read. The former recommendation to mirror the active/suspended Profile gate for new Progress is withdrawn.

Do not reuse `findSnapshot` or raw Session visibility as sufficient authority for a new metric. A future Progress permission contract needs explicit review. No current Profile policy or RLS is changed here.

## 6. Selection And Time Semantics

| Concern | Review disposition |
| --- | --- |
| Exercise-specific selection | Blocked by stable identity. Neither most-data auto-selection nor an exercise selector is adopted. |
| No exercise selector for count | Withdrawn with the rejected first-metric proposal. |
| Shared relation scope | Accepted requirement: both authorized roles use the same explicit relation and Session population. |
| Relation selector/default | Deferred. No primary/recent relation fallback, option limits or selector UX is fixed by this revision. |
| Period / eight-week controls | Withdrawn as an implementation contract; no default period selected. |
| UTC week | **Not accepted** as user-facing week semantics. |
| Future weekly metric | Open requirement: one canonical timezone contract shared by trainer/client; do not independently bucket by each browser's timezone. |

UTC used in the earlier SQL experiment describes that experiment only (architecture section 10). It is not a product decision. A future weekly activity proposal needs its own metric, timezone and UX review.

## 7. Visualization And Data Eligibility

No strength chart, chronological metric list, minimum point count, formula or success label is selected.

A stable Exercise UUID is necessary but insufficient: comparability also depends on actual load/reps/duration, repeated instances, changed rep ranges, warmup/skipped/incomplete handling, bodyweight/assistance conventions and missing inputs (E01-E06; architecture sections 2-6).

Future requirements:

- Null load is not zero; planned values must not replace missing actual results.
- Unknown exercise identity is not zero progress.
- One result does not justify an invented trend.
- Terminal Session status alone is not strength eligibility.
- Do not claim strength growth from a larger load with fewer repetitions without a validated comparison rule.
- Textual equivalents and exact source references are required for any future visualization.

The previous count-specific zero/one/two-week comparison rules, list choice and unfinished-week headline are withdrawn. They do not establish strength eligibility or an approved secondary activity design.

## 8. State Requirements For Future Review

These are constraints for a future reviewed metric, not new R3F screen states or capabilities.

| Condition | Required distinction / disposition |
| --- | --- |
| No completed Sessions in explicit scope | Scoped absence of evidence, not a lifetime claim or fabricated trend. |
| Completed Sessions with no results | No inferred strength point. The rejected activity count could include them; strength eligibility is unproven. |
| Nullable load, duration/bodyweight, incomplete/skipped results | Do not substitute zero or planned values; eligibility remains a prerequisite. |
| Unmapped or ambiguous exercise | Identity blocker, not title/key matching or a smaller hidden population. |
| One comparable result | No invented trend; metric minimum remains open. |
| Missing/foreign relation | Non-disclosing unavailable state; context does not establish ownership. |
| Athlete after suspension/end | Retain own data access; no new endpoint implied. |
| Trainer after suspension/end | No new Progress capability; do not fall back to historical Review permission or broad 0012 reads. |
| Loading/error/refresh failure | Never report failure as zero strength or no training; distinguish availability from eligibility. |
| Source unavailable | Do not invent/copy a Session or substitute another athlete/relation. |
| Long evidence population | Bounded set-based reads; exact budgets/pagination depend on the eventual metric. |

No activity-specific bucket, source-cursor or partial-week state is accepted. No R3F implementation or browser QA is claimed.

## 9. Future Prerequisite: Stable Exercise Identity Hardening

Required canonical provenance:

```text
Exercise UUID
  -> Template
  -> Assignment snapshot
  -> Session/log evidence
```

Current evidence (E05/E06): Template Exercise can retain a nullable catalog UUID; Assignment Exercise copies a source key, not that UUID. Legal same-key catalog collisions and unmapped sources prevent key/title inference from proving historical identity.

Future strength points must have provable UUID lineage and exact contributing Session/Exercise/Set evidence. Existing immutable origin links are audit evidence, not an already accepted identity repair. No title/key guessing.

**Only the prerequisite is recorded. No migration, column, schema, backfill or recovery design is proposed here.** Data eligibility requires separate proof even after identity hardening.

Existing exact client completed Session and trainer Review routes remain independently authorized source surfaces. Their existence does not select a Progress source-list DTO, pagination or return contract.

## 10. Navigation, Return And Refresh

The former weekly parameters, UTC Monday validation, eight-week windows, selected-week anchors and source cursor contract are withdrawn.

Preserve existing navigation as implemented:

- R3E history append/replay and completed Session detail remain unchanged.
- R2A.3 command transition/receipt/Next Item remains unchanged.
- `safeClientReturn` currently accepts Home/history, not Progress; trainer command tab is `training` (E13). These are evidence gaps, not shipped Progress return behavior.
- Do not forge `tab=progress` command context, treat return intent as authorization or expand existing allowlists now.

Any future approved metric must define validated read-return context, semantic source focus, canonical rereads and stale/error handling without localStorage/sessionStorage as a metric/history data cache. Navigation state must not contain workout/Feedback contents. Concrete parameters, refresh/asOf semantics and fallback behavior remain deferred.

## 11. Desktop, Mobile And Reflow

The former 1440x1024 desktop and 390x844 mobile weekly-count wireframes are withdrawn; no replacement screen is selected while strength Progress is blocked.

Retain future QA requirements only: both viewports, 200% zoom/reflow, readable wrapping, stable controls, visible focus and no overlapping sticky elements. Preserve existing compact Profile Header behavior. Do not squeeze a metric with unproven meaning into a decorative card or generate mock graphs for visual completeness.

No UI, screenshots or browser quality gate are produced by this document revision.

## 12. Accessibility Requirements For Future Design

- Metric meaning, unit, scope and source availability must be available as text; no graph-only or color-only conclusion.
- Keyboard-operable controls and exact source links; safe semantic focus restoration after return.
- Loading/error announcements must distinguish fetch failure from empty/ineligible data.
- Respect reduced motion and preserve readable text/reflow and contrast.
- Do not use hidden labels or tooltips to disguise activity as strength.

Specific controls, week labels and chart/list accessibility implementation remain deferred with the metric.

## 13. Keep / Defer / Do Not Reuse

| Treatment | Elements / component map |
| --- | --- |
| KEEP UNCHANGED | R1 Header, identity/context, primary action, URL tabs and current Progress body; client routes; R3E history/completed/Feedback flow. |
| FUTURE CANONICAL EVIDENCE | Exact Assignment/Session/log IDs, source detail and availability handling, safe navigation patterns. No current helper is blanket authorization for new Progress. |
| DEFER | Strength metric, read model/API, selector, formula, visualization, client/trainer route convergence, Progress return implementation. |
| FUTURE SECONDARY ONLY | `Тренировочная активность`: completed-workout weekly count, not strength. No R3F implementation. |
| DO NOT REUSE AS PRODUCTION FACTS | Title-keyed demo series, runtime mixed kg/reps, generated e1RM/clamped growth, Program scores and legacy null-to-zero tonnage (E10-E12). |
| SEPARATE SECURITY HARDENING | Broad 0012 suspended Profile reads; not product approval for new Progress access. |
| NO CHANGE | Existing UI primitives/charts, prototype files, body measurement/photos, achievements/title/reputation, Motivation and Program. No cleanup/deletion. |

## 14. Review Acceptance And Remaining Decisions

This revision records the founder's decisions, not a request to accept the rejected count/UTC/suspended-capability proposals again.

- R3F-01 weekly count rejected as first Progress; classified as future secondary activity.
- Honest strength metric not demonstrated; exercise-specific metrics blocked by stable identity and eligibility.
- Explicit relation scope accepted; never lifetime/overall athlete progress.
- UTC week contract not accepted; one shared canonical timezone remains an open requirement for any future weekly metric.
- No new suspended/ended trainer Progress capability; athlete own access preserved; 0012 separated from product permission.
- Stable Exercise Identity Hardening recorded as a future prerequisite, without migration design or title/key guessing.
- No replacement metric, count-specific screen, formula, eight-week window or implementation sequence approved.
- Future open decisions: identity provenance, eligibility/comparability, then a demonstrable strength metric, explicit permissions, read cost and UX. None is silently resolved here.
- R3F implementation deferred. R4 may proceed independently because the core workout-feedback loop is complete; R4 is not started in this task.

Only the architecture/design documents are revised. **No schema/API/code changes were performed**; UI/routes/tests/RLS/migrations/configuration remain untouched. No staging, commit or push. Revised documents await review.
