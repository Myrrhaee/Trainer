import { notFound } from "next/navigation";

import { CanonicalWorkoutTemplateEditor } from "@/components/trainer/template-editor/canonical-workout-template-editor";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { isQuickAssignHandoffToken } from "@/lib/quick-assign-navigation";
import { requireCapability } from "@/lib/server/access/access-guard";
import { WorkoutTemplateEditorQueryService } from "@/lib/server/template-editor/workout-template-editor-query-service";
import { WorkoutTemplateEditorNotFoundError, WorkoutTemplateEditorValidationError, WorkoutTemplateEditorViewUnavailableError } from "@/lib/server/template-editor/workout-template-editor-types";
import { parseWorkoutTemplateEditorView, safeWorkoutTemplateEditorReturnPath } from "@/lib/workout-template-editor-navigation";

type Params = Promise<{ templateId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExactWorkoutTemplateEditorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ templateId }, query] = await Promise.all([params, searchParams]);
  const { actor } = await requireCapability("trainer", `/trainer/builder/${templateId}`);
  const parsedView = parseWorkoutTemplateEditorView(single(query.view));
  if (parsedView.invalid || Array.isArray(query.view)) notFound();
  const receipt = single(query.receipt);
  if (receipt !== undefined && receipt !== "published") notFound();
  const service = new WorkoutTemplateEditorQueryService();
  let model;
  try {
    model = await service.read(actor, templateId, parsedView.view);
  } catch (error) {
    if (error instanceof WorkoutTemplateEditorNotFoundError || error instanceof WorkoutTemplateEditorValidationError || error instanceof WorkoutTemplateEditorViewUnavailableError) notFound();
    throw error;
  }
  const returnTo = safeWorkoutTemplateEditorReturnPath(single(query.returnTo));
  const handoff = single(query.handoff);
  return <TrainerShell eyebrow="Конструктор тренировок" title={model.content.title || "Шаблон тренировки"} description={model.mode === "published" ? "Опубликованная версия" : model.mode === "archived" ? "Сохранённая версия из архива" : "Редактирование черновика"}>
    <CanonicalWorkoutTemplateEditor key={`${model.mode}:${model.identity?.selectedRevisionId ?? templateId}`} actorUserId={actor.userId} initialModel={model} returnTo={returnTo} handoffToken={isQuickAssignHandoffToken(handoff) ? handoff : null} showPublishReceipt={receipt === "published" && model.mode === "published"} />
  </TrainerShell>;
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? undefined : value; }
