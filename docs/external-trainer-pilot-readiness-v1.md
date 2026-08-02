# External Trainer Pilot Readiness v1

## 1. Scope

The external trainer pilot release candidate freezes the accepted trainer/client frontend vertical slice for a moderated formative session. Changes since the Stage 14 baseline are limited to workflow continuity, local browser persistence, mobile and sticky-navigation stabilization, deterministic demo fixtures, moderator-only controls, safe recovery, tests, and research evidence. No new product area or backend capability is included.

## 2. Frozen Product Version

Branch: `release/external-trainer-pilot-v1`. Build label: `trainer-core-pilot-v1`. Release candidate: `external-trainer-pilot-v1-rc1`. The deployed environment can expose `VERCEL_GIT_COMMIT_SHA`; local production builds show `local` without reading Git or local paths at runtime. The final commit and annotated tag are recorded after release-candidate acceptance.

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

Reset is available only when a valid research fixture is active. Every reset or fixture switch requires explicit moderator confirmation, including before domain commands mark the fixture dirty, so unsaved screen-local Builder or Quick Assign drafts cannot be discarded silently. Reset recreates and persists the selected fixture, returns to its primary entry, clears all `workout-review:*` sessionStorage drafts, clears the Review module store, and increments a render revision to remove Quick Assign, Builder, dialog, set-input, and route-local state. It does not perform backend writes.

## 7. Direct Entry Points

Moderator tools provide named entries for Trainer Dashboard, Athlete Profile, Workout Review when applicable, Quick Assign, Builder, Client Home, and Client Workout. Entries append `research=1` and the stable fixture ID, preserve a stable actor ID, and never place names, comments, health data, or secrets in the URL. Quick Assign uses a research-only query flag on the existing Athlete Profile route rather than a new route.

## 8. Known Limitations

- Demo domain state persists in localStorage for continuity in the same browser profile. It is not durable, synchronized, encrypted application storage and can be lost when browser data is cleared.
- An active client session and saved set progress resume after a reload in the same browser profile. Multi-device and concurrent-session continuity are not supported.
- Builder and Review drafts use sessionStorage and remain browser-tab/session-local.
- Runtime naming retains `TrainerDemo*` compatibility names.
- Local build metadata cannot know the future commit hash and displays `local` unless the deployment supplies it.
- There is no backend persistence, production auth, notification delivery, concurrency, multi-device continuity, or audit backend.
- Seeded historical Review sessions are compatibility facts, not canonical repository rows.

## 9. Error Recovery

Unknown fixture blocks product content and links to the starting fixture. Unknown actor, athlete, session, assignment, and template never substitute another entity. Invalid or incompatible persisted demo snapshots are discarded before the requested fixture is reconstructed. Trainer error pages return to Dashboard or the athlete list. Client workout error states link to Home and current assignments. Closed items remain readable but cannot create duplicate initial feedback. Command errors preserve the current facts and expose retry-safe messages.

## 10. Build Metadata

The collapsed moderator badge discloses demo/local behavior without covering participant content. Expanded tools show build label, Stage, commit marker, selected fixture, description, role views, direct entries, and reset. No metadata is rendered without research mode. It contains no environment values, secrets, emails, or local paths.

## 11. Clean-Start QA

A production build was started after stopping the prior server. All six fixtures were opened from direct URLs without HMR history, reset, and verified again against the same athlete and facts. Reset was also tested after a domain mutation and with a stale Review draft. A second fixture could then run independently. Actor switching retained fixture context. Refresh during an active client session resumed the same saved session and set progress. Invalid persisted state was discarded safely. The full client-to-trainer-to-client loop passed from the clean fixture.

## 12. Desktop QA

At `1440×1000`, Dashboard, queue, map/list alternative, Profile, Review, Quick Assign, Builder entry, client execution, completion dialog, feedback, moderator tools, and recovery states were operable. No wrong-athlete data or console error was observed. Quick Assign correctly makes the rest of the page inaccessible while its modal Sheet is open; moderator tools become available again after closing it.

## 13. Mobile QA

At `390×844`, Client Home and moderator badge/tools had zero measured horizontal overflow. The Stage 13 mobile full loop remains covered by regression tests. Bottom navigation, completion CTA, set controls, and feedback remain reachable. Physical virtual-keyboard occlusion still requires device testing before a session that uses mobile input.

## 14. Accessibility QA

Automated checks confirm semantic links/buttons, form labels, non-color status text, safe error headings, dialog naming, focus-managed Radix primitives, and map/list non-exclusive representation. Manual checklist: VoiceOver/NVDA quick pass; complete Tab/Shift+Tab order; dialog trap/restoration; error and validation announcements; reduced motion; 200% zoom; text resizing; mobile virtual keyboard; touch target sampling. Automation is not a screen-reader audit.

## 15. Security And Privacy Constraints

Research mode is frontend/demo-only and does not change auth. Fixture and actor markers use stable synthetic IDs and no PII. Tests assert no remote writes in the integrated loop. Participants must not enter real names, contacts, credentials, payment information, health/discomfort details, or other personal data. Session cleanup resets fixtures and follows consent/recording policy.

## 16. Research Risks

P0: none found in clean frontend acceptance. P1: backend persistence, authorization/RLS, server transactions, durable idempotency, audit, and delivery remain beta blockers; browser-local persistence is pilot continuity only. P2: physical mobile keyboard, complete screen-reader pass, facilitator visibility of moderator controls while a modal is open, and real-trainer comprehension remain unverified. P3: compatibility naming and the `NO_COLOR`/`FORCE_COLOR` process warning.

## 17. Go/No-Go Criteria

Go requires: no P0; six clean-start fixtures; safe actor/entity isolation; reproducible reset; complete Review/Assign/Builder/client loop; no mobile overflow; recovery exits; passing production build and Playwright; complete guide/templates; no real participant data; and no need for participants to edit technical URLs. Immediate no-go triggers: wrong-athlete leakage, broken reset, runtime crash, failed Review/Assign/Builder, external write, lost discomfort text, unstable build, or no route back to the flow.

## 18. Acceptance Results

Current verdict: **GO for a moderated external formative pilot, not beta**. Release-candidate acceptance: 34/34 Playwright tests passed across client/trainer integration, external-pilot readiness, and trainer core-flow suites. Coverage includes all six direct launches, explicit fixture switching over persisted state, reset and repeat verification, persisted active-session recovery, invalid snapshot recovery, dirty-state confirmation and Review draft clearing, actor/entity isolation, a clean end-to-end loop, research-only metadata, mobile overflow, console, no-write checks, Builder draft recovery, and trainer workflow regression. Lint, TypeScript, and the production build pass. Backend/API/Supabase/PostgreSQL/migrations/auth remain unchanged.
