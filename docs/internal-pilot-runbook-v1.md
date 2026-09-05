# Internal Pilot Runbook v1

Дата: 2026-09-05. Статус: draft operational runbook; no external rollout performed.
Связанный план: [Internal Pilot Plan v1](internal-pilot-plan-v1.md).

## 1. Operating model

Pilot owner coordinates one trainer and two athletes. Engineering supports incidents but does not guide ordinary clicks or repair domain rows. Each participant uses a separate identity and their ordinary device. Pilot observations are kept outside the product using the approved template.

The runbook covers only the canonical workout-feedback loop. Do not direct participants to legacy `/history`, `/client/dashboard`, Progress, Program, payments, Motivation or demo routes.

## 2. Day 0 deployment gate

Migration 0016 external rollout remains **HOLD** until every item below is signed off:

- [ ] External database provenance and migration ledger verified.
- [ ] Recoverable backup created and restore procedure checked.
- [ ] Object ownership, grants, RLS and runtime role separation verified.
- [ ] Migration 0016 rollout and data-preservation implications reviewed.
- [ ] Migration applied by the canonical migrator.
- [ ] Post-migration auth, role isolation and synthetic core-loop smoke passed.
- [ ] Rollback versus forward-fix decision recorded.

Do not use real participant data for the smoke test. The required public Supabase configuration may satisfy the existing eager legacy module, but PostgreSQL remains the only canonical pilot source. Confirm through network/log evidence that no real Supabase facts enter the core workflow.

## 3. Account and participant preflight

- [ ] One trainer and two athlete identities are distinct.
- [ ] Trainer capability is active.
- [ ] Each athlete capability and profile status is active.
- [ ] Each trainer-athlete relation is active and points to the expected users.
- [ ] Each athlete can sign in on their own device without shared credentials.
- [ ] Trainer can open Dashboard, athlete roster and each exact Profile.
- [ ] Athletes can open `/client/me` and `/client/workouts`.
- [ ] Pilot owner has participant aliases, not passwords or OTP values.
- [ ] Incident/report channel and expected response time are known.

Do not put credentials, cookies, raw tokens or private comments in the observation log.

## 4. Trainer cycle script

The trainer should perform this as normal work. The pilot owner observes outcomes and avoids coaching unless the user is blocked.

1. Open Trainer Dashboard.
2. Identify the athlete who needs the next decision and explain briefly why.
3. Open the athlete Profile and confirm that the same current state/action is presented.
4. Open Quick Assign and select the intended exact Published workout revision.
5. Confirm athlete, workout, date and note; submit Assignment once.
6. Ask the athlete to continue independently. Do not keep refreshing their screen for them.
7. When the athlete completes, confirm one Review appears for the expected athlete/Session.
8. Open exact Review and compare prescription, actual Sets, omissions and athlete context.
9. Send concise Feedback through the product.
10. Confirm the Review is resolved once and return to the athlete context.
11. Make the next programming decision: assign next work when appropriate or leave no forced action.

Minimum evidence per cycle: Assignment ID, Session ID, Review/Attention ID, Feedback ID, observed next action and any intervention.

## 5. Athlete cycle script

1. Open Client Home.
2. Identify the current workout without help.
3. Open the exact Assignment or active Session.
4. Start once, or Resume the existing Session after leaving/reloading the page.
5. Record actual Sets as performed; use Skip only when a Set was not performed.
6. Confirm saved values survive a reload before completion in at least one pilot cycle.
7. Complete the Session with optional comment and explicit discomfort answer.
8. Later open the trainer response from Home or completed history.
9. Confirm the response belongs to the workout just completed.
10. Return to Workouts history and continue the next assigned workout when it appears.

Participants do not need to visit every screen. Progress and other deferred areas are not part of the script.

## 6. Known internal-pilot limitation

**Client Home does not automatically update when a trainer assigns a workout while that page is already open.**

Instruction to athlete:

> «Если тренер назначил тренировку, пока страница спортсмена уже открыта, обновите страницу.»

Record how often this happens and whether a normal refresh resolves it. Do not describe it as intended final product behavior, and do not add polling/realtime during the pilot-preparation stage.

## 7. What the pilot owner observes

At each transition answer:

- Did the participant understand the current state?
- Did they know the next action without instruction?
- Did the expected exact athlete/workout/Session/Feedback open?
- Where did they hesitate, backtrack or ask for help?
- Could they recover from a visible failure themselves?
- Did they trust that their result was persisted?
- Did the trainer understand why the athlete appeared in the queue?
- Did the athlete understand which workout the Feedback concerned?

Classify the observation before discussing a solution:

- `BLOCKER`: core loop cannot safely continue;
- `EFFICIENCY PROBLEM`: loop completes with material friction;
- `COPY/CLARITY`: meaning or next action is unclear;
- `POLISH`: visual or interaction quality without workflow loss;
- `NEW FEATURE REQUEST`: outside the validated loop.

## 8. Incident handling

### P0

Stop the full pilot for suspected data loss, privacy/security breach, or cross-user exposure. Preserve time, route, redacted screenshot and exact entity IDs. Do not repeat the action on participant data. Revoke access if needed through the approved operational procedure. Engineering decides containment and recovery before restart.

### P1

Stop the affected participant flow when core work cannot be completed or safely recovered. Preserve visible state and IDs. Do not edit PostgreSQL rows manually. Resume only after a reviewed fix or a proven non-destructive recovery procedure.

### P2

Record the obstacle, frequency, hesitation and safe workaround. Continue only when the workaround does not change facts, bypass authorization or risk duplicate commands. Product owner decides fix versus bounded acceptance after evidence accumulates.

### P3 and feature requests

Record briefly and continue. Do not interrupt the pilot or start implementation from the observation session.

For uncertain command outcomes, do not generate a new intent reflexively. Use the existing exact read, Retry or reconciliation path presented by the product. Escalate if the participant cannot determine whether persistence occurred.

## 9. Daily pilot review

Once per day the pilot owner maintains this manual table outside the production UI:

| Participant alias | Current workflow position | Last successful action | Blocker? | Next expected action | Owner |
| --- | --- | --- | --- | --- | --- |
| Trainer | | | | | |
| Athlete A | | | | | |
| Athlete B | | | | | |

Daily review procedure:

1. Count completed full cycles and verify expected exact IDs.
2. Review all new P0/P1 immediately.
3. Group repeated P2 by the same task/root symptom, without merging unrelated facts.
4. Confirm each participant's next expected action.
5. Confirm no manual DB repair, shared account or unsafe workaround occurred.
6. Record decisions, owners and due dates outside the product backlog only when evidence is sufficient.

This table is not a request for a new Dashboard feature.

## 10. Evidence handling

For a normal successful cycle, IDs and a short outcome are enough. Add a screenshot/video only when it clarifies a blocker, confusing transition or layout problem.

- Use participant aliases.
- Redact names, email addresses, health information and free-text comments.
- Never capture OTP, cookies, authorization headers or environment values.
- Prefer Session/Assignment/Feedback UUIDs over copied workout text.
- Store evidence only in the agreed pilot location with a defined retention period.
- Link evidence from the observation template; do not embed large artifacts in Git.

## 11. End-of-pilot review

At the end of 14 days, or after 6 full cycles if later:

1. Verify P0/P1 count and unresolved incidents.
2. Verify at least three consecutive cycles for each athlete.
3. Summarize repeated P2 frequency and workaround cost.
4. Confirm cross-role Assignment, Session, Set and Feedback parity.
5. Confirm whether stale Client Home remained manageable.
6. Record deployment/security gate status.
7. Apply the GO/NO-GO criteria from the Pilot Plan.

Do not infer external beta readiness from positive comments alone.
