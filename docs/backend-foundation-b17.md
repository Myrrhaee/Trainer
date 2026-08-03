# Backend Foundation B17: Telegram Pilot Decision

- Date: 2026-08-04
- Status: **not required for the first three-participant pilot; capability preserved and disabled**
- Scope: decide whether Telegram notifications or a Mini App are pilot dependencies and keep the login surface consistent with deployed configuration

## Pilot Decision

The first pilot uses email OTP for registration and browser sessions for the trainer and two athletes. Assignment, completion and review state is already visible in the canonical product workflow. Therefore neither Telegram notifications nor the Telegram Mini App is a launch blocker for this cohort.

| Capability | First-pilot decision | Reason |
| --- | --- | --- |
| Email OTP | required | every participant needs one working registration and recovery-independent sign-in path |
| Browser product | required | it contains the canonical trainer and athlete workflows under test |
| Automated Telegram notifications | disabled | no pilot evidence yet shows that in-product state plus coordinated testing is insufficient |
| Telegram browser sign-in | disabled unless fully configured | it is optional convenience, not a workflow dependency |
| Telegram Mini App | disabled | it adds WebView, bot, identity-consent and deployment variables without adding a required pilot workflow |
| Manual pilot coordination | allowed outside the product | support messages must not include credentials, invitation tokens or sensitive training/health details |

This is a scope decision, not a deletion decision. The B10 identity bridge, B11 transactional outbox and Telegram delivery adapter remain available behind server configuration.

## Implemented Guardrail

1. `GET /api/auth/federated/providers` returns booleans only and never exposes credentials.
2. Google is presented only when `GOOGLE_CLIENT_ID` is configured.
3. Telegram browser sign-in is presented only when both `TELEGRAM_CLIENT_ID` and `TELEGRAM_CLIENT_SECRET` are configured.
4. Telegram Mini App entry is presented inside a signed Mini App launch context only when `TELEGRAM_BOT_TOKEN` is configured.
5. When neither provider is available, login shows only email OTP and does not render a misleading `или email` separator.
6. Canonical browser E2E explicitly clears provider credentials and verifies that unavailable provider buttons are absent.

## Reconsideration Gate

Enable automated Telegram notifications only after all of the following are true:

1. Pilot evidence identifies an assignment, completion or feedback delay caused by the absence of a notification, or participants explicitly request Telegram delivery.
2. Each recipient gives explicit messaging consent and resolves to a canonical numeric Telegram identity.
3. The external HTTPS runtime, dedicated bot, `ai_strength_worker` database identity and scheduled one-shot outbox drain are operational.
4. A synthetic Telegram account completes assignment, completion and feedback delivery without exposing health details, credentials or identifiers in logs.
5. A named owner accepts bot-token rotation, failed-delivery support and opt-out handling.

Consider a Mini App separately. Notification demand alone does not justify it. Enable the Mini App only if the pilot demonstrates repeated mobile browser entry friction and the browser product has been verified inside Telegram WebView on supported devices.

## Evidence

| Check | Result |
| --- | --- |
| B10 Telegram browser/Mini App identity implementation | preserved; local cryptographic and repository tests exist |
| B11 transactional outbox and Telegram adapter | preserved; live delivery remains opt-in |
| External staging notification default | `disabled` |
| Login with no configured federated provider | email-only, no inactive buttons |
| Browser sign-in and Mini App configuration independence | unit tested |
| Canonical three-role browser flow without Telegram | covered by canonical E2E |
| Live Telegram delivery or WebView run | not run and not required for the first pilot |

## Remaining Boundary

B17 does not provision a bot, register an OAuth callback, create a Mini App, schedule the worker, send a Telegram message or collect Telegram identities. Those actions remain external and require the reconsideration gate above. The current external stop conditions for database, email, HTTPS deployment and real participant registration are unchanged.
