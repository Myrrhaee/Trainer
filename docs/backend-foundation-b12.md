# Backend Foundation B12: Local Pilot Operator Workflow

- Date: 2026-08-04
- Status: **local implementation complete; external pilot still deferred**
- Scope: prepare one trainer and two athletes through the canonical registration and invitation flow

## Product Rule

The operator never creates users or identities. Every participant registers through the ordinary email OTP flow. The trainer requests trainer access in onboarding. The operator may activate only that existing, verified, active account with a pending trainer request. Athletes receive their capability and relation only by accepting the trainer's one-time invitation.

## Local Sequence

1. Start the persistent local PostgreSQL database and apply migrations:

```bash
npm run local:setup
```

The dedicated container binds only to `127.0.0.1:55432` and stores data in the Docker volume `ai-strength-local-postgres-data`. It does not reuse or modify another PostgreSQL instance on the machine.

2. Start the application with the role-scoped local environment:

```bash
npm run local:dev
```

3. Open `http://127.0.0.1:3011/login`.
4. The trainer registers through `/login`, opens `/onboarding` and selects `Запросить доступ`.
5. Activate the pending trainer request:

```bash
npm run pilot:operator -- \
  activate-trainer --email trainer@example.test
```

6. The trainer signs in again, opens `/trainer/clients` and creates two separate invitation links.
7. Each athlete registers independently, opens their own invitation link and accepts it.
8. Check the three-account readiness state:

```bash
npm run pilot:operator -- \
  status \
  --trainer-email trainer@example.test \
  --athlete-email athlete-one@example.test \
  --athlete-email athlete-two@example.test
```

The status command prints only stable `PASS`, `WAIT`, `INFO` and `BLOCKER` codes. It does not print participant emails, display names, user IDs, identity subjects, invitation tokens or database credentials.

For a synthetic rehearsal against the persistent local database, the same canonical API sequence can be performed automatically after `local:setup` and `local:dev`:

```bash
npm run pilot:provision-local
```

This command uses three fixed `example.test` addresses, obtains development OTPs through the local-only memory adapter, keeps three independent session cookies in process memory and accepts two ordinary single-use invitations. It never inserts a user, identity, athlete profile or relation directly and never prints OTPs, cookies or invitation tokens.

It also exercises the canonical product loop through HTTP APIs: the trainer creates a template and assignment, the assigned athlete starts and completes the session, the trainer submits feedback, and the athlete reads that feedback.

## Verification Evidence

The local rehearsal completed on 2026-08-04 with:

- three independently authenticated synthetic accounts;
- one active trainer and two active primary athlete relations;
- one published workout template and one assignment;
- one completed workout session;
- zero open review items after trainer feedback;
- one feedback message visible to the assigned athlete;
- two pending notification intents and zero dead-letter notifications.

`scripts/ops/preflight.ts` also passed migrations `0001` through `0010`, the expected schema check, all four runtime database roles, and the negative health-role access checks. Provider delivery was not exercised: email OTP and notification delivery remained on local memory adapters.

## Activation Safety

Activation fails closed when:

- the email is invalid or absent;
- no account exists;
- the same email belongs to multiple unmerged accounts;
- the account is not active;
- every matching identity is revoked;
- the user has not submitted the trainer request;
- the trainer capability is suspended or archived;
- `APP_ENV` resolves to staging or production.

Repeated activation of an already active trainer is safe and returns `ALREADY_ACTIVE`. A successful transition writes `access.trainer_capability.operator_activated` to the audit log without storing the input email in event metadata.

## Readiness Contract

`READY` requires:

- one registered, verified, active trainer account;
- an active trainer capability;
- exactly two supplied athlete accounts, each registered and verified;
- an active athlete capability and primary relation to that trainer for both athletes.

The report also exposes aggregate counts for active athletes, templates, assignments, completed sessions, open reviews, feedback and notification outbox health. These counts diagnose the workout loop without revealing participant content.

## Deliberately Deferred

- No account creation, password reset or identity mutation by the operator.
- No trainer activation UI.
- No raw invitation generation in the operator CLI.
- No real email, Google or Telegram provider delivery.
- No public origin, cloud database or permanent notification scheduler.
- No production operator role; B12 uses migration credentials only in local/test environments.

## Next Gate

Run the three-account loop locally and record product/UI blockers. External access remains blocked until hosting, a dedicated production operator boundary, real email recovery and live provider credentials are approved.
