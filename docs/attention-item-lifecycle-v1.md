# AttentionItem Lifecycle V1

Дата: 2026-07-10

Статус: accepted Stage 2 lifecycle with weekly volume left for research

Scope boundary: first-MVP workout review items only; no advanced AI prioritization.

## Evidence labels

- **Accepted product decision** - confirmed in `docs/decision-log.md`.
- **Current code evidence** - confirmed by real code or migration.
- **Current prototype behavior** - mock/inline/local interaction, not production contract.
- **Proposed product decision** - recommendation awaiting Product Lead review.
- **Open question** - requires decision or user research.

## A. Purpose

`AttentionItem` is the central trainer workflow entity for MVP (accepted D-024). Its user-facing name is not accepted (D-025).

For every active item the trainer must understand:

1. **Who** requires attention: linked client identity.
2. **What happened**: completed assigned workout in the first MVP.
3. **Why it matters**: factual summary, comments and visible deviations, without unsupported interpretation.
4. **What can be done**: open review as primary action; open profile as secondary context action.
5. **Whether the situation is closed**: explicit status and auditable resolution.

An item is an operational task linked to a source event. It is not a notification, generic activity feed entry, CRM lead, diagnosis or AI score.

## B. Creation trigger for first MVP

Accepted rule (D-036):

```text
Each completed assigned WorkoutSession creates one review AttentionItem.
```

| Requirement | Definition | Evidence status |
| --- | --- | --- |
| Source event | First successful transition of a linked assigned `WorkoutSession` into conceptual `completed` state | Accepted product decision D-042 |
| Required source entity | Persisted `WorkoutSession` linked to a `WorkoutAssignment`, client and trainer | Accepted entity model D-018; implementation missing |
| Creation time | In the same durable lifecycle operation as completion, or via guaranteed retry/outbox immediately after it | Accepted consistency requirement |
| Owner | Trainer who owns the active trainer-client relation/assignment at completion time | Proposed product/permission rule |
| Item type | Conceptual `workout_review` | Proposed technical name; not final enum |
| Uniqueness | One item per `(review type, source WorkoutSession)` | Accepted idempotency invariant D-042 |
| Repeated completion | Return existing completed session and existing item; do not create or reopen another item | Accepted consistency rule D-042 |

Missed workout and abandoned/incomplete session do not create a review AttentionItem in the first MVP lifecycle. They may become separate event types later, but are not folded into `workout_review`.

Current code does not satisfy this lifecycle. Legacy completion calls `/api/notify-complete`, which sends Telegram only (`app/(client)/client/[id]/page.tsx:1221-1244`, `app/api/notify-complete/route.ts:35-58`). Dashboard review items are mock-backed and local close actions mutate component state only (`components/trainer-os/home/trainer-home-page.tsx:118-149`).

## C. Minimal conceptual fields

Field names are conceptual and do not define a schema.

| Field | Required in MVP | Purpose | Notes |
| --- | --- | --- | --- |
| id | Yes | Stable item identity | Must survive route changes and retries |
| trainer/owner | Yes | Queue ownership and permission | Linked trainer identity |
| client | Yes | Human context and permission | Linked client identity |
| type | Yes | Dispatch to review workflow | First MVP supports workout review type |
| source entity | Yes | Audit link to exact WorkoutSession | Store source type plus source id or equivalent |
| title | Yes | Scannable event label | Factual, e.g. workout completed |
| summary | Yes | Why trainer should open it | Derived from source facts; not authoritative clinical interpretation |
| created time | Yes | Stable queue order and age | Server-authoritative timestamp |
| status | Yes | `open` / `in_progress` / `resolved` lifecycle | Conceptual values only |
| primary action | Yes | Open exact review | Can be derived from type/source rather than persisted copy |
| optional secondary action | Optional | Open athlete profile | Should preserve item context |
| resolution | On resolve | Outcome, actor, reason and related records | Required for auditability |
| resolved time | On resolve | Closure timestamp | Server-authoritative |

### Fields not accepted as first-MVP requirements

| Candidate | MVP assessment | Rationale |
| --- | --- | --- |
| priority | Not required initially | Accepted cadence already queues every completed assigned workout; a false priority model adds noise before real volume evidence |
| urgency score | Later | Needs trainer research and event semantics |
| AI score | Later | Conflicts with keeping advanced AI prioritization outside MVP |
| snooze | Later by default | Can hide work without a validated reminder/due-date model |
| due date | Not required for review item | Age/created time may be enough for beta; due-date semantics require research |

Current `/trainer/attention` prototype includes priority, snooze and broad categories (`app/trainer/attention/page.tsx:30-69`, `:350-372`). This is prototype evidence, not accepted scope.

## D. Lifecycle

### Minimal state model

| State | Entry condition | Allowed actions | Exit condition | UI representation |
| --- | --- | --- | --- | --- |
| `open` | Item created from successfully completed assigned session | Open review; open client; quick acknowledge; begin manual resolution | Trainer starts a substantive feedback, acknowledgement or resolution action, or resolves directly | Active queue row with client, event, age, reason and primary action |
| `in_progress` | Trainer starts feedback, acknowledgement or resolution flow | Inspect session; draft/send feedback; assign optional next action; complete manual resolution | Valid resolution persisted | Active queue, visibly distinct but not removed; review retains draft/context |
| `resolved` | Detailed feedback sent, short acknowledgement sent, or manual resolution with reason confirmed | View audit/history; optionally reopen later if accepted | Terminal for MVP | Removed from active count; available in resolved history/audit view if exposed |

Opening a drawer or page alone does not require a transition. `open -> in_progress` happens after substantive trainer action. `open -> resolved` remains valid when a short acknowledgement is sent or a manual resolution with reason is completed in one command.

### Additional states

| State/action | First-MVP decision recommendation | Reason |
| --- | --- | --- |
| dismissed | Do not add as separate state | Manual resolution with reason covers legitimate “no action” outcomes and remains auditable |
| snoozed | Later | No accepted scheduling rule; risks hiding completed sessions |
| reopened | Later as explicit audit action | Useful for correction, but not needed to prove first loop; sent feedback remains immutable/auditable |

## E. Resolution rules

### Allowed resolution outcomes

| Outcome | Required record | Effect on item | Next assignment |
| --- | --- | --- | --- |
| Detailed feedback | Feedback id, author, sent time, content/version reference, source session | Resolve after persistence succeeds | Optional |
| Short acknowledgement | TrainerFeedback id with acknowledgement kind, author, sent time and client-visible content | Resolve automatically after persistence succeeds | Optional |
| Manual resolution | Stored reason code/text, actor, time; optional internal note | Resolve after explicit confirmation | Optional |

### Accepted behavior

- Successfully saving detailed feedback or short acknowledgement automatically resolves the item and displays confirmation/next-item action.
- Feedback must persist before the item resolves. A local toast or notification delivery is not sufficient.
- Short acknowledgement is an explicit kind of `TrainerFeedback`, not an empty closure.
- Manual resolution is a separate action requiring a stored reason. It creates no client-visible feedback unless trainer explicitly sends one.
- A next assignment is not required for resolution.
- If trainer chooses “Send and assign next,” send/resolve occurs first; assignment is a following guarded step. If assignment fails, the review remains resolved and the failed next-step action is shown clearly.
- No medical conclusion is stored as a resolution automatically. A discomfort signal remains client-authored source context; trainer owns the response.

These rules are accepted Stage 2 decisions D-043-D-046.

## F. Dashboard behavior

### First-MVP queue

| Behavior | Recommendation |
| --- | --- |
| Default filter | Active items: `open` and `in_progress` |
| Sort | First items with client-authored discomfort/pain signal; inside each group oldest source completion first, with stable id tie-break |
| Grouping | No required grouping in first MVP; optional lightweight “today / earlier” date sections |
| Count | Count active items only; separately show in-progress if it helps workload scanning |
| Row | Client, workout title/date, factual reason, age, status, one primary review action |
| Empty state | “Все завершённые тренировки разобраны” plus relevant next action such as open clients/templates, not fake analytics |
| Open behavior | Drawer for quick review/acknowledgement; canonical full page for detailed review; both use one read model and command contract |
| Return | Restore queue filter, scroll position and selected item |
| Next task | After resolution offer “Open next” using current stable queue ordering; do not silently navigate before success confirmation |

Advanced priority score, AI score and snooze are later. The discomfort-first rule is deterministic safety handling, not a predictive score. The original client signal/comment must remain visible and must not be hidden in an AI summary.

Current evidence:

- `/trainer/dashboard` already frames client states as actions and supports “next” behavior, but uses mock clients and local mutation (`components/trainer-os/home/trainer-home-page.tsx:118-149`, `:192-211`).
- `/trainer/attention` has useful queue/list/context/empty-state patterns, but stores inline items and broad unvalidated categories (`app/trainer/attention/page.tsx:360-425`, `:535-570`).
- Two queue concepts must converge on one lifecycle contract before implementation.

## G. Auditability

For any item the system must answer:

- which source session created it;
- which assignment and client/trainer relationship the session belongs to;
- when the source session completed and when the item was created;
- whether creation was retried or deduplicated;
- when and by whom review started, if tracked;
- which resolution outcome was chosen;
- which feedback and optional next assignment were produced;
- when it resolved;
- whether client-visible feedback was delivered in-product and optionally seen;
- whether an external notification failed independently.

Auditability is a data requirement; the first MVP does not need a large audit-log UI. Source and resolution links must still be retained.

## H. Acceptance criteria

- Completing one assigned session creates exactly one open review item owned by the correct trainer.
- Repeating completion or event delivery creates no duplicate.
- Item opens the exact client and WorkoutSession, not a date-based approximation.
- Active count and row status reflect persisted state after refresh and in another tab.
- Opening a surface alone keeps the item open; substantive trainer action can move it to `in_progress`.
- Detailed feedback and short acknowledgement both persist as TrainerFeedback and automatically resolve the item after success.
- Manual resolution requires an auditable stored reason and does not claim feedback was sent.
- Next workout is optional for all three resolution outcomes.
- A failed feedback save leaves the item active and retains the draft locally for retry.
- A failed external notification does not roll back persisted feedback or resolution.
- Stale UI detects an item resolved elsewhere and does not overwrite the resolution.
- Client cannot query or mutate trainer queue items outside its permitted feedback/session view.
- Discomfort/pain signal and source comment are preserved, visibly surfaced and sorted before other review items without diagnosis or medical inference.
- Queue works without AI and without advanced priority scoring or snooze.

## I. Remaining research decision

- What weekly review volume does the target trainer actually process, and when does that volume require additional grouping or batching?

The final user-facing name remains governed by earlier proposed decision D-025 and is not redefined in Stage 2.

## Current implementation mapping

| Surface | Useful evidence | Not accepted / missing |
| --- | --- | --- |
| `/trainer/dashboard` | Action-first team view, review/assign drawers, next-client interaction | Mock TeamClient state substitutes for item entity; close is local only |
| `/trainer/attention` | Open/in-progress/done concepts, queue count, context pane, empty state | Broad categories, priority and snooze are unvalidated; all items inline/local |
| Workout review drawer | Clear “send” and “send + assign” intent | Hardcoded data; no feedback persistence; parent callback closes local client action |
| Workout review page | Exact source route shape and detailed review presentation | Hardcoded object fallback; local `reviewed` flag and toast only |
| `trainer_workout_reviews` | In-product feedback visibility and client read receipt are partially modeled | Unique by trainer/client/date, no session source, not an AttentionItem lifecycle |

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Affected UI | Affected domain entities | Urgency |
| --- | --- | --- | --- | --- | --- | --- |
| Weekly trainer review volume | Individual reviews only; grouped batch processing; time-boxed review queue | Measure real weekly completed-session volume before adding batching or new queue mechanics | Volume determines whether the accepted deterministic queue remains sufficient | Dashboard, review queue | AttentionItem read model | before beta |
