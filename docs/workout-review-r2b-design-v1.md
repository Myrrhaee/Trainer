# Workout Review R2B Design v1

Date: 2026-08-31
Status: UX design proposal
Scope: canonical Full Page Workout Review and preview-only Review Drawer

## 1. Design verdict

R2B should be designed as one review workflow with two presentation depths:

- **Full Page** is the only command surface and the canonical place for detailed inspection, feedback, acknowledgement, follow-up and manual resolution.
- **Preview Drawer** is an optional, explicitly requested factual preview. It never sends feedback, never resolves an `AttentionItem` and always offers `Открыть подробный разбор`.
- A normal click on a review task from Dashboard or the athlete profile continues to open the Full Page directly. The Drawer must not become a mandatory intermediate step.
- Desktop uses a two-column work layout: evidence on the left and one sticky action panel on the right. After a successful command, the completion receipt replaces that action panel.
- Mobile uses one semantic column in task order. The same facts and commands remain available without a wide table or hover-dependent interaction.

For the first production release, choose **Drawer option A**: the Drawer never opens automatically and is available only through an explicit preview control in a compact queue. This preserves the shortest path to feedback while allowing a trainer to inspect an item without losing queue context.

The design does not introduce Program, Progress, Motivation, AI diagnosis, AI scoring or new domain entities.

## 2. Confirmed architecture constraints

The UX is bounded by the accepted R2B architecture:

1. The canonical route is `/trainer/review/{sessionId}`. Although the current segment is named `[workoutId]`, its value is a `WorkoutSession.id`.
2. Session, Assignment snapshot, Athlete, review `AttentionItem`, exercise/set logs and `TrainerFeedback` belong to one canonical review linkage.
3. Full Page and future production Drawer must read the same `ReviewReadModel`; a separate Drawer domain model is not allowed.
4. Detailed feedback and acknowledgement are two modes of the same feedback command.
5. Follow-up is an immutable linked feedback record, not an edit of sent feedback.
6. Manual resolution is a separate persisted command with a trainer-private reason and no athlete-visible message.
7. Initial feedback or acknowledgement resolves the exact open `AttentionItem` only after persistence succeeds.
8. Opening the Full Page, opening the Drawer, expanding an exercise or returning to a source never resolves an `AttentionItem`.
9. Retry of one logical submit reuses the same idempotency key.
10. R2A.3 owns source, return, next-item and revalidation behavior and remains unchanged.
11. The server, not the UI, validates Session, Athlete and Attention identities and chooses the next item.
12. Assignment and Session facts must remain paired by stable source IDs. The UI must not infer identity from position after filtering.
13. `skipped`, `incomplete`, missing data and unsupported data are different states.
14. Structured discomfort, overall session comment and session-level subjective metrics do not currently have a complete canonical persistence path.
15. Current production Review must therefore report discomfort and unsupported session context honestly, without synthesizing `нет сигнала`.
16. Notification transport is not the source of truth for saved feedback.
17. Suspended relations and permission failures must not reveal review facts.
18. Demo Drawer state, `review-store`, synthetic feedback, AI drafts and seeded review facts are not production sources.

## 3. Product decisions used by the design

| Decision | R2B v1 behavior |
| --- | --- |
| Canonical command surface | Full Page only |
| Default Dashboard/Profile transition | Directly to Full Page |
| Preview Drawer | Optional and explicitly invoked |
| Drawer commands | None |
| Manual resolution | Full Page only |
| Detailed feedback | Full Page |
| Short acknowledgement | Full Page |
| Follow-up | Full Page |
| Same-tab draft bridge | Not included in preview-only release |
| Drawer complexity thresholds | Research hypotheses only; they do not control domain behavior |
| AI draft or diagnosis | Not included |
| Program, Progress, Motivation | Not included |
| Feedback delivery copy | Distinguish saved product state from notification delivery |
| Existing resolved Review | Read-only history plus follow-up when capability allows |

## 4. User jobs

### Primary job

> Inspect the exact completed training facts, give the athlete an appropriate response and know that the review task has been durably closed.

### Supporting jobs

1. Confirm the athlete, workout and completion time before acting.
2. Understand the assigned plan and the actual result without reconstructing it mentally.
3. Start with exceptions: skips, incomplete sets, changed values, comments and missing logs.
4. Distinguish `not recorded`, `not collected` and `failed to load`.
5. Inspect every relevant set while retaining its exercise and source context.
6. Send a detailed response or a short acknowledgement.
7. See earlier feedback and add a follow-up without rewriting history.
8. Close an exceptional item without a message only through an explicit, reasoned confirmation.
9. Continue to the server-selected next item, the athlete profile or the queue.
10. Preview an item from a dense queue without accidentally changing its state.

## 5. Entry points

| Entry | Default destination | Context shown | Safe return |
| --- | --- | --- | --- |
| Dashboard review item | Full Page | `Из очереди`, Attention reason, exact Session | Server-provided queue or next item |
| Dashboard explicit preview icon/menu | Preview Drawer | `Предпросмотр из очереди`, exact Session, Attention reason | Close to same queue position |
| Athlete Profile, Training tab | Full Page | `Из профиля`, athlete and source block | Same profile, `tab=training`, source block anchor |
| Direct authorized URL | Full Page | `Прямая ссылка`; no invented queue position | Athlete profile or Dashboard fallback |
| Resolved item/history | Full Page | `Разбор закрыт`, existing feedback and resolution time | Original source when valid, otherwise profile/queue |
| Invalid or stale transition envelope | Full Page safe state | Review facts only if independently authorized | Server-derived safe destination |

Entry context is orientation, not authorization. It may affect labels and return destinations, but never changes which Session or Attention record is loaded.

## 6. Primary and secondary actions

### Open review

There is one primary command at a time inside the Full Page action panel:

| State | Primary action | Secondary actions |
| --- | --- | --- |
| Open, detailed mode | `Отправить ответ` | Switch to short acknowledgement; open exceptional manual resolution |
| Open, acknowledgement mode | `Подтвердить и закрыть разбор` | Choose another prepared text; switch to detailed mode |
| Submitting | Disabled `Сохраняем...` | None until response |
| Save failed | `Повторить сохранение` | Continue editing; return without losing on-screen draft |
| Resolved with existing feedback | `Добавить уточнение` | Navigate to profile/queue |
| Follow-up draft | `Отправить уточнение` | Cancel follow-up |
| Relation suspended | No command | Return to athlete list or queue |
| Permission denied/source unavailable | No command | Return to queue |

Rules:

- `Закрыть без сообщения` is never visually adjacent to the primary submit as an equal action. Place it under `Дополнительные действия` after the feedback form.
- Profile, queue and next-item links are navigation, not competing review commands.
- `Назначить следующую` is not part of the open-review action panel. It may be offered only after completion through the transition receipt or athlete profile.
- Preview Drawer has one forward action: `Открыть подробный разбор`. `Закрыть` is a dismiss control, not a workflow command.

## 7. Transition and return map

| Scenario | User job | Entry | Primary action | Next screen | Return/state rule | Keep / change / remove |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Dashboard -> Full Review -> feedback -> next | Resolve current item and continue | Dashboard review item | Send feedback/acknowledgement | Server-selected next Full Review | Use R2A.3 `nextItem`; never select locally | Keep canonical transition; change receipt clarity |
| 2. Dashboard -> Full Review -> feedback -> queue | Resolve and inspect queue | Dashboard review item | Send feedback/acknowledgement | Dashboard queue | Revalidate queue before navigation; preserve queue context | Keep |
| 3. Profile Training -> Full Review -> feedback -> profile | Resolve athlete task and return to context | Profile Training pending-review block | Send feedback/acknowledgement | Same athlete profile, Training tab | Use `profileHref` and source block anchor | Keep |
| 4. Direct Review URL | Inspect an authorized Session | Direct URL | State-dependent command | Profile or Dashboard | Do not invent queue source or `router.back()` | Change any source-dependent copy to neutral |
| 5. Preview Drawer -> Full Review | Decide whether detailed review is needed | Explicit preview control | Open detailed review | Same Session Full Page | Preserve R2A.3 flow; no draft bridge in v1 | Change Drawer to preview-only |
| 6. Review already resolved | Verify outcome | Any entry | Add follow-up, if allowed | Same Full Page receipt/history | Do not reopen or locally recreate Attention | Keep persisted feedback, change stale explanation |
| 7. Manual resolution | Close exceptional task without athlete message | Full Page additional action | Confirm reason | Completion receipt | Persist first; receipt states no message was sent | Keep endpoint; change visual hierarchy |
| 8. Follow-up feedback | Correct or clarify immutable feedback | Resolved Full Page | Send follow-up | Updated same Full Page | Link to original feedback; Attention remains resolved | Keep |
| 9. All-calm after resolution | Finish queue safely | Completion receipt | `К спортсменам` or `К очереди` | Athlete list/empty queue | Use server `allCalm`; no fake next item | Keep |
| 10. Invalid transition context | Avoid wrong return or cross-athlete state | Any malformed/stale link | State-dependent command if review itself is valid | Safe server-derived destination | Explain that return context was refreshed; review authorization remains independent | Keep R2A.3 fallback |

### Scroll and focus restoration

- Returning to Dashboard restores the originating queue item or its nearest surviving neighbor after revalidation.
- Returning to Profile restores `tab=training` and focuses the changed pending-review/history block, not an arbitrary page coordinate.
- Drawer close restores focus to the exact preview trigger.
- Full Page browser reload preserves the canonical URL and server state, but no unsent cross-device draft guarantee is made.
- After successful submit, focus moves to the completion receipt. After failed submit, focus moves to the error summary while the draft remains visible.

## 8. Full Page information hierarchy

The Full Page is a work surface, not an athlete-profile hero and not an analytics dashboard.

### First viewport order

1. **Compact context header**
   - back destination based on validated transition;
   - `Разбор тренировки` eyebrow;
   - athlete name;
   - workout title;
   - completion date/time;
   - source label;
   - Attention state and factual reason;
   - no large avatar, KPI row or repeated hero.
2. **Safety and availability strip**
   - safety-relevant context first when supported;
   - explicit unsupported/unavailable messages;
   - no positive conclusion from missing channels.
3. **Review summary**
   - compact text/fact row: exercises, sets, completed/skipped/incomplete, duration when available;
   - no separate large card for every metric.
4. **Exceptions first**
   - source-linked factual exceptions ordered by safety relevance, then skipped/incomplete, comments, changed values and missing logs.
5. **Sticky action panel on desktop**
   - existing feedback first;
   - one current action mode;
   - persistence/error state;
   - exceptional manual resolution separated below.

### Remaining content

6. Exercise results with per-exercise disclosure.
7. Session context and availability.
8. Long comments at their source rows, with a concise index in exceptions.
9. Completion receipt replacing the action panel after a successful initial command or manual resolution.

### Density rules

- Use section boundaries and compact definition lists before nested cards.
- Use cards only for a meaningful unit: one exception, one exercise disclosure or the action panel.
- Do not repeat the same Session title in the shell, context header and summary as three equally prominent headings.
- The action panel height is independent of the exercise list and remains sticky only within the review content boundary.
- Sticky behavior stops before the page footer and is disabled when viewport height makes the form unusable.

### Why desktop is not one column

A single column is simpler but separates evidence from the response composer during a long workout. Trainers would repeatedly scroll between a set result and their draft, increasing memory load and the chance of losing context. At 1440 px, two columns preserve a readable evidence width and a stable 360-400 px action panel. The layout collapses to one column below the breakpoint or when zoom/text size makes both columns too narrow.

## 9. Desktop wireframe

Target viewport: `1440 x 1024`.

```text
┌──────────────── TrainerShell / compact page heading ───────────────────────────────┐
│ ← К очереди   РАЗБОР ТРЕНИРОВКИ                                      [status]      │
│ Артём Смирнов · Силовая A · 30 авг., 19:42                           Из очереди     │
│ Причина: завершённая тренировка ждёт разбора                          Session …A7F2 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Контекст самочувствия не собирался] [Логи загружены]                              │
├───────────────────────────────────────────────┬─────────────────────────────────────┤
│ MAIN, minmax(0, 1fr)                          │ ASIDE, 380 px, sticky                │
│                                               │                                     │
│ ИТОГ                                          │ ОБРАТНАЯ СВЯЗЬ                      │
│ 5 упражнений · 18 подходов                    │ [Подробный ответ|Коротко подтвердить]│
│ 14 выполнено · 2 частично · 2 пропущено       │                                     │
│                                               │ Existing feedback, if any           │
│ СНАЧАЛА ИСКЛЮЧЕНИЯ                            │                                     │
│ ! Присед · подход 4 · пропущено      [Открыть]│ Сообщение спортсмену               │
│ ! Жим · подход 3 · 8 вместо 10       [Открыть]│ ┌─────────────────────────────────┐ │
│ ! Тяга · комментарий спортсмена      [Открыть]│ │ draft                           │ │
│                                               │ └─────────────────────────────────┘ │
│ РЕЗУЛЬТАТЫ ПО УПРАЖНЕНИЯМ                     │ [Отправить ответ]                   │
│ ▾ 1. Присед                         Частично  │                                     │
│   Подход  План              Выполнено         │ Дополнительные действия             │
│   1        10 x 80 кг        10 x 80 кг · RPE 7│ Закрыть без сообщения               │
│   2        10 x 80 кг        8 x 80 кг · RPE 9 │                                     │
│   Комментарий: ...                              │                                     │
│ ▸ 2. Жим лёжа                      По плану   │                                     │
│ ▸ 3. Тяга                          Пропущено  │                                     │
│                                               │                                     │
│ КОНТЕКСТ СЕССИИ                              │                                     │
│ Самочувствие: данные не собирались            │                                     │
└───────────────────────────────────────────────┴─────────────────────────────────────┘
```

After successful persistence, the right column changes in place:

```text
┌────────────── РАЗБОР СОХРАНЁН ───────────────┐
│ Обратная связь доступна спортсмену в кабинете │
│ ID ответа …91C4 · Задача разбора закрыта      │
│ Уведомление: статус доставки недоступен        │
│                                               │
│ [Следующий разбор: Мария]                      │
│ К профилю                  К очереди           │
└───────────────────────────────────────────────┘
```

The receipt replaces the form. It is not appended below an inactive form.

## 10. Mobile wireframe

Target viewport: `390 x 844`.

```text
┌──────────────────────────────────┐
│ ← К очереди                      │
│ РАЗБОР ТРЕНИРОВКИ                │
│ Артём Смирнов                    │
│ Силовая A · 30 авг., 19:42       │
│ [Ждёт разбора] · Из очереди       │
├──────────────────────────────────┤
│ Причина                           │
│ Завершённая тренировка            │
│ ждёт разбора                      │
├──────────────────────────────────┤
│ Важно                             │
│ Самочувствие для этой тренировки  │
│ не собиралось                     │
├──────────────────────────────────┤
│ Итог                              │
│ 5 упражнений · 18 подходов        │
│ 14 выполнено · 2 частично · 2     │
│ пропущено                         │
├──────────────────────────────────┤
│ Сначала исключения                │
│ ! Присед · подход 4               │
│   Пропущено          [К результату]│
│ ! Жим · подход 3                  │
│   8 повторов вместо 10            │
├──────────────────────────────────┤
│ Результаты                        │
│ [▾] Присед            Частично    │
│ Подход 1                          │
│ По плану: 10 повторов · 80 кг     │
│ Выполнено: 10 повторов · 80 кг    │
│ RPE: 7                            │
│ [▸] Жим лёжа          По плану    │
├──────────────────────────────────┤
│ Контекст сессии                   │
│ Самочувствие: не собиралось       │
│ Общий комментарий: не собирался   │
├──────────────────────────────────┤
│ Обратная связь                    │
│ [Подробно] [Коротко подтвердить]  │
│ ┌──────────────────────────────┐  │
│ │ Сообщение спортсмену         │  │
│ └──────────────────────────────┘  │
│ [Отправить ответ]                 │
│ Дополнительные действия           │
└──────────────────────────────────┘
```

Mobile rules:

- Planned and actual values stack under one set heading; no horizontal table is required.
- Exercise disclosures are native buttons with at least `44 x 44` px targets.
- Long titles wrap; status remains on a separate line if needed.
- The feedback composer is in document flow. It is not a fixed bottom sheet that can be covered by the virtual keyboard.
- On focus, the textarea scrolls above the keyboard with enough bottom padding for safe-area and submit controls.
- Submit remains reachable through normal scrolling and does not depend on hover.
- Success replaces the composer with the receipt and moves focus to its heading.
- At 200% zoom and with large text, the layout remains one column with no document-level horizontal overflow.

## 11. Preview Drawer role

### Purpose

The Drawer answers one question:

> Is this the Session I expect, and what are the main factual reasons it needs review?

It is useful when a trainer is scanning a dense queue and wants to inspect context without committing to a navigation. It is not useful as a default step before every review.

### Drawer content

1. Athlete name and initials/avatar.
2. Workout title and completion time.
3. Open/resolved Attention state and factual reason.
4. Exact Session identity, shown as a short suffix with an accessible copy action for the full ID.
5. Up to three main factual exceptions, with total count if more exist.
6. Skipped and incomplete counts.
7. Available source comments, quoted and attributed.
8. Compact data-availability summary.
9. Primary navigation: `Открыть подробный разбор`.
10. Dismiss control.

### Drawer exclusions

- no textarea;
- no acknowledgement choices;
- no feedback history editor;
- no follow-up command;
- no manual resolution;
- no fake AI draft, score or diagnosis;
- no local optimistic closing of the queue item;
- no claim that discomfort is absent while it is unsupported;
- no independent queue navigation that bypasses R2A.3.

### When preview is useful

Offer the preview control only where all are true:

- the user remains in a compact multi-item queue;
- losing current filters/scroll would be costly;
- the row itself already has a direct Full Page action;
- the preview adds source facts not visible in the row;
- the control can be named clearly for keyboard and screen-reader users.

Do not add a preview control to the Profile Training block when the full review is already the natural next screen and athlete context is visible.

## 12. Drawer wireframes

### Desktop, right side sheet

Recommended width: `min(520px, calc(100vw - 24px))`. The current 920 px demo Drawer is too close to a second page for preview-only scope.

```text
                         ┌──────────────────────────────┐
                         │ ПРЕДПРОСМОТР РАЗБОРА      [x]│
                         │ Артём Смирнов                │
                         │ Силовая A · сегодня, 19:42   │
                         │ [Ждёт разбора] · Session A7F2│
                         ├──────────────────────────────┤
                         │ Причина                      │
                         │ Завершённая тренировка       │
                         │ ждёт разбора                 │
                         │                              │
                         │ Основные отличия             │
                         │ ! Подход 4 пропущен          │
                         │ ! 8 повторов вместо 10       │
                         │ ! Есть комментарий           │
                         │ Ещё 2 в полном разборе       │
                         │                              │
                         │ Данные                       │
                         │ План и логи доступны         │
                         │ Самочувствие не собиралось   │
                         │                              │
                         │ Комментарий                  │
                         │ «Тяжело дался последний...»  │
                         ├──────────────────────────────┤
                         │ [Открыть подробный разбор]   │
                         │ Закрыть                      │
                         └──────────────────────────────┘
```

The sheet body scrolls independently; the footer remains visible when space permits. If content height is constrained, footer follows the scroll content rather than covering it.

### Mobile, full-height sheet

```text
┌──────────────────────────────────┐
│ ПРЕДПРОСМОТР                  [x] │
│ Артём Смирнов                    │
│ Силовая A · 19:42                │
│ [Ждёт разбора]                   │
├──────────────────────────────────┤
│ Причина                           │
│ ...                               │
│                                   │
│ Основные отличия                  │
│ 1. Подход 4 пропущен              │
│ 2. 8 повторов вместо 10           │
│ 3. Есть комментарий               │
│                                   │
│ Доступность данных                │
│ Самочувствие не собиралось        │
│                                   │
│ Комментарий                       │
│ ...                               │
├──────────────────────────────────┤
│ [Открыть подробный разбор]        │
│ Закрыть                           │
└──────────────────────────────────┘
```

On mobile the sheet occupies the viewport height, respects safe areas, traps focus, closes with Escape when a hardware keyboard is present and restores focus to the trigger.

### Drawer states

- **Loading:** keep header skeleton and one body status; no stale facts from the previous Session.
- **Source unavailable:** generic `Разбор недоступен`; do not reveal athlete/title; offer queue return.
- **Partial logs:** show available summary, label incomplete source explicitly and promote to Full Page.
- **Resolved:** show `Разбор уже закрыт`, resolution time and existing feedback summary; Full Page action becomes `Открыть историю разбора`.
- **Permission denied:** use the same non-disclosing unavailable surface as not-found where required by security.
- **Invalid flow:** preview may load authorized facts, but its Full Page link uses a safe server-derived flow or neutral route.

## 13. Drawer go/no-go comparison

| Option | Actions/time to feedback | Intermediate-step risk | Trainer clarity | Implementation cost | Core-loop impact |
| --- | --- | --- | --- | --- | --- |
| A. Explicit preview, never automatic | Direct row action remains one navigation; preview adds a step only when chosen | Low | High if preview control is clearly named | Medium | Preserves fastest core loop |
| B. Queue opens Drawer first, then Full Page | Adds one action to every detailed review | High | Medium; row click meaning becomes ambiguous | Medium | Slows feedback and can make Drawer feel mandatory |
| C. No Drawer until command-enabled | Direct path is shortest | None | High | Lowest now, higher later | Safe but loses queue inspection benefit |

### Decision

Choose **A** for R2B preview-only.

Rationale:

- It respects the accepted rule that Dashboard and Profile open Full Page by default.
- It adds no mandatory step to `assignment -> completion -> review -> feedback -> close`.
- It provides a measurable research surface: preview open rate, promotion rate and time-to-Full-Page can be observed without changing the command model.
- It avoids implying that the Drawer can finish work while discomfort/session context is unsupported.
- It keeps option C available: if pilot usage is negligible, do not promote the Drawer further.

Go criteria for release:

- the Drawer uses the canonical read model and exact Session ID;
- no production import reaches demo selectors/store/seeds;
- partial and unsupported data are explicit;
- Full Page escape always works;
- focus containment and restoration pass keyboard/mobile QA;
- opening/closing produces no domain write.

No-go criteria:

- preview requires a separate data model;
- it changes the default row action;
- it cannot preserve validated R2A.3 context;
- it shows stale facts from a previous item;
- it hides partial/unavailable logs;
- it adds any local resolution behavior.

## 14. Planned-versus-actual presentation

### Exercise level

Each exercise disclosure shows:

- stable order and exercise title;
- factual aggregate state: `По плану`, `Есть отличия`, `Выполнено частично`, `Пропущено`, `Результат не записан`;
- count of affected sets;
- original trainer note only when the canonical Assignment snapshot provides it;
- source-linked comments.

Exercises with safety-relevant context, skips, incomplete sets, comments or changed values are expanded first. Normal exercises start collapsed but remain available.

### Set level

Each row preserves source identity and displays:

```text
Подход 3 · рабочий
По плану:   8-10 повторов · 80 кг · 90 сек работы
Выполнено:  8 повторов · 80 кг · 82 сек · RPE 9
Статус:     Выполнено частично
Комментарий спортсмена: «...»
```

Only dimensions that exist in the canonical snapshot are shown. A missing planned duration is not rendered as `0 сек`. A skipped set displays `Пропущено`; null actual values are not converted to zero.

### Responsive behavior

- Desktop may align `По плану` and `Выполнено` as two definition-list columns inside one row.
- Mobile stacks them vertically under the same set heading.
- Difference emphasis uses text plus icon/border, not color alone.
- An exception link scrolls to and expands the exact source exercise/set, then moves focus to its heading.
- Added sets are not displayed as a supported state until a canonical creation command exists.

## 15. Exception and deviation presentation

Use the section title `Сначала исключения` and the neutral item label `Отличие от плана`.

### Ordering

1. Safety-relevant original context, when canonically supported.
2. Skipped exercises/sets.
3. Incomplete results.
4. Athlete comments attached to affected rows.
5. Changed repetitions, load or duration.
6. Missing logs or unavailable source data.

### Item contract

Each exception contains:

- factual title;
- exercise and set position;
- planned and actual values where both are known;
- exact state/source ID in the view model;
- original athlete wording when present;
- `К результату` action that focuses the source row.

### Copy rules

Use:

- `8 повторов вместо запланированных 10`;
- `Подход пропущен`;
- `Результат подхода не записан`;
- `Нагрузка изменена: 70 кг по плану, 65 кг выполнено`.

Do not use:

- `плохое выполнение`;
- `низкая эффективность`;
- `ошибка спортсмена`;
- `нарушение дисциплины`;
- diagnosis, AI score or adherence score.

If there are no factual exceptions and all required sources are ready, show `Отличий от плана не зафиксировано`. If any required source is unsupported or unavailable, do not show this positive conclusion without a scope qualifier.

## 16. Session-context availability

Availability is part of the content, not a hidden implementation detail.

| State | Meaning | UI form | Can support a positive empty statement? |
| --- | --- | --- | --- |
| `ready + value` | Canonical source loaded and has data | Show original value and source | Yes |
| `known empty` | Canonical write path exists, query succeeded, value is explicitly empty | `Спортсмен не отметил дискомфорт` | Yes |
| `unsupported` | Product did not collect/persist this fact | `Данные о самочувствии для этой тренировки не собирались` | No |
| `unavailable` | Supported source failed or cannot be read now | `Не удалось загрузить данные о самочувствии` | No |
| `partial` | Some source rows loaded, completeness not guaranteed | `Часть данных тренировки недоступна` | No |

### R2B v1 projection

| Context | Current production state | Required presentation |
| --- | --- | --- |
| Discomfort | Unsupported | `Данные о самочувствии для этой тренировки не собирались` |
| Overall session comment | Unsupported; `zero_result_reason` is not a general comment | `Общий комментарий к тренировке не собирался` |
| Subjective session metrics | Unsupported; per-set RPE is separate | `Общая оценка самочувствия не собиралась` |
| Assignment snapshot | Supported | Show `ready`; if absent, `Исходный план недоступен. Показаны только фактические результаты` |
| Exercise/set logs | Supported | `known empty` only after a successful complete query; otherwise partial/unavailable |
| Set comment | Supported | Empty copy only after complete source query |
| Exercise note | Stored field but current write path incomplete | Do not claim collection support until command path is confirmed |

The current R2B Full Page and Drawer must never render `Дискомфорта нет` from a hard-coded boolean.

## 17. Feedback and follow-up design

### Panel composition

1. Heading and current persisted Attention state.
2. Existing immutable feedback timeline, if present.
3. Mode segmented control for open Review: `Подробный ответ` / `Коротко подтвердить`.
4. Message textarea or acknowledgement choices.
5. One primary submit.
6. Inline persistence status/error.
7. Separated `Дополнительные действия` containing manual resolution.

### Feedback states

| State | UI behavior | Focus/data behavior |
| --- | --- | --- |
| Empty draft | Detailed mode selected; submit disabled | Focus may enter textarea |
| Typing | Character count appears near limit; mode remains visible | Draft stays in component state |
| Detailed mode | Free text; no AI draft | Submit label `Отправить ответ` |
| Acknowledgement mode | Prepared neutral phrases plus editable selected text | No silent submit on phrase click |
| Submitting | Disable mode, textarea and duplicate submit; show progress | Preserve draft until success |
| Save failed | Error next to action with `Повторить сохранение` | Keep draft and same idempotency key |
| Retry | Repeat the same logical request | Same key and payload unless user edits; editing starts a new logical attempt/key |
| Submitted | Replace panel with receipt | Clear draft only after persisted success |
| Resolved in another tab | Reload persisted state | Announce stale state; do not retry initial feedback as follow-up automatically |
| Existing feedback | Render author, kind, timestamp and exact body | Sent content is read-only |
| Follow-up | New textarea labelled `Текст уточнения` | Link new record to selected original feedback |
| Relation suspended | Disable all commands | Preserve no sensitive source beyond what authorized response permits |
| Permission denied | Generic unavailable state | No source facts or draft submit |
| Delivery status unavailable | Receipt says saved and visible in product; notification status unavailable | Never resend feedback automatically |
| Return/revalidation failed | Keep receipt and explicit fallback links | Persistence success is not rolled back |

### Acknowledgement content

Prepared acknowledgements must be neutral and editable. Avoid praise that asserts facts the trainer may not have verified. Suitable examples:

- `Тренировку посмотрел. Результаты принял.`
- `Результаты вижу. Продолжаем по текущему плану.`
- `Тренировку принял. Отдельно вернусь с корректировками.`

The chosen phrase is shown in the same textarea before submit so the athlete-visible text is never hidden.

### Concurrent submit

- First submit disables duplicate interaction locally.
- A second tab resolving the item produces a stale state, triggers canonical reload and shows the persisted result.
- The UI never relabels an unsaved initial response as a follow-up automatically.
- A follow-up becomes available only after persisted feedback is loaded and capability confirms it.

## 18. Manual-resolution design

Manual resolution is an exceptional Full Page action.

### Entry

Place `Закрыть без сообщения` under a collapsed or visually quiet `Дополнительные действия` section below the primary feedback workflow. Do not place it beside `Отправить ответ` with equal emphasis.

### Confirmation dialog

```text
Закрыть разбор без сообщения?

Спортсмен не получит обратную связь по этой тренировке.
Причина сохранится в приватной истории тренера.

Причина *
[Разобрано вне продукта                         v]
[Optional custom reason when «Другое»]

[Продолжить разбор]          [Закрыть без сообщения]
```

Requirements:

- reason is mandatory;
- custom reason is mandatory when `Другое` is selected;
- confirmation uses explicit wording, not generic `Подтвердить`;
- command uses canonical persistence and idempotency;
- dialog remains open on failure and preserves the selected reason;
- success produces a receipt with manual-resolution identity/state;
- receipt says `Разбор закрыт без сообщения спортсмену`;
- no local queue removal occurs before success;
- manual resolution is unavailable in Drawer.

## 19. Completion receipt

The receipt is the final state of the action region, not a toast and not a third layer beneath the form.

### Persisted feedback receipt

Show:

- `Обратная связь сохранена`;
- feedback kind and short immutable ID/reference;
- `Задача разбора закрыта`;
- athlete availability: `Спортсмен увидит ответ в кабинете`;
- notification status only if canonically available; otherwise `Статус доставки уведомления недоступен`;
- server-selected next item, when present;
- `К профилю` and `К очереди`;
- all-calm state when returned by the server.

### Follow-up receipt

Show `Уточнение сохранено` and retain the resolved state. Do not claim another Attention transition.

### Manual receipt

Show `Разбор закрыт без сообщения спортсмену`, persisted reason and resolution reference. Do not display athlete-delivery language.

### Failure after persistence

If return/revalidation fails after persistence:

- keep the success receipt;
- show `Решение сохранено, но очередь не удалось обновить`;
- offer stable profile and queue fallbacks;
- never invite the user to resubmit the feedback.

## 20. State matrix

| State | Full Page | Preview Drawer | Commands/navigation |
| --- | --- | --- | --- |
| Loading | Context-shaped skeleton; action disabled | Clear previous Session; compact skeleton | No command |
| Source Session unavailable | Generic unavailable state; no athlete facts | Same non-disclosing state | Queue fallback only |
| Assignment snapshot unavailable | Show actual facts only and explicit warning | Mark source partial; promote to Full Page | Feedback remains a Full Page capability if server allows |
| Partial logs | Show loaded rows plus persistent completeness warning | Summary only; promote | No positive `all clear` statement |
| No logs, complete query | `Результаты по подходам не записаны`; comments may still be reviewed | State and availability only | Feedback allowed if capability permits |
| Attention open | Open action panel | `Ждёт разбора` | Full Page feedback/manual commands only |
| Attention resolved | Existing feedback/resolution and receipt/history state | `Разбор закрыт` preview | Follow-up on Full Page if allowed |
| Feedback already sent | Immutable timeline | Short latest-feedback summary only | Full Page follow-up |
| Follow-up allowed | Explicit `Добавить уточнение` | `Открыть историю разбора` | Full Page only |
| Relation suspended | Explain that work is unavailable; hide commands | Generic unavailable/non-sensitive state | Safe list/queue return |
| Permission denied | Generic unavailable; no source disclosure | Same | Safe return only |
| Concurrent submit | Disable local duplicate; canonical reload on conflict | Not applicable | Never create local success |
| Feedback save failure | Keep draft; actionable retry | Not applicable | Retry same key |
| Delivery status unavailable | Persisted receipt plus delivery caveat | If resolved, no delivery claim | No automatic resend |
| Return/revalidation failure | Keep persisted receipt and fallback links | Invalid flow promotes using neutral route | No command replay |
| Invalid flow | Load Review only if independently authorized; neutral source | Preview authorized facts only | Server-derived return |
| Long workout | Expand/collapse, skip link to results, sticky panel bounded | Show max 3 exceptions and total | Full Page required for detail |
| Long comments | Wrap/pre-wrap at source; optional `Показать полностью` with accessible state | Truncated preview plus Full Page link | No data loss in Full Page |
| Mobile keyboard | Composer in flow, safe bottom padding, visible submit | No textarea | Focus remains in visible viewport |
| Empty known context | Explicit `Спортсмен не оставил комментарий` only for supported complete source | Same concise statement | Normal flow |
| Unsupported context | `Данные ... не собирались` | Same, compact | Never infer empty |
| Unavailable context | `Не удалось загрузить ...` with retry/reload where useful | Mark unavailable and promote | Never infer empty |

## 21. Content and terminology

Use Russian operational labels consistently.

| Concept | User-facing label | Supporting copy/example |
| --- | --- | --- |
| Review | `Разбор тренировки` | `Тренировка ждёт разбора` |
| planned | `По плану` | `По плану: 10 повторов · 80 кг` |
| actual | `Выполнено` | `Выполнено: 8 повторов · 80 кг` |
| deviation | `Отличие от плана` | `8 повторов вместо запланированных 10` |
| skipped | `Пропущено` | `Подход пропущен` |
| incomplete | `Выполнено частично` | `Записана только часть результата` |
| missing log | `Результат не записан` | `Данные подхода отсутствуют` |
| acknowledgement | `Коротко подтвердить` | `Подтвердить и закрыть разбор` |
| follow-up | `Уточнение` | `Добавить уточнение` |
| manual resolution | `Закрыть без сообщения` | `Причина сохранится в приватной истории тренера` |
| unsupported context | `Данные не собирались` | `Данные о самочувствии для этой тренировки не собирались` |
| unavailable context | `Не удалось загрузить данные` | `Не удалось загрузить данные о самочувствии` |
| resolved AttentionItem | `Разбор закрыт` | `Задача разбора закрыта` |
| source unavailable | `Разбор недоступен` | `Вернитесь к очереди и выберите доступную тренировку` |
| preview | `Предпросмотр разбора` | `Открыть предпросмотр` |
| detailed page | `Подробный разбор` | `Открыть подробный разбор` |

Avoid mixed labels such as `Plan vs actual`, `Review`, `feedback`, `manual resolve` and `follow-up` in the visible UI. Technical identifiers may remain in logs and developer tooling.

## 22. Accessibility

### Full Page

- One page `h1` names the review; major sections use ordered `h2` headings.
- Provide skip links to `Сначала исключения`, `Результаты по упражнениям` and `Обратная связь` for long workouts.
- All exercise disclosures are buttons with `aria-expanded` and `aria-controls`.
- After an exception-to-source jump, expand the target first, then focus its heading without hiding it beneath sticky UI.
- Planned and actual values use semantic `dl` or an accessible table on desktop; DOM reading order remains `По плану` then `Выполнено` for each set.
- Status is conveyed with text and icon, never color alone.
- Success and failure use separate polite/assertive `aria-live` regions as appropriate.
- After submit success, focus the receipt heading; after error, focus the error summary.
- Loading does not repeatedly announce every skeleton; use one concise status.
- Respect `prefers-reduced-motion`; scrolling/focus transitions become immediate.
- Long comments preserve line breaks and do not trap keyboard focus.

### Drawer

- `SheetTitle` names athlete and purpose; description identifies workout and completion time.
- Focus enters at the close/title region, remains contained and returns to the exact trigger.
- Escape closes the Drawer unless a nested confirmation is active; preview-only v1 has no unsaved draft warning.
- Background content is inert to keyboard and screen readers while open.
- Mobile screen-reader order matches visual order: identity, reason, exceptions, availability, comments, Full Page action.
- Close and Full Page controls have accessible names and at least 44 px targets.
- The Session copy control names the full value without forcing the raw UUID into the visual heading.

### Responsive and input

- No action depends on hover.
- At 200% zoom, content reflows to one column.
- No document-level horizontal scroll at `390 x 844`.
- Virtual keyboard does not cover textarea, validation or submit controls.
- Touch targets are at least 44 px in both dimensions.

## 23. Component reuse map

| Existing component/module | Decision | R2B design use |
| --- | --- | --- |
| `CanonicalWorkoutReview` | Adapt | Keep as production Full Page shell; simplify repeated header and compose canonical sections |
| `ReviewSessionSummary` | Adapt then share | Replace demo-shaped model and metric cards with compact canonical facts/availability |
| `ReviewSignals` | Adapt then share | Become factual exception index linked to source rows; remove unsupported positive conclusions |
| `ReviewClientComment` | Adapt then share | Render structured source comments; never flatten all set comments into one canonical value |
| `ReviewExerciseList` | Adapt then share | Preserve stable IDs, planned/actual dimensions, source comments and disclosure behavior |
| private `CanonicalFeedbackPanel` | Extract to production shared | Full Page only in preview-only release; owns canonical command states |
| `ReviewCompletionReceipt` | Extract to production shared | Replace action panel after persistence; use R2A.3 destinations |
| `WorkoutReviewDrawer` Sheet shell | Keep shell, rewrite composition later | Canonical preview-only shell with narrower desktop width and no commands |
| `ReviewFeedbackPanel` | Leave demo-only | Contains local workflow and fake AI path; not production reusable as-is |
| `review-store` / `useReviewWorkflow` | Leave demo-only, remove later after import audit | Must not provide production draft, feedback or resolution state |
| `review-model.ts` seeds | Leave demo-only, remove later after import audit | Unsupported facts and synthetic IDs are not canonical evidence |
| `TrainerWorkflowTransitionService` | Reuse unchanged | Source, return, next-item, all-calm and safe fallback contract |

Target presentation composition:

```text
CanonicalWorkoutReview
  CanonicalReviewContextHeader
  CanonicalReviewAvailability
  CanonicalReviewSummary
  CanonicalReviewExceptions
  CanonicalReviewExerciseResults
  CanonicalReviewSessionContext
  CanonicalReviewActionPanel
  CanonicalReviewCompletionReceipt

CanonicalReviewPreviewDrawer
  CanonicalReviewPreviewHeader
  CanonicalReviewPreviewExceptions
  CanonicalReviewAvailabilitySummary
  CanonicalReviewPreviewComments
  FullPageReviewLink
```

Page and Drawer may share pure factual presenters and availability copy. They do not share command-enabled composition in preview-only v1.

## 24. Keep / change / remove

### Keep

- canonical Full Page route and exact Session linkage;
- two-column desktop work pattern;
- R2A.3 transition and receipt destinations;
- existing feedback/acknowledgement/follow-up/manual command boundaries;
- sticky action concept with bounded behavior;
- immutable existing-feedback timeline;
- explicit profile and queue destinations;
- Sheet primitive and focus-management foundation.

### Change during implementation

- replace production projection into demo `WorkoutReviewDetails` with canonical view projectors;
- make context header compact and remove repeated high-prominence titles/actions;
- replace metric-card grid with a dense factual summary;
- make exceptions source-linked and neutral;
- expand planned/actual to reps, duration, load and RPE without invented zeros;
- distinguish known empty, unsupported, unavailable and partial data;
- separate manual resolution from primary submit;
- make receipt replace the action panel;
- narrow and simplify Drawer to preview-only;
- make normal Dashboard/Profile interaction continue directly to Full Page;
- remove AI and unsupported discomfort conclusions from production presentation.

### Remove from the R2B production target

- Drawer feedback textarea and acknowledgement controls;
- Drawer manual resolution and local close callbacks;
- Drawer follow-up controls;
- fake AI draft and AI status;
- synthetic queue position;
- hard-coded `hasDiscomfort: false`;
- local/synthetic feedback IDs and resolution state;
- mixed visible `Plan vs actual` terminology;
- duplicated large review hero;
- per-metric large cards that create dashboard-like visual noise.

Demo/legacy files are not deleted in the design stage. Later removal requires a separate production import audit.

## 25. Acceptance criteria

### Comprehension

1. Within the first viewport, a trainer can identify athlete, workout, completion time, Attention reason, key exceptions and current action.
2. A trainer can distinguish plan, actual result, skipped, incomplete and missing log without relying on color.
3. Unsupported discomfort/session context is never described as an empty athlete response.
4. The Full Page does not resemble an athlete-profile hero or analytics dashboard.

### Workflow

5. Dashboard and Profile default actions open Full Page directly.
6. Preview Drawer opens only from an explicit preview control and has no domain command.
7. Opening/closing Drawer or Full Page does not resolve Attention.
8. Detailed feedback and acknowledgement use one visible action mode at a time.
9. Manual resolution is secondary, reasoned and confirmed.
10. Follow-up adds an immutable linked response and does not reopen Attention.
11. Retry preserves one logical idempotency key and does not duplicate feedback.
12. Completion receipt replaces the action form and provides server destinations.
13. Return/revalidation failure cannot make a persisted command appear failed.

### Data integrity

14. The same exact Session ID and R2A.3 flow reach Drawer and Full Page.
15. Planned/actual rows preserve stable source identity.
16. Null actual values are not shown as zero.
17. Partial, unsupported and unavailable sources remain explicit.
18. No production UI imports demo selectors, runtime command store or review seeds.
19. No AI, Program, Progress or Motivation fact enters the Review.

### Responsive and accessibility

20. Desktop `1440 x 1024` shows exceptions and usable action panel in the first viewport.
21. Mobile `390 x 844` completes the full review without horizontal document overflow.
22. Planned/actual remains understandable in screen-reader order and on mobile.
23. Drawer focus is contained and restored; all controls are keyboard accessible.
24. Submit success/error and disclosure changes have deterministic focus behavior.
25. Tap targets meet 44 px minimum and the virtual keyboard does not cover submit controls.

### Quality gates for later implementation

26. Canonical PostgreSQL tests cover open/resolved, partial/unavailable source, idempotent retry and suspended relation.
27. E2E covers Dashboard -> Full Review -> feedback -> next/queue and Profile -> Full Review -> profile.
28. E2E confirms Drawer preview performs no write and preserves Full Page flow context.
29. Long workout, long comments and mobile keyboard states receive visual QA.
30. Existing R1/R2A, lint and production build remain green.

## 26. Open decisions and research hypotheses

### Founder/Product decisions

1. Is explicit preview from the Dashboard queue valuable enough for the first R2B release, or should option C defer Drawer entirely?
2. Should the preview trigger be an eye icon with tooltip `Предпросмотр разбора` or an item overflow-menu command? The design recommends a visible eye icon on desktop and a named menu item on mobile.
3. Which acknowledgement phrases are approved as product copy and should trainers be able to customize their own presets later?
4. Is manual resolution required for the pilot, and which reason taxonomy is acceptable for reporting?
5. What delivery-status promise should the UI make before a safe notification-status projection exists?
6. Should direct authorized Review URLs return to athlete Profile or Dashboard when no valid origin is present? The design recommends Profile when athlete identity is available, otherwise Dashboard.

### Research hypotheses

1. Explicit preview reduces unnecessary Full Page navigation from dense queues without increasing time to feedback.
2. A `520px` desktop Drawer is sufficient for three exceptions, availability and comments; wider Drawer starts to duplicate the Full Page.
3. Keeping exceptions and the action panel in the first desktop viewport reduces review completion time.
4. Default-collapsing exercises without exceptions reduces scanning load while retaining full evidence.
5. The architecture thresholds of 4 exercises, 16 sets, 1 deviation and 300 comment characters may later help classify a command-enabled compact review, but they are not used in preview-only R2B.
6. A two-column desktop layout performs better than one column for long sessions; this should be checked with trainer task observation rather than aesthetic preference alone.

### Dependencies before command-enabled Drawer

- canonical structured discomfort/session-context decision and write path, or an explicit accepted limitation;
- shared canonical action controller and receipt;
- validated complexity classifier;
- production pilot evidence that an additional command surface improves the core loop;
- explicit founder decision to widen the Drawer boundary.

### Change-boundary confirmation

This design task creates only:

- `docs/workout-review-r2b-design-v1.md`

It does not change application code, UI, routes, API handlers, R2A.3 behavior, PostgreSQL schema, migrations, demo data, configuration or tests. No production Drawer connection and no commit are included.
