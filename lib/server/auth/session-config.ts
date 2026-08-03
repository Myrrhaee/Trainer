import "server-only";

const DEFAULT_IDLE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_ABSOLUTE_SECONDS = 30 * 24 * 60 * 60;

function durationSeconds(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export interface SessionConfig {
  idleTtlSeconds: number;
  absoluteTtlSeconds: number;
}

export function sessionConfig(): SessionConfig {
  const idleTtlSeconds = durationSeconds("SESSION_IDLE_TTL_SECONDS", DEFAULT_IDLE_SECONDS);
  const absoluteTtlSeconds = durationSeconds(
    "SESSION_ABSOLUTE_TTL_SECONDS",
    DEFAULT_ABSOLUTE_SECONDS,
  );

  if (idleTtlSeconds > absoluteTtlSeconds) {
    throw new Error("SESSION_IDLE_TTL_SECONDS cannot exceed SESSION_ABSOLUTE_TTL_SECONDS");
  }

  return { idleTtlSeconds, absoluteTtlSeconds };
}
