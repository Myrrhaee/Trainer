# External Trainer Pilot Release Candidate v1

## Release Identity

- Branch: `release/external-trainer-pilot-v1`
- Candidate: `external-trainer-pilot-v1-rc1`
- Commit: recorded after final acceptance
- Build label shown in research tools: `trainer-core-pilot-v1`
- Intended use: moderated external formative research with independent trainers
- Release boundary: frontend demo runtime; not beta and not production data processing

## Supported Pilot Flows

1. Trainer opens Dashboard, reads the attention queue, and enters the relevant athlete context.
2. Trainer reviews a completed workout, sees deviations or discomfort, sends feedback, and closes the attention item.
3. Trainer opens an athlete profile and assigns a published template through Quick Assign.
4. Trainer creates or edits a workout template in Builder, recovers an unsaved browser-session draft, and assigns the result.
5. Client opens the assigned workout, records sets, resumes after reload, completes the workout, and sees trainer feedback.
6. Moderator switches deterministic fixtures, resets a scenario, opens role-specific entries, and verifies build metadata without editing technical URLs.

The detailed task wording, prompts, assistance policy, and evidence format remain in `docs/external-trainer-pilot-guide-v1.md`.

## Accepted Verification Baseline

- ESLint passes.
- Next.js production build and TypeScript compilation pass.
- Playwright acceptance passes 34/34 tests:
  - client-trainer core flow: 7;
  - external trainer pilot readiness: 17;
  - trainer core flow: 10.
- Desktop and mobile smoke checks cover Dashboard, Athlete Profile, Builder, client execution, sticky navigation, completion controls, and horizontal overflow.
- Automated flows assert that the integrated demo does not perform remote writes.

Final commands are rerun immediately before the release-candidate commit and tag. Any changed result supersedes this baseline and blocks tagging until documented.

## Data And Runtime Boundary

The trainer and client views share one in-browser demo domain state. Demo state is versioned and persisted in localStorage for same-browser continuity. Builder and Review drafts use sessionStorage. Invalid persisted snapshots are discarded and the requested fixture is reconstructed. Reset recreates the selected deterministic fixture and clears transient Review state.

This persistence is not a database, is not synchronized, does not provide authorization, and must not receive real participant or client data. Clearing browser data, changing browser profile, or changing device loses continuity.

## Known Pilot Limitations

- No production authentication, authorization, RLS, backend persistence, server transactions, or durable audit trail.
- No notification delivery, concurrent editing, multi-device continuity, production idempotency, or offline synchronization.
- AI drafts are interface prototypes, not validated coaching, medical, or safety recommendations.
- Research actor and fixture markers are controlled demo mechanisms, not account security.
- Physical mobile keyboard behavior and a complete screen-reader pass require manual device checks.
- Moderator tools may be unavailable while a focus-trapped modal is open; the moderator closes the modal before using them.
- Compatibility names containing `Demo` remain in source and are not release blockers.

## Pilot Go/No-Go

Go only when the environment checklist is complete, the final lint/build/E2E run passes, the exact commit is tagged, no real data is entered, and the moderator can reset every selected fixture.

Stop the session on runtime crash, wrong-athlete data, lost discomfort text, an external write, failed reset, inability to recover the workflow, or a critical mobile obstruction. Record the fixture, route, action, visible result, and console evidence without participant personal data.

## Release Procedure

1. Run the safety audit and inspect every modified and untracked file.
2. Run lint, production build, all three Playwright suites, and the visual smoke pass.
3. Confirm that only meaningful source, test, documentation, and research-evidence files are included.
4. Commit the accepted release candidate.
5. Create the annotated local tag `external-trainer-pilot-v1-rc1`.
6. Record the commit in the session environment checklist.
7. Do not push or expose the pilot publicly without a separate release decision.
