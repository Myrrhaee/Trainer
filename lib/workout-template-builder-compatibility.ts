import { isQuickAssignHandoffToken } from "@/lib/quick-assign-navigation";
import {
  safeWorkoutTemplateEditorReturnPath,
  workoutTemplateEditorHref,
} from "@/lib/workout-template-editor-navigation";
import { isUuid } from "@/lib/trainer-workflow-transition";

const allowedKeys = new Set(["create", "templateId", "view", "returnTo", "handoff"]);

type LegacyBuilderSearch = Record<string, string | string[] | undefined>;

export function resolveLegacyWorkoutTemplateBuilderHref(search: LegacyBuilderSearch) {
  if (Object.keys(search).some((key) => !allowedKeys.has(key))) return "/trainer/templates";
  if (Object.values(search).some(Array.isArray)) return "/trainer/templates";

  const create = first(search.create);
  const templateId = first(search.templateId);
  const view = first(search.view);
  const rawReturnTo = first(search.returnTo);
  const rawHandoff = first(search.handoff);
  const returnTo = rawReturnTo ? safeWorkoutTemplateEditorReturnPath(rawReturnTo) : null;
  const handoffToken = rawHandoff && isQuickAssignHandoffToken(rawHandoff) ? rawHandoff : null;

  if ((rawReturnTo && !returnTo) || (rawHandoff && !handoffToken)) return "/trainer/templates";
  if (create && create !== "1") return "/trainer/templates";
  if (view && view !== "published") return "/trainer/templates";

  if (templateId) {
    if (create || handoffToken || !isUuid(templateId)) return "/trainer/templates";
    return workoutTemplateEditorHref({
      mode: "exact",
      templateId,
      view: view === "published" ? "published" : undefined,
      returnTo,
    });
  }

  if (view) return "/trainer/templates";
  if (create === "1" || handoffToken) {
    return workoutTemplateEditorHref({ mode: "new", returnTo, handoffToken });
  }
  return "/trainer/templates";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
