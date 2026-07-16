# PostgreSQL Source-of-Truth Recovery Plan v1

Status: accepted planning sequence; no actions below were executed. PostgreSQL is canonical, Supabase is the first-beta managed provider, and clean Supabase staging is the default implementation environment.

| Phase | Action | Required access | Read/write impact | Owner | Rollback | Evidence / exit gate | Blocker | Provider dependency |
|---|---|---|---|---|---|---|---|---|
| A - environment confirmation | Founder performs a short manual check of the old project: existence, access, valuable real data, clear purpose and safe read-only auditability | Dashboard/management read-only | Read-only | Founder + platform engineer | None | Five conditions confirmed or recovery closed | Current ref unreachable/unknown | Supabase management metadata |
| B - verified PostgreSQL baseline | Export schema-only catalogs, grants, RLS, functions/triggers/extensions and aggregate counts | Read-only DB/catalog credentials or approved CLI token | Read-only; temp dump deleted | DB engineer | Delete temp artifacts | Hashable object inventory with no data | No catalog access | PostgreSQL standard plus Supabase schemas |
| C - migration-history reconciliation | Compare remote history/schema to 11 files; identify manual/remote-only/local-only changes; draft baseline | Read-only catalog/history | Read-only until separately approved baseline migration | DB engineer | No repair performed | Reviewed drift map and baseline proposal | Missing history/baseline | CLI history Supabase-specific; SQL neutral |
| D - portability boundary | Separate core SQL from Auth/RLS/Storage adapters; define repository and identity/media interfaces | Code/schema design access | Documentation/design only initially | Tech lead | Revert docs/design | Clean PostgreSQL compatibility test plan | Provider coupling map | Intentional adapters |
| E - canonical schema design | Design Stage 3 identity/relation/template/assignment/session/review tables and archives | Verified baseline + product decisions | Design; later additive writes in staging | Tech lead + Product Lead | Versioned migration rollback plan | Invariant/permission review | Final SQL states/historical access | Core neutral, policy adapter specific |
| F - security remediation | Close unsafe APIs, establish actor/relation checks, RLS tests, least privilege and audit | App/staging write access after approval | Code/policy changes in separate stage | Security/engineering | Deploy rollback/feature flags | Critical tests pass | Current critical APIs/unknown RLS | Auth adapter |
| G - vertical-slice migrations | Apply additive canonical schema to clean Supabase staging; build repositories/server commands/adapters | Staging write access | Additive staging mutation | Engineering | Recreate disposable staging from migrations | End-to-end assignment -> feedback test | Credentials and migration ownership | Managed PostgreSQL |
| H - beta cutover | Controlled cohort, backfill only high-confidence data, monitor and rollback readers/writers | Approved production/staging access | Controlled writes | Product + engineering | Route/feature rollback; preserve canonical writes | Reconciliation, latency, security SLOs | Data provenance/privacy | Provider operational tools |
| I - provider reassessment | Compare beta evidence, cost, compliance, coupling and operations | Metrics/cost/incident evidence | Decision only | Founder/Product Lead | Continue current provider | Accepted ADR | No beta evidence yet | None |

## Safe access request

Do not send secrets in chat. Provide one of:

1. restore the intended project endpoint and authenticated Supabase CLI/management access on the local machine with read-only inspection permission; or
2. provide a time-limited read-only PostgreSQL role able to query catalogs and aggregate counts; or
3. have an authorized operator produce a schema-only dump, policy/function/index inventory, migration list and aggregate count report through a secure file channel.

Needed metadata: actual tables/columns/constraints/indexes, owners/grants, RLS/FORCE/policies, functions/triggers/extensions, row counts, migration history and environment identity. No user rows are needed.

If any of the five recovery conditions fails, do not delay clean staging. Unknown remote data is not migrated automatically, and the old project is not deleted in the near-term plan.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Timing |
|---|---|---|
| Time-box recovery of current project | Yes, before choosing A vs B | Immediate |
| Recover old project after staging | Proposed if data value or audit requirement remains | Later |
| Use Storage for ProgressPhoto in vertical slice | Proposed | Before media schema |
| Exact browser read allowlist | Proposed after canonical RLS tests | Before beta |
