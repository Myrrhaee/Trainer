import { createHash, timingSafeEqual } from "node:crypto";

import type { QuickAssignUpcomingAssignment } from "./quick-assign-types";

const TOKEN_PREFIX = "qa1.";
const TOKEN_PATTERN = /^qa1\.[A-Za-z0-9_-]{43}$/;

export function projectAssignmentStateToken(input: {
  trainerUserId: string;
  athleteUserId: string;
  relationId: string;
  assignments: QuickAssignUpcomingAssignment[];
}) {
  const state = [...input.assignments]
    .sort((left, right) => (
      left.scheduledFor.localeCompare(right.scheduledFor)
      || left.createdAt.localeCompare(right.createdAt)
      || left.assignmentId.localeCompare(right.assignmentId)
    ))
    .map((assignment) => [
      assignment.assignmentId,
      assignment.sourceRevisionId,
      assignment.scheduledFor,
      assignment.createdAt,
    ]);
  const digest = createHash("sha256")
    .update(JSON.stringify({
      v: 1,
      trainerUserId: input.trainerUserId,
      athleteUserId: input.athleteUserId,
      relationId: input.relationId,
      state,
    }))
    .digest("base64url");
  return `${TOKEN_PREFIX}${digest}`;
}

export function isAssignmentStateToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function assignmentStateTokensEqual(left: string, right: string) {
  if (!isAssignmentStateToken(left) || !isAssignmentStateToken(right)) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
