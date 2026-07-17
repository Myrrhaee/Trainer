# Trainer Core Flow Integration v1

## 1. Scope

Stage 12 integrates the accepted trainer surfaces into one frontend-only internal-pilot flow. It does not add backend writes, change API routes, alter PostgreSQL/Supabase schema, remove legacy UI, or redesign the accepted screens.

## 2. Before state

The audit found seven independently mutable demo sources: Dashboard queue/client state, static Profile data, static Review data, Review session store, Quick Assign templates/receipts, Builder template state, and Team Activity mocks. Feedback, assignments, and published templates did not propagate between surfaces. Dashboard used `attention-artem-smirnov-review`, while Review used `attention-artem-review`. Several returns depended on route fallbacks rather than a shared context contract.

## 3. Integration architecture

`app/trainer/layout.tsx` owns `TrainerDemoRuntimeProvider`, so client-side transitions under `/trainer/*` keep one state. UI surfaces use selectors for reads and typed commands for mutations. Existing components remain role-specific projections rather than reading runtime internals directly.

## 4. Demo runtime

The runtime holds `athletes`, `athleteProfiles`, `workoutTemplates`, `workoutAssignments`, `workoutSessions`, `attentionItems`, `trainerFeedback`, `manualResolutions`, `teamActivity`, queue selection, and non-remote pilot events. It is provider-neutral and intentionally does not reproduce Supabase row shapes or use localStorage.

## 5. Canonical IDs and relationships

Core pilot mapping:

| Athlete | AttentionItem | WorkoutSession |
| --- | --- | --- |
| `artem-smirnov` | `attention-artem-smirnov-review` | `artem-smirnov-2026-06-10` |
| `olga-sokolova` | `attention-olga-sokolova-discomfort` | `olga-sokolova-2026-06-16` |
| `egor-nikitin` | assignment attention from Dashboard seed | none until client starts an assignment |

Assignments reference athlete ID, source template ID, source revision, revision ID, scheduled date, and an independent exercise snapshot. No relationship is inferred from a name or date.

## 6. Commands

Implemented commands: `ResolveAttentionItemWithFeedback`, `ResolveAttentionItemWithAcknowledgement`, `ResolveAttentionItemManually`, `CreateWorkoutAssignment`, `SaveWorkoutTemplateDraft`, `PublishWorkoutTemplate`, `CreateWorkoutTemplateRevision`, `ArchiveWorkoutTemplatePrototype`, and `CreateFollowUpFeedback`. Each checks actor and entity context, returns a typed receipt/error, leaves state unchanged on failure, and handles important retries idempotently.

## 7. Selectors/read models

Implemented selectors: `getTrainerDashboardView`, `getTrainerAttentionQueue`, `getAthleteProfileView`, `getWorkoutReviewDetails`, `getQuickAssignView`, `getWorkoutTemplateWorkspace`, and `getWorkoutTemplateEditorView`. Unknown exact IDs return safe not-found states. The selectors reuse the accepted Dashboard, Profile, Review, Quick Assign, and Builder view-model types.

## 8. Return context

`TrainerFlowContext` carries only safe IDs, source, and an optional internal `/trainer/*` return path. `safeTrainerReturnPath` rejects external and protocol-relative paths. Comments and feedback never enter URLs; query markers identify context only, while facts are restored by ID from runtime.

## 9. Review-to-assignment flow

Dashboard selects Artem's canonical review item, Review saves feedback, the command resolves that item, and Profile shows the feedback in its existing feed. Quick Assign creates a scheduled snapshot from a published template. Profile Workouts shows the assignment, and returning through TrainerShell reveals the next active queue item.

## 10. No-template-to-builder flow

Alexandra has no assignable pilot template initially. Quick Assign opens Builder with her ID and return context. Builder saves/publishes a template through runtime; `Save and Assign` opens Quick Assign with the published revision preselected. Quick Assign, not Builder, creates the assignment snapshot.

## 11. Calm athlete flow

Maria can receive an assignment from Profile without creating an AttentionItem or artificial reason. The scheduled assignment appears in her existing Training tab and changes the Profile read model through shared facts.

## 12. Discomfort flow

Olga's exact original text remains on the Review signal, original-comment block, Profile feed, and Training comment context after resolution. The runtime stores it separately from trainer feedback. No diagnosis or AI interpretation is created.

## 13. Manual resolution flow

Manual closure requires a non-empty reason and creates `RuntimeManualResolution`, not `TrainerFeedback`. The AttentionItem resolves only after command success, and Profile exposes an audit-friendly local resolution event.

## 14. Queue continuity

The runtime stores the selected item. Successful feedback, manual resolution, or needs-assignment completion removes the resolved item from the active selector and selects the next active item in deterministic runtime order. Direct URLs do not require queue state. Full reload intentionally resets the pilot.

## 15. Assignment integration

`CreateWorkoutAssignment` creates a stable ID, source revision reference, athlete reference, scheduled status/date, notes, overrides, and exercise snapshot. It never mutates the template and never creates a WorkoutSession. A needs-assignment item resolves only after successful creation.

## 16. Feedback integration

Feedback is linked to trainer, athlete, WorkoutSession, and AttentionItem. Successful detailed feedback or acknowledgement resolves the active item. First feedback is idempotent; follow-up is a separate record. Profile displays persistent-in-runtime feedback in the existing feed.

## 17. Template integration

Drafts appear in Templates workspace but remain unavailable for assignment. Published revisions become assignable and read-only; edits create draft revisions. Archive preserves history and removes assignability. Assignment consumes a snapshot, not mutable template state.

## 18. Team Activity integration

Successful feedback and assignment prepend secondary Team Activity events. Template and queue audit events stay in the hidden pilot log. Team Activity does not create or own AttentionItems.

## 19. Error/idempotency behavior

Commands reject unknown athlete/session/template/item, stale item context, paused athlete, archived/draft assignment source, invalid feedback/reason, and unauthorized demo actor. Repeated resolution, assignment ID, and publication produce safe receipts or typed errors. UI keeps drafts on command failure and does not show a success receipt or close the item.

## 20. Mobile behavior

The `390x844` Playwright path covers Dashboard, Profile, Review, Quick Assign, Builder, Quick Assign, and Dashboard. Measured document overflow is zero. Sheets remain viewport-bound, primary CTA stays visible above bottom navigation, and Builder core edit/assign transitions work without desktop-only drag interactions.

## 21. Accessibility

Core actions are reachable by role/name, queue items are buttons, templates are listbox options, errors use alerts, confirmations use live status regions, and dialogs/sheets retain Radix semantics and focus handling. Existing focus-visible and reduced-motion behavior remains. Automated flow found no keyboard trap; a real assistive-technology session remains required before beta.

## 22. Files changed

- Runtime provider/commands/selectors/context/seed: `components/trainer-os/demo-runtime/*`, `app/trainer/layout.tsx`.
- Integration adapters: Dashboard, Profile, Review, Quick Assign, Builder files under `components/trainer-os/*`.
- Minimal route adapter: `app/trainer/review/[workoutId]/page.tsx`.
- Tests: `playwright.config.ts`, `tests/e2e/trainer-core-flow.spec.ts`, package test dependency/script.
- Documentation: this file and `docs/trainer-internal-pilot-v1.md`.

No backend, API, auth, Supabase, PostgreSQL, or migration file changed.

## 23. Known limitations

- Runtime resets on full reload and is not a production repository.
- Existing Review `sessionStorage` draft support remains as a surface-level draft cache; canonical facts come from runtime.
- Dates and seed facts are deterministic demo data, not a clock-backed domain service.
- Pilot instrumentation is in-memory/dev-console only.
- Existing Recharts prerender warnings remain unrelated.
- Playwright uses built `next start`; the repository's `next dev` showed a parent-directory Tailwind resolution issue during the first test attempt.

## 24. Acceptance criteria

Accepted for Stage 12: canonical pilot IDs are shared; feedback, assignment, and published template propagate; no-template Builder return works; resolved items leave the active queue; next item is selected; unknown IDs do not leak other records; desktop/mobile E2E paths pass; visual structure is preserved; no remote writes occur; lint and build pass with only the pre-existing Recharts warnings.
