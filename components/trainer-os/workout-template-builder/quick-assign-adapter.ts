import type { WorkoutTemplateListItem } from "@/components/trainer-os/quick-assign/quick-assign-model";

import { getTemplateExercises, type WorkoutTemplateDraft } from "./builder-model";

export function toQuickAssignTemplate(template: WorkoutTemplateDraft): WorkoutTemplateListItem | undefined {
  if (template.status !== "published") return undefined;

  return {
    id: template.id,
    revision: template.revision,
    title: template.title,
    description: template.description,
    category: template.category,
    focus: template.category ? [template.category] : [],
    durationMin: Number.parseInt(template.estimatedDurationMin, 10) || 45,
    state: "published",
    recent: true,
    instruction: template.generalInstruction,
    hasSupersets: template.items.some((item) => item.kind === "superset"),
    exercises: getTemplateExercises(template).map((exercise) => ({
      id: exercise.instanceId,
      title: exercise.title,
      sets: Number.parseInt(exercise.prescription.sets, 10) || 1,
      repetitions: exercise.prescription.type === "duration"
        ? Number.parseInt(exercise.prescription.durationSec, 10) || 1
        : Number.parseInt(exercise.prescription.repetitionsMin, 10) || 1,
      targetWeightKg: optionalNumber(exercise.prescription.targetWeightKg),
    })),
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
