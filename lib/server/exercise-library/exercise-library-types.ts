import type { ExerciseScope } from "@/lib/exercise-library-contract";

export type ExerciseLibraryFindInput = {
  query?: string | null;
  category?: string | null;
  equipment?: string | null;
  bodyRegion?: string | null;
  scope?: string | null;
  after?: string | null;
  first?: number;
};

export type NormalizedExerciseLibraryInput = {
  query: string;
  category: string;
  equipment: string;
  bodyRegion: string;
  scope: "all" | ExerciseScope;
  first: number;
  after: string | null;
};

export class ExerciseLibraryValidationError extends Error {
  constructor() {
    super("exercise_library_validation_failed");
  }
}
