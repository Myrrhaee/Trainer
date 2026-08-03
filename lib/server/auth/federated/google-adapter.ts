import "server-only";

import { OAuth2Client, type LoginTicket } from "google-auth-library";

import type { FederatedIdentityProof } from "@/lib/server/auth/federated/federated-types";
import {
  safeDisplayName,
  safeMetadataValue,
  safeProviderSubject,
  verifiedProviderEmail,
} from "@/lib/server/auth/federated/provider-proof";

interface GoogleTokenVerifier {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<LoginTicket>;
}

export class GoogleIdentityAdapter {
  constructor(
    private readonly clientId: string,
    private readonly verifier: GoogleTokenVerifier = new OAuth2Client(),
  ) {}

  async verify(idToken: string, expectedNonce: string): Promise<FederatedIdentityProof | null> {
    if (!idToken || idToken.length > 16_384) return null;
    try {
      const ticket = await this.verifier.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload() as (ReturnType<LoginTicket["getPayload"]> & {
        nonce?: string;
      }) | undefined;
      const subject = safeProviderSubject(payload?.sub);
      if (!payload || !subject || payload.nonce !== expectedNonce) return null;

      const email = verifiedProviderEmail(payload.email, payload.email_verified === true);
      const hostedDomain = safeMetadataValue(payload.hd);
      const locale = safeMetadataValue(payload.locale);
      return {
        provider: "google",
        subject,
        emailOriginal: email.original,
        emailNormalized: email.normalized,
        displayName: safeDisplayName(payload.name),
        metadata: {
          emailVerified: payload.email_verified === true,
          ...(hostedDomain ? { hostedDomain } : {}),
          ...(locale ? { locale } : {}),
        },
      };
    } catch {
      return null;
    }
  }
}
