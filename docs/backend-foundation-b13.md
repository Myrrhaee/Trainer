# Backend Foundation B13: Canonical Pilot UI Integration

- Date: 2026-08-04
- Status: **local implementation complete; external pilot still deferred**
- Scope: connect the accepted trainer-athlete workflow UI to the canonical PostgreSQL backend without redesigning the preserved demo product

## Product Boundary

Outside explicit demo mode, the pilot routes now show only data returned by authenticated canonical APIs and repositories. Missing profile domains are shown as unavailable states instead of being filled with another athlete's demo data. Explicit demo mode continues to use the existing visual prototype and fixtures.

## Connected Routes

| Route | Canonical behavior |
| --- | --- |
| `/onboarding` | Captures the authenticated account display name before trainer access request or athlete invitation acceptance. |
| `/trainer/dashboard` | Loads active athletes, open workout reviews and published templates from canonical APIs. |
| `/trainer/clients` | Loads the trainer's active athlete relations and supports invitation, profile navigation and quick assignment. |
| `/trainer/clients/[clientId]` | Resolves only an athlete related to the current trainer and exposes the current review or assignment action. |
| `/trainer/builder` | Uses the canonical template lifecycle and assignment commands implemented in B6. |
| `/client/me` | Shows athlete-owned assignments and completed workout results. |
| `/client/workouts` | Starts or resumes a session, persists set facts and completes the workout through B7 commands. |
| `/trainer/attention` | Shows the canonical open review queue. |
| `/trainer/review/[workoutId]` | Reads completed session facts and persists immutable trainer feedback. |

## Identity Presentation

`app.users.display_name` is now editable through the actor-scoped `/api/account/profile` endpoint. The trainer shell reads that profile outside demo mode, so the navigation header no longer falls back to the named demo trainer. Profile updates:

- require an authenticated canonical session;
- require a same-origin mutation;
- normalize whitespace and accept 2-120 characters;
- update only the current actor's row under RLS;
- append `account.profile.updated` to the audit log.

The local pilot provisioner sets synthetic participant names through this public API rather than mutating PostgreSQL directly.

## End-to-End Evidence

The following browser workflow was completed locally on 2026-08-04 against the persistent PostgreSQL 16 container:

1. `Тестовый тренер` opened the canonical roster and selected `Анна Пилот`.
2. The trainer assigned a saved published template with a trainer note.
3. Anna opened the assignment, started the workout, recorded 8 repetitions at RPE 7 with a comment and completed the session.
4. The trainer dashboard displayed one open review and linked to the exact completed session.
5. The trainer submitted `B13 пройден: результат вижу, техника и темп стабильны.`
6. Anna reopened the result and saw the persisted trainer feedback.

The API rehearsal also completed independently with one trainer, two athletes, one assignment-completion-feedback cycle and zero open reviews after feedback.

## Demo Isolation

`TrainerShell` now removes fixture notifications, fixture client search results and the named demo account outside demo mode. Existing demo routes and their visual design remain available when demo mode is explicitly enabled; no legacy route or fixture was deleted in B13.

## Deliberately Deferred

- Goals, anthropometry, questionnaire answers, progress analytics and athlete photos do not yet have a canonical persistence contract.
- The richer demo athlete profile remains a visual reference, not a PostgreSQL-backed screen.
- Messages, payments, achievements, reputation and automation remain outside the closed-alpha core loop.
- Google and Telegram login, live email delivery, public hosting and notification worker scheduling remain external deployment work.
- B13 does not redesign the trainer or client cabinet and does not remove legacy routes.

## Next Gate

B14 should turn the proven browser path into a repeatable regression suite, verify desktop and mobile states from fresh accounts, and record remaining pilot-blocking UX defects. Public deployment should start only after the founder approves the local workflow and selects hosting and provider ownership.
