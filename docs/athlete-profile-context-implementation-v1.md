# Athlete Profile Context Implementation v1

Date: 2026-07-16

Stage: 8 - Athlete Profile Context and Workflow Implementation v1

Canonical route: `/trainer/clients/[clientId]`

Implementation branch: `feat/athlete-profile-context-v1`

## 1. Scope

Stage 8 stabilizes the trainer-facing athlete profile as a contextual workspace over demo/read-model data.

Implemented flow:

```text
Dashboard / Map / Clients / direct URL
-> athlete selected by stable clientId
-> identity + optional entry context
-> context-aware Review / Assign / Message / Open Plan
-> local confirmation
-> return to queue or next demo client
```

The work is limited to the athlete profile route and components plus two minimal Dashboard query-marker changes. No backend, API, auth, schema, migration, Builder, Quick Assign internals, Workout Review internals, or Client Cabinet code was changed.

## 2. Before state

The route rendered `<ClientProfilePage />` without passing `params.clientId`. The client component called `useParams()`, but `getAthleteProfile()` returned the first array item whenever no exact match existed.

Only one profile object existed. Additional divergence came from presentation code:

- career metrics `512`, `+11.8 кг`, and `82 дня` were hardcoded in `client-profile-page.tsx`;
- `toTeamClient()` always generated `waiting_review`, high priority, and review action;
- all tabs consumed the same Artem-only arrays;
- no entry context or queue item identity was shown;
- the back link always returned to the Dashboard;
- the finance tab included payment history, tariff amounts, purchased products, and destructive access actions;
- profiles without progress or active assignments had no truthful empty-state contract.

Strong existing elements preserved included the large Overview Hero, compact non-Overview Header, rank dialog, title/rank language, Training layout, client-inspired Progress visual language, and drawer integrations.

## 3. Root cause of clientId defect

The defect had two direct causes:

1. `app/trainer/clients/[clientId]/page.tsx` ignored route params and rendered a prop-less client page.
2. `components/trainer-os/client-profile/mock-data.ts#getAthleteProfile()` used `?? athleteProfiles[0]`, silently substituting Artem for unknown IDs.

The fallback also concealed missing demo mappings: valid-looking URLs appeared successful while leaking another athlete's identity and facts.

Stage 8 now:

- resolves `params` and `searchParams` in the route;
- passes the stable `clientId` and safe entry markers into the profile;
- returns `undefined` for an unknown demo ID;
- renders a dedicated unknown-client state instead of another athlete;
- derives Hero, compact Header, tabs, actions, and drawers from the selected profile view.

## 4. Profile read model

`profile-read-model.ts` defines a provider-neutral UI read model:

- `TrainerAthleteProfileView`;
- `ProfileEntryContext`;
- `ProfileEntryInput`;
- `ProfilePrimaryActionKind`;
- `ProfileAttentionKind`;
- `ClientProfileTab`.

The view contains:

- one selected `AthleteProfile`;
- optional entry context;
- source surface;
- primary action;
- default tab;
- optional review session ID;
- latest meaningful athlete event.

The adapter does not use Supabase row shapes, does not perform remote reads/writes, and does not add localStorage. `toProfileTeamClient()` is the typed compatibility adapter for the existing Quick Assign and Review drawers.

Identity and career facts are no longer redefined in Header helpers. `AthleteProfile.career` now provides completed workouts, weight change, and streak days.

## 5. Demo client mapping

| Stable ID | State | Training facts | Progress | Access | Title/rank | Primary action |
|---|---|---|---|---|---|---|
| `artem-smirnov` | Completed workout awaiting review | Day of bench session and review queue | Full weight/strength/body mock | Active | Title + Athlete II | Review workout |
| `olga-sokolova` | Discomfort / needs adjustment | Active program and next adjusted session | Olga-specific weight and pull trend | Active | Title + Sportsman III | Message from direct/context entry |
| `egor-nikitin` | Needs next assignment | Completed introductory session; no next workout or active program | No progress facts | Active | No title + Contender I | Assign workout |
| `maria-volkova` | Calm / on track | Active strength-cut program and next workout | Maria-specific weight and leg-press trend | Active | Title + Athlete I | Open current plan |
| `ksenia-belyaeva` | Paused/inactive | No active program or next assignment | No progress facts | Limited/paused | No title + Sportsman I | Message client |
| `alexandra-konstantinova` | Calm, long-name QA | Active first-meet preparation | Profile-specific weight and squat trend | Active | No title + Contender III | Open current plan |

All identities are fictional demo data. Each generated profile overrides personalized workout, progress, timeline, access, notes, posts, and invite-link facts instead of inheriting Artem-specific copy.

## 6. Entry context

Supported source behavior:

| Entry | Context behavior |
|---|---|
| Dashboard Attention | Restores compact reason, event timing, signal, safe item ID, recommended action, and queue return. |
| Living Team Map | Shows neutral athlete status and `Назад к команде`; no artificial attention reason. |
| Clients list | Neutral status/current event and `К списку клиентов`. |
| Review marker | Supported as a source value for future return treatment. |
| Direct URL | Full profile without required query parameters or an empty attention frame. |

Safe query fields are `from`, `entry`, `attention`, and `attentionItem`. Full client comments, discomfort wording, and other sensitive text are reconstructed from the local adapter, not sent in the URL.

## 7. Return-to-queue behavior

Dashboard Attention entry renders `Вернуться к очереди` linking to:

`/trainer/dashboard#attention-heading`

After local Assign/Review confirmation, the receipt offers:

- `К следующему клиенту` when a demo next item exists;
- `К очереди`.

The next-client mapping follows the Stage 7 demo order:

```text
Olga -> Ksenia -> Egor -> Artem -> queue
```

Current queue state is local to the Dashboard and is not persisted. A full route return restores the Dashboard surface and anchor, not an authoritative production queue position.

## 8. Hero and compact Header

### Overview Hero

Preserved:

- single-circle initials avatar;
- human description;
- goal and club tenure;
- three athlete-specific career facts;
- title mark;
- large clickable rank/reputation presentation.

The contextual workflow bar now appears before the Hero, keeping reason and action visible before the richer identity content. The trainer has no photo-edit action.

### Compact Header

The non-Overview Header now contains only:

- initials and identity;
- optional title;
- goal;
- coaching status;
- compact rank action.

The career KPI row was removed from the compact state. Primary action and return path remain in the persistent workflow bar above it.

Hero/compact transition remains Framer Motion-based and respects `useReducedMotion()`.

The v1 composition is implemented for validation and is not declared final.

## 9. Primary action rules

| Context/facts | Primary action |
|---|---|
| Attention kind `review` | `Разобрать тренировку` |
| Attention kind `assignment` | `Назначить тренировку` |
| Discomfort or missed-workout context | `Написать клиенту` |
| Waiting-review session without origin marker | `Разобрать тренировку` |
| No upcoming assignment and active relation | `Назначить тренировку` |
| Paused relation | `Написать клиенту` |
| Open athlete issue | `Написать клиенту` |
| Calm active athlete | `Открыть текущий план` |

No score or recommendation engine was added.

## 10. Tabs

Exactly four top-level tabs are rendered:

1. `Обзор`;
2. `Тренировки`;
3. `Прогресс`;
4. `Доступ и оплата`.

Tabs retain `tablist`, `tab`, `tabpanel`, `aria-selected`, and `aria-controls` semantics. Arrow Left/Right and Home/End change the active tab and move keyboard focus.

Review/assignment entry selects Training initially. Calm, paused, discomfort, map, Clients, and neutral direct entries use Overview unless current facts require assignment/review.

## 11. Quick Assign integration

The existing `QuickAssignDrawer` is reused without internal changes.

- `toProfileTeamClient()` carries the selected profile ID, name, initials, goal, status, activity, and action state.
- Egor's drawer visibly shows Egor rather than Artem.
- Successful local callback closes the Sheet and displays an athlete-specific confirmation.
- Context entry exposes the next demo client when available.
- Focus returns to `#profile-primary-action` after Sheet close.

Quick Assign remains callback-only demo behavior and does not persist an assignment.

## 12. Review integration

The existing `WorkoutReviewDrawer` and full Review route are reused without internal redesign.

- Only Artem currently has a mapped demo review session: `artem-smirnov-2026-06-10`.
- Review is selected only for a waiting-review fact or review attention kind.
- Non-review clients no longer show the unconditional `Открыть разбор` action in the latest-comment panel.
- The drawer receives Artem's selected identity.
- Full Review carries safe `from=profile&clientId=artem-smirnov` markers.
- Local send callback shows confirmation and restores focus.

This prevents other demo clients from opening Artem-specific exercise exceptions through a misleading Review CTA.

## 13. Empty states

### Unknown client

- Displays `Спортсмен не найден`;
- shows the unknown stable ID;
- links to `/trainer/clients`;
- renders no other athlete data;
- produces no runtime error.

### No active assignment

- Training headline states that the next workout is not assigned;
- program chips are replaced by `Активного плана нет`;
- Overview identifies that no active program exists;
- Assign is the primary action.

### No progress

- Progress renders a calm dedicated empty state;
- no Recharts component or fake zero graph is mounted;
- copy names the selected athlete.

### No title

- Header remains balanced;
- title is secondary and may be absent;
- rank remains independently available.

### Paused relation

- Coaching/access status is explicit;
- Training and upload access are shown as limited;
- no destructive access controls are rendered.

## 14. Mobile behavior

Verified at `390x844`:

- contextual workflow bar precedes Hero;
- primary action appears within the first viewport for all tested states;
- long identity and goal copy wrap without document overflow;
- large Overview Hero remains inspectable and follows the action context;
- non-Overview Header is compact;
- tablist scrolls internally while the document remains width-stable;
- fixed Stage 6 bottom navigation remains present;
- page bottom padding preserves access to final content;
- rank modal fits the viewport;
- Quick Assign and Review Sheets open without document overflow.

Existing shared Sheets still resolve to approximately 75% of the mobile viewport width. Their internals were not changed.

## 15. Accessibility

Implemented or preserved:

- one page-level `h1` from TrainerShell;
- profile identity demoted to `h2`, avoiding duplicate page headings;
- semantic workflow, Hero, tabs, panels, links, buttons, Dialogs, and Sheets;
- non-color status icons and labels;
- persistent accessible queue-return link;
- keyboard tabs with focus movement;
- focus-visible controls inherited from existing components;
- explicit rank-button labels;
- selected profile initials as visible avatar fallback;
- reduced-motion Header transitions;
- focus restoration after Quick Assign, Review, and rank modal close.

Full screen-reader testing with VoiceOver remains recommended before beta.

## 16. Component preservation matrix

| Component/file | Stage 8 treatment | Notes |
|---|---|---|
| `client-profile-page.tsx` | adapted | Route-driven read model, workflow state, tabs, headers, confirmations, unknown state. |
| `mock-data.ts` | adapted | Six stable profiles; no fallback to first athlete. |
| `types.ts` | adapted | Adds provider-neutral career facts. |
| `profile-read-model.ts` | new | Entry context, actions, Review mapping, drawer adapter. |
| `profile-workflow-bar.tsx` | new | Persistent context/action/return/receipt layer. |
| `overview-tab.tsx` | lightly adapted | Truthful paused/no-program labels. Visual composition preserved. |
| `training-tab.tsx` | adapted | No-program state; Review hidden without matching session. |
| `progress-tab.tsx` | adapted | Truthful no-progress state; chart language preserved for real demo facts. |
| `management-tab.tsx` | reduced to accepted scope | Access, expiry, issue, feature access, extend/copy actions. Revenue/history/destructive UI removed from render. |
| `reputation-ranks.ts` | preserved as-is | Existing rank definition remains source for rank modal. |
| `achievement-catalog-dialog.tsx` | preserved as-is | Existing Overview achievement experience. |
| `achievement-catalog.ts` | preserved as-is | No new gamification mechanics. |
| `client-profile-ui.tsx` | preserved as-is | Shared profile presentation helpers. |
| `QuickAssignDrawer` | reused as-is | Correct selected compatibility object supplied. |
| `WorkoutReviewDrawer` | reused as-is | Exposed only for mapped review client/session. |
| `attention-workspace.tsx` | marker-only adaptation | Adds safe `attentionItem` to profile URL. Dashboard hierarchy unchanged. |
| `living-team-map.tsx` | marker-only adaptation | Adds `from=dashboard&entry=map`. Map visual/behavior unchanged. |

No profile component file or route was deleted.

## 17. Files changed

- `app/trainer/clients/[clientId]/page.tsx`;
- `components/trainer-os/client-profile/client-profile-page.tsx`;
- `components/trainer-os/client-profile/profile-read-model.ts`;
- `components/trainer-os/client-profile/profile-workflow-bar.tsx`;
- `components/trainer-os/client-profile/mock-data.ts`;
- `components/trainer-os/client-profile/types.ts`;
- `components/trainer-os/client-profile/overview-tab.tsx`;
- `components/trainer-os/client-profile/training-tab.tsx`;
- `components/trainer-os/client-profile/progress-tab.tsx`;
- `components/trainer-os/client-profile/management-tab.tsx`;
- `components/trainer-os/home/attention-workspace.tsx`;
- `components/trainer-os/home/living-team-map.tsx`;
- `docs/athlete-profile-context-implementation-v1.md`.

`docs/decision-log.md` is unchanged because Stage 8 implements already accepted direction and does not promote the v1 Header composition to a final decision.

## 18. Visual QA

Browser automation used local Chrome through Playwright against `http://localhost:3000`.

| State | Viewport | Result |
|---|---:|---|
| Artem review profile | Desktop/mobile | Correct identity, Training default, Review action/session. |
| Olga discomfort profile | Desktop/mobile | Correct identity/facts and message action. |
| Egor assignment profile | Desktop/mobile | Correct identity, no active plan, Assign action, no progress charts. |
| Maria calm profile | Desktop/mobile | Correct identity, Overview default, plan/progress/access data. |
| Ksenia paused profile | Desktop/mobile | Correct identity, no title/progress, limited access, no destructive controls. |
| Alexandra long identity | Mobile | Name/goal wrap; no document overflow; primary action remains visible. |
| Unknown client | Desktop/mobile | Safe empty state; no leaked athlete. |
| Dashboard Attention -> Olga | Desktop | URL, identity, reason, item marker, queue return correct. |
| Living Team Map -> Maria | Desktop | Neutral context and Dashboard return correct. |
| Clients -> Artem | Desktop | Neutral origin; no attention strip; Clients return correct. |
| Direct URLs | Desktop/mobile | Work without query parameters. |
| Four tabs | Desktop | Correct selected tab and content; no document overflow. |
| Keyboard tabs | Desktop | Arrow Right moved focus and selected Training. |
| Quick Assign | Desktop/mobile | Correct Egor identity, local receipt, next-client link. |
| Review drawer | Desktop/mobile | Correct Artem identity. |
| Full Review route | Desktop | Correct Artem session route. |
| Rank modal | Desktop/mobile | Opens, fits viewport, focus returns to trigger. |
| Drawer focus restoration | Desktop | Focus returns to profile primary action. |
| No-progress state | Desktop | Zero Recharts wrappers mounted. |
| Access/payment | Desktop | Paused issue shown; destructive actions absent. |
| Horizontal overflow | All tested pages | None detected. |

Fresh direct Profile loads produced no console or hydration errors. During repeated HMR/sequential route automation, the pre-existing TrainerShell hidden Radix CommandDialog ID mismatch appeared intermittently; see Known limitations.

## 19. Known limitations

1. Profile resolution remains mock-only and supports six stable IDs, not all clients shown in every legacy/demo list.
2. Client Cabinet was intentionally not changed. Trainer Profile facts now use one internal read model, but a physically shared trainer/client adapter remains deferred.
3. Quick Assign and Review confirmations do not persist or mutate the selected profile after reload.
4. Return-to-queue uses a safe route/anchor but cannot restore authoritative queue state because Stage 7 resolution/order is local React state.
5. Message links include `clientId`, but the existing Messages page may not yet consume it as selected-thread state.
6. Shared mobile Sheets remain approximately 75% viewport width.
7. Only Artem has a complete mapped full Review demo session. Review CTA is hidden for other profiles to prevent wrong-session leakage.
8. Recharts logs existing zero-size container warnings when Progress mounts/transitions and twice during production static generation.
9. Repeated dev HMR/sequential route automation can produce a Radix ID hydration warning inside `TrainerShell`'s hidden CommandDialog. Fresh direct Profile loads did not reproduce it; Shell is outside Stage 8 scope.
10. Rank images can produce development LCP suggestions during HMR; profile rank images were marked priority in Stage 8.
11. Some reused Overview sections remain long on mobile; action context is now above them, but the overall Overview depth remains a future usability question.

## 20. Deferred decisions

- Production profile query and authorization through TrainerAthleteRelation.
- Shared client/trainer workout and progress adapter over canonical source facts.
- Durable origin envelope and queue restoration.
- Production next-client resolution under concurrent queue changes.
- Message route client selection.
- Mobile Sheet width and footer behavior.
- Final Header composition after trainer usability testing.
- Whether rank/title prominence should reduce further on mobile.
- Progress chart mount strategy that removes zero-size Recharts warnings.
- Scope and consent model for progress photos.

## 21. Acceptance criteria results

| Criterion | Result |
|---|---|
| `clientId` selects athlete | Pass. |
| Different URLs show different coherent profiles | Pass for six demo IDs. |
| Unknown ID never shows another athlete | Pass. |
| Dashboard origin context displayed | Pass. |
| Clear queue return | Pass; durable queue position remains deferred. |
| Direct profile works without origin | Pass. |
| Primary action follows context/facts | Pass. |
| Quick Assign receives correct athlete | Pass. |
| Review receives correct athlete/session | Pass for mapped Artem session; hidden elsewhere. |
| Hero and compact Header have distinct roles | Pass. |
| Gamification remains secondary | Pass; workflow bar precedes Hero. |
| Four accepted tabs only | Pass. |
| Finance limited to access/payment | Pass. |
| Empty states do not fake data | Pass. |
| Mobile document overflow | Pass. |
| Premium visual language preserved | Pass by visual inspection. |
| Dashboard hierarchy, Builder, Client Cabinet, backend unchanged | Pass; two Dashboard links only gained context markers. |
| Lint | Pass. |
| Build | Pass with pre-existing Recharts warnings. |
