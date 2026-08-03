import "server-only";

import { createHmac, randomInt, randomUUID } from "node:crypto";

function hmac(pepper: Buffer, value: string) {
  return createHmac("sha256", pepper).update(value, "utf8").digest();
}

export function createEmailOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function createChallengeId() {
  return randomUUID();
}

export function hashOtpTarget(pepper: Buffer, normalizedEmail: string) {
  return hmac(pepper, `email-target\0${normalizedEmail}`);
}

export function hashOtpRequestIp(pepper: Buffer, ipAddress: string) {
  return hmac(pepper, `request-ip\0${ipAddress}`);
}

export function hashOtpSecret(
  pepper: Buffer,
  challengeId: string,
  normalizedEmail: string,
  code: string,
) {
  return hmac(pepper, `email-code\0${challengeId}\0${normalizedEmail}\0${code}`);
}

export function isEmailOtpCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}
