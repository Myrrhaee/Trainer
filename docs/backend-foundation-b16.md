# Backend Foundation B16: Real Three-Participant Registration

- Date: 2026-08-04
- Status: **registration ceremony implemented; real participants not yet registered**
- Scope: one self-registering trainer, two self-registering athletes and a least-privilege staging activation boundary

## Implemented

1. Login now explicitly presents itself as both registration and sign-in. A new account is still created only after successful email OTP verification.
2. Migration `0011_closed_alpha_operator` introduces `ai_strength_operator`, a no-login, no-bypass-RLS group role with access only to two security-definer functions.
3. Trainer activation accepts only an existing active account with a verified identity and pending trainer request. Repeats are idempotent.
4. Activation writes a pseudonymous operator reference and immutable release reference to the audit log. Email addresses are not copied into event metadata.
5. Cohort status returns booleans and stable blocker codes for exactly one trainer and two athletes. It does not return email addresses, names, IDs or invitation tokens.
6. `npm run alpha:operator` is restricted to staging/test, requires `DATABASE_OPERATOR_URL`, refuses production/local execution and requires exact release confirmation for activation.
7. Participant emails are read from a mode-`0600`, Git-ignored `.alpha-cohort*.json` file instead of command-line arguments or tracked configuration.
8. External preflight requires a distinct operator identity and a non-placeholder `ALPHA_OPERATOR_REF`; app runtime rejects operator credentials.

## Deliberately Not Done

- No participant account was created by code or operator.
- No real email address, invitation token or personal data was added to the repository.
- No trainer was activated in a real environment.
- No staging URL, Resend delivery or managed database exists yet, so the live ceremony cannot be claimed complete.
- No public admin endpoint or operator UI was added.

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean bootstrap and migrations `0001-0011` | pass |
| Migration `0011` rollback and remigrate | pass |
| Backend suite on disposable PostgreSQL | 67/67 pass |
| Operator direct read of `app.users` | denied with PostgreSQL `42501` |
| Pending trainer activation and idempotent repeat | pass |
| Audit metadata excludes participant email | pass |
| One-trainer/two-athlete readiness without PII | pass |
| Local preflight through expected schema `0011` | pass |
| Canonical browser registration/invitation/workout loop | 2/2 pass |
| ESLint and TypeScript | pass |
| Next.js production build | pass |
| Real three-person staging ceremony | not run; external environment and participant addresses unavailable |

## Completion Gate

B16 becomes operationally complete only after the three people execute `docs/closed-alpha-registration-runbook.md` on the approved staging release and the operator status reports `READY`. Until then, the repository implementation is complete but the real registration outcome remains pending external B15 provisioning and participant input.
