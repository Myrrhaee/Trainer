import "server-only";

import type {
  NotificationDeliveryResult,
  NotificationMessage,
} from "@/lib/server/notifications/notification-types";

export interface NotificationDeliveryAdapter {
  deliver(input: {
    notificationId: string;
    recipient: string;
    message: NotificationMessage;
  }): Promise<NotificationDeliveryResult>;
}

export class MemoryNotificationDelivery implements NotificationDeliveryAdapter {
  async deliver(input: {
    notificationId: string;
    recipient: string;
    message: NotificationMessage;
  }): Promise<NotificationDeliveryResult> {
    return { ok: true, providerMessageId: `memory:${input.notificationId}` };
  }
}

export class DisabledNotificationDelivery implements NotificationDeliveryAdapter {
  async deliver(): Promise<NotificationDeliveryResult> {
    return { ok: false, errorCode: "delivery_disabled", retryable: true };
  }
}

export class TelegramNotificationDelivery implements NotificationDeliveryAdapter {
  constructor(
    private readonly botToken: string,
    private readonly publicOrigin: string,
    private readonly request: typeof fetch = fetch,
  ) {
    const origin = new URL(publicOrigin);
    if (origin.protocol !== "https:") {
      throw new Error("Telegram notification delivery requires an HTTPS AUTH_PUBLIC_ORIGIN");
    }
  }

  async deliver(input: {
    notificationId: string;
    recipient: string;
    message: NotificationMessage;
  }): Promise<NotificationDeliveryResult> {
    try {
      const response = await this.request(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: input.recipient,
            text: input.message.text,
            reply_markup: {
              inline_keyboard: [[{
                text: input.message.actionLabel,
                url: new URL(input.message.actionPath, this.publicOrigin).toString(),
              }]],
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );
      const body = await response.json().catch(() => null) as {
        result?: { message_id?: number };
        parameters?: { retry_after?: number };
      } | null;
      if (response.ok) {
        const messageId = body?.result?.message_id;
        return {
          ok: true,
          providerMessageId: Number.isSafeInteger(messageId) ? String(messageId) : null,
        };
      }
      const retryAfter = body?.parameters?.retry_after;
      return {
        ok: false,
        errorCode: response.status === 429 ? "telegram_rate_limited" : `telegram_http_${response.status}`,
        retryable: response.status === 429 || response.status >= 500,
        ...(Number.isSafeInteger(retryAfter) && Number(retryAfter) > 0
          ? { retryAfterSeconds: Number(retryAfter) }
          : {}),
      };
    } catch {
      return { ok: false, errorCode: "telegram_transport_error", retryable: true };
    }
  }
}
