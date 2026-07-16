# Stage 4 Database Blockers

PostgreSQL is canonical; Supabase is the managed provider for first beta; clean Supabase staging is the default implementation path. The configured remote is an unknown legacy environment and is neither operational source of truth nor beta-ready.

## Blockers before clean staging schema

| Blocker | Evidence / risk | Required action | Owner | Urgency |
|---|---|---|---|---|
| Founder check of old project | Ref fails DNS; identity/data purpose unknown | Confirm existence, access, valuable real data, clear purpose and safe auditability; otherwise close recovery pass | Founder | Immediate |
| New staging environment | No verified environment exists | Create separate clean Supabase staging through an approved later task | Founder/platform | Before first migration |
| Staging credentials | Existing env points to unknown legacy; secrets must not enter Git/chat | Store staging credentials in approved local/deployment secret management with rotation/access ownership | Platform/security | Before connection |
| Migration ownership | Existing history has no complete baseline/owner | Name migration owner, reviewer and production promotion authority | Founder/engineering lead | Before first migration |

## Blockers before vertical slice

| Blocker | Evidence / risk | Required action | Owner | Urgency |
|---|---|---|---|---|
| Canonical migrations | Stage 3 entities absent; local history incomplete | Build additive provider-neutral schema from verified staging baseline | DB/engineering | Core blocker |
| Auth integration | SDK/`auth.uid()` coupling | Keep Supabase Auth for beta behind actor/capability adapter | Engineering | Core blocker |
| Canonical RLS | Core remote RLS unknown | Relation/ownership policies plus negative tests in staging | Security/DB | Core blocker |
| Repository adapters | UI directly consumes Supabase rows | Implement provider-neutral repositories and role-specific read models | Engineering | Core blocker |
| Server commands | Critical writes currently browser/service-route ad hoc | Implement transactional commands, idempotency and audit | Engineering | Core blocker |
| Security remediation | Unsafe patterns could be copied into new slice | Define authorization boundary; prohibit new privileged browser writes | Security/engineering | Core blocker |

## Blockers before beta

| Blocker | Evidence / risk | Required action | Owner | Urgency |
|---|---|---|---|---|
| Critical endpoints | Unauthenticated service-role/Auth Admin/reminder/webhook paths | Remove, disable or fully authenticate/authorize | Security/engineering | Beta blocker |
| Critical browser writes | Access, payment and workout integrity bypass | Move to server-side commands | Engineering | Beta blocker |
| Environment separation | Current remote unknown; demo mode/local sources coexist | Distinct staging/beta-production refs and deployment controls | Platform | Beta blocker |
| Backups/recovery | No verified baseline/restore evidence | Backup, restore rehearsal and migration rollback runbook | Platform/DB | Beta blocker |
| Monitoring/audit | Critical commands lack audit/operational visibility | Error, security, command and migration monitoring | Engineering/platform | Beta blocker |
| Privacy/retention defaults | Historical access/retention/ProgressPhoto open | Adopt beta defaults and complete access review | Founder/privacy | Beta blocker as applicable |
| Final access review | RLS/service/storage policies unverified | Role matrix, unrelated-user tests, service-role and public projection review | Security | Beta blocker |

## Existing remote data rules

Unknown rows are never migrated automatically. Nonzero counts do not prove production data. localStorage is prototype/demo. Legacy reviews require deterministic WorkoutSession evidence. If found, the old project remains read-only until data disposition is approved; deletion is not in the near-term plan.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Timing |
|---|---|---|
| Recover historical remote after staging | Proposed only for evidenced valuable data/audit need | Later |
| ProgressPhoto on Supabase Storage in first slice | Proposed pending privacy/product decision | Before media work |
| Exact direct browser read allowlist | Proposed after canonical RLS tests | Before beta |
