# R3D: Completion Implementation Evidence

Дата: 2026-09-04. Ветка: `codex/r3d-client-workout-completion`.

## 1. Executive Verdict

Реализованы canonical Completion, минимальный контекст Session и ограниченный исторический workflow исходного тренера. PostgreSQL остаётся source of truth. Автоматические quality gates пройдены. Реализация не закоммичена; итоговые проверки и ограничения перечислены ниже.

## 2. Documentation Checkpoint

До реализации проверены ожидаемые branch/HEAD, только два новых R3D документа и `git diff --check`. Создан отдельный commit `2d2c27af7747a6c243fd5bf684ea245ae5daacbd`, `docs(client-workouts): define R3D completion architecture`. Его parent: `bdd60a99eb07f07666eacf160af6ac51735fcfe6`. После commit дерево было чистым. Push не выполнялся.

## 3. Migration And Rollout

Следующая миграция после `0015_workout_template_command_hardening`: `database/migrations/0016_workout_session_completion.{up,down}.sql`. Старые миграции не редактировались. Up добавляет три nullable-колонки, CHECK, completion trigger и точечные policies. Defaults/backfill отсутствуют.

В изолированных PostgreSQL databases проверены fresh install и настоящий upgrade `0015 -> 0016` штатным migrator. Upgrade-test создаёт старую terminal Session, старый receipt и active Session до применения `0016`: legacy tuple остаётся null, старый receipt повторяется, новая active Session требует явный boolean. Down SQL выполнен внутри откатываемой тестовой транзакции. Реальный down удаляет новые context columns и потому требует отдельного решения о сохранении данных.

Preflight существующей локальной базы до изменений: 0 Sessions, 0 несовпадающих lineage tuples, 0 Sessions без start-audit. Это не является доказательством чистоты внешней базы или сторонних импортов. Перед внешним rollout повторить provenance/ownership preflight и сделать backup. На внешнее окружение миграция не отправлялась.

После изолированных проверок `0016` применена штатным migrator к `ai_strength_local` на `127.0.0.1:55432`, без reset/data deletion. Повторный runtime catalog check подтвердил owner `ai_strength_migrator`, fixed search_path helper, `rolbypassrls=false` у app/migrator и FORCE RLS на Session.

Evidence: `tests/backend-foundation/client-workout-r3d-postgres.test.ts`, тест upgrade; `scripts/db/migrate.mjs`, ownership/checksum/transaction checks.

## 4. Session Context

`overall_comment`: nullable text, максимум 2000 Unicode code points. `discomfort_reported`: null только для старых не собранных данных; новое завершение требует boolean. `discomfort_comment`: true требует содержательный текст до 1000 code points, false требует null. Новая Session начинается active; active context не записывается отдельным save. Terminal context защищён существующим trigger immutability из `0007`.

`normalizeCompletion` в `lib/client-workout-completion-command.ts` использует trim, whitespace-only -> null, сохраняет внутренние переводы строк, считает `Array.from(text).length` согласованно с PostgreSQL `char_length`. NUL/unpaired surrogate отклоняются. Yes -> No удаляет скрытый комментарий из payload.

## 5. Completion Command And Atomicity

Расширен существующий `WorkoutSessionService.complete` и существующий POST, без нового endpoint. `WorkoutSessionRepository.complete`: own Session identity read -> active-row FOR UPDATE -> reread after wait -> receipt -> eligibility/version/zero-result -> omissions -> terminal context -> Attention -> receipt -> audit -> outbox -> persisted response.

Terminal row не блокируется через UPDATE-policy, которая разрешает только active. Поэтому после ожидания active lock выполняется повторное чтение: concurrent terminal outcome не перезаписывается. Assignment status не изменяется. В audit нет исходного текста комментариев; внешняя доставка уведомления вне транзакции.

Fault injection на context UPDATE, Attention INSERT, receipt INSERT, audit INSERT и outbox INSERT доказывает rollback terminal/context/omissions; ранее сохранённые R3C logs остаются. Четыре сочетания discomfort/omissions дают только `[]`, `[partial_completion]`, `[discomfort]`, `[discomfort, partial_completion]`.

## 6. Full Request Identity

Fingerprint SHA-256 включает строго `sessionId`, `assignmentId`, `expectedVersion`, `zeroResultConfirmed`, `zeroResultReason`, `overallComment`, `discomfortReported`, `discomfortComment`. Assignment ID сервер выводит из Session, не доверяет клиентскому источнику. Одинаковый ключ и полный payload повторяют результат; другой payload конфликтует. Другой ключ с эквивалентным полным запросом возвращает результат без второго receipt/Attention/outbox. Старый payload разрешён только для уже существующего старого receipt.

Evidence: `completionLogicalRequest`, `WorkoutSessionRepository.receipt/complete`; R3D full-hash test и upgrade test. Новые контекстные поля не заменяют сравнение версии/zero-result/identity.

## 7. Reconciliation And Safe Result

`CompletionAttempt` хранится только в памяти: operation, commandId, exact IDs, expectedVersion, frozenPayload, fingerprint, startedAt. Exact GET принимает optional UUID commandId и fingerprint; возвращает только `own/equivalent/different/none`, не hashes. Чтение Session и её receipt находится в repeatable-read read-only транзакции.

Own/equivalent terminal -> success/already completed; другой terminal request -> conflict; active/same version/no receipt -> тот же POST с тем же ключом; changed version -> явное повторное подтверждение; failed GET -> unknown без POST. Ответ включает persisted Session facts, timestamp, version, normalized context и `reviewQueued`, доказанный completion receipt. Athlete не получает содержимое Attention; его `attentionItemId` остаётся null по RLS.

## 8. Bounded Historical Authorization

После suspended/ended athlete продолжает exact уже начатую Session через GET/progress/complete. Generic Start не используется как Resume и запрещён для неактивной relation. Исходный trainer получает только terminal workflow с совпадающими trainer/athlete/relation/assignment/session/attention IDs. Новый тренер и другая relation не наследуют старый workflow.

`0016` изменяет SELECT Session/Assignment, SELECT/UPDATE Attention, feedback SELECT/INSERT, manual-resolution SELECT/INSERT и review-receipt INSERT. Child Assignment snapshot и log policies продолжают следовать родителям. Нет grants на новые бизнес-операции или доступа через worker/authenticator в app repositories.

## 9. Start / Suspension Serialization

`WorkoutSessionRepository.startOrResume` проверяет active relation при `FOR SHARE OF relation` и удерживает lock до сохранения Session/logs/audit. `PostgresAccessRepository.transitionRelation` использует `FOR UPDATE`. Порядок: exact relation -> Session; timestamp inference отсутствует.

В PostgreSQL SELECT FOR SHARE учитывает UPDATE USING. Добавлен `relations_lock_athlete` с own-athlete USING и `WITH CHECK(false)`: разрешён lock, не изменение status. Existing trainer policy не даёт athlete пройти trainer WITH CHECK. Проверены оба порядка: suspend-first запрещает Start, start-first задерживает suspend до commit и затем допускает exact completion; прямой athlete UPDATE чужого trainer status запрещён (42501).

## 10. Client UX

`CanonicalWorkoutCompletion` использует существующий exact execution route и Dialog. Перед формой один exact persisted GET. Отдельно показаны result/skipped/incomplete/pending; отсутствие результата не превращается в 0. Есть zero-result confirmation/reason, optional overall comment и обязательная радиогруппа без default. Dirty/saving/failed/unknown/conflicted Set блокирует completion, кнопка возвращает к точному Set.

Отправка замораживает запрос; unknown предлагает только проверку. Ошибки сохраняют несохранённый текст в памяти. Конфликт показывает отдельно существующий контекст и не перезаписывает его. После сохранения остаётся read-only receipt с server time и allowlisted `/client/me`, `/client/workouts`. Сбой навигации не вызывает повторное завершение; reload возвращает receipt. Закрытие формы возвращает фокус на trigger в той же Session.

## 11. Dashboard

`buildCanonicalTrainerDashboardView` строит очередь из каждой Review Attention/Session, а не Map одного review на active athlete. Отдельный selectedAttentionId сохраняет точное действие между несколькими Sessions одного человека. Пустой active roster больше не скрывает очередь исторических reviews. SQL ordering существующего `ReviewRepository.listTrainerQueue` сохраняет discomfort-first, затем canonical ordering.

Минимальный presentation fallback не добавляется в roster. Profile link скрыт без active athlete context. Dashboard/Review не переделаны целиком. Browser: 6 reviews одного suspended athlete, 0 roster athletes, переход ко второму элементу открывает именно его Session.

## 12. Review

Оригинальный discomfort выводится перед обычными deviations, overall comment после них. `ReviewRepository` проецирует legacy null -> unsupported/not collected, false -> known_empty, true -> ready с исходным текстом, повреждённый tuple -> unavailable. Последнее проверено read-boundary fault injection без отключения database constraints. Subjective metrics остаются unsupported. Утверждать отсутствие отклонений нельзя при неизвестном/повреждённом discomfort.

`canOpenAthleteProfile` и `canAssignNext` вычисляются по exact source relation. Для historical Review receipt/return ведут в очередь; запрещённые Quick Assign/Profile CTA отсутствуют. R2A.3 envelope остаётся навигационным контекстом, не доказательством авторизации.

## 13. Feedback

Используется существующий `trainer_feedback` и существующий send/resolve contract. Исходный trainer может отправить feedback и закрыть Attention после suspension/end. Athlete читает тот же persisted Feedback ID через существующий boundary; новая feedback entity не создана. Existing follow-up/manual-resolution tests входят в PostgreSQL/canonical regression.

## 14. RLS Graph And Identity

Прямой предикат Assignment SELECT -> Session оказался рекурсивным на rewrite Session INSERT policy: `Session INSERT -> Assignment SELECT -> Session SELECT`, PostgreSQL 42P17. Нужен узкий non-inlined scalar boundary, а не broad bypass.

`app.has_terminal_assignment_workflow(assignment,relation,athlete)` возвращает boolean, actor берёт из transaction context. PL/pgSQL STABLE SECURITY DEFINER, fixed `search_path=pg_catalog,app`; PUBLIC отозван, EXECUTE только app role. Владелец штатный `ai_strength_migrator` без BYPASSRLS; FORCE RLS сохранён, его отдельная Session SELECT policy разрешает только terminal строки исходного actor. Вызов с foreign trainer проверен: false. Helper не возвращает PII/строки/тексты и не принимает произвольного actor.

Identity JOIN для Review/queue и client assignment заменён на LEFT JOIN: когда existing identity policy не даёт имя после ended, используется нейтральный short-ID fallback. Доступ ко всему Profile ради имени не добавлен. После suspended existing `0012` может разрешать имя; это прежняя политика, не новый historical identity grant.

## 15. Accessibility And Mobile

Проверены Chrome 390x844, сокращённый viewport 390x500, Tab/Space/Enter completion, Escape/return focus, error focus, отсутствие horizontal overflow. DialogTitle/Description и semantic required radio присутствуют; новых hydration/Dialog accessibility warnings в сценарии не обнаружено. Не выполнялся отдельный screen-reader/axe audit.

200% reflow проверяется эквивалентным CSS viewport 720x512 для исходного 1440x1024. Это не физическое устройство, не реальная OS-клавиатура и не ручной native browser zoom. Скриншоты: `test-results/canonical/client-workout-completion--5b476-al-trainer-suspended-Review-canonical-desktop-chrome/r3d-completion-390x844.png`, `r3d-completion-390x500.png`, `r3d-completion-200-percent-layout-zoom.png`. Артефакты игнорируются Git.

## 16. Measured Performance

Измерено во время реального PostgreSQL/browser выполнения, не подсчётом SQL-строк в исходниках:

| Операция | Browser workflow HTTP | Repository driver statements |
| --- | ---: | ---: |
| Exact pre-completion GET | 1 | 11 |
| Первый completion | 1 POST | 19 |
| Same-key replay | 1 POST | 10 |
| Reconciliation GET | 1 | 12 |
| Dashboard refresh | 1 | 12 |
| Exact Review GET | 1 | 9 |

HTTP измеряется событиями Playwright request и route interception; excludes shell/auth/prefetch. Failed reconciliation тоже 1 GET и 0 POST. Repository counts измеряются proxy вокруг реального `PoolClient.query`, включают BEGIN/actor/isolation/COMMIT, исключают HTTP auth, Next revalidation и дополнительное построение transition. Это не полные SQL costs всего HTTP handler, не latency benchmark и не счёт внутренних SQL операций RLS helper.

Exact hydration использует batch Sets по exercise IDs; нет запроса на каждый Set/exercise, нет Template hydration. Существующий legacy `listAthlete` с hydrate на Session не переделывался и не подключён к новому reconciliation path.

## 17. Changed-File Classification

| Категория | Файлы |
| --- | --- |
| Existing API, 2 modified | `app/api/client/workouts/route.ts`; `app/api/workout-sessions/[sessionId]/complete/route.ts` |
| Client UI | modified `components/client/canonical-workout-execution.tsx`; new `components/client/canonical-workout-completion.tsx` |
| Shared logical command | new `lib/client-workout-completion-command.ts` |
| Client read | modified `lib/server/client-workouts/client-workout-query-service.ts`; `lib/server/client-workouts/client-workout-repository.ts` |
| Session command/read | modified `lib/server/workout-sessions/workout-session-repository.ts`; `workout-session-service.ts`; `workout-session-types.ts` |
| Review model/return | modified `lib/server/reviews/review-repository.ts`; `review-types.ts`; `lib/server/trainer-workflow/trainer-workflow-transition-service.ts` |
| Dashboard UI | modified `components/trainer/canonical-trainer-dashboard-model.ts`; `canonical-trainer-dashboard.tsx`; `components/trainer-os/home/attention-workspace.tsx`; `dashboard-read-model.ts` |
| Review UI | modified `components/trainer/review/canonical-review-action-region.tsx`; `canonical-review-evidence.tsx` |
| Schema/RLS | new `database/migrations/0016_workout_session_completion.up.sql`; `.down.sql` |
| New tests | `tests/backend-foundation/client-workout-r3d-postgres.test.ts`; `tests/ui/client-workout-completion-command.test.ts`; `tests/e2e-canonical/client-workout-completion.spec.ts` |
| Existing PG fixtures/assertions | modified `tests/backend-foundation/athlete-training-postgres.test.ts`; `client-workout-r3b-postgres.test.ts`; `client-workout-r3c-postgres.test.ts`; `notification-outbox-postgres.test.ts`; `workout-review-postgres.test.ts`; `workout-session-postgres.test.ts` |
| Existing browser fixtures/assertions | modified `tests/e2e-canonical/fixtures/long-review-fixture.ts`; `tests/e2e-canonical/long-workout-review.spec.ts`; `tests/e2e-canonical/three-role-pilot.spec.ts` |
| Delivery documentation | new `docs/client-workout-r3d-implementation-v1.md` |

Existing fixtures теперь явно передают No; настоящий legacy-null случай проверяется upgrade fixture. Pagination-only browser fixture проходит active -> terminal с explicit No вместо прямого terminal INSERT. Existing tests не отключались. Ни package/config files, ни старые migrations не менялись.

API diff: существующий POST принимает 3 context поля, сохраняет старые guards/status codes, добавляет безопасный `refreshWarning`; existing exact client GET принимает optional correlation pair и сохраняет no-store/actor capability check. Новых маршрутов или context-save endpoint нет.

## 18. Verification

| Проверка | Результат |
| --- | --- |
| Full PostgreSQL | 153 passed, 0 skipped |
| All UI/unit `tests/ui/*.test.ts` | 86 passed, 0 skipped |
| Full canonical Chrome E2E | 10 passed, 1.7 minutes |
| TypeScript `tsc --noEmit` | Passed, no errors |
| ESLint `npm run lint` | Passed, no errors/warnings |
| Production build | Passed, including production TypeScript and static generation |
| `git diff --check` plus untracked whitespace checks | Passed, включая все 8 untracked files |

Подробные runtime logs локального выполнения: `/tmp/r3d-postgres.log`, `/tmp/r3d-ui.log`, `/tmp/r3d-e2e-full.log`, `/tmp/r3d-tsc.log`, `/tmp/r3d-lint.log`, `/tmp/r3d-build.log`. Это ephemeral evidence, не файлы repository и не секреты.

В общем three-role сценарии остаются DialogContent Description warnings, вне нового R3D completion scenario; источник не локализован отдельным audit в этом задании. Общий browser log также содержит ожидаемую ошибку fetch при намеренной блокировке перехода на Home и NO_COLOR/FORCE_COLOR warnings. Прохождение E2E не означает, что весь существующий UI свободен от accessibility warnings.

Локальный dev server оставлен на `http://127.0.0.1:3011`. Smoke через agent-browser: `/login` и переход на главную работают, страница непустая, error overlay и page errors не обнаружены. Скрин login: `/tmp/r3d-local-login.png`; server log: `/tmp/r3d-local-dev.log`. Основной Completion/Review flow проверялся в изолированной E2E базе, не через добавление тестовых спортсменов в обычную локальную базу.

## 19. Remaining Risks

Внешняя база/production rollout и реальная доставка Telegram не проверялись. Проверка 390x500 эмулирует уменьшение viewport, но не особенности iOS/Android keyboard. Legacy imports требуют собственной проверки происхождения. Down удаляет контекст. Нужен отдельный review новой RLS миграции перед production rollout. Full HTTP SQL-cost/нагрузочный benchmark не выполнен; фактические измерения имеют явно указанную границу.

## 20. General Suspended Profile Policy

`database/migrations/0012_athlete_profile_read_model.up.sql`, policies `athlete_profiles_select_current_trainer` и `users_select_current_coaching_identity`, по-прежнему используют `status IN ('active','suspended')`. Они не изменены и не нужны для historical workflow authorization. Более широкий general suspended Profile доступ остаётся отдельным security-hardening finding. R3D не утверждает, что прежний доступ теперь запрещён; он не добавляет Profile/history capability из Review lineage.

## 21. Scope Boundary

R3E не начат. Progress, Motivation, Program, body-area/severity, session RPE/readiness, AI, messaging/payments и redesign общего suspended Profile не реализовывались.

## 22. Git Delivery

Единственный новый commit этого задания: documentation checkpoint из раздела 2. Implementation, migration, tests и этот отчёт оставлены uncommitted/unstaged. Push не выполнялся. Generated test/build artifacts не добавлялись в Git.

Финальный статус: 26 modified + 8 untracked, staging area пустая. Разбивка: 19 production-файлов, 2 migration-файла, 12 test/fixture-файлов и 1 implementation report. `.env*`, `.next`, `node_modules`, `test-results`, `playwright-report`, `.DS_Store` и build cache остаются ignored.
