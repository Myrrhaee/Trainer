# Backend Foundation B14: Canonical Browser E2E and UX Stabilization

- Date: 2026-08-04
- Status: **local implementation complete; external pilot still deferred**
- Scope: repeatable browser verification of the canonical closed-alpha workflow and removal of confirmed UX blockers

## Role Boundary

The browser suite covers three product states:

1. unauthenticated guest entering a protected trainer or athlete route;
2. active trainer working with the canonical roster, assignment and review surfaces;
3. active athlete accepting an invitation, completing a workout and reading feedback.

The local operator is also exercised, but remains a CLI boundary rather than a browser role. This preserves the accepted closed-alpha rule: there is no production operator UI, and trainer activation does not occur through a public route.

## Isolated Test Harness

`npm run test:e2e:canonical` now performs the following sequence:

1. starts the dedicated local PostgreSQL 16 container if necessary;
2. creates a process-scoped disposable database;
3. applies bootstrap SQL and migrations `0001` through `0010`;
4. starts Next.js on `127.0.0.1:3101` with `APP_ENV=test`, memory email and demo mode disabled;
5. runs one Chrome worker with separate browser contexts for the trainer and two athletes;
6. removes the disposable database even when the test fails.

The harness rewrites only the database name in the existing role-specific local URLs. It does not print credentials, reuse the persistent pilot database or commit OTP/session artifacts. Test traces, screenshots, video and HTML reports remain under already ignored Playwright artifact directories.

## Verified Workflow

- Guest access to `/trainer/dashboard` redirects to `/login?next=/trainer/dashboard`.
- Guest access to `/client/me` redirects to `/login?next=/client/me`.
- The trainer registers with development email OTP, saves a display name and requests trainer access.
- The operator CLI activates only that verified pending trainer.
- The trainer refreshes access in the UI without reloading the page.
- The trainer creates two distinct single-use invitation links.
- Two athletes register in independent browser contexts and accept only their own invitations.
- Operator readiness reports one active trainer and two active athlete relations.
- The trainer sees canonical display names and assigns one saved workout to the selected athlete.
- The assigned athlete completes the workout at a `390 x 844` viewport with no horizontal overflow.
- The other athlete cannot read the assignment or session by direct session URL.
- The trainer sees the exact persisted athlete comment, submits feedback and resolves the review.
- The assigned athlete reads the persisted feedback.
- No page errors, console errors, HTTP 5xx responses, React hydration overlay or horizontal overflow are accepted.

## UX Blockers Removed

1. Added `Проверить доступ` to pending trainer onboarding. Manual activation no longer requires an unexplained browser reload.
2. Prevented a late access-context response from clearing a display name already entered by the user.
3. Removed the expected unauthenticated `401` request from the onboarding console by passing the initial authentication state from the server.
4. Made invitation creation independent from clipboard permission. A valid link remains visible and usable even when automatic copying is blocked.
5. Replaced the truncated invitation text with a labelled read-only field and an explicit copy command.

The existing canonical capability layouts for `/trainer/*` and `/client/*` were not changed. B14 makes their guest redirect behavior an explicit regression contract.

## Deliberately Deferred

- No operator web UI or public trainer activation endpoint.
- No real email, Google or Telegram provider browser test.
- No public HTTPS deployment, managed database or external worker scheduler.
- No broad visual redesign or legacy route cleanup.
- No canonical goals, measurements, progress analytics, messages or payments.

## Next Gate

B15 may prepare an externally reachable closed-alpha environment: hosting, managed PostgreSQL ownership, transactional email, backup/restore evidence and provider-safe secrets. The local B14 suite should become a required release gate before every external pilot deployment.
