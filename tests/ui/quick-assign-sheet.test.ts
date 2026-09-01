import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { QuickAssignReadModel, QuickAssignTemplateListItem, QuickAssignTemplatePreview } from "../../lib/server/quick-assign/quick-assign-types";
import type { TrainerWorkflowTransition } from "../../lib/trainer-workflow-transition";
import { quickAssignHref } from "../../lib/quick-assign-navigation";
import { createTrainerWorkflowContext } from "../../lib/trainer-workflow-transition";
import {
  formatQuickAssignCalendarDate,
  quickAssignHeaderSummary,
  quickAssignReceiptNavigation,
} from "../../components/trainer/quick-assign/quick-assign-presentation";
import {
  buildStrictAssignmentPayload,
  exactDuplicateAssignment,
  initialQuickAssignState,
  isQuickAssignDirty,
  mergeTemplatePages,
  quickAssignReducer,
  sameDateAssignments,
  validateQuickAssignDraft,
} from "../../components/trainer/quick-assign/quick-assign-state";

const ATHLETE_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const REVISION_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "44444444-4444-4444-8444-444444444444";

test("neutral state has no selected template or date", () => {
  const state = initialQuickAssignState();
  assert.equal(state.draft.selected, null);
  assert.equal(state.draft.scheduledFor, "");
  assert.equal(state.mobileStep, "selection");
});

test("shared href always hosts Quick Assign in the athlete Training profile", () => {
  const context = createTrainerWorkflowContext({ origin: "dashboard", athleteUserId: ATHLETE_ID });
  const href = quickAssignHref({ athleteUserId: ATHLETE_ID, context });
  const url = new URL(href, "http://trainer.local");
  assert.equal(url.pathname, `/trainer/clients/${ATHLETE_ID}`);
  assert.equal(url.searchParams.get("tab"), "training");
  assert.equal(url.searchParams.get("assign"), "1");
  assert.ok(url.searchParams.get("flow"));
});

test("builder presentation restores query, date and note without selecting a template", () => {
  const state = quickAssignReducer(initialQuickAssignState(), {
    type: "presentation_restored",
    query: "сила",
    scheduledFor: "2026-09-03",
    trainerNote: "Без отказа",
  });
  assert.equal(state.query, "сила");
  assert.equal(state.draft.scheduledFor, "2026-09-03");
  assert.equal(state.draft.trainerNote, "Без отказа");
  assert.equal(state.draft.selected, null);
});

test("selection is explicit and enters mobile review without losing query", () => {
  const searched = quickAssignReducer(initialQuickAssignState(), { type: "query_changed", query: "сила" });
  const selected = quickAssignReducer(searched, { type: "template_selected", template: item() });
  assert.equal(selected.query, "сила");
  assert.equal(selected.draft.selected?.revisionId, REVISION_ID);
  assert.equal(selected.mobileStep, "review");
  const returned = quickAssignReducer(selected, { type: "return_to_selection" });
  assert.equal(returned.query, "сила");
  assert.equal(returned.draft.selected?.revisionId, REVISION_ID);
});

test("pagination merges by exact revision identity without duplicates", () => {
  const newer = { ...item(), title: "Обновлённая строка" };
  const second = item({ revisionId: "55555555-5555-4555-8555-555555555555", revisionNumber: 2 });
  const merged = mergeTemplatePages([item()], [newer, second]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "Обновлённая строка");
});

test("server calendar is authoritative and date starts empty", () => {
  const state = selectedState();
  const errors = validateQuickAssignDraft(model(), state.draft, preview());
  assert.equal(errors.scheduledFor, "Выберите дату тренировки.");
  const past = quickAssignReducer(state, { type: "date_changed", scheduledFor: "2026-08-31" });
  assert.match(validateQuickAssignDraft(model(), past.draft, preview()).scheduledFor, /не раньше/);
});

test("trainer note is bounded and remains assignment-owned", () => {
  const next = quickAssignReducer(selectedState(), { type: "note_changed", trainerNote: "x".repeat(2_100) });
  assert.equal(next.draft.trainerNote.length, 2_000);
  assert.equal(next.draft.selected?.title, "Силовая база");
});

test("exact revision and date duplicate blocks without override", () => {
  const current = selectedState("2026-09-02");
  const snapshot = model({
    upcomingAssignments: [{ assignmentId: ASSIGNMENT_ID, sourceRevisionId: REVISION_ID, title: "Силовая база", scheduledFor: "2026-09-02", createdAt: "2026-09-01T10:00:00.000Z" }],
  });
  assert.equal(exactDuplicateAssignment(snapshot, current.draft)?.assignmentId, ASSIGNMENT_ID);
  assert.equal(validateQuickAssignDraft(snapshot, current.draft, preview()).duplicate, "Эта версия уже назначена на выбранную дату.");
});

test("different same-date assignment requires explicit confirmation", () => {
  let current = selectedState("2026-09-02");
  const snapshot = model({
    upcomingAssignments: [{ assignmentId: ASSIGNMENT_ID, sourceRevisionId: "66666666-6666-4666-8666-666666666666", title: "Мобилити", scheduledFor: "2026-09-02", createdAt: "2026-09-01T10:00:00.000Z" }],
  });
  assert.equal(sameDateAssignments(snapshot, current.draft.scheduledFor).length, 1);
  assert.ok(validateQuickAssignDraft(snapshot, current.draft, preview()).sameDate);
  current = quickAssignReducer(current, { type: "same_date_confirmed", confirmed: true });
  assert.equal(validateQuickAssignDraft(snapshot, current.draft, preview()).sameDate, undefined);
  current = quickAssignReducer(current, { type: "date_changed", scheduledFor: "2026-09-03" });
  assert.equal(current.draft.allowAdditionalAssignment, false);
});

test("strict payload always binds exact revision and assignment state", () => {
  const payload = buildStrictAssignmentPayload({
    assignmentId: ASSIGNMENT_ID,
    model: model(),
    draft: selectedState("2026-09-02").draft,
    transitionContext: "{\"version\":1}",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "allowAdditionalAssignment",
    "assignmentId",
    "assignmentStateToken",
    "athleteUserId",
    "scheduledFor",
    "templateId",
    "templateRevisionId",
    "trainerNote",
    "transitionContext",
  ].sort());
  assert.equal(payload.templateRevisionId, REVISION_ID);
  assert.equal(payload.assignmentStateToken, "qa1.token");
});

test("uncertain outcome preserves the exact assignment id and payload", () => {
  const payload = buildStrictAssignmentPayload({ assignmentId: ASSIGNMENT_ID, model: model(), draft: selectedState("2026-09-02").draft, transitionContext: "{}" });
  let state = quickAssignReducer(selectedState("2026-09-02"), { type: "command_submitting", payload });
  state = quickAssignReducer(state, { type: "command_outcome_unknown", payload });
  assert.equal(state.command.status, "outcome_unknown");
  if (state.command.status !== "outcome_unknown") throw new Error("unexpected_state");
  assert.equal(state.command.payload, payload);
  assert.equal(state.command.payload.assignmentId, ASSIGNMENT_ID);
});

test("persisted command keeps success when revalidation reports a warning", () => {
  const state = quickAssignReducer(selectedState("2026-09-02"), {
    type: "command_persisted",
    assignmentId: ASSIGNMENT_ID,
    warning: "queue_refresh_delayed",
  });
  assert.deepEqual(state.command, {
    status: "revalidation_warning",
    assignmentId: ASSIGNMENT_ID,
    warning: "queue_refresh_delayed",
  });
});

test("recoverable conflicts preserve date and note but reset stale confirmation", () => {
  let state = selectedState("2026-09-02");
  state = quickAssignReducer(state, { type: "note_changed", trainerNote: "Работаем спокойно" });
  state = quickAssignReducer(state, { type: "same_date_confirmed", confirmed: true });
  state = quickAssignReducer(state, { type: "canonical_state_refreshed" });
  assert.equal(state.draft.scheduledFor, "2026-09-02");
  assert.equal(state.draft.trainerNote, "Работаем спокойно");
  assert.equal(state.draft.allowAdditionalAssignment, false);
});

test("dirty state covers selection, date, note and confirmation", () => {
  assert.equal(isQuickAssignDirty(initialQuickAssignState().draft), false);
  assert.equal(isQuickAssignDirty(selectedState().draft), true);
});

test("production sheet has no demo store and sends only strict command builder payload", () => {
  const source = [
    readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8"),
    readFileSync("components/trainer/quick-assign/quick-assign-client.ts", "utf8"),
    readFileSync("components/trainer/quick-assign/quick-assign-state.ts", "utf8"),
  ].join("\n");
  assert.doesNotMatch(source, /trainer-os\/quick-assign|quick-assign-model|demo-runtime|localStorage/);
  assert.match(source, /buildStrictAssignmentPayload/);
  assert.match(source, /templateRevisionId/);
  assert.match(source, /assignmentStateToken/);
});

test("production assignment entries converge on the shared profile host", () => {
  const source = [
    readFileSync("components/trainer/canonical-trainer-dashboard.tsx", "utf8"),
    readFileSync("components/trainer/canonical-trainer-roster.tsx", "utf8"),
    readFileSync("components/trainer/review/canonical-review-action-region.tsx", "utf8"),
    readFileSync("lib/server/trainer-workflow/trainer-workflow-transition-service.ts", "utf8"),
  ].join("\n");
  assert.match(source, /quickAssignHref/);
  assert.doesNotMatch(source, /CanonicalRosterAssignmentDialog|\/trainer\/builder\?athleteId/);
  const builder = readFileSync("components/trainer-os/workout-template-builder/workout-template-builder-page.tsx", "utf8");
  assert.doesNotMatch(builder, /CanonicalBuilderAssignmentDialog|fetch\("\/api\/workout-assignments"/);
  assert.match(builder, /publishQuickAssignBuilderHandoff/);
});

test("production Assignment route rejects the legacy reduced payload", () => {
  const source = readFileSync("app/api/workout-assignments/route.ts", "utf8");
  for (const field of ["assignmentId", "templateRevisionId", "assignmentStateToken", "allowAdditionalAssignment", "transitionContext"]) {
    assert.match(source, new RegExp(`body\\.${field}`));
  }
  assert.match(source, /assignment_validation_failed/);
});

test("search and preview use independent latest-request guards", () => {
  const source = readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8");
  assert.match(source, /const delay = initialLoadedRef\.current \? 300 : 0/);
  assert.match(source, /sequence !== listSequenceRef\.current/);
  assert.match(source, /sequence !== previewSequenceRef\.current/);
  assert.match(source, /selectedRevisionRef\.current !== revisionId/);
});

test("invalid cursor recovers to the first server page without exposing cursor internals", () => {
  const source = readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8");
  assert.match(source, /error\.code === "invalid_cursor"/);
  assert.match(source, /await loadFirstPage\(state\.query\)/);
  assert.doesNotMatch(readFileSync("components/trainer/quick-assign/quick-assign-template-selection.tsx", "utf8"), /endCursor|invalid_cursor/);
});

test("unknown command outcome locks fields and exposes only same-payload retry", () => {
  const sheet = readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8");
  const form = readFileSync("components/trainer/quick-assign/quick-assign-assignment-form.tsx", "utf8");
  assert.match(sheet, /command\.status === "outcome_unknown"/);
  assert.match(sheet, /runCommand\(state\.command\.payload\)/);
  assert.match(form, /fieldsDisabled/);
  assert.match(form, /Проверить и повторить/);
});

test("dirty close and browser back have explicit recovery paths", () => {
  const sheet = readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8");
  assert.match(sheet, /Закрыть без сохранения\?/);
  assert.match(sheet, /window\.history\.back\(\)/);
  assert.match(sheet, /consumeQuickAssignProfileTrigger/);
});

test("header switches from canonical future work to the persisted assignment result", () => {
  assert.equal(quickAssignHeaderSummary({
    nextAssignment: null,
    upcomingAssignmentCount: 0,
  }), "Будущих тренировок нет");
  const persisted = quickAssignHeaderSummary({
    persistedScheduledFor: "2026-08-31",
    nextAssignment: null,
    upcomingAssignmentCount: 0,
  });
  assert.equal(persisted, "Назначение создано · 31 августа");
  assert.doesNotMatch(persisted, /Будущих тренировок нет/);
});

test("calendar-only dates use stable Russian presentation without browser timezone or year suffix", () => {
  assert.equal(formatQuickAssignCalendarDate("2026-08-31"), "31 августа 2026");
  assert.equal(formatQuickAssignCalendarDate("2026-08-31", false), "31 августа");
});

test("profile receipt returns to Training and keeps queue secondary", () => {
  const navigation = quickAssignReceiptNavigation(transition({ origin: "profile" }));
  assert.deepEqual(navigation.actions.map(({ label, emphasis }) => ({ label, emphasis })), [
    { label: "Вернуться к тренировкам", emphasis: "primary" },
    { label: "К рабочей очереди", emphasis: "secondary" },
  ]);
  assert.match(navigation.actions[0].href, /tab=training/);
});

test("dashboard receipt uses the server-provided next item as its only primary action", () => {
  const navigation = quickAssignReceiptNavigation(transition({ origin: "dashboard", withNextItem: true }));
  assert.deepEqual(navigation.actions.map(({ label, emphasis }) => ({ label, emphasis })), [
    { label: "Следующая задача", emphasis: "primary" },
    { label: "К профилю", emphasis: "secondary" },
    { label: "К рабочей очереди", emphasis: "tertiary" },
  ]);
});

test("all-calm receipt explains the state and never renders a ghost next action", () => {
  const navigation = quickAssignReceiptNavigation(transition({ origin: "dashboard", allCalm: true }));
  assert.equal(navigation.allCalmCopy, "Других задач сейчас нет.");
  assert.deepEqual(navigation.actions.map(({ label, emphasis }) => ({ label, emphasis })), [
    { label: "К спортсменам", emphasis: "primary" },
    { label: "На главную", emphasis: "secondary" },
  ]);
  assert.equal(navigation.actions.some((action) => action.label === "Следующая задача"), false);
});

test("clients and direct receipts use origin-specific primary destinations", () => {
  const clients = quickAssignReceiptNavigation(transition({ origin: "clients" }));
  const direct = quickAssignReceiptNavigation(transition({ origin: "direct" }));
  assert.equal(clients.actions[0].label, "К списку спортсменов");
  assert.equal(clients.actions[0].emphasis, "primary");
  assert.equal(direct.actions[0].label, "Открыть профиль");
  assert.equal(direct.actions[0].emphasis, "primary");
});

test("receipt is a persisted user summary rather than a status table", () => {
  const receipt = readFileSync("components/trainer/quick-assign/quick-assign-receipt.tsx", "utf8");
  assert.match(receipt, /assignment\.titleSnapshot/);
  assert.match(receipt, /assignment\.sourceRevisionNumber/);
  assert.match(receipt, /formatQuickAssignCalendarDate\(assignment\.scheduledFor\)/);
  assert.match(receipt, /Номер назначения/);
  assert.doesNotMatch(receipt, /Статус:\s*Сохранено|>Ссылка</);
  assert.doesNotMatch(receipt, /Повторить назначение|onSubmit/);
  assert.equal(receipt.match(/aria-live="polite"/g)?.length, 1);
});

test("mobile selected-template presentation uses calm copy and metadata", () => {
  const sheet = readFileSync("components/trainer/quick-assign/canonical-quick-assign-sheet.tsx", "utf8");
  const preview = readFileSync("components/trainer/quick-assign/quick-assign-preview.tsx", "utf8");
  assert.match(sheet, /К выбору шаблона/);
  assert.doesNotMatch(sheet, />К шаблонам</);
  assert.match(preview, /`Версия \$\{template\.revisionNumber\}`/);
  assert.doesNotMatch(preview, /Опубликованная версия|uppercase text-lime/);
});

function selectedState(scheduledFor = "") {
  const selected = quickAssignReducer(initialQuickAssignState(), { type: "template_selected", template: item() });
  return scheduledFor ? quickAssignReducer(selected, { type: "date_changed", scheduledFor }) : selected;
}

function transition({
  origin,
  withNextItem = false,
  allCalm = false,
}: {
  origin: TrainerWorkflowTransition["context"]["origin"];
  withNextItem?: boolean;
  allCalm?: boolean;
}): TrainerWorkflowTransition {
  return {
    context: { version: 1, origin, athleteUserId: ATHLETE_ID, tab: "training" },
    profileHref: `/trainer/clients/${ATHLETE_ID}?tab=training&receipt=assignment&receiptId=${ASSIGNMENT_ID}`,
    queueHref: "/trainer/attention?filter=all&order=priority",
    returnHref: `/trainer/clients/${ATHLETE_ID}?tab=training`,
    nextItem: withNextItem ? {
      kind: "review",
      athleteUserId: ATHLETE_ID,
      athleteDisplayName: "Артём Смирнов",
      href: "/trainer/review/55555555-5555-4555-8555-555555555555",
    } : null,
    allCalm,
    result: {
      kind: "assignment",
      entityId: ASSIGNMENT_ID,
      athleteUserId: ATHLETE_ID,
      title: "Тренировка назначена",
      detail: "Силовая база",
    },
  };
}

function item(patch: Partial<QuickAssignTemplateListItem> = {}): QuickAssignTemplateListItem {
  return {
    templateId: TEMPLATE_ID,
    revisionId: REVISION_ID,
    revisionNumber: 1,
    title: "Силовая база",
    description: "Базовая тренировка",
    category: "Сила",
    exerciseCount: 1,
    prescribedSetCount: 3,
    supersetCount: 0,
    estimatedDurationMin: 30,
    updatedAt: "2026-09-01T10:00:00.000Z",
    eligibility: { assignable: true, reason: "ready" },
    ...patch,
  };
}

function preview(): QuickAssignTemplatePreview {
  return { ...item(), generalInstruction: "Без отказа", exercises: [] };
}

function model(patch: Partial<QuickAssignReadModel["athlete"]> = {}): QuickAssignReadModel {
  const upcoming = patch.upcomingAssignments ?? [];
  return {
    readAt: "2026-09-01T10:00:00.000Z",
    athlete: {
      athleteUserId: ATHLETE_ID,
      relationId: "77777777-7777-4777-8777-777777777777",
      displayName: "Артём Смирнов",
      initials: "АС",
      relationStatus: "active",
      athleteStatus: "active",
      capabilities: { canAssign: true, canSearchTemplates: true, canOpenBuilder: true, blockedReason: null },
      nextAssignment: upcoming[0] ?? null,
      upcomingAssignments: upcoming,
      upcomingAssignmentCount: upcoming.length,
      assignmentStateToken: "qa1.token",
      ...patch,
    },
    calendar: { today: "2026-09-01", tomorrow: "2026-09-02", minScheduledFor: "2026-09-01", selectedScheduledFor: null, timezone: null, timezoneAvailability: "unavailable", fallbackExplanation: "Дата сохраняется как календарная дата без привязки к часовому поясу" },
    templates: { items: [item()], pageInfo: { endCursor: null, hasNextPage: false }, search: { query: "", pageSize: 25 } },
    selectedTemplate: { status: "ready", template: preview() },
    dataAvailability: { athlete: "ready", templates: "ready", preview: "ready" },
  };
}
