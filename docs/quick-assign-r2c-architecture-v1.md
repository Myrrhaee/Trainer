# Quick Assign R2C Architecture v1

## 1. Executive verdict

R2C должен свести все точки назначения к одному production workflow:

```text
known athlete context
  -> exact saved published WorkoutTemplate revision
  -> WorkoutService.createAssignment
  -> independent WorkoutAssignment snapshot
  -> R2A.3 TrainerWorkflowTransition receipt
  -> Profile / Queue / Next item
```

Новая доменная сущность и новый command не нужны. Каноническими остаются существующие `WorkoutTemplate`, `WorkoutTemplateRevision`, `WorkoutAssignment`, `TrainerAthleteRelation` и `WorkoutService.createAssignment`.

Текущий backend уже обеспечивает основную snapshot-модель, owner/relation checks и idempotent replay. Однако существующий production contract ещё недостаточен для R2C по двум причинам:

1. POST назначения принимает только `templateId` и в момент submit выбирает `template.current_revision`. Если после preview была опубликована новая revision, может быть назначена не та версия, которую подтвердил тренер.
2. Разные `assignmentId`, отправленные параллельно из двух вкладок, могут создать два назначения без stale-state проверки. Поддержка нескольких будущих Assignment является канонической, но случайная конкурентная копия должна требовать повторного подтверждения.

Поэтому R2C требует не нового command, а расширения входа существующего `createAssignment`: точная `templateRevisionId` и opaque token состояния будущих назначений. Это изменение API-контракта, но не schema migration.

Текущий demo `QuickAssignDrawer` является только UX evidence. Его local mutation, mock templates, goal-based suitability, editable general instruction и exercise overrides не могут быть перенесены в production contract автоматически.

**Итог:** schema foundation достаточна; canonical read model и единая поверхность отсутствуют; read API и payload/error contract существующего assignment API нужно расширить; migrations не требуются.

## 2. Current implementation map

| Surface | Entry | Read source | Command | Transition/receipt | Current status |
| --- | --- | --- | --- | --- | --- |
| Canonical roster | `/trainer/clients` | `/api/trainer/dashboard` + `/api/trainer/workout-templates` | POST `/api/workout-assignments` | Локальный текст receipt, затем reload roster | Единственная production Quick Assign-подобная поверхность |
| Athlete Profile Header | `/trainer/clients/[athleteId]` | R1/R2A profile and training read models | Нет assignment form | CTA ведёт в Builder с R2A.3 context | Divergent: Builder используется вместо Quick Assign |
| Dashboard assignment item | `/trainer/dashboard` | `TrainerDashboardRepository` | Нет assignment form | Переход в Builder с R2A.3 queue context | Divergent: Builder используется вместо Quick Assign |
| Canonical Review receipt | `/trainer/review/[sessionId]` | `ReviewReadModel` + R2A.3 transition | Нет assignment form | `transition.nextItem` для assignment ведёт в Builder | Divergent: нет same-athlete Quick Assign entry |
| Canonical Builder assign | `/trainer/builder` | Builder repository/API | POST `/api/workout-assignments` | `transition.returnHref`, `router.refresh()` | Production command, но отдельный сокращённый dialog |
| Demo Quick Assign Sheet | demo mode, embedded in Dashboard/Profile/Review/Clients/Builder | `demo-runtime` + inline/mock models | `runtime.commands.createWorkoutAssignment` | Local receipt | UX prototype only; не production evidence |
| Legacy admin/client routes | `/dashboard/*`, старые client/trainer pages | Supabase/inline/demo mixes | Несвязанные flows | Нет R2A.3 guarantee | Не входят в R2C canonical path |

Evidence:

- Roster загружает Dashboard и published templates параллельно и открывает `CanonicalRosterAssignmentDialog`: `components/trainer/canonical-trainer-roster.tsx:34-64`, `:150-158`.
- Roster dialog отправляет `assignmentId`, athlete, template, date, note и transition context в canonical API: `components/trainer/canonical-roster-assignment-dialog.tsx:43-71`.
- Profile assignment CTA сейчас ведёт в Builder: `lib/server/athlete-profile/athlete-capabilities-service.ts:32-43`, `lib/server/athlete-profile/athlete-training-profile-frame-projector.ts:133-144`.
- Dashboard assignment entry сейчас ведёт в Builder: `components/trainer/canonical-trainer-dashboard.tsx:139-147`.
- R2A.3 next assignment destination сейчас ведёт в Builder: `lib/server/trainer-workflow/trainer-workflow-transition-service.ts:140-153`.
- Builder использует тот же POST и затем `transition.returnHref`: `components/trainer-os/workout-template-builder/canonical-builder-assignment-dialog.tsx:42-64`.
- Demo drawer выполняет local runtime command, а не HTTP command: `components/trainer-os/quick-assign/quick-assign-drawer.tsx:224-244`.

## 3. Canonical entity linkage

```text
TrainerProfile
  1 -> N WorkoutTemplate

WorkoutTemplate
  1 -> N WorkoutTemplateRevision
  current_revision -> one revision number

WorkoutTemplateRevision
  1 -> N WorkoutTemplateExercise
  1 -> N WorkoutTemplateExerciseSet through exercise

TrainerAthleteRelation (active)
  1 -> N WorkoutAssignment

WorkoutAssignment
  -> source_template_id
  -> source_revision_id
  -> source_revision_number
  -> independent assignment-level snapshots
  1 -> N WorkoutAssignmentExercise snapshots
  1 -> N WorkoutAssignmentExerciseSet snapshots through exercise

WorkoutAssignment
  0 -> 1 WorkoutSession
  -> R2A current/history projections
  -> Dashboard projection
  -> Client assignment list/execution
```

Schema evidence:

- Template identity, owner, status and current revision: `database/migrations/0005_workout_templates_and_assignments.up.sql:12-29`.
- Revision identity and immutable version number: `database/migrations/0005_workout_templates_and_assignments.up.sql:31-49`.
- Assignment source revision and top-level snapshots: `database/migrations/0005_workout_templates_and_assignments.up.sql:75-99`.
- Exercise snapshots: `database/migrations/0005_workout_templates_and_assignments.up.sql:101-126`, extended by `database/migrations/0006_workout_builder_lifecycle.up.sql:104-159`.
- Per-set snapshots: `database/migrations/0006_workout_builder_lifecycle.up.sql:161-186`.
- Published revision immutability: `database/migrations/0006_workout_builder_lifecycle.up.sql:219-249`.
- Archived template immutability: `database/migrations/0006_workout_builder_lifecycle.up.sql:193-217`.

### 3.1 What “saved” and “published” mean

`saveDraft` persists a `WorkoutTemplate` and its current `WorkoutTemplateRevision` with status `draft`. Saved means durable, not assignable. Draft title and items may be incomplete.

`publish` changes both current revision and template to `published`. A published revision is immutable. Editing later requires `createRevision`, which copies the published revision into a new draft and advances `current_revision`.

Evidence: `lib/server/workouts/workout-builder-repository.ts:111-165`, `:167-215`; validation allows an empty draft but requires exercises for publication in `lib/server/workouts/workout-builder-service.ts:124-146`.

### 3.2 Can a draft be assigned?

No.

- Repository query requires `template.status = 'published'`: `lib/server/workouts/workout-repository.ts:244-255`.
- Assignment RLS requires source template status `published` and at least one exercise: `database/migrations/0005_workout_templates_and_assignments.up.sql:247-272`.
- Demo UI also labels only published items as selectable, but this is supporting UX evidence rather than authority: `components/trainer-os/quick-assign/quick-assign-drawer.tsx:202-212`.

An unsaved Builder draft has no canonical template/revision identity and cannot be assigned.

### 3.3 Revision lifecycle consequence

When `createRevision` is called, the template becomes `draft` and `current_revision` points to the new draft. While that draft exists, the current production assignment query does not expose the previous published revision. After the new revision is published, it becomes the only current revision selected by `createAssignment`.

This behavior is valid for current schema, but Quick Assign must bind preview to an exact revision and reject stale selection instead of silently switching to a newer revision.

## 4. Existing template read contracts

### 4.1 `WorkoutService.listTemplates`

Route: GET `/api/trainer/workout-templates`.

Properties:

- active trainer required;
- only own templates with `template.status = 'published'`;
- current revision only;
- one set-based aggregate SQL query for templates and basic exercises;
- no pagination or server search;
- no draft/archived tombstone;
- no per-set prescription, superset detail, rich prescription ranges or revision status;
- all matching exercises are hydrated for every list row.

Evidence: `app/api/trainer/workout-templates/route.ts:19-32`, `lib/server/workouts/workout-repository.ts:114-173`.

### 4.2 Builder list contract

GET `/api/trainer/workout-builder/templates` returns own draft, published and archived templates with rich items. `WorkoutBuilderRepository.list` first reads all heads, then calls `hydrate` for every row. Each hydration performs an exercise query and a set query.

This is useful for Builder but is an N+1 read shape for a long Quick Assign list and must not become the R2C provider.

Evidence: `lib/server/workouts/workout-builder-repository.ts:32-40`, `:103-108`, `:234-248`.

### 4.3 Demo Quick Assign contract

`quick-assign-model.ts` contains inline templates, fabricated recent/favourite/suitable attributes and static recent assignments. It imports profile and home mock data.

Evidence: `components/trainer-os/quick-assign/quick-assign-model.ts:1-2`, `:33-48`, `:99-215`, `:344-352`.

It may inform progressive disclosure, search, mobile behavior and receipt language. It must not supply production facts.

### 4.4 Direct simple template API

POST `/api/trainer/workout-templates` still creates an immediately published simple template through `WorkoutService.createTemplate`. Builder has a richer draft/revision/publish lifecycle. Both write the same PostgreSQL aggregate, but expose different authoring contracts.

R2C reads the resulting canonical published revision and does not decide which authoring surface created it.

## 5. Existing assignment command

The only canonical command is:

```ts
WorkoutService.createAssignment(actor, {
  assignmentId,
  athleteUserId,
  templateId,
  scheduledFor,
  trainerNote,
})
```

Current command sequence:

1. Validate UUIDs, date and trainer note.
2. Start a database transaction and set actor context.
3. Check existing Assignment by caller-provided `assignmentId`.
4. For an existing visible Assignment, compare trainer, athlete, template, date and note.
5. Lock the active trainer-athlete relation with `FOR UPDATE`.
6. Load trainer-owned published template and its current revision.
7. Load all exercises from that revision.
8. Insert Assignment top-level snapshot.
9. Copy every exercise snapshot.
10. Copy every per-set snapshot.
11. Write audit event and notification outbox event.
12. Return the persisted Assignment.

Evidence: `lib/server/workouts/workout-service.ts:108-120`, `lib/server/workouts/workout-repository.ts:217-388`.

The API additionally:

- requires same-origin POST;
- requires an active trainer capability;
- decodes R2A.3 context only after persistence;
- builds `TrainerWorkflowTransition`;
- revalidates Dashboard, Queue, Roster, Profile and Client paths;
- maps idempotency conflict to HTTP 409.

Evidence: `app/api/workout-assignments/route.ts:31-68`, `lib/server/trainer-workflow/revalidation.ts:5-16`.

Transition context is navigation metadata, not authorization evidence. Athlete and template access are re-derived from actor-scoped PostgreSQL queries and RLS.

## 6. Current Quick Assign divergence map

| Concern | Canonical roster dialog | Builder assignment dialog | Demo QuickAssignDrawer | Target R2C |
| --- | --- | --- | --- | --- |
| Data source | PostgreSQL published list | PostgreSQL Builder draft in memory | Mock/demo runtime | PostgreSQL QuickAssignReadModel |
| Template version sent | `templateId` only | `templateId` only | local revision number | exact `templateRevisionId` |
| Template selection | native select, first row preselected | template fixed by Builder | searchable cards | explicit selection; preselect only from trusted Builder return |
| Search/pagination | none | not applicable | local search/groups | server search + cursor pagination |
| Preview | title + exercise count | title only | rich local preview | canonical selected revision preview |
| Date default | browser-local today | browser-local today | tomorrow | explicit visible default; timezone decision open |
| Editable instruction | no | no | yes | no |
| Exercise overrides | no | no | yes, local | no in R2C Core |
| Existing future Assignment | not shown | not shown | static client-side warning | canonical warning + transactional stale guard |
| Relation suspended | submit fails generically | submit fails generically | mock block | read capability false + server enforcement |
| Idempotency | stable ID per dialog retry | stable ID per dialog retry | local runtime receipt | stable assignment ID + exact revision + state token |
| Receipt | local message | R2A.3 return | local custom receipt | R2A.3 only |
| Return | roster reload | transition return | custom callbacks | Profile / Queue / Next item |

Additional divergence:

- Profile, Dashboard and R2A.3 assignment next item navigate to Builder instead of Quick Assign.
- Roster dialog catches every non-2xx response as one generic error and discards API error taxonomy.
- Current API uses one 404 for missing relation, foreign template, draft template and archived template.
- Current `WorkoutAssignment` response exposes revision number but not `sourceRevisionId`, even though PostgreSQL stores it.
- Demo “suitable”, “recent” and “favourite” values have no canonical persistence source.

## 7. Proposed QuickAssignReadModel

This is a read model, not a new domain entity. Field names below are a target contract validated against the existing schema.

```ts
type QuickAssignReadModel = {
  readAt: string;
  athlete: {
    athleteUserId: string;
    relationId: string;
    displayName: string;
    initials: string;
    relationStatus: "active" | "suspended";
    athleteStatus: "active" | "suspended" | "archived";
    current: {
      nextAssignment: {
        assignmentId: string;
        title: string;
        scheduledFor: string;
      } | null;
      upcomingAssignmentCount: number;
      assignmentStateToken: string;
    };
  };
  templates: {
    items: QuickAssignTemplateListItem[];
    pageInfo: {
      endCursor: string | null;
      hasNextPage: boolean;
    };
    search: {
      query: string;
      pageSize: number;
    };
  };
  selectedTemplate: QuickAssignTemplatePreview | null;
  assignmentDefaults: {
    scheduledFor: string | null;
    minScheduledFor: string;
    trainerNote: string;
  };
  capabilities: {
    canAssign: boolean;
    canSearchTemplates: boolean;
    canOpenBuilder: boolean;
    canConfirmAdditionalAssignment: boolean;
    blockedReason:
      | "relation_suspended"
      | "athlete_unavailable"
      | "trainer_unavailable"
      | null;
  };
  dataAvailability: {
    athlete: "ready" | "unavailable";
    templates: "ready" | "error";
    preview: "idle" | "loading" | "ready" | "stale" | "error";
  };
};

type QuickAssignTemplateListItem = {
  templateId: string;
  revisionId: string;
  revisionNumber: number;
  title: string;
  description: string;
  category: string;
  status: "published";
  exerciseCount: number;
  prescribedSetCount: number;
  estimatedDurationMin: number | null;
  supersetCount: number;
  updatedAt: string;
  eligibility: {
    assignable: boolean;
    reason: "ready" | "empty" | "stale" | "archived" | "draft";
  };
};

type QuickAssignTemplatePreview = QuickAssignTemplateListItem & {
  generalInstruction: string;
  exercises: Array<{
    templateExerciseId: string;
    instanceKey: string;
    position: number;
    title: string;
    category: string;
    equipment: string | null;
    prescriptionType: "repetitions" | "duration";
    repetitionMode: "fixed" | "range";
    sets: number;
    repetitionsMin: number | null;
    repetitionsMax: number | null;
    durationSeconds: number | null;
    targetWeightKg: number | null;
    restSeconds: number;
    trainerNote: string;
    superset: {
      key: string;
      position: number;
      label: string;
      instruction: string;
    } | null;
    setPrescriptions: Array<{
      templateSetId: string;
      setKey: string;
      position: number;
      kind: "warmup" | "working";
      repetitionsMin: number | null;
      repetitionsMax: number | null;
      durationSeconds: number | null;
      targetWeightKg: number | null;
      restSeconds: number;
      usesOverride: boolean;
    }>;
  }>;
};
```

### 7.1 Schema alignment

- Athlete/relation context exists in `trainer_athlete_relations`, `users` and `athlete_profiles`.
- Template/revision identity, title, description, category and estimated duration exist.
- Exercise and per-set preview fields exist in migrations 0005/0006.
- Exercise/set counts and superset count are set-based aggregates, not new facts.
- “Suitable”, “favourite”, “focus” and AI score are intentionally absent because no canonical source exists.
- `assignmentStateToken` is an opaque read-time concurrency token derived from canonical upcoming Assignment IDs/status/dates; it is not persisted as a new entity.

## 8. Template selection contract

### 8.1 Available templates

Default selection contains only the trainer's current published, non-archived templates with at least one exercise. Drafts and archived templates are not assignable.

Quick Assign must not silently select the first returned template. Initial selection is `null` except when Builder returns an exact newly published revision identity. A preselection is valid only if the read model confirms the same trainer-owned current published revision.

### 8.2 Sorting

Canonical order:

```text
template.updated_at DESC, template.id DESC
```

No “recommended” order is permitted without a persisted rule. Usage count may be shown later because it is derivable from Assignments, but must not silently become recommendation logic.

### 8.3 Search

Server search may match canonical `revision.title`, `revision.description` and `revision.category`. Search does not inspect athlete goal, mock focus tags or exercise descriptions in v1.

### 8.4 Archived templates

Archived templates are hidden from the default selection list. If a preselected revision becomes archived between entry and read, Quick Assign returns a non-assignable tombstone state so the trainer understands why selection disappeared. It must not offer an archive override.

The archive mechanism already exists through `WorkoutBuilderService.archive`, its API route and the archive immutability trigger: `lib/server/workouts/workout-builder-service.ts:177-179`, `app/api/trainer/workout-builder/templates/[templateId]/archive/route.ts:10-27`, `database/migrations/0006_workout_builder_lifecycle.up.sql:201-214`.

### 8.5 Stale revision

If `templateRevisionId` is no longer the current published revision at submit, command returns HTTP 409 `template_revision_stale`. It does not upgrade to the latest revision automatically. The UI reloads list and preview; trainer must confirm the new facts.

### 8.6 Long list and pagination

Use cursor pagination with a deterministic `(updated_at, template_id)` cursor and a bounded page size, initially 25. Search resets the cursor. “Показать ещё” appends rows without a second local cache.

### 8.7 No templates

Show an empty state with one secondary action to Builder. Preserve athlete and R2A.3 context. Builder may save/publish a template, but Assignment is still created only through `createAssignment` after publication.

## 9. Assignment snapshot contract

Before confirmation Quick Assign shows only facts that will be copied or identify the source:

- athlete identity;
- template title;
- exact revision number;
- exercise count;
- prescribed set count;
- stored estimated duration, only when non-null;
- general instruction;
- compact exercise structure and per-set prescriptions through progressive disclosure;
- selected date;
- assignment-specific trainer note;
- existing future assignment warning, when applicable.

### 9.1 Copied top-level fields

| Source | Assignment field |
| --- | --- |
| Template ID | `source_template_id` |
| Exact revision ID | `source_revision_id` |
| Revision number | `source_revision_number` |
| Revision title | `title_snapshot` |
| Revision general instruction | `instruction_snapshot` |
| Quick Assign input | `trainer_note` |
| Quick Assign input | `scheduled_for` |

Template description, template category and estimated duration are not currently copied to the Assignment row. They may be shown as source preview facts but must not be described as assignment snapshots.

### 9.2 Copied exercise fields

The repository copies source exercise ID, instance key, order, title, sets, repetitions, target weight, rest, trainer note, source exercise key, category, equipment, prescription type, repetition mode, repetition range, duration, per-set mode and complete superset metadata.

Evidence: `lib/server/workouts/workout-repository.ts:315-353`.

### 9.3 Copied set fields

For each source set it copies source set ID, set key, order, kind, repetition range, duration, target weight, rest and `uses_override`.

Evidence: `lib/server/workouts/workout-repository.ts:354-366`.

### 9.4 Independence guarantee

Assignment rows point to source identities for provenance but all execution prescriptions are read from assignment snapshots. Published revision is immutable, and later draft/revision changes do not update existing Assignment snapshots.

PostgreSQL tests prove top-level and per-set independence: `tests/backend-foundation/workout-flow-postgres.test.ts:79-130`, `tests/backend-foundation/workout-builder-postgres.test.ts:130-199`.

## 10. Editable versus immutable assignment fields

### 10.1 Editable inside R2C before submit

- `scheduledFor`;
- `trainerNote`;
- explicit confirmation that an additional Assignment is intended when current canonical facts show a conflict.

### 10.2 Fixed by entry/read model

- athlete identity;
- relation identity;
- selected template identity;
- exact template revision identity.

Changing athlete means closing the current Quick Assign and opening a new athlete context. It is not a dropdown substitution inside an existing command.

### 10.3 Immutable template-derived facts

- title and general instruction;
- exercise composition and order;
- exercise prescription;
- per-set prescription;
- superset structure;
- template description/category/duration source facts.

### 10.4 Explicitly excluded from R2C Core

- editing general instruction for one Assignment;
- exercise-level sets/reps/weight overrides;
- adding, deleting or reordering exercises;
- changing supersets;
- publishing a draft;
- editing/archiving Template;
- creating Program or ProgramAssignment;
- modifying an existing Assignment.

The demo drawer's overrides are not compatible with current production policy: RLS requires assignment exercise/set snapshots to equal source template values (`database/migrations/0006_workout_builder_lifecycle.up.sql:256-291`, `:431-452`). Supporting overrides would require a separate product/schema/policy decision and is not a blocker for R2C.

## 11. Idempotency and concurrency

### 11.1 Target command input

The same service method remains owner of the command:

```ts
WorkoutService.createAssignment(actor, {
  assignmentId,
  athleteUserId,
  templateId,
  templateRevisionId,
  scheduledFor,
  trainerNote,
  assignmentStateToken,
  allowAdditionalAssignment,
})
```

`transitionContext` remains an API envelope concern and is not passed as authorization evidence to the repository.

### 11.2 Duplicate identical submit

Client creates one UUID per logical submit and retains it across network retries. Repository checks existing Assignment before current-state validation. Same ID and same athlete/template/revision/date/note returns the original Assignment and produces no second audit/outbox event.

This behavior already exists for athlete/template/date/note and is covered at `tests/backend-foundation/workout-builder-postgres.test.ts:147-167`. R2C adds exact revision identity to replay comparison.

### 11.3 Modified retry

Same `assignmentId` with any changed payload returns HTTP 409 `assignment_idempotency_conflict`. UI must clear the logical key only after the trainer changes the draft intentionally, then submit with a new ID.

Current conflict behavior: `lib/server/workouts/workout-repository.ts:468-479`, `app/api/workout-assignments/route.ts:60-62`.

### 11.4 Existing future Assignment

Multiple future Assignments are already canonical: R2A exposes `upcomingAssignmentCount` and `nextAssignment.primary` (`lib/server/athlete-profile/athlete-training-repository.ts:153-168`, `:212-218`). Therefore the mere existence of a future Assignment is not an unconditional error.

Rules:

- show current next Assignment and total upcoming count;
- exact same template revision and date is treated as a likely duplicate and blocked unless it is an idempotent replay;
- another Assignment on the same date requires explicit `allowAdditionalAssignment` confirmation;
- another future Assignment on another date is informational;
- all cases still use `assignmentStateToken` to detect concurrent changes.

### 11.5 Concurrent assignment from another tab

The repository already locks the active relation row with `FOR UPDATE`, so commands for one relation can be serialized. While holding that lock, it should recompute the opaque token from available, unstarted upcoming Assignments.

If the token differs from the read model token, return HTTP 409 `assignment_state_changed` and no insert. UI reloads athlete state and asks for a new confirmation. No unique constraint or migration is required.

### 11.6 Template archived or revised between read and submit

- exact revision is no longer current: `409 template_revision_stale`;
- template/revision is archived, draft or otherwise unavailable: `409 template_unavailable`;
- template belongs to another trainer: fail closed as `404 template_not_found` or the existing non-enumerating equivalent;
- no automatic fallback to another revision.

### 11.7 Relation suspended between read and submit

The transaction's active relation query remains authoritative. If relation is no longer active, return `409 athlete_relation_changed` or `403 assignment_forbidden`; do not trust read-time capability or transition context.

## 12. Permissions matrix

| Actor/situation | Read athlete context | See template | Preview | Assign | Enforcement |
| --- | --- | --- | --- | --- | --- |
| Active trainer + own active relation + own published template | Yes | Yes | Yes | Yes | Access guard + actor-scoped SQL + RLS |
| Active trainer + suspended relation | Limited identity/status | Own templates may load | Optional read-only | No | relation status and capability false |
| Active trainer + ended/no relation | No Quick Assign model | Own templates irrelevant | No | No | fail closed |
| Inactive trainer | No | No | No | No | `AccessService` trainer status |
| Foreign athlete substitution | No | Own templates only | No athlete-bound preview | No | relation predicate + RLS |
| Foreign template substitution | Athlete may be valid | Foreign template hidden | No | No | owner predicate + RLS |
| Draft/archived own template | Athlete valid | Not in assignable list | Tombstone only when stale/preselected | No | template/revision status |
| Athlete actor | No trainer Quick Assign | No | No | No | role capability and RLS |

Production evidence:

- Active relation is checked and locked in `lib/server/workouts/workout-repository.ts:229-235`.
- Template owner/status is checked in `lib/server/workouts/workout-repository.ts:244-255`.
- RLS repeats relation, owner, status and snapshot checks in migrations 0005/0006.
- Cross-trainer/athlete isolation is covered by `tests/backend-foundation/workout-flow-postgres.test.ts:132-169`.
- Ended relation blocks future assignment while preserving athlete history: `tests/backend-foundation/workout-flow-postgres.test.ts:171-215`.

## 13. Entry, transition and return map

R2A.3 remains the only transition envelope and completion receipt. Quick Assign does not invent per-surface callbacks as authoritative workflow state.

### 13.1 Canonical contextual host

Use one shared Quick Assign surface. It may render as a dialog/sheet, but must be addressable through the athlete profile route for cross-route transitions:

```text
/trainer/clients/{athleteId}?tab=training&assign=1&flow={R2A.3 context}
```

This is URL state on an existing route, not a new product route. The server still re-derives athlete scope. `assign=1` opens presentation only and grants no permission.

### 13.2 Entry matrix

| Origin | Context | Quick Assign behavior | Successful return |
| --- | --- | --- | --- |
| Dashboard no-assignment item | athlete, queue filter/order/position, return dashboard | Open canonical surface directly, not Builder | `transition.returnHref` Dashboard receipt; Queue/Next available |
| Athlete Profile Header | athlete, return profile Training tab, `next-assignment` anchor | Open within current profile | Profile receipt focused on next Assignment |
| Clients roster | athlete, origin clients | Open same shared surface from row or profile-host URL | Inline receipt or Profile receipt; Roster reloads from canonical facts |
| Review completion | reviewed athlete/session context, Review already independently closed | Optional “Назначить следующую” entry; never part of review resolution transaction | Profile / Queue / Next item from R2A.3 |
| Direct contextual invocation | exact athlete ID, origin direct | Validate relation and show neutral reason | Profile receipt |
| Builder after publish | athlete + original flow + exact newly published revision | Reopen shared surface with verified preselection | Original R2A.3 return intent |

### 13.3 No suitable template to Builder

Quick Assign passes:

- athlete ID;
- R2A.3 `flow`;
- safe return intent;
- no unsaved assignment prescription.

Builder saves and publishes through its existing lifecycle. “Опубликовать и назначить” must then invoke the shared Quick Assign contract with the published `templateId + revisionId`. Builder must not create a local Assignment mutation and must not assign an unsaved draft.

### 13.4 Completion receipt

The POST response continues to return `TrainerWorkflowTransition` from `TrainerWorkflowTransitionService.forAssignment`: Profile receipt, Queue href, return href, next item and all-calm state (`lib/server/trainer-workflow/trainer-workflow-transition-service.ts:60-93`).

The surface navigates to `transition.returnHref` or shows the same receipt actions before navigation. It does not calculate the next queue item locally.

## 14. Empty, loading, error and stale states

| State | Required behavior |
| --- | --- |
| Initial loading | Preserve athlete/context shell; announce loading; no enabled submit |
| Athlete unavailable | Fail closed; return to Roster/Dashboard; no template facts borrowed from another athlete |
| Suspended relation | Show athlete identity and blocked reason; Profile is available; assignment controls disabled |
| Templates loading | Athlete context remains; skeleton/list progress; no first-item auto-selection |
| No published templates | Explain that saved draft is not assignable; offer Builder with preserved flow |
| Search empty | Preserve query; clear search and Builder secondary actions |
| Long list | Cursor “Показать ещё”; selected row remains stable across append |
| Preview loading | Keep selected list row; disable submit until exact revision preview is ready |
| Partial preview error | Keep list; allow retry preview; do not infer missing exercises/sets |
| Stale revision | Mark old selection unavailable; load new current revision as an unselected option |
| Archived between read/submit | Keep command draft; show unavailable reason; require new template selection |
| Existing upcoming work | Show primary next Assignment and count; warn according to conflict rules |
| Concurrent state change | 409; reload athlete state; preserve date/note; require reconfirmation |
| Identical retry receipt | Show original Assignment receipt; label as already saved only if API reports replay |
| Network/5xx | Preserve exact logical `assignmentId`, selected revision, date and note for retry |
| Transition refresh warning | State that Assignment is saved; offer manual Profile/Queue navigation |

## 15. Performance and N+1 assessment

### 15.1 Current risks

- `WorkoutBuilderRepository.list` has one head query plus two hydration queries per template. It is unsuitable for Quick Assign long lists.
- `WorkoutRepository.listTemplates` uses one aggregate query and avoids N+1, but over-hydrates all basic exercises, has no pagination/search, and omits rich per-set preview facts.
- Demo drawer filters a complete in-memory list and is not production evidence.

### 15.2 Target query shape

Read model should use:

1. one actor-scoped athlete/relation/current-assignment query;
2. one set-based paginated template summary query;
3. only when selected, one exact revision/exercise query plus one set query, or one bounded JSON aggregate query;
4. no query per template;
5. no localStorage/demo/runtime source;
6. no parallel client cache beyond normal component request state.

Summary query computes `exerciseCount`, `prescribedSetCount` and `supersetCount` in SQL. It must not load all exercise bodies for every list row.

The existing `(trainer_user_id, status, updated_at DESC)` index supports owner/status ordering (`database/migrations/0005_workout_templates_and_assignments.up.sql:128-139`). Cursor tie-break uses template ID. Search performance should be measured before adding an index; no migration is justified by current evidence alone.

## 16. Component reuse map

| Existing component/module | R2C decision | Reason |
| --- | --- | --- |
| `CanonicalRosterAssignmentDialog` | Replace internals or wrap shared R2C surface | Uses production API and good idempotency ID retention, but read/preview is too small |
| `CanonicalBuilderAssignmentDialog` | Replace with shared R2C surface in contextual preselected mode | Uses production command/transition correctly but duplicates form and lacks revision binding |
| Demo `QuickAssignDrawer` shell | UX evidence only; selective presentation reuse | Good search, mobile, progressive disclosure and receipt language; data/command are noncanonical |
| Demo `quick-assign-model.ts` | Do not reuse as production model | Imports mocks and contains unsupported fields/overrides |
| `WorkoutService.createAssignment` | Keep as sole command owner; extend input validation | Existing transaction and snapshot behavior are canonical |
| `PostgresWorkoutRepository.createAssignment` | Keep; bind exact revision and stale token | Existing relation lock, snapshot copy, audit and outbox are correct foundations |
| `TrainerWorkflowTransitionService.forAssignment` | Reuse unchanged as receipt owner | Already produces Profile/Queue/Next destinations |
| `revalidateTrainerWorkflow` | Reuse | Covers trainer and client paths |
| `WorkoutBuilderRepository.list` | Do not use for Quick Assign list | N+1 hydration and authoring-oriented shape |
| `WorkoutRepository.listTemplates` | Candidate query foundation, not final contract | Set-based but unbounded/over-hydrated and revision-light |
| R2A `AthleteTrainingRepository` facts | Reuse or compose | Canonical next/upcoming Assignment facts and relation capabilities |
| Dashboard repository | Reuse post-command projection | Canonical no-assignment and activity projections |

Preview Drawer is explicitly out of scope. Selected-template preview belongs inside the shared Quick Assign surface through progressive disclosure.

## 17. Are API changes or migrations required?

### API/read contract

**Required.** Existing reads cannot provide the target set-based list, exact revision preview, stale tombstone, relation capability and assignment concurrency token without over-hydration or N+1.

Preferred implementation options, in order:

1. Extend GET `/api/trainer/workout-templates` into an athlete-aware paginated Quick Assign read response with optional exact preview parameters.
2. If backward compatibility would make that contract ambiguous, add a trainer-scoped read-only Quick Assign endpoint.

This decision concerns a read API only, not a new mutation command.

### Assignment POST contract

**Required extension of existing endpoint.** Add exact `templateRevisionId`, assignment state token and explicit additional-assignment confirmation; add actionable 409 errors. Continue calling only `WorkoutService.createAssignment`.

### Migrations

**Not required by confirmed evidence.** Exact revision IDs, snapshots, statuses, archive lifecycle, relation lock target and all preview facts already exist. Concurrency can be checked transactionally under the existing relation row lock.

A future search index may be considered only after measured query evidence. Exercise overrides would require a separate migration/policy decision and are excluded.

## 18. Implementation sequence

1. Add `QuickAssignReadModel` types and pure projector/query contract tests.
2. Implement actor-scoped repository query for athlete context and paginated template summaries.
3. Implement exact selected revision preview without N+1.
4. Extend `WorkoutService.createAssignment` validation with `templateRevisionId` and concurrency fields.
5. Extend repository transaction to validate exact current published revision and assignment state token under relation lock.
6. Extend replay fingerprint and `WorkoutAssignment` response with source revision identity.
7. Add HTTP error mapping for stale revision, unavailable template, relation change and assignment state change.
8. Build one shared production Quick Assign surface from the read model.
9. Replace Roster dialog internals with the shared surface.
10. Redirect Profile Header and Dashboard assignment entries to the shared surface instead of Builder.
11. Update R2A.3 assignment `nextItem.href` to the profile-hosted Quick Assign state while preserving the transition envelope.
12. Add optional Review receipt entry for the reviewed athlete without coupling it to Review resolution.
13. Adapt Builder “Опубликовать и назначить” to open shared Quick Assign with exact published revision preselected.
14. Verify Profile, Dashboard and Client projections after success and navigation/refresh.
15. Add PostgreSQL, service/API, projector/UI and three-role E2E coverage.

No Builder redesign and no Preview Drawer implementation belong to this sequence.

## 19. Acceptance criteria

1. Every production entry opens one shared Quick Assign contract for one exact athlete.
2. Athlete substitution is rejected server-side.
3. Only the actor's current published non-archived revisions are selectable.
4. No unsaved or saved-draft prescription can be assigned.
5. No template is silently selected by list order.
6. Preview identifies exact `templateRevisionId` and displays only canonical facts.
7. Submit assigns exactly the revision that was previewed or returns a stale conflict.
8. Assignment copies all existing top-level, exercise and per-set snapshots.
9. Assignment never mutates Template or TemplateRevision.
10. Editing/publishing a later Template revision does not alter an existing Assignment.
11. Only date and assignment trainer note are editable in R2C Core.
12. Identical retry with one logical `assignmentId` returns one Assignment.
13. Same ID with changed payload returns 409 and does not mutate the first Assignment.
14. Concurrent different-ID submit cannot silently bypass changed upcoming-assignment state.
15. Suspended/ended relation blocks assignment even if UI was opened earlier.
16. Archived/draft/stale template cannot be assigned.
17. Foreign template and athlete substitutions fail closed without data leakage.
18. List query is set-based, paginated and performs no per-template hydration.
19. Selected preview loads only for the selected revision.
20. Successful POST returns R2A.3 receipt with Profile, Queue and Next item destinations.
21. Profile and Dashboard no-assignment projections disappear after canonical refresh.
22. Client receives the same Assignment ID and snapshot through `/api/workout-assignments`.
23. No mock/demo/localStorage facts participate in production behavior.
24. Program and ProgramAssignment are absent.
25. PostgreSQL tests cover exact revision, snapshots, replay, modified retry, stale revision, archive race, relation race and concurrent assignment.

## 20. Risks and open decisions

### Confirmed risks

1. **Silent revision drift:** current command resolves `current_revision` at submit from `templateId` only.
2. **Concurrent duplicate:** different assignment IDs are not compared against a read-time future-assignment state.
3. **Read divergence:** production Roster, Builder and demo Quick Assign use three different models.
4. **Entry divergence:** Profile, Dashboard and R2A.3 next assignment send the trainer to Builder.
5. **N+1 temptation:** Builder list is rich but unsuitable as Quick Assign provider.
6. **Generic failures:** current dialogs hide stale/archive/relation/idempotency distinctions.
7. **Client freshness:** `revalidatePath` invalidates server paths, but an already-open client browser does not receive real-time push; the assignment appears on navigation, refresh or explicit reload.
8. **Legacy type loss:** current `WorkoutAssignment` response exposes only simplified exercise facts and revision number, not full source revision identity.

### Open product decisions

1. Should `scheduledFor` default to today, tomorrow or remain empty? Current production dialogs use browser-local today; demo uses tomorrow. No accepted timezone/default decision was found.
2. Should a second Assignment on the same date be allowed after explicit confirmation, or blocked in MVP?
3. Should Quick Assign expose archived/draft tombstones only for stale direct selection, or also via an optional status filter? Recommendation: tombstone only.
4. Should search remain title/description/category only, or include exercise titles? Recommendation: start narrow and measure.
5. Should usage count affect sorting? Recommendation: display only if useful; do not call it recommendation.
6. Should Roster success stay inline or always navigate to Profile receipt? R2A.3 supports both; one interaction rule should be selected during R2C design.
7. Should Review receipt show same-athlete “Назначить следующую” even when another queue item has higher global priority? Recommendation: keep it secondary; R2A.3 next item remains the primary queue action.

No open decision above justifies a schema migration now.

## 21. Scope confirmation

This architecture pass created only:

- `docs/quick-assign-r2c-architecture-v1.md`.

It did not:

- change production code;
- change UI;
- change routes;
- change API handlers or contracts;
- create or alter migrations;
- modify PostgreSQL schema;
- add mock/demo/localStorage facts;
- redesign Builder;
- implement Preview Drawer;
- create Program or ProgramAssignment;
- create a commit.
