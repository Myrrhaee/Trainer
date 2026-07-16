# Trainer Cabinet Open Decisions

Date: 2026-07-16  
Status: finalized Stage 5 working decisions and remaining validation questions.

This file does not reopen accepted Stage 2-4 decisions. Resolved items below are working product decisions recorded in `docs/decision-log.md`; remaining items require product, trainer-research, or UX-validation evidence.

## Resolved working decisions

| ID | Area | Accepted working decision | Consequence |
|---|---|---|---|
| R-01 | Gamification | Titles, ranks, achievements, and reputation remain a secondary identity and motivation layer. Compact title/rank may appear in Header and details open on click. | Gamification does not compete with current state, attention reason, primary action, or progress and does not block the core workflow. |
| R-02 | Finance | First-MVP profile scope is access status, optional access expiration, access/payment issue, and future ability to manage or extend access. Recommended tab label is `Доступ и оплата`. | Revenue analytics, sales CRM, advanced payment history, and financial reports stay outside the core profile. |
| R-03 | Team Activity | “Жизнь клуба” remains a secondary dashboard layer for team events, achievements, and changes. | Team Activity answers “what is happening”; Attention answers “what must I do.” Activity is not a second queue and does not use AttentionItem lifecycle semantics. |
| R-04 | Experimental discovery | Automation, Insights, Reports, Sales, standalone Attention Center, and standalone Messages are hidden from primary MVP navigation while routes, UI, and assets are preserved. | Development/demo access may remain; removal requires a separate decision. |
| R-05 | Communication | First-MVP communication is contextual through Athlete Profile, Workout Review, AttentionItem, and relevant athlete actions. Standalone Messages remains experimental. | Restoring a global inbox to core navigation requires trainer evidence. |
| R-06 | Client/trainer relationship | Client and trainer use the same canonical entities, WorkoutSession, history, progress facts, and TrainerFeedback with aligned visual language. | Interfaces remain role-specific: client optimizes execution and self-understanding; trainer adds context, decisions, actions, and workload management. |
| R-07 | Living Team Map | The map is preserved as a secondary operational overview and client-navigation surface; the Attention queue is the primary sequential work surface. | The map does not duplicate the complete queue; final zone semantics remain open for validation. |
| R-08 | MVP navigation | Primary trainer sidebar is `Главная`, `Клиенты`, `Шаблоны`, `Библиотека`, `Настройки`; review, Quick Assign, athlete actions, communication, and detailed AttentionItem are contextual. | Advanced Program Builder is not a separate primary section before its flow is accepted. |
| R-09 | UX sequence | Work order is shell/navigation, dashboard, athlete profile, workout review, Quick Assign, WorkoutTemplate Builder, cross-screen integration, internal trainer pilot. | Existing workflow contracts from previous stages are inputs, not a separate preliminary UX stage. |

## Remaining product and research decisions

| ID | Question | Why it matters | Temporary default | Evidence needed | Urgency |
|---|---|---|---|---|---|
| O-01 | What are the final Living Team Map zones and their semantics? | Position, color, size, and motion must be understandable, scalable, and accessible. | Map remains secondary; position is never the only signal. | Comprehension, accessibility, and 5/20/30-client prototype tests. | before dashboard redesign |
| O-02 | What is the trainer's primary device for daily work and template creation? | Dashboard density and full Builder scope depend on device behavior. | Daily core actions remain responsive; Builder is desktop/tablet-first working hypothesis with core mobile editing. | 5-8 target-coach interviews and task diary. | before builder redesign |
| O-03 | How many AttentionItems does a coach process daily? | Determines queue density, batching, and whether a later dedicated all-items view is needed. | Dashboard queue is authoritative; standalone Attention remains hidden. | Representative daily counts and 10-30-client scenario testing. | before dashboard redesign |
| O-04 | Does a dedicated Calendar return to MVP navigation? | Calendar may be a recurring coaching tool or an adjacent prototype. | Keep route/UI preserved outside the five-section sidebar. | Trainer tool inventory and workflow interviews. | before internal pilot |
| O-05 | What is the final Athlete Header composition? | Identity, state, reason, action, and gamification must coexist without restoring CRM density. | Identity + operational context always; expanded biography/KPIs/rank on Overview; compact Header elsewhere. | Task-based information ranking and mobile/desktop prototype test. | before profile redesign |
| O-06 | Which concrete actions are performed from Athlete Profile? | Determines persistent CTA, default tab, and contextual communication placement. | Source AttentionItem selects the relevant action; neutral entry has no forced work CTA. | Observation of real profile-to-action workflows. | before profile redesign |
| O-07 | Is the review drawer sufficient for quick review? | Determines speed, detail threshold, and drawer-to-page promotion behavior. | Drawer for quick acknowledgement; full page for detailed review; one accepted contract. | Task time, errors, promotion rate, and complex-session tests. | before review redesign |
| O-08 | Is full mobile Builder required? | Full parity may be costly, while phone-only limitation may block real coaches. | Core mobile review/edit/save/assign; advanced high-throughput authoring scope remains unaccepted. | Device research and mobile authoring usability tests. | before builder redesign |
| O-09 | How do trainers actually create templates? | Blank, duplicate, prior workout, and personal-library frequencies determine the Templates workspace. | Blank and duplicate existing remain accepted first-MVP modes. | Recent-workout walkthroughs and creation-mode frequency. | before builder redesign |

## UX validation backlog

- Validate Living Team Map zone comprehension, keyboard behavior, reduced motion, non-color semantics, and scalability.
- Validate dashboard queue throughput and post-action `Следующий клиент` behavior.
- Validate Athlete Header information hierarchy and source-Attention context.
- Validate Profile actions and contextual communication entry points.
- Validate quick-review drawer sufficiency and lossless promotion to the full page.
- Validate Builder device scope and real template-creation modes.
- Validate whether Calendar or standalone Messages earns a future return to core navigation.

## Decision candidates for Product Lead review

### DC-OPEN-01 - Final Living Team Map semantics

- **Status:** proposed.
- **Proposed decision:** Define a stable, accessible set of map zones and visual signals after usability validation.
- **Alternatives:** Use non-spatial team grouping; keep only a decorative map; use the queue as the only state visualization.
- **Recommendation:** Preserve the accepted secondary-map role and validate semantics before implementation.
- **Rationale:** The map role is accepted, but its exact visual grammar is not.
- **Affected routes/components:** `/trainer/dashboard`, Living Team Map, legend, selected-client preview.
- **Risk:** Premature semantics can misprioritize athletes.
- **Urgency:** Before dashboard redesign.

### DC-OPEN-02 - Final Athlete Header content

- **Status:** proposed.
- **Proposed decision:** Finalize always-visible identity/state/reason/action fields and Overview-only biography/KPI/gamification fields through task testing.
- **Alternatives:** Keep current large composition; compact all tabs; move operational context below tabs.
- **Recommendation:** Test the accepted direction before final visual composition.
- **Rationale:** The profile must remain human while supporting immediate trainer decisions.
- **Affected routes/components:** Athlete Profile headers and tabs.
- **Risk:** Too much context recreates CRM density; too little loses action clarity.
- **Urgency:** Before profile redesign.

### DC-OPEN-03 - Calendar navigation return

- **Status:** proposed.
- **Proposed decision:** Return Calendar to primary MVP navigation only if trainer research shows a standalone recurring job not covered by dashboard/profile.
- **Alternatives:** Keep contextual; keep hidden; add as sixth primary section now.
- **Recommendation:** Preserve route/UI and defer navigation return.
- **Rationale:** Existing implementation is evidence of a concept, not proof of core frequency.
- **Affected routes/components:** `/trainer/calendar`, TrainerShell navigation and command palette.
- **Risk:** A real calendar-first workflow may be discovered late.
- **Urgency:** Before internal pilot.

### DC-OPEN-04 - Standalone Messages return

- **Status:** proposed.
- **Proposed decision:** Return standalone Messages to core navigation only if research shows coaches use a global inbox as an independent daily workspace.
- **Alternatives:** Keep contextual permanently; restore now; use an external messenger only.
- **Recommendation:** Keep the accepted contextual default through the internal pilot.
- **Rationale:** Communication is core, but the standalone inbox job is unproven.
- **Affected routes/components:** `/trainer/messages`, Athlete Profile, Workout Review, Attention actions.
- **Risk:** Contextual entry may be inefficient for inbox-oriented coaches.
- **Urgency:** Before internal pilot.
