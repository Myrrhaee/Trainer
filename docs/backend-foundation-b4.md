# Backend Foundation B4

- Date: **2026-08-03**
- Status: **implementation complete locally; closed-alpha deployment blocked**
- Scope: trainer/athlete capabilities, closed-alpha trainer activation, athlete invitations, canonical relations and capability-aware routing

## Implemented

1. `TrainerProfile` and `AthleteProfile` are optional, non-exclusive capability extensions of one application user. Authentication alone creates neither capability.
2. A trainer may request capability, but the request is always persisted as `pending`. Closed-alpha activation is an explicit operator database action; no public admin endpoint or self-activation path exists.
3. An active trainer creates a 256-bit opaque invitation. PostgreSQL stores only its SHA-256 hash, expiry and lifecycle metadata. The raw token is returned once in the generated URL.
4. Invitation acceptance requires an authenticated application session and binds the athlete profile and relation to that actor. Email, Telegram identifiers and caller-supplied user IDs are never accepted as the athlete identity.
5. Acceptance is atomic, single-use and retry-safe for the same actor. Replay by another actor fails without disclosing who accepted the invitation.
6. The first MVP permits at most one active primary trainer per athlete and one open relation per trainer-athlete pair.
7. Relation transitions support `active -> suspended|ended` and `suspended -> active|ended`; `ended` is terminal in ordinary product flow.
8. RLS isolates capability profiles, invitation rows and relations. A trainer-athlete profile route additionally requires an active canonical relation.
9. `/auth/continue` resolves post-login destination from active capabilities. Dual-capability users select a workspace; users without active capability enter `/onboarding`.
10. Canonical `/trainer/*` and `/client/*` layouts validate the application session and active capability outside explicit demo mode.
11. The existing trainer roster creates canonical invitation URLs in non-demo mode. Demo mode remains local and cannot create backend relations.
12. Legacy Supabase service-role onboarding endpoints return `410` by default and cannot be enabled in production. A named local-only escape hatch preserves forensic/manual testing without exposing them to alpha users.

## Manual Trainer Activation

Closed-alpha activation intentionally has no public HTTP endpoint. An authorized operator using the migration/operations connection may activate a reviewed pending user with:

```sql
UPDATE app.trainer_profiles
SET status = 'active',
    activated_at = clock_timestamp()
WHERE user_id = '<reviewed-user-uuid>'
  AND status = 'pending';
```

The operator must verify exactly one row and record the approval outside the product until an audited operations workflow is selected. Application runtime credentials cannot perform this update.

## Evidence

| Acceptance check | Result | Evidence |
| --- | --- | --- |
| Clean PostgreSQL 16 applies B1-B4 | pass | `database/migrations/0001_backend_foundation.up.sql` through `0004_capabilities_and_invitations.up.sql` |
| B4 rollback/remigrate | pass | both capability and invitation tables absent after rollback and present after remigrate |
| Authentication grants no capability | pass | PostgreSQL context test starts with no Trainer/Athlete profile |
| Pending trainer cannot create invitation | pass | RLS negative test returns PostgreSQL `42501` |
| Invitation is single-use and actor-bound | pass | same-actor retry succeeds; different-actor replay returns generic invalid result |
| One acceptance creates one active relation | pass | atomic PostgreSQL integration test plus uniqueness constraints |
| Unrelated trainer cannot see relation | pass | application-role RLS negative test |
| Unrelated athlete cannot see athlete profile | pass | application-role RLS negative test |
| Ended relation stops trainer athlete authorization | pass | active-relation query becomes false while athlete retains own relation history |
| Capability layouts and dynamic athlete route compile | pass | TypeScript, lint and production build |
| Complete backend suite | pass | 24/24 tests with disposable PostgreSQL 16 |
| Local trainer-to-athlete browser flow | pass | email OTP, pending request, manual activation, invitation create, logout, second account acceptance and `/client/me` |
| Cross-capability route denial | pass | athlete navigation to `/trainer/dashboard` redirects to onboarding |
| Canonical logout clears application session | pass | post-logout invitation page receives `401` context and requests login |
| Legacy service-role onboarding fails closed | pass | both preserved routes return `410 legacy_endpoint_disabled` by default |
| Mobile onboarding/client home at 390 x 844 | pass | document width equals viewport width; no console error after final integration fixes |

## Runtime Configuration

- `ATHLETE_INVITATION_TTL_HOURS` controls invitation lifetime from 1 to 168 hours; default is 72.
- `DATABASE_APP_URL` must use a login granted only `ai_strength_app`. Using migration or authenticator credentials for product requests defeats the tested role boundary.
- Invitation URLs use the current request origin. Deployment must enforce one trusted public origin at the edge before external use.

## Security Boundary

- Invitation tokens are cryptographically random, stored only as hashes, expire and are single-use, following the same general token properties recommended by OWASP for URL-delivered account workflows.
- PostgreSQL RLS is forced on all B4 product tables. Ordinary queries require both SQL privileges and an applicable actor-scoped policy.
- A relation row may remain visible to its participants for lifecycle/audit history. Athlete-private product facts must require `status = 'active'`; relation membership alone is insufficient.
- Suspension and ending are audited. Historical trainer access to already shared facts remains a legal/product policy decision and is not implemented by B4.

## Deliberately Not Implemented

- No managed PostgreSQL environment, operator console or public trainer-approval API exists.
- No production email delivery and no live Google/Telegram credentials exist.
- No canonical athlete data vertical slice has moved from Supabase/demo stores yet, so relation RLS protects only the B4 tables and route boundary today.
- Legacy `/api/ensure-profile` and `/api/link-trainer` code is preserved but disabled by default and always disabled in production. It may run only in local non-production with `ENABLE_LEGACY_SUPABASE_ONBOARDING=true`.
- Legacy pages inside `app/(client)` are outside the canonical `/client/*` capability layout and remain preservation-only until route migration.
- The canonical trainer roster intentionally shows an empty state until its PostgreSQL read model lands. Its old browser-Supabase adapter is local-only behind `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER=true` and cannot run in production.
- Canonical `/client/me` shows a truthful connected-account empty state until assignments move to PostgreSQL. The preserved Supabase client home is local-only behind `NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_CLIENT_HOME=true` and cannot run in production.
- Relation suspension/end management API exists, but no canonical operations UI is selected.
- Total credential-loss recovery and historical-access retention policy remain open.

## External References

- OWASP single-use URL token properties: `https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html`
- PostgreSQL Row Security Policies: `https://www.postgresql.org/docs/current/ddl-rowsecurity.html`

## Exit Assessment

B4 is locally implementation-complete, but the original B5 exit gate is not met with real accounts or infrastructure. Before external alpha: choose managed PostgreSQL and email delivery, configure provider credentials if used, remove legacy service-role onboarding paths, deploy separate database login roles, and run route/API/browser authorization tests against the deployed environment.
