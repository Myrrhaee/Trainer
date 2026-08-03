export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
}

export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  sessionExpiresAt: Date;
}

export interface IssuedSession {
  token: string;
  session: SessionRecord;
}

export type SessionRevocationReason =
  | "logout"
  | "logout_all"
  | "rotated"
  | "security"
  | "user_suspended";
