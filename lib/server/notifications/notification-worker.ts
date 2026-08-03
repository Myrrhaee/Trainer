import "server-only";

import {
  DisabledNotificationDelivery,
  MemoryNotificationDelivery,
  TelegramNotificationDelivery,
  type NotificationDeliveryAdapter,
} from "@/lib/server/notifications/notification-delivery";
import { notificationConfig } from "@/lib/server/notifications/notification-config";
import { notificationMessage } from "@/lib/server/notifications/notification-messages";
import { NotificationOutboxRepository } from "@/lib/server/notifications/notification-repository";

type WorkerConfig = ReturnType<typeof notificationConfig>;

function deliveryAdapter(config: WorkerConfig): NotificationDeliveryAdapter {
  if (config.mode === "memory") return new MemoryNotificationDelivery();
  if (config.mode === "disabled") return new DisabledNotificationDelivery();
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for telegram notification delivery");
  }
  return new TelegramNotificationDelivery(config.telegramBotToken, config.publicOrigin);
}

export class NotificationWorker {
  constructor(
    private readonly repository = new NotificationOutboxRepository(),
    private readonly config: WorkerConfig = notificationConfig(),
    private readonly delivery: NotificationDeliveryAdapter = deliveryAdapter(config),
  ) {}

  async drainOnce() {
    const claimed = await this.repository.claimBatch(
      this.config.batchSize,
      this.config.leaseSeconds,
    );
    const summary = { claimed: claimed.length, delivered: 0, retried: 0, deadLettered: 0 };

    for (const notification of claimed) {
      const recipient = await this.repository.telegramRecipient(notification.recipientUserId);
      const result = recipient
        ? await this.delivery.deliver({
          notificationId: notification.id,
          recipient,
          message: notificationMessage(notification.eventType),
        })
        : { ok: false as const, errorCode: "telegram_recipient_unavailable", retryable: true };

      if (result.ok) {
        await this.repository.markDelivered(notification, result.providerMessageId);
        summary.delivered += 1;
        continue;
      }

      const dead = !result.retryable || notification.attemptCount >= this.config.maxAttempts;
      const exponentialDelay = this.config.retryBaseSeconds * 2 ** Math.max(0, notification.attemptCount - 1);
      await this.repository.markFailed(notification, {
        errorCode: result.errorCode,
        retryable: result.retryable,
        retryAfterSeconds: Math.min(result.retryAfterSeconds ?? exponentialDelay, 24 * 60 * 60),
        maxAttempts: this.config.maxAttempts,
      });
      if (dead) summary.deadLettered += 1;
      else summary.retried += 1;
    }
    return summary;
  }
}
