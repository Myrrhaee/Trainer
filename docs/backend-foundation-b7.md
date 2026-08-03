# Backend Foundation B7

- Date: **2026-08-03**
- Status: **implementation complete locally; external alpha remains blocked**
- Scope: canonical athlete workout execution and durable trainer review handoff

## Implemented

1. An athlete can start or resume exactly one `WorkoutSession` for a canonical `WorkoutAssignment`. Repeating the start command, including concurrently, returns the same session.
2. Session creation copies the assignment exercise and set prescription into stable execution rows. Athlete-entered repetitions, duration, weight, RPE and comments are stored separately from planned facts.
3. Progress commands require an expected session version and an idempotency key. Equal retries return the committed result; a changed payload with the same key and stale versions fail with explicit conflicts.
4. Partial completion is supported. Pending sets become `incomplete`; a session with omissions becomes `completed_with_omissions`.
5. Completion with zero performed sets requires explicit athlete confirmation and may include a reason.
6. Every completed session creates exactly one trainer-owned `AttentionItem`. The athlete can create the handoff through the completion transaction but cannot read the trainer queue item.
7. The canonical client home exposes `Start`, `Continue` and `View result` states. `/client/workouts` provides the non-demo execution UI and reload-safe terminal result.
8. Existing demo runtime remains unchanged and continues to be selected only by explicit demo configuration.

## Canonical HTTP Surface

| Route | Method | Result |
| --- | --- | --- |
| `/api/workout-sessions` | `GET` | Athlete-owned sessions |
| `/api/workout-sessions` | `POST` | Start or resume the assignment session |
| `/api/workout-sessions/:id` | `GET` | Athlete-visible session projection |
| `/api/workout-sessions/:id/progress` | `POST` | Save one or more set facts with optimistic concurrency |
| `/api/workout-sessions/:id/complete` | `POST` | Complete fully, partially or explicitly with zero results |

Mutations require a same-origin request, a valid application session and an active athlete capability. Resource IDs never authorize access. Progress and completion request bodies are capped at 64 KiB and 32 KiB respectively.

## Persistence Boundary

- Migration `0007_workout_session_execution` adds `workout_sessions`, `workout_exercise_logs`, `workout_set_logs`, command receipts and trainer attention items.
- `UNIQUE (assignment_id)` establishes the one-session-per-assignment rule. A repeat workout requires a new assignment.
- Planned set identity and prescription fields are immutable after session start. Actual set facts remain athlete-owned while the session is active.
- A terminal session is immutable. Session version advances by exactly one for each successful progress or completion transaction.
- Command receipts provide durable retry behavior across process restarts and concurrent requests without storing raw idempotency keys.
- RLS allows the athlete to retain session history after a trainer relation ends. Trainer reads require the original active relation and trainers cannot mutate athlete execution facts.
- Attention-item creation and session completion occur in one transaction. The queue item is visible to its trainer only while the relation remains active.

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean PostgreSQL 16 migration | pass |
| B7 rollback and remigrate | pass |
| Full backend suite | pass, 33/33 |
| Concurrent session start | pass; one session row |
| Concurrent progress/completion retry | pass; one version transition per command |
| Changed idempotency payload and stale version | explicit conflict |
| Partial and zero-result completion | pass |
| Exactly one trainer AttentionItem | pass |
| Unrelated actor and ended-relation isolation | pass |
| Browser: login -> assignment -> start -> save -> reload -> partial complete | pass |
| Browser reload and terminal result link | pass |
| Mobile execution at 390 x 844 | pass; document width 390 px |
| Browser console | no errors or warnings |
| TypeScript and targeted lint | pass |

## Deliberately Not Implemented

- Trainer review UI does not yet read or resolve `AttentionItem`; B7 only establishes the durable handoff.
- No trainer feedback, athlete acknowledgement, review revision or reviewed-session state is persisted yet.
- No abandon, restart, assignment cancel/reschedule or offline synchronization command exists.
- The client saves an individual set on explicit action; no background draft autosave or multi-device merge UI exists.
- Exercise library migration remains outside this slice.
- Managed PostgreSQL, production email delivery, live Google/Telegram credentials and an operator activation workflow remain unresolved deployment gates.

## Next Slice

B8 should connect the trainer review queue to canonical `AttentionItem` and completed session facts. Review commands must be trainer-owned, relation-authorized, idempotent and preserve the athlete's original execution record.
