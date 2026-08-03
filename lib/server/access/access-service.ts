import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { createInvitationToken, hashInvitationToken, isInvitationToken } from "@/lib/server/access/invitation-crypto";
import { PostgresAccessRepository } from "@/lib/server/access/access-repository";
import type { RelationStatus } from "@/lib/server/access/access-types";

const DEFAULT_INVITATION_TTL_HOURS = 72;

function invitationTtlHours() {
  const value = Number(process.env.ATHLETE_INVITATION_TTL_HOURS ?? DEFAULT_INVITATION_TTL_HOURS);
  return Number.isInteger(value) && value >= 1 && value <= 168
    ? value
    : DEFAULT_INVITATION_TTL_HOURS;
}

export class AccessService {
  constructor(private readonly repository = new PostgresAccessRepository()) {}

  context(actor: Actor) {
    return this.repository.context(actor);
  }

  requestTrainerCapability(actor: Actor) {
    return this.repository.requestTrainerCapability(actor);
  }

  async createAthleteInvitation(actor: Actor) {
    const token = createInvitationToken();
    const expiresAt = new Date(Date.now() + invitationTtlHours() * 60 * 60 * 1_000);
    const invitation = await this.repository.createInvitation(
      actor,
      hashInvitationToken(token),
      expiresAt,
    );
    return { invitationId: invitation.id, token, expiresAt: invitation.expiresAt };
  }

  acceptAthleteInvitation(actor: Actor, token: unknown) {
    if (!isInvitationToken(token)) {
      return Promise.resolve({ ok: false as const, reason: "invalid_or_expired" as const });
    }
    return this.repository.acceptInvitation(actor, hashInvitationToken(token));
  }

  transitionRelation(actor: Actor, relationId: unknown, status: unknown) {
    if (
      typeof relationId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(relationId)
      || !(["active", "suspended", "ended"] satisfies RelationStatus[]).includes(status as RelationStatus)
    ) {
      return Promise.resolve(null);
    }
    return this.repository.transitionRelation(actor, relationId, status as RelationStatus);
  }

  hasActiveAthleteRelation(actor: Actor, athleteUserId: unknown) {
    if (
      typeof athleteUserId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(athleteUserId)
    ) {
      return Promise.resolve(false);
    }
    return this.repository.hasActiveAthleteRelation(actor, athleteUserId);
  }
}
