import "server-only";

import {
  createChallengeId,
  createEmailOtpCode,
  hashOtpRequestIp,
  hashOtpSecret,
  hashOtpTarget,
  isEmailOtpCode,
} from "@/lib/server/auth/email/email-otp-crypto";
import { emailOtpConfig, type EmailOtpConfig } from "@/lib/server/auth/email/email-otp-config";
import {
  getEmailOtpDelivery,
  mayDiscloseDevelopmentCode,
  type EmailOtpDelivery,
} from "@/lib/server/auth/email/email-otp-delivery";
import { normalizeEmail } from "@/lib/server/auth/email/email-normalization";
import {
  PostgresEmailOtpRepository,
  type EmailOtpRepository,
} from "@/lib/server/auth/email/email-otp-repository";
import type { EmailOtpIntent } from "@/lib/server/auth/email/email-otp-types";
import { SessionService } from "@/lib/server/auth/session-service";
import type { AuthenticatedActor } from "@/lib/server/auth/session-types";

export interface EmailOtpRequestResult {
  challengeId: string;
  retryAfterSeconds: number;
  developmentCode?: string;
}

export class EmailOtpService {
  constructor(
    private readonly repository: EmailOtpRepository = new PostgresEmailOtpRepository(),
    private readonly delivery: EmailOtpDelivery = getEmailOtpDelivery(),
    private readonly sessions = new SessionService(),
    private readonly config: EmailOtpConfig = emailOtpConfig(),
  ) {}

  async request(
    emailInput: unknown,
    requestIp: string,
    context: { intent: EmailOtpIntent; actor: AuthenticatedActor | null } = {
      intent: "login",
      actor: null,
    },
  ): Promise<EmailOtpRequestResult> {
    const email = normalizeEmail(emailInput);
    const challengeId = createChallengeId();

    if (!email) {
      hashOtpTarget(this.config.pepper, String(emailInput ?? ""));
      return {
        challengeId,
        retryAfterSeconds: this.config.resendCooldownSeconds,
      };
    }

    const code = createEmailOtpCode();
    const expiresAt = new Date(Date.now() + this.config.challengeTtlSeconds * 1_000);
    const created = await this.repository.createChallenge({
      id: challengeId,
      targetHash: hashOtpTarget(this.config.pepper, email.normalized),
      secretHash: hashOtpSecret(this.config.pepper, challengeId, email.normalized, code),
      requestIpHash: hashOtpRequestIp(this.config.pepper, requestIp),
      intent: context.intent,
      actorUserId: context.intent === "link" ? context.actor?.userId ?? null : null,
      sessionId: context.intent === "link" ? context.actor?.sessionId ?? null : null,
      maxAttempts: this.config.maxAttempts,
      expiresAt,
      resendCooldownSeconds: this.config.resendCooldownSeconds,
      rateWindowSeconds: this.config.rateWindowSeconds,
      maxRequestsPerTarget: this.config.maxRequestsPerTarget,
      maxRequestsPerIp: this.config.maxRequestsPerIp,
    });

    if (!created.created) {
      return {
        challengeId,
        retryAfterSeconds: created.retryAfterSeconds,
      };
    }

    let delivered = false;
    try {
      await this.delivery.send({
        challengeId,
        email: email.original,
        code,
        expiresAt,
      });
      delivered = true;
    } catch {
      delivered = false;
    } finally {
      await this.repository.markDelivery(challengeId, delivered);
    }

    const developmentCode = mayDiscloseDevelopmentCode()
      ? this.delivery.developmentCode?.(challengeId) ?? undefined
      : undefined;
    return {
      challengeId,
      retryAfterSeconds: this.config.resendCooldownSeconds,
      ...(developmentCode ? { developmentCode } : {}),
    };
  }

  async verify(input: {
    challengeId: unknown;
    email: unknown;
    code: unknown;
    actor?: AuthenticatedActor | null;
    currentSessionToken?: string | null;
  }) {
    const email = normalizeEmail(input.email);
    if (
      !email
      || typeof input.challengeId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.challengeId)
      || !isEmailOtpCode(input.code)
    ) {
      return { ok: false as const, reason: "invalid" as const, remainingAttempts: null };
    }

    const verified = await this.repository.verifyAndResolve({
      challengeId: input.challengeId,
      targetHash: hashOtpTarget(this.config.pepper, email.normalized),
      candidateSecretHash: hashOtpSecret(
        this.config.pepper,
        input.challengeId,
        email.normalized,
        input.code,
      ),
      emailOriginal: email.original,
      emailNormalized: email.normalized,
      actorUserId: input.actor?.userId ?? null,
      sessionId: input.actor?.sessionId ?? null,
    });
    if (!verified.ok) return verified;

    const issued = verified.intent === "link"
      ? input.currentSessionToken
        ? await this.sessions.rotate(input.currentSessionToken)
        : null
      : await this.sessions.issue(verified.userId);
    if (!issued) {
      return {
        ok: false as const,
        reason: "account_unavailable" as const,
        remainingAttempts: 0,
      };
    }
    return {
      ok: true as const,
      isNewUser: verified.isNewUser,
      intent: verified.intent,
      issued,
    };
  }
}
