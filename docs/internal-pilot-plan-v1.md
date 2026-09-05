# Internal Pilot Plan v1

Дата: 2026-09-05. Статус: proposed pilot plan; external deployment not approved.
База: R4 commit `7b396f4e0ead054af7d63477bcccddb6384c9dbc`.

## 1. Pilot verdict

AI Strength Coach готов к малому внутреннему пилоту после закрытия deployment gate для выбранной среды. R4 закрыл известные P0/P1 в каноническом workout-feedback loop. Это не production-readiness и не разрешение на широкую бету.

Пилот проверяет один повторяемый цикл:

```text
Trainer sees state
-> assigns exact workout
-> athlete starts/resumes and records actual Sets
-> athlete completes Session
-> trainer receives exact Review
-> trainer sends Feedback
-> athlete sees the same Feedback and history
-> trainer makes the next decision
```

## 2. Goal and non-goals

Goal: доказать, что один тренер и его спортсмены могут многократно проходить core loop без инженерного вмешательства, потери фактов и расхождения между ролями.

Пилот не предназначен для:

- проверки Progress/R3F, Program, Motivation, AI, payments или sales;
- сбора всех идей о будущих функциях;
- оценки масштабных sales/onboarding процессов;
- замены security, deployment и accessibility gates;
- подтверждения метрик vanity-usage без связи с core workflow.

## 3. Recommended cohort

| Parameter | Recommendation | Reason |
| --- | --- | --- |
| Trainers | 1 | Один реальный strength coach даёт связный programming/review context. |
| Athletes | 2 у этого тренера | Достаточно для проверки разных паттернов, но остаётся управляемым. |
| Duration | 14 календарных дней | Даёт время на повторные решения после Feedback. |
| Minimum cycles | 3 на спортсмена, 6 всего | Проверяет recurrence, а не один демо-успех. |
| Preferred device mix | Тренер: desktop; спортсмены: их обычные mobile browsers | Проверяет реальный контекст без расширения когорты. |

Если за 14 дней не набрано 6 циклов, пилот не считается неудачным автоматически, но evidence недостаточно для GO. Нужно продлить пилот или явно зафиксировать insufficient evidence.

## 4. Participant requirements

Trainer:

- реально назначает силовые тренировки;
- смотрит plan/actual результаты и контекст;
- отправляет Feedback и принимает следующее programming-решение;
- готов кратко фиксировать затруднения после работы, а не во время каждого клика.

Athlete:

- может безопасно выполнить несколько запланированных тренировок в срок пилота;
- вводит фактические Sets и комментарий, если он нужен;
- возвращается к ответу тренера и следующему назначению;
- не обязан использовать Progress или любую другую не-core зону.

Все участники должны дать согласие на пилот и понимать, как сообщить о блокере. Не использовать общие учётные записи.

## 5. In-scope workflow

In scope:

- Trainer Dashboard, Athlete Profile, Templates/Editor и Quick Assign;
- Client Home и Workouts;
- Start/Resume, Save/Skip Sets и Completion;
- Trainer Queue/Review и Feedback;
- athlete completed detail/history;
- exact identity, retry/recovery, role isolation и повторное next decision.

Out of scope:

- Progress/R3F и strength analytics;
- Program/ProgramAssignment;
- Motivation, achievements, titles и reputation;
- AI-generated prescriptions or decisions;
- sales, payments, broad onboarding automation;
- Telegram, email delivery и Mini App как обязательная часть core-loop evidence;
- legacy cleanup и визуальный редизайн.

## 6. Readiness prerequisites

| Gate | Required state before first real workout |
| --- | --- |
| R4 source | Commit `7b396f4e0ead054af7d63477bcccddb6384c9dbc` deployed unchanged or by reviewed follow-up. |
| External migration 0016 | **HOLD** until the seven deployment steps below are approved and completed. |
| PostgreSQL | Canonical source of User/Relation/Template/Assignment/Session/Feedback facts; no Supabase/demo fallback. |
| Auth | Separate trainer and athlete identities; exact role/capability and relation verified. |
| Environment | Required public Supabase configuration may be present only to satisfy the existing eager legacy module; it must not become the canonical pilot data source. |
| Smoke | One synthetic full core loop in the pilot environment after migration, with no participant data. |
| Support | Pilot owner and one engineering contact named; participants know the stop/report channel. |
| Evidence | Observation log location created outside production UI; participant aliases agreed. |

External deployment sequence:

1. Confirm external database provenance and migration ledger.
2. Create and verify a recoverable backup.
3. Verify owners, grants, RLS and runtime role separation.
4. Review migration 0016 up/down and data-preservation implications.
5. Apply migration through the canonical migrator.
6. Run post-migration auth, role-isolation and synthetic core-loop smoke.
7. Record rollback versus forward-fix decision before admitting participants.

This document does not authorize or execute that rollout.

## 7. Accepted pilot limitation

**If a trainer assigns a workout while the athlete already has Client Home open, Client Home does not update automatically.**

Participant instruction:

> «Если тренер назначил тренировку, пока страница спортсмена уже открыта, обновите страницу.»

Это принято только для internal pilot. Это не ожидаемое финальное поведение продукта.

## 8. Observable success criteria

Pilot evidence is sufficient for GO review when:

- at least 6 full cycles complete, including at least 3 consecutive cycles for each athlete;
- trainer completes Dashboard -> Assignment -> Review -> Feedback -> next decision without DB/manual engineering intervention;
- each athlete can Start or Resume, save actual Sets, Complete, find Feedback and reopen completed history without intervention;
- no actual result is lost or silently partially persisted;
- each completed Session produces one expected Review item, without duplicate logical effects;
- Assignment, Session, Set and Feedback facts match between trainer and athlete views;
- the next exact Assignment can be issued after Feedback;
- no participant can access another participant's private facts;
- known stale-Home behavior is manageable with the documented refresh instruction;
- P0 remains 0 and P1 remains 0;
- all remaining recurring P2 observations receive an explicit fix/accept decision.

These are workflow facts, not engagement or retention claims.

## 9. Severity and stop rules

| Severity | Definition | Pilot response |
| --- | --- | --- |
| P0 | Data loss, privacy/security breach, or impossible core loop for the cohort. | Stop the pilot immediately; preserve evidence; do not ask participants to retry destructive actions. |
| P1 | A participant cannot reliably complete or recover the core workflow. | Stop the affected flow; engineering review before that flow resumes. |
| P2 | Workflow completes but is materially confusing or inefficient. | Record frequency and evidence; continue only with a safe, explicit workaround. |
| P3 | Polish or deferred quality issue. | Record in backlog; do not interrupt the pilot. |

Never change production data manually to make a failed cycle look successful. A retry is valid only when the UI/command contract presents it as safe. Every observation must be classified as `BLOCKER`, `EFFICIENCY PROBLEM`, `COPY/CLARITY`, `POLISH`, or `NEW FEATURE REQUEST` before prioritization.

## 10. Evidence plan

Use existing command receipts, audit facts and identifiers where available. Do not build a new analytics platform.

For each relevant transition record only:

- participant alias and role;
- date/time and cycle number;
- Assignment/Session ID, and Attention/Feedback ID when relevant;
- expected step and observed outcome;
- whether the user understood state and next action;
- hesitation or manual instruction;
- recovery and whether persisted facts were trusted;
- severity/category/frequency;
- redacted screenshot or video reference when needed.

Do not copy passwords, OTP values, cookies, health details, or full workout/comment text into research notes. Prefer exact IDs plus a short redacted description.

## 11. GO / NO-GO after pilot

GO to external beta requires all of:

- P0 = 0 and P1 = 0;
- repeated core loops completed for both athletes;
- no recurring manual DB/engineering intervention;
- remaining P2 items explicitly fixed or accepted with bounded impact;
- cross-role facts and retry behavior remain consistent;
- deployment, backup, ownership/RLS and security gates closed;
- external environment no longer depends on an ambiguous canonical data source.

NO-GO if any of:

- repeated manual DB repair is required;
- users regularly cannot determine the next action;
- command/retry behavior creates uncertainty or duplicate effects;
- Dashboard/Profile/client facts disagree;
- a privacy, RLS or foreign-identity defect is found;
- deployment provenance or data-preservation remains unresolved.

## 12. Pre-beta backlog, not pilot scope

- stale Client Home: revalidate on focus/return candidate;
- broad migration 0012 suspended Profile security review;
- Quick Assign Radix `DialogDescription` warning;
- timezone display consistency;
- eager Supabase public-config dependency;
- native zoom, physical-device, virtual-keyboard and screen-reader QA;
- legacy Activity/Progress/History cleanup;
- R3F Stable Exercise Identity prerequisite;
- Strength Progress remains deferred.

No item in this list is implemented by pilot preparation.

## 13. Decisions required before Day 0

- pilot environment and hostname;
- named trainer and two athlete aliases;
- start/end dates and pilot owner;
- engineering incident contact and reporting channel;
- explicit approval of the external 0016 rollout plan;
- explicit acknowledgement of stale Client Home behavior;
- location and retention period for redacted observation evidence.
