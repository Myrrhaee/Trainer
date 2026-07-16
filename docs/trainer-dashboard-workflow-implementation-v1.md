# Trainer Dashboard Workflow Implementation v1

Date: 2026-07-16

Stage: 7 - Trainer Dashboard Workflow Implementation v1

Canonical route: `/trainer/dashboard`

Implementation branch: `feat/trainer-dashboard-workflow-v1`

## 1. Scope

This stage changes only the canonical trainer Dashboard composition, its local mock/read model, and directly related home components. It implements the accepted daily flow:

```text
Team state
-> Attention queue
-> Client context
-> Review / Assign / Profile
-> Local demo resolution
-> Next client
```

No backend, API, auth, migration, Supabase, PostgreSQL, Athlete Profile, Builder, Quick Assign internals, or Workout Review internals were changed.

Evidence:

- Route composition: `app/trainer/dashboard/page.tsx`.
- Workflow state and drawer reuse: `components/trainer-os/home/trainer-home-page.tsx`.
- Read model: `components/trainer-os/home/dashboard-read-model.ts`.
- Primary work surface: `components/trainer-os/home/attention-workspace.tsx`.

## 2. Before state

The route rendered `TrainerHomePage`, not `DashboardOperatingBoard`. The visible composition was:

```text
large Team HQ hero
-> Living Team Map + Action Stories
-> Team Activity + Secondary Attention
```

This created multiple task-like interpretations:

- `ActionStoriesCarousel` / `ActionStoryCard` represented the next decision;
- `SecondaryAttentionPanel` represented another attention list;
- `components/trainer-os/dashboard/*` contained a separate operating queue and separate mock/type model, although it was not rendered by the canonical route;
- `ActionQueue` / `ActionQueueItem` remained another unused queue treatment in `home/*`.

The previous local completion handler changed a client directly, but queue identity, receipt, selected map node, and deterministic next-item behavior were not expressed as one cohesive workspace.

## 3. Target hierarchy

The implemented hierarchy is:

1. Compact team status header.
2. Primary Attention workspace.
3. Living Team Map as a secondary operational overview beside/after Attention.
4. Team Activity below the working area.

Desktop uses a priority-weighted two-column work area. Mobile preserves the same order and puts the map after Attention.

## 4. Implemented layout

### Compact status

`DashboardStatusHeader` reports only:

- active clients;
- clients in a calm rhythm;
- clients requiring attention;
- workouts waiting for review.

The headline answers whether the team is calm and provides one route into the current decision. It does not recreate the removed BI-like hero or expose program analytics.

### Main work area

`TrainerHomePage` renders `AttentionWorkspace` before `LivingTeamMap` in DOM and visual order. On wide screens the approximate ratio is `7fr / 5fr`; on mobile the blocks stack without changing workflow priority.

### Secondary layer

`TeamActivityFeed` is full width below the work area. Its CTA is visually secondary and its rows open the existing event journal instead of acting as unresolved tasks.

## 5. Attention queue behavior

`buildTrainerAttentionQueue()` adapts the existing `TeamClient[]` mock into `TrainerAttentionQueueItem[]`. The first mock version supports:

- discomfort/pain signal;
- completed workout waiting for review;
- missing next assignment;
- missed/not-started workout as an explicitly labeled visual prototype.

Ordering is:

1. discomfort first;
2. all remaining items from older to newer.

The workspace provides:

- one visually dominant current item;
- ordered compact queue;
- current/total counter;
- previous and next controls;
- primary action based on the item kind;
- profile/context action;
- explicit local resolution;
- automatic selection of the next unresolved item;
- an `aria-live` resolution receipt;
- an all-calm state after the final resolution.

Opening an item does not resolve it. Review/Assign resolution happens only through their accepted callback, while the explicit `Отметить решённым` control supports the local demo outcome for non-drawer cases.

## 6. Living Team Map role

The existing map remains a prominent premium fitness OS asset, but it no longer precedes or replaces the queue.

It continues to show the current working zone concept:

- On Track;
- no next workout / Needs Decision;
- waiting review;
- adjustment / Watch;
- inactive / Pause.

These zone semantics remain an unvalidated working concept. This stage does not promote them to an accepted domain taxonomy.

The map now has:

- responsive height for mobile;
- accessible section heading;
- selected-client summary below the visual field;
- explicit profile action;
- queue-driven selected node;
- existing keyboard focus, node labels, double-click profile behavior, drag behavior, and reduced-motion CSS.

The queue and client list remain complete non-map paths to every actionable client.

## 7. Team Activity role

Team Activity answers what happened in the team. It keeps achievements, completed workouts, measurements, check-ins, assignments, and feedback events.

It is distinguished from Attention by:

- placement below the primary work area;
- neutral heading and border language;
- outline journal action instead of lime primary action;
- no resolution controls;
- no task counter or queue ordering;
- local read/hide behavior only inside the existing journal drawer.

Activity and Attention may reference the same athlete or source event, but they have different presentation semantics and do not share task actions.

## 8. Shared selection behavior

Selection is local to `TrainerHomePage`; no global state manager was added.

- Selecting an Attention item selects the same client on the map.
- Hovering or keyboard-focusing a compact queue item previews the same map node.
- Previous/next navigation updates the selected node.
- Clicking a map node selects the client and, when one exists, its queue item.
- Selecting an Activity event highlights its client on the map.
- The selected map footer exposes the athlete name, state, goal, and profile action.

This is a presentation-state bridge only. It does not create a backend origin-context entity.

## 9. Quick actions

### Review

- `Разобрать` opens the existing `WorkoutReviewDrawer` unchanged.
- `Полный разбор` opens `/trainer/review/artem-smirnov-2026-06-10` with safe `from` and `attention` query markers.
- Successful drawer callback resolves the corresponding local item and advances the queue.

### Assignment

- `Назначить` opens the existing `QuickAssignDrawer` unchanged.
- Successful callback resolves the corresponding local item and advances the queue.
- Existing `Назначить и следующий` behavior is preserved for another assignment item when available.

### Profile

- Profile links use `/trainer/clients/[clientId]`.
- Links include non-sensitive `from=dashboard` and attention-kind markers.
- No new routing or persistence mechanism was introduced.

### Message

No standalone Messages entry or new message flow was added.

## 10. Empty states

### All calm

The status header confirms that the team is calm. Attention shows `Все спокойны`, while the map, Team Activity, client list, and training assignment entry remain available.

### New trainer

The empty-team state:

- renders no fake map nodes;
- renders no fake Attention items;
- makes adding the first client the primary action;
- summarizes the basic add -> assign -> review cycle;
- retains an explicit demo-team control for local product inspection;
- does not advertise experimental trainer routes.

Demo states are available through local query markers:

- `/trainer/dashboard?demo=calm`;
- `/trainer/dashboard?demo=empty`;
- `/trainer/dashboard?demo=large`.

## 11. Large-team behavior

The normal mock has approximately 20 clients. The large visual-QA read model expands it to exactly 30 clients and seven Attention items.

Verified behavior:

- map node sizing responds to team size;
- unknown demo IDs use existing fallback placement behavior;
- queue list has a bounded vertical viewport;
- current item and queue remain independently readable;
- long names truncate inside compact rows;
- selected and focus states remain stable;
- no horizontal overflow occurs at desktop or `390x844`.

Current visual model limitations:

- no production clustering algorithm;
- generated fallback placements can become visually dense;
- one read-model item groups several related signals for one athlete instead of creating duplicate cards;
- semantic meaning of exact node position remains unvalidated.

## 12. Mobile behavior

At `390x844`, DOM and visual priority is:

1. team status;
2. Attention workspace and actions;
3. compact ordered queue;
4. responsive Living Team Map;
5. Team Activity.

Implementation details:

- page has bottom padding for Stage 6 bottom navigation;
- controls use at least 40-44 px targets in the new UI;
- queue selection is available by tap and keyboard, not hover only;
- map height reduces from desktop without hiding it;
- no horizontal overflow was detected in normal, calm, empty, or 30-client states;
- existing Review, Quick Assign, and Activity sheets open and stay within viewport width.

## 13. Accessibility

Implemented or preserved:

- semantic `main`, `section`, `article`, headings, ordered list, links, and buttons;
- `aria-labelledby` for status, Attention, map, and Activity sections;
- `aria-current` for the active queue item;
- `aria-live` for resolution and selected map context;
- explicit previous/next and map-node accessible labels;
- `focus-visible` rings on new queue, navigation, activity, and map-footer controls;
- selected state not expressed by color alone;
- stable athlete list and queue path independent of the map;
- `motion-safe` transitions for queue changes;
- existing map `prefers-reduced-motion` rules remain intact.

## 14. Mock/read-model architecture

The rendered Dashboard now reads only the existing `components/trainer-os/home/mock-data.ts` source and adapts it through `dashboard-read-model.ts`.

Read-model types:

- `TrainerDashboardSummary`;
- `TrainerAttentionQueueItem`;
- `TrainerAttentionKind`;
- `TrainerDashboardDemoMode`.

The adapter:

- references `TeamClient` rather than copying an incompatible client entity;
- does not expose Supabase row shapes;
- performs no API call or remote write;
- does not use `localStorage`;
- keeps resolution in React state for the current browser session;
- does not import the conflicting `components/trainer-os/dashboard/mock-data.ts`.

## 15. Component preservation matrix

| Component/zone | Stage 7 status | Notes / later treatment |
|---|---|---|
| `TrainerHomePage` | adapted and used | Canonical Dashboard composition and local workflow state. |
| `DashboardStatusHeader` | new and used | Replaces the rendered large Team HQ hero for daily work. |
| `AttentionWorkspace` | new and used | Authoritative rendered queue. |
| `dashboard-read-model.ts` | new and used | Adapter over existing home mock data. |
| `LivingTeamMap` | adapted and used | Secondary operational overview and navigation. |
| `TeamNode` | used unchanged | Existing interaction, scale, and reduced-motion behavior retained. |
| `TeamActivityFeed` | adapted and used | Secondary non-task event layer. |
| `ActivityDrawer` | used unchanged | Local event details/read/hide behavior. |
| `EmptyTeamState` | adapted and used | New-trainer state and demo entry. |
| `QuickAssignDrawer` | reused unchanged | Existing callback-only demo flow. |
| `WorkoutReviewDrawer` | reused unchanged | Existing quick-review demo flow. |
| `TeamHqHero` | preserved, temporarily not rendered | Candidate for later team personalization, not daily workflow header. |
| `ActionStoriesCarousel` | preserved, not rendered; duplicate | Superseded by authoritative Attention workspace. Candidate cleanup after validation. |
| `ActionStoryCard` | preserved, not rendered; duplicate | Coupled to Action Stories. Candidate cleanup after validation. |
| `SecondaryAttentionPanel` | preserved, not rendered; duplicate | Would create a second task queue. Candidate cleanup after validation. |
| `ActionQueue` / `ActionQueueItem` | preserved, not rendered; duplicate | Older alternate queue implementation. Candidate cleanup after validation. |
| `SelectedClientPreview` | preserved, not rendered | Its compact-context role is covered by the map footer. Candidate reuse/cleanup. |
| `CalmActionState` / `CalmTeamState` | preserved, not rendered | Replaced in current composition by the integrated calm state. |
| `TeamStatusBar` / `TeamSummaryPanel` | preserved, not rendered | Older summary treatments. Candidate cleanup after validation. |
| `components/trainer-os/dashboard/*` | preserved, not rendered; duplicate model | Separate operating-board mock/type system. Do not delete before a dedicated cleanup stage. |
| `/trainer/attention` | unchanged and experimental | Not linked as the primary workflow. |

No component or route file was deleted.

## 16. Files changed

- `app/trainer/dashboard/page.tsx`;
- `components/trainer-os/home/trainer-home-page.tsx`;
- `components/trainer-os/home/dashboard-read-model.ts`;
- `components/trainer-os/home/dashboard-status-header.tsx`;
- `components/trainer-os/home/attention-workspace.tsx`;
- `components/trainer-os/home/living-team-map.tsx`;
- `components/trainer-os/home/team-activity-feed.tsx`;
- `components/trainer-os/home/empty-team-state.tsx`;
- `components/trainer-os/home/mock-data.ts`;
- `docs/trainer-dashboard-workflow-implementation-v1.md`.

`docs/decision-log.md` was not changed because implementation did not introduce a new product decision beyond accepted Stage 5/Stage 7 direction.

## 17. Visual QA

Browser automation used local Chrome through Playwright against `http://localhost:3000`.

| State | Viewport | Result |
|---|---:|---|
| Normal four-item queue | `1440x1000` | Pass; Attention primary, map selected node synchronized, Activity secondary. |
| Discomfort first | `1440x1000`, `390x844` | Pass; safety signal first and non-color label/icon present. |
| Queue selection -> map | `1440x1000` | Pass; selecting Artem selected the Artem map node. |
| Review drawer | desktop and `390x844` | Pass; existing sheet opened, no page overflow. |
| Full Review page | `390x844` | Pass; canonical mock workout route loaded without overlay. |
| Quick Assign drawer | desktop and `390x844` | Pass; existing sheet opened, no page overflow. |
| Local resolution -> next | `1440x1000` | Pass; Olga receipt displayed and Ksenia became current. |
| All calm | `390x844` | Pass; zero queue items, 24 map nodes, Activity retained. |
| New trainer | `390x844` | Pass; zero queue items and zero map nodes. |
| Large team | desktop and `390x844` | Pass; 30 nodes, seven queue items, one selected node. |
| Team Activity drawer | `390x844` | Pass; existing journal sheet opened. |
| Horizontal overflow | all tested states | Pass; `scrollWidth === clientWidth`. |
| Bottom navigation | `390x844` | Pass; fixed nav detected and page bottom padding retained. |
| Dashboard console/page errors | normal and scenario routes | Pass; none observed. |
| Hydration/React key/navigation errors | tested Dashboard routes | Pass; none observed. |

The Athlete Profile route itself exposed a pre-existing mock limitation during navigation; see Known limitations.

## 18. Known limitations

1. `app/trainer/clients/[clientId]/page.tsx` ignores `clientId` and always renders the single `ClientProfilePage` mock. Therefore a correct Dashboard URL such as `/trainer/clients/olga-sokolova` currently displays Artem's mock profile. Stage 7 does not change Athlete Profile by scope.
2. The safe origin query markers are passed but the existing profile/review surfaces do not yet render a return-to-queue control.
3. Review and Quick Assign still use callback-only mock behavior and static internal content.
4. Existing mobile Sheet sizing resolves to approximately 75% viewport width because of the shared Sheet component's current class behavior. It remains usable and creates no horizontal overflow, but should be validated in the dedicated drawer stage.
5. Activity data and Attention read-model data are static and can refer to the same source event without a shared stable source ID.
6. Local resolution is reset on reload and is intentionally not persisted.
7. The missed-workout item is explicitly a visual prototype, not an accepted lifecycle type.
8. The map's exact semantic zones and clustering remain unvalidated.
9. Existing Athlete Profile emitted an LCP image warning for `/ranks/v1/athlete-ii.png`; Dashboard emitted no warning.
10. Production build still emits the pre-existing Recharts `width(-1) and height(-1)` warning twice during static generation. It was not changed in this stage.

## 19. Deferred decisions

- Final semantic names and boundaries of map zones.
- Whether the map remains useful after novelty in pilot use.
- Production Attention generation, persistence, concurrency, and source identity.
- One canonical contract shared by Dashboard, Profile, Review drawer/page, and Quick Assign.
- Return-to-queue origin context in Athlete Profile and review receipts.
- Whether quick Review remains a drawer or promotes more cases to the full page.
- Cleanup/removal of preserved duplicate dashboard components and mocks.
- Production large-team clustering or filtering.
- Exact mobile drawer width and action-footer treatment.

## 20. Acceptance criteria results

| Criterion | Result |
|---|---|
| Attention queue has obvious primary priority | Pass. |
| No two unrelated rendered queues | Pass; Action Stories and Secondary Attention are no longer rendered. |
| Living Team Map preserved and integrated | Pass. |
| Map is not the only client path | Pass; queue and client list remain available. |
| Team Activity differs from Attention | Pass. |
| Primary action is clear | Pass for review, assignment, discomfort, and missed prototype. |
| Resolution advances to next task | Pass in local demo state. |
| All-calm and no-client states | Pass. |
| Approximately 20 and 30 clients | Pass in normal and large modes. |
| Mobile horizontal overflow | Pass. |
| Bottom navigation does not remove action access | Pass. |
| Keyboard/screen-reader path independent of map | Pass for actionable queue; full manual assistive-technology QA remains recommended. |
| Existing Review and Quick Assign reused | Pass; internals unchanged. |
| Athlete Profile and Builder not redesigned | Pass. |
| Backend/schema/API/auth unchanged | Pass. |
| Lint | Pass. |
| Build | Pass with two pre-existing Recharts warnings. |
| Premium visual language preserved | Pass by visual inspection. |
