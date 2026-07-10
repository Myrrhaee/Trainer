# Workout Review Flow V1

Дата: 2026-07-10

Статус: accepted Stage 2 review flow with completion criteria and notification channel left open

Scope boundary: trainer review of one completed assigned WorkoutSession.

## Evidence labels

- **Accepted product decision** - confirmed in `docs/decision-log.md`.
- **Current code evidence** - confirmed by real code/migrations.
- **Current prototype behavior** - exists only in mock/demo/local UI.
- **Proposed product decision** - recommendation awaiting Product Lead review.
- **Open question** - evidence is insufficient.

## A. Entry points

| Entry | User intent | Required context | Recommended presentation |
| --- | --- | --- | --- |
| Dashboard AttentionItem | Process the next completed workout | item id and source session id | Quick review/acknowledgement drawer or canonical full review page |
| Athlete profile, Training tab | Review a known client/session | client id and session id | Canonical full review page or quick drawer using the same contract |
| Workout history | Reopen a completed session or inspect review status | session id | Session detail with review action/status |
| Optional notification deep link | Open a specific pending review | signed/authenticated item/session id | Canonical review route; never generic dashboard fallback if source exists |

The full review page is the canonical detailed review surface. The drawer is the quick review and acknowledgement surface. Both must use one read model, one command contract, one `TrainerFeedback` model, identical resolution rules and the shared AttentionItem lifecycle (accepted D-048 and D-049). The current route `/trainer/review/[workoutId]` simply passes a parameter and must eventually resolve a persisted session/review source rather than a hardcoded date slug (`app/trainer/review/[workoutId]/page.tsx:1-10`).

## B. Context header

The header answers “whose workout, which workout, what state?” and stays compact.

Required context:

- client name/avatar/initials and profile link;
- workout title and completion date/time;
- completion status;
- duration when recorded or derivable;
- overall client comment, if present;
- important factual signals: skipped work, incomplete data, explicit discomfort/pain wording, large planned-vs-actual differences;
- source assignment link/version reference.

The header must not contain the full athlete history, all progress charts, program analytics or generic CRM data. Previous context belongs lower in the hierarchy and only when relevant.

Current page already shows client, workout/date, status, RPE/feeling/duration (`app/trainer/review/[workoutId]/workout-review-client.tsx:400-439`), but values are hardcoded. The drawer has a useful compact client/context card but substitutes `TeamClient.nextWorkout` for an exact session (`components/trainer-os/workout-review/workout-review-drawer.tsx:177-203`).

## C. Review information hierarchy

### Accepted exception-first order

1. **Session summary:** completion facts, duration when available, overall client context and completed work.
2. **Important deviations and safety signals:** including preserved discomfort/pain signal and original client wording.
3. **Client comments:** overall first, then exercise/set-specific comments near their source.
4. **Exercises with meaningful deviations:** planned versus actual, skipped and incomplete work.
5. **Remaining exercise results:** factual set details without forcing equal visual weight.
6. **Trainer action:** detailed feedback, short acknowledgement, optional next assignment or manual resolution with reason.

### Parameter treatment

| Data | Review behavior | MVP requirement status |
| --- | --- | --- |
| Planned vs actual sets | Show counts and set-level facts; do not reduce everything to one badge | Required if assignment contains planned sets |
| Repetitions | Show plan/range and actual value; preserve missing value distinctly from zero | Required when prescribed/recorded |
| Weight | Show target only if trainer provided one; show actual independently | Actual supported; target optional |
| RPE/RIR | Show only if prescribed or recorded; label source (target vs client actual) | Optional MVP field, not universal requirement |
| Skipped exercises | Explicit skipped state with optional client reason | Required behavior once skip is supported |
| Added exercises | Show as client-added and separate from assignment | Optional MVP capability; current demo log flow suggests value but not accepted |
| Comments | Overall and exercise-level where recorded | Overall comment required capability; exercise-level field open |
| Pain/discomfort signal | Preserve and highlight client-authored signal/comment; never diagnose, infer medically or hide it in AI summary | Accepted safety requirement D-047 |
| Personal records | Show as factual derived result with traceable method | Optional enhancement; must not distract from review |
| Incomplete data | Show “not recorded” and allow review/acknowledgement; never invent values | Required error/edge behavior |

The current full page demonstrates planned-vs-actual rows, actual sets and exercise comments (`app/trainer/review/[workoutId]/workout-review-client.tsx:466-566`). This is valuable hierarchy evidence, not a domain contract.

## D. Trainer actions

### Required MVP actions

| Action | Behavior | Success condition |
| --- | --- | --- |
| Write feedback | Free text with optional factual draft/preset | Persisted and linked to source session/trainer |
| Use/edit AI draft | Draft is visibly suggested, editable and never auto-sent | Trainer explicitly sends final text |
| Short acknowledgement | Compact mode with editable message and explicit acknowledgement kind | Persisted as client-visible TrainerFeedback and automatically resolves item |
| Assign next workout | Open quick assign with current client and source context | New assignment persists; not required for review closure |
| Open profile | Navigate with source review context preserved | Easy return to same review/queue |
| Resolve review item | Automatic after successful feedback/ack; manual resolution requires stored reason | Auditable resolution persisted |

### Later or optional actions

| Action | Assessment |
| --- | --- |
| Change future template | Later or secondary deep link; do not mutate source assignment/template from review silently |
| Internal trainer note | Useful but not required to prove first loop; clarify distinction from client-visible feedback |
| Follow-up marker | Later; would expand AttentionItem types/lifecycle |
| External messenger | Notification/link only after in-product feedback persists; not source of truth by D-037 |

## E. First AI assistance

Proposed flow (aligned with D-038):

```text
System prepares factual session summary
-> AI highlights deviations and client comments
-> AI creates editable feedback draft
-> trainer reviews and edits
-> trainer explicitly sends
```

### AI input boundary

Allowed minimum inputs, subject to privacy/security review:

- assignment snapshot relevant to this session;
- actual session/log data;
- client-authored comments and subjective RPE/feeling;
- a small, explicitly selected previous comparable-session summary;
- trainer-configured language/tone preference if accepted later.

Do not send unrelated profile, payments, messages, photos or full lifetime history by default.

### Traceability and safety

- Every factual claim in the summary should be traceable to a plan field, log, comment or deterministic calculation.
- Missing values remain missing; AI cannot infer completed sets, weight, pain severity or intent.
- Separate client quote/paraphrase from AI interpretation.
- AI may suggest wording, not diagnose pain/injury, prescribe rehabilitation, autonomously change load or assign a workout.
- Trainer must see that the content is a draft and explicitly send it.
- The original discomfort/pain signal and client comment must remain visible outside and inside the summary; AI cannot omit or soften it into an untraceable conclusion.
- Store the final trainer-approved feedback as source of truth; whether to retain AI provenance/model metadata is an open backend/privacy decision.
- If AI fails, the factual system summary and manual feedback controls remain fully available.

## F. Completion behavior

### Accepted sequence

1. Trainer clicks “Send feedback” or “Send acknowledgement.”
2. UI validates non-empty client-visible content and submits an idempotent command.
3. System persists feedback linked to session/trainer.
4. System automatically resolves the source AttentionItem with the detailed-feedback or short-acknowledgement outcome.
5. UI confirms that feedback is available to the client.
6. UI offers “Assign next workout,” “Open next review,” and “Return to queue.”
7. If trainer had chosen “Send and assign,” quick assign opens with client/source context after steps 3-4.

Sending feedback/acknowledgement automatically resolves the item after successful persistence. Manual resolution remains a separate action with a stored reason. Next assignment is optional. Client read receipt never controls resolution.

Before send, feedback is editable. After successful send, the first MVP does not silently mutate it. A correction is persisted as additional follow-up TrainerFeedback linked to the same session/review context.

Navigation after success should not be forced. Primary action can be “Next review” when queue remains; secondary action returns to the same dashboard state. The existing dashboard already prototypes a next-client sequence in local state (`components/trainer-os/home/trainer-home-page.tsx:118-149`).

## G. Empty and error states

| State | Required behavior |
| --- | --- |
| Session has no recorded sets | Show completion metadata/comment, explain no set data, allow acknowledgement/manual close; do not show fake totals |
| Partial session | Mark completed exercises, skipped/incomplete work and missing values distinctly; trainer can still respond |
| No client comment | Hide/replace section with quiet “Комментарий не оставлен”; do not treat absence as positive/negative signal |
| AI unavailable | Keep factual summary and empty/manual feedback editor; no blocked send action |
| Feedback save failed | Keep draft, item remains active, show retry and no success claim |
| Feedback persisted but external send failed | Show in-product success plus non-blocking delivery warning/retry |
| Source assignment missing | Show actual session/logs with “исходное назначение недоступно”; disable comparisons that require plan; allow review |
| AttentionItem resolved in another tab | Refresh persisted resolution and disable duplicate resolution; a deliberate correction is additional follow-up TrainerFeedback |
| Session/item not found | Explain stale/deleted link, return to queue; never silently display fallback demo workout |
| Permission denied | No client/session leakage; return to authorized queue/profile |
| Unsaved draft and navigation | Warn or retain local draft keyed to review id; never silently lose trainer text |

## H. Current UI audit

### Workout review drawer

Source: `components/trainer-os/workout-review/workout-review-drawer.tsx`.

Useful:

- compact dashboard workflow and client context;
- order of summary -> exceptions -> client comment -> feedback;
- detailed send and send-and-assign actions;
- presets as an interaction idea;
- explicit profile link.

Does not match future flow:

- all workout/session data is module-level hardcoded (`:41-82`, `:207-271`);
- callbacks only pass client identity and parent closes local state (`:84-107`);
- no selected template/session/source identity;
- no validation for empty feedback;
- no persistence, loading, stale or error states;
- text claims item will close before any server success (`:142-160`);
- discomfort example is visual only and has no safe source/signal contract.

Reuse recommendation: adapt the sheet shell, compact hierarchy, feedback editor/preset interaction and action footer. Replace data/commands completely and share them with the canonical page.

### Workout review page

Source: `app/trainer/review/[workoutId]/workout-review-client.tsx`.

Useful:

- detailed planned-vs-actual structure;
- exercise-level actual sets and comments;
- exercise detail sheet integration;
- compact profile link and sticky feedback editor;
- factual metrics and explicit risky-signal area as visual patterns.

Does not match future flow:

- `workoutReviews` is hardcoded and unknown ids fall back to Artem's workout (`:137-149`, `:367-369`);
- “mark reviewed” changes local boolean and toast only (`:380-385`);
- no persisted feedback or item resolution;
- no overall client comment field distinct from generated summary;
- risk detection is regex over hardcoded feeling and RPE (`:373-378`), not a traceable signal system;
- no skipped/added/incomplete/source-missing states;
- “adjust program” targets a profile hash and assumes Program, which is not required for the first MVP;
- page can visually imply completion while backend remains unchanged.

Reuse recommendation: retain information hierarchy, exercise result presentation, detail sheet and sticky action-area concepts after redesign. Replace fallback/data handling, action semantics and Program coupling.

### Existing backend evidence

`trainer_workout_reviews` supports trainer/client/date, status, comment, reviewed and seen timestamps with RLS (`supabase/migrations/20260403120000_trainer_workout_reviews.sql:1-94`). `/client/me` reads reviewed comments and marks them seen (`app/client/me/page.tsx:346-360`, `:1622-1641`).

Useful: in-product feedback, role visibility and read receipt exist as evidence. Gap: uniqueness is trainer/client/workout date, not source session; current review page does not write this table; it is not an AttentionItem lifecycle.

## I. Acceptance criteria

- Every review opens an exact persisted completed session and source assignment when available.
- Header identifies client, workout, completion state/date and important client-authored context without unrelated analytics.
- Trainer sees factual data in the accepted exception-first hierarchy: summary, deviations/safety, comments, meaningful deviations, remaining results, action.
- Missing, skipped, added and partial data are represented explicitly and never invented.
- Discomfort/pain wording is visible as client-authored context with no diagnosis or autonomous prescription.
- Manual review works fully when AI is disabled or fails.
- AI draft is traceable, editable and cannot send or mutate training state without trainer confirmation.
- Detailed feedback and short acknowledgement persist as explicit TrainerFeedback kinds and become visible to the client.
- Feedback save is idempotent; failed save preserves draft and does not resolve the item.
- Successful feedback/acknowledgement resolves the correct item with audit links.
- Manual resolution requires a stored reason.
- Trainer may assign next workout but is never required to do so before closure.
- Sent feedback is immutable in the normal MVP flow; corrections are additional follow-up feedback.
- Client read receipt does not affect resolution.
- Stale/resolved-in-another-tab state is handled without duplicate feedback.
- Review drawer and full page use the same data and command contract.
- Success returns to the preserved queue/profile context or opens the next item by explicit trainer action.

## Open research questions

- What is the minimum session completion criterion and payload required to open review?
- Which external notification channel is acceptable for beta after in-product persistence?

## Decision candidates for Product Lead review

| Proposed decision | Alternatives | Recommendation | Rationale | Affected UI | Affected domain entities | Urgency |
| --- | --- | --- | --- | --- | --- | --- |
| Minimum session completion criteria | Require all planned sets; explicit trainer override; client confirmation with partial persisted data | Validate the least restrictive criterion that still produces a trustworthy completed session | Successful completion creates the review lifecycle and must be deterministic | Client completion, review | WorkoutSession, WorkoutLog | before backend |
| External beta notification channel | Telegram; email; push; none | Select one optional transport after in-product feedback is persisted | Delivery is useful but must not control feedback or resolution | Client/trainer notification surfaces | TrainerFeedback delivery metadata | before beta |
