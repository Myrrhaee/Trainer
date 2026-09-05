# Internal Pilot Observation Template v1

Дата: 2026-09-05. Назначение: один экземпляр на одно наблюдение или инцидент.
План: [Internal Pilot Plan v1](internal-pilot-plan-v1.md). Runbook: [Internal Pilot Runbook v1](internal-pilot-runbook-v1.md).

## 1. Observation record

| Field | Value |
| --- | --- |
| Observation ID | `PILOT-YYYYMMDD-NNN` |
| Date/time and timezone | |
| Observer | |
| Participant alias | |
| Role | `trainer` / `athlete` / `pilot owner` |
| Cycle number | |
| Environment/build | |
| Device/browser | |
| Workflow category | `BLOCKER` / `EFFICIENCY PROBLEM` / `COPY/CLARITY` / `POLISH` / `NEW FEATURE REQUEST` |
| Severity | `P0` / `P1` / `P2` / `P3` |
| Status | `new` / `reproduced` / `accepted for pilot` / `fixed pending verification` / `verified` / `closed` |

## 2. Canonical entity references

Fill only identifiers needed to establish the transition. Do not copy auth/session tokens.

| Entity | Exact ID or `not applicable` |
| --- | --- |
| Athlete User | |
| TrainerAthleteRelation | |
| WorkoutTemplate / Revision | |
| WorkoutAssignment | |
| WorkoutSession | |
| AttentionItem / Review | |
| Feedback | |

## 3. Workflow step

**Task the participant was trying to complete:**



**Entry surface and route, without secrets:**



**Expected result:**



**Observed result:**



**Last confirmed successful action:**



**Next expected action:**



## 4. Experience evidence

| Question | Observation |
| --- | --- |
| Did the participant understand the current state? | |
| Did they know the next action? | |
| Did the exact expected entity open? | |
| Did they hesitate or backtrack? | |
| Was manual instruction needed? | |
| Could they recover themselves? | |
| Did they trust the persisted result? Why? | |
| For trainer: was queue/review reason understood? | |
| For athlete: was trainer Feedback understood and correctly associated? | |

## 5. Recovery and data integrity

**Visible error or ambiguity:**



**Recovery attempted:**



**Recovery outcome:**



**Were duplicate commands, partial persistence, missing facts, foreign facts or manual DB intervention observed?**



**Known stale-Home case?** `yes` / `no`

If yes, record whether the approved normal page refresh exposed the Assignment. Do not mark this as fixed.

## 6. Evidence references

| Evidence | Reference |
| --- | --- |
| Redacted screenshot | |
| Redacted video/screencast | |
| Relevant log/audit/receipt reference | |
| Reproduction notes | |

Privacy check:

- [ ] No password, OTP, cookie, token or authorization header captured.
- [ ] Names, email addresses and health details are redacted or omitted.
- [ ] Full workout/comment text is omitted unless strictly needed and consented.
- [ ] Evidence storage location and retention follow the pilot agreement.

## 7. Triage and decision

**Why this severity applies:**



**Observed frequency:** `once` / `repeated N times` / `every attempt` / `unknown`

**Safe temporary workaround, if any:**



**Decision:** `stop` / `investigate` / `collect frequency` / `accept for internal pilot` / `fix before next cycle` / `defer pre-beta`

**Owner and due date:**



**Related observations or issue references:**



**Verification required to close:**



## 8. Severity reference

| Severity | Use when | Required response |
| --- | --- | --- |
| P0 | Data loss, privacy/security breach, or impossible core loop. | Stop full pilot and contain. |
| P1 | Core workflow cannot be completed or reliably recovered. | Stop affected flow and review before resume. |
| P2 | Workflow completes with material inefficiency or confusion. | Collect frequency; use only a safe explicit workaround. |
| P3 | Polish or deferred issue. | Backlog without interrupting pilot. |

## 9. Daily participant summary

Use one row per participant in the pilot owner's daily review. This is a manual artifact, not a production feature.

| Date | Participant alias | Current workflow position | Last successful action | Blocker? | Next expected action | Observation IDs |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## 10. Cycle completion record

| Cycle | Athlete alias | Assignment | Session | Review | Feedback | Athlete saw Feedback | Next decision made | Complete without engineering help |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | `yes` / `no` | `yes` / `no` | `yes` / `no` |
