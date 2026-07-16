# Database Access Architecture v1

Status: accepted target architecture for the canonical vertical slice. Supabase may implement adapters, but PostgreSQL and domain contracts are canonical.

## Target shape

```text
UI
-> role-specific read model / command DTO
-> server command or query service
-> provider-neutral repository
-> PostgreSQL
```

Supabase may implement Auth, PostgreSQL connectivity, Storage and RLS, but its row/API shape does not become the UI contract.

## Browser reads

- Permit direct browser + RLS only for low-risk, simple, owner-scoped reads when the repository/query service cost is not justified.
- Prefer query services for athlete profile/review/progress aggregates, trainer queue/dashboard and any read joining relation-scoped facts.
- Return Stage 3 read models, not raw rows; centralize derived metrics and sensitive-field allowlists.
- Public trainer profile uses an explicit public projection.

## Browser writes

- Critical browser writes are prohibited in the target architecture.
- A narrow draft/local preference write may use browser + RLS if ownership, validation and audit risk are low.
- Current browser writes to workout logs, weight + profile in parallel, payments, entitlement, relation access, messages and templates require reclassification/remediation.

## Server commands and transactions

| Command | Recommended boundary | Atomic work / notes |
|---|---|---|
| CreateWorkoutTemplate | Next.js server action/API -> repository transaction | Draft root + revision + ordered children; idempotency |
| PublishWorkoutTemplate | Server command -> transaction | Validate/freeze revision and audit publication |
| CreateWorkoutAssignment | Server command -> transaction | Verify trainer capability/relation/template revision; copy normalized snapshot + audit |
| UpdateScheduledWorkoutAssignment | Server command -> transaction | Enforce pre-session structural lock and optimistic version |
| StartWorkoutSession | Server command + DB unique constraint/function | Find-or-create one active/resumable session |
| SaveWorkoutSessionProgress | API/server action -> repository transaction | Versioned batch upsert logs/signals; direct browser only if equivalent invariants can be proven |
| CompleteWorkoutSession | Server command + DB transaction/RPC | Complete session + unique AttentionItem + audit event atomically; optional outbox |
| CreateOrGetReviewAttentionItem | Internal transaction/function | Not browser callable; unique source session |
| SendTrainerFeedback | Server command -> transaction | Persist immutable sent feedback, then resolve AttentionItem; audit author |
| ResolveAttentionItemManually | Server command -> transaction | Reason + resolution atomically |
| CreateNextWorkoutAssignment | Server command -> transaction | Independent from feedback resolution; same assignment checks |
| Change subscription/access status | Authenticated server command or verified provider webhook | Entitlement transition + audit/idempotency |
| Payment action | Verified server/provider command | Provider signature, idempotency and financial audit |
| Privileged trainer-client linking | Authenticated server command -> transaction | Actor/capability checks and one canonical relation |

Database RPC is an implementation option for transaction-critical sections, not the UI API. Keep function signatures provider-neutral at the service/repository boundary.

## RLS as defence in depth

Server commands authenticate and authorize actor/capability/ownership/relation before repositories run. RLS independently prevents cross-tenant access and protects any allowed direct browser path. Service-role bypass is never authorization.

## Service-role boundary

- Only server-only modules may construct a privileged client.
- Each endpoint verifies caller or signed event before privileged access.
- Target IDs from bodies are untrusted; relation/ownership is reloaded.
- Use least privilege, idempotency and structured audit. Do not log personal payloads.
- Split Auth administration, data commands and background jobs into separate capabilities where possible.

## Repository abstraction

Repositories own SQL/PostgREST details, row mapping and transaction participation. Query services compose read models. Command services enforce state transitions/idempotency. Provider adapters cover Auth and Storage separately. Avoid a generic CRUD repository that leaks rows.

## Errors, idempotency and audit

- Stable domain errors: unauthenticated, forbidden, invalid state, conflict, validation, not found, unavailable.
- Idempotency keys on start/complete/feedback/assignment/external events.
- Database uniqueness backs idempotency; retries return the prior result.
- Audit records actor, command, target, correlation and result without secrets/health text duplication.
- Outbox/background jobs handle notifications after durable commits.

## Background jobs

Notifications, delivery retries, derived progress rebuilds and non-blocking analytics may run asynchronously. They consume durable domain events and cannot define completion truth.

## Provider replacement

Swap PostgreSQL connection/repository implementation, identity verification and media adapter independently. UI contracts and domain commands remain unchanged. Test core migrations against clean standard PostgreSQL plus a Supabase integration suite for Auth/RLS policies.

## Current architecture findings

- Direct Data API calls occur in dozens of client components across 15 named sources.
- Critical browser writes include flat workout logs, dual weight/profile update, payment insertion and self-activation of paid access.
- Existing server routes generally lack transactions, idempotency and audit; several lack authentication/authorization entirely.
- `link-trainer` and check-in perform multi-source writes without atomicity.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Beta blocker? |
|---|---|---|
| Degree of direct browser reads | Allow only simple owner-scoped reads; use query services for core aggregates | Partial |
| Exact direct browser read allowlist | Proposed; decide after canonical RLS tests | Partial |
| ProgressPhoto Storage adapter | Proposed separately from core data access | Before sensitive media |
| Historical old-remote recovery | Proposed only for evidenced data value | No for new slice |
