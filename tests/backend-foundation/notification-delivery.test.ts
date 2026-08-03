import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryNotificationDelivery,
  TelegramNotificationDelivery,
} from "../../lib/server/notifications/notification-delivery";
import { notificationMessage } from "../../lib/server/notifications/notification-messages";

test("notification copy is generic and routes to the canonical role surfaces", () => {
  assert.deepEqual(notificationMessage("workout_assigned"), {
    text: "Вам назначена новая тренировка.",
    actionLabel: "Открыть тренировки",
    actionPath: "/client/workouts",
  });
  assert.equal(notificationMessage("workout_completed").actionPath, "/trainer/attention");
  assert.equal(notificationMessage("review_feedback_ready").actionPath, "/client/me");
});

test("memory delivery never contacts Telegram", async () => {
  const result = await new MemoryNotificationDelivery().deliver({
    notificationId: "notification-1",
    recipient: "123456",
    message: notificationMessage("workout_assigned"),
  });
  assert.deepEqual(result, { ok: true, providerMessageId: "memory:notification-1" });
});

test("Telegram delivery sends generic text and an HTTPS canonical link", async () => {
  let requestUrl = "";
  const captured: { body: Record<string, unknown> | null } = { body: null };
  const delivery = new TelegramNotificationDelivery(
    "synthetic-token",
    "https://coach.example.test",
    async (url, init) => {
      requestUrl = String(url);
      captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ ok: true, result: { message_id: 42 } });
    },
  );
  const result = await delivery.deliver({
    notificationId: "notification-2",
    recipient: "81818181",
    message: notificationMessage("workout_completed"),
  });

  assert.ok(captured.body);
  assert.equal(requestUrl, "https://api.telegram.org/botsynthetic-token/sendMessage");
  assert.equal(captured.body.chat_id, "81818181");
  assert.equal(captured.body.text, "Спортсмен завершил тренировку. Она готова к разбору.");
  assert.deepEqual(captured.body.reply_markup, {
    inline_keyboard: [[{
      text: "Открыть очередь разбора",
      url: "https://coach.example.test/trainer/attention",
    }]],
  });
  assert.deepEqual(result, { ok: true, providerMessageId: "42" });
});

test("Telegram delivery rejects non-HTTPS origins and classifies rate limits", async () => {
  assert.throws(
    () => new TelegramNotificationDelivery("token", "http://127.0.0.1:3000"),
    /HTTPS/,
  );
  const delivery = new TelegramNotificationDelivery(
    "synthetic-token",
    "https://coach.example.test",
    async () => Response.json(
      { ok: false, parameters: { retry_after: 17 } },
      { status: 429 },
    ),
  );
  assert.deepEqual(await delivery.deliver({
    notificationId: "notification-3",
    recipient: "81818181",
    message: notificationMessage("review_feedback_ready"),
  }), {
    ok: false,
    errorCode: "telegram_rate_limited",
    retryable: true,
    retryAfterSeconds: 17,
  });
});
