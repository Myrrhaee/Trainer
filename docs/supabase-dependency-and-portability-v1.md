# Supabase Dependency and PostgreSQL Portability v1

> Historical Stage 4 dependency audit. Its recommendation to keep Supabase for first beta was superseded on 2026-08-02 by `docs/backend-foundation-b0.md`. The coupling inventory remains valid migration evidence until code is replaced.

## Accepted platform position

PostgreSQL is canonical. Supabase is the temporary managed PostgreSQL/Auth/RLS provider for first beta. Core domain, read-model, command and repository contracts remain provider-neutral. Clean Supabase staging is the default implementation environment; the configured old remote remains unknown legacy and is not a source for new schema work.

## Overall coupling

**High vendor coupling in the current application access layer; moderate coupling in local SQL.** Tables, constraints, JSONB, arrays, transactions and PL/pgSQL are portable across managed PostgreSQL. Auth/RLS identities, browser PostgREST queries, service-role APIs and one Storage flow are Supabase-specific. No Realtime or Edge Function dependency was found.

## Dependency map

| Layer | Current usage / evidence | MVP need | Portability risk / effort | Replacement | Recommendation |
|---|---|---|---|---|---|
| PostgreSQL database | Local SQL tables, FKs, indexes, checks, JSONB/arrays | Required | Low-medium | Any managed PostgreSQL | Keep core standard |
| Extensions | No `CREATE EXTENSION`; UUID default availability must be verified | Required implementation detail | Low | Provider-supported UUID generation/app-generated UUID | Verify/isolate |
| Supabase Auth | Browser signup/login/session/update; server token verification | Required identity | High | External OIDC/Auth plus user mapping | Keep for first beta; isolate claims |
| RLS/JWT | 32 local policies use `auth.uid()`; roles such as `authenticated` | Required defence | High if Auth changes | Session-aware backend + provider-neutral DB identity context/policies | Isolate helpers |
| Storage | Browser upload/public URL for `logos` bucket | Non-core convenience | Medium | S3-compatible object storage and signed/public URL service | Keep or replace later |
| Realtime | No database channel/subscription evidence | Not required | None | Poll/query/events later | Do not add for MVP without need |
| Data API/PostgREST | Direct `.from()` across 15 named data sources in dozens of browser files | Reads useful; critical writes not acceptable target | High | Query services/repositories/read-model APIs | Isolate before core slice |
| RPC | Two local functions called by SDK | One exercise helper; legacy read receipt | Medium | Repository transaction/function adapter | Keep behind repository |
| Edge Functions | No functions directory or invocation | Not required | None | Next.js API/worker | Do not introduce by default |
| CLI/migrations | Plain SQL files; CLI/config/link absent | Required operationally | Medium due missing history | Provider-neutral migration runner/verified SQL | Recover baseline first |
| Dashboard/manual ops | Migration comments mention SQL Editor; actual actions unknown | Not a desired dependency | High provenance risk | Reviewed migration pipeline | Replace before beta changes |
| Generated TS types | No generated `Database` type found | Helpful, not required | Low | Domain DTOs + repository types | Generate only at adapter boundary |
| Service role | Admin client in several API routes, bypassing RLS | Narrow backend operations only | High security/coupling | Privileged DB account behind authenticated services | Isolate and remediate before beta |
| Client SDK | `@supabase/ssr`/JS used for Auth, Data API and Storage | Auth may remain | High | Auth adapter + query/command client | Split by responsibility |

## Supabase-specific code map

- Browser client/session: `lib/supabase-client.ts`, `lib/auth-context.tsx`, login/signup/settings/navigation.
- Server privileged client: `lib/supabase-admin.ts` and service-role API routes.
- Direct browser data: client execution/check-in/history, trainer builder/messages/settings/clients, legacy admin/dashboard/programs/payments.
- Storage: trainer logo upload in `app/(admin)/settings/page.tsx`.
- Auth-coupled SQL: all local policies and two `SECURITY DEFINER` functions.
- No database Realtime, Edge Function or generated-schema type evidence.

## Portability score

Score: 5 = readily portable, 1 = tightly coupled/unsafe.

| Subsystem | Score | Reason |
|---|---:|---|
| Table/constraint model | 4 | Mostly standard PostgreSQL; baseline missing |
| Local functions/triggers | 3 | PL/pgSQL portable, two functions Auth-coupled |
| Auth | 1 | Supabase session/JWT SDK across UI/server |
| RLS | 2 | PostgreSQL RLS itself portable; `auth.uid()` and roles are not |
| Storage | 3 | One isolated bucket flow |
| Realtime | 5 | Not used |
| Data access | 1 | Direct PostgREST calls shape many UI components |
| Critical command layer | 1 | Incomplete; service-role and browser writes dominate |
| Migration operations | 2 | SQL portable but history/link/baseline absent |

## Isolation recommendations

1. Keep Supabase Auth behind an `IdentityProvider` contract returning canonical actor/capabilities.
2. Put PostgREST/Supabase client usage inside repositories and role-specific query services.
3. Route critical writes through authenticated server commands; never expose service privilege to UI.
4. Keep RLS as defence in depth and integration-test it; server authorization remains mandatory.
5. Wrap Storage in a media service returning domain-safe references, not Supabase object paths.
6. Keep domain events/notifications provider-neutral; no Realtime requirement for beta.
7. Maintain core migrations in PostgreSQL SQL; isolate `auth.uid()` policies and Supabase grants in an infrastructure layer.

## Exit strategy

- Database: dump/restore canonical application schemas after testing migrations on clean vanilla PostgreSQL.
- Auth: export/map external subject to UserProfile; replace token verification and RLS identity helper.
- Storage: copy object bytes/metadata to S3-compatible service and rewrite media references through adapter.
- Data API: replace repositories, leaving UI read models/commands unchanged.
- Service role: replace with least-privilege server DB roles.
- Realtime/Edge: no current migration work.

## Before beta vs later

Before beta: create/separate clean staging, close critical service APIs, establish command/repository boundary for core workflow, verify RLS, stop browser entitlement/financial/workout critical writes, backups and monitoring.

After beta: broader read migration, Auth/provider reassessment, Storage replacement if needed, legacy admin/program/automation/report cleanup.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Confidence |
|---|---|---|
| Recover old remote after clean staging | Only if founder confirms valuable/auditable data | Medium |
| Use Supabase Storage for ProgressPhoto | Proposed; logo-only use may remain limited | Medium-low |
| Exact direct browser read allowlist | Define after RLS/read-model tests | Medium |
