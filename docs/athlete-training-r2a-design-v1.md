# R2A: дизайн канонической вкладки «Тренировки»

Статус: `proposed`
Дата: 2026-08-30
Область: вкладка `Тренировки` в каноническом профиле спортсмена со стороны тренера
Основа: `docs/athlete-training-r2a-architecture-v1.md`, R1 Profile и существующий canonical workout lifecycle.

## 1. Design verdict

Вкладка должна быть **компактным рабочим обзором тренировочного цикла одного человека**, а не отдельным dashboard и не копией клиентского кабинета.

Принятое направление:

- сохранить существующие R1 Header, entry strip и URL-tabs;
- сразу после вкладок показать один блок `Работа сейчас` с тремя независимыми фактами: `pendingReview`, `activeExecution`, `nextAssignment`;
- оставить единственный основной CTA в R1 Header;
- сделать переходы внутри вкладки вторичными: текстовые ссылки, кликабельные названия и раскрытие дополнительных элементов;
- показать `Последняя обратная связь` как спокойный завершённый факт, а не как задачу;
- завершить экран плотной set-based историей по assignment lineage и cursor pagination;
- не переносить из prototype hero, KPI, adherence, current weight, streak, top movements, Program и другие mock-derived блоки.

Архитектурно три текущих факта могут существовать одновременно. Визуально они живут рядом, но не объединяются в один искусственный статус. R1 Header показывает вычисленный главный фокус и единственное действие, вкладка объясняет всю тренировочную ситуацию.

Это соответствует принципам «работать с человеком, а не CRM-записью», «один сигнал — понятное действие» и «клиентский и тренерский кабинеты показывают одну тренировочную реальность» из `docs/product-principles-v1.md`.

## 2. Пользовательская задача

После открытия вкладки тренер должен за 3–5 секунд ответить:

1. Есть ли завершённая тренировка, которую нужно разобрать?
2. Выполняет ли спортсмен тренировку сейчас?
3. Что назначено следующим?
4. Какой feedback был отправлен последним и к какой сессии он относится?
5. Что происходило в предыдущих assignment/session lineage?
6. Какое одно действие сейчас важнее остальных?

Вкладка не должна заставлять тренера:

- сравнивать несвязанные карточки и самостоятельно вычислять главный статус;
- переходить в клиентский кабинет ради фактов выполнения;
- искать review среди истории;
- воспринимать последний feedback как незавершённую работу;
- видеть метрики, которых нет в canonical PostgreSQL data;
- повторно выбирать спортсмена при назначении или разборе.

## 3. Entry points

### 3.1 Neutral entry

Источник: переход из списка спортсменов или ручное открытие URL.

```text
/trainer/clients/{athleteUserId}?tab=training
```

Поведение:

- сохраняется обычный R1 Header;
- entry strip отсутствует;
- `Работа сейчас` показывает все доступные факты;
- Header может не иметь CTA, если нет pending review и следующая тренировка уже назначена;
- вкладка ничего не помечает просмотренным и не меняет AttentionItem.

Если тренер открыл профиль нейтрально без `?tab=training`, R1 по-прежнему может открывать `Обзор`. Выбор `Тренировки` становится URL-состоянием, пригодным для Back/Forward и deep link.

### 3.2 Entry из no-assignment signal

Ожидаемый результат:

- сразу открывается `?tab=training`;
- R1 Header показывает `Нет следующей тренировки` и primary CTA `Назначить тренировку`;
- в `Работа сейчас` колонка `Следующее назначение` содержит локальное пустое состояние;
- существующие review и active execution не скрываются.

Ограничение текущей модели: canonical `AttentionItem` сейчас имеет только `item_type = workout_review` (`database/migrations/0007_workout_session_execution.up.sql:104-122`). Поэтому no-assignment entry в R2A v1 является **валидированным entry reason/current focus**, а не новым persisted AttentionItem. Дизайн не вводит новую сущность. Если такой тип будет сохраняться в будущем, это потребует отдельного архитектурного решения.

Рекомендуемый URL v1:

```text
/trainer/clients/{athleteUserId}?tab=training&from=dashboard&entry=no_next_assignment
```

### 3.3 Entry из completed-session AttentionItem

```text
/trainer/clients/{athleteUserId}
  ?tab=training
  &from=dashboard
  &attentionItem={attentionItemId}
  &session={sessionId}
```

Поведение:

- R1 AttentionContextStrip остаётся между Header и tabs;
- `Работа сейчас` начинает с точного pending review;
- соответствующая строка review получает семантический акцент и доступный label `Источник перехода`;
- Header CTA открывает exact canonical Review;
- история не прокручивается автоматически при первом входе, пока source review находится в `Работа сейчас`.

### 3.4 Entry из Review и Quick Assign

Возврат всегда содержит athlete ID, `tab=training`, source entity ID и семантическую цель прокрутки. Raw pixel offset не используется как источник истины.

## 4. Primary action rules

Primary CTA принадлежит только R1 Header. Вкладка не рисует второй lime button с тем же действием.

| Приоритет | Условие | Header state | Primary CTA |
| --- | --- | --- | --- |
| 1 | Есть open pending review | Тренировка ждёт разбора | `Разобрать тренировку` |
| 2 | Нет pending review и нет next assignment | Нет следующей тренировки | `Назначить тренировку` |
| 3 | Есть active execution и/или next assignment | Выполняется / назначена | Нет forced CTA |
| 4 | Relation suspended/unavailable | Связь приостановлена | Нет CTA |

Правила:

- review всегда важнее отсутствия следующего назначения;
- наличие next assignment не скрывает pending review;
- active execution не создаёт trainer mutation CTA: выполнение принадлежит спортсмену;
- latestFeedback никогда не становится primary CTA;
- при нескольких reviews Header CTA ведёт к первому элементу canonical priority order;
- ссылки `Открыть разбор`, `Открыть результат`, `Открыть назначение` внутри вкладки имеют secondary/tertiary визуальный вес;
- пустой `nextAssignment` внутри вкладки не дублирует кнопку `Назначить тренировку` из Header.

R1 уже размещает state и один action справа от identity (`components/trainer/canonical-athlete-profile.tsx:71-105`). Это остаётся единственной зоной primary action.

## 5. Transition and return map

### 5.1 Review

```text
Training tab
  -> /trainer/review/{sessionId}
       ?from=profile
       &attentionItem={attentionItemId}
       &returnTo={encoded profile training URL}
  -> feedback or manual resolution
  -> same athlete / same Training tab
  -> source row is refreshed and focused
```

Return URL:

```text
/trainer/clients/{athleteUserId}
  ?tab=training
  &from=review
  &attentionItem={attentionItemId}
  &session={sessionId}
  &focus=history
```

После успешного review:

- read model запрашивается заново;
- Header получает новый primary focus;
- resolved review исчезает из open list и остаётся в history;
- `Последняя обратная связь` обновляется, если отправлен feedback;
- семантический focus переходит на обновлённую history row;
- короткий `aria-live` receipt сообщает `Обратная связь отправлена` или `Разбор закрыт без сообщения`;
- draft review не переносится в profile URL.

Текущий canonical route уже принимает `returnTo`, но production-компонент его теряет (`app/trainer/review/[workoutId]/page.tsx:12-24`). R2A design требует сохранить normalized return context, не меняя семантику Review.

### 5.2 Quick Assign

```text
Training tab / Header CTA
  -> canonical Quick Assign or Builder
       athleteId={athleteUserId}
       returnTo={encoded profile training URL}
  -> assignment created from published template
  -> same athlete / same Training tab
  -> nextAssignment refreshed and focused
```

Return URL:

```text
/trainer/clients/{athleteUserId}
  ?tab=training
  &from=quick-assign
  &assignment={assignmentId}
  &focus=current
```

После успеха:

- read model перезагружается до показа success receipt;
- новый assignment определяется server projection, а не локально добавляется UI;
- focus переходит на `Следующее назначение`;
- Header CTA исчезает или меняется согласно новому canonical focus;
- если параллельно появился pending review, review становится Header CTA, но новый assignment остаётся виден.

### 5.3 Safe return

- разрешены только внутренние `/trainer/` paths;
- athlete, assignment, session и AttentionItem повторно авторизуются;
- неподходящий или устаревший `returnTo` возвращает в `/trainer/clients/{athleteId}?tab=training`;
- Back сохраняет browser history и не создаёт дубликат command.

### 5.4 Scroll restoration

Применяется семантическое восстановление:

- обычное переключение tabs сохраняет положение profile frame; tab panel начинается под tabs без скачка к нулю;
- возврат из Review фокусирует history row точной session после обновления модели;
- возврат из Quick Assign фокусирует `nextAssignment`;
- browser Back использует native scroll restoration, если target ещё существует;
- если target исчез после state transition, fallback — заголовок `Работа сейчас`;
- focus устанавливается без анимации при `prefers-reduced-motion: reduce`;
- текущий безусловный `window.scrollTo(0, 0)` в `components/trainer/athlete-profile-scroll-reset.tsx:5-10` должен быть пересмотрен на implementation stage, но не изменяется этим документом.

## 6. Screen hierarchy

```text
TrainerShell
└── Canonical Athlete Profile
    ├── R1 Header
    │   ├── athlete identity
    │   ├── current focus
    │   └── one primary CTA
    ├── optional R1 AttentionContextStrip
    ├── URL tabs
    └── Training tab panel
        ├── Работа сейчас
        │   ├── Ждут разбора [count]
        │   ├── Выполняется сейчас [count/anomaly]
        │   └── Следующее назначение [count]
        ├── Последняя обратная связь
        └── История тренировок
            ├── set-based history rows
            ├── local error / empty state
            └── Показать ещё
```

### Layout principles

- max content width остаётся R1 `1180px` (`components/trainer/canonical-athlete-profile.tsx:48-50`);
- нет второго hero внутри вкладки;
- `Работа сейчас` — один full-width section с внутренними колонками и divider lines, не три большие декоративные cards;
- `Последняя обратная связь` — компактная full-width band;
- история — list, а не сетка аналитических карточек;
- section headings 18–20px, row titles 14–16px, metadata 12–14px;
- углы не больше 8px и только у реально ограниченных surfaces;
- цвет помогает распознать состояние, но текст и icon всегда несут тот же смысл.

### Visual tones

| Fact | Tone | Usage |
| --- | --- | --- |
| Pending review | amber; orange only for discomfort | Left border/icon/count, no filled warning wall |
| Active execution | restrained sky/cyan | Status icon and short label |
| Next assignment | lime as calm active product accent | Date/icon/link, not a large lime card |
| Latest feedback | neutral zinc with subtle lime confirmation | Completed fact, no urgency |
| Suspended/unavailable | muted zinc | No action colors |
| Errors | rose only in local error boundary | Does not repaint the whole page |

## 7. Desktop low-fidelity wireframe

Target: `1440 × 1024`, content width `1180px`.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ TrainerShell: Профиль спортсмена                           [К спортсменам]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ (АС)  Артём Смирнов · Активная связь     [Ждёт разбора] [РАЗОБРАТЬ]          │
│       Набор массы · В команде с 10 июля                                  R1 │
├──────────────────────────────────────────────────────────────────────────────┤
│ optional: Тренировка ждёт разбора · Силовая база        Открыть источник →  │
├──────────────────────────────────────────────────────────────────────────────┤
│          Обзор               Тренировки                Прогресс              │
│                              ━━━━━━━━━━━                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Работа сейчас                                                               │
│                                                                              │
│ ЖДУТ РАЗБОРА · 2       │ ВЫПОЛНЯЕТСЯ СЕЙЧАС · 1 │ СЛЕДУЮЩЕЕ НАЗНАЧЕНИЕ · 2 │
│ Силовая база             Верх тела                 Ноги и корпус             │
│ сегодня, 18:40           начата 42 мин назад       2 сентября                │
│ 7 из 9 подходов          4 упражнения              6 упражнений              │
│ Открыть разбор →         Открыть сессию →          Открыть назначение →      │
│ ───────────────────      Еще активных нет          Еще 1 назначение          │
│ Техника ног · вчера                                                      │
│ Открыть →                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Последняя обратная связь                                                    │
│ «Сохраняем текущий вес и спокойный темп…» · Силовая база · вчера 20:12   → │
├──────────────────────────────────────────────────────────────────────────────┤
│ История тренировок                                            12 тренировок │
│ 28 авг │ Силовая база     │ 7/9 подходов │ Разобрана · feedback отправлен →│
│ 25 авг │ Верх тела        │ 8/8 подходов │ Разобрана                       →│
│ 21 авг │ Ноги и корпус    │ 5/8 подходов │ Закрыта без сообщения           →│
│ 18 авг │ Техника          │ 0/6 подходов │ Завершена частично              →│
│                                                                              │
│                              [Показать ещё]                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Desktop grid for `Работа сейчас`:

```text
minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)
```

Pending review получает немного больше ширины, потому что может содержать несколько задач. Высота колонок не выравнивается искусственным пустым пространством; section background общий, между колонками divider.

На первом экране должны помещаться Header, tabs, весь `Работа сейчас`, `Последняя обратная связь` и начало истории. Это запрещает дополнительные KPI rows и высокий hero.

## 8. Mobile low-fidelity wireframe

Target: `390 × 844`.

```text
┌──────────────────────────────────────┐
│ ← К спортсменам                      │
│ (АС) Артём Смирнов                   │
│      Активная связь                  │
│      Набор массы                     │
│                                      │
│ Ждёт разбора                         │
│ Силовая база                         │
│ [РАЗОБРАТЬ ТРЕНИРОВКУ]               │
├──────────────────────────────────────┤
│ Обзор │ Тренировки │ Прогресс        │
│          ━━━━━━━━━                   │
├──────────────────────────────────────┤
│ Работа сейчас                        │
│                                      │
│ ЖДУТ РАЗБОРА · 2                     │
│ Силовая база                         │
│ Сегодня, 18:40 · 7 из 9 подходов     │
│ Открыть разбор →                     │
│ ──────────────────────────────────── │
│ Техника ног · вчера      Открыть →   │
│                                      │
│ ВЫПОЛНЯЕТСЯ СЕЙЧАС                   │
│ Верх тела · начата 42 мин назад      │
│ Открыть сессию →                     │
│                                      │
│ СЛЕДУЮЩЕЕ НАЗНАЧЕНИЕ · 2             │
│ Ноги и корпус · 2 сентября           │
│ Открыть назначение →                 │
├──────────────────────────────────────┤
│ Последняя обратная связь             │
│ «Сохраняем текущий вес…»             │
│ Силовая база · вчера 20:12       →   │
├──────────────────────────────────────┤
│ История тренировок                   │
│                                      │
│ 28 августа                           │
│ Силовая база                         │
│ 7 из 9 · Разобрана               →   │
│ ──────────────────────────────────── │
│ 25 августа                           │
│ Верх тела · 8 из 8               →   │
│                                      │
│          [Показать ещё]              │
└──────────────────────────────────────┘
```

Mobile rules:

- Header CTA занимает доступную ширину, но остаётся частью R1 Header;
- tabs сохраняют три стабильных равных track и `min-height: 44px`;
- current columns становятся одним вертикальным списком в фиксированном порядке review → active → next;
- metadata переносится, а не обрезается до неразличимого текста;
- history row не имитирует desktop table: дата сверху, затем title, completion и state;
- нет горизонтального scroll;
- первая текущая задача начинается в пределах первого viewport или сразу после короткого естественного scroll под Header;
- sticky CTA внутри tab panel не добавляется: он дублировал бы Header и занимал слишком много 844px viewport.

## 9. Current-state composition rules

### 9.1 Pending review

Показываются:

- count всех open reviews;
- title snapshot;
- completed date/time;
- completion summary `completed / total sets`;
- reason: `Требует разбора`, `Завершена частично`, `Спортсмен отметил дискомфорт` только при canonical reason;
- exact secondary link в Review.

Несколько reviews:

- первые 3 видны сразу на desktop, первые 2 на mobile;
- count всегда показывает полный объём;
- `Показать ещё N` раскрывает остальные inline без carousel и без смены страницы;
- source review entry всегда поднимается первым визуально, но canonical priority review остаётся Header CTA;
- раскрытие не меняет AttentionItem status;
- после разрешения одного review список обновляется, а не удаляется только локально.

### 9.2 Active execution

Показываются:

- server-selected active session;
- assignment title snapshot;
- started time и относительное время как presentation-only форматирование;
- количество упражнений/подходов только если оно уже агрегировано set-based;
- read-only link к exact session/result context.

UI не выбирает session. Если `activeSessions > 1`:

- показывается заметный, но не alarmist inline warning `Одновременно активны N тренировок`;
- primary displayed session — та, которую выбрал server projection;
- `Показать все активные` раскрывает остальные exact session rows;
- никакая сессия не закрывается и не переназначается автоматически;
- состояние регистрируется как data anomaly для дальнейшего расследования.

### 9.3 Next assignment

Показываются:

- server-selected next unstarted assignment;
- title snapshot;
- scheduled date;
- compact exercise count или estimated duration только если эти значения присутствуют в canonical assignment projection;
- secondary link к read-only assignment detail.

Если assignments несколько, отображается `Ещё N назначений` с inline disclosure. Порядок приходит с сервера. UI не сортирует canonical entities самостоятельно.

Если assignment отсутствует, колонка показывает:

```text
Следующая тренировка не назначена
```

Без второй primary button. Назначение доступно через Header CTA.

### 9.4 Latest feedback

Показываются:

- feedback kind понятным языком;
- sent timestamp;
- exact session/workout title;
- одна строка body preview, если она включена в один AthleteTraining read model query;
- secondary link к resolved Review/session.

Не показываются unread badge, urgency tone и призыв `Ответить`, если такого canonical workflow нет. Блок исчезает в локальное empty state, если feedback ещё не отправлялся.

## 10. History row contract

History — terminal assignment lineage list. Current active execution и future unstarted assignments не дублируются в истории.

### Visible fields

| Field | Source | Presentation |
| --- | --- | --- |
| Date | completed, cancelled or started fallback from server order | `<time>`; full date on mobile |
| Title | `assignment.title_snapshot` | One or two lines |
| Completion | canonical set-based counts | `7 из 9 подходов`; no percentage required |
| Session state | session status | Human label, icon and text |
| Attention state | exact AttentionItem | `Ждёт разбора`, `Разобрана`, `Закрыта без сообщения` |
| Feedback state | feedback aggregate | `Feedback отправлен`, timestamp where useful |
| Destination | canonical links | Exact Review/session; no synthetic ID |

### Human-facing terminology

| Canonical combination | UI label |
| --- | --- |
| completed + open attention | `Ждёт разбора` |
| completed_with_omissions + open attention | `Завершена частично · ждёт разбора` |
| resolved + feedback | `Разобрана · feedback отправлен` |
| resolved + manual resolution, no feedback | `Закрыта без сообщения` |
| completed + resolved unknown | `Разбор закрыт` |
| assignment cancelled | `Отменена` |
| session abandoned | `Прервана` |

### Row interaction

- title is the primary link target;
- status link appears only when it represents a distinct action, for example open Review;
- do not make the entire row a button if it contains disclosure or another link;
- keyboard order follows visual order;
- exact source row receives `tabIndex=-1` only for programmatic return focus;
- no exercise/set details are loaded until the trainer opens the destination;
- `Показать ещё` appends the next cursor page and keeps focus on the first newly added row.

## 11. State matrix

| # | Scenario | Header | Работа сейчас | Feedback | History |
| --- | --- | --- | --- | --- | --- |
| 1 | Neutral entry | Canonical focus; CTA only if required | All independent facts | Latest or empty | First page |
| 2 | No-assignment entry | `Нет следующей тренировки`; Assign CTA unless review exists | Empty next column; other facts preserved | Unchanged | Unchanged |
| 3 | Completed-session Attention entry | Review state and Review CTA | Source review first/accented | Existing latest | Source lineage discoverable |
| 4 | Pending review + next assignment | Review CTA | Both review and next visible | Independent | Normal |
| 5 | Active execution + future assignment | No forced CTA | Both active and next visible | Independent | Terminal rows only |
| 6 | Several pending reviews | First canonical review in Header | Count + visible list + disclosure | Independent | All lineages remain |
| 7 | No training data | Assign CTA | Three local empty states, no fake values | Empty | Empty history message |
| 8 | History but no current work | Assign CTA if active relation | No review/active/next | Latest if available | Existing rows retained |
| 9 | Suspended relation | `Связь приостановлена`; no CTA | Read unavailable state | Not queried/displayed under current policy | Not queried/displayed under current policy |
| 10 | Stale resolved review entry | Recomputed current focus | Resolved source removed from open list | Updated if feedback sent | Resolved row focused |
| 11 | Partial current error | Identity and tabs remain | Local error with retry; no inferred facts | May remain only if same successful response | History remains if loaded |
| 12 | Partial history error | Current focus remains | Current facts remain | Latest remains | Local retry; no page-level failure |
| 13 | Loading | Stable R1 frame skeleton | Three stable skeleton lanes | One compact skeleton line | 4–6 row skeletons |
| 14 | Long history | Normal | Normal | Normal | Cursor pages; no infinite auto-load |
| 15 | Multiple active sessions | Server-selected session | Count + anomaly + disclosure | Normal | No silent session loss |
| 16 | Source unavailable | Recomputed safe focus | No leaked entity details | Only authorized facts | Local `Источник недоступен` state |

### Suspended relation resolution

Current route and RLS do not provide trainer workout history for suspended relations. Therefore R2A design fails closed:

- no stale cached training facts;
- no history count that reveals inaccessible data;
- muted explanation `Тренировочные данные недоступны, пока связь приостановлена`;
- no links to Review, assignment or session;
- no primary CTA.

If product later accepts read-only suspended history, UX can reuse the same rows with disabled commands, but that requires the RLS/product decision identified in R2A architecture. This design does not presume it.

### Partial errors

Critical current and history fail independently. A local error must not replace the athlete identity or other successful areas. Retrying history does not refetch or reorder current facts unless the complete read model has been invalidated.

## 12. Content and terminology

### Section titles

- `Работа сейчас`
- `Ждут разбора`
- `Выполняется сейчас`
- `Следующее назначение`
- `Последняя обратная связь`
- `История тренировок`

### Preferred copy

| Situation | Copy |
| --- | --- |
| No reviews | `Нет тренировок, ожидающих разбора` |
| No active session | `Сейчас спортсмен не выполняет тренировку` |
| No next assignment | `Следующая тренировка не назначена` |
| No feedback | `Обратной связи пока не было` |
| No history | `История появится после первой завершённой тренировки` |
| Current load error | `Не удалось загрузить текущую работу` |
| History error | `Не удалось загрузить историю тренировок` |
| Stale review | `Этот разбор уже закрыт` |
| Multiple active anomaly | `Одновременно активны несколько тренировок` |
| Suspended | `Тренировочные данные недоступны, пока связь приостановлена` |

### Terms to avoid in UI

- `CRM`, `entity`, `snapshot`, `AttentionItem`, `read model`, `cursor`;
- `клиент` внутри athlete profile where `спортсмен` is established;
- `AI score`, `readiness`, `adherence`, `volume`, если они не приняты и не рассчитаны canonical data;
- `Программа`, `фаза`, `цикл` как подмена assignment;
- `успешно` для частичной тренировки без контекста;
- медицинские выводы из athlete comment.

Russian UI may use `обратная связь` instead of `feedback` in headings. If `feedback` remains in compact status due existing product language, usage should be consistent across trainer and athlete surfaces.

## 13. Accessibility requirements

1. Tab navigation keeps `aria-label` and `aria-current`; current implementation already supplies them at `components/trainer/canonical-athlete-profile.tsx:162-184`.
2. Training panel has a focusable heading associated with the selected tab.
3. `Работа сейчас`, feedback and history use semantic `<section>` headings.
4. Repeated reviews/history use `<ol>`/`<li>` or equivalent list semantics, not anonymous div soup.
5. Status is never communicated only by amber/sky/lime color; icon and visible label are required.
6. All links/buttons have at least `44 × 44px` effective target on mobile.
7. Dates use `<time dateTime="...">`.
8. Relative times have an accessible exact timestamp.
9. Disclosure controls expose `aria-expanded` and `aria-controls`.
10. Loading state uses one polite status message; decorative skeletons are `aria-hidden`.
11. Local errors use `role=alert`; retry is keyboard reachable.
12. Success after Review/Assign uses `aria-live=polite` and does not steal focus before data refresh completes.
13. Return focus lands on exact updated row or section heading; focus outline remains visible.
14. Appended pagination moves focus to the first new item only when the user activated `Показать ещё`.
15. Motion respects `prefers-reduced-motion`; no layout-height animation is required for current-state refresh.
16. Mobile reading order matches visual order: Header → tabs → review → active → next → feedback → history.
17. Truncated one-line feedback/title content exposes full text at destination, not tooltip-only.
18. Touch and keyboard actions never depend on hover.

## 14. Component reuse map

| Existing component/concept | UX decision |
| --- | --- |
| `TrainerShell` | Keep unchanged as outer trainer navigation |
| R1 `ProfileHeader` | Keep composition and sole primary CTA ownership |
| R1 `CurrentState` | Keep; feed from shared R2A projection |
| R1 `AttentionContextStrip` | Keep and extend only for stale/unavailable entry copy |
| R1 `ProfileTabs` | Keep URL-driven behavior and visual geometry |
| R1 `Section` | Reuse visual tokens; avoid wrapping each current fact in another card |
| R1 `LocalEmpty` | Reuse for independent current/history empty states |
| `CanonicalWorkoutReview` | Reuse as exact review destination; add return-context behavior during implementation |
| Canonical assignment dialog/builder | Reuse as command owner; return refreshed canonical assignment |
| Prototype `TrainingProfileHero` | Do not reuse |
| Prototype `TrainerWorkoutControlStrip` | Do not reuse; duplicates Header CTA |
| Prototype `WorkoutHistoryPanel` | Reuse only list-density idea; rebuild on canonical contract |
| Prototype `TopExerciseResultsPanel` | Exclude from R2A |
| Client canonical workout execution | Do not embed; trainer gets read-only links using the same IDs |

Conceptual components for implementation, not new domain entities:

```text
AthleteTrainingTab
├── TrainingCurrentSection
│   ├── PendingReviewList
│   ├── ActiveExecutionList
│   └── NextAssignmentList
├── LatestFeedbackBand
└── TrainingHistoryList
    ├── TrainingHistoryRow
    └── HistoryLoadMore
```

## 15. Keep / change / remove

### Keep

- compact human-first R1 Header;
- one primary CTA in Header;
- R1 AttentionContextStrip;
- URL-driven `Обзор / Тренировки / Прогресс` tabs;
- max-width and compact profile visual language;
- canonical assignment/session/attention/feedback IDs;
- local empty/error boundaries;
- exact Review and Quick Assign destinations.

### Change during implementation

- replace the two-card R1 Training placeholder (`components/trainer/canonical-athlete-profile.tsx:284-314`) with the accepted hierarchy;
- let R1 Header and Training tab consume one server-projected focus;
- preserve production Review and Quick Assign return context;
- replace unconditional profile scroll reset with semantic restoration;
- split critical current and history loading/errors;
- add cursor `Показать ещё`;
- expose counts/disclosures for multiple reviews, assignments and active-session anomalies.

### Remove from the R2A target

- duplicate `Назначить тренировку` button inside Training content when Header already owns it;
- second Training hero;
- Program/phase/week labels;
- adherence, current/target weight, streak, calories and top movements;
- string matching such as `status.includes("ждёт")`;
- local sorting/selection of active session;
- separate trainer-only workout history;
- auto-resolution on view;
- infinite automatic history loading.

Nothing is physically deleted by this design stage.

## 16. Acceptance criteria

### Comprehension

- On `1440 × 1024`, trainer sees Header, tabs, complete `Работа сейчас`, latest feedback and beginning of history without encountering a second hero.
- On `390 × 844`, trainer reaches the first current-work item immediately after the compact Header and tabs; no horizontal overflow occurs.
- In a 5-second review, a tester can state review count, active execution, next assignment and primary action correctly.

### Composition

- Pending review, active execution and next assignment render simultaneously when all exist.
- Header has no more than one primary CTA.
- Training panel contains no duplicate primary lime button.
- Latest feedback is visually completed/neutral and linked to exact session.
- Several reviews and assignments expose full counts and discoverable additional rows.
- Multiple active sessions are not silently collapsed.

### States

- All 16 state-matrix scenarios have defined copy, visual treatment and action behavior.
- Empty current does not erase history.
- Current error does not erase successful history; history error does not erase current work.
- Suspended relation fails closed under current authorization policy.
- Stale resolved review returns to an updated history row and never stays as open work.

### Workflow integrity

- Opening tab/row/Review never resolves AttentionItem.
- Review and Quick Assign return to the same athlete and `tab=training`.
- Read model refresh completes before success state is considered final.
- Review resolution updates Header, open review list, latest feedback and affected history row from canonical data.
- Assignment creation updates Header and next assignment from canonical data, including race with a newly completed session.
- Trainer and athlete surfaces link the same assignment, session and feedback IDs.

### Data discipline

- No mock facts, Program, Progress, Motivation, AI scoring or unsupported metrics appear.
- History summary is set-based and does not require per-row exercise/session queries.
- UI consumes server-selected active session and ordering.
- Pagination uses opaque cursor and explicit `Показать ещё`.

### Accessibility and responsive quality

- Keyboard, screen reader, focus return, reduced motion and 44px touch-target requirements from section 13 pass.
- Text wraps without overlapping controls at both target viewports.
- Loading skeletons preserve layout dimensions and do not cause a large content jump.

## 17. Открытые решения

1. **Suspended relation:** product owner must decide whether trainers may retain read-only history. Current design follows existing RLS and shows no training facts.
2. **Multiple active sessions:** for R2A v1 the UI surfaces the anomaly. A later architecture decision may prevent it at command/schema level.
3. **Upcoming assignments depth:** recommendation is selected next item + count + inline disclosure. Confirm whether full upcoming schedule is needed in v1.
4. **Assignment detail destination:** canonical trainer read-only assignment detail does not yet have an accepted route. Decide between inline disclosure, modal, or dedicated route before implementation.
5. **Review list expansion:** recommendation is 3 immediate rows desktop and 2 mobile, then explicit disclosure. Validate with real trainer workloads.
6. **Feedback preview:** include one-line body only if it is delivered in the same set-based read model; do not introduce a separate request solely for preview.
7. **History page size:** recommended starting point is 10 desktop/mobile rows per cursor page; verify query cost and trainer scanning behavior.
8. **No-assignment source contract:** current canonical AttentionItem cannot represent it. Confirm `entry=no_next_assignment` as an ephemeral validated reason for R2A v1.
9. **Terminology:** choose one visible product term, `Обратная связь` or `Feedback`, for trainer and athlete surfaces.
10. **Active session destination:** confirm whether trainer gets a compact read-only detail or only status until completion; trainer must never mutate athlete progress.

## 18. Change confirmation

This R2A design pass creates only `docs/athlete-training-r2a-design-v1.md`.

- UI was not implemented or changed.
- API routes were not added or changed.
- PostgreSQL migrations and schema were not changed.
- Production code was not changed.
- No mock data was added or connected.
- Progress, Motivation and Program were not designed or implemented.
- No Git commit was created.
