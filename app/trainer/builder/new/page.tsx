import { CanonicalWorkoutTemplateEditor } from "@/components/trainer/template-editor/canonical-workout-template-editor";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { isQuickAssignHandoffToken } from "@/lib/quick-assign-navigation";
import { requireCapability } from "@/lib/server/access/access-guard";
import { WorkoutTemplateEditorQueryService } from "@/lib/server/template-editor/workout-template-editor-query-service";
import { safeWorkoutTemplateEditorReturnPath } from "@/lib/workout-template-editor-navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewWorkoutTemplateEditorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { actor } = await requireCapability("trainer", "/trainer/builder/new");
  const model = await new WorkoutTemplateEditorQueryService().bootstrapNew(actor);
  const returnTo = safeWorkoutTemplateEditorReturnPath(single(params.returnTo));
  const handoff = single(params.handoff);

  return <TrainerShell eyebrow="Конструктор тренировок" title="Новый шаблон" description="Соберите тренировку и сохраните неполный черновик, когда будете готовы продолжить.">
    <CanonicalWorkoutTemplateEditor actorUserId={actor.userId} initialModel={model} returnTo={returnTo} handoffToken={isQuickAssignHandoffToken(handoff) ? handoff : null} />
  </TrainerShell>;
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? undefined : value; }
