# R3E: Client Feedback And Completed History UX

Date: 2026-09-04
Status: UX direction accepted by founder; R3E-03 amended to append-style pagination; documentation update awaiting review, not implemented or browser-verified
Baseline: `83ecb22651fb927cc3bf1970be79678331ae30ef`
Branch: `codex/r3e-client-feedback-history`
Architecture and evidence register: [R3E architecture](client-workout-r3e-architecture-v1.md)

## 1. User Task And Design Verdict

The athlete asks: **"Что я сделал в этой тренировке и что ответил тренер?"**

The experience must make four things easy: trust the persisted completion, see the exact facts/context sent to the trainer, read the trainer's response, and find the same workout later. It is a read-only continuation of R3D, not a second execution form, social feed or analytics page.

Recommend one Workouts collection with clearly separated current work and completed history. Exact completed Session uses the existing query route but a distinct read-only hierarchy. Identity/date comes first, then the trainer's answer, own completion context and recorded execution. No repeat-workout or new-assignment action is invented.

Current evidence: `CanonicalClientHome` serves Home/collection but only loads current Assignments; `CanonicalWorkoutExecution` already opens exact terminal Sessions but keeps execution-oriented composition and puts feedback last. Its feedback failure handler converts failures into empty data. These are gaps, not reasons to copy the entire demo cabinet. See architecture E01/E02/E06/E09.

Product authority: Principles 3/4/8/9/12 and Core Workflow A/H/I require shared facts, useful transitions and visible feedback. Founder acceptance is explicit in the task; the current amendment confirms append-style R3E-03. Revised documentation is submitted for review, not permission to implement or commit yet.

## 2. Entry Points

| Entry | Athlete intent | Destination and preserved context |
| --- | --- | --- |
| `/client/me`, current work | Continue current training | Existing exact Assignment or active Session; R3B/R3C unchanged |
| `/client/me`, latest trainer answer | Read the reply | Exact completed Session + same Feedback ID; return Home feedback block |
| `/client/me`, `Все тренировки` | Find earlier work | Workouts collection, history available even with no current Assignment |
| `/client/workouts`, completed row | Inspect this saved workout | Exact Session; preserve history start cursor, successful loaded-page depth and row ID |
| R3D completion receipt | Confirm handoff, then see result | Same exact terminal Session, no second Complete command or new identity |
| Direct own Session URL | Open a known workout | Exact status-owned detail; safe Workouts/history fallback |
| Browser Back/Forward | Continue navigation | Exact original Session or full saved accumulated collection depth through canonical replay; no last-item fallback |

Existing generic feedback notification lands at `/client/me` (`notification-messages.ts`, review_feedback_ready). The proposed latest block helps discovery but is not guaranteed to match an older notification. Do not claim exact notification deep links are implemented.

## 3. Route And Transition Map

Recommend R3E-01 option A:

```text
/client/me
  -> current Assignment / active Session (existing R3B/R3C)
  -> latest answer -> /client/workouts?session=S&feedback=F&returnTo=HOME
  -> all workouts -> /client/workouts

/client/workouts?historyStart=C&historyDepth=D#history
  -> exact row S
  -> /client/workouts?session=S&returnTo=ENCODED_COLLECTION_WITH_ROW_ANCHOR
  -> replay pages 1..D and append -> focus row S

direct ?session=S
  -> active: existing execution
  -> completed / completed_with_omissions: read-only completed detail
  -> foreign / malformed / missing: generic unavailable
```

`HOME`, `C`, `D`, `S`, `F` are notation, not literal runtime values. C is the initial-page replay boundary token, D is successfully loaded history page depth, and the UI uses 10 rows per request. Actual IDs must be canonical and actor-authorized. The `feedback` query selects a bounded thread window containing F; `#feedback-F` supplies a focus anchor. Feedback paging is separate from append-style history. A view flag cannot turn an active Session into a completed result.

Alternatives were compared in architecture section 6: a nested Session page or separate history route still needs cursor/return handling and adds link compatibility work. Keep query routing only if exact identity, remount/reset and restoration gates pass. No route was changed in this design pass.

Return parser accepts only Home and neutral Workouts with validated historyStart/historyDepth and semantic row anchors. It does not accept arbitrary URLs, trainer flow, execution identities as return destinations or nested returnTo. Unsafe return URLs fall back safely without changing Session identity. Invalid history cursor/depth resets only history pagination with an explicit notice; current work stays intact. Invalid Session never falls back to another athlete-owned workout.

## 4. Client Home Feedback Block

Keep the main Home task, `Что делаем сейчас`, and one current workout. Add a small independent band:

```text
Последний ответ тренера                  {sent date}
Тренер ответил на тренировку «{title}»
Посмотреть ответ ->
```

For a follow-up, use `Уточнение тренера` with the same exact link. No unread dot/count, "новое" badge or "прочитано" state: canonical read receipts do not exist. Do not copy Supabase client_seen_at or demo feedback_viewed semantics.

Place the block after current work, before the always-available `Все тренировки` link. It remains visible when no next Assignment exists. Compact empty-current copy must not occupy 60vh and push this answer/history out of reach. This is a later targeted Home composition change, not a Home redesign performed now.

No answer after a successful query: omit block. Answer query failed: small `Не удалось загрузить последний ответ` + `Повторить`; keep current workout/history access. Loading does not fabricate a title or assert "ответов нет". Do not include discomfort text or a long feedback body on Home.

Source: proposed LIMIT 1 own feedback/title read, architecture section 5; current Home has no such read (E01). Latest persists until superseded by another real answer; viewing does not dismiss it or mutate anything.

## 5. Workouts Collection Hierarchy

1. Heading `Мои тренировки`, navigation `На главную`.
2. `Текущие и ближайшие`: current/upcoming Assignment facts and existing capability-based entry.
3. `История тренировок`: initially 10 completed Sessions, then all successfully appended cursor pages.
4. `Показать ещё` appends the next page; at exhaustion `Все тренировки показаны`. No total-page counter without a source.

Current and history are independent load/error/empty regions. A current-work error must not hide history; a history error must not remove current execution access. No current Assignment does not imply no completed Sessions. R3E does not mix upcoming and completed rows into one date feed or add calendar/Program grouping.

At many current items, keep the existing bounded collection and a compact current-work region so history remains reachable. Its current hasMore-without-pagination behavior is a separate limitation, not resolved by calling history pagination a current-list fix. Do not invent automatic selection of another active Session or promote a canStart=false Assignment into an actionable Start.

### Desktop Low-Fidelity Wireframe, 1440x1024

```text
                 constrained content, no decorative outer card
< На главную
Мои тренировки

Текущие и ближайшие
{workout title}   {scheduled date}               Продолжить ->
----------------------------------------------------------------
История тренировок
{title}          {completed date}  {result}       Ответ тренера  ->
{title}          {completed date}  {result}       Пока без ответа ->
...
                          Показать ещё
                 [after exhaustion: Все тренировки показаны]
```

Rows represent the same exact identities on all viewports. Loading another page keeps earlier rows visible and deduplicates by Session ID. The 10 default / 30 maximum applies to a single server request, not the total displayed history. No KPI wall, charts, badges/ranks or parallel detail preview panel.

## 6. History Row Contract

| Visible element | Source/behavior |
| --- | --- |
| Workout title | Assignment snapshot; wrap, no substitution by current Template name |
| Completion date | Session completedAt in its canonical timezone, semantic time; use year when needed to disambiguate history |
| State | `Завершена` or `Завершена с пропусками` from persisted status |
| Compact result | e.g. `{completed} из {expected} подходов с результатом`, only when coverage/counts are trustworthy; skips/incomplete optional secondary text |
| Feedback state | `Есть ответ тренера`, `Есть уточнение`, or `Пока без ответа` after a successful scoped summary read; failure `Ответ недоступен` |
| One navigation action | `Открыть тренировку` with unique accessible title/date; real link to Session ID |

Example counts in wireframes are placeholders, not demo defaults. Never present missing logs as zero; partial source uses `Часть результатов недоступна`. No discomfort text, private review reason, AI estimate, duration or volume on the row. A feedback icon may accompany text, never replace its meaning.

Prefer semantic `ol/li` or `ul/li` and one link per row. No nested clickable card/buttons. Stable anchor `workout-{sessionId}` and stable React key are Session ID, never date/index. Numeric zero is a fact, not an empty value. Multiple workouts completed on the same day remain separate rows.

## 7. Exact Completed Detail

Order:

1. Deterministic return link (`К тренировкам` or `На главную`).
2. Snapshot workout title, completion date/time and persisted terminal state; scheduled date as secondary context.
3. `Ответ тренера`: thread, known-empty or scoped error state.
4. `Что вы передали тренеру`: own overall comment, discomfort answer/text, optional zero-result reason.
5. `Результаты тренировки`: compact factual summary, prescription/instruction, ordered exercises with plan/actual Sets and own comments.
6. Secondary repeat of the same safe return at the end of long detail.

Feedback is before execution because the post-completion job is usually to read the answer. It is not an overlay hiding results. Result heading remains visible in page structure; add a plain in-page `К результатам` link for long threads. Do not force the athlete through input controls or reopen completion.

R3D immediate receipt may remain a concise persisted handoff confirmation, but do not show two competing full-size success headers or two primary Home buttons. Ordinary historical reopen should read as a workout record, not celebrate completion on every visit. Never remove the actual persisted result because navigation or feedback loading failed.

### Exact Identity And Plan/Actual

Exercise disclosure heading: snapshot title and factual result coverage. Opening displays exact planned versus actual facts using stable Assignment/Log identities. On mobile, stack `План` and `Факт` for each Set. Include fixed/range repetitions, duration, load, rest, Set kind and per-Set differences from canonical prescription; display existing actual Set RPE only if present, never synthesize Session RPE.

Skipped -> `Пропущен`; incomplete -> `Без полного результата`; missing -> `Данные недоступны`. Keep true numeric 0 distinct from missing. Own comments appear with their exact Set, not rolled into the overall comment. Legacy Session planned snapshots may be labelled as such; missing source identity is not repaired by position matching.

Show Assignment instructions/trainer note as athlete-visible prescription, not a private trainer note. No Preview Drawer, another workout selector, edit/repeat button, charts or new exercise-log command.

## 8. Feedback Thread

Use the same TrainerFeedback.id/sessionId/kind/body/sentAt/followUpOfId. Do not rename sentAt to createdAt; DB has both, existing public API uses sentAt (architecture E10/E13). Author metadata can fall back to `Тренер` without exposing a restricted profile.

Kind labels:

- detailed: `Ответ тренера`;
- acknowledgement: `Короткий ответ`;
- follow_up: `Уточнение`.

Chronological order oldest-to-newest within the shown window, stable sent_at/id. Each message has author, semantic date/time and original body. Follow-up includes a text link `К ответу от {date}` targeting its actual parent, including a previous follow-up. Do not imply a correction overwrote the original message or hide the initial answer by default in a short thread.

Long thread: bounded pages of 20, maximum 50, and explicit `Следующие ответы` / earlier-context navigation. A Home exact-feedback link opens a server-selected bounded window containing that message, then focuses its heading; show that earlier messages exist. Parent outside loaded window uses a bounded same-Session lookup upon click, not automatic recursive fetch. Missing parent -> `Исходный ответ недоступен`; preserve authorized child body, no cross-Session fallback.

No feedback: `Тренер ещё не оставил обратную связь.` Normal state with results/context still available. Do not say the trainer has not opened the workout or that the Review remains open. Manual resolution may exist but is trainer-private. No response-time promises, chat composer, "ответить" action or read/unread controls.

Source failure: distinct `Не удалось загрузить ответ тренера` + `Повторить`. Retry only reads; it never completes Session, resolves Attention or sends a message. On focus/return, refresh current thread window; retain position and announce changes calmly without scrolling to newest automatically. Same Feedback ID cannot appear twice after retry/refresh.

## 9. Session Context Presentation

| Canonical availability/fact | Copy/treatment |
| --- | --- |
| All-null legacy context | `Данные о дискомфорте для этой тренировки не собирались` |
| discomfortReported=false, valid tuple | `Дискомфорт не отмечен` |
| true + original nonblank text | `Вы отметили дискомфорт` followed by exact original text |
| Context source unavailable or invalid tuple | `Данные о дискомфорте недоступны`, never explicit No |
| Overall comment unsupported legacy | `Общий комментарий для этой тренировки не собирался` |
| Overall comment collected, empty | `Общий комментарий не оставлен` |
| Overall comment ready | Original text with line breaks under `Ваш комментарий тренеру` |
| Existing zero-result reason present | Separate `Причина завершения без выполненных подходов` |

No body map/area, severity, diagnosis, readiness or AI interpretation. Do not infer discomfort from Set comments or Attention priority. Long text wraps naturally; optional collapse must have keyboard-accessible expand and retain full text, never truncate persisted content.

## 10. Loading, Empty, Error And Stale States

| State/scenario | Presentation and allowed action |
| --- | --- |
| Home has no Assignment but has feedback/history | Compact current-empty state plus independent answer/history entry |
| No completed Sessions | `Завершённых тренировок пока нет.` No mock example rows |
| Current read fails; history succeeds | Local current error; history remains usable |
| History initial load | Stable heading and status; no mock count or fabricated row |
| History read fails | `Не удалось загрузить историю` + Retry; don't call it empty |
| Load More fails | Keep all appended rows and successful depth; local pagination error, Retry same cursor, no duplicated request loop |
| Return/reload replay in progress | `Восстанавливаем историю: загружено {k} из {D} страниц`; append each successful page, preserve target anchor; counts refer to requested depth, not total database history |
| Replay fails after page k | Preserve restored prefix and target depth D; `Не удалось восстановить историю полностью` + Retry from failed cursor; do not claim anchor absent while unread pages remain |
| Invalid/expired-format cursor or malformed depth | Reset only history pagination to initial canonical page with `История обновлена: сохранённая позиция недоступна.`; current/upcoming unaffected; fresh-read failure uses local Retry, no reset loop |
| Long history/exhausted | Keep accumulated rows; Load More only if hasNextPage; otherwise `Все тренировки показаны`; no invented total or hidden depth cap |
| Exhaustion before saved depth | Keep all available rows; explain `История изменилась: показаны все доступные тренировки.` and normalize depth to successfully read pages; not a silent restore limit |
| Exact loading | Stable identity region with loading label, no previous Session's sensitive content |
| Exact foreign/malformed/missing | Generic `Тренировка недоступна`; safe Home/Workouts return; no other Session fallback |
| Exact valid active | Existing R3C execution, never read-only completed representation based solely on URL |
| Exact completed, no feedback | Normal no-answer state plus full available context/results |
| Feedback read fails | Independent Retry; preserved Session facts stay visible |
| Legacy null context | Explicit not-collected labels, not "discomfort absent" |
| Partial old logs/prescription | Show available exact facts and affected-source unavailable label; no all-zero summary |
| Suspended/ended relation | Own history and existing feedback remain; no new relationship-dependent action or takeover |
| Account/athlete capability denied | Fail closed, remove sensitive data after confirmed denial; relation suspension is not account suspension |
| Follow-up arrives | Refresh same thread window; polite new-content status, no unread persistence or forced scroll |
| Feedback anchor not in exact Session | Unavailable-target notice; never read another Session to satisfy it |
| Browser navigation fails after completion | Persisted result unchanged; retry navigation/read only |
| Return row disappeared | After full requested replay or genuine exhaustion, focus history heading, explain row unavailable, no alternate exact selection |

No loading/error state performs a command. On same-route Session ID change clear old Session-specific UI/state; ignore stale in-flight responses by request identity. Preserve availability distinction through API and renderer, not just copy.

## 11. Navigation And Return

### Home Answer -> Exact -> Home

Link carries exact Session/Feedback IDs and allowlisted Home origin. Returning refreshes latest block and current work, then restores focus to its link if still present. If latest changed or disappeared, focus the Home feedback section/heading. Do not relabel viewed feedback as read.

### Accumulated History -> Exact -> Same Loaded Depth

Initial history loads 10 rows. `Показать ещё` requests the next server cursor page and appends it without replacing earlier rows. Dedupe by Session ID; a retry/duplicate response cannot count as another successful page. Advance depth only after a successful distinct page response. Failed/cancelled reads leave previous rows and depth unchanged. Only one next-page request runs at a time. API default 10 / max 30 is per request; the UI consistently uses 10. There is no accepted total history limit or hidden maximum restoration depth.

After each successful append, replace the collection URL with `historyStart=C&historyDepth=D` without scrolling or adding a Back entry for each page. Before leaving for exact detail, preserve that state with `#workout-{sessionId}` in both collection URL and allowlisted returnTo. C is a server-issued replay token for the original inclusive upper boundary, not the last-page after cursor. D counts successful pages, not displayed row count. This keeps the initial boundary stable when newer completions arrive; it is not a frozen database snapshot.

Explicit `К тренировкам`, Browser Back/Forward and hard reload of the same collection URL replay pages 1..D through canonical PostgreSQL reads: first page under C, then fresh continuation cursors sequentially. Append/dedupe every returned page. For D available pages this costs D history requests, not one; the query limit bounds each request, not total restored depth. Restore all saved depth before focusing/scrolling the semantic row. If it no longer exists, focus the history heading with an explanation. Never restore just the last page or substitute another Session.

Display restoration progress with successfully restored k versus target D. On failure preserve the prefix, target URL and anchor, and retry page k+1; do not restart successful pages in the same mounted replay. If leaving during partial restoration, new return intent records only actual loaded depth k. Exhaustion may finish replay before D only when canonical source really has no more pages, with a visible source-change notice. A cursor/depth validation error resets history pagination only with the explicit notice above. No silent fallback, cap or truncation. Ignore stale responses after navigation; navigation away cancels pending replay, not stored server facts.

Workout rows exist only in transient rendered component state. No localStorage/sessionStorage history cache, persisted query-data cache or browser history-state copy of Session/Feedback/comment facts. URL/history state stores navigation metadata only. Deep restores inherently take more requests and memory; any future cap requires a separate product decision. Failed Load More keeps keyboard focus on its Retry control; successful append keeps the control stable and announces the added count calmly. At exhaustion the replacing status remains focusable when needed, so focus is not lost with the removed button.

### Direct Link And Login

No valid origin -> `/client/workouts#history`, secondary Home link remains safe. Exact authenticated reload already exists. Current layout uses fixed Home login return; a later narrow integration must preserve valid exact intent across authentication or explicitly disclose that limitation. Never claim logged-out deep linking already satisfies the authenticated route contract.

Browser back is available naturally, but the visible return is deterministic and allowlisted, not blind `router.back()`. Reject foreign return URLs and trainer flow values. Restored URL is navigation evidence only; every read rechecks actor ownership. Source freshness uses PostgreSQL read, not localStorage.

## 12. Mobile And Desktop Layout

Primary viewport 390x844, desktop 1440x1024, 200% browser zoom. One column on mobile; restrained text and separators rather than nested cards. Existing dark theme/primitives may remain, no global visual redesign.

### Mobile Collection

```text
< На главную
Мои тренировки

Текущие и ближайшие
{current title}
{scheduled date}           Продолжить ->
----------------------------------------
История тренировок
{snapshot title, wraps}
{completion date} · Завершена с пропусками
{trustworthy result counts}
Есть ответ тренера
Открыть тренировку ->
----------------------------------------
{next row}
...
             Показать ещё
[after exhaustion: Все тренировки показаны]
```

### Mobile Exact Detail

```text
< К тренировкам
{workout snapshot title}
Завершена · {server date/time}

Ответ тренера
{author} · {sent date/time}
{original feedback body, wraps}
Уточнение · К ответу от {date}
{original follow-up}
К результатам
----------------------------------------
Что вы передали тренеру
Ваш комментарий тренеру
{original text / explicit availability}
Дискомфорт не отмечен
----------------------------------------
Результаты тренировки
{summary, no invented metrics}
[v] {exercise title}
  Подход1
  План: {canonical prescription}
  Факт: {persisted actual / skipped}
  Ваш комментарий: {original text}
[>] {next exercise}

К тренировкам
```

On desktop keep the same information order in a readable constrained column, not a wide spreadsheet or feedback sidebar. Use side-by-side Plan/Actual only within sufficient width; reflow to stacks at zoom/mobile. No horizontal scroll required to compare one Set. Long titles, 5000-character feedback, 2000-character overall comments and 1000-character discomfort comments must wrap. Avoid viewport-scaled fonts and negative letter spacing.

44px minimum touch targets for links, pagination and disclosures. No sticky footer covering content, no hover-only action and no new Dialog required. Expose results through semantic disclosures; optional navigation links must not resize rows on hover. Wireframes are design specifications, not screenshots or validated current UI.

## 13. Accessibility Requirements

- Semantic page headings, independent labelled current/history/feedback regions and semantic history list.
- Exact links have unique accessible names containing workout title and completion date; distinguish same-day duplicates with time or another factual label.
- `time` elements expose machine-readable persisted instants; chronological feedback ordered list and visible kind/parent-link text, not color alone.
- Use native details/summary or existing accessible disclosure primitive; Enter/Space, aria-expanded and focus order remain predictable.
- Preserve keyboard focus to exact history row after return. If row gone, focus heading and announce why once.
- Loading, Retry, append and replay progress use restrained polite status regions. Preserve control focus while appending; restore row focus only after requested replay completes or genuinely exhausts. Do not announce every rendered Set or move focus during passive refetch.
- Distinct error/empty/not-collected text; icons decorative when the meaning is already named.
- Feedback deep link focuses its message heading after correct window loads, not a hidden off-screen element. Parent-link focus follows only explicit activation.
- Escape is not required for a nonexistent modal. No disabled editable controls presented as completed results; use readable text.
- Keyboard-only desktop,390x844, short viewport, native 200% zoom and reduced motion are future verification gates. No horizontal document overflow, covered content or clipped focus outline.
- Long text including unbroken words must wrap; body text rendered as text, never HTML from feedback/comments.

These are acceptance requirements, not a claim of screen-reader/axe/native-device QA performed on an unimplemented R3E.

## 14. Keep / Change / Remove From Future Canonical Presentation

| Action | Scope and reuse evidence |
| --- | --- |
| KEEP | R3B exact IDs and active/current read; R3C persisted plan/actual semantics; R3D atomic completion and own historical rights; same Feedback IDs and immutable body |
| KEEP | Existing Button, Link, headings, status/availability vocabulary and accessible disclosure primitives; source prescription and text presentation helpers where independent of trainer-private DTOs |
| CHANGE | `CanonicalClientHome` composition so no-current does not hide history/answer; collection gets independent append-style history with bounded server requests, not a bounded total list |
| CHANGE | Terminal branch of `CanonicalWorkoutExecution` into read-only completed hierarchy, with scoped feedback errors and exact parent linkage; preserve active branch behavior |
| CHANGE | Existing bare-path return parser/helper to strict collection start-cursor/depth/row and Home-feedback context; full-depth canonical replay, actor remains server-owned |
| CHANGE | Feedback serializer/read pagination and zero-result/context detail projection; architecture owns the contract, not a demo component |
| REMOVE from target presentation | Flat newest-first anonymous-parent replies; network error shown as no answer; unrelated Attention/private fields; repeated large success receipt on every historical reopen |
| PRESERVE AS EVIDENCE | Demo/runtime/Supabase history visuals and interaction ideas; no importing their state, stats, read receipts or mutations |
| DEFER | /history redirect/caller cleanup, Progress/R3F, calendars, Program, achievements/rank/title, AI, inbox, notification transport redesign and broad trainer-profile security cleanup |

This table describes later implementation, not file deletion or UI edits now. Do not render trainer Review components wholesale: their capabilities/Attention/manual reasons are not client content. A shared neutral factual presenter is acceptable only after an explicit safe prop contract, not as a reason for a broad refactor.

## 15. Acceptance Criteria And Scope Confirmation

1. Athlete sees current/upcoming and completed history as separate regions; no current Assignment cannot hide past work or latest feedback.
2. History consists of exact own completed Sessions, including completed_with_omissions; same-day Sessions do not collapse; abandoned/cancelled are not silently included.
3. One row opens one Session with immutable snapshot title and canonical Set counts; no mock metrics or fabricated zeros.
4. History initially loads 10 rows; Load More appends, never replaces earlier rows, with Session-ID dedupe. Default 10 / max 30 bounds one server request only. Cursor order retains full precision; no full Session hydration or client-side history slicing. Failed append preserves rows/depth; exhaustion displays `Все тренировки показаны`.
5. Multiple appended pages -> exact -> explicit return, Browser Back/Forward and hard reload of the same URL replay every saved page through canonical cursor reads and restore semantic row focus. Persist successful depth/start boundary/anchor only, no localStorage/sessionStorage history cache. Test deep restores beyond 30 accumulated rows, partial-replay Retry, duplicate responses, missing anchors and no hidden max restore depth. Invalid cursor resets only history pagination with an explicit notice and leaves current work intact.
6. Exact route is status-owned: active remains execution, terminal is read-only; malformed/foreign/missing never opens another workout. Identity changes cannot retain previous Session facts.
7. Exact detail displays readable feedback before own context and factual execution. Facts remain reachable without completing another action.
8. Same Feedback ID/body/sentAt/kind/followUpOfId is visible to athlete and trainer; follow-up links to its actual parent and never overwrites the initial answer.
9. Long feedback threads are bounded; exact incoming feedback can be focused without fetching all prior pages; no per-message or unbounded recursive parent fetching.
10. No-feedback and feedback-read-failed are distinct; private manual resolution is never revealed or inferred as an open task.
11. Legacy null context is not-collected, false explicit No, true original comment; overall unsupported/empty/ready/unavailable states remain distinct.
12. Exact plan/actual uses stable IDs; skipped/incomplete/missing/numeric zero remain different, original own Set/context comments preserved.
13. Home shows at most one latest answer with exact link, no unread/read/new claims or new read-receipt mutation.
14. Own history/feedback remains after suspended/ended relation; trainer-only/foreign actors are denied; new trainer receives no old lineage rights.
15. All reads use PostgreSQL actor-scoped facts; no mutable Template, legacy Supabase, demo runtime or localStorage data fallback.
16. Existing Start/Save/Skip/Complete and trainer Feedback/Review contracts regressions pass after future implementation; reading/navigation causes no domain mutation.
17. Mobile 390x844, desktop 1440x1024, keyboard-only, native 200% zoom, long content, focus restoration, reduced motion and no-overflow gates are verified at implementation time.
18. Capture actual request/query costs and plans against the architecture budgets: one bounded history query per page; D history requests/queries for restoring D available pages, growing rendered memory, plus independent current-work read. Measure initial/append/deep replay/partial-retry separately; no claim of constant total restore cost or measured latency before implementation. Keep external 0016 rollout gate explicit.

This amendment edits only this document and `docs/client-workout-r3e-architecture-v1.md`. R3D was committed separately before this design work. No R3E UI, production code, API, route, test, schema, migration or RLS change; no R3E implementation, staging or R3E commit. Push not performed. Founder acceptance includes the amended append-style R3E-03; the updated documents await review before a documentation commit.
