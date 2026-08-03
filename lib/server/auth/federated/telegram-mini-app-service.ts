import "server-only";

import { createFederatedFlowId, hashFederatedValue } from "@/lib/server/auth/federated/federated-crypto";
import {
  federatedAuthConfig,
  type FederatedAuthConfig,
} from "@/lib/server/auth/federated/federated-config";
import { PostgresFederatedAuthRepository } from "@/lib/server/auth/federated/federated-repository";
import { verifyTelegramMiniAppInitData } from "@/lib/server/auth/federated/telegram-mini-app-proof";
import { SessionService } from "@/lib/server/auth/session-service";

type MiniAppConfig = FederatedAuthConfig & {
  telegramBotToken: string | null;
  miniAppMaxAgeSeconds: number;
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

export function telegramMiniAppConfig(): MiniAppConfig {
  return {
    ...federatedAuthConfig(),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    miniAppMaxAgeSeconds: positiveInteger("TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS", 5 * 60),
  };
}

export class TelegramMiniAppAuthService {
  constructor(
    private readonly repository = new PostgresFederatedAuthRepository(),
    private readonly sessions = new SessionService(),
    private readonly config: MiniAppConfig = telegramMiniAppConfig(),
  ) {}

  async authenticate(input: { initData: string; requestIp: string }) {
    if (!this.config.telegramBotToken) {
      return { ok: false as const, reason: "provider_unavailable" as const };
    }
    const verified = verifyTelegramMiniAppInitData({
      initData: input.initData,
      botToken: this.config.telegramBotToken,
      maxAgeSeconds: this.config.miniAppMaxAgeSeconds,
    });
    if (!verified) return { ok: false as const, reason: "invalid_proof" as const };

    const flowId = createFederatedFlowId();
    const created = await this.repository.createTelegramMiniAppFlow({
      id: flowId,
      replayHash: hashFederatedValue(
        this.config.secret,
        "telegram-mini-app-init-data",
        input.initData,
      ),
      authDateHash: hashFederatedValue(
        this.config.secret,
        "telegram-mini-app-auth-date",
        verified.authDate.toISOString(),
      ),
      requestIpHash: hashFederatedValue(this.config.secret, "request-ip", input.requestIp),
      expiresAt: new Date(Date.now() + this.config.flowTtlSeconds * 1_000),
      rateWindowSeconds: this.config.rateWindowSeconds,
      maxRequestsPerIp: this.config.maxRequestsPerIp,
    });
    if (created !== "created") return { ok: false as const, reason: created };

    const completed = await this.repository.complete({
      flowId,
      proof: verified.proof,
      actorUserId: null,
      sessionId: null,
    });
    if (!completed.ok) return completed;

    return {
      ...completed,
      issued: await this.sessions.issue(completed.userId),
      startParam: verified.startParam,
    };
  }
}
