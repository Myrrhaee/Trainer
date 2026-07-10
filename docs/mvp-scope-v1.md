# MVP Scope V1

Дата: 2026-07-10  
Статус: proposed vertical MVP scope

## MVP Thesis

Первый MVP - один связанный вертикальный сценарий:

```text
Тренер назначает тренировку -> клиент выполняет -> тренер разбирает -> feedback отправлен -> следующий шаг назначен -> событие закрыто
```

Все, что не усиливает этот цикл, не является blocker для MVP.

## MVP Navigation

### Trainer Navigation

Основная MVP-навигация-кандидат:

- Главная: `/trainer/dashboard`;
- Клиенты: `/trainer/clients`;
- Шаблоны: `/trainer/builder` или отдельный templates route после уточнения;
- Библиотека: `/trainer/library`;
- Настройки: `/trainer/settings`.

Experimental, не в primary MVP-nav:

- `/trainer/automation`;
- `/trainer/insights`;
- `/trainer/reports`;
- `/trainer/sales`.

Legacy:

- `/dashboard/*`.

### Client Navigation

Кандидаты на каноническую клиентскую зону:

- `/client/me`;
- `/client/workouts`;
- `/client/progress`;
- `/client/activity`;
- `/client/library`;
- `/client/settings`.

`/client/me` - canonical client home. `/client/dashboard` - candidate redirect target to `/client/me`, но изменение route behavior не входит в этот docs-only этап.

## MVP Screens

| Screen | Route | MVP role | Current status |
| --- | --- | --- | --- |
| Trainer dashboard | `/trainer/dashboard` | Очередь внимания и next actions | demo-backed / prototype |
| Trainer clients list | `/trainer/clients` | Найти и открыть клиента | visual prototype / unknown data maturity |
| Athlete profile | `/trainer/clients/[clientId]` | Контекст, тренировки, прогресс, управление | mock-backed developed prototype |
| Simple WorkoutTemplate Builder | `/trainer/builder` | Создать или выбрать WorkoutTemplate | technical/visual prototype; target UX not accepted |
| Trainer library | `/trainer/library` | Exercise source | partially Supabase-backed candidate |
| Workout review | `/trainer/review/[workoutId]` | Разобрать completed session | prototype |
| Client home | `/client/me` | Главная клиента | demo-backed / mixed |
| Client workouts | `/client/workouts` | Увидеть назначения и историю | demo-backed |
| Client workout execution | `/workout/free`, `/today`, `/today/select` | Записать подходы и завершить тренировку | prototype / mixed namespace |
| Client progress | `/client/progress` | Базовый progress | demo-backed |

## MVP Entities

| Entity | MVP role | Required for MVP | Notes |
| --- | --- | --- | --- |
| User/Profile | Trainer and client identity | Yes | Auth and role boundaries must be explicit |
| TrainerClient relation | Связь тренера и клиента | Yes | Determines permissions |
| Exercise | Exercise catalog item | Yes | Existing `exercise_library` is candidate source |
| WorkoutTemplate | Reusable workout structure | Yes | Core trainer asset; simple builder is MVP blocker, current builder UX is not accepted |
| WorkoutAssignment | Template assigned to client/date | Yes | Connects trainer action to client task |
| WorkoutSession | Concrete client execution | Yes | Starts when client opens/performs assignment |
| WorkoutLog | Sets, reps, weight, comments | Yes | Needed for review and progress |
| Feedback | Trainer response to completed session | Yes | Must be visible to client |
| AttentionItem | Event requiring trainer action | Yes | Central MVP entity; final UX name unresolved; for first beta each completed assigned workout creates a review AttentionItem |
| Program | Higher-level sequence | No | Not blocker for first vertical MVP; advanced multi-week Program Builder is later |
| ProgramAssignment | Program version assigned to client | No | Revisit after workout loop is stable |
| Achievement/Title/Rank | Motivation/status layer | No | Preserve, but not core MVP blocker |

## Builder Scope And Readiness

### Simple WorkoutTemplate Builder

Simple WorkoutTemplate Builder is a core MVP capability and a blocker for the main MVP scenario because the trainer must be able to prepare a workout before assigning it.

Current status:

- current implementation: technical and visual prototype;
- current UX status: prototype, not accepted as target product UX;
- backend integration readiness: blocked by UX and domain decisions;
- MVP blocker: yes;
- reusable parts: exercise library, exercise cards, set configuration controls, superset blocks, workout form primitives, exercise detail UI;
- non-reusable by default: current full-screen composition and information architecture.

Required design work before production backend integration:

- create new WorkoutTemplate from scratch;
- edit existing WorkoutTemplate;
- choose exercises from the library;
- configure sets, reps, load targets, rest and notes;
- reorder exercises and blocks;
- create and edit supersets;
- save template;
- assign workout to a client;
- distinguish Save Template from Assign Workout;
- define error states, empty states and mobile behavior.

### Advanced Multi-Week Program Builder

Advanced multi-week Program Builder is not part of the first vertical MVP. It becomes relevant after the simple WorkoutTemplate and WorkoutAssignment flow is accepted and implemented end to end.

Current status:

- current UX status: not designed / prototype fragments only;
- MVP blocker: no;
- expected timing: after core workout-template flow;
- existing code: preserve as prototype material, revisit after core workflow.

## Capability Scope

### Trainer Capabilities

| Capability | User | Job to be done | Trigger | Main scenario | Result | Data | Interfaces | Current status | Backend dependency | Acceptance criteria | MVP blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Увидеть очередь внимания | Trainer | Понять, кому нужно действие сейчас | Клиент завершил тренировку или возникло событие | Открыть `/trainer/dashboard`, увидеть list/queue with reasons | Trainer chooses next action | AttentionItem, client summary, severity/status | Dashboard queue, filters, badges | Prototype/demo-backed | Required for production | Queue shows open items, reason, client, age, priority and action | Yes |
| Открыть клиента | Trainer | Быстро перейти от сигнала к контексту человека | Click AttentionItem/client | Open athlete profile | Context is visible | Client profile, assignments, recent sessions, notes | Athlete profile | Mock-backed developed prototype | Required | From queue item trainer can open exact client context | Yes |
| Понять причину события | Trainer | Не гадать, что случилось | AttentionItem detail | Read reason and linked session/log | Trainer knows why action is needed | AttentionItem reason, source entity, timestamps | Queue item, drawer, profile context | Prototype concept | Required | Every item has human-readable reason and source link | Yes |
| Создать или выбрать WorkoutTemplate | Trainer | Подготовить тренировку | Client needs next workout | Use a redesigned simple WorkoutTemplate Builder or select existing template | Template ready for assignment | Exercise, blocks, sets, targets, notes | Builder/templates UI | Current implementation is technical/visual prototype; UX readiness not accepted; backend integration readiness blocked by UX and domain decisions | Required after UX/domain decisions | Trainer can create/select a valid template without Program; Save Template and Assign Workout are distinct actions | Yes |
| Назначить WorkoutAssignment | Trainer | Дать клиенту конкретную тренировку | Template ready | Select client/date and assign | Client receives assignment | Template, client, due date, trainer id | Assign drawer/form | Partial/prototype | Required | Assignment appears for client and trainer | Yes |
| Открыть завершенную WorkoutSession | Trainer | Проверить факт выполнения | AttentionItem "completed session" | Open review screen from item | Session details visible | Session, workout logs, comments | Review page/drawer | Prototype | Required | Trainer sees performed sets, deviations, comments | Yes |
| Разобрать результаты | Trainer | Понять качество выполнения и next step | Review screen opened | Compare target vs actual | Review decision made | Planned vs actual logs, subjective comment | Review UI | Prototype | Required | Trainer can mark reviewed and decide action | Yes |
| Отправить feedback | Trainer | Закрыть коммуникационный цикл | Review complete | Write/send response or short acknowledgement | Client sees feedback | Feedback text, status, author, timestamp | Review UI, client workout/history | Not confirmed production-backed | Required | Feedback persists inside the product and is visible to client; external messenger is not source of truth | Yes |
| Назначить следующий шаг | Trainer | Продолжить процесс без потери контекста | Feedback or review outcome | Assign next workout or mark no action | Next task exists or no action needed | Next assignment or note | Review/profile quick action | Prototype concept | Required | Trainer can create next actionable state | Yes |
| Закрыть AttentionItem | Trainer | Убрать обработанное событие из очереди | Feedback sent and decision made | Mark item closed | Queue no longer shows closed item | AttentionItem status, resolution | Queue/review UI | Prototype concept | Required | Closed item is auditable and not active | Yes |

### Client Capabilities

| Capability | User | Job to be done | Trigger | Main scenario | Result | Data | Interfaces | Current status | Backend dependency | Acceptance criteria | MVP blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Увидеть назначение | Client | Понять, что делать сегодня | Trainer creates assignment | Open client home/workouts | Assignment visible | WorkoutAssignment, due date, trainer note | `/client/me`, `/client/workouts` | Demo-backed | Required | Client sees current assigned workout | Yes |
| Открыть тренировку | Client | Начать выполнение | Click assignment | Open execution UI | WorkoutSession starts or resumes | Template snapshot, assignment | Workout execution route | Prototype | Required | Assignment opens exact workout plan | Yes |
| Записать подходы | Client | Зафиксировать факт выполнения | During workout | Enter reps/weight/RPE/comment | Logs stored locally/server-side | WorkoutLog rows | Execution UI | Prototype/mixed | Required | Client can record sets per exercise | Yes |
| Сохранить результаты | Client | Не потерять данные | During/after workout | Save draft or autosave | Session has persisted logs | WorkoutSession, WorkoutLog | Execution UI | Unknown | Required | Refresh does not lose saved progress | Yes |
| Завершить тренировку | Client | Передать работу тренеру | End of workout | Submit complete | Session completed, AttentionItem created | Session status, completion time | Execution UI | Prototype concept | Required | Completion creates review item for trainer | Yes |
| Оставить комментарий | Client | Дать контекст тренеру | On completion | Add subjective note | Trainer sees note | Session comment | Completion form/review | Prototype | Required | Comment appears in trainer review | Yes |
| Получить feedback | Client | Понять реакцию тренера | Trainer sends feedback | Open workout/history/home | Feedback visible | Feedback entity | Client home/history/workouts | Not confirmed production-backed | Required | Feedback is linked to completed session | Yes |
| Увидеть тренировку в истории | Client | Вернуться к прошлой работе | After completion | Open history/workouts | Completed session visible | Session summary | `/client/workouts`, history route | Demo/prototype | Required | Completed workout appears in history | Yes |
| Увидеть базовое обновление прогресса | Client | Понять движение | Logs saved | Open progress | Basic metrics update | WorkoutLog, body/progress metrics | `/client/progress` | Demo-backed | Required for MVP-lite | At least one metric updates from real logs or explicit mock boundary is removed | Yes |

## MVP Backend Requirements

Required:

- stable auth with trainer/client role detection;
- trainer-client relationship permissions;
- Exercise read source;
- WorkoutTemplate CRUD;
- WorkoutAssignment create/read/status;
- WorkoutSession start/save/complete;
- WorkoutLog persistence;
- Feedback persistence;
- AttentionItem create/read/close;
- basic audit timestamps.

For first beta, each completed assigned workout should create a review AttentionItem. Trainer must be able to provide detailed feedback, provide a short acknowledgement, or close the item quickly if no detailed review is needed.

Not required for first MVP:

- full Program engine;
- advanced automation rules;
- AI-generated reports;
- complex payment ledger;
- automatic subscription and webhook flow as a blocker;
- complex achievement/rank persistence.

Beta access may use manual access, invitation-only onboarding, simple access status and optional access expiration date until the core workflow is validated.

## MVP Auth And Permissions

Minimum permission rules:

- trainer can see only assigned/linked clients;
- client can see only own assignments, sessions, feedback and progress;
- trainer can create assignments only for linked clients;
- trainer can review only sessions from linked clients;
- client cannot edit trainer feedback;
- client cannot close AttentionItem;
- demo mode must be explicitly separated from production auth.

Current risk: `proxy.ts` coverage is documented as protecting `/dashboard/:path*` and `/api/notify-complete`, while `/trainer/*` and `/client/*` need explicit auth strategy before production.

## MVP Analytics Events

Minimum events:

- `trainer_attention_item_viewed`;
- `trainer_client_opened`;
- `trainer_template_created`;
- `trainer_template_selected`;
- `trainer_assignment_created`;
- `client_assignment_opened`;
- `client_session_started`;
- `client_workout_log_saved`;
- `client_session_completed`;
- `trainer_session_review_opened`;
- `trainer_feedback_sent`;
- `trainer_next_step_assigned`;
- `trainer_attention_item_closed`.

Purpose: measure whether the vertical loop completes, not vanity engagement.

## MVP Error And Empty States

Required empty states:

- trainer has no clients;
- trainer has clients but no AttentionItems;
- trainer has no templates;
- client has no current assignment;
- client has no workout history;
- progress is unavailable because no completed sessions exist.

Required error states:

- assignment cannot be loaded;
- session save failed;
- completion failed;
- feedback send failed;
- permission denied;
- stale or already closed AttentionItem.

## MVP Mobile Requirements

Client side:

- workout execution must be comfortable on mobile;
- inputs must not jump layout;
- saving/completion must be obvious;
- feedback and current assignment must be readable on small screens.

Trainer side:

- dashboard queue should be scannable on laptop first;
- mobile trainer use can be supported for quick review and messaging, but does not define MVP layout.

## Definition Of Done

MVP vertical scenario is done when:

- trainer can create/select a WorkoutTemplate;
- trainer can assign it to a linked client;
- client can open and complete it with logs/comments;
- completion creates an AttentionItem;
- trainer can open the item, inspect results and send feedback;
- trainer can assign a next step or mark no next action;
- AttentionItem can be closed;
- client can see feedback and completed workout in history;
- trainer and client see consistent session/progress data;
- auth prevents cross-client access;
- demo/mock data is clearly separated from production paths.
