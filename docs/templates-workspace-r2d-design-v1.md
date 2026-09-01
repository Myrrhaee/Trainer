# R2D Design A: canonical Templates Workspace

Статус: UX design specification; lifecycle R2D.1 реализован, Workspace production implementation не начата
Основа: `docs/templates-builder-r2d-architecture-v1.md` и фактический lifecycle migration `0013_workout_template_revision_lifecycle`
Target route: `/trainer/templates`
Дата: 2026-09-01

## 1. Design verdict

`Шаблоны` должны открывать самостоятельную рабочую коллекцию сохранённых тренировок, а не Editor, форму назначения или набор крупных dashboard-карточек.

Выбранный desktop pattern: **одна плотная card-list surface с разделителями**. Она использует семантический список, но визуально ведёт себя как спокойная единая поверхность. Каждая строка показывает название, lifecycle, краткий состав, последнее изменение, одно видимое основное действие и постоянное overflow-меню. Это не HTML-таблица и не grid из отдельных карточек.

Ключевые решения Design A:

1. `/trainer/templates` является neutral collection route.
2. Primary action страницы: `Создать шаблон` -> `/trainer/builder/new`.
3. Desktop использует dense card-list; mobile использует вертикальные list-cards того же контракта.
4. Lifecycle filters взаимно исключают строки: `Все`, `Только черновики`, `Готовые`, `Есть новая версия`, `Архив`.
5. `Все` показывает только неархивированные шаблоны. Архив доступен отдельным фильтром.
6. `published_with_draft` показывается один раз в `Есть новая версия`, а в `Все` остаётся одной строкой.
7. Neutral Workspace не содержит `Назначить`, athlete selector или Program.
8. Published Revision остаётся видимой и доступной для Quick Assign при наличии Draft, но Workspace сообщает это только как факт, а не как assignment CTA.
9. Duplicate создаёт новый Draft и после подтверждённого server receipt открывает его Editor.
10. Archive подтверждается диалогом; существующие назначения не меняются.
11. Возврат из Editor восстанавливает URL-фильтры, загруженную глубину и semantic Template anchor, а не только pixel scroll.

Текущий `TemplatesWorkspace` является полезным prototype evidence, но target surface не должен наследовать grid из трёх карточек, локальную фильтрацию, mock usage и athlete-aware assignment action (`components/trainer-os/workout-template-builder/templates-workspace.tsx:24-56`, `:120-158`).

## 2. Confirmed implemented lifecycle

R2D.1 уже разделяет последнюю опубликованную и единственную редактируемую версии на уровне PostgreSQL. `published_revision_id` и `editable_revision_id` добавлены как UUID pointers с composite foreign keys на Revision того же Template (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:50-55`, `:99-120`). Deferred lifecycle validation проверяет статус pointers, единственную Draft, latest Published и compatibility head (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:145-237`).

| Реализованное состояние | Canonical server facts | UX consequence |
| --- | --- | --- |
| Draft-only | latest Published отсутствует; editable указывает на Draft | `Черновик`, одна команда продолжения, нельзя заявлять доступность для назначения |
| Published-only | latest Published существует; editable отсутствует | Published открывается read-only; изменение начинается отдельной новой Revision |
| Published + Draft | latest Published и editable Draft существуют одновременно | В одной строке одновременно видны usable Published и незавершённый Draft; primary ведёт в Draft |
| Archived | Template archived; оба исторических pointers сохраняются | Только исторический просмотр/duplicate proposal; edit, publish и assignment отсутствуют |

Подтверждённые ограничения реализации:

- PostgreSQL является source of truth; UI не выводит lifecycle из локального состояния.
- Не более одной editable Draft обеспечивается partial unique index и lifecycle trigger (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:112-120`, `:176-205`).
- Published Revision и её children остаются immutable; RLS разрешает изменение только exact editable Draft владельца (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:244-372`).
- Создание Draft N+1 не меняет published pointer; Quick Assign продолжает читать exact latest Published.
- Публикация атомарно переключает published pointer и очищает editable pointer; существующие Assignment snapshots не изменяются.
- Archived Template сохраняет pointers и историю, но lifecycle-команды и новые назначения запрещены.
- `current_revision` является compatibility head: editable revision number, иначе published revision number (`database/migrations/0013_workout_template_revision_lifecycle.up.sql:91-95`, `:194-197`). Это поле не входит в UX, URL или пользовательскую терминологию.
- Assignment остаётся только в Quick Assign; neutral Workspace не содержит athlete или Program context.

Implemented lifecycle даёт факты для строки, но не реализует Workspace list read model, duplicate command, новые routes или Editor UI. Эти части остаются предметом следующей production implementation, а не скрытыми возможностями Design A.

Accepted navigation already defines `Шаблоны` as primary destination for saved WorkoutTemplate management (`docs/trainer-navigation-and-screen-map-v1.md:8-12`, `:62-72`). Product principles require calm, premium and scannable operational UI rather than a card-heavy hero (`docs/product-principles-v1.md:19-22`).

## 3. Product decisions used by design

This design treats the following as accepted R2D v1 decisions:

- route split: `/trainer/templates`, `/trainer/builder/new`, `/trainer/builder/[templateId]`;
- `/trainer/builder` later becomes compatibility redirect;
- one Template can have last Published plus one editable Draft;
- neutral authoring has no athlete dependency;
- opening create route does not persist an empty Template;
- first persistence occurs only after explicit Draft save;
- duplicate должен стать server-side command с replay-safe receipt; в R2D.1 он ещё не реализован;
- archive affects the entire Template identity but not existing Assignment snapshots;
- restore/delete are absent;
- usage, favourites, recommendations, thumbnails, folders and tags are absent;
- fixed sort is latest meaningful Template update first;
- no first-row auto-open;
- Editor design remains outside Design A.

Design A additionally proposes:

- lifecycle-specific mutually exclusive filters;
- dense card-list as the main collection pattern;
- archived read-only opening;
- duplicate success opens the new Draft Editor;
- `page` plus `anchor` URL state for recoverable append depth and semantic return.

## 4. User jobs

### Primary job

> Найти, создать, открыть и управлять своими сохранёнными тренировками.

### Jobs supported

1. Scan owned templates without opening Editor.
2. Search by title, description or category.
3. Distinguish Draft-only, Published-only, Published-with-Draft and Archived.
4. Continue the one existing Draft.
5. Open the Published Revision read-only.
6. Create a new Revision from Published.
7. Duplicate a Template into a new Draft.
8. Archive the whole Template identity.
9. Create a new Template without athlete or Program context.
10. Return from Editor to the same collection context.

### Jobs explicitly excluded

- assign a workout;
- choose an athlete;
- compose or select a Program;
- edit an existing Assignment;
- inspect complete exercise content in every row;
- rank templates by popularity or AI score;
- restore/delete archived templates.

## 5. Entry points

| Entry | Intent | Initial state | Back/return behavior |
| --- | --- | --- | --- |
| TrainerShell `Шаблоны` | neutral collection | default active list | Dashboard/previous browser location |
| Shell action `Создать шаблон` | direct creation | `/trainer/builder/new` | return to neutral Workspace |
| Browser direct link | shared/bookmarked collection state | URL-derived filters | safe default if state invalid |
| Editor `К шаблонам` | return to collection | restored query/filter/page/anchor | focus semantic row |
| Editor save/publish receipt | see persisted result | restored context plus updated row | receipt then row focus |
| Compatibility `/trainer/builder` | old neutral entry | later redirect to Workspace | preserve safe supported query only |

Quick Assign to Builder is contextual and bypasses neutral Workspace unless the user explicitly chooses `К шаблонам`. Quick Assign date, note, athlete and handoff token must not leak into Workspace URL.

## 6. Route and URL state

Canonical collection URL:

```text
/trainer/templates
/trainer/templates?status=drafts
/trainer/templates?status=updates&q=тяга&category=strength&page=2&anchor=<template-id>
```

### Supported parameters

| Parameter | Values | Purpose | Default/invalid behavior |
| --- | --- | --- | --- |
| `status` | `all`, `drafts`, `published`, `updates`, `archive` | lifecycle filter | omitted means `all`; invalid resets only status |
| `q` | normalized text up to accepted server limit | search | omitted is empty; invalid/too long gets safe validation |
| `category` | stable server category key | category filter | omitted is all; unknown yields category-empty state, not silent all |
| `page` | bounded positive restore depth | number of appended pages to reconstruct | invalid resets to 1 with calm notice |
| `anchor` | authorized Template semantic ID | focus/return target | missing/unavailable falls back to list heading |

The API may internally use opaque cursors. `page` is a recoverable view depth, not offset pagination: on a cold reload the client/server replays bounded cursor pages in order; on normal Back navigation route cache restores already appended rows. `anchor` identifies meaning, not pixels.

### Never stored in Workspace URL

- Template content or exercise rows;
- dirty Editor fields;
- server capabilities or concurrency tokens;
- Quick Assign date/note/handoff;
- athlete ID or Program state;
- raw published/editable pointer fields.

Search changes use `replaceState` after debounce so typing does not create one Back entry per character. Explicit filter changes use a navigation entry only when that supports understandable Back behavior; implementation should keep a single coherent collection history, not dozens of micro-states.

## 7. Primary and secondary actions

### Page action

`Создать шаблон` is the only primary page-level action. It is visible above the fold on desktop and mobile.

### Row actions

| Lifecycle | Visible primary action | Row click destination | Overflow/secondary actions |
| --- | --- | --- | --- |
| Draft-only | `Продолжить редактирование` | Draft Editor | `Дублировать`, `Архивировать` |
| Published-only | `Открыть шаблон` | Published read-only | `Создать новую версию`, `Дублировать`, `Архивировать` |
| Published-with-Draft | `Продолжить редактирование` | Draft Editor | `Посмотреть опубликованную версию`, `Дублировать`, `Архивировать` |
| Archived | `Открыть шаблон` | archived read-only | `Дублировать в новый черновик` |

The non-interactive row body may trigger the same destination for pointer users, but nested controls remain independent. Keyboard and screen-reader users receive an explicit visible link/button; the article itself is not given misleading button semantics.

Overflow is always visible, not hover-only. Its accessible name includes the title, for example `Действия с шаблоном «Силовая база»`.

No neutral row has `Назначить`. The fact `Доступна для назначения` communicates Published availability without starting assignment.

## 8. Transition and return map

```text
TrainerShell
  -> /trainer/templates
     -> Create
        -> /trainer/builder/new
        -> first explicit save
        -> /trainer/builder/[templateId]
        -> return Workspace + anchor new row

     -> Draft row
        -> /trainer/builder/[templateId]
        -> save/cancel/publish
        -> return Workspace + same anchor

     -> Published row
        -> /trainer/builder/[templateId]?view=published
        -> read-only return

     -> Create new revision
        -> server command receipt
        -> /trainer/builder/[templateId]
        -> Draft N+1

     -> Duplicate
        -> confirm
        -> server receipt with new Template identity
        -> /trainer/builder/[newTemplateId]
        -> return Workspace + new anchor

     -> Archive
        -> confirm
        -> server receipt
        -> row leaves active collection or becomes archive row
```

`view=published` is user-facing route intent, not a database revision pointer. The server resolves the authorized Published Revision. If no Published Revision exists, it returns an unavailable state rather than a Draft fallback.

### Return receipts

| Editor outcome | Workspace result | Focus target |
| --- | --- | --- |
| Draft saved | row updated as Draft or Published-with-Draft | row heading/primary action |
| Published | row shows `Опубликована версия N`; previous Draft label removed | row heading plus polite receipt |
| Cancel before first save | no row created | `Создать шаблон` |
| Cancel existing edit | persisted row unchanged/refreshed | original row |
| Archive | row removed from active filter or updated in Archive | next row, previous row or empty heading |
| Duplicate | new Draft exists | Editor first, then new row on return |
| Stale conflict | refreshed canonical row | conflict notice then row |

## 9. Information hierarchy

### Page hierarchy

1. TrainerShell and existing global header.
2. `h1` `Шаблоны` and one-sentence purpose.
3. Exact result count when available and primary `Создать шаблон`.
4. Search and lifecycle/category controls.
5. One collection surface.
6. `Показать ещё` or terminal state.
7. Local command receipt/error region.

No hero, decorative KPI, analytics or nested cards.

### Row hierarchy

1. Title and category.
2. Lifecycle facts and revision numbers.
3. Published availability sentence when applicable.
4. `Упражнения`, `Подходы`, optional duration.
5. `Последнее изменение` and optional publication date.
6. One primary action plus overflow.

Description is searchable but is not shown in every dense row by default. It may appear as a two-line secondary excerpt only if user testing proves category/title insufficient; Design A omits it to preserve scan density.

Result count wording:

- exact total: `Найдено 18`;
- if total is not supplied: `Показано 25`;
- while loading: keep previous truthful count and append `Обновляем список`;
- never estimate a total from `hasNextPage`.

## 10. Lifecycle presentation

Lifecycle is expressed with text, icon and structure, never color alone.

### Draft-only

```text
Черновик
Версия 1
Ещё не опубликован
```

Primary: `Продолжить редактирование`.

### Published-only

```text
Опубликована версия 2
Доступна для назначения
Опубликована 24 августа 2026
```

Primary: `Открыть шаблон`. Editing remains the explicit secondary action `Создать новую версию`.

### Published-with-Draft

```text
Опубликована версия 2
Доступна для назначения
Есть черновик версии 3
```

Primary: `Продолжить редактирование`. Secondary: `Посмотреть опубликованную версию`.

The Published fact is visually first because it describes the currently usable workout; the Draft fact is adjacent and prominent because it describes the trainer's unfinished work. The row is never reduced to `Черновик`.

### Archived

```text
В архиве
Последняя версия 3
Недоступен для назначения
```

Archive uses restrained neutral styling and appears only in Archive filter/direct return. It is not described as active or Published even if it historically has a Published Revision.

## 11. Status/filter model

### Compared options

| Option | Published + Draft behavior | Counts | Comprehension | Mobile | Verdict |
| --- | --- | --- | --- | --- | --- |
| A. `Все / Черновики / Опубликованные / Архив` | row belongs to Draft and Published filters | overlapping, not additive | familiar but hides lifecycle distinction | compact | Reject for target |
| B. `Все / Только черновики / Готовые / Есть новая версия / Архив` | one exclusive bucket | additive and explainable | directly maps to user task | use Sheet | **Chosen** |
| C. Multi-select status | complex overlap | hard to explain | excessive for first version | heavy | Reject for MVP |

### Exact model

| Visible filter | URL | Included lifecycle |
| --- | --- | --- |
| `Все` | omitted or `all` | Draft-only + Published-only + Published-with-Draft; excludes Archived |
| `Только черновики` | `drafts` | Draft-only only |
| `Готовые` | `published` | Published-only only |
| `Есть новая версия` | `updates` | Published-with-Draft only |
| `Архив` | `archive` | Archived only |

No row is duplicated in one result set. `published_with_draft` appears once under `Есть новая версия` and once in the aggregate `Все` view as the same entity, not two rows.

If counts are shown, they are exact server facets from the same query snapshot:

- counts are scoped by current search and category, but ignore the selected lifecycle filter;
- `Все` equals the sum of the three active exclusive buckets;
- Archive is separate and not added to `Все`;
- absent/partial counts are omitted rather than calculated from loaded pages.

Default filter is `Все`. Category is a secondary select on desktop and belongs to Filter Sheet on mobile. Fixed sort is not exposed as a control in v1: `Последнее изменение` descending, then stable Template identity.

## 12. Collection pattern comparison

| Pattern | Lifecycle comparison | Long names/actions | Mobile transform | Accessibility | Premium density | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Table | excellent at wide viewport | brittle at zoom/mobile | requires separate pattern | good if simple | operational but rigid | Not chosen |
| Dense card-list | strong vertical scanning | resilient and stackable | direct | semantic list + explicit controls | calm and premium | **Chosen** |
| Grid cards | weak cross-row comparison | actions fit but cards grow | easy stacking | acceptable | becomes card wall | Reject |

Dense card-list is selected because lifecycle is compared vertically while each row can still carry one primary action and overflow without becoming a dashboard card. The collection has one outer boundary and row dividers. Individual rows do not float as decorative cards. Hover may enhance the active row but does not reveal required actions.

## 13. Template row contract

### Shared row anatomy

```text
[title + category] [lifecycle facts] [exercise/set/duration] [updated] [primary] [more]
```

| Fact | Rule |
| --- | --- |
| Title | up to two lines desktop/mobile; `Без названия` for incomplete Draft only |
| Category | text; `Категория не указана` when empty |
| Lifecycle | exact wording from section 10 |
| Revision numbers | user wording, no pointer terminology |
| Exercise count | canonical set-based count; `0 упражнений` is valid Draft fact |
| Prescribed set count | canonical count; no client calculation from full rows |
| Duration | shown only when canonical value exists; no estimate invented in UI |
| Last updated | absolute accessible date; relative visible label may supplement |
| Publication date | Published/Published-with-Draft only when canonical |
| Capabilities | determine available actions but are never exposed as raw data |

### Row click rule

- Draft-only: Draft Editor.
- Published-only: Published read-only view.
- Published-with-Draft: Draft Editor.
- Archived: read-only archived view showing latest authorized saved content and archive banner.

If archived read-only cannot be supported by the exact Editor read model, the fallback is a non-clickable row with only `Дублировать в новый черновик`; there must be no broken generic `Открыть`.

Long titles wrap without moving primary/overflow controls off the row. At 200% zoom the desktop row may become a stacked layout before any horizontal overflow.

## 14. Desktop wireframe

Target viewport: 1440 x 1024. Existing TrainerShell remains. Content uses the same broad max width as current trainer operational surfaces, with approximately 24-32 px internal gutters.

```text
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│ Trainer  │ ШАБЛОНЫ                                      [ + Создать шаблон ] │
│ Shell    │ Сохранённые тренировки для повторного использования.               │
│          │ Найдено 18                                                        │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ [ Поиск по названию, описанию или категории                  × ] │
│          │ [Все] [Только черновики] [Готовые] [Есть новая версия] [Архив]    │
│          │ [Категория: Все категории ▾]                         [Сбросить]    │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ Силовая база               Опубликована версия 2   8 упр. 24 подх.│
│          │ Сила                       Доступна для назначения   55 мин         │
│          │                            Изменено сегодня          [Открыть] [⋯] │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ День тяги                  Опубликована версия 4   7 упр. 21 подх.│
│          │ Спина                      Есть черновик версии 5    50 мин         │
│          │                            Изменено вчера       [Продолжить] [⋯]   │
│          ├──────────────────────────────────────────────────────────────────────┤
│          │ Новая тренировка           Черновик · Версия 1     0 упр. 0 подх. │
│          │ Категория не указана       Ещё не опубликован       [Продолжить][⋯]│
│          ├──────────────────────────────────────────────────────────────────────┤
│          │                         [ Показать ещё ]                           │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

First viewport target: header, full filters and at least three typical rows are visible at 1440 x 1024. Header and toolbar therefore stay compact; no hero or KPI band.

## 15. Mobile wireframe

Target viewport: 390 x 844, safe-area aware.

```text
┌──────────────────────────────────┐
│ TrainerShell mobile header       │
├──────────────────────────────────┤
│ Шаблоны                          │
│ Сохранённые тренировки.          │
│ [ + Создать шаблон             ] │
│                                  │
│ [ Поиск...                   × ] │
│ [ Фильтры · Есть новая версия  ] │
│ Найдено 4 · Категория: Все       │
├──────────────────────────────────┤
│ День тяги                    [⋯] │
│ Спина                            │
│ Опубликована версия 4            │
│ Доступна для назначения          │
│ Есть черновик версии 5           │
│ 7 упражнений · 21 подход · 50 мин│
│ Последнее изменение: вчера       │
│ [ Продолжить редактирование    ] │
├──────────────────────────────────┤
│ Силовая база                 [⋯] │
│ Опубликована версия 2            │
│ 8 упражнений · 24 подхода        │
│ [ Открыть шаблон               ] │
├──────────────────────────────────┤
│ [ Показать ещё                 ] │
│ safe-area                        │
└──────────────────────────────────┘
```

### Mobile filter pattern

Use one `Фильтры` button that opens a bottom/right Sheet with:

1. labelled radio group for lifecycle, all five values visible without horizontal scrolling;
2. category select/list;
3. current exact result count when available;
4. `Показать результаты` primary;
5. `Сбросить фильтры` secondary.

Search remains outside the Sheet because it is frequent and deserves immediate access. Active filter summary is plain wrapping text below the button, not a horizontally scrolling chip rail.

All touch targets are at least 44 px. Long titles wrap. Row primary action is full width. Overflow uses a labelled menu button and never swipe-only gestures. No horizontal table or document overflow.

## 16. Search

Search is server-side over title, description and category. The design never assumes a complete local collection.

Contract:

- input has visible or programmatic label `Поиск шаблонов`;
- placeholder: `Название, описание или категория`;
- 350 ms stable debounce is the v1 proposal; Enter submits immediately;
- each request carries normalized `q`, selected lifecycle/category and first page;
- a new search resets `page` and `anchor`, but not selected status/category;
- latest-request wins through cancellation/request sequence; stale responses never replace newer results;
- URL updates with `replaceState` after accepted input;
- clear button has accessible name `Очистить поиск` and returns focus to input;
- prior rows may remain structurally visible under `aria-busy` during refresh, but their count is not relabelled as new results;
- no silent fallback from empty search results to all templates;
- search error preserves query and filters and provides `Повторить`.

Empty copy: `По запросу «тяга» шаблоны не найдены.` Secondary: `Очистить поиск`; if other filters are active, also `Сбросить все фильтры`.

## 17. Pagination

Design uses cursor pagination with a proposed default page size of 25. The exact size remains a measurement decision; bounded pagination is mandatory.

### Load-more contract

1. `Показать ещё` sends the opaque `endCursor` with the same actor/query/filter/category scope.
2. While loading, button label becomes `Загружаем...`, remains in a stable-height control region and prevents duplicate submit.
3. New rows append without replacing previous rows.
4. Deduplicate by Template identity. If a repeated identity carries newer canonical facts, replace the existing row and keep one item.
5. After keyboard activation, focus moves to the heading/link of the first newly appended row; a polite live message announces `Добавлено 12 шаблонов`.
6. When exhausted, replace the button with quiet status `Все шаблоны показаны`.
7. Invalid cursor resets only pagination to first page, preserves filters/search, and announces `Список изменился. Показана первая страница.`
8. Partial page failure keeps prior rows and offers `Повторить загрузку` at the pagination region.
9. URL `page` records successful appended depth; `anchor` records return identity.
10. Return from Editor restores appended pages from route cache or bounded cursor replay before focusing the anchor.

Cursor values are opaque and never parsed by UI. No offset arithmetic or local slicing.

## 18. Create Template

Primary action label: `Создать шаблон`.

Transition:

```text
/trainer/templates?...context
  -> /trainer/builder/new?return=<safe-workspace-state>
```

Rules:

- no athlete question;
- no Program question;
- no category pre-step;
- opening `/trainer/builder/new` does not persist a row;
- leaving before first explicit save creates nothing;
- first successful Draft save returns canonical Template identity and changes route to `/trainer/builder/[templateId]`;
- return state keeps current filters but a new unsaved Template has no anchor;
- after first save, return uses the new Template anchor;
- if current filters would exclude the new Draft, Workspace shows a receipt with `Показать созданный черновик`, which switches to `Только черновики` rather than silently changing filters.

No quick-start template is auto-selected. Quick starts may be researched later inside Editor, never as fake Workspace rows.

## 19. Draft-only behavior

Visible facts:

- `Черновик`;
- `Версия N`;
- `Ещё не опубликован`;
- category or `Категория не указана`;
- canonical exercise/set counts, including zeros;
- duration only if persisted;
- last updated.

Primary: `Продолжить редактирование`.

Overflow:

- `Дублировать`;
- `Архивировать`.

The row does not show a red error merely because it is incomplete. Publication blockers belong to Editor. It cannot claim `Доступна для назначения`.

## 20. Published-only behavior

Visible facts:

- `Опубликована версия N`;
- `Доступна для назначения`;
- publication date when canonical;
- composition summary and last update.

Primary row action: `Открыть шаблон`, leading to read-only Published view. This separates inspection from mutation.

Overflow:

- `Создать новую версию`;
- `Дублировать`;
- `Архивировать`.

`Создать новую версию` is an explicit idempotent command. During submit, only that action is busy. On success, open the new Draft Editor. If another tab already created a Draft, the server returns that canonical Draft and the UI opens it with a calm notice `Черновик уже был создан`.

## 21. Published-with-Draft behavior

This is the most important row state.

Visible copy:

```text
Опубликована версия 2
Доступна для назначения
Есть черновик версии 3
Последнее изменение черновика: сегодня
```

Primary: `Продолжить редактирование` -> Draft N+1.

Overflow:

- `Посмотреть опубликованную версию` -> read-only Published N;
- `Дублировать`;
- `Архивировать`.

No `Создать новую версию` appears because one Draft already exists. The row must not imply that Draft N+1 is assignable. Published availability remains visible but does not become a neutral assignment button.

## 22. Archived behavior

Archive is a separate collection filter. Archived rows do not appear in `Все`.

Visible facts:

- `В архиве`;
- last saved revision number;
- `Недоступен для назначения`;
- archive date if canonical;
- composition summary from the read-only revision chosen by server.

Primary: `Открыть шаблон` in read-only archive view. The view must have a persistent `В архиве` banner and no save/publish action.

Overflow:

- `Дублировать в новый черновик` only.

No restore, delete or assign. Existing Assignments are historical independent snapshots and remain unchanged.

## 23. Duplicate

### Options compared

| Result destination | Benefit | Cost | Verdict |
| --- | --- | --- | --- |
| Stay in Workspace | fast repeated management | new Draft still needs opening; may be outside filter | Not chosen |
| Open new Draft Editor | matches likely intent to adapt copy | navigation transition | **Chosen** |

### Interaction

1. Overflow action opens compact confirmation dialog.
2. Dialog title: `Дублировать шаблон?`.
3. Description names source and states result: a separate unpublished Draft.
4. Optional name field is prefilled `Копия - {название}` and remains editable. This naming rule is a hypothesis, not domain behavior.
5. Confirm button: `Дублировать и открыть`.
6. Command is disabled while submitting and retains one logical command identity across retry.
7. Success receipt returns new Template ID and opens its Draft Editor.
8. Identical replay opens the same created Draft and announces `Копия уже создана`.
9. Failure keeps dialog data and offers retry/cancel.

Archived source can be duplicated. The source remains archived. Published or Draft source selection is resolved by server capability; UI labels what is copied if multiple revisions exist.

## 24. Archive

Archive begins only from overflow and always requires confirmation.

Dialog:

```text
Архивировать «Силовая база»?

Шаблон исчезнет из обычного списка, и его нельзя будет использовать
для новых назначений. Уже назначенные тренировки не изменятся.

Если есть черновик, он будет архивирован вместе с опубликованной версией.

[Отмена] [Архивировать]
```

Behavior:

- destructive button names the action, not generic `Подтвердить`;
- submitting state blocks repeat close/submit and announces progress;
- success updates the canonical list only after server receipt;
- in active filters, row leaves with reduced/no motion and focus moves to next primary row action, previous row, or collection/empty heading;
- in Archive filter, a replay refreshes the same row and reports `Шаблон уже находится в архиве`;
- failure leaves row and dialog data intact;
- stale/foreign result refreshes or removes the row without claiming success;
- a success receipt remains visible near collection header; toast alone is insufficient.

No undo toast, restore or delete is introduced because restore is outside R2D MVP.

## 25. Stale/direct-link behavior

| Scenario | Visible result | Allowed action | Recovery |
| --- | --- | --- | --- |
| Template archived elsewhere | `Шаблон перемещён в архив` | open archive/duplicate if authorized | refresh row; preserve filters |
| Draft published elsewhere | row becomes Published-only | open read-only/create new version | refresh exact row |
| Draft saved elsewhere | newer updated/revision token fact | open canonical Draft | no stale command |
| Published Revision changed | row shows new version; old direct view explains update | open current Published | no silent fallback during command |
| Stale row action | action gets conflict | no fake success | refresh row and capabilities |
| Direct Template unavailable | non-disclosing unavailable screen | `К шаблонам` | no foreign facts |
| Row leaves current filter after refresh | remove only after explanation | `Показать в новом статусе` when useful | preserve q/category |
| Current anchor unavailable | no focused wrong row | collection heading/nearest stable item | announce state change |

Workspace never performs a stale action based only on client capability. Every command is server-authorized and state-checked. A stale failure does not automatically switch filters or open another Template.

## 26. Return from Editor

Return context contains:

- `q`;
- lifecycle filter;
- category;
- successful loaded page depth;
- semantic Template anchor;
- safe origin route.

It does not contain draft content, capabilities, concurrency token or pixel scroll.

### Restoration algorithm

1. Parse and validate collection URL state.
2. Restore first page and cached appended pages, or replay bounded pages.
3. Merge/dedupe by Template ID.
4. Revalidate the anchor row.
5. Apply operation receipt to canonical result, never to mock local state.
6. Focus anchor row heading/primary action with `preventScroll` then semantic `scrollIntoView` respecting reduced motion.
7. If row no longer belongs to the filter, show receipt with `Показать шаблон` and keep current filters until the user chooses.

No pixel-only restoration is relied upon. Browser's native scroll restoration may supplement the semantic anchor but cannot replace it.

## 27. Empty/loading/error states

| State | Heading/copy | Primary/secondary action |
| --- | --- | --- |
| No templates | `Шаблонов пока нет` / save reusable workouts | `Создать шаблон` |
| No Draft-only | `Черновиков нет` | `Создать шаблон`; `Показать все` |
| No Published-only | `Опубликованных шаблонов нет` | `Показать черновики`; no Program CTA |
| No Published-with-Draft | `Нет шаблонов с новой версией` | `Показать все` |
| No Archived | `Архив пуст` | `Показать все` |
| Search empty | exact query not found | `Очистить поиск`; optional reset filters |
| Category empty | no rows in category | `Все категории` |
| Filters conflict | combined filters return none | `Сбросить фильтры` |
| Initial loading | stable header/toolbar + row skeletons | no disabled fake rows |
| Cursor loading | existing rows + busy load region | no duplicate request |
| Invalid cursor | first page restored notice | continue from refreshed list |
| Partial list failure | existing trusted rows remain | `Повторить загрузку` |
| Inactive trainer | `Раздел недоступен` | safe Dashboard/settings path only |
| Permission denied | non-disclosing access state | safe return |
| List unavailable | `Не удалось загрузить шаблоны` | `Повторить`; Dashboard return |

Empty states are compact bands within the collection area, not large marketing illustrations or decorative cards.

## 28. State matrix

| State | Visible facts | Primary action | Secondary actions | Focus target | Recovery |
| --- | --- | --- | --- | --- | --- |
| Loading | header, filters, skeleton rows | none | none | h1 remains | await/retry |
| Ready | canonical rows/count | Create Template | row actions | prior/first semantic target | normal |
| Empty all | zero owned rows | Create Template | none | empty heading | create |
| Empty per filter | filter label, zero | filter-specific safe action | Show all | empty heading | change filter |
| Search empty | query, zero | Clear search | Reset filters | empty heading | preserve other state |
| Cursor loading | existing rows, progress | none at load region | none | load button/status | retry |
| Cursor exhausted | all loaded status | none | none | terminal status | normal |
| Invalid cursor | refresh notice, first page | none | retry if needed | notice then list | reset pagination only |
| Partial list failure | prior rows | Retry load | none | error region | keep rows |
| Inactive trainer | no template facts | safe return | settings if valid | access heading | activate account |
| Permission denied | no private facts | safe return | none | access heading | re-auth/support |
| Draft-only row | Draft/version/counts | Continue editing | duplicate/archive | row primary | exact Editor |
| Published-only row | Published/availability/counts | Open Template | new revision/duplicate/archive | row primary | read-only |
| Published-with-Draft | both versions/availability | Continue editing | view Published/duplicate/archive | row primary | Draft Editor |
| Archived row | archive/unavailable/counts | Open Template | duplicate as Draft | row primary | read-only |
| Stale row | refreshed lifecycle notice | capability-derived | safe row actions | notice/row | exact refresh |
| Duplicate submitting | source + entered title | disabled busy confirm | cancel disabled during critical phase | dialog button/status | wait |
| Duplicate success | persisted receipt | open new Draft | return later | Editor h1/title | canonical ID |
| Duplicate failure | error + entered title | Retry | Cancel | error summary | retain input |
| Duplicate replay | same created Draft | Open Draft | none | receipt/open action | no second copy |
| Archive confirmation | consequences | Archive | Cancel | dialog title/Cancel initial by policy | stay |
| Archive submitting | progress | disabled | none | status | wait |
| Archive success | receipt; row moved/removed | none | Show Archive if useful | next row/empty heading | canonical refresh |
| Archive failure | row unchanged + error | Retry | Cancel | error/dialog | keep state |
| Archive replay | already archived | Open Archive | duplicate | row/receipt | no repeat mutation |
| Direct-link return | URL state + anchor | row primary | normal | anchor | fallback heading |
| Long list | loaded pages | Show more | filters | load/new row | cursor paging |
| Long title | wrapped title | lifecycle primary | overflow | explicit control | responsive stack |
| Mobile filter open | all filter values/category | Show results | Reset/Close | Sheet heading/selected item | retain pending values |
| Editor return | receipt + updated row | lifecycle primary | receipt-specific | semantic row | preserve context |

## 29. Content and terminology

### Approved visible labels

- `Шаблоны`
- `Создать шаблон`
- `Черновик`
- `Версия N`
- `Ещё не опубликован`
- `Опубликована версия N`
- `Доступна для назначения`
- `Есть черновик версии N`
- `Продолжить редактирование`
- `Открыть шаблон`
- `Посмотреть опубликованную версию`
- `Создать новую версию`
- `Дублировать`
- `Дублировать в новый черновик`
- `Архивировать`
- `В архиве`
- `Упражнения`
- `Подходы`
- `Последнее изменение`
- `Показать ещё`
- `Все шаблоны показаны`

### Forbidden visible terminology

- `Template`
- `Draft Revision`
- `Published Revision`
- `current revision`
- `published_revision_id`
- `editable_revision_id`
- `lock_version`
- `aggregate`
- `tombstone`
- `asset`
- `workspace`
- `Program` / `Program day`
- `assignable pointer`
- raw PostgreSQL status values.

Dates use understandable product copy and expose full localized date to assistive technology. Counts use correct Russian pluralization.

## 30. Accessibility

1. Page has exactly one `h1`: `Шаблоны`.
2. Search has a persistent accessible label and named clear control.
3. Lifecycle and category controls are labelled; mobile Sheet has title and description.
4. Lifecycle is communicated by text and icon/structure, never color alone.
5. Every row primary action includes exact context, for example accessible name `Продолжить редактирование шаблона «День тяги»`.
6. Overflow button includes the Template title.
7. Menu order matches the documented action order and is keyboard reachable.
8. Confirmation dialogs have explicit title, consequence description, Cancel and named command.
9. Dialog focus is trapped and returns to the exact overflow trigger on cancel/failure.
10. After successful archive, focus follows the deterministic next/previous/empty rule.
11. After duplicate, focus moves to the new Editor heading/title field only after persisted receipt.
12. Pagination announces added count and focuses the first new row heading/link.
13. Result count uses a polite live region only after settled requests; typing does not produce repeated announcements.
14. Loading uses `aria-busy`; errors use an appropriate alert without repeating every row.
15. No action is hover-only or swipe-only.
16. Mobile interactive targets are at least 44 x 44 px.
17. Row visual order matches DOM and screen-reader order: identity, lifecycle, summary, timestamp, actions.
18. Reduced motion disables row collapse/scroll animation; semantic focus still moves.
19. At 200% zoom, rows stack and no document horizontal overflow appears.
20. Long titles remain readable and do not cover actions.

## 31. Component reuse map

| Existing component/module | Verdict | Required change / hidden assumption |
| --- | --- | --- |
| `TrainerShell` | Preserve | update destination later; retain global navigation/search shell |
| current `TemplatesWorkspace` | Rewrite against canonical read model | local full-list filtering, grid cards, athlete prop, assignment action and mock usage conflict with target |
| current Builder page shell | Split | currently owns Workspace + Editor + dialogs + handoff in one client route |
| current header | Extract visual tokens only | heading currently says `Шаблоны тренировок`; target needs one route-level h1 and compact exact count |
| current search input | Adapt | keep label/icon/44 px; move query server-side and URL-bound |
| current status tabs | Replace model | horizontal overflow and four raw statuses cannot represent Published-with-Draft |
| current category select | Adapt | options/counts must be server-derived; move into mobile Sheet |
| current template cards | Rewrite as dense rows | grid, nested metric cards, mock usage and generic `Открыть` are not target |
| `TemplateStatusBadge` | Replace presentation | one status badge cannot communicate dual Published + Draft facts |
| pagination pattern in `AthleteTrainingHistory` | Adapt concept | cursor retry/exhausted behavior is reusable; return/anchor contract is Workspace-specific |
| Quick Assign template pagination | Adapt concept | server cursor, invalid-cursor reset and load-more states are useful; do not reuse assignment selection semantics |
| `WorkflowReturnReceipt` | Extract/adapt presentation | focus/live-region pattern useful; Template operations need their own receipt model |
| Dialog primitives | Preserve | duplicate/archive confirmation with correct focus and command states |
| Sheet primitives | Preserve | mobile filters only; no nested card surface |
| quick-start P/P/L/Full Body | Prototype-only | no canonical persisted facts; do not show as Workspace rows |
| mock template data | Demo-only | never supplies lifecycle/counts/results |
| Builder list API client | Replace/evolve later | loads every full aggregate, no cursor/search/filter/capabilities |
| `WorkoutBuilderRepository` lifecycle commands | Preserve as command boundary | R2D.1 owns exact editable/published pointers; Workspace must not reproduce lifecycle logic locally |
| `WorkoutBuilderService` command taxonomy | Preserve and extend only for confirmed Workspace commands | existing save/create-revision/publish/archive conflicts are canonical; duplicate still needs its own later contract |
| `QuickAssignRepository` published projection | Preserve as cross-surface truth | proves Published remains assignable while Draft exists; Workspace must describe this fact without embedding Quick Assign |
| local collection filtering | Remove | violates set-based server list |
| local assignment helpers | Remove from neutral Workspace after import audit | assignment belongs to Quick Assign |

Deletion happens only after import audit and is outside Design A.

## 32. Keep/change/remove

### Keep

- primary navigation section `Шаблоны`;
- PostgreSQL-backed lifecycle and canonical summary facts;
- exercise/set summary;
- restrained premium dark/lime language;
- existing TrainerShell;
- Editor as separate route;
- labelled icon controls, Dialog and Sheet primitives;
- semantic focus/receipt patterns already proven in canonical workflows.

### Change

- destination from mixed `/trainer/builder` to `/trainer/templates`;
- client-hydrated collection to server set-based read model;
- single status badge to lifecycle composition;
- grid cards to one dense list surface;
- local search/filter to URL-bound server queries;
- no pagination to cursor `Показать ещё`;
- generic row actions to lifecycle capabilities;
- pixel-only return to semantic anchor restoration;
- toast-like command feedback to persisted receipt plus updated row.

### Remove from target

- all-in-one Editor as Templates landing page;
- athlete and Program selectors;
- full exercise hydration for list rows;
- local full-collection filtering;
- mock usage, popularity and recommendations;
- thumbnails without canonical source;
- assignment form and `Назначить` from neutral Workspace;
- multiple competing save/assign actions;
- restore/delete;
- hidden horizontal status chip scrolling on mobile.

## 33. Acceptance criteria

1. `Шаблоны` is a standalone collection surface.
2. Workspace and Editor are visually and route-separated.
3. New Template starts without athlete or Program.
4. Opening create route does not persist an empty Template.
5. Draft-only, Published-only, Published-with-Draft and Archived are distinguishable without color.
6. Published remains visible as available while Draft exists.
7. Each lifecycle has one unambiguous row click/primary destination.
8. Page primary action is `Создать шаблон`.
9. Neutral Workspace cannot create Assignment.
10. No athlete or Program selector appears.
11. List rows use set-based summary facts and no full exercise hydration.
12. Search runs server-side over title/description/category.
13. Lifecycle/category state is URL-restorable.
14. Selected lifecycle buckets are mutually exclusive; no duplicate row.
15. Counts are exact or omitted/truthfully labelled as shown count.
16. Pagination uses opaque cursor and `Показать ещё`.
17. Append deduplicates by Template identity.
18. Invalid cursor preserves search/filter and restarts safely.
19. No first row auto-opens.
20. No mock usage, recommendation, AI score or thumbnail.
21. Duplicate creates one new Draft and opens it after server receipt.
22. Duplicate replay does not create a second copy.
23. Archive explains disappearance, assignment unavailability and snapshot independence.
24. Archive does not change existing Assignments.
25. Restore/Delete are absent.
26. Return from Editor preserves query, lifecycle, category, page depth and semantic anchor.
27. Stale row never executes silently.
28. Desktop 1440 x 1024 shows header, filters and multiple rows above the fold.
29. Mobile 390 x 844 has no horizontal table/overflow and all actions remain reachable.
30. Mobile filters use a Sheet with all statuses visible.
31. Long names wrap without hiding actions.
32. Keyboard/screen-reader users can search, filter, open, duplicate, archive and paginate.
33. Focus recovery is defined for command, pagination and Editor return.
34. Empty/loading/error/inactive/denied states do not expose false facts.
35. Program is absent.
36. Quick Assign and Builder command ownership remain unchanged.
37. Production code, UI, routes, navigation, API, schema and migrations are unchanged by Design A.
38. No commit is created.

## 34. Open decisions and research hypotheses

### Decisions made for Design A

- dense card-list is preferred over table/grid;
- default lifecycle is `Все` excluding Archive;
- category remains secondary to search/lifecycle;
- duplicate success opens Editor;
- Published read-only view opens full saved content without edit controls;
- Archived can open read-only; if backend cannot provide an exact safe view, remove the open action rather than fake it.

### Open implementation/product decisions

1. Exact default page size: design proposes 25, pending real Template counts and latency.
2. Exact search debounce: design proposes 350 ms, pending measured server response.
3. Whether category options require a separate facet query or can come from the same Workspace response.
4. Whether exact total/facet counts justify their query cost. If not, show only truthful loaded count.
5. Whether duplicate dialog allows editing title or immediately uses a deterministic default.
6. Which revision an archived read-only route shows when both Published and Draft existed at archive time. Recommendation: server-selected latest saved revision with clear historical labels.
7. Maximum bounded page depth restored automatically after cold reload.
8. Whether publication date is valuable enough to occupy every Published row or belongs in read-only view.
9. Whether assignment usage is useful later. It remains excluded until a validated trainer job exists.

### Research hypotheses

- Trainers will prefer search after approximately 12-20 templates; before that lifecycle filters may dominate.
- Category will be useful as a secondary narrowing control, but trainers may organize mentally by workout goal or recent use instead.
- Most management and authoring will occur on desktop/tablet, while mobile Workspace use will focus on finding, opening and continuing Drafts.
- Expected collection size is independent of client count and may reach hundreds; pagination should be present before that scale appears.
- Published-with-Draft needs explicit two-line lifecycle copy; a compact badge alone will cause trainers to assume the Published version disappeared.
- Usage count may later aid maintenance, but introducing it now risks becoming an unexplained recommendation signal.

Research should measure search use, filter use, page depth, device, open-to-action time and archive/duplicate frequency without adding ranking or AI scoring.

## 35. Confirmation that production code, UI, routes, API, schema, migrations and commits were not changed

This Design A pass modified only:

`docs/templates-workspace-r2d-design-v1.md`

It did not:

- modify production code or UI;
- change routes, navigation or TrainerShell;
- change API handlers, services or repositories;
- change PostgreSQL schema, migrations, RLS, grants or triggers;
- modify Quick Assign or Builder command ownership;
- create Assignment, Program or ProgramAssignment behavior;
- modify mock/demo data;
- create a Git commit.

The working tree already contained uncommitted R2C.3, R2D documentation and R2D.1 lifecycle implementation before this design pass. They were used as evidence and were not modified as part of Design A. Therefore repository-wide `git status` is intentionally not clean, while the design-task delta is limited to the document above.
