# R3C: canonical client workout execution and log persistence

Date: 2026-09-03
Status: implemented candidate, awaiting final quality gates
Scope: active Session execution only

## 1. Executive verdict

R3C reuses the existing PostgreSQL `WorkoutSessionService.saveProgress` command. No second command model, schema change, migration, Template read, Program entity, Supabase source or demo fact is required.

The server contract was already suitable for incremental explicit Save and Skip: it scopes writes to the athlete's Session, locks the Session, checks its optimistic `version`, updates only addressed Set Logs, derives Exercise status, increments the Session version, and stores a durable receipt and audit event in the same transaction. R3C adds the missing exact execution projection, stable browser attempt identity, unknown-outcome reconciliation and mobile execution hierarchy.

Completion remains existing behavior and is outside R3C. R3D owns completion context, discomfort, session RPE and Attention changes.

## 2. User task

An athlete opens or resumes one exact active workout, sees the immutable plan, records actual facts for one set at a time, and can trust that a visible Saved or Skipped state came from PostgreSQL and survives reload.

## 3. Entry, action, next state and return

| Contract | Decision |
| --- | --- |
| Entry | `/client/workouts?session={ownSessionId}` after R3B Start/Resume, or exact Resume from `/client/me` |
| Primary action | Explicit `Save` for the current Set result |
| Secondary action | Persisted `Skip` for the current Set |
| Next state | Same exact Session with its new version and persisted Set/Exercise projection |
| Return | Allowlisted `/client/me` or `/client/workouts` only |
| Resume | Exact same Session ID and persisted logs |

## 4. Existing command audit

| Fact | Canonical evidence and behavior |
| --- | --- |
| Endpoint | `POST /api/workout-sessions/{sessionId}/progress` |
| Service | `WorkoutSessionService.saveProgress` validates UUID, expected version, one to twenty Sets, result ranges and text length |
| Repository | `WorkoutSessionRepository.saveProgress` |
| Payload | `expectedVersion`, `idempotencyKey`, and addressed `sets[]` containing Set Log ID, status, actual reps/duration/weight/RPE/comment |
| Identity | Session ID plus stable Set Log ID; source Assignment Set ID and semantic Set key remain read facts |
| Idempotency | SHA-256 key plus request hash in `workout_session_command_receipts`; same key and payload returns the persisted Session; changed payload conflicts |
| Concurrency | Session row lock plus exact expected Session version; no silent same-Set last-write-wins |
| Transaction | Set write, Exercise aggregate, Session version, receipt and audit are atomic |
| Skip | Existing Set-level status; numeric actual values are forced to `null` |
| Incomplete | Existing distinct status; R3C does not synthesize it from Skip or zero |
| Exercise note | Read-only when present; no canonical athlete write command is invented |

There is no canonical exercise-level Skip command. R3C therefore exposes Set Skip only.

## 5. Execution read model

The exact R3B model is evolved without replacing its Assignment and Session entities.

- `identity`: Assignment ID, Session ID, athlete user ID.
- immutable Assignment snapshot: title, instructions, trainer notes, ordered exercises, superset facts, exact per-Set prescriptions and rest.
- Session execution: Exercise Log ID, Assignment Exercise ID, Set Log ID, source Assignment Set ID, semantic Set key, status, actual facts, athlete comment and update timestamps.
- concurrency: persisted Session version.
- capabilities: edit, skip, resume and enter-completion-flow capabilities derived from the exact Session state.

Array indexes and display positions are presentation only. They are never command identity.

## 6. Plan and actual hierarchy

Each Set row keeps two explicit layers:

1. Plan: fixed/range repetitions or duration, target load, rest and Set kind from the Assignment/Session snapshot.
2. Actual: repetitions or duration, weight, optional RPE, Set comment and persisted status.

`null` remains absent. It is never rendered or submitted as zero. `skipped`, `incomplete`, `pending` and an explicit numeric zero remain different facts. Actual values never mutate Template or Assignment data.

## 7. Save and Skip model

R3C keeps explicit per-Set commands. It does not add background autosave.

One browser logical operation freezes:

- operation (`save` or `skip`);
- command ID;
- Assignment, Session, Exercise Log and Set Log identity;
- source Assignment Set identity;
- expected Session version;
- exact result payload;
- baseline persisted Set facts;
- deterministic intent fingerprint;
- start time.

Retrying unchanged input reuses the same command ID and frozen payload. Editing any actual value creates a new logical operation on the next Save.

## 8. Save-state taxonomy

| State | Meaning and interaction |
| --- | --- |
| `editing` | Local input differs or is being prepared; no persisted claim |
| `saving` | One exact command is in flight |
| `saved` | Server response or exact reconciliation contains the frozen facts |
| `skipped` | Server response or exact reconciliation contains persisted Skip |
| `save_failed` | Known non-persisting failure; input remains; unchanged Retry reuses the attempt |
| `outcome_unknown` | Network/5xx cannot prove the result; input and attempt are frozen; Check is available |
| `conflict` | Exact source changed incompatibly, disappeared or became terminal; local input remains visible |
| `read_only/unavailable` | Exact Session is terminal, foreign, malformed, missing or not actor-visible |

## 9. Unknown outcome reconciliation

```text
unknown Save/Skip
  -> GET exact Session
     -> target Set equals frozen payload: accept as Saved/Skipped
     -> target Set equals frozen baseline and Session remains active: replay same command ID and payload
     -> target Set differs, identity differs, or Session is terminal: conflict
```

R3C never responds to an unknown outcome with a new random command ID. A known version conflict is not labelled Saved.

## 10. Concurrency

- Different Sets are updated by addressed Set Log ID, not full-Session replacement, so one write cannot erase another Set.
- Two writes carrying the same Session version serialize on the Session row. The winner increments the version; the loser gets an explicit conflict.
- Same-Set concurrent edits therefore cannot silently overwrite each other.
- A second tab reloads the exact Session before issuing its next command.
- R3C does not build a collaborative editor or per-Set revision system.

## 11. Reload and recovery

Successful writes are rehydrated from PostgreSQL. Reload, Back to Home followed by Resume, and a second tab all resolve the same Session ID and Set Logs. A failed or unknown in-page command keeps its local input until reconciliation. R3C does not add localStorage as a second source of truth.

## 12. Mobile composition

The primary target is 390x844:

1. safe Back;
2. workout title and persisted Set progress;
3. explicit exercise list when more than one exercise exists;
4. one selected exercise with trainer note and plan;
5. vertically readable Set rows;
6. actual inputs;
7. 44px Save/Skip/Check controls;
8. accessible Previous/Next exercise buttons;
9. unchanged existing completion boundary.

The exercise selector uses buttons and a tab panel, not a pointer-only carousel. A 390x500 keyboard-equivalent viewport must keep focused fields and actions reachable without document-level horizontal overflow.

## 13. Accessibility

- semantic labels for each actual input;
- numeric/decimal input modes;
- 44px minimum touch targets;
- per-Set `status`/`alert` with polite live announcements;
- failed Set receives programmatic focus;
- Save/Skip state is not communicated by color alone;
- keyboard-operable exercise tabs and Previous/Next controls;
- no hover-only command;
- focus is retained within the exact Set after command feedback;
- 200% zoom must not create document-level horizontal overflow.

## 14. KEEP / ADAPT / REMOVE

### KEEP

- exact R3B Assignment and Session URL;
- existing PostgreSQL progress command and durable receipt;
- explicit per-Set Save and Set Skip;
- Assignment snapshot as plan source;
- existing completion surface unchanged for regression continuity.

### ADAPT

- Session DTO with source Set identity and update timestamps;
- exact read model with identity and capabilities;
- execution page into one-current-exercise mobile hierarchy;
- browser mutation into a frozen attempt and reconciliation state machine;
- feedback from global banners into local Set status.

### REMOVE FROM CANONICAL PATH

- random idempotency key on every retry;
- fake Saved before persisted evidence;
- full-Session replacement writes;
- array-index identity;
- editable exercise note without a command;
- mutable Template hydration, Supabase logs and demo facts.

## 15. Error and security behavior

- malformed, missing and foreign IDs produce the same non-disclosing unavailable state;
- the athlete can read and mutate only their Session and Set Logs;
- trainer actor cannot use the athlete progress command;
- terminal Session mutation fails closed;
- one Set failure remains local while the exact Session remains usable;
- transition and URL context are never authorization evidence.

## 16. Performance budget

Measured PostgreSQL statement counts include transaction and actor-context statements:

| Operation | Statements |
| --- | ---: |
| Exact Session execution read | 10 |
| Save one repetitions Set | 13 |
| Save one duration Set | 13 |
| Skip one Set | 13 |
| Exact reconciliation read | 10 |

The count is constant with respect to workout exercise/Set count for an exact read. There is no Session list scan, query per exercise, query per Set, mutable Template query or legacy log query. Browser mutation is one POST; unknown reconciliation is one exact GET and, only when unchanged, one replay POST.

## 17. Completion boundary

R3C does not change completion API, Attention creation, overall comment, discomfort, body area/severity, session RPE or trainer Review. The existing completion button remains for regression continuity, but all new completion semantics belong to R3D.

## 18. R3-REL-01 status

**Open.** Current server ownership permits an athlete to continue their own already-started active Session even if the trainer-athlete relation is later suspended. Trainer reads and new assignments fail closed. R3C does not infer or reverse this policy in UI and does not change it without a founder/domain decision.

## 19. Acceptance criteria

1. Exact Session shows immutable plan plus persisted actual facts.
2. Repetitions, duration, weight, RPE and Set comment persist.
3. Skip persists and clears numeric actual values to `null`.
4. Missing values remain missing.
5. Assignment and Template are not mutated.
6. Saved appears only after response/reconciliation evidence.
7. Same logical retry preserves command ID and payload.
8. Unknown outcome resolves by exact read before replay.
9. Reload, Resume and second tab show the same persisted logs.
10. Known failure retains local input.
11. Same-Set races have an explicit optimistic conflict.
12. Foreign/trainer/terminal mutations fail closed.
13. Mobile and keyboard-equivalent viewports have no document overflow.
14. No new console or accessibility warnings.
15. Completion behavior remains unchanged.
16. No schema or migration change is required.

## 20. Remaining gaps

- founder decision for `R3-REL-01`;
- overall completion context and subjective metrics in R3D;
- client completed history in a later stage;
- canonical Progress and Motivation remain outside R3C;
- exercise-level athlete-note write support remains intentionally absent.
