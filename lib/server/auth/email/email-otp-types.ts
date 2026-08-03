export type ChallengeVerificationFailure =
  | "not_found"
  | "invalid"
  | "expired"
  | "consumed"
  | "attempts_exceeded"
  | "account_unavailable"
  | "identity_conflict";

export type EmailOtpIntent = "login" | "link";

export type ChallengeVerificationResult =
  | { ok: true; userId: string; isNewUser: boolean; intent: EmailOtpIntent }
  | { ok: false; reason: ChallengeVerificationFailure; remainingAttempts: number | null };

export interface CreateChallengeInput {
  id: string;
  targetHash: Buffer;
  secretHash: Buffer;
  requestIpHash: Buffer;
  intent: EmailOtpIntent;
  actorUserId: string | null;
  sessionId: string | null;
  maxAttempts: number;
  expiresAt: Date;
  resendCooldownSeconds: number;
  rateWindowSeconds: number;
  maxRequestsPerTarget: number;
  maxRequestsPerIp: number;
}

export type CreateChallengeResult =
  | { created: true; resendSequence: number }
  | { created: false; retryAfterSeconds: number };
