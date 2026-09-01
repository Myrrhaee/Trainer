# R2D Design B: canonical WorkoutTemplate Editor

Статус: UX design specification; lifecycle R2D.1 реализован, Editor production implementation не начата
Основа: `docs/templates-builder-r2d-architecture-v1.md`, `docs/templates-workspace-r2d-design-v1.md` и migration `0013_workout_template_revision_lifecycle`
Target routes: `/trainer/builder/new`, `/trainer/builder/[templateId]`, `/trainer/builder/[templateId]?view=published`
Дата: 2026-09-01

## 1. Design verdict

Canonical Editor должен быть самостоятельной route-level рабочей поверхностью для создания и изменения одной exact editable Draft Revision. Он не является Workspace, формой назначения, Program Builder или трёхколоночной CRM-панелью.

Выбранная композиция: **Editor-first canvas с компактным sticky route header и вызываемой по требованию Exercise Library Sheet**. Основной экран отдаёт ширину структуре тренировки. Упражнения редактируются в раскрываемых строках внутри последовательности, а библиотека появляется только во время выбора источника.

Главные решения:

1. В каждом состоянии есть одно основное действие.
2. `Сохранить черновик` и `Опубликовать` никогда не объединяются.
3. Published и Archived открываются как настоящие read-only представления, а не disabled form.
4. Draft может существовать без названия и упражнений, но текущий R2D.1 service пока не сохраняет частично заполненное упражнение без обязательного prescription. Это implementation gap, а не повод подставлять нули.
5. Exercise Library проектируется против будущего PostgreSQL read boundary; demo-каталог не становится production fact.
6. Silent overwrite, force overwrite и автоматический merge исключены.
7. Publish receipt может вернуть тренера в Quick Assign, но не создаёт Assignment.

## 2. Confirmed implemented lifecycle

R2D.1 хранит два независимых UUID pointer на одном Template: latest Published и exact editable Draft. Same-template foreign keys, partial unique index и deferred validation гарантируют принадлежность и не более одной Draft (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:50-120`, `:145-237`).

| Состояние | Реализованные server facts | Editor consequence |
| --- | --- | --- |
| Draft-only | Published отсутствует, editable указывает на Draft | открыть exact Draft; сохранить или опубликовать после validation |
| Published-only | Published существует, editable отсутствует | read-only; `Создать новую версию` создаёт/возвращает Draft N+1 |
| Published + Draft | оба pointers существуют | default exact route открывает Draft; Published доступна отдельным read-only view |
| Archived | pointers и history сохранены, Template immutable | read-only; save/publish/create revision недоступны |

Подтверждено кодом:

- `createRevision` клонирует latest Published в единственную Draft и при replay возвращает существующую Draft (`lib/server/workouts/workout-builder-repository.ts:241-317`).
- `saveDraft` принимает только exact editable Draft владельца неархивного Template (`lib/server/workouts/workout-builder-repository.ts:132-190`).
- `publish` переводит exact Draft в Published, переключает pointer и очищает editable (`lib/server/workouts/workout-builder-repository.ts:193-238`).
- Quick Assign продолжает использовать Published pointer, пока Draft редактируется.
- `current_revision` остаётся compatibility head и запрещён в UI, URL и пользовательской копии.

## 3. Product decisions used

- Workspace и Editor являются разными задачами и маршрутами.
- Новый route не создаёт PostgreSQL row до явного сохранения.
- Published immutable; изменение начинается через новую Revision.
- Draft persistence validation слабее publication validation по продуктовой модели.
- PostgreSQL Draft является source of truth; same-tab recovery только страхует локальную работу.
- В первой версии нет debounced server autosave.
- Save и Publish отдельны; Publish не создаёт Assignment.
- Quick Assign является единственным assignment workflow.
- Одно library exercise может иметь несколько Template instances с разными `instanceKey`.
- Superset остаётся metadata-группировкой 2-4 упражнений, не новой сущностью.
- Desktop основной для интенсивного authoring; mobile поддерживает полный базовый путь.
- Program, ProgramAssignment и AI generation отсутствуют.

Design B не считает уже реализованными: canonical Exercise Library, expected edit token, command-level idempotency, duplicate Template command, exact Editor GET и compare view. Для них здесь определяется UX boundary, а не production readiness.

## 4. User jobs

Основная задача:

> Собрать, безопасно сохранить и опубликовать повторно используемую тренировку, не назначая её конкретному спортсмену.

Поддерживаемые jobs:

1. Создать новый пустой Draft.
2. Продолжить exact editable Draft.
3. Просмотреть Published или Archived Revision.
4. Добавить canonical exercise и настроить instance prescription.
5. Управлять порядком, sets и supersets.
6. Сохранить незавершённую работу без фиктивных данных.
7. Исправить publication blockers и опубликовать.
8. Восстановиться после ошибки, uncertain outcome или конфликта.
9. Вернуться в Workspace либо продолжить Quick Assign handoff.

Не поддерживаются athlete selection, Program, Assignment editing, workout execution, AI generation и управление всей коллекцией Templates.

## 5. Entry points

| Entry | Intent | Initial resolution | Return |
| --- | --- | --- | --- |
| Workspace `Создать шаблон` | new unsaved | локальная пустая форма без PostgreSQL ID | сохранённый row anchor либо Workspace create action |
| Workspace Draft row | continue | exact editable Draft | исходный query/filter/page/anchor |
| Workspace Published row | inspect | `view=published`, exact latest Published | Published row anchor |
| `Создать новую версию` | mutate Published | server createRevision receipt, затем exact Draft | row с Published + Draft |
| Published + Draft row | continue | existing editable Draft, без N+2 | same row anchor |
| Archived row | inspect | server-selected exact historical read-only revision | Archive filter/anchor |
| Duplicate receipt | adapt copy | new Draft-only identity | new row anchor |
| Quick Assign handoff | create missing suitable template | new/existing Draft плюс validated return context | Quick Assign with exact Published revision |
| Direct URL | resume/inspect | authorization and lifecycle resolution | safe Workspace fallback |

Handoff или return context влияет только на навигацию. Он не является authorization evidence.

## 6. Routes and return contract

```text
/trainer/builder/new
/trainer/builder/[templateId]
/trainer/builder/[templateId]?view=published
```

Default exact Template route resolution:

- editable Draft есть: открыть Draft;
- editable нет, Published есть: открыть Published read-only;
- Archived: открыть server-selected historical read-only state;
- чужой/отсутствующий: non-disclosing unavailable state.

Безопасный return contract хранит только Workspace query/filter/category/page/anchor либо opaque validated Quick Assign context. Он не хранит content, pointer IDs, edit token, local recovery payload, athlete data или assignment note.

После save/publish route использует canonical Template ID. После publish `view=published` может открывать exact latest Published через server resolution, но UI не передаёт raw pointer как источник правды.

## 7. Primary/secondary action model

Выбран **state-dependent action model**, а не постоянно видимые Save + Publish. Постоянная пара создаёт ложное впечатление, что dirty или invalid Draft можно сразу публиковать, и конкурирует за primary emphasis.

| State | Primary | Secondary |
| --- | --- | --- |
| New unsaved | `Сохранить черновик` | `К шаблонам` |
| Dirty Draft | `Сохранить черновик` | `К шаблонам`; Publish объясняет `Сначала сохраните изменения` |
| Persisted Draft with blockers | `Перейти к ошибкам` | `К шаблонам` |
| Persisted valid Draft | `Опубликовать` | `К шаблонам` |
| Saving | disabled `Сохраняем...` | navigation guarded |
| Publishing | disabled `Публикуем...` | navigation guarded |
| Published read-only | `Создать новую версию` или `Продолжить черновик` | `К шаблонам` |
| Archived | `К шаблонам` | duplicate only after canonical command exists |
| Publish receipt from handoff | `Перейти к назначению` | `К шаблонам` |

Никакой state не показывает `Сохранено`, пока server receipt или reconciliation не подтвердили persistence.

## 8. Transition map

```text
Workspace -> new Editor -> explicit save -> Draft Editor
Workspace -> Draft -> edit -> save -> validate -> publish -> receipt -> Workspace
Published read-only -> createRevision -> Draft N+1 -> save/publish
Quick Assign -> Builder -> Draft -> publish -> handoff receipt -> Quick Assign
Editor dirty -> Back/Close/Shell -> save-and-exit | discard | stay
Save unknown -> exact GET -> matched | unchanged retry | conflict
Concurrent change -> retain local -> view server | save as copy
Archived/stale -> read-only/unavailable -> Workspace
```

### Required scenario map

| # | User task / entry | Primary and next screen | Return | Required states | Keep / change / remove |
| --- | --- | --- | --- | --- | --- |
| 1 | Workspace -> new | Save -> persisted Draft Editor | new row anchor | unsaved, dirty, saving | keep explicit save; remove auto-row |
| 2 | Workspace -> Draft | Save/Publish -> same Editor/receipt | original anchor | ready, dirty, errors | keep exact Draft; change action hierarchy |
| 3 | Published -> new revision | Create revision -> Draft N+1 | same identity | creating, replay, failure | keep server lifecycle; no local clone |
| 4 | Published + Draft | Continue -> Draft | same anchor | dual lifecycle | keep Published availability |
| 5 | Archived | Workspace return | Archive filter | read-only | remove mutation controls |
| 6 | Duplicate receipt | Edit new Draft | new anchor | receipt, empty/incomplete | keep distinct identity; command is future |
| 7 | Quick Assign -> Builder | Publish -> handoff receipt | Quick Assign | valid/expired handoff | keep separate Assignment submit |
| 8 | Direct exact URL | capability-derived action | safe Workspace | loading/denied/stale | remove client lifecycle inference |
| 9 | Dirty Back/Close | Save and exit / stay | intended route | guard | retain local payload |
| 10 | Save failed | Retry same logical save | same Editor | recoverable failure | no fake Saved |
| 11 | Outcome unknown | Check persistence | matched/retry/conflict | reconciliation | retain exact payload/identity |
| 12 | Concurrent edit | View saved / save copy | Editor/Workspace | conflict | no force overwrite |
| 13 | Published elsewhere | Open Published | read-only | stale Draft | no repeat publish |
| 14 | Archived elsewhere | Workspace | Archive state | mutation denied | retain local copy for export/copy |
| 15 | Publish invalid | Go to issues | exact field | issue summary | keep Draft persisted |
| 16 | Source unavailable | Continue with snapshot or replace | same Editor | warning/blocker by snapshot completeness | no demo fallback |
| 17 | Large Template | Save/issue navigation | same Editor | collapsed/long | no expand-all/virtualization by default |
| 18 | Mobile creation | Save -> Draft | Workspace/handoff | keyboard/safe-area | one column |
| 19 | Keyboard-only | Save/Publish | normal | focus announcements | non-drag operations |
| 20 | Expired handoff | Publish -> safe receipt | Workspace; restart assignment | expired context | Template remains saved |

## 9. Editor information hierarchy

1. Existing TrainerShell.
2. Compact route header: back, title, lifecycle/version, save state, contextual handoff indicator, one primary action, overflow.
3. Recovery/conflict region when applicable.
4. Template information fields.
5. `Состав тренировки` heading, issue count and `Добавить упражнение`.
6. Ordered exercise/superset sequence.
7. Publication issue summary near the action region and semantic links to fields.
8. Publish receipt replacing command state after success.

No collection sidebar, athlete selector, Program selector, assignment panel, KPI band or nested card wall.

## 10. Desktop layout comparison

| Pattern | Repeated editing | Density/long Template | Keyboard/zoom | Mobile | Cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Permanent three-column | fast source access | cramped Editor/Inspector | poor at 200% | unrelated transform | high | Reject |
| Editor-first + on-demand Library Sheet | full-width authoring, focused selection | strong | predictable | direct full-screen Sheet | medium | **Chosen** |
| Sequential steps | simple onboarding | slow repeated edits, hidden context | acceptable | good | medium | Reject |

Library is a wide right-side Sheet on desktop. It is not permanently mounted as a third column and does not shrink the Editor into a narrow center rail. Exercise details expand inline, avoiding a second Inspector column.

## 11. Desktop wireframe

Target: 1440 x 1024.

```text
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│ Trainer  │ [←] День тяги  Черновик · Версия 3 · Сохранено   [Опубликовать] [⋯]│
│ Shell    ├──────────────────────────────────────────────────────────────────────┤
│          │ Название [День тяги...............................................] │
│          │ Описание [........................................................] │
│          │ Категория [Спина ▾]  Длительность [50 мин]                         │
│          │ Общая инструкция [................................................] │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ Состав тренировки · 7 упражнений            [+ Добавить упражнение]│
│          │ 1  Тяга верхнего блока   4 x 8-12 · отдых 90с       [Раскрыть] [⋯]│
│          │ 2  Суперсет A · 2 упражнения                         [Раскрыть] [⋯]│
│          │ 3  Тяга гантели         Есть 1 ошибка                [Раскрыть] [⋯]│
│          │ ...                                                                  │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ Проверка публикации · 1 ошибка                    [Перейти к ошибке]│
└──────────┴──────────────────────────────────────────────────────────────────────┘
                                                   ┌──────────────────────────────┐
                                                   │ Библиотека упражнений    [×] │
                                                   │ [Поиск...] [Фильтры]          │
                                                   │ Тяга блока       [Добавить]   │
                                                   │ ...              [Ещё]       │
                                                   └──────────────────────────────┘
```

Route header sticky внутри content viewport, высотой не более компактной toolbar. На экранах малой высоты он остаётся sticky только пока не перекрывает validation target; layout обязан иметь `scroll-padding-top`. Нижняя action bar не нужна на desktop.

## 12. Mobile flow

Mobile 390 x 844 использует одну семантическую колонку:

```text
route header -> save/lifecycle state -> Template fields -> composition -> validation
```

Primary action находится в компактной sticky top action row, а не под экранной клавиатурой. Когда keyboard открыт, action остаётся доступным после закрытия клавиатуры и не перекрывает активное поле; `visualViewport`, safe-area и scroll padding проверяются browser QA.

Exercise Library открывается как один full-screen Sheet. Detail заменяет list внутри этого Sheet и имеет собственный `Назад к результатам`; stacked modal/Sheet запрещён.

## 13. Mobile wireframes

### 13.1 New/empty Draft

```text
[←] Новый шаблон       Не сохранено
[Сохранить черновик]
Название / описание / категория
Состав тренировки
Добавьте упражнения
[Добавить упражнение]
```

### 13.2 Exercise list

```text
Состав тренировки        [+]
1 Жим лёжа        4 x 8  [⋯]
  [Раскрыть]
2 Суперсет A             [⋯]
  2 упражнения [Раскрыть]
[Добавить упражнение]
```

### 13.3 Exercise editing

```text
Жим лёжа [Свернуть]
Тип [Повторы]
Подходы [4] Повторы [8..10]
Нагрузка [ ] Отдых [90]
Заметка к упражнению [...]
[Режим по подходам]
```

### 13.4 Library selection

```text
[← Закрыть] Библиотека упражнений
[Поиск] [Фильтры]
Жим лёжа · Грудь · Штанга
[Подробнее] [Добавить]
[Показать ещё]
```

### 13.5 Validation issues

```text
Проверка публикации · 3 ошибки
1. Жим лёжа: укажите повторы [Перейти]
2. Суперсет A: нужно 2-4 упражнения [Перейти]
[Исправить ошибки]
```

### 13.6 Publishing

```text
Черновик · Версия 3 · Сохранено
[Публикуем...]
Навигация временно защищена
```

### 13.7 Success/handoff

```text
Шаблон опубликован
День тяги · Версия 3
7 упражнений · 24 подхода
[Перейти к назначению]
[К шаблонам]
```

Все controls не меньше 44 px; reorder не зависит от drag; advanced set rows складываются вертикально без горизонтального скролла.

## 14. Template information

Фактические текущие service limits:

| Field | Draft | Publish | Current canonical limit |
| --- | --- | --- | --- |
| `Название` | optional | required | 120 characters |
| `Описание` | optional | optional | 2000 characters |
| `Категория` | optional | optional | 120 characters |
| `Общая инструкция` | optional | optional | 4000 characters |
| `Ориентировочная длительность` | optional | optional | integer-like numeric text, 1-600 minutes |

Evidence: `lib/server/workouts/workout-builder-service.ts:124-146`.

No default title, category or duration. `Новый шаблон` is route heading, not persisted title. Character counters appear near 80% of limit and always on error. Published/Archived render values as text sections, not disabled inputs.

## 15. Empty Draft

Heading: `Добавьте упражнения`.

Copy: `Начните с библиотеки упражнений. Состав можно сохранить как черновик и продолжить позже.`

Local action: `Добавить упражнение`.

Do not show PPL split, Full Body recommendation, athlete goal, AI generation, Program day or fake prefilled exercises. Empty metadata and zero exercises are valid Draft facts. Publish attempt returns exact blockers without deleting Draft.

## 16. Exercise Library

Target is a future canonical paginated PostgreSQL source. Current `getDemoLibraryExercises()` is prototype evidence only and must not supply production facts.

Desktop uses right-side Sheet; mobile uses full-screen Sheet. States: closed, loading, ready, searching, filtered, cursor loading/exhausted/invalid, empty, source unavailable, detail loading/unavailable, duplicate warning and add success.

Summary row may show only canonical title, category, equipment, accepted body region, ownership/source label and image availability. Popularity, recommendation and athlete matching are forbidden.

MVP chooses **single-add**: `Добавить` closes the Sheet, inserts one local Draft instance with a stable semantic identity, focuses its heading and announces addition. This is slower for bulk authoring but simpler for keyboard, focus and mobile. Multi-add remains a measured follow-up hypothesis.

## 17. Duplicate exercise handling

Repeated source is allowed but never silent.

Warning: `Это упражнение уже есть в шаблоне`.

Actions:

- `Добавить ещё раз` creates a distinct `instanceKey`;
- `Перейти к добавленному` closes Library and focuses the existing instance;
- `Отмена` returns to the Library row.

The warning is not a publication blocker. The second instance may use a different prescription, note or superset membership.

## 18. Exercise card

Collapsed row shows position, title, source availability, prescription summary, set count, superset membership, issue count, disclosure, reorder actions and overflow.

Expanded row contains prescription type, repetition mode/range or duration, set count, target load, rest, exercise note, per-set switch, set editor, superset controls and inline validation.

Expansion rules:

- newly added exercise: expanded;
- exact issue jump: expand and focus field;
- exercise with unresolved issue: issue indicator, not automatically all expanded;
- normal loaded exercise: collapsed;
- long Template: all normal rows collapsed.

Only one row needs to remain expanded on mobile; desktop may keep several user-opened rows. UI never expands every invalid row automatically.

## 19. Exercise identity

`instanceKey` is semantic UI/command identity. Persisted row ID is a server fact. Source library key records provenance. Position controls order only.

Identity never depends on title or array index. Reorder, expansion, focus, issue links and recovery use `instanceKey`. A duplicated source receives a new key. Set rows similarly use stable `setKey` through reorder.

Current service limits each identity string to 160 characters and rejects duplicate exercise/set semantic IDs (`lib/server/workouts/workout-builder-service.ts:40-42`, `:124-136`). These limits are validation facts, not visible technical terminology.

## 20. Reorder

Desktop drag-and-drop is an enhancement. Every exercise and group exposes keyboard-operable `Выше`, `Ниже`, and where useful `В начало`/`В конец` in overflow.

After move:

- same semantic row keeps focus;
- dirty state becomes true;
- live region announces `«Жим лёжа» перемещён на позицию 2`;
- no save occurs automatically;
- identity and configured values remain unchanged.

Mobile exposes non-drag actions first. There is no horizontal handle-only interaction.

## 21. Remove exercise

Chosen model: **immediate local removal with Undo until the next successful save**. This avoids a confirmation for every routine edit while preserving recovery.

After removal, focus moves to the next exercise, previous exercise or empty-state heading. A persistent local receipt says `Упражнение удалено` with `Вернуть`.

If member removal leaves a one-member superset, the group remains visibly incomplete with options `Добавить упражнение`, `Расформировать` or Undo. No silent group dissolution. The PostgreSQL Draft, Published Revision and Assignments remain unchanged until explicit save.

## 22. Prescription

Canonical fields:

- type: repetitions or duration;
- repetition mode: fixed or range;
- sets: 1-20;
- repetitions: 1-500;
- duration: 1-86400 seconds;
- target load: optional 0-2000 kg;
- rest: 0-3600 seconds;
- exercise-specific trainer note: maximum 2000 characters;
- per-set mode and overrides.

Current limits come from `WorkoutBuilderService` (`lib/server/workouts/workout-builder-service.ts:44-103`). Null/incomplete values are never rendered or submitted as zero/default. Switching repetitions and duration requires confirmation only when populated incompatible values would be cleared; the dialog names exactly what will be removed.

Important implementation gap: current save parser requires complete prescription values for every added exercise even when `publishing=false`. To fulfil safe partial Draft authoring, a later command/schema-compatible representation must be accepted before production Editor. Design B does not solve it with fake values.

## 23. Basic/per-set mode

### Basic -> per-set

Show preview: N stable set rows will be created from the basic prescription. Each receives a new `setKey`; values copy exactly from basic fields. Confirm `Создать отдельные настройки подходов`.

### Per-set -> basic

If all set rows are semantically equal, collapse using their common values after confirmation. If values differ, automatic conversion is blocked. The trainer must choose explicit resulting basic values in a summary dialog; discarded per-set detail remains available to local Undo until save.

No switch silently deletes configured data. Dirty state changes only after explicit confirmation.

## 24. Set editor

Each set displays position, `Разминочный`/`Рабочий`, repetitions range or duration, target load, rest, issue state, reorder and remove.

Set count and override count must agree in per-set mode; current service allows at most 20 rows. Add/remove/reorder preserves `setKey`. A removed set uses the same local Undo boundary as exercise removal.

Desktop may use compact grid tracks inside one exercise, but at 200% zoom it stacks. Mobile always uses stacked disclosures per set. No wide table is required to reach advanced fields.

## 25. Superset design

Compared patterns:

| Pattern | Context | Density | Reorder | Verdict |
| --- | --- | --- | --- | --- |
| Card containing cards | clear nesting | heavy nested-card UI | moderate | Reject |
| Lightweight group boundary in main list | context retained | compact | direct | **Chosen** |
| Separate group mode | focused | hides sequence | expensive | Reject |

Superset is a labelled boundary with group header, optional label/instruction and 2-4 member exercise rows. One exercise belongs to at most one group; nested groups do not exist.

Actions: create from selected exercises, add/remove member, move inside group, move to standalone, reorder group, dissolve. One-member group may persist locally as incomplete Draft but blocks Publish. Duplicate group is excluded until a canonical command/payload decision exists.

## 26. Notes terminology

Three facts remain distinct:

| Fact | Label | Ownership |
| --- | --- | --- |
| Template-wide coaching context | `Общая инструкция` | Template Revision |
| Exercise-specific guidance | `Заметка к упражнению` | exercise instance snapshot |
| Assignment-specific message | not present in Editor | Quick Assign / Assignment |

Generic `Комментарий` is avoided because it hides persistence ownership.

## 27. Validation model

Three levels:

1. Persistence blocker: malformed/unsafe values, duplicate semantic IDs, unrecoverable order, foreign/archived Draft.
2. Publication blocker: missing title/exercises, incomplete prescription/set, invalid superset, stale Draft.
3. Warning: repeated source, unavailable source with complete snapshot, unusual valid values, very long Template.

Issue summary sits near the action region, groups issues by Template/exercise/group and links to exact controls. Activation expands the row, focuses the field and preserves issue context. Inline copy uses `aria-describedby`.

First Publish attempt always asks the server. Client validation assists but is not authoritative. On failure, persisted Draft remains, focus moves to summary, and issues stay until changed and revalidated. Ordinary incomplete Draft is not painted red before a Publish attempt unless data is structurally unsafe.

## 28. Save state

Visible text states:

- `Не сохранено`;
- `Есть несохранённые изменения`;
- `Сохраняем`;
- `Сохранено`;
- `Не удалось сохранить`;
- `Результат сохранения неизвестен`;
- `Версия изменилась в другой вкладке`.

Explicit Save is one logical command. Target production contract requires a command ID retained across same-payload retries and an expected edit token returned by successful persistence. R2D.1 does not yet implement these fields; R2D.3 remains a backend prerequisite.

Save is disabled when clean or actively submitting, not merely because publication blockers exist. Success clears same-tab recovery only after canonical equivalence is confirmed.

## 29. Unknown outcome

Copy: `Не удалось подтвердить, сохранились ли изменения`.

Primary: `Проверить сохранение`.

Reconciliation:

1. retain local payload and logical command identity;
2. exact Editor GET;
3. server equivalent: mark Saved and clear recovery;
4. server unchanged: retry same logical command;
5. server differs: enter conflict state.

Blind retry with a new command is forbidden. Unknown publish outcome uses the same persisted-result verification and never repeats Publish if the Draft is already Published.

## 30. Concurrency conflict

Copy: `Шаблон изменился в другой вкладке. Ваши изменения не отправлены.`

Actions:

- `Посмотреть сохранённую версию`;
- `Сохранить как копию`, once canonical duplicate/copy command exists;
- `Скопировать изменения` as local export fallback.

MVP has no force overwrite and no automatic merge. Local payload remains in memory/recovery until the trainer resolves it. A full visual diff editor is not required initially; a concise server-vs-local summary may be researched after real conflicts are observed.

## 31. Dirty navigation

Guard applies to Workspace back, Browser Back, close, TrainerShell navigation, Published view and Quick Assign return.

Dialog title: `Изменения не сохранены`.

Actions:

- `Сохранить и выйти` uses Draft validation, never Publish validation;
- `Выйти без сохранения` clears the current local edit after explicit confirmation;
- `Остаться` returns focus to the trigger/active field.

For new Editor, save creates the first Draft. During saving or unknown outcome, destructive exit copy explicitly says persistence may already have happened and recommends reconciliation first.

## 32. Recovery

Same-tab recovery may contain actor/template/revision scope, edit token, local content, timestamp/TTL and safe return context. It cannot authorize commands, replace PostgreSQL or promise cross-device recovery.

On detection, exact server read occurs before applying anything. Choices:

- `Восстановить изменения` only when recovery is not older than server state;
- `Открыть сохранённую версию`;
- `Удалить восстановление`.

Recovery is never overlaid automatically on a newer server Draft. Proposed TTL is 24 hours, pending privacy/payload testing.

## 33. Published read-only

Display exact title/content, `Опубликована версия N`, publication date and `Доступна для назначения`.

No editable controls and no disabled form styling. Primary is `Создать новую версию`; if editable Draft already exists it becomes `Продолжить черновик`. Published remains inspectable through `view=published` while Draft exists.

Create revision submits once, handles replay by opening the existing Draft, and never changes Published or creates Assignment.

## 34. Archived read-only

Persistent facts: `В архиве`, `Недоступен для назначения`, exact historical revision selected by server and immutable saved content.

There is no Save, Publish, Restore or Delete. `Дублировать в новый черновик` appears only after a canonical command exists; otherwise primary is `К шаблонам`. Foreign or unavailable direct links disclose no Template facts.

## 35. Publication flow

Preconditions: exact persisted Draft, clean local state, authoritative server validation, matching future edit token, owner and nonarchived Template.

1. Trainer activates `Опубликовать`.
2. Compact confirmation shows title, revision, canonical exercise/set counts and replacement meaning.
3. Server locks exact editable Draft and validates.
4. On success receipt replaces command region.

If Published N exists, copy explains: `Версия N останется в истории. Версия N+1 станет доступной для новых назначений.` Existing Assignment snapshots remain unchanged.

## 36. Publication failure

| Failure | Presentation | Recovery |
| --- | --- | --- |
| Validation failed | grouped exact issues | focus summary, fix Draft |
| Stale edit token | conflict copy | view server / retain local |
| Already published | success-like persisted state | open Published, no retry |
| Archived | read-only archive state | Workspace |
| Permission denied | non-disclosing unavailable | safe return |
| Network unknown | outcome unknown | exact GET reconciliation |
| Publish persisted, handoff failed | keep success receipt | retry navigation, never republish |

Publication failure never removes or rolls back the persisted Draft unless the server confirms that publish succeeded.

## 37. Publish receipt

Heading: `Шаблон опубликован`.

Facts: title, `Опубликована версия N`, exercise/set count, publication date, `Доступен для назначения`, optional shortened stable reference.

Neutral actions:

- primary `К шаблонам`;
- secondary `Посмотреть опубликованную версию`.

Receipt is driven by persisted server result, not an optimistic toast.

## 38. Quick Assign handoff

Entry banner names only navigation intent: `Вы создаёте шаблон для последующего назначения`. It may show authorized athlete display context, but athlete is never a Template field.

After publish:

- primary `Перейти к назначению`;
- secondary `К шаблонам`;
- copy `Шаблон сохранён. Назначение спортсмену подтверждается отдельно.`

Return carries exact Published identity through the existing validated handoff. Quick Assign performs its own GET verification and separate Assignment confirmation. Expired handoff leaves Template saved and offers Workspace plus `Начать назначение заново` from an authorized athlete context. No Assignment POST occurs in Editor.

## 39. Large Template

QA fixture: 30 items / up to 40 exercise instances, mixed basic/per-set, several supersets, long copy, unavailable source and many issues. These numbers match current service caps (`lib/server/workouts/workout-builder-service.ts:112-129`).

Requirements:

- normal exercises collapsed;
- issue index navigates without expanding all;
- add/reorder preserves scroll/focus;
- save state remains visible;
- payload limit appears before submit;
- no document horizontal overflow;
- no virtualization until measurement proves it necessary.

## 40. Loading/error/permission states

| State | Visible facts | Primary recovery |
| --- | --- | --- |
| Initial loading | route shell + stable skeleton | await/retry |
| Exact read failed | no invented content | `Повторить` |
| Permission denied/foreign | non-disclosing unavailable | Workspace/Dashboard |
| Inactive trainer | no mutation facts | account activation path |
| Draft missing | refreshed lifecycle | Published/Workspace |
| Revision published elsewhere | Published receipt/read-only | open Published |
| Archived elsewhere | Archive banner | Workspace |
| Library loading | stable Sheet rows | wait/close |
| Library error | existing Draft retained | retry/close |
| Library empty | exact query/filter | clear/reset |
| Source unavailable | snapshot completeness fact | keep snapshot or replace |

Editor failures never replace trusted local Draft with mock/demo data.

## 41. State matrix

| State | Visible facts | Primary / secondary | Mutation | Local retained | Focus | Recovery |
| --- | --- | --- | --- | --- | --- | --- |
| New unsaved | heading, empty fields | Save / Workspace | local | yes | title | save/discard |
| Empty Draft | persisted lifecycle, 0 exercises | Add exercise / Workspace | yes | yes | empty heading | library |
| Incomplete Draft | saved facts, missing fields | Save or issues | yes | yes | changed field | continue later |
| Valid Draft | clean, no blockers | Publish / Workspace | publish | yes | Publish | receipt |
| Dirty | unsaved text | Save / guarded exit | local | yes | active field | save/discard |
| Saving | submitting | disabled Save | save | yes | status | await |
| Saved | canonical receipt | state-dependent | yes | cleared when equal | status | normal |
| Save failed | exact error | Retry / stay | retry | yes | error | same payload |
| Outcome unknown | uncertain | Check / stay | reconcile only | yes | notice | exact GET |
| Recovery available | local/server comparison | Restore / server | local | yes | dialog | explicit choice |
| Recovery stale | newer server fact | Open server / export | no overwrite | yes | warning | discard/export |
| Conflict | server changed | View server / copy | no overwrite | yes | conflict heading | resolve |
| Published read-only | immutable facts | New revision / Workspace | create revision | no dirty | h1 | Draft |
| Published + Draft | both versions | Draft action / Published view | Draft only | yes | action | exact route |
| Archived | archive facts | Workspace | none | optional export | banner | return |
| Creating revision | Published retained | disabled creating | command | no | status | receipt/replay |
| Publishing | clean Draft | disabled publishing | command | yes | status | receipt/reconcile |
| Publish invalid | issue list | Go to issues | edit | yes | summary | fix |
| Published receipt | persisted result | context-dependent | none | cleared | receipt h1 | Workspace/handoff |
| Handoff active | return intent | Publish then assign | no Assignment | yes | context banner | Quick Assign |
| Handoff expired | saved Template | Workspace / restart | none | no loss | receipt | safe restart |
| Library loading | query/filter | Close | none | yes | Sheet heading | wait |
| Library error | error, no fake rows | Retry / close | none | yes | error | retry |
| Library empty | exact filters | Clear / close | none | yes | empty heading | search |
| Duplicate exercise | existing instance | Add again / go existing | local | yes | warning | choose |
| Source unavailable | provenance warning | Replace/keep | local | yes | row warning | library |
| Exercise collapsed | summary | Expand / actions | local | yes | disclosure | expand |
| Exercise expanded | fields | Save at page level | local | yes | field | collapse |
| Invalid set | exact field issue | Go to issue | local | yes | set field | fix |
| Invalid superset | membership issue | Add/dissolve | local | yes | group heading | fix |
| Large Template | collapsed rows/index | state primary | local/save | yes | current row | issue index |
| Mobile keyboard | active field | top action later | local | yes | field | scroll/close keyboard |
| Permission denied | no private facts | safe return | none | export only if local | access heading | re-auth |
| Inactive trainer | section unavailable | safe account path | none | local unsaved guarded | heading | activate |

## 42. Content and terminology

Approved labels include `Новый шаблон`, `Черновик`, `Версия N`, `Опубликована версия N`, `Есть несохранённые изменения`, `Сохранить черновик`, `Сохраняем`, `Сохранено`, `Опубликовать`, `Шаблон опубликован`, `Создать новую версию`, `Продолжить черновик`, `Добавить упражнение`, `Состав тренировки`, `Общая инструкция`, `Заметка к упражнению`, `Подходы`, `Повторы`, `Длительность`, `Целевая нагрузка`, `Отдых`, `Разминочный подход`, `Рабочий подход`, `Объединить в суперсет` и `Перейти к назначению`.

Forbidden visible terms: `Template`, `Draft Revision`, `Published Revision`, `current revision`, pointer names, `lock_version`, `editToken`, `commandId`, `aggregate`, `Program`, `Program day`, `Assignment mutation`, `localStorage` и API status codes.

Technical terms may appear only in engineering evidence, never in user-facing wireframes or copy.

## 43. Accessibility

1. Exactly one `h1`, with lifecycle/save status in nearby readable text.
2. Semantic sections for information, composition, validation and receipt.
3. Exercise disclosure exposes `aria-expanded`; labels and issue descriptions are explicit.
4. Add focuses the new exercise; reorder preserves focus; remove focuses deterministic neighbour; save/publish errors focus summaries.
5. Live announcements are polite and deduplicated.
6. Library supports keyboard search, result traversal, detail return and focus restoration.
7. Reorder and grouping have non-drag commands.
8. Dialog/Sheet always has title, description, focus containment and return.
9. Mobile targets are at least 44 x 44 px.
10. Reduced motion disables animated scroll/reorder while preserving semantic focus.
11. At 200% zoom the desktop Editor stacks without document overflow.
12. Mobile screen-reader order matches visual order.
13. Lifecycle, save and error states never rely on color alone.

## 44. Component reuse map

| Existing part | Verdict | Design B treatment |
| --- | --- | --- |
| `WorkoutTemplateBuilderPage` | Split/rewrite composition | remove Workspace/assignment ownership; keep route orchestration evidence |
| `BuilderEditor` | Adapt heavily | extract metadata, sequence and validation regions; replace action hierarchy |
| `TemplatesWorkspace` | Exclude | belongs to Design A `/trainer/templates` |
| `ExerciseLibraryPanel` | Prototype-only shell | adapt visual primitives to canonical paginated source |
| `ExerciseDetailSheet` | Preserve interaction concept | one detail level inside Library Sheet |
| `WorkoutExerciseCard` | Adapt | compact disclosure, stable identity, non-drag actions |
| `WorkoutSupersetBlockCard` | Extract primitives | replace nested card with lightweight boundary |
| `WorkoutFormHeader` | Extract/adapt | compact route header, canonical save/lifecycle text |
| `builder-model.ts` | Prototype/domain mapping evidence | preserve semantic identity helpers selectively; remove mock/default facts |
| `builder-draft-persistence.ts` | Replace with bounded recovery adapter | same-tab recovery only, never source of truth |
| canonical Builder client | Adapt | exact read, command ID/edit token and reconciliation are future requirements |
| Builder APIs | Evolve later | no route change in design; exact GET/concurrency contract still missing |
| R2C Quick Assign handoff | Preserve | navigation context and exact Published return, no Assignment command here |
| Dialog/Sheet primitives | Preserve | dirty, conversion, confirmation and Library interactions |
| drag/reorder library | Optional enhancement | never the only reorder path |

Deletion occurs only after import audit and is outside Design B.

## 45. Keep/change/remove

### Keep

- canonical lifecycle, immutable Published and one editable Draft;
- semantic exercise/set identities;
- library/detail concept;
- prescription, per-set and superset capabilities;
- Quick Assign handoff;
- restrained premium dark/lime language.

### Change

- all-in-one route composition;
- header/action hierarchy;
- save/validation/recovery states;
- library data boundary;
- exercise density and mobile flow;
- concurrency/focus/error behavior.

### Remove

- Workspace, athlete selector, Program selector and assignment form from Editor;
- demo library facts and local domain persistence;
- automatic quick-start ontology;
- fake defaults, hidden save semantics and silent overwrite;
- combined publish-and-assign action.

## 46. Acceptance criteria

1. Editor and Workspace are separate routes/tasks.
2. New Editor has no athlete or Program requirement.
3. Opening new route creates no PostgreSQL Template.
4. First persistence is explicit Draft save.
5. Incomplete Draft is retained without fake values; partial-exercise backend gap is resolved before implementation acceptance.
6. Published and Archived views are read-only.
7. Published editing creates/opens one Draft N+1.
8. Latest Published remains available while Draft exists.
9. Header always shows lifecycle and truthful save state.
10. There is one primary action per state.
11. Dirty Draft cannot Publish before Save.
12. Save and Publish are separate commands.
13. Publish never creates Assignment.
14. Quick Assign handoff requires separate assignment confirmation.
15. Library uses canonical paginated data, not full demo catalog.
16. Duplicate source warns but may create a distinct instance.
17. Exercise/set identity never uses title/index.
18. Reorder has drag and non-drag paths.
19. Null/incomplete values never become zeros/defaults.
20. Basic/per-set conversion has no silent loss.
21. Superset invariants are visible and actionable.
22. Publication issues link to exact controls.
23. Save failure retains local work.
24. Unknown outcome reconciles before retry.
25. Concurrent edits cannot silently overwrite.
26. Recovery never overrides newer server state automatically.
27. Desktop 1440 x 1024, mobile 390 x 844 and large Template are specified.
28. Keyboard, screen reader, zoom and reduced motion are specified.
29. Program and Assignment POST are absent.
30. Production code, UI, API, routes, schema and migrations remain unchanged by Design B.
31. No commit is created.

## 47. Open decisions and research hypotheses

### Decisions made

- Editor-first canvas plus on-demand Library Sheet;
- single-add Library behavior for MVP;
- immediate local removal plus Undo;
- explicit lossy conversion confirmation;
- newly added and exact issue targets expand; normal rows collapse;
- lightweight superset boundary;
- compact sticky route header;
- no force overwrite or automatic merge.

### Open implementation/product decisions

1. Exact edit token and command receipt contract for R2D.3.
2. Persistence representation for partially configured exercises without fake values.
3. Canonical PostgreSQL Exercise Library schema/read API.
4. Exact recovery TTL; Design B proposes 24 hours.
5. Whether `Сохранить и выйти` is worth command complexity.
6. Whether publication always needs confirmation after trainers learn the flow.
7. Maximum payload bytes in addition to 30-item/40-exercise caps.
8. Archived revision selection rule for read-only view.
9. Whether Save-as-copy shares duplicate command semantics.
10. Whether mobile per-set/superset editing needs further progressive disclosure.

### Research hypotheses

- most templates contain fewer than 12 exercises;
- trainers add exercises one at a time more often than in bulk;
- title or prior Template is the preferred starting point, not a predefined split;
- sticky save status reduces uncertain duplicate saves;
- inline expanded exercise editing is faster than a permanent Inspector;
- publication confirmation may be removable after measured confidence.

## 48. Confirmation that production code, UI, API, routes, schema, migrations and commits were not changed

This Design B pass created only:

`docs/workout-template-editor-r2d-design-v1.md`

It did not:

- modify production code, current Builder UI or Workspace UI;
- create or change routes, API handlers, services or repositories;
- change PostgreSQL schema, migrations, RLS, grants or triggers;
- implement Exercise Library, concurrency or autosave;
- modify Quick Assign or create Assignment commands;
- add Program, ProgramAssignment or AI generation;
- create a Git commit.

The working tree already contained uncommitted R2C.3, R2D documents and R2D.1 lifecycle implementation before this pass. They were evidence only and were not modified as part of Design B.
