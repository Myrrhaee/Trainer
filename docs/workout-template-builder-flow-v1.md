# WorkoutTemplate Builder Flow V1

Дата: 2026-07-10

Статус: accepted Stage 2 builder flow; mobile strategy remains a proposed working hypothesis

Scope boundary: simple reusable WorkoutTemplate builder; current builder screen is not target UX.

## Evidence labels

- **Accepted product decision** - confirmed in `docs/decision-log.md`.
- **Current code evidence** - confirmed by real implementation/migration.
- **Current prototype behavior** - useful evidence, not accepted product contract.
- **Proposed product decision** - recommendation awaiting Product Lead review.
- **Open question** - requires trainer research or founder/backend decision.

## A. Purpose and boundaries

`WorkoutTemplate` is a reusable trainer-owned prescription structure. Simple template creation is a core MVP capability and blocker (accepted D-031). The existing `/trainer/builder` composition is not target UX and requires full redesign before production backend integration (accepted D-030).

Three concepts must remain separate:

| Concept | Meaning | Mutability rule |
| --- | --- | --- |
| WorkoutTemplate | Reusable source structure owned by trainer | Trainer can edit/create versions for future use |
| WorkoutAssignment | Concrete task for one client/date, created only from a saved template in first MVP | Owns an independent snapshot; editable before session start, structurally locked after start in the normal flow |
| WorkoutSession | Client's factual execution of an assignment | Stores actual behavior; never edits template implicitly |

Full multi-week Program Builder is outside first MVP (D-020, D-032).

Advanced multi-week Program Builder is an independent post-core flow and is not a mode, step or hidden branch of the simple WorkoutTemplate Builder (accepted D-059).

## B. Entry points

| Entry point | Role in MVP | Context carried into builder | Exit |
| --- | --- | --- | --- |
| Trainer opens Templates | **Primary** | none or selected template | Save to templates list; optional assign |
| Athlete profile | Secondary | fixed client id, optional date/intention | Save and Assign returns to profile |
| Quick Assign finds no suitable template | Secondary | client id, source item id, intended date | Save and Assign returns to queue/quick assign context |

Accepted flow: primary entry is a dedicated Templates workspace/list followed by create/edit. Athlete profile and Quick Assign are contextual secondary entry points. This supports reusable trainer assets without forcing a client or Program and does not redefine the template as client-owned (D-053).

Current navigation labels `/trainer/builder` as “Шаблоны” (`docs/mvp-scope-v1.md:27-31`), while the page mixes draft, Program editing, template storage and client assignment. Route naming can stay temporarily; IA should separate list, editor and assign actions conceptually before route work.

## C. Creation modes

| Mode | MVP status | Behavior |
| --- | --- | --- |
| Blank template | Required first-MVP mode | Start with name and empty exercise list; guide first exercise addition |
| Duplicate existing template | Required first-MVP mode | Create new draft with new identity and source attribution; original unchanged |
| Create from existing assigned workout/session | Later | Requires a separate rule for whether plan, actuals or both are copied |
| AI-generated template | Later | Not required for MVP; trainer review would remain mandatory |

“Repeat previous workout” from athlete profile remains prototype evidence (`components/trainer-os/client-profile/training-tab.tsx`) and is not a first-MVP template creation mode.

## D. Builder steps and layout

### Conceptual sequence

1. **Identity:** name and optional general instructions/training type.
2. **Add exercises:** browse/search/filter library and add one or more exercises.
3. **Configure exercise prescription:** working sets and core targets.
4. **Order:** reorder exercises and blocks.
5. **Supersets:** optionally group exercises and define execution order/rest.
6. **General instructions:** session-level note visible to client.
7. **Review:** scan compact prescription and validation issues.
8. **Save:** save draft or reusable template.
9. **Optional assign:** choose linked client/date and create independent assignment.

These are workflow steps, not a mandatory wizard.

### Layout comparison

| Option | Strengths | Weaknesses | Assessment |
| --- | --- | --- | --- |
| Single workspace | Fast repeated editing; all exercises visible; easy reorder | Can become dense and overwhelming | Recommended base for experienced trainers with progressive disclosure |
| Step-by-step wizard | Clear for first use; prevents missing steps | Slow for frequent edits; hides cross-exercise comparison | Not recommended as primary daily builder; possible onboarding aid |
| Split layout with exercise library | Fast library-to-workout composition on wide screens | Requires responsive adaptation and stable selection behavior | Recommended desktop/tablet pattern |
| Drawer-based editing | Keeps list context and works for one exercise | Poor for comparing many exercises/sets; nested drawer risk | Use for exercise detail/config on compact screens, not entire builder |

### Accepted recommendation

Use a **single workspace with progressive disclosure**, not a mandatory wizard. A searchable exercise library panel can accompany the workout outline on desktop/tablet; exercise cards remain compact by default and expand for configuration. A persistent action bar clearly separates Save Draft, Save Template, Assign and Save and Assign. Review is a compact validation/summary state rather than a mandatory multi-step wizard (D-054).

Rationale: the target trainer creates and edits workouts repeatedly. Speed, copy/reorder and cross-exercise scanning matter more than guided novelty. Current prototype demonstrates useful controls but overloads one page with Programs, clients, storage modes and repeated save areas (`app/trainer/builder/page.tsx:1431-1663`, `:1724-1736`, `:1889-1915`, `:2195-2233`).

## E. Exercise configuration

Field names are conceptual and do not define schema.

### Required MVP concepts

| Parameter | Rule |
| --- | --- |
| Exercise | Stable Exercise identity plus display snapshot/title |
| Default prescription | Each exercise has one default prescription expressed through the supported types selected after research |
| Set structure | The accepted hybrid model must distinguish exercise-level defaults from optional per-set overrides |
| Trainer note | Optional client-visible context; not part of minimum structural validity unless research changes this |

### Prescription candidates requiring research

| Parameter | Assessment |
| --- | --- |
| Repetitions | Exact value, range or another mode; status open |
| Target weight | Optional candidate; many assignments depend on athlete context or effort target |
| RPE or RIR | Methodology-dependent candidates; exact support remains open |
| Duration, distance or percentage | Candidate prescription types requiring trainer evidence |
| Rest | Candidate default field; required/optional semantics remain part of prescription research |
| Warm-up/top/back-off set kinds | Special-set model remains open |

### Post-MVP by default

| Parameter | Reason |
| --- | --- |
| Tempo | Current prototype supports it, but evidence of first-beta necessity is absent |
| Substitutions | Valuable but expands assignment/execution logic |
| Complex execution types/effort modes | Current UI fields are broad and unvalidated |
| Conditional progression rules | Requires Program/automation semantics |
| Video/form requests as structured rules | Can start as trainer note |

Current type includes sets, reps, weight, rest, RPE, tempo, note, comment, execution type, effort mode and per-set entries (`components/trainer/workout-builder-types.ts:9-31`). This is prototype evidence, not a requirement list.

## F. Set model

### Options

| Model | Benefit | Cost |
| --- | --- | --- |
| Common parameters for all sets | Fast and compact for repeated prescriptions | Cannot express ramp-up/top/back-off sets cleanly |
| Every set configured separately | Maximum control | Slow, visually heavy and error-prone for routine templates |

### Accepted hybrid for MVP

- Exercise has a default prescription: set count, reps/range, optional target weight/effort and rest.
- Trainer can switch to per-set overrides only when needed.
- Existing defaults prefill overrides; changes stay local to the overridden set.
- UI indicates mixed values clearly and offers “apply to all”/“reset overrides” if validated.
- Warm-up sets, if included, are marked as a set kind rather than inferred from low weight.
- Actual client logs never overwrite prescribed set defaults.

The current prototype already implements common/per-set modes and stable set entries (`components/trainer/workout-exercise-card.tsx:262-358`; `components/trainer/workout-builder-types.ts:1-31`). The conceptual hybrid is accepted; supported prescription types and warm-up/special-set semantics remain open.

## G. Superset behavior

### Proposed conceptual rules

- Trainer selects two or more exercises and groups them into one superset block.
- Block displays stable order as A1, A2, A3; the client performs that order for each round.
- Ungroup removes block semantics while preserving exercises and their prescriptions in current list order.
- Reordering the block moves it as one unit among standalone exercises/blocks.
- Reordering inside the block changes A1/A2/A3 order only.
- Moving one exercise outside requires explicit “remove from superset,” not silent drag ambiguity.
- MVP should support more than two exercises only if beta trainers use tri-sets/circuits; technically the current component supports a list, but product scope is open.
- Client sees block title/instructions, round count, exercise order and rest between exercises/rounds as accepted by the final model.
- Incomplete block with fewer than two exercises cannot be saved as a valid superset; trainer can dissolve it or add another exercise.

Current `WorkoutSupersetBlockCard` supports multiple exercises, A-order, rounds, rest, notes, move/delete and add controls (`components/trainer/workout-superset-block-card.tsx:69-240`). It is adaptation material, not accepted UX.

## H. Save versus Assign

This separation is accepted for the first-MVP flow.

| Action | MVP status | Result |
| --- | --- | --- |
| Save Draft | Required | Persists unfinished trainer-owned draft; cannot be assigned |
| Save Template | Required | Persists valid reusable template/version; does not assign anyone |
| Assign | Required | Creates an independent assignment snapshot from an already saved template; original template remains unchanged |
| Save and Assign | Required contextual convenience | Saves a valid template first, then creates an assignment snapshot for selected client/date |
| Edit assignment independently | Required before session start | Changes the assignment snapshot only; after session start structural edits are forbidden in the normal flow |

### Accepted architectural rules

```text
Editing a WorkoutTemplate must not silently change an existing WorkoutAssignment.

WorkoutAssignment in the first MVP must be created from a saved WorkoutTemplate, not from a completely unsaved ad-hoc structure.
```

Assignment stores an independent template snapshot. Trainer may edit an unstarted assignment explicitly. Once its WorkoutSession starts, structural changes are forbidden in the normal flow. In-progress/completed sessions are never silently rewritten (D-040, D-057).

Current code partially distinguishes actions, but assignment is localStorage-only (`app/trainer/builder/page.tsx:1557-1569`) and template save writes `trainer_builder_templates` or local fallback (`:1597-1659`). “Save” also patches a Program when selected (`:1431-1494`), so current semantics are not suitable as a production contract.

## I. Validation and recovery

| Case | Required behavior |
| --- | --- |
| Missing name | Draft may save; valid template/assignment requires a non-empty human-readable name or explicit generated default accepted by Product Lead |
| No exercises | Draft allowed; Save Template and Assign blocked with inline explanation |
| Exercise has no sets | Block final save/assign or mark incomplete; focus exact card |
| Duplicate exercise | Allow with visible instance distinction; warn only if accidental duplication is likely; never silently merge |
| Invalid rep range | Block valid save/assign; explain expected format/domain mode |
| Incomplete superset | Block valid save as superset; offer dissolve/add exercise |
| Duplicate template name | Allow with duplicate indicator/version/date, or warn and offer rename; do not overwrite silently |
| Unsaved changes | Autosave draft plus explicit dirty state; closing offers save/discard/cancel |
| Browser refresh | Restore same draft and source context from server/local recovery mechanism; localStorage alone is not production source of truth |
| Save failed | Preserve local editor state, show retry, do not claim template exists |
| Assign failed after template saved | Confirm template saved, preserve assignment form and retry independently |
| Exercise removed from library | Existing template retains snapshot/title and flags unavailable source; replacement is explicit |
| Concurrent edit | Detect stale template version before overwrite; offer reload/save copy/explicit conflict resolution |

## J. Desktop and mobile behavior

### Evidence status

- Product strategy assumes laptop-first trainer dashboard and mobile support for quick review/messaging (`docs/mvp-scope-v1.md:245-248`).
- There is no accepted research evidence yet for device distribution during template creation.

### Proposed approach

- Proposed working hypothesis: full creation is **desktop/tablet-first** for MVP, with responsive support rather than desktop-only blocking.
- Phone must support: open template, rename/instructions, add/remove/reorder one exercise, edit core set/reps/weight/rest/note, save draft/template and assign to a client.
- On phone, library and exercise configuration can open as full-height sheets; the workout outline remains the return anchor.
- Complex multi-select drag interactions need keyboard/touch alternatives such as move up/down and “add to superset.”
- Mobile quick edit can prioritize one exercise at a time; it must not hide validation or silently drop advanced fields.
- If full superset/per-set editing is deferred on phone, UI must explicitly preserve and display those values, not flatten them.

This mobile strategy is proposed, not accepted. It requires validation through trainer device research and usage telemetry before beta commitment (D-060).

## K. Existing builder audit

| Component/current area | Current purpose | Reusable as-is | Reusable after adaptation | Not recommended | Reason |
| --- | --- | --- | --- | --- | --- |
| `ExerciseLibraryPanel` | Search/filter mine/system exercises; inspect/add/copy | No | Yes | No | Useful domain interaction, but layout/data/loading/selection must fit new workspace |
| `ExerciseDetailSheet` | Exercise media, technique, metadata | Largely | Yes | No | Isolated and role-appropriate; needs accessibility/data contract review |
| `WorkoutExerciseCard` | Configure common/per-set fields; duplicate/delete/move/replace | No | Yes | No | Rich reusable controls, but too many unvalidated fields and current visual density |
| `WorkoutSupersetBlockCard` | Manage multi-exercise block, rounds/rest/order | No | Yes | No | Good interaction inventory; final superset semantics and mobile behavior unresolved |
| `WorkoutFormHeader` | Cancel, save as template, save | No | Maybe | No | Action labels exist but current semantics omit assign and differ from current page actions |
| Current `/trainer/builder` page composition | Client/program selectors, draft, library, cards, multiple action areas, sheets | No | Individual logic only | **Yes** | Accepted D-030: target UX not accepted; combines too many concepts and repeats controls |
| Template persistence helpers | Read/write `trainer_builder_templates` with local fallback | No | Maybe after domain review | No | Useful technical spike, but JSON shape/versioning/status/folder semantics incomplete |
| Assignment localStorage payload | Simulate client assignment | No | No | **Yes** | Not shared with client and not production source of truth |
| `/api/trainer/programs` patch flow | Insert workout day into multi-week Program JSON | No for simple template flow | Later Program work | **Yes for MVP builder** | Program is not required for first vertical MVP |
| Existing exercise types | Exercise/set/block field inventory | No | Yes as research inventory | No | Must be reduced and validated before schema/UX acceptance |

### Current data evidence

- `trainer_builder_templates` persists title, training type, note and JSON exercises with trainer RLS (`supabase/migrations/20260404120000_trainer_builder_templates.sql:1-60`).
- `exercise_library` provides system/owned exercises and RLS (`supabase/migrations/20260402120000_exercise_library.sql:1-76`).
- Builder template types include separate `exercises` and `blocks`, while migration has one `exercises` JSON column; hydration/payload behavior must be audited before any migration decision.
- Current assignment payload contains client/date/placement/visibility/note and full workout but remains local (`app/trainer/builder/page.tsx:108-126`, `:1557-1569`).

These are implementation clues, not accepted domain schema.

## L. UX Definition of Done

- Trainer can start from blank or duplicate an existing template without selecting a Program.
- Template identity, exercises, order and required prescription fields are understandable at a glance.
- Trainer can add from a searchable exercise library and inspect exercise details without losing draft context.
- Common set prescription is fast; per-set overrides are available without forcing per-set entry for every exercise.
- Trainer can reorder, duplicate, remove and replace exercise instances predictably.
- Trainer can create/dissolve/reorder a valid superset and understand what client will see.
- Validation points to exact incomplete fields and allows incomplete drafts without allowing invalid assignment.
- Save Draft, Save Template, Assign and Save and Assign are visually and behaviorally distinct.
- Assign is available only for a saved valid template; a completely unsaved ad-hoc structure cannot become a first-MVP assignment.
- Saving a template never assigns a client; assigning never silently mutates the original template.
- Editing a template never silently changes existing assignments.
- Assignment can be edited before its session starts; structural changes are blocked after start in the normal flow.
- Failed save/assignment retains work and offers a safe retry.
- Closing/refreshing does not silently lose an in-progress draft.
- Under the proposed mobile hypothesis, desktop/tablet supports full repeated use and phone supports core edits without flattening stored data.
- Templates are production-persisted and visible consistently after refresh; localStorage is recovery/cache only if used.
- Analytics records create/select/save/assign logical actions once.
- Current Program complexity is absent from the first-MVP builder path.

## M. Open research questions

- Which prescription types must be supported: exact reps, ranges, duration, distance, RPE, RIR, percentages or other forms?
- How should warm-up, top, back-off and other special sets be represented without breaking the accepted hybrid model?
- What detailed superset rules are required: maximum size, rounds and rest semantics, reorder and client execution?
- Which device is primary for full template creation and which operations must trainers perform on mobile?

## Cross-flow dependencies

- `WorkoutAssignment` creation consumes a valid template snapshot/version and is specified in `docs/core-workflow-v1.md`.
- Client execution must display the same prescribed structure; actuals belong to `WorkoutSession`/`WorkoutLog`.
- Workout review compares the assignment snapshot with actual logs, never the latest mutable template.
- AttentionItem source is the completed session, not template or builder draft.

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Affected UI | Affected domain entities | Urgency |
| --- | --- | --- | --- | --- | --- | --- |
| Supported prescription types | Exact reps/ranges only; broad typed model; free text | Validate the smallest set covering target trainers' real methods | Schema and validation must not encode an untested methodology | Builder, client workout, review | WorkoutTemplate prescription, WorkoutLog | before backend |
| Warm-up and special set model | No set kinds; explicit kinds; free-text note | Research warm-up/top/back-off use before fixing technical types | Accepted hybrid model needs clear semantics for exceptional sets | Exercise editor, client execution | Template set prescription | before backend |
| Detailed superset rules | Exactly two exercises; unlimited block; separate circuit model | Validate size, round/rest and reorder semantics with trainers | Current component capability is not product evidence | Builder, client workout | TemplateBlock | before backend |
| Trainer primary device | Desktop/tablet-first; full mobile parity; mobile quick edit only | Keep desktop/tablet-first plus mobile core editing as proposed hypothesis until research | Device evidence determines responsive scope and beta DoD | Builder | none/domain-neutral | before beta |
