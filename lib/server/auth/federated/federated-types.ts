export type FederatedProvider = "google" | "telegram";
export type FederatedIntent = "login" | "link";

export interface FederatedIdentityProof {
  provider: FederatedProvider;
  subject: string;
  emailOriginal: string | null;
  emailNormalized: string | null;
  displayName: string | null;
  metadata: Record<string, string | boolean>;
}

export interface FederatedFlowContext {
  id: string;
  provider: FederatedProvider;
  intent: FederatedIntent;
  actorUserId: string | null;
  sessionId: string | null;
  expiresAt: Date;
}

export type FederatedCompletionResult =
  | { ok: true; userId: string; intent: FederatedIntent; isNewUser: boolean; identityId: string }
  | { ok: false; reason: "invalid_flow" | "identity_conflict" | "account_unavailable" };
