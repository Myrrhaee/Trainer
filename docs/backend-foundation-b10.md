# Backend Foundation B10: Telegram Identity Bridge

- Date: 2026-08-03
- Status: **local implementation complete; live Telegram and external deployment deliberately deferred**
- Scope: one Telegram identity across browser OIDC, Mini App registration and athlete invitation onboarding

## Implemented Contract

1. The existing login button keeps browser Telegram OIDC and detects signed Mini App context at runtime.
2. `POST /api/auth/telegram/mini-app` validates the raw `Telegram.WebApp.initData` on the server before creating an application session.
3. Validation rejects invalid HMAC signatures, stale/future authentication dates, duplicate fields, bots, malformed users and oversized payloads.
4. The HMAC of each accepted raw payload is stored as the unique state hash of an existing federated login flow. Reusing the same Mini App payload fails before identity resolution.
5. Browser OIDC and Mini App proofs both use the numeric Telegram user ID as canonical `(provider, provider_subject)`. Telegram username is metadata only.
6. A verified 43-character `start_param` becomes the existing one-time athlete invitation at `/onboarding?invite=...`. Unverified URL parameters never create an athlete capability or trainer relation.
7. When `TELEGRAM_BOT_USERNAME` is configured, new athlete invitations prefer `https://t.me/<bot>?startapp=<token>` and also return the ordinary web invitation. Without it, existing web invitations are unchanged.
8. Browser OIDC requests `telegram:bot_access` for notification permission but does not request a phone number.

No new user table, session format, invitation table or migration was introduced. Telegram authentication resolves through the canonical PostgreSQL identity/session repository.

## Runtime Inputs

| Variable | Purpose | Local state |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Verify Mini App HMAC server-side | configured outside Git |
| `TELEGRAM_BOT_USERNAME` | Generate `startapp` invitation links | optional/not required for web fallback |
| `TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS` | Freshness window | defaults to 300 seconds |
| `TELEGRAM_CLIENT_ID` | Browser OIDC client | deferred until public HTTPS origin exists |
| `TELEGRAM_CLIENT_SECRET` | Browser OIDC server secret | deferred until public HTTPS origin exists |
| `AUTH_PUBLIC_ORIGIN` | Exact OIDC callback origin | deferred until deployment |

All Telegram credentials remain server-only and must never use a `NEXT_PUBLIC_` prefix.

## Verification Evidence

| Check | Result |
| --- | --- |
| TypeScript `npx tsc --noEmit` | pass |
| ESLint `npm run lint` | pass |
| Backend unit suite without database | 19 pass, 29 integration skips |
| Clean disposable PostgreSQL 16, migrations 0001-0009 | pass |
| Full backend suite against disposable PostgreSQL 16 | 48/48 pass |
| Valid Mini App signature, stable ID and invitation parameter | pass |
| Tampered, stale and duplicate-field payloads | rejected |
| Replayed signed payload in PostgreSQL | rejected |

The disposable database was removed after verification. No external infrastructure was created and no provider secret was printed.

## Deliberately Deferred

- No paid cloud resources, public HTTPS origin or BotFather Web Login configuration.
- No live Telegram client/WebView evidence; current evidence is cryptographic, repository and build verification.
- No bot webhook, notification outbox, delivery retries or user notification preferences.
- No trainer activation operator UI; the existing closed-alpha manual activation rule remains.
- No change to the B9 deployment gate. External staging still fails closed while the accepted recovery/email readiness policy is unresolved.
- No phone collection and no Telegram username-based account matching.

## Next Gate

Before inviting real users, finish the notification contract and local product acceptance, then create the public environment. Live setup must register the exact OIDC callback `${AUTH_PUBLIC_ORIGIN}/api/auth/telegram/callback`, configure the same bot as the Main Mini App and run one end-to-end identity convergence test using a non-production Telegram account.
