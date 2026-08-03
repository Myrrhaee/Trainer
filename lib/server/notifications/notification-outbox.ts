import "server-only";

import type { PoolClient } from "pg";

import type {
  NotificationAggregateType,
  NotificationEventType,
} from "@/lib/server/notifications/notification-types";

export function enqueueNotification(
  client: PoolClient,
  input: {
    eventType: NotificationEventType;
    recipientUserId: string;
    actorUserId: string;
    aggregateType: NotificationAggregateType;
    aggregateId: string;
  },
) {
  const deduplicationKey = `${input.eventType}:${input.aggregateId}`;
  return client.query(
    `INSERT INTO app.notification_outbox (
       event_type, recipient_user_id, actor_user_id,
       aggregate_type, aggregate_id, deduplication_key
     ) VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [
      input.eventType,
      input.recipientUserId,
      input.actorUserId,
      input.aggregateType,
      input.aggregateId,
      deduplicationKey,
    ],
  );
}
