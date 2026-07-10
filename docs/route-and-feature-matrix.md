# Route And Feature Matrix

Дата аудита: 2026-07-10  
Источник routes: `find app -maxdepth 4 -type f` и `npm run build` route output.  
Auth coverage evidence: `proxy.ts:42-44` защищает только `/dashboard/:path*` и `/api/notify-complete`.

## Legend

| Поле | Значение |
| --- | --- |
| Status | concept / visual prototype / demo-backed / partially Supabase-backed / legacy / unknown |
| Position | canonical / candidate canonical / legacy / experimental |
| Protected | proxy / self-check / partial / no evidence / public |

## Route Matrix

| Route | Role | Назначение | Status | Источник данных | Position | Redirect source/target | Protected | Дубли | Рекомендация |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | public | Главная точка входа | partially Supabase-backed | landing/auth state | canonical | n/a | public | `/landing` | Оставить public home, проверить CTA redirects |
| `/landing` | public | Landing route | partially Supabase-backed | `components/landing/landing-page.tsx` | candidate legacy | n/a | public | `/` | Решить, нужен ли отдельный route |
| `/login` | public | Login client/trainer | partially Supabase-backed | Supabase + demo mode | canonical | trainer -> `/dashboard` | public | `/signup` partially | Исправлять позже: trainer target conflicts |
| `/signup` | public | Регистрация/invite | partially Supabase-backed | Supabase + `/api/link-trainer` | candidate canonical | client -> `/client/me` | public | login signup mode | Проверить overlap с `/login` signup mode |
| `/support` | public | Поддержка | unknown | unknown | experimental | n/a | public | none | Проверить содержимое отдельно |
| `/terms` | public | Условия | unknown | unknown | experimental | n/a | public | none | Проверить legal content |
| `/trainers` | public/client | Каталог тренеров | partially Supabase-backed | `profiles` via `TrainersCatalogClient` | experimental | n/a | public | `/t/[slug]` related | Решить роль в MVP |
| `/t/[slug]` | public/client | Публичная страница тренера | partially Supabase-backed | `profiles` by slug | candidate canonical | n/a | public | `/trainers` related | Нужна проверка access/payment flow |
| `/client/me` | client | Главная клиента | partially Supabase-backed + demo-backed | Supabase + demo adapter | candidate canonical | target from `/client/dashboard`, login client | self-check | `/client/dashboard`, `/today` | Выбрать как canonical client home |
| `/client/dashboard` | client | Redirect shim | legacy | Supabase auth then redirect | legacy | -> `/client/me` | self-check | `/client/me` | Скрыть/оставить redirect |
| `/client/workouts` | client | Workouts hub | demo-backed | `DemoClientWorkoutsPage`; non-demo -> `/today` | candidate canonical | non-demo -> `/today` | no evidence | `/today`, `/workout/free` | Нужен real-data экран или redirect decision |
| `/client/progress` | client | Progress hub | demo-backed | `DemoClientProgressPage`; non-demo -> `/history` | candidate canonical | non-demo -> `/history` | no evidence | `/history`, `/check-in` | Нужен unified progress source |
| `/client/activity` | client | Activity calendar/history | demo-backed | `DemoClientActivityPage`; non-demo -> `/history` | candidate canonical | non-demo -> `/history` | no evidence | `/history` | Нужен real-data экран |
| `/client/library` | client | Exercise library | demo-backed / placeholder | `DemoClientLibraryPage`; non-demo placeholder | candidate canonical | n/a | no evidence | `/trainer/library`, legacy library | Подключить real `exercise_library` later |
| `/client/settings` | client | Profile/settings | partially Supabase-backed + demo-backed | `profiles` + demo settings | candidate canonical | trainer profile -> `/dashboard` | self-check | `/profile` | Trainer redirect conflicts with new trainer route |
| `/client/[id]` | client | Legacy workout execution | partially Supabase-backed | `profiles`, `trainer_clients`, `workout_logs`, programs | legacy | n/a | self-check in page | `/client/workouts`, `/today` | Сохранить как valuable legacy until new flow replaces |
| `/client/[id]/program/[programId]` | client | Legacy program payment/access | partially Supabase-backed | `profiles`, `workout_templates`, `assigned_programs`, `client_programs` | legacy | can redirect to `/client/[id]` | no evidence | `/programs/[id]`, `/explore/[id]` | Clarify purchase/access model |
| `/check-in` | client | Check-in/weight | partially Supabase-backed | `profiles`, `weight_logs`, `workout_logs` | legacy/candidate | n/a | self-check | `/client/progress` | Decide if folded into `/client/progress` |
| `/history` | client | Workout history | partially Supabase-backed | `workout_logs` | legacy/candidate | target from `/client/progress`, `/client/activity` | self-check | `/client/activity` | Could become data source for activity |
| `/profile` | client | Legacy client profile | partially Supabase-backed | `profiles`, trainer profile | legacy | n/a | self-check | `/client/settings` | Merge into settings/me |
| `/programs` | client | Client programs | partially Supabase-backed | `assigned_programs`, `client_programs`, `workout_templates` | legacy/candidate | n/a | self-check | `/client/workouts`, `/explore` | Decide canonical program route |
| `/programs/[id]` | client | Dynamic program detail from `(admin)/programs/[id]` | unknown/legacy | file exists under `(admin)` group | legacy | n/a | no evidence | `/client/[id]/program/[programId]` | Audit separately |
| `/today` | client | Today redirect | legacy redirect | redirect to `/client/me` | legacy | -> `/client/me` | no evidence | `/client/me` | Keep redirect only |
| `/today/select` | client | Today select redirect | legacy redirect | redirect to `/client/me` | legacy | -> `/client/me` | no evidence | `/client/me` | Keep redirect only |
| `/workout/free` | client | Free workout | unknown/legacy | code not deeply audited | legacy/candidate | n/a | unknown | `/client/workouts` | Audit before removing |
| `/explore` | client/public | Explore public programs | partially Supabase-backed | `workout_templates`, `profiles` | legacy/candidate | n/a | no evidence | `/trainers`, `/programs` | Decide role in sales flow |
| `/explore/[id]` | client/public | Program detail/purchase | partially Supabase-backed | `workout_templates`, `profiles` | legacy/candidate | n/a | no evidence | `/programs/[id]` | Clarify purchase flow |
| `/trainer/dashboard` | trainer | New trainer home | demo/mock-backed | `TrainerHomePage` + `home/mock-data` | candidate canonical | linked in TrainerShell | no proxy | `/dashboard` | Likely canonical, needs founder decision |
| `/trainer/attention` | trainer | Attention center | visual prototype | inline state | experimental | n/a | no proxy | dashboard attention blocks | Define AttentionItem entity before scaling |
| `/trainer/clients` | trainer | Client roster | partially Supabase-backed + demo | inline demo + Supabase reads | candidate canonical | links to `/trainer/clients/[clientId]` | self-check | `/dashboard/clients/[id]` | Keep; align with real profile source |
| `/trainer/clients/[clientId]` | trainer | Athlete profile through trainer | demo-backed | `client-profile/mock-data.ts` | candidate canonical | back to `/trainer/dashboard` | no proxy | `/dashboard/clients/[id]` | Needs Supabase adapter |
| `/trainer/builder` | trainer | Workout/template builder | partially Supabase-backed + localStorage | demo + `trainer_builder_templates` + localStorage | candidate canonical | n/a | self-check | `/dashboard/programs/[id]` editing | Keep; clarify template vs program |
| `/trainer/programs` | trainer | Trainer programs | partially Supabase-backed + demo | `workout_templates`, `assigned_programs`, `profiles`, demo | experimental/candidate | n/a | no proxy/self-check likely | `/dashboard/programs` | Decide templates-first vs programs-first |
| `/trainer/calendar` | trainer | Calendar/weekly ops | visual prototype | inline events | experimental | n/a | no proxy | attention/dashboard | Keep second-layer until real data |
| `/trainer/library` | trainer | Exercise library | demo-backed | `DemoClientLibraryContent` | candidate/experimental | n/a | no proxy | `/client/library`, `/dashboard/library` | Replace with trainer library panel later |
| `/trainer/messages` | trainer | Messages | partially Supabase-backed + local fallback | `trainer_client_messages`, localStorage, demo | experimental/candidate | n/a | no proxy | none obvious | Needs client counterpart |
| `/trainer/review/[workoutId]` | trainer | Workout review page | demo-backed | hardcoded `workoutReviews` + demo library | experimental/candidate | linked from dashboard/client profile | no proxy | review drawer | Connect to `trainer_workout_reviews` |
| `/trainer/automation` | trainer | Automation rules | visual/local prototype | localStorage + inline initial rules | experimental | n/a | no proxy | insights/reports attention | Migration exists but not used |
| `/trainer/insights` | trainer | Client insights | visual prototype | inline `initialInsights` | experimental | n/a | no proxy | dashboard/attention | Use migration or hide |
| `/trainer/reports` | trainer | Weekly reports | visual/local prototype | localStorage + inline reports | experimental | n/a | no proxy | insights/messages | Migration exists but not used |
| `/trainer/sales` | trainer | Sales/storefront | visual/demo prototype | `getDemoPrograms` + local state | experimental | n/a | no proxy | `/dashboard/analytics`, payments | Needs real product/payment model |
| `/trainer/settings` | trainer | Trainer settings | partially Supabase-backed + local/demo | `trainer_settings`, localStorage, demo | candidate canonical | n/a | self-check | `/settings` legacy | Keep; align redirects |
| `/dashboard` | trainer/admin | Legacy trainer dashboard | partially Supabase-backed + demo | Supabase + `DemoTrainerDashboardPage` | legacy | target from login trainer | proxy | `/trainer/dashboard` | Do not delete yet; redirect later after data extraction |
| `/dashboard/analytics` | trainer/admin | Legacy payments analytics | partially Supabase-backed | `payments`, `trainer_clients` | legacy | n/a | proxy | `/trainer/sales`, `/trainer/insights` | Preserve until payment model decided |
| `/dashboard/clients/[id]` | trainer/admin | Legacy client detail | partially Supabase-backed | `profiles`, `workout_logs`, `assigned_programs` | legacy | n/a | proxy | `/trainer/clients/[clientId]` | Important real-data source to mine |
| `/dashboard/library` | trainer/admin | Legacy exercise library | partially Supabase-backed + demo | `exercise_library`, legacy `exercises` | legacy | n/a | proxy | `/trainer/library` | Candidate source for trainer library |
| `/dashboard/programs` | trainer/admin | Legacy programs | partially Supabase-backed + demo | `workout_templates`, `/api/trainer/programs` | legacy | navigates to `/dashboard/programs/[id]` | proxy | `/trainer/programs`, `/trainer/builder` | Preserve until new programs stable |
| `/dashboard/programs/[id]` | trainer/admin | Legacy program editor | partially Supabase-backed | `workout_templates`, exercise library | legacy | n/a | proxy | `/trainer/builder` | Mine useful builder logic |
| `/dashboard/subscribe` | trainer/admin | Legacy subscribe redirect | legacy redirect | redirect to `/dashboard` | legacy | -> `/dashboard` | proxy | payments/sales | Decide/remove later |
| `/settings` | trainer/admin | Legacy settings | partially Supabase-backed + demo | `profiles`, storage logos | legacy | n/a | proxy? via matcher `/dashboard` only no | `/trainer/settings` | Risk: not proxy-covered if route `/settings` |
| `/api/ensure-profile` | server | Create/update profile | partially Supabase-backed | service role `profiles`, `trainer_clients` | canonical API | n/a | server only | signup/login | Needs security review |
| `/api/link-trainer` | server | Link client to trainer | partially Supabase-backed | bearer token + service role | canonical API | n/a | bearer in handler | signup/login | Good pattern; review RLS/service role |
| `/api/seed-test-users` | server | Seed demo/test users | dev/test | service role profiles | experimental | n/a | no proxy evidence | login test admin | Lock down before production |
| `/api/create-payment-link` | server | Create checkout URL | partial/payment stub | env URL only | experimental | n/a | no auth evidence | payment webhook | Needs auth/provider design |
| `/api/webhooks/payment` | server | Payment webhook | partially Supabase-backed | secret + service role | candidate canonical | n/a | secret validation | sales/program purchase | Ensure provider-specific verification |
| `/api/send-reminder` | server | Telegram reminder | partially Supabase-backed | service role profiles + Telegram | experimental | n/a | no auth evidence | automation | Needs protection |
| `/api/notify-complete` | server | Notify trainer completion | partial | Supabase + Telegram | experimental | n/a | proxy | workout completion | Converts no persisted review task |
| `/api/tg-webhook` | server | Telegram webhook | partially Supabase-backed | service role profiles + Telegram | experimental | n/a | no secret evidence | Telegram bot | Needs webhook verification |
| `/api/trainer/programs` | server | Create/patch program | partially Supabase-backed | bearer auth + service role | candidate canonical | n/a | bearer in handler | builder/programs | Keep; expand tests |
| `/api/test-env` | server | Env diagnostic | dev/test | env booleans | experimental | n/a | no auth evidence | none | Hide/remove before production |

## Explicit Conflicts

### `/trainer/*` vs `/dashboard/*`

Evidence:

- New TrainerShell primary nav points to `/trainer/dashboard`, `/trainer/clients`, `/trainer/library`, `/trainer/builder`: `components/trainer/trainer-shell.tsx:54-59`.
- Login still sends trainers to `/dashboard`: `app/login/page.tsx:155`, `app/login/page.tsx:196`, `app/login/page.tsx:284`, `app/login/page.tsx:289`.
- Proxy protects `/dashboard/:path*`, not `/trainer/*`: `proxy.ts:42-44`.

Recommendation: choose `/trainer/dashboard` or `/dashboard` as canonical. Based on current navigation, `/trainer/dashboard` is candidate canonical, but no code change is made in this audit.

### `app/client/*` vs `app/(client)/*`

Evidence:

- New routes exist under `app/client/*`.
- Legacy group still exposes `/check-in`, `/history`, `/programs`, `/today`, `/workout/free`, `/client/[id]`.
- New `/client/progress`, `/client/activity`, `/client/workouts` redirect to legacy routes outside demo mode: `app/client/progress/page.tsx:11`, `app/client/activity/page.tsx:11`, `app/client/workouts/page.tsx:11`.

Recommendation: decide which namespace owns client product before adding more screens.

### `/client/me` vs `/client/dashboard`

Evidence:

- `/client/dashboard` checks Supabase user and redirects to `/client/me`: `app/client/dashboard/page.tsx:10-21`.

Recommendation: treat `/client/me` as candidate canonical and keep `/client/dashboard` only as redirect if founder accepts.

## Engineering Review

**Overall verdict:** route map confirms a working build but an unresolved product topology.

**Главные риски:** canonical conflicts, incomplete auth coverage, demo-backed screens masquerading as product routes.

**Блокеры следующего этапа:** founder must choose canonical trainer and client route families.

**Нужны ответы:** final route policy, legacy redirect policy, MVP navigation policy.
