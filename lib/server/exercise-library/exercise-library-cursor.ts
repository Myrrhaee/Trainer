import type { ExerciseLibraryFilters } from "@/lib/exercise-library-contract";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExerciseLibraryCursor = {
  trainerUserId: string;
  filters: Omit<ExerciseLibraryFilters, "pageSize">;
  sortTitle: string;
  exerciseId: string;
};

export class ExerciseLibraryInvalidCursorError extends Error {
  constructor() {
    super("invalid_cursor");
  }
}

export function encodeExerciseLibraryCursor(cursor: ExerciseLibraryCursor) {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeExerciseLibraryCursor(
  value: string,
  expected: Pick<ExerciseLibraryCursor, "trainerUserId" | "filters">,
): ExerciseLibraryCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      parsed.v !== 1
      || parsed.trainerUserId !== expected.trainerUserId
      || JSON.stringify(parsed.filters) !== JSON.stringify(expected.filters)
      || typeof parsed.sortTitle !== "string"
      || parsed.sortTitle.length > 160
      || typeof parsed.exerciseId !== "string"
      || !UUID_PATTERN.test(parsed.exerciseId)
    ) {
      throw new ExerciseLibraryInvalidCursorError();
    }
    return {
      trainerUserId: expected.trainerUserId,
      filters: expected.filters,
      sortTitle: parsed.sortTitle,
      exerciseId: parsed.exerciseId,
    };
  } catch (error) {
    if (error instanceof ExerciseLibraryInvalidCursorError) throw error;
    throw new ExerciseLibraryInvalidCursorError();
  }
}
