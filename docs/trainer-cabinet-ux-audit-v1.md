# Trainer Cabinet UX Audit v1

Date: 2026-07-16  
Scope: `/trainer/*` only  
Evidence baseline: commit `4806a7a362bc2b03dddc0b97bbded67d2fe44ffe`

This audit is documentation only. It evaluates the current interface as evidence and as a reusable product asset. A route excluded from MVP should be hidden, not deleted; a visually strong component should be adapted before replacement. No conclusion below changes code, navigation, data, or accepted product decisions.

## A. Executive summary

The trainer cabinet has a credible premium fitness OS visual language and several strong product fragments, but it is not yet one coherent operating workflow. The shell, athlete identity treatment, exercise library, exception-first workout review, and Living Team Map are valuable foundations. The weakest areas are the current Builder composition, the standalone Attention Center, and the duplicated implementations of assign/review state.

The main UX risk is not visual quality. It is the illusion of continuity: a coach can click through polished screens, but the source reason, resolution state, and next-client context are not consistently preserved. Three local queue models and two review surfaces currently simulate one lifecycle independently.

Recommended direction: keep the premium visual system, reduce primary navigation to the accepted MVP candidate, make dashboard the single decision queue, carry an AttentionItem context envelope into the athlete profile and action surface, converge Quick Assign and Review around the accepted domain chain, and redesign the Builder around a saved WorkoutTemplate rather than a multi-week Program.

### Finalized Stage 5 working decisions

- Primary trainer navigation is `Главная`, `Клиенты`, `Шаблоны`, `Библиотека`, `Настройки`.
- Automation, Insights, Reports, Sales, standalone Attention Center, and standalone Messages are hidden from primary MVP discovery but preserved in code and demo/development access.
- Communication is contextual through Athlete Profile, Workout Review, AttentionItem, and relevant athlete actions; standalone Messages remains experimental.
- Living Team Map remains a secondary operational overview. The ordered Attention queue is the primary sequential work surface.
- Team Activity answers “what is happening in the team”; Attention answers “what must I do.” They do not share action/status semantics.
- Titles, ranks, achievements, and reputation remain a secondary identity and motivation layer and do not block or outrank current state, attention reason, primary action, or progress.
- First-MVP finance scope is limited to access status, optional expiration, access/payment issue, and future ability to manage or extend access. Revenue analytics, sales CRM, advanced payment history, and financial reports are outside the core profile.
- Client and trainer surfaces use the same canonical entities and facts, with role-specific interfaces rather than literal UI copies.
- Current Builder requires full UX redesign; reusable primitives are preserved, simple WorkoutTemplate Builder is core MVP, and advanced Program Builder is future.

### Strongest current foundations

- `TrainerShell`: compact desktop rail, sticky context header, command surface, notification surface (`components/trainer/trainer-shell.tsx:55-58`, `components/trainer/trainer-shell.tsx:427-465`).
- `/trainer/dashboard`: distinctive team-state concept, premium hero asset, and client-centered interaction (`components/trainer-os/home/trainer-home-page.tsx`, `public/trainer/team-hq-hero.png`).
- Athlete identity header, compact secondary-tab header, rank assets, and profile tabs (`components/trainer-os/client-profile/client-profile-page.tsx:42-49`, `components/trainer-os/client-profile/client-profile-page.tsx:82-161`).
- Exception-first workout review and coach-feedback composition (`app/trainer/review/[workoutId]/workout-review-client.tsx:371-614`).
- Exercise library and exercise detail assets (`app/trainer/library/page.tsx`, `components/trainer/exercise-library-panel.tsx`, `public/exercises/`).

### Weakest current foundations

- Builder combines workout authoring, saved templates, client assignment, Program selection, Program day patching, local drafts, and storage fallback in one screen (`app/trainer/builder/page.tsx`).
- `/trainer/attention` is a dense standalone operational product with its own mock lifecycle (`app/trainer/attention/page.tsx:100-425`).
- Dashboard home, dashboard operating board, and Attention Center have separate types and mock data (`components/trainer-os/home/*`, `components/trainer-os/dashboard/*`, `app/trainer/attention/page.tsx`).
- Quick Assign offers static recommendations and closes local UI state, rather than selecting a saved template revision and creating an assignment snapshot (`components/trainer-os/quick-assign/quick-assign-drawer.tsx:25-73`).

## Canonical findings register

Counts in this register are the audit totals: **P0 7, P1 13, P2 10, P3 7**.

### P0 - blocks core UX

| ID | Finding | Evidence | Consequence |
|---|---|---|---|
| P0-01 | The product has multiple unrelated Attention/queue models. | `components/trainer-os/home/types.ts`, `components/trainer-os/dashboard/types.ts`, `app/trainer/attention/page.tsx:100-425` | A task resolved in one surface is not reliably the same task elsewhere. |
| P0-02 | Entry context is not carried into the athlete profile. | Dashboard links use client ids; profile initializes from `getAthleteProfile` and local tab state: `components/trainer-os/client-profile/client-profile-page.tsx:51-60`. | The coach loses why this athlete was opened and what decision is due. |
| P0-03 | Resolution and next-client behavior are local UI callbacks, not one flow contract. | `components/trainer-os/home/trainer-home-page.tsx:194-211`; review page local `reviewed` state at `app/trainer/review/[workoutId]/workout-review-client.tsx:371-383`. | The core loop can end without a durable confirmation or deterministic next item. |
| P0-04 | Quick Assign does not select a canonical saved WorkoutTemplate revision or expose an assignment snapshot. | Static `templates` and callback-only assignment in `components/trainer-os/quick-assign/quick-assign-drawer.tsx:25-73`. | The accepted assign flow cannot be validated end to end. |
| P0-05 | Builder information architecture conflicts with the accepted first-MVP domain. | Program/client/day/template state plus local assignment payload in `app/trainer/builder/page.tsx`; accepted chain in `docs/domain-model-v1.md:43-51`. | The required simple template workflow is buried inside an advanced Program-shaped surface. |
| P0-06 | The primary nav label `Шаблоны` opens the non-target Builder and provides no clear saved-template home. | `components/trainer/trainer-shell.tsx:55-58`; `app/trainer/builder/page.tsx`. | A core MVP destination has no accepted landing journey. |
| P0-07 | Drawer review and full-page review are parallel products with different data and completion behavior. | `components/trainer-os/workout-review/workout-review-drawer.tsx:89-166`; `app/trainer/review/[workoutId]/workout-review-client.tsx:371-614`. | Coaches can receive different review affordances depending on entry point. |

### P1 - materially harms efficiency or comprehension

| ID | Finding | Evidence |
|---|---|---|
| P1-01 | Dashboard hero, Living Team Map, action story, queue, and activity compete for first-action priority. | `components/trainer-os/home/trainer-home-page.tsx:230-263`; desktop visual audit. |
| P1-02 | Living Team Map semantics rely heavily on position, color, and motion without a proven accessible equivalent. | `components/trainer-os/home/living-team-map.tsx`, `components/trainer-os/home/client-status-legend.tsx`; desktop/mobile audit. |
| P1-03 | The same client signals appear in map, queue, activity, clients page, and Attention Center with different wording. | `components/trainer-os/home/mock-data.ts`, `app/trainer/clients/page.tsx`, `app/trainer/attention/page.tsx`. |
| P1-04 | Athlete header has no persistent reason-for-entry or next action. | `components/trainer-os/client-profile/client-profile-page.tsx:68-161`. |
| P1-05 | Mobile athlete Overview spends most of the first viewport on identity and rank before work context. | 390x844 visual audit of `/trainer/clients/artem-smirnov`. |
| P1-06 | Clients page combines directory, attention cards, filters, invitations, local client creation, messages, and actions. | `app/trainer/clients/page.tsx:578-741`, `app/trainer/clients/page.tsx:826-1310`. |
| P1-07 | Standalone Attention Center is dense, status-heavy, and visually closer to CRM than coaching workflow. | `app/trainer/attention/page.tsx:361-706`; desktop visual audit. |
| P1-08 | Full review sends adjustment to `#program`, preserving a Program assumption outside first vertical MVP. | `app/trainer/review/[workoutId]/workout-review-client.tsx:452-454`, `:612-614`. |
| P1-09 | Command palette exposes experimental routes as equal first-class sections and actions. | `components/trainer/trainer-shell.tsx:82-176`. |
| P1-10 | Mobile shell uses a horizontally scrolling row whose later destinations are initially out of view. | `components/trainer/trainer-shell.tsx:520-580`; 390x844 visual audit. |
| P1-11 | New trainer, all-calm, failure, and genuinely empty states are not consistently modeled across core screens. | Inline seeded arrays and demo fallbacks across dashboard, attention, profile, and builder. |
| P1-12 | Queue behavior for 20-30 clients and multiple simultaneous signals has no visible grouping or batching contract. | Dashboard and Attention implementations; target ICP in `docs/product-strategy-v1.md:8-24`. |
| P1-13 | Status and action vocabulary drifts between `waiting_review`, `needs-review`, open/in-progress/snoozed/done, and user labels. | Home/dashboard types, Attention route types, review page types. |

### P2 - consistency and polish

| ID | Finding | Evidence |
|---|---|---|
| P2-01 | Russian and English headings coexist in primary flows (`Workout Review`, `Plan vs Actual`, `Exercise review`, `Dismiss`). | Review page and Attention Center. |
| P2-02 | Large rounded-card language is applied even to dense operational blocks, reducing hierarchy. | Dashboard, Attention, Clients, Builder visual audit. |
| P2-03 | Shell page header and page-local hero often repeat title/context. | `TrainerShell` plus local page headings on Attention, profile, review. |
| P2-04 | Risk/success colors are not governed by one documented semantic palette. | Home legend, review badges, attention tones, client statuses. |
| P2-05 | Loading and empty treatments vary from skeletons to seeded fallback content or no state. | Library skeleton, Supabase/local fallbacks, inline mocks. |
| P2-06 | Profile tabs live only in component state and cannot preserve/deep-link task context. | `components/trainer-os/client-profile/client-profile-page.tsx:58-60`, `:119-160`. |
| P2-07 | Title and rank are visually strong but their distinct meanings are not explained by interaction. | Profile header and reputation dialog in `client-profile-page.tsx`. |
| P2-08 | Drawer close/cancel does not communicate whether draft input is retained. | Quick Assign and Workout Review drawers. |
| P2-09 | Library category/filter rail is dense and partly clipped on narrower desktop widths. | `/trainer/library` desktop visual audit. |
| P2-10 | Shared client/trainer visual language is uneven outside recently aligned progress/profile components. | Profile tabs versus Clients, Attention, Programs, Reports. |

### P3 - future enhancement

| ID | Finding | Evidence |
|---|---|---|
| P3-01 | Gamification expansion (rank system, achievements, titles) needs positioning validation, not immediate removal. | Profile reputation dialog and assets under `public/`. |
| P3-02 | Calendar is a preserved future/supporting concept, not a core first-loop dependency. | `app/trainer/calendar/page.tsx:308-650`. |
| P3-03 | Standalone Messages can be valuable later, but current core actions can remain contextual. | `app/trainer/messages/page.tsx:421-1154`. |
| P3-04 | Reports are an experimental local-state product outside the first vertical slice. | `app/trainer/reports/page.tsx:186-328`. |
| P3-05 | Automation and Insights are separate local-state products and should not shape first-MVP IA. | `app/trainer/automation/page.tsx`, `app/trainer/insights/page.tsx`. |
| P3-06 | Sales/storefront is a separate commercial product surface outside the coaching loop. | `app/trainer/sales/page.tsx:78-207`. |
| P3-07 | Team Map personalization and richer animation should follow comprehension/accessibility validation. | `team-hq-hero.tsx`, `living-team-map.tsx`. |

## B. Product coherence

| Question | Current answer | Assessment |
|---|---|---|
| Is this one system? | Visually mostly yes; behaviorally no. | Shared shell and palette create cohesion, but each section owns local mock state. |
| Where does the coach start? | Dashboard suggests a start, but hero, map, next decision, queue, and activity all compete. | Direction exists; priority needs tightening. |
| What happens after an action? | Some drawers expose “and next”; full review returns to dashboard; profile actions simply close drawers. | No single completion/next contract. |
| Is athlete context preserved? | Identity persists, source reason does not. | Core context envelope is missing. |
| Which sections feel separate? | Attention, Programs, Calendar, Messages, Reports, Automation, Insights, Sales. | Preserve code and visual evidence; hide experimental routes from primary discovery. |

## C. Navigation audit

| Destination | Job to be done | Frequency | Workflow link | Product status | UX readiness | Recommendation |
|---|---|---:|---|---|---|---|
| `/trainer/dashboard` | See team state and take next action | Daily/high | Direct | core MVP | requires significant iteration | Keep primary; establish one queue and next-item loop. |
| `/trainer/clients` | Find an athlete and open context | Daily/high | Direct/supporting | core MVP | requires significant iteration | Keep primary; simplify directory role and remove duplicated queue emphasis. |
| `/trainer/builder` labelled `Шаблоны` | Create/reuse workout template | Weekly/high | Direct | core MVP | requires full redesign | Keep nav concept; redesign destination around template library + editor. |
| `/trainer/library` | Find and inspect exercises | Weekly/high | Supporting | core MVP | accepted foundation | Keep primary; reuse in Builder. |
| `/trainer/settings` | Manage trainer/account preferences | Low | Supporting | supporting MVP | requires significant iteration | Keep primary but scope first-beta settings. |
| `/trainer/attention` | Process all attention items | Daily/high | Duplicate of dashboard | duplicate/unclear | requires full redesign | Do not expose as primary; decide whether it becomes a scalable queue view. |
| `/trainer/review/[workoutId]` | Review one completed session | Daily/high | Direct contextual | core MVP | requires significant iteration | Contextual route; converge with drawer and add next-item contract. |
| `/trainer/programs` | Build/manage multi-week programs | Periodic | Outside first slice | future | visual/technical prototype only | Hide from MVP discovery; preserve. |
| `/trainer/calendar` | View weekly events | Daily/unclear | Indirect | future/unclear | visual prototype only | Hide pending trainer research; preserve. |
| `/trainer/messages` | Manage conversations | Daily/unclear | Contextual | experimental | requires significant iteration | Hide standalone route from primary MVP discovery; keep communication in contextual actions. |
| Reports/Automation/Insights/Sales | Separate analytics, automation, reporting, commerce jobs | Variable | Indirect | experimental | visual/technical prototype only | Hide from primary discovery; preserve code and assets. |

## D. Screen-by-screen audit

| Route | Purpose / user question | Entry -> exit | Data | Strengths | Gaps / duplication | Product status | UX readiness | Recommendation |
|---|---|---|---|---|---|---|---|---|
| `/trainer/dashboard` | “Who needs me now?” | Shell/login -> profile, assign, review | Home mocks | Premium identity, team concept, actionable cards | Competing semantic zones; local queue; incomplete next state | core MVP | requires significant iteration | Preserve composition language; refocus around one next decision. |
| `/trainer/attention` | “What is in my work queue?” | Command palette -> linked action | Inline mock | Explicit lifecycle controls and filters | CRM density; duplicate queue; incompatible statuses | duplicate/unclear | requires full redesign | Hide from primary discovery; decide scalable queue role. |
| `/trainer/clients` | “Find/open an athlete” | Primary nav -> profile/actions | mixed Supabase/demo/local | Useful roster and search | Too many jobs; duplicated attention; local client/message drafts | core MVP | requires significant iteration | Make a quiet directory with status summary and clear profile entry. |
| `/trainer/clients/[clientId]` | “Who is this person and what should I do?” | Dashboard/clients -> assign/review/back | profile mock | Strong identity, tabs, reputation assets, aligned progress | No source reason; oversized mobile overview; local action drawers | core MVP | requires significant iteration | Preserve header system; add compact work context and return contract. |
| `/trainer/review/[workoutId]` | “What differed and what feedback is needed?” | Queue/profile -> feedback/queue/profile | inline mock | Excellent exception-first review and actual-set detail | Parallel drawer; local completion; Program CTA; no deterministic next | core MVP | requires significant iteration | Use as complex-review foundation; converge data/actions. |
| `/trainer/builder` | “Create a reusable workout” | Nav/profile/clients -> save/assign | mixed Supabase/demo/localStorage | Rich exercise components and library integration | Domain and IA mismatch; too much setup; mobile failure | core MVP | requires full redesign | Rebuild flow, reuse editor primitives. |
| `/trainer/programs` | “Manage multi-week programs” | Command palette/builder -> builder/client | mixed Supabase/demo/localStorage | Substantial visual prototype | Future domain overlaps templates and assignments | future | technical/visual prototype only | Hide; preserve for later Program research. |
| `/trainer/calendar` | “What happens this week?” | Command palette -> linked events | inline mock/local state | Strong weekly command-center concept | Separate queue/risk model; uncertain job frequency | future/unclear | visual prototype only | Preserve and validate before inclusion. |
| `/trainer/library` | “Find exercise and technique” | Primary nav/builder -> detail/add | demo/library adapter | Dense polished asset-backed experience | Filter density and narrow-width scanning | core MVP | accepted foundation | Preserve; adapt selection mode for Builder. |
| `/trainer/messages` | “Respond to athlete” | Command/profile -> profile/builder | mixed Supabase/local/demo | Useful thread/composer prototype | Separate inbox product; sync ambiguity | experimental | requires significant iteration | Hide standalone route; preserve UI and use contextual communication in first MVP. |
| `/trainer/reports` | “Prepare weekly client report” | Command -> messages/profile | localStorage/inline | Coherent report concept | Outside core loop; separate status system | experimental | visual prototype only | Hide; preserve. |
| `/trainer/automation` | “Manage follow-up rules” | Command -> clients/messages/calendar | localStorage/inline | Rich operational concept | Separate product and queue; unsupported first beta | experimental | technical/visual prototype only | Hide; preserve. |
| `/trainer/insights` | “Find risks and growth” | Command -> automation/messages/builder | inline local state | Shows useful signal ideas | Duplicates Attention and dashboard; revenue CRM framing | experimental | visual prototype only | Hide; mine signal ideas later. |
| `/trainer/sales` | “Manage products and revenue” | Command/settings -> explore | demo + local state | Substantial commerce prototype | Separate product, not coaching loop | experimental | visual prototype only | Hide; preserve. |
| `/trainer/settings` | “Configure my workspace” | Primary nav -> sales/public profile | mixed Supabase/local/demo | Broad and structured settings UI | Includes storefront, security, operations without accepted backend | supporting MVP | requires significant iteration | Keep; limit visible first-beta settings later. |

## E. Cross-screen consistency

- **Typography:** premium base is consistent; mixed English/Russian operational labels reduce product voice consistency (P2-01).
- **Spacing/cards:** profile and library use cards well; Attention and Builder overuse large rounded containers in dense tools (P2-02).
- **Headers:** shell context should remain short; local hero owns identity or task. Current duplication should be reduced (P2-03).
- **Tabs:** profile tabs are clear, but need URL/task-state continuity (P2-06).
- **Drawers:** the wide side-sheet language is useful for bounded actions; it needs explicit draft/cancel behavior and one action contract.
- **Statuses/colors:** establish one Attention lifecycle and semantic palette before polish (P1-13, P2-04).
- **States:** every core screen needs loading, true empty, all-calm, partial failure, and demo labels that do not masquerade as persisted state (P1-11, P2-05).
- **Shared client language:** recently aligned profile progress is a good direction; operational pages should use the same athlete identity, metric definitions, and timeline vocabulary.

## F. Core workflow coverage

| Stage | Current evidence | Missing / duplicated |
|---|---|---|
| Team state | Hero, summary, Living Team Map | Competes with task priority. |
| Attention signal | Map, queue, activity, Clients cards, Attention Center | Multiple sources and lifecycle models. |
| Context | Profile identity, Quick Assign client column, review summary | Source AttentionItem and return path are not preserved. |
| Decision | Action story, queue CTA, review risk banner | Similar decisions expressed differently. |
| Action | Assign drawer, review drawer, review page, profile tabs | Drawer/page contracts diverge. |
| Confirmation | Toasts and local state | No shared assignment/review receipt. |
| Resolution | Local removal or `reviewed` boolean | No one durable AttentionItem resolution contract. |
| Next client | Some “and next” buttons | No deterministic next-item selection or empty-queue state. |

## G. Preservation plan

| Treatment | Assets/screens |
|---|---|
| Preserve as-is | Exercise image corpus; rank/title/achievement assets; route code not selected for MVP. |
| Preserve visual language | Trainer shell, premium dark/lime palette, athlete identity hero, exception-first review, Living Team Map, library. |
| Preserve after adaptation | Action cards, map nodes/legend, Quick Assign client context, review feedback editor, exercise cards, detail sheet. |
| Preserve concept only | Separate Attention Center, Programs, Calendar command center, Insights signal cards. |
| Redesign screen | Builder; standalone Attention if retained; Clients information hierarchy. |
| Hide temporarily | Standalone Attention, standalone Messages, Reports, Automation, Insights, Sales; Programs remains future and Calendar remains outside the accepted five-section navigation pending research. |
| Legacy | `/dashboard/*`; do not use it to define target trainer UX. |
| Remove only after later approval | Nothing in Stage 5. |

## H. Recommended sequence

Existing Stage 2-4 workflow and domain contracts are inputs to every UX step and do not form a separate new Stage 5 implementation phase.

1. **Trainer shell and navigation:** align sidebar, mobile navigation, and command palette with accepted MVP scope.
2. **Trainer dashboard:** select one operational queue hierarchy; preserve map as secondary team-state overview and Team Activity as non-task context.
3. **Athlete profile:** add source reason, persistent action, and return-to-queue behavior; improve mobile hierarchy.
4. **Workout review:** converge page and drawer presentation around the already accepted shared review contract.
5. **Quick Assign:** select saved template revision, show assignment snapshot adjustments, confirm and advance.
6. **WorkoutTemplate Builder:** full UX redesign using preserved exercise primitives.
7. **Cross-screen integration:** validate all-calm/new-trainer/high-volume/failure states and consistent semantics.
8. **Internal trainer pilot:** test the complete workflow with representative coaches.

## Decision candidates for Product Lead review

### DC-AUD-01 - MVP navigation

- **Status:** accepted.
- **Decision:** Primary navigation is `Главная`, `Клиенты`, `Шаблоны`, `Библиотека`, `Настройки`; experimental destinations are removed from global discovery but preserved in code.
- **Alternatives:** Keep all command-palette routes; add standalone Attention; include Messages or Calendar.
- **Recommendation:** Accept the five-item navigation for the first internal pilot.
- **Rationale:** It matches accepted strategy and reduces unrelated product surfaces.
- **Affected routes/components:** `components/trainer/trainer-shell.tsx`, all `/trainer/*` routes.
- **Risk:** Hidden prototypes may receive less incidental testing.
- **Urgency:** Before dashboard redesign.

### DC-AUD-02 - One attention workflow

- **Status:** accepted for first MVP; later dedicated queue need remains proposed.
- **Decision:** Dashboard owns the default sequential queue; `/trainer/attention` is hidden from primary navigation until a high-volume queue need is validated.
- **Alternatives:** Make Attention the canonical home; keep both equal; merge it into Clients.
- **Recommendation:** Dashboard default, optional later “all tasks” route.
- **Rationale:** The accepted home is `/trainer/dashboard`; the current Attention screen duplicates it and feels CRM-heavy.
- **Affected routes/components:** `/trainer/dashboard`, `/trainer/attention`, home/dashboard mock types.
- **Risk:** Coaches with many simultaneous items may need a denser view sooner.
- **Urgency:** Before dashboard redesign.

### DC-AUD-03 - Redesign order

- **Status:** accepted.
- **Decision:** Shell/navigation -> dashboard -> profile -> review -> Quick Assign -> WorkoutTemplate Builder -> integration -> internal trainer pilot.
- **Alternatives:** Builder first; profile first; visual polish across all screens.
- **Recommendation:** Follow the accepted order; existing workflow contracts remain inputs rather than a separate preliminary UX stage.
- **Rationale:** It stabilizes the daily loop before the highest-cost authoring surface.
- **Affected routes/components:** Core trainer routes and action drawers.
- **Risk:** Template authoring remains prototype longer.
- **Urgency:** Before any Stage 6 implementation.
