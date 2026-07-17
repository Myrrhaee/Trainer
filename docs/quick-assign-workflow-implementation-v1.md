# Quick Assign Workflow Implementation v1

## 1. Scope

Stage 10 stabilizes Quick Assign as a contextual, athlete-aware demo workflow for assigning one saved `WorkoutTemplate`. The implementation is local only. It does not write to Supabase, PostgreSQL, an API, or `localStorage`, and it does not introduce a route.

Changed scope is limited to `components/trainer-os/quick-assign/*`, thin entry adapters in Dashboard, Athlete Profile, Workout Review, Clients, and this document.

## 2. Before state

The previous `QuickAssignDrawer` accepted a `TeamClient`, displayed three inline cards, visually selected the first card by array index, and returned only `clientId` through callbacks. It had no real template selection, assignment draft, date, validation, snapshot, conflict handling, confirmation model, or origin-aware return state.

Unknown client IDs received the fallback values `74.2 кг` and `Неделя 4 из 8`, which belonged to the visual Artem scenario. Builder transitions did not preserve athlete or origin context. The wide three-column layout collapsed poorly on mobile.

## 3. Root causes

- Template cards were presentation data rather than selectable domain objects.
- Template, load strategy, client context, and assignment confirmation were mixed in one component.
- The callback contract did not carry the chosen template, date, snapshot, or overrides.
- A generic fallback made wrong-athlete data leakage possible.
- Origin context was implicit in the parent and lost inside the drawer.
- The Sheet inherited the primitive's 75% mobile width and contained min-content overflow risks.

## 4. Quick Assign role

Quick Assign is a contextual Sheet for one decision: assign one saved and published workout template to one known athlete on one date. It is not a builder, program planner, exercise library, AI recommendation engine, or authoritative assignment store.

## 5. Athlete mapping

`buildQuickAssignView()` resolves athletes by exact ID. It adapts the existing profile read source first and the existing Trainer Home team source second. It never matches by display name and never substitutes the first demo athlete.

Verified states:

| Athlete | State | Expected behavior |
| --- | --- | --- |
| `egor-nikitin` | needs next assignment | Assignment enabled; Dashboard reason preserved |
| `artem-smirnov` | after review | Assignment optional; Review context preserved |
| `maria-volkova` | calm / planned | Assignment enabled; existing date conflict available |
| `ksenia-belyaeva` | paused | Assignment blocked; profile action shown |
| unknown ID | unknown | Safe not-found state; no borrowed athlete data |

## 6. Entry contexts

The provider-neutral context supports `dashboard`, `profile`, `review`, `clients`, and `direct`. Optional values are `attentionItemId`, `reviewSessionId`, a short reason, and a safe trainer return path.

- Dashboard passes the queue item and resolves only an item whose primary action is `assign`.
- Athlete Profile passes the selected profile ID and updates a local receipt; opening the result moves to the Training tab.
- Workout Review passes the reviewed athlete and session ID. Review completion remains independent.
- Clients opens the Sheet from the selected row action.
- Direct is the safe default for local component use; no global route was added.

## 7. Read model

`quick-assign-model.ts` defines `QuickAssignView`, `QuickAssignAthlete`, `WorkoutTemplateListItem`, `WorkoutAssignmentDraft`, `ExerciseAssignmentOverride`, `AssignmentSummary`, and `AssignmentReceipt`.

The model is provider-neutral and does not expose Supabase rows. `WorkoutTemplateListItem` and `AssignmentReceipt` are separate objects. An assignment records athlete ID, source template ID and revision, scheduled date, snapshot exercises, overrides, and entry context. Program is absent.

## 8. Template selection

The Sheet provides deterministic groups for suitable, recent, and all templates. Search matches title, description, category, and focus. Suitable templates use a small deterministic goal/category mapping, not AI inference.

Selection is explicit and keyboard-focusable. No template is silently assigned by array position.

## 9. Template states

The demo list contains published, draft, and archived examples. Only `published` items can be selected. Draft and archived items remain visible in All templates with labels and disabled semantics. Quick Assign never publishes a template.

## 10. Selected template summary

The selected summary shows title, source revision, focus, duration, exercise count, general template instruction, superset presence, and a compact exercise list. Exercise details use progressive disclosure through `Посмотреть состав`.

## 11. Assignment overrides

Overrides are limited to sets, repetitions, and target weight for an existing exercise. They are stored only on the assignment draft and snapshot. `Вернуть параметры шаблона` clears every override. The source template object is never mutated.

Adding exercises, reordering, editing supersets, and full template editing are intentionally absent. Exercise deletion is deferred rather than implemented without a complete confirmation pattern.

## 12. Assignment snapshot preview

Before confirmation, the preview shows athlete, template, date, exercise count, duration, override count, trainer note, and entry source. The resulting local receipt includes a deterministic demo ID, source template revision, copied exercises, and per-exercise overrides. Technical IDs are not rendered to the trainer.

## 13. Schedule and conflict behavior

Date is required. Today, tomorrow, and a native date input are available. Past dates are rejected. Maria has a deterministic existing assignment used to verify conflict behavior.

When a date conflict exists, submission is disabled until the trainer changes the date or explicitly confirms a second assignment. This is a prototype warning and is not recorded as a new accepted product decision. Time windows and timezone conversion are deferred.

## 14. Builder transition

`Создать шаблон` and `Открыть шаблон` use the existing `/trainer/builder` route. Query markers preserve `clientId`, `from=quick-assign`, source, optional template ID, and a validated `/trainer/*` return path. Builder content and modes were not changed.

If the current Quick Assign draft is dirty, the trainer must explicitly discard it before navigation.

## 15. Confirmation and return behavior

The receipt names the exact athlete, selected template, scheduled date, source revision, exercise count, and override count.

- Dashboard offers next client, queue return, and athlete profile.
- Profile offers opening the result in the Training tab, staying in profile, profile link, and Dashboard.
- Review offers next review client when available, return to review, athlete profile, and Dashboard.
- Clients offers return to clients and athlete profile.

No persistent or authoritative assignment is claimed.

## 16. Unsaved state

Selecting a template, changing the default date, adding notes/instructions, or creating overrides marks the session dirty. Closing with Escape, the close button, or the Sheet close path opens a confirmation dialog. The trainer can continue editing or discard. Search and group filters alone do not create a fake assignment draft.

## 17. Empty/error states

- Unknown athlete: safe not-found state with no demo fallback.
- No saved templates: explanation and Builder transition preserving athlete context.
- Search has no results: clear filters and create-template actions.
- No suitable templates: the trainer can switch to All templates or open Builder.
- Invalid or missing date: inline accessible error and disabled submit.
- Draft/archived template: visible but unavailable.

The no-template demo state is attached to `alexandra-konstantinova` for local verification.

## 18. Paused athlete behavior

Paused athletes cannot receive an assignment in v1. The Sheet explains the block and offers `Открыть профиль`. It does not activate the relationship or alter access status. This remains a conservative prototype behavior, not a new accepted product decision.

## 19. Mobile behavior

At `390×844`, the Sheet is 378 px wide and leaves a 12 px edge. The rule is local to Quick Assign. Content scrolls vertically, footer actions include safe-area padding, touch controls are at least about 44 px, and all internal grids use explicit min-width constraints.

Browser measurement found zero document overflow and zero descendants extending beyond the Sheet after the responsive fix.

## 20. Accessibility

The implementation retains Radix dialog semantics, focus trap, Escape handling, and focus return. It includes an accessible title and description, labelled search/date/note inputs, tab and listbox selection semantics, `aria-selected`, disabled states that are not color-only, an announced disabled reason, conflict alert, live confirmation, and a keyboard-operable unsaved-changes dialog.

## 21. Component preservation matrix

| Component / area | Status | Notes |
| --- | --- | --- |
| Existing `QuickAssignDrawer` shell | adapted | Preserved premium dark/lime language; internal workflow replaced |
| Existing inline template cards | adapted | Rebuilt as real selectable template cards |
| Previous load strategy section | temporarily hidden | It mixed athlete analytics with assignment creation |
| Previous loads column | temporarily hidden | Not part of the minimum assignment decision |
| Athlete avatar/identity | preserved and adapted | Now resolved from exact athlete ID |
| `QuickAssignView` and assignment types | extracted | New provider-neutral model |
| Dashboard entry | adapted | Thin context and receipt adapter only |
| Athlete Profile entry | adapted | Thin context and local receipt adapter only |
| Workout Review entry | adapted | Thin context adapter; review internals unchanged |
| Clients entry | adapted | Existing quick action now opens the Sheet |
| Builder | preserved as-is | Only receives safe query markers |
| Legacy quick-assign duplicate | none found | Candidate cleanup is not required in this stage |

## 22. Files changed

- `components/trainer-os/quick-assign/quick-assign-model.ts`
- `components/trainer-os/quick-assign/quick-assign-drawer.tsx`
- `components/trainer-os/home/trainer-home-page.tsx`
- `components/trainer-os/client-profile/client-profile-page.tsx`
- `components/trainer-os/workout-review/workout-review-page.tsx`
- `app/trainer/clients/page.tsx`
- `docs/quick-assign-workflow-implementation-v1.md`

No backend, API, auth, route, migration, schema, package, global Sheet primitive, TrainerShell, Client Cabinet, or Builder content file changed.

## 23. Visual QA

Desktop `1440×1000`:

- Dashboard entry resolves Egor and creates a receipt without closing a Review item.
- Profile entry resolves Maria and exposes a conflict on the known scheduled date.
- Review entry resolves Artem and labels assignment as an optional post-review step.
- Clients entry resolves Maria; Anna's unsupported ID shows the safe unknown state.
- Ksenia shows the paused block.
- Alexandra shows the no-template state.
- Search no-results, clear filters, draft/archived disabled states, selection, details, override, reset affordance, date, conflict confirmation, preview, unsaved close, and receipt were exercised.

Mobile `390×844`:

- Sheet bounding box: `x=12`, `width=378`, `height=844`.
- Athlete context, search, tabs, template card, schedule, and fixed action area render without horizontal document overflow.
- No descendant extended outside the Sheet after the min-width correction.

Fresh browser runs reported no console errors and no Next error overlay. A transient Turbopack CSS resolution error appeared only during hot reload and disappeared after a clean dev-server restart; production build was unaffected.

## 24. Known limitations

- Assignment state is local to the current rendered screen and is lost on reload.
- The profile receipt represents the local upcoming state; it does not mutate the canonical profile mock timeline.
- There is no assignment detail route, remote persistence, calendar engine, or duplicate store.
- Template data is a Stage 10 demo read model, not synchronized with Builder local storage or Supabase.
- Exercise deletion, time windows, timezone conversion, and cross-route draft persistence are deferred.
- Direct/local rendering is supported by the component contract but no public or trainer route was added for it.
- Existing unrelated image preload and Recharts sizing warnings remain outside scope.

## 25. Deferred decisions

- Whether paused athletes may override the block.
- Whether conflicts should allow two workouts, require time windows, or block.
- Canonical persistence and reconciliation of assignments.
- Canonical template provider and publication workflow.
- Assignment detail route and post-confirmation destination.
- Exercise deletion inside Quick Assign.
- Athlete timezone ownership.

None of these items was added to `docs/decision-log.md` as accepted.

## 26. Acceptance criteria results

| Criterion | Result |
| --- | --- |
| Correct athlete across entry points | Pass |
| Unknown athlete never borrows demo data | Pass |
| Template and assignment separated | Pass |
| Published templates only assignable | Pass |
| Program absent from flow | Pass |
| No-template state preserves Builder context | Pass |
| Overrides modify snapshot only | Pass |
| Preview includes athlete, template, date, overrides | Pass |
| Paused athlete handled safely | Pass |
| Date conflict visible and explicit | Pass |
| Origin-aware confirmation | Pass |
| Review completion independent | Pass |
| Mobile no horizontal overflow | Pass |
| Focus and keyboard path | Pass through Radix and browser interaction |
| Dashboard/Profile/Review/Builder structure preserved | Pass |
| Lint | Pass |
| Build | Pass with pre-existing Recharts sizing warnings |
