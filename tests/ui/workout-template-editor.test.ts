import assert from "node:assert/strict";
import test from "node:test";

import type { ExerciseSelectionSnapshot } from "../../lib/exercise-library-contract";
import { quickAssignHref } from "../../lib/quick-assign-navigation";
import { createTrainerWorkflowContext, encodeTrainerWorkflowContext } from "../../lib/trainer-workflow-transition";
import { resolveWorkoutTemplateExitDestination, safeWorkoutTemplateEditorReturnPath, workoutTemplateEditorHref } from "../../lib/workout-template-editor-navigation";
import {
  createPerSetRows,
  draftsEqual,
  editorIssueFocusTarget,
  editorSequence,
  editorCommandReducer,
  failedCommandLabel,
  initialEditorCommandState,
  localPublicationIssues,
  moveEditorSequenceItem,
  moveSupersetMember,
  newExerciseDraft,
  normalizeDraft,
  semanticDraft,
  toCommandContent,
  type EditorDraftContent,
  type SaveDraftAttempt,
} from "../../components/trainer/template-editor/workout-template-editor-state";

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const snapshot: ExerciseSelectionSnapshot = {
  sourceExerciseId: "22222222-2222-4222-8222-222222222222",
  sourceExerciseKey: "bench-press",
  title: "Жим штанги лёжа",
  description: "Базовое упражнение",
  category: "Грудь",
  equipment: "Штанга",
  imageUrl: null,
};

test("new canonical route carries only safe return context", () => {
  assert.equal(workoutTemplateEditorHref({ mode: "new", returnTo: "/trainer/templates?status=drafts" }), "/trainer/builder/new?returnTo=%2Ftrainer%2Ftemplates%3Fstatus%3Ddrafts");
  assert.equal(workoutTemplateEditorHref({ mode: "exact", templateId: TEMPLATE_ID, view: "published" }), `/trainer/builder/${TEMPLATE_ID}?view=published`);
});

test("save-and-exit resolver preserves safe shell destinations and anchors workspace state", () => {
  assert.equal(resolveWorkoutTemplateExitDestination("/trainer/dashboard", TEMPLATE_ID), "/trainer/dashboard");
  assert.equal(resolveWorkoutTemplateExitDestination("/trainer/clients", TEMPLATE_ID), "/trainer/clients");
  assert.equal(resolveWorkoutTemplateExitDestination("/trainer/library", TEMPLATE_ID), "/trainer/library");
  assert.equal(resolveWorkoutTemplateExitDestination("/trainer/settings", TEMPLATE_ID), "/trainer/settings");
  assert.equal(
    resolveWorkoutTemplateExitDestination("/trainer/templates?status=drafts&q=legs&category=strength&page=2", TEMPLATE_ID),
    `/trainer/templates?status=drafts&q=legs&category=strength&page=2&anchor=${TEMPLATE_ID}`,
  );
  assert.equal(resolveWorkoutTemplateExitDestination("/trainer/dashboard?unsupported=1", TEMPLATE_ID), "/trainer/templates");
  assert.equal(resolveWorkoutTemplateExitDestination("https://foreign.example/trainer/dashboard", TEMPLATE_ID), "/trainer/templates");
});

test("quick-assign return is preserved as navigation context and rejects malformed substitutions", () => {
  const athleteUserId = "55555555-5555-4555-8555-555555555555";
  const foreignAthleteUserId = "66666666-6666-4666-8666-666666666666";
  const handoffToken = "r2d7c_quick_assign_handoff_123456";
  const context = createTrainerWorkflowContext({ origin: "profile", athleteUserId });
  const destination = quickAssignHref({ athleteUserId, context, handoffToken });

  assert.equal(safeWorkoutTemplateEditorReturnPath(destination), destination);
  assert.equal(resolveWorkoutTemplateExitDestination(destination, TEMPLATE_ID), destination);
  assert.equal(new URL(destination, "http://trainer.local").searchParams.has("anchor"), false);

  const foreign = new URL(destination, "http://trainer.local");
  foreign.searchParams.set("flow", encodeTrainerWorkflowContext(createTrainerWorkflowContext({
    origin: "profile",
    athleteUserId: foreignAthleteUserId,
  })));
  assert.equal(safeWorkoutTemplateEditorReturnPath(`${foreign.pathname}${foreign.search}`), null);

  const invalidFlow = new URL(destination, "http://trainer.local");
  invalidFlow.searchParams.set("flow", "not-json");
  assert.equal(safeWorkoutTemplateEditorReturnPath(`${invalidFlow.pathname}${invalidFlow.search}`), null);

  const invalidHandoff = new URL(destination, "http://trainer.local");
  invalidHandoff.searchParams.set("handoff", "short");
  assert.equal(safeWorkoutTemplateEditorReturnPath(`${invalidHandoff.pathname}${invalidHandoff.search}`), null);
});

test("selected exercise starts honestly incomplete with a fresh semantic identity", () => {
  const first = newExerciseDraft(snapshot);
  const second = newExerciseDraft(snapshot);
  assert.notEqual(first.instanceKey, second.instanceKey);
  assert.equal(first.setCount, "");
  assert.equal(first.repetitionsMin, "");
  assert.equal(first.restSec, "");
  assert.equal(first.sourceExerciseId, snapshot.sourceExerciseId);
});

test("semantic dirty comparison ignores only normalized positions", () => {
  const content = draft([newExerciseDraft(snapshot)]);
  assert.equal(draftsEqual(content, { ...content, exercises: content.exercises.map((item) => ({ ...item, position: 99 })) }), true);
  assert.equal(draftsEqual(content, { ...content, title: "Другое" }), false);
});

test("per-set conversion creates stable unique keys without fake values", () => {
  const exercise = { ...newExerciseDraft(snapshot), setCount: "3", repetitionsMin: "8", repetitionsMax: "8", restSec: "90" };
  const rows = createPerSetRows(exercise);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((row) => row.setKey)).size, 3);
  assert.deepEqual(rows.map((row) => row.restSec), ["90", "90", "90"]);
});

test("publication issues are local guidance while partial Draft remains serializable", () => {
  const content = draft([newExerciseDraft(snapshot)]);
  assert.ok(localPublicationIssues(content).some((issue) => issue.path.includes("prescription.sets")));
  assert.doesNotThrow(() => semanticDraft(content));
  const command = toCommandContent(content) as { items: unknown[] };
  assert.equal(command.items.length, 1);
});

test("normalization preserves instance identity while fixing display order", () => {
  const first = newExerciseDraft(snapshot);
  const second = newExerciseDraft({ ...snapshot, sourceExerciseKey: "squat", title: "Приседание" });
  const normalized = normalizeDraft(draft([{ ...first, position: 8 }, { ...second, position: 3 }]));
  assert.deepEqual(normalized.exercises.map((item) => item.position), [1, 2]);
  assert.deepEqual(normalized.exercises.map((item) => item.instanceKey), [first.instanceKey, second.instanceKey]);
});

test("group-aware sequence moves standalone rows and whole supersets without losing identities", () => {
  const first = identifiedExercise("first", "Первое");
  const memberA = { ...identifiedExercise("member-a", "Пара A"), supersetKey: "group-a", supersetPosition: 1 };
  const memberB = { ...identifiedExercise("member-b", "Пара B"), supersetKey: "group-a", supersetPosition: 2 };
  const last = identifiedExercise("last", "Последнее");
  const source = [first, memberA, memberB, last];

  assert.deepEqual(editorSequence(source).map((item) => item.key), ["exercise:first", "superset:group-a", "exercise:last"]);
  const groupFirst = moveEditorSequenceItem(source, "member-a", -1);
  assert.deepEqual(groupFirst.map((item) => item.instanceKey), ["member-a", "member-b", "first", "last"]);
  assert.deepEqual(groupFirst.filter((item) => item.supersetKey).map((item) => item.supersetPosition), [1, 2]);
  assert.deepEqual(new Set(groupFirst.map((item) => item.instanceKey)).size, 4);

  const standaloneUp = moveEditorSequenceItem(source, "last", -1);
  assert.deepEqual(standaloneUp.map((item) => item.instanceKey), ["first", "last", "member-a", "member-b"]);
});

test("superset member reorder changes only persisted member order and keeps one-member drafts representable", () => {
  const memberA = { ...identifiedExercise("member-a", "A"), supersetKey: "group-a", supersetPosition: 1 };
  const memberB = { ...identifiedExercise("member-b", "B"), supersetKey: "group-a", supersetPosition: 2 };
  const reordered = moveSupersetMember([memberA, memberB], "member-b", -1);
  assert.deepEqual(reordered.map((item) => item.instanceKey), ["member-b", "member-a"]);
  assert.deepEqual(reordered.map((item) => item.supersetPosition), [1, 2]);
  const command = toCommandContent(draft(reordered)) as { items: Array<{ exercises?: Array<{ instanceId: string }> }> };
  assert.deepEqual(command.items[0]?.exercises?.map((item) => item.instanceId), ["member-b", "member-a"]);

  const oneMember = moveEditorSequenceItem([memberA], "member-a", 1);
  assert.equal(oneMember.length, 1);
  assert.equal(oneMember[0]?.supersetKey, "group-a");
  assert.ok(localPublicationIssues(draft(oneMember)).some((issue) => issue.supersetKey === "group-a"));
});

test("validation issues resolve to exact stable semantic controls", () => {
  assert.deepEqual(editorIssueFocusTarget({ severity: "publication_blocker", code: "required", path: "template.title", instanceKey: null, setKey: null, supersetKey: null, messageData: { code: "required" } }), { id: "template-title", instanceKey: null, supersetKey: null });
  assert.equal(editorIssueFocusTarget({ severity: "publication_blocker", code: "required", path: "exercises.exercise-a.sets.set-b.restSec", instanceKey: "exercise-a", setKey: "set-b", supersetKey: null, messageData: { code: "required" } }).id, "exercise-set-field:exercise-a:set-b:restSec");
  assert.equal(editorIssueFocusTarget({ severity: "publication_blocker", code: "invalid_superset", path: "supersets.group-a.members", instanceKey: null, setKey: null, supersetKey: "group-a", messageData: { code: "invalid_superset" } }).id, "superset-target:group-a");
});

test("failed command status is operation-specific", () => {
  assert.equal(failedCommandLabel("save_draft"), "Не удалось сохранить");
  assert.equal(failedCommandLabel("save_as_new"), "Не удалось создать копию");
  assert.equal(failedCommandLabel("publish"), "Не удалось опубликовать");
  assert.equal(failedCommandLabel("create_revision"), "Не удалось создать версию");
});

test("logical save attempt keeps frozen identity and payload through unknown reconciliation", () => {
  const frozenContent = draft([{ ...newExerciseDraft(snapshot), setCount: "3", repetitionsMin: "8", repetitionsMax: "8" }]);
  const attempt: SaveDraftAttempt = {
    operation: "save_draft",
    commandId: "33333333-3333-4333-8333-333333333333",
    templateId: TEMPLATE_ID,
    revisionId: "44444444-4444-4444-8444-444444444444",
    expectedToken: "edit-token",
    fingerprint: semanticDraft(frozenContent),
    frozenContent: structuredClone(frozenContent),
    frozenPayload: toCommandContent(frozenContent, 2),
    exitTo: null,
    startedAt: 1,
    resultState: "running",
  };
  const running = editorCommandReducer(initialEditorCommandState, { type: "begin", attempt });
  const unknown = editorCommandReducer(running, { type: "outcome_unknown" });
  assert.equal(unknown.phase, "outcome_unknown");
  assert.equal(unknown.attempt?.commandId, attempt.commandId);
  assert.equal(unknown.attempt?.templateId, attempt.templateId);
  assert.deepEqual((unknown.attempt as SaveDraftAttempt).frozenPayload, attempt.frozenPayload);
});

test("known failure unlocks retry while conflict remains an explicit recovery branch", () => {
  const frozenContent = draft([]);
  const attempt: SaveDraftAttempt = {
    operation: "save_draft",
    commandId: "33333333-3333-4333-8333-333333333333",
    templateId: TEMPLATE_ID,
    revisionId: "44444444-4444-4444-8444-444444444444",
    expectedToken: "edit-token",
    fingerprint: semanticDraft(frozenContent),
    frozenContent,
    frozenPayload: toCommandContent(frozenContent),
    exitTo: null,
    startedAt: 1,
    resultState: "running",
  };
  const running = editorCommandReducer(initialEditorCommandState, { type: "begin", attempt });
  assert.equal(editorCommandReducer(running, { type: "failed" }).phase, "failed");
  const conflict = editorCommandReducer(running, { type: "conflict" });
  assert.equal(conflict.phase, "conflict");
  assert.equal(conflict.attempt?.commandId, attempt.commandId);
});

function draft(exercises: EditorDraftContent["exercises"]): EditorDraftContent {
  return { title: "", description: "", category: "", generalInstruction: "", estimatedDurationMin: "", exercises };
}

function identifiedExercise(instanceKey: string, title: string) {
  return { ...newExerciseDraft({ ...snapshot, sourceExerciseKey: instanceKey, title }), instanceKey };
}
