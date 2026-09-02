import { isQuickAssignHandoffToken } from "@/lib/quick-assign-navigation";
import { safeTemplateWorkspaceReturnPath } from "@/lib/template-workspace-navigation";
import { decodeTrainerWorkflowContext, isUuid } from "@/lib/trainer-workflow-transition";
import type { WorkoutTemplateEditorViewIntent } from "@/lib/workout-template-editor-contract";

const views = new Set<WorkoutTemplateEditorViewIntent>(["default", "editable", "published", "archived"]);

export function parseWorkoutTemplateEditorView(value: string | null | undefined) {
  const raw = value?.trim() || "default";
  return {
    view: views.has(raw as WorkoutTemplateEditorViewIntent)
      ? raw as WorkoutTemplateEditorViewIntent
      : "default" as const,
    invalid: !views.has(raw as WorkoutTemplateEditorViewIntent),
  };
}

export function workoutTemplateEditorHref(input:
  | { mode: "new"; returnTo?: string | null }
  | { mode: "exact"; templateId: string; view?: WorkoutTemplateEditorViewIntent; returnTo?: string | null }
) {
  const pathname = input.mode === "new"
    ? "/trainer/builder/new"
    : isUuid(input.templateId) ? `/trainer/builder/${input.templateId}` : failInvalidTemplate();
  const params = new URLSearchParams();
  if (input.mode === "exact" && input.view && input.view !== "default") params.set("view", input.view);
  const returnTo = safeWorkoutTemplateEditorReturnPath(input.returnTo);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function safeWorkoutTemplateEditorReturnPath(value: string | null | undefined) {
  const workspace = safeTemplateWorkspaceReturnPath(value);
  if (workspace) return workspace;
  if (!value || value.length > 2_048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(value, "http://trainer.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://trainer.local") return null;
  const match = url.pathname.match(/^\/trainer\/clients\/([0-9a-f-]{36})$/i);
  if (!match || !isUuid(match[1])) return null;
  const allowed = new Set(["tab", "assign", "flow", "handoff"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return null;
  if (url.searchParams.get("tab") !== "training" || url.searchParams.get("assign") !== "1") return null;
  const flowValue = url.searchParams.get("flow");
  if (flowValue) {
    const context = decodeTrainerWorkflowContext(flowValue);
    if (!context || (context.athleteUserId && context.athleteUserId !== match[1])) return null;
  }
  const handoff = url.searchParams.get("handoff");
  if (handoff && !isQuickAssignHandoffToken(handoff)) return null;
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function failInvalidTemplate(): never {
  throw new Error("invalid_workout_template_editor_template");
}
