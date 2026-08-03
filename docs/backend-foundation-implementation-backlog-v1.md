# Backend Foundation Implementation Backlog v1

- Status: **B9 local readiness gate complete; managed deployment and live provider verification pending**
- Date: **2026-08-03**
- Scope: B1 through B9

## Sequencing Rule

Do not replace the complete demo runtime or all legacy Supabase reads at once. Build and verify the identity/session foundation first, then move one canonical trainer-client vertical slice through provider-neutral backend services. Existing pilot mode remains deterministic and isolated.

## B1 - PostgreSQL and Session Foundation

Implementation status: **complete and verified on clean PostgreSQL 16**. Managed provider/region/backup ownership remains an operational deployment blocker; see `docs/backend-foundation-b1.md`.

### Entry

- Accept B0-OD-001, B0-OD-002 and B0-OD-003.
- Record environment owner, region, backup/restore policy, pooling and secret storage.

### Work

1. Select the managed PostgreSQL environment and migration/query tooling.
2. Define separate database roles for migration, ordinary application transactions and background/maintenance work.
3. Create canonical migrations for `users`, `auth_identities`, `sessions` and minimal `audit_events`.
4. Add constraints for provider-subject uniqueness, session expiry/revocation and safe user status transitions.
5. Implement server-only PostgreSQL connection and transaction helpers.
6. Implement opaque session issuance, hash lookup, rotation, revocation and cookie helpers.
7. Implement canonical `Actor` resolution from an application session.
8. Establish transaction-local actor context and first RLS policy/negative test.
9. Add readiness/health behavior without exposing connection strings or database internals.
10. Add clean-database migration, rollback/recovery and connection-failure tests.

### Acceptance

- A clean test database migrates deterministically.
- Backend can create/read a synthetic user and revoke a synthetic session.
- Browser bundles contain no database credentials.
- A second user cannot read the first user's protected test record through query service or direct SQL role.
- Pool reuse does not leak actor context between transactions.
- Backup and restore are demonstrated on non-production synthetic data.

## B2 - Email OTP

Implementation status: **complete and verified with the local non-production delivery adapter**. Transactional email delivery and sender-domain configuration remain an external pilot/staging blocker; see `docs/backend-foundation-b2.md`.

### Entry

- Use the local delivery adapter for implementation verification; accept B0-OD-004 and configure a non-production sender domain before external testing.
- B1 session and actor foundation passes.

### Work

1. Add email challenge persistence with hashed secret, expiry, attempt, resend and consumption state.
2. Add request and verify services with uniform responses for known/unknown email.
3. Add provider adapter for transactional email delivery and safe delivery failure handling.
4. Resolve or create `email_otp` identity and user atomically.
5. Issue/rotate application session after successful verification.
6. Add logout-current and logout-all-devices commands.
7. Add accessibility and fallback states to the existing auth surface without changing product roles.
8. Add rate limits and structured security events without logging full email/code.

### Acceptance

- New and returning user flows pass.
- Expired, consumed, incorrect and replayed codes fail safely.
- Attempt and resend limits pass.
- Responses do not enumerate registered emails.
- Logout and revocation invalidate server sessions.

## B3 - Google, Telegram and Identity Linking

Implementation status: **complete and verified with synthetic provider proofs and local browser fallback states**. Live Google/Telegram callbacks remain blocked by non-production credentials and provider-console configuration; see `docs/backend-foundation-b3.md`.

### Entry

- B2 account resolution and session services pass.
- Synthetic implementation may proceed without credentials; live callback verification requires Google and Telegram non-production credentials, callback URLs and secret owners outside Git.

### Work

1. Implement Google Identity Services adapter and server-side ID-token verification.
2. Implement Telegram Login/OIDC adapter and server-side response verification.
3. Add provider nonce/state/replay records where required.
4. Route both adapters through the same account-resolution service used by email OTP.
5. Add authenticated link-identity and unlink-identity commands.
6. Prevent silent email merge and identity transfer between users.
7. Rotate sessions and create audit events after identity changes.
8. Provide email fallback for provider popup, browser and embedded-webview failures.

### Acceptance

- Email, Google and Telegram can each create/login a user.
- All three may be explicitly linked to one user.
- Same-looking email does not silently merge two identities.
- Replayed/stale provider responses fail.
- An identity attached to another user cannot be stolen through linking.
- Removing the last usable identity is blocked.

## B4 - Capabilities, Invitations and Relations

**Implementation status (2026-08-03):** locally complete for the application-owned backend boundary. Preserved Supabase onboarding endpoints now fail closed; managed deployment, live delivery/provider credentials and the first PostgreSQL athlete-data slice remain blocked; see `docs/backend-foundation-b4.md`.

### Entry

- Founder accepts B0-OD-005 and B0-OD-006.
- Recovery handling for closed-alpha support is documented.

### Work

1. Implement canonical `TrainerProfile`, `AthleteProfile`, invitation and `TrainerAthleteRelation` migrations/contracts.
2. Implement trainer activation according to the accepted alpha policy.
3. Implement signed/opaque athlete invitation creation, acceptance, expiry and single-use behavior.
4. Bind invitation acceptance to the authenticated athlete user, never an email/Telegram ID from the request body.
5. Add relation lifecycle and safe end/suspension behavior.
6. Implement capability-aware route/session guards for canonical `/trainer/*` and `/client/*` entry points.
7. Implement the permission matrix through backend commands/query services and RLS defence.
8. Isolate or disable unsafe legacy privileged endpoints before real alpha users.

### Acceptance

- Trainer onboarding creates no athlete capability implicitly unless explicitly selected/accepted.
- Athlete invitation creates one relation and is safe under retries.
- Trainer cannot access an unrelated athlete.
- Athlete cannot access another athlete or trainer-private data.
- Ended/suspended relation blocks new shared facts according to the accepted historical-access policy.
- Negative authorization E2E tests cover route, query and command boundaries.

## Cross-Cutting Constraints

- No real user data in development fixtures or migration tests.
- No provider/database secrets in browser bundles, logs, screenshots, Git or test artifacts.
- Every externally retryable mutation has an idempotency boundary.
- Every sensitive state change has a minimal audit event.
- Authentication success does not imply trainer/athlete capability.
- Legacy Supabase code is preserved until its replacement path is verified; no broad cleanup is part of B1-B4.
- Demo mode remains clearly disclosed and cannot write to the production backend.

## Exit to B5

B5 may begin only when two real test accounts can authenticate independently, establish one authorized trainer-athlete relation, pass cross-tenant negative tests, and use the canonical actor/session boundary without Supabase Auth or browser database access.

## B5 - Canonical Workout Template and Assignment Slice

**Implementation status (2026-08-03): locally complete for the minimal canonical vertical slice.** The rich builder and workout execution remain separate follow-up slices; see `docs/backend-foundation-b5.md`.

### Implemented work

1. Read the active trainer roster through the canonical PostgreSQL relation boundary.
2. Persist a valid trainer-owned published WorkoutTemplate revision with normalized exercises.
3. Create WorkoutAssignment only from that saved revision and an active target relation.
4. Copy an independent normalized assignment snapshot with source provenance.
5. Expose athlete-owned assignments through the canonical client home.
6. Enforce cross-actor and ended-relation RLS negative paths.
7. Preserve demo/runtime and legacy Supabase screens behind their existing explicit boundaries.

### Exit to B6

B6 may connect the accepted simple builder only after the published-revision and assignment-snapshot contract remains green under migration, RLS and browser tests. Workout execution must additionally define idempotent session start/resume and assignment locking before client mutation is enabled.

## B6 - Canonical Builder Lifecycle

**Implementation status (2026-08-03): locally complete.** The preserved rich Builder now uses canonical draft, publish, revision, archive and assignment commands outside explicit demo mode; see `docs/backend-foundation-b6.md`.

### Implemented work

1. Persist current draft revisions with normalized exercises, supersets and per-set overrides.
2. Publish immutable revisions and create revision N+1 as a copied draft.
3. Preserve complete exercise/set assignment snapshots across later template changes.
4. Enforce owner-only RLS, archived immutability and bounded same-origin commands.
5. Connect canonical roster context to the full Builder and assignment dialog.

### Exit to B7

B7 may enable athlete execution only after idempotent start/resume, assignment locking, partial completion and SetLog ownership are specified and covered by concurrent command tests.

## B7 - Canonical Workout Execution

**Implementation status (2026-08-03): locally complete.** Canonical athlete execution now persists one resumable session per assignment, stable planned set snapshots, athlete-owned actual facts and one durable trainer review handoff; see `docs/backend-foundation-b7.md`.

### Implemented work

1. Start or resume exactly one session per assignment under concurrent requests.
2. Persist ExerciseLog and SetLog facts separately from assignment prescriptions.
3. Enforce expected-version and durable idempotency boundaries for progress and completion.
4. Support full, partial and explicitly confirmed zero-result completion.
5. Create exactly one trainer-only AttentionItem in the completion transaction.
6. Enforce athlete ownership, active-relation trainer reads and historical access after relation end.
7. Connect canonical client home and `/client/workouts` without changing demo runtime.

### Exit to B8

B8 may expose trainer review only through the canonical AttentionItem and completed WorkoutSession boundary. Review and feedback must not mutate the athlete's original SetLog facts.

## B8 - Canonical Workout Review and Feedback

**Implementation status (2026-08-03): locally complete.** The canonical trainer queue now reads durable `AttentionItem` rows, review reads exact session facts, and immutable feedback is visible in the athlete's terminal result; see `docs/backend-foundation-b8.md`.

### Implemented work

1. Read the trainer-owned open review queue from canonical completion handoffs.
2. Build the exact review projection from assignment plan, ExerciseLog and SetLog facts.
3. Persist detailed feedback and acknowledgements before resolving the source AttentionItem transactionally.
4. Support append-only follow-up feedback and trainer-private manual resolution reasons.
5. Enforce durable idempotency, row locking, RLS isolation and feedback immutability.
6. Expose canonical feedback history to the owning athlete without changing demo runtime.
7. Verify the complete athlete -> trainer -> athlete flow in desktop and mobile browser states.

### Exit to B9

B9 should close deployment and operations gates before another product-domain expansion: managed PostgreSQL, secret ownership, transactional email, live identity-provider callbacks, feedback notification policy and a staging rehearsal of the complete B1-B8 flow.

## B9 - Closed Alpha Deployment Readiness

**Implementation status (2026-08-03): local gate complete; external staging blocked.** Configuration validation, dedicated health role, checksummed schema preflight and safe HTTP readiness are implemented; see `docs/backend-foundation-b9.md` and `docs/closed-alpha-staging-runbook.md`.

### Implemented work

1. Fail closed for incomplete or unsafe staging/production environment profiles.
2. Separate runtime application, authenticator and health database identities from migration credentials.
3. Verify all canonical migration checksums and the expected schema pointer before deployment.
4. Prove that the health identity cannot read product users or private sessions.
5. Return only a generic public readiness status while retaining safe internal issue codes.
6. Document provisioning, staging acceptance, backup restore, release and incident stop conditions.

### External exit gate

Do not begin another broad backend slice until managed PostgreSQL ownership, transactional email, restore evidence and a two-account staging rehearsal are complete. Google/Telegram and external feedback notifications remain optional only if the founder explicitly accepts an email-only, in-product-notification closed alpha.
