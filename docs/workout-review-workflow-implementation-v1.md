# Workout Review Workflow Implementation V1

Дата: 2026-07-16

Статус: implemented local demo workflow; backend persistence intentionally deferred

## 1. Scope

Stage 9 стабилизирует trainer review завершённой `WorkoutSession` в двух поверхностях: быстрый drawer и каноническая страница `/trainer/review/[workoutId]`. Реализация локальная, demo-backed и не меняет API, auth, PostgreSQL, Supabase schema или migrations.

## 2. Before state

- Full page использовала собственный inline `WorkoutReview` и при неизвестном ID подставляла сессию Артёма (`app/trainer/review/[workoutId]/workout-review-client.tsx:52-73`, `:137-350`, `:367-369`).
- Drawer принимал только `TeamClient` и показывал одинаковые module-level summary, exceptions и comment для любого клиента (`components/trainer-os/workout-review/workout-review-drawer.tsx` до Stage 9).
- Full page меняла boolean `reviewed`; drawer вызывал parent callbacks. Общей feedback/resolution model не было.
- Dashboard, Athlete Profile и Activity Drawer передавали client/event context, но не всегда стабильный session ID.

## 3. Root causes and duplicated models

1. Session identity была отделена от drawer и нестрогой на page.
2. План, факт, comments и client identity хранились в несовместимых mock shapes.
3. Feedback был состоянием конкретного React component, а не review session.
4. Origin context не имел единого `from`/`attentionItem` контракта.
5. Визуальный `reviewed` не моделировал успешное сохранение, failure или manual resolution.

## 4. Canonical Review read model

`components/trainer-os/workout-review/review-model.ts` определяет provider-neutral `WorkoutReviewDetails`.

- `session.id` является единственным ключом выбора.
- `athlete`, `assignment`, `signals`, `clientComment`, `exercises`, `feedback` и `attentionContext` принадлежат одному объекту.
- Planned prescription и actual logs разделены.
- Summary вычисляется из exercise/set facts функцией `buildReview`.
- `getWorkoutReviewDetails` возвращает `null` для неизвестного ID и не имеет fallback на первую запись.

## 5. Demo sessions

| Session ID | State | Дополнительное покрытие |
| --- | --- | --- |
| `maria-volkova-2026-06-09` | normal completed | no client comment, AI available |
| `artem-smirnov-2026-06-10` | meaningful deviations | AI available, first send fails, retry succeeds |
| `liza-gromova-2026-06-18` | discomfort signal | missing assignment, original wording, AI unavailable |
| `maxim-orlov-2026-06-18` | partial completion | skipped exercise, missing sets |
| `irina-kozlova-2026-06-12` | session without set logs | completion/comment remains reviewable |
| `egor-nikitin-2026-06-14` | already resolved | immutable acknowledgement and follow-up action |

Все имена и факты являются вымышленными demo-данными.

## 6. Entry contexts

- Dashboard передаёт `from=dashboard`, `attentionItem` и queue marker.
- Athlete Profile открывает ту же session через `getDefaultReviewSessionId` и передаёт `from=profile` при promotion на full page.
- Workout history открывает `from=history` без искусственного AttentionItem.
- Direct URL работает без context marker.
- Marker не содержит комментарии или чувствительный payload и не участвует в выборе session.

## 7. Drawer role

`workout-review-drawer.tsx` показывает identity, compact summary, максимум три приоритетных signal, original client comment, ключевые отклонения и shared feedback panel. Полные sets остаются на detailed page. Drawer занимает `calc(100vw - 12px)` на mobile, предупреждает о draft при X/Escape/footer close и сохраняет draft при promotion.

## 8. Full page role

`workout-review-page.tsx` является канонической подробной поверхностью. Она показывает compact context header, summary, signals, comment, все exercises/sets, previous context, sticky feedback, profile/back actions и optional Quick Assign. Страница не строит BI score и не требует следующего назначения для resolution.

## 9. Exception-first hierarchy

Порядок одинаков для drawer/page:

1. session summary;
2. safety/deviation signals;
3. original client comment;
4. skipped/incomplete/modified exercises;
5. остальные results;
6. trainer action.

Signals сортируются с discomfort первым и содержат `sourceLabel`, связывающий UI с конкретным фактом.

## 10. Plan vs actual

`ReviewExercise` хранит `planned` и `actual` отдельно. UI различает completed, incomplete, skipped, modified и added. Target weight показывается только при наличии. Missing plan, repetitions и set logs отображаются явно, без нулей или вымышленных значений. Set details имеют table/list semantics с отдельными planned/actual cells.

## 11. Discomfort handling

Discomfort отображается до списка упражнений и AI. Сохраняются original text, area, severity и source exercise. UI не ставит диагноз, не предлагает лечение и не меняет программу автоматически. AI draft в discomfort demo недоступен; ручной workflow остаётся полноценным.

## 12. TrainerFeedback model

`review-store.ts` хранит session-scoped draft, feedback records и resolution. После explicit send создаётся `TrainerFeedbackRecord` с kind, body, author и timestamp. Первый sent feedback делает item resolved только после успешного demo save. Sent records read-only; correction создаёт отдельный `follow-up`.

## 13. Short acknowledgement

Shared panel предлагает три нейтральных текста, переносит выбранный текст в редактируемое поле и требует отдельного `Отправить`. После save record получает kind `acknowledgement` и закрывает item по тем же правилам, что detailed feedback.

## 14. Manual resolution

Secondary action `Закрыть без сообщения` открывает confirmation dialog. Trainer выбирает одну из причин или вводит `Другое`. Успех создаёт локальный resolution record без `TrainerFeedback`. Empty custom reason блокирует подтверждение.

## 15. AI draft prototype

Реальных AI/API вызовов нет. Модель поддерживает available, generating, unavailable, failed и no-context presentation states. Available draft имеет provenance, копируется в обычный editable textarea и никогда не отправляется автоматически. Manual editor не зависит от AI.

## 16. Next assignment

Quick Assign открывается после resolution или независимо из context header и получает `TeamClient`, построенный из review athlete. Внутренний Quick Assign UX не менялся. Assignment является отдельным local action и не блокирует review resolution.

## 17. Return and next behavior

- Dashboard: receipt, `Следующий клиент` по safe session marker и возврат к `#attention-heading`.
- Profile/history: возврат к тому же athlete profile и optional assign.
- Direct: профиль и главная тренера.
- Навигация не создаёт persistent authoritative queue state.

## 18. Empty/error states

Реализованы unknown session, missing assignment, no sets, partial session, no comment, AI unavailable/no context, fail-once feedback save, already resolved и follow-up. Failure сохраняет draft и не создаёт resolution. Unknown ID не раскрывает чужого athlete/session.

## 19. Mobile behavior

Проверено на `390×844`: full page и drawer имеют `scrollWidth = 390`; drawer width `378px`, left offset `12px`; sticky footer не расширяет viewport; important signal и comment идут до exercises; touch actions имеют minimum height 44px. Глобальная ширина других Sheets не менялась.

## 20. Accessibility

- Структурные headings/regions и labelled textarea.
- Signals имеют icon + text labels, а не только цвет.
- Feedback modes используют `aria-pressed`; acknowledgement options доступны как buttons.
- Manual resolution использует Radix Dialog и labelled native select.
- Save failure использует `role=alert`; receipts используют live regions.
- Set details имеют row/columnheader/cell semantics.
- Radix Sheet обеспечивает focus trap; browser QA подтвердил возврат focus на profile trigger после close.

## 21. Component preservation matrix

| Existing part | Stage 9 status | Notes |
| --- | --- | --- |
| Drawer shell | adapted | Сохранена Sheet-поверхность, данные/actions заменены |
| Full page context/profile identity | adapted | Компактный header и source-aware return |
| Plan-vs-actual language | shared/adapted | Общие typed components для drawer/page |
| Exercise result cards | adapted | Exception ordering и expandable set details |
| Sticky feedback concept | shared/adapted | Один shared feedback panel/store |
| Old route-local `workout-review-client.tsx` | preserved, not rendered | Candidate for later cleanup; файл не удалён |
| Exercise technique detail sheet | temporarily hidden | Не нужен для core Review completion; старый код сохранён |
| Old static drawer mocks | replaced | Duplicate data removed from rendered drawer |
| Quick Assign internals | preserved as-is | Получает athlete adapter из Review model |

## 22. Files changed

- Route: `app/trainer/review/[workoutId]/page.tsx`.
- Review module: `components/trainer-os/workout-review/*`.
- Minimal Dashboard markers: `trainer-home-page.tsx`, `attention-workspace.tsx`, `activity-drawer.tsx`.
- Minimal Athlete Profile markers: `client-profile-page.tsx`, `profile-read-model.ts`.
- This document only. `docs/decision-log.md` is unchanged because Stage 9 implements already accepted D-048/D-049/D-043-D-046 decisions.

## 23. Visual QA

Desktop/default viewport:

- normal, deviations, discomfort, partial, no assignment, no sets, no comment and unknown session rendered correctly;
- Dashboard drawer and Profile drawer selected the same Artem session as full page;
- fail-once retained draft and item, retry resolved it;
- acknowledgement, manual reason, already-resolved receipt, follow-up and correct Quick Assign athlete verified;
- unknown session contained no Artem fallback.

Mobile `390×844`:

- no horizontal overflow;
- discomfort source text visible before exercise list;
- full page and 378px drawer usable;
- footer/actions remained within viewport.

Temporary screenshots were not added to Git.

## 24. Known limitations

- Workflow is demo/local; refresh persistence uses session-scoped browser storage, not backend records.
- Dashboard queue removal remains parent-local and is not authoritative across tabs.
- Demo fail-once behavior is intentionally attached to the Artem session.
- Full persistence, concurrency/idempotency, permission denial and external delivery states await backend Stage.
- Existing unrelated Recharts build warnings remain.
- Old route-local page implementation remains on disk for later evidence-based cleanup.

## 25. Deferred decisions

- Final backend IDs/status enums and command transport.
- Cross-tab authoritative resolution and draft conflict policy.
- Whether AI provenance/model metadata is persisted.
- Whether exercise technique detail belongs in canonical Review.
- Notification delivery channel and client read receipt presentation.

## 26. Acceptance criteria results

| Criterion | Result |
| --- | --- |
| Strict `workoutId`; safe unknown | Pass |
| One read model for drawer/page | Pass |
| Shared session draft and lossless promotion | Pass |
| Exception-first and original discomfort/comment | Pass |
| Detailed feedback and acknowledgement | Pass, local demo |
| Manual resolution with reason | Pass, local demo |
| AI optional and explicit send | Pass |
| Failure does not resolve; retry works | Pass |
| Sent feedback immutable; follow-up separate | Pass |
| Optional next assignment; correct athlete | Pass |
| Dashboard/Profile/direct return context | Pass |
| Mobile no horizontal overflow | Pass |
| No backend/schema/Builder redesign | Pass |
| Lint | Pass |
| Production build | Pass with two pre-existing Recharts size warnings |
