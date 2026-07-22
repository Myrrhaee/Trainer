# External Trainer Pilot Readiness v1

## 1. Scope

Stage 14 freezes the accepted Stage 13 frontend vertical slice and prepares it for a moderated formative session. Changes are limited to deterministic demo fixtures, moderator-only reset/disclosure, build metadata, direct entries, safe recovery, tests, and research documents. No new product area or major capability is included.

## 2. Frozen Product Version

Branch: `release/external-trainer-pilot-v1`. Build label: `trainer-core-pilot-v1`. Stage: `Stage 14`. The deployed environment can expose `VERCEL_GIT_COMMIT_SHA`; local production builds show `local` without reading Git or local paths at runtime. The functional product baseline is Stage 13 commit `5a9aa2940bab56f398dba5ddd184eac67e888f8d`.

## 3. Demo Architecture

One root `ProductDemoRuntimeProvider` still owns the shared trainer/client facts. Research state is separate from the domain state: fixture ID, dirty flag, reset revision, disclosure, and build metadata. `DemoResearchBoundary` activates only for `research=1`, restores missing research markers during client-side navigation, blocks unknown fixtures, and remounts route content after reset so local component state cannot leak between fixtures.

## 4. Fixtures

| ID | Stable athlete | Initial fact | Primary entry |
|---|---|---|---|
| `review-required` | `artem-smirnov` | one active Review item, no feedback | `/trainer/dashboard` |
| `discomfort` | `olga-sokolova` | one safety-priority item with original text | `/trainer/dashboard` |
| `needs-assignment` | `egor-nikitin` | no next assignment | `/trainer/clients/egor-nikitin` |
| `no-suitable-template` | `alexandra-konstantinova` | no available published template for athlete | profile Quick Assign |
| `calm-team` | `maria-volkova` | no active AttentionItem | `/trainer/dashboard?demo=calm` |
| `client-execution` | `maria-volkova` | stable WorkoutAssignment, no session | `/client/me?actor=maria-volkova` |

Fixtures clone the same accepted seed and then select or create only the facts required by the scenario. They do not create separate trainer/client copies.

## 5. Actor Model

Client actor remains a stable non-PII query ID. Unknown actors and cross-athlete entity IDs fail closed. Research role buttons route only to the fixture athlete and clear transient UI state. The marker is not production authentication and is disclosed to the moderator. Production auth code is unchanged.

## 6. Reset Behavior

Reset is available only when a valid research fixture is active. Every reset or fixture switch requires explicit moderator confirmation, including before domain commands mark the fixture dirty, so unsaved screen-local Builder or Quick Assign drafts cannot be discarded silently. Reset recreates the selected fixture, returns to its primary entry, clears all `workout-review:*` sessionStorage drafts, clears the Review module store, and increments a render revision to remove Quick Assign, Builder, dialog, set-input, and route-local state. It does not use localStorage or backend writes.

## 7. Direct Entry Points

Moderator tools provide named entries for Trainer Dashboard, Athlete Profile, Workout Review when applicable, Quick Assign, Builder, Client Home, and Client Workout. Entries append `research=1` and the stable fixture ID, preserve a stable actor ID, and never place names, comments, health data, or secrets in the URL. Quick Assign uses a research-only query flag on the existing Athlete Profile route rather than a new route.

## 8. Known Limitations

- Full reload restores the fixture baseline; it does not preserve in-progress commands.
- Reloading an active client session leaves a stale session URL, which now fails closed and offers Home/Assignments recovery.
- Runtime naming retains `TrainerDemo*` compatibility names.
- Local build metadata cannot know the future commit hash and displays `local` unless the deployment supplies it.
- There is no durable storage, production auth, notification delivery, concurrency, multi-device continuity, or audit backend.
- Seeded historical Review sessions are compatibility facts, not canonical repository rows.

## 9. Error Recovery

Unknown fixture blocks product content and links to the starting fixture. Unknown actor, athlete, session, assignment, and template never substitute another entity. Trainer error pages return to Dashboard or the athlete list. Client workout error states explain reload/stale-ID behavior and link to Home and current assignments. Closed items remain readable but cannot create duplicate initial feedback. Command errors preserve the current facts and expose retry-safe messages.

## 10. Build Metadata

The collapsed moderator badge discloses demo/local behavior without covering participant content. Expanded tools show build label, Stage, commit marker, selected fixture, description, role views, direct entries, and reset. No metadata is rendered without research mode. It contains no environment values, secrets, emails, or local paths.

## 11. Clean-Start QA

A production build was started after stopping the prior server. All six fixtures were opened from direct URLs without HMR history, reset, and verified again against the same athlete and facts. Reset was also tested after a domain mutation and with a stale Review draft. A second fixture could then run independently. Actor switching retained fixture context. Refresh during an active client session produced the documented safe recovery state. The full client-to-trainer-to-client loop passed from the clean fixture.

## 12. Desktop QA

At `1440×1000`, Dashboard, queue, map/list alternative, Profile, Review, Quick Assign, Builder entry, client execution, completion dialog, feedback, moderator tools, and recovery states were operable. No wrong-athlete data or console error was observed. Quick Assign correctly makes the rest of the page inaccessible while its modal Sheet is open; moderator tools become available again after closing it.

## 13. Mobile QA

At `390×844`, Client Home and moderator badge/tools had zero measured horizontal overflow. The Stage 13 mobile full loop remains covered by regression tests. Bottom navigation, completion CTA, set controls, and feedback remain reachable. Physical virtual-keyboard occlusion still requires device testing before a session that uses mobile input.

## 14. Accessibility QA

Automated checks confirm semantic links/buttons, form labels, non-color status text, safe error headings, dialog naming, focus-managed Radix primitives, and map/list non-exclusive representation. Manual checklist: VoiceOver/NVDA quick pass; complete Tab/Shift+Tab order; dialog trap/restoration; error and validation announcements; reduced motion; 200% zoom; text resizing; mobile virtual keyboard; touch target sampling. Automation is not a screen-reader audit.

## 15. Security And Privacy Constraints

Research mode is frontend/demo-only and does not change auth. Fixture and actor markers use stable synthetic IDs and no PII. Tests assert no remote writes in the integrated loop. Participants must not enter real names, contacts, credentials, payment information, health/discomfort details, or other personal data. Session cleanup resets fixtures and follows consent/recording policy.

## 16. Research Risks

P0: none found in clean frontend acceptance. P1: persistence, authorization/RLS, server transactions, durable idempotency, audit, and delivery remain beta blockers; reload intentionally loses progress. P2: physical mobile keyboard, complete screen-reader pass, facilitator visibility of moderator controls while a modal is open, and real-trainer comprehension remain unverified. P3: compatibility naming and the `NO_COLOR`/`FORCE_COLOR` process warning.

## 17. Go/No-Go Criteria

Go requires: no P0; six clean-start fixtures; safe actor/entity isolation; reproducible reset; complete Review/Assign/Builder/client loop; no mobile overflow; recovery exits; passing production build and Playwright; complete guide/templates; no real participant data; and no need for participants to edit technical URLs. Immediate no-go triggers: wrong-athlete leakage, broken reset, runtime crash, failed Review/Assign/Builder, external write, lost discomfort text, unstable build, or no route back to the flow.

## 18. Acceptance Results

Current verdict: **GO for a moderated external formative pilot, not beta**. Final acceptance: 26/26 Playwright tests passed. This includes all six direct launches with reset and repeat verification, dirty-state confirmation and Review draft clearing, actor switch, invalid IDs, refresh recovery, a clean full loop, a second independent scenario, research-only metadata, mobile overflow, console, no-write checks, and the complete Stage 12–13 regression suite. Lint, TypeScript, and the production build pass. Backend/API/Supabase/PostgreSQL/migrations/auth remain unchanged.
