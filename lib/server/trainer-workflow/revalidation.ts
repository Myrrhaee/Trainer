import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateTrainerWorkflow(athleteUserId: string) {
  try {
    revalidatePath("/trainer/dashboard");
    revalidatePath("/trainer/attention");
    revalidatePath("/trainer/clients");
    revalidatePath(`/trainer/clients/${athleteUserId}`);
    revalidatePath("/client/me");
    revalidatePath("/client/workouts");
    return null;
  } catch {
    return "Данные сохранены, но автоматическое обновление экранов задержалось.";
  }
}
