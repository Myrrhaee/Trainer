# PostgreSQL RLS and Authorization Security Audit v1

Status: static/local evidence only. All Critical findings are accepted beta blockers. The current unknown legacy remote is not used for security validation; canonical RLS is validated in clean staging.

## Threat boundaries

- Browser is untrusted even after login.
- Athlete may access only own profile/workout facts and active session mutations.
- Trainer requires capability, ownership and canonical relation for athlete data.
- Server backend must authenticate caller/event before privileged use.
- Service role bypasses RLS and is a high-impact secret, not an authorization mechanism.
- Public trainer projection must never expose athlete/private profile fields.

## Local table policy findings

| Table | Local policy summary | Finding | Severity |
|---|---|---|---|
| `exercise_library` | System visible; owner CRUD via `auth.uid()` | Directionally sound; hard delete/cascade conflicts with archive; remote unknown | Medium |
| `trainer_workout_reviews` | Trainer/self-reviewed-client; relation via `profiles.trainer_id` | Wrong canonical relation, mutable/date source, hard delete; SECURITY DEFINER seen RPC date ambiguity | High |
| `trainer_builder_templates` | Trainer owner CRUD | Ownership sound locally; no immutable revision/archive; direct browser write | Medium |
| `trainer_settings` | Owner select/insert/update | No explicit role target/force RLS; JSON security section writable by owner by design; remote unknown | Medium |
| `trainer_client_messages` | Participant read/insert; trainer update | No relation check; trainer/client can name arbitrary counterpart; trainer update can alter broad row fields | High |
| `trainer_automation_rules` | Trainer-id owner CRUD | No capability proof beyond ID; non-core | Medium |
| `trainer_client_insights` | Trainer-id owner CRUD | Client may be arbitrary/null; no relation check; derived score risks independent truth | High |
| `trainer_client_reports` | Trainer CRUD; client reads sent | Trainer may target arbitrary client; no canonical relation; hard delete | High |
| Core code-only tables | Remote/local policies unavailable | Profiles, relation, assignments, logs, weight and payments have unknown RLS | Critical |

Local count: 32 policies, RLS enabled on 8 tables, no FORCE RLS statement. Remote counts/state: unknown.

## Function findings

| Function | Finding | Severity |
|---|---|---|
| `copy_system_exercise_to_my_library` | SECURITY DEFINER; checks `auth.uid()`, fixed `public` search path and explicit grants; owner/search-path/grants must be verified remotely | Medium |
| `mark_trainer_workout_review_seen` | SECURITY DEFINER; client constrained by `auth.uid()`, but date-only update can match multiple trainers and lacks source session | High |
| Four updated-at functions | Standard trigger logic; no explicit search path/grant hardening | Low-medium |

## API findings

| Finding | Evidence | Severity / beta impact |
|---|---|---|
| Unauthenticated service-role profile/role/relation mutation using body user ID | `app/api/ensure-profile/route.ts` | Critical; block beta |
| Unauthenticated Auth Admin test-user creation and credential disclosure | `app/api/seed-test-users/route.ts` | Critical; block beta |
| Unauthenticated service-role reminder by arbitrary client ID plus external side effect | `app/api/send-reminder/route.ts` | Critical; block beta |
| Telegram webhook lacks verified webhook secret and logs full update | `app/api/tg-webhook/route.ts` | Critical/high; block public beta |
| Legacy client can set own paid flag directly | `app/(client)/client/[id]/page.tsx` | Critical entitlement bypass if current RLS permits; block beta |
| Payment webhook uses generic secret, no provider-signature/idempotency evidence | `app/api/webhooks/payment/route.ts` | High; block payment beta |
| Completion notification trusts body client ID; proxy proves session only, not subject/relation; no durable completion | notify route + proxy | High; block canonical completion |
| Trainer program API authenticates and checks string role/ownership but lacks transaction/idempotency/audit | trainer programs route | High for target command, legacy otherwise |
| Link trainer verifies JWT but performs profile update/delete/insert without transaction and duplicates relation truth | link route | High |
| Proxy covers only `/dashboard/*` and notify API; trainer/client/API families rely on client guards/RLS | `proxy.ts` | High defence gap |

## Direct browser findings

- Workout set rows are appended directly without canonical session/set idempotency.
- Weight insertion and profile current-weight update run in parallel, allowing partial success.
- Browser inserts financial payment records.
- Legacy client toggles paid entitlement.
- Browser updates relation access, templates, messages and settings.
- Profile and public catalog safety depends on unknown remote `profiles` RLS.

## Stage 3 requirement coverage

| Requirement | Static conclusion |
|---|---|
| Trainer sees only related athletes | Not proven; several policies use no relation or wrong relation source |
| Athlete sees only own records | Proven only for some local policies; core remote unknown |
| Athlete cannot alter template/prescription | Not proven for code-only tables |
| Athlete edits only own active session | Canonical session absent |
| Trainer cannot rewrite completed logs | Not proven; logs schema/RLS unknown |
| Related trainer alone creates feedback | Canonical feedback absent |
| Client cannot edit TrainerFeedback | Canonical feedback absent |
| AttentionItem owner-only | Canonical table absent |
| Public trainer projection safe | Code selects allowlisted fields, but underlying profile policy is unknown |

## Portability implications

PostgreSQL RLS is portable; `auth.uid()`, Supabase JWT roles and service-role behavior are not. Isolate identity helper/policy migrations and duplicate authorization in server commands. Another provider needs a session identity strategy or backend-only DB access.

## Recommended fix order

### Before schema implementation

1. Define authentication, capability, ownership and TrainerAthleteRelation authorization boundary.
2. Prohibit new privileged/critical browser writes.
3. Define provider-neutral server command and repository contracts.

### Before vertical slice

1. Implement canonical migrations in clean staging.
2. Integrate Supabase Auth through actor adapter.
3. Add canonical RLS and negative unrelated-actor tests.
4. Implement transactional commands and service-role isolation.

### Before beta

1. Remove or protect unauthenticated service-role/test/admin endpoints.
2. Close paid-access self-activation and browser payment/workout critical writes.
3. Verify all canonical RLS, privileged grants and SECURITY DEFINER ownership/search path.
4. Remove test/admin actions from public runtime and perform access review.

## Decision candidates for Product Lead review

| Candidate | Recommendation | Urgency |
|---|---|---|
| Exact safe browser read allowlist | Proposed after canonical RLS/read-model tests | Before beta |
| ProgressPhoto Storage/RLS scope | Proposed pending privacy/product decision | Before sensitive media |
| Recover old remote for security evidence after staging | Proposed only if founder confirms audit value | Later |
