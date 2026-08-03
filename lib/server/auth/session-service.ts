import "server-only";

import {
  createOpaqueSessionToken,
  hashSessionToken,
  isPlausibleSessionToken,
} from "@/lib/server/auth/session-crypto";
import {
  PostgresSessionRepository,
  type SessionRepository,
} from "@/lib/server/auth/session-repository";
import { sessionConfig, type SessionConfig } from "@/lib/server/auth/session-config";
import type {
  AuthenticatedActor,
  IssuedSession,
  SessionRevocationReason,
} from "@/lib/server/auth/session-types";

export class SessionService {
  constructor(
    private readonly repository: SessionRepository = new PostgresSessionRepository(),
    private readonly config: SessionConfig = sessionConfig(),
  ) {}

  async issue(userId: string): Promise<IssuedSession> {
    const token = createOpaqueSessionToken();
    const session = await this.repository.create(this.newSession(userId, token));
    return { token, session };
  }

  async authenticate(token: string | null | undefined): Promise<AuthenticatedActor | null> {
    if (!token || !isPlausibleSessionToken(token)) return null;

    const session = await this.repository.findAndTouch(
      hashSessionToken(token),
      this.config.idleTtlSeconds,
    );
    if (!session) return null;

    return {
      userId: session.userId,
      sessionId: session.id,
      sessionExpiresAt: session.idleExpiresAt,
    };
  }

  async rotate(token: string): Promise<IssuedSession | null> {
    if (!isPlausibleSessionToken(token)) return null;

    const replacementToken = createOpaqueSessionToken();
    const session = await this.repository.rotate(
      hashSessionToken(token),
      this.newReplacementSession(replacementToken),
    );
    return session ? { token: replacementToken, session } : null;
  }

  async revoke(token: string, reason: SessionRevocationReason = "logout") {
    if (!isPlausibleSessionToken(token)) return false;
    return this.repository.revoke(hashSessionToken(token), reason);
  }

  async revokeAllForUser(userId: string, reason: SessionRevocationReason = "logout_all") {
    return this.repository.revokeAllForUser(userId, reason);
  }

  private newSession(userId: string, token: string) {
    return { userId, ...this.newReplacementSession(token) };
  }

  private newReplacementSession(token: string) {
    const now = Date.now();
    return {
      tokenHash: hashSessionToken(token),
      idleExpiresAt: new Date(now + this.config.idleTtlSeconds * 1_000),
      absoluteExpiresAt: new Date(now + this.config.absoluteTtlSeconds * 1_000),
    };
  }
}
