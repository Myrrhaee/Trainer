export type ExerciseScope = "system" | "trainer";
export type ExerciseStatus = "active" | "archived";
export type ExerciseSourceAvailability =
  | "ready"
  | "archived"
  | "unavailable"
  | "source_not_mapped"
  | "permission_denied";
export type ExerciseImageAvailability = "ready" | "image_unavailable";

export type ExerciseLibraryFilters = {
  query: string;
  category: string;
  equipment: string;
  bodyRegion: string;
  scope: "all" | ExerciseScope;
  pageSize: number;
};

export type ExerciseLibraryImage = {
  availability: ExerciseImageAvailability;
  assetPath: string | null;
  url: string | null;
};

export type ExerciseLibraryItem = {
  exerciseId: string;
  stableKey: string;
  scope: ExerciseScope;
  title: string;
  category: string | null;
  equipment: string | null;
  bodyRegion: string | null;
  image: ExerciseLibraryImage;
  sourceLabel: string;
  status: "active";
  eligibility: { canSelect: true; reason: null };
  updatedAt: string;
};

export type ExerciseDetailReadModel = {
  exerciseId: string;
  stableKey: string;
  scope: ExerciseScope;
  ownerTrainerUserId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  equipment: string | null;
  bodyRegion: string | null;
  image: ExerciseLibraryImage;
  sourceLabel: string;
  status: ExerciseStatus;
  sourceAvailability: Extract<ExerciseSourceAvailability, "ready" | "archived">;
  canSelect: boolean;
  anomalies: Array<"source_archived" | "image_unavailable">;
  dataAvailability: "ready";
  createdAt: string;
  updatedAt: string;
};

export type ExerciseLibraryReadModel = {
  actor: {
    trainerUserId: string;
    capabilities: {
      canRead: true;
      canCreateCustomExercise: false;
      canEditCustomExercise: false;
      canArchiveCustomExercise: false;
    };
  };
  filters: ExerciseLibraryFilters;
  items: ExerciseLibraryItem[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  dataAvailability: "ready";
  readAt: string;
};

export type ExerciseSelectionSnapshot = {
  sourceExerciseId: string;
  sourceExerciseKey: string;
  title: string;
  category: string;
  equipment: string | null;
  description: string | null;
  imageUrl: string | null;
};

export function createExerciseSelectionSnapshot(
  detail: ExerciseDetailReadModel,
): ExerciseSelectionSnapshot | null {
  if (!detail.canSelect || detail.status !== "active") return null;
  return {
    sourceExerciseId: detail.exerciseId,
    sourceExerciseKey: detail.stableKey,
    title: detail.title,
    category: detail.category ?? "",
    equipment: detail.equipment,
    description: detail.description,
    imageUrl: detail.image.availability === "ready" ? detail.image.url : null,
  };
}

export function projectExerciseSourceAvailability(input: {
  sourceExerciseId: string | null;
  sourceExerciseKey: string | null;
  detail: ExerciseDetailReadModel | null;
}): ExerciseSourceAvailability {
  if (!input.sourceExerciseId) {
    return input.sourceExerciseKey ? "source_not_mapped" : "unavailable";
  }
  if (!input.detail) return "unavailable";
  return input.detail.status === "archived" ? "archived" : "ready";
}
