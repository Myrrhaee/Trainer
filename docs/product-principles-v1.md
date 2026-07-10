# Product Principles V1

Дата: 2026-07-10  
Статус: accepted principles for MVP strategy

## Principles

| # | Principle | Значение | Положительный пример | Отрицательный пример | Влияние на UX | Влияние на архитектуру | Критерий проверки |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Тренер работает с человеком, а не с CRM-записью | Профиль клиента должен ощущаться как профиль спортсмена с контекстом жизни и тренировок | Hero профиля показывает человека, цель, статус, историю и рабочий контекст | Верх экрана выглядит как карточка сделки с десятком KPI | Меньше CRM-визуала, больше человеческого контекста | Client domain не должен сводиться к sales lead | Открыв профиль, тренер понимает "кто это", а не только "какой статус" |
| 2 | Каждый сигнал должен вести к понятному действию | AttentionItem существует ради next action | "Клиент завершил тренировку, нужно разобрать результаты" ведет в review | "Клиент активен" без action и причины | Очередь должна показывать reason + action | AttentionItem хранит source, reason, status, action type | У каждого active item есть следующий шаг |
| 3 | Клиентский и тренерский кабинеты показывают одну тренировочную реальность | Нет двух разных версий workouts/progress | Клиентский WorkoutLog сразу виден в trainer review | У клиента одни графики, у тренера другие несвязанные mock-графики | UI может отличаться, данные нет | Shared entities: Assignment, Session, Log, Feedback | Одно действие клиента меняет оба кабинета |
| 4 | Тренер получает дополнительный рабочий слой, но не отдельную версию данных | Trainer view добавляет review, notes, decisions, но не копирует данные | Тренер видит комментарии, отклонения, feedback controls поверх session | Создать отдельный trainer-only progress без связи с client logs | Trainer UI богаче, но согласован | Avoid duplicated domain models for client/trainer | Один источник правды для workout/session/progress |
| 5 | Dashboard - не отчет, а очередь решений | Главная тренера должна отвечать "что сделать сейчас" | Dashboard показывает AttentionItems по срочности | Dashboard превращается в красивую analytics wall | Сканируемость выше декоративности | Dashboard queries active operational state | За 30 секунд тренер выбирает первый action |
| 6 | Профиль спортсмена - контекстное рабочее пространство | Профиль нужен и для знакомства, и для действия | Overview показывает человека, tabs дают training/progress/management | Все действия размазаны по отдельным независимым страницам | Profile combines context and task entry points | Client profile composes shared entities | Из профиля можно перейти к ключевым actions |
| 7 | AI предлагает и объясняет, но тренер принимает решение | AI не заменяет ответственность тренера | AI suggests feedback draft, trainer edits/sends | AI автоматически меняет нагрузку и пишет клиенту без подтверждения | AI UI должен иметь confirm/edit | AI output is suggestion, not source of truth | Critical changes require trainer confirmation |
| 8 | Не добавлять новый раздел, если он не усиливает основной цикл | Navigation должна оставаться узкой | Добавить Templates, если ускоряет assignment | Добавить Sales, пока нет payment workflow | Primary nav короткая | Experimental routes isolated | Каждый nav item связан с core loop |
| 9 | Сначала полностью связанный сценарий, затем ширина функциональности | Вертикальная целостность важнее количества экранов | One client can complete full cycle end-to-end | 12 красивых страниц без persistence между ними | Fewer screens, deeper flow | Backend supports full lifecycle first | Assignment -> feedback -> close работает полностью |
| 10 | Demo UI не должен определять доменную модель | Красивый mock не равен architecture decision | Модель фиксируется как entities and transitions | Перенести random mock fields в schema | UI can inspire, not dictate | Domain model documented separately | Schema decisions trace to workflow, not visual card |
| 11 | Визуальная премиальность не должна ухудшать скорость работы | Дизайн должен помогать тренеру работать быстро | Compact headers, clear hierarchy, stable controls | Перегруженный hero, из-за которого action уезжает ниже первого экрана | Calm, premium, scannable | Components support dense operational states | Trainer finds action without hunting |
| 12 | Система должна поддерживать последовательность между действиями тренера и клиента | Каждое действие меняет состояние цикла | Feedback closes review item and appears to client | Тренер отправил feedback, но item остался active | Status transitions visible | State machine or explicit status fields | Нет orphan states after completed actions |
| 13 | Prototype is evidence, not a product decision | Прототип помогает обсуждать продукт, но не становится целевым UX автоматически | Отдельные компоненты builder переиспользуются после проектирования нового flow | Backend-модель строится вокруг текущего макета только потому, что он уже написан | Prototype screens should be labeled by readiness and not over-promoted in navigation | Backend contracts follow accepted workflow and domain model, not accidental UI composition | Before backend integration, the flow has accepted IA, states, entities and acceptance criteria |

## Review Cadence

Эти принципы нужно пересматривать после:

- первой end-to-end beta;
- выбора production backend model;
- первых 5-10 интервью с тренерами;
- первого решения о monetization.
