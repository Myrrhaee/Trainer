# Current Product State

Дата аудита: 2026-07-10  
Метод: evidence-based review по реальному коду, маршрутам, импортам, миграциям, `npm run lint`, `npm run build`, `git status`.  
Ограничение: runtime/browser QA не выполнялся в рамках этого документа; выводы о "работает" означают "есть кодовый путь и сборка проходит", а не подтверждение через клики.

## Status Legend

| Статус | Значение |
| --- | --- |
| concept | Описано в документах или типах, но нет полноценного runtime-flow. |
| visual prototype | Экран/компонент визуально собран, данные в основном inline/mock/local state. |
| demo-backed | Работает через `lib/demo-data.ts`, `components/demo/*` или `lib/demo-mode.ts`. |
| partially Supabase-backed | Есть Supabase/API path, но есть mock/local fallback или не все workflow связаны. |
| production-backed | Не обнаружено убедительного полного production-flow без mock/local fallback. |
| legacy | Старый route/экран, который дублирует новую зону или живет в `(admin)`/`(client)`. |
| unknown | Недостаточно данных по коду. |

## 1. Public И Auth

**Назначение:** публичный вход в продукт, landing, login/signup, публичная карточка тренера.

**Основные маршруты:**

- `/` -> `app/page.tsx`
- `/landing` -> `app/landing/page.tsx`
- `/login` -> `app/login/page.tsx`
- `/signup` -> `app/signup/page.tsx`
- `/trainers` -> `app/trainers/page.tsx`
- `/t/[slug]` -> `app/t/[slug]/page.tsx`
- `/support`, `/terms`

**Основные компоненты:**

- `components/landing/landing-page.tsx`
- `app/trainers/TrainersCatalogClient.tsx`
- `lib/auth-context.tsx`
- `lib/demo-mode.ts`
- `lib/supabase-client.ts`

**Текущий статус:** partially Supabase-backed.

**Что реально работает по коду:**

- Login выбирает роль через `role` search param и переключатель роли: `app/login/page.tsx:31-75`.
- Demo login существует через `isDemoModeEnabled`, `resolveDemoLogin`, `writeDemoSession`: `app/login/page.tsx:11-15`, `app/login/page.tsx:136-155`, `lib/demo-mode.ts:26-110`.
- Supabase login/signup вызывает `supabase.auth.signUp` и `supabase.auth.signInWithPassword`: `app/login/page.tsx:174-177`, `app/login/page.tsx:205-208`.
- `ensure-profile` вызывается при регистрации/синхронизации профиля: `app/login/page.tsx:85-103`, `app/login/page.tsx:236-260`.
- Invite-link клиента к тренеру поддержан через `/api/link-trainer`: `app/login/page.tsx:109-122`, `app/login/page.tsx:265-276`.
- Public trainer page читает `profiles` по slug: `app/t/[slug]/page.tsx:25-39`.
- Trainers catalog читает `profiles`: `app/trainers/TrainersCatalogClient.tsx:35-37`.

**Что не работает / риск:**

- Trainer redirects в login ведут на legacy `/dashboard`, а не на новый `/trainer/dashboard`: `app/login/page.tsx:155`, `app/login/page.tsx:196`, `app/login/page.tsx:284`, `app/login/page.tsx:289`.
- Proxy защищает только `/dashboard/:path*` и `/api/notify-complete`; `/trainer/*` и `/client/*` не покрыты proxy: `proxy.ts:42-44`.
- Auth logic частично на уровне отдельных страниц (`router.replace("/login?role=client")`), частично в proxy, единой стратегии нет.

**Основные зависимости:**

- Supabase client/server: `lib/supabase-client.ts`, `lib/supabase-admin.ts`, `proxy.ts`.
- Demo mode: `lib/demo-mode.ts`.
- API: `/api/ensure-profile`, `/api/link-trainer`, `/api/seed-test-users`.

**Технические риски:**

- Несогласованные redirect targets создают конфликт нового и legacy тренерского кабинета.
- `proxy.ts` не защищает новые canonical-candidate зоны.
- `app/login/page.tsx` содержит много auth-flow в одном client component.

## 2. Клиентский Кабинет

**Назначение:** домашний экран клиента, тренировки, прогресс, активность, библиотека, настройки.

**Основные маршруты:**

- New client namespace: `/client/me`, `/client/dashboard`, `/client/workouts`, `/client/progress`, `/client/activity`, `/client/library`, `/client/settings`.
- Legacy/client group: `/client/[id]`, `/client/[id]/program/[programId]`, `/check-in`, `/history`, `/profile`, `/programs`, `/today`, `/today/select`, `/workout/free`, `/explore`, `/explore/[id]`.

**Основные компоненты:**

- `components/demo/demo-client-cabinet.tsx`
- `components/client/WeightTracker.tsx`
- `components/client-nav.tsx`
- `components/client/mobile-cabinet-nav.tsx`
- `components/client/ShareCard.tsx`
- `src/features/client-dashboard/components/*`
- `src/features/execution/components/ClientMiniAnalyticsCard`

**Текущий статус:** mixed: `/client/me` partially Supabase-backed + demo-backed; `/client/workouts`, `/client/progress`, `/client/activity`, `/client/library` mostly demo-backed; `(client)` routes are partially Supabase-backed legacy.

**Что реально работает по коду:**

- `/client/me` в demo mode рендерит `DemoClientMePage`; иначе грузит Supabase данные: `app/client/me/page.tsx:27-41`, `app/client/me/page.tsx:431-436`, `app/client/me/page.tsx:1422-1472`.
- `/client/dashboard` является redirect shim на `/client/me`: `app/client/dashboard/page.tsx:7-21`.
- `/client/workouts` в demo mode показывает `DemoClientWorkoutsPage`, иначе redirect на `/today`: `app/client/workouts/page.tsx:3-11`.
- `/client/progress` в demo mode показывает `DemoClientProgressPage`, иначе redirect на `/history`: `app/client/progress/page.tsx:3-11`.
- `/client/activity` в demo mode показывает `DemoClientActivityPage`, иначе redirect на `/history`: `app/client/activity/page.tsx:3-11`.
- `/client/library` в demo mode показывает `DemoClientLibraryPage`, иначе placeholder: `app/client/library/page.tsx:1-13`.
- `/client/settings` в demo mode показывает demo settings, иначе работает с `profiles`: `app/client/settings/page.tsx:7-15`, `app/client/settings/page.tsx:52-58`, `app/client/settings/page.tsx:89-117`.
- Legacy `/client/[id]` читает `profiles`, `trainer_clients`, `assigned_programs`, `client_programs`, `workout_templates`, `workout_logs` и пишет `workout_logs`: `app/(client)/client/[id]/page.tsx:205-275`, `app/(client)/client/[id]/page.tsx:331-551`.

**Что не работает / риск:**

- `/client/workouts`, `/client/progress`, `/client/activity` в non-demo режиме не являются самостоятельными экранами, а redirect-ят в legacy routes.
- `/client/library` в non-demo режиме показывает placeholder.
- `app/client/*` и `app/(client)/*` дублируют задачи и требуют canonical decision.
- Есть client-side `Date.now()`/`new Date()`/Recharts usage, что нужно проверять на hydration/layout issues: `app/client/me/page.tsx:1414`, `app/client/me/page.tsx:1942-1980`.

**Основные зависимости:**

- Demo: `components/demo/demo-client-cabinet.tsx`, `lib/demo-data.ts`.
- Supabase tables: `profiles`, `workout_logs`, `trainer_workout_reviews`, `assigned_programs`, `client_programs`, `workout_templates`, `weight_logs`.
- Exercise library: `lib/exercise-library.ts`.

**Технические риски:**

- Раздвоение клиентских routes.
- Demo UI является качественным эталоном, но не все demo screens имеют real-data equivalent.
- Риск рассинхрона client progress vs trainer-side progress.

## 3. Тренерский Кабинет

**Назначение:** рабочая ОС тренера: команда, клиенты, действия, назначения, библиотека, сообщения, отчеты и настройки.

**Основные маршруты:**

- `/trainer/dashboard`
- `/trainer/attention`
- `/trainer/clients`
- `/trainer/clients/[clientId]`
- `/trainer/builder`
- `/trainer/programs`
- `/trainer/calendar`
- `/trainer/library`
- `/trainer/messages`
- `/trainer/review/[workoutId]`
- `/trainer/automation`
- `/trainer/insights`
- `/trainer/reports`
- `/trainer/sales`
- `/trainer/settings`

**Основные компоненты:**

- `components/trainer/trainer-shell.tsx`
- `components/trainer-os/home/*`
- `components/trainer-os/dashboard/*`
- `components/trainer-os/quick-assign/quick-assign-drawer.tsx`
- `components/trainer-os/workout-review/workout-review-drawer.tsx`

**Текущий статус:** mixed: visual prototype + demo-backed + partially Supabase-backed.

**Что реально работает по коду:**

- `/trainer/dashboard` рендерит `TrainerHomePage`: `app/trainer/dashboard/page.tsx:1-4`.
- Primary navigation в `TrainerShell` ограничена четырьмя пунктами: dashboard, clients, library, builder: `components/trainer/trainer-shell.tsx:54-59`.
- Command palette содержит больше разделов, включая attention/messages/programs/calendar/automation/insights/reports/sales/settings: `components/trainer/trainer-shell.tsx:82-90` и далее.
- Trainer home использует mock data из `components/trainer-os/home/mock-data.ts`: `components/trainer-os/home/trainer-home-page.tsx:18`, `components/trainer-os/home/mock-data.ts:5-23`.
- `/trainer/clients` смешивает inline demo clients и Supabase loading: imports `isDemoModeEnabled`/`createClient` at `app/trainer/clients/page.tsx:44-48`; inline `demoClients` starts at `app/trainer/clients/page.tsx:109`; Supabase reads at `app/trainer/clients/page.tsx:374-417`, `app/trainer/clients/page.tsx:603-612`.

**Что не работает / риск:**

- New trainer routes are not covered by proxy matcher: `proxy.ts:42-44`.
- `/dashboard/*` legacy still exists and login routes still send trainers there.
- Many trainer screens are UI/local-state only and not persisted.

**Основные зависимости:**

- Mock: `components/trainer-os/home/mock-data.ts`, `components/trainer-os/dashboard/mock-data.ts`.
- Supabase: `profiles`, `workout_logs`, `trainer_workout_reviews`, `assigned_programs`.
- Demo mode: `lib/demo-mode.ts`.

**Технические риски:**

- Нет единой persisted Attention Item model despite multiple screens modeling attention.
- Trainer shell navigation and login redirects disagree about canonical trainer home.
- Большое количество experimental routes в первом слое продукта.

## 4. Профиль Спортсмена Через Тренера

**Назначение:** тренер открывает спортсмена и видит human profile + рабочие вкладки.

**Маршрут:** `/trainer/clients/[clientId]`.

**Основные компоненты:**

- `app/trainer/clients/[clientId]/page.tsx`
- `components/trainer-os/client-profile/client-profile-page.tsx`
- `overview-tab.tsx`, `training-tab.tsx`, `progress-tab.tsx`, `management-tab.tsx`
- `mock-data.ts`, `types.ts`, `reputation-ranks.ts`, `achievement-catalog.ts`

**Текущий статус:** demo-backed / visual prototype.

**Что реально работает по коду:**

- Route рендерит `ClientProfilePage`: `app/trainer/clients/[clientId]/page.tsx:1-4`.
- Данные берутся из `getAthleteProfile(params.clientId)`: `components/trainer-os/client-profile/client-profile-page.tsx:32`, `components/trainer-os/client-profile/client-profile-page.tsx:51-54`.
- Tabs реализованы кастомно с детерминированными ids, без Radix generated ids: `components/trainer-os/client-profile/client-profile-page.tsx:42-49`, `components/trainer-os/client-profile/client-profile-page.tsx:123-160`.
- Header переключается между full/compact state через Framer Motion: `components/trainer-os/client-profile/client-profile-page.tsx:59-66`, `components/trainer-os/client-profile/client-profile-page.tsx:83-108`.
- QuickAssignDrawer и WorkoutReviewDrawer подключены: `components/trainer-os/client-profile/client-profile-page.tsx:28-29`, `components/trainer-os/client-profile/client-profile-page.tsx:167-180`.
- Mock profile содержит membership, calendar events, titles, achievements, photos, measurements, weight trend: `components/trainer-os/client-profile/mock-data.ts:13-23`, `components/trainer-os/client-profile/mock-data.ts:54-83`, `components/trainer-os/client-profile/mock-data.ts:98-182`, `components/trainer-os/client-profile/mock-data.ts:345`, `components/trainer-os/client-profile/mock-data.ts:452-458`.

**Что не работает / риск:**

- Нет Supabase read path для `/trainer/clients/[clientId]`; route всегда использует mock profile.
- Drawer actions close local state, но не видно persistence или task resolution в `client-profile-page.tsx:167-180`.
- Profile data model не синхронизирован с real client tables.

**Основные зависимости:**

- Mock profile: `components/trainer-os/client-profile/mock-data.ts`.
- Rank/catalog: `reputation-ranks.ts`, `achievement-catalog.ts`.
- UI: `framer-motion`, local dialog/sheet components.

**Технические риски:**

- Высокий риск расхождения с real client data.
- Много доменных сущностей в mock, для которых нет подтвержденной DB schema.

## 5. Builder И Templates

**Назначение:** сборка тренировки/шаблона, выбор упражнений, назначение клиенту/дню программы.

**Маршрут:** `/trainer/builder`.

**Основные компоненты:**

- `app/trainer/builder/page.tsx`
- `components/trainer/exercise-library-panel.tsx`
- `components/trainer/exercise-detail-sheet.tsx`
- `components/trainer/workout-exercise-card.tsx`
- `components/trainer/workout-superset-block-card.tsx`

**Текущий статус:** partially Supabase-backed + localStorage fallback + demo-backed.

**Что реально работает по коду:**

- Импортирует demo data, Supabase client, exercise library helpers: `app/trainer/builder/page.tsx:44-63`.
- Локально хранит templates/assignments/draft: `app/trainer/builder/page.tsx:441-473`, `app/trainer/builder/page.tsx:718`, `app/trainer/builder/page.tsx:1428`.
- Supabase reads/writes `trainer_builder_templates`, `profiles`, `workout_templates`: `app/trainer/builder/page.tsx:477-590`.
- Demo mode использует `getDemoLibraryExercises`, `getDemoRosterClients`, `getDemoPrograms`: `app/trainer/builder/page.tsx:639-709`.
- Save to program вызывает `/api/trainer/programs`: `app/trainer/builder/page.tsx:1453-1461`.
- Migration for `trainer_builder_templates` exists with RLS: `supabase/migrations/20260404120000_trainer_builder_templates.sql:1-57`.

**Что не работает / риск:**

- Назначение тренировки хранится в localStorage payload, не видно Supabase assignment table для single workout assignment в builder.
- Builder combines templates, assignments, draft, program patching in one large page.

**Основные зависимости:**

- Supabase tables: `trainer_builder_templates`, `profiles`, `workout_templates`.
- API: `/api/trainer/programs`.
- Demo data and localStorage.

## 6. Programs

**Назначение:** программы тренера, назначения клиентам, упаковка templates в циклы/программы.

**Маршруты:**

- `/trainer/programs`
- legacy `/dashboard/programs`, `/dashboard/programs/[id]`
- client `/programs`, `/programs/[id]`, `/explore`, `/explore/[id]`

**Основные компоненты:**

- `app/trainer/programs/page.tsx`
- `app/api/trainer/programs/route.ts`
- legacy/admin program pages.

**Текущий статус:** partially Supabase-backed + demo-backed + localStorage helper.

**Что реально работает по коду:**

- Trainer programs imports demo and Supabase: `app/trainer/programs/page.tsx:35-44`.
- Local builder template read exists: `app/trainer/programs/page.tsx:325`.
- Demo program builders exist: `app/trainer/programs/page.tsx:404-436`.
- Non-demo reads `workout_templates`, `assigned_programs`, `profiles`: `app/trainer/programs/page.tsx:488-508`.
- API validates bearer auth and trainer role: `app/api/trainer/programs/route.ts:135-168`.
- API writes/patches `workout_templates`: `app/api/trainer/programs/route.ts:190-224`, `app/api/trainer/programs/route.ts:250-335`.

**Что не работает / риск:**

- Programs and builder templates are separate concepts but share overlapping storage/UX.
- Client program access has old `assigned_programs` and `client_programs` paths; canonical access model is unclear.

## 7. Workout Assignment И Completion

**Назначение:** тренер назначает тренировку/программу, клиент выполняет и завершает тренировку.

**Текущий статус:** partially Supabase-backed for client completion; assignment is mixed/local/demo.

**Что реально работает по коду:**

- Client workout route writes `workout_logs`: `app/(client)/client/[id]/page.tsx:551`.
- Completion can call `/api/notify-complete`: `app/(client)/client/[id]/page.tsx:1227`.
- `/api/notify-complete` sends Telegram message after reading profile: `app/api/notify-complete/route.ts:21-46`.
- Client program access checks `assigned_programs` and `client_programs`: `app/(client)/client/[id]/page.tsx:238-275`.
- Builder assignment payload is localStorage-based: `app/trainer/builder/page.tsx:461-473`, `app/trainer/builder/page.tsx:1566`.

**Что не работает / риск:**

- No single canonical `workout_assignments` table was found in migrations.
- Completion notification is Telegram-only and not clearly converted into persisted review task/Attention Item.

## 8. Workout Review

**Назначение:** тренер разбирает выполненную тренировку.

**Маршруты и компоненты:**

- `/trainer/review/[workoutId]`
- `app/trainer/review/[workoutId]/workout-review-client.tsx`
- `components/trainer-os/workout-review/workout-review-drawer.tsx`

**Текущий статус:** visual prototype / demo-backed, with Supabase table existing for another review path.

**Что реально работает по коду:**

- Route passes `workoutId` into client component: `app/trainer/review/[workoutId]/page.tsx:1-10`.
- Review page uses hardcoded `workoutReviews` object and `getDemoLibraryExercises`: `app/trainer/review/[workoutId]/workout-review-client.tsx:27`, `app/trainer/review/[workoutId]/workout-review-client.tsx:119-138`.
- Migration `trainer_workout_reviews` exists with RLS and `mark_trainer_workout_review_seen`: `supabase/migrations/20260403120000_trainer_workout_reviews.sql:1-96`.
- `/client/me` reads trainer workout reviews and calls `mark_trainer_workout_review_seen`: `app/client/me/page.tsx:348-349`, `app/client/me/page.tsx:1622`.

**Что не работает / риск:**

- `/trainer/review/[workoutId]` does not read `trainer_workout_reviews`; it uses demo object.
- Review completion is not clearly persisted from trainer page.

## 9. Progress

**Назначение:** вес, замеры, фото, силовой прогресс, достижения прогресса.

**Маршруты и компоненты:**

- `/client/progress`
- `/trainer/clients/[clientId]` -> Progress tab
- `components/demo/demo-client-cabinet.tsx`
- `components/trainer-os/client-profile/progress-tab.tsx`
- `components/client/WeightTracker.tsx`

**Текущий статус:** client demo-backed; trainer profile demo-backed; some Supabase weight/log data exists in client home/check-in/history.

**Что реально работает по коду:**

- Client `/client/progress` is demo-backed with redirect fallback: `app/client/progress/page.tsx:3-11`.
- Trainer progress tab uses `athlete` mock props and Recharts: `components/trainer-os/client-profile/progress-tab.tsx:1-31`, `components/trainer-os/client-profile/progress-tab.tsx:283-314`, `components/trainer-os/client-profile/progress-tab.tsx:452-483`.
- Client demo progress uses Recharts: `components/demo/demo-client-cabinet.tsx:4495`, `components/demo/demo-client-cabinet.tsx:4945-5064`.
- `weight_logs` table is used by `WeightTracker`, check-in, and client home: `components/client/WeightTracker.tsx:45-131`, `app/(client)/check-in/page.tsx:172-273`, `app/client/me/page.tsx:1461-1463`.

**Что не работает / risk:**

- Build emits Recharts warning: `width(-1)`/`height(-1)` twice during static generation.
- Trainer progress is not reading real `weight_logs` or `workout_logs`.

## 10. Messages

**Назначение:** сообщения тренера и клиента, quick replies, risk dialogs.

**Маршрут:** `/trainer/messages`.

**Текущий статус:** partially Supabase-backed + localStorage fallback + demo mode.

**Что реально работает по коду:**

- Imports Supabase and demo mode: `app/trainer/messages/page.tsx:5-28`.
- Local fallback key exists: `app/trainer/messages/page.tsx:129`.
- Initial inline threads exist: `app/trainer/messages/page.tsx:140-180`.
- Reads from `trainer_client_messages`: `app/trainer/messages/page.tsx:477-479`.
- Updates/creates messages in `trainer_client_messages`: `app/trainer/messages/page.tsx:603-658`.
- Migration exists with RLS for trainer/client read/create: `supabase/migrations/20260406120000_trainer_client_messages.sql:1-46`.

**Что не работает / risk:**

- Client-side matching screen for messages was not confirmed in audited routes.
- Local fallback may hide schema/runtime issues.

## 11. Payments

**Назначение:** payment link, webhook, access after purchase, subscription/payment metadata.

**Маршруты/API:**

- `/api/create-payment-link`
- `/api/webhooks/payment`
- `/dashboard/analytics` legacy payments
- `/trainer/sales` visual sales products

**Текущий статус:** partially Supabase-backed for webhook, visual prototype for sales.

**Что реально работает по коду:**

- Payment link requires `clientId` and `programId` and builds external URL from env: `app/api/create-payment-link/route.ts:11-31`.
- Payment webhook validates secret and upserts `client_programs` or updates `profiles`: `app/api/webhooks/payment/route.ts:72-120`, `app/api/webhooks/payment/route.ts:179-188`.
- Legacy analytics reads/writes `payments`: `app/(admin)/dashboard/analytics/page.tsx:103-108`, `app/(admin)/dashboard/analytics/page.tsx:198-206`.
- Trainer sales derives products from demo programs and local state: `app/trainer/sales/page.tsx:34-35`, `app/trainer/sales/page.tsx:78-107`.

**Что не работает / risk:**

- No migration for `payments` or `client_programs` was found in current `supabase/migrations`.
- Real payment provider integration is env-url based and webhook-shape generic.

## 12. Achievements, Titles И Reputation

**Назначение:** долгосрочный прогресс, титулы, ранги, спортивная репутация.

**Основные файлы:**

- `docs/achievement-system-v1.md`
- `docs/achievement-catalog-v1.md`
- `docs/titles-v1.md`
- `docs/athlete-reputation-rank-system.md`
- `components/trainer-os/client-profile/achievement-catalog.ts`
- `components/trainer-os/client-profile/reputation-ranks.ts`
- `components/trainer-os/client-profile/mock-data.ts`

**Текущий статус:** concept + visual prototype + mock-backed.

**Что реально работает по коду:**

- Rank list exists in code with assets and thresholds: `components/trainer-os/client-profile/reputation-ranks.ts:3-140`.
- Achievement catalog exists in code with catalog items and assets: `components/trainer-os/client-profile/achievement-catalog.ts:21-140`.
- Achievement dialog exists and computes unlocked/in-progress/locked counts from athlete mock: `components/trainer-os/client-profile/achievement-catalog-dialog.tsx:24-55`.
- Mock athlete contains titles and achievements: `components/trainer-os/client-profile/mock-data.ts:98-182`.
- Docs define separation between Achievement Score, Titles and Reputation: `docs/athlete-reputation-rank-system.md:5-13`.

**Что не работает / risk:**

- No Supabase migrations for achievements/titles/ranks were found.
- It is not confirmed that client-side achievement UI uses the same code catalog.

## 13. Automation, Insights, Reports И Sales

**Назначение:** вторичный/операционный слой тренера: правила, аналитика, отчеты, продажи.

**Маршруты:**

- `/trainer/automation`
- `/trainer/insights`
- `/trainer/reports`
- `/trainer/sales`

**Текущий статус:** automation/reports visual + localStorage; insights/sales visual prototype; migrations exist for automation/insights/reports, but not all screens use them.

**Что реально работает по коду:**

- Automation has localStorage keys and inline initial rules/queue: `app/trainer/automation/page.tsx:69-70`, `app/trainer/automation/page.tsx:85-150`.
- Insights uses inline `initialInsights` and `initialActions`: `app/trainer/insights/page.tsx:68-150`.
- Reports uses localStorage key and inline reports: `app/trainer/reports/page.tsx:63-131`.
- Sales uses `getDemoPrograms` + local React state: `app/trainer/sales/page.tsx:34-35`, `app/trainer/sales/page.tsx:78-107`.
- Migrations exist for automation rules, insights, reports: `supabase/migrations/20260407120000_trainer_automation_rules.sql:1-44`, `supabase/migrations/20260408120000_trainer_client_insights.sql:1-37`, `supabase/migrations/20260409120000_trainer_client_reports.sql:1-52`.

**Что не работает / risk:**

- Automation page does not read/write `trainer_automation_rules` despite migration.
- Reports page does not read/write `trainer_client_reports` despite migration.
- Sales has no confirmed production-backed store/payment product table.

## Engineering Review

**Overall verdict:** проект собирается и lint проходит, но продукт сейчас является смесью demo-backed экранов, partial Supabase flows, visual prototypes и legacy routes. Production-backed зон в строгом смысле не подтверждено.

**Главные риски:**

- `/trainer/*` и `/dashboard/*` конфликтуют.
- `app/client/*` и `app/(client)/*` конфликтуют.
- Новые `/trainer/*` и `/client/*` не покрыты proxy auth guard.
- Данные спортсмена в trainer profile полностью mock-backed.
- Client progress и trainer progress используют разные источники.
- Recharts warnings на build.

**Блокеры следующего этапа:**

- Выбрать canonical routes.
- Принять единый источник данных для Athlete/Profile/Progress/WorkoutAssignment/Review/AttentionItem.
- Решить судьбу legacy dashboard.

**Решения фаундера:**

- Является ли `/trainer/dashboard` единственным home тренера?
- Что считается основным клиентским кабинетом: `/client/me` или legacy `/client/[id]` flow?
- Делать ли Attention Item главной доменной сущностью MVP?
- Оставлять ли automation/insights/reports/sales в MVP navigation?

**Недостаточно информации:**

- Какая Supabase schema уже применена в remote DB.
- Какие env vars реально стоят в production.
- Есть ли внешняя payment provider настройка.
- Есть ли Telegram webhook secret/protection вне кода.
