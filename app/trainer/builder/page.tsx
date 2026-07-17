import { WorkoutTemplateBuilderPage } from "@/components/trainer-os/workout-template-builder/workout-template-builder-page";

type BuilderSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TrainerBuilderRoute({ searchParams }: { searchParams: BuilderSearchParams }) {
  const params = await searchParams;
  const value = (key: string) => {
    const current = params[key];
    return Array.isArray(current) ? current[0] : current;
  };

  return (
    <WorkoutTemplateBuilderPage
      entry={{
        athleteId: value("athleteId") ?? value("clientId"),
        templateId: value("templateId"),
        returnTo: value("returnTo"),
        source: value("from") === "quick-assign" ? "quick-assign" : value("templateId") ? "templates" : "direct",
        initialGoal: value("goal") ?? value("category"),
        emptyWorkspace: value("demo") === "empty",
      }}
    />
  );
}
