import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifyTelegramMiniAppInitData } from "../../lib/server/auth/federated/telegram-mini-app-proof";

const botToken = "123456789:test-bot-token-with-sufficient-entropy";
const now = new Date("2026-08-03T12:00:00.000Z");

function signedInitData(overrides: Record<string, string> = {}) {
  const fields = new Map<string, string>([
    ["auth_date", String(Math.floor(now.getTime() / 1_000))],
    ["query_id", "AAHdF6IQAAAAAN0XohDhrOrc"],
    ["start_param", "A".repeat(43)],
    ["user", JSON.stringify({
      id: 42424242,
      first_name: "  Test ",
      last_name: " Athlete  ",
      username: "strength_user",
      language_code: "ru",
      is_premium: true,
      allows_write_to_pm: true,
    })],
  ]);
  for (const [key, value] of Object.entries(overrides)) fields.set(key, value);
  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  fields.set("hash", createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return new URLSearchParams([...fields.entries()]).toString();
}

test("Telegram Mini App proof verifies signature, freshness and stable identity", () => {
  const verified = verifyTelegramMiniAppInitData({
    initData: signedInitData(),
    botToken,
    maxAgeSeconds: 300,
    now,
  });

  assert.equal(verified?.proof.provider, "telegram");
  assert.equal(verified?.proof.subject, "42424242");
  assert.equal(verified?.proof.displayName, "Test Athlete");
  assert.equal(verified?.proof.metadata.username, "strength_user");
  assert.equal(verified?.proof.metadata.allowsWriteToPm, true);
  assert.equal(verified?.startParam, "A".repeat(43));
});

test("Telegram Mini App proof rejects tampering, stale data and duplicate fields", () => {
  const valid = signedInitData();
  const tampered = valid.replace("strength_user", "attacker_user");
  assert.equal(verifyTelegramMiniAppInitData({
    initData: tampered,
    botToken,
    maxAgeSeconds: 300,
    now,
  }), null);

  const stale = signedInitData({
    auth_date: String(Math.floor(now.getTime() / 1_000) - 301),
  });
  assert.equal(verifyTelegramMiniAppInitData({
    initData: stale,
    botToken,
    maxAgeSeconds: 300,
    now,
  }), null);

  const duplicate = `${valid}&user=${encodeURIComponent(JSON.stringify({
    id: 7,
    first_name: "Attacker",
  }))}`;
  assert.equal(verifyTelegramMiniAppInitData({
    initData: duplicate,
    botToken,
    maxAgeSeconds: 300,
    now,
  }), null);
});
