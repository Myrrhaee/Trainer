# Workout Builder UX Gap Analysis v1

Date: 2026-07-16  
Route: `/trainer/builder`  
Status: audit and future redesign brief; no final UI proposed.

## Verdict

Product status: **core MVP capability inside a non-target prototype**.  
UX readiness: **requires full redesign**.

The current Builder proves that the codebase can render a rich exercise library, detailed exercise prescriptions, per-set controls, supersets, drafts, template persistence, and assignment controls. It does not prove an accepted creation workflow. The first viewport asks for client, Program, Program day, and saved template while calling the object a workout day; the page then mixes Program editing, template saving, and assignment. On mobile, setup context dominates before the coach reaches exercise authoring.

Finalized Stage 5 position: the current composition requires full UX redesign; simple WorkoutTemplate Builder is a core MVP capability; advanced Program Builder is a future flow; existing primitives and components must be audited for reuse; production backend integration does not proceed until the redesigned UX flow is accepted.

## Current composition and flow

### Entry points

- Primary nav labels `/trainer/builder` as `Шаблоны` (`components/trainer/trainer-shell.tsx:55-58`).
- Clients and Messages can link with `?clientId=...`.
- Programs links with `programId` and `dayId`.
- Quick Assign offers `Открыть конструктор` without a clear selected-template handoff.

### Page responsibilities

The route owns:

- trainer/client/Program loading;
- Program day selection;
- saved builder templates;
- local draft restore;
- exercise library filtering/copying;
- exercise and superset editing;
- template save sheets;
- assignment sheets and local assignment payloads;
- optional Program patching;
- demo, localStorage, and Supabase fallbacks.

Evidence: `app/trainer/builder/page.tsx`; current-state summary in `docs/current-product-state.md:221-301`.

### Current creation flow

```text
Open Builder
→ choose optional client
→ choose optional Program and day
→ choose saved template or quick P/P/L/Full Body seed
→ edit exercises and blocks
→ save draft / save template / patch Program
→ optionally assign current workout locally
```

This makes the object identity change during the flow: it can be a day, a Program child, a reusable template, a local draft, or an assignment payload.

## Gap analysis

### Information architecture

- No dedicated Templates list/home despite the nav label.
- Creation, editing, duplicate, Program insertion, and assignment share one long page.
- Context selectors precede the core authoring job.
- Library and editor relationship is useful but spatially dense.

### Interaction model

- Save semantics depend on selected context.
- Assignment can originate from current editor state rather than an already saved template.
- Selection and persistence state are not expressed as a stable object lifecycle.
- No explicit stale/concurrent edit or safe conflict path.

### Content hierarchy

- Program/client context competes with workout name and exercises.
- Quick-start bodybuilding splits imply a specific training style before the coach defines intent.
- Multiple action regions make the final primary action ambiguous.

### Domain mismatch

Accepted first-MVP chain is:

```text
WorkoutTemplate revision
→ WorkoutAssignment snapshot
→ WorkoutSession
→ ExerciseLog / SetLog
→ AttentionItem
→ TrainerFeedback
```

Current code reads `workout_templates` as Programs, stores builder JSON in `trainer_builder_templates`, patches Program JSON, and stores assignment payloads in localStorage. Accepted behavior requires assignment only from a saved valid template and an independent snapshot (`docs/workout-template-builder-flow-v1.md:19-43`, `:166-181`).

### Visual composition

- Desktop is visually coherent but over-segmented and card-heavy for repeated editing.
- The first screen emphasizes context/configuration over the exercise list.
- Dense editor controls need stronger scan hierarchy rather than more container chrome.
- Premium dark/lime language should remain; this is not a request for global restyling.

### Component limitations

- Exercise cards contain extensive controls and can become vertically large.
- Superset block nests exercise cards, increasing density.
- Exercise library cards are optimized for browsing, not necessarily rapid multi-select or keyboard addition.
- Current header/action components do not encode saved-template state, validation, or assignment eligibility.

### Missing states

- First blank template and first exercise.
- Incomplete draft versus valid reusable template.
- Duplicate name/version clarity.
- Unsaved changes on navigation/close.
- Save failure with retained work.
- Assignment failure after successful save.
- Removed/unavailable exercise source.
- Concurrent edit conflict.
- Archived template and duplicated template provenance.
- No clients / no suitable template / invalid assignment date.

### Mobile

At 390x844 there is no document overflow, but context selectors fill the first viewport and authoring is pushed far below. Mobile must support the accepted minimum operations, but device research should decide whether full high-throughput creation is phone-primary. Do not merely stack the current desktop cards.

### Accessibility

- Reorder must have keyboard and non-drag alternatives.
- Every icon action needs accessible naming and stable focus.
- Library selection should announce additions and duplicates.
- Validation must point to exact exercise/set fields.
- Nested sheets/dialogs should not trap or lose editor state.

### Backend readiness

This audit does not change backend. Current mixed persistence is prototype evidence, not a production contract. `trainer_builder_templates` JSON, `workout_templates` Program usage, local drafts, and local assignments require Stage 3-4 alignment before production integration (`docs/domain-model-v1.md:43-51`, `:129`; `docs/workout-template-builder-flow-v1.md:181-239`).

## Relationship to adjacent surfaces

| Surface | Correct relationship |
|---|---|
| Programs | Later orchestration of templates/assignments; not required to create a template. |
| Quick Assign | Select a saved template revision; if none suitable, enter Builder with client/return intent preserved. |
| Library | Shared searchable exercise source and detail; Builder adds exercises into current draft. |
| Athlete profile | Secondary contextual entry for Save and Assign; profile is not template owner. |
| Review | May suggest a future template/assignment adjustment; never silently edits historical assignment or mutable template. |

## Component reuse matrix

| Component | Treatment | Reason / adaptation |
|---|---|---|
| `ExerciseLibraryPanel` | preserve after adaptation | Strong browsing/search/cards; add builder selection state, rapid add, duplicates, keyboard flow. |
| `ExerciseDetailSheet` | preserve after adaptation | Useful technique/detail surface; ensure nested-sheet behavior and selected context. |
| `WorkoutExerciseCard` | extract/preserve editor primitives | Rich prescription and per-set controls are valuable; simplify hierarchy and separate compact/default detail states. |
| `WorkoutFormHeader` | concept only / adapt heavily | Existing save language does not represent template lifecycle and Save-and-Assign eligibility. |
| `WorkoutSupersetBlockCard` | preserve after adaptation | Valuable advanced block; must not dominate basic first-template flow. |
| `workout-builder-types.ts` | concept only pending domain mapping | Useful UI types, but weeks/days and persistence names are not canonical automatically. |
| Quick templates P/P/L/Full Body | preserve as optional starter evidence | Useful acceleration for some coaches; do not make them the default ontology. |
| Current page composition | do not reuse | Accepted as non-target; too many object/context responsibilities. |
| Local assignment payload | do not reuse as product contract | Not shared with client and can originate from unsaved state. |
| Template persistence helpers | technical spike only | Revisit after canonical revision/status/storage contract. |

## Future redesign brief

### Users

Independent online/hybrid strength coach with approximately 10-30 active one-to-one athletes.

### Jobs

- Create a reusable workout quickly.
- Duplicate and adapt an existing workout.
- Configure exercises and prescriptions accurately.
- Save incomplete work safely.
- Assign a valid saved template to an athlete without mutating the source.

### Main scenarios

1. Templates list -> blank template -> save.
2. Templates list -> duplicate -> edit -> save copy.
3. Athlete/Quick Assign -> no suitable template -> create -> save and assign -> return.
4. Existing template -> edit draft/new revision -> publish/save without changing past assignments.
5. Saved template -> assign -> adjust assignment snapshot before session start.

### Creation modes

- Blank template: required.
- Duplicate existing template: required.
- Optional starter/template category: useful, not required ontology.
- AI-generated template: later, with trainer review mandatory.

### Core objects

WorkoutTemplate, template revision/draft, ordered template exercises, prescriptions/overrides, WorkoutAssignment snapshot, Exercise identity.

### Constraints

- Program is not required.
- Saving does not assign.
- Assigning does not mutate the template.
- Existing assignments do not change when template changes.
- Structural assignment edits stop after session start.
- Backend remains paused in Stage 5; prototype state must still use canonical concepts.

### Required states

Blank, dirty, autosaved/local recovery, incomplete draft, valid saved template, saving, save failed, assign form, assignment failed after save, stale conflict, duplicate, archived, missing exercise, no clients, mobile compact editing.

### Expected outputs

- Saved reusable WorkoutTemplate revision.
- Optional independent WorkoutAssignment snapshot.
- Return receipt containing template id/revision, assignment id if created, origin, and next action.

### Usability criteria

- Coach can create a basic 5-exercise template without selecting client or Program.
- Coach can duplicate/reorder/edit with clear save state.
- Coach can distinguish draft, saved template, and athlete assignment at all times.
- Coach cannot assign unsaved invalid work.
- Failure never loses the editor state.
- Contextual Save and Assign returns to the correct athlete/queue position.

### Research questions

- Primary device and acceptable phone scope.
- Most common creation starting point: blank, duplicate, prior athlete workout, or personal library.
- Required prescription fields by training style.
- Frequency and importance of supersets/per-set overrides.
- Whether coaches name/folder templates or search by athlete/use case.
- How often assignment needs athlete-specific adjustment.

## Findings applied

P0-04, P0-05, P0-06, P1-08, P1-11, P2-08, and the accepted Builder decisions in `docs/workout-template-builder-flow-v1.md`.

## Decision candidates for Product Lead review

### DC-BUILD-01 - Templates workspace

- **Status:** accepted working direction, consistent with the accepted Stage 2 Builder entry.
- **Decision:** `Шаблоны` opens a saved-template list/workspace; creation/editing is a focused child state, even if the temporary route remains `/trainer/builder`.
- **Alternatives:** Open blank editor directly; retain current all-in-one page; use Programs as home.
- **Recommendation:** Templates workspace first.
- **Rationale:** Supports reuse, duplicate, status, and contextual assignment without requiring Program/client.
- **Affected routes/components:** `/trainer/builder`, TrainerShell nav, builder components.
- **Risk:** Requires more IA work before visual implementation.
- **Urgency:** Before builder redesign.

### DC-BUILD-02 - Component reuse boundary

- **Status:** accepted principle; exact reuse decisions require component-level design audit.
- **Decision:** Evaluate library/detail and prescription/set/superset primitives for reuse; do not preserve the current page composition as target UX.
- **Alternatives:** Rewrite all components; minimally rearrange current page.
- **Recommendation:** Reuse primitives after task-based component audit.
- **Rationale:** Preserves substantial working UI while removing incompatible IA.
- **Affected routes/components:** `components/trainer/*`, `/trainer/builder`.
- **Risk:** Existing components may carry hidden assumptions and need more extraction than expected.
- **Urgency:** Before builder redesign.

### DC-BUILD-03 - Mobile scope

- **Status:** proposed pending trainer device research.
- **Proposed decision:** Guarantee basic template review/edit/save/assign on phone; determine full high-throughput creation scope from trainer research.
- **Alternatives:** Full parity now; desktop/tablet only; read-only mobile.
- **Recommendation:** Basic capable mobile plus researched advanced scope.
- **Rationale:** Current evidence shows responsive rendering, not efficient mobile authoring.
- **Affected routes/components:** Future Builder layout and editor controls.
- **Risk:** Coaches may require phone-first full creation.
- **Urgency:** Before builder redesign.

### DC-BUILD-04 - Programs separation

- **Status:** accepted.
- **Decision:** Keep Program management outside the first template editor and assignment flow.
- **Alternatives:** Preserve Program selector in Builder; remove Program prototype later; make Program mandatory.
- **Recommendation:** Separate and hide Programs for first vertical MVP.
- **Rationale:** Accepted product/domain strategy excludes advanced Program Builder from the first slice.
- **Affected routes/components:** `/trainer/programs`, `/trainer/builder`, Program query parameters.
- **Risk:** Some existing prototype flows become temporarily undiscoverable.
- **Urgency:** Before builder redesign.
