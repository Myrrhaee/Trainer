# External Placement Runbook

- Target: first closed-alpha staging environment
- Reference runtime: Vercel-compatible Next.js host
- Required external services: managed PostgreSQL and Resend
- Current state: prepared in repository, not provisioned

## Architecture Boundary

The browser talks only to the public HTTPS Next.js application. The application uses four distinct PostgreSQL runtime identities: app, authenticator, health and worker. Migration and closed-alpha operator identities exist only in isolated operator environments. Resend receives OTP email requests from server-side code only. No database URL, OTP pepper, flow secret, provider token or migration credential may use a `NEXT_PUBLIC_` prefix.

Per the B17 pilot decision, Telegram notifications, browser sign-in and the Mini App are not dependencies of the first three-participant deployment. Notifications remain disabled unless the evidence and operational gates in `docs/backend-foundation-b17.md` are satisfied. Email OTP is required because users need a working sign-in path before an external environment may report ready.

## Founder Inputs

Before provisioning, record these decisions outside Git:

| Decision | Required value |
| --- | --- |
| Public host and billing owner | named provider account and owner |
| Staging origin | final HTTPS origin |
| PostgreSQL provider | provider, region and billing owner |
| Data residency | approved region for alpha data |
| Sender domain | verified domain and `From` address |
| Secrets owner | person responsible for rotation and revocation |
| Backup owner | person responsible for restore evidence |
| Alpha operator | person activating trainers and handling access incidents |

Do not invite real participants while any owner is blank.

## Secret Sets

Use `deployment/staging-runtime.env.example` as the runtime key list. Enter values directly in the hosting provider secret store; do not create a tracked `.env` file. The runtime must not receive `DATABASE_MIGRATION_URL`, generic `DATABASE_URL`, owner credentials or legacy Supabase service-role credentials.

Use `deployment/staging-operator.env.example` only in an isolated migration/preflight shell. Remove the file or secret injection after the job. The environment contains separate migration and closed-alpha operator identities and must never be attached to a web deployment.

The tracked examples are intentionally not deployable: `ops:validate-config` rejects their `replace-*` values. Copy the key list into the provider secret store and replace every placeholder before expecting a passing gate.

Generate `AUTH_OTP_PEPPER` and `AUTH_FLOW_SECRET` independently. Both must contain at least 32 random bytes and must not equal each other. Scope `RESEND_API_KEY` to email sending only. Verify `AUTH_EMAIL_FROM` in Resend before the first delivery test.

## Provisioning Order

1. Create the managed PostgreSQL database with encrypted external connections and provider-managed backups.
2. Bootstrap the non-login group roles with a short-lived owner connection.
3. Create six distinct login identities and grant only the matching canonical group role.
4. Inject `deployment/staging-operator.env.example` values into an isolated shell.
5. Run `npm run db:migrate` and `npm run ops:preflight`.
6. Configure the public host from `deployment/staging-runtime.env.example` with `APP_RELEASE` set to the immutable Git commit.
7. Configure and verify the Resend sender domain, then deploy the exact tested commit.
8. Check HTTP readiness and run `EXTERNAL_BASE_URL=https://<origin> npm run ops:smoke-external`.
9. Send one OTP to a synthetic inbox and confirm delivery, expiry and one-time verification.
10. Rehearse the canonical trainer and two-athlete flow with synthetic identities before inviting the alpha group.

For Vercel, bind secret variables to the staging/preview environment only. A linked `.vercel` directory and pulled `.env.local` remain local and ignored. No Git-based auto-deploy should be enabled until the preflight owner and rollback owner are named.

## Release Gate

Run locally against a disposable PostgreSQL database:

```bash
npm run test:backend:postgres
npm run test:e2e:canonical
npm run lint
npx tsc --noEmit
npm run build
```

Run in the isolated external operator environment:

```bash
npm run ops:validate-config -- --context=preflight
npm run ops:preflight
```

Run after deployment:

```bash
EXTERNAL_BASE_URL=https://staging.example.com npm run ops:smoke-external
```

Every command must pass for the same `APP_RELEASE`. Store only check codes, commit hash, timestamps and named owners as evidence. Never store email addresses, OTPs, cookies, tokens or connection strings in the release record.

## Rollback And Recovery

Application rollback means promoting the previous immutable release only when it is compatible with the applied additive schema. Do not automatically roll back database migrations. If readiness fails, remove traffic first, preserve generic logs, and rotate any credential suspected of exposure.

Before real alpha data, restore a provider backup into a separate disposable database and run preflight against it. Backup-enabled status is not sufficient; a successful restore is the gate.

## Remaining Stop Conditions

- No approved provider, region, domain or named owners.
- No managed database identities or backup restore evidence.
- No verified Resend sender and synthetic OTP delivery evidence.
- No deployed HTTPS origin with passing readiness and smoke checks.
- Migration credentials present in runtime.
- Demo, legacy or development OTP disclosure enabled externally.
- Real participant data proposed before retention, deletion and support ownership are accepted.
