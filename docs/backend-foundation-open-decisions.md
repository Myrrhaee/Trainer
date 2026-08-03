# Backend Foundation Open Decisions

Date: 2026-08-02

Only decisions not already accepted in `docs/backend-foundation-b0.md` are listed here.

| ID | Decision | Working recommendation | Required by | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| B0-OD-001 | Managed PostgreSQL provider and region | Managed PostgreSQL, not self-hosted; select by region, backups, pooling, restore and operating access | Before staging or real data | Founder + Engineering | open; B1 deployment blocker |
| B0-OD-002 | Migration/query tool | Explicit checksummed SQL migrations, `pg` pools and typed repositories | B1 | Engineering | accepted 2026-08-02 |
| B0-OD-003 | Session idle and absolute lifetime | Configurable 7-day idle and non-extendable 30-day absolute lifetime | B1 | Founder + Engineering | accepted implementation baseline 2026-08-02 |
| B0-OD-004 | Email delivery provider and sender domain | Transactional provider with delivery logs; configure SPF, DKIM and DMARC | Before staging or external email-auth testing | Founder + Engineering | open; B2 local adapter only |
| B0-OD-005 | Trainer activation | Self-registration plus closed-alpha manual activation; no public approval endpoint | Before external alpha | Founder | accepted implementation baseline 2026-08-03; operating owner open |
| B0-OD-006 | Athlete onboarding | Identity may exist first, but Athlete capability and relation require a trainer invitation | Before B4 | Founder | accepted implementation baseline 2026-08-03 |
| B0-OD-007 | Recovery when primary provider is lost | Require at least one additional verified identity before self-service recovery; support-led recovery policy remains undefined | Before closed alpha | Founder + Security | open |
| B0-OD-008 | Historical access after trainer-athlete relation ends | Safe temporary default remains no trainer access to athlete-private facts after end; retention/legal policy required | Before first canonical athlete-fact migration | Founder + Legal/Privacy | open; B4 relation row retains lifecycle metadata only |
| B0-OD-009 | Object storage provider and sensitive-photo scope | Defer provider selection; ProgressPhoto remains out until consent and access policy are accepted | Before canonical progress photos or real sensitive media | Founder + Engineering | open; not part of B8/B9 |
| B0-OD-010 | Notification channels in first alpha | Assignment and feedback notifications only; generic payload with authenticated product link | Before external alpha if out-of-product delivery is required | Founder | open; B8 in-product source exists, transport not selected |
| B0-OD-011 | Google and Telegram non-production applications | Register one Google web client and one Telegram OIDC bot/client; record callback origins, credential owner and rotation process | Before live B3 testing or staging | Founder + Engineering | open; synthetic adapters only |

## Founder Answers Needed First

1. Where may the managed PostgreSQL instance be hosted, and who owns billing, backups, secrets and production access?
2. Should every trainer sign up immediately, or should closed alpha require founder approval?
3. May an athlete create an account before receiving a trainer invitation?
4. Which provider and domain will deliver login emails outside local development?
5. What is the acceptable recovery process when a user loses both Telegram/Google and email access?
6. Who owns the Google Cloud OAuth client and Telegram BotFather OIDC credentials, and which non-production origin will be registered first?
