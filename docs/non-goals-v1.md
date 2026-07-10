# Non-Goals V1

Дата: 2026-07-10  
Статус: accepted MVP boundaries unless superseded by founder decision

## Purpose

Этот документ защищает первый MVP от расползания scope. Non-goal не означает "никогда". Это означает: не блокирует первый вертикальный сценарий `assignment -> completion -> review -> feedback -> close`.

## Non-Goals

| Non-goal | Почему не входит в MVP | Риск ранней реализации | Условия возврата в roadmap | Что делать с текущим кодом/экраном |
| --- | --- | --- | --- | --- |
| Маркетплейс тренеров | Первый покупатель - самостоятельный тренер, а не клиент, выбирающий тренера | Сместит фокус на acquisition, profiles, search и trust mechanics | После доказанного спроса со стороны клиентов или B2C motion | preserve, revisit later |
| Управление фитнес-клубом | MVP не про клубную операционку и администраторов | Потребуются роли, филиалы, расписания, сотрудники | Если целевой сегмент сменится на studios/gyms | legacy or revisit later |
| Команды и несколько тренеров в одной организации | Первичный сценарий - один тренер и его клиенты | Сложные permissions, ownership, handoff | После работающего single-trainer workflow | preserve concepts, revisit later |
| Массовая продажа курсов | Core loop - персональное назначение и разбор | Продукт станет course platform вместо coaching OS | Если появится validated creator/course segment | hide from navigation, revisit later |
| Полноценная CRM продаж | MVP решает внимание и тренировочный workflow, не pipeline продаж | CRM-ощущение, перегруз dashboard | Когда появятся реальные sales jobs у тренера | experimental / sales route hidden |
| Продвинутая финансовая отчетность | Не нужна для первого workout loop | Payment ledger отвлечет backend и UI | После выбора бизнес-модели и payment provider | experimental, revisit later |
| Full automatic payments and subscription workflow | Автоматические платежи не являются blocker первого MVP; beta может работать через manual access, invitation-only onboarding, simple access status и optional expiration date | Платежная инфраструктура отвлечет от проверки core workflow | После validation assignment -> review -> feedback loop или для paid pilot | preserve existing API/webhook work, revisit after core workflow |
| Standalone client product without trainer | Первый MVP строится вокруг тренера и его клиентов | Продукт превратится в отдельный B2C fitness app с другими задачами | Если появится отдельная validated B2C strategy | preserve existing standalone client UI / future opportunity |
| Полностью автономный AI-тренер | Принцип MVP: тренер принимает решения | Юридические/качество/доверие риски, потеря human-in-loop | Только как отдельный продуктовый трек после проверки | do not build for MVP |
| Глубокая автоматизация | Первый MVP должен быть ручным и проверяемым | Автоматизация закрепит неверные правила до user research | Когда repeated manual actions доказаны usage data | experimental / hide from navigation |
| Сложные AI-insights | Core value - next action, не аналитический центр | Много недоказанных интерпретаций и false confidence | После накопления реальных WorkoutLog/Session data | experimental / hide from navigation |
| Социальная сеть спортсменов | Не связана с тренерским операционным циклом | Уводит в engagement, moderation, feeds | Только при отдельной стратегии community | do not build for MVP |
| Отдельный развитый календарный модуль | Календарь полезен, но не должен стать центром MVP | Сложная scheduling logic до стабилизации assignments | Когда due dates и adherence требуют calendar UX | preserve prototype, revisit later |
| Advanced multi-week Program Builder | Сначала должен быть полностью принят и реализован flow отдельного WorkoutTemplate и WorkoutAssignment | Сложная программная архитектура может закрепить неверный builder UX до проверки core loop | После принятого simple WorkoutTemplate Builder и работающего end-to-end assignment/review workflow | preserve / prototype / revisit after core workflow |
| Сложные ranks, titles и achievements | Мотивация важна, но не закрывает core loop | Может подменить тренировочную ценность геймификацией | После стабильной истории и progress данных | preserve assets, hide complexity |
| Advanced reports | Reports не нужны для ежедневного review loop | Съедят время на аналитику и PDF/export | После beta-запросов на отчетность | experimental / hide from navigation |
| Отдельный sales-модуль | Sales не часть первого assignment-review цикла | Появится второй продукт внутри продукта | После validated monetization/sales workflow | experimental / hide from navigation |

## Handling Rule

Для существующего кода non-goal зон:

- не удалять в рамках MVP strategy;
- не добавлять в primary navigation;
- не расширять без отдельного founder decision;
- помечать как experimental или legacy в продуктовой матрице;
- возвращать в roadmap только после доказанного влияния на core loop или бизнес-модель.
