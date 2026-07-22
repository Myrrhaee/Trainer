# Client–Trainer Core Flow Integration v1

## 1. Scope

Stage 13 connects the accepted trainer workflow and canonical client demo routes through one frontend-only runtime. It proves assignment → execution → completion → review → feedback without API, PostgreSQL, Supabase, auth, remote writes, global redesign, route migration, or legacy deletion.

## 2. Before state

The audit found four independent canonical client demo state areas: Home scenarios, local Workout player/log state, static Activity, and static Progress. Legacy execution under `app/(client)/client/[id]` additionally holds component state, `localStorage`, Supabase reads/writes, and `/api/notify-complete`. Trainer Stage 12 had a separate provider scoped to `/trainer/*`. Assignment, session, history, progress, and feedback therefore did not cross roles.

## 3. Shared runtime architecture

`ProductDemoRuntimeProvider` now wraps the application in `app/layout.tsx`; `app/trainer/layout.tsx` is a transparent segment wrapper. Trainer and canonical `/client/*` adapters consume the same context during client-side navigation. Public/auth pages are visually unchanged and do not receive role-specific selectors. The implementation keeps the Stage 12 context API as a compatibility alias rather than introducing a production DI framework.

## 4. Actor model

The client actor is a development/demo query marker, `?actor=<stable-athlete-id>`. Commands require `ClientDemoActor.role === "client"` and actor ID equality with assignment/session athlete ID. Unknown actors and cross-athlete entity IDs fail closed. The marker is not production authorization, contains no email/PII, is preserved by canonical client links, and can reset on full reload. The shared profile seed supports Artem, Egor, Maria as the calm-path pilot actor, Ksenia as the paused/no-assignment state, Olga, and Alexandra by stable ID.

## 5. Canonical IDs

WorkoutTemplate revision → WorkoutAssignment uses `sourceTemplateRevisionId`; each assignment snapshot exercise receives `assignmentExerciseId`; each session is deterministically `session-<assignment-id>`; ExerciseLog and SetLog IDs include session and assignment-exercise identity; completion creates `attention-review-<session-id>`. No lookup uses athlete name or date.

## 6. Client selectors

`getClientActor`, `getClientHomeView`, `getClientWorkoutView`, `getClientHistoryView`, `getClientProgressView`, and `getClientActivityView` project role-specific views from `TrainerDemoState`. Requested unknown session/assignment IDs return explicit safe states rather than latest-record fallback.

## 7. Client commands

Implemented `StartWorkoutSession`, `ResumeWorkoutSession`, `SaveSetLog`, `UpdateSetLog`, `SkipExercise`, `SaveClientSessionComment`, `SetDiscomfortSignal`, and `CompleteWorkoutSession`. Commands validate actor/entity ownership, reject edits after completion, return typed receipts, preserve state on domain failure, and record PII-free pilot events. Start and completion are locally idempotent.

## 8. Client Home

`/client/me` derives five states: assignment ready, session in progress, completed awaiting feedback, feedback received, and no assignment. Primary actions are Start, Resume, View result, or View trainer feedback. No assignment produces an honest neutral state and no fabricated workout. The previous demo Home remains available only through `NEXT_PUBLIC_STAGE13_RUNTIME=false`.

## 9. Workout execution

`/client/workouts` is the temporary canonical execution route. It reuses the accepted dark client visual language and interaction hierarchy while replacing local facts with runtime adapters. It renders immutable assignment snapshot structure, general instruction, actual inputs, skip, comment, discomfort, completion summary, and history. Legacy `/today` and `app/(client)/*` remain untouched.

## 10. Session/log model

One active/resumable RuntimeWorkoutSession may exist per assignment. ExerciseLog points to a concrete assignment exercise instance; SetLog points to ExerciseLog/assignment exercise, retains warmup or working kind, plan, actual repetitions, actual weight, optional RPE/comment, and completion state. Results are not pre-marked completed.

## 11. Supersets

Assignment snapshots preserve optional superset ID, label, instruction, and ordered position from Builder items. Client execution renders 2–4 exercises inside one ordered block while keeping separate SetLogs. Timers and round semantics were not added.

## 12. Partial completion

Completion permits skipped exercises, incomplete sets, missing optional values, comment, and discomfort. The confirmation dialog lists completed/skipped exercises, missing/saved sets, comment, and original discomfort text. Zero-result completion is explicitly warned but remains possible. Runtime distinguishes completed from completed-with-omissions without defining a SQL enum.

## 13. Discomfort

The client stores original text plus optional area/severity. Completion projects the same original text to a safety-priority AttentionItem and Review signal. No diagnosis, treatment, or AI interpretation is created. Resolution does not remove the signal from session/history.

## 14. Completion transaction simulation

`CompleteWorkoutSession` atomically materializes Review plan-vs-actual, marks lifecycle status, keeps comments/signals, creates or reuses exactly one AttentionItem, adds one Team Activity completion event, records pilot events, and updates both role selectors. A repeated command returns the existing receipt and item.

## 15. Trainer Review integration

Dashboard receives runtime-created review/discomfort items without new seed data. Existing Review drawer/full page reads the same RuntimeWorkoutSession, assignment snapshot, ExerciseLogs, SetLogs, comment, and discomfort. Stage 12 feedback/resolution commands remain the only trainer mutation boundary.

## 16. Client Feedback

Detailed feedback, acknowledgement, and follow-up records are selected by athlete and WorkoutSession and appear on Client Home and Workout History. Follow-up remains a separate record. Manual resolution is absent from client selectors and never appears as a message.

## 17. History

Client History joins WorkoutAssignment, WorkoutSession, completion status, summary, feedback, and discomfort indicator. It distinguishes scheduled, in progress, completed, completed with omissions, and feedback received. WorkoutTemplate is not presented as a completed session.

## 18. Progress

Client Progress derives completion count, consistency prototype, best actual set, and strength trend from RuntimeWorkoutSession/SetLog. Bodyweight shows an empty state because the runtime has no measurement facts. Trainer Profile augments history, completed count, best result, and exercise trend from the same integrated sessions; no composite score was added.

## 19. Activity

Client Activity projects assignment, session, and feedback domain facts into a client-facing timeline. Team Activity remains a separate trainer projection over shared facts. Frontend pilot events stay internal; neither surface exposes manual resolution or raw audit events.

## 20. Cross-role consistency

Assignment: Client Home/Workouts and Trainer Profile/Quick Assign receipt. Session and SetLog: Client execution/history and Trainer Review/Profile. Discomfort: client completion/history and trainer Dashboard/Review. Feedback: client Home/history and trainer Review/Profile. Progress: both role-specific progress views derive integrated session/log facts.

## 21. Idempotency

Double start returns the existing session; double completion returns the existing receipt/AttentionItem; feedback retains Stage 12 initial-feedback protection; assignment ID remains deterministic; Review reopening is read-only. Playwright verifies one session and one review item after synchronous double actions.

## 22. Mobile

The `390×844` flow covers Quick Assign → Client Home → Workout → completion dialog → Dashboard → Review → feedback → Client Home. Document overflow is zero, fixed CTA remains above mobile navigation, set controls fit narrow width, supersets remain bounded, and no desktop-only action is required.

## 23. Accessibility

Core controls use buttons/links, labels, headings, list/region semantics, alerts/status, Radix dialog focus management, non-color status text, and keyboard-reachable actions. Automated role/name navigation completed without a trap. Manual screen-reader announcements, physical mobile keyboard occlusion, long-session focus order, and reduced-motion device review remain required before beta.

## 24. Files changed

Provider/runtime: root/trainer layouts and `components/trainer-os/demo-runtime/*`. Client runtime adapters: `components/client/runtime/*` and canonical `/client/me`, `/client/workouts`, `/client/progress`, `/client/activity`. Minimal trainer adapters: Profile demo-role link, Quick Assign client-view link, Profile runtime progress augmentation. Verification: `tests/e2e/client-trainer-core-flow.spec.ts`. Documentation: this file and the Stage 13 pilot report.

| Surface | Stage 13 treatment | Preservation status |
|---|---|---|
| Client Home | Runtime selector, role link, honest empty/error states | Existing route and visual language retained; larger legacy demo preserved behind the demo fallback |
| Client Workouts | Runtime selector and execution commands | Focused canonical adapter; existing large demo player remains a candidate for later reuse/redesign |
| Client Progress | Runtime selector and bodyweight empty state | Existing route retained; no deep redesign or synthetic chart facts |
| Client Activity | Domain-fact read model | Existing route retained; pilot/audit events are not exposed |
| Trainer Dashboard / Review | Existing selectors plus shared sessions/logs | Reused as-is; no structural redesign |
| Athlete Profile | Shared progress/history augmentation and demo client link | Minimal integration correction only |
| Quick Assign | Existing command plus client-view receipt link | Existing drawer and assignment UX reused as-is |
| Legacy client routes | None | Preserved unchanged and non-canonical for this flow |

## 25. Known limitations

Full reload resets runtime. Demo actor query is not auth. Runtime naming still carries Stage 12 `TrainerDemo*` compatibility names. Existing seeded Review sessions are normalized into runtime sessions but are not linked to new assignment rows. Bodyweight has no facts. Client execution is a focused integration adapter, while the larger visual demo player remains a later reuse/redesign candidate. No persistence, notifications, delivery/read receipts, concurrency, or multi-device continuity exists.

## 26. Acceptance criteria

Accepted for Stage 13: one root runtime serves both roles; assignment, one resumable session, SetLogs, partial completion, original discomfort, one review item, trainer Review, client feedback, shared history/progress, safe unknown states, mobile flow, and 14-test regression pass are demonstrated. Trainer hierarchy and client visual foundation are preserved. Backend/API/Supabase/PostgreSQL/migrations/auth remain unchanged.
