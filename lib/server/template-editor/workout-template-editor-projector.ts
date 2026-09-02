import type { Actor } from "@/lib/server/database/actor-context";
import type {
  EditorExerciseRow,
  EditorHeaderRow,
  EditorSetRow,
  WorkoutTemplateEditorBundle,
} from "@/lib/server/template-editor/workout-template-editor-repository";
import { workoutTemplateEditorFieldLimits } from "@/lib/server/template-editor/workout-template-editor-types";
import {
  issueWorkoutTemplateEditToken,
  issueWorkoutTemplateLifecycleToken,
} from "@/lib/server/workouts/workout-template-command-crypto";
import type {
  WorkoutTemplateEditorAnomaly,
  WorkoutTemplateEditorCapabilities,
  WorkoutTemplateEditorExercise,
  WorkoutTemplateEditorIssue,
  WorkoutTemplateEditorReadModel,
  WorkoutTemplateEditorRevisionSummary,
  WorkoutTemplateLifecycle,
} from "@/lib/workout-template-editor-contract";

export function projectNewWorkoutTemplateEditor(readAt = new Date().toISOString()): WorkoutTemplateEditorReadModel {
  return {
    mode: "new",
    requestedView: "default",
    identity: null,
    lifecycle: {
      templateStatus: null,
      publishedRevisionSummary: null,
      editableRevisionSummary: null,
      archivedAt: null,
      meaningfulUpdatedAt: null,
    },
    content: {
      title: "",
      description: "",
      category: "",
      generalInstruction: "",
      estimatedDurationMin: null,
      revisionStatus: null,
      revisionNumber: null,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      exercises: [],
    },
    validation: { persistenceBlockers: [], publicationBlockers: [], warnings: [] },
    capabilities: {
      canRead: true,
      canSaveDraft: true,
      canAttemptPublish: false,
      publicationReady: false,
      canCreateRevision: false,
      canContinueDraft: false,
      canViewPublished: false,
      canDuplicate: false,
      canArchive: false,
      canOpenExerciseLibrary: true,
    },
    concurrency: { editToken: null, lifecycleToken: null, lastPersistedAt: null },
    fieldLimits: workoutTemplateEditorFieldLimits,
    anomalies: [],
    dataAvailability: "empty",
    readAt,
  };
}

export function projectWorkoutTemplateEditor(
  actor: Actor,
  requestedView: WorkoutTemplateEditorReadModel["requestedView"],
  bundle: WorkoutTemplateEditorBundle,
): WorkoutTemplateEditorReadModel {
  const { header } = bundle;
  const lifecycle = projectLifecycle(header);
  const editableSummary = revisionSummary(header, "editable");
  const publishedSummary = revisionSummary(header, "published");
  const exercises = projectExercises(bundle.exercises, bundle.sets);
  const anomalies = projectAnomalies(header, lifecycle, bundle.exercises, bundle.sets);
  const publicationBlockers = publicationIssues(header.publication_issues);
  if (header.selected_revision_status === "published" && publicationBlockers.length > 0) {
    anomalies.push("published_content_invalid");
  }
  const warnings = sourceWarnings(exercises);
  for (const warning of warnings) {
    if (warning.code === "source_not_mapped") anomalies.push("source_not_mapped");
    if (warning.code === "source_unavailable") anomalies.push("source_unavailable");
  }
  const uniqueAnomalies = [...new Set(anomalies)];
  const mode = header.selected_revision_role?.startsWith("archived_")
    ? "archived"
    : header.selected_revision_role === "editable" ? "editable" : "published";
  const capabilities = projectCapabilities({
    mode,
    lifecycle,
    hasPublished: publishedSummary !== null,
    hasEditable: editableSummary !== null,
    publicationBlockers,
    anomalies: uniqueAnomalies,
  });
  const editToken = mode === "editable" && capabilities.canSaveDraft && header.selected_lock_version
    ? issueWorkoutTemplateEditToken({
        actorUserId: actor.userId,
        templateId: header.template_id,
        revisionId: header.selected_revision_id!,
        version: Number(header.selected_lock_version),
      })
    : null;
  const lifecycleToken = mode !== "archived"
    && (capabilities.canArchive || capabilities.canCreateRevision)
    ? issueWorkoutTemplateLifecycleToken({
        actorUserId: actor.userId,
        templateId: header.template_id,
        version: Number(header.lifecycle_version),
      })
    : null;
  const sourcePartial = warnings.some((warning) => [
    "source_not_mapped",
    "source_unavailable",
    "source_archived",
    "image_unavailable",
  ].includes(warning.code));

  return {
    mode,
    requestedView,
    identity: {
      templateId: header.template_id,
      selectedRevisionId: header.selected_revision_id!,
      selectedRevisionNumber: header.selected_revision_number!,
      selectedRevisionRole: header.selected_revision_role!,
      lifecycle,
    },
    lifecycle: {
      templateStatus: header.template_status,
      publishedRevisionSummary: publishedSummary,
      editableRevisionSummary: editableSummary,
      archivedAt: header.archived_at?.toISOString() ?? null,
      meaningfulUpdatedAt: meaningfulUpdatedAt(header),
    },
    content: {
      title: header.selected_title ?? "",
      description: header.selected_description ?? "",
      category: header.selected_category ?? "",
      generalInstruction: header.selected_general_instruction ?? "",
      estimatedDurationMin: header.selected_estimated_duration_min,
      revisionStatus: header.selected_revision_status,
      revisionNumber: header.selected_revision_number,
      createdAt: header.selected_created_at?.toISOString() ?? null,
      updatedAt: header.selected_updated_at?.toISOString() ?? null,
      publishedAt: header.selected_published_at?.toISOString() ?? null,
      exercises,
    },
    validation: { persistenceBlockers: [], publicationBlockers, warnings },
    capabilities,
    concurrency: {
      editToken,
      lifecycleToken,
      lastPersistedAt: header.selected_updated_at?.toISOString() ?? null,
    },
    fieldLimits: workoutTemplateEditorFieldLimits,
    anomalies: uniqueAnomalies,
    dataAvailability: sourcePartial ? "source_partial" : exercises.length === 0 ? "empty" : "ready",
    readAt: header.read_at.toISOString(),
  };
}

function projectLifecycle(header: EditorHeaderRow): WorkoutTemplateLifecycle {
  if (header.template_status === "archived") return "archived";
  if (header.published_revision_id && header.editable_revision_id) return "published_with_draft";
  if (header.published_revision_id) return "published_only";
  return "draft_only";
}

function meaningfulUpdatedAt(header: EditorHeaderRow) {
  if (header.template_status === "archived") {
    return (header.archived_at ?? header.template_updated_at).toISOString();
  }
  if (header.editable_revision_id && header.editable_updated_at) {
    return header.editable_updated_at.toISOString();
  }
  const publishedTimes = [header.published_updated_at, header.published_published_at]
    .flatMap((value) => value ? [value.getTime()] : []);
  return publishedTimes.length
    ? new Date(Math.max(...publishedTimes)).toISOString()
    : header.template_updated_at.toISOString();
}

function revisionSummary(header: EditorHeaderRow, role: "editable" | "published"): WorkoutTemplateEditorRevisionSummary | null {
  const id = header[`${role}_revision_id`];
  const number = header[`${role}_revision_number`];
  const status = header[`${role}_revision_status`];
  const title = header[`${role}_title`];
  const category = header[`${role}_category`];
  const createdAt = header[`${role}_created_at`];
  const updatedAt = header[`${role}_updated_at`];
  if (!id || number === null || !status || title === null || category === null || !createdAt || !updatedAt) return null;
  return {
    revisionId: id,
    revisionNumber: number,
    status,
    title,
    category,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    publishedAt: header[`${role}_published_at`]?.toISOString() ?? null,
  };
}

function projectExercises(rows: EditorExerciseRow[], setRows: EditorSetRow[]): WorkoutTemplateEditorExercise[] {
  const setsByExercise = new Map<string, EditorSetRow[]>();
  for (const row of setRows) {
    setsByExercise.set(row.exercise_id, [...(setsByExercise.get(row.exercise_id) ?? []), row]);
  }
  return rows.map((row) => {
    const source = sourceProjection(row);
    return {
      templateExerciseId: row.template_exercise_id,
      instanceKey: row.instance_key,
      sourceExerciseId: row.source_exercise_id,
      sourceExerciseKey: row.source_exercise_key,
      position: row.position,
      snapshot: {
        title: row.title,
        description: row.description,
        category: row.category,
        equipment: row.equipment,
        imageUrl: row.image_url,
      },
      prescription: {
        type: row.prescription_type,
        repetitionMode: row.repetition_mode,
        setCount: row.sets,
        repetitionsMin: row.repetitions_min,
        repetitionsMax: row.repetitions_max,
        durationSeconds: row.duration_seconds,
        targetWeightKg: numeric(row.target_weight_kg),
        restSeconds: row.rest_seconds,
      },
      trainerNote: row.trainer_note,
      perSetMode: row.per_set_mode,
      sets: (setsByExercise.get(row.template_exercise_id) ?? []).map((set) => ({
        templateSetId: set.template_set_id,
        setKey: set.set_key,
        position: set.position,
        kind: set.kind,
        repetitionsMin: set.repetitions_min,
        repetitionsMax: set.repetitions_max,
        durationSeconds: set.duration_seconds,
        targetWeightKg: numeric(set.target_weight_kg),
        restSeconds: set.rest_seconds,
        usesOverride: set.uses_override,
      })),
      superset: row.superset_key && row.superset_position !== null
        ? {
            supersetKey: row.superset_key,
            supersetPosition: row.superset_position,
            label: row.superset_label ?? "",
            instruction: row.superset_instruction ?? "",
          }
        : null,
      source,
      anomalies: sourceAnomalies(source.availability),
    };
  });
}

function sourceProjection(row: EditorExerciseRow): WorkoutTemplateEditorExercise["source"] {
  if (!row.source_exercise_id) {
    return { availability: "source_not_mapped", currentStatus: null, currentStableKey: null, imageAvailability: null };
  }
  if (!row.source_visible_id || !row.source_status) {
    return { availability: "unavailable", currentStatus: null, currentStableKey: null, imageAvailability: null };
  }
  const imageAvailability = row.source_image_available && row.source_image_path ? "ready" : "image_unavailable";
  return {
    availability: row.source_status === "archived"
      ? "archived"
      : imageAvailability === "image_unavailable" ? "image_unavailable" : "ready",
    currentStatus: row.source_status,
    currentStableKey: row.source_current_key,
    imageAvailability,
  };
}

function sourceAnomalies(availability: WorkoutTemplateEditorExercise["source"]["availability"]): WorkoutTemplateEditorExercise["anomalies"] {
  if (availability === "source_not_mapped") return ["source_not_mapped"];
  if (availability === "unavailable") return ["source_unavailable"];
  if (availability === "archived") return ["source_archived"];
  if (availability === "image_unavailable") return ["image_unavailable"];
  return [];
}

function publicationIssues(raw: EditorHeaderRow["publication_issues"]): WorkoutTemplateEditorIssue[] {
  return raw.flatMap((issue) => typeof issue.path === "string" && typeof issue.code === "string"
    ? [projectIssue("publication_blocker", issue.path, issue.code)]
    : []);
}

function sourceWarnings(exercises: WorkoutTemplateEditorExercise[]): WorkoutTemplateEditorIssue[] {
  return exercises.flatMap((exercise) => exercise.anomalies.map((code) => projectIssue(
    "warning",
    `exercises.${exercise.instanceKey}.source`,
    code,
  )));
}

function projectIssue(severity: WorkoutTemplateEditorIssue["severity"], path: string, code: string): WorkoutTemplateEditorIssue {
  const parts = path.split(".");
  const instanceIndex = parts.indexOf("exercises");
  const setIndex = parts.indexOf("sets");
  const supersetIndex = parts.indexOf("supersets");
  return {
    severity,
    code,
    path,
    instanceKey: instanceIndex >= 0 ? parts[instanceIndex + 1] ?? null : null,
    setKey: setIndex >= 0 ? parts[setIndex + 1] ?? null : null,
    supersetKey: supersetIndex >= 0 ? parts[supersetIndex + 1] ?? null : null,
    messageData: { code },
  };
}

function projectAnomalies(
  header: EditorHeaderRow,
  lifecycle: WorkoutTemplateLifecycle,
  exercises: EditorExerciseRow[],
  sets: EditorSetRow[],
): WorkoutTemplateEditorAnomaly[] {
  const anomalies: WorkoutTemplateEditorAnomaly[] = [];
  const editableValid = !header.editable_revision_id || header.editable_revision_status === "draft";
  const publishedValid = !header.published_revision_id || header.published_revision_status === "published";
  const expectedStatus = header.template_status === "archived"
    ? "archived"
    : header.published_revision_id ? "published" : "draft";
  if (!editableValid || !publishedValid || header.template_status !== expectedStatus) anomalies.push("lifecycle_pointer_mismatch");
  if (!header.selected_revision_id || header.selected_revision_number === null) anomalies.push("selected_revision_missing");
  if ((header.selected_revision_role === "editable" && header.selected_revision_status !== "draft")
    || (header.selected_revision_role === "published" && header.selected_revision_status !== "published")
    || (header.selected_revision_role?.startsWith("archived_") && !["draft", "published"].includes(header.selected_revision_status ?? ""))) {
    anomalies.push("invalid_revision_status");
  }
  if (new Set(exercises.map((row) => row.instance_key)).size !== exercises.length) anomalies.push("duplicate_instance_key");
  if (!contiguous(exercises.map((row) => row.position))) anomalies.push("invalid_exercise_order");
  const setsByExercise = new Map<string, number[]>();
  const setKeysByExercise = new Map<string, string[]>();
  for (const row of sets) {
    setsByExercise.set(row.exercise_id, [...(setsByExercise.get(row.exercise_id) ?? []), row.position]);
    setKeysByExercise.set(row.exercise_id, [...(setKeysByExercise.get(row.exercise_id) ?? []), row.set_key]);
  }
  if ([...setKeysByExercise.values()].some((keys) => new Set(keys).size !== keys.length)) {
    anomalies.push("duplicate_set_key");
  }
  if ([...setsByExercise.values()].some((positions) => !contiguous(positions))) anomalies.push("invalid_set_order");
  const groups = new Map<string, EditorExerciseRow[]>();
  for (const row of exercises) {
    if (row.superset_key) groups.set(row.superset_key, [...(groups.get(row.superset_key) ?? []), row]);
  }
  for (const members of groups.values()) {
    const positions = members.flatMap((member) => member.superset_position === null ? [] : [member.superset_position]);
    if (members.length < 2 || members.length > 4 || positions.length !== members.length
      || !contiguous(positions) || new Set(positions).size !== positions.length
      || new Set(members.map((member) => member.superset_label)).size !== 1
      || new Set(members.map((member) => member.superset_instruction)).size !== 1) {
      anomalies.push("invalid_superset");
    }
  }
  if (lifecycle === "draft_only" && header.published_revision_id) anomalies.push("lifecycle_pointer_mismatch");
  return anomalies;
}

function projectCapabilities(input: {
  mode: "editable" | "published" | "archived";
  lifecycle: WorkoutTemplateLifecycle;
  hasPublished: boolean;
  hasEditable: boolean;
  publicationBlockers: WorkoutTemplateEditorIssue[];
  anomalies: WorkoutTemplateEditorAnomaly[];
}): WorkoutTemplateEditorCapabilities {
  const fatal = input.anomalies.some((anomaly) => [
    "lifecycle_pointer_mismatch",
    "selected_revision_missing",
    "invalid_revision_status",
  ].includes(anomaly));
  const publishedInvalid = input.anomalies.includes("published_content_invalid");
  return {
    canRead: true,
    canSaveDraft: input.mode === "editable" && !fatal,
    canAttemptPublish: input.mode === "editable" && !fatal,
    publicationReady: input.mode === "editable" && !fatal && input.publicationBlockers.length === 0,
    canCreateRevision: input.mode === "published" && input.lifecycle === "published_only" && !fatal && !publishedInvalid,
    canContinueDraft: input.lifecycle === "published_with_draft" && input.hasEditable && !fatal,
    canViewPublished: input.hasPublished,
    canDuplicate: !fatal && !publishedInvalid,
    canArchive: input.mode !== "archived" && !fatal && !publishedInvalid,
    canOpenExerciseLibrary: input.mode === "editable" && !fatal,
  };
}

function contiguous(values: number[]) {
  if (values.length === 0) return true;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.every((value, index) => value === index + 1);
}

function numeric(value: string | null) {
  return value === null ? null : Number(value);
}
