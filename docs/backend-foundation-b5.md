# Backend Foundation B5

- Date: **2026-08-03**
- Status: **implementation complete locally; external alpha remains blocked**
- Scope: canonical trainer roster, saved workout template, assignment snapshot and athlete assignment read

## Implemented

1. The canonical trainer roster reads active `TrainerAthleteRelation` rows from PostgreSQL and no longer falls back to browser Supabase access outside the explicit local legacy flag.
2. An active trainer can persist a minimal published `WorkoutTemplate` with one immutable revision and normalized exercise rows.
3. A `WorkoutAssignment` can be created only from the trainer's saved published template and for an athlete connected through an active canonical relation.
4. Assignment creation copies title, instruction, revision number and normalized exercise prescription into assignment-owned snapshot rows. Later template metadata changes do not alter existing assignments.
5. The canonical athlete home reads only the authenticated athlete's available assignments. It does not receive access to the trainer's private template library.
6. Ending the trainer-athlete relation prevents new assignments and revokes ordinary trainer reads of existing athlete assignments. The athlete retains their own history.
7. Same-origin API routes resolve the actor from the application session; request body athlete/template IDs remain resource references and never establish authorization.
8. The existing rich builder, Quick Assign drawer, demo runtime and Supabase-preservation screens remain untouched. B5 adds a compact canonical creation/assignment surface rather than pretending those adapters are already integrated.

## Canonical HTTP Surface

| Route | Method | Capability | Result |
| --- | --- | --- | --- |
| `/api/trainer/athletes` | `GET` | active trainer | Active PostgreSQL roster projection |
| `/api/trainer/workout-templates` | `GET` | active trainer | Trainer-owned published templates |
| `/api/trainer/workout-templates` | `POST` | active trainer | Valid saved template plus revision/exercises |
| `/api/workout-assignments` | `POST` | active trainer and active target relation | Independent assignment snapshot |
| `/api/workout-assignments` | `GET` | active athlete | Actor-owned available assignments |

## Persistence Boundary

- `app.workout_templates` owns reusable trainer authoring identity.
- `app.workout_template_revisions` and `app.workout_template_exercises` own the published source prescription.
- `app.workout_assignments` stores relation, participants, source provenance and assignment-level text/date snapshots.
- `app.workout_assignment_exercises` stores the normalized independent exercise snapshot.
- PostgreSQL `date` values are converted to `YYYY-MM-DD` in the repository DTO boundary so browser locale formatting cannot shift the calendar day.
- B5 deliberately supports one published revision per template through the current service. The schema preserves revision identity, but draft editing and creation of later revisions remain a separate command slice.

## Authorization Boundary

- Template rows are visible only to their authenticated trainer owner.
- Athlete users cannot read raw template/revision/exercise authoring rows.
- Assignment insert policy verifies actor-owned template, matching source revision, a non-empty exercise prescription and the exact active relation participants.
- Assignment exercise insert policy verifies that every copied row exactly matches its source revision in B5. Per-athlete prescription overrides require a future explicit contract and are not silently accepted.
- Athlete assignment reads are self-only.
- Trainer assignment reads require the same relation to remain active; relation history alone is insufficient.
- The ordinary application role has no update/delete rights on published revisions, template exercises, assignments or snapshots.

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean PostgreSQL 16 applies migrations B1-B5 | pass |
| B5 rollback and remigrate | pass |
| Full backend suite | pass, 27/27 |
| Unrelated trainer template/roster/assignment isolation | pass |
| Unrelated athlete assignment isolation | pass |
| Ended relation blocks new assignment and former-trainer read | pass |
| Athlete retains own assignment after relation end | pass |
| Application role cannot mutate published exercise revision | pass |
| Trainer browser flow: real roster -> save template -> assign | pass |
| Athlete browser flow: own assignment snapshot renders | pass |
| Mobile athlete home at 390 x 844 | pass; document width equals viewport width |
| TypeScript and lint | pass |
| Production build | pass |

The browser flow also caught and fixed a PostgreSQL `date` serialization error before completion: repository output now uses a date-only string and renders the same calendar day in the athlete locale.

## Deliberately Not Implemented

- No full integration of `components/trainer-os/workout-template-builder/` with PostgreSQL exists yet.
- No canonical draft edit, later template revision, archive, duplicate, superset, duration prescription or per-set override command exists.
- No assignment edit/cancel UI exists.
- No workout start, resumable session, completion, exercise log, review or feedback workflow exists on this backend slice.
- The trainer header still uses the preserved shell's demo display identity; canonical profile projection is not part of B5.
- Managed PostgreSQL, production email delivery, Google/Telegram credentials, operator tooling and deployed negative authorization tests remain external-alpha gates.

## Next Slice

B6 should integrate the accepted simple WorkoutTemplate Builder commands with this repository contract, including draft persistence, publish-as-revision and existing-template assignment. Workout execution must begin only after the assignment lifecycle/idempotency contract is implemented and tested.
