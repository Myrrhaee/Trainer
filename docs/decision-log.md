# Decision Log

Дата создания: 2026-07-10  
Назначение: фиксировать только решения, подтвержденные кодом или существующими документами. Предположения и будущие рекомендации не считаются принятыми решениями.

## Status Values

- proposed
- accepted
- rejected
- superseded

## Decisions

| ID | Дата | Область | Решение | Статус | Основание | Последствия | Связанные файлы | Кто принял решение |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | unknown | Demo mode | В проекте реализован demo mode с ролями `trainer` и `client`, localStorage session и test emails. | accepted | Код содержит `DemoRole`, `DEMO_STORAGE_KEY`, `DEMO_TRAINER`, `DEMO_CLIENT`, `isDemoModeEnabled`, `writeDemoSession`. | Многие экраны могут показывать demo UI без реальных данных. | `lib/demo-mode.ts:3-110`, `app/login/page.tsx:136-155` | unknown |
| D-002 | unknown | Client routes | `/client/dashboard` не является полноценным экраном и перенаправляет пользователя на `/client/me`. | accepted | `router.replace("/client/me")` after Supabase user check. | `/client/me` фактически candidate home клиента; `/client/dashboard` является shim. | `app/client/dashboard/page.tsx:7-21` | unknown |
| D-003 | unknown | Trainer navigation | Основная навигация `TrainerShell` показывает 4 пункта: Главная, Клиенты, Библиотека, Шаблоны. | accepted | `trainerNav` array. | Остальные trainer routes доступны через command palette/links, но не primary nav. | `components/trainer/trainer-shell.tsx:54-59`, `components/trainer/trainer-shell.tsx:82-90` | unknown |
| D-004 | unknown | Trainer profile | Профиль спортсмена через тренера использует mock-backed `AthleteProfile` и кастомные tabs. | accepted | Route renders `ClientProfilePage`; page uses `getAthleteProfile`; tabs defined in component. | Экран визуально развит, но не production-backed. | `app/trainer/clients/[clientId]/page.tsx:1-4`, `components/trainer-os/client-profile/client-profile-page.tsx:32-60`, `:123-160` | unknown |
| D-005 | unknown | Client demo screens | `/client/workouts`, `/client/progress`, `/client/activity` показывают demo pages in demo mode and redirect outside demo. | accepted | `isDemoModeEnabled()` branches and redirects. | New client pages are not yet real-data standalone screens. | `app/client/workouts/page.tsx:3-11`, `app/client/progress/page.tsx:3-11`, `app/client/activity/page.tsx:3-11` | unknown |
| D-006 | unknown | Exercise library | В проект добавлена новая таблица/модель `exercise_library` с RLS and copy function, while legacy `exercises` fallback remains in code. | accepted | Migration creates `exercise_library`; `lib/exercise-library.ts` reads new table and legacy fallback. | Exercise domain has migration path but still supports legacy source. | `supabase/migrations/20260402120000_exercise_library.sql:1-57`, `lib/exercise-library.ts:94-267` | unknown |
| D-007 | unknown | Reputation system | Репутация, Achievement Score и Титулы описаны как разные сущности в документации. | proposed | Document explicitly separates systems. | Concept is documented but no DB-backed user state confirmed. | `docs/athlete-reputation-rank-system.md:5-13`, `docs/achievement-system-v1.md:65-90`, `docs/titles-v1.md:31-40` | unknown |
| D-008 | unknown | Payment webhook | Payment webhook uses `PAYMENT_SECRET_KEY` validation before Supabase writes. | accepted | `validateSecret` function and early validation branch. | Webhook has generic secret protection, but provider-specific signature is not confirmed. | `app/api/webhooks/payment/route.ts:72-101` | unknown |
| D-009 | unknown | Proxy/auth | Current proxy matcher protects `/dashboard/:path*` and `/api/notify-complete` only. | accepted | `config.matcher` array. | New `/trainer/*` and `/client/*` route families are not proxy-protected by current matcher. | `proxy.ts:42-44` | unknown |

## Empty Template For Future Decisions

| ID | Дата | Область | Решение | Статус | Основание | Последствия | Связанные файлы | Кто принял решение |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-010 | YYYY-MM-DD | TBD | TBD | proposed | TBD | TBD | TBD | TBD |

## Notes

- Decisions with `unknown` date/owner are implementation decisions inferred from existing code, not from an explicit founder statement.
- `proposed` means the idea exists in docs/code but acceptance as product policy is not proven.
- Do not add aspirational roadmap items here unless they are explicitly accepted.

## Engineering Review

**Overall verdict:** decision history is under-specified. Code contains several implicit decisions, but ownership/date/rationale are missing.

**Главные риски:** future work may treat implemented experiments as product decisions.

**Блокеры следующего этапа:** founder needs to mark route/data/model decisions as accepted/rejected.

**Founder decisions needed:** canonical trainer home, canonical client namespace, MVP nav, AttentionItem model, production auth strategy.
