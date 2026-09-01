# Quick Assign R2C Design v1

Дата фиксации: 2026-08-31
Статус: design specification, production implementation не выполнялась
Архитектурная основа: `docs/quick-assign-r2c-architecture-v1.md`

## 1. Design verdict

R2C должен быть одной контекстной поверхностью назначения, а не отдельным разделом, сокращённым Builder или набором разных модальных окон для каждой точки входа.

Канонический пользовательский путь:

```text
известный спортсмен
  -> явный выбор точной опубликованной WorkoutTemplate revision
  -> проверка неизменяемого состава будущего Assignment
  -> обязательная дата и необязательная заметка
  -> проверка существующей будущей работы
  -> WorkoutService.createAssignment
  -> persisted WorkoutAssignment snapshot
  -> R2A.3 receipt
  -> профиль / очередь / список / следующий элемент
```

Канонический host:

```text
/trainer/clients/{athleteId}?tab=training&assign=1&flow=...
```

На desktop это широкая contextual Sheet шириной 880-960 px с двумя колонками. На mobile это full-screen Sheet с двумя последовательными состояниями: выбор шаблона, затем проверка и назначение.

Ключевой UX-результат: тренер всегда понимает, **кому**, **какую точную версию**, **на какую дату** он назначает и не создаёт ли он случайный дубль. Quick Assign не редактирует шаблон, не создаёт Program и не подменяет Builder.

Evidence:

- Канонический command уже существует в `lib/server/workouts/workout-service.ts:108-120` и `lib/server/workouts/workout-repository.ts:217-388`.
- Текущий roster-dialog автоматически выбирает первый шаблон и browser-local дату, поэтому не является целевым UX: `components/trainer/canonical-roster-assignment-dialog.tsx:15-35`.
- Builder-dialog отправляет тот же command, но не даёт выбора и точного revision contract: `components/trainer-os/workout-template-builder/canonical-builder-assignment-dialog.tsx:42-60`.
- Demo drawer использует mock/demo runtime и локальные suitability/recent facts, поэтому остаётся только prototype evidence: `components/trainer-os/quick-assign/quick-assign-drawer.tsx:44-62`, `:145-160`.
- Return и next-item принадлежат R2A.3: `lib/server/trainer-workflow/trainer-workflow-transition-service.ts:100-155`.

## 2. Confirmed architecture constraints

| Ограничение | UX-следствие |
| --- | --- |
| Новая доменная сущность не нужна | Sheet собирает read model вокруг существующих Template, Revision, Assignment и Relation. |
| Единственный command owner — `WorkoutService.createAssignment` | UI не создаёт локальную mutation и не пишет Assignment через Builder state. |
| Assignment создаётся из сохранённой опубликованной revision | Draft и unsaved work отсутствуют в обычном списке и не имеют submit action. |
| Submit привязан к exact `templateRevisionId` | Preview и подтверждение показывают одну и ту же версию; замена на current revision молча запрещена. |
| Assignment — независимый snapshot | Изменения Template после назначения не изменяют receipt и существующий Assignment. |
| Exercise overrides исключены | Состав, prescription и подходы в preview только для чтения. |
| Program исключён | Нет выбора программы, дня программы и создания ProgramAssignment. |
| R2A.3 — единственный transition contract | Origin влияет на receipt и возврат, но не на authorization. |
| PostgreSQL — source of truth | Нет mock, demo-runtime, localStorage или client-derived фактов. |
| Template list set-based и paginated | Список не гидратирует полный состав каждого шаблона. |
| Preview загружает exact revision отдельно | Подробные упражнения появляются только после явного выбора. |
| `assignmentStateToken` opaque | Token никогда не показывается пользователю и используется только для stale-state проверки. |
| Migration не нужна | Дизайн не предполагает изменение schema. |

## 3. Product decisions used by the design

1. Athlete фиксируется entry context и не может быть заменён dropdown-ом внутри Sheet.
2. При обычном входе ни один шаблон не выбран.
3. Builder return может предложить exact опубликованную revision как preselection только после серверной проверки ownership, статуса и revision identity.
4. Дата изначально пуста. `Сегодня`, `Завтра` и календарь являются явными действиями тренера.
5. Exact same revision + date блокируется как вероятный дубль.
6. Другая тренировка на ту же дату разрешается только после explicit confirmation.
7. Будущая работа на другие даты показывается информационно и не блокирует назначение.
8. Success receipt заменяет форму; toast не является доказательством сохранения.
9. Receipt actions вычисляются из validated R2A.3 origin.
10. Quick Assign не меняет Template instruction, упражнения, подходы или prescription.
11. Закрытие Sheet до submit ничего не сохраняет, кроме уже опубликованного в Builder шаблона.
12. Открытие Quick Assign и просмотр шаблонов не разрешают AttentionItem.

## 4. User jobs

### Primary job

> Быстро назначить конкретному спортсмену существующий опубликованный шаблон, убедившись, что назначается точная версия и новое назначение не конфликтует с уже запланированной работой.

### Supporting jobs

1. Проверить личность спортсмена до выбора шаблона.
2. Найти опубликованный шаблон по названию, описанию или категории.
3. Увидеть revision, структуру упражнений и количество подходов до submit.
4. Выбрать дату в календарном контексте спортсмена.
5. Добавить assignment-specific заметку, не меняя Template.
6. Увидеть следующую и остальные будущие тренировки.
7. Осознанно подтвердить вторую тренировку на ту же дату.
8. Восстановиться после stale revision, network error или concurrent state change без потери введённых данных.
9. При отсутствии подходящего шаблона перейти в Builder и вернуться к тому же спортсмену и origin.
10. После сохранения продолжить исходный workflow, не угадывая следующий экран.

## 5. Entry points

| Сценарий | Пользовательская задача | Entry | Основное действие | Следующий экран | Возврат и состояние | Keep / change / remove |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard no-assignment | Закрыть приоритетную нехватку тренировки | Attention item / CTA на Dashboard | Открыть Quick Assign для указанного athlete | Та же contextual Sheet | Receipt: server `Next item`; secondary Profile/Queue | Keep reason и queue context; change Builder destination на Quick Assign |
| Profile Header | Выполнить текущий профильный CTA | R1 Header `Назначить тренировку` | Открыть Sheet | Profile остаётся под Sheet | Receipt: `Вернуться к тренировкам`, focus `nextAssignment` | Keep Header ownership; remove duplicate primary CTA в tab |
| Profile Training tab | Назначить из текущего контекста тренировок | Secondary action в блоке `Работа сейчас`/empty state | Открыть Sheet | Profile Training | Return к тому же tab и semantic focus | Keep context; use secondary action only |
| Clients roster | Назначить выбранному человеку из списка | Row action/menu | Открыть Sheet с фиксированным athlete | Roster остаётся под Sheet | Receipt: primary `К списку`, secondary `Открыть профиль` | Adapt current roster dialog into shared surface; remove athlete selector/auto-selection |
| Review completion | После независимого закрытия разбора назначить следующую работу | R2B completion receipt | Optional `Назначить тренировку` | Quick Assign for same athlete | Receipt: server Next item; secondary Profile/Queue | Keep review persistence independent; never make assignment required for review completion |
| Direct contextual invocation | Назначить по авторизованной ссылке без доказанного queue origin | Canonical host URL | Open neutral Sheet | Profile context if authorized | Receipt: primary Profile, secondary Dashboard | Invalid flow becomes neutral; context is not authorization |
| Builder after publish | Назначить только что опубликованную exact revision | Builder publish receipt | `Назначить спортсмену` / return intent | Quick Assign with verified preselection | Preserve athlete and original R2A.3 context | Keep published Template; no silent assignment |
| Invalid or stale flow | Безопасно продолжить без ложного origin | Malformed/expired `flow` | Load authorized athlete context neutrally | Quick Assign or safe profile fallback | Explain refreshed navigation context; no sensitive disclosure | Keep server fallback; remove client-trusted origin behavior |

## 6. Canonical surface and host

### 6.1 URL contract

```text
/trainer/clients/{athleteId}?tab=training&assign=1&flow={validated-envelope}
```

- `athleteId` задаёт requested context, но доступ повторно проверяется сервером.
- `assign=1` отвечает только за открытое состояние Sheet.
- `flow` несёт origin/return metadata R2A.3 и не является authorization evidence.
- Search query, note, date, revision token и state token не помещаются в URL.
- Закрытие Sheet убирает `assign` и Quick Assign-specific параметры через navigation contract, сохраняя profile tab и origin.

### 6.2 Surface behavior

- Sheet открывается поверх canonical profile frame, поэтому athlete identity остаётся визуально связанным с профилем.
- Для roster, Dashboard и Review host всё равно нормализуется к profile Training URL; фон не используется как источник данных.
- Desktop Sheet появляется справа и не вызывает document-level horizontal overflow.
- Mobile Sheet занимает весь visual viewport.
- Закрытие возвращает focus точному trigger, если он существует; иначе — безопасному heading исходного экрана.
- Browser Back закрывает Sheet до ухода со страницы.

### 6.3 Why not a Dialog or Builder page

- Обычный Dialog слишком узок для поиска, списка и exact preview.
- Отдельная full page теряет ощущение быстрого контекстного действия и усложняет возврат.
- Builder решает authoring job, а Quick Assign — selection and confirmation job.
- Выбранный preview встроен во вторую колонку Sheet; отдельный Preview Drawer в R2C не создаётся.

## 7. Primary and secondary actions

В каждый момент существует одна command-oriented primary action.

| State | Primary | Secondary / navigation |
| --- | --- | --- |
| Selection idle | Нет primary submit | `Создать шаблон`, закрыть Sheet |
| Template selected, preview loading | Disabled `Назначить тренировку` | Вернуться к списку на mobile |
| Preview ready, date empty | Disabled `Назначить тренировку` | Выбрать дату, изменить выбор |
| Ready, no blocking conflict | `Назначить тренировку` | Изменить шаблон, закрыть |
| Same-date different assignment | Disabled до confirmation, затем `Назначить тренировку` | Открыть существующее назначение при наличии route |
| Exact duplicate | Нет submit | Открыть существующее назначение / выбрать другую дату или revision |
| Stale revision/state | `Обновить данные` | Выбрать другой шаблон, закрыть |
| Submitting | Disabled `Назначаем...` | Закрытие блокируется до результата |
| Recoverable failure | `Повторить` | Изменить поля; закрыть с discard confirmation при dirty state |
| Persisted success | Origin-specific receipt primary | Profile / Queue / Clients / Dashboard according to R2A.3 |
| Suspended/denied | Нет command | Safe return only |

Правила:

- В list column нет второй кнопки `Назначить`.
- `Создать шаблон` — navigation, не competing primary command.
- Quick actions даты не считаются primary workflow action.
- Удаление, редактирование и архивирование Template отсутствуют.

## 8. Transition and return map

```text
Dashboard / Profile / Training / Clients / Review / Direct
                         |
                         v
              Canonical Quick Assign Sheet
                 |                 |
       no suitable template       select revision
                 |                 |
                 v                 v
              Builder       preview + date + note
                 |                 |
            publish exact          submit
                 |                 |
                 +-------> Quick Assign
                                   |
                              persisted receipt
                                   |
                     R2A.3 Next / Profile / Queue /
                         Clients / Dashboard / all-calm
```

| Origin | Success primary | Secondary | Restoration |
| --- | --- | --- | --- |
| Dashboard | Server `Следующая задача` | `К профилю`, `К очереди` | Revalidated queue position or nearest surviving item |
| Profile Header/Training | `Вернуться к тренировкам` | `К очереди` when valid | `tab=training`, focus `next-assignment` |
| Clients | `К списку спортсменов` | `Открыть профиль` | Same roster search/filter/row position when available |
| Review receipt | Server `Следующая задача` | `К профилю`, `К очереди` | Review remains completed independently |
| Direct/invalid flow | `Открыть профиль` | `На главную` | No invented queue position |
| All-calm | `К спортсменам` | `На главную` | Explicit calm state, no fake next item |
| Builder return | Original origin action | Original secondary destinations | Original athlete and validated flow restored |

### 8.1 Scroll and focus restoration

- Close without submit restores the exact trigger.
- Return from Builder restores search query, loaded pages, date and note held by the Quick Assign flow; published revision is proposed as verified preselection.
- Return after success reloads canonical profile/dashboard reads before focus movement.
- Profile return focuses `next-assignment`, not a remembered pixel coordinate.
- Queue return restores semantic item/neighbor after revalidation.
- If the target disappeared, focus falls back to `Работа сейчас` or page heading.
- With `prefers-reduced-motion`, focus movement does not use smooth scrolling.

## 9. Information hierarchy

### 9.1 Context header

Always visible:

1. Sheet title `Назначить тренировку`.
2. Athlete avatar/initials and display name.
3. Origin phrase: `Из очереди`, `Из профиля`, `После разбора` or neutral `Для спортсмена`.
4. Current next Assignment, if present.
5. Upcoming count, if greater than one.
6. Close control.

Never shown:

- athlete selector;
- internal relation ID;
- Attention ID;
- state token;
- queue scoring.

### 9.2 Selection column

Order:

1. Heading `Выберите шаблон`.
2. Server search.
3. Result count/status announcement.
4. Single-selection template list.
5. Cursor action `Показать ещё`.
6. Empty/supporting action `Создать шаблон`.

List item facts:

- title;
- `Версия N`;
- category when canonical;
- exercise count;
- prescribed set count;
- duration only when canonical value exists;
- updated date;
- selected and unavailable state.

### 9.3 Preview and confirmation column

Before selection:

```text
Выберите шаблон
Здесь появятся точная версия, состав тренировки и параметры назначения.
```

After selection:

1. Template title and exact human-facing revision number.
2. Read-only source summary.
3. Compact exercise structure.
4. Optional disclosures for set prescriptions and supersets.
5. Divider: `Параметры назначения`.
6. Required scheduled date.
7. Optional trainer note.
8. Upcoming work and conflicts.
9. Error summary or stale message.
10. Primary submit.

### 9.4 Density rules

- One outer Sheet, no card wall and no cards nested inside cards.
- Dividers and unframed sections provide hierarchy.
- Template rows use stable minimum height; long names wrap to two lines without moving controls.
- Preview does not repeat every metadata field in separate KPI boxes.
- Warnings are ordered by actionability: blocking, confirmable, informational.

## 10. Desktop wireframe, 1440 x 1024

Target Sheet width: 920 px within allowed 880-960 px. Selection track: 360 px. Preview track: remaining 560 px. Header and receipt span both tracks.

```text
PAGE UNDERLAY: Athlete Profile / Training
                                   +-----------------------------------------------+
                                   | Назначить тренировку                     [x] |
                                   | [АС] Артём Смирнов · Из очереди               |
                                   | Следующая: 12 сен · Верх тела   Ещё: 2        |
                                   +------------------+----------------------------+
                                   | SELECT 360 px    | PREVIEW / CONFIRM 560 px   |
                                   |                  |                            |
                                   | Выберите шаблон  | <initial>                  |
                                   | [Поиск________]  | Выберите шаблон            |
                                   | 18 результатов   | Точная версия и состав     |
                                   |                  | появятся здесь.            |
                                   | ( ) Верх тела    |                            |
                                   |     Версия 4     | <selected>                 |
                                   |     7 упр · 24   | Верх тела                  |
                                   | (o) Ноги А       | Версия шаблона 6           |
                                   |     Версия 6     | 6 упражнений · 22 подхода  |
                                   |     6 упр · 22   | Инструкция...              |
                                   | ( ) Full body    |                            |
                                   |     Версия 2     | Состав тренировки          |
                                   |                  | 1. Жим ногами     [v]      |
                                   |                  | 2. Выпады          [>]      |
                                   | [Показать ещё]   | 3. Сгибание ног    [>]      |
                                   | Создать шаблон   |                            |
                                   |                  | -------------------------- |
                                   |                  | Параметры назначения       |
                                   |                  | Дата тренировки *          |
                                   |                  | [Сегодня] [Завтра] [date]  |
                                   |                  | Заметка спортсмену         |
                                   |                  | [________________________] |
                                   |                  | Будущие тренировки: 2      |
                                   |                  | [warning / confirmation]   |
                                   +------------------+----------------------------+
                                   |                         [Назначить тренировку] |
                                   +-----------------------------------------------+
```

Desktop behavior:

- Context header sticky внутри Sheet.
- List and preview scroll independently beneath the header.
- Submit area принадлежит preview и остаётся доступным без document-level fixed overlay.
- Selection remains selected while another cursor page loads.
- Loading next page appends rows; it does not clear existing results.
- Search resets cursor but not scheduled date or note.
- No first-row auto-selection.
- Long title wraps; revision/meta remain below it; no horizontal scroll.
- At widths below the two-column threshold, layout switches to mobile sequence instead of compressing columns.

## 11. Mobile wireframes, 390 x 844

### 11.1 State 1: template selection

```text
+--------------------------------------+
| [x] Назначить тренировку             |
| [АС] Артём Смирнов                   |
| Из профиля · Будущих тренировок: 2   |
+--------------------------------------+
| Выберите шаблон                      |
| [Поиск по шаблонам_______________]   |
| 18 результатов                       |
|                                      |
| ( ) Верх тела                        |
|     Версия 4 · 7 упр · 24 подхода    |
|                                      |
| ( ) Ноги А                           |
|     Версия 6 · 6 упр · 22 подхода    |
|                                      |
| ( ) Full body                        |
|     Версия 2 · 8 упр                 |
|                                      |
| [Показать ещё]                       |
|                                      |
| Нет подходящего? [Создать шаблон]    |
+---------------- safe area -----------+
```

Choosing a row moves to State 2 and focuses its heading. Search query, loaded rows, cursor position and scroll position remain in memory.

### 11.2 State 2: preview and assignment

```text
+--------------------------------------+
| [<] К шаблонам                   [x] |
| Артём Смирнов                        |
+--------------------------------------+
| Ноги А                               |
| Версия шаблона 6                     |
| 6 упражнений · 22 подхода            |
|                                      |
| Состав тренировки                    |
| 1. Жим ногами                  [v]   |
|    4 x 8-10 · отдых 120 сек          |
| 2. Выпады                      [>]   |
| 3. Сгибание ног                [>]   |
|                                      |
| Дата тренировки *                    |
| [Сегодня] [Завтра] [Открыть календарь]|
| Часовой пояс спортсмена: Москва      |
|                                      |
| Заметка спортсмену                   |
| [__________________________________] |
| 0 / 2000                             |
|                                      |
| Будущие тренировки                   |
| 12 сен · Верх тела                   |
| [ ] Назначить ещё одну на эту дату   |
|                                      |
| [Назначить тренировку]               |
+---------------- safe area -----------+
```

### 11.3 Mobile success

```text
+--------------------------------------+
| Тренировка назначена                 |
| Артём Смирнов                        |
| Ноги А · версия 6                    |
| 14 сентября 2026                     |
| Назначение сохранено · ref …8F2A     |
|                                      |
| [Вернуться к тренировкам]            |
| Открыть очередь                      |
+---------------- safe area -----------+
```

Mobile behavior:

- Sheet uses the full visual viewport and safe-area padding.
- Tap targets are at least 44 x 44 px.
- No hover-only controls or wide tables.
- `К шаблонам` restores search/list state exactly.
- Expanded prescriptions use accessible disclosure buttons.
- Submit remains after the form in reading order. Sticky enhancement is allowed only if the visual viewport keeps it above the keyboard and content receives equivalent bottom padding.
- On textarea focus, the form scrolls the field and submit region into the resized viewport.
- Success replaces both states; Back does not resubmit.

## 12. Template selection

### 12.1 Eligibility

Default list contains only:

- templates owned by the active trainer;
- current revision with status `published`;
- non-archived templates;
- revisions containing at least one exercise;
- revisions confirmed assignable by the server.

Draft and archived templates are hidden. A stale direct or Builder preselection may return a non-selectable tombstone only to explain why it cannot be assigned.

### 12.2 Sorting, search and pagination

Canonical order:

```text
updatedAt DESC, templateId DESC
```

- Search is server-side across title, description and category.
- Search input has a visible label or accessible name, clear control and loading state.
- Query changes reset the list cursor and result count, but retain date and note.
- Cursor pagination appends results through `Показать ещё`.
- Invalid cursor reloads the first page and announces that the list was refreshed.
- Cursor exhausted removes/disabled pagination with `Все шаблоны показаны` status.
- Selected row stays visible and selected even when later pages are appended.

### 12.3 Selection semantics

- List behaves as a single-selection radiogroup/listbox.
- No row is selected on neutral entry.
- Selection is conveyed by control state, label and focus treatment, not color alone.
- Choosing a different row invalidates the previous preview request and loads the new exact revision.
- Submit stays disabled until preview status is `ready` for the selected `templateRevisionId`.
- No `Подходящие`, `Недавние`, `Избранное`, usage score or AI recommendation without a canonical source.

### 12.4 Empty results

- No published templates: `Нет опубликованных шаблонов` and primary navigation action `Создать шаблон`.
- Search empty: `По этому запросу шаблоны не найдены`; action `Сбросить поиск`; Builder remains secondary.
- No silent fallback from an empty search to all templates.

## 13. Selected revision preview

Preview is fetched for the exact selected `templateRevisionId`, not for mutable `template.current_revision` inferred on the client.

### 13.1 Visible source facts

- title;
- `Версия шаблона N`;
- description and category when stored;
- general instruction;
- exercise count;
- prescribed set count;
- canonical estimated duration, when present;
- compact ordered exercises;
- superset grouping and order;
- prescription summary and per-set details through disclosure.

Description, category and estimated duration are labelled as template facts. Assignment snapshot facts are title, instruction, exercises, prescriptions and the exact revision identity according to the canonical command contract.

### 13.2 Interaction rules

- Composition is read-only.
- No inline edit, reorder, override, remove, duplicate or archive controls.
- Long exercise names wrap and keep disclosure control reachable.
- Preview error preserves selected row, search, loaded pages, date and note.
- Retry reloads the same exact revision.
- The UI must not show a preview that differs from the snapshot command payload.
- If exact preview cannot be loaded completely, submit remains disabled.

## 14. Scheduled date and trainer note

### 14.1 Scheduled date

Initial state is empty and required.

Controls:

- segmented quick choices `Сегодня` and `Завтра`, each resolving to an explicit ISO date in server-provided calendar context;
- calendar/date input;
- visible selected full date;
- timezone explanation when athlete timezone is available.

Validation:

| Situation | Design response |
| --- | --- |
| No date | Inline `Выберите дату тренировки`; submit disabled. |
| Past date | `Дата уже прошла. Выберите сегодня или будущую дату.` |
| Below server `minScheduledFor` | Use server boundary; do not trust browser clock. |
| Browser/server timezone mismatch | Explain athlete timezone and validate against server calendar date. |
| Athlete timezone unavailable | Label `Дата будет сохранена как календарная дата`; do not invent timezone. |
| Search/preview reload | Retain selected date. |
| Recoverable 409 | Retain date until trainer explicitly changes it. |

No browser-local hidden default is allowed. Clicking `Сегодня` or `Завтра` is a visible user decision.

### 14.2 Trainer note

- Label: `Заметка спортсмену`.
- Optional, assignment-specific and distinct from `Общая инструкция шаблона`.
- Maximum length follows the existing command contract, currently 2000 characters.
- Character count appears near the limit and is announced when exceeded.
- Note is preserved after preview, stale-state and recoverable network failures.
- Note is not stored in URL and never mutates Template.
- Placeholder avoids prescribing content: `Необязательно: акцент, ограничение или напоминание`.

Dirty close opens a compact discard confirmation only when template/date/note have changed. Builder-published Template is never deleted by discarding Quick Assign.

## 15. Upcoming assignments and conflicts

| Canonical state | Presentation | Submit behavior |
| --- | --- | --- |
| No future work | No warning; optional `Будущих тренировок нет` in context | Allowed when other fields valid |
| One Assignment on another date | Compact informational row with date/title | Allowed |
| Several future Assignments | `Будущие тренировки: N`; show nearest, disclose rest | Allowed |
| Same date, different Assignment | Amber warning with existing title/date | Requires explicit checkbox/confirmation |
| Same date, exact revision duplicate | Blocking duplicate state with stable reference | Blocked; no confirmation override |
| Existing Assignment created in another tab | State token conflict; reload canonical future work | Reconfirm after reload |
| Existing Assignment cancelled after read | Reload updates list and token | No warning after refreshed validation |
| `assignmentStateToken` mismatch | `План спортсмена изменился после открытия` | Block current submit until reload/reconfirmation |

Explicit same-date copy:

```text
На эту дату уже назначена другая тренировка.
[ ] Назначить ещё одну тренировку на эту дату
```

Rules:

- Confirmation resets when date, selected revision or canonical future state changes.
- Exact duplicate is based on exact revision + scheduled date for the same athlete, not title matching.
- Other-date future work never becomes a hidden blocker.
- UI does not optimistically insert or remove future Assignments.
- Conflict list comes from the read model and is revalidated transactionally at submit.

## 16. Stale revision and concurrency

### 16.1 Stale revision states

| State | Message | Recovery |
| --- | --- | --- |
| `template_revision_stale` | `Шаблон обновился после открытия. Показанная версия N больше недоступна для назначения.` | Keep fields; old revision unavailable; show new current revision unselected. |
| `template_unavailable` | `Шаблон больше недоступен.` | Return to list; no ownership/status disclosure beyond authorized context. |
| Archived after preview | `Шаблон был архивирован и его нельзя назначить.` | Keep date/note; choose another template. |
| New current revision | `Доступна новая версия N.` | Trainer explicitly selects it; no automatic replacement. |
| Stale direct preselection | Tombstone at top of list | Focus message; continue with normal published list. |
| Foreign template substitution | Generic unavailable state | Do not reveal owner, title or existence. |

Required stale copy:

> Шаблон обновился после открытия. Показанная версия 4 больше недоступна для назначения. Проверьте актуальную версию.

On stale response:

1. Keep scheduled date and trainer note.
2. Mark old selection unavailable.
3. Clear assignment confirmation tied to old facts.
4. Load list/current state from server.
5. Leave new revision unselected until explicit action.
6. Move focus to the stale-state message.

### 16.2 Relation and future-state concurrency

- Relation is checked at read and again inside command transaction.
- Relation suspended before submit produces a no-command state; it is not a generic retry error.
- `assignmentStateToken` mismatch reloads upcoming work and requires conflict confirmation again.
- Concurrent assignment from another tab is not automatically removed or merged.
- Invalid transition context affects only navigation receipt, never athlete/template authorization.

## 17. Idempotency and failure recovery

### 17.1 Logical command identity

The Sheet creates one `assignmentId` for the first valid submit attempt.

- Double click and repeated network retry with unchanged logical payload reuse this ID.
- While submitting, all submit controls are disabled.
- Exact persisted replay returns the same Assignment receipt.
- A changed revision, date, note or required conflict acknowledgement constitutes an edited payload; it cannot reuse a key whose persisted payload differs.
- The final command contract determines whether a new ID is generated immediately after edit or after a modified-retry conflict. UI must never silently reinterpret a 409 as success.

### 17.2 State handling

| Event | UI response |
| --- | --- |
| First submit | Disable form; announce `Назначаем тренировку...`. |
| Double click | Ignore client duplicate; one request remains in flight. |
| Network failure before known result | Keep exact selection, revision, date, note and assignment ID; offer `Проверить и повторить`. |
| Identical replay persisted | Show receipt for existing Assignment; no duplicate audit/outbox claim. |
| Same ID, changed payload | Blocking `Данные попытки изменились`; require a new logical command path. |
| Persistence success, transition/revalidation failure | Keep success receipt; show stable Profile/Dashboard fallbacks; never resubmit Assignment. |
| Server validation error | Focus error summary and linked field; preserve unrelated fields. |

There is no fake optimistic success. Receipt appears only from persisted Assignment returned by the server.

## 18. Builder handoff

```text
Quick Assign
  -> Нет подходящего шаблона
  -> Builder with athlete + validated R2A.3 intent
  -> Save draft
  -> Publish
  -> Return to Quick Assign
  -> server verifies exact published revision
  -> revision proposed as preselection
  -> trainer reviews and confirms Assignment
  -> original origin receipt
```

Rules:

1. `Сохранить черновик` never assigns.
2. `Опубликовать` never silently assigns.
3. Builder does not create local Assignment.
4. Cancellation after publication leaves Template saved.
5. Original athlete and flow remain intact but are revalidated on return.
6. Search/list/date/note restoration is a Quick Assign concern, not Template persistence.
7. A returned revision that is draft, archived, foreign or stale is shown as unavailable, not replaced.
8. Program selection is absent.
9. This design does not redesign Builder.

## 19. Completion receipt

Receipt replaces selection and confirmation content inside the same Sheet.

### 19.1 Persisted facts

Show:

- heading `Тренировка назначена`;
- athlete display name;
- Assignment snapshot title;
- source revision number in human form;
- scheduled date;
- stable shortened assignment reference with accessible full value if needed for support;
- persisted status;
- athlete notification/delivery status only when canonically available;
- R2A.3 actions.

Do not show:

- `assignmentStateToken`;
- revision UUID;
- raw snapshot token;
- optimistic `Спортсмен уведомлён`, unless confirmed by canonical delivery state.

### 19.2 Origin-specific actions

| Origin | Primary | Secondary |
| --- | --- | --- |
| Dashboard | Server `Следующая задача` | `К профилю`, `К очереди` |
| Profile | `Вернуться к тренировкам` | Queue when valid |
| Clients | `К списку спортсменов` | `Открыть профиль` |
| Review | Server `Следующая задача` | `К профилю`, `К очереди` |
| Direct | `Открыть профиль` | `На главную` |
| All-calm | `К спортсменам` | `На главную` |

### 19.3 Revalidation failure after persistence

Copy:

```text
Тренировка сохранена, но рабочую очередь не удалось обновить.
```

Keep the success receipt and stable fallback links. Never return to an enabled submit form for the same persisted command.

## 20. State matrix

| State | Selection/list | Preview/form | Command/navigation |
| --- | --- | --- | --- |
| Initial loading | Athlete-shaped header skeleton; list skeleton | Neutral preview skeleton | Close available; no submit |
| Athlete unavailable | No athlete-sensitive template facts | Generic unavailable state | Safe Clients/Dashboard return |
| Relation suspended | Authorized athlete context may remain; templates hidden or inert | Explain assignment unavailable | No command; safe profile/list return |
| Permission denied | Non-disclosing state | No athlete/template facts | Safe return only |
| Templates loading | Search disabled or busy; stable skeleton rows | Initial guidance remains | No submit |
| No published templates | Empty state `Нет опубликованных шаблонов` | No preview | `Создать шаблон` if capability allows |
| Search empty | Keep query and result count zero | Initial guidance | `Сбросить поиск`; Builder secondary |
| Long list | Virtualization only if needed; stable row size | Independent scroll | Cursor pagination |
| Cursor exhausted | Existing rows remain | Unchanged | Announce `Все шаблоны показаны` |
| Invalid cursor | Reload first page; announce refresh | Keep selected exact preview if still valid | No submit interruption unless selection stale |
| Preview idle | No selected row | `Выберите шаблон` | No submit |
| Preview loading | Selected row busy | Exact-revision skeleton, old preview cleared | Disabled submit |
| Preview ready | Selected state visible | Complete read-only facts and form | Submit depends on date/conflicts |
| Preview error | Keep row/search/pages | Error for exact revision with retry | Submit disabled |
| Preview stale | Old row/tombstone unavailable | Focus stale explanation | Reload/select explicitly |
| Template archived | Tombstone only when previously selected | Archived explanation | Choose another / close |
| Template draft | Not in normal list; stale preselection tombstone | Draft cannot be assigned | Builder navigation only |
| No date | Selection preserved | Inline required state | Submit disabled |
| Invalid/past date | Selection/note preserved | Field error with server boundary | Submit disabled |
| Long note | Selection/date preserved | Counter and linked error above limit | Submit disabled until valid |
| Future assignments | Context count and nearest facts | Informational section | Submit allowed on other dates |
| Exact duplicate | Existing item identified | Blocking duplicate message | No override; open existing/change input |
| Same-date conflict | Existing different Assignment shown | Explicit unchecked confirmation | Submit enabled only after confirmation |
| Concurrent state change | List may remain | `План спортсмена изменился` | Reload and reconfirm |
| Assignment submitting | Selection locked | Inputs read-only/disabled | One disabled `Назначаем...` |
| Double click | No visual duplicate | Existing progress remains | Ignore second event |
| Network failure | Preserve all draft state | Recoverable error summary | Retry same logical command |
| Idempotent replay | Selection no longer needed | Persisted receipt | Origin actions only |
| Modified retry conflict | Preserve edited values | Explain command identity conflict | Create explicit new attempt after validation |
| Relation changed before submit | List becomes inert after response | Assignment unavailable | Safe return; no generic retry |
| Template changed before submit | Old selection stale | New revision unselected | Explicit reselection required |
| Persistence success | Replace list | Replace form with receipt | R2A.3 actions |
| Revalidation failure | Replace list | Success receipt plus refresh caveat | Stable Profile/Queue/Dashboard fallbacks |
| Invalid flow | Authorized data loads neutrally | No false origin copy | Server-derived safe receipt |
| Builder return valid | Restored list/search; verified row proposed | Exact published preview loads | Explicit confirmation required |
| Builder return invalid | Tombstone/non-disclosing message | Restored date/note; no preview | Choose another template |
| Mobile keyboard | Selection state unchanged | Field and submit remain visible in visual viewport | No hidden action behind keyboard |
| Long template name | Two-line wrap; meta below | Full wrapping heading | No horizontal overflow |
| Long exercise name | Not hydrated in list | Wrap inside disclosure row | 44 px disclosure target |
| Search request race | Latest query owns results | Selected preview remains keyed separately | Stale response ignored |
| Preview request race | Latest selected revision owns preview | Never flash another revision | Submit locked to ready identity |
| Close with clean state | Dismiss | No confirmation | Restore trigger focus |
| Close with dirty state | Preserve until decision | Discard confirmation | Stay or discard; no server mutation |

## 21. Content and terminology

### 21.1 Canonical labels

- `Назначить тренировку`
- `Выберите шаблон`
- `Версия шаблона`
- `Состав тренировки`
- `Дата тренировки`
- `Заметка спортсмену`
- `Следующая тренировка`
- `Будущие тренировки`
- `Тренировка назначена`
- `Шаблон обновился`
- `Шаблон больше недоступен`
- `Назначить ещё одну тренировку на эту дату`
- `Создать шаблон`
- `Показать ещё`

### 21.2 Supporting copy

| Situation | Copy |
| --- | --- |
| Initial preview | `Выберите шаблон, чтобы проверить точную версию и состав тренировки.` |
| No templates | `Опубликованных шаблонов пока нет.` |
| Search empty | `По этому запросу шаблоны не найдены.` |
| Date required | `Выберите дату тренировки.` |
| Same-date work | `На эту дату уже назначена другая тренировка.` |
| Exact duplicate | `Эта версия уже назначена спортсмену на выбранную дату.` |
| State changed | `План спортсмена изменился после открытия. Обновите данные и проверьте назначение ещё раз.` |
| Stale revision | `Шаблон обновился после открытия. Показанная версия больше недоступна для назначения.` |
| Success | `Тренировка назначена и сохранена в плане спортсмена.` |

### 21.3 Terms forbidden in visible UI

- template revision ID;
- `assignmentStateToken`;
- snapshot token;
- stale payload;
- Program day;
- suitable score;
- AI recommendation;
- favourite/recent without canonical source;
- `mutation`, `idempotency key`, `409`;
- raw database status without human translation.

## 22. Accessibility

1. Sheet has an accessible title and description tied to athlete and task.
2. Focus is contained while Sheet is open and returns to the exact trigger on close.
3. Escape closes only when no command is in the persistence-critical submitting phase; dirty state receives discard confirmation.
4. Template selection uses single-selection semantics (`radiogroup` or equivalent listbox pattern).
5. Selected, unavailable and loading states are not conveyed by color alone.
6. Search result count and loading completion are announced through polite live region.
7. `Показать ещё` retains focus on the trigger or moves to the first appended row by an explicit, consistent rule; it never jumps to the top.
8. On mobile, selected preview heading receives programmatic focus after state transition.
9. Error summary receives focus and links to invalid fields where applicable.
10. Stale-state message receives focus after server conflict.
11. Submit/progress/receipt status is announced through `aria-live` without duplicate announcements.
12. Receipt heading receives focus after persistence.
13. Exercise/set disclosures are keyboard accessible and expose expanded state.
14. All mobile tap targets are at least 44 x 44 px.
15. Safe-area padding protects header and final action.
16. Screen-reader order matches visual order: context, selection/preview, form, warning, submit.
17. Desktop independent scroll regions are named and keyboard reachable without trapping focus.
18. Reduced motion disables Sheet and focus-scroll animation while preserving state clarity.
19. Long names reflow at 200% zoom without horizontal page overflow.
20. Calendar control has a text-equivalent selected date and does not depend on icon recognition.

## 23. Component reuse map

| Existing component/service | Decision | Rationale / target use |
| --- | --- | --- |
| `CanonicalRosterAssignmentDialog` | Adapt command behavior, then replace surface with shared Quick Assign host | Contains production fetch/idempotent ID evidence, but auto-selects first template, defaults local date and collapses errors. |
| `CanonicalBuilderAssignmentDialog` | Replace assignment step with handoff to shared surface | Uses canonical command/transition, but fixed template dialog lacks exact read/selection/conflict contract. |
| Demo `QuickAssignDrawer` shell | Prototype-only; selectively reuse interaction ideas, not data/model | Search, progressive preview and mobile flow are useful evidence; mock suitability, overrides and local command are forbidden. |
| `quick-assign-model.ts` | Prototype-only; do not import into production | Contains mock recommendations, recent/favourite and demo facts. |
| `WorkoutService.createAssignment` | Keep as sole command owner | Existing validation, snapshot and idempotency foundation. |
| `PostgresWorkoutRepository.createAssignment` | Keep/adapt for exact revision and stale-state command contract during implementation | Existing transaction copies snapshot and enforces active relation; architecture identifies exact revision/state gaps. |
| `WorkoutRepository.listTemplates` | Do not use unchanged for long list; adapt behind R2C read model | Current query is set-based but hydrates exercises for every row and lacks cursor/search. |
| `WorkoutBuilderRepository.list` | Builder-only | N+1 rich hydration is inappropriate for Quick Assign list. |
| `AthleteTrainingRepository` | Reuse canonical future Assignment facts through composition | Source for next/upcoming state; avoid parallel cache. |
| `TrainerWorkflowTransitionService.forAssignment` | Keep | Owns validated receipt, next item, queue and all-calm behavior. |
| `revalidateTrainerWorkflow` | Keep | Revalidates canonical consumers after persistence. |
| `WorkflowReturnReceipt` | Adapt/wrap shared receipt presentation | Existing focus/live-region pattern is useful; Quick Assign receipt requires richer persisted facts and origin actions. |
| Sheet primitives | Reuse | Appropriate for 920 px desktop and full-screen mobile contextual host. |
| Dialog primitives | Reuse only for discard confirmation | Main R2C surface is a Sheet, not narrow Dialog. |

Later removal of old dialogs/demo imports requires a separate import audit and is not part of this design stage.

## 24. Keep / change / remove

### Keep

- canonical `WorkoutService.createAssignment` ownership;
- transactional independent Assignment snapshot;
- stable client-generated command identity for retries;
- trainer-athlete relation enforcement;
- R2A.3 transition, revalidation and receipt;
- fixed contextual athlete identity;
- published Template lifecycle;
- dark restrained trainer UI language and existing primitives.

### Change during R2C implementation

- create canonical QuickAssignReadModel and selected-revision preview contract;
- bind preview and submit to exact `templateRevisionId`;
- add server search and cursor pagination;
- replace auto-selection with explicit selection;
- make scheduled date explicit and server-calendar aware;
- expose canonical upcoming work and state token;
- map duplicate, same-date, stale, suspended and permission errors separately;
- route all production entry points to the shared Sheet;
- return from Builder with exact published revision and original flow;
- show persisted receipt before navigation;
- preserve semantic focus and origin return.

### Remove from the R2C target

- mock recommendations and suitability;
- automatic first template selection;
- athlete switching inside assignment surface;
- browser-local hidden date default;
- local mutation or local Assignment receipt;
- assignment from draft or unsaved Builder state;
- exercise/prescription overrides;
- Program and ProgramAssignment controls;
- generic catch-all assignment error;
- editable template instruction in Quick Assign;
- separate production assignment dialogs after shared-surface migration;
- optimistic insertion/removal of upcoming Assignments.

## 25. Acceptance criteria

### Workflow and comprehension

1. All production entry points open one canonical contextual Quick Assign surface.
2. Athlete identity is visible and fixed by validated context.
3. Neutral entry selects no template automatically.
4. Only own current published, non-archived revisions are normally selectable.
5. Preview identifies and loads the exact selected revision.
6. Submit creates that exact previewed revision or returns a stale conflict.
7. Date is required and chosen explicitly.
8. Trainer note is visibly separate from Template instruction.
9. Exercise and set composition are read-only.
10. Existing future work is visible before submit.
11. Exact same revision/date duplicate is blocked.
12. Same-date additional work requires explicit confirmation.
13. Concurrent state change requires reload and reconfirmation.
14. Retry of the same logical command does not duplicate Assignment.
15. Receipt is based on persisted Assignment facts.
16. R2A.3 determines return, next item and all-calm state.
17. Builder handoff preserves athlete and validated flow.
18. Publishing in Builder does not silently assign.
19. Draft cannot be assigned.
20. Program is absent.
21. No mock/demo/localStorage facts enter production UX.

### Responsive and accessibility

22. Desktop 1440 x 1024 supports independent list/preview scrolling without horizontal overflow.
23. Mobile 390 x 844 supports selection, preview, date, note, conflict and receipt without hidden submit.
24. Search/list state survives mobile back-to-templates.
25. Long template and exercise names wrap without occluding controls.
26. Keyboard-only user can search, select, inspect disclosures, choose date, confirm conflict and submit.
27. Focus returns to trigger on close and moves to preview/error/receipt at semantic transitions.
28. Screen reader receives result counts, errors, submitting state and success.
29. Reduced-motion mode remains fully usable.

### Data and recovery

30. List is set-based and paginated; no full exercise hydration per list row.
31. Preview request is isolated to exact selected revision.
32. Date and note survive recoverable preview, network, stale and 409 errors.
33. A stale revision is never replaced silently.
34. A foreign template/athlete substitution produces a non-disclosing failure.
35. Persistence success plus revalidation failure never invites duplicate submit.
36. Opening or closing Quick Assign does not resolve AttentionItem.
37. Trainer and athlete continue to reference the same Assignment identity.

### Scope boundary

38. No production code was written in this design step.
39. No UI, API, routes, schema or migrations were changed.
40. R2A.3 was not changed.
41. Builder was not redesigned.
42. Preview Drawer was not implemented.
43. No Program, Progress or Motivation scope was introduced.

## 26. Open decisions and research hypotheses

### 26.1 Decisions required before implementation

1. **Trainer note length.** Architecture aligns with the current 2000-character command limit; confirm this as the visible product limit.
2. **Calendar context fallback.** Confirm the display copy when athlete timezone is unavailable and only a calendar date is stored.
3. **Existing Assignment destination.** Decide whether duplicate/same-date warning links to a dedicated Assignment view or only to Profile Training focus.
4. **Dirty state across Builder navigation.** Confirm whether restoration lives in short-lived server/session flow state or another non-domain mechanism; it must not become localStorage source of truth.
5. **Modified retry identity.** Final API contract must state exactly when UI issues a new `assignmentId` after the trainer edits payload following an uncertain attempt.
6. **List page size.** Choose bounded default after measuring real trainer template counts; design assumes cursor pagination regardless of value.
7. **Search trigger.** Decide debounce versus explicit submit based on latency measurements; both remain server search.
8. **Multiple same-date assignments.** Product accepts explicit confirmation in v1; validate whether pilot trainers need a stronger daily workload summary later.

### 26.2 Research hypotheses

- Trainers will identify a template faster from title + revision + exercise/set counts than from decorative thumbnails.
- Explicit empty date will reduce accidental wrong-day assignments despite adding one interaction.
- A two-step mobile flow will outperform a compressed one-screen form for error rate and comprehension.
- Showing the nearest future Assignment and total count will be sufficient for v1 conflict decisions without embedding a calendar.
- Builder return with explicit final confirmation will feel safe rather than repetitive because publication and assignment are distinct jobs.
- Most trainers will use search after roughly 12-20 templates; telemetry should measure query use and pagination depth without introducing recommendation scoring.

These are hypotheses, not accepted domain facts. They should be validated during the internal trainer pilot.

## 27. Change-boundary confirmation

This task created only:

```text
docs/quick-assign-r2c-design-v1.md
```

The following were not changed as part of this design task:

- production code;
- application UI;
- API handlers or contracts;
- routes;
- PostgreSQL schema;
- migrations;
- R2A.3 transition contract;
- Builder implementation;
- Preview Drawer implementation;
- Program, Progress or Motivation functionality;
- Git history.

No commit was created.
