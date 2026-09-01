import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import type { ExerciseLibraryReadModel } from "@/lib/exercise-library-contract";
import {
  decodeExerciseLibraryCursor,
  encodeExerciseLibraryCursor,
} from "./exercise-library-cursor";
import { ExerciseLibraryRepository } from "./exercise-library-repository";
import {
  ExerciseLibraryValidationError,
  type ExerciseLibraryFindInput,
  type NormalizedExerciseLibraryInput,
} from "./exercise-library-types";

export class ExerciseLibraryQueryService {
  constructor(private readonly repository = new ExerciseLibraryRepository()) {}

  async list(actor: Actor, raw: ExerciseLibraryFindInput = {}): Promise<ExerciseLibraryReadModel> {
    const input = normalizeInput(raw);
    const filters = {
      query: input.query,
      category: input.category,
      equipment: input.equipment,
      bodyRegion: input.bodyRegion,
      scope: input.scope,
    };
    const cursor = input.after
      ? decodeExerciseLibraryCursor(input.after, { trainerUserId: actor.userId, filters })
      : null;
    const page = await this.repository.list(actor, input, cursor);
    const endCursor = page.hasNextPage && page.last
      ? encodeExerciseLibraryCursor({
          trainerUserId: actor.userId,
          filters,
          sortTitle: page.last.sort_title,
          exerciseId: page.last.id,
        })
      : null;
    return {
      actor: {
        trainerUserId: actor.userId,
        capabilities: {
          canRead: true,
          canCreateCustomExercise: false,
          canEditCustomExercise: false,
          canArchiveCustomExercise: false,
        },
      },
      filters: { ...filters, pageSize: input.first },
      items: page.items,
      pageInfo: { endCursor, hasNextPage: page.hasNextPage },
      dataAvailability: "ready",
      readAt: new Date().toISOString(),
    };
  }

  detail(actor: Actor, exerciseId: string) {
    return this.repository.findDetail(actor, exerciseId);
  }
}

export function normalizeExerciseLibraryInput(
  raw: ExerciseLibraryFindInput = {},
): NormalizedExerciseLibraryInput {
  return normalizeInput(raw);
}

function normalizeInput(raw: ExerciseLibraryFindInput): NormalizedExerciseLibraryInput {
  const query = bounded(raw.query, 200, true);
  const category = bounded(raw.category, 120, true);
  const equipment = bounded(raw.equipment, 160, true);
  const bodyRegion = bounded(raw.bodyRegion, 120, true);
  const scope = raw.scope?.trim() || "all";
  const first = raw.first ?? 25;
  if (!(["all", "system", "trainer"] as const).includes(scope as "all" | "system" | "trainer")) {
    throw new ExerciseLibraryValidationError();
  }
  if (!Number.isInteger(first) || first < 1 || first > 50) {
    throw new ExerciseLibraryValidationError();
  }
  return {
    query,
    category,
    equipment,
    bodyRegion,
    scope: scope as "all" | "system" | "trainer",
    first,
    after: raw.after?.trim() || null,
  };
}

function bounded(value: string | null | undefined, max: number, lower: boolean) {
  const result = (value ?? "").trim();
  if (result.length > max || result.includes("\0")) throw new ExerciseLibraryValidationError();
  return lower ? result.toLocaleLowerCase("ru-RU") : result;
}
