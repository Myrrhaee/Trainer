# Database Platform Decision v1

- Decision status: **accepted temporary decision**
- Owner: **Founder/Product Lead**
- Decision date: **2026-07-10**
- Confidence: **medium** because the provider direction is clear, while the existing remote environment remains unverified.

## 1. Context

PostgreSQL is the canonical database technology for AI Strength Coach. Supabase is the managed PostgreSQL provider for first beta, plus Auth/RLS and limited Storage/Data API infrastructure. Stage 4 could not identify or reach the configured legacy project; local migration history is incomplete. Provider choice must not conceal schema/security work required under every option.

## 2. Product requirements

- Reliable multi-tenant workout facts and transactional commands.
- Authenticated trainer-athlete relation authorization and defence-in-depth RLS.
- Fast beta delivery without self-hosted operations.
- Sensitive-data/privacy controls and auditable history.
- Provider-neutral UI/domain contracts and recoverable migrations.

## 3. Current state

- One stale/unresolved Supabase ref configured; environment identity unknown.
- Supabase CLI/link/config absent; remote catalog/history/counts unavailable.
- Local SQL is mostly PostgreSQL-portable but Auth policies are Supabase-coupled.
- UI has high Data API coupling; Storage usage is narrow; Realtime/Edge Functions unused.
- Critical authorization issues are application-level and must be fixed regardless of provider.

## 4. Decision criteria

Data value/provenance, security, beta time, migration reversibility, Auth/Storage effort, operational burden, vendor coupling and ability to test canonical migrations on clean PostgreSQL.

## 5. Option A - current unknown legacy Supabase project

Benefits: possible reuse of Auth/data/storage; lowest cutover if project is recoverable and safe. Risks: unknown identity/history/RLS/data, stale endpoint, cleanup ambiguity. One-time cost medium-high; ongoing cost low-medium; beta effect potentially short only after recovery. Confidence low.

## 6. Option B - clean Supabase staging

Benefits: canonical schema from zero, retains familiar Auth/RLS/Storage, clean migration history, safe vertical-slice tests. Risks: two environments, Auth/data/storage migration decisions, operational discipline required. One-time cost medium; ongoing cost medium; beta effect moderate but predictable. Confidence medium-high.

## 7. Option C - another managed PostgreSQL

Benefits: explicit vendor independence and clean database. Risks: replace Auth/Storage/session-RLS integration; build stronger backend immediately; highest migration and beta delay. One-time cost high; ongoing cost medium-high; beta effect longest. Confidence medium.

## 8. Option D - self-hosted PostgreSQL

Not recommended for first beta. Backups, upgrades, security, observability, HA and incident response add operational risk without solving domain/access flaws. Revisit only for strong compliance/business requirements.

## 9. Comparison matrix

| Criterion | A current Supabase | B clean Supabase staging | C other managed PG | D self-hosted |
|---|---:|---:|---:|---:|
| Preserve possible existing value | High if recoverable | Medium | Medium-low | Medium-low |
| Clean source of truth | Unknown | High | High | High |
| Beta speed | Unknown | High-medium | Low-medium | Low |
| Auth/Storage reuse | High | High | Low | Low |
| Operational burden | Low | Medium | Medium | High |
| Vendor independence | Medium with adapters | Medium with adapters | High | High |
| Current recommendation confidence | Low | Medium-high | Medium | High against |

## 10. Accepted temporary decision

> Use Supabase as managed PostgreSQL for the first beta, build a provider-neutral application access layer, keep critical writes server-side, and reassess the provider after beta or when an explicit migration trigger occurs.

The default implementation path is **Option B: a clean Supabase staging project** for canonical schema and first vertical slice. One short additional read-only recovery pass on the old project is allowed before staging only if the founder confirms that it exists, is accessible, contains valuable real data, has a clear purpose and can be audited safely. Otherwise staging proceeds and the old environment remains read-only/unknown legacy.

Self-hosted PostgreSQL is not selected for first beta.

### Assumptions

- Supabase continues to provide suitable managed PostgreSQL, Auth and RLS for beta.
- Canonical core SQL remains PostgreSQL-portable.
- Critical writes move behind server commands and provider-neutral repositories.
- Unknown remote data is not migrated automatically.

### Reversal path

Core schema is tested on standard PostgreSQL; Auth, Storage, Data API and RLS/JWT integration remain adapters. A future move replaces repository connection, identity and media adapters without rewriting UI/domain contracts. Provider is reassessed after beta or when a trigger below occurs.

## 11. Provider migration triggers

- Supabase cannot meet required region/compliance/availability.
- Supabase creates critical authorization-model limitations.
- Current schema cannot be restored or verified safely.
- Auth/Storage economics or product needs materially change.
- Repository isolation is complete and another provider has clear business advantage.
- Repeated platform-specific limitations block core PostgreSQL operations.
- Stage 4 recovery proves current project unsafe; this triggers clean environment, not necessarily non-Supabase provider.

## 12. Portability safeguards

Provider-neutral repositories/commands/read models; standard PostgreSQL core migrations; separate Supabase policy/Auth layer; Storage adapter; no Realtime dependency without need; clean PostgreSQL migration tests; export/restore runbook.

## 13. Risks

Choosing A without recovery may build on unknown data/security. Choosing B without environment governance may recreate drift. Choosing C now may delay beta while leaving application authorization bugs. Any option fails if unsafe service APIs and browser writes remain.

## Decision candidates for Product Lead review

| Candidate | Working recommendation | Decision evidence needed |
|---|---|---|
| Recover the historical remote after staging exists | Proposed only if data value or audit need justifies it | Founder confirmation and aggregate data evidence |
| Use Supabase Storage for ProgressPhoto in first vertical slice | Keep proposed; logo storage is optional/limited and separate | Product/privacy scope and bucket-policy audit |
| Exact direct browser read allowlist | Keep proposed; default to role-specific query services | Canonical RLS tests and read-model design |
