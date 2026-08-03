import "server-only";

import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

import type { FederatedIdentityProof } from "@/lib/server/auth/federated/federated-types";
import {
  safeDisplayName,
  safeMetadataValue,
} from "@/lib/server/auth/federated/provider-proof";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
const telegramJwks = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json"),
);

interface TelegramAdapterConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TelegramAdapterDependencies {
  fetch: typeof fetch;
  verifyJwt: (idToken: string, clientId: string) => Promise<JWTPayload>;
}

const defaultDependencies: TelegramAdapterDependencies = {
  fetch,
  async verifyJwt(idToken, clientId) {
    const result = await jwtVerify(idToken, telegramJwks, {
      issuer: TELEGRAM_ISSUER,
      audience: clientId,
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["sub", "exp", "iat", "nonce"],
      clockTolerance: 5,
    });
    return result.payload;
  },
};

function telegramUserId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== "string" || !/^[1-9][0-9]{0,15}$/.test(value)) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? String(numeric) : null;
}

export class TelegramIdentityAdapter {
  constructor(
    private readonly config: TelegramAdapterConfig,
    private readonly dependencies: TelegramAdapterDependencies = defaultDependencies,
  ) {}

  async exchangeAndVerify(
    code: string,
    pkceVerifier: string,
    expectedNonce: string,
  ): Promise<FederatedIdentityProof | null> {
    if (!code || code.length > 4_096 || !pkceVerifier || pkceVerifier.length > 256) return null;
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: pkceVerifier,
      });
      const response = await this.dependencies.fetch(TELEGRAM_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const tokenResponse = await response.json() as Record<string, unknown>;
      const idToken = typeof tokenResponse.id_token === "string" ? tokenResponse.id_token : null;
      if (!idToken || idToken.length > 16_384) return null;
      const grantedScopes = typeof tokenResponse.scope === "string"
        ? new Set(tokenResponse.scope.split(/\s+/).filter(Boolean))
        : new Set<string>();

      const payload = await this.dependencies.verifyJwt(idToken, this.config.clientId);
      const oidcSubject = safeMetadataValue(payload.sub, 255);
      const subject = telegramUserId(payload.id);
      if (!oidcSubject || !subject || payload.nonce !== expectedNonce) return null;
      const username = safeMetadataValue(payload.preferred_username);
      return {
        provider: "telegram",
        subject,
        emailOriginal: null,
        emailNormalized: null,
        displayName: safeDisplayName(payload.name),
        metadata: {
          oidcSubject,
          ...(grantedScopes.has("telegram:bot_access") ? { botAccessGranted: true } : {}),
          ...(username ? { username } : {}),
        },
      };
    } catch {
      return null;
    }
  }
}
