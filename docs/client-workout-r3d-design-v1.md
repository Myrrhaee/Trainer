# R3D: canonical client workout completion UX v1

Date: 2026-09-03
Status: UX proposal on accepted product rules; not implemented
Baseline: `bdd60a99eb07f07666eacf160af6ac51735fcfe6`
Architecture: [R3D completion contract](client-workout-r3d-architecture-v1.md)

## 1. User task and design verdict

The athlete has finished their actual work and wants to reliably hand the exact Session to their trainer, with a short overall comment and an explicit answer about discomfort. The interface must distinguish local input, persisted results and a completed handoff.

Design a short confirmation surface inside the existing exact execution route, not a new wellness questionnaire or another workout editor. Keep the athlete's existing work visible on return. The result is a persisted completion receipt, not a success toast based on a button click.

Evidence: `components/client/canonical-workout-execution.tsx:405,596-659` already has completion confirmation, partial/zero-result support and canonical commands. Its fresh idempotency key per completion request and lack of structured context are gaps. `components/client/runtime/client-runtime-workouts.tsx:37-60,117-120` is prototype evidence only: its body-area input and hardcoded medium severity are not accepted domain fields.

The founder's current R3-REL-01 and R3D-CONTEXT-V1 decisions take precedence over older open questions in [R3A](client-workout-r3a-architecture-v1.md), [R3B](client-workout-r3b-design-v1.md) and [R3C](client-workout-r3c-design-v1.md). [Product principles](product-principles-v1.md) require one shared training reality and a clear next action; [Core Workflow](core-workflow-v1.md), sections E/H, requires original discomfort signals, atomic completion and safe repeats.

## 2. Entry and exact context

Entry: an own active `WorkoutSession` already opened in R3C at `/client/workouts?session={sessionId}`. Preserve the existing allowlisted return destination (`/client/me` or `/client/workouts`). Never infer Session from an array position, Template, most recent date or another Assignment.

The existing `Завершить` entry opens `Завершить тренировку`. Opening the surface is read-only: it neither completes work nor creates Attention. It refreshes exact persisted summary/version while retaining local dirty/unknown Set state separately. In-page context draft is owned by exact Session ID and cleared when that identity changes.

An already-completed exact URL opens persisted read-only result, never a new form. An unavailable Session stays unavailable; no fallback to another own workout.

## 3. Primary action and eligibility

One primary action: `Завершить тренировку`. While submitting: `Завершаем…`. After persistence: `На главную`. During unknown result, replace the submit action with `Проверить завершение`.

Server eligibility is authoritative: own active Session, active account/athlete capability, current Session version and valid v1 context. A relation suspended/ended after a legitimate Start does not invalidate that Session's completion. No new Start or Assignment is permitted after suspension.

Local safety gate supplements, never replaces, server eligibility:

| Local condition | Behavior |
| --- | --- |
| No dirty/unresolved Set, exact read ready | Context can be entered; submit after explicit Yes/No and other required confirmation. |
| Dirty Set or known failed save | Explain which exercise/Set has unsaved input; `Вернуться к подходу` focuses it. Explicit discard may drop only local edits and reload persisted facts; never silently save/discard as part of Complete. |
| Set command saving | Wait; completion disabled. Show exact local operation status. |
| Set outcome unknown/conflict | Completion disabled. Resolve exact command first. Do not treat a disabled pending spinner as resolution. |
| Exact refresh failed or version changed | Keep context text in memory; refresh and show new persisted summary; require confirmation of the updated basis. |

Partial completion is supported. Missing Sets do not have to be filled just to pass validation. But unresolved local mutations must be resolved before a terminal command can freeze the Session.

## 4. Transition map

```text
R3C exact active Session
  -> open completion + exact refresh
     -> dirty / saving / unknown Set -> resolve in R3C -> reopen
     -> ready persisted summary
        -> comment + explicit Yes/No (+ comment when Yes)
        -> explicit zero-result confirmation when required
        -> Complete with one frozen command attempt
           -> validation/known failure -> keep form and exact inputs
           -> outcome unknown -> Check exact Session/own receipt
           -> conflict -> persisted result or refreshed basis, never overwrite
           -> persisted success -> read-only receipt
              -> Home OR Workouts

same persisted completion
  -> one trainer Review AttentionItem
  -> Dashboard / Queue -> exact canonical Review -> existing Feedback flow
```

Trainer visibility must not depend on active roster membership or notification delivery. The architecture identifies the current RLS, identity-join and Dashboard blockers; this UX is not claimed to work before those changes.

## 5. Return and restoration

Before submission, `Вернуться к тренировке` closes the surface, restores the selected exercise, scroll anchor and focused Complete entry, and preserves in-memory context for this Session. Escape/backdrop on the ready form has the same cancel behavior; accidental closure must not silently clear the form.

During sending/unknown, closing the surface does not cancel or create a command. Keep the attempt in the exact execution owner and show unresolved completion status on return; block fresh Save/Complete until reconciled. Do not trap browser navigation indefinitely. Warn on leaving with unsaved/unknown input using the existing unsaved-navigation conventions where available; always allow explicit departure.

After a reload, persisted Session is authoritative. If terminal, show actual receipt. If active and no browser attempt survives, show exact saved logs and require a new explicit completion confirmation. No localStorage copy of discomfort text, no automatic repeat on mount.

Success actions use `/client/me` and `/client/workouts`, not `router.back()`. The old exact URL remains a read-only persisted result. Home/Workouts refresh canonical source after return and no longer present this Session as active. Building a completed-history list or new detail route belongs to R3E and is not designed here.

For trainer return after suspended-workflow Review, retain R2A.3 but prefer Queue/receipt rather than a forbidden general profile. Hide unavailable new-assignment actions; do not widen Profile permissions merely to make a return link work.

## 6. Screen hierarchy and wireframes

Reuse `Dialog`, `DialogTitle`, `DialogDescription`, Button, Textarea and existing execution labels. Proposed presentation: responsive dialog/sheet on the same URL. Desktop has one compact content column, maximum approximately 560px; mobile uses a vertically scrollable full-width sheet with safe-area spacing. No decorative nested cards or comparison table. Radius follows the existing UI primitives. No new visual asset is required for a text confirmation surface.

Order:

1. Heading `Завершить тренировку` and concise workout identity.
2. Persisted summary: exercises, Sets with results, skipped, incomplete/missing.
3. Factual omissions message when relevant.
4. Existing explicit zero-result confirmation/reason when no completed Sets.
5. Optional `Комментарий тренеру`.
6. Required `Был ли дискомфорт во время тренировки?` with unselected Yes/No.
7. Conditional `Опишите, что почувствовали` when Yes.
8. Local validation/command status.
9. Primary Complete, secondary Return to workout.

### Mobile 390x844

```text
+------------------------------------+
| Завершить тренировку            [x] |
| Полное тело A                      |
| 4 упражнения                       |
| С результатом      6 из 10 подходов |
| Пропущено          2               |
| Без полного результата 2           |
|                                    |
| Не все результаты заполнены        |
|                                    |
| Комментарий тренеру (необязательно) |
| [                                ] |
| [                                ] |
|                                    |
| Был ли дискомфорт во время         |
| тренировки?                        |
| ( ) Нет             ( ) Да         |
|                                    |
| [ Завершить тренировку            ] |
|      Вернуться к тренировке        |
+------------------------------------+
```

Numbers are wireframe examples, never runtime mock defaults. With Yes, the conditional textarea follows the radio group and pushes actions downward in natural flow. At 390x500 and with the virtual keyboard, content scrolls; no fixed footer overlays the field or Save/Complete action.

### Desktop 1440x1024

```text
              +----------------------------------------+
              | Завершить тренировку               [x] |
              | Workout title                          |
              | Persisted summary / omissions          |
              | Optional overall comment               |
              | Explicit discomfort No / Yes           |
              | Conditional original comment           |
              | Status / exact field validation        |
              | Return to workout       [Complete]     |
              +----------------------------------------+
```

Execution remains context behind the modal, not a second editable layer. Long title/comments wrap. At 200% zoom the single-column layout scrolls vertically with no horizontal document overflow; do not scale font size with viewport width.

## 7. Completion state model

| UI state | Source and available action |
| --- | --- |
| `loading_exact` | Exact Session/summary load; no submit or placeholder counts. |
| `unavailable` | No permission/malformed/missing source; safe Home/Workouts link. |
| `local_work_unresolved` | Known dirty/saving/unknown Set; return to exact Set. |
| `ready` | Persisted summary + current version + valid capability; editable context. |
| `validation_failed` | Preserve inputs, focus exact field; no persisted claim. |
| `submitting` | Frozen payload/key/version; prevent double submit; announce status. |
| `known_failure` | Server proves no persistence; retain input; unchanged retry keeps attempt. |
| `outcome_unknown` | Outcome cannot be established; freeze attempt, offer Check, not fresh Complete. |
| `stale_conflict` | Logs/version or completion context changed; show exact persisted state separately. |
| `completed` | Server receipt/context confirmed; replace form with receipt. |
| `completed_elsewhere` | Another tab completed; no overwrite, no second command, show actual result. |

Names above are UX states, not new PostgreSQL enums. Existing `active/completed/completed_with_omissions/abandoned` and Set statuses remain domain facts.

## 8. Omissions and zero-result semantics

Use server-persisted counts on the exact version that will be submitted:

- planned Sets = exact Session planned Set rows;
- with result = status `completed`;
- skipped = status `skipped`;
- incomplete = status `incomplete`;
- not recorded = status `pending` (or explicitly unavailable source, never silently zero).

Completed/skipped/incomplete/pending counts partition the Sets. `С результатом` is clearer here than R3C's broader `сохранено`: a saved Skip is persisted but not a completed result. Show separate count labels; do not sum skipped into completed. Zero repetitions explicitly saved as completed remains a real zero under the current server contract, not a missing value.

Omissions copy: `Не все результаты заполнены`. Supporting factual text: `Тренировку можно завершить с пропусками. Тренер увидит сохранённые результаты.` No red quality score or pressure to invent results. On commit, pending becomes incomplete; skip remains skip.

With zero completed Sets retain existing checkbox `Подтверждаю завершение без выполненных подходов` and optional reason. Reason is not the overall comment and not discomfort. It is not mandatory under the existing command. Missing confirmation focuses this checkbox; server 422 retains the form.

## 9. Overall comment and discomfort interaction

| Field | Behavior |
| --- | --- |
| Overall comment | Optional, proposed 2000-character limit; preserve original wording/line breaks; whitespace-only -> null. Visible label, not placeholder-only. |
| Discomfort question | Semantic radio group, no default. User explicitly chooses `Нет` or `Да`. Omitting it is validation failure, never false. |
| Yes comment | Visible required textarea, proposed 1000 characters. Whitespace-only invalid. No body area, severity or diagnostic wording. |
| Yes -> No | Hide textarea, remove its value from submitted payload; persist null. In-memory draft may remain only while editing this same form so toggling back does not lose typing. Clear draft on successful completion. |
| No -> Yes | Restore in-page unsent draft if present; otherwise empty required field. No auto-fill from Set comments or zero-result reason. |

Do not use an on/off toggle that implies a default No. Radio choice is a required answer, not a preference switch.

Source wording: `Был ли дискомфорт во время тренировки?` / `Опишите, что почувствовали`. No diagnosis, severity inference, urgency score, AI recommendation or promise of medical response.

Original overall/discomfort text is athlete-owned. Trainer Review displays it as Session context, with discomfort before ordinary deviations. No proposed UI lets the trainer edit that original text. Old null context displays `Данные о дискомфорте не собирались`, not `Дискомфорта не было`.

## 10. Success receipt

Only persisted success replaces the form with:

```text
Тренировка завершена
{workout title}
{server completion date and time}

Результат сохранён.
Тренировка отправлена тренеру на разбор.

[На главную]
К тренировкам
```

When true: `Комментарий о дискомфорте сохранён и будет виден тренеру.` This copy requires bounded trainer read/Review capability to be implemented. It confirms in-product work creation, not a delivered Telegram message.

Do not promise reply time, notification delivery, AI analysis or a history screen that does not exist yet. Use the server completion timestamp, formatted in the Session timezone; do not replace it with browser click time. No form resubmit button on a terminal result.

Focus receipt heading (`tabIndex=-1`), announce once. If navigation subsequently fails, keep the persisted receipt and allow retrying navigation only. Never turn a routing failure into `completion_failed`.

## 11. Failure and unknown reconciliation

| Scenario | Copy / action / retained state |
| --- | --- |
| Missing Yes/No | `Выберите «Да» или «Нет».` Focus radio group; retain other text. |
| Yes without comment | `Опишите, что почувствовали.` Focus textarea; no POST. |
| Excess text | Exact field error with limit; no truncation without user action. |
| Dirty/known failed Set | `Есть несохранённые результаты.` Link exact exercise/Set; context remains in memory. |
| Unknown Set save | `Сначала проверьте сохранение подхода.` Complete disabled; return to exact Check action. |
| Known completion failure | `Не удалось завершить тренировку.` Retain full context, same-key Retry for unchanged attempt; permit editing after known rollback. |
| Unknown completion | `Не удалось подтвердить завершение тренировки.` Focus status, `Проверить завершение`; no fresh random key, no assumption of failure. |
| Exact read remains active, same version, no receipt | Replay frozen command with the same key. Another write before replay is caught by server version check. |
| Exact read confirms same completion/context | Show receipt without another completion write. |
| Other tab completed with different context | `Тренировка уже завершена в другой вкладке.` Show actual persisted result; preserve unsent text in-page, no overwrite or follow-up context command. |
| Active logs/version changed | `Результаты тренировки изменились.` Refresh summary; require explicit reconfirmation on current version. No silent token update in old attempt. |
| Suspended before Start | New Start unavailable; do not offer completion for a nonexistent Session. |
| Suspended after Start | Existing Session remains completable. Quiet factual notice only if needed: `Связь с тренером приостановлена. Начатую тренировку можно завершить.` |
| Ended after Start | Same workflow guarantee, copy uses `Связь с тренером завершена`. No invitation/new assignment CTA. |
| Account/capability permission lost | Generic unavailable; hide sensitive fetched data on confirmed permission loss; require sign-in or safe return. No repeated POST. |
| Attention/receipt/audit/context/outbox SQL failure | Transaction failure or unknown outcome; no success receipt. Check exact Session first for 5xx/transport uncertainty. |
| Notification delivery failure after commit | Keep success. Do not retry completion or make athlete troubleshoot delivery. |
| Navigation failure after commit | Keep receipt; retry only navigation. |

Reference: architecture sections 3/9 define exact matching receipt and normalized payload behavior. Status `active` alone is not enough for safe replay: same version is necessary. All unresolved outcomes are local to the exact Session; never choose another workout as recovery.

## 12. Mobile and keyboard behavior

- Primary viewport 390x844; keyboard-equivalent 390x500; desktop 1440x1024 and 200% browser zoom.
- All touch controls at least 44px including close, radios' clickable labels and return action.
- Modal max-height follows available viewport (`dvh` or existing equivalent); one scroll container, safe-area bottom padding. Actions are in content flow, not a fixed footer above the keyboard.
- Textarea remains scrollable into view when focused. Conditional comment insertion must not cover controls or jump to the bottom automatically.
- Numeric Set inputs stay in R3C; this surface contains text context and a required choice, not a broad actual-results table.
- Long title, 2000-character overall comment and 1000-character discomfort comment must wrap; no horizontal overflow or tiny shrinking type.
- Browser Back/Forward and explicit return preserve exact identity; mobile swipe/back does not create a second POST.

## 13. Accessibility requirements

- Use existing accessible Dialog title/description and focus trap, with correct close semantics. No missing `aria-describedby` warning on the new surface.
- Use `fieldset`/`legend` or equivalent semantic radio group; arrow-key selection, Tab order and required state are announced. No preselected answer.
- Labels remain visible; optional overall comment and required conditional text are announced distinctly. Errors use `aria-invalid` and `aria-describedby` on exact controls.
- Submit validation focuses first invalid field in visual order. Unresolved Set action opens the right exercise and focuses its stable Set ID, not an index.
- Sending/unknown statuses have a polite live region; focus unknown status once, not on each polling/render. No automatic polling loop is required.
- On success focus receipt heading; on Return restore invoking control and scroll anchor. If it no longer exists, focus exact Session heading.
- Visible focus rings, text/status icons as well as color; no hover-only action.
- Reduced motion removes nonessential transition/spinner motion; no animation-dependent completion state.
- Required browser assertions: keyboard-only complete/cancel/Check; focus after each outcome; 200% zoom; 390x500 textarea/action reachability; no overflow; no new console/a11y warnings.

## 14. Loading, empty and stale states

| State | Treatment |
| --- | --- |
| Exact loading | Stable heading and loading region; no mock summary/counts. |
| Unavailable | Generic explanation and safe destination; no other Assignment fallback. |
| No actual results, planned rows exist | Zero-result confirmation + optional reason, explicit discomfort answer; partial completion allowed. |
| Partial logs | Show persisted completed/skipped/incomplete/pending counts and factual omissions. |
| Structural source unavailable or unexpectedly absent | Do not show all-zero success summary; require refresh/unavailable according to server eligibility. |
| Already completed | Persisted result/receipt, context availability and no writable form. |
| Stale execution | Refresh exact version/summary while retaining unsent context; explicit reconfirmation. |
| Context persistence failure | No standalone context-saved state: the whole completion either commits or remains failed/unknown. |
| Review item already exists | For a legitimate completed Session, show receipt. If Session still active or identities disagree, show integrity conflict; do not synthesize success. |
| Relation changed | Server capability decides Start versus existing-Session continuation; client cannot infer authorization from old profile context. |

## 15. Keep / adapt / remove / defer

| Disposition | Elements and source |
| --- | --- |
| KEEP | Exact R3B URL and safe return, R3C persisted logs/plan, explicit confirmation, optional zero-result reason, shared UI primitives, server version/receipt commands. |
| ADAPT | Current completion Dialog into short context-and-summary sheet; fresh-key `complete()` into frozen attempt; terminal toast into durable receipt; local command gating; mobile scrolling and focus restoration. |
| ADAPT minimally downstream | Review original context rendering and Queue visibility/return for suspended workflows. No new Review layout, no profile/history expansion. |
| REMOVE FROM CANONICAL proposal | Demo wellness fields, fixed `severity=medium`, area input, automatic interpretation, fake completion before receipt, new random key on Check, completion while a Set outcome is unresolved. Prototype files are not deleted. |
| DEFER | Body area/map, severity, session RPE, readiness/feeling, diagnosis, AI, R3E history, Progress, Motivation, Program, messaging, payments. |

## 16. Acceptance criteria and verification boundary

1. Exact active Session opens a read-only confirmation basis without mutation.
2. One primary action; no new workout or Template selection inside completion.
3. Persisted summary counts are distinct from local edits and do not turn null/missing/skipped into zero/completed.
4. Partial completion is allowed; zero-completed-Set confirmation remains explicit.
5. Dirty/saving/unknown/conflicted Set state cannot be bypassed by Complete.
6. Overall comment is optional; Yes/No is explicit and initially unselected; Yes requires original text; No persists no stale comment.
7. Session context, completion, Attention, receipt, audit and outbox are one authoritative operation.
8. Unknown Check preserves command ID/payload; persisted/equal, unchanged/current and incompatible states are distinct.
9. Second-tab completion never overwrites original context or duplicates Attention/receipt/outbox.
10. Success replaces form, uses server time, survives reload and is not undone by navigation/delivery failure.
11. Return restores exact exercise/focus; Home/Workouts refresh canonical state; no R3E screen is promised.
12. Before-start suspension blocks new work; after-start suspension/end preserves Save/Complete and original trainer Review/Feedback without general athlete access.
13. Dashboard shows each pending Session including suspended-workflow items; discomfort is ahead of ordinary deviations, original text is available in Review.
14. Legacy null context remains unsupported/not collected; false means explicit No; unreadable data never becomes known empty.
15. Foreign/invalid Session, different trainer, inactive account/capability and manipulated fields fail closed.
16. Mobile 390x844/390x500, desktop keyboard, 200% zoom, 44px targets, semantic radio group, exact focus and no overflow are tested after implementation.
17. No body area, severity, session RPE, AI interpretation or broader questionnaire is introduced.

These are acceptance requirements, **not a claim of tested R3D implementation**. Current baseline regression is recorded in the architecture companion; the proposed screens have not been rendered or browser-tested because this stage permits documentation only.

### Scope confirmation

Only `docs/client-workout-r3d-architecture-v1.md` and this file are created in R3D. No production UI/code, API, repository/service, RLS/schema/migration, test, route or package file was changed. No R3D implementation, migration SQL, R3D commit or R3E implementation was started.
