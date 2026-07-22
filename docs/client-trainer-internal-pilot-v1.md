# Client–Trainer Internal Pilot v1

## 1. Purpose

Verify as an internal expert walkthrough that accepted trainer and client surfaces form one coherent frontend demo loop. This is not user research and makes no usability claim beyond the tested build.

## 2. Method

The pilot used a production-built local application, desktop `1440×1000`, mobile `390×844`, Playwright role/name interactions, runtime-ID assertions, console/error checks, overflow measurements, and a no-remote-write assertion. Existing Stage 12 tests were rerun as regression coverage.

## 3. Scenarios

1. Maria: trainer assignment, full client execution, completion, Review, feedback, client receipt.
2. Egor: one saved set, skipped exercise, comment, partial completion, feedback.
3. Olga: original discomfort text, safety item, careful feedback, retained history.
4. Maria: leave active session, return through Home, resume same session/set.
5. Maria: double start and double completion idempotency.
6. Unknown/cross-athlete IDs and mobile full role loop.

## 4. Step counts

| Scenario | Primary actions | Result |
| --- | ---: | --- |
| Full loop | 22 | completed; one assignment/session/item/feedback |
| Partial | 17 | completed with omissions and comment |
| Discomfort | 19 | original text retained across roles |
| Resume | 10 | same session ID and saved set |
| Idempotency | 11 | no duplicate session/item |
| Mobile loop | 20 | completed; zero horizontal overflow |

Counts exclude passive assertions and scrolling.

## 5. Findings

- Root provider placement is sufficient for cross-role client-side transitions.
- Completion-to-Review is the critical integration boundary and now uses one session fact.
- The existing client visual language supports a focused runtime player without a global redesign.
- Partial completion needs explicit summary; silent omission would be unsafe and confusing.
- Trainer-to-client context is clearest through receipt/profile links, not a production-style account switcher.
- Progress must show honest empty states when measurement facts do not exist.

## 6. P0/P1/P2/P3

| Priority | Finding |
| --- | --- |
| P0 | None in the frontend pilot. |
| P1 | Production persistence, auth/authorization, transactional commands, idempotency storage, RLS, audit, and delivery are absent and block beta. |
| P1 | Full reload resets cross-role facts and active-session continuity by design. |
| P2 | Manual screen reader and mobile virtual-keyboard verification remains outstanding. |
| P2 | Focused runtime workout UI should be tested with athletes before replacing or extracting more of the large demo player. |
| P2 | Existing seeded historical sessions and new assignment-backed sessions need a canonical repository migration policy. |
| P3 | Compatibility names still say `TrainerDemoRuntime`; rename only with a later contained refactor. |
| P3 | Development Playwright emits the existing `NO_COLOR`/`FORCE_COLOR` process warning. |

## 7. Cross-role consistency findings

The final walkthrough showed the same assignment ID on receipt/client, the same deterministic session ID on client/Review, the same SetLog totals in completion/Review, the exact original discomfort string in both roles, and the same feedback record in Review/Profile/Client Home. Manual resolution is excluded from client projections. Unknown IDs did not expose another athlete.

## 8. Mobile findings

At `390×844`, Client Home, exercise/set inputs, skip, comment, discomfort, completion summary, trainer queue, Review feedback, and returned client feedback remained operable. Primary CTA and dialog actions were visible, bottom navigation did not cover them, and measured horizontal overflow was zero. Superset metadata remained within the viewport.

## 9. Accessibility findings

Automated keyboard-oriented locators found semantic navigation, labelled inputs, buttons, dialog title/description, alerts, status regions, headings, ordered activity, and non-color labels. Radix restored modal focus in automated flow. Screen reader phrasing, physical virtual-keyboard occlusion, touch target sampling on devices, and complete Shift+Tab order require manual verification.

## 10. Beta blockers

Canonical PostgreSQL schema/migrations, staging identity, actor capabilities, trainer-athlete relation checks, RLS negative tests, durable assignment/session/log/attention/feedback storage, atomic completion and feedback transactions, durable idempotency, audit, and safe notification delivery remain blockers. Existing unsafe/unknown legacy API and database findings from prior stages remain unchanged.

## 11. Deferred backend requirements

Implement provider-neutral repositories and server commands for assignment snapshots, one-active-session invariant, ExerciseLog/SetLog writes, partial completion, discomfort original text, completion-plus-review-item transaction, feedback-plus-resolution transaction, progress projections, delivery/read events, conflict handling, and audit. Supabase remains an adapter to canonical PostgreSQL contracts rather than a UI dependency.

## 12. Recommendations

Use this vertical slice as the staging acceptance contract. Next, implement backend boundaries in the same order as the demonstrated loop, add negative authorization/idempotency tests before real data, run a manual assistive-technology pass, and conduct a moderated athlete/trainer pilot measuring completion time, terminology, and perceived continuity across roles.
