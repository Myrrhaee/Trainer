import type { AthleteTrainingHistoryCursor } from "./athlete-training-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AthleteTrainingInvalidCursorError extends Error {
  constructor() {
    super("athlete_training_cursor_invalid");
  }
}

export function encodeAthleteTrainingCursor(cursor: AthleteTrainingHistoryCursor) {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeAthleteTrainingCursor(
  value: string,
  expected: Pick<AthleteTrainingHistoryCursor, "athleteUserId" | "relationId">,
): AthleteTrainingHistoryCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      parsed.v !== 1
      || parsed.athleteUserId !== expected.athleteUserId
      || parsed.relationId !== expected.relationId
      || typeof parsed.sortAt !== "string"
      || Number.isNaN(Date.parse(parsed.sortAt))
      || typeof parsed.assignmentId !== "string"
      || !UUID_PATTERN.test(parsed.assignmentId)
    ) {
      throw new AthleteTrainingInvalidCursorError();
    }
    return {
      athleteUserId: expected.athleteUserId,
      relationId: expected.relationId,
      sortAt: new Date(parsed.sortAt).toISOString(),
      assignmentId: parsed.assignmentId,
    };
  } catch (error) {
    if (error instanceof AthleteTrainingInvalidCursorError) throw error;
    throw new AthleteTrainingInvalidCursorError();
  }
}
