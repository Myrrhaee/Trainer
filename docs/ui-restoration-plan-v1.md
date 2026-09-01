# AI Strength Coach UI Restoration Plan V1

Дата: 2026-08-24
Статус: proposed
Область: trainer cabinet, athlete profile, client cabinet, shared progression identity

## 1. Purpose

Вернуть принятую продуктовую глубину интерфейса поверх canonical PostgreSQL/backend-контура без отката авторизации, прав доступа, repository/service boundaries и core workout workflow.

Этот этап не является редизайном с нуля. Сохранившиеся demo-компоненты и ранее принятые UX-решения используются как визуальная и сценарная спецификация. Canonical backend остаётся источником правды.

## 2. Confirmed diagnosis

Текущие production-path маршруты при `NEXT_PUBLIC_DEMO_MODE=false` переключены на минимальные canonical-компоненты:

- `/trainer/clients/[clientId]` использует `components/trainer/canonical-athlete-profile.tsx`;
- `/client/me` использует `components/client/canonical-client-home.tsx`;
- demo-режим продолжает использовать расширенный профиль из `components/trainer-os/client-profile/`;
- старый UI достижений, прогресса, истории, репутации и профиля не удалён, но не подключён к canonical read models;
- accepted primary trainer navigation сознательно ограничена пятью разделами.

Следовательно, проблема состоит не в потере исходного дизайна, а в отсутствии UI reintegration после backend foundation.

## 3. Restoration principles

1. Не откатывать canonical PostgreSQL, application sessions, capability checks и TrainerAthleteRelation authorization.
2. Не возвращать mock/localStorage как источник правды для production-path экранов.
3. Не создавать второй новый дизайн, пока сохранившийся accepted UI решает задачу.
4. Разделять shared athlete facts и role-specific actions.
5. Клиент и тренер должны видеть одну сущность спортсмена, но с разными правами и рабочими действиями.
6. Пустые canonical данные должны показывать спроектированный empty state, а не приводить к исчезновению целого раздела.
7. Достижения, титулы, ранг и репутация должны иметь единую модель и общий read model для обеих ролей.
8. Hidden MVP routes не возвращаются в primary navigation только ради визуального паритета.

## 4. What remains accepted

Следующие canonical решения сохраняются:

- TrainerShell и пятираздельная primary navigation;
- Dashboard как главная тренера;
- живая карта команды;
- рабочая очередь и журнал активности;
- roster спортсменов с next action;
- Quick Assign как contextual drawer/dialog;
- WorkoutTemplate Builder и библиотека шаблонов;
- assignment, execution, review и feedback как core workflow;
- PostgreSQL как source of truth;
- provider-neutral repository/service boundaries;
- capability-based auth и relation authorization.

## 5. Restoration matrix

| Surface | Current canonical state | Preserved richer source | Restoration decision | Data/backend gap | Priority |
|---|---|---|---|---|---|
| Athlete profile header | Initials, name, accepted date, assign/review actions | `components/trainer-os/client-profile/client-profile-page.tsx` and profile headers | Restore compact/full adaptive Hero, title and rank status | Athlete identity/profile read model; rank read model | R1 |
| Athlete Overview | Not present | `overview-tab.tsx` | Restore overview as first tab | Profile, goals, preferences, timeline and note reads | R1 |
| Achievements | Not present | `overview-tab.tsx`, `achievement-catalog-dialog.tsx`, `achievement-catalog.ts` | Restore shared achievement strip and catalog dialog | Canonical definitions, athlete awards and progress | R1 |
| Titles and reputation | Not present in canonical profile | rich profile header and rank dialog | Restore as read-only athlete status for trainer | Canonical title unlocks, reputation and rank rules | R1 |
| Athlete Training tab | Replaced by one current-status block | `training-tab.tsx` | Restore next plan, history, review queue and top movements | Aggregate assignment/session read model | R2 |
| Athlete Progress tab | Not present | `progress-tab.tsx` | Restore weight, strength, measurements and progress photos | Measurements, exercise metrics and media APIs | R2 |
| Coach notes | Not present | `overview-tab.tsx` | Restore private notes after authorization/storage contract | Trainer-private note entity and audit policy | R2 |
| Athlete feed | Not present | `overview-tab.tsx` | Restore only product-relevant events, check-ins and photos | Timeline projection and media ownership | R3 |
| Client home | Assignment-only canonical page | `app/client/me/page.tsx`, demo cabinet and runtime client home | Restore identity, current state, next action and compact progress | Shared athlete summary read model | R2 |
| Client achievements | Not present in canonical home | `AchievementsStrip` and demo cabinet | Restore using the same achievement data as trainer view | Shared achievement API/read model | R2 |
| Client activity/progress | Production path redirects or is minimal | runtime/demo activity and progress components | Restore canonical routes after real data adapters exist | Session history, measurements and aggregate metrics | R3 |
| Client profile/settings | Fragmented across legacy pages | existing profile/settings components | Consolidate without inventing another athlete identity model | Profile mutation rules and media storage | R3 |
| Access and payment | Not present in canonical athlete profile | `management-tab.tsx` | Preserve as deferred surface; do not block core restoration | Billing/subscription source of truth not accepted | R4 |

## 6. Deliberately hidden, not accidentally removed

The following routes remain preserved but outside primary MVP navigation until independent user evidence exists:

- `/trainer/attention`, because Dashboard owns the primary queue;
- `/trainer/messages`, currently experimental;
- `/trainer/calendar`, pending evidence of an independent recurring job;
- `/trainer/programs`;
- `/trainer/automation`;
- `/trainer/insights`;
- `/trainer/reports`;
- `/trainer/sales`.

UI Restoration must not automatically place these routes back in the sidebar.

## 7. Proposed canonical data additions

This section is a gap list, not an accepted schema design.

- AthleteProfile: biography, goal, training context, preferences and public profile fields.
- AthleteMeasurement: body weight and body measurements with timestamps and source.
- ProgressPhoto: athlete-owned media with visibility and deletion rules.
- AchievementDefinition: stable catalog entry and unlock/progress rule metadata.
- AthleteAchievement: awarded/in-progress athlete state with timestamps and evidence.
- TitleDefinition and AthleteTitle: unlocked titles and current selected title.
- ReputationSnapshot or deterministic reputation projection: current rank and level.
- CoachNote: trainer-private note scoped to an active/historical relation policy.
- AthleteTimeline projection: workout, feedback, check-in, measurement, photo and achievement events.

Before migrations, architecture must decide which values are stored facts and which are deterministic projections.

## 8. Delivery phases

### R0. Contract and visual baseline

- Accept this restoration boundary.
- Mark screenshots as canonical-current or demo-reference.
- Map each preserved component to a canonical read/write contract.
- Freeze route names and role permissions.

### R1. Athlete identity and Overview

- Replace the sparse canonical athlete profile body with the accepted profile frame.
- Restore adaptive Hero, Overview tab, rank, title and achievements.
- Use canonical empty states where data entities do not yet exist.
- Keep assign and review actions connected to current backend services.

### R2. Core working tabs and client parity

- Connect Training tab to assignments, sessions and reviews.
- Connect Progress tab to the first accepted real metrics.
- Restore the client home hierarchy and shared achievement identity.
- Ensure the trainer and client see consistent facts.

### R3. Rich context

- Add athlete timeline, check-ins, progress photos and coach notes.
- Restore client activity and fuller progress navigation.
- Validate mobile layouts and long-data states.

### R4. Deferred commercial surfaces

- Decide billing, subscription and access ownership separately.
- Restore payment/access UI only after a canonical commercial model is accepted.

## 9. Acceptance criteria

Restoration is complete only when:

- production-path routes render the accepted information architecture without enabling demo mode;
- no production-path screen imports inline/mock/demo athlete facts;
- trainer and client views use the same athlete, achievement and progress identities;
- role permissions prevent trainer edits to athlete-owned profile/photo fields;
- private coach notes are never visible to the athlete;
- missing data produces explicit empty states;
- assignment, execution, review and feedback continue to pass canonical E2E tests;
- desktop `1440x1000` and mobile `390x844` screenshots pass visual review;
- no major section disappears merely because its current dataset is empty;
- visual parity is reviewed alongside functional, auth and persistence checks.

## 10. Required architect output

The architect should produce:

- component reuse map;
- canonical read models per screen;
- entity/projection decisions for achievements and reputation;
- API/service ownership;
- role and privacy matrix;
- migration sequence with backward compatibility;
- removal criteria for demo adapters after parity.

## 11. Required designer output

The designer should produce:

- screen hierarchy for trainer Athlete Profile and client cabinet;
- full and compact profile header states;
- Overview, Training, Progress and deferred Access layouts;
- achievements/rank hierarchy shared between roles;
- empty, loading, error and long-data states;
- desktop and mobile transition behavior;
- explicit keep/change/remove annotations against current screenshots.

## 12. Founder decisions required

1. Are achievements, titles and reputation part of closed-alpha MVP or only visual identity for the next release?
2. Which profile fields are athlete-owned, trainer-visible and trainer-editable?
3. Are progress photos required in the first external pilot with real data?
4. Are coach notes required before the first trainer pilot?
5. Is payment/access intentionally deferred from the athlete profile?
6. Should the athlete feed contain social posts, or only product-generated training events?

## 13. Evidence

- `app/trainer/clients/[clientId]/page.tsx`
- `components/trainer/canonical-athlete-profile.tsx`
- `components/trainer-os/client-profile/client-profile-page.tsx`
- `components/trainer-os/client-profile/overview-tab.tsx`
- `components/trainer-os/client-profile/training-tab.tsx`
- `components/trainer-os/client-profile/progress-tab.tsx`
- `components/trainer-os/client-profile/management-tab.tsx`
- `components/trainer-os/client-profile/achievement-catalog-dialog.tsx`
- `app/client/me/page.tsx`
- `components/client/canonical-client-home.tsx`
- `components/trainer/trainer-shell.tsx`
- `docs/trainer-internal-pilot-v1.md`
- `docs/mvp-scope-v1.md`
- `docs/decision-log.md`
- `docs/gpt-project-screenshots/`
