# Core Workflow V1

Дата: 2026-07-10

Статус: accepted Stage 2 workflow with explicitly listed open research decisions

Scope boundary: documentation only; UI, routes, API and schema are unchanged.

## Evidence labels

- **Accepted product decision** - зафиксировано в `docs/decision-log.md` со статусом `accepted`.
- **Current code evidence** - подтверждено реальным маршрутом, компонентом, API или migration.
- **Current prototype behavior** - существует в demo/mock/local state, но не является production contract.
- **Proposed product decision** - рекомендация этого документа; требует Product Lead review.
- **Open question** - данных недостаточно или требуется исследование пользователей.

## A. Scope

### Что входит

Вертикальный сценарий начинается с сохранённого `WorkoutTemplate` и заканчивается тогда, когда trainer feedback доступен клиенту, review `AttentionItem` разрешён, а завершённая сессия отображается в общей истории и базовом прогрессе. Builder может создать новый template в этом сценарии, но `WorkoutAssignment` первого MVP всегда создаётся из уже сохранённого template.

```text
Trainer creates or selects WorkoutTemplate
-> creates WorkoutAssignment
-> client sees assignment
-> client starts WorkoutSession
-> client records results
-> client completes WorkoutSession
-> system creates review AttentionItem
-> trainer opens review
-> trainer sends feedback
-> trainer optionally assigns next action
-> AttentionItem is resolved
-> client sees feedback
-> history and progress are updated
```

Это accepted core workflow: `docs/decision-log.md` D-027. Каждая успешно завершённая назначенная тренировка создаёт не более одного review `AttentionItem`: D-036 и D-042. Assignment snapshot и одна resumable session зафиксированы в D-040 и D-041.

### Что сознательно не входит

- full multi-week `Program` и `ProgramAssignment` engine;
- autonomous AI prescription или автоматическое изменение нагрузки;
- advanced priority scoring, snooze rules и anomaly-only review;
- медицинская диагностика;
- payments, sales, reports, achievements и внешние messenger threads как source of truth;
- standalone client workflow без тренера.

Границы подтверждены `docs/non-goals-v1.md:20-30` и решениями D-020, D-028, D-032, D-035, D-039.

### Участники

- **Trainer** - создаёт тренировочную структуру, назначает, разбирает факт, отправляет feedback и выбирает следующий шаг.
- **Client** - видит назначение, выполняет тренировку, фиксирует факт и субъективный контекст.
- **System** - сохраняет состояния, создаёт review item, обеспечивает консистентность и доступ обеих сторон.
- **Optional AI assistant** - готовит проверяемую сводку и редактируемый draft, но не выполняет критические действия без trainer confirmation.

### Systems of record

| Information | Target source of truth | Notes |
| --- | --- | --- |
| Exercise identity | `Exercise` | Existing `exercise_library` is a candidate source; current code evidence: `supabase/migrations/20260402120000_exercise_library.sql:1-76`. |
| Reusable prescription | `WorkoutTemplate` plus immutable/versioned content | Current `trainer_builder_templates.exercises` JSON is implementation evidence, not accepted schema. |
| Concrete client task | Independent `WorkoutAssignment` snapshot created from a saved `WorkoutTemplate` | Template changes never mutate an existing assignment. Before session start the assignment can be edited; after start structural edits are forbidden in the normal flow. Current builder stores assignment only in localStorage at `app/trainer/builder/page.tsx:1557-1569`. |
| Concrete execution | `WorkoutSession` | Missing as a canonical persisted entity in current migrations. |
| Set/exercise facts | `WorkoutLog` linked to session | Legacy execution writes `workout_logs`, but not through a canonical session contract: `app/(client)/client/[id]/page.tsx:534-553`. |
| Trainer response | `TrainerFeedback` linked to session and author | Existing `trainer_workout_reviews` is date-based and can inform migration, but is not sufficient as final contract. |
| Trainer work queue | `AttentionItem` linked to source session | No persisted model exists now; accepted central MVP entity D-024. |

## B. Actor responsibilities

| Actor | Human decisions | Automatic/system actions | Must not happen automatically |
| --- | --- | --- | --- |
| Trainer | Template contents; assignment target/date; final feedback; next workout; manual close reason | Draft recovery and validation can assist | Sending feedback, changing load, assigning next workout, or closing a disputed item without confirmation |
| Client | Start/resume; actual reps/weight; skipped work; comments; completion confirmation | Autosave and resume can run automatically | Inventing missing results or silently marking incomplete work completed |
| System | None | Persist commands; enforce permissions; create one item per completed assigned session; derive summaries; expose consistent views | Infer medical diagnosis, discard logs after partial failure, or produce duplicate lifecycle records |
| Optional AI | None | Produce factual summary, traceable highlights and editable draft | Send, prescribe, diagnose, close or mutate template/assignment/session autonomously |

## C. Happy path

| # | Actor | Trigger | Command/action | System response | Entity change | Next conceptual state | Interface | User-visible confirmation | Analytics event |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Trainer | Client needs work | Create and save, or select, a valid template | Persist/load the saved template and preserve trainer context | `WorkoutTemplate` created or selected | template `draft` -> `ready`, or existing `ready` | Templates/builder; client profile entry | Saved/selected template and exercise count | `trainer_template_created` or `trainer_template_selected` |
| 2 | Trainer | Saved template ready | Choose linked client, date and optional note; confirm assignment | Validate relationship and create an independent snapshot from the saved template | `WorkoutAssignment` created | assignment `scheduled/available` | Quick assign or Save and Assign | Client/date/workout confirmation | `trainer_assignment_created` |
| 3 | Client | Assignment becomes available | Open client home/workouts | Return exact assignment and trainer note | No required mutation; optional viewed timestamp | assignment remains available | `/client/me` or `/client/workouts` | Workout card with status/date | `client_assignment_opened` |
| 4 | Client | Opens workout | Start or resume session | Create the assignment's only active/resumable session, or return the existing one | `WorkoutSession` created/updated | session `not_started` -> `in_progress`; assignment `available` -> `in_progress` | Client workout execution | Resume-safe progress state | `client_session_started` |
| 5 | Client | Performs sets | Record actual set/exercise data and comments | Validate and persist incrementally | `WorkoutLog` created/updated | session remains `in_progress` | Client workout execution | Saved/autosaved state | `client_workout_log_saved` |
| 6 | Client | Ready to finish | Confirm completion under the minimum criteria selected before backend implementation | Atomically finalize session and return the same result for a repeated completion command | `WorkoutSession` completed | session `in_progress` -> `completed`; assignment -> `completed` | Completion sheet | “Тренировка завершена” and pending trainer review | `client_session_completed` |
| 7 | System | First successful completion transition | Create review task | Create exactly one source-linked item owned by trainer | `AttentionItem` created | item `open` | Trainer dashboard queue | Queue count changes; client sees “отправлено тренеру” | internal lifecycle event; no duplicate analytics |
| 8 | Trainer | Opens queue or deep link | Open review item | Load the shared review read model: item, session, assignment snapshot, logs and comments | No required state change from opening alone | item remains `open` | Dashboard -> quick drawer or canonical full page | Exact client/session context | `trainer_attention_item_viewed`, `trainer_session_review_opened` |
| 9 | Trainer | Starts feedback, acknowledgement or resolution flow | Write/edit detailed feedback or short acknowledgement; explicitly send | Mark substantive work as `in_progress`; persist TrainerFeedback before resolving | `TrainerFeedback` created | item `open` -> `in_progress`; feedback `draft` -> `sent/available` | Review UI | “Feedback сохранён и доступен клиенту” | `trainer_feedback_sent` |
| 10 | Trainer | Optional next step | Assign next workout or choose no next action | Create independent next assignment if requested | Optional `WorkoutAssignment` created | next assignment `scheduled/available` | Review -> quick assign | Assignment confirmation or “следующий шаг не нужен” | `trainer_next_step_assigned` when applicable |
| 11 | System/trainer | TrainerFeedback saved or manual resolution confirmed with reason | Resolve item with detailed feedback, short acknowledgement or manual reason | Persist resolution and timestamp; client read receipt remains independent | `AttentionItem` updated | item -> `resolved` | Review or queue | Item leaves active queue; next item offered | `trainer_attention_item_closed` |
| 12 | Client | Feedback becomes available | Open home/history/session detail | Read same persisted feedback | Optional read receipt | feedback remains sent/read | `/client/me`, client history/workouts | Feedback with trainer/time/session link | future `client_feedback_viewed` candidate |
| 13 | System | Session/log/feedback committed | Recompute or query history/progress | Expose one shared dataset to client and trainer views | Derived read models updated | n/a | Client history/progress; trainer profile | Same completed session and metrics on both sides | derived analytics only |

## D. State model

The labels below are conceptual. They are not accepted enum names or a schema prescription.

| Entity | Minimal conceptual states | Required transitions | Notes |
| --- | --- | --- | --- |
| WorkoutTemplate | `draft`, `ready`, `archived` | draft -> ready; ready -> archived; ready -> new edited version | Assignment is created only from a saved template and receives an independent snapshot. |
| WorkoutAssignment | `scheduled/available`, `in_progress`, `completed`, `cancelled` | available -> in_progress -> completed; available -> cancelled | Editable before session start. After session start structural edits are forbidden in the normal flow. Template edits never propagate to it. |
| WorkoutSession | `not_started`, `in_progress`, `completed` plus non-review `abandoned` later | not_started -> in_progress -> completed | At most one active/resumable session per assignment. Repeat performance requires a new assignment. |
| TrainerFeedback | `draft`, `sent/available`; optional transport failure metadata | draft -> sent | Detailed feedback and short acknowledgement are feedback kinds. Sent feedback is not silently edited; corrections are follow-up feedback. |
| AttentionItem | `open`, `in_progress`, `resolved` | open -> in_progress -> resolved; open -> resolved for a valid manual resolution | Opening a surface alone does not require `in_progress`; substantive trainer action does. |

## E. Alternative paths

| Scenario | Required behavior | Status |
| --- | --- | --- |
| Trainer has no template | Offer “Create template” with return context `{clientId, intendedDate}`; save it before creating assignment | Accepted product decision |
| Assign from client profile | Open quick assign with fixed client context; after success return to the training tab and show assignment | Current prototype entry exists at `components/trainer-os/client-profile/training-tab.tsx`; persistence missing |
| Assign from dashboard | Open quick assign from exact AttentionItem/client; preserve queue item and next-item position | Current prototype behavior in `TrainerHomePage`; actions only mutate local state at `components/trainer-os/home/trainer-home-page.tsx:118-149` |
| Client does not start / missed workout | Assignment remains available or is handled outside this lifecycle; no review AttentionItem in first MVP | Accepted product decision |
| Client starts but abandons | Autosaved session remains resumable/abandoned; no review AttentionItem in first MVP | Accepted product decision |
| Exercise skipped | Save explicit skipped state and optional reason; do not synthesize zero reps; show in review as deviation | Proposed product decision |
| Client changes weight/reps | Store actual values alongside immutable planned snapshot; highlight difference without marking it inherently bad | Accepted principle: shared training reality; proposed review behavior |
| Client adds comment | Persist overall and, if supported, exercise-level comments linked to session/log | Current prototypes show both forms; final field shape open |
| Discomfort or pain | Preserve the original signal/comment, show it explicitly, never diagnose or hide it in AI summary; sort these items before other reviews | Accepted product decision |
| Client completes twice | Return the existing completed session and review item; create no duplicates | Accepted product decision |
| Repeat workout | Create a new WorkoutAssignment; do not create a second session under the completed assignment | Accepted product decision |
| Short acknowledgement | Persist an explicit short-acknowledgement kind of TrainerFeedback, expose it to the client, then resolve the item | Accepted product decision |
| Assign next workout | Create a new assignment after feedback if desired; it is optional for review resolution | Accepted product decision |
| Close without next assignment | Persist detailed feedback, short acknowledgement, or manual resolution with reason; resolve without creating assignment | Accepted product decision |
| Feedback save fails | Keep text locally in UI, keep item active, show retry; do not claim client access | Proposed error rule |
| Notification fails after feedback save | Feedback remains source of truth and item may resolve; show non-blocking delivery warning/retry | Accepted source-of-truth principle D-037; proposed UX behavior |
| Assignment changed | Before session start, edit the assignment snapshot explicitly. After session start, structural edits are forbidden in the normal flow | Accepted product decision |
| Sent feedback needs correction | Create follow-up TrainerFeedback; do not silently mutate the already sent record | Accepted product decision |

## F. Screen and transition map

| From | To | Trigger | Preserved context | Return behavior |
| --- | --- | --- | --- | --- |
| `/trainer/dashboard` | review drawer or `/trainer/review/[workoutId]` | Open review AttentionItem | item id, session id, client id, queue filter/order | Return to same queue position or open next item |
| `/trainer/dashboard` | quick assign | Client needs next workout | client id, source item id, queue position | Return to queue with success state; resolve only under explicit rule |
| `/trainer/clients/[clientId]` | quick assign | “Назначить” in training tab | client id, active tab | Return to same profile tab and refresh assignments |
| `/trainer/clients/[clientId]` | template builder | No suitable template / open builder | client id and assignment intent | “Save and Assign” returns to profile; “Save Template” keeps client context optional |
| Templates/builder | quick assign or assignment confirmation | Save and Assign | template id/version, client id if known | Return to originating profile/dashboard or templates list |
| Review | client profile | Open client | client id, source review id | Browser back/deep return restores review context |
| Review | quick assign | Assign next workout | client id, source session/item | Return to review completion state, then queue/next item |
| `/client/me` or `/client/workouts` | client workout | Open assignment | assignment id | Back returns to same card/status |
| Client workout | `/client/workouts` history/detail | Complete | session id and completion receipt | Completed session visible immediately |
| `/client/me` or history | feedback/session detail | Open trainer feedback | session id, feedback id | Return to previous client surface |
| Client/trainer history | progress | Open related trend | client id, optional metric/exercise | Return to history/session detail |

Canonical route decisions are D-011, D-014 and D-015. Current execution still lives partly in legacy `app/(client)/*`, which is explicitly not the target route family (D-016).

## G. Data flow

| Step | Input | Persisted data | Derived data | Source of truth | Consumers |
| --- | --- | --- | --- | --- | --- |
| Template save | name, exercises, prescription, notes, blocks | Template content, owner, version/timestamps | exercise count, estimated metadata | WorkoutTemplate | Templates, builder, assignment UI |
| Assignment | saved template version/content, trainer, client, date, note | Independent immutable prescribed snapshot plus assignment metadata | availability label | WorkoutAssignment | Client home/workouts, trainer profile/dashboard |
| Session start | assignment id, client identity | session id, started time, status | completion progress | WorkoutSession | Client execution, trainer status |
| Log save | session id, exercise/set identity, actual fields | WorkoutLog | totals, deviations, estimated metrics | WorkoutLog | Client resume/history, trainer review/progress |
| Completion | session id, overall comment, optional RPE/feeling | completed time/status and final client context | duration, planned-vs-actual summary | WorkoutSession + logs | Attention creation, review, history |
| Attention creation | completion event + session id | item owner/type/source/status/timestamps | title/summary/action label | AttentionItem | Dashboard, profile, review entry |
| Feedback | item/session id, trainer text, mode | author, content, sent time, session link | preview/read status | TrainerFeedback | Client home/history, trainer audit |
| Resolution | item id, result type, reason, feedback/assignment links | resolution and resolved time | queue counts | AttentionItem | Dashboard, audit/history |
| Progress | completed sessions/logs | Prefer no duplicate write for simple metrics | trends, PRs, adherence | Session/Log plus explicit body measurements | Client and trainer progress views |

## H. Idempotency and consistency requirements

1. **Session completion:** one authoritative completion command per session. Repeating it returns the same completed session and does not repeat side effects.
2. **Attention creation:** deterministic uniqueness by `(type, source entity id)` or equivalent invariant. A completion retry reads the existing item.
3. **Feedback:** explicit client-generated command/idempotency key prevents duplicate visible messages. A sent record is immutable in the normal MVP flow; correction creates linked follow-up feedback.
4. **Incremental logs:** every log write is tied to session plus stable exercise/set identity. Failed partial writes remain retryable; completion verifies that persisted data matches the client summary.
5. **Template isolation:** assignment owns a snapshot created from a saved template. Template edits affect future assignments only. Before session start the assignment can be edited explicitly; after start structural edits are forbidden in the normal flow.
6. **Cross-role consistency:** client and trainer read the same session/log/feedback identifiers. Different presentation is allowed; duplicated mock domain models are not.
7. **Atomic lifecycle boundary:** successful completion and item creation must be transactionally coupled or supported by a durable retry/outbox mechanism. “Completed but never queued” is not acceptable.
8. **Concurrency:** if another tab resolves an item, stale review UI refreshes and shows the persisted result instead of overwriting it.
9. **Notification separation:** in-product persistence succeeds independently of email/Telegram/push delivery. Delivery retries do not duplicate feedback.

These are requirements, not a database design.

## I. Acceptance criteria: vertical slice Definition of Done

- Trainer can create and save, or select, a valid WorkoutTemplate without creating a Program.
- Trainer can create an assignment only from a saved template; the client sees its independent prescribed snapshot.
- Assignment edits are allowed before session start, while structural edits are blocked after start.
- Client can start, refresh/resume, record actual results/comments and complete the assignment's only active/resumable session without data loss.
- Repeating a completed workout requires a new assignment.
- Completion is idempotent and creates exactly one open review AttentionItem.
- Missed workouts and abandoned sessions create no review AttentionItem in the first lifecycle.
- Trainer can open the exact source session from dashboard or athlete profile.
- Review shows planned versus actual data, skips and client comments from the same persisted session.
- Trainer can send detailed feedback or a short-acknowledgement kind of TrainerFeedback; client can read either inside the product.
- Trainer can optionally assign a next workout or explicitly choose no next assignment.
- Successful feedback persistence automatically resolves the item; manual resolution requires a stored reason.
- Sent feedback is not silently editable; corrections are additional follow-up feedback.
- Client read receipt does not affect item resolution.
- Discomfort/pain signals are preserved, shown explicitly and placed before other items in deterministic queue order.
- Completed session and feedback appear in client history; base metrics use the same logs in trainer/client views.
- Permissions prevent cross-client access and demo data is not used in production paths.
- Every command has clear loading, success, empty, stale and retry states.
- Minimum analytics events in `docs/mvp-scope-v1.md:196-212` are emitted once per logical action.

## J. Current implementation mapping

| Workflow step | Existing route/component | Current status | Reusable | Missing | Redesign required | Backend gap |
| --- | --- | --- | --- | --- | --- | --- |
| See queue | `/trainer/dashboard`, `components/trainer-os/home/*` | Mock-backed prototype | Team/client context, action-oriented concept, drawer entry | Persisted AttentionItem query and stable item identity | Queue IA must converge with `/trainer/attention` | No AttentionItem model |
| Manage attention | `/trainer/attention` | Inline-state visual prototype | Open/in-progress/done concepts, counts, empty state | Source links, persistence, resolution record | Too broad categories/priority/snooze are unvalidated for first MVP | No storage/API |
| Quick assign | `quick-assign-drawer.tsx` | Hardcoded visual prototype | Client context, compact template selection intent, “assign and next” idea | Real templates, selected state, validation, assignment persistence | Recommendation and load strategy must be evidence-based | Callbacks only; dashboard mutates local client state |
| Build template | `/trainer/builder`, `components/trainer/*` | Mixed prototype; templates partly Supabase-backed | Exercise library, detail sheet, exercise/set controls, superset component | Accepted IA, template versioning, clean Save/Assign contract | Full screen composition | Assignment is localStorage; schema/domain contract unresolved |
| Client sees assignment | `/client/me`, `/client/workouts` | Mixed/demo; workouts redirects to legacy outside demo | Client card language and existing home composition | Canonical assignment read | Canonical client workflow | No WorkoutAssignment source |
| Client executes | `app/(client)/client/[id]`, demo workouts | Legacy partially Supabase-backed plus demo prototype | Set entry interaction, completion context, RPE/feeling/note patterns | Canonical session, autosave/resume, skip/comment contract | Route and execution composition | Logs not tied to canonical session; completion only notifies Telegram |
| Create review task | `/api/notify-complete` | Telegram notification only | None as lifecycle persistence | Durable item creation | Entire event-to-task path | No item or idempotent completion transaction |
| Review session | review drawer and `/trainer/review/[workoutId]` | Hardcoded/mock local state | Planned-vs-actual hierarchy, exceptions, comments, exercise detail | Real source session, stale/error states, persistence | Drawer/page duplication must be rationalized | No real reads/writes from review page |
| Store feedback | `trainer_workout_reviews` migration; `/client/me` read | Partial Supabase evidence | In-product client display/read receipt | Session/source linkage, trainer write path, feedback mode | Date-based coupling needs replacement/adaptation | Existing uniqueness is trainer/client/date, not session |
| Resolve item | dashboard local handlers; attention inline state | Prototype only | “close and next” interaction | Resolution record and concurrency behavior | Tie close to actual outcome | No persistence |
| Shared history/progress | client home/history and trainer profile progress | Mixed legacy/demo | Existing charts/history can inspire views | Shared session/log adapter | Separate client/trainer mock models | No canonical read model |

## Open questions

- What is the minimum session completion criterion and payload?
- Which single progress metric is sufficient for the first vertical MVP?
- Which external notification channel should the beta use after in-product persistence succeeds?

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Affected UI | Affected domain entities | Urgency |
| --- | --- | --- | --- | --- | --- | --- |
| Minimum session completion criteria | Require all planned work; explicit trainer policy; client confirmation plus persisted partial data | Validate the least restrictive criterion that still produces a trustworthy completed session | Completion is the lifecycle trigger and must be unambiguous | Client completion, review | WorkoutSession, WorkoutLog | before backend |
| Minimum progress metric | Volume; adherence; e1RM; another trainer-validated metric | Select one metric backed by the same completed session/log source | Closes vertical slice without building broad analytics | Client/trainer progress | WorkoutSession, WorkoutLog | before beta |
| External beta notification channel | Telegram; email; push; no external notification | Choose one optional channel after in-product feedback persistence | Transport must not become source of truth or block resolution | Client/trainer notification surfaces | Feedback delivery metadata | before beta |
