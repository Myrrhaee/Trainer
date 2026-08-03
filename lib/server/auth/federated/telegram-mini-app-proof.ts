import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { FederatedIdentityProof } from "@/lib/server/auth/federated/federated-types";

const MAX_INIT_DATA_BYTES = 16 * 1024;
const MAX_FUTURE_SKEW_SECONDS = 30;

type TelegramWebAppUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
};

export type VerifiedTelegramMiniAppProof = {
  proof: FederatedIdentityProof;
  authDate: Date;
  startParam: string | null;
};

function stringField(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    ? value
    : null;
}

function parseUser(raw: string): TelegramWebAppUser | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      !value
      || typeof value !== "object"
      || !Number.isSafeInteger(value.id)
      || Number(value.id) <= 0
      || value.is_bot === true
      || !stringField(value.first_name, 128)
    ) return null;

    return {
      id: Number(value.id),
      first_name: String(value.first_name),
      ...(stringField(value.last_name, 128) ? { last_name: String(value.last_name) } : {}),
      ...(stringField(value.username, 64) ? { username: String(value.username) } : {}),
      ...(stringField(value.language_code, 35) ? { language_code: String(value.language_code) } : {}),
      ...(typeof value.is_premium === "boolean" ? { is_premium: value.is_premium } : {}),
      ...(typeof value.allows_write_to_pm === "boolean"
        ? { allows_write_to_pm: value.allows_write_to_pm }
        : {}),
      ...(stringField(value.photo_url, 2_048) ? { photo_url: String(value.photo_url) } : {}),
    };
  } catch {
    return null;
  }
}

export function verifyTelegramMiniAppInitData(input: {
  initData: string;
  botToken: string;
  maxAgeSeconds: number;
  now?: Date;
}): VerifiedTelegramMiniAppProof | null {
  if (
    !input.botToken
    || !input.initData
    || Buffer.byteLength(input.initData, "utf8") > MAX_INIT_DATA_BYTES
  ) return null;

  const params = new URLSearchParams(input.initData);
  const fields = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (fields.has(key)) return null;
    fields.set(key, value);
  }

  const receivedHash = fields.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(input.botToken, "utf8")
    .digest();
  const expectedHash = createHmac("sha256", secret)
    .update(dataCheckString, "utf8")
    .digest();
  const receivedHashBuffer = Buffer.from(receivedHash, "hex");
  if (
    receivedHashBuffer.byteLength !== expectedHash.byteLength
    || !timingSafeEqual(receivedHashBuffer, expectedHash)
  ) return null;

  const authDateSeconds = Number(fields.get("auth_date"));
  if (!Number.isSafeInteger(authDateSeconds) || authDateSeconds <= 0) return null;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  if (
    authDateSeconds > nowSeconds + MAX_FUTURE_SKEW_SECONDS
    || nowSeconds - authDateSeconds > input.maxAgeSeconds
  ) return null;

  const user = parseUser(fields.get("user") ?? "");
  if (!user) return null;
  const displayName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const metadata: FederatedIdentityProof["metadata"] = {
    source: "mini_app",
    ...(user.username ? { username: user.username } : {}),
    ...(user.language_code ? { languageCode: user.language_code } : {}),
    ...(typeof user.is_premium === "boolean" ? { isPremium: user.is_premium } : {}),
    ...(typeof user.allows_write_to_pm === "boolean"
      ? { allowsWriteToPm: user.allows_write_to_pm }
      : {}),
    ...(user.photo_url ? { photoUrl: user.photo_url } : {}),
  };

  return {
    proof: {
      provider: "telegram",
      subject: String(user.id),
      emailOriginal: null,
      emailNormalized: null,
      displayName: displayName || null,
      metadata,
    },
    authDate: new Date(authDateSeconds * 1_000),
    startParam: stringField(fields.get("start_param"), 512),
  };
}
