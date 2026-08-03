import "server-only";

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";
import type {
  ClaimedNotification,
  NotificationAggregateType,
  NotificationEventType,
} from "@/lib/server/notifications/notification-types";

type NotificationRow = {
  id: string;
  event_type: NotificationEventType;
  recipient_user_id: string;
  aggregate_type: NotificationAggregateType;
  aggregate_id: string;
  attempt_count: number;
  expires_at: Date;
};

function mapClaim(row: NotificationRow, lockToken: string): ClaimedNotification {
  return {
    id: row.id,
    eventType: row.event_type,
    recipientUserId: row.recipient_user_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    attemptCount: row.attempt_count,
    lockToken,
    expiresAt: row.expires_at,
  };
}

export class NotificationOutboxRepository {
  constructor(private readonly pool: Pool = getDatabasePool("worker")) {}

  claimBatch(batchSize: number, leaseSeconds: number): Promise<ClaimedNotification[]> {
    return withDatabaseTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE app.notification_outbox
         SET status = 'cancelled', last_error_code = 'expired',
             lock_token = NULL, locked_at = NULL
         WHERE status IN ('pending', 'retry_wait', 'processing')
           AND expires_at <= clock_timestamp()`,
      );
      const lockToken = randomUUID();
      const result = await client.query<NotificationRow>(
        `WITH candidates AS (
           SELECT id
           FROM app.notification_outbox
           WHERE expires_at > clock_timestamp()
             AND (
               (status IN ('pending', 'retry_wait') AND available_at <= clock_timestamp())
               OR (
                 status = 'processing'
                 AND locked_at < clock_timestamp() - ($2::int * interval '1 second')
               )
             )
           ORDER BY available_at, created_at, id
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE app.notification_outbox notification
         SET status = 'processing', lock_token = $3, locked_at = clock_timestamp(),
             attempt_count = notification.attempt_count + 1, last_error_code = NULL
         FROM candidates
         WHERE notification.id = candidates.id
         RETURNING notification.id, notification.event_type::text,
           notification.recipient_user_id, notification.aggregate_type,
           notification.aggregate_id, notification.attempt_count, notification.expires_at`,
        [batchSize, leaseSeconds, lockToken],
      );
      return result.rows.map((row) => mapClaim(row, lockToken));
    });
  }

  async telegramRecipient(userId: string) {
    const result = await this.pool.query<{ recipient: string | null }>(
      "SELECT app_private.telegram_notification_recipient($1) AS recipient",
      [userId],
    );
    return result.rows[0]?.recipient ?? null;
  }

  async markDelivered(notification: ClaimedNotification, providerMessageId: string | null) {
    const result = await this.pool.query(
      `UPDATE app.notification_outbox
       SET status = 'delivered', delivered_at = clock_timestamp(),
           provider_message_id = $3, lock_token = NULL, locked_at = NULL,
           last_error_code = NULL
       WHERE id = $1 AND status = 'processing' AND lock_token = $2`,
      [notification.id, notification.lockToken, providerMessageId],
    );
    return result.rowCount === 1;
  }

  async markFailed(notification: ClaimedNotification, input: {
    errorCode: string;
    retryable: boolean;
    retryAfterSeconds: number;
    maxAttempts: number;
  }) {
    const dead = !input.retryable || notification.attemptCount >= input.maxAttempts;
    const result = await this.pool.query(
      `UPDATE app.notification_outbox
       SET status = $3::app.notification_delivery_status,
           available_at = CASE WHEN $3::app.notification_delivery_status = 'retry_wait'
             THEN clock_timestamp() + ($4::int * interval '1 second')
             ELSE available_at END,
           lock_token = NULL, locked_at = NULL, last_error_code = $5
       WHERE id = $1 AND status = 'processing' AND lock_token = $2`,
      [
        notification.id,
        notification.lockToken,
        dead ? "dead_letter" : "retry_wait",
        input.retryAfterSeconds,
        input.errorCode.slice(0, 120),
      ],
    );
    return result.rowCount === 1;
  }
}
