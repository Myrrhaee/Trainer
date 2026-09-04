# R4 Core Loop UX Consistency Gate v1

Дата: 2026-09-04. Baseline: `fdaf2be82a01ac5c9d780f409a412e5587d02e7a`.
Статус: code-based consistency review; fresh authenticated browser/mobile gate NOT VERIFIED.
Related: [integration audit](core-loop-r4-integration-audit-v1.md), [test plan](core-loop-r4-test-plan-v1.md).

## 1. Verdict and scope

Существующий UI уже связывает реальные назначения, выполнение, разбор и обратную связь. Главные вопросы остаются прежними: тренер понимает, кому нужен следующий шаг; спортсмен понимает, что делать сейчас. Не нужен новый Dashboard, CRM, Progress или визуальный редизайн.

Pilot NOT READY: подтверждён P1 атомарности сохранения F01, есть P2 восстановления/обновления/навигации, а повторный интегрированный browser gate в этом проходе не запустился. RUN PostgreSQL 154/154 не является UX PASS. Ни один пункт CHANGE/REMOVE ниже не реализован: это рекомендации на review, а не разрешение на новый scope.

Обозначения: CODE = проверено по текущему компоненту/контракту; PRIOR = прежние отчёты; PLAN = требуется браузерная проверка. Свежих core-loop скриншотов и успешного мобильного прогона этот документ не заявляет. Existing Next server на 3011 не остановлен; E2E runner столкнулся с dev lock до запуска тестов.

## 2. Surface contracts

### 2.1 Trainer Dashboard

- USER TASK: «Кому сейчас нужен мой следующий шаг и что сделать?»
- ENTRY: trainer Home; возврат из Review/Profile/назначения с flow/receipt.
- PRIMARY ACTION: действие конкретной рабочей строки: exact Review прежде назначения. Карта клиентов является альтернативным входом в контекст, не вторым набором доменных фактов.
- NEXT SCREEN: `/trainer/review/{S}` либо `/trainer/clients/{A}` / shared Quick Assign.
- RETURN: R2A.3 queue filter/order/anchor; после команды fresh snapshot.
- STATES: начальная загрузка/map skeleton; отдельная ошибка Dashboard; пустая рабочая очередь; несколько Review одного A; completed discomfort; no-next-assignment; suspended terminal review не исчезает только потому, что A отсутствует в active roster.
- KEEP: canonical queue, human-first athlete context, atomic map и activity presentation над реальными входными данными; Review не схлопывать по A.
- CHANGE: проверить независимые active execution и next assignment, а также Next Item order/position (F05). Пропущенные/просроченные сигналы допустимы только из canonical фактов, не из старых mock-строк.
- REMOVE: ничего сейчас; в будущих изменениях не добавлять придуманные online/missed/scoring показатели как факты.
- SEVERITY: F05 P2; независимость next-work при active и новой relation требует сценарного подтверждения, не объявлена privacy bug.

Evidence: `components/trainer/canonical-trainer-dashboard.tsx`, `canonical-trainer-dashboard-model.ts`; `lib/server/trainer-dashboard/trainer-dashboard-repository.ts`; `TrainerWorkflowTransitionService.destinations`. Требуется browser PLAN для двух Review одного спортсмена, non-default queue order и suspension.

### 2.2 Athlete Profile

- USER TASK: понять человека и текущий тренировочный контекст, выбрать один следующий шаг.
- ENTRY: neutral roster/direct A либо attention entry с exact I/S; только athlete User UUID в profile route.
- PRIMARY ACTION: R1 Header, pending Review -> no next Assignment -> no forced action. Training не дублирует primary CTA.
- NEXT SCREEN: exact Review или shared Quick Assign; URL tab `training` сохраняет профильную сущность.
- RETURN: безопасный queue/profile return; после command receipt перечитать Profile/Training, не доверять старым capabilities.
- STATES: pendingReview, activeExecution и nextAssignment могут сосуществовать; latest feedback не task; partial current/history errors раздельны; suspended relation ограничивает действия; invalid/unavailable A возвращает roster.
- KEEP: R1 identity/header, athlete-owned read-only анкета для тренера, URL tabs, независимые рабочие секции.
- CHANGE: expiry-return F03; проверить возврат focus после Review/Assign и partial states. Отдельно вынести broad suspended Profile policy F06 на security review.
- REMOVE: ничего; не превращать отсутствие Program/Progress/Motivation в ошибку профиля.
- SEVERITY: F03/F06 P2, не новый grant или профильный редизайн.

Evidence: `app/trainer/clients/[clientId]/page.tsx`; `components/trainer/canonical-athlete-profile.tsx`; `lib/server/athlete-profile/athlete-training-query-service.ts`, `athlete-training-profile-frame-projector.ts`, `athlete-current-state-projector.ts`.

### 2.3 Templates Workspace

- USER TASK: найти свой шаблон и понять, какую опубликованную/редактируемую версию открыть.
- ENTRY: trainer navigation; Editor return с filters/query/anchor; не старый inline roster builder.
- PRIMARY ACTION: создать Template в empty state либо открыть/выбрать конкретный существующий; опубликованная версия и Draft различимы.
- NEXT SCREEN: exact Editor M/revision; assignment entry сохраняет athlete context, если он действительно есть.
- RETURN: server-filtered Workspace URL и semantic Template anchor, не браузерный глобальный Back как единственная стратегия.
- STATES: initial/list loading; zero total versus no filter matches; next-page load error; stale archive/revision; foreign owner unavailable; command unknown для lifecycle operations.
- KEEP: set-based summaries, counts, explicit lifecycle, bounded list, one exact Editor.
- CHANGE: проверить full cycle Workspace -> Editor -> Publish -> Quick Assign с native Back/Forward, а не только локальные тесты.
- REMOVE: ничего; не назначать unsaved Draft и не гидратировать все exercises каждого Template для списка.
- SEVERITY: отдельный новый дефект не подтверждён; browser proof F08 открыт.

Evidence: `components/trainer/templates/canonical-templates-workspace.tsx`; `lib/template-workspace-navigation.ts`; `lib/server/template-workspace/`; `tests/e2e-canonical/templates-workspace.spec.ts` (coverage source, не свежий RUN).

### 2.4 Builder / WorkoutTemplate Editor

- USER TASK: подготовить и сохранить тренировку, опубликовать точную версию без потери редактирования.
- ENTRY: Workspace exact M или new; Quick Assign с validated handoff.
- PRIMARY ACTION: зависит от lifecycle/dirty/command state: Save Draft либо Publish, не Assign unsaved content.
- NEXT SCREEN: остаётся exact Editor после обычного Save; по явному Save-and-Exit идёт в выбранное место; Publish receipt возвращает в Workspace/Quick Assign.
- RETURN: safe explicit destination; command identity сохраняется, navigation intent определяется текущим действием.
- STATES: editable/read-only/archived; unknown Save/Publish; token conflict; recovery offer; empty draft; validation issue; missing catalog source; long exercise/Set list.
- KEEP: immutable Published + separate Draft; stable instance/set/superset identities; exact issue focus; explicit recovery Restore/Discard; operation-specific failed labels.
- CHANGE: проверить четырёхупражненческий loop, мобильные полевые ошибки и диалог выхода с keyboard. Не возвращать старые clock-domain/unknown-Publish/exit-intent ошибки.
- REMOVE: ничего; не переносить прототипные domain facts из localStorage в canonical persistence.
- SEVERITY: новый Editor blocker не доказан; существующие unit/PG тесты не заменяют свежий integrated browser gate F08.

Evidence: `components/trainer/template-editor/canonical-workout-template-editor.tsx`, `workout-template-editor-recovery.ts`, `workout-template-editor-state.ts`, `workout-template-composition.tsx`; `lib/workout-template-editor-navigation.ts`; Editor tests.

### 2.5 Quick Assign Sheet

- USER TASK: назначить спортсмену конкретную сохранённую Published Revision, убедиться в дате и заметке.
- ENTRY: Dashboard/Profile/roster/Review receipt; exact A и validated flow; direct invocation проходит ту же авторизацию.
- PRIMARY ACTION: подтвердить назначение после выбора eligible V; во время unknown сначала проверить исход.
- NEXT SCREEN: completion receipt с разрешёнными Profile/Queue/next destinations; no template -> Builder с handoff.
- RETURN: единый R2A.3 completion contract; template revision и assignment-state token перечитываются на сервере.
- STATES: no templates / no search matches; loading list/preview; stale V; archived during submit; suspended R; same-date/concurrent W; unknown; explicit success.
- KEEP: один Sheet и одна команда `WorkoutService.createAssignment`; stable W ID; immutable snapshot preview; доступность action из DB, не из entry context.
- CHANGE: browser PLAN для всех production entries и возврата Builder; shared state не гарантирует live refresh уже открытого кабинета A (F02).
- REMOVE: ничего; не добавлять редактирование prescription или Program внутрь назначения.
- SEVERITY: F02 P2 относится к получению результата другой ролью; нового Sheet-specific blocker не подтверждено.

Evidence: `components/trainer/quick-assign/canonical-quick-assign-sheet.tsx`; `lib/quick-assign-navigation.ts`; `lib/server/quick-assign/`; `lib/server/workouts/workout-repository.ts:createAssignment`.

### 2.6 Client Home

- USER TASK: «Что делать сейчас?» и «Что ответил тренер?»
- ENTRY: `/client/me`, login, completion/Home return.
- PRIMARY ACTION: открыть текущий W/S; latest Feedback отдельный осмысленный переход, не замена текущей тренировки.
- NEXT SCREEN: exact `/client/workouts?assignment=W` / `?session=S`; feedback carries exact S/F; collection link.
- RETURN: allowlisted Home anchor для feedback; completion не требует Progress.
- STATES: current loading, no assignment, read failure, latest feedback independently loading/empty/failed; account/capability denial.
- KEEP: спокойный текущий workout, latest response, все тренировки; ошибки отделены от настоящей пустоты.
- CHANGE: F02 mount-only current read; current GET error требует reload вместо локального retry. Текст «Новое назначение появится здесь» при отсутствии автообновления может вводить в заблуждение. F03 после истечения auth теряет exact destination.
- REMOVE: ничего; не заполнять пустой Home фиктивным назначением или статистикой активности.
- SEVERITY: F02/F03 P2; reload позволяет продолжить, поэтому не P1.

Evidence: `components/client/canonical-client-home.tsx:42`, `:73`, `:109`; `canonical-recent-feedback.tsx:48`; `app/client/layout.tsx:7`.

### 2.7 Client Workouts collection / history

- USER TASK: найти назначение или уже завершённую Session и её feedback.
- ENTRY: Home, completed return, direct collection URL.
- PRIMARY ACTION: открыть конкретную row; `Показать ещё` вторично к выбору Session.
- NEXT SCREEN: exact W/S; history row не использует Assignment ID вместо Session ID.
- RETURN: startCursor + successful depth D + semantic Session anchor; полный replay 1..D при Back/reload.
- STATES: current/history independent load/error/empty; partial replay prefix; invalid cursor notice; exhaustion `Все тренировки показаны`; отдельная feedback pagination.
- KEEP: append, dedupe Session ID, 10 initial, 10 default / 30 max per request, no local history cache, no hidden depth cap.
- CHANGE: F04 current collection hasMore не отражён в UI; это не лимит завершённой истории. Проверить append/return при сетевом сбое на третьей странице.
- REMOVE: ничего; не вести в `/history` или возвращать замену текущего окна вместо принятого append.
- SEVERITY: F04 P2; полнота history restoration требует browser F08.

Evidence: `components/client/canonical-client-history.tsx`; `lib/client-history-navigation.ts`; `lib/server/client-workouts/client-history-repository.ts`; `client-workout-repository.ts:105`; R3E tests.

### 2.8 Execution

- USER TASK: выполнить именно назначенную тренировку, записать/пропустить подход и продолжить без потерь.
- ENTRY: exact W/S; Start возвращает тот же S при повторе.
- PRIMARY ACTION: Save/Skip конкретного подхода; Complete становится доступным при разрешённом состоянии команд.
- NEXT SCREEN: same S execution или completion dialog; terminal S -> completed detail.
- RETURN: явный allowlisted collection/Home URL; dirty/unresolved results не должны исчезать из-за перехода.
- STATES: loading; eligible/not-startable; running; per-Set saving/saved/skipped/failed/unknown/conflict; terminal; denied; network failure.
- KEEP: numeric zero versus null, stable K/source identity, explicit reconciliation, Session-level expected version, focus exact unresolved Set.
- CHANGE: F01 backend atomicity требует исправления до pilot; F09 initial transport/503 currently renders generic unavailable before actual error notice. Последний случай не доказывает отсутствия workout.
- REMOVE: ничего; не заменять exact Session на “последнюю” при stale/foreign ссылке.
- SEVERITY: F01 P1; F09 P2. Первый воспроизведён service/PG probe; второй CODE branch evidence, browser reproduction pending.

Evidence: `canonical-workout-execution.tsx:154`, `:391`, `:430`, `:609`; `lib/client-workout-progress-command.ts`; service/repository F01 evidence in integration audit.

### 2.9 Completion

- USER TASK: однозначно завершить S, передать общий комментарий/дискомфорт и понимать, сохранилось ли завершение.
- ENTRY: execution Complete; unresolved Save блокирует преждевременный terminal переход.
- PRIMARY ACTION: подтвердить завершение; при unknown проверить статус, не создавать новый Complete intent.
- NEXT SCREEN: exact terminal S / receipt, затем Home или Workouts.
- RETURN: Escape/close возвращает focus на trigger; success имеет явные destinations.
- STATES: incomplete/skipped summary; zero-result confirmation; explicit discomfort yes/no; saving/known failed/unknown/conflict; unavailable/permission loss; success.
- KEEP: atomic completion/context/Attention/receipt/audit/outbox; null legacy не приводить к false; не создавать боль/оценку из пропусков.
- CHANGE: свежий browser gate с длинным комментарием, открытой клавиатурой, retry до/после COMMIT и возвратом focus.
- REMOVE: ничего; не вводить обязательный score/analytics шаг.
- SEVERITY: новый completion-specific дефект не подтверждён; RUN R3D PostgreSQL green, mobile PLAN.

Evidence: `components/client/canonical-workout-completion.tsx:171`; `lib/client-workout-completion-command.ts`; `client-workout-r3d-postgres.test.ts`; `client-workout-completion.spec.ts`.

### 2.10 Review and Queue

- USER TASK: открыть точную завершённую тренировку, прочитать реальные результаты и ответить/явно закрыть разбор.
- ENTRY: Dashboard/Queue/Profile с I/S; direct Review exact S.
- PRIMARY ACTION: Send Feedback / acknowledgement либо explicit manual resolution; follow-up после resolved, не новая initial review.
- NEXT SCREEN: receipt Queue/Profile/next action по текущим capabilities; athlete получает тот же F.
- RETURN: R2A.3 context, no router.back-only; suspended historical Review не ведёт в недоступный Profile/Assign.
- STATES: loading, explicit retryable GET versus inaccessible; partial evidence; legacy-null context; already resolved; send failure/unknown retry; missing parent; historical relation.
- KEEP: evidence перед ответом, exact IDs, private manual-resolution reason, feedback thread, no fabricated athlete results.
- CHANGE: F05 Next Item order; Queue mount-only/error reload как Home требует сценарного refresh test; unknown follow-up after reload требует отдельного доказательства browser attempt semantics.
- REMOVE: ничего; старый demo Review не использовать как production test surface.
- SEVERITY: F05/F02-type refresh P2; follow-up reload сейчас test gap, не доказанный duplicate-feedback bug.

Evidence: `components/trainer/canonical-workout-review.tsx:125`; `review/canonical-review-action-region.tsx`; `canonical-review-queue.tsx:34`; `lib/server/reviews/review-repository.ts`; transition service.

### 2.11 Completed Detail

- USER TASK: перечитать результаты именно S и точный ответ тренера; вернуться в то же место истории.
- ENTRY: completion, history row, latest F link.
- PRIMARY ACTION: read-only; явный return к истории/Home, никакого повторного Start/Complete.
- NEXT SCREEN: restored history или exact feedback parent/thread position.
- RETURN: successful history depth + S anchor; никакого восстановления только одного окна.
- STATES: initial/section loading; unavailable/permission loss; feedback missing versus failed; partial source; legacy null; focus F missing; long thread pagination.
- KEEP: immutable results, explicit missing evidence, feedback IDs/body/parent, separate bounded thread navigation.
- CHANGE: проверить focus original S после D-page replay, forward/reload и секционную feedback ошибку без потери результата S.
- REMOVE: ничего; не давать trainer-private Attention/manual reason клиенту и не пересчитывать результаты по актуальному Template.
- SEVERITY: новый дефект не подтверждён, browser F08 не закрыт.

Evidence: `components/client/canonical-completed-workout.tsx`; `lib/server/client-workouts/client-completed-repository.ts`; `client-feedback-repository.ts`; R3E PostgreSQL/browser specs.

## 3. Cross-screen state review

| Surface | Loading / empty | Recoverable / fatal | Stale / unknown / permission |
| --- | --- | --- | --- |
| Dashboard | CODE skeleton and real empty snapshot | CODE error branch; browser refresh behavior PLAN | Fresh read/receipt needed; no mutation on open |
| Profile | Server frame, separate Training current/history | Partial sources should not erase good section; unavailable A -> roster | Relation-aware capability; one Header action |
| Workspace | List loading, empty vs filtered empty | Retry/page failure | Lifecycle conflict/unknown; actor-owned exact IDs |
| Builder | Exact model load / blank new Draft | Field issues/operation labels and recovery | Frozen attempts, token conflicts, readonly Published/archived |
| Quick Assign | Initial/list/preview; no templates/search match | Explicit initial retry; stale selection | Unknown freezes intent; relation/revision rechecked |
| Home | CODE loading/empty separated | Error explicit but no local current retry (F02) | No automatic current refresh; auth layout F03 |
| Collection | Current/history independent | History retry/prefix/invalid cursor notice | D-page replay; current hasMore F04 |
| Execution | Spinner, no legitimate “empty exact workout” | First GET 503 incorrectly becomes unavailable (F09) | Per-Set/Start command states exist; denied exact read never substitutes entity |
| Completion | Dialog over same S | Validation/failed command | Unknown check/replay; explicit permission loss |
| Review | CODE loading and retryable-vs-denied distinction | Retry button for transient errors | Resolved exact state; command retry and historical capabilities |
| Completed | Readonly detail + independent thread loading | Thread retry/missing F notice; detail unavailable | No mutation; own history after end |

Это CODE inventory, не утверждение, что все перечисленные состояния проверены браузером. Обязательные next-run injection cases: initial 503, local section 503, denied after successful read, stale version, lost response after COMMIT, partial replay and navigation failure after success.

## 4. Mobile and accessibility gate

| Check | Current evidence | Gate status |
| --- | --- | --- |
| 1440x1024 / 390x844 / 390x500 | Existing canonical E2E specs and prior reports; no fresh R4 screenshots | NOT VERIFIED for full repeated loop |
| 200% zoom | Prior reflow-equivalent tests; native zoom/device not proven | NOT VERIFIED native; record separately |
| Overflow / long comments / footer + keyboard | Responsive classes are only CODE; need measured viewport/device behavior | NOT VERIFIED |
| Builder/Quick Assign/Completion dialog labels | CODE Title/Description present in canonical components | Semantics inspection PASS; keyboard/screen-reader runtime pending |
| Exact issue/Set/Feedback/history focus | CODE stable element IDs, focus callbacks and navigation helpers | Needs sequence verification, including restore after appended pages |
| Reduced motion / focus-visible / live regions | Some components explicitly support them; execution Set states have role/status/alert | Not a blanket accessibility PASS |
| Heading/landmark/link-name clarity | Home has main/h1, Review quick links, execution set labels; repeated links need contextual accessibility inspection | Whole route tree/keyboard run pending |

### DialogDescription warning catalog

| Exact source | Reachability | Finding |
| --- | --- | --- |
| `components/trainer/exercise-detail-sheet.tsx:25` | Imported/mounted by old `app/trainer/review/[workoutId]/workout-review-client.tsx:620`; canonical Review page selects a different component | SheetContent lacks Radix SheetTitle/SheetDescription. Confirmed structural legacy warning source; P3 off core path, not a freshly captured runtime warning. |
| `components/trainer/quick-assign/canonical-quick-assign-sheet.tsx:376` | Canonical | Explicit `aria-describedby` and `quick-assign-description`, plus title; do not blame historical warning on this Sheet without runtime evidence. |
| `components/trainer/template-editor/canonical-workout-template-editor.tsx:783` | Canonical duplicate/leave/conversion dialogs | DialogTitle/Description present. |
| `components/client/canonical-workout-completion.tsx:171` | Canonical Completion | DialogTitle/Description and return-focus callback present. |

Historical reports mention non-R3D DialogDescription warnings but do not establish a fresh canonical runtime stack. Broader nested conditional dialogs may need inspection; this catalog does not certify zero warnings. Next gate must capture full warning stack and route/state, not suppress warnings or add blanket `aria-describedby={undefined}` during audit.

## 5. Keep / change / remove summary and acceptance

KEEP: current canonical components, shared IDs, actor boundaries, PostgreSQL snapshots, R1 Header and URL tabs, R2A.3 transitions, published/draft separation, exact Review, accepted R3E append history and separate feedback pagination.

CHANGE later, after approval: fix F01 atomicity; distinguish transient exact-load error F09; scoped current/queue refresh and retry F02; safe auth continuation F03; current-list discoverability F04; define/align Next Item ordering F05; explicit security decision F06. Verify before redesigning anything. P2 acceptance must name workaround and pilot limits.

REMOVE now: nothing. No legacy deletion, no UI redesign, no widening permissions, no mandatory Progress. Deferred Exercise identity hardening is not a UX gate workaround.

Acceptance: two repeated exact-ID cycles with no manual DB repair; P0=0/P1=0; remaining P2 expressly accepted; all 20 binary checklist items in test plan checked with fresh evidence. Existing PostgreSQL PASS is useful but insufficient. Native zoom/physical keyboard gaps cannot be described as tested.

## 6. Scope confirmation

Only this document and the two companion R4 documents were created in Part B. UI/production/API/routes/tests/configuration/schema/migrations were not changed, no fixes started, no R4 commit or stage created. The earlier R3F docs-only commit is separate and preserves accepted Progress deferral.
