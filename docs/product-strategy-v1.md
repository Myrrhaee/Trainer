# Product Strategy V1

Дата: 2026-07-10  
Статус: working strategy, not validated user research

## 1. Product Summary

AI Strength Coach - рабочая система для самостоятельного онлайн- или гибридного персонального тренера, который ведет примерно 10-30 активных клиентов и лично отвечает за планы, назначения, проверку тренировок, прогресс и коммуникацию.

Первая MVP-гипотеза: продукт должен не быть широкой CRM, а помогать тренеру каждый день понимать, кто требует внимания, почему, что нужно сделать дальше и закрыта ли ситуация после действия.

## 2. Product Vision

Создать единое рабочее пространство, где тренер видит состояние клиентов, назначает тренировочную работу, разбирает результаты и поддерживает общий контекст с клиентом без постоянного переключения между мессенджерами, таблицами, заметками и памятью.

Долгосрочно продукт может стать операционной системой персонального тренера. Для первого MVP фокус уже: один связанный цикл от назначения тренировки до обратной связи и обновления истории.

## 3. Primary Customer

Первичный пользователь - самостоятельный онлайн- или гибридный персональный тренер.

Рабочий профиль:

- ведет примерно 10-30 активных клиентов;
- сам создает тренировочные планы и шаблоны;
- назначает тренировки конкретным клиентам;
- проверяет выполненные тренировки;
- корректирует нагрузку;
- следит за прогрессом;
- общается с клиентами лично.

Evidence status: product hypothesis, founder decision. Требует проверки интервью и beta-использованием.

## 4. Secondary User

Вторичный пользователь - клиент или спортсмен тренера.

Для MVP клиент не является самостоятельным покупателем продукта. Его задача - увидеть назначенную тренировку, выполнить ее, записать результаты, оставить комментарий, получить feedback и видеть историю/progress в той же тренировочной реальности, которую видит тренер.

Evidence status: product hypothesis, code evidence for existing client screens, requires user research.

## 5. Problem Statement

Данные и коммуникация у тренера распределены между:

- мессенджерами;
- заметками;
- таблицами;
- памятью тренера;
- фитнес-приложениями;
- отдельными CRM или payment tools.

Из-за этого тренер не всегда понимает:

- кому сейчас требуется внимание;
- что именно произошло;
- насколько это срочно;
- какое действие нужно сделать;
- закрыта ли ситуация после действия.

Evidence status: founder decision, product hypothesis. Требует пользовательской проверки.

## 6. Existing Alternatives

| Alternative | Почему используется | Что ломается для тренера |
| --- | --- | --- |
| Мессенджеры | Быстро, привычно, клиент уже там | Контекст теряется, результаты и решения уходят в переписку |
| Таблицы | Гибко, дешево, можно настроить под себя | Нет workflow, сложно видеть срочность и историю действий |
| Заметки | Быстро фиксировать мысли | Нет структуры, нет общей реальности с клиентом |
| Обычные фитнес-трекеры | Клиент может записывать тренировки | Тренеру часто не хватает рабочего слоя проверки и назначения |
| Отдельные CRM | Есть списки клиентов и статусы | Риск ощущения CRM вместо работы с человеком; слабая связь с тренировочной логикой |

Evidence status: product hypothesis, requires user research.

## 7. Value Proposition

AI Strength Coach показывает тренеру, какой клиент требует внимания, объясняет причину и помогает выполнить следующее действие.

В MVP ценность должна проявляться в одном цикле:

```text
назначение -> выполнение -> сигнал на разбор -> feedback -> следующий шаг -> закрытие
```

Evidence status: founder decision, product hypothesis.

## 8. Core Product Principles

Короткая версия принципов:

- тренер работает с человеком, а не с CRM-записью;
- каждый сигнал должен вести к действию;
- клиент и тренер видят одну тренировочную реальность;
- dashboard тренера - очередь решений, а не отчет;
- профиль спортсмена - контекстное рабочее пространство;
- AI предлагает и объясняет, но тренер принимает решение;
- сначала связанный вертикальный сценарий, затем ширина функциональности.
- существование UI-прототипа не является доказательством продуктовой готовности.

Полная версия зафиксирована в `docs/product-principles-v1.md`.

Evidence status: founder decision, product hypothesis.

## 9. Central Workflow

```text
Тренер создает или выбирает шаблон тренировки
-> назначает тренировку клиенту
-> клиент выполняет тренировку
-> создается AttentionItem на разбор
-> тренер открывает результаты
-> отправляет обратную связь
-> при необходимости назначает следующую тренировку
-> AttentionItem закрывается
-> клиент видит обратную связь
-> история и прогресс обновляются у обеих сторон
```

`AttentionItem` - центральная доменная сущность тренерского MVP. Пользовательское название еще не принято. Допустимые рабочие формулировки: "Требует внимания", "Очередь", "Нужно разобрать", "Следующие действия".

Evidence status: founder decision for centrality, product hypothesis for final UX naming.

## 10. Role Of AI

### Где AI потенциально создает ценность

- группирует события клиента в понятную очередь;
- объясняет, почему клиент требует внимания;
- предлагает next action;
- помогает сформулировать feedback;
- summarizes completed workout, identifies relevant deviations and client comments, and prepares an editable feedback draft;
- подсвечивает риск перегруза, пропусков или стагнации;
- помогает тренеру быстрее пересобрать следующую тренировку на основе результата.

### Где AI нельзя делать обязательной зависимостью MVP

- создание WorkoutTemplate;
- назначение WorkoutAssignment;
- запись WorkoutSession клиентом;
- сохранение WorkoutLog;
- отправка feedback;
- закрытие AttentionItem;
- базовая история и прогресс.

MVP должен работать как ручной workflow даже без AI. AI может ускорять и объяснять, но не должен быть единственной причиной, почему сценарий вообще работает.

### Какие решения подтверждает тренер

- финальный feedback клиенту;
- изменение нагрузки;
- назначение следующей тренировки;
- закрытие спорного события;
- изменение программы или цели клиента.

First AI capability hypothesis: AI summarizes the completed workout, identifies relevant deviations and client comments, and prepares an editable feedback draft. Trainer reviews and confirms the result. Autonomous load adjustment and workout prescription are not part of the first AI capability.

Evidence status: founder decision for human-in-the-loop, product hypothesis for AI value areas.

## 11. Differentiation

Главное отличие от CRM: продукт начинается не с карточки сделки, а с тренировочного события и состояния человека.

Главное отличие от фитнес-трекера: клиентская запись результатов сразу превращается в рабочее действие для тренера.

Главное отличие от таблиц: система должна хранить не только данные, но и состояние цикла: назначено, выполнено, требует разбора, feedback отправлен, закрыто.

Evidence status: product hypothesis, requires competitor/user research.

## 12. Product Risks

| Risk | Почему опасно | Mitigation |
| --- | --- | --- |
| Слишком широкий MVP | Команда утонет в automation, reports, sales и achievements | Держать вертикальный цикл как единственный обязательный scope |
| CRM-ощущение | Тренер теряет ощущение живого профиля спортсмена | Профиль должен показывать человека и рабочий контекст, а не только статусы |
| Две версии данных | Клиент и тренер видят разные тренировки/progress | Единые сущности WorkoutAssignment, WorkoutSession, WorkoutLog |
| AI как обязательная магия | MVP становится нестабильным и трудно проверяемым | Все ключевые действия должны иметь ручной путь |
| Demo UI диктует модель | Визуальные макеты закрепят неправильные сущности | Доменную модель фиксировать отдельно от demo components |
| Prototype-completeness illusion | Визуально собранный экран может восприниматься как почти готовая функция, хотя сценарий, доменная модель, состояния и backend-контракт еще не утверждены | Отделять prototype evidence от accepted product UX; не подключать production backend к непрошедшему redesign flow |

Evidence status: code evidence for many prototype surfaces, product hypothesis for risk severity.

## 13. Working Assumptions

- Тренеру важнее очередь решений, чем широкий аналитический dashboard.
- Первым core loop должен быть workout assignment and review.
- Клиентский кабинет нужен не как отдельный продукт, а как источник и отображение общей тренировочной реальности.
- Program может быть отложен, если WorkoutTemplate -> WorkoutAssignment -> WorkoutSession закрывает первый сценарий.
- Automation, insights, reports и sales не должны входить в первую MVP-навигацию.
- Current Workout Builder is technical/visual prototype only; reusable components can be evaluated separately, but current screen composition is not accepted target UX.
- Primary beta customer hypothesis is an independent personal strength coach working online or hybrid with approximately 10-30 active one-to-one clients in strength training, hypertrophy or general fitness.
- Payer model hypothesis: trainer pays for the product; client access is included in coaching.
- Client without trainer is not a primary first-MVP scenario; existing standalone client UI is preserved as future opportunity.
- For first beta, each completed assigned workout creates a review AttentionItem.
- Trainer feedback must be stored inside the product; external messengers may later deliver notifications or links but are not the system of record.
- Full automatic payments are not an MVP blocker; beta may use manual access, invitation-only onboarding, simple access status and optional expiration date.

Evidence status: proposed working hypotheses, requires user research and implementation validation.

## 14. Open Questions

Подробный список вопросов вынесен в `docs/founder-open-questions.md`.

Ключевые:

- точный сегмент первого beta-тренера;
- платит тренер, клиент или оба;
- является ли клиент без тренера отдельным сценарием;
- насколько коммуникация должна жить внутри продукта в MVP;
- какой уровень AI допустим в первой beta;
- как много achievements нужно оставить в первой версии.

Evidence status: requires founder decision and user research.

## 15. Evidence Status Index

| Key assertion | Evidence status | Evidence |
| --- | --- | --- |
| Checkpoint state fixed before MVP stabilization | code evidence, founder decision | `checkpoint/pre-mvp-core-2026-07-10`, commit `ec4a69c757620670d4996b0e910346080512215f`, tag `pre-mvp-core-2026-07-10` |
| `/trainer/dashboard` is canonical trainer home | founder decision | Accepted in current strategy request |
| `/dashboard/*` is legacy | founder decision | Accepted in current strategy request |
| `/client/me` is canonical client home | founder decision, code evidence | Accepted in current strategy request; existing redirect documented in `docs/decision-log.md` |
| `app/(client)/*` is legacy/prototype layer | founder decision | Accepted in current strategy request |
| AttentionItem is central MVP entity | founder decision, product hypothesis | Accepted as working MVP frame; final UX naming not accepted |
| Primary beta customer is independent personal strength coach with 10-30 one-to-one clients | product hypothesis | Needs interviews and beta validation; excludes group fitness, rehabilitation, professional teams, club management and mass course sales for first ICP |
| Core workflow is assignment -> completion -> review -> feedback -> close | product hypothesis, founder decision | Current strategy request |
| AI assists but trainer decides | founder decision, product hypothesis | Current strategy request |
| Programs are not required for first vertical MVP | founder decision | Current strategy request |
| Automation/insights/reports/sales are experimental for MVP | founder decision | Current strategy request |
| Existing mock/demo UI is not production truth | code evidence, existing project document | `docs/current-product-state.md`, `docs/data-source-matrix.md` |
| Current Workout Builder is not target product UX | founder decision, code evidence | Accepted in corrective strategy pass; implementation exists but requires full UX redesign before production backend integration |
| Each completed assigned workout creates a review AttentionItem in first beta | founder decision | Accepted in corrective strategy pass |
| Trainer feedback is stored inside the product | founder decision | Accepted in corrective strategy pass |
| First AI capability is workout summary/deviation/comment extraction plus editable feedback draft | product hypothesis | Requires validation; trainer confirmation remains required |
| Automatic payments are not a first-MVP blocker | founder decision | Accepted in corrective strategy pass |
