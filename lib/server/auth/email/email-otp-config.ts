import "server-only";

import { randomBytes } from "node:crypto";

export interface EmailOtpConfig {
  challengeTtlSeconds: number;
  resendCooldownSeconds: number;
  rateWindowSeconds: number;
  maxRequestsPerTarget: number;
  maxRequestsPerIp: number;
  maxAttempts: number;
  pepper: Buffer;
}

const globalWithDevelopmentPepper = globalThis as typeof globalThis & {
  __aiStrengthDevelopmentOtpPepper?: Buffer;
};

function positiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function otpPepper() {
  const configured = process.env.AUTH_OTP_PEPPER;
  if (configured) {
    if (Buffer.byteLength(configured, "utf8") < 32) {
      throw new Error("AUTH_OTP_PEPPER must contain at least 32 bytes");
    }
    return Buffer.from(configured, "utf8");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_OTP_PEPPER is required in production");
  }

  globalWithDevelopmentPepper.__aiStrengthDevelopmentOtpPepper ??= randomBytes(32);
  return globalWithDevelopmentPepper.__aiStrengthDevelopmentOtpPepper;
}

export function emailOtpConfig(): EmailOtpConfig {
  return {
    challengeTtlSeconds: positiveInteger("AUTH_OTP_TTL_SECONDS", 10 * 60),
    resendCooldownSeconds: positiveInteger("AUTH_OTP_RESEND_COOLDOWN_SECONDS", 60),
    rateWindowSeconds: positiveInteger("AUTH_OTP_RATE_WINDOW_SECONDS", 15 * 60),
    maxRequestsPerTarget: positiveInteger("AUTH_OTP_MAX_REQUESTS_PER_TARGET", 3),
    maxRequestsPerIp: positiveInteger("AUTH_OTP_MAX_REQUESTS_PER_IP", 10),
    maxAttempts: positiveInteger("AUTH_OTP_MAX_ATTEMPTS", 5),
    pepper: otpPepper(),
  };
}
