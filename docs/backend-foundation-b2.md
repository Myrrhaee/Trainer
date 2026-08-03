# Backend Foundation B2

- Date: **2026-08-03**
- Status: **implementation complete locally; transactional delivery pending**
- Scope: email OTP challenges, account resolution, application-session issuance, logout APIs and canonical login UI

## Implemented

1. `verification_challenges` stores only HMAC hashes of the email target, OTP secret and request IP. Plaintext email addresses and codes are not stored in challenge rows.
2. Six-digit codes are cryptographically generated, expire after 10 minutes by default, are single-use and allow five attempts by default.
3. Resend invalidates the previous open challenge. Per-target and per-IP limits plus a resend cooldown are enforced inside PostgreSQL transactions.
4. Request responses remain generic for invalid, throttled and accepted targets, preventing account enumeration at the API boundary.
5. Successful verification atomically resolves or creates one `email_otp` identity and canonical user, then issues the B1 application session.
6. Session cookies remain opaque, `HttpOnly`, `SameSite=Lax` and `Secure` in production. Current-device and all-device logout routes revoke server sessions.
7. Same-origin POST checks and an 8 KB JSON limit protect the new auth endpoints.
8. `/login` is the canonical email OTP surface. `/signup` redirects to it while preserving trainer invitation context.
9. The previous Supabase/demo login remains available only when `NEXT_PUBLIC_DEMO_MODE=true`.
10. Local development uses an in-memory delivery adapter and may show the synthetic code in the UI. Production cannot disclose that code and fails closed until a real adapter is configured.

## Evidence

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| Clean PostgreSQL 16 applies B1 and B2 migrations | pass | `database/migrations/0001_backend_foundation.up.sql`, `database/migrations/0002_email_otp.up.sql` |
| New and returning email resolve consistently | pass | `tests/backend-foundation/email-otp-postgres.test.ts` |
| Expired, exhausted, consumed and replayed codes fail | pass | PostgreSQL integration tests plus live API replay check |
| Resend invalidates the earlier challenge | pass | PostgreSQL integration test |
| Target/IP throttling does not disclose delivery state or race past the IP limit | pass | Sequential and concurrent PostgreSQL integration tests plus generic API contract |
| OTP comparison is constant-time after equal-length validation | pass | `lib/server/auth/email/email-otp-repository.ts` |
| Browser request, verify and completion flow | pass locally | `/login` against disposable PostgreSQL 16 and memory delivery |
| Session cookie, replay rejection and logout revocation | pass locally | live same-origin API check; server session marked `logout` |
| Signup context preservation | pass locally | `/signup?trainer=trainer-demo-42` redirects to `/login?trainer_id=trainer-demo-42` |
| 390 x 844 layout has no horizontal overflow | pass locally | browser geometry check; content remains within 16-374 px |
| Lint, TypeScript and production build | pass | `npm run lint`, `npx tsc --noEmit`, `npm run build` |

## Runtime Configuration

- `AUTH_OTP_PEPPER` is mandatory in production and must contain at least 32 bytes.
- `AUTH_EMAIL_DELIVERY_MODE=memory` is accepted only outside production.
- `AUTH_DEV_OTP_DISCLOSURE=false` hides the local code; production always hides it.
- TTL, resend, rate-window and attempt defaults are configurable through server-only environment variables in `lib/server/auth/email/email-otp-config.ts`.

## Deliberately Not Implemented

- No transactional email provider, sender domain, SPF, DKIM or DMARC setup exists yet.
- No Google or Telegram provider/linking flow is part of B2.
- Authentication creates a user identity but does not grant Trainer or Athlete capability.
- The success screen does not route into a cabinet until B4 capability and invitation rules exist.
- Existing product route guards and legacy Supabase-backed screens are not migrated in B2.
- No real identity or personal data is approved for the local/disposable environment.

## Operational Gate

Before staging or external authentication testing, accept B0-OD-001 and B0-OD-004, provision managed PostgreSQL, configure a transactional email provider and verified sender domain, store the OTP pepper in managed secrets, and run deliverability plus abuse tests. Until then B2 is a verified local implementation, not a production login system.

## Next Stage

B3 may implement Google and Telegram adapters against the same account-resolution and application-session boundary. B4 remains responsible for Trainer/Athlete capability assignment, invitations and post-login routing.
