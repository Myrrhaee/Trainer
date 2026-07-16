# TrainerShell and MVP Navigation Implementation v1

Date: 2026-07-16  
Branch: `feat/trainer-shell-navigation-v1`  
Baseline: `34b5a70c48f7c548ffc4c5b74b512ea6e0188bb1`

## 1. Scope

Stage 6 implements the accepted trainer MVP information architecture inside `TrainerShell` without redesigning Dashboard, Athlete Profile, Workout Review, Quick Assign, Builder content, client cabinet, backend, or domain data.

Implemented scope:

- one five-item navigation configuration;
- desktop icon rail;
- mobile bottom navigation;
- deterministic active-route matching;
- contextual and experimental route behavior;
- core-only command palette and shell notifications;
- account identity and logout behavior;
- shell accessibility and focus states;
- one navigation-driven page-title alignment for `/trainer/builder`.

## 2. Before state

- Desktop rail rendered four items from `trainerNav` and rendered Settings through a separate duplicated branch.
- Mobile repeated the same four items plus Settings in a horizontally scrolling chip row after Search and Notifications.
- Active matching used generic `pathname.startsWith(href)` logic in both desktop and mobile render paths.
- Command palette exposed Attention, Messages, Programs, Calendar, Automation, Insights, Reports, and Sales as first-class sections/actions.
- Shell notifications linked directly to Calendar and Sales.
- Trainer identity was visible on desktop, but TrainerShell had no logout behavior and no mobile account surface.
- No `app/trainer/layout.tsx` exists; trainer screens wrap themselves with the single `components/trainer/trainer-shell.tsx` implementation.
- Repository search found no second trainer sidebar or trainer mobile navigation implementation.

Evidence reviewed before edits:

- all `TrainerShell` call sites in `app/trainer/*` and `components/trainer-os/*`;
- trainer route tree and absence of a trainer layout;
- desktop/mobile branches, command palette, notifications, logo, identity, and focus behavior in `trainer-shell.tsx`;
- account/logout precedent in `components/client-nav.tsx` and demo-session helpers in `lib/demo-mode.ts`.

## 3. Implemented navigation

One `trainerNavigationItems` configuration now drives desktop, mobile, command-palette section entries, labels, icons, hrefs, and active matching.

| Order | ID | Label | Route | Active rule |
|---:|---|---|---|---|
| 1 | `dashboard` | Главная | `/trainer/dashboard` | exact |
| 2 | `clients` | Клиенты | `/trainer/clients` | exact or nested client route |
| 3 | `templates` | Шаблоны | `/trainer/builder` | exact or nested builder route |
| 4 | `library` | Библиотека | `/trainer/library` | exact or nested library route |
| 5 | `settings` | Настройки | `/trainer/settings` | exact or nested settings route |

`/trainer/builder` remains the temporary route for Templates. No route or Templates workspace was created. Its TrainerShell title changed from `Builder` to `Шаблоны` solely to keep the accepted user-facing section name consistent; Builder content was not changed.

## 4. Desktop behavior

- The existing `w-24` premium icon rail, lime accent, logo treatment, borders, and dark surface remain.
- Exactly five navigation links render in accepted order.
- Settings is part of the same configuration and no longer has a duplicated special rendering branch.
- The logo continues to return to `/trainer/dashboard`.
- Active state uses `aria-current="page"`, border/background treatment, and a separate lime edge indicator, so state is not conveyed by color alone.
- Every icon-only destination retains an accessible label and title.
- Keyboard focus uses an explicit high-contrast focus ring.
- Identity remains in the account area; logout is a separate labelled icon action rather than a second Settings link.
- The sticky rail and sticky header remain independent of long page content.

## 5. Mobile behavior

Chosen solution: **five-item bottom navigation**.

Rationale:

- five accepted destinations fit at `390px` without an `Ещё` bucket;
- it makes frequent sections continuously discoverable;
- it removes the previous horizontal-scrolling navigation row;
- it preserves Search, Notifications, and Account as compact header actions;
- it avoids putting experimental routes behind an ambiguous menu.

Implementation details:

- five equal grid columns;
- measured touch area at `390×844`: approximately `76×72px` per item;
- readable Russian labels without document-level horizontal overflow;
- active top indicator, filled icon capsule, text weight, and `aria-current`;
- `env(safe-area-inset-bottom)` support;
- `104px` mobile main-content bottom padding so the final content/actions can scroll above the fixed navigation;
- bottom navigation remains below Radix sheets/dialogs (`z-40` navigation, `z-50` overlays).

Mobile account identity opens a Radix Sheet with identity and logout. Search opens the existing Command Dialog. Both close with Escape through existing Radix behavior.

## 6. Active route rules

- `/trainer/dashboard` activates `Главная` only on the exact route.
- `/trainer/clients` and `/trainer/clients/[clientId]` activate `Клиенты`.
- `/trainer/builder` activates `Шаблоны`.
- `/trainer/library` activates `Библиотека`.
- `/trainer/settings` activates `Настройки`.
- Matching is segment-safe: prefix items use exact href or `${href}/...`, not an unrestricted string prefix.
- Desktop and mobile use the same helper and cannot diverge by implementation branch.

## 7. Contextual route rules

- `/trainer/clients/[clientId]` activates `Клиенты` because the athlete workspace is nested client context.
- `/trainer/review/[workoutId]` creates no active primary item. The route currently has no persisted navigation-origin context, so highlighting Clients would create a false state for dashboard/notification entry.
- Quick Assign and Workout Review drawers inherit the underlying route's active state and create no navigation items.
- Detailed AttentionItem and communication actions create no standalone primary items.
- A future origin-aware review highlight may be added only when route/context state can identify its source reliably.

## 8. Experimental route preservation

The following routes were removed from primary desktop/mobile navigation and primary command-palette discovery:

- `/trainer/attention`;
- `/trainer/programs`;
- `/trainer/calendar`;
- `/trainer/messages`;
- `/trainer/reports`;
- `/trainer/automation`;
- `/trainer/insights`;
- `/trainer/sales`.

No route, page, component, asset, or direct URL was removed. No redirect or deprecated UI label was added. Shell notifications that directly promoted Calendar/Sales were removed from the local shell seed so experimental surfaces do not return through primary shell discovery.

## 9. Accessibility changes

- Both navigation surfaces use a `nav` landmark named `Основная навигация тренера`.
- Active destinations expose `aria-current="page"`.
- Icon-only desktop links and mobile header controls have labels/titles.
- Active state combines shape/background/indicator with color.
- Desktop links, logo, Search, Notifications, Account, logout, and mobile links have explicit `focus-visible` treatment.
- Mobile touch targets exceed the approximate `44×44px` minimum.
- Command Dialog and account/notification Sheets retain Radix focus trapping and Escape close behavior.
- Logout buttons expose disabled/busy presentation while sign-out is in progress.

## 10. Files changed

| File | Change |
|---|---|
| `components/trainer/trainer-shell.tsx` | Unified navigation config, desktop/mobile navigation, active rules, core-only shell discovery, account/logout, accessibility. |
| `app/trainer/builder/page.tsx` | TrainerShell page title only: `Builder` -> `Шаблоны`. |
| `docs/trainer-shell-navigation-implementation-v1.md` | Stage 6 implementation record and verification results. |

`docs/decision-log.md` was not changed because implementation required no product decision beyond accepted D-105-D-122.

## 11. Reused UI

- Existing TrainerShell rail, logo, header, avatar, command palette, and notification sheet.
- Existing shadcn/Radix `Sheet`, `CommandDialog`, `Button`, and `Avatar` components.
- Existing lucide icons.
- Existing premium dark surfaces, lime accent, border language, typography, and responsive `lg` breakpoint.
- Existing demo-session and Supabase sign-out adapters.

## 12. Known limitations

- Templates still resolves to the current `/trainer/builder` prototype until the accepted Builder redesign.
- Review does not highlight Clients because origin context is not persisted in the route.
- Desktop rail remains icon-only by design; accessible labels and native titles identify destinations.
- Command-palette client entries remain seeded demo data; this stage did not redesign search data sources.
- Shell notifications remain local prototype state.
- The fixed mobile bottom navigation overlays the viewport edge while scrolling; reserved bottom content padding keeps final actions reachable.
- Next dev mode injects `NEXTJS-PORTAL`, which intercepted automated pointer hit-testing at the bottom edge. The same bottom-nav tap was therefore repeated successfully against the production build, where the portal is absent.

## 13. Visual QA

### Desktop `1280×720`, development server

Verified routes:

- `/trainer/dashboard` -> Главная active;
- `/trainer/clients` -> Клиенты active;
- `/trainer/clients/artem-smirnov` -> Клиенты active;
- `/trainer/builder` -> Шаблоны active;
- `/trainer/library` -> Библиотека active;
- `/trainer/settings` -> Настройки active;
- `/trainer/attention` direct URL -> no false active item;
- `/trainer/review/artem-smirnov-2026-06-10` -> no false active item.

Every route rendered meaningful content, exactly five primary navigation links, no experimental links in the primary nav, no document horizontal overflow, and no Next error overlay.

### Mobile `390×844`, development server

Verified Dashboard, Clients, athlete profile, Builder, Library, and Settings. All expected active states passed; every page had no horizontal overflow or error overlay. Bottom-navigation geometry was `390×73px`, with five approximately `76×72px` link targets. Main content reported `104px` bottom padding.

Account Sheet and Command Dialog opened and closed with Escape. Command Dialog showed all five core sections and none of the eight hidden experimental section names.

### Production interaction verification

The optimized build was served on port `3002`. At `390×844`, `/trainer/builder` rendered the `Шаблоны` header with no overlay, overflow, warning, or error. A real tap on the bottom-nav `Клиенты` link navigated to `/trainer/clients` and updated `aria-current` to `/trainer/clients`.

Console result: no errors or hydration warnings. Two development-only Next Image LCP warnings were observed on existing rank/exercise images; they are unrelated to TrainerShell and were not changed.

No screenshots were added to Git and no remote-data-writing action was performed.

## 14. Deferred decisions

- Whether a future review route should reflect its persisted origin in the primary active state.
- Whether mobile navigation needs a different treatment below `390px` after device research.
- Whether account identity/logout later belongs in a unified account menu shared across roles.
- When `/trainer/builder` is replaced by the redesigned Templates workspace.
- Whether any experimental section earns a return to primary navigation after research.

## 15. Acceptance criteria results

| Criterion | Result |
|---|---|
| Desktop sidebar contains exactly five accepted sections | Pass |
| Experimental routes hidden only from primary navigation/discovery | Pass |
| Experimental direct route remains available | Pass: `/trainer/attention` verified |
| Contextual routes do not create extra sidebar items | Pass |
| Client profile activates Clients | Pass |
| Russian primary labels are consistent | Pass; Builder shell title aligned to `Шаблоны` |
| Mobile supports five sections | Pass |
| No horizontal overflow at `390×844` | Pass on six required routes |
| Navigation does not make final actions unreachable | Pass; safe-area-aware bottom padding reserved |
| Keyboard/focus behavior preserved or improved | Pass |
| Dashboard/Profile/Review/Quick Assign/Builder content unchanged | Pass; only Builder shell title changed |
| Backend/Supabase/domain mocks unchanged | Pass |
| `npm run lint` | Pass, no errors |
| `npm run build` | Pass; existing Recharts static-generation warnings only |
| Premium fitness OS language preserved | Pass |
