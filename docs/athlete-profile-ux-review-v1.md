# Athlete Profile UX Review v1

Date: 2026-07-16  
Route: `/trainer/clients/[clientId]`  
Implementation: `components/trainer-os/client-profile/*`

## Verdict

Product status: **core MVP**.  
UX readiness: **requires significant iteration**, with an accepted identity/profile foundation.

The current page succeeds at feeling like a profile of a real athlete more than the other operational screens. The large Overview hero, compact header for work tabs, title/rank assets, and recently aligned training/progress sections should be preserved. It does not yet function as the contextual workspace required by the core loop because it does not retain the source AttentionItem, reason for entry, queue position, or a persistent next action.

The finalized direction preserves identity and human context, carries the source AttentionItem or entry reason, exposes the primary next action, and provides an explicit return to the queue. Client and trainer views use the same WorkoutSession, history, progress facts, and TrainerFeedback, but the trainer interface adds context, decisions, actions, and workload management instead of copying client UI literally.

## Current structure

- Shell header with athlete name and the description “Публичная витрина клиента и рабочие вкладки тренера” (`client-profile-page.tsx:68-73`).
- `Назад к команде` always links to dashboard (`:76-80`).
- Animated large Overview header and compact header for other tabs (`:83-109`).
- Local-state tabs: `Обзор`, `Тренировки`, `Прогресс`, `Финансы и доступ` (`:45-60`, `:113-160`).
- Quick Assign and Workout Review drawers (`:167-183`).
- Reputation dialog and extensive title/rank/achievement assets.
- All athlete content comes from `client-profile/mock-data.ts`; unknown ids fall back to demo profile behavior in that module.

## Jobs coverage

| Profile job | Current coverage | Gap |
|---|---|---|
| Recognize the person | Strong name, avatar/initials, about, goal, club tenure | Real photo/state source remains mock; duplicate shell/local identity. |
| Understand current state | Career stats, training and progress tabs | No concise persistent training/status line across tabs. |
| Understand why profile opened | Not represented | Source AttentionItem and reason are absent. |
| Review coaching history | Workouts, progress, notes/activity blocks | History exists as presentation fragments, not one event timeline. |
| Take action | Assign/review in Training tab | Actions are not persistent or selected by source reason. |
| Return/continue | Static “Назад к команде” | Does not restore queue position or advance to next item. |

## Header audit

### Data needed always

- Athlete name and reliable avatar/initials.
- One concise goal/context line.
- Current coaching/training status relevant to work, for example active, paused, awaiting assignment, or awaiting review.
- Source reason when entered from AttentionItem.
- One primary action determined by that reason.
- Return path (`К очереди` with position) when entered from queue.

### Data needed only on Overview

- Two-line personal description.
- Club tenure.
- Career-level training count, weight change, and consistency streak.
- Expanded reputation presentation.
- Personal portrait, achievements, notes, photos, and richer activity narrative.

### Identity

Name, avatar, about, goal, and club tenure are identity/context. They should remain visually calm and athlete-first. The removal of trainer-side photo editing and the single-circle initials treatment are appropriate for role clarity.

### Status

Waiting for review, needs assignment, paused access, recent discomfort signal, and current training phase are operational status. They should not be represented as decorative badges or mixed into rank.

### Decorative/gamification

Title, rank/reputation, achievements, and streak celebration are an accepted secondary motivation and identity layer. They remain in the product and may use compact title/rank treatment in the Header with details on click, but they do not compete with current state, attention reason, primary action, or progress and are not a blocker of the core workflow.

### Click behavior

- Rank remains clickable to explain the rank system; current dialog is a useful prototype.
- Title may be explanatory later, but should not become a primary action.
- Status/reason should open its source context or relevant tab.
- Primary action should be directly actionable without searching the tabs.

### What currently overloads the header

Desktop Overview presents name, title, about, goal, tenure, three career KPIs, and a large rank at once (`client-profile-page.tsx:189-235`). This is visually premium, but the entire block plus shell consumes substantial space. On 390x844, identity and rank create a long first screen before operational context.

### What looks unnatural

- “Публичная витрина клиента” is implementation language, not a coach's job.
- A neutral profile always returning “к команде” ignores whether entry came from Clients, queue, review, or a notification.
- Mock reputation can appear more authoritative than actual coaching status.

### Preserve from recent iterations

- Large Overview / compact work-header distinction.
- Smooth reduced-motion-aware transition (`client-profile-page.tsx:61-108`).
- One circular avatar/initials treatment without “Изменить фото”.
- Title as prestige mark, not green status badge.
- Goal and club tenure only in identity hero.
- Three career KPIs and simplified three-level rank.
- Borderless rank integration with rank-dependent aura.
- Clickable rank dialog.

## Tab audit

| Tab/content | Current value | Issue | Recommendation |
|---|---|---|---|
| Overview | Rich athlete identity, portrait, achievements, activity, notes | Long and presentation-heavy; action context absent | Preserve sections; prioritize personal snapshot and recent coaching story. |
| Training | Current/upcoming/history and assign/review triggers | Best operational tab; drawers are local mock callbacks | Make source-linked default tab when reason is assignment/review. |
| Progress | Client-inspired charts and body-change cards | Stronger visual consistency after recent reuse | Preserve; ensure same metric definitions and source facts across roles. |
| Finance and access | Subscription/access/management information | Current prototype is broader than the accepted MVP need | Use the recommended label `Доступ и оплата`; limit to access status, optional expiration, access/payment issue, and future ability to manage or extend access. |
| Notes | Nested in Overview | Hard to find during a decision | Decide whether notes are a compact persistent panel/action, not necessarily a top tab. |
| Achievements/titles | Nested/gamified | Can dominate work context | Keep on Overview; validate positioning. |
| Progress photos | Overview/progress content | Sensitive and task-specific | Place under Progress with explicit access/privacy behavior. |
| Activity | Overview feed | Can duplicate dashboard activity | Present athlete-specific coaching timeline, not unread inbox. |

Four top-level tabs are enough for first MVP. Adding more tabs solely to reduce visual density would fragment the athlete journey. Notes, achievements, photos, and activity should be organized within the most relevant tab or a contextual side panel after usage research.

`Доступ и оплата` is a UX-recommended label, not a mandatory final route or component name. Revenue analytics, sales CRM, advanced payment history, and financial reports do not belong in the core athlete profile.

## Context-of-entry concept

```text
AttentionItem context envelope
├── item id and source session/event
├── reason and priority explanation
├── recommended primary action
├── originating queue/filter/order
└── return/next behavior

opens athlete profile
→ compact attention strip remains visible across tabs
→ relevant tab is selected without hiding identity
→ coach inspects context
→ assign/review/message/manual resolution
→ explicit completion receipt
→ next item or restored queue position
```

Neutral entry from Clients should omit the attention strip and show a general current-state summary instead. The same profile should support both entry modes without becoming a CRM record.

## Primary action rules

| Source reason | Default tab | Primary action | Secondary |
|---|---|---|---|
| Completed session | Training | Review workout | View Progress/history. |
| No next assignment | Training | Assign saved template | Open Templates if none suitable. |
| Athlete message/context signal | Overview or relevant context | Respond/acknowledge | Open history. |
| Neutral Clients entry | Overview | No forced destructive/work action | View training/progress. |

## Mobile behavior

The page technically avoids document overflow at 390x844. The UX issue is vertical priority: the large avatar/name/rank sequence delays tabs and action context. Preserve the premium identity signal, but ensure the reason and primary action remain visible in or immediately after the compact mobile identity area. On secondary tabs, the compact header is the correct foundation.

## Findings applied

- P0-02: no source context.
- P0-03: no durable resolution/next behavior.
- P0-07: review drawer diverges from full page.
- P1-04, P1-05: persistent action and mobile hierarchy.
- P2-03, P2-06, P2-07: repeated identity, local tabs, title/rank meaning.
- P3-01: gamification positioning requires validation.

## Preservation plan

| Treatment | Profile elements |
|---|---|
| Preserve visual language | Both headers, rank aura, title mark, dark/lime profile language. |
| Preserve after adaptation | Tabs, Training actions, Progress charts/cards, reputation dialog, athlete timeline. |
| Reframe | Finance/access, notes, activity, progress photos. |
| Add conceptually | Source reason, persistent action, queue return/next, neutral-entry state. |
| Do not delete | Achievements, titles, ranks, photos, existing tabs and mock UI. |

## Decision candidates for Product Lead review

### DC-PROFILE-01 - Header composition

- **Status:** direction accepted; final Header content remains proposed for a separate UX stage.
- **Decision:** Preserve identity and human context, show source reason and primary action for Attention entry, keep compact Header outside Overview, and allow a large Overview Hero only when it does not obscure state or action.
- **Alternatives:** Keep current header; make all tabs use compact header; put all work context below tabs.
- **Recommendation:** Accept context-aware two-level header.
- **Rationale:** Preserves the athlete profile feeling while supporting work.
- **Affected routes/components:** `ClientProfilePage`, `AthleteHeader`, `CompactClientHeader`.
- **Risk:** More header states require clear state rules.
- **Urgency:** Before profile redesign.

### DC-PROFILE-02 - Profile tabs

- **Status:** proposed tab composition; finance scope is accepted.
- **Proposed decision:** Keep four top-level tabs: Overview, Training, Progress, `Доступ и оплата`; organize notes, achievements, photos, and activity within those contexts.
- **Alternatives:** Add separate tabs for every content type; remove Finance; merge Overview/Progress.
- **Recommendation:** Keep four pending usability validation.
- **Rationale:** Current tabs are understandable and avoid a fragmented profile.
- **Affected routes/components:** `client-profile-page.tsx`, all profile tab components.
- **Risk:** Notes may remain less discoverable.
- **Urgency:** Before profile redesign.

### DC-PROFILE-03 - Gamification prominence

- **Status:** accepted.
- **Decision:** Preserve rank/title/achievements/reputation as secondary motivational and identity context, subordinate to state, source reason, action, and progress in trainer work views.
- **Alternatives:** Keep rank equally dominant everywhere; hide gamification from trainers; make it central positioning.
- **Recommendation:** Preserve with contextual prominence.
- **Rationale:** Assets are strong, but business value and trainer usage are unvalidated.
- **Affected routes/components:** Profile headers, reputation dialog, achievement/title sections.
- **Risk:** Reduced prominence may weaken perceived differentiation.
- **Urgency:** Before internal pilot.

### DC-PROFILE-04 - Finance visibility

- **Status:** accepted.
- **Decision:** Limit first-beta `Доступ и оплата` to access status, optional expiration date, access/payment issue, and future ability to manage or extend access.
- **Alternatives:** Hide tab; show full revenue analytics; keep current prototype.
- **Recommendation:** Exclude revenue analytics, sales CRM, advanced payment history, and financial reports from the core profile.
- **Rationale:** Trainer needs service continuity, not a broad CRM ledger.
- **Affected routes/components:** `management-tab.tsx`.
- **Risk:** Payment provider/source may not support all fields initially.
- **Urgency:** Before internal pilot.
