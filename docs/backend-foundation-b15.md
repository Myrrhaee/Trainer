# Backend Foundation B15: External Placement Preparation

- Date: 2026-08-04
- Status: **repository implementation complete; no external deployment created**
- Scope: deployment-safe email OTP, external configuration validation, environment contracts and post-deploy smoke verification

## Implemented

1. `ResendEmailOtpDelivery` sends the existing six-digit OTP through the fixed Resend HTTPS endpoint. The provider request uses the challenge ID only as an idempotency key and does not log provider bodies, API keys, recipients or OTPs.
2. Staging and production readiness now require `AUTH_EMAIL_DELIVERY_MODE=resend`, a server-only `RESEND_API_KEY` and a valid `AUTH_EMAIL_FROM`. Memory email remains restricted to local/test.
3. External configuration now rejects memory notification delivery. Telegram mode additionally requires a bot token; `disabled` remains the safe closed-alpha default.
4. `npm run ops:validate-config` validates runtime or preflight profiles and prints issue codes only.
5. `deployment/staging-runtime.env.example` and `deployment/staging-operator.env.example` make the migration credential boundary explicit. Both contain placeholders only.
6. `npm run ops:smoke-external` accepts one HTTPS origin and checks readiness, login availability and protected-route redirects without credentials or participant data.
7. `npm run test:backend:postgres` bootstraps an isolated process-scoped database, runs every backend test and removes the database even after failure.
8. `docs/external-placement-runbook.md` defines provisioning order, release gates, rollback and the founder-owned decisions still required.

## Security Properties

- Resend is called only from server-side auth code.
- Provider errors are reduced to a generic HTTP status and response bodies are discarded.
- Runtime readiness cannot pass with memory email, memory notifications, migration credentials, generic `DATABASE_URL`, local hosts, missing TLS, demo mode or legacy runtime flags.
- The public readiness endpoint continues to expose only `ready` or `unavailable`.
- The smoke command does not authenticate and never accepts secrets.

## Deliberately Not Done

- No Vercel project, database, Resend account, sender domain or DNS record was created.
- No real credentials were added to files, Git or command output.
- No push, CI auto-deploy or production alias was configured.
- No backup exists yet, so restore evidence cannot be claimed.
- No live email or Telegram message was sent.
- No external worker scheduler was selected; workout notifications default to disabled externally.

## Verification Evidence

| Check | Result |
| --- | --- |
| Complete synthetic external profile through config validator | pass |
| Tracked placeholder profiles | correctly blocked |
| Backend suite with disposable local PostgreSQL | 64/64 pass |
| Canonical guest/trainer/two-athlete browser suite | 2/2 pass |
| ESLint | pass |
| TypeScript `--noEmit` | pass |
| Next.js production build | pass, 54 static pages generated |
| External HTTPS smoke | not run; no external origin exists |
| Live Resend delivery | not run; no provider account or verified sender configured |
| Managed backup restore | not run; no managed database provisioned |

## External Gate

B15 removes the repository-level email blocker but does not make the product externally available by itself. The founder must approve the host, database provider/region, sender domain, billing and named operational owners. Engineering must then provision the resources, run migrations and preflight, deploy one immutable commit, prove synthetic OTP delivery, run the external smoke command, and demonstrate backup restore before real alpha participants are invited.
