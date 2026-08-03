# Auth and Identity Architecture v1

- Status: **accepted conceptual contract**
- Date: **2026-08-02**
- Implementation: begins in B1; this document does not define final SQL

## 1. Identity Layers

| Layer | Purpose | Must not determine |
| --- | --- | --- |
| `User` | Stable internal human/account identity | Trainer-athlete relation by itself |
| `AuthIdentity` | Verified login method owned by a user | Product permissions from provider claims |
| `Session` | Revocable authenticated browser context | Resource ownership from URL/body IDs |
| `TrainerProfile` | Trainer capability and trainer-owned product state | Authentication method |
| `AthleteProfile` | Athlete capability and athlete-owned facts | Authentication method |
| `TrainerAthleteRelation` | Explicit scoped coaching relationship | Global ownership of either account |

One user may hold trainer and athlete capabilities simultaneously, preserving D-061. A string role selected on a login screen is not authorization evidence.

## 2. Conceptual Records

### User

```text
id                 opaque UUID
status             pending | active | suspended | deletion_pending | deleted
display_name       nullable user-facing value
created_at
updated_at
```

### AuthIdentity

```text
id
user_id
provider           email_otp | google | telegram
provider_subject   provider-stable identifier
email_original     nullable
email_normalized   nullable
verified_at
last_used_at
created_at
revoked_at         nullable
provider_metadata  minimal allowlisted JSON, nullable
```

Required uniqueness: active `(provider, provider_subject)` belongs to at most one user. Provider metadata must not contain access tokens, bot tokens, raw ID tokens or complete provider payloads.

### Session

```text
id
user_id
token_hash
created_at
last_seen_at
expires_at
revoked_at         nullable
revocation_reason  nullable
```

The raw opaque session token exists only in the secure cookie and transient server processing. PostgreSQL stores its cryptographic hash.

### VerificationChallenge

```text
id
kind               email_login | identity_link | recovery
target_hash
secret_hash
attempt_count
expires_at
consumed_at        nullable
created_at
```

The model may be split into provider-specific tables during B1 if that improves constraints and retention; the security contract remains unchanged.

## 3. Provider Contracts

### Email OTP

- Preserve the original email for display and define one consistent comparison policy.
- Do not activate an email identity before challenge verification.
- Challenge is single-use, expires quickly, has attempt and resend limits, and is stored hashed.
- Request response does not reveal whether the email already exists.
- Email is a login identity and recovery channel, not proof of real-world identity.

### Google

- Use Google Identity Services for authentication only with `openid email profile`.
- Verify the ID token on the server: signature, issuer, audience, expiry, nonce/CSRF context where applicable.
- Use Google `sub` as `provider_subject`; never use email as the Google identity key.
- Do not request Gmail, Drive, contacts or offline Google API access for login.

### Telegram

- Prefer Telegram Login/OIDC for website authentication; a bot deep-link challenge may be a linking/fallback adapter.
- Verify the Telegram response on the server and reject stale or replayed authentication.
- Use stable Telegram user ID as `provider_subject`; username and phone are not identity keys.
- Bot token and Telegram client secret remain server-only.
- Google/email fallback remains available because embedded webviews and Telegram availability cannot be assumed.

## 4. Account Resolution

Provider verification resolves accounts in this order:

1. Find active `AuthIdentity` by `(provider, provider_subject)`.
2. If found, validate user status and create/rotate an application session.
3. If not found and the request is an authenticated linking flow, attach it to the current user after conflict checks.
4. If not found and the request is registration, create a pending/active user according to onboarding policy and attach the identity atomically.
5. If an email resembles an existing account but identity ownership is not proven, do not merge. Require authentication of the existing account and explicit linking.

## 5. Linking and Unlinking Invariants

- Linking requires a current non-stale application session and fresh verification of the new identity.
- An identity already attached to another active user cannot be moved through ordinary self-service.
- Unlinking the last usable identity is forbidden until a replacement/recovery method is verified.
- Linking, unlinking and conflict decisions create audit events without provider tokens or full sensitive payloads.
- Account merging is an exceptional support/admin workflow and is outside B1-B4.

## 6. Session Contract

- Same-origin opaque session cookie with `Secure`, `HttpOnly`, explicit `SameSite` and `Path=/`.
- Session state and revocation live in PostgreSQL; provider ID/access tokens are not browser sessions.
- Login, linking and privilege/capability changes rotate the session identifier.
- Server derives canonical actor from the session for every command/query.
- Client-provided `user_id`, `trainer_id` or `athlete_id` is a resource reference, never actor identity.

Exact idle and absolute lifetimes remain open until the B1 environment and alpha operating model are selected.

## 7. Database Actor Context

The application authorization layer validates actor and command first. Repository transactions then set a transaction-local application actor context for RLS, for example an internal `app.user_id`/capability mechanism. The final SQL API is a B1 engineering decision.

Constraints:

- context is transaction-local and cannot leak through pooled connections;
- ordinary application roles cannot bypass RLS;
- migrations/background workers use separate least-privilege roles;
- no `auth.uid()` dependency remains in canonical policies;
- negative cross-user and cross-relation policy tests are mandatory.

## 8. External References

- Google server-side ID token verification: `https://developers.google.com/identity/gsi/web/guides/verify-google-id-token`
- Telegram Login/OIDC: `https://core.telegram.org/bots/telegram-login`
- Telegram Mini App data validation: `https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app`
- OWASP email verification: `https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html`
- OWASP session management: `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`

