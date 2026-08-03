# Backend Foundation B8

- Date: **2026-08-03**
- Status: **implementation complete locally; external alpha remains blocked**
- Scope: canonical trainer workout review and athlete-visible feedback

## Implemented

1. `/trainer/attention` reads open canonical `AttentionItem` rows outside explicit demo mode. The queue shows only completed sessions owned by the active trainer relation and links to the exact `WorkoutSession`.
2. `/trainer/review/:sessionId` reads the immutable assignment plan together with athlete-owned `ExerciseLog` and `SetLog` facts. Partial work, changed repetitions or weight, and original athlete comments are rendered without mutating the execution record.
3. A trainer can send detailed feedback or an acknowledgement. The feedback row is inserted before the attention item is resolved in the same transaction.
4. A resolved review accepts append-only follow-up feedback linked to the original response. Previously sent feedback cannot be edited or deleted by the application role.
5. A trainer can resolve an item without athlete-visible feedback only after supplying a private reason. The reason is stored separately and is not exposed through the athlete endpoint.
6. Every mutation has a durable idempotency receipt and locks the attention item. Equal concurrent retries converge on one result; changed payloads and stale review attempts fail explicitly.
7. The terminal client workout screen reads the same canonical `TrainerFeedback` rows. Athlete history remains visible after the original trainer relation ends, while the former trainer loses access.
8. Existing demo queue and demo review remain unchanged behind explicit demo mode.

## Canonical HTTP Surface

| Route | Method | Result |
| --- | --- | --- |
| `/api/trainer/reviews` | `GET` | Trainer-owned open review queue |
| `/api/trainer/reviews/:sessionId` | `GET` | Exact completed session review projection |
| `/api/trainer/reviews/:sessionId/feedback` | `POST` | Initial response, acknowledgement or follow-up |
| `/api/trainer/reviews/:sessionId/resolve` | `POST` | Trainer-private manual resolution |
| `/api/client/feedback?sessionId=:id` | `GET` | Athlete-owned immutable feedback history |

Mutations require a same-origin request, an application session and an active trainer capability. Initial feedback additionally requires the active trainer-athlete relation represented by the source attention item. Feedback bodies are capped at 5,000 characters by the service and 16 KiB at the HTTP boundary; manual reasons are capped at 1,000 characters and 8 KiB.

## Persistence Boundary

- Migration `0008_workout_review_feedback` adds `trainer_feedback`, `attention_manual_resolutions` and `review_command_receipts`.
- `TrainerFeedback` is append-only. The application role receives `SELECT` and `INSERT`, but no `UPDATE` or `DELETE` grant.
- The database trigger permits only the `open -> resolved` attention transition and preserves source identity.
- Feedback insert and attention resolution commit together. Manual resolution and its private reason also commit together.
- RLS derives access from the actor and active relation, never from a caller-supplied athlete ID.
- Feedback content and manual reasons are excluded from audit-event metadata; audit rows contain only command and entity identifiers.

## Verification Evidence

| Check | Result |
| --- | --- |
| PostgreSQL 16 B8 rollback and remigrate | pass |
| Full backend suite | pass, 36/36 |
| Concurrent feedback retry and changed-payload conflict | pass |
| Concurrent manual resolution | pass |
| Feedback immutability under application role | pass |
| Unrelated trainer and ended-relation isolation | pass |
| Browser: athlete completion -> trainer queue -> exact review -> feedback -> athlete result | pass |
| Browser plan-vs-actual and original comment | pass |
| Mobile terminal result at 390 x 844 | pass; document width 390 px |
| Browser console and Next.js overlay | no errors, warnings or overlay |
| TypeScript, lint and production build | pass |

The browser flow used synthetic local users and a disposable PostgreSQL database only.

## Deliberately Not Implemented

- No email, Telegram or push notification is sent when feedback arrives. B8 provides the in-product source of truth only.
- No athlete acknowledgement, read receipt, feedback edit/delete, threaded conversation or notification preference exists.
- No structured discomfort/body-signal field exists in canonical execution yet. Free-text comments are preserved and surfaced, but the product does not infer a diagnosis.
- No trainer access to historical athlete-private facts after relation end. The athlete retains the feedback record; the trainer loses the review projection.
- No object storage or progress-photo scope is introduced.
- Existing broad trainer dashboard badges and shell identity are still presentation/demo data outside this vertical slice.
- Managed PostgreSQL, production email delivery, live identity providers and an operator activation workflow remain unresolved deployment gates.

## Next Slice

B9 should harden the closed-alpha operational boundary rather than add another broad feature surface: choose managed PostgreSQL and secret ownership, configure real email delivery, define feedback notification delivery, and run the canonical B1-B8 flow in staging with two independent test accounts.
