# Internal Pilot Deployment Hardening v1

Дата проверки: 2026-09-05
Ветка реализации: `codex/internal-pilot-deployment-hardening`
Базовый deployment gate: `fb810af` (`docs(deployment): define internal pilot rollout gate`)

## 1. Verdict

**Repository/runtime hardening: PASS после полного локального gate.**

**Итоговый статус: READY FOR OPERATOR ROLLOUT PREP.**

Это не `GO FOR ROLLOUT` и не разрешение изменять внешнюю Neon database. Внешний кандидат остаётся на `0011_closed_alpha_operator`; migration `0012..0016`, роли, grants и данные в рамках этого прохода не изменялись.

`GO FOR ROLLOUT` остаётся заблокирован, пока operator не определит фактическое pilot environment и `<PILOT_ORIGIN>`, не создаст runtime credentials, не подтвердит backup/restore evidence и не выполнит финальный read-only preflight.

## 2. Previous HOLD causes

Reviewed gate `docs/internal-pilot-deployment-gate-v1.md` зафиксировал:

- `PRODUCT READINESS = PASS`, `DEPLOYMENT READINESS = HOLD`;
- внешний Neon candidate на `0011`, pending chain `0012..0016`;
- 0 canonical product rows и 0 известных provenance/ownership anomalies;
- единственный доступный внешний login является managed owner с `BYPASSRLS` и непригоден для runtime;
- backup/restore evidence и application origin отсутствуют;
- runtime schema marker ошибочно ожидал `0011`;
- standalone upgrade harness после unrestricted migrate ошибочно ожидал `0015`.

Последние два пункта были repository blockers и устранены этим проходом. Остальные пункты остаются operator/environment gates.

## 3. Exact process and connection map

Карта выведена из `lib/server/database/config.ts`, repository constructors, `scripts/notifications/drain.ts`, `scripts/db/*`, `scripts/ops/closed-alpha.ts` и PostgreSQL grants.

| Process | Connection variable | Expected principal | Write | DDL | BYPASSRLS | Expected RLS behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Web/application runtime | `DATABASE_APP_URL` | restricted login, member of `ai_strength_app` only among operationally relevant roles | Yes | No | Forbidden | All business reads/writes run under FORCE RLS with transaction-local `app.actor_user_id` |
| Auth runtime | `DATABASE_AUTH_URL` | restricted login, member of `ai_strength_authenticator` | Yes | No | Forbidden | Uses narrow identity/session grants and auth policies; must not inherit app, worker or operations privileges |
| Readiness/schema check | `DATABASE_HEALTH_URL` | restricted login, member of `ai_strength_health` | No | No | Forbidden | Can connect and read `public.app_schema_migrations`; cannot read product or private session data |
| Notification worker | `DATABASE_WORKER_URL` | restricted login, member of `ai_strength_worker` | Yes | No | Forbidden | Uses explicit worker grants for outbox claim/delivery state and recipient lookup; required only when delivery is enabled |
| Migration runner | `DATABASE_MIGRATION_URL` | isolated operations login, member of `ai_strength_migrator` | Yes | Yes | Not required | Runner executes `SET LOCAL ROLE ai_strength_migrator`, validates ownership and applies the immutable migration chain |
| Manual/closed-alpha operator | `DATABASE_OPERATOR_URL` | isolated operations login, member of `ai_strength_operator` | Narrow audited commands | No for operator command | Not required | Uses reviewed SECURITY DEFINER operator functions; never serves product requests |

### Minimal role decision

`app`, `auth` and `health` need separate logins because their grants are intentionally incompatible. `worker` also needs a separate login when a worker process is enabled; with `NOTIFICATION_DELIVERY_MODE=disabled`, no worker process or `DATABASE_WORKER_URL` is required.

`migration` and manual `operator` may use one isolated operations login for the internal pilot if that login is a member of both group roles. Separate credentials remain preferable for a larger environment, but are not required by current command ownership. The shared operations login must never be present in the web runtime environment.

Runtime principal checks reject superuser, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, replication, and membership in `ai_strength_migrator` or `ai_strength_operator`. Merely being a member of `ai_strength_app` is no longer sufficient for readiness.

## 4. Code and runtime fixes

| Area | Previous behavior | Hardened behavior |
| --- | --- | --- |
| Runtime schema marker | Expected `0011_closed_alpha_operator` | Expects `0016_workout_session_completion` and migration count 16 |
| Schema health | Passed when the expected row merely existed | Classifies exact current, outdated, ahead/unknown and inconsistent states; only exact `0016`/16 is ready |
| Runtime DB identity | Checked expected group-role membership only | Also rejects privileged or operations-capable login identities |
| Migration preflight | Checked local checksums but ignored extra ledger rows | Requires exact expected chain and rejects unknown ledger entries |
| DB identity count | Required six distinct usernames | Requires isolated app/auth/health and conditional worker; permits one migration/operator operations login |
| Worker config | Required even when notifications disabled | Required only when worker delivery is enabled or explicitly configured |
| Eager legacy Supabase | Unspecified dummy values | Requires exact inert public constructor sentinels in external config |
| Upgrade harness | Unrestricted migrate expected `0015` | Verifies `0011 -> 0012 -> 0013 -> 0014 -> 0015 -> 0016`, count 16 and repeatability |

No API, product route, product UI or migration SQL changed.

## 5. Schema-version contract

Canonical migration source remains the ordered immutable `database/migrations/*.up.sql` chain. Runtime code uses the reviewed deployment constant in `lib/server/runtime/schema-version.ts`:

- expected latest: `0016_workout_session_completion`;
- expected ledger count: 16;
- expected ordered ledger: exact canonical `0001..0016` names.

`lib/server/database/health.ts` reads the ledger through `DATABASE_HEALTH_URL` and returns:

- `current`: the ordered ledger exactly matches all canonical names `0001..0016`;
- `outdated`: the ledger is an older canonical subset and does not include the target;
- `ahead_or_unknown`: any unknown ledger name is present;
- `inconsistent`: `0016` exists but one or more earlier canonical entries are missing.

Only `current` is ready. An `0011` database now returns `database_schema_outdated`; an ahead/unknown database cannot false-pass.

Copies of schema-version knowledge are limited to the runtime ordered-name constant, migration filenames and assertions in the upgrade tests/docs. `scripts/ops/preflight.ts` imports the latest runtime constant and independently derives the complete checksum registry from migration files.

## 6. Migration harness

`scripts/test/run-migration-upgrade-postgres.mjs` now proves:

1. bootstrap and migration through exact `0011`;
2. deterministic ordered upgrades through each `0012`, `0013`, `0014`, `0015`, `0016` boundary;
3. final latest migration `0016`, count 16;
4. second full migrate is idempotent;
5. lifecycle and exercise backfills remain intact;
6. a terminal Session created before `0016` receives `overall_comment`, `discomfort_reported` and `discomfort_comment` as `NULL`;
7. `0016` helper, trigger and columns exist after upgrade and disappear under the existing rollback test;
8. existing ownership recovery and lossy `0015` rollback guard remain active.

Fresh installation through `0016` is also exercised by `scripts/test/run-backend-postgres.mjs`. No old migration file was edited.

## 7. Canonical pilot environment contract

### Web runtime

Required names and semantics:

| Variable | Contract |
| --- | --- |
| `APP_ENV` | `staging` for the internal pilot |
| `APP_RELEASE` | Immutable reviewed commit identifier |
| `AUTH_PUBLIC_ORIGIN` | Exact first-party HTTPS `<PILOT_ORIGIN>`; existing application equivalent of `APP_ORIGIN` |
| `DATABASE_APP_URL` | Restricted app login, never owner/BYPASSRLS |
| `DATABASE_AUTH_URL` | Restricted authenticator login |
| `DATABASE_HEALTH_URL` | Restricted health-only login |
| `DATABASE_WORKER_URL` | Required only when notification delivery is enabled |
| `AUTH_OTP_PEPPER` | Secret, at least 32 bytes |
| `AUTH_FLOW_SECRET` | Different secret, at least 32 bytes |
| `AUTH_DEV_OTP_DISCLOSURE` | `false` |
| `AUTH_EMAIL_DELIVERY_MODE` | `resend` |
| `RESEND_API_KEY` | Secret provider credential |
| `AUTH_EMAIL_FROM` | Verified sender address |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| Legacy Supabase feature flags | false/unset |
| `NOTIFICATION_DELIVERY_MODE` | `disabled` or explicitly approved `telegram` |

Runtime must not receive `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `DATABASE_OPERATOR_URL`, a real legacy Supabase URL/key, or any service-role secret.

### Operator/preflight job

The isolated job receives the same non-secret release/origin contract plus runtime URLs for verification, `DATABASE_MIGRATION_URL`, `DATABASE_OPERATOR_URL` and pseudonymous `ALPHA_OPERATOR_REF`. Migration and operator URLs may identify the same operations login, but that login must satisfy both expected group-role checks and must differ from every runtime login.

No actual origin is invented here. Deployment remains HOLD until the operator supplies and verifies `<PILOT_ORIGIN>`.

## 8. Health and readiness contract

For staging/production, `/api/health/ready` returns ready only when:

1. deployment config is complete;
2. demo mode and legacy feature gates are disabled;
3. the health connection can execute `SELECT 1`;
4. app, auth and health connections activate their expected group roles;
5. their current principals are restricted and have no operations membership;
6. migration ledger is exactly current at `0016` with 16 entries.

The health connection is used only for liveness and migration metadata. App-role isolation is checked using `DATABASE_APP_URL`; a privileged owner connection cannot be substituted to prove application RLS behavior. Public response remains minimal (`ready` or `unavailable`) and does not expose issue details.

## 9. Eager Supabase prerequisite

Canonical facts remain PostgreSQL-only. The legacy client is still created eagerly by `app/client/me/page.tsx`, so external build/boot needs public constructor values even when all legacy branches are disabled.

The accepted temporary contract is exact:

```text
NEXT_PUBLIC_SUPABASE_URL=https://legacy-supabase-disabled.invalid
NEXT_PUBLIC_SUPABASE_ANON_KEY=legacy-supabase-disabled-public-anon-key
```

These values are public inert sentinels, not secrets and not a real Supabase project. External config validation rejects absent values and any real/different project values. Canonical smoke must still prove no request to the dummy host or `.supabase.co`.

## 10. Test evidence

Final local evidence:

| Gate | Result |
| --- | --- |
| Deployment/config/schema classifier targeted tests | PASS, 14/14 |
| Integrated PostgreSQL preflight and restricted app-principal assertion | PASS inside the full PostgreSQL suite |
| Fresh install through `0016` | PASS |
| Disposable explicit `0011 -> 0012 -> 0013 -> 0014 -> 0015 -> 0016` upgrade | PASS, latest `0016`, count 16 |
| Migration repeatability, rollback checks and legacy ownership recovery | PASS |
| Full PostgreSQL suite | PASS, 175/175 |
| TypeScript | PASS, `npx tsc --noEmit --incremental false` |
| ESLint | PASS |
| Production build | PASS, Next.js 16.2.12 Turbopack, 57/57 static pages generated |
| Canonical E2E | PASS, 12/12 on Turbopack in an isolated worktree and disposable PostgreSQL database |
| `git diff --check` | PASS |

Canonical E2E was isolated because boot/readiness code changed and another checkout already owned a Next development lock. The isolated run reused only the healthy local PostgreSQL service, created and removed its own database, and did not query or mutate external Neon.

No real credentials are embedded in tests or tracked environment examples.

## 11. Remaining operator actions

1. Choose and record the exact pilot hosting project and database.
2. Supply the exact HTTPS `<PILOT_ORIGIN>` and configure it consistently.
3. Provision restricted app, auth and health credentials; provision worker only if notifications are enabled.
4. Provision an isolated operations credential with migration/operator memberships, or two equivalent isolated credentials.
5. Configure OTP, flow and Resend secrets in the provider secret store.
6. Set demo mode and all legacy feature flags to false; configure inert public Supabase sentinels.
7. Confirm notification mode and worker identity.
8. Create a verified backup/restore point and record timestamp, owner, retention and restore evidence.
9. Repeat external read-only migration, checksum, provenance, ownership, grant and RLS preflight.
10. Obtain explicit authorization before applying `0012..0016`.
11. Apply the chain only through the reviewed migration runner and verify post-migration catalog/RLS state.
12. Deploy the exact reviewed release, run synthetic two-role smoke and record the final GO/HOLD/STOP decision.

Until all items are evidenced, the correct deployment decision remains **HOLD**, while repository status is **READY FOR OPERATOR ROLLOUT PREP**.

## 12. External database boundary

This hardening pass did not apply migrations, create or alter roles, change grants, create backup artifacts, insert fixture data or mutate configuration in the external Neon database. Previous read-only evidence remains the current external record; it was not promoted to rollout evidence by local test success.
