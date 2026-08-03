# Canonical PostgreSQL Foundation

This directory is the provider-neutral PostgreSQL source for the new backend foundation. Legacy files under `supabase/migrations/` are not executed by these commands.

## Roles

Run the bootstrap once with a database owner that may create roles:

```bash
DATABASE_MIGRATION_URL=... npm run db:bootstrap
```

The bootstrap creates non-login group roles:

- `ai_strength_migrator`: migration ownership boundary;
- `ai_strength_authenticator`: narrow identity/session access;
- `ai_strength_app`: ordinary actor-scoped product transactions;
- `ai_strength_worker`: explicitly granted background work.
- `ai_strength_health`: readiness-only access to checksummed migration metadata.
- `ai_strength_operator`: closed-alpha activation through two audited functions only.

The managed environment must create separate login roles and grant each login only its corresponding group role. Do not reuse the migration login in the application runtime.

## Migrations

```bash
DATABASE_MIGRATION_URL=... npm run db:migrate
DATABASE_MIGRATION_URL=... npm run db:rollback
```

The runner applies `*.up.sql` files in lexical order, records a SHA-256 checksum and rejects a changed migration that was already applied. Rollback removes only the latest applied migration through its matching `*.down.sql` file.

## Runtime Environment

All values are server-only. None may use a `NEXT_PUBLIC_` prefix.

| Variable | Purpose | Fallback |
| --- | --- | --- |
| `APP_ENV` | Explicit deployment profile: local, test, staging or production | Inferred conservatively from `NODE_ENV` |
| `APP_RELEASE` | Immutable deployed release identifier | Required in staging/production |
| `DATABASE_MIGRATION_URL` | Schema migration login | `DATABASE_URL` |
| `DATABASE_AUTH_URL` | Identity and session login | `DATABASE_URL` |
| `DATABASE_APP_URL` | Actor-scoped product login | `DATABASE_URL` |
| `DATABASE_HEALTH_URL` | Least-privilege readiness login | `DATABASE_URL` |
| `DATABASE_WORKER_URL` | Background notification worker login | `DATABASE_URL` |
| `DATABASE_OPERATOR_URL` | Isolated closed-alpha operator login; never app runtime | none |
| `DATABASE_POOL_MAX` | Maximum connections per runtime pool | `5` |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Pool connection timeout | `5000` |
| `DATABASE_IDLE_TIMEOUT_MS` | Idle pooled connection timeout | `30000` |
| `SESSION_IDLE_TTL_SECONDS` | Sliding idle session lifetime | `604800` (7 days) |
| `SESSION_ABSOLUTE_TTL_SECONDS` | Non-extendable absolute lifetime | `2592000` (30 days) |
| `AUTH_OTP_PEPPER` | Server-only HMAC key for OTP target, request and secret hashes | Random process-local value in development; required in production |
| `AUTH_EMAIL_DELIVERY_MODE` | Email OTP delivery adapter | `memory` locally/test; `resend` externally |
| `RESEND_API_KEY` | Server-only transactional email credential | required externally |
| `AUTH_EMAIL_FROM` | Verified transactional sender | required externally |
| `AUTH_DEV_OTP_DISCLOSURE` | Return the local OTP to the development UI | Enabled outside production unless set to `false`; never available in production |
| `AUTH_FLOW_SECRET` | HMAC and cookie-encryption secret for federated state, nonce and PKCE context | Random process-local value in development; required in production |
| `AUTH_PUBLIC_ORIGIN` | Canonical origin used for provider callbacks | Request origin in development; required in production |
| `AUTH_FLOW_TTL_SECONDS` | Federated login/link flow lifetime | `600` (10 minutes) |
| `AUTH_FLOW_RATE_WINDOW_SECONDS` | Federated start rate-limit window | `900` (15 minutes) |
| `AUTH_FLOW_MAX_REQUESTS_PER_IP` | Maximum flow starts per request-IP hash in the window | `20` |
| `GOOGLE_CLIENT_ID` | Google Identity Services web client ID | none; Google login fails closed |
| `TELEGRAM_CLIENT_ID` | Telegram Login/OIDC client ID from BotFather | none; Telegram login fails closed |
| `TELEGRAM_CLIENT_SECRET` | Server-only Telegram OIDC client secret | none; Telegram login fails closed |
| `TELEGRAM_BOT_TOKEN` | Server-only bot token used to validate Mini App `initData` | none; Mini App login fails closed |
| `TELEGRAM_BOT_USERNAME` | Bot username used to create `startapp` athlete invitations | none; web invitation remains canonical |
| `TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS` | Maximum accepted age of signed Mini App data | `300` (5 minutes) |
| `NOTIFICATION_DELIVERY_MODE` | Notification adapter: `memory`, `disabled` or `telegram` | `memory` locally/test; `disabled` externally |
| `NOTIFICATION_WORKER_BATCH_SIZE` | Maximum events claimed by one drain | `25` |
| `NOTIFICATION_WORKER_LEASE_SECONDS` | Processing lease before a crashed claim may be retried | `60` |
| `NOTIFICATION_MAX_ATTEMPTS` | Delivery attempts before dead-lettering | `8` |
| `NOTIFICATION_RETRY_BASE_SECONDS` | Base for capped exponential retry delay | `30` |
| `ATHLETE_INVITATION_TTL_HOURS` | Single-use athlete invitation lifetime, 1-168 hours | `72` |
| `ENABLE_LEGACY_SUPABASE_ONBOARDING` | Local-only escape hatch for preserved `/api/ensure-profile` and `/api/link-trainer` | disabled; ignored in production |
| `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER` | Local-only escape hatch for the preserved browser Supabase roster read | disabled; ignored in production |
| `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_CLIENT_HOME` | Local-only escape hatch for the preserved browser Supabase client home | disabled; ignored in production |

Use separate URLs in staging/production. `DATABASE_URL` is a local/test convenience only.

In staging/production, the application runtime must not receive `DATABASE_MIGRATION_URL`, `DATABASE_OPERATOR_URL` or `DATABASE_URL`. Run migrations, preflight and closed-alpha activation in isolated jobs, then deploy only the app, auth, health and worker URLs.

## Deployment Preflight

```bash
npm run ops:preflight
```

The command fails on unsafe environment configuration, missing or changed migration checksums, incorrect runtime role membership, or health-role access to product/private data. Output contains stable check codes only and must not be supplemented with connection strings or secret values in CI logs.

## Verification

`npm run test:backend` always runs unit tests. PostgreSQL integration tests also run when `TEST_DATABASE_URL` points to a clean migrated test database.

The B1 verification uses synthetic records only and covers migration idempotency, rollback/remigrate, session issue/revoke/rotation, cross-user RLS, private-table grants, pooled actor-context reset and dump/restore.

The B2 verification also covers new/returning email identities, expiry, attempt exhaustion, replay prevention, resend invalidation and request throttling. The `memory` delivery adapter is local-only; staging and production require an accepted transactional email provider and sender domain.

The B3 verification covers hashed federated flow state, encrypted PKCE callback context, Google and Telegram nonce checks, stable provider-subject resolution, no silent email merge, session-bound linking, identity conflict handling, last-identity protection, session rotation and concurrent flow throttling. Real provider callbacks require non-production credentials registered outside Git.

The B4 verification covers explicit capabilities, manual trainer activation, invitation expiry/single-use/retry behavior, one active primary trainer, relation transitions, cross-actor RLS and active-relation route authorization. Trainer activation remains an operator-only closed-alpha action.

The B5 verification covers actor-scoped trainer roster reads, trainer-owned published templates, assignment creation from an active relation, immutable normalized assignment snapshots, athlete self-only reads and revocation of ordinary trainer assignment access after relation end.

The B6 verification covers mutable drafts, immutable published revisions, revision N+1 cloning, supersets, warmup/working per-set overrides, assignment set snapshots, archive immutability and cross-trainer RLS isolation.

The B7 verification covers one resumable session per assignment, stable execution snapshots, versioned and idempotent set progress, partial and zero-result completion, exactly one trainer review attention item, terminal immutability and participant access across relation lifecycle.

The B8 verification covers trainer-owned review queues, exact plan-vs-actual projections, transactional feedback-before-resolution, trainer-private manual reasons, append-only follow-ups, durable command idempotency, feedback immutability and athlete history after relation end.

The B9 verification covers explicit deployment profiles, runtime/migration credential separation, all migration checksums, dedicated health-role isolation, fail-closed external email readiness and generic HTTP readiness responses.

The B10 verification covers Telegram Mini App HMAC validation, payload freshness, duplicate-field rejection, one-time replay protection, convergence with the browser OIDC identity key and invitation hand-off through a verified `start_param`.

The B11 verification covers transactional notification events for assignment, completion and trainer feedback, event deduplication, actor-bound RLS, explicit Telegram messaging consent, worker-only claiming, generic message copy, memory delivery, retries, dead letters and migration rollback/remigrate.

The B16 verification covers the staging-only closed-alpha operator, denial of direct participant-table reads, verified pending-request activation, pseudonymous audit provenance and non-PII readiness for exactly one trainer and two athletes.

## Notification Worker

One local drain processes the currently available batch and exits:

```bash
DATABASE_WORKER_URL=... npm run notifications:drain
```

Local/test defaults to `memory` and never calls Telegram. Live delivery requires the explicit combination `NOTIFICATION_DELIVERY_MODE=telegram`, `TELEGRAM_BOT_TOKEN`, an HTTPS `AUTH_PUBLIC_ORIGIN` and a user identity carrying verified bot messaging permission. The worker prints aggregate counts only; it does not print recipient IDs, message bodies or provider responses.
