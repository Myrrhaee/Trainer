import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decodeTemplateWorkspaceCursor,
  encodeTemplateWorkspaceCursor,
  TemplateWorkspaceInvalidCursorError,
} from "../../lib/server/template-workspace/template-workspace-cursor";
import {
  projectTemplateLifecycle,
  projectTemplateWorkspaceCapabilities,
} from "../../lib/server/template-workspace/template-workspace-projector";
import { normalizeTemplateWorkspaceInput } from "../../lib/server/template-workspace/template-workspace-query-service";
import { TemplateWorkspaceValidationError } from "../../lib/server/template-workspace/template-workspace-types";

const trainerUserId = "11111111-1111-4111-8111-111111111111";
const templateId = "22222222-2222-4222-8222-222222222222";
const draftId = "33333333-3333-4333-8333-333333333333";
const publishedId = "44444444-4444-4444-8444-444444444444";

test("Template Workspace lifecycle projector uses pointers and archive state, never current_revision", () => {
  const draft = projectTemplateLifecycle(state({ editableRevisionId: draftId, editableRevisionStatus: "draft" }));
  const published = projectTemplateLifecycle(state({
    templateStatus: "published",
    publishedRevisionId: publishedId,
    publishedRevisionStatus: "published",
  }));
  const update = projectTemplateLifecycle(state({
    templateStatus: "published",
    editableRevisionId: draftId,
    editableRevisionStatus: "draft",
    publishedRevisionId: publishedId,
    publishedRevisionStatus: "published",
  }));
  const archived = projectTemplateLifecycle(state({
    templateStatus: "archived",
    archivedAt: "2026-09-01T10:00:00.000Z",
    editableRevisionId: draftId,
    editableRevisionStatus: "draft",
    publishedRevisionId: publishedId,
    publishedRevisionStatus: "published",
  }));
  assert.equal(draft.lifecycle, "draft_only");
  assert.equal(published.lifecycle, "published_only");
  assert.equal(update.lifecycle, "published_with_draft");
  assert.equal(archived.lifecycle, "archived");
  for (const value of [draft, published, update, archived]) assert.deepEqual(value.anomalies, []);
});

test("Template Workspace lifecycle projector reports invalid pointers and fails mutation capabilities closed", () => {
  const projection = projectTemplateLifecycle(state({
    templateStatus: "published",
    editableRevisionId: draftId,
    editableRevisionStatus: "published",
    publishedRevisionId: draftId,
    publishedRevisionStatus: "draft",
  }));
  assert.equal(projection.lifecycle, "published_with_draft");
  assert.deepEqual(new Set(projection.anomalies), new Set([
    "invalid_revision_status",
    "duplicate_revision_pointer",
  ]));
  assert.deepEqual(projectTemplateWorkspaceCapabilities({
    lifecycle: projection.lifecycle,
    hasPrimaryRevision: true,
    hasEditableRevision: true,
    hasPublishedRevision: true,
    anomalies: projection.anomalies,
  }), {
    canOpen: true,
    canContinueDraft: false,
    canViewPublished: true,
    canCreateRevision: false,
    canDuplicate: false,
    canArchive: false,
    canOpenArchived: false,
  });
  assert.deepEqual(projectTemplateLifecycle(state({
    editableRevisionId: draftId,
    editableRevisionStatus: null,
  })).anomalies, ["editable_revision_missing"]);
});

test("Template Workspace cursor is actor, lifecycle, query, category and sort bound", () => {
  const scope = {
    trainerUserId,
    lifecycle: "updates" as const,
    query: "сила",
    category: "ноги",
    sort: "meaningful_updated_desc" as const,
  };
  const cursor = encodeTemplateWorkspaceCursor({
    ...scope,
    meaningfulUpdatedAt: "2026-09-01T10:00:00.000Z",
    templateId,
  });
  assert.deepEqual(decodeTemplateWorkspaceCursor(cursor, scope), {
    ...scope,
    meaningfulUpdatedAt: "2026-09-01T10:00:00.000Z",
    templateId,
  });
  for (const changed of [
    { ...scope, trainerUserId: publishedId },
    { ...scope, lifecycle: "all" as const },
    { ...scope, query: "масса" },
    { ...scope, category: "грудь" },
  ]) {
    assert.throws(() => decodeTemplateWorkspaceCursor(cursor, changed), TemplateWorkspaceInvalidCursorError);
  }
  assert.throws(() => decodeTemplateWorkspaceCursor(`${cursor}broken`, scope), TemplateWorkspaceInvalidCursorError);
});

test("Template Workspace input normalization is bounded and preserves unknown categories", () => {
  assert.deepEqual(normalizeTemplateWorkspaceInput({
    status: "updates",
    query: "  СИЛА   И ноги ",
    category: "  Верх   тела ",
    first: 50,
  }), {
    lifecycle: "updates",
    query: "сила и ноги",
    category: "верх тела",
    first: 50,
    after: null,
  });
  assert.throws(() => normalizeTemplateWorkspaceInput({ status: "draft" }), TemplateWorkspaceValidationError);
  assert.throws(() => normalizeTemplateWorkspaceInput({ first: 51 }), TemplateWorkspaceValidationError);
  assert.throws(() => normalizeTemplateWorkspaceInput({ query: "x".repeat(201) }), TemplateWorkspaceValidationError);
});

test("Template Workspace API is read-only, no-store and isolated from Builder full hydration", () => {
  const route = readFileSync("app/api/trainer/workout-builder/workspace/route.ts", "utf8");
  const repository = readFileSync(
    "lib/server/template-workspace/template-workspace-repository.ts",
    "utf8",
  );
  const contract = readFileSync("lib/template-workspace-contract.ts", "utf8");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.equal(route.includes('"Cache-Control": "no-store"'), true);
  assert.match(route, /template_workspace_forbidden/);
  assert.match(route, /invalid_cursor/);
  assert.match(route, /invalid_filter/);
  assert.doesNotMatch(repository, /WorkoutBuilderRepository|hydrateMany|workout_assignments|athlete|program/i);
  assert.doesNotMatch(contract, /canAssign|exercise(s|Items):\s*Array|athlete|program/i);
});

function state(overrides: Partial<Parameters<typeof projectTemplateLifecycle>[0]> = {}) {
  return {
    templateStatus: "draft" as const,
    archivedAt: null,
    editableRevisionId: null,
    editableRevisionStatus: null,
    publishedRevisionId: null,
    publishedRevisionStatus: null,
    ...overrides,
  };
}
