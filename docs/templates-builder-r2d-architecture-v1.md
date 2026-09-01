# R2D — Templates Workspace и canonical WorkoutTemplate Builder

Статус: architecture audit, implementation не начата
Checkpoint evidence: `bf3df970fb85cfe02b9298f444c2d11a1837b189`
Рабочая ветка при аудите: `codex/r2c3-quick-assign-convergence`
Дата аудита: 2026-09-01

## 1. Executive verdict

R2D нельзя реализовывать как визуальную перестройку текущего `/trainer/builder`. Существующий PostgreSQL aggregate пригоден как основа, immutable Published Revision и независимый Assignment snapshot уже реализованы, но перед production Workspace и Editor нужны два доменных решения и несколько hardening-изменений.

**Критический blocker R2D-01 подтверждён.** `createRevision` переводит весь Template в `draft` и меняет `current_revision` на новую Draft Revision (`lib/server/workouts/workout-builder-repository.ts:167-216`). Quick Assign читает только `template.current_revision` и требует одновременно `template.status = 'published'` и `revision.status = 'published'` (`lib/server/quick-assign/quick-assign-repository.ts:190-234`). Поэтому предыдущая Published Revision перестаёт быть назначаемой на всё время редактирования новой версии. Это поведение закреплено тестом как `stale_revision` (`tests/backend-foundation/quick-assign-postgres.test.ts:207-228`), но отдельного принятого продуктового решения, запрещающего назначать последнюю опубликованную версию во время редактирования Draft, не найдено.

**Рекомендация:** Template должен одновременно указывать на последнюю assignable Published Revision и не более чем одну editable Draft Revision. Для этого нужен явный published pointer, а не вывод assignability из единственного `current_revision` и общего `template.status`. Это migration blocker до production Workspace, потому что статус строки Workspace иначе остаётся неоднозначным, и blocker до Editor, потому что команда «Создать новую версию» ломает Quick Assign.

**Второй blocker до production Editor:** библиотека упражнений в production-ветке Builder берётся из `getDemoLibraryExercises()` (`components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:90`), а отдельная trainer library route также показывает demo-компонент (`app/trainer/library/page.tsx:1-17`). Существующая legacy-библиотека Supabase не является PostgreSQL source of truth (`lib/exercise-library.ts:1-119`). Нужен canonical PostgreSQL library read boundary либо явное решение о минимальной seeded system library.

**Третий обязательный hardening до пилота:** save Draft выполняет полную замену aggregate без expected-version и idempotency contract (`lib/server/workouts/workout-builder-repository.ts:111-147`, `:251-290`). Две вкладки могут молча перезаписать изменения друг друга; повтор неизвестного результата создания может создать второй Template.

Целевая архитектура:

```text
Templates Workspace read model
  -> открыть/создать Template
WorkoutTemplate Editor read model
  -> сохранить Draft Revision
  -> отдельно опубликовать Revision
  -> вернуться в Workspace

Quick Assign
  -> handoff token
  -> Editor
  -> publish exact Revision
  -> handoff exact revisionId обратно
  -> canonical GET verification
  -> отдельный createAssignment submit
```

Assignment не входит в command ownership Builder. Program, ProgramAssignment, AI generation и assignment form в R2D не участвуют.

## 2. Evidence method and scope

### Evidence labels

| Label | Значение |
| --- | --- |
| `E` | Confirmed code evidence: route/import/query/schema/test проверены в repository |
| `D` | Accepted product decision: явно зафиксировано в принятых документах или условиях R2D |
| `P` | Prototype evidence: полезная гипотеза UI, не production contract |
| `A` | Proposed architecture decision: рекомендация этого аудита |
| `O` | Open product/founder decision |

Аудит выполнен по фактическим routes, import graph, service/repository/API, PostgreSQL migrations, RLS/triggers, UI components и tests. Наличие файла само по себе не считалось production evidence. Для смешанных экранов проверена ветка `NEXT_PUBLIC_DEMO_MODE=false`.

Основные источники:

- route и query contract: `app/trainer/builder/page.tsx:1-25`;
- primary navigation: `components/trainer/trainer-shell.tsx:63-114`, `:180-188`;
- current composition и demo/production branch: `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:59-121`, `:412-511`;
- canonical service/repository: `lib/server/workouts/workout-builder-service.ts:124-179`, `lib/server/workouts/workout-builder-repository.ts:100-290`;
- schema и lifecycle: `database/migrations/0005_workout_templates_and_assignments.up.sql:12-139`, `database/migrations/0006_workout_builder_lifecycle.up.sql:1-249`;
- RLS/grants: `database/migrations/0005_workout_templates_and_assignments.up.sql:174-318`, `database/migrations/0006_workout_builder_lifecycle.up.sql:293-463`;
- Quick Assign exact revision: `lib/server/quick-assign/quick-assign-repository.ts:175-347`;
- current UI model: `components/trainer-os/workout-template-builder/builder-model.ts:1-359`;
- PostgreSQL tests: `tests/backend-foundation/workout-builder-postgres.test.ts:72-201`, `tests/backend-foundation/quick-assign-postgres.test.ts:123-228`, `:353-403`;
- E2E prototype flows: `tests/e2e/trainer-core-flow.spec.ts:40-110`, `:172-225`.

Не запускались production mutations и migrations. R2C.3 working tree использовался как текущее evidence и не изменялся.

## 3. Current implementation map

| Surface | Route/component | Data/command path | Branch | Verdict |
| --- | --- | --- | --- | --- |
| Templates + Editor | `/trainer/builder` -> `WorkoutTemplateBuilderPage` | mixed local state + Builder API | demo and production | One route and one client component switch between Workspace/Editor |
| Primary nav | `TrainerShell` item `Шаблоны` | href `/trainer/builder` | production shell | Accepted destination label, route semantics unresolved |
| Workspace | `TemplatesWorkspace` | receives all hydrated templates | mixed | Prototype composition; not scalable read boundary |
| Editor | `BuilderEditor` | full local draft | mixed | Reuse evidence; production library is still demo |
| Draft persistence | Builder API -> `WorkoutBuilderService` -> repository | PostgreSQL | production | Canonical foundation, concurrency incomplete |
| Draft recovery | `builder-draft-persistence.ts` | `sessionStorage` | both | Ephemeral same-tab recovery only |
| Quick Assign return | handoff helper + profile-hosted sheet | `sessionStorage` token + canonical GET | production R2C.3 | Correct command boundary |
| Legacy templates API | `/api/trainer/workout-templates` | `WorkoutService.createTemplate` | production | Creates immediately Published simple template; divergent authoring contract |
| Trainer library route | `/trainer/library` | `DemoClientLibraryContent` | current route | Demo-only facts behind a production-looking route |
| Legacy exercise library | `lib/exercise-library.ts` | Supabase + fallback | legacy | Not canonical PostgreSQL boundary |

Current `/trainer/builder` accepts `templateId`, athlete/client aliases, return and handoff parameters, then resolves the editor after loading the entire list (`app/trainer/builder/page.tsx:1-25`; `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:99-148`). Direct reload therefore depends on list hydration, not an exact editor read.

## 4. Production/demo/legacy import map

### Production branch

```text
/trainer/builder
  -> WorkoutTemplateBuilderPage
     -> loadCanonicalBuilderTemplates()
        -> GET /api/trainer/workout-builder/templates
           -> WorkoutBuilderService.list
              -> WorkoutBuilderRepository.list
     -> save/publish/createRevision/archive Builder APIs
     -> R2C handoff helpers
     -> BuilderEditor
        -> ExerciseLibraryPanel
        -> ExerciseDetailSheet
```

`E`: production list/save/publish path is PostgreSQL-backed (`components/trainer-os/workout-template-builder/canonical-builder-client.ts:1-47`). Assignment POST is absent from production Builder; the old `QuickAssignDrawer` is rendered only when `demoMode` is true (`workout-template-builder-page.tsx:511`).

### Mixed dependency that breaks production purity

`E`: `libraryExercises` always comes from `getDemoLibraryExercises()` before branch-specific rendering (`workout-template-builder-page.tsx:21`, `:90`). Therefore production Editor is not free of demo facts.

`E`: same-tab recovery imports `registerDemoTransientReset`, although its storage behavior is generic (`builder-draft-persistence.ts:3-15`). This is coupling to remove or isolate, not a domain source-of-truth breach while PostgreSQL remains authoritative.

### Demo branch

- initial templates from `getDemoBuilderTemplates()`;
- local lifecycle helpers in `builder-model.ts`;
- `QuickAssignDrawer` and demo runtime assignment;
- demo library and demo quick-start examples.

These are valid interaction evidence only. They cannot define statuses, counts, eligibility, ownership or persistence.

### Legacy/prototype surfaces

- `/api/trainer/workout-templates` immediately creates a Published Revision through `WorkoutService.createTemplate` (`app/api/trainer/workout-templates/route.ts:35-56`, `lib/server/workouts/workout-service.ts:101-107`).
- `lib/exercise-library.ts` uses Supabase tables and a legacy fallback (`lib/exercise-library.ts:89-119`).
- `WorkoutExerciseCard`, `WorkoutSupersetBlockCard` and `WorkoutFormHeader` are not imported by the current Builder family; only the first two import each other. They are presentation prototypes, not active production composition.
- old `/trainer/*` pages link to `/trainer/builder` with `clientId`/`programId`; these links are compatibility/legacy evidence and must not introduce athlete or Program ownership into canonical Builder.

## 5. Canonical entity lifecycle

### Persisted graph

```text
TrainerProfile (owner)
  1 -> N WorkoutTemplate
WorkoutTemplate
  1 -> N WorkoutTemplateRevision
WorkoutTemplateRevision
  1 -> N WorkoutTemplateExercise
WorkoutTemplateExercise
  0 -> N WorkoutTemplateExerciseSet

WorkoutTemplateExercise
  carries optional superset metadata

Published WorkoutTemplateRevision
  -> createAssignment
  -> WorkoutAssignment independent snapshot
     -> WorkoutAssignmentExercise snapshots
        -> WorkoutAssignmentExerciseSet snapshots
```

Template identity/owner/status/current revision are stored at `0005:12-29`. Revision identity/content and `(template_id, revision_number)` uniqueness are at `0005:31-49`. Exercise stable keys and order are at `0005:51-73`; rich prescriptions, source keys and supersets are added at `0006:29-76`. Per-set rows are at `0006:78-102`. Assignment source identities and snapshots are at `0005:75-126` and `0006:104-186`.

`E`: repository-wide migration search found no migration after `0006_workout_builder_lifecycle.up.sql` that alters the four Template/Revision/Exercise/Set tables. Later migrations reference assignments and surrounding workflows but do not repair the Template head/published pointer lifecycle.

### Existing states and transitions

| Transition | Owner/precondition | Lock | Mutation | Side effects | Workspace now | Quick Assign now |
| --- | --- | --- | --- | --- | --- | --- |
| First create/save | active trainer; no template ID | transaction, no semantic idempotency | Template draft + Revision 1 draft + children | audit `draft_saved` | Draft | hidden |
| Save same Draft | owner + Template status draft | `FOR UPDATE OF template, revision` | update heads; delete/reinsert children | audit per save | Draft updated | hidden |
| Publish first Revision | owner + valid Draft | save lock, then publish lock in second transaction | Revision published; Template published | `draft_saved`, then `published` audits | Published | assignable |
| Create new Revision | owner + current Template/Revision published | `FOR UPDATE OF template` | clone children; Template becomes draft/current N+1 | no audit | Draft N+1 | old Published disappears |
| Edit new Draft | owner + Template draft | `FOR UPDATE OF template, revision` | full replacement | audit `draft_saved` | Draft | hidden |
| Publish new Revision | owner + valid Draft | two transactions | Draft becomes published; Template published | save + publish audit | Published N+1 | new revision assignable |
| Duplicate | no backend command | client clone -> ordinary save | new Template/Revision IDs; copied content | ordinary `draft_saved` only | New Draft | hidden |
| Archive Draft/Published | owner + non-archived | UPDATE transaction | Template archived + trigger timestamp | no audit | Archived | hidden |
| Repeat publish | no draft remains | row not found by state predicate | no mutation | none | unchanged | unchanged; API returns 404 |
| Repeat archive | already archived immutable | row not matched | no mutation | none | archived | API returns 404 |
| Concurrent save | both read same draft | row lock serializes writes only | later full replacement wins | two audits | latest writer | n/a |
| Unknown create result | no command key/client ID persisted | retry may insert another Template | duplicate possible | duplicate audit possible | two drafts possible | n/a |

`E`: published revisions are immutable by trigger (`0006:219-238`) and child RLS allows mutations only under Draft Revision (`0006:298-406`). `E`: existing Assignment snapshots survive later revisions (`tests/backend-foundation/workout-builder-postgres.test.ts:130-199`).

## 6. Critical published-plus-draft finding

### Confirmed answer to R2D-01

1. **Остаётся ли предыдущая Published Revision назначаемой?** Нет. `createRevision` moves Template to `draft` and advances `current_revision`; Quick Assign joins only that current row and requires published statuses. Exact assignment also rejects a revision whose number is not `current_revision` (`lib/server/workouts/workout-repository.ts:302-365`).
2. **Сознательное правило или schema side effect?** It is confirmed behavior and test expectation, but no accepted product decision was found. Treat as incidental model coupling until founder accepts otherwise.
3. **Можно ли редактировать несколько дней, продолжая назначать старую?** Нет в текущем production contract.
4. **Может ли Template одновременно иметь published + editable draft rows?** Rows physically coexist, but Template has one pointer and one aggregate status, so production projections cannot expose both roles canonically.
5. **Более одного Draft?** Current command prevents it: `createRevision` requires Template published; once it becomes draft, another call returns null. DB itself does not provide a partial unique constraint for one draft, but command/trigger path yields one.
6. **Как Quick Assign определяет Published Revision?** Сейчас: current revision plus both statuses published.
7. **Нужен ли отдельный pointer?** Recommended: yes.
8. **Можно ли без migration?** A code-only query for highest published revision is possible, but leaves Template status/current pointer overloaded and makes RLS/commands/error semantics fragile. Not recommended as canonical lifecycle.
9. **Что затронет решение?** Template schema, update trigger/grant, assignment RLS, Builder repository, Quick Assign list/preview, assignment command verification, backfill and tests.

### Options

| Option | Description | Advantages | Risks | Verdict |
| --- | --- | --- | --- | --- |
| A | Keep current behavior | No migration | Editing breaks assignment availability; poor operational model | Reject |
| B | Query max published revision while keeping current schema | Fast code-only patch | Status and pointer remain ambiguous; archive/RLS/command drift | Temporary mitigation only |
| C | Add `published_revision_id`; retain one editable head/draft pointer | Explicit assignable revision; supports published + draft | Migration and query updates | **Recommended** |
| D | Separate TemplatePublication entity | Most expressive future model | New entity and excess complexity for MVP | Defer |

### Recommended target invariant

```text
Template archived_at is lifecycle availability.
Template published_revision_id -> zero or one immutable Published Revision.
Template editable_revision_id/current draft -> zero or one Draft Revision.

Draft-only Template:
  published_revision_id = null
  editable draft = revision 1

Published-only Template:
  published_revision_id = revision N
  no editable draft

Published with Draft:
  published_revision_id = revision N
  editable draft = revision N+1

Archived Template:
  no commands; published/draft rows remain historical.
```

The exact name and whether `current_revision` is replaced by `editable_revision_id` or retained as editable head is an implementation choice. The product invariant, not the column spelling, requires founder acceptance.

### Backward compatibility

- Published template with current Published Revision: backfill pointer to current revision.
- Draft-only template with no published rows: pointer null.
- Existing template currently in Draft N+1 after earlier publication: backfill latest Published Revision N and retain Draft N+1 as editable head.
- Existing Assignment source IDs and snapshots remain unchanged.
- Quick Assign must use the published pointer and revalidate exact revision on submit.

## 7. Existing repositories/services/API

### Canonical Builder service

`WorkoutBuilderService` owns list, saveDraft, publish, createRevision and archive (`lib/server/workouts/workout-builder-service.ts:156-179`). It is sufficient as the command owner after lifecycle, validation, idempotency and error hardening. A second command service is not needed.

### Repository behavior

- list: one head query followed by two hydration queries for every Template (`workout-builder-repository.ts:103-109`, `:234-248`);
- save: full aggregate replacement in one transaction (`:111-147`, `:251-290`);
- publish: Draft -> Published in one transaction after a separate save transaction (`:150-165`; service `:167-171`);
- create revision: set-based clone under Template row lock (`:167-216`);
- archive: single update (`:219-225`).

### API inventory

| Endpoint | Method | Purpose | Current problems |
| --- | --- | --- | --- |
| `/api/trainer/workout-builder/templates` | GET | full list | unbounded, N+1, over-hydrated, no search/filter/cursor |
| same | POST | create/update Draft | no expected version/idempotency; 64 KB hard limit may reject legitimate large Template |
| `/.../[templateId]/publish` | POST | save full payload then publish | two transactions; no command key; generic 404/503 |
| `/.../[templateId]/revisions` | POST | clone new Draft | no audit/idempotency; breaks Published availability |
| `/.../[templateId]/archive` | POST | archive | no audit; repeated command returns 404 |
| `/api/trainer/workout-templates` | GET/POST | legacy simple published templates | divergent lifecycle; bypasses Draft/Publish UX |

All mutation routes enforce same-origin and active trainer; reads use actor-scoped RLS. Builder routes return broad `template_not_found` or generic `temporarily_unavailable`, so UI cannot distinguish foreign, stale, archived and concurrent cases (`app/api/trainer/workout-builder/templates/route.ts:17-44` and child route files).

## 8. Current persistence divergence

| Concern | PostgreSQL production | Current UI/demo/legacy | Gap |
| --- | --- | --- | --- |
| Template aggregate | canonical draft/revision tables | demo templates in `builder-model.ts` | Demo statuses/usage cannot be facts |
| Exercise library | no canonical `app` repository/table for Builder | demo array; legacy Supabase | Production Editor source gap |
| Draft recovery | PostgreSQL on explicit save | sessionStorage copy | Valid only as ephemeral recovery |
| Duplicate | no explicit command | client clone then save | No provenance/idempotent outcome |
| Assignment | exact Published Revision via Quick Assign | demo drawer in demo branch | Production boundary now correct |
| Legacy template creation | Builder lifecycle | legacy API publishes directly | Two production authoring contracts |

The Supabase library may contain useful seed/catalog data, but its service and IDs are not automatically canonical. A data migration or seed import must preserve a stable source key and ownership semantics explicitly.

## 9. Templates Workspace user job and route boundary

User job: **найти, создать, открыть и управлять своими переиспользуемыми тренировками.** Workspace is an asset-management surface, not athlete CRM, assignment form or Program editor.

### Route options

| Option | Direct reload/Back | Dirty editor | Handoff | Compatibility | Clarity | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A. One `/trainer/builder` with query/client state | fragile; full list needed | hard to scope | works today | highest | low | Reject as target |
| B. `/trainer/builder` + `/trainer/builder/[templateId]` | good | route-scoped | good | high | medium | Acceptable low-cost option |
| C. `/trainer/templates` Workspace + `/trainer/builder/new` and `/trainer/builder/[templateId]` Editor | best | route-scoped | explicit | requires redirects | highest | **Recommended** |

`A`: choose C for implementation design. Keep `/trainer/builder` as a compatibility redirect to `/trainer/templates` only after production callers and tests are migrated. Existing contextual links should target `/trainer/builder/new?...handoff=...`; existing template deep links target exact template/editor route. Do not change routes in this architecture phase.

Why C:

- primary nav label `Шаблоны` maps to saved asset management;
- Builder URL means authoring task, not collection;
- exact route supports server-scoped actor/permission read and direct reload;
- browser Back naturally returns to filters/scroll-preserved Workspace;
- Quick Assign handoff is isolated to the Editor route;
- Program remains a separate future concept.

## 10. Proposed TemplateWorkspaceReadModel

```ts
type TemplateWorkspaceReadModel = {
  actor: {
    trainerUserId: string;
    trainerStatus: "active" | "inactive";
  };
  filters: {
    status: "all" | "draft" | "published" | "archived";
    query: string;
    category: string | null;
    sort: "updated_desc";
  };
  items: Array<{
    templateId: string;
    title: string;
    lifecycle: "draft_only" | "published" | "published_with_draft" | "archived";
    editableRevision: null | {
      revisionId: string;
      revisionNumber: number;
      updatedAt: string;
    };
    publishedRevision: null | {
      revisionId: string;
      revisionNumber: number;
      publishedAt: string;
    };
    summaryRevisionId: string;
    category: string;
    exerciseCount: number;
    prescribedSetCount: number;
    estimatedDurationMin: number | null;
    updatedAt: string;
    capabilities: {
      canOpen: boolean;
      canEdit: boolean;
      canCreateRevision: boolean;
      canDuplicate: boolean;
      canArchive: boolean;
      canOpenQuickAssign: boolean;
    };
    anomalyCodes: string[];
  }>;
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
  dataAvailability: "ready" | "empty" | "unavailable";
};
```

Rules:

- list facts are set-based counts; no exercises array per item;
- `summaryRevisionId` is editable Draft when the row action is “Continue editing”, otherwise latest Published; UI labels the choice;
- usage count is derivable but not required for MVP. It must not become a popularity/ranking proxy;
- last assignment date, thumbnails, folders, tags, favourite and AI rating are out of first R2D;
- category is retained because the schema has it and it supports findability;
- capabilities are projected server-side from actor and lifecycle, not inferred from button visibility;
- archive row is a tombstone with no mutable actions except view/duplicate if accepted;
- cursor is bound to actor, filters, query and sort.

## 11. Workspace actions and command ownership

| Action | User task | Command owner/precondition | Result/return | Keep/change/remove |
| --- | --- | --- | --- | --- |
| Создать шаблон | start reusable workout | BuilderService create/save Draft; active trainer | Editor new Draft | Keep, route explicitly |
| Открыть черновик | continue work | exact Editor read; own active Draft | Editor | Keep |
| Просмотреть опубликованную | inspect immutable source | exact read; own Published | read-only Editor | Add explicit action/state |
| Редактировать опубликованный | produce next version | createRevision; no existing Draft | Editor Draft N+1 | Rename to “Создать новую версию” |
| Дублировать | branch reusable workout | explicit duplicate command recommended | new Draft Template | Keep behavior, move ownership server-side |
| Архивировать | remove from active library | archive; own non-archived | Workspace receipt/tombstone | Keep with confirmation |
| Вернуть из архива | restore asset | no command exists | n/a | Do not add in R2D MVP |
| Перейти к назначению | use Published source | navigation only to athlete-hosted Quick Assign | Quick Assign | Keep only when athlete context exists or athlete selection is delegated to canonical host; no assignment command here |
| Удалить | hard-delete | no command exists; FKs use RESTRICT | n/a | Do not add |

Stale action results must return machine-readable conflict and refresh one row or list without losing Workspace filters/scroll.

## 12. Builder Editor user job and route boundary

User job: **создать или отредактировать одну Draft Revision, безопасно сохранить её и отдельно опубликовать, когда она валидна.**

Editor owns:

- Template/Revision content editing;
- exercise selection and snapshot creation;
- prescription, sets, order, notes and supersets;
- Draft save;
- publication validation;
- publish command;
- exact revision result for navigation handoff.

Editor does not own:

- athlete selection in neutral flow;
- Assignment fields or POST;
- Program/ProgramAssignment;
- client history/progress;
- AI-generated workout;
- library item CRUD unless opened as a separate library task.

Published Revision is read-only. Editing it first creates a new Draft Revision. A Template with an existing Draft opens that Draft instead of creating another.

## 13. Proposed WorkoutTemplateEditorReadModel

```ts
type WorkoutTemplateEditorReadModel = {
  identity: {
    templateId: string;
    ownerTrainerUserId: string;
    lifecycle: "draft_only" | "published" | "published_with_draft" | "archived";
    revisionId: string;
    revisionNumber: number;
    revisionStatus: "draft" | "published";
    provenance: {
      copiedFromTemplateId: string | null;
      copiedFromRevisionId: string | null;
    } | null;
  };
  content: {
    title: string;
    description: string;
    category: string;
    generalInstruction: string;
    estimatedDurationMin: number | null;
    items: Array<ExerciseItem | SupersetItem>;
  };
  publication: {
    latestPublishedRevisionId: string | null;
    latestPublishedRevisionNumber: number | null;
    publishedAt: string | null;
  };
  validation: {
    persistenceBlockers: ValidationIssue[];
    publicationBlockers: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  capabilities: {
    canSaveDraft: boolean;
    canPublish: boolean;
    canCreateRevision: boolean;
    canDuplicate: boolean;
    canArchive: boolean;
  };
  concurrency: {
    editToken: string;
    lastPersistedAt: string;
  };
  handoff: {
    token: string | null;
    athleteUserId: string | null;
    expiresAt: string | null;
  };
  anomalyCodes: string[];
  dataAvailability: "ready" | "not_found" | "unavailable";
};
```

Exercise contract:

```ts
type TemplateExercise = {
  templateExerciseId: string;
  instanceKey: string;
  sourceExerciseKey: string;
  sourceAvailability: "available" | "unavailable" | "unknown";
  position: number;
  snapshot: {
    title: string;
    category: string;
    equipment: string | null;
    description: string | null;
    imageUrl: string | null;
  };
  prescription: Prescription;
  perSetMode: boolean;
  sets: TemplateSet[];
  trainerNote: string;
  superset: null | {
    key: string;
    position: number;
    label: string;
    instruction: string;
  };
};
```

`templateExerciseId` is the persisted row identity for the loaded Revision; `instanceKey` is stable semantic identity within and across cloned revisions. Commands must not match by title or array index. `sourceExerciseKey` records provenance; snapshot facts remain historical if library content changes.

## 14. Save Draft contract

### Current contract

- payload is the complete aggregate, not patch/granular commands;
- transaction locks Template/current Revision;
- existing exercise/set rows are deleted and reinserted;
- child DB UUIDs do not survive save; semantic `instance_key` and `set_key` do;
- one audit event is written per save;
- no expected version or idempotency key.

### Target contract

```text
saveDraft(
  templateId/clientGeneratedTemplateId,
  revisionId,
  expectedEditToken,
  commandId,
  completeDraftAggregate
)
```

Requirements:

1. Keep full aggregate replacement for MVP; it is simpler and transactionally safe for bounded templates.
2. Compare opaque `expectedEditToken` derived from revision identity and persisted version/`updated_at` while holding row lock.
3. Reject stale save with HTTP 409 `draft_version_conflict`; never silently overwrite.
4. Use a client-generated UUID for first Template identity or a persisted command receipt so identical retries return the same Draft.
5. Return persisted aggregate summary, new edit token and command replay flag.
6. Preserve local recovery payload on failure, unknown outcome or conflict.
7. On unknown result, GET exact Editor model before retry; compare server revision/token and optional content fingerprint.
8. Audit one logical save, not every transport retry.

No granular mutation system is needed for R2D unless measured large-template payloads make full replacement unacceptable.

## 15. Publish/New Revision contract

### Publish

Current service first saves and then publishes in separate transactions (`workout-builder-service.ts:167-171`). That permits a Draft to be durably changed even if publication subsequently fails; UI must not describe this as one atomic all-or-nothing command.

Target publish command:

- input: exact Template ID, Draft Revision ID, expected edit token, command ID;
- server loads persisted Draft and runs publication validation;
- row locks Template and exact Draft;
- if valid, transitions only that Revision to Published and updates `published_revision_id`;
- removes/clears editable Draft pointer without mutating prior Published rows;
- returns exact published Revision identity and replay-safe receipt;
- writes audit once; outbox is not required unless another accepted consumer exists;
- repeated identical publish returns existing receipt/state; changed/stale publish returns 409.

### New Revision

- only from own non-archived Template with Published Revision;
- if editable Draft already exists, return that Draft instead of creating another;
- clone snapshot facts, instance keys, set keys and superset metadata into new DB rows;
- assign new Revision/exercise/set row UUIDs;
- retain Published pointer throughout editing;
- return exact Editor model and edit token;
- audit `workout.template.revision_created`.

## 16. Duplicate/Archive contract

### Duplicate

Current UI creates a new local Template with fresh semantic keys and saves it as an ordinary Draft (`builder-model.ts:187-200`). There is no explicit backend command or persisted provenance.

Recommended command:

```text
duplicateTemplate(sourceTemplateId, sourceRevisionId, newTemplateId, commandId)
  -> new Draft Template revision 1
```

- owner can duplicate own Draft or Published Revision; archived source duplication is an open product decision;
- source is locked/read exactly, copy is transactionally inserted;
- all Template, Revision, exercise row and set row UUIDs are new;
- all `instance_key`, `set_key` and `superset_key` values should also be regenerated because they are scoped to the copied aggregate and should not imply cross-Template identity;
- optional provenance fields are useful for audit but not a blocker; audit metadata may be enough for MVP;
- no Assignment is created.

### Archive

- archive whole Template identity, not one Revision;
- Published and Draft rows remain historical;
- Quick Assign no longer exposes the Published pointer;
- repeated archive is idempotent success, not generic not-found;
- foreign Template remains indistinguishable from not found at the external boundary;
- restore and delete are not part of R2D MVP.

## 17. Validation rules

### A. Save Draft

The current parser allows empty title and zero items, but every present exercise and set must already be publication-valid, and a superset must already contain 2–4 exercises (`workout-builder-service.ts:44-146`). This is too strict for safe incomplete work.

Target persistence blockers only:

- malformed payload/type/size;
- foreign/archived/published exact Revision;
- duplicate semantic IDs that would corrupt aggregate identity;
- impossible ordering that cannot be normalized safely;
- values outside storage-safe hard bounds.

Allowed in persisted Draft:

- empty title;
- zero exercises;
- incomplete prescription/set fields represented explicitly as nullable/incomplete Draft data;
- temporarily one-member superset or ungrouped recovery state, provided it cannot publish;
- unavailable source exercise with retained snapshot;
- publication warnings.

Current non-null DB constraints on prescription and set values may require a Draft representation decision or schema adjustment. Do not fake valid numbers such as `1` or `90` to persist incomplete UI.

### B. Publish

Must require:

- non-empty title;
- at least one exercise;
- unique instance/set keys and contiguous unique order;
- valid repetitions or duration prescription;
- set count and per-set rows consistent;
- valid load/rest bounds;
- every superset complete with 2–4 unique exercise instances and unique internal positions;
- exact Draft Revision and non-stale token;
- active owner and non-archived Template.

Missing library source should not automatically invalidate a Draft snapshot. Founder must decide whether it blocks publication or becomes a warning; recommendation: allow publication when all required snapshot facts are present, and show provenance warning.

### C. Assignment eligibility

- exact Revision is Published and equals Template published pointer;
- Template not archived;
- owner is current trainer;
- at least one exercise;
- active trainer-athlete relation is checked by Quick Assign/Assignment, not Builder;
- server revalidates at submit.

## 18. Exercise and set identity

| Identity | Scope | Persists through save? | New after revision? | New after duplicate? | Use |
| --- | --- | --- | --- | --- | --- |
| Library/source key | library catalog | yes as provenance | copied | source stays same | reference to origin |
| Template exercise row UUID | one Revision | no under current full save | new | new | persisted row/source for snapshot |
| `instance_key` | one Template Revision semantic item | yes | copied today | should be regenerated | UI/command identity |
| position | one Revision | rewritten | copied then reorderable | copied | order only, never identity |
| Template set row UUID | one exercise row | no under full save | new | new | persisted source for Assignment set |
| `set_key` | one exercise instance | yes | copied today | should be regenerated | UI/command identity |

Answers:

1. Same library exercise may appear multiple times. Server uniqueness is `instance_key`, not `source_exercise_key`; UI currently warns but allows it (`builder-model.ts:298-302`). This is correct.
2. Duplicate source is warning, not blocker.
3. Separate `instance_key` values distinguish instances.
4. DB child UUIDs are recreated by full save; semantic keys survive.
5. Reorder changes positions, not semantic keys.
6. Duplicate must allocate all new aggregate-local identities.
7. Exercise/set deletion only affects mutable Draft rows. Existing Assignments retain independent snapshots and RESTRICT source references point to immutable Published rows, not the rewritten Draft.
8. Migration 0006 backfills legacy `source_exercise_key` from `instance_key` (`0006:46-52`), so old rows receive a key, though origin may be semantically unknown.
9. Editor read model needs anomaly codes for missing/duplicate keys, invalid order, source unavailable and malformed supersets.

## 19. Superset contract

Current schema has no separate Superset table. Each exercise stores `superset_key`, `superset_position`, `superset_label` and `superset_instruction` (`0006:41-44`, `:66-76`). The UI groups rows by key and orders members by superset position (`workout-builder-repository.ts:79-98`).

Current invariants:

- one exercise belongs to at most one superset because metadata is scalar;
- nested supersets are impossible in the type model;
- UI/service allow 2–4 participants;
- DB checks metadata consistency and position range 1–4, but does not enforce group cardinality, unique positions within a group or identical label/instruction across rows;
- top-level order remains exercise `position`; internal order is `superset_position`;
- deletion in current UI ungroups an invalid one-member remainder;
- revision clone preserves keys and metadata.

Recommendation: keep metadata model; a separate Superset aggregate is not needed for MVP. Harden publication validation server-side and return anomaly codes for legacy malformed groups. Save Draft may retain incomplete groups; Published Revision may not.

Reorder contract:

- within group: update member `superset_position` and global positions deterministically;
- between groups: explicit ungroup/move/regroup operation in UI model, persisted as full aggregate;
- group top-level move: preserve internal order;
- duplicate group: new superset, instance and set keys;
- an exercise cannot belong to two groups.

## 20. Dirty state and recovery

### Options

| Option | Loss risk | Requests/concurrency | MVP clarity | Verdict |
| --- | --- | --- | --- | --- |
| A. Explicit save only | medium/high | low | simple but unsafe | Insufficient alone |
| B. Debounced server autosave | low after debounce | high; conflict-heavy | ambiguous publication boundary | Not first choice |
| C. Explicit save + ephemeral same-tab recovery | low on same device/tab | bounded | clear states | **Recommended MVP** |
| D. Server autosave + explicit publish | lowest cross-device | highest complexity | good later | Research after pilot |

`A`: use C. PostgreSQL Draft is source of truth; `sessionStorage` may keep a short-lived local recovery copy keyed by trainer, Template/Revision and edit token. It is not domain persistence and does not promise cross-device recovery. Do not use localStorage for Template facts.

Required UI state machine:

```text
pristine
  -> dirty
  -> saving
  -> saved

saving
  -> save_failed (server rejected; outcome known)
  -> save_unknown (network ended without trusted result)
  -> conflict (server version changed)
```

Rules:

- dirty navigation requires explicit leave confirmation;
- Browser Back participates in the same guard;
- local recovery is cleared only after confirmed persisted equivalent, explicit discard, or successful publish;
- `save_unknown` first performs exact GET before retry;
- conflict retains local payload and offers reload server version or “Сохранить как копию”; no automatic merge;
- archived/published elsewhere keeps local payload exportable as copy, not writable to original.

## 21. Concurrency and stale behavior

| Scenario | Server result | UI recovery |
| --- | --- | --- |
| Two tabs save same Draft | second stale token -> 409 `draft_version_conflict` | retain local, compare metadata, reload or copy |
| Draft saved elsewhere | exact GET returns newer token | show “Версия обновлена” before overwrite |
| Revision published elsewhere | 409 `revision_already_published` or idempotent receipt for same command | open Published read-only; preserve unmatched local as copy |
| Template archived elsewhere | 409 `template_archived` | disable mutations; allow copy from recovery |
| Two publishes | same command -> replay; different stale command -> conflict | show persisted Published receipt |
| Save retry | same command/payload -> one logical result | no duplicate audit/template |
| Unknown save outcome | no blind retry | exact GET and content/token comparison |
| Stale Workspace row | command precondition fails | refresh row/list preserving filters |
| Quick Assign during Draft edit | latest Published pointer stays assignable | no conflict unless archive/new publication changes exact revision |

Recommended MVP concurrency primitive:

- opaque `editToken` bound to actor, Template ID, Draft Revision ID and persisted revision version;
- repository row lock plus equality check;
- client-generated `commandId` for create/save/publish/duplicate/archive;
- stable machine error taxonomy;
- no merge algorithm.

Using only row locks is insufficient: locks serialize writes but do not detect that the second writer edited an older read. `updated_at` can back the token initially, but a dedicated monotonic `lock_version` is more robust and easier to test. See migration priorities in section 30.

## 22. Exercise Library integration

### Confirmed current behavior

- `BuilderEditor` receives one full in-memory array and performs search/category/equipment filters client-side (`builder-editor.tsx:111-127`).
- `ExerciseLibraryPanel` is a controlled presentation component with system/mine scope, search, filters, inspect and add callbacks (`components/trainer/exercise-library-panel.tsx:18-56`, `:89-156`).
- `ExerciseDetailSheet` displays details in a nested Sheet (`components/trainer/exercise-detail-sheet.tsx:14-125`).
- production Builder still supplies demo rows (`workout-template-builder-page.tsx:90`).
- `/trainer/library` is demo-backed (`app/trainer/library/page.tsx:1-17`).

### Canonical boundary

```text
Editor
  -> ExerciseLibraryQueryService
     -> PostgreSQL system + trainer-owned exercise catalog
  -> paged summaries
  -> exact Exercise detail on demand
  -> add selection
  -> snapshot required facts into Draft Revision
  -> return focus to new exercise card/inspector
```

Requirements:

- actor-scoped, paginated search/filter by category/equipment/body part;
- no full catalog in initial Editor payload;
- detail/image loaded only when inspected;
- single add is MVP; multi-add is optional research;
- duplicate source detection is warning/confirmation;
- keyboard add and focus restoration are required;
- desktop may use adjacent panel; mobile uses one Sheet at a time;
- nested Detail Sheet must restore focus to the originating library row and avoid stacked inaccessible dialogs;
- snapshot title/category/equipment/description/image and source key at add time;
- later library changes/deletion never mutate Template Revision or Assignment.

`A`: canonical PostgreSQL exercise library is a blocker before production Editor. Reusing the legacy Supabase repository would violate the accepted source-of-truth boundary.

## 23. Quick Assign handoff

### Confirmed R2C.3 flow

`Quick Assign -> Builder` stores an opaque token in `sessionStorage`. The payload includes version, TTL timestamps, athlete ID, validated flow, search/date/note state and optional exact revision ID; it does not carry raw Template as authority (`components/trainer/quick-assign/quick-assign-handoff.ts:1-139`). TTL is 30 minutes; invalid/expired/athlete-mismatched data is rejected and expired data is removed lazily.

Builder publication writes the exact persisted `revisionId` into that handoff and navigates to the athlete Training profile host (`components/trainer-os/workout-template-builder/workout-template-builder-page.tsx:412-450`; `lib/quick-assign-navigation.ts:1-31`). Quick Assign then performs canonical GET verification to recover Template identity and preview before explicit Assignment submit.

Contract:

1. Handoff token is navigation continuity, not authorization.
2. Builder verifies active trainer and own Template through server commands.
3. On publish, Builder returns exact persisted Published Revision identity.
4. Quick Assign rechecks athlete relation, Template ownership/status, exact revision and assignment concurrency.
5. Builder never sends Assignment POST and never assumes publication means assignment.
6. Cancelled Builder returns to preserved Quick Assign state without Template deletion.
7. Expired handoff returns to neutral Workspace/Editor with calm message; published revision remains saved.
8. Browser Back may return to Quick Assign; stale selection must revalidate.
9. Direct neutral Builder entry has no athlete dependency.
10. Successful handoff should be consumed/cleared explicitly after Quick Assign restores it; current code only lazy-clears invalid/expired records, so cleanup is recommended but not a domain blocker.

No Builder command-result changes beyond exact persisted revision receipt are required; R2C.3 already carries that identity.

## 24. Permissions matrix

| Actor/state | Workspace | Draft edit/save | Published view | New revision | Duplicate | Archive | Handoff/assign |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active trainer, own Template | yes | yes if exact Draft | yes read-only | yes if no Draft | yes | yes | only through Quick Assign |
| Inactive trainer | deny | deny | deny or read-only per access policy; current API denies all | deny | deny | deny | deny |
| Foreign Template/Revision | not visible | not found | not found | not found | not found | not found | blocked by actor query/RLS |
| Archived own Template | archive filter/tombstone | no | optional read-only | no | open decision | idempotent archived | unavailable |
| Client actor | deny | deny | deny | deny | deny | deny | client reads Assignment only |
| Suspended athlete relation | neutral Template work unaffected | unaffected | unaffected | unaffected | unaffected | unaffected | Quick Assign/Assignment blocked |
| Handoff for other athlete | Template work may continue neutrally | yes | yes | yes | yes | yes | token rejected; no authorization |

Template ownership belongs to trainer and is independent of athlete relation. Athlete authorization enters only at Quick Assign/Assignment.

Current RLS correctly scopes Template/Revision/children to owner and mutations to Draft rows (`0005:174-230`, `0006:293-406`). Application APIs must keep active-trainer checks and same-origin mutation checks.

## 25. Workspace and Editor state matrix

### Workspace

| State | Facts/actions | Safe behavior |
| --- | --- | --- |
| Initial loading | actor known, list pending | skeleton rows; filters stable |
| No templates | no rows | create Template primary action |
| Only drafts | draft rows | continue editing; no assign |
| Only published | published rows | view, new revision, duplicate, archive |
| Published with draft | both revision facts | continue Draft; Published remains assignable |
| Archived | tombstones | view if supported; no mutation/assign |
| Search empty | filters produce zero | clear filters, no create pressure |
| Cursor exhausted | no more rows | disable load more |
| Invalid cursor | machine 400 | reset to first page with message |
| List error/partial | no trusted fabricated rows | retry; retain filters |
| Stale row | command conflict | refresh row/list |
| Permission denied/inactive | no data | access state, no CTA that will fail |
| Long list | cursor pages | bounded list, stable sort |
| Long title | persisted max 120 | wrap/truncate with full accessible name |

### Editor

| State | Mutation | Recovery/action |
| --- | --- | --- |
| New unsaved | local only | explicit first save; recovery copy |
| Empty persisted Draft | allowed | add title/exercises later |
| Incomplete Draft | allowed after schema decision | show publication blockers |
| Valid Draft | save/publish | one primary action by intent |
| Published | read-only | create new version |
| Creating revision | blocked during command | idempotent result/retry |
| Dirty | local differs | save/discard guard |
| Saving | disabled duplicate submit | show persistent state |
| Saved | token refreshed | clear equivalent recovery |
| Save failed | local retained | fix/retry |
| Save unknown | local retained | exact GET before retry |
| Publish validation failed | Draft retained | focus issue list/item |
| Publishing | prevent duplicate command | await receipt |
| Published | immutable | Workspace or handoff return |
| Concurrent edit | no overwrite | reload/copy, no auto merge |
| Archived elsewhere | no original mutation | save as copy |
| Source unavailable | snapshot retained | warning; founder publication rule |
| Legacy missing identity | read with anomaly | block destructive rewrite until resolved |
| Invalid superset | Draft only | fix before publish |
| Large Template | bounded max + payload feedback | no silent truncation |
| Handoff active | same Editor | publish then return exact revision |
| Handoff expired | Template work preserved | neutral return |
| Mobile | non-drag controls | all MVP actions reachable |
| Keyboard reorder | semantic-key action | announce new position |

## 26. Desktop/mobile implications

### Desktop hypothesis

- Workspace is a restrained list/card-list with search, status filter, category and row actions.
- Editor is a focused full-width work surface, not three independent dashboard panels.
- Library may be an adjacent panel on wide screens but must have an independent paged query boundary.
- Save/publication state remains visible while editing.
- No athlete selector, Program selector or Assignment form in neutral Editor.
- Published and Draft identities are visible as product language (“Опубликована версия 2”, “Есть черновик версии 3”), not internal IDs.

### Mobile minimum

Must support Workspace, search/filter, create/open Draft, add exercise, basic prescription, non-drag reorder, save, validation, publish and handoff return. Drag is enhancement only; current arrow controls are useful evidence (`builder-editor.tsx:273-274`).

Open research decision: whether advanced per-set and superset authoring on phone is pilot-critical. Recommendation: preserve read/edit access but optimize pilot QA around basic prescription first; do not silently omit advanced fields.

Passing a no-horizontal-overflow E2E (`tests/e2e/trainer-core-flow.spec.ts:184-225`) proves layout containment only, not target authoring ergonomics.

## 27. Component reuse map

| Component/module | Verdict | Hidden assumptions / required adaptation |
| --- | --- | --- |
| `ExerciseLibraryPanel` | Extract/reuse presentation | currently receives full array; add server paging/loading/error/focus contract |
| `ExerciseDetailSheet` | Adapt | nested Sheet/focus/a11y; exact detail source; optional add action |
| `WorkoutExerciseCard` | Prototype primitive only | different legacy types; not imported by current Builder |
| `WorkoutSupersetBlockCard` | Prototype primitive only | coupled to legacy card/types; inspect before extraction |
| `WorkoutFormHeader` | Leave legacy, replace for target | unreferenced; target needs route-aware dirty/save state |
| current `workout-builder-types.ts` UI family | Do not make canonical | separate from server Builder types; positional assumptions must be audited |
| `builder-model.ts` | Adapt domain-free editor reducer concepts | demo fixtures, Date/counter IDs, client publish/clone helpers are not commands |
| `BuilderEditor` | Extract interaction primitives, rewrite composition | demo library, monolithic state, client filtering, desktop panel assumptions |
| `TemplatesWorkspace` | Rewrite against read model | client-side full-list filters, hydrated rows, no pagination/capabilities |
| current Builder page shell | Split | route, list, editor, dialogs, lifecycle and handoff all in one client component |
| current template selector | Remove from Builder | selection belongs to Workspace/Quick Assign |
| athlete selector/context | Remove from neutral Builder | athlete only in contextual handoff banner/navigation |
| Program selector | Remove/leave legacy | Program is non-goal |
| save controls | Adapt | need edit token, unknown/conflict states and route guard |
| publish controls | Adapt | separate persisted validation/command receipt |
| `builder-draft-persistence.ts` | Adapt | sessionStorage is recovery only; key must include actor/template/revision/token; remove demo reset coupling |
| local assignment helpers/drawer | Demo-only; remove after import audit | Builder cannot own Assignment mutation |
| quick-start P/P/L/Full Body | Demo/research only | not canonical facts or automatic recommendation |
| `WorkoutBuilderService` | Keep and harden | command owner; split validation and stable errors |
| `WorkoutBuilderRepository` | Keep and refactor reads/commands | N+1, pointer lifecycle, concurrency/idempotency |
| Builder APIs | Evolve | exact reads, summaries, cursors, stable errors/tokens |
| R2C handoff | Keep | add explicit consume cleanup; no authorization assumptions |

Delete decisions require a later import audit and are not part of R2D architecture.

## 28. Search/pagination/performance

### Confirmed findings

- Current Workspace list is `1 + 2N` queries and hydrates all exercises/sets (`workout-builder-repository.ts:103-109`, `:234-248`).
- Current UI filters all rows client-side (`templates-workspace.tsx:43-56`).
- save executes head updates/deletes plus one insert per exercise and one per set (`workout-builder-repository.ts:111-147`, `:251-290`): query count grows with aggregate size.
- createRevision is mostly set-based and bounded by one aggregate (`:167-216`).
- Quick Assign already demonstrates a set-based summary, search and cursor query pattern (`quick-assign-repository.ts:190-255`).
- library currently loads a full demo array; legacy Supabase query is not a canonical performance baseline.

### Target budgets

| Operation | Query budget | Notes |
| --- | --- | --- |
| Workspace initial/page | 1 aggregate query, optionally 1 bounded facet query | no exercise hydration per row |
| Editor exact aggregate | 3 queries max: head/revisions, exercises, sets | may run children in parallel after actor-scoped head |
| Library search page | 1 summary query; detail 1 on demand | cursor, max 25–50 |
| Save Draft | bounded transaction; target <= 6 set-based statements plus audit | bulk insert via JSON/unnest rather than E+S round trips |
| Publish | <= 4 statements plus audit | validate aggregate set-based, lock, transition |
| Duplicate | <= 5 set-based clone statements plus audit | no per-child loop |

Workspace cursor sort: `updated_at DESC, template_id DESC`, bound to actor/query/status/category. Search over title, description and category. Filters: All, Drafts, Published, Archive; `published_with_draft` appears in both Published and Draft contexts only if UI labels it unambiguously, otherwise use lifecycle-specific filter semantics.

Existing `(trainer_user_id, status, updated_at DESC)` and revision/exercise/set indexes are reasonable starting points (`0005:128-139`, `0006:188-191`). Do not add an index until target query and `EXPLAIN` show need; the new published pointer will need its FK index only if PostgreSQL does not obtain one from the chosen constraint/index design.

Server Component boundaries: Workspace initial read and exact Editor head are candidates for server rendering; interactive editor/library remain client components. Avoid shipping the full catalog and full template collection in the client bundle. Measure drag/reorder rendering for 40 exercises, the current server maximum.

## 29. API change assessment

### A. Workspace read API

**Required change.** Do not extend current full-hydration response in place as the target contract. Introduce a set-based Workspace summary endpoint or a response mode/version with:

- cursor, query, lifecycle/status, category;
- server capabilities and anomaly codes;
- editable and published revision summaries;
- no full exercises;
- `Cache-Control: no-store` initially.

### B. Editor read API

**Required new exact read boundary.** GET by Template ID and optional exact Revision ID, actor-scoped, returning full aggregate, lifecycle pointers, validation/anomalies, capabilities and edit token. It must not load all templates to resolve one deep link.

### C. Commands

Keep `WorkoutBuilderService`, harden payloads with:

- exact Template/Revision IDs;
- `commandId`;
- expected edit token/version;
- explicit operation-specific payloads;
- stable errors: `template_not_found`, `template_archived`, `draft_not_found`, `draft_version_conflict`, `revision_already_published`, `publication_validation_failed`, `command_id_conflict`, `temporarily_unavailable`;
- replay-safe receipts.

Add explicit duplicate command. Archive can remain the existing operation after idempotency/audit hardening. No restore/delete API in MVP.

Deprecate legacy `/api/trainer/workout-templates` creation after tests and callers move to Builder publication. Until then, label it compatibility-only and prevent new UI imports.

Assignment endpoint remains unchanged by R2D; Builder only uses R2C handoff and exact revision verification.

## 30. Migration/schema assessment

### Blocker before Workspace

**Migration recommended:** explicit latest Published Revision pointer and editable Draft invariant.

Minimum effects:

- add/backfill `published_revision_id` or equivalent;
- ensure pointer belongs to same Template and points to Published Revision;
- retain at most one editable Draft per Template, preferably with explicit pointer/partial unique invariant;
- revise Template update trigger and grants;
- revise assignment insert RLS to validate exact published pointer rather than general Template status;
- revise Builder and Quick Assign repositories and assignment command;
- preserve all Assignment rows/snapshots.

### Blocker before Editor

**Migration/domain source decision required:** canonical PostgreSQL Exercise Library. Current `source_exercise_key text` has no FK and production Builder uses demo data. Options:

1. Create PostgreSQL system/trainer exercise catalog and retain source key/reference plus snapshots — recommended.
2. Seed a bounded system catalog only for first pilot, still PostgreSQL-backed — acceptable phased MVP.
3. Reuse Supabase library directly — rejected by source-of-truth decision.

### Blocker before pilot

Concurrency/version:

- preferred: monotonic `lock_version bigint` on mutable Draft Revision, incremented per save, represented by opaque edit token;
- lower-cost option: compare `updated_at` under row lock, but test timestamp precision and every mutation path;
- idempotent create/commands need either client-generated stable aggregate IDs plus replay logic or a persisted command receipt. A generic new command framework is not required.

### Future/optional

- duplicate provenance columns can be deferred; audit metadata can carry source IDs;
- folders/tags/thumbnails/AI metadata are not needed;
- no separate Superset table;
- no index changes without measured query plan;
- restore/delete schema is not needed.

## 31. Implementation sequence

Audit changes the originally suggested order because the Exercise Library source is also a hard blocker.

### R2D.1 — Lifecycle decision and migration design

- founder accepts simultaneous Published + Draft invariant;
- design/backfill published pointer and one-Draft invariant;
- update RLS/triggers/repository contracts;
- PostgreSQL tests prove old Published remains assignable while Draft N+1 is edited.

### R2D.2 — Exercise Library source-of-truth foundation

- choose canonical PostgreSQL catalog scope;
- implement actor-scoped paged summaries/detail;
- seed/migrate stable source identities;
- prove Template snapshots survive library changes/unavailability.

### R2D.3 — Command and concurrency hardening

- split Save vs Publish validation;
- expected edit token and command IDs;
- idempotent create/publish/archive;
- explicit duplicate command;
- stable conflict taxonomy and audits.

### R2D.4 — Workspace read model and routes

- set-based summary, cursor/search/filter/capabilities;
- exact route architecture and compatibility plan;
- query-budget PostgreSQL tests.

### R2D.5 — Workspace UI

- canonical `/trainer/templates` destination;
- lifecycle rows/actions, empty/error/stale states;
- desktop/mobile list QA;
- no full aggregate hydration.

### R2D.6 — Editor read model and desktop UI

- exact aggregate GET;
- focused Editor composition;
- library selection/detail;
- exercise/set/superset controls;
- dirty/save/publish/conflict states.

### R2D.7 — Mobile minimum and accessibility

- non-drag reorder;
- basic and advanced field reachability;
- focus restoration, dialogs/sheets, live save status;
- 390×844 QA.

### R2D.8 — Handoff E2E and compatibility cleanup

- Quick Assign -> Builder -> exact publish -> Quick Assign -> Assignment receipt;
- neutral flow back to Workspace;
- expired/cancelled/stale handoff;
- retire production callers of legacy authoring API;
- import audit before deleting demo/legacy components.

Each stage should be a small reviewable change; no Builder UI should land on unresolved R2D-01 semantics.

## 32. Acceptance criteria

Architecture is accepted when:

1. Real Template/Revision lifecycle is documented from code and schema.
2. R2D-01 is acknowledged as a blocker, with a founder decision on Published + Draft.
3. Previous Published Revision remains assignable while one Draft is edited, if recommended invariant is accepted.
4. Workspace and Editor have separate routes, jobs and read models.
5. Workspace list is set-based, paged and contains no full exercise hydration.
6. Editor loads one exact actor-scoped aggregate.
7. Builder never creates Assignment.
8. Quick Assign remains the sole production assignment command surface.
9. Program and ProgramAssignment are absent.
10. Save Draft and Publish use separate validation policies.
11. Incomplete Draft persistence has an explicit schema representation; no fake valid defaults.
12. Published Revision and existing Assignment remain immutable.
13. Stable exercise/set identities do not depend on title or array index.
14. Duplicate creates new aggregate-local identities.
15. Superset metadata and server publication invariants are documented.
16. Same library exercise may be added twice with separate instances.
17. Exercise Library is PostgreSQL-backed in production and paged.
18. Library changes do not mutate Template snapshots.
19. Explicit save plus same-tab recovery has clear state semantics.
20. Concurrent edits cannot silently overwrite newer data.
21. Unknown command outcome is reconciled before retry.
22. Create/publish/archive/duplicate are replay-safe.
23. Active trainer/ownership checks and RLS fail closed.
24. Athlete relation is required only for handoff/Assignment.
25. Quick Assign handoff carries no raw authoritative Template.
26. Exact Published Revision is revalidated before Assignment.
27. Desktop and mobile minimum workflows are specified.
28. Existing components have explicit reuse verdicts.
29. Legacy authoring API has a deprecation plan.
30. Query budgets and confirmed N+1 are documented.
31. Migration/backfill preserves existing Assignments.
32. PostgreSQL tests cover lifecycle, concurrency, RLS, snapshots and query bounds.
33. E2E covers neutral and contextual flows, expiry and conflicts.
34. Production code, UI, API, routes, schema and migrations remain unchanged by this architecture pass.

## 33. Risks and open decisions

### Founder decisions required

| ID | Decision | Recommendation | Consequence if deferred |
| --- | --- | --- | --- |
| R2D-O1 | Can latest Published remain assignable while Draft N+1 exists? | Yes | Builder editing continues to disable Quick Assign |
| R2D-O2 | Canonical route option B or C? | C: `/trainer/templates` + separate Builder routes | Current route remains ambiguous and reload-heavy |
| R2D-O3 | Exercise Library MVP scope | PostgreSQL seeded system catalog + trainer-owned extension if needed | Production Editor retains demo/Supabase dependency |
| R2D-O4 | Can unavailable source exercise publish from complete snapshot? | Yes, with warning | Old valid workouts may become unpublishable due to catalog cleanup |
| R2D-O5 | Duplicate archived Template? | Allow copy to new Draft, keep source archived | Trainer may lack recovery path without restore |
| R2D-O6 | Phone advanced authoring pilot scope | Support, but optimize QA around basic prescription first | Full phone workflow may be expensive before evidence |
| R2D-O7 | Version primitive | monotonic `lock_version` + opaque token | `updated_at` contract remains more fragile |

### Principal risks

1. Existing tests encode the current stale Published behavior; changing lifecycle requires intentional test replacement, not merely adding a query.
2. Template aggregate status is overloaded. Adding only a pointer without redefining capabilities can preserve contradictory states.
3. Save Draft schema currently demands valid prescription values, so UI-level relaxed validation alone is insufficient.
4. Full replacement changes child row UUIDs. Any future code that treats Draft child UUID as long-lived must be rejected or migrated to semantic keys.
5. RLS currently requires `template.status = 'published'` for Assignment. It must change with Published + Draft or app-layer fixes will still fail.
6. Existing legacy API can create Published templates outside the canonical lifecycle and should not gain new consumers.
7. Exercise source keys are text without canonical FK; provenance cannot be trusted until the library boundary is defined.
8. Current 64 KB request body may be too small for 40 rich exercises and per-set overrides; measure representative payload before fixing a limit.
9. R2C.3 is uncommitted; R2D implementation must begin from a clean checkpoint or explicitly preserve its changes.

## 34. Confirmation that production code, UI, API, routes, schema, migrations and commits were not changed

This R2D pass created only:

`docs/templates-builder-r2d-architecture-v1.md`

It did not:

- modify production code or UI;
- change API handlers or route structure;
- change PostgreSQL schema, migrations, RLS, grants or triggers;
- run production mutations;
- create Program, Assignment or AI workflow;
- alter demo/mock data;
- create a Git commit.

All other modified, deleted and untracked files visible in the working tree pre-existed this documentation pass and belong to the uncommitted R2C.3 or unrelated local work.
