# WorkoutTemplate Builder Implementation v1

## 1. Scope

Stage 11 заменяет смешанный builder на frontend-first workflow для создания переиспользуемого `WorkoutTemplate`. Изменения ограничены маршрутом `/trainer/builder`, новой компонентной зоной `components/trainer-os/workout-template-builder/*` и минимальным входным адаптером Quick Assign. Dashboard, Athlete Profile, Workout Review, Program, backend, API, auth и схема данных не менялись.

## 2. Before state

Предыдущий `app/trainer/builder/page.tsx` содержал в одном client-компоненте библиотеку, выбор клиента, Program, week/day, template и assignment-семантику. Файл одновременно читал demo/local state и Supabase, сохранял разные типы сущностей и управлял несколькими визуальными режимами. Из-за этого тренер не мог однозначно понять, создаёт ли он шаблон, день программы или назначение.

## 3. Root causes

- Несколько доменных задач были объединены в одном route-level компоненте.
- Template зависел от выбранного клиента, программы и дня.
- Save actions имели разные назначения без ясной state model.
- Canvas, Library и details конкурировали за пространство.
- Published revision не была визуально и поведенчески отделена от mutable draft.
- Mobile уменьшал старый desktop layout, вместо отдельного core editing flow.

## 4. Target workflow

Canonical frontend flow: `Templates workspace -> open/create draft -> compose workout -> validate -> save draft or publish -> optionally open Quick Assign`. Builder создаёт только `WorkoutTemplate`. Он не создаёт `WorkoutAssignment`, не записывает календарную дату и не редактирует Program.

## 5. Templates workspace

Workspace показывает demo templates как единый список с поиском, status tabs (`All`, `Draft`, `Published`, `Archived`) и фильтром category. Карточка содержит title, status, revision, exercise count, duration, focus, usage и update label. Доступны open, duplicate, archive и assign для published template при наличии athlete context. Реализованы empty workspace и empty filtered result.

## 6. Builder layout

Desktop `1440x1000` использует три самостоятельные зоны: Exercise Library слева, Workout Canvas в центре и Exercise Inspector справа. Sticky command header содержит template identity, dirty state и основные действия. На tablet/mobile Library и Inspector открываются через Sheets, а Canvas остаётся основным рабочим пространством.

## 7. Read models

Frontend model находится в `components/trainer-os/workout-template-builder/builder-model.ts`. Он определяет template, exercise instance, prescription, set override, superset group, validation issue, publish receipt и entry context. Модель provider-neutral и не импортирует Supabase, Program или WorkoutAssignment.

## 8. Entry contexts

Route принимает `templateId`, `athleteId` или legacy-compatible `clientId`, `source`, `returnTo`, `goal/category` и demo-флаг `empty`. Из Quick Assign может открыться новый draft с сохранённым athlete context. Неизвестный `templateId` показывает явный safe state и не подставляет первый шаблон автоматически.

## 9. Exercise Library

Сохранён существующий `ExerciseLibraryPanel` и текущий demo exercise catalog. Поддерживаются search, scope, category, equipment, detail sheet и явное добавление кнопкой. Desktop, keyboard и touch не зависят от drag-and-drop. Повторное добавление того же library exercise требует подтверждения.

## 10. Workout Canvas

Canvas отображает упорядоченный список standalone exercises и superset blocks. Exercise card показывает order, title, prescription summary, category, per-set marker и trainer note marker. Выбор карточки синхронизирует Inspector. Empty Canvas содержит понятный призыв добавить первое упражнение.

## 11. Prescription editor

Inspector поддерживает `repetitions` и `duration`, количество sets, fixed/range repetitions, target weight, rest и trainer note. Изменение общего количества sets пересобирает set rows с сохранением существующих overrides там, где это возможно. Published/archived revision read-only.

## 12. Hybrid set model

Каждое упражнение хранит default prescription и стабильные per-set rows. По умолчанию compact editor меняет общие параметры. Переключатель `Настроить подходы отдельно` открывает granular overrides. Такой hybrid не заставляет тренера редактировать каждую строку в простом случае и сохраняет сложные prescriptions.

## 13. Warmup/working sets

Per-set mode различает `warmup` и `working` через label, icon и цветовой accent. Можно добавить разминочный или рабочий set, изменить его тип, reorder, удалить, сбросить один override или применить defaults ко всем rows. Demo `Низ тела · техника` содержит готовый warm-up сценарий.

## 14. Reorder

Desktop поддерживает block drag-and-drop. Для keyboard, touch и mobile у каждого standalone block, superset и superset member есть явные кнопки вверх/вниз. Stable item/instance IDs используются как keys, поэтому reorder не зависит от array index.

## 15. Supersets

Trainer может выбрать от двух до четырёх standalone exercises и объединить их в один superset. Group имеет собственные label и instruction, перемещается как единый block и поддерживает reorder members. Ungroup возвращает упражнения в Canvas без потери prescription. Nested supersets не создаются; удаление, после которого остаётся один member, безопасно распускает group.

## 16. General settings

Template-level settings включают title, description, focus/category, estimated duration и general trainer instruction. Athlete, calendar date, payment, analytics, AI plan generation и Program week/day отсутствуют намеренно.

## 17. Draft/publish/version states

Draft mutable и может быть неполным. `Save Draft` добавляет или обновляет template в текущем in-memory workspace. Publish создаёт read-only published state после blocking validation. Published revision редактируется только через `Создать новую версию`, которая создаёт mutable draft copy с `sourceTemplateId` и `sourceRevision`.

## 18. Validation

Blocking errors включают отсутствующий title, пустой Canvas, invalid sets/prescription, invalid repetition range, invalid duration, negative rest/weight, unstable duplicate instance IDs и superset вне диапазона 2-4. Warnings включают отсутствующие description/category/duration/rest, duplicate source exercise и длинную тренировку. Draft сохраняется с warnings; publish блокируется только errors. Summary находится в документе, а не только в toast, и переводит к связанному field/item.

## 19. Duplicate exercise behavior

Exercise library ID описывает исходное упражнение, а `instanceId` описывает конкретное появление в template. Одинаковый source exercise разрешён после confirmation и получает новый stable `instanceId` вместе с новыми set row IDs. Duplicate template и duplicate exercise копируют mutable вложенные структуры, а не переиспользуют ссылки.

## 20. Unsaved changes

Dirty state вычисляется сравнением текущего draft с baseline. Возврат в Templates workspace показывает dialog с `Сохранить черновик`, `Продолжить редактирование` и `Выйти без сохранения`. Реальное закрытие вкладки защищено `beforeunload`. После save/publish baseline обновляется.

## 21. Preview

Client preview реализован Dialog-ом и показывает template status, title, description, general instruction, порядок, supersets, prescriptions, rest, per-set labels и trainer notes. Preview read-only и не копирует workout completion или Client Cabinet.

## 22. Quick Assign integration

Минимальный адаптер `quick-assign-adapter.ts` переводит published builder template в существующий `WorkoutTemplateListItem`. `QuickAssignDrawer` получил optional `initialTemplate`, добавляющий конкретную published revision в доступный read model и выбирающий её при открытии. Athlete ID и return context сохраняются. Assignment создаётся только после существующего Quick Assign confirmation.

## 23. Mobile behavior

На `390x844` доступны Templates list, open, title edit, full-width Library Sheet, add exercise, Inspector Sheet, sets/reps/rest, reorder buttons, delete, save draft, publish, preview и Quick Assign. Exercise actions переходят на отдельную строку и не обрезаются. Существующие supersets отображаются и минимально редактируются. Page-level horizontal overflow отсутствует.

## 24. Accessibility

Использованы semantic `main`, `header`, `section`, `aside`, ordered lists, listbox/tabs в существующем Quick Assign и native buttons/inputs. Icon actions имеют `aria-label` и tooltip через `title`. Drag-and-drop имеет кнопочную альтернативу. Dialog/Sheet primitives управляют focus. Validation summary имеет читаемые error/warning labels и focus/scroll targets.

## 25. Component preservation matrix

| Existing component/area | Result | Reason |
|---|---|---|
| `ExerciseLibraryPanel` | Preserved and adapted | Существующая библиотека уже поддерживает filter/add/details semantics. |
| `ExerciseDetailSheet` | Preserved | Подходит для read-only inspection library exercise. |
| `WorkoutExerciseCard` | Not reused | Старый card смешивал builder, program and assignment controls. |
| `WorkoutSupersetBlockCard` | Not reused | Старый group model был связан с broad legacy page state. |
| `WorkoutFormHeader` | Not reused | Новый command header отражает template revision and save state. |
| `QuickAssignDrawer` | Preserved with optional adapter prop | Flow и confirmation не менялись; добавлена только preselection. |
| `TrainerShell` | Preserved | Navigation Stage 6 остаётся canonical. |

## 26. Files changed

- `app/trainer/builder/page.tsx`: server entry and query normalization.
- `components/trainer-os/workout-template-builder/builder-model.ts`: isolated frontend domain/read model and demo states.
- `components/trainer-os/workout-template-builder/templates-workspace.tsx`: list, filters and empty states.
- `components/trainer-os/workout-template-builder/builder-editor.tsx`: command header, Library/Canvas/Inspector and dialogs.
- `components/trainer-os/workout-template-builder/exercise-inspector.tsx`: prescription and per-set editing.
- `components/trainer-os/workout-template-builder/workout-template-builder-page.tsx`: local orchestration, save/publish/version and transition states.
- `components/trainer-os/workout-template-builder/quick-assign-adapter.ts`: published template adapter.
- `components/trainer-os/quick-assign/quick-assign-drawer.tsx`: optional preselected template input only.
- `docs/workout-template-builder-implementation-v1.md`: this implementation record.

## 27. Visual QA

Playwright with local Chrome verified `/trainer/builder` and editor routes on `1440x1000` and `390x844`. Desktop showed Library, Canvas and Inspector without page overflow. Mobile showed full-width core editing and action rows without clipping. Console and page error collection returned no errors. End-to-end checks confirmed mobile add, save, preview and desktop Quick Assign preselection for `artem-smirnov`.

## 28. Known limitations

- Templates and mutations are in-memory demo state; refresh resets changes.
- There is no repository/API persistence, concurrency, ownership or migration in Stage 11.
- Browser navigation outside the local back-to-workspace action relies only on `beforeunload`; no global route interception was added.
- HTML drag-and-drop is intentionally basic; button reorder is the reliable cross-input path.
- Duration exercises are adapted to Quick Assign's legacy numeric `repetitions` field because its read model has no duration prescription.
- Existing global Recharts build warnings remain unrelated and unchanged.

## 29. Deferred decisions

- Canonical PostgreSQL schema and repository contract for template revisions.
- Whether archive is reversible and who may archive shared templates.
- Full route-level navigation guard shared by TrainerShell.
- Richer mobile superset creation and bulk editing.
- Canonical duration/set prescription in Quick Assign and WorkoutAssignment snapshots.
- Cover/visual marker and template sharing/ownership.
- Whether template category and focus become separate controlled vocabularies.

## 30. Acceptance criteria results

- Templates workspace and empty state: passed.
- Blank create, duplicate, draft edit, published revision and archived demo states: passed.
- Library/Canvas/Inspector desktop workspace: passed.
- Hybrid prescriptions, warmup/working sets and overrides: passed.
- Standalone and 2-4 exercise superset composition without nesting: passed.
- Blocking validation, warnings, duplicate confirmation and unsaved confirmation: passed.
- Preview and published read-only state: passed.
- Athlete-aware Save and Assign through Quick Assign with preselection: passed.
- Mobile core editing and no page-level horizontal overflow: passed.
- Lint: passed with no warnings at verification time.
- Production build: passed; two pre-existing Recharts size warnings remain.
- Dashboard, Athlete Profile, Workout Review, TrainerShell internals, backend, API, Supabase, PostgreSQL, auth and migrations were not redesigned.
