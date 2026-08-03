import "server-only";

export type DatabasePurpose = "app" | "auth" | "health" | "worker";

const DEFAULT_POOL_SIZE = 5;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

function positiveInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function databaseConnectionString(purpose: DatabasePurpose) {
  const specificName = purpose === "app"
    ? "DATABASE_APP_URL"
    : purpose === "auth"
      ? "DATABASE_AUTH_URL"
      : purpose === "health"
        ? "DATABASE_HEALTH_URL"
        : "DATABASE_WORKER_URL";
  const value = process.env[specificName] ?? process.env.DATABASE_URL;

  if (!value) {
    throw new Error(`${specificName} or DATABASE_URL is required`);
  }
  return value;
}

export function databasePoolConfig() {
  return {
    max: positiveInteger("DATABASE_POOL_MAX", DEFAULT_POOL_SIZE),
    connectionTimeoutMillis: positiveInteger(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      DEFAULT_CONNECTION_TIMEOUT_MS,
    ),
    idleTimeoutMillis: positiveInteger("DATABASE_IDLE_TIMEOUT_MS", DEFAULT_IDLE_TIMEOUT_MS),
  };
}
