import assert from "node:assert/strict";
import test from "node:test";

import { federatedProviderAvailability } from "../../lib/server/auth/federated/provider-availability";

test("federated providers remain hidden until their complete server configuration exists", () => {
  assert.deepEqual(federatedProviderAvailability({}), {
    google: false,
    telegramBrowser: false,
    telegramMiniApp: false,
  });

  assert.deepEqual(federatedProviderAvailability({
    GOOGLE_CLIENT_ID: "google-client",
    TELEGRAM_CLIENT_ID: "telegram-client",
  }), {
    google: true,
    telegramBrowser: false,
    telegramMiniApp: false,
  });
});

test("browser Telegram and Mini App availability are independent", () => {
  assert.deepEqual(federatedProviderAvailability({
    TELEGRAM_CLIENT_ID: "telegram-client",
    TELEGRAM_CLIENT_SECRET: "telegram-secret",
  }), {
    google: false,
    telegramBrowser: true,
    telegramMiniApp: false,
  });

  assert.deepEqual(federatedProviderAvailability({
    TELEGRAM_BOT_TOKEN: "bot-token",
  }), {
    google: false,
    telegramBrowser: false,
    telegramMiniApp: true,
  });
});
