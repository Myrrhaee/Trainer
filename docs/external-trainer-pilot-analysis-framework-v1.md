# External Trainer Pilot Analysis Framework v1

This framework turns moderated-session evidence into traceable findings. It is not a scoring model and must not generate recommendations without observed evidence.

## Evidence Unit

Use one row for one observable episode: a participant action, statement, hesitation, error, recovery, or explicit expectation. Preserve the scenario and task context.

| Field | Entry |
| --- | --- |
| Session ID | |
| Participant profile | |
| Scenario and task | |
| Timestamp or recording reference | |
| Evidence type | Action / statement / error / assistance / recovery |
| Direct evidence | |
| Moderator intervention | None / description |

Do not combine several participants into one evidence unit. Quotes must be exact where possible and clearly marked as paraphrases otherwise.

## Observation

Describe only what was visible or audible, without explaining why it happened.

- Starting state:
- First action:
- Path taken:
- Hesitation or backtracking:
- Error or critical incident:
- Outcome:
- Time on task:
- Assistance required:

## Participant Interpretation

Record the participant's own explanation separately from the observer's interpretation.

- What the participant expected:
- What the participant believed happened:
- Confidence stated by the participant:
- Relevant quote:
- Follow-up answer:

## Finding

A finding is a concise claim supported by one or more evidence units.

- Finding ID:
- Finding statement:
- Supporting evidence unit IDs:
- Disconfirming evidence unit IDs:
- Scope boundary:

Do not convert a single preference into a general product conclusion. Label isolated signals and hypotheses explicitly.

## Severity

| Level | Definition |
| --- | --- |
| P0 | The participant cannot complete a core flow. |
| P1 | High probability of error or substantial loss of efficiency. |
| P2 | Noticeable comprehension or consistency problem. |
| P3 | Improvement or future opportunity. |

Severity describes impact, not how often the issue appeared.

## Frequency

Record the observed count and denominator, for example `2 of 6 sessions`. With a 5–7 participant formative sample, frequency is descriptive and not statistically representative.

- Sessions affected:
- Evidence units:
- Participant profiles affected:
- Repeated within the same session: Yes / No:

## Confidence

| Level | Use when |
| --- | --- |
| Low | Evidence is isolated, ambiguous, assisted, or contradicted. |
| Medium | The pattern is repeated or strongly explained by participants, with some uncertainty. |
| High | Multiple independent evidence units converge and plausible contradictions were checked. |

Confidence must be reduced when moderator help, fixture defects, device problems, or prior product knowledge may explain the behavior.

## Affected Workflow

Mark the smallest relevant surface and the end-to-end flow it affects.

- Surface: Dashboard / Athlete Profile / Review / Quick Assign / Builder / Client Home / Client Workout / cross-surface
- Workflow step:
- Upstream effect:
- Downstream effect:
- Actor: Trainer / Client / Moderator:

## Recommendation

Recommendations are optional during first-pass synthesis.

- Recommendation:
- Evidence addressed:
- Expected behavioral change:
- Smallest testable change:
- Validation method:
- Product or technical dependency:

Do not recommend a solution when the evidence establishes only a symptom. Keep alternative explanations open until follow-up analysis.

## Traceability

Every finding and recommendation must link back to evidence.

| Item | References |
| --- | --- |
| Finding ID | |
| Evidence unit IDs | |
| Session IDs | |
| Recording timestamps | |
| Observation notes | |
| Related route or fixture | |
| Related research question | |

Do not include participant names or contact details in product issue trackers. Use study IDs.

## Contradiction

Capture evidence that conflicts with the finding instead of averaging it away.

- Contradicting evidence:
- Participant or workflow difference:
- Possible explanation:
- Does it change severity, confidence, or scope?:
- Follow-up needed:

## Open Question

- Question:
- Why current evidence is insufficient:
- Evidence needed:
- Best next method: follow-up interview / additional session / prototype test / analytics after backend integration
- Decision blocked by this question:

## Synthesis Process

1. Normalize notes into independent evidence units within 24 hours of each session.
2. Separate observation, participant interpretation, and researcher interpretation.
3. Cluster evidence by workflow and research question, not by desired feature.
4. Draft findings with supporting and contradicting evidence.
5. Assign severity, descriptive frequency, and confidence independently.
6. Review P0 and P1 findings against recordings before changing the pilot build.
7. Create recommendations only where evidence supports a causal hypothesis or a clearly testable next step.
8. Keep unresolved contradictions and open questions visible in the final report.

## Analysis Guardrails

- Do not claim statistical representativeness from the first 5–7 sessions.
- Do not treat task completion alone as proof of comprehension or product value.
- Distinguish assisted completion from unassisted completion.
- Distinguish fixture, moderator, device, and product failures.
- Do not infer willingness to pay from general enthusiasm.
- Do not treat the moderator-only controls as participant-facing product UX.
- Do not infer backend readiness from a successful local demo flow.
- Never enter or preserve real participant or client data in demo fixtures or analysis artifacts.
