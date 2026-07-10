# Аудит проекта AI Strength Coach для ChatGPT

Дата: 2026-07-10  
Проект: `AI Strength Coach`  
Рабочая папка: `/Users/ikhudyakov/Cursor-проекты/web/trainer — копия 2`

## 1. Коротко о проекте

Мы строим премиальный фитнес-продукт с двумя связанными кабинетами:

- клиентский кабинет для спортсмена;
- тренерский кабинет для тренера, который ведет клиентов, назначает тренировки и отслеживает прогресс.

Главная продуктовая идея: это не просто CRM и не просто трекер тренировок. Это связанная система, где клиент тренируется и заполняет данные, а тренер видит, кому он нужен сейчас, почему именно, и какое действие нужно сделать дальше.

Текущий визуальный язык: темный premium fitness OS, черный/zinc фон, lime-акценты, крупные карточки, мягкие градиенты, визуальная библиотека упражнений, ощущение спортивного продукта, а не обычной админки.

## 2. Технологический стек

Проект сделан на Next.js App Router.

Основные зависимости:

- `next`
- `react`
- `react-dom`
- `tailwindcss`
- `@tailwindcss/postcss`
- `framer-motion`
- `recharts`
- `lucide-react`
- Radix UI primitives: avatar, dialog, slot, switch, tabs, tooltip
- Supabase: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-nextjs`
- `sonner`
- `qrcode`
- `html-to-image`
- `canvas-confetti`

Основные команды:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Файл конфигурации Next: `next.config.ts`  
Tailwind/PostCSS: `postcss.config.mjs`  
UI registry: `components.json`

## 3. Главная структура проекта

### `app/`

Основные маршруты приложения.

Публичные и auth-страницы:

- `app/page.tsx` - главная точка входа.
- `app/landing/page.tsx` - landing route.
- `app/login/page.tsx` - вход клиента/тренера.
- `app/signup/page.tsx` - регистрация.
- `app/support/page.tsx` - поддержка.
- `app/terms/page.tsx` - условия.
- `app/trainers/page.tsx` - каталог тренеров.
- `app/t/[slug]/page.tsx` - публичная страница/ссылка тренера.

Клиентский кабинет:

- `app/client/me/page.tsx` - главная клиента.
- `app/client/dashboard/page.tsx` - альтернативная/legacy-точка клиента.
- `app/client/workouts/page.tsx` - тренировки клиента.
- `app/client/progress/page.tsx` - прогресс клиента.
- `app/client/activity/page.tsx` - активность клиента.
- `app/client/library/page.tsx` - библиотека упражнений.
- `app/client/settings/page.tsx` - настройки клиента.

Legacy/client group:

- `app/(client)/check-in/page.tsx`
- `app/(client)/client/[id]/page.tsx`
- `app/(client)/client/[id]/program/[programId]/page.tsx`
- `app/(client)/explore/page.tsx`
- `app/(client)/explore/[id]/page.tsx`
- `app/(client)/history/page.tsx`
- `app/(client)/profile/page.tsx`
- `app/(client)/programs/page.tsx`
- `app/(client)/today/page.tsx`
- `app/(client)/today/select/page.tsx`
- `app/(client)/workout/free/page.tsx`

Тренерский кабинет:

- `app/trainer/dashboard/page.tsx` - новая главная тренера.
- `app/trainer/attention/page.tsx` - центр внимания.
- `app/trainer/clients/page.tsx` - список клиентов.
- `app/trainer/clients/[clientId]/page.tsx` - профиль спортсмена через тренера.
- `app/trainer/review/[workoutId]/page.tsx` - разбор тренировки.
- `app/trainer/builder/page.tsx` - конструктор тренировки/шаблонов.
- `app/trainer/programs/page.tsx` - программы.
- `app/trainer/calendar/page.tsx` - календарь.
- `app/trainer/library/page.tsx` - библиотека упражнений.
- `app/trainer/messages/page.tsx` - сообщения.
- `app/trainer/reports/page.tsx` - отчеты.
- `app/trainer/automation/page.tsx` - автоматизация.
- `app/trainer/insights/page.tsx` - аналитика/риски.
- `app/trainer/sales/page.tsx` - продажи.
- `app/trainer/settings/page.tsx` - настройки.

Legacy/admin dashboard:

- `app/(admin)/dashboard/page.tsx`
- `app/(admin)/dashboard/analytics/page.tsx`
- `app/(admin)/dashboard/library/page.tsx`
- `app/(admin)/dashboard/programs/page.tsx`
- `app/(admin)/dashboard/programs/[id]/page.tsx`
- `app/(admin)/dashboard/subscribe/page.tsx`
- `app/(admin)/settings/page.tsx`

API routes:

- `app/api/ensure-profile/route.ts`
- `app/api/link-trainer/route.ts`
- `app/api/seed-test-users/route.ts`
- `app/api/test-env/route.ts`
- `app/api/create-payment-link/route.ts`
- `app/api/webhooks/payment/route.ts`
- `app/api/send-reminder/route.ts`
- `app/api/notify-complete/route.ts`
- `app/api/tg-webhook/route.ts`
- `app/api/trainer/programs/route.ts`

### `components/`

Ключевые зоны компонентов:

- `components/landing/landing-page.tsx` - лендинг.
- `components/demo/demo-client-cabinet.tsx` - большой demo-клиентский кабинет.
- `components/demo/demo-pages.tsx` - demo-страницы и вспомогательные экраны.
- `components/trainer/trainer-shell.tsx` - оболочка тренерского кабинета.
- `components/trainer/*` - конструктор тренировки, библиотека упражнений, карточки упражнений.
- `components/trainer-os/home/*` - новая главная тренера: карта команды, рабочая зона, очередь действий, лента.
- `components/trainer-os/dashboard/*` - операционные элементы dashboard.
- `components/trainer-os/client-profile/*` - профиль спортсмена через тренера.
- `components/trainer-os/quick-assign/quick-assign-drawer.tsx` - drawer быстрого назначения.
- `components/trainer-os/workout-review/workout-review-drawer.tsx` - drawer разбора тренировки.
- `components/client/*` - клиентские компоненты.
- `components/ui/*` - локальные shadcn/Radix-подобные UI primitives.

### `lib/`

- `lib/auth-context.tsx` - auth-контекст.
- `lib/demo-data.ts` - demo-данные.
- `lib/demo-mode.ts` - demo-режим и demo-сессии.
- `lib/exercise-categories.ts` - категории упражнений.
- `lib/exercise-library.ts` - библиотека упражнений.
- `lib/supabase-client.ts` - Supabase client.
- `lib/supabase-admin.ts` - Supabase admin client.
- `lib/utils.ts` - утилиты.

### `supabase/migrations/`

Есть миграции для:

- антропометрии клиента;
- веса, роста и цели клиента;
- библиотеки упражнений;
- seed системной библиотеки упражнений;
- тренерских разборов тренировок;
- шаблонов конструктора;
- настроек тренера;
- сообщений тренер-клиент;
- automation rules;
- client insights;
- reports.

### `public/`

Основные ассеты:

- `public/Home.png`
- `public/Training.png`
- `public/trainer/team-hq-hero.png`
- `public/training/*`
- `public/category-icons/*`
- `public/exercises/*`
- `public/achievements/*`
- `public/ranks/*`
- `public/titles/*`

### `docs/`

Уже есть продуктовые документы:

- `docs/project-overview-and-backlog.md`
- `docs/trainer-client-profile-concept.md`
- `docs/trainer-cabinet-flow.md`
- `docs/trainer-product-operating-audit.md`
- `docs/achievement-system-v1.md`
- `docs/achievement-catalog-v1.md`
- `docs/athlete-reputation-rank-system.md`
- `docs/titles-v1.md`
- `docs/trainer-audit-raw-answers.md`
- `docs/trainer-os-last-six-product-answers.md`

Также есть:

- `GPT_PRODUCT_CONTEXT.md`
- `TRAINER_CABINET_PHASE_1.md`

## 4. Что уже хорошо работает

### 4.1. Визуальная база продукта

У проекта уже есть сильный визуальный характер: темный спортивный интерфейс, lime-акцент, крупные блоки, карточки, визуальные ассеты упражнений. Это важное преимущество, потому что продукт не выглядит как типовая CRM.

### 4.2. Demo-клиентский кабинет

Клиентский demo-кабинет сейчас является главным эталоном качества. В нем уже есть:

- главная клиента;
- тренировки;
- тренировка по плану;
- свободная тренировка;
- логирование результатов;
- библиотека упражнений;
- активность;
- прогресс;
- настройки;
- разные состояния клиента: с тренером, без тренера, без программы, с активной программой.

Файл-ядро: `components/demo/demo-client-cabinet.tsx`.

### 4.3. Новая тренерская ОС

Новая тренерская зона `/trainer/*` уже выглядит как отдельный продукт, а не просто набор страниц. Особенно сильные зоны:

- `app/trainer/dashboard/page.tsx`
- `components/trainer-os/home/trainer-home-page.tsx`
- `components/trainer-os/home/living-team-map.tsx`
- `components/trainer-os/home/activity-drawer.tsx`
- `components/trainer-os/home/team-activity-feed.tsx`

У тренера уже есть идея рабочей главной:

- видеть команду;
- видеть проблемных клиентов;
- открывать action drawer;
- понимать, что произошло;
- быстро перейти к клиенту или действию.

### 4.4. Профиль спортсмена через тренера

Активная зона сейчас: `app/trainer/clients/[clientId]/page.tsx`, которая рендерит `components/trainer-os/client-profile/client-profile-page.tsx`.

Что уже сделано:

- есть вкладки: обзор, тренировки, прогресс, финансы и доступ;
- Hero профиля разделен на два состояния:
  - большой Hero на вкладке "Обзор";
  - компактный Header на остальных вкладках;
- переход между состояниями Hero анимирован через `framer-motion`;
- удалена кнопка "Изменить фото", потому что тренер не должен менять фото клиента;
- аватар упрощен до одного круга с инициалами;
- титул спортсмена оформлен как статус, а не как обычный badge;
- спортивная репутация/ранг вынесена в кликабельный элемент;
- есть модальное окно с системой рангов;
- вкладка `Progress` начала использовать визуальный язык клиентского прогресса: графики, body changes, sparklines;
- был устранен риск hydration mismatch от Radix Tabs за счет кастомных стабильных tab id.

### 4.5. Библиотека упражнений и builder

В проекте уже есть заметная база для тренерского конструктора:

- `components/trainer/exercise-library-panel.tsx`
- `components/trainer/exercise-detail-sheet.tsx`
- `components/trainer/workout-exercise-card.tsx`
- `components/trainer/workout-form-header.tsx`
- `components/trainer/workout-superset-block-card.tsx`

Это важный фундамент для назначения тренировок, шаблонов и программ.

### 4.6. Supabase-направление

Supabase уже подключен и есть миграции под реальные сущности. Это хорошо: проект не только визуальный прототип, но уже движется к реальному продукту.

## 5. Что работает плохо или требует внимания

### 5.1. Раздвоение маршрутов тренера

Сейчас одновременно живут:

- новый тренерский кабинет `/trainer/*`;
- legacy/admin dashboard `/dashboard/*` внутри `app/(admin)/dashboard/*`.

Это создает путаницу. Например, в `app/login/page.tsx` demo-вход и часть real-login сценариев все еще отправляют тренера на `/dashboard`, хотя активная новая зона - `/trainer/dashboard`.

Что нужно сделать:

- принять `/trainer/dashboard` как canonical home тренера;
- заменить redirects тренера с `/dashboard` на `/trainer/dashboard`;
- решить судьбу legacy `/dashboard/*`: redirect, скрыть из навигации или постепенно разобрать на полезные части.

### 5.2. Раздвоение клиентских маршрутов

Есть новые маршруты `app/client/*` и legacy group `app/(client)/*`. Это не обязательно плохо, но сейчас не до конца понятно, что является канонической клиентской зоной.

Нужно решить:

- что является главной клиента: скорее всего `/client/me`;
- что делать с `/client/dashboard`;
- какие страницы должны быть реальными, а какие пока demo;
- как связать `/client/progress`, `/client/activity`, `/client/workouts` с тем, что видит тренер в профиле спортсмена.

### 5.3. Demo-данные и реальные данные смешаны

В проекте много mock/demo-данных:

- `lib/demo-data.ts`
- `components/demo/demo-client-cabinet.tsx`
- `components/trainer-os/home/mock-data.ts`
- `components/trainer-os/dashboard/mock-data.ts`
- `components/trainer-os/client-profile/mock-data.ts`

Это нормально для текущей стадии, но риск в том, что UI уже выглядит почти как продукт, а данные еще не имеют единого источника правды.

Нужно:

- описать доменные сущности;
- решить, какие данные приходят из Supabase;
- какие данные пока остаются demo;
- вынести адаптеры, чтобы клиентский и тренерский кабинеты смотрели на одни и те же сущности.

### 5.4. Клиентский и тренерский UI иногда расходятся

Одна из главных проблем, которую уже заметили визуально: когда тренер открывает профиль спортсмена, часть блоков раньше выглядела не как клиентский кабинет, а как новая CRM-аналитика.

Уже начато исправление:

- Hero упрощен;
- графики progress начали приводиться к клиентскому стилю;
- блок изменения тела заменен на более клиентский визуальный паттерн.

Но риск остается:

- календарь;
- история тренировок;
- прогресс;
- achievements;
- карточки тела;
- фотоотчеты;
- активность.

Нужно создавать shared-компоненты, а не копировать похожие блоки отдельно.

### 5.5. Слишком много разделов тренера для MVP

В `/trainer/*` уже есть почти полноценная операционная система:

- dashboard;
- attention;
- clients;
- builder;
- programs;
- calendar;
- library;
- messages;
- reports;
- automation;
- insights;
- sales;
- settings.

Это хорошо для видения, но рискованно для MVP: тренер может потеряться, а разработка расползется.

Рекомендация: в основном sidebar оставить рабочее ядро:

- Главная;
- Клиенты;
- Шаблоны/Builder;
- Библиотека;
- Настройки.

Остальное оставить во втором слое через command palette или как experimental-разделы, пока они не привязаны к реальным workflow.

### 5.6. Attention Item пока не стал настоящей сущностью

В продукте уже чувствуется главная логика:

```text
клиент -> проблема/событие -> действие тренера -> задача закрыта
```

Но это пока в основном UI/demo-концепция.

Нужно сделать canonical contract:

```ts
type AttentionItem = {
  id: string;
  clientId: string;
  source: "missed_workout" | "workout_review" | "check_in" | "message" | "payment" | "manual";
  reason: string;
  urgency: "low" | "medium" | "high";
  primaryAction: string;
  secondaryAction?: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
};
```

### 5.7. Quick Assign должен стать глобальным действием

Сейчас `QuickAssignDrawer` уже есть и работает как важный элемент. Но продуктово он должен открываться из разных мест:

- dashboard;
- attention;
- clients;
- client profile;
- workout review;
- calendar.

Идеальный сценарий:

```text
тренер видит проблему -> открывает клиента -> назначает тренировку -> задача закрывается -> система предлагает следующего клиента
```

### 5.8. Review loop нужно связать с клиентскими тренировками

В клиентском кабинете есть логирование тренировок. В тренерском есть drawer разбора. Но важно связать это в один цикл:

```text
клиент завершил тренировку -> тренеру пришла задача на разбор -> тренер отправил feedback -> задача закрылась -> при необходимости назначил следующую тренировку
```

Это один из самых важных рабочих процессов продукта.

### 5.9. Auth/redirects требуют ревизии

В `app/login/page.tsx` есть логика demo-login, Supabase-login, ensure profile, invite trainer. Это полезно, но сейчас там есть продуктовая устаревшая логика:

- тренер после входа уходит на `/dashboard`;
- signup тренера тоже ведет на `/dashboard`;
- fallback тоже ведет на `/dashboard`.

Нужно перевести на `/trainer/dashboard`.

Также `proxy.ts` сейчас защищает:

- `/dashboard/:path*`
- `/api/notify-complete`

Но не защищает `/trainer/*` и `/client/*`. Нужно отдельно решить стратегию auth-guard для новых зон.

### 5.10. Возможные frontend-проблемы

Ранее была ошибка hydration mismatch из-за Radix Tabs в профиле спортсмена. В текущей активной зоне это поправлено кастомными tabs, но общий риск остается:

- компоненты с auto-generated ids;
- `Date.now()`, `Math.random()`, локаль форматирования даты на SSR;
- разные server/client branches;
- анимации и layout shift.

Также были замечены предупреждения Recharts на `/client/progress`, связанные с некорректной шириной/высотой контейнера в момент рендера. Это нужно проверить отдельно.

### 5.11. Рабочее дерево сейчас очень грязное

`git status` показывает много измененных и новых файлов. Это значит, что проект находится в активной фазе генерации/итераций.

Риск:

- сложно понять, что уже принято;
- сложно откатить плохую итерацию;
- сложно делать чистые PR/коммиты;
- сложно отделить legacy от новой архитектуры.

Рекомендация:

- сделать один контрольный commit/snapshot текущего состояния;
- после этого итерации вести маленькими пакетами;
- отдельно зафиксировать новую тренерскую ОС и отдельно legacy/dashboard cleanup.

## 6. Что еще не сделано

### 6.1. Единая модель данных

Нужно описать и связать сущности:

- User/Profile;
- Trainer;
- Client/Athlete;
- TrainerClientRelation;
- Program;
- WorkoutTemplate;
- WorkoutAssignment;
- WorkoutSession;
- WorkoutLog;
- Exercise;
- ExerciseSet;
- CheckIn;
- BodyMeasurement;
- ProgressPhoto;
- Achievement;
- Title;
- ReputationRank;
- AttentionItem;
- Message;
- Payment/Subscription.

### 6.2. Единый профиль спортсмена

Профиль спортсмена должен быть одновременно:

- человеческим профилем: кто этот человек, цель, контекст, статус;
- рабочим местом тренера: тренировки, прогресс, история, заметки, финансы, доступ.

Сейчас это уже появилось, но нужно продолжать выравнивать с клиентским кабинетом.

Важный принцип:

```text
Тренер видит тот же продуктовый мир, что и клиент, но с дополнительным рабочим слоем.
```

### 6.3. Shared UI между клиентом и тренером

Нужно вынести общие компоненты:

- weight dynamics chart;
- strength progress chart;
- body changes cards;
- activity calendar;
- workout history card;
- achievement/titles UI;
- rank/reputation UI;
- progress photos;
- workout session summary.

Иначе клиентская и тренерская версии будут снова расходиться.

### 6.4. Реальный backend-flow

Нужно связать UI с Supabase:

- реальные клиенты тренера;
- реальные назначения тренировок;
- реальные выполненные тренировки;
- реальные check-ins;
- реальные замеры;
- реальные сообщения;
- реальные оплаты/подписки;
- реальные attention items.

### 6.5. Тесты и проверка

Сейчас не видно устойчивой test/e2e-системы. Есть `npm run lint`, но для такого UI нужны:

- smoke tests маршрутов;
- e2e для login и demo-login;
- e2e для клиента: открыть тренировку, заполнить подходы, сохранить;
- e2e для тренера: открыть dashboard, клиента, назначить тренировку;
- visual QA для ключевых экранов desktop/mobile.

### 6.6. Mobile/responsive QA

Продукт визуально сложный. Нужно отдельно проверять:

- `/client/me`;
- `/client/workouts`;
- `/client/progress`;
- `/trainer/dashboard`;
- `/trainer/clients`;
- `/trainer/clients/[clientId]`;
- `/trainer/builder`.

Особенно важно:

- чтобы тексты не вылезали из карточек;
- tabs не ломались;
- графики имели стабильные размеры;
- drawer/modal не перекрывали критичные элементы;
- Hero профиля не занимал весь экран там, где это не нужно.

## 7. Рекомендуемый backlog

### P0 - стабилизация продукта

1. Принять `/trainer/dashboard` как единственную главную тренера.
2. Исправить redirects в `app/login/page.tsx` с `/dashboard` на `/trainer/dashboard`.
3. Решить стратегию legacy `/dashboard/*`.
4. Решить canonical routes клиента: `/client/me`, `/client/workouts`, `/client/progress`, `/client/activity`, `/client/library`, `/client/settings`.
5. Описать доменные сущности и источник данных для каждой.
6. Зафиксировать текущее состояние в git.

### P1 - тренерский рабочий цикл

1. Сделать Attention Item реальной сущностью.
2. Связать завершенную тренировку клиента с задачей тренеру на review.
3. Сделать Quick Assign глобальным drawer/action.
4. После назначения или review закрывать связанную задачу.
5. В профиле спортсмена довести вкладки:
   - Обзор;
   - Тренировки;
   - Прогресс;
   - Финансы и доступ.
6. Продолжить перенос удачных client UI-паттернов в trainer-side profile через shared-компоненты.

### P2 - дизайн-система и переиспользование

1. Вынести shared progress components.
2. Вынести shared workout history/activity components.
3. Вынести rank/title/achievement components.
4. Убрать дублирование карточек и графиков.
5. Привести все tabs, dialogs, drawers к единому поведению и доступности.

### P3 - backend и production readiness

1. Supabase schema review.
2. RLS policies.
3. Защита `/trainer/*` и `/client/*`.
4. Payment/webhook security.
5. Telegram webhook security.
6. Обработка ошибок API.
7. Логи и наблюдаемость.
8. E2E и visual regression.

## 8. Главные продуктовые вопросы для ChatGPT

Можно обсуждать проект с ChatGPT через такие вопросы:

1. Как лучше структурировать профиль спортсмена через тренера, чтобы он не выглядел как CRM, но оставался рабочим инструментом?
2. Какие вкладки должны быть в профиле спортсмена и что именно должно лежать в каждой?
3. Как связать клиентский прогресс и тренерский прогресс, чтобы не было двух разных визуальных систем?
4. Что должно быть главным рабочим циклом тренера в MVP?
5. Какие разделы тренерского кабинета нужно оставить в первом релизе, а какие скрыть?
6. Как правильно описать Attention Item как продуктовую и техническую сущность?
7. Как разделить templates, workouts и programs?
8. Как сделать subscription/payment block полезным для тренера?
9. Какие данные тренер должен видеть в Hero профиля, а какие только во вкладках?
10. Как постепенно перейти от demo-данных к реальному Supabase-backed продукту?

## 9. Рекомендуемая формулировка текущей цели

Текущая активная цель:

```text
Довести тренерский кабинет до понятной MVP-версии, где тренер видит состояние команды, открывает профиль спортсмена, понимает контекст, назначает тренировку, разбирает выполненные тренировки и отслеживает прогресс в той же визуальной системе, что и клиент.
```

Главный критерий:

```text
При открытии профиля спортсмена тренер должен чувствовать: "Я смотрю на живого человека и его тренировочный путь", а не "Я открыл CRM-карточку клиента".
```

## 10. Короткий итог

Проект уже имеет сильное визуальное и продуктово-концептуальное ядро. Самые сильные части сейчас:

- demo-клиентский кабинет;
- новая главная тренера;
- профиль спортсмена через тренера после последних итераций;
- библиотека упражнений;
- builder-направление;
- документы по achievements, titles и reputation ranks.

Главная проблема сейчас не в отсутствии идей, а в расфокусировке:

- много routes;
- много demo/mock-данных;
- есть legacy dashboard;
- клиентский и тренерский UI местами расходятся;
- рабочие циклы еще не связаны в единую систему.

Следующий правильный шаг: не добавлять новые большие разделы, а стабилизировать ядро:

```text
Trainer dashboard -> Attention Item -> Athlete profile -> Assign / Review -> Progress -> Task resolved
```

Если этот цикл станет понятным и приятным, продукт начнет ощущаться цельным.
