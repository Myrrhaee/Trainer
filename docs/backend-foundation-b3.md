# Backend Foundation B3

- Date: **2026-08-03**
- Status: **implementation complete locally; live provider verification pending**
- Scope: Google Identity Services, Telegram OIDC, federated flow security, account resolution and explicit identity linking/unlinking

## Implemented

1. Short-lived federated flows persist only HMAC hashes of state, nonce and request IP. Login flows are anonymous; link flows are bound to an authenticated user and exact application session.
2. Google credentials are verified server-side with `google-auth-library`, including signature, issuer, audience, expiry and expected nonce. Google `sub` is the identity key.
3. Telegram uses the current OIDC Authorization Code Flow with PKCE, a server-side token exchange and `jose` JWKS verification for issuer, audience, expiry and nonce. Telegram `sub` is the identity key.
4. The Telegram PKCE verifier and nonce are encrypted and authenticated in a short-lived `HttpOnly`, `SameSite=Lax` callback cookie. Raw state and nonce are not persisted.
5. Google and Telegram share one PostgreSQL account resolver. A matching email never performs a silent merge.
6. Existing provider identities log in to their canonical user; new provider subjects create one user and identity atomically.
7. Authenticated users may explicitly link email, Google or Telegram. A provider identity attached to another user produces a conflict and is never transferred.
8. Unlinking is authenticated, audited and blocked when it would remove the last active login identity.
9. Successful linking and unlinking rotate the application session. Provider tokens never become product sessions and are not stored.
10. `/login` exposes Google, Telegram and email entry points. Without credentials, provider buttons fail closed with an accessible email fallback.

## Evidence

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| Clean PostgreSQL 16 applies B1-B3 migrations | pass | `database/migrations/0001_backend_foundation.up.sql` through `0003_federated_identity.up.sql` |
| State/nonce hashes and encrypted callback cookie reject tampering | pass | `tests/backend-foundation/federated-auth.test.ts` |
| Google proof requires matching nonce and uses `sub` | pass with synthetic signed-proof boundary | adapter unit test; live Google keys pending |
| Telegram OIDC proof requires matching nonce and uses `sub` | pass with synthetic JWT boundary | adapter unit test; live Telegram exchange/JWKS pending |
| Telegram authorization URL uses code flow, PKCE and no phone scope | pass | configured-start PostgreSQL test |
| Matching Google/email text does not merge accounts | pass | PostgreSQL account-resolution test |
| Login replay is rejected | pass | consumed-flow PostgreSQL test |
| Linking is bound to the exact user/session | pass | negative PostgreSQL session-binding test |
| Identity attached to another user cannot be stolen | pass | conflict PostgreSQL test |
| Email may be linked to a federated user | pass | email-link PostgreSQL test |
| Last usable identity cannot be removed | pass | unlink PostgreSQL test |
| Linking rotates the server session | pass | email-link/session test |
| Parallel starts cannot race past the IP limit | pass | concurrent PostgreSQL test |
| Browser preserves provider failure fallback and email OTP | pass locally | `/login` against disposable PostgreSQL 16 without provider credentials |
| 390 x 844 layout has no horizontal overflow | pass locally | browser geometry check; auth content remains within 16-374 px |

## Runtime Configuration

- `AUTH_FLOW_SECRET` must contain at least 32 bytes and is mandatory in production.
- `AUTH_PUBLIC_ORIGIN` is mandatory in production and determines the Telegram callback URI.
- `GOOGLE_CLIENT_ID` enables Google start and server verification.
- `TELEGRAM_CLIENT_ID` and `TELEGRAM_CLIENT_SECRET` enable Telegram OIDC start and exchange.
- Telegram BotFather must register `${AUTH_PUBLIC_ORIGIN}/api/auth/telegram/callback` and use RS256 or ES256 for the current `openid profile` implementation.
- Google must register the exact product origin for the web client. No Gmail, Drive, contacts or offline scopes are requested.

## Deliberately Not Implemented

- No real Google or Telegram credentials, provider-console applications or live callback evidence exist yet.
- No access/refresh token is stored and no Google or Telegram data API permission is requested.
- Identity-list/link/unlink backend APIs exist, but account-security management UI is deferred until a canonical settings surface is selected.
- Total credential-loss recovery and exceptional account merge remain support/security policy decisions.
- Authentication still grants no Trainer or Athlete capability; B4 owns invitations, capability activation and post-login routing.
- Existing product route guards and legacy Supabase-backed screens remain outside B3.

## Operational Gate

Before live B3 testing, accept B0-OD-011, create non-production Google and Telegram applications, register exact origins/callbacks, keep secrets outside Git, and run real signature, cancellation, stale-state, replay and browser/webview tests. Managed PostgreSQL and email delivery gates remain required before external alpha use.

## External References

- Google server-side ID-token verification: `https://developers.google.com/identity/gsi/web/guides/verify-google-id-token`
- Google Identity Services JavaScript API: `https://developers.google.com/identity/gsi/web/reference/js-reference`
- Telegram Login/OIDC and JWKS: `https://core.telegram.org/bots/telegram-login`

## Next Stage

B4 may implement Trainer/Athlete capabilities, invitation acceptance, relation authorization and capability-aware post-login routing on top of the canonical application session.
