import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  projectNewWorkoutTemplateEditor,
  projectWorkoutTemplateEditor,
} from "../../lib/server/template-editor/workout-template-editor-projector";
import type {
  EditorExerciseRow,
  EditorHeaderRow,
  EditorSetRow,
  WorkoutTemplateEditorBundle,
} from "../../lib/server/template-editor/workout-template-editor-repository";
import {
  normalizeWorkoutTemplateEditorInput,
} from "../../lib/server/template-editor/workout-template-editor-query-service";
import { WorkoutTemplateEditorValidationError } from "../../lib/server/template-editor/workout-template-editor-types";
import {
  parseWorkoutTemplateEditorView,
  safeWorkoutTemplateEditorReturnPath,
  workoutTemplateEditorHref,
} from "../../lib/workout-template-editor-navigation";

const actor = { userId: "11111111-1111-4111-8111-111111111111" };
const templateId = "22222222-2222-4222-8222-222222222222";
const editableId = "33333333-3333-4333-8333-333333333333";
const publishedId = "44444444-4444-4444-8444-444444444444";

test("new bootstrap is pure, empty and cannot publish before first Save", () => {
  const model = projectNewWorkoutTemplateEditor("2026-09-02T10:00:00.000Z");
  assert.equal(model.mode, "new");
  assert.equal(model.identity, null);
  assert.deepEqual(model.content.exercises, []);
  assert.equal(model.capabilities.canSaveDraft, true);
  assert.equal(model.capabilities.canAttemptPublish, false);
  assert.equal(model.concurrency.editToken, null);
  assert.equal(JSON.stringify(model).includes("athlete"), false);
  assert.equal(JSON.stringify(model).includes("Program"), false);
});

test("view input is strict and future routes contain no revision, token or capability material", () => {
  assert.deepEqual(normalizeWorkoutTemplateEditorInput(templateId, "published"), { templateId, view: "published" });
  assert.throws(() => normalizeWorkoutTemplateEditorInput(templateId, "history"), WorkoutTemplateEditorValidationError);
  assert.deepEqual(parseWorkoutTemplateEditorView("history"), { view: "default", invalid: true });
  assert.equal(workoutTemplateEditorHref({ mode: "new", returnTo: "/trainer/templates?status=drafts" }), "/trainer/builder/new?returnTo=%2Ftrainer%2Ftemplates%3Fstatus%3Ddrafts");
  assert.equal(workoutTemplateEditorHref({ mode: "exact", templateId, view: "published" }), `/trainer/builder/${templateId}?view=published`);
  assert.equal(safeWorkoutTemplateEditorReturnPath("/trainer/dashboard"), "/trainer/dashboard");
  assert.equal(safeWorkoutTemplateEditorReturnPath("/trainer/templates?editToken=secret"), null);
});

test("editable projection preserves partial nullable prescription, semantic set identity and source warning", () => {
  const bundle = editorBundle({
    exercises: [exercise({ source_exercise_id: null, source_visible_id: null, sets: null, repetitions_min: null, repetitions_max: null })],
    sets: [set({ repetitions_min: null, repetitions_max: null, rest_seconds: null })],
    publicationIssues: [
      { path: "exercises.instance-a.prescription.sets", code: "required" },
      { path: "exercises.instance-a.sets.set-a.restSec", code: "required" },
    ],
  });
  const model = projectWorkoutTemplateEditor(actor, "editable", bundle);
  const projected = model.content.exercises[0];
  assert.equal(projected.instanceKey, "instance-a");
  assert.equal(projected.prescription.setCount, null);
  assert.equal(projected.sets[0].setKey, "set-a");
  assert.equal(projected.sets[0].restSeconds, null);
  assert.equal(projected.source.availability, "source_not_mapped");
  assert.equal(model.validation.publicationBlockers[1].setKey, "set-a");
  assert.equal(model.validation.warnings[0].instanceKey, "instance-a");
  assert.equal(model.capabilities.canSaveDraft, true);
  assert.equal(model.capabilities.publicationReady, false);
  assert.ok(model.concurrency.editToken?.startsWith("wt1."));
  assert.equal(JSON.stringify(model).includes("lock_version"), false);
  assert.equal("canAssign" in model.capabilities, false);
});

test("published plus Draft can select immutable Published while retaining both summaries", () => {
  const bundle = editorBundle({
    header: {
      template_status: "published",
      selected_revision_id: publishedId,
      selected_revision_role: "published",
      selected_revision_number: 1,
      selected_revision_status: "published",
      selected_title: "Опубликованное название",
      selected_published_at: new Date("2026-08-01T10:00:00.000Z"),
      publication_issues: [],
    },
  });
  const model = projectWorkoutTemplateEditor(actor, "published", bundle);
  assert.equal(model.mode, "published");
  assert.equal(model.content.title, "Опубликованное название");
  assert.equal(model.lifecycle.editableRevisionSummary?.title, "Черновое название");
  assert.equal(model.lifecycle.publishedRevisionSummary?.title, "Опубликованное название");
  assert.equal(model.capabilities.canContinueDraft, true);
  assert.equal(model.capabilities.canCreateRevision, false);
  assert.equal(model.capabilities.canSaveDraft, false);
  assert.equal(model.concurrency.editToken, null);
});

test("canonical pointers, not compatibility current_revision, determine the selected revision", () => {
  const model = projectWorkoutTemplateEditor(actor, "published", editorBundle({
    header: {
      current_revision: 99,
      selected_revision_id: publishedId,
      selected_revision_role: "published",
      selected_revision_number: 1,
      selected_revision_status: "published",
      selected_title: "Pointer-selected Published",
      selected_published_at: new Date("2026-08-01T10:00:00.000Z"),
    },
  }));
  assert.equal(model.identity?.selectedRevisionId, publishedId);
  assert.equal(model.identity?.selectedRevisionNumber, 1);
  assert.equal(model.content.title, "Pointer-selected Published");
  assert.equal(JSON.stringify(model).includes("current_revision"), false);
});

test("invalid lifecycle pointer/status fails mutation capabilities closed", () => {
  const model = projectWorkoutTemplateEditor(actor, "editable", editorBundle({
    header: { editable_revision_status: "published", selected_revision_status: "published" },
  }));
  assert.ok(model.anomalies.includes("lifecycle_pointer_mismatch"));
  assert.ok(model.anomalies.includes("invalid_revision_status"));
  assert.equal(model.capabilities.canSaveDraft, false);
  assert.equal(model.capabilities.canAttemptPublish, false);
  assert.equal(model.capabilities.canArchive, false);
});

test("set keys are semantic identities scoped to their exercise", () => {
  const second = exercise({
    template_exercise_id: "88888888-8888-4888-8888-888888888888",
    instance_key: "instance-b",
    position: 2,
  });
  const model = projectWorkoutTemplateEditor(actor, "editable", editorBundle({
    exercises: [exercise(), second],
    sets: [
      set(),
      set({
        template_set_id: "99999999-9999-4999-8999-999999999999",
        exercise_id: second.template_exercise_id,
      }),
    ],
  }));
  assert.equal(model.anomalies.includes("duplicate_set_key"), false);
  assert.deepEqual(model.content.exercises.map((entry) => entry.sets[0].setKey), ["set-a", "set-a"]);
});

test("superset and source projections fail visibly without rewriting snapshot facts", () => {
  const first = exercise({
    title: "Snapshot title",
    source_visible_id: "55555555-5555-4555-8555-555555555555",
    source_current_key: "source-a",
    source_status: "active",
    source_image_available: false,
    superset_key: "pair-a",
    superset_position: 1,
    superset_label: "Пара",
    superset_instruction: "Без отдыха",
  });
  const model = projectWorkoutTemplateEditor(actor, "editable", editorBundle({ exercises: [first], publicationIssues: [
    { path: "supersets.pair-a.members", code: "invalid_superset" },
  ] }));
  assert.equal(model.content.exercises[0].snapshot.title, "Snapshot title");
  assert.equal(model.content.exercises[0].source.availability, "image_unavailable");
  assert.equal(model.content.exercises[0].superset?.supersetKey, "pair-a");
  assert.ok(model.anomalies.includes("invalid_superset"));
  assert.equal(model.validation.publicationBlockers[0].supersetKey, "pair-a");
});

test("valid supersets remain stable while duplicate member positions fail closed", () => {
  const memberA = exercise({
    superset_key: "pair-a",
    superset_position: 1,
    superset_label: "Пара",
    superset_instruction: "Без отдыха",
  });
  const memberB = exercise({
    template_exercise_id: "88888888-8888-4888-8888-888888888888",
    instance_key: "instance-b",
    position: 2,
    superset_key: "pair-a",
    superset_position: 2,
    superset_label: "Пара",
    superset_instruction: "Без отдыха",
  });
  const valid = projectWorkoutTemplateEditor(actor, "editable", editorBundle({ exercises: [memberA, memberB] }));
  assert.equal(valid.anomalies.includes("invalid_superset"), false);
  assert.deepEqual(valid.content.exercises.map((entry) => entry.superset?.supersetPosition), [1, 2]);

  const duplicatePosition = projectWorkoutTemplateEditor(actor, "editable", editorBundle({
    exercises: [memberA, { ...memberB, superset_position: 1 }],
  }));
  assert.ok(duplicatePosition.anomalies.includes("invalid_superset"));
});

test("foreign or invisible source is non-disclosing and keeps the persisted snapshot", () => {
  const model = projectWorkoutTemplateEditor(actor, "editable", editorBundle({
    exercises: [exercise({ source_visible_id: null, source_current_key: null, source_status: null })],
  }));
  assert.equal(model.content.exercises[0].source.availability, "unavailable");
  assert.equal(model.content.exercises[0].source.currentStableKey, null);
  assert.equal(model.content.exercises[0].snapshot.title, "Snapshot title");
  assert.ok(model.anomalies.includes("source_unavailable"));
  assert.ok(model.validation.warnings.some((issue) => issue.code === "source_unavailable"));
});

test("invalid Published content is readable but disables misleading lifecycle capabilities", () => {
  const model = projectWorkoutTemplateEditor(actor, "published", editorBundle({
    header: {
      editable_revision_id: null,
      editable_revision_number: null,
      editable_revision_status: null,
      editable_title: null,
      editable_category: null,
      editable_created_at: null,
      editable_updated_at: null,
      editable_published_at: null,
      selected_revision_id: publishedId,
      selected_revision_role: "published",
      selected_revision_number: 1,
      selected_revision_status: "published",
      selected_published_at: new Date("2026-08-01T10:00:00.000Z"),
    },
    publicationIssues: [{ path: "supersets.pair-a.members", code: "invalid_superset" }],
  }));
  assert.ok(model.anomalies.includes("published_content_invalid"));
  assert.equal(model.capabilities.canCreateRevision, false);
  assert.equal(model.capabilities.canDuplicate, false);
  assert.equal(model.capabilities.canArchive, false);
});

test("exact API is read-only, no-store, actor-gated and independent from demo/full-list hydration", () => {
  const route = readFileSync("app/api/trainer/workout-builder/templates/[templateId]/editor/route.ts", "utf8");
  const repository = readFileSync("lib/server/template-editor/workout-template-editor-repository.ts", "utf8");
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /invalid_view/);
  assert.match(route, /template_editor_forbidden/);
  assert.match(route, /unauthorized.*401/);
  assert.match(route, /template_not_found.*404/);
  assert.match(route, /WorkoutTemplateEditorViewUnavailableError/);
  assert.match(route, /temporarily_unavailable.*503/);
  assert.doesNotMatch(route, /export async function POST|PUT|PATCH|DELETE/);
  assert.match(repository, /REPEATABLE READ READ ONLY/);
  assert.doesNotMatch(repository, /\.list\(|Workspace|Assignment|athlete|demo|mock|localStorage/);
});

function editorBundle(input: {
  header?: Partial<EditorHeaderRow>;
  exercises?: EditorExerciseRow[];
  sets?: EditorSetRow[];
  publicationIssues?: EditorHeaderRow["publication_issues"];
} = {}): WorkoutTemplateEditorBundle {
  const header = baseHeader();
  return {
    header: { ...header, ...input.header, publication_issues: input.publicationIssues ?? input.header?.publication_issues ?? header.publication_issues },
    exercises: input.exercises ?? [exercise()],
    sets: input.sets ?? [set()],
  };
}

function baseHeader(): EditorHeaderRow {
  const date = new Date("2026-09-01T10:00:00.000Z");
  return {
    template_id: templateId,
    template_status: "published",
    current_revision: 2,
    lifecycle_version: "3",
    template_created_at: date,
    template_updated_at: date,
    archived_at: null,
    editable_revision_id: editableId,
    editable_revision_number: 2,
    editable_revision_status: "draft",
    editable_title: "Черновое название",
    editable_category: "Сила",
    editable_created_at: date,
    editable_updated_at: date,
    editable_published_at: null,
    published_revision_id: publishedId,
    published_revision_number: 1,
    published_revision_status: "published",
    published_title: "Опубликованное название",
    published_category: "Сила",
    published_created_at: date,
    published_updated_at: date,
    published_published_at: date,
    selected_revision_id: editableId,
    selected_revision_role: "editable",
    selected_revision_number: 2,
    selected_revision_status: "draft",
    selected_title: "Черновое название",
    selected_description: "Описание",
    selected_category: "Сила",
    selected_general_instruction: "Инструкция",
    selected_estimated_duration_min: null,
    selected_created_at: date,
    selected_updated_at: date,
    selected_published_at: null,
    selected_lock_version: "4",
    publication_issues: [],
    read_at: date,
  };
}

function exercise(overrides: Partial<EditorExerciseRow> = {}): EditorExerciseRow {
  return {
    template_exercise_id: "66666666-6666-4666-8666-666666666666",
    instance_key: "instance-a",
    source_exercise_id: "55555555-5555-4555-8555-555555555555",
    source_exercise_key: "source-a",
    position: 1,
    title: "Snapshot title",
    category: "Сила",
    equipment: "Штанга",
    description: "Snapshot description",
    image_url: "/snapshot.webp",
    prescription_type: "repetitions",
    repetition_mode: "fixed",
    sets: 1,
    repetitions_min: 8,
    repetitions_max: 8,
    duration_seconds: null,
    target_weight_kg: "50.00",
    rest_seconds: 90,
    per_set_mode: true,
    trainer_note: "Спокойно",
    superset_key: null,
    superset_position: null,
    superset_label: null,
    superset_instruction: null,
    source_visible_id: "55555555-5555-4555-8555-555555555555",
    source_current_key: "source-a",
    source_status: "active",
    source_image_path: "exercises/source-a.webp",
    source_image_available: true,
    ...overrides,
  };
}

function set(overrides: Partial<EditorSetRow> = {}): EditorSetRow {
  return {
    template_set_id: "77777777-7777-4777-8777-777777777777",
    exercise_id: "66666666-6666-4666-8666-666666666666",
    set_key: "set-a",
    position: 1,
    kind: "working",
    repetitions_min: 8,
    repetitions_max: 8,
    duration_seconds: null,
    target_weight_kg: "50.00",
    rest_seconds: 90,
    uses_override: true,
    ...overrides,
  };
}
