# Client Workout R3B Design v1

## 1. Design verdict

R3B keeps the canonical page routes `/client/me` and `/client/workouts`. It replaces browser-side list joining and positional fallback with a PostgreSQL-backed, actor-scoped Assignment projection and exact execution read. No new workout domain, page route, schema, migration, logging command or completion behavior is introduced.

## 2. User task

The athlete must answer one question on Home: "What do I need to do now?" From that answer they can open the exact Assignment, start or resume the one persisted Session, reload safely and return to the surface they came from.

## 3. Route and identity

| Surface | Canonical route | Identity rule |
| --- | --- | --- |
| Home | `/client/me` | Server selects the current actionable Assignment. |
| Collection | `/client/workouts` | Bounded current/upcoming Assignments; no completed history in R3B. |
| Not started | `/client/workouts?assignment={assignmentId}` | Exact own Assignment ID only. |
| Started | `/client/workouts?session={sessionId}` | Exact own Session ID, linked to its exact Assignment. |

Malformed, nonexistent and foreign IDs produce the same non-disclosing unavailable state. They never select another own Assignment. Template IDs are traceability facts and are never execution route identities.

## 4. Transition contract

```text
Home or Collection
  -> exact Assignment read
  -> Start with frozen commandId + assignmentId + timezone
  -> created or resumed Session
  -> replace URL with exact Session ID
  -> reload/resume exact Session
```

An unknown Start outcome first performs an exact Assignment read. An existing linked Session is accepted. An unchanged startable Assignment replays the same command ID and payload. Any incompatible state becomes a conflict.

## 5. Screen structure

1. Safe return link.
2. Workout title, trainer presentation name, scheduled date and persisted Session state.
3. Trainer general instruction and Assignment note.
4. Ordered Assignment snapshot composition.
5. One Start action when the server capability allows it.
6. Existing Session execution/result surface after a Session exists.

R3B does not add fake autosave, new result inputs, activity metrics or workout history.

## 6. Action hierarchy

- No Session and `canStart`: **Начать тренировку**.
- Active Session: **Продолжить тренировку** from Home/Collection; opening lands directly in the exact Session.
- Start running: **Начинаем тренировку...**.
- Unknown outcome: explanatory alert plus **Проверить**.
- Terminal Session: no Start or Resume action.
- Cancelled, stale or unauthorized entity: generic unavailable state.

## 7. State taxonomy

| State | UI behavior |
| --- | --- |
| Loading | Single progress indicator; no substitute entity. |
| No current Assignment | "Сейчас нет назначенной тренировки." |
| Scheduled | Exact date, trainer context, snapshot and Start capability. |
| Active | Resume link to exact Session. |
| Starting | Start is disabled and progress copy is visible. |
| Outcome unknown | Preserve attempt; exact reconcile before replay. |
| Conflict | Stop replay and ask the athlete to return to the list. |
| Completed | Existing read-only result; never offer Resume. |
| Cancelled/unavailable | Generic non-disclosing state. |
| Partial read failure | Error state; never fall back to another Assignment. |

## 8. Mobile behavior

At `390x844`, title and context stack vertically, touch actions have at least 44px height, prescription rows wrap rather than overflow, and the safe return remains visible before the workout content. The R3B entry does not add a second sticky action layer.

## 9. Return contract

Only `/client/me` and `/client/workouts` are accepted return destinations. Home links preserve `/client/me`; Collection links preserve `/client/workouts`; direct URLs default to Home. The visible return link is deterministic and does not rely on `router.back()`. Browser Back/Forward remains valid because Start replaces only Assignment detail with the exact Session URL.

## 10. Keep / change / remove

**Keep:** current visual language, Assignment instruction/note, ordered exercise presentation, existing Session logs and completion UI, canonical Session repository and commands.

**Change:** Home to one server-selected current item; Workouts neutral route to a bounded collection; exact reads to actor-scoped rich snapshots; Start response to typed `created | resumed`; browser retry to frozen command identity.

**Remove from canonical read path:** all-Session list hydration, client-side Assignment/Session joining, `assignments[0]` fallback, mutable Template reads and demo/Supabase workout facts.

## 11. Data and request budget

| Operation | HTTP | PostgreSQL application reads/writes |
| --- | --- | --- |
| `/client/me` | 1 canonical collection request | access context + 1 set-based bounded Assignment query |
| `/client/workouts` | 1 canonical collection request | access context + 1 set-based bounded Assignment query |
| Exact Assignment without Session | 1 exact request | access context + 1 rich Assignment query |
| Exact Assignment with Session | 1 exact request | access context + 1 rich Assignment query + 3 constant Session hydration queries |
| Exact Session | 1 exact request | access context + 3 Session queries + 1 rich Assignment query |
| Start | 1 command | active relation/Assignment read, unique insert, set-based snapshot copies, audit, exact Session hydration |
| Resume/reload | 1 exact read | constant query count; no all-Session list and no N+1 per history row |

The composition query uses lateral set aggregation in one bounded Assignment query; it performs no query per exercise or set.

## 12. Accessibility

- Loading and unavailable states have explicit text, not color-only meaning.
- Start and Check are real buttons with disabled running state.
- Workout order remains semantic ordered lists.
- Focusable controls keep visible labels and minimum touch height.
- Foreign and invalid routes use identical copy to prevent information disclosure.

## 13. Relation lifecycle decision

**R3-REL-01, status: proposed/open.** Can an athlete finish an already active Session after the trainer-athlete relation becomes suspended or ended, and who can review that Session?

R3B follows current server facts: a non-active relation cannot create a new Session; an already persisted Session remains readable according to existing actor policies. R3B does not change progress/completion authorization or RLS. Founder decision is required before R3D so completion cannot create trainer-invisible review work by accident.

## 14. Scope confirmation

R3B does not implement R3C logging behavior, change completion, add Progress, Motivation or Program, or redesign the full client cabinet. API read/response contracts are extended, while PostgreSQL schema and migrations remain unchanged.
