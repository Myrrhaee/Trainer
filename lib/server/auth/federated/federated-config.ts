import "server-only";

import { randomBytes } from "node:crypto";

import type { FederatedProvider } from "@/lib/server/auth/federated/federated-types";

export interface FederatedAuthConfig {
  flowTtlSeconds: number;
  rateWindowSeconds: number;
  maxRequestsPerIp: number;
  secret: Buffer;
  googleClientId: string | null;
  telegramClientId: string | null;
  telegramClientSecret: string | null;
  publicOrigin: string | null;
}

const globalWithDevelopmentSecret = globalThis as typeof globalThis & {
  __aiStrengthDevelopmentFederatedSecret?: Buffer;
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

function flowSecret() {
  const configured = process.env.AUTH_FLOW_SECRET;
  if (configured) {
    if (Buffer.byteLength(configured, "utf8") < 32) {
      throw new Error("AUTH_FLOW_SECRET must contain at least 32 bytes");
    }
    return Buffer.from(configured, "utf8");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_FLOW_SECRET is required in production");
  }
  globalWithDevelopmentSecret.__aiStrengthDevelopmentFederatedSecret ??= randomBytes(32);
  return globalWithDevelopmentSecret.__aiStrengthDevelopmentFederatedSecret;
}

function optional(name: string) {
  return process.env[name]?.trim() || null;
}

export function federatedAuthConfig(): FederatedAuthConfig {
  const publicOrigin = optional("AUTH_PUBLIC_ORIGIN");
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) {
    throw new Error("AUTH_PUBLIC_ORIGIN must be an origin without a path");
  }
  if (process.env.NODE_ENV === "production" && !publicOrigin) {
    throw new Error("AUTH_PUBLIC_ORIGIN is required in production");
  }
  return {
    flowTtlSeconds: positiveInteger("AUTH_FLOW_TTL_SECONDS", 10 * 60),
    rateWindowSeconds: positiveInteger("AUTH_FLOW_RATE_WINDOW_SECONDS", 15 * 60),
    maxRequestsPerIp: positiveInteger("AUTH_FLOW_MAX_REQUESTS_PER_IP", 20),
    secret: flowSecret(),
    googleClientId: optional("GOOGLE_CLIENT_ID"),
    telegramClientId: optional("TELEGRAM_CLIENT_ID"),
    telegramClientSecret: optional("TELEGRAM_CLIENT_SECRET"),
    publicOrigin,
  };
}

export function isFederatedProvider(value: unknown): value is FederatedProvider {
  return value === "google" || value === "telegram";
}
