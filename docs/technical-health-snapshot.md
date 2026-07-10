# Technical Health Snapshot

Дата аудита: 2026-07-10  
Команды выполнены без исправления кода.

## Git State

Current branch:

```text
main
```

Last commits:

```text
9f5e9f9 your message
db43408 your message
1e1f7eb your message
929f646 your message
ef37f3e your message
```

Baseline before creating these audit docs:

```text
101 changed paths
39 modified
2 deleted
60 untracked
```

Evidence from `git status --short` before audit docs:

```text
 M app/(admin)/dashboard/analytics/page.tsx
 M app/(admin)/dashboard/library/page.tsx
 M app/(admin)/dashboard/page.tsx
 M app/(admin)/dashboard/programs/[id]/page.tsx
 M app/(admin)/dashboard/programs/page.tsx
 M app/(admin)/dashboard/subscribe/page.tsx
 M app/(admin)/layout.tsx
 M app/(admin)/settings/page.tsx
 M app/(client)/client/[id]/page.tsx
 M app/(client)/client/[id]/program/[programId]/page.tsx
 M app/(client)/explore/[id]/page.tsx
 M app/(client)/explore/page.tsx
 M app/api/send-reminder/route.ts
 M app/api/tg-webhook/route.ts
 M app/api/webhooks/payment/route.ts
 M app/client/dashboard/page.tsx
 M app/client/me/page.tsx
 M app/client/settings/page.tsx
 M app/globals.css
 M app/layout.tsx
 M app/login/page.tsx
 M app/trainer/dashboard/page.tsx
 M app/trainers/TrainersCatalogClient.tsx
 M components/BackgroundFluid.tsx
 M components/BackgroundShader.tsx
 M components/Footer.tsx
 M components/client-nav.tsx
 M components/client/ShareCard.tsx
 M components/client/WeightTracker.tsx
 M components/landing/landing-page.tsx
 M components/nav-bar.tsx
 D components/subscription-guard.tsx
 M components/ui/dialog.tsx
 M components/ui/input.tsx
 M components/ui/label.tsx
 M components/ui/sheet.tsx
 M lib/auth-context.tsx
 M lib/utils.ts
 D middleware.ts
 M package-lock.json
 M package.json
?? GPT_PRODUCT_CONTEXT.md
?? PROJECT_AUDIT_FOR_CHATGPT.md
?? TRAINER_CABINET_PHASE_1.md
?? app/(admin)/dashboard/clients/
?? app/(client)/check-in/
?? app/(client)/history/
?? app/(client)/profile/
?? app/(client)/programs/
?? app/(client)/today/
?? app/(client)/workout/
?? app/api/trainer/
?? app/client/activity/
?? app/client/library/
?? app/client/progress/
?? app/client/workouts/
?? app/trainer/attention/
?? app/trainer/automation/
?? app/trainer/builder/
?? app/trainer/calendar/
?? app/trainer/clients/
?? app/trainer/insights/
?? app/trainer/library/
?? app/trainer/messages/
?? app/trainer/programs/
?? app/trainer/reports/
?? app/trainer/review/
?? app/trainer/sales/
?? app/trainer/settings/
?? components/client/mobile-cabinet-nav.tsx
?? components/demo/
?? components/exercise-category-icon.tsx
?? components/trainer-os/
?? components/trainer/
?? docs/
?? lib/demo-data.ts
?? lib/demo-mode.ts
?? lib/exercise-categories.ts
?? lib/exercise-library.ts
?? proxy.ts
?? public/Home.png
?? public/Training.png
?? public/achievements/
?? public/category-icons/
?? public/exercises/
?? public/ranks/
?? public/titles/
?? public/trainer/
?? public/training/
?? scripts/
?? src/
?? supabase/migrations/20260402120000_exercise_library.sql
?? supabase/migrations/20260402143000_seed_system_exercise_library.sql
?? supabase/migrations/20260403120000_trainer_workout_reviews.sql
?? supabase/migrations/20260404120000_trainer_builder_templates.sql
?? supabase/migrations/20260405120000_trainer_settings.sql
?? supabase/migrations/20260406120000_trainer_client_messages.sql
?? supabase/migrations/20260407120000_trainer_automation_rules.sql
?? supabase/migrations/20260408120000_trainer_client_insights.sql
?? supabase/migrations/20260409120000_trainer_client_reports.sql
?? test-results/
```

## Modified/Untracked By Semantic Group

| Group | Files/dirs | Meaning |
| --- | --- | --- |
| Legacy admin/dashboard | `app/(admin)/*` modified; new `app/(admin)/dashboard/clients/` | Existing legacy route family changed and expanded. |
| Legacy client routes | `app/(client)/*` modified/new | Older client execution/check-in/history/program routes active. |
| New client routes | `app/client/activity`, `library`, `progress`, `workouts`; modified `me`, `settings`, `dashboard` | New client namespace is active but mixed demo/redirect. |
| New trainer routes | `app/trainer/*` untracked except dashboard modified | New trainer OS route family. |
| Trainer/client components | `components/trainer-os`, `components/trainer`, `components/demo`, `components/client/mobile-cabinet-nav.tsx` | Major new UI component surface. |
| Data/utilities | `lib/demo-data.ts`, `lib/demo-mode.ts`, `lib/exercise-*`, `proxy.ts` | New demo/data/auth/proxy infrastructure. |
| Docs/assets | `docs/`, `public/achievements`, `public/ranks`, `public/titles`, `public/exercises` | Product docs and asset catalogs. |
| Deleted | `components/subscription-guard.tsx`, `middleware.ts` | Old guard/middleware removed from working tree, replacement `proxy.ts` untracked. |
| Test artifacts | `test-results/` | Contains `.last-run.json`; no test script found. |

## Lint

Command:

```bash
npm run lint
```

Result:

```text
Exit code: 0
> trainer@0.1.0 lint
> eslint
```

## Build

Command:

```bash
npm run build
```

Result:

```text
Exit code: 0
Next.js 16.1.6 (Turbopack)
Compiled successfully
Running TypeScript ...
Generating static pages (54/54)
```

Build warning:

```text
The width(-1) and height(-1) of chart should be greater than 0,
please check the style of container, or the props width(100%) and height(100%),
or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
height and width.
```

This appears twice during static generation. Likely related to Recharts `ResponsiveContainer` usage. Evidence of Recharts usage includes:

- client demo progress: `components/demo/demo-client-cabinet.tsx:4945-5064`
- trainer profile progress: `components/trainer-os/client-profile/progress-tab.tsx:283-314`, `components/trainer-os/client-profile/progress-tab.tsx:452-483`
- client home charts: `app/client/me/page.tsx:654-706`, `app/client/me/page.tsx:1942-1980`

## TypeScript

Build TypeScript step passed. No TypeScript compile errors were emitted by `npm run build`.

## Hydration Risks

Known previous issue in conversation: hydration mismatch around Radix tab generated ids. Current trainer profile uses custom tab ids:

- deterministic tab ids: `components/trainer-os/client-profile/client-profile-page.tsx:123-130`
- tab panel id derives from active tab: `components/trainer-os/client-profile/client-profile-page.tsx:144-160`

Remaining general risks found by grep:

- `Date.now()` and `Math.random()` in client code: `app/(client)/client/[id]/page.tsx:858`, `app/(client)/client/[id]/page.tsx:994`, `lib/utils.ts:55`, `app/trainer/clients/page.tsx:348`.
- locale date formatting in render paths: many `toLocaleDateString("ru-RU")` usages, e.g. `app/client/me/page.tsx:221`, `components/trainer-os/client-profile/client-profile-ui.tsx:52`.
- Radix Tabs still used in other screens: `components/trainer/exercise-library-panel.tsx:77-88`, `app/trainer/settings/page.tsx:627-630`, legacy admin pages.

No active hydration error was reproduced in this audit because browser QA was not run.

## Routing Problems

Evidence:

- Trainer login redirects to `/dashboard`: `app/login/page.tsx:155`, `app/login/page.tsx:196`, `app/login/page.tsx:284`, `app/login/page.tsx:289`.
- TrainerShell primary nav points to `/trainer/*`: `components/trainer/trainer-shell.tsx:54-59`.
- `/client/dashboard` redirects to `/client/me`: `app/client/dashboard/page.tsx:10-21`.
- `/client/progress` and `/client/activity` redirect to `/history` outside demo: `app/client/progress/page.tsx:11`, `app/client/activity/page.tsx:11`.
- `/client/workouts` redirects to `/today` outside demo: `app/client/workouts/page.tsx:11`.

## Auth/Proxy Coverage

`proxy.ts`:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/api/notify-complete"],
};
```

Evidence: `proxy.ts:42-44`.

Coverage:

| Area | Coverage |
| --- | --- |
| `/dashboard/*` | proxy-protected |
| `/api/notify-complete` | proxy-protected |
| `/trainer/*` | not proxy-protected by matcher |
| `/client/*` | not proxy-protected by matcher |
| `/api/send-reminder` | no proxy evidence |
| `/api/tg-webhook` | no proxy/secret evidence in code |
| `/api/webhooks/payment` | protected by `PAYMENT_SECRET_KEY` validation |
| `/api/trainer/programs` | bearer auth in handler |

Some pages perform self-checks with Supabase user and redirect to login, for example:

- `app/client/dashboard/page.tsx:10-21`
- `app/client/settings/page.tsx:89-117`
- `app/trainer/clients/page.tsx:603-612`
- `app/trainer/builder/page.tsx:746-750`

## Tests

`package.json` scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

No `test`, `e2e`, `playwright`, `jest`, or `vitest` script was found. `rg --files | rg '(test|spec|playwright|vitest|jest|cypress)'` returned no test files. `test-results/.last-run.json` exists but appears to be an artifact only.

## Supabase Migrations

Existing migration files:

| File | Main entities/functions |
| --- | --- |
| `20250316120000_client_anthropometry.sql` | alters `profiles` anthropometry |
| `20250317100000_client_weight_height_target.sql` | alters `profiles` weight/height/target |
| `20260402120000_exercise_library.sql` | `exercise_library`, RLS, `copy_system_exercise_to_my_library` |
| `20260402143000_seed_system_exercise_library.sql` | seed exercise library, function update |
| `20260403120000_trainer_workout_reviews.sql` | `trainer_workout_reviews`, RLS, `mark_trainer_workout_review_seen` |
| `20260404120000_trainer_builder_templates.sql` | `trainer_builder_templates`, RLS |
| `20260405120000_trainer_settings.sql` | `trainer_settings`, RLS |
| `20260406120000_trainer_client_messages.sql` | `trainer_client_messages`, RLS |
| `20260407120000_trainer_automation_rules.sql` | `trainer_automation_rules`, RLS |
| `20260408120000_trainer_client_insights.sql` | `trainer_client_insights`, RLS |
| `20260409120000_trainer_client_reports.sql` | `trainer_client_reports`, RLS |

Potential schema gaps:

- No migration found for `payments`, despite legacy analytics using `payments`.
- No migration found for `client_programs`, despite payment webhook and client program access using it.
- No migration found for `assigned_programs`, despite multiple screens using it.
- No migration found for achievements/titles/reputation user state.
- No explicit `attention_items` table/function found.

## Potentially Dangerous API Routes And Webhooks

| Route | Risk | Evidence |
| --- | --- | --- |
| `/api/ensure-profile` | service role writes `profiles` and `trainer_clients`; relies on body `userId` | `app/api/ensure-profile/route.ts:24-39`, `:85-102` |
| `/api/link-trainer` | service role write path; better auth pattern because user comes from bearer token | `app/api/link-trainer/route.ts:13-35`, `:55-123` |
| `/api/seed-test-users` | test seed route available; no auth evidence | `app/api/seed-test-users/route.ts:76` |
| `/api/create-payment-link` | creates checkout URL without auth evidence | `app/api/create-payment-link/route.ts:11-31` |
| `/api/webhooks/payment` | has secret validation, but provider-specific signature validation not confirmed | `app/api/webhooks/payment/route.ts:72-101` |
| `/api/send-reminder` | sends Telegram messages; no auth/secret evidence | `app/api/send-reminder/route.ts:15-39`, `:79` |
| `/api/tg-webhook` | Telegram webhook has no explicit secret validation in audited lines | `app/api/tg-webhook/route.ts:35-54` |
| `/api/notify-complete` | proxy-protected, sends Telegram based on clientId | `proxy.ts:42-44`, `app/api/notify-complete/route.ts:21-46` |
| `/api/trainer/programs` | bearer auth + role check; service role write | `app/api/trainer/programs/route.ts:135-168`, `:190-224` |

## Engineering Review

**Overall verdict:** technically buildable. The repo is not clean and contains a large uncommitted product expansion. Main technical issue visible in automated checks is Recharts sizing warning; main architectural issue is route/data/auth inconsistency.

**Главные риски:** dirty Git tree, incomplete auth coverage for new routes, service-role API routes, schema/code mismatch, missing tests.

**Блокеры следующего этапа:** no canonical route decision; no canonical data model for attention/review/assignment/progress.

**Founder decisions needed:** canonical trainer route, legacy dashboard policy, production auth boundary, which experimental trainer pages remain visible.

**Additional needed files/answers:** applied remote Supabase schema, production env list, payment provider details, Telegram webhook setup, intended MVP route list.
