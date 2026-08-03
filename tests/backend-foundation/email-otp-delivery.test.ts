import assert from "node:assert/strict";
import test from "node:test";

import { ResendEmailOtpDelivery } from "../../lib/server/auth/email/email-otp-delivery";

const message = {
  challengeId: "00000000-0000-4000-8000-000000000001",
  email: "athlete@example.test",
  code: "123456",
  expiresAt: new Date("2026-08-04T12:00:00.000Z"),
};

test("Resend adapter sends the OTP with provider idempotency and no challenge metadata", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const request: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ id: "synthetic-message" }), { status: 200 });
  };
  const delivery = new ResendEmailOtpDelivery(
    "re_synthetic_test_key",
    "AI Strength Coach <login@example.test>",
    request,
  );

  await delivery.send(message);

  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.equal(requestInit?.method, "POST");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer re_synthetic_test_key");
  assert.equal(
    new Headers(requestInit?.headers).get("Idempotency-Key"),
    `email-otp/${message.challengeId}`,
  );
  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.deepEqual(body.to, [message.email]);
  assert.equal(body.from, "AI Strength Coach <login@example.test>");
  assert.match(String(body.text), /123456/);
  assert.equal(String(requestInit?.body).includes(message.challengeId), false);
});

test("Resend adapter reports only a generic status on provider rejection", async () => {
  const request: typeof fetch = async () => new Response(
    JSON.stringify({ message: "private provider detail" }),
    { status: 422 },
  );
  const delivery = new ResendEmailOtpDelivery(
    "re_private_test_key",
    "login@example.test",
    request,
  );

  await assert.rejects(
    delivery.send(message),
    (error: Error) => {
      assert.equal(error.message, "Email OTP delivery failed with status 422");
      assert.equal(error.message.includes("private provider detail"), false);
      assert.equal(error.message.includes("re_private_test_key"), false);
      return true;
    },
  );
});

test("Resend adapter rejects missing credentials before making a request", () => {
  assert.throws(
    () => new ResendEmailOtpDelivery("", ""),
    /Resend email delivery is not configured/,
  );
});
