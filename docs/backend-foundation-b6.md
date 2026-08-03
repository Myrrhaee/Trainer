# Backend Foundation B6

- Date: **2026-08-03**
- Status: **implementation complete locally; external alpha remains blocked**
- Scope: canonical WorkoutTemplate Builder lifecycle and assignment integration

## Implemented

1. The existing rich trainer Builder uses its preserved demo runtime only when `NEXT_PUBLIC_DEMO_MODE=true`. Canonical mode now reads and mutates PostgreSQL through actor-scoped application APIs.
2. Trainers can save empty or incomplete drafts, update the current draft, publish a valid immutable revision, create a copied next draft revision, duplicate into a new template and archive a template.
3. Exercise prescriptions preserve repetition or duration mode, fixed/range repetitions, target weight, rest, trainer note, equipment metadata, ordered supersets and optional per-set warmup/working overrides.
4. Assignment creation copies the complete published exercise and per-set prescription into assignment-owned normalized snapshot rows. A later draft revision cannot alter an existing assignment.
5. The canonical trainer roster links the selected athlete into the full Builder. Publishing and assigning returns through the same canonical assignment API introduced in B5.
6. Published revisions and archived templates are immutable at both repository and PostgreSQL-policy boundaries. Unrelated trainers cannot read or mutate them.
7. Rich Builder JSON is capped at 64 KiB; all other existing small JSON routes keep the 8 KiB limit.

## Canonical HTTP Surface

| Route | Method | Result |
| --- | --- | --- |
| `/api/trainer/workout-builder/templates` | `GET` | Trainer-owned current builder projections |
| `/api/trainer/workout-builder/templates` | `POST` | Create or replace the actor-owned current draft |
| `/api/trainer/workout-builder/templates/:id/publish` | `POST` | Validate, save and publish current draft |
| `/api/trainer/workout-builder/templates/:id/revisions` | `POST` | Copy current published revision into revision N+1 draft |
| `/api/trainer/workout-builder/templates/:id/archive` | `POST` | Archive an owned non-archived template |

Every mutation requires same-origin requests, a valid application session and an active trainer capability. Request IDs identify resources; they do not grant authorization.

## Persistence Boundary

- Migration `0006_workout_builder_lifecycle` adds explicit draft/published revision status and normalized optional set rows.
- `workout_template_exercises` stores ordered exercise instances and superset membership; `workout_template_exercise_sets` stores per-set authoring facts.
- `workout_assignment_exercises` and `workout_assignment_exercise_sets` store independent assignment snapshots with source provenance.
- Published revision rows cannot be updated. A new revision advances `current_revision` by exactly one and starts as a draft.
- Draft replacement deletes and reinserts only rows owned by the actor's current draft transaction.

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean PostgreSQL 16 migration | pass |
| B6 rollback and remigrate | pass |
| Full backend suite | pass, 30/30 |
| Rich draft and per-set round trip | pass |
| Published and archived immutability | pass |
| Cross-trainer isolation | pass |
| Assignment snapshot survives revision N+1 | pass |
| Browser: roster -> builder -> save -> publish -> assign -> revision | pass |
| Reloaded template workspace retains revision 2 draft | pass |
| Mobile Builder at 390 x 844 | pass; document width 390 px |
| TypeScript and lint | pass |

## Deliberately Not Implemented

- No workout start/resume/completion, exercise log, set log, review or trainer feedback persistence exists yet.
- No assignment edit, cancel or reschedule command exists.
- No optimistic concurrency token exists for two tabs editing one draft; transactions prevent invalid revision transitions but last successful draft save wins.
- Exercise library rows still come from the existing demo library adapter. B6 persists selected exercise identity and metadata but does not migrate the library source.
- No managed PostgreSQL, production email adapter, live provider credentials or operator activation tool is configured.

## Next Slice

B7 should define the idempotent WorkoutSession start/resume contract and assignment execution lock before enabling client-side workout mutation. The contract must preserve partial completion and SetLog facts without deriving truth from browser state.
