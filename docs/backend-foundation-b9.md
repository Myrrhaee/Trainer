# Backend Foundation B9

- Date: **2026-08-03**
- Status: **local readiness gate complete; external staging remains blocked by founder/platform inputs**
- Scope: closed-alpha deployment configuration, schema preflight and safe readiness

## Implemented

1. The application resolves an explicit `APP_ENV` profile: `local`, `test`, `staging` or `production`. A production Node runtime without `APP_ENV` is treated conservatively as production and fails readiness until the external contract is complete.
2. Staging and production require separate app, authenticator and health PostgreSQL identities, encrypted non-loopback URLs, HTTPS canonical origin, distinct auth secrets, disabled development OTP disclosure, disabled demo/legacy escape hatches and a release identifier.
3. Migration credentials are accepted only by the operator preflight context and are rejected when exposed to the application runtime.
4. A dedicated `ai_strength_health` role can read checksummed migration metadata and connection liveness only. It cannot read product users or private sessions.
5. `npm run ops:preflight` compares every local canonical migration checksum with the target database, verifies expected role membership and proves health-role isolation. It prints check codes only, never connection strings or secret values.
6. `/api/health/ready` now combines configuration, role and schema checks. Its public response remains only `ready` or `unavailable` with `Cache-Control: no-store`.
7. External readiness deliberately fails while the repository has no real transactional email adapter. Setting an arbitrary delivery-mode string cannot create a false-positive staging state.

## Deployment Contract

### Runtime only

- `APP_ENV`
- `APP_RELEASE`
- `DATABASE_APP_URL`
- `DATABASE_AUTH_URL`
- `DATABASE_HEALTH_URL`
- application auth/provider secrets

The runtime must not receive `DATABASE_MIGRATION_URL` or generic `DATABASE_URL` in staging/production.

### Operator preflight only

- all three runtime database URLs;
- `DATABASE_MIGRATION_URL`;
- the same non-secret deployment profile metadata needed by static validation.

The migration identity is not part of the deployed application's environment.

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean PostgreSQL 16 bootstrap and migrations through `0009` | pass |
| B9 rollback -> preflight | expected fail on `0009` and expected schema |
| B9 remigrate -> preflight | pass |
| Local preflight checks | 15/15 pass: nine migrations, schema pointer, three roles, two isolation checks |
| Full backend suite | pass, 43/43 |
| Health role reads migration metadata | pass |
| Health role reads `app.users` or `app_private.sessions` | denied |
| HTTP readiness in test profile | `200`, generic `ready` body |
| HTTP readiness in staging without email adapter | `503`, generic `unavailable` body |
| Secret value in validator report | absent by test |
| TypeScript, lint and production build | pass |

All infrastructure and identities used for verification were synthetic and disposable.

## External Blockers

- Select managed PostgreSQL provider, region, billing owner, secret owner and access policy.
- Provision separate login identities mapped to the four non-login group roles and demonstrate backup restore.
- Select and implement a transactional email provider plus verified sender domain.
- Decide whether assignment/feedback notifications are in-product only for closed alpha or require an external channel.
- Define support-led recovery for complete credential loss.
- Register Google/Telegram non-production applications before those buttons are advertised as working in alpha.

## Next Step

Do not add B10 product scope yet. First close the infrastructure inputs above, execute `docs/closed-alpha-staging-runbook.md`, and capture one real staging rehearsal with two synthetic accounts and no production personal data.
