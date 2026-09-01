import type { QuickAssignTemplateCursor } from "./quick-assign-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class QuickAssignInvalidCursorError extends Error {
  constructor() {
    super("invalid_cursor");
  }
}

export function normalizeQuickAssignSearch(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru-RU").slice(0, 200);
}

export function encodeQuickAssignCursor(cursor: QuickAssignTemplateCursor) {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeQuickAssignCursor(
  value: string,
  expected: Pick<QuickAssignTemplateCursor, "trainerUserId" | "athleteUserId" | "relationId" | "query">,
): QuickAssignTemplateCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      parsed.v !== 1
      || parsed.trainerUserId !== expected.trainerUserId
      || parsed.athleteUserId !== expected.athleteUserId
      || parsed.relationId !== expected.relationId
      || parsed.query !== expected.query
      || typeof parsed.updatedAt !== "string"
      || Number.isNaN(Date.parse(parsed.updatedAt))
      || typeof parsed.templateId !== "string"
      || !UUID_PATTERN.test(parsed.templateId)
    ) {
      throw new QuickAssignInvalidCursorError();
    }
    return {
      ...expected,
      updatedAt: new Date(parsed.updatedAt).toISOString(),
      templateId: parsed.templateId,
    };
  } catch (error) {
    if (error instanceof QuickAssignInvalidCursorError) throw error;
    throw new QuickAssignInvalidCursorError();
  }
}
