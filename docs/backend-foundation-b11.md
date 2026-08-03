# Backend Foundation B11: Transactional Telegram Notifications

- Date: 2026-08-04
- Status: **local implementation complete; live delivery deliberately disabled**
- Scope: durable notification events for the canonical trainer-client workout loop

## Implemented Contract

1. Creating a workout assignment transactionally enqueues `workout_assigned` for the athlete.
2. Completing a workout transactionally enqueues `workout_completed` for the trainer.
3. Sending trainer feedback or a follow-up transactionally enqueues `review_feedback_ready` for the athlete. Manual review resolution sends nothing.
4. The outbox stores product event identity only. Message bodies are fixed server-side and do not include workout details, athlete comments, feedback text or health data.
5. Stable event keys and existing workflow command receipts prevent duplicate delivery after request retries.
6. `ai_strength_app` may insert only an event justified by the canonical assignment, session or feedback row under the current actor. It cannot read or process the outbox.
7. `ai_strength_worker` claims rows with `FOR UPDATE SKIP LOCKED`, processing leases, bounded exponential retry, expiry and dead-letter states.
8. Telegram recipient resolution uses the canonical numeric Telegram identity only when the identity is active and carries explicit `telegram:bot_access` or Mini App `allows_write_to_pm` evidence.
9. Local/test delivery defaults to `memory`; external stages default to `disabled`. Telegram Bot API calls require an explicit `telegram` mode, bot token and HTTPS public origin.
10. Worker logs contain aggregate counters only and never include bot tokens, Telegram IDs, message bodies or provider response bodies.

## Persistence

Migration `0010_notification_outbox` adds:

- `app.notification_outbox`;
- `app.notification_event_type`;
- `app.notification_delivery_status`;
- `app_private.telegram_notification_recipient(uuid)` as a narrow worker-only consent resolver.

The outbox is channel-neutral even though Telegram is the first adapter. Product transactions do not call Telegram directly.

## Delivery States

`pending -> processing -> delivered`

Transient failures and missing messaging permission move through `retry_wait`. Permanent provider failures or exhaustion of the configured attempt limit move to `dead_letter`. Events older than seven days are `cancelled` before claim. A stale `processing` lease may be reclaimed after `NOTIFICATION_WORKER_LEASE_SECONDS`.

## Runtime Inputs

| Variable | Purpose | Local state |
| --- | --- | --- |
| `DATABASE_WORKER_URL` | Dedicated least-privilege worker login | falls back to local `DATABASE_URL` |
| `NOTIFICATION_DELIVERY_MODE` | `memory`, `disabled` or `telegram` | `memory` |
| `NOTIFICATION_WORKER_BATCH_SIZE` | Claim size | `25` |
| `NOTIFICATION_WORKER_LEASE_SECONDS` | Crash-recovery lease | `60` |
| `NOTIFICATION_MAX_ATTEMPTS` | Dead-letter threshold | `8` |
| `NOTIFICATION_RETRY_BASE_SECONDS` | Exponential retry base | `30` |
| `TELEGRAM_BOT_TOKEN` | Bot API credential | configured outside Git; unused by memory mode |
| `AUTH_PUBLIC_ORIGIN` | Base for canonical action links | live mode requires HTTPS |

Local one-shot command:

```bash
npm run notifications:drain
```

## Verification Evidence

| Check | Result |
| --- | --- |
| Clean PostgreSQL 16 bootstrap and migrations `0001-0010` | pass |
| Full backend suite against disposable PostgreSQL 16 | 54/54 pass |
| Migration `0010` rollback and remigrate | pass |
| App-role event forgery | rejected by RLS |
| Telegram identity without messaging permission | not resolved; event retried |
| OIDC and Mini App explicit messaging consent | resolved to canonical numeric Telegram ID |
| Local memory drain | delivered without a network request |
| Telegram adapter URL, copy and 429 handling | pass with synthetic fetch |

No Telegram message was sent and no external infrastructure was created during B11 verification.

## Deliberately Deferred

- No permanent worker process, scheduler, cron or cloud queue.
- No live Bot API delivery test.
- No notification preferences UI, quiet hours, reminder scheduling or manual reminder action.
- No migration of legacy `/api/send-reminder`, `/api/notify-complete` or `/api/tg-webhook`; they remain outside the canonical B11 path.
- No alerting or operator UI for `dead_letter` rows.

## Next Gate

Before a closed external pilot, choose a public HTTPS runtime and worker scheduler, configure a dedicated `ai_strength_worker` login, then verify one assignment-completion-feedback loop with non-production Telegram accounts. Live mode must remain off until that environment is ready.
