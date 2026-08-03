import "server-only";

import { resolveDeploymentStage } from "@/lib/server/runtime/deployment-config";

export type NotificationDeliveryMode = "memory" | "disabled" | "telegram";

function positiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function notificationConfig() {
  const stage = resolveDeploymentStage(process.env);
  const fallbackMode: NotificationDeliveryMode = stage === "local" || stage === "test"
    ? "memory"
    : "disabled";
  const rawMode = process.env.NOTIFICATION_DELIVERY_MODE?.trim() || fallbackMode;
  if (!(["memory", "disabled", "telegram"] as string[]).includes(rawMode)) {
    throw new Error("NOTIFICATION_DELIVERY_MODE must be memory, disabled or telegram");
  }

  return {
    mode: rawMode as NotificationDeliveryMode,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    publicOrigin: process.env.AUTH_PUBLIC_ORIGIN?.trim() || "http://127.0.0.1:3000",
    batchSize: positiveInteger("NOTIFICATION_WORKER_BATCH_SIZE", 25),
    leaseSeconds: positiveInteger("NOTIFICATION_WORKER_LEASE_SECONDS", 60),
    maxAttempts: positiveInteger("NOTIFICATION_MAX_ATTEMPTS", 8),
    retryBaseSeconds: positiveInteger("NOTIFICATION_RETRY_BASE_SECONDS", 30),
  };
}
