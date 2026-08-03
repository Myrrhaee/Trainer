import "server-only";

import type { AuthenticatedActor } from "@/lib/server/auth/session-types";
import { SessionService } from "@/lib/server/auth/session-service";
import {
  createFederatedFlowId,
  createFederatedNonce,
  createFederatedState,
  createPkceChallenge,
  createPkceVerifier,
  hashFederatedValue,
} from "@/lib/server/auth/federated/federated-crypto";
import {
  federatedAuthConfig,
  type FederatedAuthConfig,
} from "@/lib/server/auth/federated/federated-config";
import { GoogleIdentityAdapter } from "@/lib/server/auth/federated/google-adapter";
import { PostgresFederatedAuthRepository } from "@/lib/server/auth/federated/federated-repository";
import { TelegramIdentityAdapter } from "@/lib/server/auth/federated/telegram-adapter";
import type {
  FederatedIdentityProof,
  FederatedIntent,
  FederatedProvider,
} from "@/lib/server/auth/federated/federated-types";

export type FederatedStartResult =
  | {
    ok: true;
    provider: "google";
    flowId: string;
    nonce: string;
    clientId: string;
    expiresAt: Date;
  }
  | {
    ok: true;
    provider: "telegram";
    authorizationUrl: string;
    cookie: { flowId: string; nonce: string; pkceVerifier: string };
    expiresAt: Date;
  }
  | { ok: false; reason: "provider_unavailable" | "rate_limited" | "unauthorized" };

export class FederatedAuthService {
  constructor(
    private readonly repository = new PostgresFederatedAuthRepository(),
    private readonly sessions = new SessionService(),
    private readonly config: FederatedAuthConfig = federatedAuthConfig(),
  ) {}

  async start(input: {
    provider: FederatedProvider;
    intent: FederatedIntent;
    actor: AuthenticatedActor | null;
    requestIp: string;
    requestOrigin: string;
  }): Promise<FederatedStartResult> {
    if (input.intent === "link" && !input.actor) {
      return { ok: false, reason: "unauthorized" };
    }
    if (input.provider === "google" && !this.config.googleClientId) {
      return { ok: false, reason: "provider_unavailable" };
    }
    if (
      input.provider === "telegram"
      && (!this.config.telegramClientId || !this.config.telegramClientSecret)
    ) {
      return { ok: false, reason: "provider_unavailable" };
    }

    const id = createFederatedFlowId();
    const state = createFederatedState();
    const nonce = createFederatedNonce();
    const pkceVerifier = createPkceVerifier();
    const expiresAt = new Date(Date.now() + this.config.flowTtlSeconds * 1_000);
    const created = await this.repository.createFlow({
      id,
      provider: input.provider,
      intent: input.intent,
      stateHash: hashFederatedValue(this.config.secret, "state", state),
      nonceHash: hashFederatedValue(this.config.secret, "nonce", nonce),
      requestIpHash: hashFederatedValue(this.config.secret, "request-ip", input.requestIp),
      actorUserId: input.intent === "link" ? input.actor!.userId : null,
      sessionId: input.intent === "link" ? input.actor!.sessionId : null,
      expiresAt,
      rateWindowSeconds: this.config.rateWindowSeconds,
      maxRequestsPerIp: this.config.maxRequestsPerIp,
    });
    if (!created) return { ok: false, reason: "rate_limited" };

    if (input.provider === "google") {
      return {
        ok: true,
        provider: "google",
        flowId: id,
        nonce,
        clientId: this.config.googleClientId!,
        expiresAt,
      };
    }

    const redirectUri = this.telegramRedirectUri(input.requestOrigin);
    const authorizationUrl = new URL("https://oauth.telegram.org/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: this.config.telegramClientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile telegram:bot_access",
      state,
      nonce,
      code_challenge: createPkceChallenge(pkceVerifier),
      code_challenge_method: "S256",
    }).toString();
    return {
      ok: true,
      provider: "telegram",
      authorizationUrl: authorizationUrl.toString(),
      cookie: { flowId: id, nonce, pkceVerifier },
      expiresAt,
    };
  }

  async completeGoogle(input: {
    flowId: string;
    nonce: string;
    credential: string;
    actor: AuthenticatedActor | null;
    currentSessionToken: string | null;
  }) {
    if (!this.config.googleClientId) return { ok: false as const, reason: "provider_unavailable" as const };
    const context = await this.repository.findActiveById({
      id: input.flowId,
      provider: "google",
      nonceHash: hashFederatedValue(this.config.secret, "nonce", input.nonce),
    });
    if (!this.contextMatchesActor(context, input.actor)) {
      return { ok: false as const, reason: "invalid_flow" as const };
    }
    const proof = await new GoogleIdentityAdapter(this.config.googleClientId)
      .verify(input.credential, input.nonce);
    if (!proof) return { ok: false as const, reason: "invalid_proof" as const };
    return this.finish(context!, proof, input.actor, input.currentSessionToken);
  }

  async prepareTelegram(input: {
    flowId: string;
    state: string;
    nonce: string;
    actor: AuthenticatedActor | null;
  }) {
    const context = await this.repository.findActiveByState({
      id: input.flowId,
      provider: "telegram",
      stateHash: hashFederatedValue(this.config.secret, "state", input.state),
      nonceHash: hashFederatedValue(this.config.secret, "nonce", input.nonce),
    });
    return this.contextMatchesActor(context, input.actor) ? context : null;
  }

  async completeTelegram(input: {
    context: NonNullable<Awaited<ReturnType<FederatedAuthService["prepareTelegram"]>>>;
    code: string;
    nonce: string;
    pkceVerifier: string;
    actor: AuthenticatedActor | null;
    currentSessionToken: string | null;
    requestOrigin: string;
  }) {
    if (!this.config.telegramClientId || !this.config.telegramClientSecret) {
      return { ok: false as const, reason: "provider_unavailable" as const };
    }
    const proof = await new TelegramIdentityAdapter({
      clientId: this.config.telegramClientId,
      clientSecret: this.config.telegramClientSecret,
      redirectUri: this.telegramRedirectUri(input.requestOrigin),
    }).exchangeAndVerify(input.code, input.pkceVerifier, input.nonce);
    if (!proof) return { ok: false as const, reason: "invalid_proof" as const };
    return this.finish(input.context, proof, input.actor, input.currentSessionToken);
  }

  private async finish(
    context: { id: string },
    proof: FederatedIdentityProof,
    actor: AuthenticatedActor | null,
    currentSessionToken: string | null,
  ) {
    const completed = await this.repository.complete({
      flowId: context.id,
      proof,
      actorUserId: actor?.userId ?? null,
      sessionId: actor?.sessionId ?? null,
    });
    if (!completed.ok) return completed;
    if (completed.intent === "login") {
      return { ...completed, issued: await this.sessions.issue(completed.userId) };
    }
    if (!currentSessionToken) return { ok: false as const, reason: "invalid_flow" as const };
    const issued = await this.sessions.rotate(currentSessionToken);
    return issued
      ? { ...completed, issued }
      : { ok: false as const, reason: "session_rotation_failed" as const };
  }

  private contextMatchesActor(
    context: Awaited<ReturnType<PostgresFederatedAuthRepository["findActiveById"]>>,
    actor: AuthenticatedActor | null,
  ) {
    if (!context) return false;
    return context.intent === "login"
      ? actor === null
      : actor?.userId === context.actorUserId && actor.sessionId === context.sessionId;
  }

  private telegramRedirectUri(requestOrigin: string) {
    const origin = this.config.publicOrigin ?? requestOrigin;
    return `${origin}/api/auth/telegram/callback`;
  }
}
