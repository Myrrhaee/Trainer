# External Trainer Pilot Environment Checklist v1

## Build

- [ ] Branch is `release/external-trainer-pilot-v1`.
- [ ] Commit hash recorded: `________________`.
- [ ] Build label is `trainer-core-pilot-v1`; Stage is `Stage 14`.
- [ ] `npm run lint`, production build, and full Playwright suite pass.
- [ ] No uncommitted or unexpected files are present.
- [ ] No remote backend, API, Supabase, or PostgreSQL writes are enabled.

## Scenario

- [ ] Fixture ID recorded: `________________`.
- [ ] Actor ID recorded: `________________`.
- [ ] Direct route recorded: `________________`.
- [ ] Moderator badge shows the expected fixture.
- [ ] Reset was tested and returns to the fixture primary entry.
- [ ] Backup route is available through moderator tools.
- [ ] Review draft/sessionStorage from the previous session is cleared.

## Device

- [ ] Browser and version recorded: `________________`.
- [ ] Viewport/device recorded: `________________`.
- [ ] Network/power conditions are stable.
- [ ] Screen sharing and recording were tested.
- [ ] Audio input/output were tested.
- [ ] Notes and backup note-taking method are ready.

## Consent And Privacy

- [ ] Participant consent covers recording and note-taking.
- [ ] Participant ID is pseudonymous.
- [ ] No real client or participant personal data will be entered into the demo.
- [ ] No credentials, contact details, health data, or payment data will be entered.
- [ ] Moderator has explained that data and writes are demonstrational/local.

## Accessibility Manual Pass

- [ ] VoiceOver or NVDA quick pass.
- [ ] Keyboard-only focus order and reverse order.
- [ ] Dialog focus trap and focus restoration.
- [ ] Error and validation announcement.
- [ ] Status is understandable without color.
- [ ] Team Map is not the exclusive representation of information.
- [ ] Reduced-motion behavior.
- [ ] Zoom at 200% and text resizing.
- [ ] Mobile virtual keyboard does not hide set/comment/discomfort inputs or CTA.
- [ ] Touch targets sampled on the session device.

## Session Cleanup

- [ ] Recording stopped and stored according to consent.
- [ ] Observation sheet contains no unnecessary personal data.
- [ ] Fixture reset completed.
- [ ] Browser session closed or returned to the neutral start state.
- [ ] Any accidental personal data was removed according to the research protocol.
- [ ] Critical incident and follow-up owner recorded.

## Known Limitations Acknowledged

- [ ] Full reload restores the fixture rather than durable in-progress state.
- [ ] Actor switching is a research mechanism, not production authorization.
- [ ] Receipts and feedback are local frontend simulation.
- [ ] AI drafts are prototypes and not a quality or safety claim.
- [ ] Backend, notifications, concurrency, and multi-device continuity are not under test.
