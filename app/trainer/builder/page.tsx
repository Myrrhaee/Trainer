import { redirect } from "next/navigation";

import { resolveLegacyWorkoutTemplateBuilderHref } from "@/lib/workout-template-builder-compatibility";

type BuilderSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TrainerBuilderRoute({ searchParams }: { searchParams: BuilderSearchParams }) {
  const params = await searchParams;
  redirect(resolveLegacyWorkoutTemplateBuilderHref(params));
}
