# Closed Alpha Registration Runbook

- Cohort: one trainer and exactly two athletes
- Environment: staging only
- Account rule: every participant confirms their own email
- Operator rule: no account creation, identity mutation or invitation acceptance on behalf of a participant

## Prerequisites

Do not begin with real addresses until all B15 external gates pass: HTTPS origin, managed PostgreSQL, verified Resend sender, readiness, external smoke and restore evidence. Record participant consent, a support contact and the person allowed to activate the trainer.

Create an untracked local file named `.alpha-cohort.local.json`:

```json
{
  "trainerEmail": "trainer@example.com",
  "athleteEmails": [
    "athlete-one@example.com",
    "athlete-two@example.com"
  ]
}
```

Replace every example address, then restrict the file:

```bash
chmod 600 .alpha-cohort.local.json
```

The filename is ignored by Git. The operator refuses a group/world-readable file, duplicate participants or any cohort other than one trainer and two athletes. Do not put names, health data, OTPs, invitation tokens or notes in this file.

## Registration Ceremony

1. The trainer opens `/login?role=trainer`, confirms their own email, enters their display name and selects `Запросить доступ`.
2. From the isolated operator environment, check status:

```bash
npm run alpha:operator -- status --cohort-file .alpha-cohort.local.json
```

Expected blocker at this point: `trainer_activation_required`. `trainer_registration_missing`, `trainer_identity_unavailable` or `trainer_request_missing` means the trainer must finish the corresponding browser step.

3. Activate the existing request for the exact deployed release:

```bash
npm run alpha:operator -- activate-trainer \
  --cohort-file .alpha-cohort.local.json \
  --confirm-release "$APP_RELEASE"
```

The command succeeds only in staging/test, through `DATABASE_OPERATOR_URL`, with a valid pseudonymous `ALPHA_OPERATOR_REF`. It records the operator reference and release in the audit event, never the participant email.

4. The trainer selects `Проверить доступ`, opens `/trainer/clients` and creates two independent invitations.
5. Send each invitation privately to its intended athlete. Do not reuse one link or post links in a group chat; each token is single-use and expires after the configured TTL.
6. Each athlete opens their own invitation, confirms their own email, saves their display name and selects `Принять приглашение`.
7. Re-run the status command. Continue only when it prints `Closed alpha cohort: READY` and all nine participant checks are `PASS`.
8. The trainer assigns one short, non-sensitive test workout. One athlete completes it, the trainer sends feedback, and the athlete confirms that feedback is visible.

## Stop Conditions

- OTP email is not delivered or arrives after expiry.
- The participant did not personally confirm the email.
- Trainer activation reports anything except `activated` or `already_active`.
- Either invitation was forwarded, exposed, expired or accepted by the wrong account.
- Cohort status is not `READY`.
- Any participant can open another participant's workout or feedback.
- Readiness becomes unavailable, backup ownership is unknown or operator credentials appear in app runtime.

## Evidence And Cleanup

Record only release hash, timestamps, PASS/BLOCKER codes and the pseudonymous operator reference. Do not capture OTPs, cookies, emails, invitation URLs, workout comments or feedback bodies. After the cohort is ready, securely remove the local cohort file unless it is still required for an approved support session.
