import type { AthleteTrainingHistoryItem } from "@/lib/server/athlete-profile/athlete-training-types";

export function mergeAthleteTrainingHistory(
  existing: AthleteTrainingHistoryItem[],
  incoming: AthleteTrainingHistoryItem[],
) {
  const known = new Set(existing.map((item) => item.assignment.id));
  const additions = incoming.filter((item) => !known.has(item.assignment.id));
  return { items: [...existing, ...additions], additions };
}
