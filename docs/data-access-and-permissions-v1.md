# Data Access and Permissions v1

Status: accepted conceptual authorization and RLS contracts. This document intentionally contains no SQL or final policy names.

## Actors and trust boundaries

| Actor | Authentication | Trust level |
|---|---|---|
| Unauthenticated visitor | None | May read only explicitly public projections |
| Authenticated athlete/client | Application-owned server session plus AthleteProfile capability | May access own profile and workout facts, and mutate only allowed active-session facts |
| Authenticated trainer | Application-owned server session plus TrainerProfile capability | May access owned authoring data and athlete data only through required active `TrainerAthleteRelation` |
| Service/admin backend | Scoped server/database role plus verified caller or trusted job identity | May use privileged operations only for narrow audited work; never a substitute for ordinary UI authorization |

The backend resolves the caller from the application session and supplies transaction-local actor context to repositories/RLS. IDs in request bodies are resource references, not proof of identity. Capability, ownership and TrainerAthleteRelation determine access; a provider claim or string role alone is insufficient. The browser receives no database key or provider token for ordinary product access.

## Permission matrix

Legend: `R` read, `C` create, `U` update, `A` archive, `-` forbidden. Conditions after a symbol are mandatory.

| Entity | Visitor | Athlete | Trainer | Service/admin | Core policy contract |
|---|---|---|---|---|---|
| UserProfile | - | R/U own allowed fields | R own; R athlete-scoped fields via relation only | Audited C/R/U | No broad profile-row exposure |
| TrainerProfile | R public projection | R public; R own if dual-capability | C/R/U/A own | Audited | Public projection is an allowlist and excludes athlete data |
| AthleteProfile | - | R/U own self-described fields | R related; U only delegated coaching fields | Audited | Active relation for trainer access |
| TrainerAthleteRelation | - | R own participation; accept/end under workflow | C invite/R own/U lifecycle under workflow | Audited | Pair membership required; no arbitrary id substitution |
| ExerciseCategory | R public/system | R | R | C/U/A curated | Controlled vocabulary |
| Exercise/Media | R explicitly public only | R visible | C/R/U/A own; R system/allowed | Audited | System rows not trainer-editable; private media signed/scoped |
| WorkoutTemplate and children | - | R only if needed through an assignment projection, not raw private library | C/R/U/A own; publish own | Audited | Athlete cannot mutate authoring records |
| WorkoutAssignment and snapshot | - | R own | C/R/U schedule/prescription before start for active relation; cancel per policy | Audited | Athlete cannot edit prescription; structure locks after start |
| WorkoutSession | - | C/R/U own active session; complete idempotently | R related; no silent factual update | Audited exception/correction | Assignment ownership and relation must agree |
| ExerciseLog/SetLog | - | C/R/U own while session active | R related | Audited correction only | Completed logs immutable in ordinary flow |
| ClientSessionComment/DiscomfortSignal | - | C/R/U own while active; R own | R related; no rewrite | Audited | Preserve original signal; health-adjacent sensitivity |
| AttentionItem | - | - | C/R/U own through authenticated workflow; no direct arbitrary source | Audited | Owner trainer and source relation/session enforced |
| TrainerFeedback | - | R own received | C/R related; no update after send; follow-up C | Audited | Athlete cannot edit; creation requires authorized session |
| ManualResolution | - | - | C/R own with reason | Audited | One resolution path, immutable reason record |
| Weight/BodyMeasurement | - | C/R/U own under correction policy | R related; write only if product explicitly delegates | Audited | Private factual data |
| ProgressPhoto | - | C/R/A own | R only with active relation and consent scope | Audited | Highly sensitive; never public |
| ProgressProjection | - | R own | R related | Rebuild/manage | Inherits access from source facts |
| InternalTrainerNote | - | - | C/R/U/A own and related | Audited | Explicitly trainer-private |
| Message | - | C/R own relation; U own draft/read state only | Same | Audited | Sender derived from auth; active/historical participation policy |
| Notification | - | R own delivery status if exposed | R own delivery status if exposed | C/U worker | Domain write completes before delivery attempt |
| Subscription/AccessStatus | - | R own | R only required coaching entitlement projection | Provider/admin writes | No client-supplied paid state |

## Command authorization contracts

1. Every trainer command on athlete data resolves the sole canonical `TrainerAthleteRelation` from authenticated trainer plus target athlete and validates required state. `profiles.trainer_id` is not authorization truth.
2. Every athlete execution command resolves assignment ownership from authenticated athlete; it does not accept a trusted `client_id` from the browser.
3. Template ownership derives from authenticated trainer. Assignment creation verifies both template revision ownership and active relation.
4. Starting/saving/completing a session checks assignment state and stable session identity. Completed facts cannot be updated through the active-session command.
5. Feedback creation verifies AttentionItem owner, source session, and relation. Resolution occurs only after feedback persistence succeeds.
6. Manual resolution verifies owner and stores a required reason.
7. Service commands authenticate either an application session with equivalent authorization or a trusted signed provider/job event, and then repeat capability, ownership and relation checks. A privileged database role alone is not caller authorization and does not replace RLS as defence in depth.
8. All externally retryable commands require an idempotency key and record actor, target, result and correlation identifiers without logging sensitive payloads unnecessarily.

## Relation and historical-access policy

The athlete always retains access to their own records. Active relation is required for trainer access to new athlete data. Ending a relation prevents access to data created afterward and never automatically deletes historical records. Trainer access to historical shared records from the active period remains proposed pending privacy/legal review; the safe temporary default is no trainer UI access after relation end while records remain retained for athlete/admin and potential dispute handling.

## Archive and physical deletion boundary

WorkoutTemplate, TrainerAthleteRelation, WorkoutAssignment, WorkoutSession, TrainerFeedback and AttentionItem are archived/soft-deleted in ordinary product flow. Archive affects discoverability and allowed commands, not factual retention. Physical deletion is a separate privacy/admin procedure with explicit authorization, dependency analysis and audit; it is never an ordinary cascade from profile/template/relation UI.

## Public trainer page contract

The public page may read an explicit TrainerProfile projection: public name, slug, approved bio/specialization, public media and published offer fields. It must never select broad `profiles.*`, relation records, athlete identity, workout data, measurements, messages, notes, feedback, payment metadata or private contact fields.

## Current security gaps

- `lib/auth-context.tsx` proves authentication but exposes `trainerId = user.id` without establishing trainer capability or relation authorization.
- `proxy.ts` matches `/dashboard/:path*` and `/api/notify-complete`, not the canonical `/trainer/*`, `/client/*`, or most service APIs. Route guards are defense in depth; RLS/command checks remain mandatory.
- `app/api/ensure-profile/route.ts` uses service role and trusts body `userId`/role/trainer id without demonstrated bearer verification.
- `app/api/send-reminder/route.ts` uses service access for body-selected client without demonstrated authorization.
- `trainer_client_messages` policies validate actor ID but not an active trainer-athlete relation (`20260406120000_trainer_client_messages.sql`).
- `trainer_workout_reviews` authorization depends on `profiles.trainer_id`, while other code uses `trainer_clients` (`20260403120000_trainer_workout_reviews.sql`).

## Required verification suites

- Cross-tenant RLS tests for every athlete-scoped entity.
- Command tests for forged athlete/trainer/resource IDs.
- Anonymous tests for every API route and public projection.
- Completed-log immutability and follow-up feedback tests.
- Ended-relation access and retention tests.
- Static/deployment scans proving database credentials and provider secrets are absent from browser bundles and logs.
- Concurrency/idempotency tests for session start/completion, AttentionItem and notifications.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Evidence | Affected entities | Affected existing tables/code | Urgency |
|---|---|---|---|---|---|---|---|
| Retain history but revoke normal trainer access when relation ends | Delete history; permanent trainer access | Retain records; default revoke, then decide narrow historical access | Balances integrity and privacy | Accepted no-destruction invariant; policy unanswered | Relation, sessions, feedback | Current cascade FKs | Before schema |
| Include ProgressPhoto in trainer permissions for the first slice | Athlete-only; defer entity | Defer pending explicit scope/consent decision | Highly sensitive media needs separate privacy UX | Current progress photo data is mock-only | ProgressPhoto | Progress UI and future storage policies | Before beta |
