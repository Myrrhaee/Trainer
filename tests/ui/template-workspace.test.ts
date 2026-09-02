import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  dialogCommandError,
  duplicateAttemptAfterTitleChange,
  isLifecycleStale,
  mergeTemplateWorkspaceItems,
  shouldSkipInternalPageReplay,
  templateWorkspaceFilterKey,
  withDialogCommandError,
  type DuplicateAttempt,
} from "../../components/trainer/templates/canonical-templates-workspace";
import { TemplateWorkspaceRequestError } from "../../components/trainer/templates/template-workspace-client";
import type { TemplateWorkspaceItem } from "../../lib/template-workspace-contract";
import {
  parseTemplateWorkspaceUrlState,
  safeTemplateWorkspaceReturnPath,
  templateWorkspaceBuilderHref,
  templateWorkspaceHref,
  templateWorkspaceReturnWithAnchor,
} from "../../lib/template-workspace-navigation";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";

test("Workspace URL keeps only bounded canonical collection state", () => {
  assert.equal(templateWorkspaceHref({
    status: "updates",
    q: "  тяга  ",
    category: "strength",
    page: 2,
    anchor: TEMPLATE_ID,
  }), `/trainer/templates?status=updates&q=${encodeURIComponent("тяга")}&category=strength&page=2&anchor=${TEMPLATE_ID}`);
  const invalid = parseTemplateWorkspaceUrlState(new URLSearchParams("status=wrong&page=99&anchor=foreign"));
  assert.equal(invalid.state.status, "all");
  assert.equal(invalid.state.page, 1);
  assert.equal(invalid.state.anchor, null);
  assert.equal(invalid.invalidStatus, true);
  assert.equal(invalid.invalidPage, true);
  assert.equal(invalid.invalidAnchor, true);
});

test("safe return path rejects foreign routes and capability material", () => {
  assert.equal(safeTemplateWorkspaceReturnPath(`/trainer/templates?status=drafts&anchor=${TEMPLATE_ID}`), `/trainer/templates?status=drafts&anchor=${TEMPLATE_ID}`);
  assert.equal(safeTemplateWorkspaceReturnPath("/trainer/dashboard"), null);
  assert.equal(safeTemplateWorkspaceReturnPath("/trainer/templates?token=secret"), null);
  assert.equal(safeTemplateWorkspaceReturnPath("https://example.test/trainer/templates"), null);
});

test("Workspace create destination uses the canonical product Editor route", () => {
  const href = templateWorkspaceBuilderHref({
    mode: "create",
    returnState: { status: "drafts", q: "сила", category: "", page: 1, anchor: null },
  });
  const url = new URL(href, "http://trainer.local");
  assert.equal(url.pathname, "/trainer/builder/new");
  assert.equal(url.searchParams.get("create"), null);
  assert.equal(url.searchParams.get("from"), null);
  assert.equal(url.searchParams.get("returnTo"), "/trainer/templates?status=drafts&q=%D1%81%D0%B8%D0%BB%D0%B0");
  assert.equal(
    templateWorkspaceReturnWithAnchor(url.searchParams.get("returnTo"), TEMPLATE_ID),
    `/trainer/templates?status=drafts&q=${encodeURIComponent("сила")}&anchor=${TEMPLATE_ID}`,
  );
});

test("pagination merge keeps one row per Template identity", () => {
  const first = item(TEMPLATE_ID, "Первый");
  const updated = item(TEMPLATE_ID, "Обновлённый");
  const second = item("22222222-2222-4222-8222-222222222222", "Второй");
  const merged = mergeTemplateWorkspaceItems([first], [updated, second]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].primaryRevision?.title, "Обновлённый");
});

test("internal page-depth URL sync skips replay while cold restoration does not", () => {
  const filterKey = templateWorkspaceFilterKey({ status: "all", q: "", category: "" });
  const sync = { filterKey, page: 2, refreshVersion: 0 };
  assert.equal(shouldSkipInternalPageReplay(sync, filterKey, 2, 0), true);
  assert.equal(shouldSkipInternalPageReplay(null, filterKey, 2, 0), false);
  assert.equal(shouldSkipInternalPageReplay(sync, filterKey, 2, 1), false);
  assert.equal(shouldSkipInternalPageReplay(sync, templateWorkspaceFilterKey({ status: "all", q: "тяга", category: "" }), 1, 0), false);
});

test("dialog failure preserves command identity and title until an explicit title edit", () => {
  const attempt = duplicateAttempt();
  const recoverable = dialogCommandError(new TemplateWorkspaceRequestError(503, "temporarily_unavailable"), "Не удалось создать копию.");
  const failed = withDialogCommandError(attempt, recoverable);
  assert.equal(failed.commandId, attempt.commandId);
  assert.equal(failed.newTemplateId, attempt.newTemplateId);
  assert.equal(failed.title, attempt.title);
  assert.equal(failed.retryable, true);

  const unchanged = duplicateAttemptAfterTitleChange(attempt, "Обычное редактирование", {
    commandId: "new-command",
    newTemplateId: "new-template",
    newRevisionId: "new-revision",
  });
  assert.equal(unchanged.commandId, attempt.commandId);

  const renewed = duplicateAttemptAfterTitleChange(failed, "Новая логическая попытка", {
    commandId: "new-command",
    newTemplateId: "new-template",
    newRevisionId: "new-revision",
  });
  assert.equal(renewed.commandId, "new-command");
  assert.equal(renewed.newTemplateId, "new-template");
  assert.equal(renewed.errorCode, null);
  assert.equal(renewed.renewedAfterEdit, true);
});

test("command conflict is dialog-local and cannot silently retry a changed payload", () => {
  const conflict = dialogCommandError(new TemplateWorkspaceRequestError(409, "command_id_conflict"), "Не удалось создать копию.", true);
  assert.equal(conflict.errorCode, "command_id_conflict");
  assert.equal(conflict.retryable, false);
  assert.match(conflict.errorMessage ?? "", /Измените название/);
});

test("lifecycle conflicts trigger canonical refresh but command identity conflicts stay local", () => {
  assert.equal(isLifecycleStale(new TemplateWorkspaceRequestError(409, "draft_version_conflict")), true);
  assert.equal(isLifecycleStale(new TemplateWorkspaceRequestError(409, "template_lifecycle_conflict")), true);
  assert.equal(isLifecycleStale(new TemplateWorkspaceRequestError(409, "command_id_conflict")), false);
  const archiveConflict = dialogCommandError(new TemplateWorkspaceRequestError(409, "command_id_conflict"), "Не удалось архивировать шаблон.");
  assert.match(archiveConflict.errorMessage ?? "", /Закройте окно/);
  assert.doesNotMatch(archiveConflict.errorMessage ?? "", /название/);
});

test("production Workspace is canonical, lifecycle-readable and assignment-free", () => {
  const component = readFileSync("components/trainer/templates/canonical-templates-workspace.tsx", "utf8");
  const client = readFileSync("components/trainer/templates/template-workspace-client.ts", "utf8");
  for (const copy of [
    "Черновик",
    "Ещё не опубликован",
    "Опубликована версия",
    "Доступна для назначения",
    "Есть черновик версии",
    "В архиве",
    "Недоступен для назначения",
  ]) assert.match(component, new RegExp(copy));
  assert.doesNotMatch(component, /Назначить тренировку|athleteId|Program|Программа/);
  assert.doesNotMatch(component, /demo|mock|localStorage/);
  assert.match(client, /\/api\/trainer\/workout-builder\/workspace/);
  assert.doesNotMatch(client, /fetch\(`?"?\/api\/trainer\/workout-builder\/templates["?`]?\)/);
  assert.match(component, /DialogTitle/);
  assert.match(component, /DialogDescription/);
  assert.match(component, /SheetTitle/);
  assert.match(component, /SheetDescription/);
  assert.doesNotMatch(component, /role="menu"|role="menuitem"|aria-haspopup="menu"/);
  assert.match(component, /data-overflow-action/);
  assert.match(component, /\[data-overflow-action\]:not\(:disabled\)/);
  assert.match(component, /DialogErrorSummary/);
  assert.match(component, /setDuplicateAttempt\(\(current\)/);
  assert.match(component, /setArchiveAttempt\(\(current\)/);
});

test("TrainerShell primary Templates destination is the collection route", () => {
  const shell = readFileSync("components/trainer/trainer-shell.tsx", "utf8");
  assert.match(shell, /id: "templates"[\s\S]*href: "\/trainer\/templates"/);
  assert.match(shell, /pathname === "\/trainer\/builder"/);
  const builder = readFileSync("components/trainer-os/workout-template-builder/workout-template-builder-page.tsx", "utf8");
  assert.match(builder, /safeTemplateWorkspaceReturnPath/);
  assert.match(builder, /router\.push\(workspaceReturn\)/);
});

function item(templateId: string, title: string): TemplateWorkspaceItem {
  return {
    templateId,
    lifecycle: "draft_only",
    primaryRevision: revision(title),
    editableRevision: revision(title),
    publishedRevision: null,
    archived: false,
    meaningfulUpdatedAt: "2026-09-01T10:00:00.000Z",
    capabilities: {
      canOpen: true,
      canContinueDraft: true,
      canViewPublished: false,
      canCreateRevision: false,
      canDuplicate: true,
      canArchive: true,
      canOpenArchived: false,
    },
    actionPreconditions: {
      lifecycleActionToken: "opaque",
      duplicateSource: { intent: "editable", revisionId: "33333333-3333-4333-8333-333333333333" },
    },
    matchContext: { query: null, category: null },
    anomalies: [],
  };
}

function duplicateAttempt(): DuplicateAttempt {
  return {
    item: item(TEMPLATE_ID, "Исходный шаблон"),
    title: "Копия — Исходный шаблон",
    commandId: "command-1",
    newTemplateId: "template-1",
    newRevisionId: "revision-1",
    trigger: null,
    renewedAfterEdit: false,
    errorCode: null,
    errorMessage: null,
    retryable: false,
  };
}

function revision(title: string) {
  return {
    revisionId: "33333333-3333-4333-8333-333333333333",
    revisionNumber: 1,
    status: "draft" as const,
    title,
    category: "Сила",
    exerciseCount: 2,
    prescribedSetCount: 6,
    estimatedDurationMin: 45,
    updatedAt: "2026-09-01T10:00:00.000Z",
    publishedAt: null,
    publicationAvailability: "not_published" as const,
  };
}
