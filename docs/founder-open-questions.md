# Founder Open Questions

Дата обновления: 2026-08-02
Статус: resolved product/auth decisions plus remaining questions requiring founder or research input

## Resolved Working Decisions

| Area | Decision | Status | Trace |
| --- | --- | --- | --- |
| Payer model | Working hypothesis: trainer pays for the product; client access is included in coaching. | proposed / requires pricing research | `docs/decision-log.md` D-034 |
| Standalone client | Client without trainer is not a primary first-MVP scenario. Existing standalone client UI is preserved as future opportunity. | accepted as non-core for first MVP | `docs/decision-log.md` D-035 |
| Review cadence | Each completed assigned workout creates a review AttentionItem in first beta. Trainer can provide detailed feedback, short acknowledgement, or close quickly. | accepted for first beta | `docs/decision-log.md` D-036 |
| Feedback source of truth | Trainer feedback must be stored inside the product. External messengers may later deliver notifications or links but are not system of record. | accepted | `docs/decision-log.md` D-037 |
| First AI capability | AI summarizes completed workout, identifies deviations and client comments, and prepares editable feedback draft. Trainer confirms. | proposed / requires validation | `docs/decision-log.md` D-038 |
| Payments as MVP blocker | Full automatic payments are not blocker for first MVP. Beta may use manual access, invitation-only onboarding, simple access status and optional expiration date. | accepted as non-blocking | `docs/decision-log.md` D-039 |
| Backend platform | PostgreSQL is canonical; Supabase provider/Auth/Storage are no longer default first-beta dependencies. | accepted | `docs/decision-log.md` D-127 |
| Login methods | Email OTP, Google and Telegram resolve through one internal User/AuthIdentity model. | accepted | `docs/decision-log.md` D-128-D-130 |
| Session model | Product owns revocable server sessions in secure HttpOnly cookies. | accepted | `docs/decision-log.md` D-131 |
| Account linking | Linking requires current login plus fresh verification; matching email never silently merges accounts. | accepted | `docs/decision-log.md` D-132 |
| Product data access | Browser does not connect directly to PostgreSQL; durable reads/writes use backend services. | accepted | `docs/decision-log.md` D-133-D-134 |
| Database implementation | Explicit SQL migrations, `pg` pools, typed repositories and four separate PostgreSQL role boundaries. | accepted engineering baseline | `docs/decision-log.md` D-139-D-140 |
| Session lifetime | 7-day sliding idle lifetime and non-extendable 30-day absolute lifetime, configurable server-side. | accepted implementation baseline | `docs/decision-log.md` D-141 |
| Email OTP implementation | Hashed single-use challenges, application-session issuance and a local-only delivery adapter are implemented; real email delivery is not selected. | accepted engineering baseline | `docs/decision-log.md` D-144-D-146 |
| Federated identity implementation | Google GIS verification, Telegram OIDC+PKCE, explicit linking/unlinking and no-silent-merge account resolution are implemented locally; live credentials are not configured. | accepted engineering baseline | `docs/decision-log.md` D-148-D-152 |
| Capability onboarding | Trainer capability requires manual closed-alpha activation; Athlete capability and the canonical relation require a single-use trainer invitation. | accepted implementation baseline | `docs/decision-log.md` D-153-D-157 |

## Backend Foundation

| Question | Why it matters | Working recommendation | Required by |
| --- | --- | --- | --- |
| Which managed PostgreSQL provider, region and billing/secret owner do we choose? | Blocks staging deployment, backups, pooling and real identity data | Managed, not self-hosted; decide from region/restore/operations | before staging or real data |
| Which email provider and sending domain do we use? | Blocks real OTP delivery and deliverability controls | Transactional provider plus SPF/DKIM/DMARC | before staging or external email-auth testing |
| Who owns Google and Telegram test applications and which callback origin is registered? | Blocks live signature/code-exchange verification | One non-production Google web client and Telegram OIDC bot/client with secrets outside Git | before live B3 testing or staging |
| Who owns and records manual trainer approvals? | Prevents untracked privilege grants during closed alpha | Founder-led approval with an audited operations workflow before scale | before external alpha |
| What happens if all verified providers are lost? | Prevents insecure manual account takeover | Require additional identity where possible; define support recovery | before closed alpha |
| Which generic events go to Telegram/email? | Prevents notification noise and sensitive payload leakage | Assignment and feedback first; details remain in product | before external alpha if an external channel is required |

## Target Segment

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Какой подтип strength coach является лучшим ICP: hypertrophy, general strength, powerlifting-adjacent, body recomposition, beginner fitness? | Даже внутри strength сегмента разные методики и ритм обратной связи | Messaging, demo scenarios, exercise defaults, progress metrics | Start with online/hybrid one-to-one strength/hypertrophy/general fitness coach | before beta |
| Сколько активных клиентов и завершенных тренировок в неделю реально обрабатывает тренер? | Определяет плотность Attention queue и ценность triage | Dashboard density, notifications, pricing tiers | 10-30 active clients, multiple completed workouts per week | before beta |
| Какой minimum viable team/client volume создает боль, а не просто nice-to-have? | При малом объеме тренер может справляться в мессенджере | ICP, onboarding qualification, pricing | Pain starts around 10+ active clients | before beta |

## Trainer Workflow

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Какие параметры тренировки критичны для разных методик: RPE, RIR, tempo, rest, warm-up sets, video, pain notes? | Builder и review должны поддерживать реальные coaching decisions | WorkoutTemplate fields, WorkoutLog schema, review UI | Sets/reps/weight/comments first; RPE/RIR likely needed soon | before implementation |
| Что считается достаточным "short acknowledgement" для закрытия review item? | Нужно избежать перегруза тренера обязательным подробным feedback | Feedback UX, close states, analytics | Short acknowledgement can close low-risk session | before beta |
| Какие признаки должны влиять на будущую приоритизацию AttentionItem? | Сейчас every completion creates item, но дальше нужна умная очередь | Future triage, AI, prioritization rules | Missed target, client comment, pain, PR, skipped workout, stagnation | before beta |

## Builder And Assignment

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Как тренер ожидает разделять Save Template и Assign Workout в одном flow? | Это главный UX-risk текущего builder prototype | Builder IA, buttons, backend contract | Separate actions; assignment can happen after save or from template library | before MVP architecture |
| Должен ли trainer чаще создавать template from scratch или duplicate/edit previous workout? | Определяет самый быстрый builder path | Builder UX, template library, reuse mechanics | Duplicate/edit will be important after MVP | before implementation |
| Какие empty states нужны до появления template library? | Первый опыт тренера не должен упираться в пустоту | Onboarding, starter templates, exercise library | Starter templates may be useful, but not yet accepted | before beta |

## Communication And Notifications

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Нужен ли внешний notification channel в первой beta: Telegram, email, WhatsApp link, push позже? | Feedback хранится в продукте, но клиент должен узнать о нем | Notification architecture, beta operations | External notification optional but likely useful | before beta |
| Какие события требуют уведомления клиента: assignment, feedback, missed workout, trainer comment? | Слишком много уведомлений создаст шум | Notification rules, user settings | Assignment and feedback first | before beta |

## AI

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Какой уровень объяснения AI нужен тренеру, чтобы доверять draft feedback? | AI draft без понятной причины может не использоваться | AI UX, prompt outputs, auditability | Show deviations and source facts near draft | before beta |
| Нужно ли показывать AI confidence или лучше показывать source evidence? | Confidence может создать ложную точность | AI UI, trust model | Prefer source evidence over numeric confidence | before beta |
| Какие действия AI никогда не должен делать автоматически после beta? | Safety boundary должен быть понятен заранее | Permissions, automation roadmap | No autonomous send, load adjustment or prescription without trainer confirm | later |

## Pricing And Business Model

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Какую цену тренер готов платить за core workflow без advanced automation? | Payer model предложен, но price не доказан | Pricing, packaging, beta offer | Trainer pays; exact price unknown | before beta |
| Цена должна зависеть от количества клиентов, активных assignments или flat workspace fee? | Нужна честная связь value/cost | Billing model, limits, onboarding | Client-tier pricing likely, but unvalidated | before beta |

## Achievements And Motivation

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Какие achievements реально помогают клиенту, а какие являются decorative layer? | Сложная мотивация может отвлечь от workout loop | Client progress, profile, rank system | Preserve assets, keep non-blocking | later |
| Должен ли rank/title отображаться тренеру как рабочий сигнал или только как статус клиента? | Может повлиять на trainer profile IA | Profile hero, attention logic | Rank/title are status/motivation, not review priority | later |

## Go To Market

| Question | Почему важно | На что влияет | Working hypothesis | Срочность |
| --- | --- | --- | --- | --- |
| Beta будет high-touch с личными знакомыми тренерами или cold outreach? | Разный onboarding, support и скорость обучения | Beta plan, founder involvement, docs | Start with high-touch founder-led beta | before beta |
| Что является главным обещанием лендинга: порядок в клиентах, review workflow, AI draft feedback или premium client cabinet? | Messaging должен совпадать с MVP value | Landing copy, onboarding, sales calls | "Понимать, кому нужно внимание и что сделать дальше" | before beta |
| Какая метрика доказывает product value? | Нужен критерий успеха beta | Analytics, roadmap, retention | Attention loop completion and time-to-feedback | before beta |
