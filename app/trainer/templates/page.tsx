import { CanonicalTemplatesWorkspace } from "@/components/trainer/templates/canonical-templates-workspace";
import { TrainerShell } from "@/components/trainer/trainer-shell";

export default function TrainerTemplatesRoute() {
  return (
    <TrainerShell
      eyebrow="Конструктор тренировок"
      title="Шаблоны"
      description="Сохранённые тренировки для повторного использования"
    >
      <CanonicalTemplatesWorkspace />
    </TrainerShell>
  );
}
