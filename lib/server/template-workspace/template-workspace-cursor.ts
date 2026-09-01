import type { TemplateWorkspaceLifecycleFilter } from "@/lib/template-workspace-contract";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TemplateWorkspaceCursorScope = {
  trainerUserId: string;
  lifecycle: TemplateWorkspaceLifecycleFilter;
  query: string;
  category: string;
  sort: "meaningful_updated_desc";
};

export type TemplateWorkspaceCursor = TemplateWorkspaceCursorScope & {
  meaningfulUpdatedAt: string;
  templateId: string;
};

export class TemplateWorkspaceInvalidCursorError extends Error {
  constructor() {
    super("invalid_cursor");
  }
}

export function encodeTemplateWorkspaceCursor(cursor: TemplateWorkspaceCursor) {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeTemplateWorkspaceCursor(
  value: string,
  expected: TemplateWorkspaceCursorScope,
): TemplateWorkspaceCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const date = typeof parsed.meaningfulUpdatedAt === "string"
      ? new Date(parsed.meaningfulUpdatedAt)
      : null;
    if (
      parsed.v !== 1
      || parsed.trainerUserId !== expected.trainerUserId
      || parsed.lifecycle !== expected.lifecycle
      || parsed.query !== expected.query
      || parsed.category !== expected.category
      || parsed.sort !== expected.sort
      || !date
      || Number.isNaN(date.valueOf())
      || date.toISOString() !== parsed.meaningfulUpdatedAt
      || typeof parsed.templateId !== "string"
      || !UUID_PATTERN.test(parsed.templateId)
    ) {
      throw new TemplateWorkspaceInvalidCursorError();
    }
    return {
      ...expected,
      meaningfulUpdatedAt: parsed.meaningfulUpdatedAt,
      templateId: parsed.templateId,
    };
  } catch (error) {
    if (error instanceof TemplateWorkspaceInvalidCursorError) throw error;
    throw new TemplateWorkspaceInvalidCursorError();
  }
}
