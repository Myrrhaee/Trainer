# Closed Alpha Staging Runbook

- Status: **executable locally; external provisioning blocked**
- Canonical schema: migrations `0001` through `0010`
- Data rule: staging starts with synthetic accounts only

## Required Owners

| Responsibility | Required owner before provisioning |
| --- | --- |
| Provider, region and billing | Founder |
| Database owner and migration approval | Engineering lead |
| Runtime and migration secrets | Platform/security owner |
| Backups and restore rehearsal | Platform owner |
| Email provider, domain and deliverability | Founder + platform owner |
| Trainer activation and alpha support | Named operator |
| Incident and credential-loss recovery | Founder + security owner |

Do not provision real users until every row has a named person.

## Environment Separation

Use separate local, staging and production databases, credentials and provider applications. The unknown legacy Supabase project remains read-only/unknown and is not a migration target.

Runtime receives only:

```text
APP_ENV=staging
APP_RELEASE=<immutable commit or release id>
DATABASE_APP_URL=<app login with ai_strength_app membership>
DATABASE_AUTH_URL=<auth login with ai_strength_authenticator membership>
DATABASE_HEALTH_URL=<health login with ai_strength_health membership>
DATABASE_WORKER_URL=<worker login with ai_strength_worker membership>
AUTH_PUBLIC_ORIGIN=https://<staging origin>
AUTH_OTP_PEPPER=<managed secret, at least 32 bytes>
AUTH_FLOW_SECRET=<different managed secret, at least 32 bytes>
AUTH_DEV_OTP_DISCLOSURE=false
AUTH_EMAIL_DELIVERY_MODE=<implemented production adapter>
NEXT_PUBLIC_DEMO_MODE=false
```

The runtime must not receive `DATABASE_MIGRATION_URL`, generic `DATABASE_URL`, legacy Supabase service-role credentials or local development disclosure flags.

## Provisioning Sequence

1. Create the clean managed PostgreSQL staging database in the approved region.
2. Create a short-lived owner connection for bootstrap only.
3. Run `npm run db:bootstrap` to create the non-login group roles.
4. Create five separate login identities and grant only their matching group roles: migrator, authenticator, app, health and worker.
5. Remove owner credentials from the operator environment after the dedicated migration identity is proven.
6. Run `npm run db:migrate` with `DATABASE_MIGRATION_URL` from an approved migration job.
7. Run `npm run ops:preflight` from an isolated operator job containing all five database URLs. A nonzero exit blocks deployment.
8. Deploy the application with runtime-only variables.
9. Require `/api/health/ready` to return HTTP 200 before routing alpha traffic.
10. Record release ID, migration checksums, preflight output, owner and timestamp without recording secrets.

## Staging Acceptance

Use two independent synthetic accounts and verify:

1. Email OTP creates and returns to the same identity.
2. Operator activates the trainer capability.
3. Trainer invitation creates one active athlete relation.
4. Trainer saves/publishes a template and assigns its immutable snapshot.
5. Athlete starts, resumes and partially completes a workout.
6. Completion creates exactly one trainer review item.
7. Trainer reads exact plan-vs-actual facts and sends feedback.
8. Queue resolves only after feedback persistence.
9. Athlete sees the same immutable feedback and a follow-up.
10. Unrelated users receive no route, query or command access.

Capture request IDs and aggregate timings only. Do not put OTPs, tokens, email addresses, feedback bodies or connection details in the evidence bundle.

## Backup And Restore Gate

Before closed alpha:

1. Create a provider-managed backup containing synthetic data only.
2. Restore it into a separate disposable database.
3. Run `npm run ops:preflight` against the restored database.
4. Re-run the full backend suite and one read-only staging flow.
5. Record recovery point, recovery time and responsible owner.
6. Destroy the restored test environment according to the approved retention policy.

A dashboard showing that backups are enabled is not restore evidence.

## Release And Rollback

- Application rollback may return to the previous immutable release only when its expected schema is compatible with the applied additive migrations.
- Do not automatically run `npm run db:rollback` during application rollback.
- Stop rollout when preflight reports checksum drift, missing migration, wrong role or health isolation failure.
- A failed migration remains an engineering incident; do not edit an already applied migration file.
- Revoke exposed credentials before investigating with replacement secrets.

## Current Stop Conditions

Staging deployment must remain blocked while any of these is true:

- no named provider/region/owners;
- no separate database identities;
- no demonstrated restore;
- no implemented transactional email adapter;
- development OTP disclosure or demo/legacy mode enabled;
- migration identity present in runtime;
- preflight nonzero;
- readiness HTTP 503;
- real personal data proposed before privacy/retention ownership is accepted.
