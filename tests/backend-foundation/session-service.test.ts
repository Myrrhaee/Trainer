import assert from "node:assert/strict";
import test from "node:test";

import type {
  NewSession,
  SessionRepository,
} from "../../lib/server/auth/session-repository";
import { SessionService } from "../../lib/server/auth/session-service";
import type {
  SessionRecord,
  SessionRevocationReason,
} from "../../lib/server/auth/session-types";

class MemorySessionRepository implements SessionRepository {
  sessions = new Map<string, SessionRecord>();
  hashes = new Map<string, string>();

  async create(input: NewSession) {
    const record = this.record(input.userId, input);
    this.sessions.set(record.id, record);
    this.hashes.set(input.tokenHash.toString("hex"), record.id);
    return record;
  }

  async findAndTouch(tokenHash: Buffer, idleTtlSeconds: number) {
    const record = this.find(tokenHash);
    if (!record || record.revokedAt) return null;
    record.lastSeenAt = new Date();
    record.idleExpiresAt = new Date(
      Math.min(Date.now() + idleTtlSeconds * 1_000, record.absoluteExpiresAt.getTime()),
    );
    return record;
  }

  async rotate(oldTokenHash: Buffer, replacement: Omit<NewSession, "userId">) {
    const previous = this.find(oldTokenHash);
    if (!previous || previous.revokedAt) return null;
    previous.revokedAt = new Date();
    previous.revocationReason = "rotated";
    return this.create({
      ...replacement,
      userId: previous.userId,
      idleExpiresAt: new Date(Math.min(
        replacement.idleExpiresAt.getTime(),
        previous.absoluteExpiresAt.getTime(),
      )),
      absoluteExpiresAt: previous.absoluteExpiresAt,
    });
  }

  async revoke(tokenHash: Buffer, reason: SessionRevocationReason) {
    const record = this.find(tokenHash);
    if (!record || record.revokedAt) return false;
    record.revokedAt = new Date();
    record.revocationReason = reason;
    return true;
  }

  async revokeAllForUser(userId: string, reason: SessionRevocationReason) {
    let count = 0;
    for (const record of this.sessions.values()) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = new Date();
        record.revocationReason = reason;
        count += 1;
      }
    }
    return count;
  }

  private find(tokenHash: Buffer) {
    const id = this.hashes.get(tokenHash.toString("hex"));
    return id ? this.sessions.get(id) ?? null : null;
  }

  private record(userId: string, input: Omit<NewSession, "userId">): SessionRecord {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: input.idleExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
      revokedAt: null,
      revocationReason: null,
    };
  }
}

test("session issue, actor resolution, rotation and revocation form one contract", async () => {
  const repository = new MemorySessionRepository();
  const service = new SessionService(repository, {
    idleTtlSeconds: 60,
    absoluteTtlSeconds: 600,
  });
  const userId = crypto.randomUUID();

  const issued = await service.issue(userId);
  const actor = await service.authenticate(issued.token);
  assert.equal(actor?.userId, userId);

  const rotated = await service.rotate(issued.token);
  assert.ok(rotated);
  assert.equal(
    rotated.session.absoluteExpiresAt.getTime(),
    issued.session.absoluteExpiresAt.getTime(),
  );
  assert.equal(await service.authenticate(issued.token), null);
  assert.equal((await service.authenticate(rotated.token))?.userId, userId);

  assert.equal(await service.revoke(rotated.token), true);
  assert.equal(await service.authenticate(rotated.token), null);
});

test("invalid tokens do not reach persistence", async () => {
  const repository = new MemorySessionRepository();
  const service = new SessionService(repository, {
    idleTtlSeconds: 60,
    absoluteTtlSeconds: 600,
  });

  assert.equal(await service.authenticate("not-a-session"), null);
  assert.equal(repository.sessions.size, 0);
});
