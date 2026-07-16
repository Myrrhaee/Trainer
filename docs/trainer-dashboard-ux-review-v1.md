# Trainer Dashboard UX Review v1

Date: 2026-07-16  
Route: `/trainer/dashboard`  
Current implementation: `app/trainer/dashboard/page.tsx`, `components/trainer-os/home/*`

## Verdict

Product status: **core MVP**.  
UX readiness: **requires significant iteration**, with an accepted visual/conceptual foundation.

The dashboard is the strongest differentiating concept in the trainer cabinet. It already feels more like a living coaching workspace than a generic CRM. The premium hero, team-state language, Living Team Map, and client-centered cards should be preserved. The main issue is hierarchy: too many strong zones ask to be the coach's starting point, while their task states are local and partly duplicated.

## Current composition

Current order and behavior are defined in `components/trainer-os/home/trainer-home-page.tsx`:

1. Team HQ hero and team summary.
2. Team status and semantic filters.
3. Living Team Map with selected-client preview.
4. “Следующее решение” / action story.
5. Action queue.
6. Activity feed and secondary attention.
7. Activity, Quick Assign, and Workout Review drawers.

Data comes from `components/trainer-os/home/mock-data.ts`; action completion mutates local component state (`trainer-home-page.tsx:194-211`). A separate unused/adjacent operating board has its own types and mocks under `components/trainer-os/dashboard/*`.

## Dashboard question coverage

| Required question | Current answer | Gap |
|---|---|---|
| How is the team? | Hero summary, map distribution, status bar | Strong, but visually dominant. |
| Who needs attention? | Map, next-decision card, queue, activity, secondary panel | Repeated in too many places. |
| Why? | Issue/context on cards and drawers | Reason can change wording and disappears in profile. |
| How urgent? | Color, zone, order | No one priority model or textual accessible explanation. |
| What action? | Assign/review/open/message CTAs | Similar states map to different surfaces. |
| What happens next? | Some “and next” actions | No consistent resolution receipt or next-item rule. |

## Semantic zones

### Team-state zone

The hero and map successfully answer “what kind of day is this?” and create emotional connection to a coaching team. Preserve the visual language and `public/trainer/team-hq-hero.png`. Reduce its operational competition: team state should orient, while the next decision should own the primary CTA.

### Decision zone

The action story and queue are closest to the accepted dashboard job. They should become the authoritative rendering of AttentionItem, with one reason, one priority explanation, one primary action, and one next behavior.

### Activity zone

Team Activity is an accepted secondary dashboard layer for events, achievements, and changes in the team. It answers “what is happening in the team,” while the Attention queue answers “what must I do.” An activity event may highlight a client on the map and open context, but it does not use AttentionItem action/status semantics and cannot become a second lifecycle for unresolved work.

## Living Team Map

### Job to be done

The map is best understood as a rapid team-state overview and navigation surface: show distribution, reveal unusual changes, and let the coach enter a person. It should not become the sole authoritative task queue.

### Operational tool or visual hero?

Accepted verdict: **secondary operational overview and contextual navigation surface**. It is more valuable than decoration because node selection and activity highlighting connect team state to a person. The ordered queue remains the primary sequential work tool, and position alone is not reliable enough to represent urgency or determine order.

### Semantics

- Zone meaning needs persistent text, not only spatial grouping.
- Every node needs an accessible name, state, reason, and equivalent list entry.
- Color should reinforce, not define, status.
- Size should have one meaning or remain stable; it must not imply importance accidentally.
- Motion should communicate change, stop under reduced-motion settings, and avoid making calm clients look unstable.

### Scale

| Team size | Expected behavior |
|---:|---|
| 0 | New-trainer state with invite/add path; map is not shown as an empty decorative field. |
| 1-5 | Labels or selected preview can be generous; map helps learn semantics. |
| 10-20 | Clustering and filtering become important; selected node must remain identifiable. |
| 20-30 | Map summarizes distribution; ordered queue remains the efficient action surface. |

### Mobile

At 390x844 the dashboard has no document-level horizontal overflow, but the hero consumes most of the initial viewport and the map is not visible early. A mobile map should not be a compressed desktop canvas. It may become a small team-state summary with explicit state counts and a focused selected-client view; the queue must remain earlier and easier to reach.

### Accessibility

Required before pilot: keyboard node selection, non-color state labels, reduced-motion behavior, screen-reader summary, and a list equivalent with identical actions. These are P1 because the map currently contributes to operational meaning.

## Queue and client cards

Preserve the athlete-first cards and direct verbs. Consolidate action story and queue around one AttentionItem presentation model. A card should contain:

- athlete identity;
- reason generated from source event;
- priority reason and time;
- one primary action;
- optional secondary “open profile”;
- explicit post-action confirmation.

Avoid program/revenue/CRM metadata unless it directly changes today's decision.

## Action drawers

The wide drawers provide useful in-context work and preserve dashboard orientation. They are sufficient when the coach can decide with a concise summary. They are insufficient when a session has multiple exceptions, technique media, discomfort signals, or requires comparing detailed sets; those cases should open the full review page.

Both presentations must receive the same context envelope and return the same resolution result.

## Required states

| State | UX requirement |
|---|---|
| All calm | Say there is no unresolved work; show team pulse and optional exploration, not fake tasks. |
| New trainer, no clients | Explain the next setup action and offer invite/add; hide empty map/analytics. |
| Loading | Stable shell and semantic skeletons; do not seed data silently. |
| Partial data failure | Preserve available queue, label unavailable team/activity areas, offer retry. |
| 20-30 clients | Ordered/grouped queue, compact map distribution, filters that do not reset context. |
| Several simultaneous problems | One item per accepted generation rule, transparent priority reasons, avoid duplicate cards for the same source. |
| Action completed | Receipt with what changed, undo only if domain permits, `Следующий клиент`, and all-calm terminal state. |

## Findings applied

- P0-01, P0-03: queue and resolution models must converge.
- P1-01: hierarchy is visually diluted.
- P1-02: map semantics/accessibility need validation.
- P1-03: signal duplication creates inconsistent reasons.
- P1-11, P1-12: state and scale coverage is incomplete.
- P2-04, P2-05: semantic color and loading/empty behavior need consistency.

## Treatment summary

### Accepted foundation

- Premium Team HQ visual identity.
- Athlete-centered rather than account-centered language.
- Team Map concept and node-to-client interaction.
- Exception/action-oriented cards.

### Preserve

- Hero asset and restrained dark/lime language.
- Map component concept, status legend, activity-to-node highlighting.
- Quick action drawer pattern.
- Client avatar/initial, issue, goal, and recent-activity primitives.

### Improve

- Shorten orientation before the next decision.
- Make one queue authoritative.
- Carry source context to profile/action.
- Add explicit completion and next-item states.
- Add scale, empty, failure, mobile, keyboard, and reduced-motion behavior.

### Redesign

- Relationship among action story, queue, and secondary attention.
- Data/state contract across dashboard, Attention Center, and drawers.

### Remove from primary focus

- Any Team Activity treatment that behaves like a competing task inbox; preserve Activity itself as secondary team context.
- Standalone Attention Center as an equal entry point until validated.

### Open research question

Whether coaches understand and repeatedly use map position as team-state meaning after the novelty period.

## Decision candidates for Product Lead review

### DC-DASH-01 - Role of Living Team Map

- **Status:** accepted; final zone semantics remain proposed.
- **Decision:** Preserve the map as a secondary team-state overview and contextual navigation surface; the ordered queue remains authoritative for work.
- **Alternatives:** Make map primary; make it decorative only; hide it.
- **Recommendation:** Secondary operational overview.
- **Rationale:** It differentiates the product and supports recognition, but position/color alone cannot order work reliably.
- **Affected routes/components:** `/trainer/dashboard`, `living-team-map.tsx`, legend and selected preview.
- **Risk:** A secondary role may reduce the visual drama of the first screen.
- **Urgency:** Before dashboard redesign.

### DC-DASH-02 - Default dashboard hierarchy

- **Status:** accepted principle; exact layout remains subject to UX validation.
- **Decision:** The Attention queue is primary; Living Team Map and Team Activity are secondary layers with different non-queue jobs.
- **Candidate layout:** Team pulse -> next decision -> compact queue -> map/team exploration -> activity.
- **Alternatives:** Map first; activity first; dense Attention Center first.
- **Recommendation:** Accept proposed hierarchy, with exact layout validated in prototype.
- **Rationale:** It answers the daily action question without discarding the team concept.
- **Affected routes/components:** `components/trainer-os/home/*`.
- **Risk:** Existing hero/map balance will need careful adaptation.
- **Urgency:** Before dashboard redesign.

### DC-DASH-03 - High-volume queue route

- **Status:** standalone Attention is accepted as non-primary for first MVP; later dedicated high-volume view remains proposed.
- **Proposed decision:** Validate whether `/trainer/attention` is needed as an optional all-items view for 20-30 clients after dashboard stabilization.
- **Alternatives:** Remove route later; make it canonical now; merge into Clients.
- **Recommendation:** Preserve and hide pending pilot evidence.
- **Rationale:** Current evidence proves implementation, not user need.
- **Affected routes/components:** `/trainer/attention`, command palette.
- **Risk:** Dense-queue needs may be discovered late.
- **Urgency:** Before internal pilot.
